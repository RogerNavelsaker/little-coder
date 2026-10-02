/**
 * `grove_read` tool — Read items across Grove ecosystem (Seeds, Mulch, Trellis, Canopy, Roots).
 *
 * Supported ops:
 * - `seeds`: Read issue details (`sd show <id>`) or ready list (`sd ready`)
 * - `mulch`: Query expertise records (`ml query <domain>`) or read specific record
 * - `canopy`: Render prompt (`cn render <name>`) or show metadata (`cn show <name>`)
 * - `trellis`: Read spec or plan (`tl show <id>`)
 * - `roots`: Read idea or proposal (`roots show <id>`)
 */

import { Type } from "@sinclair/typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { spawnSync } from "node:child_process";
import { encodeToon } from "../../_shared/toon.ts";
import { isToolEnabled } from "../../_shared/tool-gating.ts";

export const groveReadItemSchema = Type.Object({
  op: Type.Optional(
    Type.Union([
      Type.Literal("seeds", { description: "Read Seeds issue (show/ready)" }),
      Type.Literal("mulch", { description: "Read Mulch expertise records" }),
      Type.Literal("canopy", { description: "Read Canopy prompt" }),
      Type.Literal("trellis", { description: "Read Trellis spec or plan" }),
      Type.Literal("roots", { description: "Read Roots idea or graph" }),
    ]),
  ),
  id: Type.Optional(Type.String({ description: "Target ID or name (e.g. little-coder-1234, prompt name, mx-abc)" })),
  domain: Type.Optional(Type.String({ description: "Mulch domain (architecture, tools, tech, etc.)" })),
  ready: Type.Optional(Type.Boolean({ description: "For seeds/trellis: list unblocked ready items" })),
});

export const groveReadSchema = Type.Object({
  ops: Type.Optional(
    Type.Array(groveReadItemSchema, { description: "Batch grove read operations" }),
  ),
  op: Type.Optional(
    Type.Union([
      Type.Literal("seeds"),
      Type.Literal("mulch"),
      Type.Literal("canopy"),
      Type.Literal("trellis"),
      Type.Literal("roots"),
    ]),
  ),
  id: Type.Optional(Type.String()),
  domain: Type.Optional(Type.String()),
  ready: Type.Optional(Type.Boolean()),
});

