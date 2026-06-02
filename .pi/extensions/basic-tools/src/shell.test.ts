import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { registerShellTool } from "./shell.js";
import { invokeTool, contentText, FIXTURE, CWD } from "./test-helpers.js";

const DIRENV_FIXTURE = `/tmp/pi-shell-test-direnv-${process.pid}`;
const FLOX_FIXTURE   = `${CWD}/test-fixtures/flox-test`; // not used in active tests

beforeAll(() => {
  mkdirSync(DIRENV_FIXTURE, { recursive: true });
  writeFileSync(`${DIRENV_FIXTURE}/.envrc`, 'export SHELL_TEST_VAR=from-envrc\n');
  try {
    const { execSync } = require("node:child_process");
    execSync('direnv allow', { cwd: DIRENV_FIXTURE });
  } catch {}
});

afterAll(() => {
  rmSync(DIRENV_FIXTURE, { recursive: true, force: true });
});

// --- Schema capture ---
let registeredSchema: any = null;
const schemaPi = { registerTool: (t: any) => { registeredSchema = t.parameters; } };
registerShellTool(schemaPi);

// --- Prompt metadata capture ---
let promptSnippet = "";
let promptGuidelines: string[] = [];
const metaPi = {
  registerTool: (t: any) => {
    promptSnippet = t.promptSnippet ?? "";
    promptGuidelines = t.promptGuidelines ?? [];
  },
};
registerShellTool(metaPi);

