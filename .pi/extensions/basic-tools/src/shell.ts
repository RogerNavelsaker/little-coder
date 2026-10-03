/**
 * `shell` tool — Nushell-backed command execution with environment mode handling.
 *
 * Replaces bash-style command execution with structured Nushell execution.
 * Supports environment modes: auto, current, none, direnv, clean.
 *
 * Phase 19: Shell Runtime Dogfood Fix
 * - Visible failure summary in content.text for nonzero exits, timeouts,
 *   Nu parser errors, spawn errors, and stderr-only failures.
 * - Pi-specific Nushell config resolution: PI_NUSHELL_CONFIG →
 *   ~/.config/pi/nushell/config.nu → clean/no-config.
 */
import { Type } from '@sinclair/typebox';
import { spawn, spawnSync, type ChildProcess } from 'child_process';
import { resolve, join } from 'path';
import { existsSync, readFileSync } from 'fs';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Text } from '@earendil-works/pi-tui';
import { error } from './output.js';
import { encodeToon } from './toon.js';
import { makeThrottle } from './display.js';

// ---- Container environment detection ----

export function isContainerEnvironment(): boolean {
  if (process.env.WARREN_RUNTIME === 'docker' || process.env.WARREN_RUNTIME === 'container') return true;
  if (existsSync('/.dockerenv') || existsSync('/run/.containerenv')) return true;
  if (process.env.container === 'docker' || process.env.container === 'podman' || process.env.container === 'oci') return true;
  try {
    if (existsSync('/proc/1/cgroup')) {
      const cgroup = readFileSync('/proc/1/cgroup', 'utf-8');
      if (cgroup.includes('docker') || cgroup.includes('containerd') || cgroup.includes('kubepods')) {
        return true;
      }
    }
  } catch { /* ignore */ }
  return false;
}

// ---- Bubblewrap read-only shell helpers ----

function isBwrapAvailable(): boolean {
  return isBinaryAvailable('bwrap');
}

/**
 * Build the bubblewrap command args for a read-only sandbox.
 * - Bind cwd read-only
 * - Provide writable tmpfs /tmp
 * - Bind minimal system paths read-only (nu, common utils)
 * - Minimal env
 * - No network (--die-with-parent + no --share-network)
 */
function buildBwrapArgs(command: string, targetCwd: string, nuBin: string): string[] {
  const args: string[] = [
    '--die-with-parent',
    // CWD read-only
    '--ro-bind', targetCwd, targetCwd,
    // Writable tmpfs /tmp
    '--tmpfs', '/tmp',
    // Dev/proc/sys for basic system access
    '--dev-bind', '/dev', '/dev',
    '--proc', '/proc',
    // Bind minimal system paths read-only (use --ro-bind for dirs)
    '--ro-bind', '/usr', '/usr',
    '--ro-bind', '/bin', '/bin',
    '--ro-bind', '/lib', '/lib',
    '--ro-bind', '/lib64', '/lib64',
    '--ro-bind', '/etc', '/etc',
    '--ro-bind', '/nix', '/nix',
    // Nu binary — bind to a writable tmpfs location so bwrap can create symlinks
    '--tmpfs', '/tmp/bin',
    '--bind', nuBin, '/tmp/bin/nu',
    // Minimal env
    '--clearenv',
    '--setenv', 'HOME', targetCwd,
    '--setenv', 'USER', process.env.USER ?? 'pi',
    '--setenv', 'PATH', '/tmp/bin:/usr/bin:/bin:/nix/store/*/bin',
    '--setenv', 'TERM', process.env.TERM ?? 'xterm-256color',
    '--setenv', 'NU_CONFIG_PATH', resolve(process.env.HOME ?? '', '.config', 'pi', 'nushell', 'config.nu'),
    // No network
    '--unshare-all',
    // Run the command (bwrap -- COMMAND [ARGS...])
    '--',
    'nu', '-c', command,
  ];
  return args;
}

/**
 * Execute a command inside a bubblewrap sandbox.
 * Returns structured result with readonlyShell/sandbox metadata.
 */
