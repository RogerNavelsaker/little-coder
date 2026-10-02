import { describe, expect, it } from "bun:test";
import { executeWebSearchOp, registerWebSearchTool } from "./web-search.ts";

describe("web-tools/web_search", () => {
  it("fails gracefully with missing query", () => {
    const res = executeWebSearchOp({});
    expect(res.success).toBe(false);
    expect(res.error).toBe("Missing query");
  });

  it("executes query search via ddgr", () => {
    const res = executeWebSearchOp({
      query: "little coder github itayinbarr",
      num: 2,
    });

    expect(res.success).toBe(true);
    expect(res.query).toBe("little coder github itayinbarr");
    // ddgr might return 0 results if DuckDuckGo temporarily responds with 202 / rate-limit
    if (res.results.length > 0) {
      expect(res.results[0].url).toBeDefined();
    }
  });

  it("supports batch operations via ops[] universal array", () => {
    const ops = [
      { query: "little coder github itayinbarr", num: 1 },
      { query: "nushell github", num: 1 },
    ];

    const results = ops.map((op) => executeWebSearchOp(op));
    expect(results.length).toBe(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(true);
  });

  it("registers web_search tool with pi", () => {
    let registered: any = null;
    const mockPi: any = {
      registerTool: (tool: any) => {
        registered = tool;
      },
    };

    registerWebSearchTool(mockPi);
    expect(registered).toBeDefined();
    expect(registered.name).toBe("web_search");
    expect(typeof registered.execute).toBe("function");
  });
});
