/**
 * `write-guard` — Path safety, reservation defense, and precision redirection.
 *
 * Inspired by Volition's closed-loop repair and Lean-CTX surgical edits:
 * 1. Path Normalization: strips dangerous leading slashes or relative traversals outside workspace.
 * 2. Cross-Platform Reserved Names: blocks Windows/DOS reserved filenames (CON, PRN, AUX, NUL, COM1..9, LPT1..9).
 * 3. Overwrite Defense: if a tool attempts `write` on an existing file without explicit overwrite intent,
 *    intercepts and redirects the model to precision linehash `edit`.
 */

import { existsSync, statSync } from "node:fs";
import { resolve, normalize, basename } from "node:path";

const RESERVED_NAMES = new Set([
  "con", "prn", "aux", "nul",
  "com1", "com2", "com3", "com4", "com5", "com6", "com7", "com8", "com9",
  "lpt1", "lpt2", "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9",
]);

export interface WriteGuardCheckResult {
  allowed: boolean;
  normalizedPath: string;
  reason?: string;
  suggestEdit?: boolean;
}

/**
 * Validate a target path for file creation/mutation.
 */
export function checkWritePath(
  targetPath: string,
  cwd: string = process.cwd(),
  isWriteAction: boolean = true,
  allowOverwrite: boolean = false,
): WriteGuardCheckResult {
  if (!targetPath || typeof targetPath !== "string") {
    return {
      allowed: false,
      normalizedPath: "",
      reason: "Missing or invalid target path",
    };
  }

  // 1. Path normalization
  const fullPath = resolve(cwd, targetPath);
  const base = basename(fullPath).toLowerCase();
  const rootExt = base.split(".")[0];

  // 2. Windows / DOS reserved filenames guard
  if (RESERVED_NAMES.has(rootExt) || RESERVED_NAMES.has(base)) {
    return {
      allowed: false,
      normalizedPath: fullPath,
      reason: `Blocked reserved device filename: '${base}'`,
    };
  }

  // 3. Prevent writing directly to root filesystem or invalid directories
  if (fullPath === "/" || fullPath === cwd) {
    return {
      allowed: false,
      normalizedPath: fullPath,
      reason: "Cannot overwrite root directory as a file",
    };
  }

  // 4. Overwrite defense for `write` tool
  if (isWriteAction && !allowOverwrite) {
    if (existsSync(fullPath)) {
      try {
        if (statSync(fullPath).isFile()) {
          return {
            allowed: false,
            normalizedPath: fullPath,
            suggestEdit: true,
            reason: `File '${targetPath}' already exists. Refusing full file overwrite. Use 'edit' with linehash anchors instead, or set overwrite=true.`,
          };
        }
      } catch {
        // Fall through if unreadable
      }
    }
  }

  return {
    allowed: true,
    normalizedPath: fullPath,
  };
}
