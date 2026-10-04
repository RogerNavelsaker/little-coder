import { describe, it, expect, beforeEach } from "bun:test";
import {
  STRUCTURAL_TOOL_ICONS,
  isStructuralTool,
  getToolRoleIcon,
  ToolGroupingTracker,
  executeBasicToolGroupingOp,
  registerBasicToolGrouping,
} from "./basic-tool-grouping.js";
import { getToolDefinitionOverride } from "../../_shared/tool-execution-patch.js";

describe("basic-tool-grouping", () => {
  let tracker: ToolGroupingTracker;

  beforeEach(() => {
    tracker = new ToolGroupingTracker();
  });

  it("maps correct role icons to structural tools", () => {
    // ◫ read/grep/find/ls
    expect(getToolRoleIcon("read")).toBe("◫");
    expect(getToolRoleIcon("grep")).toBe("◫");
    expect(getToolRoleIcon("find")).toBe("◫");
    expect(getToolRoleIcon("ls")).toBe("◫");

    // ✎ edit/write
    expect(getToolRoleIcon("edit")).toBe("✎");
    expect(getToolRoleIcon("write")).toBe("✎");

    // ❯ shell/sh
    expect(getToolRoleIcon("shell")).toBe("❯");
    expect(getToolRoleIcon("sh")).toBe("❯");

    // ⌕ ast_search/ast-search
    expect(getToolRoleIcon("ast_search")).toBe("⌕");
    expect(getToolRoleIcon("ast-search")).toBe("⌕");

    // ⌕ web_search
    expect(getToolRoleIcon("web_search")).toBe("⌕");
    // ⇲ web_fetch
    expect(getToolRoleIcon("web_fetch")).toBe("⇲");
    // ☷ outline
    expect(getToolRoleIcon("outline")).toBe("☷");
    // ⚡ session
    expect(getToolRoleIcon("session")).toBe("⚡");

    expect(isStructuralTool("read")).toBe(true);
    expect(isStructuralTool("edit")).toBe(true);
    expect(isStructuralTool("shell")).toBe(true);
    expect(isStructuralTool("ast_search")).toBe(true);
    expect(isStructuralTool("revert_file")).toBe(true);
    expect(isStructuralTool("web_search")).toBe(true);
    expect(isStructuralTool("web_fetch")).toBe(true);
    expect(isStructuralTool("outline")).toBe(true);
    expect(isStructuralTool("session")).toBe(true);
    expect(isStructuralTool("unknown_tool")).toBe(false);
  });

  it("tracks consecutive structural tools and groups them", () => {
    // 1st tool: read (standalone initially)
    const t1 = tracker.recordToolStart("call_1", "read");
    expect(t1.isGrouped).toBe(false);
    expect(t1.isFirst).toBe(true);
    expect(t1.prefix).toBe("◫ ");

    // 2nd tool: grep (consecutive structural -> grouped with ├, and retrofits 1st tool to ┌)
    const t2 = tracker.recordToolStart("call_2", "grep");
    expect(t2.isGrouped).toBe(true);
    expect(t2.prefix).toBe("├ ◫ ");

    // Verify retro-fitted 1st tool
    const retroT1 = tracker.getInfo("call_1");
    expect(retroT1?.isGrouped).toBe(true);
    expect(retroT1?.isFirst).toBe(true);
    expect(retroT1?.prefix).toBe("┌ ◫ ");

    // 3rd tool: edit (consecutive structural -> grouped with ├)
    const t3 = tracker.recordToolStart("call_3", "edit");
    expect(t3.isGrouped).toBe(true);
    expect(t3.prefix).toBe("├ ✎ ");

    // End 3rd tool as last in turn -> updates to └
    const ended = tracker.recordToolEnd("call_3", true);
    expect(ended?.isLast).toBe(true);
    expect(ended?.prefix).toBe("└ ✎ ");
  });

  it("resets consecutive grouping on non-structural tool", () => {
    tracker.recordToolStart("c1", "read");
    tracker.recordToolStart("c2", "grep"); // grouped

    // Non-structural tool
    const nonStruct = tracker.recordToolStart("c3", "custom_tool");
    expect(nonStruct.isGrouped).toBe(false);

    // Following structural tool starts fresh
    const nextStruct = tracker.recordToolStart("c4", "edit");
    expect(nextStruct.isGrouped).toBe(false);
    expect(nextStruct.prefix).toBe("✎ ");
  });

  it("formats headers with correct tree glyphs", () => {
    expect(tracker.formatHeader("read", "read file.ts", false, false)).toBe("◫ read file.ts");
    expect(tracker.formatHeader("edit", "edit file.ts", true, false)).toBe("├ ✎ edit file.ts");
    expect(tracker.formatHeader("shell", "sh cargo test", true, true)).toBe("└ ❯ sh cargo test");
  });

  it("executes executeBasicToolGroupingOp single and ops[] batch", async () => {
    // Single
    const res1 = await executeBasicToolGroupingOp("call_1", {
      toolName: "edit",
      callText: "edit src/index.ts",
      isGrouped: true,
      isLast: false,
    });
    expect(res1.isError).toBe(false);
    expect(res1.content[0].text).toBe("├ ✎ edit src/index.ts");
    expect(res1.details.isStructural).toBe(true);

    // Batch ops
    const resOps = await executeBasicToolGroupingOp("call_ops", {
      ops: [
        { toolName: "read", isGrouped: false },
        { toolName: "write", isGrouped: true, isLast: true },
      ],
    });
    expect(resOps.isError).toBe(false);
    expect(resOps.details.totalOps).toBe(2);
    expect(resOps.content[0].text).toContain("◫ read");
    expect(resOps.content[0].text).toContain("└ ✎ write");
  });

  it("registers hooks and overrides in registerBasicToolGrouping", () => {
    const hooks: Record<string, Function[]> = {};
    const mockPi = {
      on(event: string, fn: Function) {
        hooks[event] = hooks[event] || [];
        hooks[event].push(fn);
      },
    };

    registerBasicToolGrouping(mockPi as any, tracker);

    expect(hooks["turn_start"]).toBeDefined();
    expect(hooks["tool_execution_start"]).toBeDefined();
    expect(hooks["tool_execution_end"]).toBeDefined();
    expect(hooks["turn_end"]).toBeDefined();

    // Check that overrides were registered for structural tools
    const readOverride = getToolDefinitionOverride("read");
    expect(readOverride).toBeDefined();
    expect(typeof readOverride.renderCall).toBe("function");

    const mockTheme = { fg: (_c: string, t: string) => t };
    const rendered = readOverride.renderCall({ path: "src/foo.ts", offset: 1, limit: 10 }, mockTheme, {});
    expect(rendered.text).toContain("◫ read (src/foo.ts) [1-10]");

    // Check sh override with ❯
    const shOverride = getToolDefinitionOverride("sh");
    expect(shOverride).toBeDefined();
    const shRendered = shOverride.renderCall({ command: "git status" }, mockTheme, { isError: false });
    expect(shRendered.text).toContain("❯ git status");

    // Check basic-tools override
    const btOverride = getToolDefinitionOverride("basic-tools");
    expect(btOverride).toBeDefined();
    expect(typeof btOverride.renderCall).toBe("function");
    const btRendered = btOverride.renderCall(
      { ops: [{ type: "sh", command: "git status" }] },
      mockTheme,
      {}
    );
    expect(btRendered.text).toContain("⚙ basic-tools (sh git status)");
  });

  it("handles consecutive basic-tools grouping", () => {
    const t1 = tracker.recordToolStart("c_bt1", "basic-tools");
    expect(t1.isGrouped).toBe(false);
    expect(t1.prefix).toBe("⚙ ");

    const t2 = tracker.recordToolStart("c_bt2", "basic-tools");
    expect(t2.isGrouped).toBe(true);
    expect(t2.prefix).toBe("├ ⚙ ");

    const retroT1 = tracker.getInfo("c_bt1");
    expect(retroT1?.isGrouped).toBe(true);
    expect(retroT1?.prefix).toBe("┌ ⚙ ");
  });
});
