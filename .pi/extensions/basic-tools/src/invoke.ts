#!/usr/bin/env bun
/**
 * Generic CLI for triggering any structural-tool from the command line.
 *
 * Usage:
 *   bun src/invoke.ts <tool> <json-params> [--cwd <dir>]
 *
 * Examples:
 *   bun src/invoke.ts read '{"path":"src/read.ts","limit":5}'
 *   bun src/invoke.ts grep '{"pattern":"tool","path":"PROMPT.md"}'
 *   bun src/invoke.ts edit '{"path":"src/invoke.ts","old_text":"hello","new_text":"world"}'
 *   bun src/invoke.ts ast-search '{"pattern":"function","path":"src/read.ts"}'
 */

import { invokeTool, mockTheme } from "./test-helpers.js";
import { resolve } from "node:path";
import { existsSync, statSync } from "node:fs";
import { registerReadTool } from "./read.js";
import { registerEditTool } from "./edit.js";
import { registerWriteTool } from "./write.js";
import { registerGrepTool } from "./grep.js";
import { registerFindTool } from "./find.js";
import { registerLsTool } from "./ls.js";
import { registerShellTool } from "./shell.js";
import { registerAstSearchTool } from "./ast-search.js";
import { captureFile, diffAgainstCheckpoint } from "./file-checkpoint.js";

const TOOL_REGISTRY: Record<string, Parameters<typeof registerReadTool>[0]> = {
  read: registerReadTool,
  edit: registerEditTool,
  write: registerWriteTool,
  grep: registerGrepTool,
  find: registerFindTool,
  ls: registerLsTool,
  shell: registerShellTool,
  "ast-search": registerAstSearchTool,
  ast_search: registerAstSearchTool,
};

const TOOLS = Object.keys(TOOL_REGISTRY).sort().join(", ");

// --- Arg parsing ---

function printUsage(): never {
  console.error(`Usage: bun src/invoke.ts <tool> <json-params> [--cwd <dir>]

Supported tools: ${TOOLS}

Examples:
  bun src/invoke.ts read '{"path":"src/read.ts","limit":5}'
  bun src/invoke.ts grep '{"pattern":"tool","path":"PROMPT.md"}'
  bun src/invoke.ts edit '{"path":"src/invoke.ts","old_text":"hello","new_text":"world"}'
  bun src/invoke.ts ast-search '{"pattern":"function","path":"src/read.ts"}'
  bun src/invoke.ts shell '{"command":"ls -la src/"}'
`);
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length < 2) {
  printUsage();
}

let cwd = process.cwd();
const nonFlagArgs: string[] = [];

// Extract --cwd and collect positional args
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--cwd" && i + 1 < args.length) {
    cwd = resolve(args[i + 1]);
    i++; // skip next arg
  } else {
    nonFlagArgs.push(args[i]);
  }
}

if (nonFlagArgs.length < 2) {
  printUsage();
}

const toolName = nonFlagArgs[0];
const paramsJson = nonFlagArgs[1];

if (!TOOL_REGISTRY[toolName]) {
  console.error(`Error: unknown tool "${toolName}". Supported: ${TOOLS}`);
  process.exit(1);
}

if (!paramsJson) {
  console.error(`Error: missing JSON params for tool "${toolName}".`);
  printUsage();
}

// --- Execute ---

async function main() {
  let params: unknown;
  try {
    params = JSON.parse(paramsJson);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error: invalid JSON params: ${msg}`);
    process.exit(1);
  }

  const register = TOOL_REGISTRY[toolName];
  try {
    // Simulate tool_call hook: capture file before edit/write.
    // Handles both single-file (params.path) and batch (params.edits[]/params.files[]).
    const isEditOrWrite = toolName === 'edit' || toolName === 'write';
    if (isEditOrWrite) {
      const p = params as Record<string, unknown>;
      const paths: string[] = [];
      if (typeof p['path'] === 'string') paths.push(p['path']);
      const batch = p['edits'] ?? p['files'];
      if (Array.isArray(batch)) {
        for (const item of batch) {
          if (item && typeof (item as Record<string, unknown>)['path'] === 'string') {
            paths.push((item as Record<string, unknown>)['path'] as string);
          }
        }
      }
      for (const filePath of paths) {
        if (existsSync(filePath) && statSync(filePath).isFile()) captureFile(filePath);
      }
    }

    const { result, tool } = await invokeTool(register, params as any, cwd);

    // Simulate tool_result hook: replace diff(s) with clean checkpoint diffs.
    if (isEditOrWrite) {
      const d = (result as any).details as Record<string, unknown> | undefined;
      if (d) {
        if (Array.isArray(d['files'])) {
          // Batch: patch each file's diff individually.
          for (const f of d['files'] as Record<string, unknown>[]) {
            const fp = typeof f['path'] === 'string' ? f['path'] : undefined;
            if (fp) { const cd = diffAgainstCheckpoint(fp); if (cd !== null) f['diff'] = cd; }
          }
        } else {
          // Single file.
          const fp = typeof d['path'] === 'string' ? d['path'] : undefined;
          if (fp) { const cd = diffAgainstCheckpoint(fp); if (cd !== null) d['diff'] = cd; }
        }
      }
    }
    console.log(JSON.stringify(result, null, 2));

    // Print content.text as raw multiline text
    const contentText = (result as any).content?.[0]?.text;
    if (typeof contentText === "string") {
      console.log("\n── content.text ──");
      process.stdout.write(contentText.endsWith("\n") ? contentText : contentText + "\n");
    }

    // Print TUI render output
    if (tool.renderResult) {
      const collapsed = tool.renderResult(result, { expanded: false, isPartial: false }, mockTheme, {});
      const expanded  = tool.renderResult(result, { expanded: true,  isPartial: false }, mockTheme, {});
      console.log("\n── collapsed ──");
      console.log(collapsed?.text ?? "(no render)");
      console.log("\n── expanded ──");
      console.log(expanded?.text ?? "(no render)");
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${msg}`);
    process.exit(1);
  }
}

main();
