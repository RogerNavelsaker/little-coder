import { describe, expect, it, beforeEach } from "bun:test";
import { ReadGuardEditTracker } from "./read-guard-edit.ts";

describe("ReadGuardEditTracker", () => {
  let tracker: ReadGuardEditTracker;

  beforeEach(() => {
    tracker = new ReadGuardEditTracker();
  });

  it("blocks edit on files that have not been read in the session", () => {
    const res = tracker.checkEdit("src/foo.ts", "/workspace");
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("File must be read first before edit");
  });

  it("allows edit after file has been read", () => {
    tracker.recordAccess("src/foo.ts", "/workspace");
    const res = tracker.checkEdit("src/foo.ts", "/workspace");
    expect(res.allowed).toBe(true);
  });

  it("resolves relative and normalized paths accurately", () => {
    tracker.recordAccess("./src/bar.ts", "/workspace");
    const res = tracker.checkEdit("src/bar.ts", "/workspace");
    expect(res.allowed).toBe(true);
  });

  it("resets tracked files on session reset", () => {
    tracker.recordAccess("src/baz.ts", "/workspace");
    expect(tracker.checkEdit("src/baz.ts", "/workspace").allowed).toBe(true);

    tracker.reset();
    expect(tracker.checkEdit("src/baz.ts", "/workspace").allowed).toBe(false);
  });
});
