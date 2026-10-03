import { describe, expect, it } from "bun:test";
import { getDualModelConfig, setDualModelConfig, registerModelRouteTool } from "./model-router";

describe("model-router (dual-model split)", () => {
  it("initializes with default config and allows updates", () => {
    setDualModelConfig({ planModel: "anthropic/claude-3-7-sonnet", actionModel: "lemonade-server/Qwen3.8-27B", activeRole: "action" });
    const cfg = getDualModelConfig();
    expect(cfg.planModel).toBe("anthropic/claude-3-7-sonnet");
    expect(cfg.actionModel).toBe("lemonade-server/Qwen3.8-27B");
    expect(cfg.activeRole).toBe("action");
  });

  it("registers model_route tool with schema", async () => {
    let registeredTool: any = null;
    const mockPi = {
      registerTool: (tool: any) => {
        registeredTool = tool;
      },
    };
    registerModelRouteTool(mockPi as any);
    expect(registeredTool).toBeDefined();
    expect(registeredTool.name).toBe("model_route");

    const res = await registeredTool.execute("call-1", { role: "plan", plan_model: "o3-mini" }, undefined, undefined, {});
    expect(res.content[0].text).toContain("role=plan");
    expect(res.details.config.planModel).toBe("o3-mini");
  });
});
