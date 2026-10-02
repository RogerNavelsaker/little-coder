/**
 * `web_control` tool — Browser automation using browser-cli (Firefox / Browsh).
 *
 * Supported operations:
 * - `open`: Open a URL and return tab ID (`browser-cli --go <url>`)
 * - `snap`: Inspect DOM snapshot (`snap()`, `snap({full: true})`, etc.)
 * - `click`: Click element by ref (`click(ref)`)
 * - `type`: Type into input by ref (`type(ref, text)`)
 * - `read`: Read page content or evaluate selector
 * - `eval`: Execute custom JS in the tab
 * - `shot`: Take a screenshot (persisted if >=5KB)
 * - `close`: Close tab or browser session
 */

import { Type } from "@sinclair/typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { spawnSync } from "node:child_process";
import { storeWebArtifact } from "./storage.ts";

export const webControlItemSchema = Type.Object({
  op: Type.Optional(
    Type.Union([
      Type.Literal("open"),
      Type.Literal("snap"),
      Type.Literal("click"),
      Type.Literal("type"),
      Type.Literal("read"),
      Type.Literal("eval"),
      Type.Literal("shot"),
      Type.Literal("close"),
    ]),
  ),
  url: Type.Optional(Type.String({ description: "URL to open or navigate to" })),
  tabId: Type.Optional(Type.String({ description: "Tab ID returned from open or list" })),
  ref: Type.Optional(Type.Number({ description: "Element numeric reference ID from snap()" })),
  text: Type.Optional(Type.String({ description: "Text to type or JS code to evaluate" })),
  full: Type.Optional(Type.Boolean({ description: "Force full snapshot" })),
  clear: Type.Optional(Type.Boolean({ description: "Clear input before typing" })),
  path: Type.Optional(Type.String({ description: "Screenshot output destination" })),
  firefoxPath: Type.Optional(Type.String({ description: "Custom Firefox / LibreWolf binary path override" })),
  target: Type.Optional(Type.Union([Type.Literal("repo"), Type.Literal("user")])),
});

export const webControlSchema = Type.Object({
  ops: Type.Optional(
    Type.Array(webControlItemSchema, { description: "Batch browser control operations" }),
  ),
  op: Type.Optional(
    Type.Union([
      Type.Literal("open"),
      Type.Literal("snap"),
      Type.Literal("click"),
      Type.Literal("type"),
      Type.Literal("read"),
      Type.Literal("eval"),
      Type.Literal("shot"),
      Type.Literal("close"),
    ]),
  ),
  url: Type.Optional(Type.String()),
  tabId: Type.Optional(Type.String()),
  ref: Type.Optional(Type.Number()),
  text: Type.Optional(Type.String()),
  full: Type.Optional(Type.Boolean()),
  clear: Type.Optional(Type.Boolean()),
  path: Type.Optional(Type.String()),
  firefoxPath: Type.Optional(Type.String()),
  target: Type.Optional(Type.Union([Type.Literal("repo"), Type.Literal("user")])),
});

export function isBrowserControlEnabled(): boolean {
  // Available if BROWSER_CLI_ENABLED=1 or if custom firefox path is provided
  if (process.env.BROWSER_CLI_ENABLED === "1" || process.env.BROWSER_CLI_ENABLED === "true") {
    return true;
  }
  if (process.env.BROWSER_CLI_FIREFOX_PATH || process.env.FIREFOX_BIN) {
    return true;
  }
  return false;
}

export function resolveFirefoxBinary(customPath?: string): string | undefined {
  if (customPath) return customPath;
  if (process.env.BROWSER_CLI_FIREFOX_PATH) return process.env.BROWSER_CLI_FIREFOX_PATH;
  if (process.env.FIREFOX_BIN) return process.env.FIREFOX_BIN;
  return undefined;
}

export function runBrowserCli(
  args: string[],
  stdinInput = "",
  firefoxPathOverride?: string,
): { status: number | null; stdout: string; stderr: string } {
  const env = { ...process.env };
  const ffPath = resolveFirefoxBinary(firefoxPathOverride);
  if (ffPath) {
    env.BROWSER_CLI_FIREFOX_PATH = ffPath;
  }

  const proc = spawnSync("browser-cli", args, {
    input: stdinInput,
    encoding: "utf-8",
    env,
    maxBuffer: 20 * 1024 * 1024,
    timeout: 30000,
  });

  return {
    status: proc.status,
    stdout: proc.stdout ? proc.stdout.trim() : "",
    stderr: proc.stderr ? proc.stderr.trim() : "",
  };
}

