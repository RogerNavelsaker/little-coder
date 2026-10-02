import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { storeDocArtifact, INLINE_SIZE_THRESHOLD } from "./storage.ts";

describe("docs-tools storage", () => {
  it("returns content inline if under 5KB", () => {
    const smallText = "Hello world";
    const res = storeDocArtifact(smallText, "sample.txt");
    expect(res.inline).toBe(true);
    expect(res.content).toBe(smallText);
    expect(res.filePath).toBeUndefined();
  });

  it("persists content to .pi/docs if >= 5KB", () => {
    const largeText = "A".repeat(INLINE_SIZE_THRESHOLD + 100);
    const res = storeDocArtifact(largeText, "test-large.pdf", "md");
    expect(res.inline).toBe(false);
    expect(res.filePath).toBeDefined();
    expect(existsSync(res.filePath!)).toBe(true);
    expect(readFileSync(res.filePath!, "utf-8")).toBe(largeText);

    // Clean up
    if (res.filePath) {
      const parentDir = resolve(res.filePath, "..");
      rmSync(parentDir, { recursive: true, force: true });
    }
  });
});
