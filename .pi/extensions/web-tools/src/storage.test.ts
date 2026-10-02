import { describe, expect, it } from "bun:test";
import { storeWebArtifact, slugify, INLINE_SIZE_THRESHOLD } from "./storage.ts";
import { existsSync, readFileSync, rmSync } from "node:fs";

describe("web-tools/storage", () => {
  it("slugifies URLs and titles nicely", () => {
    expect(slugify("https://example.com/foo/bar?q=1")).toBe("example.com-foo-bar-q-1");
    expect(slugify("Hello World & Special!")).toBe("Hello-World-Special");
  });

  it("inlines small content (<5KB)", () => {
    const small = "Hello world small artifact content";
    const res = storeWebArtifact(small, "test-small", "txt");
    expect(res.inline).toBe(true);
    expect(res.content).toBe(small);
    expect(res.filePath).toBeUndefined();
  });

  it("persists large content (>=5KB) to disk and returns file pointer", () => {
    const large = "A".repeat(INLINE_SIZE_THRESHOLD + 200);
    const res = storeWebArtifact(large, "test-large", "md", { target: "repo" });
    expect(res.inline).toBe(false);
    expect(res.filePath).toBeDefined();
    expect(existsSync(res.filePath!)).toBe(true);
    expect(readFileSync(res.filePath!, "utf-8")).toBe(large);
    expect(res.content).toContain(res.filePath!);

    // Clean up
    if (res.filePath) {
      rmSync(res.filePath.split("/content.md")[0], { recursive: true, force: true });
    }
  });
});