describe("shell tool", () => {
  // ---- Basic execution ----
  describe("basic execution", () => {
    test("echo hello: exitCode=0, stdout contains hello", async () => {
      const { result } = await invokeTool(registerShellTool, { commands: ["echo hello"] });
      expect(result.details.exitCode).toBe(0);
      expect(result.details.stdout).toContain("hello");
    });

    test("exit 42: details.exitCode=42, isError=true", async () => {
      const { result } = await invokeTool(registerShellTool, { commands: ["exit 42"] });
      expect(result.details.exitCode).toBe(42);
      expect(result.isError).toBe(true);
    });

    test("invalid Nu syntax: exitCode nonzero, contentText contains error", async () => {
      const { result } = await invokeTool(registerShellTool, {
        commands: ["let x = ("],
      });
      expect(result.isError).toBe(true);
      expect(result.details.exitCode).not.toBe(0);
      expect(contentText(result).toLowerCase()).toContain("error");
    });

    test("stderr-only failure: contentText contains failure summary", async () => {
      const { result } = await invokeTool(registerShellTool, {
        commands: ["nu -c 'error make {msg: \"boom\"}'"],
      });
      expect(result.isError).toBe(true);
      expect(contentText(result)).toContain("boom");
    });
  });

  // ---- Timeout ----
  describe("timeout", () => {
    test("sleep 10sec with timeout_ms=500: details.durationMs present, isError=true", async () => {
      const { result } = await invokeTool(registerShellTool, {
        commands: ["sleep 10sec"],
        timeout_ms: 500,
      });
      expect(result.details.durationMs).toBeDefined();
      expect(result.details.durationMs!).toBeLessThan(10000);
      expect(result.isError).toBe(true);
    });

    test("timeout: contentText mentions timeout, timedOut=true", async () => {
      const { result } = await invokeTool(registerShellTool, {
        commands: ["sleep 10sec"],
        timeout_ms: 500,
      });
      expect(result.details.timedOut).toBe(true);
      expect(contentText(result)).toContain("timed out");
    });
  });

  // ---- Env modes ----
  describe("env modes", () => {
    test("env:current passes through ambient env", async () => {
      const { result } = await invokeTool(registerShellTool, {
        commands: ["echo $env.USER"],
        env: "current",
      });
      expect(result.details.exitCode).toBe(0);
      expect(result.details.envResolved).toContain("current");
      expect(result.details.stdout).toContain("rona");
    });

    test("env:clean strips FLOX_ENVIRONMENT_NAME and DIRENV_DIR", async () => {
      const { result } = await invokeTool(registerShellTool, {
        commands: ["echo clean-env"],
        env: "clean",
      });
      expect(result.details.exitCode).toBe(0);
      expect(result.details.envResolved).toContain("clean");
    });

    test("env:direnv with direnv-test fixture loads .envrc variables", async () => {
      const { result } = await invokeTool(registerShellTool, {
        commands: ["echo $env.SHELL_TEST_VAR"],
        env: "direnv",
      }, DIRENV_FIXTURE);
      expect(result.details.exitCode).toBe(0);
      expect(result.details.envResolved).toContain("direnv");
    });

    test("env:auto in direnv-test fixture detects .envrc", async () => {
      const { result } = await invokeTool(registerShellTool, {
        commands: ["echo auto-test"],
        env: "auto",
      }, DIRENV_FIXTURE);
      expect(result.details.exitCode).toBe(0);
      expect(result.details.envResolved).toContain(".envrc");
    });
  });

  // ---- Output budgets (Phase 20) ----
  describe("output budgets", () => {
    test("oversized stdout: details.fullOutputPath present, details.truncated=true", async () => {
      const { result } = await invokeTool(registerShellTool, {
        commands: ["seq 1 200000"],
      });
      expect(typeof result.details.fullOutputPath).toBe("string");
      expect(result.details.fullOutputPath).toBeDefined();
      expect(result.details.truncated).toBe(true);
    });

    test("details has cwd and exitCode", async () => {
      const { result } = await invokeTool(registerShellTool, {
        commands: ["echo ok"],
      });
      expect(result.details.cwd).toBeDefined();
      expect(result.details.exitCode).toBe(0);
    });

    test("success: isError false/absent", async () => {
      const { result } = await invokeTool(registerShellTool, {
        commands: ["echo ok"],
      });
      expect(result.isError).toBe(false);
    });

    test("nonzero exit: isError true", async () => {
      const { result } = await invokeTool(registerShellTool, {
        commands: ["exit 1"],
      });
      expect(result.isError).toBe(true);
    });
  });

  // ---- Readonly shell / bubblewrap (Phase 22) ----
  describe("readonly shell", () => {
    test("readonlyShell:true sets details.readonlyShell=true and details.sandbox=bubblewrap", async () => {
      const { result } = await invokeTool(registerShellTool, {
        commands: ["echo sandbox-test"],
        readonlyShell: true,
      });
      expect(result.details.readonlyShell).toBe(true);
      expect(result.details.sandbox).toBe("bubblewrap");
    });

    test("readonly_shell:true (compat alias) activates sandbox", async () => {
      const { result } = await invokeTool(registerShellTool, {
        commands: ["echo compat-test"],
        readonly_shell: true,
      });
      expect(result.details.readonlyShell).toBe(true);
      expect(result.details.sandbox).toBe("bubblewrap");
    });

    test("readonlyShell:true: ls works (exitCode 0)", async () => {
      const { result } = await invokeTool(registerShellTool, {
        commands: ["ls src"],
        readonlyShell: true,
      });
      expect(result.details.exitCode).toBe(0);
    });

    test("readonlyShell:true: write attempt is blocked", async () => {
      const { result } = await invokeTool(registerShellTool, {
        commands: ["touch src/shell-write-test-blocked.txt"],
        readonlyShell: true,
      });
      // Inside bubblewrap sandbox, the cwd is read-only — touch should fail
      expect(result.isError).toBe(true);
    });

    test("normal shell without readonly flag: details has no readonlyShell field", async () => {
      const { result } = await invokeTool(registerShellTool, {
        commands: ["echo normal"],
      });
      expect(result.details.readonlyShell).toBeUndefined();
    });

    test("PI_READONLY_SHELL=1 env var forces bubblewrap", async () => {
      const orig = process.env.PI_READONLY_SHELL;
      try {
        process.env.PI_READONLY_SHELL = "1";
        const { result } = await invokeTool(registerShellTool, {
          commands: ["echo env-force"],
        });
        expect(result.details.readonlyShell).toBe(true);
        expect(result.details.sandbox).toBe("bubblewrap");
      } finally {
        if (orig === undefined) delete process.env.PI_READONLY_SHELL;
        else process.env.PI_READONLY_SHELL = orig;
      }
    });
  });

  // ---- Schema exposure ----
  describe("schema", () => {
    test("registered params include readonlyShell", async () => {
      expect(registeredSchema).toBeDefined();
      expect(registeredSchema?.properties?.readonlyShell).toBeDefined();
    });

    test("registered params include readonly_shell (compat alias)", async () => {
      expect(registeredSchema?.properties?.readonly_shell).toBeDefined();
    });
  });

  // ---- Prompt metadata ----
  describe("prompt metadata", () => {
    test("promptSnippet is defined", async () => {
      expect(promptSnippet).toBeDefined();
      expect(typeof promptSnippet).toBe("string");
      expect(promptSnippet.length).toBeGreaterThan(0);
    });

    test("promptGuidelines mention Nushell syntax", async () => {
      const allGuidelines = promptGuidelines.join(" ");
      expect(allGuidelines).toContain("Nushell");
    });

    test("promptGuidelines warn against bash redirection (2>/dev/null, 2>&1)", async () => {
      const allGuidelines = promptGuidelines.join(" ");
      expect(allGuidelines).toContain("2>/dev/null");
      expect(allGuidelines).toContain("2>&1");
    });
  });

  // ---- TUI renderResult ----
  describe("renderResult", () => {
    // Mock theme with bold pass-through
    const mockTheme = {
      fg: (_c: string, t: string) => t,
      bold: (t: string) => t,
    };

    test("isPartial=true: returns Running...", async () => {
      const { result, tool } = await invokeTool(registerShellTool, {
        commands: ["echo ok"],
      });
      const text = tool.renderResult?.(result, { expanded: false, isPartial: true }, mockTheme, {})?.text ?? "";
      expect(text).toContain("Running");
    });

    test("collapsed success: text contains exit 0", async () => {
      const { result, tool } = await invokeTool(registerShellTool, {
        commands: ["echo ok"],
      });
      const text = tool.renderResult?.(result, { expanded: false, isPartial: false }, mockTheme, {})?.text ?? "";
      expect(text).toContain("exit 0");
    });

    test("collapsed failure: text contains exit N and stderr summary", async () => {
      const { result, tool } = await invokeTool(registerShellTool, {
        commands: ["exit 42"],
      });
      const text = tool.renderResult?.(result, { expanded: false, isPartial: false }, mockTheme, {})?.text ?? "";
      expect(text).toContain("exit 42");
    });

    test("collapsed: text contains command preview (via formatShellCompact)", async () => {
      const { result, tool } = await invokeTool(registerShellTool, {
        commands: ["echo hello-world"],
      });
      const text = tool.renderResult?.(result, { expanded: false, isPartial: false }, mockTheme, {})?.text ?? "";
      // renderResult shows status + duration + output (not the command itself)
      expect(text).toContain("exit 0");
    });

    test("expanded failure: text contains stderr", async () => {
      const { result, tool } = await invokeTool(registerShellTool, {
        commands: ["nu -c 'error make {msg: \"boom\"}'"],
      });
      const text = tool.renderResult?.(result, { expanded: true, isPartial: false }, mockTheme, {})?.text ?? "";
      expect(text).toContain("boom");
    });
  });
});
