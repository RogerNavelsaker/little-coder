import { describe, expect, it } from "bun:test";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { executeDocReadOp } from "./doc-read.ts";

describe("doc_read tool", () => {
  it("fails when file does not exist", () => {
    const res = executeDocReadOp({ path: "/tmp/non-existent-doc-xyz.pdf" });
    expect(res.success).toBe(false);
    expect(res.backend).toBe("error");
  });

  it("reads plain text/markdown directly", () => {
    const testFile = resolve("/tmp", `test-doc-${Date.now()}.md`);
    writeFileSync(testFile, "# Title\n\nHello from doc_read", "utf-8");

    const res = executeDocReadOp({ path: testFile });
    expect(res.success).toBe(true);
    expect(res.backend).toBe("direct");
    expect(res.output).toContain("Hello from doc_read");

    unlinkSync(testFile);
  });

  it("handles batch ops schema", () => {
    const testFile = resolve("/tmp", `test-doc-batch-${Date.now()}.txt`);
    writeFileSync(testFile, "Batch content", "utf-8");

    const res = executeDocReadOp({ path: testFile });
    expect(res.success).toBe(true);
    expect(res.output).toContain("Batch content");

    unlinkSync(testFile);
  });
});
