import { describe, test, expect } from "bun:test";
import { registerCtxPacketTool, executeCtxPacketOp } from "./ctx-packet.js";

describe("ctx_packet tool", () => {
  test("exports executeCtxPacketOp and registers cleanly", async () => {
    expect(typeof executeCtxPacketOp).toBe("function");
    const mockPi = { registerTool: () => {} };
    registerCtxPacketTool(mockPi as any);
  });

  test("ops array parameter support", async () => {
    const result = await executeCtxPacketOp("call_2", {
      ops: [{ limit: 10 }],
    });
    expect(result).toBeDefined();
    expect((result as any).details).toBeDefined();
  });
});
