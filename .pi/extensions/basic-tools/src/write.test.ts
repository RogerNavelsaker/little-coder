import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { registerWriteTool } from "./write.js";
import { invokeTool, contentText, parseDetails, FIXTURE, CWD } from "./test-helpers.js";
import { writeFileSync, readFileSync, unlinkSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TEMP_DIR = join(tmpdir(), "pi-write-test");
const CREATE_FILE = join(TEMP_DIR, `create-${Date.now()}.txt`);
const OVERWRITE_FILE = join(TEMP_DIR, `overwrite-${Date.now()}.txt`);
const APPEND_FILE = join(TEMP_DIR, `append-${Date.now()}.txt`);
const MULTI_A = join(TEMP_DIR, `multi-a-${Date.now()}.txt`);
const MULTI_B = join(TEMP_DIR, `multi-b-${Date.now()}.txt`);

function setupFiles() {
  mkdirSync(TEMP_DIR, { recursive: true });
  writeFileSync(OVERWRITE_FILE, "original content\n", "utf-8");
  writeFileSync(APPEND_FILE, "first line\n", "utf-8");
}

describe("write tool", () => {
  beforeAll(() => { setupFiles(); });

  afterAll(() => {
    for (const f of [CREATE_FILE, OVERWRITE_FILE, APPEND_FILE, MULTI_A, MULTI_B]) {
      try { unlinkSync(f); } catch { /* ignore */ }
    }
  });

  test("single create: files:[{path, content}] — created=true, bytesWritten correct", async () => {
    const { result } = await invokeTool(registerWriteTool, {
      files: [{ path: CREATE_FILE, content: "hello from write tool\nline two\n", create_dirs: true }],
    });
    expect(contentText(result)).toBeDefined();
    const d = result.details as Record<string, unknown>;
    expect(d.created).toBe(true);
    expect(d.overwritten).toBe(false);
    expect(d.bytesWritten).toBeGreaterThan(0);
    expect(readFileSync(CREATE_FILE, "utf-8")).toContain("hello from write tool");
  });

  test("single overwrite: files:[{path, content, if_exists:'overwrite'}] — overwritten=true", async () => {
    const { result } = await invokeTool(registerWriteTool, {
      files: [{ path: OVERWRITE_FILE, content: "new content here\n", if_exists: "overwrite" }],
    });
    const d = result.details as Record<string, unknown>;
    expect(d.overwritten).toBe(true);
    expect(readFileSync(OVERWRITE_FILE, "utf-8")).toBe("new content here\n");
  });

  test("single append: files:[{path, content, if_exists:'append'}] — appended=true", async () => {
    const { result } = await invokeTool(registerWriteTool, {
      files: [{ path: APPEND_FILE, content: "appended line\n", if_exists: "append" }],
    });
    const d = result.details as Record<string, unknown>;
    expect(d.appended).toBe(true);
    const content = readFileSync(APPEND_FILE, "utf-8");
    expect(content).toContain("first line");
    expect(content).toContain("appended line");
  });

  test("if_exists:'error' on existing file: isError=true", async () => {
    const { result } = await invokeTool(registerWriteTool, {
      files: [{ path: OVERWRITE_FILE, content: "should fail", if_exists: "error" }],
    });
    expect(result.isError).toBe(true);
  });

  test("multi-file write: both files created, details.files[]", async () => {
    const { result } = await invokeTool(registerWriteTool, {
      files: [
        { path: MULTI_A, content: "file A content\n", create_dirs: true },
        { path: MULTI_B, content: "file B content\n", create_dirs: true },
      ],
    });
    expect(readFileSync(MULTI_A, "utf-8")).toBe("file A content\n");
    expect(readFileSync(MULTI_B, "utf-8")).toBe("file B content\n");
    const d = result.details as Record<string, unknown>;
    expect(Array.isArray(d.files)).toBe(true);
    expect((d.files as any[]).length).toBe(2);
  });

  test("diff output: no Index: header (linehash diff, not npm diff)", async () => {
    const { result } = await invokeTool(registerWriteTool, {
      files: [{ path: OVERWRITE_FILE, content: "new content\n" }],
    });
    const text = contentText(result);
    expect(text).not.toContain("Index:");
  });

  test("diff output: no === header rows (linehash diff, not npm diff)", async () => {
    const { result } = await invokeTool(registerWriteTool, {
      files: [{ path: OVERWRITE_FILE, content: "new content\n" }],
    });
    const text = contentText(result);
    const lines = text.split("\n");
    const hasEqHeader = lines.some(l => /^={3,}/.test(l.trim()));
    expect(hasEqHeader).toBe(false);
  });
});
