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

export type TaskType = "quick_fix" | "test_run" | "refactor" | "feature" | "architecture" | "debug";

export interface EffortConfig {
  roleBudgets: Record<ThinkingRole, { level: "high" | "medium" | "low" | "off"; tokens: number }>;
  taskBudgets: Record<TaskType, { level: "high" | "medium" | "low" | "off"; tokens: number }>;
}

export const DEFAULT_EFFORT_CONFIG: EffortConfig = {
  roleBudgets: {
    coordinator: { level: "high", tokens: 4096 },
    coder: { level: "medium", tokens: 2048 },
    reviewer: { level: "low", tokens: 1024 },
    watchdog: { level: "off", tokens: 0 },
  },
  taskBudgets: {
    quick_fix: { level: "minimal" as any, tokens: 1024 },
    test_run: { level: "off", tokens: 0 },
    refactor: { level: "low", tokens: 2048 },
    feature: { level: "medium", tokens: 4096 },
    architecture: { level: "high", tokens: 8192 },
    debug: { level: "high", tokens: 8192 },
  },
};

/**
 * Classify task intent from the last message or tool execution context.
 */
export function classifyTurnIntent(lastMessageText?: string): TaskType | undefined {
  if (!lastMessageText) return undefined;
  const lower = lastMessageText.toLowerCase();

  if (/^(fix typo|rename|format|lint|bump|spelling|whitespace)\b/.test(lower) || lower.includes("quick fix")) {
    return "quick_fix";
  }
  if (/^(bun test|cargo test|npm test|pytest|test:|run tests?|verify)\b/.test(lower) || lower.includes("run the tests")) {
    return "test_run";
  }
  if (lower.includes("architecture") || lower.includes("design") || lower.includes("rfc") || lower.includes("decompose")) {
    return "architecture";
  }
  if (lower.includes("debug") || lower.includes("investigate") || lower.includes("root cause") || lower.includes("why is it failing")) {
    return "debug";
  }
  if (lower.includes("refactor") || lower.includes("cleanup") || lower.includes("reorganize")) {
    return "refactor";
  }
  return undefined;
}

/**
 * Injects or adjusts reasoning effort parameters in a raw provider request payload.
 */
export function injectThinkingEffort(
  payload: any,
  roleOrLevelOrTask?: ThinkingRole | TaskType | "high" | "medium" | "low" | "minimal" | "off",
  customTokens?: number,
  config: EffortConfig = DEFAULT_EFFORT_CONFIG,
): any {
  if (!payload || typeof payload !== "object") return payload;

  let level: "high" | "medium" | "low" | "minimal" | "off" = "medium";
  let tokens = customTokens ?? 2048;

  if (roleOrLevelOrTask) {
    if (roleOrLevelOrTask in config.taskBudgets) {
      const taskSetting = config.taskBudgets[roleOrLevelOrTask as TaskType];
      level = taskSetting.level as any;
      tokens = customTokens ?? taskSetting.tokens;
    } else if (roleOrLevelOrTask in config.roleBudgets) {
      const roleSetting = config.roleBudgets[roleOrLevelOrTask as ThinkingRole];
      level = roleSetting.level as any;
      tokens = customTokens ?? roleSetting.tokens;
    } else if (["high", "medium", "low", "minimal", "off"].includes(roleOrLevelOrTask)) {
      level = roleOrLevelOrTask as any;
    }
  }

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
