/**
 * Unified settings loader for little-coder configuration.
 *
 * Precedence (highest -> lowest):
 * 1. Process environment variables (LITTLE_CODER_*)
 * 2. Workspace settings: `<workspace>/.pi/settings.json` ("little_coder" object)
 * 3. User settings: `~/.pi/agent/settings.json` ("little_coder" object)
 * 4. Built-in defaults
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export interface LittleCoderSettings {
  roles: {
    voice_model?: string;
    mind_model?: string;
    hands_model?: string;
    default_role: "voice" | "mind" | "hands";
  };
  effort: {
    voice_budget: number;
    mind_budget: number;
    hands_budget: number;
    dynamic_intent: boolean;
  };
  tools: {
    discrete_tools: boolean;
    readonly: boolean;
    disabled_tools: string[];
    enabled_tools?: string[];
  };
  watchdog: {
    enabled: boolean;
    threshold: number;
  };
  turn_cap: {
    max_turns: number;
    warn_remaining: number;
  };
  shell: {
    async_grace_ms: number;
    semi_async: boolean;
  };
  statusline: "minimal" | "standard" | "full" | "custom" | "off";
  statusline_items?: {
    cwd?: boolean;
    model?: boolean;
    context?: boolean;
    tokens?: boolean;
    cost?: boolean;
    extension_status?: boolean;
  };
  fixed_model: boolean;
}

export const DEFAULT_LITTLE_CODER_SETTINGS: LittleCoderSettings = {
  roles: {
    voice_model: undefined,
    mind_model: undefined,
    hands_model: undefined,
    default_role: "hands",
  },
  effort: {
    voice_budget: 0,
    mind_budget: 8192,
    hands_budget: 1024,
    dynamic_intent: true,
  },
  tools: {
    discrete_tools: false,
    readonly: false,
    disabled_tools: [],
    enabled_tools: undefined,
  },
  watchdog: {
    enabled: true,
    threshold: 80,
  },
  turn_cap: {
    max_turns: 40,
    warn_remaining: 5,
  },
  shell: {
    async_grace_ms: 15000,
    semi_async: true,
  },
  statusline: "minimal",
  statusline_items: {
    cwd: true,
    model: true,
    context: true,
    tokens: false,
    cost: false,
    extension_status: true,
  },
  fixed_model: false,
};

function readJsonFile(filePath: string): any {
  if (!existsSync(filePath)) return null;
  try {
    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function loadLittleCoderSettings(workspaceDir: string = process.cwd()): LittleCoderSettings {
  const result: LittleCoderSettings = JSON.parse(JSON.stringify(DEFAULT_LITTLE_CODER_SETTINGS));

  // 1. User global settings (~/.pi/agent/settings.json)
  const userSettingsPath = join(homedir(), ".pi", "agent", "settings.json");
  const userSettings = readJsonFile(userSettingsPath);
  if (userSettings?.little_coder) {
    applyJsonConfig(result, userSettings.little_coder);
  }

  // 2. Workspace settings (<workspace>/.pi/settings.json)
  const wsSettingsPath = join(workspaceDir, ".pi", "settings.json");
  const wsSettings = readJsonFile(wsSettingsPath);
  if (wsSettings?.little_coder) {
    applyJsonConfig(result, wsSettings.little_coder);
  }

  // 3. Environment overrides (highest precedence)
  applyEnvOverrides(result);

  return result;
}

export function saveStatuslineSetting(
  mode: "minimal" | "standard" | "full" | "custom" | "off",
  items?: {
    cwd?: boolean;
    model?: boolean;
    context?: boolean;
    tokens?: boolean;
    cost?: boolean;
    extension_status?: boolean;
  },
  workspaceDir: string = process.cwd()
): boolean {
  try {
    const wsSettingsPath = join(workspaceDir, ".pi", "settings.json");
    let wsSettings: any = {};
    if (existsSync(wsSettingsPath)) {
      wsSettings = readJsonFile(wsSettingsPath) || {};
    }
    if (!wsSettings.little_coder || typeof wsSettings.little_coder !== "object") {
      wsSettings.little_coder = {};
    }
    wsSettings.little_coder.statusline = mode;
    if (items) {
      wsSettings.little_coder.statusline_items = items;
    }
    writeFileSync(wsSettingsPath, JSON.stringify(wsSettings, null, 2) + "\n", "utf-8");
    return true;
  } catch {
    return false;
  }
}

function applyJsonConfig(target: LittleCoderSettings, src: any): void {
  if (typeof src !== "object" || src === null) return;

  if (src.roles) {
    if (typeof src.roles.voice_model === "string") target.roles.voice_model = src.roles.voice_model;
    if (typeof src.roles.mind_model === "string") target.roles.mind_model = src.roles.mind_model;
    if (typeof src.roles.hands_model === "string") target.roles.hands_model = src.roles.hands_model;
    if (["voice", "mind", "hands"].includes(src.roles.default_role)) target.roles.default_role = src.roles.default_role;
  }

  if (src.effort) {
    if (typeof src.effort.voice_budget === "number") target.effort.voice_budget = src.effort.voice_budget;
    if (typeof src.effort.mind_budget === "number") target.effort.mind_budget = src.effort.mind_budget;
    if (typeof src.effort.hands_budget === "number") target.effort.hands_budget = src.effort.hands_budget;
    if (typeof src.effort.dynamic_intent === "boolean") target.effort.dynamic_intent = src.effort.dynamic_intent;
  }

  if (src.tools) {
    if (typeof src.tools.discrete_tools === "boolean") target.tools.discrete_tools = src.tools.discrete_tools;
    if (typeof src.tools.readonly === "boolean") target.tools.readonly = src.tools.readonly;
    if (Array.isArray(src.tools.disabled_tools)) target.tools.disabled_tools = src.tools.disabled_tools;
    if (Array.isArray(src.tools.enabled_tools)) target.tools.enabled_tools = src.tools.enabled_tools;
  }

  if (src.watchdog) {
    if (typeof src.watchdog.enabled === "boolean") target.watchdog.enabled = src.watchdog.enabled;
    if (typeof src.watchdog.threshold === "number") target.watchdog.threshold = src.watchdog.threshold;
  }

  if (src.turn_cap) {
    if (typeof src.turn_cap.max_turns === "number") target.turn_cap.max_turns = src.turn_cap.max_turns;
    if (typeof src.turn_cap.warn_remaining === "number") target.turn_cap.warn_remaining = src.turn_cap.warn_remaining;
  }

  if (src.shell) {
    if (typeof src.shell.async_grace_ms === "number") target.shell.async_grace_ms = src.shell.async_grace_ms;
    if (typeof src.shell.semi_async === "boolean") target.shell.semi_async = src.shell.semi_async;
  }

  if (typeof src.statusline === "string" && ["minimal", "standard", "full", "custom", "off"].includes(src.statusline)) {
    target.statusline = src.statusline as any;
  }

  if (src.statusline_items && typeof src.statusline_items === "object") {
    target.statusline_items = {
      cwd: typeof src.statusline_items.cwd === "boolean" ? src.statusline_items.cwd : target.statusline_items?.cwd ?? true,
      model: typeof src.statusline_items.model === "boolean" ? src.statusline_items.model : target.statusline_items?.model ?? true,
      context: typeof src.statusline_items.context === "boolean" ? src.statusline_items.context : target.statusline_items?.context ?? true,
      tokens: typeof src.statusline_items.tokens === "boolean" ? src.statusline_items.tokens : target.statusline_items?.tokens ?? false,
      cost: typeof src.statusline_items.cost === "boolean" ? src.statusline_items.cost : target.statusline_items?.cost ?? false,
      extension_status: typeof src.statusline_items.extension_status === "boolean" ? src.statusline_items.extension_status : target.statusline_items?.extension_status ?? true,
    };
  }

  if (typeof src.fixed_model === "boolean") {
    target.fixed_model = src.fixed_model;
  }
}

function applyEnvOverrides(target: LittleCoderSettings): void {
  const env = process.env;

  // Roles
  if (env.LITTLE_CODER_VOICE_MODEL) target.roles.voice_model = env.LITTLE_CODER_VOICE_MODEL;
  if (env.LITTLE_CODER_MIND_MODEL || env.LITTLE_CODER_PLAN_MODEL) {
    target.roles.mind_model = env.LITTLE_CODER_MIND_MODEL || env.LITTLE_CODER_PLAN_MODEL;
  }
  if (env.LITTLE_CODER_HANDS_MODEL || env.LITTLE_CODER_ACTION_MODEL) {
    target.roles.hands_model = env.LITTLE_CODER_HANDS_MODEL || env.LITTLE_CODER_ACTION_MODEL;
  }
  if (env.LITTLE_CODER_ROLE && ["voice", "mind", "hands"].includes(env.LITTLE_CODER_ROLE)) {
    target.roles.default_role = env.LITTLE_CODER_ROLE as any;
  }

  // Effort
  if (env.LITTLE_CODER_VOICE_BUDGET) target.effort.voice_budget = parseInt(env.LITTLE_CODER_VOICE_BUDGET, 10);
  if (env.LITTLE_CODER_MIND_BUDGET) target.effort.mind_budget = parseInt(env.LITTLE_CODER_MIND_BUDGET, 10);
  if (env.LITTLE_CODER_HANDS_BUDGET) target.effort.hands_budget = parseInt(env.LITTLE_CODER_HANDS_BUDGET, 10);
  if (env.LITTLE_CODER_DYNAMIC_EFFORT) {
    target.effort.dynamic_intent = env.LITTLE_CODER_DYNAMIC_EFFORT !== "0" && env.LITTLE_CODER_DYNAMIC_EFFORT !== "false";
  }

  // Tools
  if (env.PI_DISCRETE_TOOLS === "1" || env.LITTLE_CODER_DISCRETE_TOOLS === "1") {
    target.tools.discrete_tools = true;
  }
  if (env.LITTLE_CODER_READONLY === "1" || env.LITTLE_CODER_READONLY === "true") {
    target.tools.readonly = true;
  }
  if (env.LITTLE_CODER_DISABLED_TOOLS) {
    target.tools.disabled_tools = env.LITTLE_CODER_DISABLED_TOOLS.split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (env.LITTLE_CODER_ENABLED_TOOLS) {
    target.tools.enabled_tools = env.LITTLE_CODER_ENABLED_TOOLS.split(",").map((s) => s.trim()).filter(Boolean);
  }

  // Watchdog
  if (env.LITTLE_CODER_WATCHDOG_THRESHOLD) {
    target.watchdog.threshold = parseInt(env.LITTLE_CODER_WATCHDOG_THRESHOLD, 10);
  }
  if (env.LITTLE_CODER_WATCHDOG_ENABLED) {
    target.watchdog.enabled = env.LITTLE_CODER_WATCHDOG_ENABLED !== "0" && env.LITTLE_CODER_WATCHDOG_ENABLED !== "false";
  }

  // Turn cap
  if (env.LITTLE_CODER_MAX_TURNS) {
    target.turn_cap.max_turns = parseInt(env.LITTLE_CODER_MAX_TURNS, 10);
  }
  if (env.LITTLE_CODER_WARN_REMAINING) {
    target.turn_cap.warn_remaining = parseInt(env.LITTLE_CODER_WARN_REMAINING, 10);
  }

  // Shell semi-async & grace window
  if (env.LITTLE_CODER_SHELL_ASYNC_GRACE_MS) {
    target.shell.async_grace_ms = parseInt(env.LITTLE_CODER_SHELL_ASYNC_GRACE_MS, 10);
  }
  if (env.LITTLE_CODER_SEMI_ASYNC) {
    target.shell.semi_async = env.LITTLE_CODER_SEMI_ASYNC !== "0" && env.LITTLE_CODER_SEMI_ASYNC !== "false";
  }

  // Statusline
  if (env.LITTLE_CODER_STATUSLINE && ["minimal", "standard", "full", "custom", "off"].includes(env.LITTLE_CODER_STATUSLINE)) {
    target.statusline = env.LITTLE_CODER_STATUSLINE as any;
  }

  // Fixed model
  if (env.LITTLE_CODER_FIXED_MODEL === "1") {
    target.fixed_model = true;
  }
}
