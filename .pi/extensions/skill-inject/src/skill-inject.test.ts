import { describe, expect, it } from "bun:test";
import {
  parseFrontmatter,
  loadToolSkills,
  rankToolSkills,
  formatSkillBlock,
  type ToolSkill,
} from "./skill-inject.ts";

describe("skill-inject", () => {
  it("parses YAML frontmatter and body correctly", () => {
    const raw = `---
name: edit-guidance
type: tool-guidance
target_tool: Edit
priority: 10
token_cost: 150
user-invocable: false
---
## Edit Tool
Replace text in file.`;

    const { data, body } = parseFrontmatter(raw);
    expect(data.name).toBe("edit-guidance");
    expect(data.target_tool).toBe("Edit");
    expect(data.priority).toBe(10);
    expect(data.token_cost).toBe(150);
    expect(data.user_invocable ?? data["user-invocable"]).toBe(false);
    expect(body).toBe("## Edit Tool\nReplace text in file.");
  });

  it("prioritizes error-recovery over recency and intent", () => {
    const skills: ToolSkill[] = [
      {
        name: "edit-guidance",
        targetTool: "Edit",
        tokenCost: 150,
        priority: 10,
        content: "Edit guidance",
        filePath: "/fake/edit.md",
      },
      {
        name: "read-guidance",
        targetTool: "Read",
        tokenCost: 100,
        priority: 10,
        content: "Read guidance",
        filePath: "/fake/read.md",
      },
      {
        name: "write-guidance",
        targetTool: "Write",
        tokenCost: 110,
        priority: 10,
        content: "Write guidance",
        filePath: "/fake/write.md",
      },
    ];

    // Failed tool is Edit -> should be ranked 1st
    const ranked = rankToolSkills(skills, {
      lastFailedTool: "Edit",
      recentTools: ["Read", "Write"],
      userPrompt: "please write a new test",
    });

    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0].targetTool).toBe("Edit");
  });

  it("prioritizes recency when no error", () => {
    const skills: ToolSkill[] = [
      {
        name: "edit-guidance",
        targetTool: "Edit",
        tokenCost: 150,
        priority: 10,
        content: "Edit guidance",
        filePath: "/fake/edit.md",
      },
      {
        name: "read-guidance",
        targetTool: "Read",
        tokenCost: 100,
        priority: 10,
        content: "Read guidance",
        filePath: "/fake/read.md",
      },
    ];

    const ranked = rankToolSkills(skills, {
      recentTools: ["Read"],
      userPrompt: "something unrelated",
    });

    expect(ranked[0].targetTool).toBe("Read");
  });

  it("prioritizes intent match from prompt keywords", () => {
    const skills: ToolSkill[] = [
      {
        name: "edit-guidance",
        targetTool: "Edit",
        tokenCost: 150,
        priority: 10,
        content: "Edit guidance",
        filePath: "/fake/edit.md",
      },
      {
        name: "grep-guidance",
        targetTool: "Grep",
        tokenCost: 100,
        priority: 10,
        content: "Grep guidance",
        filePath: "/fake/grep.md",
      },
    ];

    const ranked = rankToolSkills(skills, {
      userPrompt: "please search text or find string in src",
    });

    expect(ranked[0].targetTool).toBe("Grep");
  });

  it("enforces strict token budget cap (300 tokens)", () => {
    const skills: ToolSkill[] = [
      {
        name: "skill-1",
        targetTool: "Tool1",
        tokenCost: 200,
        priority: 20,
        content: "Content 1",
        filePath: "/1",
      },
      {
        name: "skill-2",
        targetTool: "Tool2",
        tokenCost: 150,
        priority: 15,
        content: "Content 2",
        filePath: "/2",
      },
      {
        name: "skill-3",
        targetTool: "Tool3",
        tokenCost: 90,
        priority: 10,
        content: "Content 3",
        filePath: "/3",
      },
    ];

    // Tool1 (200 tok) + Tool2 (150 tok) = 350 > 300
    // Tool1 (200 tok) + Tool3 (90 tok) = 290 <= 300
    const ranked = rankToolSkills(
      skills,
      {
        userPrompt: "tool1 tool2 tool3",
        requiredTools: ["Tool1", "Tool2", "Tool3"],
      },
      300,
    );

    const totalCost = ranked.reduce((sum, s) => sum + s.tokenCost, 0);
    expect(totalCost).toBeLessThanOrEqual(300);
    expect(ranked.map((s) => s.targetTool)).toEqual(["Tool1", "Tool3"]);
  });

  it("formats skill block with research directive when active", () => {
    const skills: ToolSkill[] = [
      {
        name: "edit-guidance",
        targetTool: "Edit",
        tokenCost: 150,
        priority: 10,
        content: "Replace text in file.",
        filePath: "/fake/edit.md",
      },
    ];

    const formatted = formatSkillBlock(skills, true);
    expect(formatted).toContain("### Research Mode Active");
    expect(formatted).toContain("### Guidance for Edit");
    expect(formatted).toContain("Replace text in file.");
  });

  it("loads actual skills from skills/tools", () => {
    const skills = loadToolSkills();
    expect(skills.length).toBeGreaterThan(0);
    const tools = skills.map((s) => s.targetTool);
    expect(tools).toContain("Edit");
    expect(tools).toContain("Read");
    expect(tools).toContain("Write");
  });
});
