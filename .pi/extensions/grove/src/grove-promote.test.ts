import { describe, expect, it } from "bun:test";
import { executeGrovePromoteOp, registerGrovePromoteTool } from "./grove-promote.ts";

describe("grove/grove_promote", () => {
  it("fails with missing id on close", () => {
    const res = executeGrovePromoteOp({ op: "close" });
    expect(res.success).toBe(false);
    expect(res.error).toBe("Missing ID");
  });

  it("ranks mulch architecture records", () => {
    const res = executeGrovePromoteOp({ op: "rank", domain: "architecture" });
    expect(res.success).toBe(true);
    expect(res.op).toBe("rank");
  });

  it("registers grove_promote tool with pi", () => {
    let registered: any = null;
    const mockPi: any = {
      registerTool: (tool: any) => {
        registered = tool;
      },
    };

    registerGrovePromoteTool(mockPi);
    expect(registered).toBeDefined();
    expect(registered.name).toBe("grove_promote");
    expect(typeof registered.execute).toBe("function");
  });
});
