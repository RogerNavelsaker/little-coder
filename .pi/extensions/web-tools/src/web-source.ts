/**
 * `web_source` tool — Multi-engine code & file search / retrieval.
 *
 * Supported operations:
 * - `search`: Search code repositories via Sourcegraph API (or GitHub CLI `gh search code` fallback)
 * - `file`: Fetch raw file content from repository via Sourcegraph raw API (or `gh api` / `curl` fallback)
 * - `download`: Download media/files via `aria2c`, `yt-dlp`, or `curl`
 */

import { Type } from "@sinclair/typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { encodeToon } from "../../_shared/toon.ts";
import { storeWebArtifact } from "./storage.ts";

export interface SourcegraphMatch {
  repository: string;
  path: string;
  lineMatches?: Array<{ line: string; lineNumber: number }>;
}

export const webSourceItemSchema = Type.Object({
  op: Type.Optional(
    Type.Union([
      Type.Literal("search", { description: "Search code via Sourcegraph or gh cli fallback" }),
      Type.Literal("file", { description: "Fetch file content from repository" }),
      Type.Literal("download", { description: "Download media/file using yt-dlp, aria2c, or curl" }),
    ]),
  ),
  query: Type.Optional(Type.String({ description: "Search query or terms" })),
  url: Type.Optional(Type.String({ description: "Target URL to download or retrieve" })),
  repo: Type.Optional(Type.String({ description: "Repository name (e.g. github.com/owner/repo or owner/repo)" })),
  path: Type.Optional(Type.String({ description: "File path in repository or local save path" })),
  commit: Type.Optional(Type.String({ description: "Branch or commit hash (default: HEAD)" })),
  limit: Type.Optional(Type.Number({ description: "Max results limit (default: 10)" })),
  endpoint: Type.Optional(Type.String({ description: "Sourcegraph endpoint (env: SOURCEGRAPH_URL)" })),
  token: Type.Optional(Type.String({ description: "Sourcegraph access token (env: SRC_ACCESS_TOKEN)" })),
  downloader: Type.Optional(
    Type.Union([Type.Literal("yt-dlp"), Type.Literal("aria2c"), Type.Literal("curl")]),
  ),
  target: Type.Optional(Type.Union([Type.Literal("repo"), Type.Literal("user")])),
});

export const webSourceSchema = Type.Object({
  ops: Type.Optional(
    Type.Array(webSourceItemSchema, { description: "Batch web source operations" }),
  ),
  op: Type.Optional(
    Type.Union([
      Type.Literal("search"),
      Type.Literal("file"),
      Type.Literal("download"),
    ]),
  ),
  query: Type.Optional(Type.String()),
  url: Type.Optional(Type.String()),
  repo: Type.Optional(Type.String()),
  path: Type.Optional(Type.String()),
  commit: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Number()),
  endpoint: Type.Optional(Type.String()),
  token: Type.Optional(Type.String()),
  downloader: Type.Optional(Type.Union([Type.Literal("yt-dlp"), Type.Literal("aria2c"), Type.Literal("curl")])),
  target: Type.Optional(Type.Union([Type.Literal("repo"), Type.Literal("user")])),
});