export function executeGroveReadOp(op: any, cwd?: string): {
  success: boolean;
  op: string;
  id?: string;
  output: string;
  data?: any;
  error?: string;
} {
  const effectiveCwd = cwd || process.cwd();
  const operation =
    op.op ||
    (op.id?.startsWith("little-coder-") || op.id?.startsWith("sd-")
      ? "seeds"
      : op.id?.startsWith("mx-") || op.domain
      ? "mulch"
      : op.id?.startsWith("tl-")
      ? "trellis"
      : op.id?.startsWith("r-")
      ? "roots"
      : "seeds");

  switch (operation) {
    case "seeds": {
      if (op.ready) {
        const proc = spawnSync("seeds", ["ready", "--json"], { cwd: effectiveCwd, encoding: "utf-8" });
        if (proc.status === 0 && proc.stdout) {
          try {
            const parsed = JSON.parse(proc.stdout);
            return {
              success: true,
              op: "seeds",
              output: encodeToon(parsed).text,
              data: parsed,
            };
          } catch {
            return { success: true, op: "seeds", output: proc.stdout.trim() };
          }
        }
        return { success: false, op: "seeds", output: proc.stderr || "Failed to list ready seeds", error: proc.stderr };
      }

      const id = op.id;
      if (!id) {
        const proc = spawnSync("seeds", ["ready"], { cwd: effectiveCwd, encoding: "utf-8" });
        return { success: proc.status === 0, op: "seeds", output: proc.stdout.trim() || proc.stderr };
      }

      const proc = spawnSync("seeds", ["show", id], { cwd: effectiveCwd, encoding: "utf-8" });
      return {
        success: proc.status === 0,
        op: "seeds",
        id,
        output: proc.stdout.trim() || proc.stderr || `Issue not found: ${id}`,
        error: proc.status !== 0 ? proc.stderr : undefined,
      };
    }

    case "mulch": {
      const domain = op.domain || "architecture";
      const proc = spawnSync("mulch", ["query", domain, "--json"], { cwd: effectiveCwd, encoding: "utf-8" });
      if (proc.status === 0 && proc.stdout) {
        try {
          const parsed = JSON.parse(proc.stdout);
          // If specific ID requested, filter
          if (op.id) {
            const records = parsed.records || parsed.domains?.[0]?.records || [];
            const match = records.find((r: any) => r.id === op.id);
            if (match) {
              return { success: true, op: "mulch", id: op.id, output: encodeToon(match).text, data: match };
            }
          }
          return { success: true, op: "mulch", id: domain, output: encodeToon(parsed).text, data: parsed };
        } catch {
          return { success: true, op: "mulch", output: proc.stdout.trim() };
        }
      }
      return { success: false, op: "mulch", output: proc.stderr || `Failed to query mulch domain: ${domain}`, error: proc.stderr };
    }

    case "canopy": {
      const name = op.id || "agent-context";
      const proc = spawnSync("canopy", ["render", name], { cwd: effectiveCwd, encoding: "utf-8" });
      return {
        success: proc.status === 0,
        op: "canopy",
        id: name,
        output: proc.stdout.trim() || proc.stderr || `Canopy prompt not found: ${name}`,
        error: proc.status !== 0 ? proc.stderr : undefined,
      };
    }

    case "trellis": {
      const sub = op.ready ? ["ready"] : op.id ? ["show", op.id] : ["prime"];
      const proc = spawnSync("trellis", sub, { cwd: effectiveCwd, encoding: "utf-8" });
      return {
        success: proc.status === 0,
        op: "trellis",
        id: op.id,
        output: proc.stdout.trim() || proc.stderr || "Trellis query failed",
        error: proc.status !== 0 ? proc.stderr : undefined,
      };
    }

    case "roots": {
      const sub = op.id ? ["show", op.id] : ["prime"];
      const proc = spawnSync("roots", sub, { cwd: effectiveCwd, encoding: "utf-8" });
      return {
        success: proc.status === 0,
        op: "roots",
        id: op.id,
        output: proc.stdout.trim() || proc.stderr || "Roots query failed",
        error: proc.status !== 0 ? proc.stderr : undefined,
      };
    }

    default:
      return { success: false, op: operation, output: `Unsupported grove read op: ${operation}`, error: "Unsupported op" };
  }
}

export function registerGroveReadTool(pi: ExtensionAPI): void {
  if (!isToolEnabled("grove_read", "grove")) return;

  pi.registerTool({
    name: "grove_read",
    label: "grove_read",
    description: "Read issues, expertise, specs, prompts, and ideas from Grove ecosystem (Seeds, Mulch, Trellis, Canopy, Roots).",
    parameters: groveReadSchema,
    execute: async (_toolCallId: string, params: any) => {
      const ops = params?.ops || [params];
      const detailsList: any[] = [];
      const contentList: string[] = [];

      for (const op of ops) {
        const res = executeGroveReadOp(op);
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
      const op = first.op || "read";
      const target = first.id ? ` [${first.id}]` : "";

      if (!expanded) {
        const text = theme?.fg ? theme.fg("accent", `🌲 Grove ${op}${target}`) : `🌲 Grove ${op}${target}`;
        return new Text(text, 0, 0);
      }

      const lines = [`🌲 Grove read: ${op}${target}`, `Status: ${first.success ? "success" : "failed"}`];
      if (first.output) lines.push(first.output.slice(0, 300));
      const text = theme?.fg ? theme.fg("muted", lines.join("\n")) : lines.join("\n");
      return new Text(text, 0, 0);
    },
  });
}
