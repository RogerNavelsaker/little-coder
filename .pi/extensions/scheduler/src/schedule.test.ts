import { describe, expect, it } from "bun:test";
import {
  executeScheduleOp,
  getScheduledTasks,
  clearScheduledTasks,
  registerScheduleTool,
} from "./schedule";

describe("executeScheduleOp", () => {
  it("lists empty tasks initially", async () => {
    clearScheduledTasks();
    const res = await executeScheduleOp("t1", { action: "list" });
    expect(res.isError).toBe(false);
    expect(res.content[0].text).toContain("No scheduled prompt tasks active");
    expect(res.details.count).toBe(0);
  });

  it("creates, lists, and cancels a scheduled task", async () => {
    clearScheduledTasks();

    const createRes = await executeScheduleOp("t2", {
      action: "create",
      id: "task-test-1",
      delaySeconds: 10,
      prompt: "Check background logs",
    });

    expect(createRes.isError).toBe(false);
    expect(createRes.details.id).toBe("task-test-1");

    const listRes = await executeScheduleOp("t3", { action: "list" });
    expect(listRes.details.count).toBe(1);
    expect(listRes.content[0].text).toContain("task-test-1");

    const cancelRes = await executeScheduleOp("t4", {
      action: "cancel",
      id: "task-test-1",
    });
    expect(cancelRes.details.cancelled).toBe(true);

    const emptyRes = await executeScheduleOp("t5", { action: "list" });
    expect(emptyRes.details.count).toBe(0);
  });

  it("supports batch operations via ops[] universal array", async () => {
    clearScheduledTasks();

    const batchRes = await executeScheduleOp("t6", {
      ops: [
        { action: "create", id: "batch-1", delaySeconds: 20, prompt: "Prompt 1" },
        { action: "create", id: "batch-2", delaySeconds: 30, prompt: "Prompt 2" },
      ],
    });

    expect(batchRes.isError).toBe(false);
    expect(batchRes.details.totalOps).toBe(2);

    const listRes = await executeScheduleOp("t7", { action: "list" });
    expect(listRes.details.count).toBe(2);

    clearScheduledTasks();
  });
});

describe("registerScheduleTool", () => {
  it("registers tool and command", () => {
    const registeredTools: any[] = [];
    const registeredCommands: any[] = [];
    const mockPi: any = {
      registerTool: (t: any) => registeredTools.push(t),
      registerCommand: (name: string, c: any) => registeredCommands.push({ name, ...c }),
    };

    registerScheduleTool(mockPi);
    expect(registeredTools.length).toBe(1);
    expect(registeredTools[0].name).toBe("schedule");
    expect(registeredCommands.length).toBe(1);
    expect(registeredCommands[0].name).toBe("schedule");
  });
});