function runBwrapSandbox(
  command: string,
  targetCwd: string,
  timeoutMs: number,
  nuBin: string,
): { stdout: string; stderr: string; exitCode: number; durationMs: number; timedOut: boolean; bwrapError?: string } {
  const start = Date.now();
  const bwrapArgs = buildBwrapArgs(command, targetCwd, nuBin);

  // Check if bwrap is available
  if (!isBwrapAvailable()) {
    return {
      stdout: '',
      stderr: '',
      exitCode: -1,
      durationMs: Date.now() - start,
      timedOut: false,
      bwrapError: 'bubblewrap (bwrap) not found — add it to the devenv or Nix environment',
    };
  }

  try {
    const result = spawnSync('bwrap', bwrapArgs, {
      cwd: targetCwd,
      env: { ...process.env },
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024 * 10,
    });
    const durationMs = Date.now() - start;
    const timedOut = result.status === null || result.status === 124 || durationMs >= timeoutMs;
    return {
      stdout: result.stdout?.toString() ?? '',
      stderr: result.stderr?.toString() ?? '',
      exitCode: result.status ?? 1,
      durationMs,
      timedOut,
    };
  } catch (err) {
    return {
      stdout: '',
      stderr: `bwrap execution failed: ${err instanceof Error ? err.message : String(err)}`,
      exitCode: -1,
      durationMs: Date.now() - start,
      timedOut: false,
    };
  }
}
import { loadSettings } from './settings.js';
import {
  type DisplayMode,
  formatShellCompact,
  formatStarshipHeader,
  formatStarshipPrompt,
  SHELL_GUIDANCE,
} from './display.js';
import { writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';

// ---- Resolve binaries ----

function resolveNuBin(): string {
  if (process.env.NU_BIN) return process.env.NU_BIN;
  try {
    const { execSync } = require('child_process');
    const p = execSync('which nu 2>/dev/null || true', { encoding: 'utf-8' }).trim();
    if (p) return p;
  } catch { /* continue */ }
  return 'nu';
}

// ---- Pi Nushell config resolution ----
// Follows the pi-hashline-readmap pattern: PI_NUSHELL_CONFIG > ~/.config/pi/nushell/config.nu > clean.
// This is the backend-tool config surface for Nu plugins, aliases, and agent-safe defaults.
// User interactive shell config is intentionally separate.

const PI_NUSHELL_CONFIG_PATH = join(process.env.HOME ?? '', '.config', 'pi', 'nushell', 'config.nu');

/**
 * Resolve the Nushell config path for backend tool execution.
 *
 * Priority:
 * 1. PI_NUSHELL_CONFIG environment variable (explicit override)
 * 2. ~/.config/pi/nushell/config.nu (Pi-specific config file)
 * 3. undefined (clean/no-config execution via --no-config-file)
 *
 * Returns { configPath: string | undefined, configSource: string }.
 */
function resolveNuConfig(): { configPath: string | undefined; configSource: string } {
  // 1. Check PI_NUSHELL_CONFIG env var
  const envPath = process.env.PI_NUSHELL_CONFIG;
  if (envPath && existsSync(envPath)) {
    return { configPath: envPath, configSource: 'env:PI_NUSHELL_CONFIG' };
  }
  // 1b. Even if set but missing, honor it (caller can handle missing)
  if (envPath) {
    return { configPath: envPath, configSource: 'env:PI_NUSHELL_CONFIG (missing)' };
  }
  // 2. Check ~/.config/pi/nushell/config.nu
  if (existsSync(PI_NUSHELL_CONFIG_PATH)) {
    return { configPath: PI_NUSHELL_CONFIG_PATH, configSource: PI_NUSHELL_CONFIG_PATH };
  }
  // 3. Check bundled default config (.pi/nushell/config.nu)
  const bundledCandidates = [
    resolve(__dirname, '../../../nushell/config.nu'),
    resolve(__dirname, '../../nushell/config.nu'),
    join(process.cwd(), '.pi', 'nushell', 'config.nu'),
  ];
  for (const cand of bundledCandidates) {
    if (existsSync(cand)) {
      return { configPath: cand, configSource: cand };
    }
  }
  // 4. No config — clean execution
  return { configPath: undefined, configSource: 'clean (no config)' };
}

/**
 * Build the Nu invocation prefix based on config resolution.
 */
function buildNuPrefix(configPath: string | undefined): string[] {
  if (configPath) {
    return ['--config', configPath];
  }
  return ['--no-config-file'];
}

function oneLine(value: unknown, max = 96): string {
  const line = String(value ?? '').split('\n').find(l => l.trim().length > 0)?.trim() ?? '';
  if (line.length <= max) return line;
  return `${line.slice(0, max - 1)}…`;
}

/**
 * Strip ANSI escape codes from output.
 */
export function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');
}

/**
 * Scrub and compact terminal noise (lean-ctx pattern):
 * - Strips ANSI codes
 * - Collapses long runs of passing test assertions (e.g. `✓ test name [0.1ms]`) when test passed
 * - Collapses repeated progress spinners / download bars
 * - Preserves failures, assertion errors, stack traces, and exit summaries intact
 */
export function scrubShellOutput(text: string, exitCode = 0): string {
  if (!text) return '';
  const clean = stripAnsi(text);
  const lines = clean.split('\n');

  // If exitCode is 0, we can safely collapse passing test assertions to a summary
  if (exitCode === 0) {
    const isPassingLine = (l: string) => /^\s*(✓|√|PASS|ok\b|test\s+\S+\s+\.\.\.\s+ok)/.test(l.trim());
    let passCount = 0;
    const scrubbed: string[] = [];

    for (const line of lines) {
      if (isPassingLine(line)) {
        passCount++;
      } else {
        if (passCount > 3) {
          scrubbed.push(`... [${passCount} passing tests collapsed] ...`);
          passCount = 0;
        } else if (passCount > 0) {
          for (let i = 0; i < passCount; i++) {
            // Keep up to 3 individual passing lines
            scrubbed.push(`(passed test)`);
          }
          passCount = 0;
        }
        scrubbed.push(line);
      }
    }
    if (passCount > 3) {
      scrubbed.push(`... [${passCount} passing tests collapsed] ...`);
    } else if (passCount > 0) {
      for (let i = 0; i < passCount; i++) scrubbed.push(`(passed test)`);
    }
    return scrubbed.join('\n');
  }

  // If failed (exitCode !== 0), preserve failing lines and stack traces, but collapse carriage returns
  const normalized = clean.replace(/\r+/g, '\n');
  return normalized;
}

/**
 * Check if a command string looks like a Nushell parser error.
 */
function looksLikeNuParserError(stderr: string): boolean {
  return /error:/.test(stderr) && /parse error|unexpected|expected|leftovers|mismatch/i.test(stderr);
}

/**
 * Build a visible failure summary for content.text.
 *
 * For success: returns undefined (success output stays in stdout, unchanged).
 * For failures: returns a concise summary string.
 */
