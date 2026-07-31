import { describe, test, expect } from "bun:test";
import { registerCtxRecordTool, executeCtxRecordOp } from "./ctx-record.js";

describe("ctx_record tool", () => {
  test("exports executeCtxRecordOp and registers cleanly", async () => {
    expect(typeof executeCtxRecordOp).toBe("function");
    const mockPi = { registerTool: () => {} };
    registerCtxRecordTool(mockPi as any);
  });

  test("ops array parameter support", async () => {
    const result = await executeCtxRecordOp("call_3", {
      ops: [{ type: "decision", title: "Test decision" }],
    });
    expect(result).toBeDefined();
    expect((result as any).details).toBeDefined();
  });
});
