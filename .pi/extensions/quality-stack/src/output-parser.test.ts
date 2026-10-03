import { describe, expect, it } from "bun:test";
import { repairJsonString, extractFencedToolCalls, filterKnownTools } from "./output-parser";

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

  describe("filterKnownTools (Issue #96)", () => {
    const known = ["read", "write", "edit", "sh", "outline"];

    it("drops unknown tools and config blobs", () => {
      const text = `
\`\`\`json
{
  "name": "myCustomPackage",
  "version": "1.0.0"
}
\`\`\``;
      const calls = extractFencedToolCalls(text);
      expect(calls.length).toBe(1);
      const filtered = filterKnownTools(calls, known);
      expect(filtered.length).toBe(0);
    });

    it("preserves known tools regardless of case", () => {
      const text = `
\`\`\`json
{
  "name": "Read",
  "parameters": { "path": "foo.txt" }
}
\`\`\``;
      const calls = extractFencedToolCalls(text);
      expect(calls.length).toBe(1);
      const filtered = filterKnownTools(calls, known);
      expect(filtered.length).toBe(1);
      expect(filtered[0].tool).toBe("Read");
    });

    it("passes through all calls if known list is empty or undefined", () => {
      const text = `
\`\`\`json
{
  "name": "someTool",
  "args": {}
}
\`\`\``;
      const calls = extractFencedToolCalls(text);
      expect(filterKnownTools(calls, undefined).length).toBe(1);
      expect(filterKnownTools(calls, []).length).toBe(1);
    });
  });
});
