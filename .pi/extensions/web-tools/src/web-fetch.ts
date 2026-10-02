/**
 * `web_fetch` tool — Fetch and extract webpage content using flyscrape/crawl4ai pipeline.
 *
 * Supported operations:
 * - `get`: Fetch single or multiple URLs to markdown/html/metadata
 * - `crawl`: Crawl domain with depth/follow rules
 */

import { Type } from "@sinclair/typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { storeWebArtifact } from "./storage.ts";

export const webFetchItemSchema = Type.Object({
  op: Type.Optional(
    Type.Union([
      Type.Literal("get", { description: "Fetch one or more URLs (default)" }),
      Type.Literal("crawl", { description: "Crawl domain with depth" }),
    ]),
  ),
  url: Type.Optional(Type.String({ description: "Target URL to fetch" })),
  urls: Type.Optional(Type.Array(Type.String(), { description: "List of URLs to fetch" })),
  engine: Type.Optional(
    Type.Union([Type.Literal("defuddle"), Type.Literal("readability")]),
  ),
  extract: Type.Optional(
    Type.Union([
      Type.Literal("markdown"),
      Type.Literal("html"),
      Type.Literal("metadata"),
      Type.Literal("links"),
      Type.Literal("all"),
    ]),
  ),
  depth: Type.Optional(Type.Number({ description: "Crawl depth (for crawl op)" })),
  target: Type.Optional(Type.Union([Type.Literal("repo"), Type.Literal("user")])),
});

export const webFetchSchema = Type.Object({
  ops: Type.Optional(
    Type.Array(webFetchItemSchema, { description: "Batch web fetch operations array" }),
  ),
  op: Type.Optional(Type.Union([Type.Literal("get"), Type.Literal("crawl")])),
  url: Type.Optional(Type.String()),
  urls: Type.Optional(Type.Array(Type.String())),
  engine: Type.Optional(Type.Union([Type.Literal("defuddle"), Type.Literal("readability")])),
  extract: Type.Optional(
    Type.Union([
      Type.Literal("markdown"),
      Type.Literal("html"),
      Type.Literal("metadata"),
      Type.Literal("links"),
      Type.Literal("all"),
    ]),
  ),
  depth: Type.Optional(Type.Number()),
  target: Type.Optional(Type.Union([Type.Literal("repo"), Type.Literal("user")])),
});

export function executeWebFetchOp(op: any, cwd?: string): {
  success: boolean;
  urls: string[];
  output: string;
  artifactPath?: string;
  error?: string;
} {
  const effectiveCwd = cwd || process.cwd();
  const urlList: string[] = [];
  if (typeof op.url === "string" && op.url) {
    urlList.push(op.url);
  }
  if (Array.isArray(op.urls)) {
    for (const u of op.urls) {
      if (typeof u === "string" && u) urlList.push(u);
    }
  }

  if (urlList.length === 0) {
    return {
      success: false,
      urls: [],
      output: "At least one URL is required",
      error: "Missing URL",
    };
  }

  const engine = op.engine || "defuddle";
  const extract = op.extract || "markdown";
  const depth = typeof op.depth === "number" ? op.depth : 0;
  const isCrawl = op.op === "crawl" || depth > 0;

  const scriptPath = resolve(effectiveCwd, "skills/web/web-fetch/scripts/bin/fetch.nu");
  const tempOutputFile = resolve(
    effectiveCwd,
    `.tmp-fetch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.out`,
  );

  const nuArgs = [
    scriptPath,
    ...urlList,
    "--output",
    tempOutputFile,
    "--engine",
    engine,
    "--extract",
    extract,
    "--format",
    extract === "markdown" ? "markdown" : "json",
  ];

  if (isCrawl && depth > 0) {
    nuArgs.push("--depth", String(depth));
  }

  try {
    const proc = spawnSync("nu", nuArgs, {
      cwd: effectiveCwd,
      encoding: "utf-8",
      maxBuffer: 20 * 1024 * 1024,
      timeout: 120000,
    });

    if (proc.status !== 0 || !existsSync(tempOutputFile)) {
      const err = proc.stderr || proc.stdout || "Fetch process failed";
      return {
        success: false,
        urls: urlList,
        output: err,
        error: err,
      };
    }

    const rawContent = readFileSync(tempOutputFile, "utf-8");
    try {
      rmSync(tempOutputFile, { force: true });
    } catch {}

    const slug = urlList.length === 1 ? urlList[0] : "web-fetch-multi";
    const extension = extract === "markdown" ? "md" : "json";
    const stored = storeWebArtifact(rawContent, slug, extension, {
      target: op.target || "repo",
      cwd: effectiveCwd,
    });

    return {
      success: true,
      urls: urlList,
      output: stored.inline ? stored.content : `Fetched web content saved: ${stored.filePath}`,
      artifactPath: stored.filePath,
    };
  } catch (err: any) {
    if (existsSync(tempOutputFile)) {
      try {
        rmSync(tempOutputFile, { force: true });
      } catch {}
    }
    return {
      success: false,
      urls: urlList,
      output: err?.message || "Web fetch execution failed",
      error: err?.message,
    };
  }
}

export function registerWebFetchTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "web_fetch",
    label: "web_fetch",
    description: "Fetch and extract web content into Markdown/JSON using flyscrape + Defuddle/Readability with artifact persistence for large documents.",
    parameters: webFetchSchema,
    execute: async (_toolCallId: string, params: any) => {
      const ops = params?.ops || [params];
      const detailsList: any[] = [];
      const contentList: string[] = [];

      for (const op of ops) {
        const res = executeWebFetchOp(op);
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
      const count = first.urls?.length || 0;
      const firstUrl = first.urls?.[0] || "unknown";

      if (!expanded) {
        const text = theme?.fg
          ? theme.fg("accent", `🌐 Fetch: ${firstUrl}${count > 1 ? ` (+${count - 1} more)` : ""}`)
          : `🌐 Fetch: ${firstUrl}${count > 1 ? ` (+${count - 1} more)` : ""}`;
        return new Text(text, 0, 0);
      }

      const lines = [`🌐 Fetched ${count} URL(s):`];
      for (const u of first.urls || []) {
        lines.push(`• ${u}`);
      }
      if (first.artifactPath) {
        lines.push(`📁 Saved to: ${first.artifactPath}`);
      }
      const text = theme?.fg ? theme.fg("muted", lines.join("\n")) : lines.join("\n");
      return new Text(text, 0, 0);
    },
  });
}
