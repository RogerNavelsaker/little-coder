/**
 * `doc_extract` tool — Information extraction into structured JSON.
 *
 * Capabilities:
 * - Priority 1: NuExtract model via Unix domain socket ($EXTRACT_SOCKET or `/run/user/<uid>/extract.sock` / `/tmp/extract.sock`)
 *               or remote HTTP endpoint ($EXTRACT_URL).
 * - Priority 2: Local structured JSON parser / schema matcher fallback.
 * - Inputs:
 *   - `text` or `file`: source raw document text
 *   - `schema`: JSON schema / template specifying desired fields
 * - Output: Structured JSON payload conforming to schema.
 */

import { Type } from "@sinclair/typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve, basename } from "node:path";
import { isToolEnabled } from "../../_shared/tool-gating.ts";
import { storeDocArtifact } from "./storage.ts";

export const docExtractItemSchema = Type.Object({
  text: Type.Optional(Type.String({ description: "Raw text to extract from" })),
  file: Type.Optional(Type.String({ description: "Path to file to read and extract from" })),
  schema: Type.Record(Type.String(), Type.Any(), {
    description: "JSON schema or key-type dictionary to extract into",
  }),
  target: Type.Optional(Type.Union([Type.Literal("repo"), Type.Literal("user")])),
});

export const docExtractSchema = Type.Object({
  ops: Type.Optional(
    Type.Array(docExtractItemSchema, { description: "Batch extraction operations array" }),
  ),
  text: Type.Optional(Type.String({ description: "Raw text to extract from" })),
  file: Type.Optional(Type.String({ description: "Path to file to read and extract from" })),
  schema: Type.Optional(Type.Record(Type.String(), Type.Any())),
  target: Type.Optional(Type.Union([Type.Literal("repo"), Type.Literal("user")])),
});

export interface DocExtractOpResult {
  success: boolean;
  backend: "socket" | "endpoint" | "local_schema_parse" | "error";
  data?: any;
  artifactPath?: string;
  output: string;
  error?: string;
}

/**
 * Find active extract Unix domain socket
 */
export function findExtractSocket(env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.EXTRACT_SOCKET && existsSync(env.EXTRACT_SOCKET)) {
    return env.EXTRACT_SOCKET;
  }
  const uid = typeof process.getuid === "function" ? process.getuid() : 1000;
  const candidates = [
    `/run/user/${uid}/extract.sock`,
    "/tmp/extract.sock",
    `/run/user/${uid}/nuextract.sock`,
    "/tmp/nuextract.sock",
  ];
  for (const cand of candidates) {
    if (existsSync(cand)) return cand;
  }
  return null;
}

/**
 * Fallback lightweight key-value extraction using regex patterns
 */
export function fallbackLocalExtract(text: string, schema: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [key, spec] of Object.entries(schema)) {
    // Try matching "Key: value" or "Key = value"
    const pattern = new RegExp(`(?:${key}|"${key}")\\s*[:=]\\s*["']?([^\\n,"'\\}\\]]+)["']?`, "i");
    const match = text.match(pattern);
    if (match && match[1]) {
      const val = match[1].trim();
      if (typeof spec === "number" || spec === "number") {
        result[key] = Number(val) || val;
      } else if (typeof spec === "boolean" || spec === "boolean") {
        result[key] = val.toLowerCase() === "true";
      } else {
        result[key] = val;
      }
    } else {
      result[key] = null;
    }
  }

  return result;
}

