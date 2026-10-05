import { describe, expect, it } from "bun:test";
import {
  getTriModelConfig,
  setTriModelConfig,
  getDualModelConfig,
  registerModelRouteTool,
  normalizeRole,
} from "./model-router";

describe("model-router (tri-tier model split)", () => {
  it("normalizes roles and handles aliases", () => {
    expect(normalizeRole("voice")).toBe("voice");
    expect(normalizeRole("mind")).toBe("mind");
    expect(normalizeRole("hands")).toBe("hands");
    expect(normalizeRole("plan")).toBe("mind");
    expect(normalizeRole("action")).toBe("hands");
  });

  it("initializes with default config and allows updates", () => {
    setTriModelConfig({
      voiceModel: "google/gemini-2.5-flash",
      mindModel: "anthropic/claude-3-7-sonnet",
      handsModel: "lemonade-server/Qwen3.8-27B",
      activeRole: "hands",
    });
    const cfg = getTriModelConfig();
    expect(cfg.voiceModel).toBe("google/gemini-2.5-flash");
    expect(cfg.mindModel).toBe("anthropic/claude-3-7-sonnet");
    expect(cfg.handsModel).toBe("lemonade-server/Qwen3.8-27B");
    expect(cfg.activeRole).toBe("hands");

    // Backward compat check
    const dual = getDualModelConfig();
    expect(dual.planModel).toBe("anthropic/claude-3-7-sonnet");
    expect(dual.actionModel).toBe("lemonade-server/Qwen3.8-27B");
    expect(dual.activeRole).toBe("action");
  });

  it("registers model_route tool with schema supporting voice, mind, and hands", async () => {
    let registeredTool: any = null;
    const mockPi = {
      registerTool: (tool: any) => {
        registeredTool = tool;
      },
    };
    registerModelRouteTool(mockPi as any);
    expect(registeredTool).toBeDefined();
    expect(registeredTool.name).toBe("model_route");

    // Test tri-tier role switch to mind
    const resMind = await registeredTool.execute(
      "call-1",
      { role: "mind", mind_model: "o3-mini" },
      undefined,
      undefined,
      {},
    );
    expect(resMind.content[0].text).toContain("role=mind");
    expect(resMind.details.config.mindModel).toBe("o3-mini");

    // Test role switch to voice
    const resVoice = await registeredTool.execute(
      "call-2",
      { role: "voice", voice_model: "gemini-2.5-flash" },
      undefined,
      undefined,
      {},
    );
    expect(resVoice.content[0].text).toContain("role=voice");
    expect(resVoice.details.config.voiceModel).toBe("gemini-2.5-flash");

    // Test role switch to hands
    const resHands = await registeredTool.execute(
      "call-3",
      { role: "hands", hands_model: "qwen-2.5-coder-7b" },
      undefined,
      undefined,
      {},
    );
    expect(resHands.content[0].text).toContain("role=hands");
    expect(resHands.details.config.handsModel).toBe("qwen-2.5-coder-7b");
  });
});
