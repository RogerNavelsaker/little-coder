/**
 * Automated turn-transition state machine (Volition / Abe & Guppi inspired).
 *
 * Implements cognitive turn progression across asymmetric tiers:
 * 1. User Input arrives:
 *    - If user prompt requires architecture/decomposition/debugging or is initial turn -> `mind` (frontier reasoning)
 *    - If simple direct command / test run -> `hands` (Guppi mechanical executor)
 * 2. Intermediate Tool Execution:
 *    - While assistant is calling tools and handling tool results -> `hands` (Guppi mechanical executor with low/zero thinking)
 * 3. Final Assistant Turn (no tool calls pending, replying to user):
 *    - Transitions to `voice` (0 thinking tokens, concise caveman response)
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getTriModelConfig, setTriModelConfig, type ModelTierRole } from "./model-router.ts";
import { classifyTurnIntent } from "./effort.ts";

export interface TurnTransitionState {
  hasExecutedToolsInTurn: boolean;
  isInitialTurn: boolean;
  currentCycleRole: "voice" | "mind" | "hands";
}

let turnState: TurnTransitionState = {
  hasExecutedToolsInTurn: false,
  isInitialTurn: true,
  currentCycleRole: "hands",
};

export function getTurnTransitionState(): TurnTransitionState {
  return { ...turnState };
}

export function resetTurnTransitionState(): void {
  turnState = {
    hasExecutedToolsInTurn: false,
    isInitialTurn: true,
    currentCycleRole: "hands",
  };
}

/**
 * Determine appropriate role for an incoming user input.
 */
export function determineInputRole(userText: string): "mind" | "hands" {
  const intent = classifyTurnIntent(userText);
  if (intent === "architecture" || intent === "debug") {
    return "mind";
  }
  if (intent === "test_run" || intent === "quick_fix") {
    return "hands";
  }

  // By default, for non-trivial instructions (> 50 chars or multi-word), start in mind
  const words = userText.trim().split(/\s+/);
  if (words.length >= 5) {
    return "mind";
  }
  return "hands";
}

/**
 * Register automated turn-transition hooks with Pi.
 */
export function registerTurnTransitionHooks(pi: ExtensionAPI): void {
  pi.on("session_start", () => {
    resetTurnTransitionState();
  });

  // 1. User Input arrives -> evaluate whether to begin in mind (planner) or hands (guppi)
  pi.on("input", async (event: any) => {
    const config = getTriModelConfig();
    if (!config.autoTurnTransition) return { action: "continue" };

    const text = typeof event?.text === "string" ? event.text : "";
    turnState.hasExecutedToolsInTurn = false;
    turnState.isInitialTurn = true;

    const targetRole = determineInputRole(text);
    turnState.currentCycleRole = targetRole;
    setTriModelConfig({ activeRole: targetRole });

    return { action: "continue" };
  });

  // 2. Tool executed -> transition cycle into `hands` (Guppi mechanical executor)
  pi.on("tool_call", async () => {
    const config = getTriModelConfig();
    if (!config.autoTurnTransition) return;

    turnState.hasExecutedToolsInTurn = true;
    turnState.isInitialTurn = false;
    if (turnState.currentCycleRole !== "hands") {
      turnState.currentCycleRole = "hands";
      setTriModelConfig({ activeRole: "hands" });
    }
  });

  // 3. Assistant emits message -> if it made no tool calls or completed all tool calls, transition to `voice`
  pi.on("turn_end", async (event: any) => {
    const config = getTriModelConfig();
    if (!config.autoTurnTransition) return;

    const message = event?.message;
    if (message?.role === "assistant") {
      const toolCalls = message?.tool_calls || message?.toolCalls || [];
      const hasTools = Array.isArray(toolCalls) && toolCalls.length > 0;

      if (!hasTools) {
        // Pure text response to user -> switch to voice (0 thinking, clean conversational completion)
        turnState.currentCycleRole = "voice";
        setTriModelConfig({ activeRole: "voice" });
      }
    }
  });
}