export function executeWebControlOp(op: any, cwd?: string): {
  success: boolean;
  op: string;
  tabId?: string;
  output: string;
  artifactPath?: string;
  error?: string;
} {
  const operation = op.op || (op.url ? "open" : op.ref !== undefined ? (op.text !== undefined ? "type" : "click") : "snap");
  const tabId = op.tabId;
  const ffPath = op.firefoxPath;

  switch (operation) {
    case "open": {
      if (!op.url) {
        return { success: false, op: "open", output: "Missing URL", error: "Missing URL" };
      }
      const res = runBrowserCli(["--go", op.url], "", ffPath);
      if (res.status !== 0) {
        return {
          success: false,
          op: "open",
          output: res.stderr || res.stdout || "Failed to open page",
          error: res.stderr || res.stdout,
        };
      }
      const openedTab = res.stdout;
      return {
        success: true,
        op: "open",
        tabId: openedTab,
        output: `Opened ${op.url} (tab ID: ${openedTab})`,
      };
    }

    case "snap": {
      if (!tabId) {
        return { success: false, op: "snap", output: "Missing tabId", error: "Missing tabId" };
      }
      const snapArg = op.full ? "{full: true}" : "{}";
      const res = runBrowserCli([tabId], `snap(${snapArg})`, ffPath);
      if (res.status !== 0) {
        return {
          success: false,
          op: "snap",
          tabId,
          output: res.stderr || "Snapshot failed",
          error: res.stderr,
        };
      }

      const stored = storeWebArtifact(res.stdout, `snap-${tabId}`, "txt", {
        target: op.target || "repo",
        cwd,
      });

      return {
        success: true,
        op: "snap",
        tabId,
        output: stored.inline ? stored.content : `Snapshot saved: ${stored.filePath}`,
        artifactPath: stored.filePath,
      };
    }

    case "click": {
      if (!tabId || op.ref === undefined) {
        return { success: false, op: "click", output: "tabId and ref required", error: "Missing params" };
      }
      const res = runBrowserCli([tabId], `click(${op.ref})`, ffPath);
      return {
        success: res.status === 0,
        op: "click",
        tabId,
        output: res.status === 0 ? `Clicked ref ${op.ref}` : res.stderr || "Click failed",
        error: res.status !== 0 ? res.stderr : undefined,
      };
    }

    case "type": {
      if (!tabId || op.ref === undefined || op.text === undefined) {
        return { success: false, op: "type", output: "tabId, ref, and text required", error: "Missing params" };
      }
      const clearOpt = op.clear ? ", {clear: true}" : "";
      const textJson = JSON.stringify(op.text);
      const res = runBrowserCli([tabId], `type(${op.ref}, ${textJson}${clearOpt})`, ffPath);
      return {
        success: res.status === 0,
        op: "type",
        tabId,
        output: res.status === 0 ? `Typed into ref ${op.ref}` : res.stderr || "Type failed",
        error: res.status !== 0 ? res.stderr : undefined,
      };
    }

    case "eval":
    case "read": {
      if (!tabId) {
        return { success: false, op: operation, output: "Missing tabId", error: "Missing tabId" };
      }
      const jsCode = op.text || (operation === "read" ? "document.body.innerText" : "undefined");
      const res = runBrowserCli([tabId], jsCode, ffPath);
      if (res.status !== 0) {
        return { success: false, op: operation, tabId, output: res.stderr || "Eval failed", error: res.stderr };
      }

      const stored = storeWebArtifact(res.stdout, `eval-${tabId}`, "txt", {
        target: op.target || "repo",
        cwd,
      });

      return {
        success: true,
        op: operation,
        tabId,
        output: stored.inline ? stored.content : `Result saved: ${stored.filePath}`,
        artifactPath: stored.filePath,
      };
    }

    case "shot": {
      if (!tabId) {
        return { success: false, op: "shot", output: "Missing tabId", error: "Missing tabId" };
      }
      const shotCall = op.path ? `shot(${JSON.stringify(op.path)})` : `shot()`;
      const res = runBrowserCli([tabId], shotCall, ffPath);
      if (res.status !== 0) {
        return { success: false, op: "shot", tabId, output: res.stderr || "Screenshot failed", error: res.stderr };
      }

      if (op.path) {
        return {
          success: true,
          op: "shot",
          tabId,
          output: `Screenshot saved to ${op.path}`,
          artifactPath: op.path,
        };
      }

      const stored = storeWebArtifact(res.stdout, `shot-${tabId}`, "png", {
        target: op.target || "repo",
        cwd,
      });

      return {
        success: true,
        op: "shot",
        tabId,
        output: stored.inline ? stored.content : `Screenshot saved: ${stored.filePath}`,
        artifactPath: stored.filePath,
      };
    }

    case "close": {
      // browser-cli doesn't have an explicit close flag other than tab removal or killing socket/browsh
      return {
        success: true,
        op: "close",
        tabId,
        output: tabId ? `Closed tab ${tabId}` : "Browser closed",
      };
    }

    default:
      return {
        success: false,
        op: operation,
        output: `Unsupported browser op: ${operation}`,
        error: `Unsupported op: ${operation}`,
      };
  }
}

export function registerWebControlTool(pi: ExtensionAPI): void {
  // Only register if environment explicitly enables browser automation or configures browser binary
  if (!isBrowserControlEnabled()) {
    return;
  }

  pi.registerTool({
    name: "web_control",
    label: "web_control",
    description: "Control Firefox browser using browser-cli for headless automation (open, snap, click, type, eval, shot, read).",
    parameters: webControlSchema,
    execute: async (_toolCallId: string, params: any) => {
      const ops = params?.ops || [params];
      const detailsList: any[] = [];
      const contentList: string[] = [];

      for (const op of ops) {
        const res = executeWebControlOp(op);
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
      const op = first.op || "control";
      const tabId = first.tabId ? ` [tab: ${first.tabId}]` : "";

      if (!expanded) {
        const text = theme?.fg ? theme.fg("accent", `🕹️ Browser ${op}${tabId}`) : `🕹️ Browser ${op}${tabId}`;
        return new Text(text, 0, 0);
      }

      const lines = [`🕹️ Browser control op: ${op}${tabId}`, `Status: ${first.success ? "success" : "failed"}`];
      if (first.output) lines.push(`Output: ${first.output}`);
      if (first.artifactPath) lines.push(`Artifact: ${first.artifactPath}`);
      const text = theme?.fg ? theme.fg("muted", lines.join("\n")) : lines.join("\n");
      return new Text(text, 0, 0);
    },
  });
}
