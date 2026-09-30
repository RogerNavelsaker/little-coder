import { describe, it, expect } from "bun:test";
import { registerRecapTool } from "./recap.js";

describe("recap extension", () => {
  const mockTheme = {
    fg: (_c: string, t: string) => t,
    bold: (t: string) => t,
    italic: (t: string) => `_italic_${t}_italic_`,
  };

  it("registers tool with correct name and schema", () => {
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

    registerRecapTool(mockPi as any);

    expect(registeredTool).toBeDefined();
    expect(registeredTool.name).toBe("recap");
    expect(registeredTool.parameters.properties.message).toBeDefined();
    expect(hooks["before_agent_start"]).toBeDefined();
  });

  it("executes returning the message in content and details", async () => {
    let registeredTool: any = null;
    const mockPi = {
      registerTool(tool: any) {
        registeredTool = tool;
      },
      on() {},
    };

    registerRecapTool(mockPi as any);

    const result = await registeredTool.execute("call_1", {
      message: "Refactoring auth module",
    });

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toBe("Refactoring auth module");
    expect(result.details.message).toBe("Refactoring auth module");
  });

  it("renders call with italic styling", () => {
    let registeredTool: any = null;
    const mockPi = {
      registerTool(tool: any) {
        registeredTool = tool;
      },
      on() {},
    };

    registerRecapTool(mockPi as any);

    const text = registeredTool.renderCall({ message: "Phase 2 starting" }, mockTheme);
    expect(text.text).toContain("recap");
    expect(text.text).toContain("_italic_\"Phase 2 starting\"_italic_");
  });

  it("renders result with prefix and italic message", () => {
    let registeredTool: any = null;
    const mockPi = {
      registerTool(tool: any) {
        registeredTool = tool;
      },
      on() {},
    };

    registerRecapTool(mockPi as any);

    const text = registeredTool.renderResult(
      { details: { message: "Phase 2 complete" } },
      { expanded: false },
      mockTheme
    );
    expect(text.text).toContain("💬");
    expect(text.text).toContain("_italic_Phase 2 complete_italic_");
  });

  it("before_agent_start hook appends narration discipline to systemPrompt", async () => {
    const hooks: Record<string, Function[]> = {};
    const mockPi = {
      registerTool() {},
      on(event: string, handler: Function) {
        hooks[event] = hooks[event] || [];
        hooks[event].push(handler);
      },
    };

    registerRecapTool(mockPi as any);

    const handler = hooks["before_agent_start"][0];
    const res = await handler({ systemPrompt: "Original prompt" });
    expect(res.systemPrompt).toContain("Original prompt");
    expect(res.systemPrompt).toContain("[Narration Discipline]");
    expect(res.systemPrompt).toContain("recap");
  });
});
