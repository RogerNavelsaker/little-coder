/**
 * `doc_read` tool — Document conversion and parsing tool.
 *
 * Capabilities:
 * - Priority 1: Self-hosted Docling Serve ($DOCLING_URL) for complex PDFs/scanned docs/tables.
 * - Priority 2: Local CLI/tools:
 *   - Plain text / markdown / csv / json: direct read.
 *   - PDF: `pdftotext` (poppler) if installed, or fallback.
 *   - Office documents (.docx, .pptx, .xlsx, .odt): unzip & XML extraction.
 * - Artifacts: Content >= 5KB is written to `.pi/docs/<timestamp>-<slug>/` or `~/.pi/docs/`.
 * - Mulch Chunking: Optional `chunk_domain` parameter to split and record chunks directly into Mulch.
 */

import { Type } from "@sinclair/typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { spawnSync, execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, mkdtempSync } from "node:fs";
import { resolve, extname, basename } from "node:path";
import { tmpdir } from "node:os";
import { isToolEnabled } from "../../_shared/tool-gating.ts";
import { storeDocArtifact } from "./storage.ts";

export const docReadItemSchema = Type.Object({
  path: Type.String({ description: "Path to document file to read/convert" }),
  format: Type.Optional(
    Type.Union([Type.Literal("md"), Type.Literal("text"), Type.Literal("json")], {
      description: "Desired output format (default 'md')",
    }),
  ),
  vlm: Type.Optional(
    Type.Boolean({
      description: "Enable VLM acceleration for Docling Serve (if available)",
    }),
  ),
  target: Type.Optional(
    Type.Union([Type.Literal("repo"), Type.Literal("user")], {
      description: "Target location for persisted artifact if >= 5KB ('repo' or 'user')",
    }),
  ),
  chunk_domain: Type.Optional(
    Type.String({
      description: "Optional Mulch domain (e.g., 'tech', 'architecture') to chunk and record into",
    }),
  ),
});

export const docReadSchema = Type.Object({
  ops: Type.Optional(
    Type.Array(docReadItemSchema, {
      description: "Batch document read operations array",
    }),
  ),
  path: Type.Optional(Type.String({ description: "Single document file path" })),
  format: Type.Optional(Type.Union([Type.Literal("md"), Type.Literal("text"), Type.Literal("json")])),
  vlm: Type.Optional(Type.Boolean()),
  target: Type.Optional(Type.Union([Type.Literal("repo"), Type.Literal("user")])),
  chunk_domain: Type.Optional(Type.String()),
});

export interface DocReadOpResult {
  success: boolean;
  path: string;
  backend: "docling" | "officeparser" | "pdftotext" | "unzip_xml" | "direct" | "error";
  output: string;
  artifactPath?: string;
  chunksRecorded?: number;
  error?: string;
}

/**
 * Extract text from docx/pptx/odt/xlsx using unzip if available
 */
export function extractFromZipContainer(filePath: string, ext: string): string | null {
  try {
    const tmpDir = mkdtempSync(resolve(tmpdir(), "doc-unzip-"));
    const unzipRes = spawnSync("unzip", ["-q", filePath, "-d", tmpDir], {
      encoding: "utf-8",
      timeout: 10000,
    });
    if (unzipRes.status !== 0) {
      rmSync(tmpDir, { recursive: true, force: true });
      return null;
    }

    let extractedText = "";
    if (ext === ".docx") {
      const docXmlPath = resolve(tmpDir, "word/document.xml");
      if (existsSync(docXmlPath)) {
        const rawXml = readFileSync(docXmlPath, "utf-8");
        extractedText = rawXml
          .replace(/<w:p.*?>/gi, "\n\n")
          .replace(/<[^>]+>/g, " ")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&amp;/g, "&")
          .replace(/[ \t]+/g, " ")
          .trim();
      }
    } else if (ext === ".pptx") {
      const slidesDir = resolve(tmpDir, "ppt/slides");
      if (existsSync(slidesDir)) {
        const files = (spawnSync("find", [slidesDir, "-name", "slide*.xml"], { encoding: "utf-8" }).stdout || "")
          .trim()
          .split("\n")
          .filter(Boolean)
          .sort();
        for (const file of files) {
          const rawXml = readFileSync(file, "utf-8");
          const slideText = rawXml
            .replace(/<a:p.*?>/gi, "\n")
            .replace(/<[^>]+>/g, " ")
            .replace(/[ \t]+/g, " ")
            .trim();
          if (slideText) {
            extractedText += `\n\n### Slide\n${slideText}`;
          }
        }
      }
    } else if (ext === ".xlsx") {
      const sharedStringsPath = resolve(tmpDir, "xl/sharedStrings.xml");
      if (existsSync(sharedStringsPath)) {
        const rawXml = readFileSync(sharedStringsPath, "utf-8");
        const matches = rawXml.match(/<t[^>]*>(.*?)<\/t>/gs);
        if (matches) {
          extractedText = matches
            .map((m) => m.replace(/<[^>]+>/g, ""))
            .join("\n");
        }
      }
    }

    rmSync(tmpDir, { recursive: true, force: true });
    return extractedText.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Record text chunks to Mulch domain
 */
export function recordChunksToMulch(
  text: string,
  docName: string,
  domain: string,
  cwd: string,
): number {
  const chunkSize = 2000;
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }

  let count = 0;
  const safeDocName = docName.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
  for (let idx = 0; idx < chunks.length; idx++) {
    const chunkName = `${safeDocName}-p${idx + 1}`;
    try {
      spawnSync(
        "mulch",
        ["record", domain, "--type", "note", "--name", chunkName, chunks[idx]],
        { cwd, timeout: 5000 },
      );
      count++;
    } catch {
      // Continue recording remaining
    }
  }
  return count;
}

