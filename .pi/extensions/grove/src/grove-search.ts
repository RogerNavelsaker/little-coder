/**
 * `grove_search` tool — Search across Grove ecosystem (Seeds, Mulch, Trellis, Roots).
 *
 * Supported ops:
 * - `seeds`: Full-text issue search (`sd search <query>`)
 * - `mulch`: Expertise search across domains (`ml search <query>`)
 * - `trellis`: Trellis search or audit (`tl ready` / `tl search`)
 * - `roots`: Search ideas and questions (`roots list`)
 */

import { Type } from "@sinclair/typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { spawnSync } from "node:child_process";
import { encodeToon } from "../../_shared/toon.ts";
import { isToolEnabled } from "../../_shared/tool-gating.ts";

export const groveSearchItemSchema = Type.Object({
  op: Type.Optional(
    Type.Union([
      Type.Literal("all", { description: "Search across Seeds and Mulch (default)" }),
      Type.Literal("seeds", { description: "Search Seeds issues" }),
      Type.Literal("mulch", { description: "Search Mulch expertise records" }),
      Type.Literal("trellis", { description: "Search Trellis specs/plans" }),
      Type.Literal("roots", { description: "Search Roots graph" }),
    ]),
  ),
  query: Type.String({ description: "Search query or keyword pattern" }),
  domain: Type.Optional(Type.String({ description: "Optional Mulch domain filter" })),
});

export const groveSearchSchema = Type.Object({
  ops: Type.Optional(
    Type.Array(groveSearchItemSchema, { description: "Batch grove search operations" }),
  ),
  op: Type.Optional(Type.Union([Type.Literal("all"), Type.Literal("seeds"), Type.Literal("mulch"), Type.Literal("trellis"), Type.Literal("roots")])),
  query: Type.Optional(Type.String()),
  domain: Type.Optional(Type.String()),
});

export function executeGroveSearchOp(op: any, cwd?: string): {
  success: boolean;
  query: string;
  op: string;
  output: string;
  results?: any;
  error?: string;
} {
  const effectiveCwd = cwd || process.cwd();
  const query = op.query || "";
  if (!query) {
    return { success: false, query: "", op: op.op || "all", output: "Search query required", error: "Missing query" };
  }

  const operation = op.op || "all";
  const outputSections: string[] = [];

  // Seeds search
  if (operation === "all" || operation === "seeds") {
    const proc = spawnSync("seeds", ["search", query], { cwd: effectiveCwd, encoding: "utf-8" });
    if (proc.status === 0 && proc.stdout.trim()) {
      outputSections.push(`### Seeds Results\n${proc.stdout.trim()}`);
    }
  }

  // Mulch search
  if (operation === "all" || operation === "mulch") {
    const mulchArgs = ["search", query];
    if (op.domain) mulchArgs.push("--domain", op.domain);
    const proc = spawnSync("mulch", mulchArgs, { cwd: effectiveCwd, encoding: "utf-8" });
    if (proc.status === 0 && proc.stdout.trim()) {
      outputSections.push(`### Mulch Results\n${proc.stdout.trim()}`);
    }
  }

  // Roots search
  if (operation === "roots") {
    const proc = spawnSync("roots", ["list"], { cwd: effectiveCwd, encoding: "utf-8" });
    if (proc.status === 0 && proc.stdout.trim()) {
      outputSections.push(`### Roots Graph\n${proc.stdout.trim()}`);
    }
  }

  const finalOutput = outputSections.length > 0 ? outputSections.join("\n\n") : `No results found for "${query}"`;

  return {
    success: true,
    query,
    op: operation,
    output: finalOutput,
  };
}

export function registerGroveSearchTool(pi: ExtensionAPI): void {
  if (!isToolEnabled("grove_search", "grove")) return;

  pi.registerTool({
    name: "grove_search",
    label: "grove_search",
    description: "Search issues, expertise, specs, and prompts across Grove ecosystem (Seeds, Mulch, Trellis, Roots).",
    parameters: groveSearchSchema,
    execute: async (_toolCallId: string, params: any) => {
      const ops = params?.ops || [params];
      const detailsList: any[] = [];
      const contentList: string[] = [];

      for (const op of ops) {
        const res = executeGroveSearchOp(op);
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
      const query = first.query || "";

      if (!expanded) {
        const text = theme?.fg ? theme.fg("accent", `🔍 Grove Search: "${query}"`) : `🔍 Grove Search: "${query}"`;
        return new Text(text, 0, 0);
      }

      const lines = [`🔍 Grove search: "${query}"`];
      if (first.output) lines.push(first.output.slice(0, 300));
      const text = theme?.fg ? theme.fg("muted", lines.join("\n")) : lines.join("\n");
      return new Text(text, 0, 0);
    },
  });
}
