/**
 * `web_source` tool — Sourcegraph code search and file retrieval.
 *
 * Supported operations:
 * - `search`: Search public or private code repositories via Sourcegraph stream API
 * - `file`: Fetch raw file content from repository via Sourcegraph raw API
 */

import { Type } from "@sinclair/typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { spawnSync } from "node:child_process";
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
      Type.Literal("search", { description: "Search code via Sourcegraph" }),
      Type.Literal("file", { description: "Fetch file content from repository" }),
    ]),
  ),
  query: Type.Optional(Type.String({ description: "Sourcegraph search query (e.g. repo:^github.com/... query)" })),
  repo: Type.Optional(Type.String({ description: "Repository name (e.g. github.com/owner/repo)" })),
  path: Type.Optional(Type.String({ description: "File path in repository" })),
  commit: Type.Optional(Type.String({ description: "Branch or commit hash (default: HEAD)" })),
  limit: Type.Optional(Type.Number({ description: "Max results limit (default: 10)" })),
  endpoint: Type.Optional(Type.String({ description: "Sourcegraph endpoint (default: https://sourcegraph.com)" })),
  token: Type.Optional(Type.String({ description: "Sourcegraph access token (env: SRC_ACCESS_TOKEN)" })),
  target: Type.Optional(Type.Union([Type.Literal("repo"), Type.Literal("user")])),
});

export const webSourceSchema = Type.Object({
  ops: Type.Optional(
    Type.Array(webSourceItemSchema, { description: "Batch web source operations" }),
  ),
  op: Type.Optional(Type.Union([Type.Literal("search"), Type.Literal("file")])),
  query: Type.Optional(Type.String()),
  repo: Type.Optional(Type.String()),
  path: Type.Optional(Type.String()),
  commit: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Number()),
  endpoint: Type.Optional(Type.String()),
  token: Type.Optional(Type.String()),
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
  const operation = op.op || (op.path && op.repo ? "file" : "search");
  const endpoint = op.endpoint || process.env.SOURCEGRAPH_URL || "https://sourcegraph.com";
  const token = op.token || process.env.SRC_ACCESS_TOKEN || "";

  const headers = ["-H", "Accept: application/json, text/event-stream"];
  if (token) {
    headers.push("-H", `Authorization: token ${token}`);
  }

  if (operation === "file") {
    if (!op.repo || !op.path) {
      return { success: false, op: "file", output: "repo and path required", error: "Missing repo or path" };
    }
    const commit = op.commit || "HEAD";
    const fileUrl = `${endpoint.replace(/\/+$/, "")}/${op.repo}@${commit}/-/raw/${op.path.replace(/^\/+/, "")}`;

    const proc = spawnSync("curl", ["-sSL", "--max-time", "30", ...headers, fileUrl], {
      encoding: "utf-8",
      maxBuffer: 20 * 1024 * 1024,
    });

    if (proc.status !== 0 || !proc.stdout) {
      return {
        success: false,
        op: "file",
        output: proc.stderr || "Failed to retrieve file from Sourcegraph",
        error: proc.stderr,
      };
    }

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

  // search operation
  const query = op.query || (op.repo ? `repo:^${op.repo}$` : "");
  if (!query) {
    return { success: false, op: "search", output: "query is required for code search", error: "Missing query" };
  }

  const limit = typeof op.limit === "number" ? op.limit : 10;
  const searchUrl = `${endpoint.replace(/\/+$/, "")}/.api/search/stream?q=${encodeURIComponent(query)}&display=${limit}`;

  const proc = spawnSync("curl", ["-sSL", "--max-time", "30", ...headers, searchUrl], {
    encoding: "utf-8",
    maxBuffer: 20 * 1024 * 1024,
  });

  if (proc.status !== 0 || !proc.stdout) {
    return {
      success: false,
      op: "search",
      output: proc.stderr || "Sourcegraph search failed",
      error: proc.stderr,
    };
  }

  const matches: SourcegraphMatch[] = [];
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
    description: "Search open-source code and retrieve repository files using Sourcegraph API.",
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
