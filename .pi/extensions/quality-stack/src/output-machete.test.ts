import { describe, expect, it } from "bun:test";
import { applyOutputMachete } from "./output-machete";

describe("output-machete", () => {
  it("leaves normal size shell output untouched", () => {
    const text = "Success: 5 tests passed\nAll checks ok.";
    const res = applyOutputMachete(text, { maxLines: 10, maxChars: 100, headLines: 2, tailLines: 2 });
    expect(res.truncated).toBe(false);
    expect(res.text).toBe(text);
  });

  it("truncates oversized outputs preserving head and tail lines with disk spillover", () => {
    const lines = Array.from({ length: 200 }, (_, i) => `Line ${i + 1}`);
    const bigText = lines.join("\n");
    const res = applyOutputMachete(bigText, {
      maxLines: 50,
      maxChars: 5000,
      headLines: 5,
      tailLines: 5,
    });

    expect(res.truncated).toBe(true);
    expect(res.spillPath).toBeDefined();
    expect(res.text).toContain("Line 1");
    expect(res.text).toContain("Line 5");
    expect(res.text).toContain("Line 196");
    expect(res.text).toContain("Line 200");
    expect(res.text).toContain("Output Machete: Truncated");
    expect(res.text).toContain("Full output spooled to:");
    expect(res.text).toContain("rg '<pattern>'");
  });
});