function buildFailureSummary(
  exitCode: number,
  stdout: string,
  stderr: string,
  timeoutMs: number,
  durationMs: number,
  wasTimeout: boolean,
): string | undefined {
  if (exitCode === 0 && !wasTimeout && stderr.length === 0) {
    return undefined; // success — keep stdout as-is
  }

  const parts: string[] = [];

  // Timeout detection
  if (wasTimeout || (durationMs >= timeoutMs * 0.9 && exitCode !== 0)) {
    const reason = wasTimeout ? 'timeout' : 'near-timeout';
    parts.push(`[timeout] command timed out after ${durationMs}ms (limit: ${timeoutMs}ms)`);
  }

  // Nu parser errors
  if (looksLikeNuParserError(stderr)) {
    // Extract the first meaningful error line
    const errLines = stderr.split('\n').filter(l => l.trim().length > 0 && /error:/.test(l));
    if (errLines.length > 0) {
      parts.push(`[parser error] Nushell syntax error: ${errLines[0].trim().slice(0, 200)}`);
    } else {
      parts.push('[parser error] Nushell syntax error — see details.stderr');
    }
  }

  // Nonzero exit code
  if (exitCode !== 0 && !wasTimeout) {
    parts.push(`[exit ${exitCode}] command exited with code ${exitCode}`);
  }

  // Stderr-only failure (no stdout)
  if (stderr.length > 0 && stdout.length === 0) {
    const summary = stderr.split('\n').filter(l => l.trim().length > 0).slice(0, 3).join('; ');
    if (parts.length === 0 || !parts.some(p => p.includes('parser error') || p.includes('timeout'))) {
      parts.push(`[stderr] ${summary.slice(0, 300)}`);
    }
  }

  // If we still have nothing useful, show raw stderr
  if (parts.length === 0 && stderr.length > 0) {
    parts.push(`[stderr] ${stderr.slice(0, 500)}`);
  }

  if (parts.length === 0) {
    return undefined; // nothing to report
  }

  return parts.join(' | ');
}

function resolveDirenvBin(): string {
  if (process.env.DIRENV_BIN) return process.env.DIRENV_BIN;
  try {
    const { execSync } = require('child_process');
    const p = execSync('which direnv 2>/dev/null || true', { encoding: 'utf-8' }).trim();
    if (p) return p;
  } catch { /* continue */ }
  return 'direnv';
}

function resolveTruBin(): string {
  if (process.env.TRU_BIN) return process.env.TRU_BIN;
  try {
    const { execSync } = require('child_process');
    const p = execSync('which tru 2>/dev/null || true', { encoding: 'utf-8' }).trim();
    if (p) return p;
  } catch { /* continue */ }
  return 'tru';
}

const NU_BIN = resolveNuBin();
const DIRENV_BIN = resolveDirenvBin();
const TRU_BIN = resolveTruBin();

// ---- Mode types ----

export type ShellEnvMode = 'auto' | 'current' | 'none' | 'direnv' | 'clean';

export type ShellBackend = 'nu' | 'nu+direnv' | 'nu-clean';

export interface ShellToolParams {
  commands: string[];
  cwd?: string;
  env?: ShellEnvMode;
  mode?: 'text' | 'json' | 'nuon' | 'toon';
  timeout_ms?: number | string;
  display?: DisplayMode;
  readonly_shell?: boolean;
  /** Agent-facing camelCase alias for readonly_shell. */
  readonlyShell?: boolean;
}

// ---- Helpers ----

function detectActiveEnv(): { direnv: boolean; direnvDir?: string } {
  const env = process.env;
  return {
    direnv: Boolean(env.DIRENV_DIR) || Boolean(env.DIRENV_WATCHES),
    direnvDir: env.DIRENV_DIR,
  };
}

function hasEnvrc(dirPath: string): boolean {
  return existsSync(resolve(dirPath, '.envrc'));
}

function runNuCommand(
  args: string[],
  cwd: string,
  timeoutMs: number,
): { stdout: string; stderr: string; exitCode: number; durationMs: number; timedOut: boolean } {
  const start = Date.now();
  const result = spawnSync(NU_BIN, args, {
    cwd,
    env: { ...process.env },
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024 * 10,
  });
  const durationMs = Date.now() - start;
  const timedOut = result.status === null || result.status === 124 || durationMs >= timeoutMs;
  return {
    stdout: result.stdout?.toString() ?? '',
    stderr: result.stderr?.toString() ?? '',
    exitCode: result.status ?? 1,
    durationMs,
    timedOut,
  };
}

