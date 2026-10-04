/**
 * `orientation` module — Session resume & wake orientation calculation (Volition-inspired).
 *
 * Capabilities:
 * - Tracks timestamps across agent turns and sleep/idle gaps.
 * - Inspects git status (branch, HEAD commit, uncommitted modifications).
 * - Generates a compact `[ORIENTATION]` block when waking after idle periods (> 60 seconds)
 *   or external changes occurred, orienting small models without expensive historical re-reading.
 */

import { execSync } from "node:child_process";

export interface OrientationData {
  elapsedIdleMs: number;
  gitBranch?: string;
  gitCommit?: string;
  gitDirtyCount?: number;
  gitDirtyFiles?: string[];
}

export function computeOrientation(
  lastActiveTimestamp?: number,
  cwd: string = process.cwd(),
  now: number = Date.now(),
): OrientationData {
  const elapsedIdleMs = lastActiveTimestamp ? Math.max(0, now - lastActiveTimestamp) : 0;

  let gitBranch: string | undefined;
  let gitCommit: string | undefined;
  let gitDirtyFiles: string[] = [];

  try {
    gitBranch = execSync("git branch --show-current 2>/dev/null", { cwd, encoding: "utf-8" }).trim();
    gitCommit = execSync("git rev-parse --short HEAD 2>/dev/null", { cwd, encoding: "utf-8" }).trim();
    const statusOut = execSync("git status --porcelain 2>/dev/null", { cwd, encoding: "utf-8" }).trim();
    if (statusOut) {
      gitDirtyFiles = statusOut
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
    }
  } catch {
    // Non-git directory or git not available
  }

  return {
    elapsedIdleMs,
    gitBranch: gitBranch || undefined,
    gitCommit: gitCommit || undefined,
    gitDirtyCount: gitDirtyFiles.length,
    gitDirtyFiles,
  };
}

export function formatOrientationBlock(data: OrientationData): string {
  const parts: string[] = [];

  if (data.elapsedIdleMs > 0) {
    const totalSec = Math.round(data.elapsedIdleMs / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    parts.push(`Idle Gap: ${timeStr} elapsed since last active turn`);
  }

  if (data.gitBranch) {
    parts.push(`Git: ${data.gitBranch} @ ${data.gitCommit ?? "unknown"}`);
  }

  if (data.gitDirtyCount !== undefined) {
    if (data.gitDirtyCount === 0) {
      parts.push(`Working Tree: clean`);
    } else {
      const shown = (data.gitDirtyFiles || []).slice(0, 5);
      const remaining = data.gitDirtyCount - shown.length;
      const fileList = shown.join(", ") + (remaining > 0 ? ` (+${remaining} more)` : "");
      parts.push(`Working Tree: ${data.gitDirtyCount} uncommitted change(s) [${fileList}]`);
    }
  }

  return `[ORIENTATION]\n${parts.join("\n")}`;
}
