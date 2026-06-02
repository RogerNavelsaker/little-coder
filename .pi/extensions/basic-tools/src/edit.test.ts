import { describe, test, expect, beforeEach, afterAll } from "bun:test";
import { writeFileSync, readFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Use PATH-resolved linehash (flox-provided) — no hardcoded paths
// LINEHASH_BIN env var can override for dev/test if needed

import { registerEditTool } from "./edit.js";
import { invokeTool, contentText, parseDetails, renderCollapsed, FIXTURE, CWD } from "./test-helpers.js";

const TEMP = join(tmpdir(), `pi-edit-test-${Date.now()}.txt`);
const TEMP2 = join(tmpdir(), `pi-edit-test2-${Date.now()}.txt`);

describe("edit tool", () => {
  beforeEach(() => {
    writeFileSync(TEMP, "line one: alpha\nline two: beta\nline three: gamma\n", "utf-8");
    writeFileSync(TEMP2, "other: delta\nother: epsilon\n", "utf-8");
  });

  afterAll(() => {
    try { unlinkSync(TEMP); } catch { /* ignore */ }
    try { unlinkSync(TEMP2); } catch { /* ignore */ }
  });

  test("single edit: file content changes, applied=true, linesChanged>0, diff in contentText", async () => {
    const { result } = await invokeTool(registerEditTool, {
      edits: [{ path: TEMP, old_text: "alpha", new_text: "ALPHA" }],
    });
    expect(contentText(result)).toContain("@@");
    const d = parseDetails(result);
    expect(d.applied).toBe(true);
    expect(d.dry_run).toBe(false);
    expect(d.linesChanged).toBeGreaterThan(0);
    expect(readFileSync(TEMP, "utf-8")).toContain("ALPHA");
  });

  test("dry run: file NOT modified, applied=false, dry_run=true, diff in contentText", async () => {
    const before = readFileSync(TEMP, "utf-8");
    const { result } = await invokeTool(registerEditTool, {
      edits: [{ path: TEMP, old_text: "beta", new_text: "BETA_REPLACED" }],
      dry_run: true,
    });
    const d = parseDetails(result);
    expect(d.applied).toBe(false);
    expect(d.dry_run).toBe(true);
    expect(contentText(result)).toContain("@@");
    expect(readFileSync(TEMP, "utf-8")).toBe(before);
  });

  test("text not found: unchanged=true", async () => {
    const { result } = await invokeTool(registerEditTool, {
      edits: [{ path: TEMP, old_text: "THIS_DOES_NOT_EXIST_XYZ", new_text: "replaced" }],
    });
    const d = parseDetails(result);
    expect(d.unchanged).toBe(true);
  });

  test("renderCollapsed on applied single edit: contains 'edited'", async () => {
    const { result, tool } = await invokeTool(registerEditTool, {
      edits: [{ path: TEMP, old_text: "gamma", new_text: "GAMMA" }],
    });
    const collapsed = renderCollapsed(tool, result);
    expect(collapsed).toContain("edited");
  });

  test("same-file batch (multiple items same path): applies all, editResults[]", async () => {
    const { result } = await invokeTool(registerEditTool, {
      edits: [
        { path: TEMP, old_text: "alpha", new_text: "ALPHA" },
        { path: TEMP, old_text: "gamma", new_text: "GAMMA" },
      ],
    });
    const content = readFileSync(TEMP, "utf-8");
    expect(content).toContain("ALPHA");
    expect(content).toContain("GAMMA");
    expect(content).toContain("beta");
    const d = parseDetails(result);
    expect(d.applied).toBe(true);
    expect(Array.isArray(d.editResults)).toBe(true);
    expect(d.editResults.length).toBe(2);
    expect(d.editResults[0].applied).toBe(true);
    expect(d.editResults[1].applied).toBe(true);
    expect(contentText(result)).toContain("@@");
  });

  test("same-file batch partial match: editResults shows which applied", async () => {
    const { result } = await invokeTool(registerEditTool, {
      edits: [
        { path: TEMP, old_text: "alpha", new_text: "ALPHA" },
        { path: TEMP, old_text: "DOES_NOT_EXIST", new_text: "X" },
      ],
    });
    const d = parseDetails(result);
    expect(d.editResults[0].applied).toBe(true);
    expect(d.editResults[1].applied).toBe(false);
    expect(d.applied).toBe(true);
  });

  test("same-file batch collapsed: '2/2 edits applied'", async () => {
    const { result, tool } = await invokeTool(registerEditTool, {
      edits: [
        { path: TEMP, old_text: "alpha", new_text: "ALPHA" },
        { path: TEMP, old_text: "beta", new_text: "BETA" },
      ],
    });
    expect(renderCollapsed(tool, result)).toContain("2/2 edits applied");
  });

  test("multi-file edits: each file modified, details.files[]", async () => {
    const { result } = await invokeTool(registerEditTool, {
      edits: [
        { path: TEMP, old_text: "alpha", new_text: "ALPHA" },
        { path: TEMP2, old_text: "delta", new_text: "DELTA" },
      ],
    });
    expect(readFileSync(TEMP, "utf-8")).toContain("ALPHA");
    expect(readFileSync(TEMP2, "utf-8")).toContain("DELTA");
    const d = parseDetails(result);
    expect(Array.isArray(d.files)).toBe(true);
    expect(d.files.length).toBe(2);
    expect(d.files[0].applied).toBe(true);
    expect(d.files[1].applied).toBe(true);
  });

  test("fuzzy whitespace mismatch: succeeds when old_text has extra spaces", async () => {
    // TEMP has "line one: alpha" — try with extra spaces
    const { result } = await invokeTool(registerEditTool, {
      edits: [{ path: TEMP, old_text: "line   one:   alpha", new_text: "LINE ONE: ALPHA" }],
    });
    const d = parseDetails(result);
    // Fuzzy should normalize whitespace and find the match
    expect(d.applied).toBe(true);
    expect(readFileSync(TEMP, "utf-8")).toContain("LINE ONE: ALPHA");
  });

  test("fuzzy=false: strict match fails on whitespace mismatch", async () => {
    // TEMP has "line one: alpha" — try with extra spaces but fuzzy disabled
    const { result } = await invokeTool(registerEditTool, {
      edits: [{ path: TEMP, old_text: "line   one:   alpha", new_text: "LINE ONE: ALPHA" }],
      fuzzy: false,
    });
    const d = parseDetails(result);
    expect(d.unchanged).toBe(true);
    expect(d.applied).toBe(false);
  });

  test("diff output: no Index: header (linehash diff, not npm diff)", async () => {
    const { result } = await invokeTool(registerEditTool, {
      edits: [{ path: TEMP, old_text: "alpha", new_text: "ALPHA" }],
    });
    const text = contentText(result);
    expect(text).not.toContain("Index:");
  });

  test("diff output: no === header rows (linehash diff, not npm diff)", async () => {
    const { result } = await invokeTool(registerEditTool, {
      edits: [{ path: TEMP, old_text: "alpha", new_text: "ALPHA" }],
    });
    const text = contentText(result);
    // === header rows from npm diff's createPatch look like "=== file ==="
    // linehash diff produces "--- a/file" / "+++ b/file" instead
    const lines = text.split("\n");
    const hasEqHeader = lines.some(l => /^={3,}/.test(l.trim()));
    expect(hasEqHeader).toBe(false);
  });
});
