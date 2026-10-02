import { describe, expect, it } from "bun:test";
import { executeWebFetchOp, registerWebFetchTool } from "./web-fetch.ts";

describe("web-tools/web_fetch", () => {
  it("fails when no URL is provided", () => {
    const res = executeWebFetchOp({});
    expect(res.success).toBe(false);
    expect(res.error).toBe("Missing URL");
  });

  it("fetches example.com successfully", () => {
    const res = executeWebFetchOp({
      url: "https://example.com",
      extract: "markdown",
    });

    expect(res.success).toBe(true);
    expect(res.output).toContain("documentation examples");
  });

  it("registers web_fetch tool with pi", () => {
    let registered: any = null;
    const mockPi: any = {
      registerTool: (tool: any) => {
        registered = tool;
      },
    };

    registerWebFetchTool(mockPi);
    expect(registered).toBeDefined();
    expect(registered.name).toBe("web_fetch");
    expect(typeof registered.execute).toBe("function");
  });
});
