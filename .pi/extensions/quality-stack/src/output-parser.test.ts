import { describe, expect, it } from "bun:test";
import { repairJsonString, extractFencedToolCalls } from "./output-parser";

describe("output-parser", () => {
  it("repairs control characters, single quotes, and trailing commas", () => {
    const broken = "{\n  'tool': 'edit',\n  'path': 'src/main.ts',\n}";
    const repaired = repairJsonString(broken);
    const parsed = JSON.parse(repaired);
    expect(parsed.tool).toBe("edit");
    expect(parsed.path).toBe("src/main.ts");
  });

  it("extracts tool call from markdown fenced json block", () => {
    const text = `I will read the configuration:
\`\`\`json
{
  "tool": "read",
  "parameters": { "path": "package.json" }
}
\`\`\`
Let's see what happens.`;

    const calls = extractFencedToolCalls(text);
    expect(calls.length).toBe(1);
    expect(calls[0].tool).toBe("read");
    expect((calls[0].parameters as any).path).toBe("package.json");
  });

  it("extracts tool call from XML-style <tool_call> tags", () => {
    const text = `<tool_call>
{
  "name": "outline",
  "path": "src/index.ts"
}
</tool_call>`;

    const calls = extractFencedToolCalls(text);
    expect(calls.length).toBe(1);
    expect(calls[0].tool).toBe("outline");
  });
});
