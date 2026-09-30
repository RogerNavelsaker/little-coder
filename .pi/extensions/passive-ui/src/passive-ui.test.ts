import { describe, it, expect, beforeAll } from "bun:test";
import { initTheme } from "@earendil-works/pi-coding-agent";
import {
  registerPassiveUi,
  executePassiveUiOp,
} from "./passive-ui.js";

describe("passive-ui integration", () => {
  beforeAll(() => {
    try {
      initTheme();
    } catch {
      // ignore
    }
  });

  const mockTheme = {
    fg: (_c: string, t: string) => t,
    bold: (t: string) => t,
  };

  it("registers passive_ui tool and hooks", () => {
    let registeredTool: any = null;
    const hooks: Record<string, Function[]> = {};

    const mockPi = {
      registerTool(tool: any) {
        registeredTool = tool;
      },
      on(event: string, fn: Function) {
        hooks[event] = hooks[event] || [];
        hooks[event].push(fn);
      },
    };

    registerPassiveUi(mockPi as any);

    expect(registeredTool).toBeDefined();
    expect(registeredTool.name).toBe("passive_ui");
    expect(hooks["turn_start"]).toBeDefined();
    expect(hooks["tool_execution_start"]).toBeDefined();

    const callText = registeredTool.renderCall({ action: "status" }, mockTheme);
    expect(callText.text).toContain("passive_ui");
    expect(callText.text).toContain("status");

    const resText = registeredTool.renderResult(
      { details: { toolGrouping: "enabled", thinkingSteps: "enabled" } },
      { expanded: false },
      mockTheme
    );
    expect(resText.text).toContain("Passive UI");
  });

  it("executes executePassiveUiOp status, enable, disable, and ops[]", async () => {
    // Status
    const resStatus = await executePassiveUiOp("call_status", { action: "status" });
    expect(resStatus.isError).toBe(false);
    expect(resStatus.details.toolGrouping).toBe("enabled");

    // Enable
    const resEnable = await executePassiveUiOp("call_enable", { action: "enable" });
    expect(resEnable.isError).toBe(false);

    // Disable
    const resDisable = await executePassiveUiOp("call_disable", { action: "disable" });
    expect(resDisable.isError).toBe(false);

    // Ops array
    const resOps = await executePassiveUiOp("call_ops", {
      ops: [
        { action: "status" },
        { action: "enable" },
      ],
    });
    expect(resOps.isError).toBe(false);
    expect(resOps.details.totalOps).toBe(2);
  });
});
