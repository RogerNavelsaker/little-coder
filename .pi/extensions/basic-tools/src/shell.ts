/**
 * `shell` tool — Nushell-backed command execution with environment mode handling.
 *
 * Replaces bash-style command execution with structured Nushell execution.
 * Supports environment modes: auto, current, none, flox, flox-default,
 * flox-temp (deferred), direnv, clean.
 *
 * Phase 19: Shell Runtime Dogfood Fix
 * - Visible failure summary in content.text for nonzero exits, timeouts,
 *   Nu parser errors, spawn errors, and stderr-only failures.
 * - Pi-specific Nushell config resolution: PI_NUSHELL_CONFIG →
 *   ~/.config/pi/nushell/config.nu → clean/no-config.
 */
import { Type } from '@sinclair/typebox';
import { spawn, spawnSync } from 'child_process';
import { resolve, join, dirname } from 'path';
import { existsSync, readFileSync, readdirSync } from 'fs';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Text } from '@earendil-works/pi-tui';
import { error } from '../../_shared/output.js';

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
      bwrapError: 'bubblewrap (bwrap) not found — install with: flox install bubblewrap || nix-shell -p bubblewrap',
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
import { loadSettings } from '../../_shared/settings.js';
import { type DisplayMode, formatShellCompact, SHELL_GUIDANCE } from '../../_shared/display.js';
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
  // 3. No config — clean execution
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

