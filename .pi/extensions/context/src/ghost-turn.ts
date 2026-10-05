/**
 * `ghost-turn` module — In-flight turn & action tracking with crash/interruption recovery (Mini-Volition pattern).
 *
 * Implements ephemeral state recording:
 * 1. Writes `.pi/in-flight-turn.json` upon starting a turn or tool execution.
 * 2. Clears it on clean completion (`turn_end` or tool success).
 * 3. On wake / session restart, detects un-cleared in-flight turns as "ghosts".
 * 4. Injects `[RECOVERY ALERT: PREVIOUS TURN INTERRUPTED]` into the orientation block,
 *    advising the model to verify workspace integrity / git diff before proceeding.
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface InFlightAction {
  toolName: string;
  argsSummary?: string;
  targetFile?: string;
  startedAt: number;
}

export interface InFlightTurn {
  turnId: string;
  startedAt: number;
  cwd: string;
  promptSummary?: string;
  activeAction?: InFlightAction;
}

export function getGhostStatePath(cwd: string = process.cwd(), customBase?: string): string {
  const base = customBase || join(cwd, ".pi");
  if (!existsSync(base)) {
    try {
      mkdirSync(base, { recursive: true });
    } catch {
      // best-effort
    }
  }
  return join(base, "in-flight-turn.json");
}

/**
 * Record an in-flight turn start.
 */
export function recordInFlightTurn(
  turnId: string,
  promptSummary?: string,
  cwd: string = process.cwd(),
  customBase?: string,
): void {
  const turn: InFlightTurn = {
    turnId,
    startedAt: Date.now(),
    cwd,
    promptSummary: promptSummary ? promptSummary.slice(0, 200) : undefined,
  };
  const path = getGhostStatePath(cwd, customBase);
  try {
    writeFileSync(path, JSON.stringify(turn, null, 2), "utf-8");
  } catch {
    // best-effort
  }
}

/**
 * Record an in-flight tool action within the turn.
 */
export function recordInFlightAction(
  toolName: string,
  args?: Record<string, any>,
  cwd: string = process.cwd(),
  customBase?: string,
): void {
  const path = getGhostStatePath(cwd, customBase);
  if (!existsSync(path)) return;

  try {
    const raw = readFileSync(path, "utf-8");
    const turn = JSON.parse(raw) as InFlightTurn;

    let targetFile: string | undefined;
    if (args) {
      if (typeof args.path === "string") targetFile = args.path;
      else if (typeof args.file === "string") targetFile = args.file;
      else if (typeof args.targetFile === "string") targetFile = args.targetFile;
      else if (Array.isArray(args.edits) && args.edits[0]?.path) targetFile = args.edits[0].path;
    }

    turn.activeAction = {
      toolName,
      targetFile,
      argsSummary: args ? JSON.stringify(args).slice(0, 150) : undefined,
      startedAt: Date.now(),
    };
    writeFileSync(path, JSON.stringify(turn, null, 2), "utf-8");
  } catch {
    // best-effort
  }
}

/**
 * Clear in-flight action when the tool finishes successfully.
 */
export function clearInFlightAction(cwd: string = process.cwd(), customBase?: string): void {
  const path = getGhostStatePath(cwd, customBase);
  if (!existsSync(path)) return;
  try {
    const raw = readFileSync(path, "utf-8");
    const turn = JSON.parse(raw) as InFlightTurn;
    delete turn.activeAction;
    writeFileSync(path, JSON.stringify(turn, null, 2), "utf-8");
  } catch {
    // best-effort
  }
}

/**
 * Clear in-flight turn upon clean completion.
 */
export function clearInFlightTurn(cwd: string = process.cwd(), customBase?: string): void {
  const path = getGhostStatePath(cwd, customBase);
  if (existsSync(path)) {
    try {
      unlinkSync(path);
    } catch {
      // best-effort
    }
  }
}

/**
 * Detect if there was an interrupted/ghosted turn and consume it.
 */
export function consumeGhostTurn(cwd: string = process.cwd(), customBase?: string): InFlightTurn | null {
  const path = getGhostStatePath(cwd, customBase);
  if (!existsSync(path)) return null;

  try {
    const raw = readFileSync(path, "utf-8");
    const turn = JSON.parse(raw) as InFlightTurn;
    // Remove the file so we don't alert repeatedly
    try {
      unlinkSync(path);
    } catch {
      // best-effort
    }
    return turn;
  } catch {
    try {
      unlinkSync(path);
    } catch {}
    return null;
  }
}

/**
 * Format a ghost turn recovery alert for injection into orientation or prompt.
 */
export function formatGhostRecoveryAlert(ghost: InFlightTurn): string {
  const elapsedSec = Math.round((Date.now() - ghost.startedAt) / 1000);
  const parts: string[] = [
    `[RECOVERY ALERT: PREVIOUS TURN INTERRUPTED]`,
    `Notice: The previous session or turn terminated abruptly ${elapsedSec}s ago without clean finalization.`,
  ];

  if (ghost.activeAction) {
    const action = ghost.activeAction;
    parts.push(
      `• Interrupted in-flight tool: "${action.toolName}"${action.targetFile ? ` on target: ${action.targetFile}` : ""}`,
    );
    parts.push(`• Risk: File edits or command execution may be incomplete or uncommitted.`);
  }

  if (ghost.promptSummary) {
    parts.push(`• Interrupted goal/intent: "${ghost.promptSummary}"`);
  }

  parts.push(
    `Action required: Run \`git status\` or verify affected files before resuming mutation to ensure environment consistency.`,
  );

  return parts.join("\n");
}
