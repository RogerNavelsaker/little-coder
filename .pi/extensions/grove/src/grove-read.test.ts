import { describe, expect, it } from "bun:test";
import { executeGroveReadOp, registerGroveReadTool } from "./grove-read.ts";

describe("grove/grove_read", () => {
  it("reads ready seeds issues", () => {
    const res = executeGroveReadOp({ op: "seeds", ready: true });
    expect(res.success).toBe(true);
    expect(res.op).toBe("seeds");
    expect(res.output).toBeDefined();
  });

  it("reads mulch architecture domain", () => {
    const res = executeGroveReadOp({ op: "mulch", domain: "architecture" });
    expect(res.success).toBe(true);
    expect(res.op).toBe("mulch");
    expect(res.output).toContain("architecture");
  });

  it("renders canopy prompt", () => {
    const res = executeGroveReadOp({ op: "canopy", id: "agent-context" });
    expect(res.success).toBe(true);
    expect(res.op).toBe("canopy");
    expect(res.output).toContain("agent-context");
  });

  it("registers grove_read tool with pi", () => {
    let registered: any = null;
    const mockPi: any = {
      registerTool: (tool: any) => {
        registered = tool;
      },
    };

    registerGroveReadTool(mockPi);
    expect(registered).toBeDefined();
    expect(registered.name).toBe("grove_read");
    expect(typeof registered.execute).toBe("function");
  });
});
