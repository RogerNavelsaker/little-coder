/**
 * `web_search` tool — Search the web via ddgr or SearXNG instance.
 *
 * Supported operations:
 * - `query`: Search via ddgr CLI or SearXNG (if SEARXNG_URL set)
 * - `searxng`: Explicit SearXNG search with custom instance URL
 */

import { Type } from "@sinclair/typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { spawnSync } from "node:child_process";
import { encodeToon } from "../../_shared/toon.ts";
import { storeWebArtifact } from "./storage.ts";

export interface SearchResultItem {
  title: string;
  url: string;
  abstract: string;
}

export const webSearchItemSchema = Type.Object({
  op: Type.Optional(
    Type.Union([
      Type.Literal("query", { description: "Search the web via ddgr / default SearXNG" }),
      Type.Literal("searxng", { description: "Search via dedicated SearXNG instance URL" }),
    ]),
  ),
  query: Type.String({ description: "Search terms or query string" }),
  num: Type.Optional(Type.Number({ description: "Number of results (default: 8)" })),
  site: Type.Optional(Type.String({ description: "Limit results to specific domain" })),
  searxngUrl: Type.Optional(Type.String({ description: "Optional SearXNG instance endpoint" })),
  target: Type.Optional(Type.Union([Type.Literal("repo"), Type.Literal("user")])),
});

export const webSearchSchema = Type.Object({
  ops: Type.Optional(
    Type.Array(webSearchItemSchema, { description: "Batch web search operations array" }),
  ),
  op: Type.Optional(
    Type.Union([Type.Literal("query"), Type.Literal("searxng")]),
  ),
  query: Type.Optional(Type.String({ description: "Search query" })),
  num: Type.Optional(Type.Number({ description: "Number of results" })),
  site: Type.Optional(Type.String({ description: "Site filter" })),
  searxngUrl: Type.Optional(Type.String({ description: "Custom SearXNG URL" })),
  target: Type.Optional(Type.Union([Type.Literal("repo"), Type.Literal("user")])),
});

export function executeWebSearchOp(op: any, cwd?: string): {
  success: boolean;
  query: string;
  results: SearchResultItem[];
  output: string;
  artifactPath?: string;
  error?: string;
} {
  const query = op.query || "";
  if (!query) {
    return {
      success: false,
      query: "",
      results: [],
      output: "Search query is required",
      error: "Missing query",
    };
  }

  const num = typeof op.num === "number" ? op.num : 8;
  const site = op.site || "";
  const searxngUrl = op.searxngUrl || (op.op === "searxng" ? op.searxngUrl : "") || process.env.SEARXNG_URL || "";

  // 1. Try SearXNG if configured
  if (searxngUrl) {
    try {
      const url = new URL("/search", searxngUrl);
      url.searchParams.set("q", site ? `site:${site} ${query}` : query);
      url.searchParams.set("format", "json");

      const proc = spawnSync("curl", ["-sSL", "--max-time", "15", url.toString()], {
        encoding: "utf-8",
      });

      if (proc.status === 0 && proc.stdout.trim()) {
        const parsed = JSON.parse(proc.stdout);
        const rawResults = parsed.results || [];
        const results: SearchResultItem[] = rawResults.slice(0, num).map((r: any) => ({
          title: r.title || "",
          url: r.url || "",
          abstract: r.content || r.snippet || "",
        }));

        const toon = encodeToon({ query, count: results.length, results }).text;
        const stored = storeWebArtifact(toon, `search-${query}`, "toon", {
          target: op.target || "repo",
          cwd,
        });

        return {
          success: true,
          query,
          results,
          output: stored.inline ? stored.content : `Search results saved: ${stored.filePath}`,
          artifactPath: stored.filePath,
        };
      }
    } catch {
      // Fall back to ddgr
    }
  }

  // 2. Fall back to ddgr
  const args = ["--json", "--np", "-n", String(num), "--colorize=never"];
  if (site) {
    args.push("--site", site);
  }
  args.push(query);

  try {
    const proc = spawnSync("ddgr", args, { encoding: "utf-8", maxBuffer: 5 * 1024 * 1024 });
    if (proc.status !== 0) {
      return {
        success: false,
        query,
        results: [],
        output: proc.stderr || "ddgr execution failed",
        error: proc.stderr,
      };
    }

    const raw = proc.stdout.trim();
    if (!raw) {
      return {
        success: true,
        query,
        results: [],
        output: "No results found",
      };
    }

    const parsed = JSON.parse(raw);
    const results: SearchResultItem[] = (Array.isArray(parsed) ? parsed : []).map((r: any) => ({
      title: r.title || "",
      url: r.url || "",
      abstract: r.abstract || "",
    }));

    const toon = encodeToon({ query, count: results.length, results }).text;
    const stored = storeWebArtifact(toon, `search-${query}`, "toon", {
      target: op.target || "repo",
      cwd,
    });

    return {
      success: true,
      query,
      results,
      output: stored.inline ? stored.content : `Search results saved: ${stored.filePath}`,
      artifactPath: stored.filePath,
    };
  } catch (err: any) {
    return {
      success: false,
      query,
      results: [],
      output: err?.message || "Search failed",
      error: err?.message,
    };
  }
}

export function registerWebSearchTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "web_search",
    label: "web_search",
    description: "Search the web using ddgr CLI or SearXNG instances with compact TOON output and artifact storage.",
    parameters: webSearchSchema,
    execute: async (_toolCallId: string, params: any) => {
      const ops = params?.ops || [params];
      const detailsList: any[] = [];
      const contentList: string[] = [];

      for (const op of ops) {
        const res = executeWebSearchOp(op);
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
      const query = first.query || "web search";
      const count = first.results?.length || 0;

      if (!expanded) {
        const text = theme?.fg
          ? theme.fg("accent", `🔍 Search: "${query}" (${count} results)`)
          : `🔍 Search: "${query}" (${count} results)`;
        return new Text(text, 0, 0);
      }

      const lines = [`🔍 Search query: "${query}" (total: ${count})`];
      for (const r of (first.results || []).slice(0, 5)) {
        lines.push(`• ${r.title}\n  ${r.url}`);
      }
      const text = theme?.fg ? theme.fg("muted", lines.join("\n")) : lines.join("\n");
      return new Text(text, 0, 0);
    },
  });
}
