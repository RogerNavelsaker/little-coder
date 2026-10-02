import { describe, expect, it } from "bun:test";
import { executeDocOcrOp } from "./doc-ocr.ts";

describe("doc_ocr tool", () => {
  it("fails cleanly when image file is missing", () => {
    const res = executeDocOcrOp({ image: "/tmp/non-existent-image.png" });
    expect(res.success).toBe(false);
    expect(res.backend).toBe("error");
    expect(res.error).toBeDefined();
  });

  it("handles missing image parameter", () => {
    const res = executeDocOcrOp({});
    expect(res.success).toBe(false);
    expect(res.error).toContain("Missing image path");
  });
});
