#!/usr/bin/env bun
// Idempotent, dependency-free, best-effort patches to the bundled pi runtime
// for things little-coder can't express through pi's extension API.
//
// little-coder treats pi as a substrate it owns, not a boundary — but pi is a
// normal npm dependency, so we can't ship a modified copy of it. Instead we
// re-apply small source edits to the installed pi after install AND on every
// launch (the launcher calls applyPiPatches). Running on launch makes it
// self-heal if npm install scripts were skipped, if pi was reinstalled, or if
// the global/hoisted layout defeated the postinstall — the launcher always
// resolves pi's real location, so it can patch wherever pi actually lives.
//
// Contract: NEVER throw, NEVER exit non-zero. A failed patch must not break
// `npm install` or a launch — the only consequence is the un-patched UI.
//
// Current patches:
//   1. Suppress pi's bare "Operation aborted" assistant-message marker. Harness
//      interventions surface their own single "harness intervention: …" line,
//      and a user ESC is self-evident; the stacked red marker was noise. A
//      genuine custom errorMessage (not the default abort string) is preserved.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PI_PKG = "@earendil-works/pi-coding-agent";

const ABORT_MARKER_PATCH = {
  rel: "dist/modes/interactive/components/assistant-message.js",
  // Skip if our edit is already present (idempotency).
  applied: 'little-coder patch: suppress the bare "Operation aborted" marker',
  // Exact original block shipped by pi 0.75.x. If it doesn't match (pi changed),
  // we skip silently rather than guess.
  find:
    '                const abortMessage = message.errorMessage && message.errorMessage !== "Request was aborted"\n' +
    "                    ? message.errorMessage\n" +
    '                    : "Operation aborted";\n' +
    "                if (hasVisibleContent) {\n" +
    "                    this.contentContainer.addChild(new Spacer(1));\n" +
    "                }\n" +
    "                else {\n" +
    "                    this.contentContainer.addChild(new Spacer(1));\n" +
    "                }\n" +
    "                this.contentContainer.addChild(new Text(theme.fg(\"error\", abortMessage), 1, 0));",
  replace:
    '                // little-coder patch: suppress the bare "Operation aborted" marker.\n' +
    "                // Harness interventions surface their own single\n" +
    '                // "harness intervention: …" line, and a user ESC is self-evident.\n' +
    "                // A genuine custom errorMessage is still shown.\n" +
    '                const abortMessage = message.errorMessage && message.errorMessage !== "Request was aborted"\n' +
    "                    ? message.errorMessage\n" +
    "                    : null;\n" +
    "                if (abortMessage) {\n" +
    "                    this.contentContainer.addChild(new Spacer(1));\n" +
    "                    this.contentContainer.addChild(new Text(theme.fg(\"error\", abortMessage), 1, 0));\n" +
    "                }",
};

const BOX_RENDER_PATCH = {
  rel: "node_modules/@earendil-works/pi-tui/dist/components/box.js",
  applied: "little-coder patch: check child.render function existence in box component",
  find:
    "        // Render all children\n" +
    "        const childLines = [];\n" +
    "        for (const child of this.children) {\n" +
    "            const lines = child.render(contentWidth);",
  replace:
    "        // Render all children\n" +
    "        // little-coder patch: check child.render function existence in box component\n" +
    "        const childLines = [];\n" +
    "        for (const child of this.children) {\n" +
    "            if (!child || typeof child.render !== \"function\") continue;\n" +
    "            const lines = child.render(contentWidth);",
};

const TOOL_EXECUTION_SPACER_PATCH = {
  rel: "dist/modes/interactive/components/tool-execution.js",
  applied: "little-coder patch: suppress blank spacer lines for grouped tools",
  find:
    "    render(width) {\n" +
    "        if (this.hideComponent) {\n" +
    "            return [];\n" +
    "        }\n" +
    "        return super.render(width);\n" +
    "    }",
  replace:
    "    render(width) {\n" +
    "        if (this.hideComponent) {\n" +
    "            return [];\n" +
    "        }\n" +
    "        // little-coder patch: suppress blank spacer lines for grouped tools\n" +
    "        const lines = super.render(width);\n" +
    "        if (this.suppressLeadingSpacer || this.isGrouped) {\n" +
    "            if (lines.length > 0 && lines[0] === \"\") {\n" +
    "                lines.shift();\n" +
    "            }\n" +
    "        }\n" +
    "        return lines;\n" +
    "    }",
};

const TOOL_OVERRIDE_PATCH = {
  rel: "dist/modes/interactive/components/tool-execution.js",
  applied: "little-coder patch: toolDefinitionOverrides for third-party rendering",
  find:
    "    getCallRenderer() {\n" +
    "        if (!this.builtInToolDefinition) {\n" +
    "            return this.toolDefinition?.renderCall;\n" +
    "        }",
  replace:
    "    // little-coder patch: toolDefinitionOverrides for third-party rendering\n" +
    "    getCallRenderer() {\n" +
    "        const override = globalThis.__littleCoderToolOverrides?.get(this.toolName);\n" +
    "        if (override?.renderCall) return override.renderCall;\n" +
    "        if (!this.builtInToolDefinition) {\n" +
    "            return this.toolDefinition?.renderCall;\n" +
    "        }",
};

