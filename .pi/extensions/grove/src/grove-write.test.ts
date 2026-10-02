import { describe, expect, it } from "bun:test";
import { executeGroveWriteOp, registerGroveWriteTool } from "./grove-write.ts";

describe("grove/grove_write", () => {
  it("fails with missing issue id on update", () => {
    const res = executeGroveWriteOp({ op: "seeds", action: "update" });
    expect(res.success).toBe(false);
    expect(res.error).toBe("Missing ID");
  });

  it("registers grove_write tool with pi", () => {
    let registered: any = null;
    const mockPi: any = {
      registerTool: (tool: any) => {
        registered = tool;
      },
    };

    registerGroveWriteTool(mockPi);
    expect(registered).toBeDefined();
    expect(registered.name).toBe("grove_write");
    expect(typeof registered.execute).toBe("function");
  });
});
