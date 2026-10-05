import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  recordInFlightTurn,
  recordInFlightAction,
  clearInFlightAction,
  clearInFlightTurn,
  consumeGhostTurn,
  formatGhostRecoveryAlert,
  type InFlightTurn,
} from "./ghost-turn.ts";

describe("ghost-turn (Mini-Volition pattern)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "ghost-test-"));
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("records in-flight turn and actions, then consumes ghost on restart", () => {
    // 1. Record turn start
    recordInFlightTurn("turn_123", "Refactor authentication flow", tempDir, tempDir);

    // 2. Record tool execution
    recordInFlightAction("edit", { path: "src/auth.ts", new_text: "..." }, tempDir, tempDir);

    // Simulate crash: no clearInFlightTurn called.
    // 3. On restart / next session: consume ghost
    const ghost = consumeGhostTurn(tempDir, tempDir);
    expect(ghost).not.toBeNull();
    expect(ghost?.turnId).toBe("turn_123");
    expect(ghost?.promptSummary).toBe("Refactor authentication flow");
    expect(ghost?.activeAction?.toolName).toBe("edit");
    expect(ghost?.activeAction?.targetFile).toBe("src/auth.ts");

    // 4. Ghost file should now be consumed/cleared
    const secondCheck = consumeGhostTurn(tempDir, tempDir);
    expect(secondCheck).toBeNull();
  });

  it("clears ghost cleanly on normal turn completion", () => {
    recordInFlightTurn("turn_456", "Run test suite", tempDir, tempDir);
    recordInFlightAction("shell", { command: "bun test" }, tempDir, tempDir);
    clearInFlightAction(tempDir, tempDir);
    clearInFlightTurn(tempDir, tempDir);

    const ghost = consumeGhostTurn(tempDir, tempDir);
    expect(ghost).toBeNull();
  });

  it("formats informative recovery alert", () => {
    const ghost: InFlightTurn = {
      turnId: "turn_789",
      startedAt: Date.now() - 5000,
      cwd: tempDir,
      promptSummary: "Deploy microservice",
      activeAction: {
        toolName: "write",
        targetFile: "config.yaml",
        startedAt: Date.now() - 4000,
      },
    };

    const alert = formatGhostRecoveryAlert(ghost);
    expect(alert).toContain("[RECOVERY ALERT: PREVIOUS TURN INTERRUPTED]");
    expect(alert).toContain("write");
    expect(alert).toContain("config.yaml");
    expect(alert).toContain("Deploy microservice");
    expect(alert).toContain("git status");
  });
});
