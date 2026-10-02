/**
 * `doc_ocr` tool — Optical Character Recognition tool.
 *
 * Capabilities:
 * - Priority 1: MiniCPM-V / OCR server via Unix domain socket ($OCR_SOCKET or standard paths)
 *               or remote HTTP endpoint ($OCR_URL).
 * - Priority 2: Local bundled/system `tesseract` CLI.
 * - Options: image path, optional bounding region / crop coordinates, language.
 * - Output: Recognized text or layout structure.
 */

import { Type } from "@sinclair/typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve, basename } from "node:path";
import * as net from "node:net";
import { isToolEnabled } from "../../_shared/tool-gating.ts";
import { storeDocArtifact } from "./storage.ts";

export const docOcrItemSchema = Type.Object({
  image: Type.String({ description: "Path to image or page snapshot to OCR" }),
  lang: Type.Optional(Type.String({ description: "OCR language (default 'eng')" })),
  region: Type.Optional(
    Type.Object({
      x: Type.Number(),
      y: Type.Number(),
      width: Type.Number(),
      height: Type.Number(),
    }, { description: "Optional bounding crop region (x, y, width, height)" }),
  ),
  target: Type.Optional(Type.Union([Type.Literal("repo"), Type.Literal("user")])),
});

export const docOcrSchema = Type.Object({
  ops: Type.Optional(
    Type.Array(docOcrItemSchema, { description: "Batch OCR operations array" }),
  ),
  image: Type.Optional(Type.String({ description: "Image file path" })),
  lang: Type.Optional(Type.String()),
  region: Type.Optional(
    Type.Object({
      x: Type.Number(),
      y: Type.Number(),
      width: Type.Number(),
      height: Type.Number(),
    }),
  ),
  target: Type.Optional(Type.Union([Type.Literal("repo"), Type.Literal("user")])),
});

export interface DocOcrOpResult {
  success: boolean;
  image: string;
  backend: "socket" | "endpoint" | "tesseract" | "error";
  text: string;
  artifactPath?: string;
  error?: string;
}

/**
 * Find active OCR Unix domain socket
 */
export function findOcrSocket(env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.OCR_SOCKET && existsSync(env.OCR_SOCKET)) {
    return env.OCR_SOCKET;
  }
  const uid = typeof process.getuid === "function" ? process.getuid() : 1000;
  const candidates = [
    `/run/user/${uid}/ocr.sock`,
    "/tmp/ocr.sock",
    `/run/user/${uid}/minicpm.sock`,
    "/tmp/minicpm.sock",
  ];
  for (const cand of candidates) {
    if (existsSync(cand)) return cand;
  }
  return null;
}

/**
 * Send request to Unix domain socket synchronously
 */
export async function queryUnixSocket(socketPath: string, payload: any): Promise<string> {
  return new Promise((res, rej) => {
    const client = net.createConnection({ path: socketPath }, () => {
      client.write(JSON.stringify(payload) + "\n");
    });
    let data = "";
    client.on("data", (chunk) => {
      data += chunk.toString();
    });
    client.on("end", () => {
      res(data.trim());
    });
    client.on("error", (err) => {
      rej(err);
    });
    client.setTimeout(10000, () => {
      client.destroy();
      rej(new Error("Socket timeout"));
    });
  });
}

