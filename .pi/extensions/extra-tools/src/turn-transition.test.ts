import { describe, expect, it, beforeEach } from "bun:test";
import {
  determineInputRole,
  registerTurnTransitionHooks,
  resetTurnTransitionState,
  getTurnTransitionState,
} from "./turn-transition.ts";
import { getTriModelConfig, setTriModelConfig } from "./model-router.ts";

describe("turn-transition state machine (Volition / Abe & Guppi)", () => {
  beforeEach(() => {
    resetTurnTransitionState();
    setTriModelConfig({ activeRole: "hands", autoTurnTransition: true });
  });

  it("determines appropriate input role based on prompt intent and complexity", () => {
    // Architecture prompt -> mind
    expect(determineInputRole("Let's plan the architecture for the new gateway")).toBe("mind");

    // Debugging prompt -> mind
    expect(determineInputRole("Investigate why the test is failing")).toBe("mind");

    // Quick command / test run -> hands
    expect(determineInputRole("bun test")).toBe("hands");

    // Short phrase (< 5 words) -> hands
    expect(determineInputRole("git status")).toBe("hands");

    // Longer multi-step user instruction (>= 5 words) -> mind
    expect(determineInputRole("Please review the entire auth module and report vulnerabilities")).toBe("mind");
  });

  it("transitions from user input (mind) to execution (hands) on tool call", async () => {
    const handlers: Record<string, Function> = {};
    const mockPi = {
      on: (event: string, handler: Function) => {
        handlers[event] = handler;
      },
    };

    registerTurnTransitionHooks(mockPi as any);

    // 1. User inputs a design question
    await handlers.input({ text: "Please decompose and implement the payment gateway" });
    expect(getTurnTransitionState().currentCycleRole).toBe("mind");
    expect(getTriModelConfig().activeRole).toBe("mind");

    // 2. Assistant executes a tool -> transitions to hands (Guppi mechanical executor)
    await handlers.tool_call({ toolName: "read" });
    expect(getTurnTransitionState().currentCycleRole).toBe("hands");
    expect(getTriModelConfig().activeRole).toBe("hands");

    // 3. Assistant completes turn with text only (no tools) -> transitions to voice
    await handlers.turn_end({
      message: {
        role: "assistant",
        content: "Done. All tests pass.",
        tool_calls: [],
      },
    });
    expect(getTurnTransitionState().currentCycleRole).toBe("voice");
    expect(getTriModelConfig().activeRole).toBe("voice");
  });

  it("bypasses auto transition when autoTurnTransition is disabled", async () => {
    setTriModelConfig({ autoTurnTransition: false, activeRole: "hands" });

    const handlers: Record<string, Function> = {};
    const mockPi = {
      on: (event: string, handler: Function) => {
        handlers[event] = handler;
      },
    };

    registerTurnTransitionHooks(mockPi as any);

    // Input does not alter activeRole when disabled
    await handlers.input({ text: "Please decompose and implement the payment gateway" });
    expect(getTriModelConfig().activeRole).toBe("hands");
  });
});
