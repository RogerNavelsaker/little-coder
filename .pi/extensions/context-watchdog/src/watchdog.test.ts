import { describe, it, expect } from "bun:test";
import {
  thresholdPercent,
  shouldCompactNow,
  compactionHelped,
  canCompactMidRun,
  classifyCompactionError,
  MIN_PROGRESS_PCT,
  DEFAULT_PERCENT,
  type ContextUsageLike,
} from "./watchdog.ts";

describe("thresholdPercent", () => {
  it("defaults to 80 when unset", () => {
    expect(thresholdPercent({})).toBe(DEFAULT_PERCENT);
    expect(thresholdPercent({ LITTLE_CODER_COMPACT_AT_PERCENT: "  " })).toBe(80);
  });

  it("honors valid overrides", () => {
    expect(thresholdPercent({ LITTLE_CODER_COMPACT_AT_PERCENT: "75" })).toBe(75);
    expect(thresholdPercent({ LITTLE_CODER_COMPACT_AT_PERCENT: "90" })).toBe(90);
  });

  it("disables on <= 0 or >= 100", () => {
    expect(thresholdPercent({ LITTLE_CODER_COMPACT_AT_PERCENT: "0" })).toBe(0);
    expect(thresholdPercent({ LITTLE_CODER_COMPACT_AT_PERCENT: "-10" })).toBe(0);
    expect(thresholdPercent({ LITTLE_CODER_COMPACT_AT_PERCENT: "100" })).toBe(0);
    expect(thresholdPercent({ LITTLE_CODER_COMPACT_AT_PERCENT: "105" })).toBe(0);
  });

  it("disables when LITTLE_CODER_NO_COMPACT_WATCHDOG=1", () => {
    expect(
      thresholdPercent({
        LITTLE_CODER_NO_COMPACT_WATCHDOG: "1",
        LITTLE_CODER_COMPACT_AT_PERCENT: "70",
      }),
    ).toBe(0);
  });
});

describe("compactionHelped", () => {
  it("requires at least MIN_PROGRESS_PCT headroom below threshold", () => {
    // threshold = 80, MIN_PROGRESS_PCT = 5 -> needs <= 75
    expect(compactionHelped(75, 80)).toBe(true);
    expect(compactionHelped(70, 80)).toBe(true);
    expect(compactionHelped(76, 80)).toBe(false);
    expect(compactionHelped(82, 80)).toBe(false);
  });
});

describe("classifyCompactionError", () => {
  it("classifies already compacted races", () => {
    expect(classifyCompactionError("Session already compacted")).toBe("already");
  });

  it("classifies aborted or cancelled runs", () => {
    expect(classifyCompactionError("Compaction cancelled")).toBe("cancelled");
    expect(classifyCompactionError("Request was aborted")).toBe("cancelled");
  });

  it("classifies genuine failures", () => {
    expect(classifyCompactionError("Nothing to compact (session too small)")).toBe("failed");
    expect(classifyCompactionError("Provider connection error")).toBe("failed");
  });
});

describe("canCompactMidRun", () => {
  it("only allows tui mode", () => {
    expect(canCompactMidRun("tui")).toBe(true);
    expect(canCompactMidRun("print")).toBe(false);
    expect(canCompactMidRun("rpc")).toBe(false);
    expect(canCompactMidRun(undefined)).toBe(false);
  });
});

describe("shouldCompactNow", () => {
  const normalUsage: ContextUsageLike = { tokens: 8500, contextWindow: 10000, percent: 85 };

  it("compacts when usage exceeds threshold", () => {
    expect(shouldCompactNow(normalUsage, 80, false)).toBe(true);
  });

  it("does not compact when below threshold", () => {
    expect(shouldCompactNow({ ...normalUsage, percent: 79 }, 80, false)).toBe(false);
  });

  it("does not compact if already compacting in-flight", () => {
    expect(shouldCompactNow(normalUsage, 80, true)).toBe(false);
  });

  it("does not compact if threshold is 0 (disabled)", () => {
    expect(shouldCompactNow(normalUsage, 0, false)).toBe(false);
  });

  it("does not compact if usage reading is null or missing", () => {
    expect(shouldCompactNow(undefined, 80, false)).toBe(false);
    expect(shouldCompactNow({ tokens: null, contextWindow: 10000, percent: null }, 80, false)).toBe(false);
  });
});