export function executeDocOcrOp(
  op: any,
  cwd?: string,
  env: NodeJS.ProcessEnv = process.env,
): DocOcrOpResult {
  const effectiveCwd = cwd || process.cwd();
  const imagePath = op.image;
  if (!imagePath || typeof imagePath !== "string") {
    return {
      success: false,
      image: "",
      backend: "error",
      text: "Missing image path",
      error: "Missing image path",
    };
  }

  const resolvedImage = resolve(effectiveCwd, imagePath);
  if (!existsSync(resolvedImage)) {
    return {
      success: false,
      image: imagePath,
      backend: "error",
      text: `Image not found: ${imagePath}`,
      error: `Image not found: ${imagePath}`,
    };
  }

  const lang = op.lang || "eng";
  const ocrSocket = findOcrSocket(env);
  const ocrUrl = env.OCR_URL || "";

  // 1. Socket backend (MiniCPM-V worker)
  if (ocrSocket) {
    try {
      // Synchronous curl over unix socket or curl CLI
      const curlRes = spawnSync(
        "curl",
        [
          "--unix-socket",
          ocrSocket,
          "-X",
          "POST",
          "http://localhost/v1/ocr",
          "-H",
          "Content-Type: application/json",
          "-d",
          JSON.stringify({ image: resolvedImage, region: op.region, lang }),
        ],
        { encoding: "utf-8", timeout: 15000 },
      );

      if (curlRes.status === 0 && curlRes.stdout) {
        let extracted = curlRes.stdout;
        try {
          const parsed = JSON.parse(curlRes.stdout);
          if (parsed.text) extracted = parsed.text;
        } catch {
          // Keep raw
        }
        const stored = storeDocArtifact(extracted, `${basename(resolvedImage)}-ocr`, "txt", {
          target: op.target,
          cwd: effectiveCwd,
        });
        return {
          success: true,
          image: imagePath,
          backend: "socket",
          text: stored.content,
          artifactPath: stored.filePath,
        };
      }
    } catch {
      // Fallback
    }
  }

  // 2. HTTP Endpoint backend
  if (ocrUrl) {
    try {
      const curlRes = spawnSync(
        "curl",
        [
          "--fail",
          "--silent",
          "-X",
          "POST",
          `${ocrUrl.replace(/\/$/, "")}/ocr`,
          "-F",
          `file=@${resolvedImage}`,
          "-F",
          `lang=${lang}`,
        ],
        { encoding: "utf-8", timeout: 20000 },
      );
      if (curlRes.status === 0 && curlRes.stdout) {
        const stored = storeDocArtifact(curlRes.stdout, `${basename(resolvedImage)}-ocr`, "txt", {
          target: op.target,
          cwd: effectiveCwd,
        });
        return {
          success: true,
          image: imagePath,
          backend: "endpoint",
          text: stored.content,
          artifactPath: stored.filePath,
        };
      }
    } catch {
      // Fallback
    }
  }

  // 3. Local Tesseract CLI fallback
  try {
    const tesseractArgs = [resolvedImage, "stdout", "-l", lang];
    const tessRes = spawnSync("tesseract", tesseractArgs, {
      encoding: "utf-8",
      timeout: 30000,
    });

    if (tessRes.status === 0) {
      const text = (tessRes.stdout || "").trim();
      const stored = storeDocArtifact(text, `${basename(resolvedImage)}-ocr`, "txt", {
        target: op.target,
        cwd: effectiveCwd,
      });
      return {
        success: true,
        image: imagePath,
        backend: "tesseract",
        text: stored.content,
        artifactPath: stored.filePath,
      };
    } else {
      return {
        success: false,
        image: imagePath,
        backend: "error",
        text: tessRes.stderr || "Tesseract OCR failed",
        error: "Tesseract OCR failed",
      };
    }
  } catch (err: any) {
    return {
      success: false,
      image: imagePath,
      backend: "error",
      text: err.message || "No OCR backend available (tesseract not found)",
      error: err.message,
    };
  }
}

export function registerDocOcrTool(pi: ExtensionAPI): void {
  if (!isToolEnabled("doc_ocr", "docs")) {
    return;
  }

  pi.registerTool({
    name: "doc_ocr",
    label: "doc_ocr",
    description:
      "Perform Optical Character Recognition on an image or page snapshot. Uses MiniCPM socket/endpoint if available; falls back to local Tesseract CLI.",
    parameters: docOcrSchema,
    execute: async (_toolCallId, params) => {
      const ops = Array.isArray(params.ops) && params.ops.length > 0 ? params.ops : [params];
      const results: DocOcrOpResult[] = [];

      for (const op of ops) {
        if (!op.image && !params.image) continue;
        const normalizedOp = {
          image: op.image || params.image,
          lang: op.lang || params.lang || "eng",
          region: op.region || params.region,
          target: op.target || params.target,
        };
        results.push(executeDocOcrOp(normalizedOp));
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
      const target = first.image ? ` [${first.image}]` : "";

      if (!expanded) {
        const text = theme?.fg ? theme.fg("accent", `🔍 doc_ocr${target}`) : `🔍 doc_ocr${target}`;
        return new Text(text, 0, 0);
      }

      const lines = [`🔍 doc_ocr: ${first.image || "image"}`, `Backend: ${first.backend || "unknown"}`];
      if (first.text) lines.push(first.text.slice(0, 300));
      const text = theme?.fg ? theme.fg("muted", lines.join("\n")) : lines.join("\n");
      return new Text(text, 0, 0);
    },
  });
}
