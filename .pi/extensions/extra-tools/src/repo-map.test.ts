import { describe, it, expect } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  executeRepoMapOp,
  detectEntrypoints,
  renderTree,
  registerRepoMapTool,
} from "./repo-map.ts";

function createTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "lc-repomap-"));
}

describe("executeRepoMapOp", () => {
  it("renders tree and detects entrypoints", async () => {
    const tmp = createTmpDir();
    try {
      fs.mkdirSync(path.join(tmp, "src"));
      fs.writeFileSync(path.join(tmp, "src", "index.ts"), "console.log('hi');");
      fs.writeFileSync(
        path.join(tmp, "package.json"),
        JSON.stringify({ name: "demo", main: "src/index.ts", scripts: { test: "bun test" } }),
      );

      const res = await executeRepoMapOp("call-1", { action: "map", cwd: tmp }, undefined, undefined, { cwd: tmp });
      expect(res.isError).toBe(false);
      expect(res.details.action).toBe("map");
      expect(res.content[0].text).toContain("Repository Map");
      expect(res.content[0].text).toContain("Node/Bun");
      expect(res.content[0].text).toContain("src/");
      expect(res.content[0].text).toContain("index.ts");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("handles entrypoints action directly", async () => {
    const tmp = createTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, "Cargo.toml"), "[package]\nname = 'test'");
      const res = await executeRepoMapOp("call-2", { action: "entrypoints", cwd: tmp }, undefined, undefined, { cwd: tmp });
      expect(res.isError).toBe(false);
      expect(res.details.entrypoints["Rust"]).toBeDefined();
      expect(res.content[0].text).toContain("Rust");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("supports batch operations via ops[] universal array", async () => {
    const tmp = createTmpDir();
    try {
      const res = await executeRepoMapOp(
        "call-3",
        {
          ops: [
            { action: "entrypoints", cwd: tmp },
            { action: "modified", cwd: tmp },
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

describe("registerRepoMapTool", () => {
  it("registers repo_map tool and command", () => {
    const tools: any[] = [];
    const commands: Record<string, any> = {};
    const mockPi: any = {
      registerTool: (t: any) => tools.push(t),
      registerCommand: (name: string, opts: any) => { commands[name] = opts; },
      on: () => {},
    };

    registerRepoMapTool(mockPi);
    expect(tools.length).toBe(1);
    expect(tools[0].name).toBe("repo_map");
    expect(commands["repomap"]).toBeDefined();
  });
});
