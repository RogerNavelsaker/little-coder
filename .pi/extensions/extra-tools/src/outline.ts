/**
 * `outline` tool — Structural symbol index and JIT signature disclosure.
 *
 * Inspired by Lean-CTX's "signatures / outline first, bodies on demand lines:N-M".
 * Parses classes, interfaces, functions, methods, and types with line numbers
 * and 4-character hex linehash anchors for precision edits.
 */

import { Type } from "@sinclair/typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

export interface SymbolRecord {
  line: number;
  anchor: string;
  kind: "function" | "class" | "interface" | "type" | "enum" | "struct" | "const";
  name: string;
  signature: string;
  span?: string; // e.g. "lines:12-45"
}

export const outlineItemSchema = Type.Object({
  action: Type.Optional(Type.Union([Type.Literal("outline"), Type.Literal("search")])),
  path: Type.Optional(Type.String({ description: "Target file path to outline" })),
  query: Type.Optional(Type.String({ description: "Symbol name or substring to search for" })),
});

export const outlineSchema = Type.Object({
  ops: Type.Optional(
    Type.Array(outlineItemSchema, { description: "Batch outline operations array" }),
  ),
  action: Type.Optional(
    Type.Union(
      [
        Type.Literal("outline", { description: "Generate structural symbol outline for a file (default)" }),
        Type.Literal("search", { description: "Search for matching symbols in a file" }),
      ],
      { description: "Action to perform" },
    ),
  ),
  path: Type.Optional(Type.String({ description: "File path to inspect" })),
  query: Type.Optional(Type.String({ description: "Symbol name or pattern filter" })),
});

export function computeLineAnchor(line: string): string {
  // 4-char hex anchor (consistent with linehash xxhash32 convention)
  return createHash("sha256").update(line.trim()).digest("hex").slice(0, 4);
}

