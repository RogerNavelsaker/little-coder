/**
 * `quality-monitor` — Loop, patch-spiral, and hallucination monitor.
 *
 * Detects:
 * 1. Read Loop: Reading the same file repeatedly (3+ times) without any mutation.
 * 2. Patch Spiral: Repeatedly attempting and failing precision edits on the same file/anchor.
 * 3. Hallucinated Tools: Model calling tools that do not exist in the active schema.
 */

import { statSync } from "node:fs";
import { resolve } from "node:path";

export interface QualityIncident {
  type: "read_loop" | "patch_spiral" | "hallucinated_tool";
  target: string;
  count: number;
  suggestion: string;
}

export class QualityMonitor {
  private fileReadCounts = new Map<string, number>();
  private fileMtimes = new Map<string, number>();
  private failedEditCounts = new Map<string, number>();

  recordToolExecution(
    toolName: string,
    params: any,
    isError: boolean,
    availableTools: Set<string>,
    cwd: string = process.cwd(),
  ): QualityIncident | null {
    // 1. Check hallucinated tool
    if (!availableTools.has(toolName) && toolName !== "sh") {
      return {
        type: "hallucinated_tool",
        target: toolName,
        count: 1,
        suggestion: `Tool '${toolName}' does not exist. Use available tools or run commands via 'sh'.`,
      };
    }

    // 2. Check read loop
    if (toolName === "read") {
      const readPaths: string[] = [];
      if (params?.path) {
        readPaths.push(String(params.path));
      } else if (Array.isArray(params?.files)) {
        for (const f of params.files) {
          if (f?.path) readPaths.push(String(f.path));
        }
      }

      for (const p of readPaths) {
        const full = resolve(cwd, p);
        let currentMtime: number | undefined;
        try {
          currentMtime = statSync(full).mtimeMs;
        } catch {
          // File might not exist or be virtual
        }

        const lastMtime = this.fileMtimes.get(p);
        // If file was modified externally on disk since last read, reset loop counter
        if (currentMtime !== undefined && lastMtime !== undefined && currentMtime > lastMtime) {
          this.fileReadCounts.set(p, 1);
          this.fileMtimes.set(p, currentMtime);
          continue;
        }

        if (currentMtime !== undefined) {
          this.fileMtimes.set(p, currentMtime);
        }

        const current = (this.fileReadCounts.get(p) || 0) + 1;
        this.fileReadCounts.set(p, current);
        if (current >= 3) {
          return {
            type: "read_loop",
            target: p,
            count: current,
            suggestion: `File '${p}' has been read ${current} times without modification. Rely on existing context or use 'outline'/'ast_search' instead of re-reading.`,
          };
        }
      }
    }

    // Reset read count on edit/write to the same file
    if ((toolName === "edit" || toolName === "write")) {
      const targetPath = params?.path || (Array.isArray(params?.edits) && params.edits[0]?.path);
      if (targetPath) {
        this.fileReadCounts.delete(String(targetPath));
      }
    }

    // 3. Check patch spiral
    if (toolName === "edit" && isError) {
      const p = String(params?.path || params?.edits?.[0]?.path || "unknown");
      const current = (this.failedEditCounts.get(p) || 0) + 1;
      this.failedEditCounts.set(p, current);
      if (current >= 2) {
        return {
          type: "patch_spiral",
          target: p,
          count: current,
          suggestion: `Repeated failed edits on '${p}' (${current} failures). Use fresh 'read' with line anchors or review the file outline.`,
        };
      }
    } else if (toolName === "edit" && !isError) {
      const p = String(params?.path || params?.edits?.[0]?.path || "unknown");
      this.failedEditCounts.delete(p);
    }

    return null;
  }

  reset(): void {
    this.fileReadCounts.clear();
    this.fileMtimes.clear();
    this.failedEditCounts.clear();
  }
}
