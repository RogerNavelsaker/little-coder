/**
 * `project-context` tool & extension — workspace instructions and @filepath reference expansion.
 *
 * Capabilities:
 * 1. Discovers nearest workspace AGENTS.md / CLAUDE.md (capped at 4k chars, deduplicated).
 * 2. Resolves @filepath references embedded in context files and user prompt inputs.
 * 3. Delivers guidance as cache-friendly tail messages via `injectionResult` and `makeDedupe`.
 * 4. Supports Universal Tool Contract (executeProjectContextOp, ops[] schema).
 */

import { Type } from "@sinclair/typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { injectionResult, makeDedupe } from "../../_shared/inject.ts";
import {
  findContextFile,
  loadProjectContext,
  formatProjectContext,
  isEnabled,
  maxChars,
  type FoundContext,
} from "./discover.ts";
import {
  getAllFilePathFromContextFiles,
  parseFileAndContent,
  formatProjectReferences,
  expandPromptRefs,
  parseRefs,
} from "./file-reference.ts";

export const projectContextItemSchema = Type.Object({
  action: Type.Optional(
    Type.Union([
      Type.Literal("discover"),
      Type.Literal("read"),
      Type.Literal("resolve_refs"),
      Type.Literal("clear_cache"),
    ]),
  ),
  cwd: Type.Optional(Type.String({ description: "Target workspace directory" })),
  text: Type.Optional(Type.String({ description: "Text or snippet to extract refs from" })),
  maxChars: Type.Optional(Type.Number({ description: "Character limit for context injection" })),
});

export const projectContextSchema = Type.Object({
  ops: Type.Optional(
    Type.Array(projectContextItemSchema, {
      description: "Batch project context operations array",
    }),
  ),
  action: Type.Optional(
    Type.Union(
      [
        Type.Literal("discover", {
          description: "Discover nearest workspace instructions and referenced files (default)",
        }),
        Type.Literal("read", {
          description: "Read full project context and resolved references",
        }),
        Type.Literal("resolve_refs", {
          description: "Parse and resolve @filepath references in provided text or cwd",
        }),
        Type.Literal("clear_cache", {
          description: "Clear cached context and deduplication state",
        }),
      ],
      { description: "Action to perform" },
    ),
  ),
  cwd: Type.Optional(Type.String({ description: "Directory to discover instructions from" })),
  text: Type.Optional(Type.String({ description: "Text to extract @filepath references from" })),
  maxChars: Type.Optional(Type.Number({ description: "Custom character cap override" })),
});

function getOwnAgentsMd(): string {
  const dir = typeof import.meta.dir === "string"
    ? import.meta.dir
    : (import.meta.url ? dirname(fileURLToPath(import.meta.url)) : process.cwd());
  return resolve(dir, "..", "..", "..", "AGENTS.md");
}

let cachedFound: FoundContext | undefined;
let cachedRefs: string[] = [];
let cachedDedupe = makeDedupe();

export function clearProjectContextCache(): void {
  cachedFound = undefined;
  cachedRefs = [];
  cachedDedupe = makeDedupe();
}

export async function executeProjectContextOp(
  _toolCallId: string,
  params: any,
  _signal?: AbortSignal,
  _onUpdate?: (update: unknown) => void,
  ctx: { cwd: string } = { cwd: process.cwd() },
) {
  if (Array.isArray(params.ops) && params.ops.length > 0) {
    if (params.ops.length === 1) {
      return executeProjectContextOp(
        _toolCallId,
        { ...params.ops[0], ops: undefined },
        _signal,
        _onUpdate,
        ctx,
      );
    }
    const results = await Promise.all(
      params.ops.map((op: any) =>
        executeProjectContextOp(_toolCallId, op, _signal, _onUpdate, ctx),
      ),
    );
    return {
      content: [
        {
          type: "text" as const,
          text: results.map((r: any) => r.content[0].text).join("\n---\n"),
        },
      ],
      isError: false,
      details: {
        totalOps: results.length,
        results: results.map((r: any) => r.details),
      },
    };
  }

  const action = params.action ?? "discover";
  const targetCwd = params.cwd ? resolve(ctx.cwd, params.cwd) : ctx.cwd;
  const skip = [getOwnAgentsMd()];

  if (action === "clear_cache") {
    clearProjectContextCache();
    return {
      content: [{ type: "text" as const, text: "Project context cache cleared." }],
      isError: false,
      details: { cleared: true },
    };
  }

  if (action === "resolve_refs") {
    const textToScan = params.text ?? "";
    const extracted = parseRefs(textToScan);
    const resolvedPaths = getAllFilePathFromContextFiles([
      { path: join(targetCwd, "input.md"), content: textToScan },
    ]);
    const contents = parseFileAndContent(resolvedPaths);

    return {
      content: [
        {
          type: "text" as const,
          text: contents.length
            ? formatProjectReferences(contents)
            : `No valid .md/.mdc references resolved (found ${extracted.length} raw ref candidate(s)).`,
        },
      ],
      isError: false,
      details: {
        action: "resolve_refs",
        rawRefs: extracted,
        resolvedPaths,
        fileCount: contents.length,
      },
    };
  }

  const limit = typeof params.maxChars === "number" ? params.maxChars : maxChars();
  const found = loadProjectContext(targetCwd, { skipPaths: skip, maxChars: limit });

  if (!found) {
    return {
      content: [
        {
          type: "text" as const,
          text: `No workspace AGENTS.md or CLAUDE.md found searching upwards from ${targetCwd}.`,
        },
      ],
      isError: false,
      details: { found: false, cwd: targetCwd },
    };
  }

  const resolvedRefs = getAllFilePathFromContextFiles([
    { path: found.path, content: found.content },
  ]);
  const refContents = parseFileAndContent(resolvedRefs);

  if (action === "read") {
    const mainBlock = formatProjectContext(found);
    const refBlock = refContents.length ? "\n\n" + formatProjectReferences(refContents) : "";
    return {
      content: [{ type: "text" as const, text: mainBlock + refBlock }],
      isError: false,
      details: {
        path: found.path,
        chars: found.content.length,
        truncatedChars: found.truncatedChars,
        refs: resolvedRefs,
      },
    };
  }

  // Default: 'discover'
  const summary = [
    `Project Context: ${found.path}`,
    `Characters: ${found.content.length}${found.truncatedChars > 0 ? ` (${found.truncatedChars} truncated)` : ""}`,
    `Resolved References: ${resolvedRefs.length ? resolvedRefs.join(", ") : "none"}`,
  ].join("\n");

  return {
    content: [{ type: "text" as const, text: summary }],
    isError: false,
    details: {
      action: "discover",
      path: found.path,
      chars: found.content.length,
      truncatedChars: found.truncatedChars,
      refs: resolvedRefs,
    },
  };
}

