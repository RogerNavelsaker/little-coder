import { describe, expect, it } from "bun:test";
import { executeSessionOp, registerSessionTool, getSessionsDir } from "./session";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("executeSessionOp", () => {
  const testSessionsDir = join(tmpdir(), `test-sessions-${Date.now()}`);

  it("lists empty sessions when none are running", async () => {
    const res = await executeSessionOp("t1", { action: "list" }, undefined, undefined, {
      cwd: process.cwd(),
      sessionsDir: testSessionsDir,
    });
    expect(res.isError).toBe(false);
    expect(res.content[0].text).toContain("No active sessions found");
    expect(res.details.sessions).toEqual([]);
  });

  it("creates/spawns a background process and reads output", async () => {
    mkdirSync(testSessionsDir, { recursive: true });

    // Spawn an echo command
    const spawnRes = await executeSessionOp(
      "t2",
      {
        action: "create",
        id: "test-echo",
        command: "echo 'hello from session'",
      },
      undefined,
      undefined,
      { cwd: process.cwd(), sessionsDir: testSessionsDir },
    );

    expect(spawnRes.isError).toBe(false);
    expect(spawnRes.content[0].text).toContain("Session 'test-echo' started");
    expect(spawnRes.content[0].text).toContain("[exit=null");

    // Wait 150ms for process to finish writing log
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Read log output
    const readRes = await executeSessionOp(
      "t3",
      {
        action: "read",
        id: "test-echo",
      },
      undefined,
      undefined,
      { cwd: process.cwd(), sessionsDir: testSessionsDir },
    );

    expect(readRes.isError).toBe(false);
    expect(readRes.content[0].text).toContain("hello from session");
    expect(readRes.content[0].text).toContain("timed_out=false");

    // Close session
    const closeRes = await executeSessionOp(
      "t4",
      {
        action: "close",
        id: "test-echo",
      },
      undefined,
      undefined,
      { cwd: process.cwd(), sessionsDir: testSessionsDir },
    );
    expect(closeRes.isError).toBe(false);
    expect(closeRes.content[0].text).toContain("Closed session 'test-echo'");

    rmSync(testSessionsDir, { recursive: true, force: true });
  });

  it("handles reset action to terminate and clean up all sessions", async () => {
    mkdirSync(testSessionsDir, { recursive: true });

    await executeSessionOp(
      "t5",
      { action: "create", id: "s1", command: "sleep 10" },
      undefined,
      undefined,
      { cwd: process.cwd(), sessionsDir: testSessionsDir },
    );

    await executeSessionOp(
      "t6",
      { action: "create", id: "s2", command: "sleep 10" },
      undefined,
      undefined,
      { cwd: process.cwd(), sessionsDir: testSessionsDir },
    );

    const resetRes = await executeSessionOp(
      "t7",
      { action: "reset" },
      undefined,
      undefined,
      { cwd: process.cwd(), sessionsDir: testSessionsDir },
    );

    expect(resetRes.isError).toBe(false);
    expect(resetRes.details.resetCount).toBe(2);

    const listRes = await executeSessionOp(
      "t8",
      { action: "list" },
      undefined,
      undefined,
      { cwd: process.cwd(), sessionsDir: testSessionsDir },
    );
    expect(listRes.details.sessions.length).toBe(0);

    rmSync(testSessionsDir, { recursive: true, force: true });
  });

  it("supports batch operations via ops[] universal array", async () => {
    mkdirSync(testSessionsDir, { recursive: true });

    const batchRes = await executeSessionOp(
      "t9",
      {
        ops: [
          { action: "create", id: "batch-1", command: "echo 'first'" },
          { action: "create", id: "batch-2", command: "echo 'second'" },
        ],
      },
      undefined,
      undefined,
      { cwd: process.cwd(), sessionsDir: testSessionsDir },
    );

    expect(batchRes.isError).toBe(false);
    expect(batchRes.details.totalOps).toBe(2);

    await executeSessionOp(
      "t10",
      { action: "reset" },
      undefined,
      undefined,
      { cwd: process.cwd(), sessionsDir: testSessionsDir },
    );

    rmSync(testSessionsDir, { recursive: true, force: true });
  });
});

describe("registerSessionTool", () => {
  it("registers session tool and command", () => {
    const registeredTools: any[] = [];
    const registeredCommands: any[] = [];
    const mockPi: any = {
      registerTool: (tool: any) => registeredTools.push(tool),
      registerCommand: (name: string, cmd: any) => registeredCommands.push({ name, ...cmd }),
    };

    registerSessionTool(mockPi);
    expect(registeredTools.length).toBe(1);
    expect(registeredTools[0].name).toBe("session");
    expect(registeredCommands.length).toBe(1);
    expect(registeredCommands[0].name).toBe("session");
  });
});
