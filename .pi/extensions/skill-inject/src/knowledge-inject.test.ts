import { describe, expect, it } from "bun:test";
import {
  loadKnowledgeEntries,
  scoreKnowledgeEntries,
  selectKnowledge,
  formatKnowledgeBlock,
  type KnowledgeEntry,
} from "./knowledge-inject.ts";

describe("knowledge-inject", () => {
  const mockEntries: KnowledgeEntry[] = [
    {
      name: "task-decomposition",
      topic: "decomposition",
      keywords: ["/decompose", "plan", "complex task", "multi-step", "breakdown"],
      tokenCost: 140,
      requiresTools: ["Read", "Edit"],
      content: "Decomposition instructions...",
      filePath: "/fake/task_decomposition.md",
    },
    {
      name: "perf-audit",
      topic: "performance",
      keywords: ["latency", "profiling", "benchmark", "flamegraph"],
      tokenCost: 250, // exceeds 150 limit
      requiresTools: ["Shell"],
      content: "Long performance profiling guide with lots of text that should be capped...",
      filePath: "/fake/perf.md",
    },
    {
      name: "unrelated",
      topic: "misc",
      keywords: ["xyz", "unrelated keyword"],
      tokenCost: 50,
      requiresTools: [],
      content: "Unrelated content",
      filePath: "/fake/unrelated.md",
    },
  ];

  it("scores entries above threshold based on matched keywords", () => {
    const scored = scoreKnowledgeEntries(
      mockEntries,
      "Please execute /decompose on this complex task",
      2.0,
    );

    expect(scored.length).toBe(1);
    expect(scored[0].entry.name).toBe("task-decomposition");
    expect(scored[0].score).toBeGreaterThanOrEqual(2.0);
    expect(scored[0].matchedKeywords).toContain("/decompose");
  });

  it("ignores entries below threshold", () => {
    const scored = scoreKnowledgeEntries(mockEntries, "hello world", 2.0);
    expect(scored.length).toBe(0);
  });

  it("caps entry tokens at 150 and publishes required tools", () => {
    const result = selectKnowledge(mockEntries, "performance latency profiling", {
      threshold: 2.0,
      maxPerEntryTokens: 150,
      maxTotalTokens: 300,
    });

    expect(result.selected.length).toBe(1);
    const selected = result.selected[0];
    expect(selected.name).toBe("perf-audit");
    expect(selected.tokenCost).toBeLessThanOrEqual(150);
    expect(selected.content).toContain("[truncated to 150 tokens]");
    expect(result.publishedRequiredTools).toContain("Shell");
  });

  it("publishes required tools to skill-inject", () => {
    const result = selectKnowledge(
      mockEntries,
      "let's plan a multi-step decomposition",
      { threshold: 2.0 },
    );

    expect(result.selected.length).toBe(1);
    expect(result.publishedRequiredTools).toContain("Read");
    expect(result.publishedRequiredTools).toContain("Edit");
  });

  it("formats knowledge block properly", () => {
    const block = formatKnowledgeBlock([mockEntries[0]]);
    expect(block).toContain("### Protocol / Knowledge: task-decomposition");
    expect(block).toContain("Decomposition instructions...");
  });

  it("loads actual knowledge/protocol entries from repo", () => {
    const entries = loadKnowledgeEntries();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some((e) => e.name === "task-decomposition")).toBe(true);
    expect(entries.some((e) => e.name === "grilling")).toBe(true);
    expect(entries.some((e) => e.name === "grill-with-docs")).toBe(true);
    expect(entries.some((e) => e.name === "systematic-debugging")).toBe(true);
  });

  it("scores grilling and debugging protocols on matching prompts", () => {
    const entries = loadKnowledgeEntries();

    const grillResults = selectKnowledge(entries, "/grill-me let's stress-test the design tree", { threshold: 2.0 });
    expect(grillResults.selected.some((e) => e.name === "grilling")).toBe(true);

    const debugResults = selectKnowledge(entries, "diagnose bug and test failure hypothesis", { threshold: 2.0 });
    expect(debugResults.selected.some((e) => e.name === "systematic-debugging")).toBe(true);
  });
});
