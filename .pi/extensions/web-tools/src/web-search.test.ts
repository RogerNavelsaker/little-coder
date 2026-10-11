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

    expect(res.query).toBe("little coder github itayinbarr");
    // ddgr + DuckDuckGo are live external dependencies: ddgr may be absent
    // from PATH, and DDG may answer with a 202 challenge / rate-limit on
    // shared CI runner IPs (ddgr then exits non-zero). The contract under
    // test is that the op always returns a well-shaped result.
    if (res.success) {
      expect(res.results.length).toBeLessThanOrEqual(2);
      for (const r of res.results) {
        expect(r.url).toBeDefined();
      }
    } else {
      expect(res.error).toBeDefined();
    }
  });

  it("supports batch operations via ops[] universal array", () => {
    const ops = [
      { query: "little coder github itayinbarr", num: 1 },
      { query: "nushell github", num: 1 },
    ];

    const results = ops.map((op) => executeWebSearchOp(op));
    expect(results.length).toBe(2);
    // Same external-dependency caveat as above: search may legitimately
    // fail (ddgr missing or rate-limited), but every op must return a
    // well-shaped result.
    for (const res of results) {
      expect(Array.isArray(res.results)).toBe(true);
      if (res.success) {
        expect(res.error).toBeUndefined();
      }
    }
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
