/**
 * Document artifacts storage manager.
 * Rules:
 * - Content < 5KB is returned inline.
 * - Content >= 5KB is persisted to disk:
 *   - target 'repo': `.pi/docs/<timestamp>-<slug>/<file>`
 *   - target 'user': `~/.pi/docs/<timestamp>-<slug>/<file>`
 * - Returns reference path and metadata to conserve context tokens.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";

export const INLINE_SIZE_THRESHOLD = 5 * 1024; // 5KB

export interface StoredDocArtifact {
  inline: boolean;
  content: string;
  filePath?: string;
  bytes: number;
}

export function slugify(str: string): string {
  return (
    str
      .replace(/^https?:\/\//i, "")
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "doc"
  );
}

export function storeDocArtifact(
  content: string,
  slugHint: string,
  extension = "md",
  options?: {
    target?: "repo" | "user";
    cwd?: string;
  },
): StoredDocArtifact {
  const bytes = Buffer.byteLength(content, "utf-8");

  if (bytes < INLINE_SIZE_THRESHOLD) {
    return {
      inline: true,
      content,
      bytes,
    };
  }

  const target = options?.target || "repo";
  const cwd = options?.cwd || process.cwd();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const slug = slugify(slugHint);
  const dirName = `${timestamp}-${slug}`;

  const baseDir =
    target === "repo"
      ? resolve(cwd, ".pi/docs", dirName)
      : resolve(homedir(), ".pi/docs", dirName);

  if (!existsSync(baseDir)) {
    mkdirSync(baseDir, { recursive: true });
  }

  const fileName = `content.${extension.replace(/^\./, "")}`;
  const filePath = join(baseDir, fileName);
  writeFileSync(filePath, content, "utf-8");

  const summary = `Document artifact stored (${bytes} bytes): ${filePath}`;

  return {
    inline: false,
    content: summary,
    filePath,
    bytes,
  };
}
