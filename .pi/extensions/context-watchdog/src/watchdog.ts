/**
 * `watchdog` core logic for mid-run token compaction and loop guards.
 */

export interface ContextUsageLike {
  tokens: number | null;
  contextWindow: number;
  percent: number | null;
}

export const DEFAULT_PERCENT = 80;
export const MIN_PROGRESS_PCT = 5;

export const RESUME_MESSAGE =
  "Your context was automatically compacted mid-task to stay within the model's window. " +
  "Continue the task from where you left off — the summary above preserves the work done so far. " +
  "Do not restart from scratch or re-ask the user; just carry on. " +
  "Rely on the summary and the files already in context — do NOT re-read files " +
  "you have already read or re-explore the project from scratch.";

export function compactionHelped(postPercent: number, pct: number): boolean {
  return postPercent <= pct - MIN_PROGRESS_PCT;
}

export function thresholdPercent(env: NodeJS.ProcessEnv = process.env): number {
  if (env.LITTLE_CODER_NO_COMPACT_WATCHDOG === "1") return 0;
  const raw = env.LITTLE_CODER_COMPACT_AT_PERCENT;
  if (raw === undefined || raw.trim() === "") return DEFAULT_PERCENT;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_PERCENT;
  if (n <= 0 || n >= 100) return 0;
  return n;
}

export type CompactionOutcome = "already" | "cancelled" | "failed";

export function classifyCompactionError(message?: string): CompactionOutcome {
  const m = (message ?? "").toLowerCase();
  if (m.includes("already compacted")) return "already";
  if (m.includes("cancel") || m.includes("abort")) return "cancelled";
  return "failed";
}

export function canCompactMidRun(mode: unknown): boolean {
  return mode === "tui";
}

export function shouldCompactNow(
  usage: ContextUsageLike | undefined,
  pct: number,
  compacting: boolean,
): boolean {
  if (pct <= 0) return false;
  if (compacting) return false;
  if (!usage) return false;
  if (usage.contextWindow <= 0) return false;
  if (usage.tokens === null || usage.percent === null) return false;
  return usage.percent >= pct;
}
