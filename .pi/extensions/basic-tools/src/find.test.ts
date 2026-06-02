import { describe, test, expect } from "bun:test";
import { registerFindTool } from "./find.js";
import { invokeTool, contentText } from "./test-helpers.js";
import { writeFileSync, unlinkSync, utimesSync, mkdirSync, renameSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Use the actual source directory for tests
const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = __dirname;

describe("find tool", () => {
  test('glob "*.ts" in src/: finds TypeScript files, details has totalEntries/returnedEntries/entries', async () => {
    const { result } = await invokeTool(registerFindTool, {
      pattern: "*.ts",
      path: SRC_DIR,
    }, SRC_DIR);
    expect(contentText(result)).toBeDefined();
    const d = result.details;
    expect(d.totalEntries).toBeGreaterThan(0);
    expect(d.returnedEntries).toBe(d.totalEntries);
    expect(d.truncated).toBe(false);
    expect(Array.isArray(d.entries)).toBe(true);
  });

  test("limit: details.truncated=true when limit < total", async () => {
    const { result } = await invokeTool(registerFindTool, {
      pattern: "*.ts",
      path: SRC_DIR,
      limit: 2,
    }, SRC_DIR);
    const d = result.details;
    expect(d.returnedEntries).toBe(2);
    expect(d.truncated).toBe(true);
  });

  test("missing path: result.isError=true", async () => {
    const { result } = await invokeTool(registerFindTool, {
      pattern: "*.ts",
      path: "/nonexistent/path",
    });
    expect(result.isError).toBe(true);
    expect(result.details.errorType).toBe("not-found");
  });

  test("sortBy=mtime: entries ordered by modification time (newest first)", async () => {
    const base = join(tmpdir(), `find-mtime-test-${Date.now()}`);
    mkdirSync(base, { recursive: true });
    const files = ["a.txt", "b.txt", "c.txt"].map((name) => join(base, name));
    files.forEach((f) => writeFileSync(f, "x", "utf-8"));
    // Set mtimes with 10s gaps: a oldest, c newest
    const baseTime = Date.now() - 30_000;
    utimesSync(files[0], new Date(baseTime), new Date(baseTime));
    utimesSync(files[1], new Date(baseTime + 10_000), new Date(baseTime + 10_000));
    utimesSync(files[2], new Date(baseTime + 20_000), new Date(baseTime + 20_000));
    try {
      const { result } = await invokeTool(registerFindTool, {
        op: "glob",
        path: base,
        sortBy: "mtime",
        limit: 3,
      }, SRC_DIR);
      const d = result.details;
      expect(d.op).toBe("glob");
      expect(d.sortBy).toBe("mtime");
      expect(d.returnedEntries).toBe(3);
      // Newest first: c (newest), b, a (oldest)
      const paths = d.entries.map((e: { path: string }) => e.path);
      expect(paths[0]).toContain("c.txt");
      expect(paths[1]).toContain("b.txt");
      expect(paths[2]).toContain("a.txt");
    } finally {
      files.forEach(unlinkSync);
      try { unlinkSync(base); } catch { /* ignore */ }
    }
  });

  test("recent: modifiedSince excludes files older than window", async () => {
    const tmpDir = join(tmpdir(), `find-recent-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    try {
      // Create a file and set its mtime to 2 days ago
      const oldFile = join(tmpDir, "old.txt");
      writeFileSync(oldFile, "old", "utf-8");
      const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000);
      utimesSync(oldFile, twoDaysAgo, twoDaysAgo);
      // Create a fresh file
      const newFile = join(tmpDir, "new.txt");
      writeFileSync(newFile, "new", "utf-8");
      const { result } = await invokeTool(registerFindTool, {
        op: "recent",
        path: tmpDir,
        modifiedSince: "1h",
      }, SRC_DIR);
      const d = result.details;
      expect(d.op).toBe("recent");
      expect(d.modifiedSince).toBe("1h");
      // Only the new file should be in results (old is >1h)
      const paths = d.entries.map((e: { path: string }) => e.path);
      expect(paths.some((p: string) => p.includes("new.txt"))).toBe(true);
      expect(paths.some((p: string) => p.includes("old.txt"))).toBe(false);
    } finally {
      try { unlinkSync(join(tmpdir(), `find-recent-${Date.now()}`, "old.txt")); } catch { /* ignore */ }
      try { unlinkSync(join(tmpdir(), `find-recent-${Date.now()}`, "new.txt")); } catch { /* ignore */ }
      try { unlinkSync(join(tmpdir(), `find-recent-${Date.now()}`)); } catch { /* ignore */ }
    }
  });

  test("sized: minSize excludes files under threshold", async () => {
    const tmpDir = join(tmpdir(), `find-sized-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    try {
      // Create 1KB file (under 10K min) and 100KB file (within 10K..1M)
      writeFileSync(join(tmpDir, "tiny.txt"), "x".repeat(1024), "utf-8");
      writeFileSync(join(tmpDir, "big.txt"), "x".repeat(100 * 1024), "utf-8");
      const { result } = await invokeTool(registerFindTool, {
        op: "sized",
        path: tmpDir,
        minSize: "10K",
        maxSize: "1M",
      }, SRC_DIR);
      const d = result.details;
      expect(d.op).toBe("sized");
      expect(d.minSize).toBe("10K");
      expect(d.maxSize).toBe("1M");
      const paths = d.entries.map((e: { path: string }) => e.path);
      // Only big.txt should match (tiny is 1KB < 10K)
      expect(paths.some((p: string) => p.includes("big.txt"))).toBe(true);
      expect(paths.some((p: string) => p.includes("tiny.txt"))).toBe(false);
      // All returned entries should be >= 10K
      for (const e of d.entries) {
        if (e.size !== undefined) {
          expect(e.size).toBeGreaterThanOrEqual(10 * 1024);
        }
      }
    } finally {
      try { unlinkSync(join(tmpDir, "tiny.txt")); } catch { /* ignore */ }
      try { unlinkSync(join(tmpDir, "big.txt")); } catch { /* ignore */ }
      try { unlinkSync(tmpDir); } catch { /* ignore */ }
    }
  });

  test("sized: lowercase size units normalized (5k → 5K)", async () => {
    const tmpDir = join(tmpdir(), `find-sized-unit-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    try {
      writeFileSync(join(tmpDir, "small.txt"), "x".repeat(3000), "utf-8");
      writeFileSync(join(tmpDir, "big.txt"), "x".repeat(20_000), "utf-8");
      const { result } = await invokeTool(registerFindTool, {
        op: "sized",
        path: tmpDir,
        minSize: "5k", // lowercase k
      }, SRC_DIR);
      const d = result.details;
      expect(d.op).toBe("sized");
      // small.txt (3KB) should be excluded, big.txt (20KB) included
      const paths = d.entries.map((e: { path: string }) => e.path);
      expect(paths.some((p: string) => p.includes("big.txt"))).toBe(true);
      expect(paths.some((p: string) => p.includes("small.txt"))).toBe(false);
    } finally {
      try { unlinkSync(join(tmpDir, "small.txt")); } catch { /* ignore */ }
      try { unlinkSync(join(tmpDir, "big.txt")); } catch { /* ignore */ }
      try { unlinkSync(tmpDir); } catch { /* ignore */ }
    }
  });
});
