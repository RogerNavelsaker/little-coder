#!/usr/bin/env bun
// little-coder launcher — Nix-native Pi distribution launcher.
//
// Dev mode  (bun bin/little-coder.ts): pkgRoot = repo root, pi via bun + node_modules.
// Nix mode  (wrapped binary):         pkgRoot = Nix share dir, pi & rg via nixpkgs PATH.

import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Mode detection
//
// process.argv[1] ends with .ts when bun runs source directly (dev mode).
// In a compiled bun binary process.argv[1] is the binary path itself.
// ---------------------------------------------------------------------------
const isDev = Boolean(process.argv[1]?.match(/\.(m?ts|tsx)$/));

// ---------------------------------------------------------------------------
// RPC mode detection & stdout purity guard
//
// In Warren container / RPC mode (--mode rpc), stdout is strictly reserved
// for JSON-RPC messages between Pi and Warren. Any stdout pollution corrupts
// the handshake. All launcher logs/diagnostics are diverted to stderr.
// ---------------------------------------------------------------------------
function checkRpcMode(): boolean {
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === "--mode" && process.argv[i + 1] === "rpc") return true;
    if (arg === "--mode=rpc") return true;
    if (arg === "-m" && process.argv[i + 1] === "rpc") return true;
    if (arg === "-m=rpc") return true;
  }
  return process.env.LITTLE_CODER_MODE === "rpc";
}

const isRpc = checkRpcMode();
if (isRpc) {
  console.log = (...args: unknown[]) => { console.error(...args); };
  console.info = (...args: unknown[]) => { console.error(...args); };
  process.env.PI_SKIP_VERSION_CHECK = "1";
}

// ---------------------------------------------------------------------------
// Root / Share directories
//
// Dev:      repo root (sibling of this file)
// Nix:      LITTLE_CODER_SHARE or ../share/little-coder
// ---------------------------------------------------------------------------
const nixShare = process.env.LITTLE_CODER_SHARE
  ?? resolve(dirname(process.execPath), "..", "share", "little-coder");

const pkgRoot = isDev
  ? resolve(dirname(fileURLToPath(import.meta.url)), "..")
  : nixShare;

// ---------------------------------------------------------------------------
// Path utilities
// ---------------------------------------------------------------------------
function findOnPath(name: string): string | null {
  const PATH = (process.env.PATH ?? "").split(":");
  for (const d of PATH) {
    const p = join(d, name);
    if (existsSync(p)) return p;
  }
  return null;
}

