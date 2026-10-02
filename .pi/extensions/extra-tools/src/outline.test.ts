import { describe, expect, it } from "bun:test";
import { executeOutlineOp, extractSymbols, computeLineAnchor, registerOutlineTool } from "./outline";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("extractSymbols", () => {
  it("extracts classes, interfaces, types, functions, and structs with line spans", () => {
    const code = `
// Comment
export interface UserConfig {
  name: string;
  age: number;
}

export class ServiceWorker {
  run() {
    return true;
  }
}

export type ID = string | number;

export function calculateTotal(a: number, b: number): number {
  return a + b;
}

pub struct RustItem {
  id: u64,
}
`;
    const symbols = extractSymbols(code);
    expect(symbols.length).toBe(5);

    const iface = symbols.find((s) => s.name === "UserConfig");
    expect(iface).toBeDefined();
    expect(iface?.kind).toBe("interface");
    expect(iface?.span).toContain("lines:");

    const cls = symbols.find((s) => s.name === "ServiceWorker");
    expect(cls).toBeDefined();
    expect(cls?.kind).toBe("class");

    const tp = symbols.find((s) => s.name === "ID");
    expect(tp).toBeDefined();
    expect(tp?.kind).toBe("type");

    const fn = symbols.find((s) => s.name === "calculateTotal");
    expect(fn).toBeDefined();
    expect(fn?.kind).toBe("function");

    const st = symbols.find((s) => s.name === "RustItem");
    expect(st).toBeDefined();
    expect(st?.kind).toBe("struct");
  });

  it("computes 4-character hex linehash anchors", () => {
    const anchor = computeLineAnchor("export function helloWorld() {");
    expect(anchor).toHaveLength(4);
    expect(/^[a-f0-9]{4}$/.test(anchor)).toBe(true);
  });
});

describe("executeOutlineOp", () => {
  const testDir = join(tmpdir(), `test-outline-${Date.now()}`);

  it("returns error if path is missing", async () => {
    const res = await executeOutlineOp("t1", {});
    expect(res.isError).toBe(true);
    expect(res.details.error).toBe("missing_path");
  });

  it("returns error if file does not exist", async () => {
    const res = await executeOutlineOp("t1", { path: "nonexistent.ts" }, undefined, undefined, { cwd: testDir });
    expect(res.isError).toBe(true);
    expect(res.details.error).toBe("file_not_found");
  });

  it("generates outline for an existing file and supports symbol search", async () => {
    mkdirSync(testDir, { recursive: true });
    const filePath = join(testDir, "sample.ts");
    writeFileSync(
      filePath,
      `export class Greeter {
  greet() { return "hello"; }
}

export function helper() {
  return 42;
}
`,
      "utf-8",
    );

    const outlineRes = await executeOutlineOp("t1", { path: "sample.ts" }, undefined, undefined, { cwd: testDir });
    expect(outlineRes.isError).toBe(false);
    expect(outlineRes.details.symbolCount).toBe(2);
    expect(outlineRes.content[0].text).toContain("Outline for sample.ts");
    expect(outlineRes.content[0].text).toContain("Greeter");
    expect(outlineRes.content[0].text).toContain("helper");

    const searchRes = await executeOutlineOp(
      "t2",
      { path: "sample.ts", action: "search", query: "greet" },
      undefined,
      undefined,
      { cwd: testDir },
    );
    expect(searchRes.isError).toBe(false);
    expect(searchRes.details.symbolCount).toBe(1);
    expect(searchRes.details.symbols[0].name).toBe("Greeter");

    rmSync(testDir, { recursive: true, force: true });
  });

  it("supports batch operations via ops[] universal array", async () => {
    mkdirSync(testDir, { recursive: true });
    const f1 = join(testDir, "a.ts");
    const f2 = join(testDir, "b.ts");
    writeFileSync(f1, "export function funcA() {}", "utf-8");
    writeFileSync(f2, "export function funcB() {}", "utf-8");

    const batchRes = await executeOutlineOp(
      "t3",
      {
        ops: [
          { path: "a.ts" },
          { path: "b.ts" },
        ],
      },
      undefined,
      undefined,
      { cwd: testDir },
    );

    expect(batchRes.isError).toBe(false);
    expect(batchRes.details.totalOps).toBe(2);
    expect(batchRes.content[0].text).toContain("funcA");
    expect(batchRes.content[0].text).toContain("funcB");

    rmSync(testDir, { recursive: true, force: true });
  });
});

describe("registerOutlineTool", () => {
  it("registers outline tool and command", () => {
    const registeredTools: any[] = [];
    const registeredCommands: any[] = [];
    const mockPi: any = {
      registerTool: (tool: any) => registeredTools.push(tool),
      registerCommand: (name: string, cmd: any) => registeredCommands.push({ name, ...cmd }),
    };

    registerOutlineTool(mockPi);
    expect(registeredTools.length).toBe(1);
    expect(registeredTools[0].name).toBe("outline");
    expect(registeredCommands.length).toBe(1);
    expect(registeredCommands[0].name).toBe("outline");
  });
});