function isBinaryAvailable(bin: string): boolean {
  try {
    const result = spawnSync(bin, ['--version'], {
      cwd: process.cwd(),
      env: { ...process.env },
      timeout: 3000,
      maxBuffer: 1024 * 1024,
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

/**
 * Stream nu execution with throttled onUpdate.
 * Returns { stdout, stderr, exitCode, durationMs, timedOut }.
 */
function runNuStreaming(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  timeoutMs: number,
  onUpdate: (update: unknown) => void,
): Promise<{ stdout: string; stderr: string; exitCode: number; durationMs: number; timedOut: boolean }> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const proc: ChildProcess = spawn(command, args, { cwd, env });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      try { proc.kill(); } catch { /* already dead */ }
    }, timeoutMs);

    // Initial "started" signal
    onUpdate({ content: [], details: undefined } as any);

    const throttle = makeThrottle(500);
    proc.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
      throttle(() => {
        onUpdate({ content: [], details: { stdout } } as any);
      });
    });

    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on('close', (exitCode) => {
      clearTimeout(timer);
      const durationMs = Date.now() - start;
      resolve({ stdout, stderr, exitCode: exitCode ?? 1, durationMs, timedOut });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Resolve the environment mode and build the activation command.
 */
function resolveEnvMode(
  mode: ShellEnvMode,
  targetCwd: string,
): { backend: ShellBackend; activationCommand: string; envResolved: string } {
  const detected = detectActiveEnv();

  switch (mode) {
    case 'current':
    case 'none':
      return {
        backend: 'nu',
        activationCommand: '',
        envResolved: 'current (inherited environment)',
      };
    case 'clean':
      return {
        backend: 'nu-clean',
        activationCommand: '',
        envResolved: 'clean (HOME, USER, PATH, TERM only)',
      };
    case 'direnv': {
      const bin = isBinaryAvailable(DIRENV_BIN) ? DIRENV_BIN : 'direnv';
      return {
        backend: 'nu+direnv',
        activationCommand: `${bin} exec ${targetCwd} nu -c`,
        envResolved: `direnv exec ${targetCwd}`,
      };
    }
    case 'auto':
    default:
      if (detected.direnv) {
        return {
          backend: 'nu',
          activationCommand: '',
          envResolved: `auto (already in direnv: ${detected.direnvDir})`,
        };
      }
      if (hasEnvrc(targetCwd) && isBinaryAvailable(DIRENV_BIN)) {
        const bin = DIRENV_BIN;
        return {
          backend: 'nu+direnv',
          activationCommand: `${bin} exec ${targetCwd} nu -c`,
          envResolved: `auto (found .envrc in ${targetCwd})`,
        };
      }
      return {
        backend: 'nu',
        activationCommand: '',
        envResolved: 'auto (no direnv detected, plain nu)',
      };
  }
}

/**
 * Exported executeShellOp for invocation harnesses & tool dispatchers.
 */
export async function executeShellOp(
  _toolCallId: string,
  params: any,
  _signal?: AbortSignal,
  _onUpdate?: (update: unknown) => void,
  ctx: { cwd: string } = { cwd: process.cwd() }
) {
  if (Array.isArray(params.ops) && params.ops.length > 0) {
    if (params.ops.length === 1) {
      return executeShellOp(_toolCallId, { ...params.ops[0], ops: undefined }, _signal, _onUpdate, ctx);
    }
    const results = await Promise.all(
      params.ops.map(op => executeShellOp(_toolCallId, op, _signal, _onUpdate, ctx))
    );
    const allOk = results.every(r => !(r as any).isError);
    const shellMap: Record<string, unknown> = {};
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const opSpec = params.ops[i];
      const key = (opSpec.commands && opSpec.commands[0]) ?? opSpec.command ?? `cmd_${i}`;
      const d = (r as any).details ?? {};
      shellMap[key] = { exitCode: d.exitCode ?? 0, stdout: d.stdout ?? '', stderr: d.stderr ?? '' };
    }
    return {
      content: [{ type: 'text' as const, text: encodeToon({ shell: shellMap }).text }],
      details: {
        runs: results.map(r => (r as any).details),
        totalRuns: params.ops.length,
      },
      ...(!allOk ? { isError: true } : {}),
    };
  }

  const commands = params.commands ?? (params.command ? [params.command] : []);
  const requestedPath = params.cwd ? (params.cwd.startsWith('@') ? params.cwd.slice(1) : params.cwd) : ctx.cwd;
  const targetCwd = resolve(ctx.cwd, requestedPath);
  const envMode: ShellEnvMode = (params.env ?? 'auto') as ShellEnvMode;
  const mode = (params.mode ?? 'text') as 'text' | 'json' | 'nuon' | 'toon';
  const timeoutMs = typeof params.timeout_ms === 'string' ? parseInt(params.timeout_ms, 10) : (params.timeout_ms ?? 30000);

  if (!existsSync(targetCwd)) {
    return {
      content: [{ type: 'text', text: error('not-found', `CWD not found: ${targetCwd}`, { tool: 'shell', path: targetCwd }).message }],
      isError: true,
      details: {
        cwd: targetCwd,
        command: commands[0] ?? '',
        shell: 'nu',
        envRequested: envMode,
        envResolved: 'not-found',
        activationCommand: '',
        exitCode: -1,
        stdout: '',
        stderr: `CWD not found: ${targetCwd}`,
        durationMs: 0,
        truncated: false,
        mode,
      },
    };
  }

  if (commands.length > 1) {
    const mResolved = resolveEnvMode(envMode, targetCwd);
    const mNuConfig = resolveNuConfig();
    const mPrefix = buildNuPrefix(mNuConfig.configPath);
    const shellMap: Record<string, unknown> = {};
    let anyError = false;
    for (const cmd of commands) {
      const nuCmd = mode === 'json' ? `${cmd} | to json`
        : mode === 'nuon' ? `${cmd} | to nuon`
        : cmd;

      let cOut = '';
      let cErr = '';
      let cExit = 1;
      let cDur = 0;
      let cTimedOut = false;

      try {
        if (mResolved.backend === 'nu-clean') {
          const cleanEnv: NodeJS.ProcessEnv = {
            HOME: process.env.HOME ?? '',
            USER: process.env.USER ?? '',
            PATH: process.env.PATH ?? '/usr/bin:/bin',
            TERM: process.env.TERM ?? 'xterm-256color',
          };
          const res = await runNuStreaming(NU_BIN, [...mPrefix, '-c', nuCmd], targetCwd, cleanEnv, timeoutMs, _onUpdate as any);
          cOut = res.stdout; cErr = res.stderr; cExit = res.exitCode; cDur = res.durationMs; cTimedOut = res.timedOut;
        } else if (mResolved.backend === 'nu+direnv') {
          const bin = isBinaryAvailable(DIRENV_BIN) ? DIRENV_BIN : 'direnv';
          const res = await runNuStreaming(bin, ['exec', targetCwd, NU_BIN, ...mPrefix, '-c', nuCmd], targetCwd, { ...process.env }, timeoutMs, _onUpdate as any);
          cOut = res.stdout; cErr = res.stderr; cExit = res.exitCode; cDur = res.durationMs; cTimedOut = res.timedOut;
        } else {
          const res = await runNuStreaming(NU_BIN, [...mPrefix, '-c', nuCmd], targetCwd, { ...process.env }, timeoutMs, _onUpdate as any);
          cOut = res.stdout; cErr = res.stderr; cExit = res.exitCode; cDur = res.durationMs; cTimedOut = res.timedOut;
        }
      } catch (err) {
        cErr = err instanceof Error ? err.message : String(err);
        cExit = -1;
      }

      if (cExit !== 0 || cTimedOut) anyError = true;
      shellMap[cmd] = [{ exitCode: cExit, durationMs: cDur, stdout: cOut, stderr: cErr }];
    }

    return {
      content: [{ type: 'text', text: encodeToon({ shell: shellMap }).text }],
      isError: anyError,
      details: {
        cwd: targetCwd,
        commands,
        multiCommand: true,
        totalCommands: commands.length,
      },
    };
  }

  const command = commands[0] ?? '';
  const isReadonly = params.readonlyShell === true || params.readonly_shell === true || process.env.PI_READONLY_SHELL === '1';
  if (isReadonly && !isContainerEnvironment()) {
    if (!isBwrapAvailable()) {
      return {
        content: [{ type: 'text', text: error('binary-failed', 'bubblewrap (bwrap) is not available on PATH for read-only shell execution', { tool: 'sh' }).message }],
        isError: true,
        details: {
          cwd: targetCwd,
          command,
          readonlyShell: true,
          exitCode: -1,
        },
      };
    }

    const nuConfig = resolveNuConfig();
    const bwrapArgs = buildBwrapArgs(command, targetCwd, NU_BIN);
    const startMs = Date.now();
    let bwrapStdout = '';
    let bwrapStderr = '';
    let bwrapExitCode = 1;
    let bwrapTimedOut = false;

    try {
      const r = spawnSync('bwrap', bwrapArgs, {
        cwd: targetCwd,
        encoding: 'utf-8',
        timeout: timeoutMs,
        env: {
          HOME: process.env.HOME ?? '',
          PATH: '/usr/bin:/bin',
          TERM: process.env.TERM ?? 'xterm-256color',
        },
      });
      bwrapStdout = r.stdout ?? '';
      bwrapStderr = r.stderr ?? '';
      bwrapExitCode = r.status ?? (r.signal ? 128 : 1);
      if (r.error && (r.error as any).code === 'ETIMEDOUT') {
        bwrapTimedOut = true;
      }
    } catch (err) {
      bwrapStderr = err instanceof Error ? err.message : String(err);
      bwrapExitCode = -1;
    }

    const bwrapDurationMs = Date.now() - startMs;
    const bwrapFailureSummary = buildFailureSummary(
      bwrapExitCode,
      bwrapStdout,
      bwrapStderr,
      timeoutMs,
      bwrapDurationMs,
      bwrapTimedOut,
    );
    let bwrapUserText = encodeToon({ shell: [{ exitCode: bwrapExitCode, durationMs: bwrapDurationMs, stdout: bwrapStdout, stderr: bwrapStderr }] }).text;
    if (bwrapFailureSummary) {
      bwrapUserText += '\n' + bwrapFailureSummary;
    }

    return {
      content: [{ type: 'text', text: bwrapUserText }],
      isError: bwrapExitCode !== 0 || bwrapTimedOut,
      details: {
        cwd: targetCwd,
        command,
        envResolved: 'readonly (bubblewrap)',
        configResolved: nuConfig.configSource,
        exitCode: bwrapExitCode,
        stdout: bwrapStdout,
        stderr: bwrapStderr,
        durationMs: bwrapDurationMs,
        truncated: false,
        timedOut: bwrapTimedOut,
        readonlyShell: true,
        sandbox: 'bubblewrap',
        sandboxArgs: ['--die-with-parent', '--bind', targetCwd, '--tmpfs', '/tmp', '--clearenv', '--unshare-all'],
      },
    };
  }

  const { backend, activationCommand, envResolved } = resolveEnvMode(envMode, targetCwd);
  const nuConfig = resolveNuConfig();

  let stdout = '';
  let stderr = '';
  let exitCode = 1;
  let durationMs = 0;
  let timedOut = false;

  const nuArgsBase = buildNuPrefix(nuConfig.configPath);
  const nuCommand = mode === 'json' ? `${command} | to json`
    : mode === 'nuon' ? `${command} | to nuon`
    : command;

  try {
    if (backend === 'nu-clean') {
      const cleanEnv: NodeJS.ProcessEnv = {
        HOME: process.env.HOME ?? '',
        USER: process.env.USER ?? '',
        PATH: process.env.PATH ?? '/usr/bin:/bin',
        TERM: process.env.TERM ?? 'xterm-256color',
      };
      const result = await runNuStreaming(
        NU_BIN,
        [...nuArgsBase, '-c', nuCommand],
        targetCwd,
        cleanEnv,
        timeoutMs,
        _onUpdate as any,
      );
      stdout = result.stdout;
      stderr = result.stderr;
      exitCode = result.exitCode;
      durationMs = result.durationMs;
      timedOut = result.timedOut;
    } else if (backend === 'nu+direnv') {
      const bin = isBinaryAvailable(DIRENV_BIN) ? DIRENV_BIN : 'direnv';
      const result = await runNuStreaming(
        bin,
        ['exec', targetCwd, NU_BIN, ...nuArgsBase, '-c', nuCommand],
        targetCwd,
        { ...process.env },
        timeoutMs,
        _onUpdate as any,
      );
      stdout = result.stdout;
      stderr = result.stderr;
      exitCode = result.exitCode;
      durationMs = result.durationMs;
      timedOut = result.timedOut;
    } else {
      const result = await runNuStreaming(
        NU_BIN,
        [...nuArgsBase, '-c', nuCommand],
        targetCwd,
        { ...process.env },
        timeoutMs,
        _onUpdate as any,
      );
      stdout = result.stdout;
      stderr = result.stderr;
      exitCode = result.exitCode;
      durationMs = result.durationMs;
      timedOut = result.timedOut;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: error('binary-failed', `nu execution failed: ${msg}`, { tool: 'shell', details: { command } }).message }],
      isError: true,
      details: {
        cwd: targetCwd,
        envResolved,
        configResolved: nuConfig.configSource,
        exitCode: -1,
        stdout: '',
        stderr: msg,
        durationMs: 0,
        truncated: false,
        timedOut: false,
      },
    };
  }

  const { settings, warnings } = loadSettings(ctx.cwd);
  const settingsWarning = warnings.length > 0 ? warnings.join('; ') : undefined;
  const maxLines = settings.shellMaxVisibleLines;
  const maxBytes = settings.shellMaxVisibleBytes;
  const headLines = settings.shellHeadLines;
  const tailLines = settings.shellTailLines;
  const saveFull = settings.shellSaveFullOutput;

  const failureSummary = buildFailureSummary(exitCode, stdout, stderr, timeoutMs, durationMs, timedOut);

  // Apply pattern-based compaction and noise scrubbing (lean-ctx pattern)
  const scrubbedStdout = scrubShellOutput(stdout, exitCode);
  const scrubbedStderr = scrubShellOutput(stderr, exitCode);

  const stdoutExceeds = scrubbedStdout.length > maxBytes || scrubbedStdout.split('\n').length > maxLines;
  const stderrExceeds = scrubbedStderr.length > maxBytes || scrubbedStderr.split('\n').length > maxLines;
  const stdoutTruncated = stdoutExceeds;
  const stderrTruncated = stderrExceeds;

  let stdoutPreview = scrubbedStdout;
  if (stdoutTruncated) {
    const lines = scrubbedStdout.split('\n');
    const head = lines.slice(0, headLines).join('\n');
    const tail = lines.slice(-tailLines).join('\n');
    stdoutPreview = `[oversized: ${lines.length} lines, ${stdout.length} bytes — head ${headLines} lines + tail ${tailLines} lines]\n${head}\n... [${lines.length - headLines - tailLines} lines omitted] ...\n${tail}`;
  }

  let stderrPreview = stderr;
  if (stderrTruncated) {
    const lines = stderr.split('\n');
    const head = lines.slice(0, headLines).join('\n');
    const tail = lines.slice(-tailLines).join('\n');
    stderrPreview = `[oversized: ${lines.length} lines, ${stderr.length} bytes — head ${headLines} lines + tail ${tailLines} lines]\n${head}\n... [${lines.length - headLines - tailLines} lines omitted] ...\n${tail}`;
  }

  let fullOutputPath: string | undefined;
  if (saveFull && (stdoutTruncated || stderrTruncated)) {
    try {
      const tmpDir = mkdtempSync(join(tmpdir(), 'pi-shell-'));
      const tmpFile = join(tmpDir, `shell-${Date.now()}.txt`);
      writeFileSync(tmpFile, `=== stdout ===\n${stdout}\n=== stderr ===\n${stderr}`, 'utf-8');
      fullOutputPath = tmpFile;
    } catch { /* ignore */ }
  }

  let userText = encodeToon({ shell: [{ exitCode, durationMs, stdout: (stdoutTruncated ? stdoutPreview : scrubbedStdout), stderr: (stderrTruncated ? stderrPreview : scrubbedStderr) }] }).text;
  if (failureSummary) userText += '\n' + failureSummary;

  return {
    content: [{ type: 'text', text: userText }],
    isError: exitCode !== 0 || timedOut,
    details: {
      cwd: targetCwd,
      command,
      display: params.display,
      envResolved: (isReadonly && isContainerEnvironment()) ? 'readonly (container)' : envResolved,
      configResolved: nuConfig.configSource,
      exitCode,
      stdout: stdoutTruncated ? stdoutPreview : stdout,
      stderr: stderrTruncated ? stderrPreview : stderr,
      durationMs,
      truncated: stdoutTruncated || stderrTruncated,
      timedOut,
      ...(isReadonly && isContainerEnvironment() ? { readonlyShell: true, sandbox: 'container' } : {}),
      ...(fullOutputPath ? { fullOutputPath } : {}),
      ...(settingsWarning ? { settingsWarning } : {}),
    },
  };
}

