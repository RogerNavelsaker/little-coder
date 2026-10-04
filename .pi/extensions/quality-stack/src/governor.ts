/**
 * `governor` module — Turn velocity and rapid-fire loop circuit breaker (Volition-inspired).
 *
 * Prevents rapid-fire autonomous agent cascades where models generate failing commands
 * in tight sub-second / high-frequency loops, exhausting API token budgets or spinning CPU.
 *
 * Contract:
 * - Tracks timestamps of turns within a rolling time window (`windowMs`, default: 120,000ms / 2 min).
 * - If turns in window exceed `maxTurnsPerWindow` (default: 15), triggers a circuit breaker cooldown.
 * - Cooldown enforces a refractory pause (`cooldownMs`, default: 30,000ms / 30s) or aborts if configured.
 */

export interface GovernorConfig {
  maxTurnsPerWindow: number;
  windowMs: number;
  cooldownMs: number;
}

export function resolveGovernorConfig(env: NodeJS.ProcessEnv = process.env): GovernorConfig {
  const maxTurns = env.LITTLE_CODER_GOVERNOR_MAX_TURNS
    ? parseInt(env.LITTLE_CODER_GOVERNOR_MAX_TURNS, 10)
    : 15;
  const windowMs = env.LITTLE_CODER_GOVERNOR_WINDOW_MS
    ? parseInt(env.LITTLE_CODER_GOVERNOR_WINDOW_MS, 10)
    : 120_000;
  const cooldownMs = env.LITTLE_CODER_GOVERNOR_COOLDOWN_MS
    ? parseInt(env.LITTLE_CODER_GOVERNOR_COOLDOWN_MS, 10)
    : 30_000;

  return {
    maxTurnsPerWindow: isNaN(maxTurns) || maxTurns <= 0 ? 15 : maxTurns,
    windowMs: isNaN(windowMs) || windowMs <= 0 ? 120_000 : windowMs,
    cooldownMs: isNaN(cooldownMs) || cooldownMs <= 0 ? 30_000 : cooldownMs,
  };
}

export type GovernorAction =
  | { action: "allow" }
  | { action: "throttle"; waitMs: number; turnsInWindow: number; message: string };

export class Governor {
  private turnTimestamps: number[] = [];
  private lastThrottleUntil = 0;
  private config: GovernorConfig;

  constructor(config?: GovernorConfig) {
    this.config = config ?? resolveGovernorConfig();
  }

  reset(): void {
    this.turnTimestamps = [];
    this.lastThrottleUntil = 0;
  }

  evaluateTurn(now: number = Date.now()): GovernorAction {
    // 1. Check if still in cooldown
    if (now < this.lastThrottleUntil) {
      const waitRemaining = this.lastThrottleUntil - now;
      return {
        action: "throttle",
        waitMs: waitRemaining,
        turnsInWindow: this.turnTimestamps.length,
        message: `Turn velocity governor active: cooling down for ${Math.ceil(waitRemaining / 1000)}s to prevent runaway cascade.`,
      };
    }

    // 2. Prune timestamps outside rolling window
    const windowStart = now - this.config.windowMs;
    this.turnTimestamps = this.turnTimestamps.filter((ts) => ts >= windowStart);

    // 3. Record current turn timestamp
    this.turnTimestamps.push(now);

    // 4. Check if velocity threshold exceeded
    if (this.turnTimestamps.length > this.config.maxTurnsPerWindow) {
      this.lastThrottleUntil = now + this.config.cooldownMs;
      this.turnTimestamps = []; // Reset window to allow resuming after cooldown
      return {
        action: "throttle",
        waitMs: this.config.cooldownMs,
        turnsInWindow: this.config.maxTurnsPerWindow + 1,
        message: `Turn velocity governor tripped: limit of ${this.config.maxTurnsPerWindow} turns per ${Math.round(this.config.windowMs / 1000)}s exceeded. Pausing for ${Math.round(this.config.cooldownMs / 1000)}s cooldown.`,
      };
    }

    return { action: "allow" };
  }
}
