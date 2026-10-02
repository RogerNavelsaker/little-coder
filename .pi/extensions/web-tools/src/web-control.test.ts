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

  it("registers web_control tool with pi", () => {
    let registered: any = null;
    const mockPi: any = {
      registerTool: (tool: any) => {
        registered = tool;
      },
    };

    registerWebControlTool(mockPi);
    expect(registered).toBeDefined();
    expect(registered.name).toBe("web_control");
    expect(typeof registered.execute).toBe("function");
  });
});
