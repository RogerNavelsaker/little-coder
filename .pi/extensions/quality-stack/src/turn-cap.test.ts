import { describe, expect, it } from "bun:test";
import { TurnCapGuard, resolveTurnCapConfig } from "./turn-cap";

describe("turn-cap guard", () => {
  it("resolves default and custom configuration", () => {
    const def = resolveTurnCapConfig({});
    expect(def.maxTurns).toBe(40);
    expect(def.warnRemaining).toBe(5);

    const custom = resolveTurnCapConfig({
      LITTLE_CODER_MAX_TURNS: "20",
      LITTLE_CODER_WARN_REMAINING: "3",
    });
    expect(custom.maxTurns).toBe(20);
    expect(custom.warnRemaining).toBe(3);
  });

  it("continues normally when below warning threshold", () => {
    const guard = new TurnCapGuard({ maxTurns: 10, warnRemaining: 3 });
    const res = guard.evaluateTurn(0); // turn 1
    expect(res.action).toBe("continue");
  });

  it("warns once when reaching the warnRemaining boundary", () => {
    const guard = new TurnCapGuard({ maxTurns: 10, warnRemaining: 3 });

    // Turn 7 (3 remaining) -> should warn
    const warnRes = guard.evaluateTurn(6);
    expect(warnRes.action).toBe("warn");
    if (warnRes.action === "warn") {
      expect(warnRes.remaining).toBe(3);
      expect(warnRes.message).toContain("Only 3 turns remaining");
    }

    // Turn 8 (2 remaining) -> warned already, should continue
    const nextRes = guard.evaluateTurn(7);
    expect(nextRes.action).toBe("continue");
  });

  it("aborts when reaching maxTurns", () => {
    const guard = new TurnCapGuard({ maxTurns: 10, warnRemaining: 3 });
    const abortRes = guard.evaluateTurn(9); // turn 10
    expect(abortRes.action).toBe("abort");
    if (abortRes.action === "abort") {
      expect(abortRes.message).toContain("Safety turn cap reached");
    }
  });

  it("resets state cleanly", () => {
    const guard = new TurnCapGuard({ maxTurns: 10, warnRemaining: 3 });
    guard.evaluateTurn(6); // triggers warn
    guard.reset();

    const warnAgain = guard.evaluateTurn(6);
    expect(warnAgain.action).toBe("warn");
  });
});
