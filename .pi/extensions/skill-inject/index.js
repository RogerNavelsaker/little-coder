// @bun
// .pi/extensions/_shared/inject.ts
function injectMode(env = process.env) {
  return env.LITTLE_CODER_INJECT_MODE === "system" ? "system" : "message";
}
function injectionResult(customType, block, systemPrompt = "", env = process.env) {
  if (!block)
    return;
  if (injectMode(env) === "system") {
    return { systemPrompt: systemPrompt + block };
  }
  return { message: { customType, content: block, display: false } };
}
function makeDedupe(env = process.env) {
  let last = null;
  return (block) => {
    if (injectMode(env) === "system")
      return true;
    if (block === last)
      return false;
    last = block;
    return true;
  };
}

// .pi/extensions/skill-inject/src/skill-inject.ts
import { existsSync, readdirSync, readFileSync } from "fs";
import { join, resolve } from "path";
var MAX_SKILL_TOKENS = 300;
var INTENT_MAP = {
  edit: ["edit", "change", "modify", "update", "replace", "fix", "patch", "refactor"],
  write: ["write", "create", "new file", "scaffold", "generate file"],
  read: ["read", "view", "inspect", "show file", "examine", "check content"],
  grep: ["grep", "search text", "find string", "search code", "regex"],
  glob: ["glob", "find file", "list files", "file tree", "search filename"],
  shell: ["run", "command", "exec", "terminal", "bash", "sh", "test", "build"],
  webfetch: ["curl", "fetch", "http", "url", "download url", "scrape"]
};
function parseFrontmatter(rawContent) {
  if (!rawContent.startsWith("---")) {
    return { data: {}, body: rawContent.trim() };
  }
  const endIdx = rawContent.indexOf(`
---`, 3);
  if (endIdx === -1) {
    return { data: {}, body: rawContent.trim() };
  }
  const fmText = rawContent.slice(3, endIdx).trim();
  const body = rawContent.slice(endIdx + 4).trim();
  const data = {};
  for (const line of fmText.split(`
`)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#"))
      continue;
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1)
      continue;
    const key = trimmed.slice(0, colonIdx).trim();
    let valStr = trimmed.slice(colonIdx + 1).trim();
    if (valStr.startsWith("[") && valStr.endsWith("]")) {
      const items = valStr.slice(1, -1).split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
      data[key] = items;
      continue;
    }
    if (valStr.startsWith('"') && valStr.endsWith('"') || valStr.startsWith("'") && valStr.endsWith("'")) {
      valStr = valStr.slice(1, -1);
    }
    if (/^\d+$/.test(valStr)) {
      data[key] = parseInt(valStr, 10);
    } else if (valStr === "true") {
      data[key] = true;
    } else if (valStr === "false") {
      data[key] = false;
    } else {
      data[key] = valStr;
    }
  }
  return { data, body };
}
function loadToolSkills(skillsDir) {
  const baseDir = skillsDir || resolve(process.cwd(), "skills/tools");
  if (!existsSync(baseDir))
    return [];
  const skills = [];
  const entries = readdirSync(baseDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md"))
      continue;
    const fullPath = join(baseDir, entry.name);
    try {
      const raw = readFileSync(fullPath, "utf-8");
      const { data, body } = parseFrontmatter(raw);
      const targetTool = data.target_tool || data.targetTool || "";
      if (!targetTool)
        continue;
      const tokenCost = typeof data.token_cost === "number" ? data.token_cost : Math.ceil(body.length / 4);
      const priority = typeof data.priority === "number" ? data.priority : 10;
      const name = data.name || entry.name.replace(/\.md$/, "");
      skills.push({
        name,
        targetTool,
        tokenCost,
        priority,
        content: body,
        filePath: fullPath
      });
    } catch {}
  }
  return skills;
}
function rankToolSkills(skills, context, tokenBudget = MAX_SKILL_TOKENS) {
  if (skills.length === 0)
    return [];
  const scored = [];
  const failedNorm = context.lastFailedTool ? context.lastFailedTool.toLowerCase() : null;
  const recentNorm = (context.recentTools || []).slice(-2).map((t) => t.toLowerCase());
  const promptLower = (context.userPrompt || "").toLowerCase();
  const requiredNorm = (context.requiredTools || []).map((t) => t.toLowerCase());
  for (const skill of skills) {
    const toolNorm = skill.targetTool.toLowerCase();
    let score = 0;
    let reason = "none";
    if (requiredNorm.includes(toolNorm)) {
      score += 1500;
      reason = "required-tool";
    }
    if (failedNorm && toolNorm === failedNorm) {
      score += 1000;
      reason = "error-recovery";
    }
    const recencyIdx = recentNorm.lastIndexOf(toolNorm);
    if (recencyIdx !== -1) {
      const recencyScore = 400 + (recencyIdx + 1) * 50;
      if (recencyScore > score) {
        score = recencyScore;
        reason = "recency";
      } else {
        score += recencyScore;
      }
    }
    for (const [intentTool, keywords] of Object.entries(INTENT_MAP)) {
      if (toolNorm === intentTool.toLowerCase()) {
        const matches = keywords.filter((kw) => promptLower.includes(kw));
        if (matches.length > 0) {
          const intentScore = 200 + matches.length * 20;
          if (intentScore > score) {
            score = intentScore;
            reason = "intent";
          } else {
            score += intentScore;
          }
        }
      }
    }
    score += skill.priority;
    if (score > 10) {
      scored.push({ skill, score, reason });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  const selected = [];
  let spentTokens = 0;
  for (const item of scored) {
    if (spentTokens + item.skill.tokenCost <= tokenBudget) {
      selected.push(item.skill);
      spentTokens += item.skill.tokenCost;
    }
  }
  return selected;
}
function formatSkillBlock(selectedSkills, researchTrigger = false) {
  if (selectedSkills.length === 0 && !researchTrigger)
    return "";
  const sections = [];
  if (researchTrigger) {
    sections.push(`### Research Mode Active
When exploring unfamiliar code or errors: read relevant files before proposing modifications.`);
  }
  for (const skill of selectedSkills) {
    sections.push(`### Guidance for ${skill.targetTool}
${skill.content}`);
  }
  return sections.join(`

`);
}

// .pi/extensions/skill-inject/src/knowledge-inject.ts
import { existsSync as existsSync2, readdirSync as readdirSync2, readFileSync as readFileSync2 } from "fs";
import { join as join2, resolve as resolve2 } from "path";
var KEYWORD_SCORE_THRESHOLD = 2;
var MAX_KNOWLEDGE_TOKENS_PER_ENTRY = 150;
var MAX_TOTAL_KNOWLEDGE_TOKENS = 300;
function loadKnowledgeEntries(baseDirs) {
  const dirs = baseDirs || [
    resolve2(process.cwd(), "skills/knowledge"),
    resolve2(process.cwd(), "skills/protocols")
  ];
  const entries = [];
  for (const dir of dirs) {
    if (!existsSync2(dir))
      continue;
    const files = readdirSync2(dir, { withFileTypes: true });
    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith(".md"))
        continue;
      const fullPath = join2(dir, file.name);
      try {
        const raw = readFileSync2(fullPath, "utf-8");
        const { data, body } = parseFrontmatter(raw);
        let keywords = [];
        if (Array.isArray(data.keywords)) {
          keywords = data.keywords.map((k) => String(k).trim().toLowerCase());
        } else if (typeof data.keywords === "string") {
          keywords = data.keywords.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);
        }
        if (Array.isArray(data.triggers)) {
          for (const tr of data.triggers) {
            keywords.push(String(tr).trim().toLowerCase());
          }
        }
        if (data.topic) {
          keywords.push(String(data.topic).trim().toLowerCase());
        }
        if (data.name) {
          keywords.push(String(data.name).trim().toLowerCase().replace(/[-_]/g, " "));
        }
        let requiresTools = [];
        if (Array.isArray(data.requires_tools || data.requiresTools)) {
          requiresTools = (data.requires_tools || data.requiresTools).map((t) => String(t).trim());
        } else if (typeof (data.requires_tools || data.requiresTools) === "string") {
          requiresTools = (data.requires_tools || data.requiresTools).split(",").map((t) => t.trim()).filter(Boolean);
        }
        const tokenCost = typeof data.token_cost === "number" ? data.token_cost : Math.ceil(body.length / 4);
        entries.push({
          name: data.name || file.name.replace(/\.md$/, ""),
          topic: data.topic,
          keywords: Array.from(new Set(keywords)),
          tokenCost,
          requiresTools,
          content: body,
          filePath: fullPath
        });
      } catch {}
    }
  }
  return entries;
}
function scoreKnowledgeEntries(entries, prompt, threshold = KEYWORD_SCORE_THRESHOLD) {
  if (!prompt || entries.length === 0)
    return [];
  const promptLower = prompt.toLowerCase();
  const words = promptLower.split(/\s+/).filter((w) => w.length > 2);
  const results = [];
  for (const entry of entries) {
    let score = 0;
    const matched = [];
    for (const kw of entry.keywords) {
      if (!kw)
        continue;
      if (promptLower.includes(kw)) {
        score += kw.includes(" ") || kw.startsWith("/") ? 2.5 : 1.5;
        matched.push(kw);
      } else {
        for (const w of words) {
          if (kw === w || kw.includes(w) || w.includes(kw)) {
            score += 1;
            matched.push(kw);
            break;
          }
        }
      }
    }
    if (score >= threshold) {
      results.push({
        entry,
        score,
        matchedKeywords: Array.from(new Set(matched))
      });
    }
  }
  results.sort((a, b) => b.score - a.score);
  return results;
}
function selectKnowledge(entries, prompt, options) {
  const threshold = options?.threshold ?? KEYWORD_SCORE_THRESHOLD;
  const maxPerEntry = options?.maxPerEntryTokens ?? MAX_KNOWLEDGE_TOKENS_PER_ENTRY;
  const maxTotal = options?.maxTotalTokens ?? MAX_TOTAL_KNOWLEDGE_TOKENS;
  const scored = scoreKnowledgeEntries(entries, prompt, threshold);
  const selected = [];
  const requiredToolsSet = new Set;
  let totalTokens = 0;
  for (const item of scored) {
    let content = item.entry.content;
    let entryTokens = item.entry.tokenCost;
    if (entryTokens > maxPerEntry) {
      const maxChars = maxPerEntry * 4;
      content = content.slice(0, maxChars) + `
...[truncated to 150 tokens]`;
      entryTokens = maxPerEntry;
    }
    if (totalTokens + entryTokens <= maxTotal) {
      selected.push({
        ...item.entry,
        tokenCost: entryTokens,
        content
      });
      totalTokens += entryTokens;
      for (const t of item.entry.requiresTools) {
        requiredToolsSet.add(t);
      }
    }
  }
  return {
    selected,
    publishedRequiredTools: Array.from(requiredToolsSet)
  };
}
function formatKnowledgeBlock(selected) {
  if (selected.length === 0)
    return "";
  return selected.map((e) => `### Protocol / Knowledge: ${e.name}
${e.content}`).join(`

`);
}

