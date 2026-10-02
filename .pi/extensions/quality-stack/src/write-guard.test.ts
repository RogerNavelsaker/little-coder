import { describe, expect, it } from "bun:test";
import { checkWritePath } from "./write-guard";
import { join } from "node:path";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";

describe("write-guard", () => {
  it("blocks Windows/DOS reserved filenames", () => {
    const res1 = checkWritePath("con.txt");
    expect(res1.allowed).toBe(false);
    expect(res1.reason).toContain("Blocked reserved device filename");

    const res2 = checkWritePath("aux.js");
    expect(res2.allowed).toBe(false);

    const res3 = checkWritePath("NUL");
    expect(res3.allowed).toBe(false);
  });

  it("blocks directory/root overwrites", () => {
    const res = checkWritePath("/");
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("Cannot overwrite root directory");
  });

  it("blocks overwriting existing files when allowOverwrite is false, suggesting edit", () => {
    const testFile = join(tmpdir(), `wg-test-${Date.now()}.txt`);
    writeFileSync(testFile, "initial content", "utf-8");

    try {
      const check = checkWritePath(testFile, tmpdir(), true, false);
      expect(check.allowed).toBe(false);
      expect(check.suggestEdit).toBe(true);
      expect(check.reason).toContain("already exists");
      expect(check.reason).toContain("Use 'edit'");

      // Allowed when allowOverwrite is true
      const checkAllowed = checkWritePath(testFile, tmpdir(), true, true);
      expect(checkAllowed.allowed).toBe(true);
    } finally {
      unlinkSync(testFile);
    }
  });

  it("allows creating new files", () => {
    const newFile = join(tmpdir(), `nonexistent-${Date.now()}.ts`);
    const check = checkWritePath(newFile, tmpdir(), true, false);
    expect(check.allowed).toBe(true);
  });
});
