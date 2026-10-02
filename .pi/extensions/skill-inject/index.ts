import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { injectionResult, makeDedupe } from "../_shared/inject.ts";
import {
  loadToolSkills,
  rankToolSkills,
  formatSkillBlock,
  type ToolSkill,
} from "./src/skill-inject.ts";
import {
  loadKnowledgeEntries,
  selectKnowledge,
  formatKnowledgeBlock,
  type KnowledgeEntry,
} from "./src/knowledge-inject.ts";

export default function skillInjectExtension(pi: ExtensionAPI): void {
  let toolSkillsCache: ToolSkill[] | null = null;
  let knowledgeEntriesCache: KnowledgeEntry[] | null = null;

  const dedupe = makeDedupe();

  let lastFailedTool: string | null = null;
  const recentTools: string[] = [];
  let lastUserPrompt: string = "";

  // Reset caches and session trackers on session_start
  pi.on("session_start", () => {
    toolSkillsCache = null;
    knowledgeEntriesCache = null;
    lastFailedTool = null;
    recentTools.length = 0;
    lastUserPrompt = "";
  });

  // Track user input for intent matching and research triggers
  pi.on("input", async (event: any) => {
    if (typeof event?.text === "string") {
      lastUserPrompt = event.text;
    }
    return { action: "continue" };
  });

  // Track tool calls and failure events to inform error-recovery and recency
  pi.on("tool_call", async (event: any) => {
    const toolName = event?.toolName || event?.tool;
    if (typeof toolName === "string") {
      recentTools.push(toolName);
      if (recentTools.length > 5) {
        recentTools.shift();
      }
    }
  });

  pi.on("tool_result", async (event: any) => {
    const toolName = event?.toolName || event?.tool;
    const isError = Boolean(event?.isError || event?.error);
    if (isError && typeof toolName === "string") {
      lastFailedTool = toolName;
    } else if (lastFailedTool === toolName) {
      lastFailedTool = null;
    }
  });

  // Intercept before_agent_start to dynamically select and inject skills & knowledge
  pi.on("before_agent_start", async (event: any) => {
    if (!toolSkillsCache) {
      toolSkillsCache = loadToolSkills();
    }
    if (!knowledgeEntriesCache) {
      knowledgeEntriesCache = loadKnowledgeEntries();
    }

    // 1. Evaluate knowledge & protocol injection first
    const { selected: selectedKnowledge, publishedRequiredTools } = selectKnowledge(
      knowledgeEntriesCache,
      lastUserPrompt,
    );

    // Check research trigger directive: trigger if prompt asks for research/investigate
    const promptLower = lastUserPrompt.toLowerCase();
    const researchTrigger =
      promptLower.includes("research") ||
      promptLower.includes("investigate") ||
      promptLower.includes("audit") ||
      promptLower.includes("explore codebase");

    // 2. Evaluate tool skill injection using 3-priority ranker (error-recovery > recency > intent)
    const selectedSkills = rankToolSkills(
      toolSkillsCache,
      {
        lastFailedTool,
        recentTools,
        userPrompt: lastUserPrompt,
        requiredTools: publishedRequiredTools,
      },
      300,
    );

    const blocks: string[] = [];

    const knowledgeBlock = formatKnowledgeBlock(selectedKnowledge);
    if (knowledgeBlock) {
      blocks.push(knowledgeBlock);
    }

    const skillBlock = formatSkillBlock(selectedSkills, researchTrigger);
    if (skillBlock) {
      blocks.push(skillBlock);
    }

    if (blocks.length === 0) return;

    const fullBlock = blocks.join("\n\n");
    if (!dedupe(fullBlock)) return;

    return injectionResult("lc-skill-knowledge-inject", fullBlock, event?.systemPrompt);
  });
}