export function executeDocReadOp(
  op: any,
  cwd?: string,
  env: NodeJS.ProcessEnv = process.env,
): DocReadOpResult {
  const effectiveCwd = cwd || process.cwd();
  const filePathStr = op.path;
  if (!filePathStr || typeof filePathStr !== "string") {
    return {
      success: false,
      path: "",
      backend: "error",
      output: "Missing required document path",
      error: "Missing required document path",
    };
  }

  const resolvedPath = resolve(effectiveCwd, filePathStr);
  if (!existsSync(resolvedPath)) {
    return {
      success: false,
      path: filePathStr,
      backend: "error",
      output: `File not found: ${filePathStr}`,
      error: `File not found: ${filePathStr}`,
    };
  }

  const ext = extname(resolvedPath).toLowerCase();
  const format = op.format || "md";
  const doclingUrl = env.DOCLING_URL || "";

  // 1. If DOCLING_URL is set, use remote Docling Serve
  if (doclingUrl) {
    try {
      const curlArgs = [
        "--fail",
        "--silent",
        "--show-error",
        "-X",
        "POST",
        `${doclingUrl.replace(/\/$/, "")}/v1/convert/file`,
        "-F",
        `file=@${resolvedPath}`,
        "-F",
        `to_formats=${format}`,
      ];

      if (op.vlm) {
        const options = JSON.stringify({
          pipeline: "vlm",
          to_formats: [format],
          vlm_pipeline_model_api: {
            url: "http://100.108.123.126:13305/api/v1/chat/completions",
            params: { model: "Docling_258M", max_tokens: 4096 },
            response_format: "doctags",
            prompt: "Convert this page to docling.",
          },
        });
        curlArgs.push("-F", `options=${options}`);
      }

      const res = spawnSync("curl", curlArgs, {
        encoding: "utf-8",
        timeout: 60000,
      });

      if (res.status === 0 && res.stdout) {
        let content = res.stdout;
        let chunksCount: number | undefined;
        if (op.chunk_domain) {
          chunksCount = recordChunksToMulch(content, basename(resolvedPath), op.chunk_domain, effectiveCwd);
        }

        const stored = storeDocArtifact(content, basename(resolvedPath), format, {
          target: op.target,
          cwd: effectiveCwd,
        });

        return {
          success: true,
          path: filePathStr,
          backend: "docling",
          output: stored.content,
          artifactPath: stored.filePath,
          chunksRecorded: chunksCount,
        };
      }
    } catch {
      // Fallback to local parsing
    }
  }

  // 2. Local Fallback handling
  let extractedContent = "";
  let backendUsed: DocReadOpResult["backend"] = "direct";

  // Case A: Text/markdown/csv/json formats
  if ([".txt", ".md", ".json", ".csv", ".tsv", ".log", ".yaml", ".yml"].includes(ext)) {
    try {
      extractedContent = readFileSync(resolvedPath, "utf-8");
      backendUsed = "direct";
    } catch (e: any) {
      return {
        success: false,
        path: filePathStr,
        backend: "error",
        output: e.message || "Failed to read text file",
        error: e.message,
      };
    }
  } else {
    // Check if officeparser CLI (from nixpkg-officeparser or PATH) is available
    const officeFormat = format === "json" ? "json" : format === "text" ? "text" : "md";
    try {
      const officeRes = spawnSync(
        "officeparser",
        [resolvedPath, `--to=${officeFormat}`],
        { encoding: "utf-8", timeout: 30000 },
      );
      if (officeRes.status === 0 && officeRes.stdout && officeRes.stdout.trim().length > 0) {
        extractedContent = officeRes.stdout.trim();
        backendUsed = "officeparser";
      }
    } catch {
      // officeparser not installed or failed, continue to format-specific fallbacks
    }

    if (!extractedContent) {
      if (ext === ".pdf") {
        // Case B: PDF via pdftotext
        try {
          const pdfRes = spawnSync("pdftotext", ["-layout", resolvedPath, "-"], {
            encoding: "utf-8",
            timeout: 15000,
          });
          if (pdfRes.status === 0 && pdfRes.stdout) {
            extractedContent = pdfRes.stdout.trim();
            backendUsed = "pdftotext";
          } else {
            return {
              success: false,
              path: filePathStr,
              backend: "error",
              output: pdfRes.stderr || "pdftotext extraction failed",
              error: "pdftotext failed",
            };
          }
        } catch (e: any) {
          return {
            success: false,
            path: filePathStr,
            backend: "error",
            output: e.message || "pdftotext execution error",
            error: e.message,
          };
        }
      } else if ([".docx", ".pptx", ".xlsx", ".odt"].includes(ext)) {
        // Case C: Office archives via unzip + XML extraction
        const text = extractFromZipContainer(resolvedPath, ext);
        if (text) {
          extractedContent = text;
          backendUsed = "unzip_xml";
        } else {
          return {
            success: false,
            path: filePathStr,
            backend: "error",
            output: `Failed to extract text from ${ext} container`,
            error: "Unzip XML extraction failed",
          };
        }
      } else {
        // Unsupported fallback
        try {
          extractedContent = readFileSync(resolvedPath, "utf-8");
          backendUsed = "direct";
        } catch {
          return {
            success: false,
            path: filePathStr,
            backend: "error",
            output: `Unsupported document format '${ext}' and no DOCLING_URL or officeparser configured`,
            error: `Unsupported format ${ext}`,
          };
        }
      }
    }
  }

  let chunksCount: number | undefined;
  if (op.chunk_domain && extractedContent) {
    chunksCount = recordChunksToMulch(extractedContent, basename(resolvedPath), op.chunk_domain, effectiveCwd);
  }

  const stored = storeDocArtifact(extractedContent, basename(resolvedPath), format, {
    target: op.target,
    cwd: effectiveCwd,
  });

  return {
    success: true,
    path: filePathStr,
    backend: backendUsed,
    output: stored.content,
    artifactPath: stored.filePath,
    chunksRecorded: chunksCount,
  };
}

