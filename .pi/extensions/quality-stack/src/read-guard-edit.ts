/**
 * `read-guard-edit` — Enforce Read-before-Edit invariant.
 *
 * Ensures that a model reads a file in the active session before attempting to edit it.
 * Prevents small models from guessing file content or line anchors.
 */

import { resolve } from "node:path";

export class ReadGuardEditTracker {
  private readFiles = new Set<string>();

  public reset(): void {
    this.readFiles.clear();
  }

  public recordAccess(filePath: string, cwd: string = process.cwd()): void {
    if (!filePath || typeof filePath !== "string") return;
    const full = resolve(cwd, filePath);
    this.readFiles.add(full);
  }

  public hasRead(filePath: string, cwd: string = process.cwd()): boolean {
    if (!filePath || typeof filePath !== "string") return false;
    const full = resolve(cwd, filePath);
    return this.readFiles.has(full);
  }

  public checkEdit(
    filePath: string,
    cwd: string = process.cwd(),
  ): { allowed: boolean; reason?: string } {
    if (!filePath || typeof filePath !== "string") {
      return { allowed: true }; // Let edit tool surface missing path error
    }

    const full = resolve(cwd, filePath);
    if (!this.readFiles.has(full)) {
      return {
        allowed: false,
        reason:
          `File must be read first before edit — ${filePath} has not been read in this session.\n\n` +
          `Read ${filePath} first to inspect the exact line anchors and surrounding context, ` +
          `then apply the edit. Do not guess file contents.`,
      };
    }

    return { allowed: true };
  }
}
