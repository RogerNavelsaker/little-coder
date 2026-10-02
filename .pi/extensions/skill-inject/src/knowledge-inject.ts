import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseFrontmatter } from "./skill-inject.ts";

export interface KnowledgeEntry {
  name: string;
  topic?: string;
  keywords: string[];
  tokenCost: number;
  requiresTools: string[];
  content: string;
  filePath: string;
}

export interface KnowledgeScoreResult {
  entry: KnowledgeEntry;
  score: number;
  matchedKeywords: string[];
}

export const KEYWORD_SCORE_THRESHOLD = 2.0;
export const MAX_KNOWLEDGE_TOKENS_PER_ENTRY = 150;
export const MAX_TOTAL_KNOWLEDGE_TOKENS = 300;

export function loadKnowledgeEntries(baseDirs?: string[]): KnowledgeEntry[] {
  const dirs = baseDirs || [
    resolve(process.cwd(), "skills/knowledge"),
    resolve(process.cwd(), "skills/protocols"),
  ];

  const entries: KnowledgeEntry[] = [];

  for (const dir of dirs) {
    if (!existsSync(dir)) continue;

    const files = readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith(".md")) continue;
      const fullPath = join(dir, file.name);

      try {
        const raw = readFileSync(fullPath, "utf-8");
        const { data, body } = parseFrontmatter(raw);

        // Extract keywords
        let keywords: string[] = [];
        if (Array.isArray(data.keywords)) {
          keywords = data.keywords.map((k: any) => String(k).trim().toLowerCase());
        } else if (typeof data.keywords === "string") {
          keywords = data.keywords
            .split(",")
            .map((k: string) => k.trim().toLowerCase())
            .filter(Boolean);
        }

        // Also add triggers or topic words
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

        // requires_tools
        let requiresTools: string[] = [];
        if (Array.isArray(data.requires_tools || data.requiresTools)) {
          requiresTools = (data.requires_tools || data.requiresTools).map((t: any) => String(t).trim());
        } else if (typeof (data.requires_tools || data.requiresTools) === "string") {
          requiresTools = (data.requires_tools || data.requiresTools)
            .split(",")
            .map((t: string) => t.trim())
            .filter(Boolean);
        }

        const tokenCost =
          typeof data.token_cost === "number"
            ? data.token_cost
            : Math.ceil(body.length / 4);

        entries.push({
          name: data.name || file.name.replace(/\.md$/, ""),
          topic: data.topic,
          keywords: Array.from(new Set(keywords)),
          tokenCost,
          requiresTools,
          content: body,
          filePath: fullPath,
        });
      } catch {
        // Ignore unparseable files
      }
    }
  }

  return entries;
}

export function scoreKnowledgeEntries(
  entries: KnowledgeEntry[],
  prompt: string,
  threshold: number = KEYWORD_SCORE_THRESHOLD,
): KnowledgeScoreResult[] {
  if (!prompt || entries.length === 0) return [];

  const promptLower = prompt.toLowerCase();
  const words = promptLower.split(/\s+/).filter((w) => w.length > 2);
  const results: KnowledgeScoreResult[] = [];

  for (const entry of entries) {
    let score = 0;
    const matched: string[] = [];

    for (const kw of entry.keywords) {
      if (!kw) continue;
      // Direct substring match
      if (promptLower.includes(kw)) {
        score += kw.includes(" ") || kw.startsWith("/") ? 2.5 : 1.5;
        matched.push(kw);
      } else {
        // Word level match
        for (const w of words) {
          if (kw === w || kw.includes(w) || w.includes(kw)) {
            score += 1.0;
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
        matchedKeywords: Array.from(new Set(matched)),
      });
    }
  }

  // Sort descending by score
  results.sort((a, b) => b.score - a.score);
  return results;
}

export function selectKnowledge(
  entries: KnowledgeEntry[],
  prompt: string,
  options?: {
    threshold?: number;
    maxPerEntryTokens?: number;
    maxTotalTokens?: number;
  },
): {
  selected: KnowledgeEntry[];
  publishedRequiredTools: string[];
} {
  const threshold = options?.threshold ?? KEYWORD_SCORE_THRESHOLD;
  const maxPerEntry = options?.maxPerEntryTokens ?? MAX_KNOWLEDGE_TOKENS_PER_ENTRY;
  const maxTotal = options?.maxTotalTokens ?? MAX_TOTAL_KNOWLEDGE_TOKENS;

  const scored = scoreKnowledgeEntries(entries, prompt, threshold);
  const selected: KnowledgeEntry[] = [];
  const requiredToolsSet = new Set<string>();
  let totalTokens = 0;

  for (const item of scored) {
    let content = item.entry.content;
    let entryTokens = item.entry.tokenCost;

    // Truncate entry if it exceeds maxPerEntry
    if (entryTokens > maxPerEntry) {
      const maxChars = maxPerEntry * 4;
      content = content.slice(0, maxChars) + "\n...[truncated to 150 tokens]";
      entryTokens = maxPerEntry;
    }

    if (totalTokens + entryTokens <= maxTotal) {
      selected.push({
        ...item.entry,
        tokenCost: entryTokens,
        content,
      });
      totalTokens += entryTokens;

      for (const t of item.entry.requiresTools) {
        requiredToolsSet.add(t);
      }
    }
  }

  return {
    selected,
    publishedRequiredTools: Array.from(requiredToolsSet),
  };
}

export function formatKnowledgeBlock(selected: KnowledgeEntry[]): string {
  if (selected.length === 0) return "";
  return selected
    .map((e) => `### Protocol / Knowledge: ${e.name}\n${e.content}`)
    .join("\n\n");
}