const PATTERNS: Array<{
  kind: SymbolRecord["kind"];
  regex: RegExp;
}> = [
  {
    kind: "class",
    regex: /^(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z0-9_$]+)/,
  },
  {
    kind: "interface",
    regex: /^(?:export\s+)?interface\s+([A-Za-z0-9_$]+)/,
  },
  {
    kind: "type",
    regex: /^(?:export\s+)?type\s+([A-Za-z0-9_$]+)\s*=/,
  },
  {
    kind: "enum",
    regex: /^(?:export\s+)?enum\s+([A-Za-z0-9_$]+)/,
  },
  {
    kind: "struct",
    regex: /^(?:pub\s+)?struct\s+([A-Za-z0-9_$]+)/,
  },
  {
    kind: "function",
    regex: /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/,
  },
  {
    kind: "function",
    regex: /^(?:pub\s+)?(?:async\s+)?fn\s+([A-Za-z0-9_$]+)\s*[\(<]/,
  },
  {
    kind: "function",
    regex: /^def\s+([A-Za-z0-9_$]+)\s*\(/,
  },
  {
    kind: "const",
    regex: /^(?:export\s+)?const\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\(/,
  },
];

export function extractSymbols(fileContent: string): SymbolRecord[] {
  const lines = fileContent.split("\n");
  const symbols: SymbolRecord[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("/*")) {
      continue;
    }

    for (const pat of PATTERNS) {
      const match = trimmed.match(pat.regex);
      if (match) {
        const name = match[1];
        const lineNum = i + 1;
        const anchor = computeLineAnchor(rawLine);

        // Approximate block span if open brace present
        let endLine = lineNum;
        if (trimmed.includes("{")) {
          let open = 0;
          for (let j = i; j < lines.length; j++) {
            open += (lines[j].match(/\{/g) || []).length;
            open -= (lines[j].match(/\}/g) || []).length;
            if (open <= 0) {
              endLine = j + 1;
              break;
            }
          }
        }

        const span = endLine > lineNum ? `lines:${lineNum}-${endLine}` : `line:${lineNum}`;

        symbols.push({
          line: lineNum,
          anchor,
          kind: pat.kind,
          name,
          signature: trimmed.slice(0, 100),
          span,
        });
        break;
      }
    }
  }

  return symbols;
}

export async function executeOutlineOp(
  _toolCallId: string,
  params: any,
  _signal?: AbortSignal,
  _onUpdate?: (update: unknown) => void,
  ctx: { cwd: string } = { cwd: process.cwd() },
) {
  if (Array.isArray(params.ops) && params.ops.length > 0) {
    if (params.ops.length === 1) {
      return executeOutlineOp(_toolCallId, { ...params.ops[0], ops: undefined }, _signal, _onUpdate, ctx);
    }
    const results = await Promise.all(
      params.ops.map((op: any) => executeOutlineOp(_toolCallId, op, _signal, _onUpdate, ctx)),
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

  if (!params.path) {
    return {
      content: [{ type: "text" as const, text: "Error: missing required parameter 'path'." }],
      isError: true,
      details: { error: "missing_path" },
    };
  }

  const filePath = resolve(ctx.cwd, params.path);
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    return {
      content: [{ type: "text" as const, text: `Error: file not found: ${filePath}` }],
      isError: true,
      details: { error: "file_not_found", path: filePath },
    };
  }

  const content = readFileSync(filePath, "utf-8");
  const allSymbols = extractSymbols(content);
  const action = params.action ?? "outline";

  let symbols = allSymbols;
  if (action === "search" && params.query) {
    const q = params.query.toLowerCase();
    symbols = allSymbols.filter(
      (s) => s.name.toLowerCase().includes(q) || s.signature.toLowerCase().includes(q),
    );
  }

  if (symbols.length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: `No symbols found in ${params.path}${params.query ? ` matching '${params.query}'` : ""}.`,
        },
      ],
      isError: false,
      details: { path: filePath, symbolCount: 0, symbols: [] },
    };
  }

  const formatted = symbols
    .map((s) => `L${s.line} [${s.anchor}] (${s.kind}) ${s.name} [${s.span}]: ${s.signature}`)
    .join("\n");

  const header = `Outline for ${params.path} (${symbols.length} symbol${symbols.length > 1 ? "s" : ""}):\n`;

  return {
    content: [{ type: "text" as const, text: header + formatted }],
    isError: false,
    details: {
      action,
      path: filePath,
      symbolCount: symbols.length,
      symbols,
    },
  };
}

export function registerOutlineTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "outline",
    label: "Outline",
    description: "Extract structural symbols, signatures, and linehash anchors from a source file.",
    promptSnippet: "File symbol signatures and line anchors outline",
    promptGuidelines: [
      "Use outline to inspect declarations and line spans (lines:N-M) in a file before deciding which slice to read.",
    ],
    parameters: outlineSchema,

    renderCall(args: any, theme: any) {
      const p = args?.path ? ` ${args.path.split("/").pop()}` : "";
      const text = theme.fg("toolTitle", "outline ") + theme.fg("accent", p);
      return new Text(text, 0, 0);
    },

    renderResult(result: any, { expanded }: any, theme: any) {
      const count = result?.details?.symbolCount ?? 0;
      const text = theme.fg("muted", `Outline (${count} symbols)`);
      return new Text(text, 0, 0);
    },

    async execute(toolCallId: string, params: any, signal: any, onUpdate: any, ctx: any) {
      return executeOutlineOp(toolCallId, params, signal, onUpdate, ctx) as any;
    },
  });

  pi.registerCommand("outline", {
    description: "Display symbol outline for a file",
    handler: async (args: string, ctx: any) => {
      const p = args.trim();
      if (!p) {
        ctx.ui?.notify?.("Usage: /outline <path>", "warning");
        return;
      }
      const res = await executeOutlineOp("cmd", { path: p, action: "outline" }, undefined, undefined, { cwd: ctx?.cwd || process.cwd() });
      ctx.ui?.notify?.(res.content[0].text, res.isError ? "error" : "info");
    },
  });
}
