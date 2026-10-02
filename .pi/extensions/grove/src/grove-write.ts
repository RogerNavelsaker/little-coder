/**
 * `grove_write` tool — Create and update items across Grove ecosystem (Seeds, Mulch, Canopy, Roots).
 *
 * Supported ops:
 * - `seeds`: Create issue (`sd create`) or update issue fields (`sd update <id>`)
 * - `mulch`: Record new expertise entry (`ml record <domain> ...`)
 * - `canopy`: Update or create prompt (`cn update <name>`)
 * - `roots`: Propose idea or file question (`roots ask` / `roots propose`)
 */

import { Type } from "@sinclair/typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { spawnSync } from "node:child_process";
import { isToolEnabled } from "../../_shared/tool-gating.ts";

export const groveWriteItemSchema = Type.Object({
  op: Type.Optional(
    Type.Union([
      Type.Literal("seeds", { description: "Create or update Seeds issue" }),
      Type.Literal("mulch", { description: "Record expertise in Mulch" }),
      Type.Literal("canopy", { description: "Update or create Canopy prompt" }),
      Type.Literal("roots", { description: "Propose or ask in Roots" }),
    ]),
  ),
  action: Type.Optional(
    Type.Union([Type.Literal("create"), Type.Literal("update"), Type.Literal("record"), Type.Literal("ask")]),
  ),
  id: Type.Optional(Type.String({ description: "Target ID when updating (e.g. little-coder-1234)" })),
  title: Type.Optional(Type.String({ description: "Issue title or Mulch record title" })),
  content: Type.Optional(Type.String({ description: "Description or expertise content" })),
  domain: Type.Optional(Type.String({ description: "Mulch domain (architecture, tools, tech, etc.)" })),
  type: Type.Optional(Type.String({ description: "Issue type (task, feature, bug, epic) or Mulch type (decision, pattern, discovery)" })),
  priority: Type.Optional(Type.Number({ description: "Issue priority (0-4)" })),
  status: Type.Optional(Type.String({ description: "Target status (in_progress, open, closed)" })),
  rationale: Type.Optional(Type.String({ description: "Rationale for Mulch decisions" })),
  name: Type.Optional(Type.String({ description: "Mulch record or Canopy prompt name" })),
});

export const groveWriteSchema = Type.Object({
  ops: Type.Optional(
    Type.Array(groveWriteItemSchema, { description: "Batch grove write operations" }),
  ),
  op: Type.Optional(Type.Union([Type.Literal("seeds"), Type.Literal("mulch"), Type.Literal("canopy"), Type.Literal("roots")])),
  action: Type.Optional(Type.Union([Type.Literal("create"), Type.Literal("update"), Type.Literal("record"), Type.Literal("ask")])),
  id: Type.Optional(Type.String()),
  title: Type.Optional(Type.String()),
  content: Type.Optional(Type.String()),
  domain: Type.Optional(Type.String()),
  type: Type.Optional(Type.String()),
  priority: Type.Optional(Type.Number()),
  status: Type.Optional(Type.String()),
  rationale: Type.Optional(Type.String()),
  name: Type.Optional(Type.String()),
});

export function executeGroveWriteOp(op: any, cwd?: string): {
  success: boolean;
  op: string;
  output: string;
  error?: string;
} {
  const effectiveCwd = cwd || process.cwd();
  const operation =
    op.op ||
    (op.domain ? "mulch" : op.id?.startsWith("little-coder-") || op.id?.startsWith("sd-") ? "seeds" : "seeds");

  switch (operation) {
    case "seeds": {
      if (op.action === "update" || op.id) {
        if (!op.id) return { success: false, op: "seeds", output: "Missing issue ID for update", error: "Missing ID" };
        const args = ["update", op.id];
        if (op.status) args.push("--status", op.status);
        if (op.priority !== undefined) args.push("--priority", String(op.priority));
        if (op.title) args.push("--title", op.title);

        const proc = spawnSync("seeds", args, { cwd: effectiveCwd, encoding: "utf-8" });
        return {
          success: proc.status === 0,
          op: "seeds",
          output: proc.stdout.trim() || proc.stderr,
          error: proc.status !== 0 ? proc.stderr : undefined,
        };
      }

      // create
      const title = op.title || "New Task";
      const args = ["create", "--title", title];
      if (op.type) args.push("--type", op.type);
      if (op.priority !== undefined) args.push("--priority", String(op.priority));
      if (op.content) args.push("--description", op.content);

      const proc = spawnSync("seeds", args, { cwd: effectiveCwd, encoding: "utf-8" });
      return {
        success: proc.status === 0,
        op: "seeds",
        output: proc.stdout.trim() || proc.stderr,
        error: proc.status !== 0 ? proc.stderr : undefined,
      };
    }

    case "mulch": {
      const domain = op.domain || "architecture";
      const content = op.content || op.title || "Recorded expertise";
      const args = ["record", domain, content];
      if (op.type) args.push("--type", op.type);
      if (op.name) args.push("--name", op.name);
      if (op.title) args.push("--title", op.title);
      if (op.rationale) args.push("--rationale", op.rationale);

      const proc = spawnSync("mulch", args, { cwd: effectiveCwd, encoding: "utf-8" });
      return {
        success: proc.status === 0,
        op: "mulch",
        output: proc.stdout.trim() || proc.stderr,
        error: proc.status !== 0 ? proc.stderr : undefined,
      };
    }

    case "canopy": {
      const name = op.name || op.id;
      if (!name) return { success: false, op: "canopy", output: "Prompt name required", error: "Missing name" };
      const args = ["update", name];
      const proc = spawnSync("canopy", args, { cwd: effectiveCwd, encoding: "utf-8" });
      return {
        success: proc.status === 0,
        op: "canopy",
        output: proc.stdout.trim() || proc.stderr,
        error: proc.status !== 0 ? proc.stderr : undefined,
      };
    }

    case "roots": {
      const text = op.content || op.title || "";
      const sub = op.action === "ask" ? "ask" : "propose";
      const proc = spawnSync("roots", [sub, text], { cwd: effectiveCwd, encoding: "utf-8" });
      return {
        success: proc.status === 0,
        op: "roots",
        output: proc.stdout.trim() || proc.stderr,
        error: proc.status !== 0 ? proc.stderr : undefined,
      };
    }

    default:
      return { success: false, op: operation, output: `Unsupported grove write op: ${operation}`, error: "Unsupported op" };
  }
}

export function registerGroveWriteTool(pi: ExtensionAPI): void {
  if (!isToolEnabled("grove_write", "grove")) return;

  pi.registerTool({
    name: "grove_write",
    label: "grove_write",
    description: "Create or update issues, expertise, prompts, and ideas in Grove ecosystem (Seeds, Mulch, Canopy, Roots).",
    parameters: groveWriteSchema,
    execute: async (_toolCallId: string, params: any) => {
      const ops = params?.ops || [params];
      const detailsList: any[] = [];
      const contentList: string[] = [];

      for (const op of ops) {
        const res = executeGroveWriteOp(op);
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
      const op = first.op || "write";

      if (!expanded) {
        const text = theme?.fg ? theme.fg("accent", `🌲 Grove ${op}: ${first.success ? "success" : "failed"}`) : `🌲 Grove ${op}`;
        return new Text(text, 0, 0);
      }

      const lines = [`🌲 Grove write: ${op}`, `Status: ${first.success ? "success" : "failed"}`];
      if (first.output) lines.push(first.output.slice(0, 300));
      const text = theme?.fg ? theme.fg("muted", lines.join("\n")) : lines.join("\n");
      return new Text(text, 0, 0);
    },
  });
}
