/**
 * Settings loader for pi-structural-tools.
 *
 * Precedence (highest → lowest):
 *   1. Environment variables (CTX_GUARD_*)
 *   2. Project settings: <repo>/.pi/structural-tools/settings.json
 *   3. Global settings: ~/.pi/agent/pi-structural-tools/settings.json
 *   4. Built-in defaults
 *
 * Invalid config degrades safely: a visible warning is emitted but
 * the tool continues with built-in defaults.
 */
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';

// ---- Built-in defaults ----

const DEFAULT_EXCLUDES = ['.git/**', 'node_modules/**', '.direnv/**', '.flox/**', '.cache/**'];

export interface Settings {
  /** Default glob patterns to exclude from grep/find (generic, not session logs) */
  defaultExcludes: string[];
  /** Maximum visible lines for grep output */
  grepMaxVisibleLines: number;
  /** Maximum visible bytes for grep output */
  grepMaxVisibleBytes: number;
  /** Maximum visible entries for find output */
  findMaxEntries: number;
  /** Maximum visible entries for ls output */
  lsMaxEntries: number;
  /** Maximum visible lines for read output */
  readMaxVisibleLines: number;
  /** Maximum visible bytes for read output */
  readMaxVisibleBytes: number;
  /** Maximum visible lines for shell output */
  shellMaxVisibleLines: number;
  /** Maximum visible bytes for shell output */
  shellMaxVisibleBytes: number;
  /** Number of head lines to show for oversized shell output */
  shellHeadLines: number;
  /** Number of tail lines to show for oversized shell output */
  shellTailLines: number;
  /** Whether to save full shell output to temp file */
  shellSaveFullOutput: boolean;
  /** Maximum visible matches for ast_search */
  astSearchMaxMatches: number;
}

const BUILTIN_DEFAULTS: Settings = {
  defaultExcludes: DEFAULT_EXCLUDES,
  grepMaxVisibleLines: 500,
  grepMaxVisibleBytes: 32768,
  findMaxEntries: 500,
  lsMaxEntries: 300,
  readMaxVisibleLines: 2000,
  readMaxVisibleBytes: 51200,
  shellMaxVisibleLines: 1200,
  shellMaxVisibleBytes: 49152,
  shellHeadLines: 80,
  shellTailLines: 120,
  shellSaveFullOutput: true,
  astSearchMaxMatches: 300,
};

// ---- Environment variable overrides ----

function envNum(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw === 'true' || raw === '1' || raw === 'yes';
}

function envStrArray(name: string, fallback: string[]): string[] {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

function applyEnvOverrides(settings: Settings): Settings {
  return {
    ...settings,
    grepMaxVisibleLines: envNum('CTX_GUARD_GREP_MAX_VISIBLE_LINES', settings.grepMaxVisibleLines),
    grepMaxVisibleBytes: envNum('CTX_GUARD_GREP_MAX_VISIBLE_BYTES', settings.grepMaxVisibleBytes),
    findMaxEntries: envNum('CTX_GUARD_FIND_MAX_ENTRIES', settings.findMaxEntries),
    lsMaxEntries: envNum('CTX_GUARD_LS_MAX_ENTRIES', settings.lsMaxEntries),
    readMaxVisibleLines: envNum('CTX_GUARD_READ_MAX_VISIBLE_LINES', settings.readMaxVisibleLines),
    readMaxVisibleBytes: envNum('CTX_GUARD_READ_MAX_VISIBLE_BYTES', settings.readMaxVisibleBytes),
    shellMaxVisibleLines: envNum('CTX_GUARD_SHELL_MAX_VISIBLE_LINES', settings.shellMaxVisibleLines),
    shellMaxVisibleBytes: envNum('CTX_GUARD_SHELL_MAX_VISIBLE_BYTES', settings.shellMaxVisibleBytes),
    shellHeadLines: envNum('CTX_GUARD_SHELL_HEAD_LINES', settings.shellHeadLines),
    shellTailLines: envNum('CTX_GUARD_SHELL_TAIL_LINES', settings.shellTailLines),
    shellSaveFullOutput: envBool('CTX_GUARD_SHELL_SAVE_FULL_OUTPUT', settings.shellSaveFullOutput),
    astSearchMaxMatches: envNum('CTX_GUARD_AST_SEARCH_MAX_MATCHES', settings.astSearchMaxMatches),
  };
}

// ---- JSON config loading ----

/**
 * Load a JSON settings file safely.
 * Returns null on any failure (missing file, parse error, etc.)
 * and pushes a warning string to warnings if there was a parse error.
 */
function loadJsonSettings(filePath: string, warnings: string[]): Record<string, unknown> | null {
  if (!existsSync(filePath)) return null;
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      warnings.push(`settings.json at ${filePath}: top-level value is not an object, ignoring`);
      return null;
    }
    return parsed;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warnings.push(`settings.json at ${filePath}: parse error (${msg}), ignoring`);
    return null;
  }
}

/**
 * Merge a JSON settings object into the settings structure.
 * Only known keys are applied; unknown keys are silently ignored.
 * Invalid values (present key but wrong type) produce a warning.
 */
