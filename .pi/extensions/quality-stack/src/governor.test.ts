import { describe, expect, it } from "bun:test";
import { Governor } from "./governor";

describe("governor", () => {
  it("allows normal pacing turns within window", () => {
    const gov = new Governor({ maxTurnsPerWindow: 5, windowMs: 10_000, cooldownMs: 2_000 });
    const now = 100_000;

    for (let i = 0; i < 5; i++) {
      const res = gov.evaluateTurn(now + i * 1000);
      expect(res.action).toBe("allow");
    }
  });

  it("throttles and enforces cooldown when velocity limit exceeded", () => {
    const gov = new Governor({ maxTurnsPerWindow: 3, windowMs: 10_000, cooldownMs: 2_000 });
    const now = 100_000;

    expect(gov.evaluateTurn(now).action).toBe("allow");
    expect(gov.evaluateTurn(now + 100).action).toBe("allow");
    expect(gov.evaluateTurn(now + 200).action).toBe("allow");

    // 4th turn exceeds maxTurnsPerWindow (3)
    const trip = gov.evaluateTurn(now + 300);
    expect(trip.action).toBe("throttle");
    expect(trip.message).toContain("Turn velocity governor tripped");

    // Immediate next turn still within cooldown
    const duringCooldown = gov.evaluateTurn(now + 1000);
    expect(duringCooldown.action).toBe("throttle");

    // After cooldown expires
    const afterCooldown = gov.evaluateTurn(now + 300 + 2500);
    expect(afterCooldown.action).toBe("allow");
  });
});