export function executeWebSourceOp(op: any, cwd?: string): {
  success: boolean;
  op: string;
  output: string;
  matches?: SourcegraphMatch[];
  artifactPath?: string;
  error?: string;
} {
  const operation =
    op.op ||
    (op.url ? "download" : op.path && op.repo ? "file" : "search");

  // 1. Download operation (yt-dlp / aria2c / curl)
  if (operation === "download") {
    const url = op.url;
    if (!url) {
      return { success: false, op: "download", output: "Missing URL", error: "Missing URL" };
    }

    const downloader = op.downloader || (url.includes("youtube.com") || url.includes("youtu.be") || url.includes("vimeo.com") ? "yt-dlp" : "aria2c");

    // Try aria2c or yt-dlp first
    if (downloader === "yt-dlp") {
      const proc = spawnSync("yt-dlp", ["--no-playlist", "--no-warnings", url], {
        cwd,
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
      });

      if (proc.status === 0) {
        return {
          success: true,
          op: "download",
          output: proc.stdout.trim() || `Downloaded with yt-dlp: ${url}`,
        };
      }
    }

    if (downloader === "aria2c") {
      const outPath = op.path ? ["-o", op.path] : [];
      const proc = spawnSync("aria2c", ["-x", "4", "-s", "4", "--summary-interval=0", ...outPath, url], {
        cwd,
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
      });

      if (proc.status === 0) {
        return {
          success: true,
          op: "download",
          output: `Downloaded with aria2c: ${url}`,
        };
      }
    }

    // Fallback to curl
    const curlOut = op.path ? ["-o", op.path] : ["-O"];
    const proc = spawnSync("curl", ["-sSL", "--fail", ...curlOut, url], {
      cwd,
      encoding: "utf-8",
    });

    if (proc.status === 0) {
      return {
        success: true,
        op: "download",
        output: `Downloaded with curl: ${url}`,
      };
    }

    return {
      success: false,
      op: "download",
      output: proc.stderr || "Download failed across all tools",
      error: proc.stderr,
    };
  }

  // 2. File retrieval operation (Sourcegraph or gh api/curl fallback)
  if (operation === "file") {
    if (!op.repo || !op.path) {
      return { success: false, op: "file", output: "repo and path required", error: "Missing repo or path" };
    }

    const endpoint = op.endpoint || process.env.SOURCEGRAPH_URL || "https://sourcegraph.com";
    const token = op.token || process.env.SRC_ACCESS_TOKEN || "";
    const commit = op.commit || "HEAD";

    const headers = ["-H", "Accept: application/json, text/event-stream"];
    if (token) headers.push("-H", `Authorization: token ${token}`);

    const fileUrl = `${endpoint.replace(/\/+$/, "")}/${op.repo}@${commit}/-/raw/${op.path.replace(/^\/+/, "")}`;
    const proc = spawnSync("curl", ["-sSL", "--max-time", "30", ...headers, fileUrl], {
      encoding: "utf-8",
      maxBuffer: 20 * 1024 * 1024,
    });

    if (proc.status === 0 && proc.stdout) {
      const stored = storeWebArtifact(proc.stdout, `source-${op.path.split("/").pop()}`, "txt", {
        target: op.target || "repo",
        cwd,
      });

      return {
        success: true,
        op: "file",
        output: stored.inline ? stored.content : `File content saved: ${stored.filePath}`,
        artifactPath: stored.filePath,
      };
    }

    // Fallback: GitHub raw URL if repo is a github repo
    const cleanRepo = op.repo.replace(/^github\.com\//, "");
    const rawGhUrl = `https://raw.githubusercontent.com/${cleanRepo}/${commit === "HEAD" ? "main" : commit}/${op.path.replace(/^\/+/, "")}`;
    const ghProc = spawnSync("curl", ["-sSL", "--fail", "--max-time", "15", rawGhUrl], {
      encoding: "utf-8",
      maxBuffer: 20 * 1024 * 1024,
    });

    if (ghProc.status === 0 && ghProc.stdout) {
      const stored = storeWebArtifact(ghProc.stdout, `source-${op.path.split("/").pop()}`, "txt", {
        target: op.target || "repo",
        cwd,
      });

      return {
        success: true,
        op: "file",
        output: stored.inline ? stored.content : `File content saved: ${stored.filePath}`,
        artifactPath: stored.filePath,
      };
    }

    return {
      success: false,
      op: "file",
      output: proc.stderr || ghProc.stderr || "Failed to retrieve file from Sourcegraph and GitHub raw",
      error: proc.stderr || ghProc.stderr,
    };
  }

  // 3. Search operation (Sourcegraph or gh search fallback)
  const query = op.query || (op.repo ? `repo:^${op.repo}$` : "");
  if (!query) {
    return { success: false, op: "search", output: "query is required for code search", error: "Missing query" };
  }

  const endpoint = op.endpoint || process.env.SOURCEGRAPH_URL || "https://sourcegraph.com";
  const token = op.token || process.env.SRC_ACCESS_TOKEN || "";
  const limit = typeof op.limit === "number" ? op.limit : 10;

  const headers = ["-H", "Accept: application/json, text/event-stream"];
  if (token) headers.push("-H", `Authorization: token ${token}`);

  const searchUrl = `${endpoint.replace(/\/+$/, "")}/.api/search/stream?q=${encodeURIComponent(query)}&display=${limit}`;
  const proc = spawnSync("curl", ["-sSL", "--max-time", "30", ...headers, searchUrl], {
    encoding: "utf-8",
    maxBuffer: 20 * 1024 * 1024,
  });

  const matches: SourcegraphMatch[] = [];
  if (proc.status === 0 && proc.stdout) {
    const lines = proc.stdout.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === "event: matches" && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (nextLine.startsWith("data:")) {
          try {
            const rawData = JSON.parse(nextLine.slice(5).trim());
            if (Array.isArray(rawData)) {
              for (const item of rawData) {
                if (item.type === "content" || item.type === "path") {
                  matches.push({
                    repository: item.repository || "",
                    path: item.path || "",
                    lineMatches: item.lineMatches,
                  });
                }
              }
            }
          } catch {}
        }
      }
    }
  }

  // Fallback: gh search code if matches empty and gh CLI available
  if (matches.length === 0) {
    try {
      const ghProc = spawnSync("gh", ["search", "code", query, "--limit", String(limit), "--json", "repository,path"], {
        encoding: "utf-8",
      });
      if (ghProc.status === 0 && ghProc.stdout) {
        const parsed = JSON.parse(ghProc.stdout);
        for (const item of parsed) {
          matches.push({
            repository: item.repository?.fullName || item.repository?.name || "",
            path: item.path || "",
          });
        }
      }
    } catch {}
  }

  const toon = encodeToon({ query, count: matches.length, matches: matches.slice(0, limit) }).text;
  const stored = storeWebArtifact(toon, `sourcegraph-${query.slice(0, 30)}`, "toon", {
    target: op.target || "repo",
    cwd,
  });

  return {
    success: true,
    op: "search",
    matches: matches.slice(0, limit),
    output: stored.inline ? stored.content : `Sourcegraph results saved: ${stored.filePath}`,
    artifactPath: stored.filePath,
  };
}

