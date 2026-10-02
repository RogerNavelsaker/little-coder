import { describe, expect, it } from "bun:test";
import {
  executeGoalOp,
  getActiveGoal,
  resetActiveGoal,
  registerGoalTool,
} from "./goal";

describe("executeGoalOp", () => {
  it("starts, updates, checkpoints, and completes a goal", async () => {
    resetActiveGoal();

    // 1. Initial status
    const initialStatus = await executeGoalOp("t1", { action: "status" });
    expect(initialStatus.details.active).toBe(false);

    // 2. Start goal
    const startRes = await executeGoalOp("t2", {
      action: "start",
      objective: "Refactor database queries",
    });
    expect(startRes.isError).toBe(false);
    expect(startRes.details.goal.objective).toBe("Refactor database queries");

    // 3. Add subgoal
    const subRes = await executeGoalOp("t3", {
      action: "subgoal_add",
      subgoalId: "step-1",
      title: "Add index to users table",
    });
    expect(subRes.isError).toBe(false);
    expect(subRes.details.subgoal.id).toBe("step-1");

    // 4. Update subgoal
    const updateRes = await executeGoalOp("t4", {
      action: "subgoal_update",
      subgoalId: "step-1",
      status: "completed",
      note: "Migration applied cleanly",
    });
    expect(updateRes.details.subgoal.status).toBe("completed");

    // 5. Add checkpoint
    const cpRes = await executeGoalOp("t5", {
      action: "checkpoint",
      note: "Ran unit tests, 100% pass",
    });
    expect(cpRes.isError).toBe(false);

    // 6. Complete goal
    const compRes = await executeGoalOp("t6", {
      action: "complete",
      note: "All database queries optimized",
    });
    expect(compRes.details.completed).toBe(true);

    // Goal is now cleared
    expect(getActiveGoal()).toBeNull();
  });

  it("supports batch operations via ops[] universal array", async () => {
    resetActiveGoal();

    const batchRes = await executeGoalOp("t7", {
      ops: [
        { action: "start", objective: "Batch Goal" },
        { action: "subgoal_add", subgoalId: "b1", title: "Batch Subgoal 1" },
        { action: "checkpoint", note: "Batch checkpoint" },
      ],
    });

    expect(batchRes.isError).toBe(false);
    expect(batchRes.details.totalOps).toBe(3);

    const goal = getActiveGoal();
    expect(goal).not.toBeNull();
    expect(goal?.subgoals.length).toBe(1);

    resetActiveGoal();
  });
});

describe("registerGoalTool", () => {
  it("registers goal tool and command", () => {
    const registeredTools: any[] = [];
    const registeredCommands: any[] = [];
    const mockPi: any = {
      registerTool: (t: any) => registeredTools.push(t),
      registerCommand: (name: string, c: any) => registeredCommands.push({ name, ...c }),
    };

    registerGoalTool(mockPi);
    expect(registeredTools.length).toBe(1);
    expect(registeredTools[0].name).toBe("goal");
    expect(registeredCommands.length).toBe(1);
    expect(registeredCommands[0].name).toBe("goal");
  });
});
