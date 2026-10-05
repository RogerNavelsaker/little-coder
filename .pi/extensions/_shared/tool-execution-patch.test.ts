import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import { ToolExecutionComponent, FooterComponent, initTheme } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import {
  registerToolDefinitionOverride,
  getToolDefinitionOverride,
  clearToolDefinitionOverrides,
  patchToolExecutionComponent,
  patchFooterComponent,
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

  it("formats single-line colored statusline with Codex data segments", () => {
    patchFooterComponent();
    const fakeSession = {
      state: {
        model: { id: "gpt-6-luna", provider: "openai-codex" },
        thinkingLevel: "low",
      },
      sessionManager: {
        getEntries: () => [
          { type: "message", message: { role: "assistant", usage: { input: 12000, output: 800, cacheRead: 50000, cacheWrite: 0, cost: { total: 0.005 } } } },
        ],
        getCwd: () => "/home/rona/Repositories/RogerNavelsaker/nix-repos",
        getSessionName: () => undefined,
      },
      getContextUsage: () => ({ percent: 25.5, contextWindow: 200000 }),
      modelRegistry: { isUsingOAuth: () => true },
    };

    const fakeFooterData = {
      getGitBranch: () => "main",
      getAvailableProviderCount: () => 1,
      getExtensionStatuses: () => new Map([["agent-status", "idle"]]),
    };

    const footer = Object.create(FooterComponent.prototype);
    footer.session = fakeSession;
    footer.footerData = fakeFooterData;
    footer.autoCompactEnabled = true;

    const lines = footer.render(140);
    expect(lines.length).toBe(1);
    const line = lines[0];
    expect(line).toContain("nix-repos (main)");
    expect(line).toContain("gpt-6-luna (openai-codex) • low");
    expect(line).toContain("Context 25.5%/200k (auto)");
    // Default minimal statusline does not clutter with tokens/cost on normal terminal widths
    expect(line).not.toContain("↑12k");

    // With detailed statusline enabled (e.g. via /quickinfo):
    const { toggleDetailedStatusline } = require("./tool-execution-patch.js");
    toggleDetailedStatusline(true);
    const detailedLines = footer.render(160);
    toggleDetailedStatusline(false);
    expect(detailedLines[0]).toContain("↑12k ↓800 R50k");
    expect(detailedLines[0]).toContain("$0.005 (sub)");
  });
});
