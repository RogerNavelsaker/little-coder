import { describe, expect, it } from "bun:test";
import { injectThinkingEffort, DEFAULT_EFFORT_CONFIG } from "./effort";

describe("injectThinkingEffort", () => {
  it("injects Anthropic thinking budget based on role", () => {
    const rawPayload = {
      model: "claude-3-7-sonnet-20250219",
      messages: [{ role: "user", content: "hello" }],
    };

    const res = injectThinkingEffort(rawPayload, "coordinator");
    expect(res.thinking).toBeDefined();
    expect(res.thinking.type).toBe("enabled");
    expect(res.thinking.budget_tokens).toBe(4096);
  });

  it("removes thinking when role is watchdog (off)", () => {
    const rawPayload = {
      model: "claude-3-7-sonnet-20250219",
      messages: [{ role: "user", content: "hello" }],
      thinking: { type: "enabled", budget_tokens: 2048 },
    };

    const res = injectThinkingEffort(rawPayload, "watchdog");
    expect(res.thinking).toBeUndefined();
  });

  it("injects reasoning_effort for OpenAI reasoning models", () => {
    const rawPayload = {
      model: "o3-mini",
      messages: [{ role: "user", content: "hello" }],
    };

    const res = injectThinkingEffort(rawPayload, "coordinator");
    expect(res.reasoning_effort).toBe("high");
    expect(res.max_completion_tokens).toBeGreaterThanOrEqual(4096);
  });

  it("respects explicit token override", () => {
    const rawPayload = {
      model: "claude-3-7-sonnet-20250219",
      messages: [{ role: "user", content: "hello" }],
    };

    const res = injectThinkingEffort(rawPayload, "coder", 3000);
    expect(res.thinking.budget_tokens).toBe(3000);
  });
});
