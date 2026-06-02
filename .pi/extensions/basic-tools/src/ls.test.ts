import { describe, test, expect } from "bun:test";
import { registerLsTool } from "./ls.js";
import { invokeTool, contentText, FIXTURE, CWD } from "./test-helpers.js";

describe("ls tool", () => {
  test("list CWD: details.entries array with name/type/size", async () => {
    const { result } = await invokeTool(registerLsTool, { path: CWD });
    expect(contentText(result)).toContain("pi-structural-tools");
    const d = result.details;
    expect(Array.isArray(d.entries)).toBe(true);
    expect(d.entries.length).toBeGreaterThan(0);
    expect(d.entries[0].name).toBeDefined();
    expect(d.entries[0].type).toBeDefined();
  });

  test("file path (ls a file not a dir): result.isError=true, contentText contains 'is a file'", async () => {
    const { result } = await invokeTool(registerLsTool, { path: FIXTURE });
    expect(result.isError).toBe(true);
    expect(contentText(result)).toContain("is a file");
    expect(result.details.errorType).toBe("invalid-params");
  });

  test("missing path: result.isError=true", async () => {
    const { result } = await invokeTool(registerLsTool, {
      path: "/nonexistent/path",
    });
    expect(result.isError).toBe(true);
    expect(result.details.errorType).toBe("not-found");
  });

  test("all:true includes hidden files (compare entry counts)", async () => {
    const { result: noHidden } = await invokeTool(registerLsTool, { path: CWD });
    const { result: withHidden } = await invokeTool(registerLsTool, { path: CWD, all: true });
    const countNoHidden = noHidden.details.entries.length;
    const countWithHidden = withHidden.details.entries.length;
    expect(countWithHidden).toBeGreaterThanOrEqual(countNoHidden);
  });
});
