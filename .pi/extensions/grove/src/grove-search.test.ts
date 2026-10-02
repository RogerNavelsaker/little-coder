import { describe, expect, it } from "bun:test";
import { executeGroveSearchOp, registerGroveSearchTool } from "./grove-search.ts";

describe("grove/grove_search", () => {
  it("fails with missing query", () => {
    const res = executeGroveSearchOp({});
    expect(res.success).toBe(false);
    expect(res.error).toBe("Missing query");
  });

  it("searches across seeds and mulch", () => {
    const res = executeGroveSearchOp({ query: "web-tools" });
    expect(res.success).toBe(true);
    expect(res.query).toBe("web-tools");
    expect(res.output).toContain("Results");
  });

  it("registers grove_search tool with pi", () => {
    let registered: any = null;
    const mockPi: any = {
      registerTool: (tool: any) => {
        registered = tool;
      },
    };

    registerGroveSearchTool(mockPi);
    expect(registered).toBeDefined();
    expect(registered.name).toBe("grove_search");
    expect(typeof registered.execute).toBe("function");
  });
});
