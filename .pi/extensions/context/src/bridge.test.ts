import { describe, expect, it } from "bun:test";
import {
  isEngramAvailable,
  formatSessionSummary,
  extractCompactionContext,
  saveEngramSummary,
  type SessionSummaryPayload,
} from "./bridge";

describe("bridge", () => {
  it("detects engram availability on PATH", () => {
    const available = isEngramAvailable();
    expect(typeof available).toBe("boolean");
  });

  it("formats structured session summary according to Engram conventions", () => {
    const payload: SessionSummaryPayload = {
      goal: "Implement memory bridge",
      instructions: ["Never write to .pi-context/"],
      discoveries: ["Engram CLI supports save --type session_summary"],
      accomplished: ["Created bridge.ts"],
      nextSteps: ["Wire session_before_compact hook"],
      relevantFiles: ["src/bridge.ts"],
    };

    const formatted = formatSessionSummary(payload);
    expect(formatted).toContain("## Goal\nImplement memory bridge");
    expect(formatted).toContain("## Instructions\n- Never write to .pi-context/");
    expect(formatted).toContain("## Discoveries\n- Engram CLI supports save --type session_summary");
    expect(formatted).toContain("## Accomplished\n- Created bridge.ts");
    expect(formatted).toContain("## Next Steps\n- Wire session_before_compact hook");
    expect(formatted).toContain("## Relevant Files\n- src/bridge.ts");
  });

  it("extracts compaction context from messages", () => {
    const messages: any[] = [
      { role: "user", content: "Implement feature X" },
      { role: "assistant", content: "✓ Finished writing code\nKey Learning: Keep it clean" },
      { role: "toolResult", details: { path: "/tmp/foo.ts" } },
    ];

    const ctx = extractCompactionContext(messages);
    expect(ctx.goal).toBe("Implement feature X");
    expect(ctx.accomplished).toContain("✓ Finished writing code");
    expect(ctx.discoveries).toContain("Key Learning: Keep it clean");
    expect(ctx.relevantFiles).toContain("/tmp/foo.ts");
  });
});
