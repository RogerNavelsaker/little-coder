import { describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  parseRefs,
  resolveRef,
  getAllFilePathFromContextFiles,
  parseFileAndContent,
  formatProjectReferences,
  expandPromptRefs,
  MAX_FILE_SIZE,
} from "./file-reference.ts";

function createTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "lc-fileref-"));
}

describe("parseRefs", () => {
  it("extracts @ref at start of line", () => {
    expect(parseRefs("@path/to/file.md")).toEqual(["path/to/file.md"]);
  });

  it("extracts @ref after space or tab", () => {
    expect(parseRefs("  @path/to/file.md")).toEqual(["path/to/file.md"]);
    expect(parseRefs("\t@path/to/file.md")).toEqual(["path/to/file.md"]);
  });

  it("extracts multiple @refs on one line", () => {
    expect(parseRefs("first @a.md and @b.md and @c/d/e.md")).toEqual([
      "a.md",
      "b.md",
      "c/d/e.md",
    ]);
  });

  it("parses double-quoted references with spaces", () => {
    expect(parseRefs('use @"path with spaces/file.md"')).toEqual([
      "path with spaces/file.md",
    ]);
  });

  it("ignores @ preceded by non-whitespace character", () => {
    expect(parseRefs("some@ref.md")).toEqual([]);
    expect(parseRefs("test@example.com")).toEqual([]);
  });

  it("ignores @words without path separators or extensions", () => {
    expect(parseRefs("@filepath and @todo notes")).toEqual([]);
  });

  it("accepts .md and .mdc extensions", () => {
    expect(parseRefs("@guide.md and @rule.mdc")).toEqual(["guide.md", "rule.mdc"]);
  });

  it("drops non-md/mdc file extensions like .txt, .ts, .png", () => {
    expect(parseRefs("@notes.txt and @script.ts and @img.png")).toEqual([]);
  });

  it("accepts directory paths without extensions", () => {
    expect(parseRefs("@./docs and @/var/docs/")).toEqual(["./docs", "/var/docs/"]);
  });
});

describe("resolveRef", () => {
  it("leaves absolute paths untouched", () => {
    expect(resolveRef("/foo/bar.md", "/base")).toBe("/foo/bar.md");
  });

  it("resolves tilde paths against homedir", () => {
    const home = os.homedir();
    expect(resolveRef("~/docs/guide.md", "/base")).toBe(path.join(home, "docs/guide.md"));
  });

  it("resolves relative paths against baseDir", () => {
    expect(resolveRef("docs/guide.md", "/base")).toBe(path.resolve("/base", "docs/guide.md"));
    expect(resolveRef("./docs/guide.md", "/base")).toBe(path.resolve("/base", "docs/guide.md"));
    expect(resolveRef("../other/guide.md", "/base/sub")).toBe(path.resolve("/base", "other/guide.md"));
  });
});

describe("getAllFilePathFromContextFiles and parseFileAndContent", () => {
  it("resolves files and expands directories skipping hidden and non-md files", () => {
    const tmp = createTmpDir();
    try {
      const docsDir = path.join(tmp, "docs");
      fs.mkdirSync(docsDir, { recursive: true });
      fs.writeFileSync(path.join(docsDir, "b_guide.md"), "Guide B");
      fs.writeFileSync(path.join(docsDir, "a_guide.mdc"), "Guide A");
      fs.writeFileSync(path.join(docsDir, ".hidden.md"), "Hidden");
      fs.writeFileSync(path.join(docsDir, "code.ts"), "TypeScript");

      const contextFiles = [
        {
          path: path.join(tmp, "AGENTS.md"),
          content: "See @./docs for rules.",
        },
      ];

      const resolved = getAllFilePathFromContextFiles(contextFiles);
      expect(resolved).toEqual([
        path.join(docsDir, "a_guide.mdc"),
        path.join(docsDir, "b_guide.md"),
      ]);

      const contents = parseFileAndContent(resolved);
      expect(contents).toHaveLength(2);
      expect(contents[0].content).toBe("Guide A");
      expect(contents[1].content).toBe("Guide B");

      const formatted = formatProjectReferences(contents);
      expect(formatted).toContain(`<project_references path="${path.join(docsDir, "a_guide.mdc")}">`);
      expect(formatted).toContain("Guide A");
      expect(formatted).toContain("Guide B");
      expect(formatted).toContain("</project_references>");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("skips files that exceed 100KB limit", () => {
    const tmp = createTmpDir();
    try {
      const bigFile = path.join(tmp, "big.md");
      fs.writeFileSync(bigFile, "x".repeat(MAX_FILE_SIZE + 10));

      const resolved = getAllFilePathFromContextFiles([
        { path: path.join(tmp, "AGENTS.md"), content: "@./big.md" },
      ]);
      expect(resolved).toEqual([]);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("expandPromptRefs", () => {
  it("leaves text without @ untouched", () => {
    const res = expandPromptRefs("Hello world", "/tmp");
    expect(res.expandedCount).toBe(0);
    expect(res.expandedText).toBe("Hello world");
  });

  it("expands valid @file.md in prompt text", () => {
    const tmp = createTmpDir();
    try {
      const doc = path.join(tmp, "doc.md");
      fs.writeFileSync(doc, "# Documentation Content");

      const prompt = `Please review @./doc.md carefully`;
      const res = expandPromptRefs(prompt, tmp);
      expect(res.expandedCount).toBe(1);
      expect(res.expandedText).toContain("Please review @./doc.md carefully");
      expect(res.expandedText).toContain(`<referenced_file path="${doc}">`);
      expect(res.expandedText).toContain("# Documentation Content");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
