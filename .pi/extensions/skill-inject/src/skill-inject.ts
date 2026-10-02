import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

export interface ToolSkill {
  name: string;
  targetTool: string;
  tokenCost: number;
  priority: number;
  content: string;
  filePath: string;
}

export interface SkillSelectionContext {
  lastFailedTool?: string | null;
  recentTools?: string[];
  userPrompt?: string;
  requiredTools?: string[];
}

export const MAX_SKILL_TOKENS = 300;

export const INTENT_MAP: Record<string, string[]> = {
  edit: ["edit", "change", "modify", "update", "replace", "fix", "patch", "refactor"],
  write: ["write", "create", "new file", "scaffold", "generate file"],
  read: ["read", "view", "inspect", "show file", "examine", "check content"],
  grep: ["grep", "search text", "find string", "search code", "regex"],
  glob: ["glob", "find file", "list files", "file tree", "search filename"],
  shell: ["run", "command", "exec", "terminal", "bash", "sh", "test", "build"],
  webfetch: ["curl", "fetch", "http", "url", "download url", "scrape"],
};

export function parseFrontmatter(rawContent: string): { data: Record<string, any>; body: string } {
  if (!rawContent.startsWith("---")) {
    return { data: {}, body: rawContent.trim() };
  }

  const endIdx = rawContent.indexOf("\n---", 3);
  if (endIdx === -1) {
    return { data: {}, body: rawContent.trim() };
  }

  const fmText = rawContent.slice(3, endIdx).trim();
  const body = rawContent.slice(endIdx + 4).trim();
  const data: Record<string, any> = {};

  for (const line of fmText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    let valStr = trimmed.slice(colonIdx + 1).trim();

    // Parse array if bracketed
    if (valStr.startsWith("[") && valStr.endsWith("]")) {
      const items = valStr
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
      data[key] = items;
      continue;
    }

    // Strip quotes
    if ((valStr.startsWith('"') && valStr.endsWith('"')) || (valStr.startsWith("'") && valStr.endsWith("'"))) {
      valStr = valStr.slice(1, -1);
    }

    // Number conversion
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

export function loadToolSkills(skillsDir?: string): ToolSkill[] {
  const baseDir = skillsDir || resolve(process.cwd(), "skills/tools");
  if (!existsSync(baseDir)) return [];

  const skills: ToolSkill[] = [];
  const entries = readdirSync(baseDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const fullPath = join(baseDir, entry.name);
    try {
      const raw = readFileSync(fullPath, "utf-8");
      const { data, body } = parseFrontmatter(raw);

      const targetTool = data.target_tool || data.targetTool || "";
      if (!targetTool) continue;

      const tokenCost = typeof data.token_cost === "number" ? data.token_cost : Math.ceil(body.length / 4);
      const priority = typeof data.priority === "number" ? data.priority : 10;
      const name = data.name || entry.name.replace(/\.md$/, "");

      skills.push({
        name,
        targetTool,
        tokenCost,
        priority,
        content: body,
        filePath: fullPath,
      });
    } catch {
      // Ignore unparseable files
    }
  }

  return skills;
}

export function rankToolSkills(
  skills: ToolSkill[],
  context: SkillSelectionContext,
  tokenBudget: number = MAX_SKILL_TOKENS,
): ToolSkill[] {
  if (skills.length === 0) return [];

  const scored: Array<{ skill: ToolSkill; score: number; reason: string }> = [];

  const failedNorm = context.lastFailedTool ? context.lastFailedTool.toLowerCase() : null;
  const recentNorm = (context.recentTools || []).slice(-2).map((t) => t.toLowerCase());
  const promptLower = (context.userPrompt || "").toLowerCase();
  const requiredNorm = (context.requiredTools || []).map((t) => t.toLowerCase());

  for (const skill of skills) {
    const toolNorm = skill.targetTool.toLowerCase();
    let score = 0;
    let reason = "none";

    // Required tools (from knowledge-inject or protocol) get highest bonus
    if (requiredNorm.includes(toolNorm)) {
      score += 1500;
      reason = "required-tool";
    }

    // 1. Error recovery (last failed tool)
    if (failedNorm && toolNorm === failedNorm) {
      score += 1000;
      reason = "error-recovery";
    }

    // 2. Recency (last 2 tool calls)
    const recencyIdx = recentNorm.lastIndexOf(toolNorm);
    if (recencyIdx !== -1) {
      // most recent gets 500, previous gets 400
      const recencyScore = 400 + (recencyIdx + 1) * 50;
      if (recencyScore > score) {
        score = recencyScore;
        reason = "recency";
      } else {
        score += recencyScore;
      }
    }

    // 3. Intent (INTENT_MAP keyword match)
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

    // Apply baseline priority as tiebreaker
    score += skill.priority;

    if (score > 10) {
      scored.push({ skill, score, reason });
    }
  }

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  // Apply token budget cap (300 tokens)
  const selected: ToolSkill[] = [];
  let spentTokens = 0;

  for (const item of scored) {
    if (spentTokens + item.skill.tokenCost <= tokenBudget) {
      selected.push(item.skill);
      spentTokens += item.skill.tokenCost;
    }
  }

  return selected;
}

export function formatSkillBlock(selectedSkills: ToolSkill[], researchTrigger = false): string {
  if (selectedSkills.length === 0 && !researchTrigger) return "";

  const sections: string[] = [];

  if (researchTrigger) {
    sections.push(
      "### Research Mode Active\nWhen exploring unfamiliar code or errors: read relevant files before proposing modifications.",
    );
  }

  for (const skill of selectedSkills) {
    sections.push(`### Guidance for ${skill.targetTool}\n${skill.content}`);
  }

  return sections.join("\n\n");
}
