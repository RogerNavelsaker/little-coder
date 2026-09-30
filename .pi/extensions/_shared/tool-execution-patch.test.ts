import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import { ToolExecutionComponent, initTheme } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import {
  registerToolDefinitionOverride,
  getToolDefinitionOverride,
  clearToolDefinitionOverrides,
  patchToolExecutionComponent,
} from "./tool-execution-patch.js";

describe("tool-execution-patch", () => {
  beforeAll(() => {
    initTheme();
  });
  beforeEach(() => {
    clearToolDefinitionOverrides();
    patchToolExecutionComponent();
  });

  it("suppresses leading blank line when suppressLeadingSpacer is true", () => {
    const comp = new ToolExecutionComponent(
      "test_tool",
      "call_1",
      {},
      {},
      {
        renderCall: () => new Text("Running test_tool", 0, 0),
      } as any,
      { requestRender: () => {} } as any,
      process.cwd()
    );

    // Default unsuppressed: starts with blank line from Spacer(1)
    const normalLines = comp.render(80);
    expect(normalLines.length).toBeGreaterThan(0);
    expect(normalLines[0]).toBe("");

    // With suppressLeadingSpacer: leading blank line is removed
    (comp as any).suppressLeadingSpacer = true;
    const suppressedLines = comp.render(80);
    expect(suppressedLines.length).toBeGreaterThan(0);
    expect(suppressedLines[0]).not.toBe("");
  });

  it("suppresses leading blank line when isGrouped is true", () => {
    const comp = new ToolExecutionComponent(
      "test_tool",
      "call_2",
      {},
      {},
      {
        renderCall: () => new Text("Running grouped tool", 0, 0),
      } as any,
      { requestRender: () => {} } as any,
      process.cwd()
    );

    (comp as any).isGrouped = true;
    const lines = comp.render(80);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]).not.toBe("");
  });

  it("allows registerToolDefinitionOverride for third-party rendering", () => {
    registerToolDefinitionOverride("custom_tool", {
      renderCall: () => new Text("OVERRIDDEN CALL", 0, 0),
      renderResult: () => new Text("OVERRIDDEN RESULT", 0, 0),
    });

    expect(getToolDefinitionOverride("custom_tool")).toBeDefined();

    const comp = new ToolExecutionComponent(
      "custom_tool",
      "call_3",
      {},
      {},
      undefined,
      { requestRender: () => {} } as any,
      process.cwd()
    );

    const callRenderer = comp.getCallRenderer();
    expect(callRenderer).toBeDefined();
    const rendered = callRenderer?.({}, {}, {});
    expect((rendered as any)?.text).toBe("OVERRIDDEN CALL");
  });
});
