/**
 * Universal Tool Gating & Enablement Evaluator.
 *
 * Implements Pattern 3: Hybrid Profile & Granular Environment Flags.
 *
 * Precedence:
 * 1. Explicit Granular Override (highest):
 *    - `LITTLE_CODER_DISABLED_TOOLS="web_control,grove_write"` (denylist)
 *    - `LITTLE_CODER_ENABLED_TOOLS="read,edit,write,grove_read"` (strict allowlist, if set)
 * 2. Role / Profile Defaults:
 *    - `LITTLE_CODER_ROLE` or `LITTLE_CODER_PROFILE`:
 *      - `reviewer` / `auditor` / `readonly`: only read and search tools enabled; all write/mutate/promote tools blocked.
 *      - `watchdog`: minimal watchdog/health monitoring.
 *      - `coder` / `coordinator` (default): full standard suite enabled.
 * 3. Specific Domain Overrides:
 *    - `LITTLE_CODER_READONLY=1`: disables all write/modify tools across extensions.
 *    - `LITTLE_CODER_DISABLE_WEB=1`: disables all web-* tools.
 *    - `LITTLE_CODER_DISABLE_GROVE=1`: disables all grove-* tools.
 */

export type ToolRole = "coder" | "coordinator" | "reviewer" | "auditor" | "readonly" | "watchdog";

export interface ToolGatingConfig {
  role?: ToolRole;
  readonly?: boolean;
  disabledTools?: string[];
  enabledTools?: string[];
  disableWeb?: boolean;
  disableGrove?: boolean;
}

export const WRITE_AND_MUTATION_TOOLS = new Set([
  "write",
  "edit",
  "grove_write",
  "grove_promote",
  "web_control",
]);

export function getToolGatingConfig(env: NodeJS.ProcessEnv = process.env): ToolGatingConfig {
  const role = (env.LITTLE_CODER_ROLE || env.LITTLE_CODER_PROFILE || "coder") as ToolRole;
  const readonly =
    env.LITTLE_CODER_READONLY === "1" ||
    env.LITTLE_CODER_READONLY === "true" ||
    role === "reviewer" ||
    role === "auditor" ||
    role === "readonly";

  const disabledTools = (env.LITTLE_CODER_DISABLED_TOOLS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const enabledTools = (env.LITTLE_CODER_ENABLED_TOOLS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const disableWeb = env.LITTLE_CODER_DISABLE_WEB === "1" || env.LITTLE_CODER_DISABLE_WEB === "true";
  const disableGrove = env.LITTLE_CODER_DISABLE_GROVE === "1" || env.LITTLE_CODER_DISABLE_GROVE === "true";

  return {
    role,
    readonly,
    disabledTools,
    enabledTools: enabledTools.length > 0 ? enabledTools : undefined,
    disableWeb,
    disableGrove,
  };
}

/**
 * Determine if a specific tool is enabled given its name and category.
 */
export function isToolEnabled(
  toolName: string,
  category?: "basic" | "web" | "grove" | "extra" | "scheduler" | "autonomous",
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const config = getToolGatingConfig(env);

  // 1. Explicit allowlist (if provided, tool must be present)
  if (config.enabledTools && !config.enabledTools.includes(toolName)) {
    return false;
  }

  // 2. Explicit denylist
  if (config.disabledTools && config.disabledTools.includes(toolName)) {
    return false;
  }

  // 3. Domain disable flags
  if (config.disableWeb && (category === "web" || toolName.startsWith("web_"))) {
    return false;
  }
  if (config.disableGrove && (category === "grove" || toolName.startsWith("grove_"))) {
    return false;
  }

  // 4. Readonly enforcement across roles and flags
  if (config.readonly && WRITE_AND_MUTATION_TOOLS.has(toolName)) {
    return false;
  }

  return true;
}
