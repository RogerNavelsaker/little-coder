/**
 * Shared test helpers for structural-tools bun:test files.
 *
 * Exports tool invocation, content-text extraction, details parsing,
 * and renderResult wrappers so each tool test stays concise.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
// AbortController is globally available in Bun/Node

export interface MockTheme {
  fg(color: string, text: string): string;
  bold(text: string): string;
}

// Pass-through theme — colors stripped, text preserved
export const mockTheme: MockTheme = {
  fg: (_c, t) => t,
  bold: (t) => t,
};

export const CWD = "/home/rona/.pi/agent/pi-structural-tools";
export const FIXTURE = `${CWD}/PROMPT.md`; // 186-line existing file

// --- Tool invocation ---

export async function invokeTool<P>(
  register: (pi: { registerTool(t: unknown): void }) => void,
  params: P,
  cwd: string = CWD,
): Promise<{ result: any; tool: any }> {
  let capturedTool: any = null;
  register({ registerTool: (t) => { capturedTool = t; } });
  if (!capturedTool) throw new Error("registerTool not called");
  const result = await capturedTool.execute(
    "test-id",
    params,
    new AbortController().signal,
    () => {},
    { cwd },
  );
  return { result, tool: capturedTool };
}

// --- Content-text extraction (LLM-visible) ---

export function contentText(result: any): string {
  return result?.content?.[0]?.text ?? "";
}

// --- Details parsing ---
//
// Some tools (edit) return details.text as a JSON string.
// Others (read, grep, find, ls) return details as a plain object.
// TOON-encoded tools (write, ast_search) produce details.text that
// is NOT valid JSON — parseDetails falls back to returning the raw object.

export function parseDetails(result: any): Record<string, unknown> {
  const d = result?.details;
  if (!d) return {};
  if (typeof d.text === "string") {
    try { return JSON.parse(d.text); } catch { return d; }
  }
  return d;
}

// --- renderResult wrappers (TUI-visible) ---

export function renderCollapsed(tool: any, result: any): string {
  return tool.renderResult?.(
    result,
    { expanded: false, isPartial: false },
    mockTheme,
    {},
  )?.text ?? "";
}

export function renderExpanded(tool: any, result: any): string {
  return tool.renderResult?.(
    result,
    { expanded: true, isPartial: false },
    mockTheme,
    {},
  )?.text ?? "";
}