export function executeDocExtractOp(
  op: any,
  cwd?: string,
  env: NodeJS.ProcessEnv = process.env,
): DocExtractOpResult {
  const effectiveCwd = cwd || process.cwd();
  let inputText = op.text || "";

  if (op.file && typeof op.file === "string") {
    const resolvedPath = resolve(effectiveCwd, op.file);
    if (existsSync(resolvedPath)) {
      try {
        inputText = readFileSync(resolvedPath, "utf-8");
      } catch (err: any) {
        return {
          success: false,
          backend: "error",
          output: `Failed reading file ${op.file}: ${err.message}`,
          error: err.message,
        };
      }
    } else {
      return {
        success: false,
        backend: "error",
        output: `File not found: ${op.file}`,
        error: `File not found: ${op.file}`,
      };
    }
  }

  if (!inputText) {
    return {
      success: false,
      backend: "error",
      output: "Missing input text or readable file",
      error: "Missing input text or file",
    };
  }

  const targetSchema = op.schema;
  if (!targetSchema || typeof targetSchema !== "object") {
    return {
      success: false,
      backend: "error",
      output: "Missing schema dictionary for extraction",
      error: "Missing schema",
    };
  }

  const extractSocket = findExtractSocket(env);
  const extractUrl = env.EXTRACT_URL || "";

  // 1. Socket backend (NuExtract worker)
  if (extractSocket) {
    try {
      const curlRes = spawnSync(
        "curl",
        [
          "--unix-socket",
          extractSocket,
          "-X",
          "POST",
          "http://localhost/v1/extract",
          "-H",
          "Content-Type: application/json",
          "-d",
          JSON.stringify({ text: inputText, schema: targetSchema }),
        ],
        { encoding: "utf-8", timeout: 15000 },
      );

      if (curlRes.status === 0 && curlRes.stdout) {
        let parsed: any;
        try {
          parsed = JSON.parse(curlRes.stdout);
        } catch {
          parsed = curlRes.stdout;
        }

        const serialized = JSON.stringify(parsed, null, 2);
        const stored = storeDocArtifact(serialized, "extract-result", "json", {
          target: op.target,
          cwd: effectiveCwd,
        });

        return {
          success: true,
          backend: "socket",
          data: parsed,
          output: stored.content,
          artifactPath: stored.filePath,
        };
      }
    } catch {
      // Fallback
    }
  }

  // 2. HTTP Endpoint backend
  if (extractUrl) {
    try {
      const curlRes = spawnSync(
        "curl",
        [
          "--fail",
          "--silent",
          "-X",
          "POST",
          `${extractUrl.replace(/\/$/, "")}/extract`,
          "-H",
          "Content-Type: application/json",
          "-d",
          JSON.stringify({ text: inputText, schema: targetSchema }),
        ],
        { encoding: "utf-8", timeout: 20000 },
      );

      if (curlRes.status === 0 && curlRes.stdout) {
        let parsed: any;
        try {
          parsed = JSON.parse(curlRes.stdout);
        } catch {
          parsed = curlRes.stdout;
        }

        const serialized = JSON.stringify(parsed, null, 2);
        const stored = storeDocArtifact(serialized, "extract-result", "json", {
          target: op.target,
          cwd: effectiveCwd,
        });

        return {
          success: true,
          backend: "endpoint",
          data: parsed,
          output: stored.content,
          artifactPath: stored.filePath,
        };
      }
    } catch {
      // Fallback
    }
  }

  // 3. Local fallback pattern matching
  const extracted = fallbackLocalExtract(inputText, targetSchema);
  const serialized = JSON.stringify(extracted, null, 2);
  const stored = storeDocArtifact(serialized, "extract-result", "json", {
    target: op.target,
    cwd: effectiveCwd,
  });

  return {
    success: true,
    backend: "local_schema_parse",
    data: extracted,
    output: stored.content,
    artifactPath: stored.filePath,
  };
}

export function registerDocExtractTool(pi: ExtensionAPI): void {
  if (!isToolEnabled("doc_extract", "docs")) {
    return;
  }

  pi.registerTool({
    name: "doc_extract",
    label: "doc_extract",
    description:
      "Extract structured data into JSON from raw text or document using a schema template. Connects to NuExtract socket/endpoint when available; falls back to structured schema parser.",
    parameters: docExtractSchema,
    execute: async (_toolCallId, params) => {
      const ops = Array.isArray(params.ops) && params.ops.length > 0 ? params.ops : [params];
      const results: DocExtractOpResult[] = [];

      for (const op of ops) {
        const normalizedOp = {
          text: op.text || params.text,
          file: op.file || params.file,
          schema: op.schema || params.schema,
          target: op.target || params.target,
        };
        results.push(executeDocExtractOp(normalizedOp));
      }

      const allSuccess = results.every((r) => r.success);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ results }, null, 2),
          },
        ],
        details: { success: allSuccess, count: results.length, results },
      };
    },
    renderResult: (result: any, { expanded }: { expanded: boolean }, theme: any) => {
      const details = result?.details?.results || [];
      const first = details[0] || {};

      if (!expanded) {
        const text = theme?.fg ? theme.fg("accent", `🧩 doc_extract`) : `🧩 doc_extract`;
        return new Text(text, 0, 0);
      }

      const lines = [`🧩 doc_extract`, `Backend: ${first.backend || "unknown"}`];
      if (first.output) lines.push(first.output.slice(0, 300));
      const text = theme?.fg ? theme.fg("muted", lines.join("\n")) : lines.join("\n");
      return new Text(text, 0, 0);
    },
  });
}