function firstContentText(result: unknown): string {
  const content = (result as { content?: Array<{ type?: string; text?: string }> })?.content;
  return content?.find(item => item.type === 'text' && item.text)?.text ?? '';
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

function resolveFloxBin(): string {
  if (process.env.FLOX_BIN) return process.env.FLOX_BIN;
  try {
    const { execSync } = require('child_process');
    const p = execSync('which flox 2>/dev/null || true', { encoding: 'utf-8' }).trim();
    if (p) return p;
  } catch { /* continue */ }
  return 'flox';
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
const FLOX_BIN = resolveFloxBin();
const TRU_BIN = resolveTruBin();

// ---- Mode types ----

export type ShellEnvMode =
  | 'auto'
  | 'current'
  | 'none'
  | 'flox'
  | 'flox-default'
  | 'flox-temp'
  | 'direnv'
  | 'clean';

export type ShellBackend =
  | 'nu'
  | 'nu+direnv'
  | 'nu+flox'
  | 'nu+flox-default'
  | 'nu+flox-temp'
  | 'nu-clean';

export interface ShellToolParams {
  command: string;
  cwd?: string;
  env?: ShellEnvMode;
  packages?: string[];
  start_services?: boolean | string;
  mode?: 'text' | 'json' | 'nuon' | 'toon';
  timeout_ms?: number | string;
  display?: DisplayMode;
  readonly_shell?: boolean;
  /** Agent-facing camelCase alias for readonly_shell. */
  readonlyShell?: boolean;
}

// ---- Helpers ----

function detectActiveEnv(): { flox: boolean; direnv: boolean; floxName?: string; direnvDir?: string } {
  const env = process.env;
  const flox = Boolean(env.FLOX_ACTIVE_ENVIRONMENTS) || Boolean(env.FLOX_ENVIRONMENT_NAME);
  const direnv = Boolean(env.DIRENV_DIR) || Boolean(env.DIRENV_WATCHES);
  return {
    flox,
    direnv,
    floxName: env.FLOX_ENVIRONMENT_NAME,
    direnvDir: env.DIRENV_DIR,
  };
}

function hasEnvrc(dirPath: string): boolean {
  return existsSync(resolve(dirPath, '.envrc'));
}

function hasFlox(dirPath: string): boolean {
  return existsSync(resolve(dirPath, '.flox'));
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
 * Resolve the environment mode and build the activation command.
 */
function resolveEnvMode(
  mode: ShellEnvMode,
  targetCwd: string,
): { backend: ShellBackend; activationCommand: string; packages: string[]; envResolved: string } {
  const detected = detectActiveEnv();

  switch (mode) {
    case 'current':
    case 'none': {
      return {
        backend: 'nu',
        activationCommand: '',
        packages: [],
        envResolved: detected.flox ? `current (flox: ${detected.floxName})` : 'current (none)',
      };
    }
    case 'clean': {
      return {
        backend: 'nu-clean',
        activationCommand: '',
        packages: [],
        envResolved: 'clean (HOME, USER, PATH, TERM only)',
      };
    }
    case 'direnv': {
      const bin = isBinaryAvailable(DIRENV_BIN) ? DIRENV_BIN : 'direnv';
      return {
        backend: 'nu+direnv',
        activationCommand: `${bin} exec ${targetCwd} nu -c`,
        packages: [],
        envResolved: `direnv exec ${targetCwd}`,
      };
    }
    case 'flox': {
      const bin = isBinaryAvailable(FLOX_BIN) ? FLOX_BIN : 'flox';
      return {
        backend: 'nu+flox',
        activationCommand: `${bin} activate -d ${targetCwd} --no-start-services -- nu -c`,
        packages: [],
        envResolved: `flox activate -d ${targetCwd}`,
      };
    }
    case 'flox-default': {
      const bin = isBinaryAvailable(FLOX_BIN) ? FLOX_BIN : 'flox';
      return {
        backend: 'nu+flox-default',
        activationCommand: `${bin} activate -d /home/rona --no-start-services -- nu -c`,
        packages: [],
        envResolved: 'flox activate -d /home/rona (default)',
      };
    }
    case 'flox-temp': {
      return {
        backend: 'nu+flox-temp',
        activationCommand: '# DEFERRED: flox activate has no -p flag; requires temp .flox manifest',
        packages: [],
        envResolved: 'flox-temp (deferred — no -p flag in flox activate)',
      };
    }
    case 'auto':
    default: {
      if (detected.flox) {
        return {
          backend: 'nu',
          activationCommand: '',
          packages: [],
          envResolved: `auto (already in flox: ${detected.floxName})`,
        };
      }
      if (detected.direnv) {
        return {
          backend: 'nu',
          activationCommand: '',
          packages: [],
          envResolved: `auto (already in direnv: ${detected.direnvDir})`,
        };
      }
      if (hasEnvrc(targetCwd) && isBinaryAvailable(DIRENV_BIN)) {
        const bin = DIRENV_BIN;
        return {
          backend: 'nu+direnv',
          activationCommand: `${bin} exec ${targetCwd} nu -c`,
          packages: [],
          envResolved: `auto (found .envrc in ${targetCwd})`,
        };
      }
      if (hasFlox(targetCwd)) {
        const bin = isBinaryAvailable(FLOX_BIN) ? FLOX_BIN : 'flox';
        return {
          backend: 'nu+flox',
          activationCommand: `${bin} activate -d ${targetCwd} --no-start-services -- nu -c`,
          packages: [],
          envResolved: `auto (found .flox in ${targetCwd})`,
        };
      }
      return {
        backend: 'nu',
        activationCommand: '',
        packages: [],
        envResolved: 'auto (no flox/direnv detected, plain nu)',
      };
    }
  }
}

/**
 * Register the shell tool with pi.
 */
export function registerShellTool(pi: ExtensionAPI) {
  const shellSchema = Type.Object({
    command: Type.String({ description: 'Nushell command or shell command to execute' }),
    cwd: Type.Optional(Type.String({ description: 'Working directory for command execution' })),
    env: Type.Optional(
      Type.Union([
        Type.Literal('auto', { description: 'Auto-detect: check for active flox/direnv, then .envrc/.flox' }),
        Type.Literal('current', { description: 'Use inherited environment directly' }),
        Type.Literal('none', { description: 'Use inherited environment directly (alias for current)' }),
        Type.Literal('flox', { description: 'Activate flox env at cwd' }),
        Type.Literal('flox-default', { description: 'Activate flox default env (/home/rona)' }),
        Type.Literal('flox-temp', { description: 'Temporary flox activation with packages (deferred)' }),
        Type.Literal('direnv', { description: 'Use direnv exec for cwd' }),
        Type.Literal('clean', { description: 'Minimal env: HOME, USER, PATH, TERM only' }),
      ], { description: 'Environment mode for command execution' })
    ),
    packages: Type.Optional(Type.Array(Type.String(), { description: 'Packages to install for flox-temp mode' })),
    start_services: Type.Optional(
      Type.Union([
        Type.Boolean({ description: 'Start flox services on activation' }),
        Type.String({ description: 'Start flox services on activation' }),
      ], { description: 'Start flox services (default: false)' })
    ),
    mode: Type.Optional(
      Type.Union([
        Type.Literal('text', { description: 'Plain text output' }),
        Type.Literal('json', { description: 'JSON output' }),
        Type.Literal('nuon', { description: 'Nushell ON output' }),
        Type.Literal('toon', { description: 'TOON output via tru' }),
      ], { description: 'Output format (default: text)' })
    ),
    timeout_ms: Type.Optional(
      Type.Union([
        Type.Number({ description: 'Timeout in milliseconds' }),
        Type.String({ description: 'Timeout in milliseconds' }),
      ], { description: 'Command timeout (default: 30000)' })
    ),
    display: Type.Optional(
      Type.Union([
        Type.Literal('auto', { description: 'Auto: compact by default, fuller when expanded (default)' }),
        Type.Literal('compact', { description: 'Compact: 1-5 short visible lines' }),
        Type.Literal('table', { description: 'Markdown table via renderResult' }),
        Type.Literal('full', { description: 'Compact summary + stdout/stderr sections' }),
      ], { description: 'Display mode: auto (default), compact, table, or full' })
    ),
    readonly_shell: Type.Optional(
      Type.Boolean({ description: 'Run command inside a bubblewrap read-only sandbox (PoC)' })
    ),
    readonlyShell: Type.Optional(
      Type.Boolean({ description: 'Run command inside a bubblewrap read-only sandbox (agent-facing alias)' })
    ),
  });

  pi.registerTool({
    name: 'shell',
    label: 'Shell',
    description:
      'Execute commands with structured result envelopes. '
      + 'Supports environment modes (auto, current, none, flox, flox-default, flox-temp, direnv, clean). '
      + 'Returns exit code, stdout, stderr, duration, and truncation metadata.',
    promptSnippet: 'Execute commands with environment modes',
    promptGuidelines: [
      'shell executes Nushell syntax, not POSIX/bash. Use Nu pipeline operators (|) and Nu commands.',
      'Prefer find, grep, ls, read, edit, and write tools for file discovery and file work — not shell.',
      'Avoid bash redirection syntax: 2>/dev/null and 2>&1 do not work in Nushell.',
      'In Nushell, redirect stdout+stderr with out+err> or o+e>. Redirect stdout with out>. Redirect stderr with err>.',
      'Use shell for command execution, verification, package managers, git commands, and structured data pipelines.',
      'Use env: "clean" for minimal environment (no flox/direnv).',
      'Use env: "flox-default" to use the default flox stack.',
      'Use env: "auto" to auto-detect active environments.',
      'Use timeout_ms to set command timeout.',
      'Report non-zero exits and timeouts as evidence, not as hidden failures.',
      'Oversized output is bounded: head/tail preview with full output saved to temp file.',
      'Use readonlyShell: true to run shell inside the Bubblewrap read-only sandbox when a read-only command execution boundary is needed.',
    ],
    parameters: shellSchema,
    renderCall(args, theme, _context) {
      const params = args as Partial<ShellToolParams>;
      const command = oneLine(params.command, 110);
      const env = params.env ? ` env=${params.env}` : '';
      const cwd = params.cwd ? ` cwd=${params.cwd}` : '';
      const mode = params.mode && params.mode !== 'text' ? ` mode=${params.mode}` : '';
      let text = theme.fg('toolTitle', theme.bold('shell '));
      text += theme.fg('accent', command || '(empty command)');
      if (env || cwd || mode) {
        text += theme.fg('dim', `${env}${cwd}${mode}`);
      }
      return new Text(text, 0, 0);
    },
    renderResult(result, { expanded, isPartial }, theme, _context) {
      if (isPartial) return new Text(theme.fg('warning', 'Running...'), 0, 0);

      const details = (result as {
        details?: {
          exitCode?: number;
          durationMs?: number;
          stdout?: string;
          stderr?: string;
          backend?: string;
          envResolved?: string;
        };
      }).details;
      const exitCode = details?.exitCode;
      const output = oneLine(firstContentText(result) || details?.stderr || details?.stdout, 140);
      const status = exitCode === 0 ? theme.fg('success', 'exit 0') : theme.fg('error', `exit ${exitCode ?? '?'}`);
      const duration = typeof details?.durationMs === 'number' ? theme.fg('dim', ` ${details.durationMs}ms`) : '';
      let text = `${status}${duration}`;
      if (output) {
        text += theme.fg(exitCode === 0 ? 'muted' : 'warning', ` ${output}`);
      }

      // Phase 21: auto mode shows fuller view when expanded; compact forces compact
      const displayParam = (result as { params?: { display?: DisplayMode } }).params?.display;
      const isAuto = displayParam === undefined || displayParam === 'auto';
      const isCompact = displayParam === 'compact';
      const showFull = expanded && !isCompact && isAuto;

      if (showFull && details) {
        if (details.backend) text += `\n${theme.fg('dim', `backend: ${details.backend}`)}`;
        if (details.envResolved) text += `\n${theme.fg('dim', `env: ${details.envResolved}`)}`;
        const stdout = oneLine(details.stdout, 180);
        const stderr = oneLine(details.stderr, 180);
        if (stdout) text += `\n${theme.fg('muted', `stdout: ${stdout}`)}`;
        if (stderr) text += `\n${theme.fg('warning', `stderr: ${stderr}`)}`;
      }

      return new Text(text, 0, 0);
    },
    async execute(_toolCallId, params: ShellToolParams, _signal, _onUpdate, ctx) {
      const requestedPath = params.cwd ? (params.cwd.startsWith('@') ? params.cwd.slice(1) : params.cwd) : ctx.cwd;
      const targetCwd = resolve(ctx.cwd, requestedPath);
      const envMode: ShellEnvMode = (params.env ?? 'auto') as ShellEnvMode;
      const startServices = params.start_services === true || params.start_services === 'true';
      const mode = (params.mode ?? 'text') as 'text' | 'json' | 'nuon' | 'toon';
      const timeoutMs = typeof params.timeout_ms === 'string' ? parseInt(params.timeout_ms, 10) : (params.timeout_ms ?? 30000);
      const packages = params.packages ?? [];

      // Validate target cwd
      if (!existsSync(targetCwd)) {
        return {
          content: [{ type: 'text', text: error('not-found', `CWD not found: ${targetCwd}`, { tool: 'shell', path: targetCwd }).message }],
          isError: true,
          details: {
            cwd: targetCwd,
            command: params.command,
            shell: 'nu',
            envRequested: envMode,
            envResolved: 'not-found',
            activationCommand: '',
            packages,
            exitCode: -1,
            stdout: '',
            stderr: `CWD not found: ${targetCwd}`,
            durationMs: 0,
            truncated: false,
            mode,
          },
        };
      }

      // Build the nu command with mode-based output formatting
      // Pipe through to text/json/toon for clean output
      let nuCommand = params.command;
      if (mode === 'json') {
        nuCommand = `${nuCommand} | to json`;
      } else if (mode === 'nuon') {
        nuCommand = `${nuCommand} | to nuon`;
      } else if (mode === 'toon') {
        nuCommand = `${nuCommand} | to json | tru`;
      } else {
        // text mode: pipe through to text for clean output
        nuCommand = `${nuCommand} | to text`;
      }

      // Resolve environment mode (determines backend and execution path)
      const resolved = resolveEnvMode(envMode, targetCwd);
      const { backend, activationCommand, envResolved } = resolved;

      // Resolve Nushell config for backend tool execution
      const nuConfig = resolveNuConfig();

      // ---- Bubblewrap read-only shell (Phase 22 PoC) ----
      // PI_READONLY_SHELL=1 is set by pi-dev for readonly/reviewer profiles,
      // enforcing the sandbox for every call regardless of tool param.
      const forceReadonly = process.env.PI_READONLY_SHELL === '1';
      if (params.readonly_shell || params.readonlyShell || forceReadonly) {
        const bwrapResult = runBwrapSandbox(
          nuCommand,
          targetCwd,
          timeoutMs,
          NU_BIN,
        );

        // Handle bwrap not available
        if (bwrapResult.bwrapError) {
          return {
            content: [{ type: 'text', text: error('unknown', bwrapResult.bwrapError, { tool: 'shell', details: { readonly: true } }).message }],
            isError: true,
            details: {
              cwd: targetCwd,
              command: params.command,
              shell: 'bwrap',
              envRequested: envMode,
              envResolved: 'readonly (bubblewrap)',
              configResolved: nuConfig.configSource,
              activationCommand: '',
              packages,
              exitCode: -1,
              stdout: '',
              stderr: bwrapResult.bwrapError,
              durationMs: bwrapResult.durationMs,
              truncated: false,
              timedOut: false,
              mode,
              readonlyShell: true,
              sandbox: 'bubblewrap',
            },
          };
        }

        const { stdout: bwrapStdout, stderr: bwrapStderr, exitCode: bwrapExitCode, durationMs: bwrapDurationMs, timedOut: bwrapTimedOut } = bwrapResult;
        const failureSummary = buildFailureSummary(bwrapExitCode, bwrapStdout, bwrapStderr, timeoutMs, bwrapDurationMs, bwrapTimedOut);
        const display = (params.display ?? 'auto') as DisplayMode;
        const compactResult = { exitCode: bwrapExitCode, durationMs: bwrapDurationMs, stdout: bwrapStdout, stderr: bwrapStderr };
        let userText = display === 'compact' ? formatShellCompact(compactResult) : formatShellCompact(compactResult);
        if (failureSummary) userText += '\n' + failureSummary;

        return {
          content: [{ type: 'text', text: userText }],
          isError: bwrapExitCode !== 0 || bwrapTimedOut,
          details: {
            cwd: targetCwd,
            command: params.command,
            shell: 'bwrap+nu',
            envRequested: envMode,
            envResolved: 'readonly (bubblewrap)',
            configResolved: nuConfig.configSource,
            activationCommand: '',
            packages,
            exitCode: bwrapExitCode,
            stdout: bwrapStdout,
            stderr: bwrapStderr,
            durationMs: bwrapDurationMs,
            truncated: false,
            timedOut: bwrapTimedOut,
            mode,
            readonlyShell: true,
            sandbox: 'bubblewrap',
            sandboxArgs: ['--die-with-parent', '--bind', targetCwd, '--tmpfs', '/tmp', '--clearenv', '--unshare-all'],
          },
        };
      }

      // Execute based on resolved backend
      let stdout = '';
      let stderr = '';
      let exitCode = 1;
      let durationMs = 0;
      let timedOut = false;

      // Build nu args with config resolution
      const nuArgsBase = buildNuPrefix(nuConfig.configPath);
      const start = Date.now();

      if (backend === 'nu-clean') {
        const cleanEnv = {
          HOME: process.env.HOME ?? '',
          USER: process.env.USER ?? '',
          PATH: process.env.PATH ?? '/usr/bin:/bin',
          TERM: process.env.TERM ?? 'xterm-256color',
        };
        const syncResult = spawnSync(NU_BIN, [...nuArgsBase, '-c', nuCommand], {
          cwd: targetCwd,
          env: cleanEnv,
          timeout: timeoutMs,
          maxBuffer: 1024 * 1024 * 10,
        });
        stdout = syncResult.stdout?.toString() ?? '';
        stderr = syncResult.stderr?.toString() ?? '';
        exitCode = syncResult.status ?? 1;
        durationMs = Date.now() - start;
        timedOut = syncResult.status === null || syncResult.status === 124 || durationMs >= timeoutMs;
      } else if (backend === 'nu+direnv') {
        const bin = isBinaryAvailable(DIRENV_BIN) ? DIRENV_BIN : 'direnv';
        const result = spawnSync(bin, ['exec', targetCwd, NU_BIN, ...nuArgsBase, '-c', nuCommand], {
          cwd: targetCwd,
          env: { ...process.env },
          timeout: timeoutMs,
          maxBuffer: 1024 * 1024 * 10,
        });
        stdout = result.stdout?.toString() ?? '';
        stderr = result.stderr?.toString() ?? '';
        exitCode = result.status ?? 1;
        durationMs = Date.now() - start;
        timedOut = result.status === null || result.status === 124 || durationMs >= timeoutMs;
      } else if (backend === 'nu+flox') {
        const bin = isBinaryAvailable(FLOX_BIN) ? FLOX_BIN : 'flox';
        const result = spawnSync(bin, ['activate', '-d', targetCwd, '--no-start-services', '--', NU_BIN, ...nuArgsBase, '-c', nuCommand], {
          cwd: targetCwd,
          env: { ...process.env },
          timeout: timeoutMs,
          maxBuffer: 1024 * 1024 * 10,
        });
        stdout = result.stdout?.toString() ?? '';
        stderr = result.stderr?.toString() ?? '';
        exitCode = result.status ?? 1;
        durationMs = Date.now() - start;
        timedOut = result.status === null || result.status === 124 || durationMs >= timeoutMs;
      } else if (backend === 'nu+flox-default') {
        const bin = isBinaryAvailable(FLOX_BIN) ? FLOX_BIN : 'flox';
        const result = spawnSync(bin, ['activate', '-d', '/home/rona', '--no-start-services', '--', NU_BIN, ...nuArgsBase, '-c', nuCommand], {
          cwd: targetCwd,
          env: { ...process.env },
          timeout: timeoutMs,
          maxBuffer: 1024 * 1024 * 10,
        });
        stdout = result.stdout?.toString() ?? '';
        stderr = result.stderr?.toString() ?? '';
        exitCode = result.status ?? 1;
        durationMs = Date.now() - start;
        timedOut = result.status === null || result.status === 124 || durationMs >= timeoutMs;
      } else {
        // nu (current, none, auto with no detection) — plain nu
        const result = spawnSync(NU_BIN, [...nuArgsBase, '-c', nuCommand], {
          cwd: targetCwd,
          env: { ...process.env },
          timeout: timeoutMs,
          maxBuffer: 1024 * 1024 * 10,
        });
        stdout = result.stdout?.toString() ?? '';
        stderr = result.stderr?.toString() ?? '';
        exitCode = result.status ?? 1;
        durationMs = Date.now() - start;
        timedOut = result.status === null || result.status === 124 || durationMs >= timeoutMs;
      }

      // Phase 20: Load settings for shell guards
      const { settings, warnings } = loadSettings(ctx.cwd);
      const settingsWarning = warnings.length > 0 ? warnings.join('; ') : undefined;
      const maxLines = settings.shellMaxVisibleLines;
      const maxBytes = settings.shellMaxVisibleBytes;
      const headLines = settings.shellHeadLines;
      const tailLines = settings.shellTailLines;
      const saveFull = settings.shellSaveFullOutput;

      // Phase 19: Visible failure summary in content.text
      // Phase 20: Oversized output head/tail preview + full output save
      const failureSummary = buildFailureSummary(exitCode, stdout, stderr, timeoutMs, durationMs, timedOut);

      // Determine if output exceeds visible budgets
      const stdoutExceeds = stdout.length > maxBytes || stdout.split('\n').length > maxLines;
      const stderrExceeds = stderr.length > maxBytes || stderr.split('\n').length > maxLines;
      const stdoutTruncated = stdoutExceeds;
      const stderrTruncated = stderrExceeds;

      // Build head/tail preview for oversized stdout
      let stdoutPreview = stdout;
      if (stdoutTruncated) {
        const lines = stdout.split('\n');
        const head = lines.slice(0, headLines).join('\n');
        const tail = lines.slice(-tailLines).join('\n');
        stdoutPreview = `[oversized: ${lines.length} lines, ${stdout.length} bytes — head ${headLines} lines + tail ${tailLines} lines]\n${head}\n... [${lines.length - headLines - tailLines} lines omitted] ...\n${tail}`;
      }

      // Build head/tail preview for oversized stderr
      let stderrPreview = stderr;
      if (stderrTruncated) {
        const lines = stderr.split('\n');
        const head = lines.slice(0, headLines).join('\n');
        const tail = lines.slice(-tailLines).join('\n');
        stderrPreview = `[oversized: ${lines.length} lines, ${stderr.length} bytes — head ${headLines} lines + tail ${tailLines} lines]\n${head}\n... [${lines.length - headLines - tailLines} lines omitted] ...\n${tail}`;
      }

      // Save full output to temp file when enabled
      let fullOutputPath: string | undefined;
      if (saveFull && (stdoutTruncated || stderrTruncated)) {
        try {
          const tmpDir = mkdtempSync(join(tmpdir(), 'pi-shell-'));
          const tmpFile = join(tmpDir, `shell-${Date.now()}.txt`);
          writeFileSync(tmpFile, `=== stdout ===\n${stdout}\n=== stderr ===\n${stderr}`, 'utf-8');
          fullOutputPath = tmpFile;
        } catch {
          // If saving fails, silently continue — the preview is still available
        }
      }

      // Build user text: display-aware (Phase 21)
      // auto/compact both use compact for content.text; renderResult handles expansion
      const display = (params.display ?? 'auto') as DisplayMode;
      const compactResult = {
        exitCode,
        durationMs,
        stdout: stdoutPreview,
        stderr: stderrPreview,
      };
      let userText: string;

      if (display === 'compact' || display === 'auto') {
        userText = formatShellCompact(compactResult);
        if (failureSummary) {
          userText += '\n' + failureSummary;
        }
      } else if (display === 'table') {
        userText = formatShellCompact(compactResult);
        if (failureSummary) {
          userText += '\n\n' + failureSummary;
        }
        if (stdoutPreview) {
          userText += '\n\n**stdout:**\n' + stdoutPreview;
        }
        if (stderrPreview) {
          userText += '\n\n**stderr:**\n' + stderrPreview;
        }
      } else {
        // Full
        userText = formatShellCompact(compactResult);
        if (failureSummary) {
          userText += '\n\n' + failureSummary;
        }
        if (stdoutPreview) {
          userText += '\n\n**stdout:**\n' + stdoutPreview;
        }
        if (stderrPreview) {
          userText += '\n\n**stderr:**\n' + stderrPreview;
        }
        if (envResolved) {
          userText += '\n\n' + SHELL_GUIDANCE;
        }
      }

      // For TOON mode, we already piped through tru in the command.
      // Calculate token savings if we have the original command output.
      let tokenSavings: number | undefined;

      if (mode === 'toon' && stdout && !failureSummary) {
        try {
          const jsonStr = JSON.stringify(JSON.parse(stdout), null, 2);
          tokenSavings = Math.round((1 - stdout.length / jsonStr.length) * 100);
        } catch {
          // stdout might not be valid JSON (tru output), skip token savings
        }
      }

      return {
        content: [{ type: 'text', text: userText }],
        isError: exitCode !== 0 || timedOut,
        details: {
          cwd: targetCwd,
          command: params.command,
          shell: 'nu',
          envRequested: envMode,
          envResolved,
          configResolved: nuConfig.configSource,
          activationCommand,
          packages,
          exitCode,
          stdout: stdoutTruncated ? stdoutPreview : stdout,
          stderr: stderrTruncated ? stderrPreview : stderr,
          durationMs,
          truncated: stdoutTruncated || stderrTruncated,
          timedOut,
          mode,
          tokenSavings,
          visibleBudget: { maxLines, maxBytes },
          ...(fullOutputPath ? { fullOutputPath } : {}),
          ...(settingsWarning ? { settingsWarning } : {}),
        },
      };
    },
  });
}

/**
 * Register the shell tool result hook.
 * Override isError for nonzero exits and timeouts.
 * (Pi agent loop ignores execute-level isError; hook is the real card-color path)
 * Call this from your extension after registerShellTool(pi).
 */
export function registerShellResultHook(pi: ExtensionAPI) {
  pi.on('tool_result', async (event) => {
    if (event.toolName !== 'shell') return undefined;
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