function mergeSettings(settings: Settings, json: Record<string, unknown>, warnings: string[]): Settings {
  const next = { ...settings };

  if (Array.isArray(json.default_excludes) || Array.isArray(json.defaultExcludes)) {
    const arr = (json.default_excludes ?? json.defaultExcludes) as unknown[];
    const filtered = arr.filter((v): v is string => typeof v === 'string' && v.length > 0);
    if (filtered.length > 0) next.defaultExcludes = filtered;
  }

  if (json.grep_max_visible_lines !== undefined) {
    if (typeof json.grep_max_visible_lines === 'number' && json.grep_max_visible_lines > 0) {
      next.grepMaxVisibleLines = json.grep_max_visible_lines as number;
    } else {
      warnings.push('grep_max_visible_lines: invalid value, ignoring');
    }
  }
  if (json.grep_max_visible_bytes !== undefined) {
    if (typeof json.grep_max_visible_bytes === 'number' && json.grep_max_visible_bytes > 0) {
      next.grepMaxVisibleBytes = json.grep_max_visible_bytes as number;
    } else {
      warnings.push('grep_max_visible_bytes: invalid value, ignoring');
    }
  }
  if (json.find_max_entries !== undefined) {
    if (typeof json.find_max_entries === 'number' && json.find_max_entries > 0) {
      next.findMaxEntries = json.find_max_entries as number;
    } else {
      warnings.push('find_max_entries: invalid value, ignoring');
    }
  }
  if (json.ls_max_entries !== undefined) {
    if (typeof json.ls_max_entries === 'number' && json.ls_max_entries > 0) {
      next.lsMaxEntries = json.ls_max_entries as number;
    } else {
      warnings.push('ls_max_entries: invalid value, ignoring');
    }
  }
  if (json.read_max_visible_lines !== undefined) {
    if (typeof json.read_max_visible_lines === 'number' && json.read_max_visible_lines > 0) {
      next.readMaxVisibleLines = json.read_max_visible_lines as number;
    } else {
      warnings.push('read_max_visible_lines: invalid value, ignoring');
    }
  }
  if (json.read_max_visible_bytes !== undefined) {
    if (typeof json.read_max_visible_bytes === 'number' && json.read_max_visible_bytes > 0) {
      next.readMaxVisibleBytes = json.read_max_visible_bytes as number;
    } else {
      warnings.push('read_max_visible_bytes: invalid value, ignoring');
    }
  }
  if (json.shell_max_visible_lines !== undefined) {
    if (typeof json.shell_max_visible_lines === 'number' && json.shell_max_visible_lines > 0) {
      next.shellMaxVisibleLines = json.shell_max_visible_lines as number;
    } else {
      warnings.push('shell_max_visible_lines: invalid value, ignoring');
    }
  }
  if (json.shell_max_visible_bytes !== undefined) {
    if (typeof json.shell_max_visible_bytes === 'number' && json.shell_max_visible_bytes > 0) {
      next.shellMaxVisibleBytes = json.shell_max_visible_bytes as number;
    } else {
      warnings.push('shell_max_visible_bytes: invalid value, ignoring');
    }
  }
  if (json.shell_head_lines !== undefined) {
    if (typeof json.shell_head_lines === 'number' && json.shell_head_lines > 0) {
      next.shellHeadLines = json.shell_head_lines as number;
    } else {
      warnings.push('shell_head_lines: invalid value, ignoring');
    }
  }
  if (json.shell_tail_lines !== undefined) {
    if (typeof json.shell_tail_lines === 'number' && json.shell_tail_lines > 0) {
      next.shellTailLines = json.shell_tail_lines as number;
    } else {
      warnings.push('shell_tail_lines: invalid value, ignoring');
    }
  }
  if (json.shell_save_full_output !== undefined) {
    if (typeof json.shell_save_full_output === 'boolean') {
      next.shellSaveFullOutput = json.shell_save_full_output as boolean;
    } else {
      warnings.push('shell_save_full_output: invalid value, ignoring');
    }
  }
  if (json.ast_search_max_matches !== undefined) {
    if (typeof json.ast_search_max_matches === 'number' && json.ast_search_max_matches > 0) {
      next.astSearchMaxMatches = json.ast_search_max_matches as number;
    } else {
      warnings.push('ast_search_max_matches: invalid value, ignoring');
    }
  }

  return next;
}

// ---- Global settings path ----

function getGlobalSettingsPath(): string {
  const home = process.env.HOME;
  if (!home) return '';
  return join(home, '.pi', 'agent', 'pi-structural-tools', 'settings.json');
}

// ---- Project settings path ----

function getProjectSettingsPath(repoRoot: string): string {
  return join(repoRoot, '.pi', 'structural-tools', 'settings.json');
}

// ---- Main loader ----

export interface LoadSettingsResult {
  settings: Settings;
  warnings: string[];
}

/**
 * Load settings with full precedence chain.
 *
 * @param repoRoot - Optional repository root for project-level settings.
 *   When not provided, only global settings + built-in defaults are used.
 */
export function loadSettings(repoRoot?: string): LoadSettingsResult {
  const warnings: string[] = [];

  // Start with built-in defaults
  let settings: Settings = { ...BUILTIN_DEFAULTS };

  // 3. Global settings
  const globalPath = getGlobalSettingsPath();
  const globalJson = loadJsonSettings(globalPath, warnings);
  if (globalJson) {
    settings = mergeSettings(settings, globalJson, warnings);
  }

  // 2. Project settings
  if (repoRoot) {
    const projectPath = getProjectSettingsPath(repoRoot);
    const projectJson = loadJsonSettings(projectPath, warnings);
    if (projectJson) {
      settings = mergeSettings(settings, projectJson, warnings);
    }
  }

  // 1. Environment overrides (highest precedence)
  settings = applyEnvOverrides(settings);

  return { settings, warnings };
}

/**
 * Get just the built-in defaults (for testing).
 */
export function getBuiltInDefaults(): Settings {
  return { ...BUILTIN_DEFAULTS };
}
