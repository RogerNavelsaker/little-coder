/**
 * `focus` module — Channel/Tool burst & noise suppression (Mini-Volition focus pattern).
 *
 * Capabilities:
 * - Detects runaway tool call bursts within a sliding time window (e.g. 5 identical commands in 15 seconds).
 * - Enforces cooldown suspension directives when a burst threshold is exceeded.
 * - Injects a structured throttle intervention to halt runaway loops, prompting model reflection.
 */

export interface ToolCallEvent {
  toolName: string;
  signature: string;
  timestamp: number;
}

export interface FocusConfig {
  windowMs: number;
  burstThreshold: number;
  cooldownMs: number;
}

export interface ThrottleDirective {
  toolName: string;
  signature: string;
  burstCount: number;
  cooldownUntil: number;
  reason: string;
}

export const DEFAULT_FOCUS_CONFIG: FocusConfig = {
  windowMs: 15_000,       // 15 second sliding window
  burstThreshold: 4,      // 4 identical invocations within window
  cooldownMs: 10_000,     // 10 second cooldown
};

export class FocusManager {
  private events: ToolCallEvent[] = [];
  private suspensions = new Map<string, ThrottleDirective>();
  private config: FocusConfig;

  constructor(config: Partial<FocusConfig> = {}) {
    this.config = { ...DEFAULT_FOCUS_CONFIG, ...config };
  }

  /**
   * Derive a stable signature from tool name and arguments.
   */
  static getSignature(toolName: string, params: any): string {
    if (!params) return toolName;

    if (toolName === "sh" || toolName === "shell") {
      const cmd = typeof params === "string" ? params : (params.command || params.cmd || "");
      return `${toolName}:${String(cmd).trim().slice(0, 150)}`;
    }

    if (toolName === "read") {
      const p = params.path || (Array.isArray(params.files) ? params.files[0]?.path : "");
      return `${toolName}:${String(p)}`;
    }

    if (toolName === "edit" || toolName === "write") {
      const p = params.path || params.file_path || (Array.isArray(params.edits) ? params.edits[0]?.path : "");
      return `${toolName}:${String(p)}`;
    }

    try {
      return `${toolName}:${JSON.stringify(params).slice(0, 100)}`;
    } catch {
      return toolName;
    }
  }

  /**
   * Check if a tool execution should be blocked by active cooldown.
   */
  checkThrottle(toolName: string, params: any, now: number = Date.now()): ThrottleDirective | null {
    const signature = FocusManager.getSignature(toolName, params);
    const existing = this.suspensions.get(signature);

    if (existing) {
      if (now < existing.cooldownUntil) {
        return existing;
      }
      // Cooldown expired
      this.suspensions.delete(signature);
    }

    return null;
  }

  /**
   * Record a tool execution and check if it triggers a burst directive.
   */
  recordExecution(toolName: string, params: any, now: number = Date.now()): ThrottleDirective | null {
    const signature = FocusManager.getSignature(toolName, params);

    // Prune events outside window
    const windowStart = now - this.config.windowMs;
    this.events = this.events.filter((e) => e.timestamp >= windowStart);

    // Record this event
    this.events.push({
      toolName,
      signature,
      timestamp: now,
    });

    // Count occurrences of this signature in window
    const count = this.events.filter((e) => e.signature === signature).length;

    if (count >= this.config.burstThreshold) {
      const directive: ThrottleDirective = {
        toolName,
        signature,
        burstCount: count,
        cooldownUntil: now + this.config.cooldownMs,
        reason: `Burst loop detected: called ${count} times within ${Math.round(this.config.windowMs / 1000)}s`,
      };
      this.suspensions.set(signature, directive);
      return directive;
    }

    return null;
  }

  reset(): void {
    this.events = [];
    this.suspensions.clear();
  }
}
