import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { recordEpisode, queryEpisodes } from "./episode-storage.ts";
import type { SessionSummaryPayload } from "./bridge.ts";

describe("episode-storage (Volition / Mini-Volition pattern)", () => {
  it("records episode checkpoints into both JSONL and SQLite", () => {
    const testDir = mkdtempSync(join(tmpdir(), "episodes-test-"));

    const payload: SessionSummaryPayload = {
      goal: "Implement authentication and session refresh",
      instructions: ["Adhere to gentle-coding"],
      discoveries: ["JWT rotation requires DB lock"],
      accomplished: ["Created auth endpoint", "Added unit tests"],
      nextSteps: ["Wire refresh token cookie"],
      relevantFiles: ["src/auth.ts", "src/auth.test.ts"],
    };

    const record = recordEpisode(payload, "/fake/workspace", {
      baseDir: testDir,
      gitBranch: "feat/auth",
      gitCommit: "c0ffee1",
      tokensScrubbed: 512,
    });

    expect(record.id).toBeDefined();
    expect(record.goal).toBe("Implement authentication and session refresh");

    // 1. Verify JSONL exists and contains entry
    const jsonlPath = join(testDir, "episodes.jsonl");
    expect(existsSync(jsonlPath)).toBe(true);
    const jsonlContent = readFileSync(jsonlPath, "utf-8");
    expect(jsonlContent).toContain("feat/auth");
    expect(jsonlContent).toContain("c0ffee1");
    expect(jsonlContent).toContain("Implement authentication and session refresh");

    // 2. Verify SQLite DB exists and is queryable
    const dbPath = join(testDir, "episodes.db");
    expect(existsSync(dbPath)).toBe(true);

    const queried = queryEpisodes("/fake/workspace", 10, testDir);
    expect(queried.length).toBe(1);
    expect(queried[0].id).toBe(record.id);
    expect(queried[0].gitBranch).toBe("feat/auth");
    expect(queried[0].accomplished).toContain("Created auth endpoint");
    expect(queried[0].relevantFiles).toContain("src/auth.ts");

    rmSync(testDir, { recursive: true, force: true });
  });
});
