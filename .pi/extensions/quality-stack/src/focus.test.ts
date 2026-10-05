import { describe, it, expect, beforeEach } from "bun:test";
import { FocusManager } from "./focus.ts";

describe("focus (Mini-Volition focus pattern)", () => {
  let focus: FocusManager;

  beforeEach(() => {
    focus = new FocusManager({
      windowMs: 5000,
      burstThreshold: 3,
      cooldownMs: 2000,
    });
  });

  it("permits calls under burst threshold", () => {
    const t0 = 1000;
    expect(focus.recordExecution("sh", { command: "cargo test" }, t0)).toBeNull();
    expect(focus.checkThrottle("sh", { command: "cargo test" }, t0 + 100)).toBeNull();

    expect(focus.recordExecution("sh", { command: "cargo test" }, t0 + 500)).toBeNull();
    expect(focus.checkThrottle("sh", { command: "cargo test" }, t0 + 600)).toBeNull();
  });

  it("triggers suspension directive when burst threshold is reached", () => {
    const t0 = 1000;
    focus.recordExecution("sh", { command: "git status" }, t0);
    focus.recordExecution("sh", { command: "git status" }, t0 + 100);

    const directive = focus.recordExecution("sh", { command: "git status" }, t0 + 200);
    expect(directive).not.toBeNull();
    expect(directive?.burstCount).toBe(3);
    expect(directive?.cooldownUntil).toBe(t0 + 200 + 2000);
    expect(directive?.reason).toContain("Burst loop detected");

    // Immediate next call is throttled
    const blocked = focus.checkThrottle("sh", { command: "git status" }, t0 + 500);
    expect(blocked).not.toBeNull();
    expect(blocked?.signature).toBe("sh:git status");

    // After cooldown expires, throttle is released
    const afterCooldown = focus.checkThrottle("sh", { command: "git status" }, t0 + 200 + 2001);
    expect(afterCooldown).toBeNull();
  });

  it("tracks distinct signatures independently", () => {
    const t0 = 1000;
    focus.recordExecution("sh", { command: "cmd-a" }, t0);
    focus.recordExecution("sh", { command: "cmd-a" }, t0 + 100);
    focus.recordExecution("sh", { command: "cmd-a" }, t0 + 200); // throttled

    // cmd-b should not be throttled
    expect(focus.checkThrottle("sh", { command: "cmd-b" }, t0 + 300)).toBeNull();
  });
});