export function registerDocReadTool(pi: ExtensionAPI): void {
  if (!isToolEnabled("doc_read", "docs")) {
    return;
  }

  pi.registerTool({
    name: "doc_read",
    label: "doc_read",
    description:
      "Convert and read document files (PDF, DOCX, PPTX, XLSX, TXT, CSV) into Markdown. Uses remote Docling Serve if DOCLING_URL is set; falls back to local pdftotext/office parsers. Content >= 5KB is saved to .pi/docs/ to save context tokens.",
    parameters: docReadSchema,
    execute: async (_toolCallId, params) => {
      const ops = Array.isArray(params.ops) && params.ops.length > 0 ? params.ops : [params];
      const results: DocReadOpResult[] = [];

      for (const op of ops) {
        if (!op.path && !params.path) continue;
        const normalizedOp = {
          path: op.path || params.path,
          format: op.format || params.format || "md",
          vlm: op.vlm ?? params.vlm,
          target: op.target || params.target,
          chunk_domain: op.chunk_domain || params.chunk_domain,
        };
        results.push(executeDocReadOp(normalizedOp));
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
      const target = first.path ? ` [${first.path}]` : "";

      if (!expanded) {
        const text = theme?.fg ? theme.fg("accent", `📄 doc_read${target}`) : `📄 doc_read${target}`;
        return new Text(text, 0, 0);
      }

      const lines = [`📄 doc_read: ${first.path || "doc"}`, `Backend: ${first.backend || "unknown"}`];
      if (first.output) lines.push(first.output.slice(0, 300));
      const text = theme?.fg ? theme.fg("muted", lines.join("\n")) : lines.join("\n");
      return new Text(text, 0, 0);
    },
  });
}
