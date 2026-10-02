import { describe, it, expect, beforeEach } from "bun:test";
import {
  executeScratchpadOp,
  clearScratchpad,
  formatActiveClipboard,
  registerScratchpadTool,
} from "./scratchpad.ts";

describe("executeScratchpadOp", () => {
  beforeEach(() => {
    clearScratchpad();
  });

  it("handles empty scratchpad list", async () => {
    const res = await executeScratchpadOp("call-1", { action: "list" });
    expect(res.isError).toBe(false);
    expect(res.details.count).toBe(0);
    expect(res.content[0].text).toContain("Scratchpad is empty");
  });

  it("sets and gets entries", async () => {
    const setRes = await executeScratchpadOp("call-2", {
      action: "set",
      key: "task-plan",
      content: "Step 1: refactor\nStep 2: test",
    });
    expect(setRes.isError).toBe(false);
    expect(setRes.details.key).toBe("task-plan");

    const getRes = await executeScratchpadOp("call-3", {
      action: "get",
      key: "task-plan",
    });
    expect(getRes.isError).toBe(false);
    expect(getRes.details.found).toBe(true);
    expect(getRes.content[0].text).toBe("Step 1: refactor\nStep 2: test");
  });

  it("removes entries and clears", async () => {
    await executeScratchpadOp("call-4", { action: "set", key: "temp", content: "data" });
    const removeRes = await executeScratchpadOp("call-5", { action: "remove", key: "temp" });
    expect(removeRes.details.deleted).toBe(true);

    await executeScratchpadOp("call-6", { action: "set", key: "a", content: "1" });
    await executeScratchpadOp("call-7", { action: "set", key: "b", content: "2" });
    const clearRes = await executeScratchpadOp("call-8", { action: "clear" });
    expect(clearRes.details.count).toBe(2);
  });

  it("formats active clipboard XML", async () => {
    await executeScratchpadOp("call-9", { action: "set", key: "findings", content: "Memory leak in handler" });
    const formatted = formatActiveClipboard();
    expect(formatted).toContain("<active_clipboard>");
    expect(formatted).toContain("[findings]: Memory leak in handler");
    expect(formatted).toContain("</active_clipboard>");
  });

  it("supports batch operations via ops[] universal array", async () => {
    const res = await executeScratchpadOp("call-10", {
      ops: [
        { action: "set", key: "k1", content: "v1" },
        { action: "set", key: "k2", content: "v2" },
        { action: "list" },
      ],
    });
    expect(res.isError).toBe(false);
    expect(res.details.totalOps).toBe(3);
    expect(res.content[0].text).toContain("---");
  });
});

describe("registerScratchpadTool", () => {
  it("registers scratchpad tool and command", () => {
    const tools: any[] = [];
    const commands: Record<string, any> = {};
    const mockPi: any = {
      registerTool: (t: any) => tools.push(t),
      registerCommand: (name: string, opts: any) => { commands[name] = opts; },
      on: () => {},
    };

    registerScratchpadTool(mockPi);
    expect(tools.length).toBe(1);
    expect(tools[0].name).toBe("scratchpad");
    expect(commands["scratchpad"]).toBeDefined();
  });
});
