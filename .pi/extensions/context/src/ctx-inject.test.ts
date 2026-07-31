import { describe, test, expect } from "bun:test";
import { registerCtxInjectTool } from "./ctx-inject.js";
import { executeCtxInjectOp } from "./ctx-inject.js";

describe("ctx_inject tool", () => {
  test("exports executeCtxInjectOp and functions cleanly", async () => {
    expect(typeof executeCtxInjectOp).toBe("function");
    const mockPi = { registerTool: () => {} };
    registerCtxInjectTool(mockPi as any);
  });

  test("ops array parameter support", async () => {
    const result = await executeCtxInjectOp("call_1", {
      ops: [{ packetId: "nonexistent" }],
    });
    expect(result).toBeDefined();
    expect((result as any).details).toBeDefined();
  });
});
