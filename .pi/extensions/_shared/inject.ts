// Where little-coder's per-turn context augmentation lands (issue #73).
//
// Extensions add a block of guidance to a turn. Appending to the system prompt
// destroys the KV cache because the system prompt is the first element in the
// request, invalidating the entire cached prefix on every turn.
//
// Instead, before_agent_start may return a custom message appended to the TAIL
// of the conversation, leaving the prefix cached.

export type InjectMode = "message" | "system";

/** Shape of what a `before_agent_start` handler may return. */
export interface InjectionResult {
  systemPrompt?: string;
  message?: {
    customType: string;
    content: string;
    /** false -> carried in context but not rendered in the transcript. */
    display: boolean;
  };
}

export function injectMode(env: NodeJS.ProcessEnv = process.env): InjectMode {
  return env.LITTLE_CODER_INJECT_MODE === "system" ? "system" : "message";
}

/**
 * Build the `before_agent_start` return value for a block of injected guidance.
 *
 * @param customType  Stable id for this injector (e.g. `lc-project-context`)
 * @param block       The text to inject. Returns undefined when empty.
 * @param systemPrompt The turn's system prompt — only read in `system` mode.
 */
export function injectionResult(
  customType: string,
  block: string,
  systemPrompt = "",
  env: NodeJS.ProcessEnv = process.env,
): InjectionResult | undefined {
  if (!block) return undefined;
  if (injectMode(env) === "system") {
    return { systemPrompt: systemPrompt + block };
  }
  return { message: { customType, content: block, display: false } };
}

/**
 * Suppress a block that is byte-identical to the one this injector added last.
 *
 * A tail message persists in the conversation, unlike a system prompt that is
 * rebuilt each turn — so re-sending the same block every turn would pile
 * up duplicate copies and spend context for nothing. The previous copy is
 * still there and still visible to the model, so skipping is free.
 *
 * Returns a `shouldInject` predicate that remembers the last block it accepted.
 * In `system` mode it always returns true.
 */
export function makeDedupe(env: NodeJS.ProcessEnv = process.env): (block: string) => boolean {
  let last: string | null = null;
  return (block: string): boolean => {
    if (injectMode(env) === "system") return true;
    if (block === last) return false;
    last = block;
    return true;
  };
}
