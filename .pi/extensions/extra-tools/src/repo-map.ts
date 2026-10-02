/**
 * `repo_map` tool — High-density workspace topology, entrypoints, and dirty-file orientation.
 *
 * Inspired by Lean-CTX code mapping and Volition's running changelog.
 * Provides instant orientation without flooding context with recursive directory listings.
 */

import { Type } from "@sinclair/typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, join, relative } from "node:path";
import { execSync } from "node:child_process";

export const repoMapItemSchema = Type.Object({
  action: Type.Optional(
    Type.Union([
      Type.Literal("map"),
      Type.Literal("modified"),
      Type.Literal("entrypoints"),
    ]),
  ),
  cwd: Type.Optional(Type.String({ description: "Target workspace directory" })),
  depth: Type.Optional(Type.Number({ description: "Directory tree depth (default: 2)" })),
});

export const repoMapSchema = Type.Object({
  ops: Type.Optional(
    Type.Array(repoMapItemSchema, { description: "Batch repo_map operations array" }),
  ),
  action: Type.Optional(
    Type.Union(
      [
        Type.Literal("map", { description: "Generate compact workspace topology map (default)" }),
        Type.Literal("modified", { description: "List git modified and untracked files (capped at 10)" }),
        Type.Literal("entrypoints", { description: "Inspect project manifests and entrypoint files" }),
      ],
      { description: "Action to perform" },
    ),
  ),
  cwd: Type.Optional(Type.String({ description: "Target directory" })),
  depth: Type.Optional(Type.Number({ description: "Directory tree depth" })),
});

export function getModifiedFiles(cwd: string, cap = 10): string[] {
  try {
    const stdout = execSync("git status --porcelain -uall", { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] });
    return stdout
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, cap);
  } catch {
    return [];
  }
}

export function detectEntrypoints(cwd: string): Record<string, string[]> {
  const result: Record<string, string[]> = {};

  // Node / Bun
  const pkgPath = join(cwd, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      const entries: string[] = [];
      if (pkg.main) entries.push(`main: ${pkg.main}`);
      if (pkg.module) entries.push(`module: ${pkg.module}`);
      if (typeof pkg.bin === "string") entries.push(`bin: ${pkg.bin}`);
      else if (typeof pkg.bin === "object") {
        for (const [k, v] of Object.entries(pkg.bin)) entries.push(`bin.${k}: ${v}`);
      }
      if (pkg.scripts) {
        entries.push(`scripts: ${Object.keys(pkg.scripts).slice(0, 8).join(", ")}`);
      }
      result["Node/Bun"] = entries;
    } catch {
      result["Node/Bun"] = ["package.json (unreadable)"];
    }
  }

  // Rust
  const cargoPath = join(cwd, "Cargo.toml");
  if (existsSync(cargoPath)) {
    result["Rust"] = ["Cargo.toml"];
  }

  // Nix
  const flakePath = join(cwd, "flake.nix");
  if (existsSync(flakePath)) {
    result["Nix"] = ["flake.nix"];
  }

  // Python
  const pyprojectPath = join(cwd, "pyproject.toml");
  if (existsSync(pyprojectPath)) {
    result["Python"] = ["pyproject.toml"];
  }

  return result;
}

export function renderTree(dir: string, currentDepth: number, maxDepth: number, root: string): string[] {
  if (currentDepth > maxDepth) return [];
  const lines: string[] = [];

  try {
    const dirents = readdirSync(dir, { withFileTypes: true });
    const sorted = dirents.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const d of sorted) {
      if (d.name.startsWith(".") && d.name !== ".pi") continue;
      if (d.name === "node_modules" || d.name === "dist" || d.name === "target" || d.name === "coverage") continue;

      const relPath = relative(root, join(dir, d.name));
      const indent = "  ".repeat(currentDepth);

      if (d.isDirectory()) {
        lines.push(`${indent}📁 ${d.name}/`);
        lines.push(...renderTree(join(dir, d.name), currentDepth + 1, maxDepth, root));
      } else {
        lines.push(`${indent}📄 ${d.name}`);
      }
    }
  } catch {
    // Ignore unreadable
  }

  return lines;
}