function findBun(): string {
  if (isDev) return process.execPath;
  const b = findOnPath("bun");
  if (b) return b;
  console.error("little-coder: bun not found in PATH. Install bun: https://bun.sh");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Subcommand dispatch
// ---------------------------------------------------------------------------
const sub = process.argv[2];
if (sub === "install" || sub === "uninstall" || sub === "update") {
  console.log("Managed by Nix");
  process.exit(0);
}
if (sub === "version") {
  await cmdVersion();
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Guard: shared assets directory must exist in Nix mode
// ---------------------------------------------------------------------------
if (!isDev && !existsSync(pkgRoot)) {
  console.error(`little-coder: shared assets directory not found at ${pkgRoot}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Dependency verification (ripgrep)
// ---------------------------------------------------------------------------
if (!isDev) {
  const rg = findOnPath("rg");
  if (!rg) {
    console.error("little-coder: ripgrep ('rg') not found in PATH. Ensure ripgrep is available via nixpkgs or wrapper.");
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// pi entry point
//
// Dev:      bun + node_modules/@earendil-works/pi-coding-agent bin entry
// Installed: PATH pi or LITTLE_CODER_PI_BIN (populated via nixpkgs makeBinaryWrapper)
// ---------------------------------------------------------------------------
let piCmd: string;
let piCmdArgs: string[] = [];

if (isDev) {
  const piPkgRoot = join(pkgRoot, "node_modules", "@earendil-works", "pi-coding-agent");
  let piEntry: string;
  try {
    const piPkgJson = JSON.parse(readFileSync(join(piPkgRoot, "package.json"), "utf-8"));
    const binRel = typeof piPkgJson?.bin === "string" ? piPkgJson.bin : piPkgJson?.bin?.pi;
    if (typeof binRel !== "string") throw new Error("pi package.json has no bin.pi entry");
    piEntry = resolve(piPkgRoot, binRel);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`little-coder: cannot resolve pi under ${piPkgRoot}.\n${msg}`);
    process.exit(1);
  }
  if (!existsSync(piEntry)) {
    console.error(`little-coder: pi entry not found at ${piEntry}`);
    process.exit(1);
  }

  // Apply patches in dev mode (baked into vendored binary at build time)
  try {
    const patchScript = join(pkgRoot, "scripts", "patch-pi.ts");
    if (existsSync(patchScript)) {
      const { applyPiPatches } = await import(patchScript);
      applyPiPatches(piPkgRoot);
    }
  } catch { /* non-fatal */ }

  // Merge quietStartup + lastChangelogVersion into pi settings
  try {
    const agentDirEnv = process.env.PI_CODING_AGENT_DIR;
    let agentDir: string;
    if (agentDirEnv?.trim()) {
      agentDir = agentDirEnv === "~" ? homedir()
        : agentDirEnv.startsWith("~/") ? join(homedir(), agentDirEnv.slice(2))
        : agentDirEnv;
    } else {
      agentDir = join(homedir(), ".pi", "agent");
    }
    mkdirSync(agentDir, { recursive: true });
    const settingsPath = join(agentDir, "settings.json");
    let s: Record<string, unknown> = {};
    if (existsSync(settingsPath)) {
      try { const p = JSON.parse(readFileSync(settingsPath, "utf-8")); if (p && typeof p === "object") s = p; } catch { s = {}; }
    }
    let dirty = false;
    if (s.quietStartup !== true) { s.quietStartup = true; dirty = true; }
    let piVer: string | undefined;
    try { piVer = JSON.parse(readFileSync(join(piPkgRoot, "package.json"), "utf-8"))?.version; } catch { /* ok */ }
    if (piVer && s.lastChangelogVersion !== piVer) { s.lastChangelogVersion = piVer; dirty = true; }
    if (dirty) writeFileSync(settingsPath, JSON.stringify(s, null, 2));
  } catch { /* best-effort */ }

  piCmd = findBun();
  piCmdArgs = [piEntry];
} else {
  // Installed Nix mode: resolve pi from PATH or LITTLE_CODER_PI_BIN
  const piFromEnv = process.env.LITTLE_CODER_PI_BIN;
  const piOnPath = findOnPath("pi");

  if (piFromEnv && existsSync(piFromEnv)) {
    piCmd = piFromEnv;
  } else if (piOnPath) {
    piCmd = piOnPath;
  } else {
    console.error("little-coder: 'pi' not found in PATH. Ensure pi is available via nixpkgs or wrapper.");
    process.exit(1);
  }
}

// Auto-discover extensions under pkgRoot/extensions or pkgRoot/.pi/extensions
const extDir = existsSync(join(pkgRoot, "extensions"))
  ? join(pkgRoot, "extensions")
  : join(pkgRoot, ".pi", "extensions");
const extArgs: string[] = [];
if (existsSync(extDir)) {
  for (const name of readdirSync(extDir).sort()) {
    if (name.startsWith("_")) continue;
    const subdir = join(extDir, name);
    // Prefer pre-compiled index.js (faster startup); fall back to index.ts for dev
    const idx = existsSync(join(subdir, "index.js"))
      ? join(subdir, "index.js")
      : join(subdir, "index.ts");
    try {
      if (statSync(subdir).isDirectory() && existsSync(idx)) {
        extArgs.push("--extension", idx);
      }
    } catch { /* skip unreadable */ }
  }
}

// Quiet pi's own version banner
if (process.env.PI_SKIP_VERSION_CHECK === undefined || isRpc) {
  process.env.PI_SKIP_VERSION_CHECK = "1";
}

// Set default PI_NUSHELL_CONFIG if not already defined
if (!process.env.PI_NUSHELL_CONFIG) {
  const defaultNuConfig = join(pkgRoot, ".pi", "nushell", "config.nu");
  if (existsSync(defaultNuConfig)) {
    process.env.PI_NUSHELL_CONFIG = defaultNuConfig;
  }
}

// Compose argv and spawn pi
const userArgs = process.argv.slice(2);
const agentsMd = join(pkgRoot, "AGENTS.md");
const piArgs = [
  "--no-context-files",
  "--no-extensions",
  ...(existsSync(agentsMd) ? ["--system-prompt", agentsMd] : []),
  ...extArgs,
  ...userArgs,
];

const child = spawn(piCmd, [...piCmdArgs, ...piArgs], {
  stdio: "inherit",
  cwd: process.cwd(),
  env: process.env,
});

const fwd = (sig: NodeJS.Signals) => () => { try { child.kill(sig); } catch { /* gone */ } };
process.on("SIGINT",  fwd("SIGINT"));
process.on("SIGTERM", fwd("SIGTERM"));
process.on("SIGHUP",  fwd("SIGHUP"));
child.on("error", (err) => { console.error("little-coder: failed to start pi:", err.message); process.exit(1); });
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});

// ===========================================================================
// Commands
// ===========================================================================

async function cmdVersion() {
  const pkgJson = join(pkgRoot, "package.json");
  const ver = existsSync(pkgJson)
    ? (JSON.parse(readFileSync(pkgJson, "utf-8")) as { version: string }).version
    : "unknown";
  console.log(`little-coder ${ver}`);
}
