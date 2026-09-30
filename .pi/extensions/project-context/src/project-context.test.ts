import { describe, expect, it, beforeEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  executeProjectContextOp,
  clearProjectContextCache,
  registerProjectContextTool,
} from "./project-context.ts";

function createTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "lc-projctx-tool-"));
}

describe("executeProjectContextOp", () => {
  beforeEach(() => {
    clearProjectContextCache();
  });

  it("handles when no project context exists", async () => {
    const tmp = createTmpDir();
    try {
      const res = await executeProjectContextOp("call-1", { action: "discover", cwd: tmp }, undefined, undefined, { cwd: tmp });
      expect(res.isError).toBe(false);
      expect(res.details.found).toBe(false);
      expect(res.content[0].text).toContain("No workspace AGENTS.md or CLAUDE.md found");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("discovers AGENTS.md and parses embedded @refs", async () => {
    const tmp = createTmpDir();
    try {
      const doc = path.join(tmp, "style.md");
      fs.writeFileSync(doc, "# Style Rules");
      fs.writeFileSync(join(tmp, "AGENTS.md"), "Follow @./style.md always");

      const res = await executeProjectContextOp("call-2", { action: "discover", cwd: tmp }, undefined, undefined, { cwd: tmp });
      expect(res.isError).toBe(false);
      expect(res.details.action).toBe("discover");
      expect(res.details.path).toBe(join(tmp, "AGENTS.md"));
      expect(res.details.refs).toEqual([doc]);
      expect(res.content[0].text).toContain("Project Context:");
      expect(res.content[0].text).toContain(doc);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("reads project context with resolved reference blocks", async () => {
    const tmp = createTmpDir();
    try {
      const doc = path.join(tmp, "rules.md");
      fs.writeFileSync(doc, "# Embedded Rules");
      fs.writeFileSync(join(tmp, "AGENTS.md"), "Workspace conventions:\n@./rules.md");

      const res = await executeProjectContextOp("call-3", { action: "read", cwd: tmp }, undefined, undefined, { cwd: tmp });
      expect(res.isError).toBe(false);
      expect(res.content[0].text).toContain("<project_instructions source=");
      expect(res.content[0].text).toContain("<project_references path=");
      expect(res.content[0].text).toContain("# Embedded Rules");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("resolves references from custom text via action=resolve_refs", async () => {
    const tmp = createTmpDir();
    try {
      const doc = path.join(tmp, "extra.md");
      fs.writeFileSync(doc, "Extra guideline content");

      const res = await executeProjectContextOp(
        "call-4",
        { action: "resolve_refs", text: "Look at @./extra.md please", cwd: tmp },
        undefined,
        undefined,
        { cwd: tmp },
      );
      expect(res.isError).toBe(false);
      expect(res.details.action).toBe("resolve_refs");
      expect(res.details.fileCount).toBe(1);
      expect(res.content[0].text).toContain("<project_references");
      expect(res.content[0].text).toContain("Extra guideline content");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("clears cache via action=clear_cache", async () => {
    const res = await executeProjectContextOp("call-5", { action: "clear_cache" });
    expect(res.isError).toBe(false);
    expect(res.details.cleared).toBe(true);
    expect(res.content[0].text).toContain("cache cleared");
  });

  it("supports batch operations via ops[] universal array", async () => {
    const tmp = createTmpDir();
    try {
      fs.writeFileSync(join(tmp, "AGENTS.md"), "Short instructions");
      const res = await executeProjectContextOp(
        "call-6",
        {
          ops: [
            { action: "discover", cwd: tmp },
            { action: "clear_cache" },
          ],
        },
        undefined,
        undefined,
        { cwd: tmp },
      );
      expect(res.isError).toBe(false);
      expect(res.details.totalOps).toBe(2);
      expect(res.content[0].text).toContain("---");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("registerProjectContextTool", () => {
  it("registers tool, command, and lifecycle hooks", () => {
    const tools: any[] = [];
    const commands: Record<string, any> = {};
    const hooks: Record<string, Function[]> = {};

    const mockPi: any = {
      registerTool: (tool: any) => tools.push(tool),
      registerCommand: (name: string, opts: any) => { commands[name] = opts; },
      on: (event: string, handler: Function) => {
        hooks[event] = hooks[event] || [];
        hooks[event].push(handler);
      },
    };

    registerProjectContextTool(mockPi);

    expect(tools.length).toBe(1);
    expect(tools[0].name).toBe("project_context");
    expect(commands["project-context"]).toBeDefined();
    expect(hooks["session_start"]).toBeDefined();
    expect(hooks["before_agent_start"]).toBeDefined();
    expect(hooks["input"]).toBeDefined();
  });
});

function join(...parts: string[]): string {
  return path.join(...parts);
}
