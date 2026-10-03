import { describe, it, expect } from "bun:test";
import { repairJsonControlChars, PATCHES } from "./patch-pi.js";

describe("patch-pi", () => {
  it("exports PATCHES array with all essential patches", () => {
    expect(PATCHES.length).toBeGreaterThanOrEqual(8);
    const rels = PATCHES.map(p => p.rel);
    expect(rels).toContain("dist/modes/interactive/components/assistant-message.js");
    expect(rels).toContain("dist/modes/interactive/components/tool-execution.js");
    expect(rels).toContain("dist/core/tools/edit.js");
    expect(rels).toContain("dist/core/auth-storage.js");
    expect(rels).toContain("dist/core/model-resolver.js");
  });

  describe("repairJsonControlChars", () => {
    it("leaves normal strings unchanged", () => {
      const input = '[{"oldText":"hello","newText":"world"}]';
      expect(repairJsonControlChars(input)).toBe(input);
    });

    it("escapes raw newlines inside string literals", () => {
      const input = '{"oldText":"line1\nline2","newText":"line1\nmodified"}';
      const expected = '{"oldText":"line1\\nline2","newText":"line1\\nmodified"}';
      expect(repairJsonControlChars(input)).toBe(expected);
      expect(JSON.parse(repairJsonControlChars(input))).toEqual({
        oldText: "line1\nline2",
        newText: "line1\nmodified",
      });
    });

    it("escapes raw tabs and CR inside string literals", () => {
      const input = '{"text":"\tindented\r\n"}';
      const repaired = repairJsonControlChars(input);
      expect(JSON.parse(repaired)).toEqual({
        text: "\tindented\r\n",
      });
    });

    it("handles escaped quotes properly without exiting string mode", () => {
      const input = '{"code":"const s = \\"hello\\";\nreturn s;"}';
      const repaired = repairJsonControlChars(input);
      expect(JSON.parse(repaired)).toEqual({
        code: 'const s = "hello";\nreturn s;',
      });
    });
  });
});
