/**
 * `episode-storage` — Tier-2 Episodic Session Storage (Volition / Mini-Volition pattern).
 *
 * Implements dual-storage for session compaction checkpoints and episodes:
 * 1. JSONL log: `<sessionsDir>/episodes.jsonl` (append-only human/tool inspectable)
 * 2. SQLite DB: `<sessionsDir>/episodes.db` (indexed, queryable episodic store)
 *
 * Captures episode checkpoints containing:
 * - timestamp, cwd, gitCommit, branch
 * - goal, accomplishments, discoveries, nextSteps, touchedFiles
 * - raw token metrics / stats
 */

import { existsSync, mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { Database } from "bun:sqlite";
import type { SessionSummaryPayload } from "./bridge.ts";

export interface EpisodeRecord {
  id: string;
  timestamp: number;
  cwd: string;
  gitBranch?: string;
  gitCommit?: string;
  goal: string;
  accomplished: string[];
  discoveries: string[];
  nextSteps: string[];
  relevantFiles: string[];
  tokensScrubbed?: number;
}

export function getEpisodesDir(customBase?: string): string {
  const base = customBase || join(homedir(), ".pi", "episodes");
  if (!existsSync(base)) {
    mkdirSync(base, { recursive: true });
  }
  return base;
}

/**
 * Initialize SQLite database schema for episodes.
 */
export function initEpisodesDb(dbPath: string): Database {
  const db = new Database(dbPath);
  db.run(`
    CREATE TABLE IF NOT EXISTS episodes (
      id TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL,
      cwd TEXT NOT NULL,
      git_branch TEXT,
      git_commit TEXT,
      goal TEXT NOT NULL,
      accomplished_json TEXT NOT NULL,
      discoveries_json TEXT NOT NULL,
      next_steps_json TEXT NOT NULL,
      relevant_files_json TEXT NOT NULL,
      tokens_scrubbed INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_episodes_cwd ON episodes(cwd);
    CREATE INDEX IF NOT EXISTS idx_episodes_timestamp ON episodes(timestamp);
  `);
  return db;
}

/**
 * Store an episode into both JSONL and SQLite.
 */
export function recordEpisode(
  payload: SessionSummaryPayload,
  cwd: string = process.cwd(),
  options: {
    baseDir?: string;
    gitBranch?: string;
    gitCommit?: string;
    tokensScrubbed?: number;
  } = {},
): EpisodeRecord {
  const dir = getEpisodesDir(options.baseDir);
  const now = Date.now();
  const id = `ep_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  const record: EpisodeRecord = {
    id,
    timestamp: now,
    cwd,
    gitBranch: options.gitBranch,
    gitCommit: options.gitCommit,
    goal: payload.goal || "(Compaction checkpoint)",
    accomplished: payload.accomplished || [],
    discoveries: payload.discoveries || [],
    nextSteps: payload.nextSteps || [],
    relevantFiles: payload.relevantFiles || [],
    tokensScrubbed: options.tokensScrubbed ?? 0,
  };

  // 1. JSONL append
  const jsonlPath = join(dir, "episodes.jsonl");
  try {
    appendFileSync(jsonlPath, JSON.stringify(record) + "\n", "utf-8");
  } catch {
    // best-effort
  }

  // 2. SQLite insert
  const dbPath = join(dir, "episodes.db");
  try {
    const db = initEpisodesDb(dbPath);
    const stmt = db.prepare(`
      INSERT INTO episodes (
        id, timestamp, cwd, git_branch, git_commit, goal,
        accomplished_json, discoveries_json, next_steps_json, relevant_files_json, tokens_scrubbed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      record.id,
      record.timestamp,
      record.cwd,
      record.gitBranch || null,
      record.gitCommit || null,
      record.goal,
      JSON.stringify(record.accomplished),
      JSON.stringify(record.discoveries),
      JSON.stringify(record.nextSteps),
      JSON.stringify(record.relevantFiles),
      record.tokensScrubbed ?? 0,
    );
    db.close();
  } catch {
    // best-effort
  }

  return record;
}

/**
 * Query recent episodes for a workspace directory from SQLite.
 */
export function queryEpisodes(
  cwd: string = process.cwd(),
  limit: number = 5,
  customBase?: string,
): EpisodeRecord[] {
  const dir = getEpisodesDir(customBase);
  const dbPath = join(dir, "episodes.db");
  if (!existsSync(dbPath)) return [];

  try {
    const db = new Database(dbPath, { readonly: true });
    const stmt = db.prepare(`
      SELECT * FROM episodes
      WHERE cwd = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    const rows = stmt.all(cwd, limit) as any[];
    db.close();

    return rows.map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      cwd: r.cwd,
      gitBranch: r.git_branch ?? undefined,
      gitCommit: r.git_commit ?? undefined,
      goal: r.goal,
      accomplished: JSON.parse(r.accomplished_json || "[]"),
      discoveries: JSON.parse(r.discoveries_json || "[]"),
      nextSteps: JSON.parse(r.next_steps_json || "[]"),
      relevantFiles: JSON.parse(r.relevant_files_json || "[]"),
      tokensScrubbed: r.tokens_scrubbed || 0,
    }));
  } catch {
    return [];
  }
}

/**
 * Check which past episodes have been superseded based on modified files (Lineage & Invalidation pattern).
 */
export function annotateEpisodeLineage(
  episodes: EpisodeRecord[],
  modifiedFiles: string[] = [],
): Array<EpisodeRecord & { supersededBy?: string[] }> {
  if (!episodes || episodes.length === 0) return [];
  const normalizedModified = new Set(modifiedFiles.map((f) => f.replace(/^(\.\/|\/)/, "")));

  return episodes.map((ep) => {
    const overlapping = ep.relevantFiles.filter((rf) => {
      const norm = rf.replace(/^(\.\/|\/)/, "");
      return normalizedModified.has(norm);
    });

    if (overlapping.length > 0) {
      return {
        ...ep,
        supersededBy: overlapping,
      };
    }
    return ep;
  });
}

/**
 * Format recent episodes into a compact prompt injection block.
 * Includes lineage indicators and [SUPERSEDED] flags for invalidated knowledge.
 */
export function formatPastEpisodesBlock(
  episodes: EpisodeRecord[],
  modifiedFiles: string[] = [],
): string {
  if (!episodes || episodes.length === 0) return "";

  const annotated = annotateEpisodeLineage(episodes, modifiedFiles);
  const lines: string[] = ["[PAST EPISODES]"];

  for (const ep of annotated) {
    const timeStr = new Date(ep.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const gitRef = ep.gitCommit ? ` (${ep.gitBranch || "HEAD"} @ ${ep.gitCommit})` : "";
    const supersededTag = ep.supersededBy && ep.supersededBy.length > 0
      ? ` [SUPERSEDED: ${ep.supersededBy.slice(0, 2).join(", ")} modified]`
      : "";

    lines.push(`• [${timeStr}${gitRef}] Goal: ${ep.goal}${supersededTag}`);

    if (ep.accomplished.length > 0) {
      lines.push(`  Accomplished: ${ep.accomplished.slice(0, 3).join("; ")}`);
    }
    if (ep.discoveries.length > 0) {
      lines.push(`  Learned: ${ep.discoveries.slice(0, 2).join("; ")}`);
    }
    if (ep.relevantFiles.length > 0) {
      lines.push(`  Touched files: ${ep.relevantFiles.slice(0, 4).join(", ")}`);
    }
    if (ep.nextSteps.length > 0) {
      lines.push(`  Pending: ${ep.nextSteps.slice(0, 2).join("; ")}`);
    }
  }

  return lines.join("\n");
}

