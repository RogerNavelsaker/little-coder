import { describe, expect, it } from "bun:test";
import { executeWebSourceOp, registerWebSourceTool } from "./web-source.ts";

describe("web-tools/web_source", () => {
  it("fails when query is missing on search", () => {
    const res = executeWebSourceOp({ op: "search" });
    expect(res.success).toBe(false);
    expect(res.error).toBe("Missing query");
  });

  it("fails when repo or path is missing on file", () => {
    const res = executeWebSourceOp({ op: "file", repo: "github.com/foo/bar" });
    expect(res.success).toBe(false);
    expect(res.error).toBe("Missing repo or path");
  });

  it("searches code repositories using Sourcegraph stream API or gh fallback", () => {
    const res = executeWebSourceOp({
      op: "search",
      query: "repo:^github\\.com/itayinbarr/little-coder$ little-coder",
      limit: 2,
    });

    expect(res.success).toBe(true);
    expect(res.matches).toBeDefined();
    expect(res.matches!.length).toBeGreaterThan(0);
    expect(res.matches![0].repository).toBe("github.com/itayinbarr/little-coder");
  });

  it("supports download op with aria2c or curl", () => {
    const res = executeWebSourceOp({
      op: "download",
      url: "https://example.com",
      downloader: "curl",
      path: "/tmp/test-download.html",
    });

    expect(res.success).toBe(true);
    expect(res.output).toContain("Downloaded with curl");
  });

  it("registers web_source tool with pi", () => {
    let registered: any = null;
    const mockPi: any = {
      registerTool: (tool: any) => {
        registered = tool;
      },
    };

    registerWebSourceTool(mockPi);
    expect(registered).toBeDefined();
    expect(registered.name).toBe("web_source");
    expect(typeof registered.execute).toBe("function");
  });
});
