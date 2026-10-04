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

    // Reset on edit
    qm.recordToolExecution("edit", { path: "src/app.ts" }, false, available);
    expect(qm.recordToolExecution("read", { path: "src/app.ts" }, false, available)).toBeNull();

    // Multi-file read specs in files array
    expect(qm.recordToolExecution("read", { files: [{ path: "src/b.ts" }] }, false, available)).toBeNull();
    expect(qm.recordToolExecution("read", { files: [{ path: "src/b.ts" }] }, false, available)).toBeNull();
    const inc2 = qm.recordToolExecution("read", { files: [{ path: "src/b.ts" }] }, false, available);
    expect(inc2).not.toBeNull();
    expect(inc2?.type).toBe("read_loop");
    expect(inc2?.target).toBe("src/b.ts");
  });

  it("resets read counter when file is modified externally", () => {
    const qm = new QualityMonitor();
    const available = new Set(["read", "edit", "write", "sh"]);
    const testFile = "package.json"; // exists on disk

    expect(qm.recordToolExecution("read", { path: testFile }, false, available)).toBeNull();
    expect(qm.recordToolExecution("read", { path: testFile }, false, available)).toBeNull();

    // Manually touch file or simulate external modification by bumping mtime in test
    const { utimesSync } = require("node:fs");
    const now = new Date(Date.now() + 2000);
    try {
      utimesSync(testFile, now, now);
    } catch {}

    // Subsequent read should notice mtime changed and not trigger read_loop incident
    const afterExternalMod = qm.recordToolExecution("read", { path: testFile }, false, available);
    expect(afterExternalMod).toBeNull();
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
