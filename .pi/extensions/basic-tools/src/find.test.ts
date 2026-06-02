import { describe, test, expect } from "bun:test";
import { registerFindTool } from "./find.js";
import { invokeTool, contentText, FIXTURE, CWD } from "./test-helpers.js";

describe("find tool", () => {
  test('glob "*.ts" in src/: finds TypeScript files, details has totalEntries/returnedEntries/entries', async () => {
    const { result } = await invokeTool(registerFindTool, {
      pattern: "*.ts",
      path: `${CWD}/src`,
    });
    expect(contentText(result)).toBeDefined();
    const d = result.details;
    expect(d.totalEntries).toBeGreaterThan(0);
    expect(d.returnedEntries).toBe(d.totalEntries);
    expect(d.truncated).toBe(false);
    expect(Array.isArray(d.entries)).toBe(true);
  });

  test("limit: details.truncated=true when limit < total", async () => {
    const { result } = await invokeTool(registerFindTool, {
      pattern: "*.ts",
      path: `${CWD}/src`,
      limit: 2,
    });
    const d = result.details;
    expect(d.returnedEntries).toBe(2);
    expect(d.truncated).toBe(true);
  });

  test("missing path: result.isError=true", async () => {
    const { result } = await invokeTool(registerFindTool, {
      pattern: "*.ts",
      path: "/nonexistent/path",
    });
    expect(result.isError).toBe(true);
    expect(result.details.errorType).toBe("not-found");
  });
});