function shortHash(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 12);
}

export function registerProjectContextTool(pi: ExtensionAPI): void {
  if (!isEnabled()) return;

  const skipPaths = [getOwnAgentsMd()];

  pi.registerTool({
    name: "project_context",
    label: "Project Context",
    description:
      "Inspect, discover, and read workspace AGENTS.md / CLAUDE.md instructions and referenced @docs.",
    promptSnippet: "Query workspace instructions and @filepath references",
    promptGuidelines: [
      "Use project_context to discover or inspect repository conventions and referenced guidelines.",
    ],
    parameters: projectContextSchema,

    renderCall(args: any, theme: any) {
      const action = args?.action ?? "discover";
      const text = theme.fg("toolTitle", "project_context ") + theme.fg("accent", action);
      return new Text(text, 0, 0);
    },

    renderResult(result: any, { expanded }: any, theme: any) {
      const details = result?.details;
      if (details?.found === false) {
        return new Text(theme.fg("muted", "No project context"), 0, 0);
      }
      const p = details?.path ? details.path.split("/").pop() : "context";
      const refsCount = details?.refs?.length ?? 0;
      const refStr = refsCount > 0 ? ` (+${refsCount} refs)` : "";
      const text = theme.fg("muted", `${p}${refStr}`);
      return new Text(text, 0, 0);
    },

    async execute(toolCallId: string, params: any, signal: any, onUpdate: any, ctx: any) {
      return executeProjectContextOp(toolCallId, params, signal, onUpdate, ctx) as any;
    },
  });

  pi.registerCommand("project-context", {
    description: "Show the workspace AGENTS.md / CLAUDE.md loaded into this session",
    handler: async (_args: string, ctx: any) => {
      const cwd = ctx?.cwd || process.cwd();
      const found = cachedFound || loadProjectContext(cwd, { skipPaths, maxChars: maxChars() });

      if (!found) {
        ctx.ui?.notify?.(
          `No project AGENTS.md or CLAUDE.md found from ${cwd} upward`,
          "warning",
        );
        return;
      }

      const truncated =
        found.truncatedChars > 0 ? `, ${found.truncatedChars} chars truncated` : "";
      ctx.ui?.notify?.(
        `Project context: ${found.path} (${found.content.length} chars${truncated}, sha256:${shortHash(found.content)})`,
        "info",
      );
    },
  });

  pi.on("session_start", () => {
    clearProjectContextCache();
  });

  // Inject workspace AGENTS.md / CLAUDE.md + @filepath references on each agent turn
  pi.on("before_agent_start", async (event: any) => {
    const cwd = process.cwd();
    if (!cachedFound) {
      cachedFound = loadProjectContext(cwd, { skipPaths, maxChars: maxChars() });
      if (cachedFound) {
        cachedRefs = getAllFilePathFromContextFiles([
          { path: cachedFound.path, content: cachedFound.content },
        ]);
      }
    }

    if (!cachedFound) return;

    let block = formatProjectContext(cachedFound);
    if (cachedRefs.length) {
      const refContents = parseFileAndContent(cachedRefs);
      if (refContents.length) {
        block += "\n\n" + formatProjectReferences(refContents);
      }
    }

    if (!cachedDedupe(block)) return;

    return injectionResult("lc-project-context", block, event?.systemPrompt);
  });

  // Expand @filepath references in user prompt input
  pi.on("input", async (event: any, ctx: any) => {
    const text = event?.text || "";
    const cwd = ctx?.cwd || process.cwd();

    if (typeof text === "string" && text.includes("@")) {
      const expanded = expandPromptRefs(text, cwd);
      if (expanded.expandedCount > 0) {
        return {
          action: "transform",
          text: expanded.expandedText,
        };
      }
    }

    return { action: "continue" };
  });
}