/**
 * Register the shell tool with pi.
 */
export function registerShellTool(pi: ExtensionAPI) {
  const shellItemSchema = Type.Object({
    command: Type.Optional(Type.String({ description: 'Single command string' })),
    commands: Type.Optional(Type.Array(Type.String(), { description: 'Nushell commands array' })),
    cwd: Type.Optional(Type.String()),
    env: Type.Optional(Type.String()),
    timeout_ms: Type.Optional(Type.Union([Type.Number(), Type.String()])),
    readonlyShell: Type.Optional(Type.Boolean()),
  });

  const shellSchema = Type.Object({
    ops: Type.Optional(Type.Array(shellItemSchema, { description: 'Shell operations array. Single: ops: [{command: "echo hi"}]. Multi: ops: [{command: "echo 1"}, {command: "echo 2"}]' })),
    commands: Type.Optional(Type.Array(Type.String(), { description: 'Nushell commands to execute. Single: ["cmd"]. Multi: ["cmd1","cmd2",...] — share cwd/env/timeout.' })),
    command: Type.Optional(Type.String({ description: 'Single Nushell command' })),
    cwd: Type.Optional(Type.String({ description: 'Working directory for command execution' })),
    env: Type.Optional(
      Type.Union([
        Type.Literal('auto', { description: 'Auto-detect active direnv or use .envrc when available' }),
        Type.Literal('current', { description: 'Use inherited environment directly' }),
        Type.Literal('none', { description: 'Use inherited environment directly (alias for current)' }),
        Type.Literal('direnv', { description: 'Use direnv exec for cwd' }),
        Type.Literal('clean', { description: 'Minimal env: HOME, USER, PATH, TERM only' }),
      ], { description: 'Environment mode for command execution' })
    ),
    timeout_ms: Type.Optional(
      Type.Union([
        Type.Number({ description: 'Timeout in milliseconds' }),
        Type.String({ description: 'Timeout in milliseconds' }),
      ], { description: 'Command timeout (default: 30000)' })
    ),
    display: Type.Optional(
      Type.Union([
        Type.Literal('auto', { description: 'Auto: starship header & prompt when expanded (default)' }),
        Type.Literal('starship', { description: 'Starship-style header (CWD + right-aligned status/runtime) and prompt' }),
        Type.Literal('plain', { description: 'Plain: backend/env info and raw stdout/stderr without starship header' }),
        Type.Literal('compact', { description: 'Compact: 1-5 short visible lines' }),
        Type.Literal('table', { description: 'Markdown table via renderResult' }),
        Type.Literal('full', { description: 'Compact summary + stdout/stderr sections' }),
      ], { description: 'Display mode: auto (default), starship, plain, compact, table, or full' })
    ),
    readonly_shell: Type.Optional(
      Type.Boolean({ description: 'Run command inside a bubblewrap read-only sandbox (PoC)' })
    ),
    readonlyShell: Type.Optional(
      Type.Boolean({ description: 'Run command inside a bubblewrap read-only sandbox (agent-facing alias)' })
    ),
  });

  function createShellTool(toolName: string, toolLabel: string) {
    return {
      name: toolName,
      label: toolLabel,
      description:
        'Execute Nushell commands with structured result envelopes. Pass ops: [{command: "..."}] or command: "..." directly.',
      promptSnippet: 'Execute Nushell commands and CLI tools',
      promptGuidelines: [
        'Pass ops: [{command: "..."}] or command: "..." directly.',
        'sh executes Nushell syntax, not POSIX/bash. Use Nu pipeline operators (|) and Nu commands.',
        'Prefer find, grep, ls, read, edit, and write tools for file discovery and file work.',
        'Prefer native CLI tools available in the devenv (e.g. search.nu, fetch.nu, docling.nu, rg, fd, etc.).',
        'Avoid bash redirection syntax: 2>/dev/null and 2>&1 do not work in Nushell. Use out+err> or o+e>.',
        'Use sh for command execution, verification, package managers, git commands, and structured data pipelines.',
      ],
      parameters: shellSchema,
      renderCall(args: any, theme: any, _context: any) {
        const params = args as Partial<ShellToolParams>;
        const command = oneLine(params.commands?.[0] || (params as any).command, 110);
        const env = params.env ? ` env=${params.env}` : '';
        const cwd = params.cwd ? ` cwd=${params.cwd}` : '';
        const mode = params.mode && params.mode !== 'text' ? ` mode=${params.mode}` : '';
        let text = theme.fg('toolTitle', theme.bold(`${toolName} `));
        text += theme.fg('accent', command || '(empty command)');
        if (env || cwd || mode) {
          text += theme.fg('dim', `${env}${cwd}${mode}`);
        }
        return new Text(text, 0, 0);
      },
      renderResult(result: any, { expanded, isPartial }: any, theme: any, _context: any) {
        if (isPartial) return new Text(theme.fg('warning', 'Running...'), 0, 0);

        const details = (result as {
          details?: {
            cwd?: string;
            command?: string;
            exitCode?: number;
            durationMs?: number;
            stdout?: string;
            stderr?: string;
            backend?: string;
            envResolved?: string;
            truncated?: boolean;
            fullOutputPath?: string;
            display?: DisplayMode;
            runs?: any[];
          };
        }).details;

        const displayParam = details?.display ?? (result as { params?: { display?: DisplayMode } }).params?.display;
        const isCompact = displayParam === 'compact';
        const isPlain = displayParam === 'plain';

        if (!expanded || isCompact) {
          const exitCode = details?.exitCode;
          const output = oneLine(details?.stderr || details?.stdout, 140);
          const status = exitCode === 0 ? theme.fg('success', 'exit 0') : theme.fg('error', `exit ${exitCode ?? '?'}`);
          const duration = typeof details?.durationMs === 'number' ? theme.fg('dim', ` ${details.durationMs}ms`) : '';
          let text = `${status}${duration}`;
          if (output) {
            text += theme.fg(exitCode === 0 ? 'muted' : 'warning', ` ${output}`);
          }
          return new Text(text, 0, 0);
        }

        if (isPlain) {
          const exitCode = details?.exitCode;
          const output = oneLine(details?.stderr || details?.stdout, 140);
          const status = exitCode === 0 ? theme.fg('success', 'exit 0') : theme.fg('error', `exit ${exitCode ?? '?'}`);
          const duration = typeof details?.durationMs === 'number' ? theme.fg('dim', ` ${details.durationMs}ms`) : '';
          let text = `${status}${duration}`;
          if (output) {
            text += theme.fg(exitCode === 0 ? 'muted' : 'warning', ` ${output}`);
          }
          if (details) {
            if (details.backend) text += `\n${theme.fg('dim', `backend: ${details.backend}`)}`;
            if (details.envResolved) text += `\n${theme.fg('dim', `env: ${details.envResolved}`)}`;
            if (details.stdout) text += `\n${details.stdout}`;
            if (details.stderr) text += `\n${theme.fg('warning', details.stderr)}`;
            if (details.truncated) {
              const hint = details.fullOutputPath ? ` · full output at ${details.fullOutputPath}` : '';
              text += `\n${theme.fg('muted', `… output truncated${hint}`)}`;
            }
          }
          return new Text(text, 0, 0);
        }

        // Expanded Starship view (default)
        const width = Math.max(20, (theme as any)?.terminalWidth ?? (_context as any)?.terminalWidth ?? (process.stdout?.columns || 80));

        if (details?.runs && Array.isArray(details.runs)) {
          const renderedRuns = details.runs.map((run: any) => {
            const rCwd = run?.cwd ?? process.cwd();
            const rCommand = run?.command ?? '';
            const rExitCode = run?.exitCode ?? 0;
            const rDurationMs = run?.durationMs ?? 0;
            const rHeader = formatStarshipHeader({
              cwd: rCwd,
              exitCode: rExitCode,
              durationMs: rDurationMs,
              width,
              theme,
            });
            const rPrompt = formatStarshipPrompt(rCommand, theme);
            let rText = `${rHeader}\n${rPrompt}`;
            if (run?.stdout) {
              const stdout = run.stdout.replace(/\n+$/, '');
              if (stdout) rText += `\n${stdout}`;
            }
            if (run?.stderr) {
              const stderr = run.stderr.replace(/\n+$/, '');
              if (stderr) rText += `\n${theme.fg('warning', stderr)}`;
            }
            return rText;
          });
          return new Text(renderedRuns.join('\n\n'), 0, 0);
        }

        const cwd = details?.cwd ?? process.cwd();
        const command = details?.command ?? (Array.isArray((details as any)?.commands) ? (details as any).commands.join('; ') : '');
        const exitCode = details?.exitCode ?? (result?.isError ? 1 : 0);
        const durationMs = details?.durationMs ?? 0;

        const header = formatStarshipHeader({
          cwd,
          exitCode,
          durationMs,
          width,
          theme,
        });
        const prompt = formatStarshipPrompt(command, theme);

        let text = `${header}\n${prompt}`;

        if (details?.stdout) {
          const stdout = details.stdout.replace(/\n+$/, '');
          if (stdout) {
            text += `\n${stdout}`;
          }
        }
        if (details?.stderr) {
          const stderr = details.stderr.replace(/\n+$/, '');
          if (stderr) {
            text += `\n${theme.fg('warning', stderr)}`;
          }
        }
        if (details?.truncated) {
          const hint = details.fullOutputPath ? ` · full output at ${details.fullOutputPath}` : '';
          text += `\n${theme.fg('muted', `… output truncated${hint}`)}`;
        }

        return new Text(text, 0, 0);
      },
      async execute(toolCallId: string, params: any, signal: any, onUpdate: any, ctx: any) {
        return executeShellOp(toolCallId, params, signal, onUpdate as any, ctx) as any;
      },
    };
  }

  pi.registerTool(createShellTool('sh', 'sh'));
  pi.registerTool(createShellTool('shell', 'Shell'));
}

/**
 * Register the shell/sh tool result hook.
 * Override isError for nonzero exits and timeouts.
 * (Pi agent loop ignores execute-level isError; hook is the real card-color path)
 * Call this from your extension after registerShellTool(pi).
 */
export function registerShellResultHook(pi: ExtensionAPI) {
  pi.on('tool_result', async (event) => {
    if (event.toolName !== 'shell' && event.toolName !== 'sh') return undefined;
    const details = event.details as { exitCode?: number; timedOut?: boolean } | undefined;
    const exitCode = details?.exitCode;
    const timedOut = details?.timedOut;
    if (exitCode !== undefined && exitCode !== 0) {
      return { isError: true };
    }
    if (timedOut === true) {
      return { isError: true };
    }
    return undefined;
  });
}

