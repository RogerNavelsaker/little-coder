/**
 * `bridge` helper — Engram persistent memory & Grove compaction bridge.
 *
 * Provides bridge functions to capture active session summaries, decisions,
 * and key learnings into Engram (via `engram` CLI) without writing `.pi-context/`
 * files or cluttering repositories.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync, execSync } from "node:child_process";
import type { AgentMessage } from "@earendil-works/pi-agent-core";

export interface SessionSummaryPayload {
  goal: string;
  instructions: string[];
  discoveries: string[];
  accomplished: string[];
  nextSteps: string[];
  relevantFiles: string[];
}

/** Check if engram CLI is available on PATH */
export function isEngramAvailable(): boolean {
  try {
    const res = spawnSync("which", ["engram"], { encoding: "utf-8" });
    return res.status === 0 && res.stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/** Format structured session summary text for Engram session_summary */
export function formatSessionSummary(payload: SessionSummaryPayload): string {
  const parts: string[] = [];

  parts.push("## Goal");
  parts.push(payload.goal.trim() || "(Session compaction checkpoint)");
  parts.push("");

  if (payload.instructions.length > 0) {
    parts.push("## Instructions");
    for (const inst of payload.instructions) {
      parts.push(`- ${inst}`);
    }
    parts.push("");
  }

  if (payload.discoveries.length > 0) {
    parts.push("## Discoveries");
    for (const disc of payload.discoveries) {
      parts.push(`- ${disc}`);
    }
    parts.push("");
  }

  parts.push("## Accomplished");
  if (payload.accomplished.length > 0) {
    for (const acc of payload.accomplished) {
      parts.push(`- ${acc}`);
    }
  } else {
    parts.push("- Ongoing session work compacted");
  }
  parts.push("");

  if (payload.nextSteps.length > 0) {
    parts.push("## Next Steps");
    for (const next of payload.nextSteps) {
      parts.push(`- ${next}`);
    }
    parts.push("");
  }

  if (payload.relevantFiles.length > 0) {
    parts.push("## Relevant Files");
    for (const file of payload.relevantFiles) {
      parts.push(`- ${file}`);
    }
    parts.push("");
  }

  return parts.join("\n").trim();
}

/**
 * Extract heuristic session accomplishments and touched files from AgentMessages.
 */
export function extractCompactionContext(messages: AgentMessage[]): SessionSummaryPayload {
  const accomplished: string[] = [];
  const discoveries: string[] = [];
  const relevantFiles = new Set<string>();
  let goal = "";

  for (const msg of messages) {
    if (msg.role === "user") {
      const text = typeof msg.content === "string"
        ? msg.content
        : Array.isArray(msg.content)
          ? msg.content.map((c: any) => c.text || "").join(" ")
          : "";

      if (!goal && text && !text.startsWith("/") && !text.startsWith("<active_clipboard>")) {
        goal = text.slice(0, 150);
      }
    } else if (msg.role === "assistant") {
      const text = typeof msg.content === "string"
        ? msg.content
        : Array.isArray(msg.content)
          ? msg.content.map((c: any) => c.text || "").join(" ")
          : "";

      // Heuristic extraction for learnings/discoveries
      const lines = text.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("✓") || trimmed.startsWith("Completed") || trimmed.startsWith("Fixed")) {
          accomplished.push(trimmed.slice(0, 120));
        } else if (trimmed.startsWith("Key Learning") || trimmed.startsWith("Discovered:")) {
          discoveries.push(trimmed.slice(0, 120));
        }
      }
    } else if (msg.role === "toolResult") {
      // Collect file paths from tool results or details
      const details: any = (msg as any).details;
      if (details?.path && typeof details.path === "string") {
        relevantFiles.add(details.path);
      }
      if (details?.files && Array.isArray(details.files)) {
        for (const f of details.files) {
          if (typeof f === "string") relevantFiles.add(f);
        }
      }
    }
  }

  return {
    goal: goal || "Context compaction checkpoint",
    instructions: [],
    discoveries: discoveries.slice(-5),
    accomplished: accomplished.slice(-8),
    nextSteps: [],
    relevantFiles: Array.from(relevantFiles).slice(-10),
  };
}

/**
 * Save observation or session summary directly into Engram via CLI.
 */
export function saveEngramSummary(
  summary: string,
  cwd: string = process.cwd(),
): { success: boolean; output: string } {
  if (!isEngramAvailable()) {
    return { success: false, output: "engram CLI not found on PATH" };
  }

  try {
    const res = spawnSync("engram", ["save", "--type", "session_summary", "--title", "Compaction summary", summary], {
      cwd,
      encoding: "utf-8",
    });

    return {
      success: res.status === 0,
      output: (res.stdout || res.stderr || "").trim(),
    };
  } catch (err: any) {
    return {
      success: false,
      output: err?.message || String(err),
    };
  }
}
