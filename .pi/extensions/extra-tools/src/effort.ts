/**
 * `effort` module — Thinking-budget & reasoning effort injection.
 *
 * Implements `before_provider_request` hook logic.
 * Reads the active model and thinking level/budget configurations.
 * Injects model-specific reasoning parameters into the provider request payload:
 * - Anthropic: `thinking: { type: "enabled", budget_tokens: N }` or `thinking: { type: "adaptive" }` / `effort`
 * - OpenAI / Compatible: `reasoning_effort: "low" | "medium" | "high"` or `max_completion_tokens`
 * - Local / Ollama / Llama.cpp: adjusts `max_tokens` / `thinking_budget` based on role profiles
 *   (coordinator=high, coder=medium, reviewer=low, watchdog=off).
 */

export type ThinkingRole = "coordinator" | "coder" | "reviewer" | "watchdog";

export interface EffortConfig {
  roleBudgets: Record<ThinkingRole, { level: "high" | "medium" | "low" | "off"; tokens: number }>;
}

export const DEFAULT_EFFORT_CONFIG: EffortConfig = {
  roleBudgets: {
    coordinator: { level: "high", tokens: 4096 },
    coder: { level: "medium", tokens: 2048 },
    reviewer: { level: "low", tokens: 1024 },
    watchdog: { level: "off", tokens: 0 },
  },
};

/**
 * Injects or adjusts reasoning effort parameters in a raw provider request payload.
 */
export function injectThinkingEffort(
  payload: any,
  roleOrLevel?: ThinkingRole | "high" | "medium" | "low" | "off",
  customTokens?: number,
  config: EffortConfig = DEFAULT_EFFORT_CONFIG,
): any {
  if (!payload || typeof payload !== "object") return payload;

  const targetRole = (roleOrLevel && roleOrLevel in config.roleBudgets ? roleOrLevel : "coder") as ThinkingRole;
  const setting = config.roleBudgets[targetRole] || config.roleBudgets.coder;
  const level = (roleOrLevel && ["high", "medium", "low", "off"].includes(roleOrLevel) ? roleOrLevel : setting.level);
  const tokens = customTokens ?? setting.tokens;

  const cloned = { ...payload };

  if (level === "off" || tokens === 0) {
    if ("thinking" in cloned) {
      delete cloned.thinking;
    }
    if ("reasoning_effort" in cloned) {
      delete cloned.reasoning_effort;
    }
    return cloned;
  }

  // 1. Anthropic-style payload (has messages or system)
  if ("messages" in cloned && !("max_completion_tokens" in cloned)) {
    cloned.thinking = {
      type: "enabled",
      budget_tokens: tokens,
    };
  }

  // 2. OpenAI / o-series / reasoning compatible payload
  if ("reasoning_effort" in cloned || "max_completion_tokens" in cloned || cloned.model?.includes("o1") || cloned.model?.includes("o3") || cloned.model?.includes("r1")) {
    cloned.reasoning_effort = level;
    if (tokens > 0) {
      cloned.max_completion_tokens = Math.max(cloned.max_completion_tokens || 0, tokens + 1024);
    }
  }

  return cloned;
}