// .pi/extensions/skill-inject/index.ts
function skillInjectExtension(pi) {
  let toolSkillsCache = null;
  let knowledgeEntriesCache = null;
  const dedupe = makeDedupe();
  let lastFailedTool = null;
  const recentTools = [];
  let lastUserPrompt = "";
  pi.on("session_start", () => {
    toolSkillsCache = null;
    knowledgeEntriesCache = null;
    lastFailedTool = null;
    recentTools.length = 0;
    lastUserPrompt = "";
  });
  pi.on("input", async (event) => {
    if (typeof event?.text === "string") {
      lastUserPrompt = event.text;
    }
    return { action: "continue" };
  });
  pi.on("tool_call", async (event) => {
    const toolName = event?.toolName || event?.tool;
    if (typeof toolName === "string") {
      recentTools.push(toolName);
      if (recentTools.length > 5) {
        recentTools.shift();
      }
    }
  });
  pi.on("tool_result", async (event) => {
    const toolName = event?.toolName || event?.tool;
    const isError = Boolean(event?.isError || event?.error);
    if (isError && typeof toolName === "string") {
      lastFailedTool = toolName;
    } else if (lastFailedTool === toolName) {
      lastFailedTool = null;
    }
  });
  pi.on("before_agent_start", async (event) => {
    if (!toolSkillsCache) {
      toolSkillsCache = loadToolSkills();
    }
    if (!knowledgeEntriesCache) {
      knowledgeEntriesCache = loadKnowledgeEntries();
    }
    const { selected: selectedKnowledge, publishedRequiredTools } = selectKnowledge(knowledgeEntriesCache, lastUserPrompt);
    const promptLower = lastUserPrompt.toLowerCase();
    const researchTrigger = promptLower.includes("research") || promptLower.includes("investigate") || promptLower.includes("audit") || promptLower.includes("explore codebase");
    const selectedSkills = rankToolSkills(toolSkillsCache, {
      lastFailedTool,
      recentTools,
      userPrompt: lastUserPrompt,
      requiredTools: publishedRequiredTools
    }, 300);
    const blocks = [];
    const knowledgeBlock = formatKnowledgeBlock(selectedKnowledge);
    if (knowledgeBlock) {
      blocks.push(knowledgeBlock);
    }
    const skillBlock = formatSkillBlock(selectedSkills, researchTrigger);
    if (skillBlock) {
      blocks.push(skillBlock);
    }
    if (blocks.length === 0)
      return;
    const fullBlock = blocks.join(`

`);
    if (!dedupe(fullBlock))
      return;
    return injectionResult("lc-skill-knowledge-inject", fullBlock, event?.systemPrompt);
  });
}
export {
  skillInjectExtension as default
};
