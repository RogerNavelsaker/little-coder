import { describe, expect, it } from "bun:test";
import { synthesizeOrientationBlock } from "./orientation.ts";

describe("grove/orientation", () => {
  it("synthesizes orientation block when repo has .seeds", () => {
    const block = synthesizeOrientationBlock();
    expect(block).toBeDefined();
    expect(block).toContain("[ORIENTATION]");
    expect(block).toContain("Grove commands");
  });
});
