import { describe, expect, it } from "bun:test";
import { executeWebControlOp, registerWebControlTool, resolveFirefoxBinary } from "./web-control.ts";

describe("web-tools/web_control", () => {
  it("resolves firefox binary from env or args", () => {
    expect(resolveFirefoxBinary("/custom/firefox")).toBe("/custom/firefox");
  });

  it("handles missing url on open", () => {
    const res = executeWebControlOp({ op: "open" });
    expect(res.success).toBe(false);
    expect(res.error).toBe("Missing URL");
  });

  it("handles missing tabId on snap", () => {
    const res = executeWebControlOp({ op: "snap" });
    expect(res.success).toBe(false);
    expect(res.error).toBe("Missing tabId");
  });

  it("handles missing params on click", () => {
    const res = executeWebControlOp({ op: "click", tabId: "123" });
    expect(res.success).toBe(false);
    expect(res.error).toBe("Missing params");
  });

  it("registers web_control tool with pi when BROWSER_CLI_ENABLED is set", () => {
    let registered: any = null;
    const mockPi: any = {
      registerTool: (tool: any) => {
        registered = tool;
      },
    };

    // Unset: should not register
    const origEnv = process.env.BROWSER_CLI_ENABLED;
    delete process.env.BROWSER_CLI_ENABLED;
    registerWebControlTool(mockPi);
    expect(registered).toBeNull();

    // Set: registers tool
    process.env.BROWSER_CLI_ENABLED = "1";
    registerWebControlTool(mockPi);
    expect(registered).toBeDefined();
    expect(registered.name).toBe("web_control");
    expect(typeof registered.execute).toBe("function");

    if (origEnv !== undefined) {
      process.env.BROWSER_CLI_ENABLED = origEnv;
    } else {
      delete process.env.BROWSER_CLI_ENABLED;
    }
  });
});