export async function executeRepoMapOp(
  _toolCallId: string,
  params: any,
  _signal?: AbortSignal,
  _onUpdate?: (update: unknown) => void,
  ctx: { cwd: string } = { cwd: process.cwd() },
) {
  if (Array.isArray(params.ops) && params.ops.length > 0) {
    if (params.ops.length === 1) {
      return executeRepoMapOp(_toolCallId, { ...params.ops[0], ops: undefined }, _signal, _onUpdate, ctx);
    }
    const results = await Promise.all(
      params.ops.map((op: any) => executeRepoMapOp(_toolCallId, op, _signal, _onUpdate, ctx)),
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

  const targetCwd = params.cwd ? resolve(ctx.cwd, params.cwd) : ctx.cwd;
  const action = params.action ?? "map";

  if (action === "modified") {
    const modified = getModifiedFiles(targetCwd, 10);
    const text = modified.length
      ? `Dirty/Modified Files (capped at 10):\n${modified.join("\n")}`
      : "Working tree clean (no modified files).";
    return {
      content: [{ type: "text" as const, text }],
      isError: false,
      details: { action: "modified", count: modified.length, files: modified },
    };
  }

  if (action === "entrypoints") {
    const entrypoints = detectEntrypoints(targetCwd);
    const lines: string[] = ["Project Entrypoints:"];
    for (const [tech, items] of Object.entries(entrypoints)) {
      lines.push(`• [${tech}]: ${items.join("; ")}`);
    }
    if (Object.keys(entrypoints).length === 0) {
      lines.push("No recognized manifests found.");
    }
    return {
      content: [{ type: "text" as const, text: lines.join("\n") }],
      isError: false,
      details: { action: "entrypoints", entrypoints },
    };
  }

  // Action: map
  const maxDepth = typeof params.depth === "number" ? Math.max(1, params.depth) : 2;
  const tree = renderTree(targetCwd, 0, maxDepth, targetCwd);
  const modified = getModifiedFiles(targetCwd, 5);
  const entrypoints = detectEntrypoints(targetCwd);

  const sections: string[] = [];
  sections.push(`Repository Map (${targetCwd}):`);

  if (modified.length) {
    sections.push(`\nRecent Changes (${modified.length}):\n${modified.map((m) => `  ${m}`).join("\n")}`);
  }

  if (Object.keys(entrypoints).length) {
    const epStr = Object.entries(entrypoints)
      .map(([k, v]) => `  ${k}: ${v.join(", ")}`)
      .join("\n");
    sections.push(`\nEntrypoints:\n${epStr}`);
  }

  sections.push(`\nStructure (depth: ${maxDepth}):\n${tree.join("\n")}`);

  return {
    content: [{ type: "text" as const, text: sections.join("\n") }],
    isError: false,
    details: {
      action: "map",
      cwd: targetCwd,
      modifiedCount: modified.length,
      entrypointCount: Object.keys(entrypoints).length,
      treeNodes: tree.length,
    },
  };
}

export function registerRepoMapTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "repo_map",
    label: "Repo Map",
    description: "Generate high-density workspace topology map, detect entrypoints, and inspect dirty files.",
    promptSnippet: "High-density workspace code map and entrypoint detection",
    promptGuidelines: [
      "Use repo_map to quickly grasp directory layout, modified files, and entrypoint targets without recursive globs.",
    ],
    parameters: repoMapSchema,

    renderCall(args: any, theme: any) {
      const action = args?.action ?? "map";
      const text = theme.fg("toolTitle", "repo_map ") + theme.fg("accent", action);
      return new Text(text, 0, 0);
    },

    renderResult(result: any, { expanded }: any, theme: any) {
      const details = result?.details;
      const nodes = details?.treeNodes ?? details?.count ?? 0;
      const text = theme.fg("muted", `Repo Map (${nodes} items)`);
      return new Text(text, 0, 0);
    },

    async execute(toolCallId: string, params: any, signal: any, onUpdate: any, ctx: any) {
      return executeRepoMapOp(toolCallId, params, signal, onUpdate, ctx) as any;
    },
  });

  pi.registerCommand("repomap", {
    description: "Display concise repository topology map",
    handler: async (_args: string, ctx: any) => {
      const cwd = ctx?.cwd || process.cwd();
      const res = await executeRepoMapOp("cmd", { action: "map", cwd }, undefined, undefined, { cwd });
      ctx.ui?.notify?.(`Repo map generated for ${cwd}:\n${res.content[0].text}`, "info");
    },
  });
}
