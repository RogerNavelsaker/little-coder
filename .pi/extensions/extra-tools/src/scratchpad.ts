/**
 * `scratchpad` tool — Ephemeral session clipboard and working memory.
 *
 * Inspired by Volition's [ACTIVE_CLIPBOARD] and Lean-CTX session memory.
 * Provides fast, zero-disk-clutter short-term state that can be injected
 * on `before_agent_start` into the conversation tail.
 */

import { Type } from "@sinclair/typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

export interface ScratchpadEntry {
  key: string;
  content: string;
  updatedAt: string;
}

export const scratchpadItemSchema = Type.Object({
  action: Type.Optional(
    Type.Union([
      Type.Literal("set"),
      Type.Literal("get"),
      Type.Literal("list"),
      Type.Literal("remove"),
      Type.Literal("clear"),
    ]),
  ),
  key: Type.Optional(Type.String({ description: "Entry key identifier" })),
  content: Type.Optional(Type.String({ description: "Content string to store" })),
});

export const scratchpadSchema = Type.Object({
  ops: Type.Optional(
    Type.Array(scratchpadItemSchema, { description: "Batch scratchpad operations array" }),
  ),
  action: Type.Optional(
    Type.Union(
      [
        Type.Literal("set", { description: "Store or update a key-value entry" }),
        Type.Literal("get", { description: "Retrieve an entry by key" }),
        Type.Literal("list", { description: "List all active scratchpad entries (default)" }),
        Type.Literal("remove", { description: "Remove an entry by key" }),
        Type.Literal("clear", { description: "Clear all scratchpad entries" }),
      ],
      { description: "Action to perform" },
    ),
  ),
  key: Type.Optional(Type.String({ description: "Key identifier" })),
  content: Type.Optional(Type.String({ description: "Content to write or update" })),
});

// Ephemeral in-memory store
const entries = new Map<string, ScratchpadEntry>();

export function getScratchpadEntries(): ScratchpadEntry[] {
  return Array.from(entries.values());
}

export function clearScratchpad(): void {
  entries.clear();
}

export function formatActiveClipboard(): string {
  if (entries.size === 0) return "";
  const lines: string[] = ["<active_clipboard>"];
  for (const [key, item] of entries.entries()) {
    lines.push(`[${key}]: ${item.content}`);
  }
  lines.push("</active_clipboard>");
  return lines.join("\n");
}

export async function executeScratchpadOp(
  _toolCallId: string,
  params: any,
  _signal?: AbortSignal,
  _onUpdate?: (update: unknown) => void,
  _ctx?: any,
) {
  if (Array.isArray(params.ops) && params.ops.length > 0) {
    if (params.ops.length === 1) {
      return executeScratchpadOp(_toolCallId, { ...params.ops[0], ops: undefined }, _signal, _onUpdate, _ctx);
    }
    const results = await Promise.all(
      params.ops.map((op: any) => executeScratchpadOp(_toolCallId, op, _signal, _onUpdate, _ctx)),
    );
    return {
      content: [{ type: "text" as const, text: results.map((r: any) => r.content[0].text).join("\n---\n") }],
      isError: false,
      details: {
        totalOps: results.length,
        results: results.map((r: any) => r.details),
      },
    };
  }

  const action = params.action ?? "list";

  if (action === "set") {
    const key = params.key ?? "default";
    const content = params.content ?? "";
    const entry: ScratchpadEntry = {
      key,
      content,
      updatedAt: new Date().toISOString(),
    };
    entries.set(key, entry);
    return {
      content: [{ type: "text" as const, text: `Stored [${key}] (${content.length} chars).` }],
      isError: false,
      details: { action: "set", key, size: content.length },
    };
  }

  if (action === "get") {
    const key = params.key ?? "default";
    const entry = entries.get(key);
    if (!entry) {
      return {
        content: [{ type: "text" as const, text: `Key [${key}] not found in scratchpad.` }],
        isError: false,
        details: { action: "get", key, found: false },
      };
    }
    return {
      content: [{ type: "text" as const, text: entry.content }],
      isError: false,
      details: { action: "get", key, found: true, entry },
    };
  }

  if (action === "remove") {
    const key = params.key ?? "default";
    const deleted = entries.delete(key);
    return {
      content: [
        {
          type: "text" as const,
          text: deleted ? `Removed [${key}] from scratchpad.` : `Key [${key}] did not exist.`,
        },
      ],
      isError: false,
      details: { action: "remove", key, deleted },
    };
  }

  if (action === "clear") {
    const count = entries.size;
    entries.clear();
    return {
      content: [{ type: "text" as const, text: `Cleared ${count} scratchpad entries.` }],
      isError: false,
      details: { action: "clear", count },
    };
  }

  // Action: list
  if (entries.size === 0) {
    return {
      content: [{ type: "text" as const, text: "Scratchpad is empty." }],
      isError: false,
      details: { action: "list", count: 0, entries: [] },
    };
  }

  const items = Array.from(entries.values()).map(
    (e) => `• [${e.key}] (${e.content.length} chars, ${e.updatedAt.slice(11, 19)}): ${e.content.slice(0, 60)}${e.content.length > 60 ? "..." : ""}`,
  );

  return {
    content: [{ type: "text" as const, text: items.join("\n") }],
    isError: false,
    details: { action: "list", count: entries.size, entries: Array.from(entries.values()) },
  };
}

export function registerScratchpadTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "scratchpad",
    label: "Scratchpad",
    description: "Store and recall ephemeral working memory and active clipboard snippets across turns.",
    promptSnippet: "Active clipboard and ephemeral scratchpad notes",
    promptGuidelines: [
      "Use scratchpad to save working notes, hypotheses, or intermediate results across turns without writing temp files to disk.",
    ],
    parameters: scratchpadSchema,

    renderCall(args: any, theme: any) {
      const action = args?.action ?? "list";
      const key = args?.key ? ` [${args.key}]` : "";
      const text = theme.fg("toolTitle", "scratchpad ") + theme.fg("accent", `${action}${key}`);
      return new Text(text, 0, 0);
    },

    renderResult(result: any, { expanded }: any, theme: any) {
      const count = result?.details?.count ?? result?.details?.size ?? 0;
      const text = theme.fg("muted", `Scratchpad (${count})`);
      return new Text(text, 0, 0);
    },

    async execute(toolCallId: string, params: any, signal: any, onUpdate: any, ctx: any) {
      return executeScratchpadOp(toolCallId, params, signal, onUpdate, ctx) as any;
    },
  });

  pi.registerCommand("scratchpad", {
    description: "Inspect or clear active scratchpad notes",
    handler: async (args: string, ctx: any) => {
      if (args.trim() === "clear") {
        clearScratchpad();
        ctx.ui?.notify?.("Scratchpad cleared", "info");
        return;
      }
      const count = entries.size;
      ctx.ui?.notify?.(`Scratchpad contains ${count} items`, "info");
    },
  });
}
