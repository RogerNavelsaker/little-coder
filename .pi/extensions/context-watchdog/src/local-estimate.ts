// Local prompt-size estimation, for providers whose reported input token count
// cannot be trusted to detect overflow.
//
// Issue #128: Some local/remote providers report prompt_eval_count AFTER truncation.
// For example, Ollama reporting half the context window even when the prompt has
// grown to 50k tokens, which silently drops older turns without triggering overflow
// errors or compaction.
//
// To prevent silent context loss, we measure the conversation directly via
// character length when untrusted providers are detected.

import type { ContextUsageLike } from "./watchdog.ts";

/** Characters per token. English prose runs ~4; code runs nearer 3, so 4 is a
 *  deliberate UNDER-estimate of a code-heavy transcript. */
export const CHARS_PER_TOKEN = 4;

/** Providers whose reported input token count is measured post-truncation and
 *  therefore cannot be used directly to detect overflow. */
const UNTRUSTED_INPUT_REPORTERS = new Set(["ollama"]);

export function reportsPostTruncationInput(
  provider: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const forced = (env.LITTLE_CODER_LOCAL_CONTEXT_ESTIMATE ?? "").trim().toLowerCase();
  if (forced === "1" || forced === "always") return true;
  if (forced === "0" || forced === "off" || forced === "never") return false;
  return provider !== undefined && UNTRUSTED_INPUT_REPORTERS.has(provider.toLowerCase());
}

/** Total characters in whatever pi sends. Recursively walks structure. */
export function charLength(value: unknown, depth = 0): number {
  if (depth > 12 || value == null) return 0;
  if (typeof value === "string") return value.length;
  if (typeof value === "number" || typeof value === "boolean") return String(value).length;
  if (Array.isArray(value)) {
    let n = 0;
    for (const v of value) n += charLength(v, depth + 1);
    return n;
  }
  if (typeof value === "object") {
    let n = 0;
    for (const v of Object.values(value as Record<string, unknown>)) n += charLength(v, depth + 1);
    return n;
  }
  return 0;
}

/** Estimated prompt tokens from entries plus system prompt. */
export function estimateContextTokens(entries: unknown, systemPrompt: string | undefined): number {
  const chars = charLength(entries) + (systemPrompt?.length ?? 0);
  return Math.ceil(chars / CHARS_PER_TOKEN);
}

/**
 * Reconcile a provider's reported usage with a local estimate.
 * Takes the larger of the two values to ensure early compaction rather than
 * silent truncation.
 */
export function reconcileUsage(
  usage: ContextUsageLike | undefined,
  estimatedTokens: number,
  untrusted: boolean,
): ContextUsageLike | undefined {
  if (!usage || !untrusted) return usage;
  if (usage.contextWindow <= 0) return usage;
  const reported = usage.tokens ?? 0;
  if (estimatedTokens <= reported) return usage;
  return {
    tokens: estimatedTokens,
    contextWindow: usage.contextWindow,
    percent: (estimatedTokens / usage.contextWindow) * 100,
  };
}

/** Detects if reported token count appears truncated against estimated tokens. */
export function looksTruncated(reportedTokens: number | null, estimatedTokens: number): boolean {
  if (reportedTokens === null || reportedTokens <= 0) return false;
  return estimatedTokens > reportedTokens * 1.5;
}
