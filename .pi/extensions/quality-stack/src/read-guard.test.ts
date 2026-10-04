import { describe, expect, it } from "bun:test";
import { guardReadOutput } from "./read-guard";

describe("read-guard", () => {
  it("leaves normal size reads untouched", () => {
    const text = "Line 1\nLine 2\nLine 3";
    const res = guardReadOutput(text, { maxLines: 10, maxChars: 100 });
    expect(res.truncated).toBe(false);
    expect(res.text).toBe(text);
  });

  it("truncates reads exceeding bounds, spools to disk overflow, and provides search/sub-agent options", () => {
    const bigContent = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`).join("\n");
    const res = guardReadOutput(bigContent, { maxLines: 50, maxChars: 5000 });
    expect(res.truncated).toBe(true);
    expect(res.spillPath).toBeDefined();
    expect(res.text).toContain("Context Cutoff Notice");
    expect(res.text).toContain("Full payload spooled to disk at:");
    expect(res.text).toContain("Search: run `rg '<pattern>'");
    expect(res.text).toContain("Sub-Agent: delegate summarization");
  });
});
