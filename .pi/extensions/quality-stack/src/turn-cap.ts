/**
 * `turn-cap` module — Safety turn cap and finalize-warn guardrail.
 *
 * Prevents runaway loops during autonomous runs:
 * 1. `turn-cap`: Aborts execution if turn count reaches `maxTurns` (default: 40, configurable).
 * 2. `finalize-warn`: Fires when `warnRemaining` (default: 5) turns remain, warning the agent
 *    to finalize work, run verifications, and answer before budget exhaustion.
 */

export interface TurnCapConfig {
  maxTurns: number;
  warnRemaining: number;
}

export function resolveTurnCapConfig(env: NodeJS.ProcessEnv = process.env): TurnCapConfig {
  const envMax = env.LITTLE_CODER_MAX_TURNS ? parseInt(env.LITTLE_CODER_MAX_TURNS, 10) : NaN;
  const maxTurns = !isNaN(envMax) && envMax > 0 ? envMax : 40;

  const envWarn = env.LITTLE_CODER_WARN_REMAINING ? parseInt(env.LITTLE_CODER_WARN_REMAINING, 10) : NaN;
  const warnRemaining = !isNaN(envWarn) && envWarn > 0 ? envWarn : 5;

  return { maxTurns, warnRemaining };
}

export type TurnAction =
  | { action: "continue" }
  | { action: "warn"; remaining: number; message: string }
  | { action: "abort"; turnIndex: number; maxTurns: number; message: string };

export class TurnCapGuard {
  private warned = false;
  private config: TurnCapConfig;

  constructor(config?: TurnCapConfig) {
    this.config = config ?? resolveTurnCapConfig();
  }

  reset(): void {
    this.warned = false;
  }

  evaluateTurn(turnIndex: number): TurnAction {
    const currentTurn = turnIndex + 1;

    // 1. Cap reached: Abort
    if (currentTurn >= this.config.maxTurns) {
      return {
        action: "abort",
        turnIndex: currentTurn,
        maxTurns: this.config.maxTurns,
        message: `Safety turn cap reached (${currentTurn}/${this.config.maxTurns} turns). Halting execution to prevent runaway loop.`,
      };
    }

    // 2. Warn boundary reached: Warn once
    const remaining = this.config.maxTurns - currentTurn;
    if (remaining <= this.config.warnRemaining && !this.warned) {
      this.warned = true;
      return {
        action: "warn",
        remaining,
        message: `Warning: Only ${remaining} turn${remaining === 1 ? "" : "s"} remaining before budget exhaustion (${currentTurn}/${this.config.maxTurns}). Finalize current work and verify now.`,
      };
    }

    return { action: "continue" };
  }
}
