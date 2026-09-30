import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  registerCommandHistoryTool,
  appendHistoryEntry,
  readHistoryEntries,
  clearHistoryEntries,
  getHistoryFilePath,
  executeCommandHistoryOp,
} from "./command-history.js";

describe("command-history extension", () => {
  let tempDir: string;
  const mockTheme = {
    fg: (_c: string, t: string) => t,
    bold: (t: string) => t,
    italic: (t: string) => `_italic_${t}_italic_`,
  };

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "pi-cmd-hist-test-"));
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("appends and reads history entries per-CWD", () => {
    const cwd1 = "/workspace/project-a";
    const cwd2 = "/workspace/project-b";

    appendHistoryEntry(cwd1, "echo hello", tempDir);
    appendHistoryEntry(cwd1, "git status", tempDir);
    appendHistoryEntry(cwd2, "cargo build", tempDir);

    const entries1 = readHistoryEntries(cwd1, 50, tempDir);
    expect(entries1.length).toBe(2);
    expect(entries1[0].text).toBe("echo hello");
    expect(entries1[1].text).toBe("git status");

    const entries2 = readHistoryEntries(cwd2, 50, tempDir);
    expect(entries2.length).toBe(1);
    expect(entries2[0].text).toBe("cargo build");
  });

  it("clears history for a specific CWD", () => {
    const cwd = "/workspace/to-clear";
    appendHistoryEntry(cwd, "npm test", tempDir);
    expect(readHistoryEntries(cwd, 50, tempDir).length).toBe(1);

    const cleared = clearHistoryEntries(cwd, tempDir);
    expect(cleared).toBe(true);
    expect(readHistoryEntries(cwd, 50, tempDir).length).toBe(0);
  });

  it("executes list and search actions via executeCommandHistoryOp", async () => {
    process.env.PI_FOLDER_HISTORY_DIR = tempDir;
    try {
      const cwd = "/workspace/exec-test";
      appendHistoryEntry(cwd, "bun run build", tempDir);
      appendHistoryEntry(cwd, "bun run test", tempDir);
      appendHistoryEntry(cwd, "git commit -m 'feat'", tempDir);

      // List
      const listRes = await executeCommandHistoryOp(
        "call_list",
        { action: "list", limit: 2, cwd },
        undefined,
        undefined,
        { cwd }
      );
      expect(listRes.isError).toBe(false);
      expect(listRes.details.entries.length).toBe(2);

      // Search
      const searchRes = await executeCommandHistoryOp(
        "call_search",
        { action: "search", query: "commit", cwd },
        undefined,
        undefined,
        { cwd }
      );
      expect(searchRes.isError).toBe(false);
      expect(searchRes.content[0].text).toContain("git commit");
      expect(searchRes.details.entries.length).toBe(1);
    } finally {
      delete process.env.PI_FOLDER_HISTORY_DIR;
    }
  });

  it("supports ops array via executeCommandHistoryOp", async () => {
    process.env.PI_FOLDER_HISTORY_DIR = tempDir;
    try {
      const cwd = "/workspace/ops-test";
      appendHistoryEntry(cwd, "task one", tempDir);
      appendHistoryEntry(cwd, "task two", tempDir);

      const res = await executeCommandHistoryOp(
        "call_ops",
        {
          ops: [
            { action: "list", limit: 1, cwd },
            { action: "search", query: "two", cwd },
          ],
        },
        undefined,
        undefined,
        { cwd }
      );
      expect(res.isError).toBe(false);
      expect(res.details.totalOps).toBe(2);
      expect(res.details.entries.length).toBe(2);
    } finally {
      delete process.env.PI_FOLDER_HISTORY_DIR;
    }
  });

  it("registers tool and renders call/result properly", () => {
    let registeredTool: any = null;
    const hooks: Record<string, Function[]> = {};

    const mockPi = {
      registerTool(tool: any) {
        registeredTool = tool;
      },
      on(event: string, handler: Function) {
        hooks[event] = hooks[event] || [];
        hooks[event].push(handler);
      },
    };

    registerCommandHistoryTool(mockPi as any);

    expect(registeredTool).toBeDefined();
    expect(registeredTool.name).toBe("command_history");
    expect(hooks["input"]).toBeDefined();

    const callText = registeredTool.renderCall({ action: "search", query: "git" }, mockTheme);
    expect(callText.text).toContain("command_history");
    expect(callText.text).toContain('search "git"');

    const resText = registeredTool.renderResult(
      { details: { totalEntries: 5 } },
      { expanded: false },
      mockTheme
    );
    expect(resText.text).toContain("History (5 entries)");
  });

  it("records user prompt via pi.on('input') hook", async () => {
    process.env.PI_FOLDER_HISTORY_DIR = tempDir;
    try {
      let registeredTool: any = null;
      const hooks: Record<string, Function[]> = {};

      const mockPi = {
        registerTool(tool: any) {
          registeredTool = tool;
        },
        on(event: string, handler: Function) {
          hooks[event] = hooks[event] || [];
          hooks[event].push(handler);
        },
      };

      registerCommandHistoryTool(mockPi as any);

      const inputHook = hooks["input"][0];
      const testCwd = "/workspace/hook-test";
      let statusSet = "";
      const ctx = {
        cwd: testCwd,
        ui: {
          setStatus: (_key: string, val: string) => {
            statusSet = val;
          },
        },
      };

      await inputHook({ text: "do something helpful" }, ctx);

      const entries = readHistoryEntries(testCwd, 10, tempDir);
      expect(entries.length).toBe(1);
      expect(entries[0].text).toBe("do something helpful");
      expect(statusSet).toContain("History saved");
    } finally {
      delete process.env.PI_FOLDER_HISTORY_DIR;
    }
  });
});