/**
 * Escape raw CR / LF / TAB that appear INSIDE JSON string literals, leaving
 * structural whitespace between tokens untouched.
 */
export function repairJsonControlChars(text: string): string {
  let out = "";
  let inStr = false;
  let esc = false;
  for (const ch of text) {
    if (esc) {
      out += ch;
      esc = false;
      continue;
    }
    if (ch === "\\") {
      out += ch;
      esc = true;
      continue;
    }
    if (ch === '"') {
      inStr = !inStr;
      out += ch;
      continue;
    }
    if (inStr) {
      if (ch === "\n") {
        out += "\\n";
        continue;
      }
      if (ch === "\r") {
        out += "\\r";
        continue;
      }
      if (ch === "\t") {
        out += "\\t";
        continue;
      }
    }
    out += ch;
  }
  return out;
}

const EDIT_REPAIR_APPLIED = "little-coder patch: repair raw control chars in a JSON-string `edits`";

function editRepairCatch(indent: number): string {
  const i = " ".repeat(indent);
  return (
    `catch {\n` +
    `${i}    // ${EDIT_REPAIR_APPLIED} (issue #127).\n` +
    `${i}    // Small local models emit literal newlines inside oldText/newText;\n` +
    `${i}    // JSON.parse rejects those as "Bad control character in string\n` +
    `${i}    // literal", and the original empty catch left \`edits\` a string for\n` +
    `${i}    // schema validation to refuse. With write refused for an existing\n` +
    `${i}    // file, that left the model no way to deliver a patch at all.\n` +
    `${i}    try {\n` +
    `${i}        const repair = ${String(repairJsonControlChars).split("\n").join(`\n${i}        `)};\n` +
    `${i}        const repaired = JSON.parse(repair(args.edits));\n` +
    `${i}        if (Array.isArray(repaired))\n` +
    `${i}            args.edits = repaired;\n` +
    `${i}    }\n` +
    `${i}    catch { }\n` +
    `${i}}`
  );
}

const EDIT_REPAIR_PATCH = {
  rel: "dist/core/tools/edit.js",
  applied: EDIT_REPAIR_APPLIED,
  find:
    "            if (Array.isArray(parsed))\n" +
    "                args.edits = parsed;\n" +
    "        }\n" +
    "        catch { }\n" +
    "    }\n" +
    "    const legacy = args;",
  replace:
    "            if (Array.isArray(parsed))\n" +
    "                args.edits = parsed;\n" +
    "        }\n" +
    "        " + editRepairCatch(8) + "\n" +
    "    }\n" +
    "    const legacy = args;",
};

export const PATCHES = [
  ABORT_MARKER_PATCH,
  BOX_RENDER_PATCH,
  TOOL_EXECUTION_SPACER_PATCH,
  TOOL_OVERRIDE_PATCH,
  EDIT_REPAIR_PATCH,
];

export function resolvePiRoot(piRootOverride) {
  if (piRootOverride && existsSync(join(piRootOverride, "package.json"))) {
    return piRootOverride;
  }
  // 1) Module resolution (respects npm hoisting).
  try {
    const resolved = Bun.resolveSync(`${PI_PKG}/package.json`, import.meta.dir);
    return dirname(resolved);
  } catch {
    // pi may not export package.json — fall through.
  }
  // 2) Nested node_modules next to this package root (scripts/ -> ..).
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const nested = join(here, "..", "node_modules", ...PI_PKG.split("/"));
    if (existsSync(join(nested, "package.json"))) return nested;
  } catch {
    // ignore
  }
  return null;
}

/**
 * Apply all pi patches in place. Best-effort and idempotent.
 * @param {string} [piRootOverride] Known pi package root (the launcher passes
 *   its already-resolved path; postinstall omits it and we resolve).
 */
export function applyPiPatches(piRootOverride?: string) {
  const piRoot = resolvePiRoot(piRootOverride);
  if (!piRoot) return;
  for (const p of PATCHES) {
    try {
      const file = join(piRoot, p.rel);
      if (!existsSync(file)) continue;
      const src = readFileSync(file, "utf8");
      if (src.includes(p.applied)) continue; // already patched
      if (!src.includes(p.find)) continue; // pi changed — skip silently
      writeFileSync(file, src.replace(p.find, p.replace));
    } catch {
      // best-effort: never break install or launch
    }
  }
}

// Run directly as a postinstall hook (but not when imported by the launcher).
let invokedDirectly = false;
try {
  invokedDirectly = process.argv[1] != null && fileURLToPath(import.meta.url) === process.argv[1];
} catch {
  invokedDirectly = false;
}
if (invokedDirectly) applyPiPatches();
