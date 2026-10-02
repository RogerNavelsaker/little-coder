import { describe, expect, it } from "bun:test";
import {
  charLength,
  estimateContextTokens,
  reconcileUsage,
  reportsPostTruncationInput,
  looksTruncated,
  CHARS_PER_TOKEN,
} from "./local-estimate.ts";

describe("reportsPostTruncationInput", () => {
  it("recognizes ollama by default", () => {
    expect(reportsPostTruncationInput("ollama", {})).toBe(true);
    expect(reportsPostTruncationInput("Ollama", {})).toBe(true);
    expect(reportsPostTruncationInput("anthropic", {})).toBe(false);
    expect(reportsPostTruncationInput(undefined, {})).toBe(false);
  });

  it("honors LITTLE_CODER_LOCAL_CONTEXT_ESTIMATE overrides", () => {
    expect(reportsPostTruncationInput("anthropic", { LITTLE_CODER_LOCAL_CONTEXT_ESTIMATE: "1" })).toBe(true);
    expect(reportsPostTruncationInput("anthropic", { LITTLE_CODER_LOCAL_CONTEXT_ESTIMATE: "always" })).toBe(true);
    expect(reportsPostTruncationInput("ollama", { LITTLE_CODER_LOCAL_CONTEXT_ESTIMATE: "0" })).toBe(false);
    expect(reportsPostTruncationInput("ollama", { LITTLE_CODER_LOCAL_CONTEXT_ESTIMATE: "off" })).toBe(false);
  });
});

describe("charLength and estimateContextTokens", () => {
  it("counts characters across nested values", () => {
    const data = {
      message: "hello",
      items: ["world", 123, true],
    };
    // "hello" (5) + "world" (5) + "123" (3) + "true" (4) = 17
    expect(charLength(data)).toBe(17);
  });

  it("estimates tokens using CHARS_PER_TOKEN", () => {
    const text = "12345678";
    const est = estimateContextTokens([text], undefined);
    expect(est).toBe(Math.ceil(8 / CHARS_PER_TOKEN));
  });
});

describe("reconcileUsage", () => {
  it("leaves trusted providers unchanged", () => {
    const usage = { tokens: 1000, contextWindow: 4000, percent: 25 };
    expect(reconcileUsage(usage, 2000, false)).toEqual(usage);
  });

  it("takes larger estimated tokens for untrusted providers", () => {
    const usage = { tokens: 1000, contextWindow: 4000, percent: 25 };
    const reconciled = reconcileUsage(usage, 2000, true);
    expect(reconciled?.tokens).toBe(2000);
    expect(reconciled?.percent).toBe(50);
  });

  it("keeps reported if reported is larger", () => {
    const usage = { tokens: 3000, contextWindow: 4000, percent: 75 };
    const reconciled = reconcileUsage(usage, 2000, true);
    expect(reconciled?.tokens).toBe(3000);
    expect(reconciled?.percent).toBe(75);
  });
});

describe("looksTruncated", () => {
  it("detects >1.5x discrepancy", () => {
    expect(looksTruncated(1000, 2000)).toBe(true);
    expect(looksTruncated(1000, 1200)).toBe(false);
    expect(looksTruncated(null, 2000)).toBe(false);
  });
});
