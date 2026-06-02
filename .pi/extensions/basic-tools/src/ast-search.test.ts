import { describe, test, expect } from "bun:test";
import { registerAstSearchTool } from "./ast-search.js";
import { invokeTool, contentText, renderCollapsed, CWD } from "./test-helpers.js";

describe("ast_search tool", () => {
  test("search for TypeScript function pattern: finds matches with structured details", async () => {
    const { result } = await invokeTool(registerAstSearchTool, {
      pattern: "function",
      path: `${CWD}/src/read.ts`,
    });
    expect(contentText(result)).toBeDefined();
    const d = result.details as Record<string, unknown>;
    expect(d.totalMatches).toBeDefined();
    expect(typeof d.totalMatches).toBe("number");
    expect((d.totalMatches as number)).toBeGreaterThan(0);
    expect(d.returnedMatches).toBeDefined();
    expect(d.query).toBe("function");
    const matches = d.matches as Array<{ file: string; anchor: string }>;
    expect(Array.isArray(matches)).toBe(true);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].file).toContain("read.ts");
  });

  test("language filter (language:'typescript'): works, renderCollapsed shows match count", async () => {
    const { tool, result } = await invokeTool(registerAstSearchTool, {
      pattern: "function",
      path: `${CWD}/src`,
      language: "typescript",
    });
    const d = result.details as Record<string, unknown>;
    expect(d.totalMatches).toBeDefined();
    expect((d.totalMatches as number)).toBeGreaterThan(0);
    expect(d.language).toBe("typescript");
    const collapsed = renderCollapsed(tool, result);
    expect(collapsed).toContain("function");
  });

  test("missing path: result.isError=true", async () => {
    const { result } = await invokeTool(registerAstSearchTool, {
      pattern: "function",
      path: "/nonexistent/path",
    });
    expect(result.isError).toBe(true);
    expect(result.details.errorType).toBe("not-found");
  });
});
