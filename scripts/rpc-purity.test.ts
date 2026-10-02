import { describe, test, expect } from "bun:test";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

describe("RPC stdout purity", () => {
  test("stdout in --mode rpc contains zero non-JSON banners or greeting text", async () => {
    const launcher = resolve(import.meta.dir, "../bin/little-coder.ts");
    const child = spawn("bun", [launcher, "--mode", "rpc"], {
      env: { ...process.env, LITTLE_CODER_MODE: "rpc" },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdoutData = "";
    let stderrData = "";

    child.stdout.on("data", (chunk) => {
      stdoutData += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderrData += chunk.toString();
    });

    // Send RPC initialize request
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }) + "\n");

    // Wait for response
    await new Promise((res) => setTimeout(res, 3000));
    child.kill("SIGTERM");

    // Audit every line emitted to stdout
    const lines = stdoutData.trim().split("\n").filter((l) => l.trim().length > 0);
    for (const line of lines) {
      let parsed: unknown;
      expect(() => {
        parsed = JSON.parse(line);
      }).not.toThrow();
      expect(typeof parsed).toBe("object");
    }
  });
});