export function registerWebSourceTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "web_source",
    label: "web_source",
    description: "Search open-source code and retrieve repository files using Sourcegraph API or fallback to bundled CLIs (gh/curl/aria2c/yt-dlp).",
    parameters: webSourceSchema,
    execute: async (_toolCallId: string, params: any) => {
      const ops = params?.ops || [params];
      const detailsList: any[] = [];
      const contentList: string[] = [];

      for (const op of ops) {
        const res = executeWebSourceOp(op);
        detailsList.push(res);
        contentList.push(res.output);
      }

      return {
        content: [{ type: "text", text: contentList.join("\n\n---\n\n") }],
        details: { ops: detailsList },
      };
    },
    renderResult: (result: any, { expanded }: { expanded: boolean }, theme: any) => {
      const details = result?.details?.ops || [];
      const first = details[0] || {};
      const count = first.matches?.length || 0;

      if (!expanded) {
        const text = theme?.fg ? theme.fg("accent", `🐙 Sourcegraph (${count} matches)`) : `🐙 Sourcegraph (${count} matches)`;
        return new Text(text, 0, 0);
      }

      const lines = [`🐙 Sourcegraph matches: ${count}`];
      for (const m of (first.matches || []).slice(0, 5)) {
        lines.push(`• [${m.repository}] ${m.path}`);
      }
      const text = theme?.fg ? theme.fg("muted", lines.join("\n")) : lines.join("\n");
      return new Text(text, 0, 0);
    },
  });
}
