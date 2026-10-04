import { describe, expect, it } from "bun:test";
import { computeOrientation, formatOrientationBlock } from "./orientation";

describe("orientation", () => {
  it("formats orientation block with elapsed time and git state", () => {
    const data = {
      elapsedIdleMs: 125_000,
      gitBranch: "main",
      gitCommit: "abc1234",
      gitDirtyCount: 2,
      gitDirtyFiles: ["M src/index.ts", "M package.json"],
    };

    const formatted = formatOrientationBlock(data);
    expect(formatted).toContain("[ORIENTATION]");
    expect(formatted).toContain("Idle Gap: 2m 5s elapsed");
    expect(formatted).toContain("Git: main @ abc1234");
    expect(formatted).toContain("2 uncommitted change(s)");
  });

  it("computes orientation against current working tree", () => {
    const now = Date.now();
    const result = computeOrientation(now - 75_000, process.cwd(), now);
    expect(result.elapsedIdleMs).toBe(75_000);
    expect(result.gitBranch).toBeDefined();
  });
});
