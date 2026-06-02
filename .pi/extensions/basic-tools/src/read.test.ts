import { describe, test, expect } from "bun:test";
import { registerReadTool } from "./read.js";
import { invokeTool, contentText, renderCollapsed, FIXTURE, CWD } from "./test-helpers.js";

describe("read tool", () => {
  test("single read: files:[{path}] — content has line records, details has truncation", async () => {
    const { result } = await invokeTool(registerReadTool, { files: [{ path: FIXTURE }] });
    expect(contentText(result)).toBeDefined();
    const d = result.details;
    expect(d.files[0].totalLines).toBe(186);
    expect(d.files[0].returnedLines).toBe(186);
    expect(d.files[0].truncated).toBe(false);
  });

  test("truncated read: files:[{path, limit:5}] — truncated=true, returnedLines=5", async () => {
    const { result } = await invokeTool(registerReadTool, { files: [{ path: FIXTURE, limit: 5 }] });
    const d = result.details;
    expect(d.files[0].truncated).toBe(true);
    expect(d.files[0].returnedLines).toBe(5);
    expect(contentText(result)).toContain("{line,anchor,text}");
  });

  test("offset read: files:[{path, offset:3, limit:3}] — 3 lines returned", async () => {
    const { result } = await invokeTool(registerReadTool, { files: [{ path: FIXTURE, offset: 3, limit: 3 }] });
    expect(result.details.files[0].returnedLines).toBe(3);
  });

  test("file not found: isError=true, contentText contains 'not found'", async () => {
    const { result } = await invokeTool(registerReadTool, {
      files: [{ path: "/nonexistent/path/file.md" }],
    });
    expect(contentText(result)).toContain("not found");
  });

  test("multi-file read: TOON sections per file, details.totalFiles=2", async () => {
    const { result, tool } = await invokeTool(registerReadTool, {
      files: [
        { path: FIXTURE, limit: 3 },
        { path: CWD + "/src/ls.ts", limit: 3 },
      ],
    });
    const ct = contentText(result);
    expect(ct).toContain("read:");
    expect(ct).toContain("{line,anchor,text}");
    const d = result.details;
    expect(d.totalFiles).toBe(2);
    expect(Array.isArray(d.files)).toBe(true);
    expect(d.files.length).toBe(2);
    expect(d.files[0].returnedLines).toBe(3);
    expect(d.files[0].truncated).toBe(true);
  });

  test("multi-file renderCollapsed: '2 files read'", async () => {
    const { result, tool } = await invokeTool(registerReadTool, {
      files: [
        { path: FIXTURE, limit: 2 },
        { path: CWD + "/src/grep.ts", limit: 2 },
      ],
    });
    expect(renderCollapsed(tool, result)).toContain("2 files read");
  });
});
