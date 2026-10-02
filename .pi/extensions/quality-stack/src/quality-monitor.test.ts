import { describe, expect, it } from "bun:test";
import { QualityMonitor } from "./quality-monitor";

describe("quality-monitor", () => {
  it("detects hallucinated tools", () => {
    const qm = new QualityMonitor();
    const available = new Set(["read", "edit", "write", "sh"]);

    const incident = qm.recordToolExecution("bash_exec", {}, false, available);
    expect(incident).not.toBeNull();
    expect(incident?.type).toBe("hallucinated_tool");
    expect(incident?.suggestion).toContain("does not exist");
  });

  it("detects read loops when a file is repeatedly read without edit", () => {
    const qm = new QualityMonitor();
    const available = new Set(["read", "edit", "write", "sh"]);

    expect(qm.recordToolExecution("read", { path: "src/app.ts" }, false, available)).toBeNull();
    expect(qm.recordToolExecution("read", { path: "src/app.ts" }, false, available)).toBeNull();

    const incident = qm.recordToolExecution("read", { path: "src/app.ts" }, false, available);
    expect(incident).not.toBeNull();
    expect(incident?.type).toBe("read_loop");
    expect(incident?.count).toBe(3);
  });

  it("detects patch spirals on repeated failed edits", () => {
    const qm = new QualityMonitor();
    const available = new Set(["read", "edit", "write", "sh"]);

    expect(qm.recordToolExecution("edit", { path: "src/app.ts" }, true, available)).toBeNull();

    const incident = qm.recordToolExecution("edit", { path: "src/app.ts" }, true, available);
    expect(incident).not.toBeNull();
    expect(incident?.type).toBe("patch_spiral");
    expect(incident?.suggestion).toContain("Repeated failed edits");
  });
});
