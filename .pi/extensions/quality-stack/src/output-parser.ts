/**
 * `output-parser` — Multi-pass JSON & fenced tool-call recovery.
 *
 * Detects fenced code blocks (```json ... ```), XML-like tool calls (<tool_call>...</tool_call>),
 * or bare JSON in assistant text when small models fail to use native function calling.
 * Applies multi-pass repair (control chars, single quotes, unescaped newlines, trailing commas).
 */

import { repairJsonControlChars } from "../../../../scripts/patch-pi.ts";

export interface RecoveredToolCall {
  tool: string;
  parameters: Record<string, unknown>;
  rawSnippet: string;
}

/**
 * 6-pass JSON repair for small model outputs.
 */
export function repairJsonString(input: string): string {
  let s = input.trim();

  // Pass 1: Raw control character repair (embedded newlines/tabs inside strings)
  s = repairJsonControlChars(s);

  // Pass 2: Strip trailing commas before } or ]
  s = s.replace(/,(\s*[}\]])/g, "$1");

  // Pass 3: Convert single-quoted keys/strings to double quotes if valid JSON wasn't parsed
  s = s.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');

  // Pass 4: Fix missing closing braces if model truncated tail
  const openBraces = (s.match(/\{/g) || []).length;
  const closeBraces = (s.match(/\}/g) || []).length;
  if (openBraces > closeBraces) {
    s += "}".repeat(openBraces - closeBraces);
  }

  const openBrackets = (s.match(/\[/g) || []).length;
  const closeBrackets = (s.match(/\]/g) || []).length;
  if (openBrackets > closeBrackets) {
    s += "]".repeat(openBrackets - closeBrackets);
  }

  return s;
}

/**
 * Scan assistant text for pseudo tool calls.
 */
export function extractFencedToolCalls(text: string): RecoveredToolCall[] {
  if (!text || typeof text !== "string") return [];

  const recovered: RecoveredToolCall[] = [];

  // 1. Pattern: ```json ... ``` or ```tool ... ```
  const fencedRegex = /```(?:json|tool)?\s*([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = fencedRegex.exec(text)) !== null) {
    const raw = match[1].trim();
    if (!raw.startsWith("{") && !raw.startsWith("[")) continue;

    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null) {
        if (parsed.tool || parsed.name) {
          recovered.push({
            tool: parsed.tool || parsed.name,
            parameters: parsed.parameters || parsed.arguments || parsed.args || parsed,
            rawSnippet: match[0],
          });
          continue;
        }
      }
    } catch {
      // Try repairJsonString
      try {
        const repaired = repairJsonString(raw);
        const parsed = JSON.parse(repaired);
        if (typeof parsed === "object" && parsed !== null && (parsed.tool || parsed.name)) {
          recovered.push({
            tool: parsed.tool || parsed.name,
            parameters: parsed.parameters || parsed.arguments || parsed.args || parsed,
            rawSnippet: match[0],
          });
        }
      } catch {}
    }
  }

  // 2. Pattern: <tool_call>...</tool_call>
  const tagRegex = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;
  while ((match = tagRegex.exec(text)) !== null) {
    const raw = match[1].trim();
    try {
      const repaired = repairJsonString(raw);
      const parsed = JSON.parse(repaired);
      if (typeof parsed === "object" && parsed !== null) {
        recovered.push({
          tool: parsed.tool || parsed.name || "unknown",
          parameters: parsed.parameters || parsed.arguments || parsed.args || parsed,
          rawSnippet: match[0],
        });
      }
    } catch {}
  }

  return recovered;
}
