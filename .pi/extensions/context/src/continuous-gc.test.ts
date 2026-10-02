import { describe, expect, it } from "bun:test";
import { runContinuousGC, type ContinuousGCSettings } from "./continuous-gc";
import type { AgentMessage } from "@earendil-works/pi-agent-core";

describe("continuous-gc (Sapling pattern)", () => {
  it("keeps messages untouched when total turns <= verbatimRecentTurns", () => {
    const messages: AgentMessage[] = [
      { role: "user", content: "turn 1" },
      { role: "assistant", content: "ok" },
      { role: "toolResult", toolName: "read", content: [{ type: "text", text: "x".repeat(1000) }] } as any,
    ];

    const { messages: res, stats } = runContinuousGC(messages, {
      enabled: true,
      verbatimRecentTurns: 3,
      maxHistoricalToolOutputChars: 100,
    });

    expect(stats.prunedToolResults).toBe(0);
    expect(res).toEqual(messages);
  });

  it("prunes large tool outputs in older turns while keeping recent turns verbatim", () => {
    const hugeOutput = "A".repeat(800);
    const messages: AgentMessage[] = [
      // Turn 1 (old)
      { role: "user", content: "turn 1" },
      { role: "assistant", content: "calling tool" },
      { role: "toolResult", toolName: "grep", content: [{ type: "text", text: hugeOutput }] } as any,

      // Turn 2 (recent)
      { role: "user", content: "turn 2" },
      { role: "assistant", content: "calling tool 2" },
      { role: "toolResult", toolName: "read", content: [{ type: "text", text: hugeOutput }] } as any,

      // Turn 3 (recent)
      { role: "user", content: "turn 3" },
      { role: "assistant", content: "done" },
    ];

    const settings: ContinuousGCSettings = {
      enabled: true,
      verbatimRecentTurns: 2, // Turn 2 and 3 are recent, Turn 1 is old
      maxHistoricalToolOutputChars: 200,
    };

    const { messages: res, stats } = runContinuousGC(messages, settings);

    expect(stats.prunedToolResults).toBe(1);
    expect(stats.charsSaved).toBeGreaterThan(500);

    // Old turn toolResult was pruned with tombstone
    const oldToolResult: any = res[2];
    expect(oldToolResult.content[0].text).toContain("omitted by continuous GC for grep");

    // Recent turn toolResult was kept verbatim
    const recentToolResult: any = res[5];
    expect(recentToolResult.content[0].text).toBe(hugeOutput);
  });

  it("respects LITTLE_CODER_NO_CONTINUOUS_GC flag to disable", () => {
    const messages: AgentMessage[] = [
      { role: "user", content: "1" },
      { role: "user", content: "2" },
      { role: "user", content: "3" },
      { role: "user", content: "4" },
      { role: "toolResult", toolName: "read", content: [{ type: "text", text: "X".repeat(500) }] } as any,
    ];

    const { stats } = runContinuousGC(messages, {
      enabled: false,
      verbatimRecentTurns: 1,
      maxHistoricalToolOutputChars: 50,
    });

    expect(stats.prunedToolResults).toBe(0);
  });
});
