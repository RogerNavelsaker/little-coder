import { describe, it, expect, beforeEach } from "bun:test";
import {
  executeContextWatchdogOp,
  registerContextWatchdog,
  watchdogState,
} from "./context-watchdog.ts";
import { DEFAULT_PERCENT } from "./watchdog.ts";

describe("executeContextWatchdogOp", () => {
  beforeEach(() => {
    watchdogState.enabled = true;
    watchdogState.threshold = DEFAULT_PERCENT;
    watchdogState.paused = false;
    watchdogState.compacting = false;
    watchdogState.lastUsage = null;
  });

  it("returns status", async () => {
    watchdogState.lastUsage = { tokens: 4000, contextWindow: 8000, percent: 50 };
    const res = await executeContextWatchdogOp("call-1", { action: "status" });
    expect(res.isError).toBe(false);
    expect(res.details.threshold).toBe(DEFAULT_PERCENT);
    expect(res.details.paused).toBe(false);
    expect(res.content[0].text).toContain("Watchdog Status: enabled");
    expect(res.content[0].text).toContain("50% (4000/8000 tokens)");
  });

  it("updates threshold", async () => {
    const res = await executeContextWatchdogOp("call-2", { action: "status", threshold: 70 });
    expect(res.details.threshold).toBe(70);
    expect(watchdogState.threshold).toBe(70);
  });

  it("pauses and resumes", async () => {
    const pauseRes = await executeContextWatchdogOp("call-3", { action: "pause" });
    expect(pauseRes.details.paused).toBe(true);
    expect(watchdogState.paused).toBe(true);

    const resumeRes = await executeContextWatchdogOp("call-4", { action: "resume" });
    expect(resumeRes.details.paused).toBe(false);
    expect(watchdogState.paused).toBe(false);
  });

  it("supports batch operations via ops[]", async () => {
    const res = await executeContextWatchdogOp("call-5", {
      ops: [{ action: "pause" }, { action: "status" }],
    });
    expect(res.isError).toBe(false);
    expect(res.details.totalOps).toBe(2);
    expect(res.content[0].text).toContain("---");
  });
});

describe("registerContextWatchdog", () => {
  it("registers tool and lifecycle events", () => {
    const tools: any[] = [];
    const commands: Record<string, any> = {};
    const hooks: Record<string, Function[]> = {};

    const mockPi: any = {
      registerTool: (t: any) => tools.push(t),
      registerCommand: (name: string, opts: any) => { commands[name] = opts; },
      on: (ev: string, fn: Function) => {
        hooks[ev] = hooks[ev] || [];
        hooks[ev].push(fn);
      },
    };

    registerContextWatchdog(mockPi);
    expect(tools.length).toBe(1);
    expect(tools[0].name).toBe("context_watchdog");
    expect(commands["watchdog"]).toBeDefined();
    expect(hooks["turn_start"]).toBeDefined();
    expect(hooks["before_agent_start"]).toBeDefined();
    expect(hooks["session_compact"]).toBeDefined();
  });
});
