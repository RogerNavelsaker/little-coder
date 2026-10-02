/**
 * `grove_promote` tool — Promotion & lifecycle operations (Seeds close, Mulch rank/outcome).
 *
 * Supported ops:
 * - `close`: Close a Seeds issue (`sd close <id> --reason <reason>`)
 * - `outcome`: Record success/failure outcome to a Mulch record (`ml outcome <domain> <id> ...`)
 * - `rank`: Rank Mulch records by confirmation-frequency score (`ml rank <domain>`)
 * - `sync`: Stage and commit .seeds/ and .mulch/ changes (`sd sync && ml sync`)
 */

import { Type } from "@sinclair/typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { spawnSync } from "node:child_process";
import { isToolEnabled } from "../../_shared/tool-gating.ts";

export const grovePromoteItemSchema = Type.Object({
  op: Type.Optional(
    Type.Union([
      Type.Literal("close", { description: "Close Seeds issue" }),
      Type.Literal("outcome", { description: "Append outcome to Mulch record" }),
      Type.Literal("rank", { description: "Rank Mulch records by confirmation score" }),
      Type.Literal("sync", { description: "Sync and commit grove changes (.seeds, .mulch)" }),
    ]),
  ),
  id: Type.Optional(Type.String({ description: "Target issue or record ID" })),
  reason: Type.Optional(Type.String({ description: "Reason for closing issue or outcome summary" })),
  domain: Type.Optional(Type.String({ description: "Mulch domain" })),
  success: Type.Optional(Type.Boolean({ description: "Whether outcome succeeded" })),
});

export const grovePromoteSchema = Type.Object({
  ops: Type.Optional(
    Type.Array(grovePromoteItemSchema, { description: "Batch grove promote operations" }),
  ),
  op: Type.Optional(Type.Union([Type.Literal("close"), Type.Literal("outcome"), Type.Literal("rank"), Type.Literal("sync")])),
  id: Type.Optional(Type.String()),
  reason: Type.Optional(Type.String()),
  domain: Type.Optional(Type.String()),
  success: Type.Optional(Type.Boolean()),
});

export function executeGrovePromoteOp(op: any, cwd?: string): {
  success: boolean;
  op: string;
  id?: string;
  output: string;
  error?: string;
} {
  const effectiveCwd = cwd || process.cwd();
  const operation = op.op || (op.reason && op.id ? "close" : "close");

  switch (operation) {
    case "close": {
      const id = op.id;
      if (!id) return { success: false, op: "close", output: "Missing issue ID", error: "Missing ID" };

      const args = ["close", id];
      if (op.reason) args.push("--reason", op.reason);

      const proc = spawnSync("seeds", args, { cwd: effectiveCwd, encoding: "utf-8" });
      return {
        success: proc.status === 0,
        op: "close",
        id,
        output: proc.stdout.trim() || proc.stderr,
        error: proc.status !== 0 ? proc.stderr : undefined,
      };
    }

    case "outcome": {
      const id = op.id;
      const domain = op.domain || "architecture";
      if (!id) return { success: false, op: "outcome", output: "Missing record ID", error: "Missing ID" };

      const args = ["outcome", domain, id];
      if (op.reason) args.push(op.reason);

      const proc = spawnSync("mulch", args, { cwd: effectiveCwd, encoding: "utf-8" });
      return {
        success: proc.status === 0,
        op: "outcome",
        id,
        output: proc.stdout.trim() || proc.stderr,
        error: proc.status !== 0 ? proc.stderr : undefined,
      };
    }

    case "rank": {
      const domain = op.domain || "architecture";
      const proc = spawnSync("mulch", ["rank", domain], { cwd: effectiveCwd, encoding: "utf-8" });
      return {
        success: proc.status === 0,
        op: "rank",
        output: proc.stdout.trim() || proc.stderr,
        error: proc.status !== 0 ? proc.stderr : undefined,
      };
    }

    case "sync": {
      const sdProc = spawnSync("seeds", ["sync"], { cwd: effectiveCwd, encoding: "utf-8" });
      const mlProc = spawnSync("mulch", ["sync"], { cwd: effectiveCwd, encoding: "utf-8" });

      const out = `${sdProc.stdout.trim()}\n${mlProc.stdout.trim()}`.trim();
      const isOk = sdProc.status === 0 && mlProc.status === 0;

      return {
        success: isOk,
        op: "sync",
        output: out || "Grove synced",
        error: !isOk ? `${sdProc.stderr}\n${mlProc.stderr}`.trim() : undefined,
      };
    }

    default:
      return { success: false, op: operation, output: `Unsupported promote op: ${operation}`, error: "Unsupported op" };
  }
}

export function registerGrovePromoteTool(pi: ExtensionAPI): void {
  if (!isToolEnabled("grove_promote", "grove")) return;

  pi.registerTool({
    name: "grove_promote",
    label: "grove_promote",
    description: "Close issues, append mulch outcomes, rank expertise, and sync grove repository changes.",
    parameters: grovePromoteSchema,
    execute: async (_toolCallId: string, params: any) => {
      const ops = params?.ops || [params];
      const detailsList: any[] = [];
      const contentList: string[] = [];

      for (const op of ops) {
        const res = executeGrovePromoteOp(op);
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
      const op = first.op || "promote";
      const id = first.id ? ` [${first.id}]` : "";

      if (!expanded) {
        const text = theme?.fg ? theme.fg("accent", `🚀 Grove ${op}${id}`) : `🚀 Grove ${op}${id}`;
        return new Text(text, 0, 0);
      }

      const lines = [`🚀 Grove promote: ${op}${id}`, `Status: ${first.success ? "success" : "failed"}`];
      if (first.output) lines.push(first.output.slice(0, 300));
      const text = theme?.fg ? theme.fg("muted", lines.join("\n")) : lines.join("\n");
      return new Text(text, 0, 0);
    },
  });
}
