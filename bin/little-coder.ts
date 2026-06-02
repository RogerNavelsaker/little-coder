#!/usr/bin/env bun
// little-coder launcher — install/update/uninstall + pi dispatch.
//
// Dev mode  (bun bin/little-coder.ts): pkgRoot = repo root, runtime = bun itself.
// Compiled  (bun build --compile):     pkgRoot = ~/.little-coder, runtime = bun in PATH.

import { spawn, spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { arch, homedir, platform } from "node:os";
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
// Data directory
//
// Dev:      repo root  (sibling of this file)
// Compiled: ~/.little-coder  (or LITTLE_CODER_HOME env override)
// ---------------------------------------------------------------------------
const DATA_HOME = process.env.LITTLE_CODER_HOME ?? join(homedir(), ".little-coder");
const pkgRoot = isDev
  ? resolve(dirname(fileURLToPath(import.meta.url)), "..")
  : DATA_HOME;

// ---------------------------------------------------------------------------
// Bun runtime
//
// Dev:      process.execPath IS bun.
// Compiled: process.execPath is our binary; find bun separately in PATH.
// ---------------------------------------------------------------------------
function findBun(): string {
  if (isDev) return process.execPath;
  const PATH = (process.env.PATH ?? "").split(":");
  for (const d of PATH) {
    const b = join(d, "bun");
    if (existsSync(b)) return b;
  }
  console.error("little-coder: bun not found in PATH. Install bun: https://bun.sh");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// GitHub release coordinates
// ---------------------------------------------------------------------------
const REPO = "RogerNavelsaker/little-coder";
const GH_API = `https://api.github.com/repos/${REPO}`;
const GH_DL = `https://github.com/${REPO}/releases/download`;

function binaryAsset(tag: string): string {
  const os = { linux: "linux", darwin: "darwin" }[platform()];
  const cpu = { x64: "x64", arm64: "arm64", aarch64: "arm64" }[arch()];
  if (!os || !cpu) {
    console.error(`little-coder: unsupported platform ${platform()}-${arch()}`);
    process.exit(1);
  }
  return `${GH_DL}/${tag}/little-coder-${os}-${cpu}`;
}

function dataAsset(tag: string): string {
  return `${GH_DL}/${tag}/data.tar.gz`;
}

// ---------------------------------------------------------------------------
// Subcommand dispatch — must come before any pi-launch logic
// ---------------------------------------------------------------------------
const sub = process.argv[2];
if (sub === "install")   { await cmdInstall(process.argv.slice(3));   process.exit(0); }
if (sub === "uninstall") { await cmdUninstall(process.argv.slice(3)); process.exit(0); }
if (sub === "update")    { await cmdUpdate(process.argv.slice(3));    process.exit(0); }
if (sub === "version")   { await cmdVersion();                        process.exit(0); }

// ---------------------------------------------------------------------------
// Guard: compiled binary requires data dir to exist
// ---------------------------------------------------------------------------
if (!isDev && !existsSync(DATA_HOME)) {
  console.error(`little-coder: data directory not found at ${DATA_HOME}`);
  console.error(`Run: little-coder install`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// pi entry point
// ---------------------------------------------------------------------------
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
  if (!isDev) console.error("Try: little-coder update");
  process.exit(1);
}
if (!existsSync(piEntry)) {
  console.error(`little-coder: pi entry not found at ${piEntry}`);
  process.exit(1);
}

// Re-apply patches (best-effort, cosmetic only)
try {
  const patchScript = join(pkgRoot, "scripts", "patch-pi.ts");
  if (existsSync(patchScript)) {
    const { applyPiPatches } = await import(patchScript);
    applyPiPatches(piPkgRoot);
  }
} catch { /* non-fatal */ }

// Auto-discover extensions under pkgRoot/.pi/extensions/*/index.ts
const extDir = join(pkgRoot, ".pi", "extensions");
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
if (process.env.PI_SKIP_VERSION_CHECK === undefined) {
  process.env.PI_SKIP_VERSION_CHECK = "1";
}

// Merge quietStartup + lastChangelogVersion into ~/.pi/agent/settings.json
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

// Compose argv and spawn pi
const userArgs = process.argv.slice(isDev ? 2 : 2);
const agentsMd = join(pkgRoot, "AGENTS.md");
const piArgs = [
  "--no-context-files",
  "--no-extensions",
  ...(existsSync(agentsMd) ? ["--system-prompt", agentsMd] : []),
  ...extArgs,
  ...userArgs,
];

const bun = findBun();
const child = spawn(bun, [piEntry, ...piArgs], {
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
  const pkgJson = join(isDev ? pkgRoot : DATA_HOME, "package.json");
  const ver = existsSync(pkgJson)
    ? (JSON.parse(readFileSync(pkgJson, "utf-8")) as { version: string }).version
    : "unknown";
  const pinned = join(DATA_HOME, ".version");
  const tag = existsSync(pinned) ? readFileSync(pinned, "utf-8").trim() : ver;
  console.log(`little-coder ${tag}`);
}

async function cmdInstall(args: string[]) {
  const force = args.includes("--force") || args.includes("-f");

  if (existsSync(DATA_HOME) && !force) {
    try {
      if (readdirSync(DATA_HOME).length > 0) {
        console.error(`little-coder: ${DATA_HOME} already exists. Use --force to overwrite or 'update' to upgrade.`);
        process.exit(1);
      }
    } catch { /* readable check failed — proceed */ }
  }

  console.log(`Installing little-coder to ${DATA_HOME}...`);
  mkdirSync(DATA_HOME, { recursive: true });

  const tag = await fetchLatestTag();
  await downloadData(tag, DATA_HOME);
  runBunInstall(DATA_HOME);
  writeFileSync(join(DATA_HOME, ".version"), tag);

  console.log(`\nlittle-coder ${tag} installed.`);
}

async function cmdUninstall(_args: string[]) {
  if (!existsSync(DATA_HOME)) {
    console.log(`Nothing to uninstall — ${DATA_HOME} not found.`);
    return;
  }
  rmSync(DATA_HOME, { recursive: true, force: true });
  console.log(`Removed ${DATA_HOME}`);
  console.log(`Binary kept. To remove: rm $(which little-coder)`);
}

async function cmdUpdate(_args: string[]) {
  const pinned = join(DATA_HOME, ".version");
  const current = existsSync(pinned) ? readFileSync(pinned, "utf-8").trim() : "(unknown)";
  const tag = await fetchLatestTag();

  if (tag === current) {
    console.log(`Already up to date (${tag}).`);
    return;
  }

  console.log(`Updating ${current} → ${tag}...`);
  mkdirSync(DATA_HOME, { recursive: true });
  await downloadData(tag, DATA_HOME);
  runBunInstall(DATA_HOME);
  writeFileSync(pinned, tag);

  if (!isDev) await updateBinary(tag);

  console.log(`\nUpdated to ${tag}.`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchLatestTag(): Promise<string> {
  const res = await fetch(`${GH_API}/releases/latest`, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "little-coder" },
  });
  if (!res.ok) {
    console.error(`little-coder: GitHub API error ${res.status}`);
    process.exit(1);
  }
  const { tag_name } = await res.json() as { tag_name: string };
  return tag_name;
}

async function downloadData(tag: string, dest: string) {
  const url = dataAsset(tag);
  const tmp = join(dest, ".data.tar.gz.tmp");
  console.log(`  Downloading data archive...`);
  await downloadFile(url, tmp);
  console.log(`  Extracting...`);
  const r = spawnSync("tar", ["-xzf", tmp, "--strip-components=1", "-C", dest], { stdio: "inherit" });
  rmSync(tmp, { force: true });
  if (r.status !== 0) { console.error("little-coder: tar extraction failed"); process.exit(1); }
}

async function downloadFile(url: string, dest: string) {
  const res = await fetch(url, { headers: { "User-Agent": "little-coder" } });
  if (!res.ok) { console.error(`little-coder: download failed ${url} (${res.status})`); process.exit(1); }
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

function runBunInstall(cwd: string) {
  console.log(`  Running bun install...`);
  const r = spawnSync(findBun(), ["install", "--frozen-lockfile"], { cwd, stdio: "inherit" });
  if (r.status !== 0) { console.error("little-coder: bun install failed"); process.exit(1); }
}

async function updateBinary(tag: string) {
  const url = binaryAsset(tag);
  const self = process.execPath;
  const tmp = `${self}.new`;
  console.log(`  Updating binary...`);
  try {
    await downloadFile(url, tmp);
    chmodSync(tmp, 0o755);
    renameSync(tmp, self);
  } catch (err: unknown) {
    rmSync(tmp, { force: true });
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`  Warning: binary update skipped (${msg}). Re-run install.sh to update.`);
  }
}
