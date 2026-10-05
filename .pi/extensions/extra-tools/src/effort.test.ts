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

  describe("task intent classification & dynamic steering", () => {
    it("classifies quick fix intent", () => {
      const { classifyTurnIntent } = require("./effort");
      expect(classifyTurnIntent("fix typo in line 42")).toBe("quick_fix");
      expect(classifyTurnIntent("rename variable foo to bar")).toBe("quick_fix");
    });

    it("classifies test run intent", () => {
      const { classifyTurnIntent } = require("./effort");
      expect(classifyTurnIntent("bun test src/app.test.ts")).toBe("test_run");
      expect(classifyTurnIntent("run the tests")).toBe("test_run");
    });

    it("classifies architecture and debug intent", () => {
      const { classifyTurnIntent } = require("./effort");
      expect(classifyTurnIntent("refactor the auth architecture")).toBe("architecture");
      expect(classifyTurnIntent("debug why eviction fails")).toBe("debug");
    });

    it("injects minimal tokens for quick_fix task", () => {
      const rawPayload = {
        model: "claude-3-7-sonnet-20250219",
        messages: [{ role: "user", content: "fix typo" }],
      };
      const res = injectThinkingEffort(rawPayload, "quick_fix");
      expect(res.thinking).toBeDefined();
      expect(res.thinking.budget_tokens).toBe(1024);
    });

    it("disables thinking for test_run task", () => {
      const rawPayload = {
        model: "claude-3-7-sonnet-20250219",
        messages: [{ role: "user", content: "run tests" }],
        thinking: { type: "enabled", budget_tokens: 4096 },
      };
      const res = injectThinkingEffort(rawPayload, "test_run");
      expect(res.thinking).toBeUndefined();
    });

    it("respects voice (off), mind (high: 8k), and hands (low: 1k) roles", () => {
      const payload = {
        model: "claude-3-7-sonnet-20250219",
        messages: [{ role: "user", content: "hello" }],
        thinking: { type: "enabled", budget_tokens: 2048 },
      };

      const resVoice = injectThinkingEffort(payload, "voice");
      expect(resVoice.thinking).toBeUndefined();

      const resMind = injectThinkingEffort(payload, "mind");
      expect(resMind.thinking.budget_tokens).toBe(8192);

      const resHands = injectThinkingEffort(payload, "hands");
      expect(resHands.thinking.budget_tokens).toBe(1024);
    });
  });
});
