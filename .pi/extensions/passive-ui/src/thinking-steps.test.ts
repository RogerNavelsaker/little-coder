import { describe, it, expect, beforeAll } from "bun:test";
import { initTheme, AssistantMessageComponent } from "@earendil-works/pi-coding-agent";
import {
  parseThinkingSteps,
  formatThinkingStepsLabel,
  patchAssistantMessageComponent,
  unpatchAssistantMessageComponent,
  getThinkingStepsPatchRefCount,
  executeThinkingStepsOp,
  THINKING_STEPS_REF_COUNT,
  THINKING_STEPS_ORIG_UPDATE,
} from "./thinking-steps.js";

describe("thinking-steps", () => {
  beforeAll(() => {
    try {
      initTheme();
    } catch {
      // ignore if already initialized
    }
  });

  it("parses empty and single thinking traces", () => {
    expect(parseThinkingSteps("")).toEqual([]);
    expect(parseThinkingSteps("   ")).toEqual([]);

    const single = "Considering the refactor approach.";
    expect(parseThinkingSteps(single)).toEqual([single]);
  });

  it("parses multi-paragraph and header-based thinking into steps", () => {
    const raw = `I will first inspect the codebase.

Then I will run the tests to check current status.

Finally I will apply the patch.`;

    const steps = parseThinkingSteps(raw);
    expect(steps.length).toBe(3);
    expect(steps[0]).toBe("I will first inspect the codebase.");
    expect(steps[1]).toBe("Then I will run the tests to check current status.");
    expect(steps[2]).toBe("Finally I will apply the patch.");
  });

  it("formats thinking step summary labels", () => {
    expect(formatThinkingStepsLabel(0)).toBe("Thinking...");
    expect(formatThinkingStepsLabel(1)).toBe("Thinking...");
    expect(formatThinkingStepsLabel(3)).toBe("Thinking (3 steps)...");
    expect(formatThinkingStepsLabel(4, "Reasoning")).toBe("Reasoning (4 steps)...");
  });

  it("manages reference-counted prototype patching with Symbol", () => {
    const proto = AssistantMessageComponent.prototype as any;
    const initialRefCount = getThinkingStepsPatchRefCount();

    // 1st patch
    const count1 = patchAssistantMessageComponent();
    expect(count1).toBe(initialRefCount + 1);
    expect(proto[THINKING_STEPS_ORIG_UPDATE]).toBeDefined();

    // 2nd patch (reference increment)
    const count2 = patchAssistantMessageComponent();
    expect(count2).toBe(count1 + 1);

    // 1st unpatch (reference decrement)
    const count3 = unpatchAssistantMessageComponent();
    expect(count3).toBe(count1);

    // 2nd unpatch (restore original)
    const count4 = unpatchAssistantMessageComponent();
    expect(count4).toBe(initialRefCount);
  });

  it("renders thinking steps inside AssistantMessageComponent when patched", () => {
    patchAssistantMessageComponent();
    try {
      const component = new AssistantMessageComponent();
      const message = {
        role: "assistant" as const,
        content: [
          {
            type: "thinking" as const,
            thinking: "Step 1: Check files.\n\nStep 2: Update code.",
          },
          {
            type: "text" as const,
            text: "All done!",
          },
        ],
      };

      component.updateContent(message as any);
      expect((component as any).contentContainer.children.length).toBeGreaterThan(0);
    } finally {
      unpatchAssistantMessageComponent();
    }
  });

  it("renders Codex-style turn duration status badge when present on assistant message", () => {
    patchAssistantMessageComponent();
    try {
      const component = new AssistantMessageComponent();
      const message = {
        role: "assistant" as const,
        content: [{ type: "text" as const, text: "Completed implementation." }],
        turnDurationBadge: "  \x1b[2mWorked for 37s • 9:42 AM\x1b[0m",
      };

      component.updateContent(message as any);
      const rendered = component.render(80);
      const fullText = rendered.join("\n");
      expect(fullText).toContain("Completed implementation.");
      expect(fullText).toContain("Worked for 37s • 9:42 AM");
    } finally {
      unpatchAssistantMessageComponent();
    }
  });

  it("executes executeThinkingStepsOp for single and ops[] batch", async () => {
    // Single
    const res1 = await executeThinkingStepsOp("call_1", {
      rawThinking: "First examine schema.\n\nSecond implement tool.",
    });
    expect(res1.isError).toBe(false);
    expect(res1.details.totalSteps).toBe(2);
    expect(res1.content[0].text).toContain("[Step 1] First examine schema.");
    expect(res1.content[0].text).toContain("[Step 2] Second implement tool.");

    // Batch ops
    const resOps = await executeThinkingStepsOp("call_ops", {
      ops: [
        { rawThinking: "Solo thought" },
        { rawThinking: "Part A\n\nPart B" },
      ],
    });
    expect(resOps.isError).toBe(false);
    expect(resOps.details.totalOps).toBe(2);
    expect(resOps.content[0].text).toContain("[Step 1] Solo thought");
    expect(resOps.content[0].text).toContain("[Step 2] Part B");
  });
});
