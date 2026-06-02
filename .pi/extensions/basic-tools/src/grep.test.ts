import { describe, test, expect } from "bun:test";
import { registerGrepTool } from "./grep.js";
import { invokeTool, contentText, parseDetails, FIXTURE, CWD } from "./test-helpers.js";

describe("grep tool", () => {
  test("regex search for 'tool': contentText has match count, details has totalMatches>0, records with anchor fields", async () => {
    const { result } = await invokeTool(registerGrepTool, {
      pattern: "tool",
      path: FIXTURE,
    });
    expect(contentText(result)).toBeDefined();
    const d = result.details;
    expect(d.totalMatches).toBeGreaterThan(0);
    expect(d.returnedMatches).toBe(d.totalMatches);
    expect(d.truncated).toBe(false);
    expect(Array.isArray(d.matches)).toBe(true);
    expect(d.matches.length).toBeGreaterThan(0);
    expect(d.matches[0].line).toBeDefined();
    expect(d.matches[0].anchor).toBeDefined();
  });

  test("literal search (literal:true): works same as regex for literal string", async () => {
    const { result } = await invokeTool(registerGrepTool, {
      pattern: "tool",
      path: FIXTURE,
      literal: true,
    });
    const d = result.details;
    expect(d.totalMatches).toBeGreaterThan(0);
    expect(d.patternMode).toBe("literal");
  });

  test("case-insensitive (ignore_case:true): matches both cases", async () => {
    const { result } = await invokeTool(registerGrepTool, {
      pattern: "Phase",
      path: FIXTURE,
      ignore_case: true,
    });
    const d = result.details;
    expect(d.totalMatches).toBeGreaterThan(0);
  });

  test("limit:1: details.returnedMatches=1, details.totalMatches>1, details.truncated=true", async () => {
    const { result } = await invokeTool(registerGrepTool, {
      pattern: "tool",
      path: FIXTURE,
      limit: 1,
    });
    const d = result.details;
    expect(d.returnedMatches).toBe(1);
    expect(d.totalMatches).toBeGreaterThan(1);
    expect(d.truncated).toBe(true);
  });

  test("missing path: result.isError=true", async () => {
    const { result } = await invokeTool(registerGrepTool, {
      pattern: "test",
      path: "/nonexistent/path",
    });
    expect(result.isError).toBe(true);
    expect(result.details.errorType).toBe("not-found");
  });

  test("context:2: returns matches with context_before and context_after arrays", async () => {
    const { result } = await invokeTool(registerGrepTool, {
      pattern: "tool",
      path: FIXTURE,
      context: 2,
    });
    const d = result.details;
    expect(d.totalMatches).toBeGreaterThan(0);
    expect(d.matches[0].context_before).toBeDefined();
    expect(d.matches[0].context_after).toBeDefined();
    expect(Array.isArray(d.matches[0].context_before)).toBe(true);
    expect(Array.isArray(d.matches[0].context_after)).toBe(true);
  });

  test("glob:\"*.md\": only .md files matched", async () => {
    const { result } = await invokeTool(registerGrepTool, {
      pattern: "tool",
      path: FIXTURE,
      glob: "*.md",
    });
    const d = result.details;
    expect(d.totalMatches).toBeGreaterThanOrEqual(0);
    // All matched paths should end with .md
    for (const m of d.matches) {
      expect(m.path.endsWith('.md')).toBe(true);
    }
  });

  test("context:3: details.context=3 round-trips into result", async () => {
    const { result } = await invokeTool(registerGrepTool, {
      pattern: "tool",
      path: FIXTURE,
      context: 3,
    });
    const d = result.details;
    expect(d.context).toBe(3);
    expect(d.totalMatches).toBeGreaterThan(0);
  });
});
