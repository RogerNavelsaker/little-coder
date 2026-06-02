#!/usr/bin/env bun
// Build release artifacts:
//   dist/little-coder-<os>-<cpu>    compiled little-coder launcher binary
//   dist/pi-<os>-<cpu>              compiled pi runtime binary (patches baked in)
//   dist/data.tar.gz                cross-platform data archive (extensions, AGENTS.md, skills)
//
// Usage:
//   bun scripts/build-release.ts              # all artifacts (current platform)
//   bun scripts/build-release.ts --data-only  # data archive only (CI cross-build)
//   bun scripts/build-release.ts --bin-only   # launcher + pi binaries only

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { arch, platform } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(import.meta.url), "../..");
const dist = join(root, "dist");
mkdirSync(dist, { recursive: true });

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));
const version: string = pkg.version;

const dataOnly = process.argv.includes("--data-only");
const binOnly  = process.argv.includes("--bin-only");

// ---------------------------------------------------------------------------
// Platform
// ---------------------------------------------------------------------------
const osName   = ({ linux: "linux", darwin: "darwin" } as Record<string, string>)[platform()] ?? platform();
const cpuName  = ({ x64: "x64", arm64: "arm64", aarch64: "arm64" } as Record<string, string>)[arch()] ?? arch();
const bunTarget = `bun-${osName}-${cpuName}`;

// ---------------------------------------------------------------------------
// 1. Compile little-coder launcher binary
// ---------------------------------------------------------------------------
if (!dataOnly) {
  const outfile = join(dist, `little-coder-${osName}-${cpuName}`);
  console.log(`\nCompiling launcher → ${outfile}`);
  const r = spawnSync("bun", [
    "build",
    "--compile",
    `--target=${bunTarget}`,
    "--bytecode",
    "--minify",
    "--format=esm",
    "bin/little-coder.ts",
    "--outfile", outfile,
  ], { cwd: root, stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

// ---------------------------------------------------------------------------
// 2. Patch + compile pi runtime binary
//
//    Patches are applied to pi's dist files before compilation so they are
//    baked into the binary — no postinstall or runtime patching needed.
// ---------------------------------------------------------------------------
if (!dataOnly) {
  console.log(`\nPatching pi dist...`);
  const piPkgRoot = join(root, "node_modules", "@earendil-works", "pi-coding-agent");
  if (!existsSync(piPkgRoot)) {
    console.error(`  pi package not found at ${piPkgRoot} — run bun install first`);
    process.exit(1);
  }
  try {
    const { applyPiPatches } = await import(join(root, "scripts", "patch-pi.ts"));
    applyPiPatches(piPkgRoot);
    console.log(`  Patches applied.`);
  } catch (e) {
    console.warn(`  Warning: patch step failed (${e}). Building unpatched pi.`);
  }

  // Resolve pi's bin entry
  const piPkgJson = JSON.parse(readFileSync(join(piPkgRoot, "package.json"), "utf-8"));
  const binRel = typeof piPkgJson?.bin === "string" ? piPkgJson.bin : piPkgJson?.bin?.pi;
  if (typeof binRel !== "string") {
    console.error("  pi package.json has no bin.pi entry");
    process.exit(1);
  }
  const piEntry = join(piPkgRoot, binRel);
  if (!existsSync(piEntry)) {
    console.error(`  pi entry not found: ${piEntry}`);
    process.exit(1);
  }

  const piOutfile = join(dist, `pi-${osName}-${cpuName}`);
  console.log(`\nCompiling pi runtime → ${piOutfile}`);
  const r = spawnSync("bun", [
    "build",
    "--compile",
    `--target=${bunTarget}`,
    "--bytecode",
    "--minify",
    "--format=esm",
    piEntry,
    "--outfile", piOutfile,
  ], { cwd: root, stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (binOnly) process.exit(0);

// ---------------------------------------------------------------------------
// 3. Pre-compile extensions
//
//    All dependencies (typebox, toon, diff, pi-tui) are BUNDLED inline.
//    The installed data dir has no node_modules — extensions must be
//    self-contained. Only relative src/* imports are inlined automatically.
//
//    pi-coding-agent is type-only in extensions; bun tree-shakes it away.
// ---------------------------------------------------------------------------
const extSrc  = join(root, ".pi", "extensions");
const extDist = join(dist, "extensions");

console.log("\nPre-compiling extensions...");
for (const name of readdirSync(extSrc).sort()) {
  if (name.startsWith("_")) continue;
  const subdir = join(extSrc, name);
  if (!statSync(subdir).isDirectory()) continue;
  const entry = join(subdir, "index.ts");
  if (!existsSync(entry)) continue;

  const outDir = join(extDist, name);
  mkdirSync(outDir, { recursive: true });

  console.log(`  ${name}`);
  const r = spawnSync("bun", [
    "build",
    entry,
    "--outfile", join(outDir, "index.js"),
    "--format=esm",
    "--target=bun",
    "--minify",
    // No --external flags: pi-tui, typebox, toon, diff all bundled inline.
    // pi-coding-agent usage in extensions is type-only; tree-shaken away.
  ], { cwd: root, stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`  Error compiling ${name}`);
    process.exit(r.status ?? 1);
  }
}

// ---------------------------------------------------------------------------
// 4. Data archive (cross-platform — no pi binary inside)
//
//    Contains: compiled extensions, AGENTS.md, skills/, .pi/settings.json,
//              models.json, vendor/ source (provenance).
//    Does NOT contain: node_modules, package.json, bun.lock, pi binaries.
//    pi binary is a separate per-platform release asset (pi-<os>-<cpu>).
// ---------------------------------------------------------------------------
const dataOut = join(dist, "data.tar.gz");
console.log(`\nBuilding data archive → ${dataOut}`);

const stageDir = join(dist, ".stage");
const { execSync } = await import("node:child_process");
const { rmSync, cpSync, writeFileSync, copyFileSync } = await import("node:fs");

rmSync(stageDir, { recursive: true, force: true });
mkdirSync(join(stageDir, "data", ".pi", "extensions"), { recursive: true });

// AGENTS.md
if (existsSync(join(root, "AGENTS.md"))) {
  copyFileSync(join(root, "AGENTS.md"), join(stageDir, "data", "AGENTS.md"));
}

// models.json
if (existsSync(join(root, "models.json"))) {
  copyFileSync(join(root, "models.json"), join(stageDir, "data", "models.json"));
}

// .pi/settings.json
const piSettings = join(root, ".pi", "settings.json");
if (existsSync(piSettings)) {
  mkdirSync(join(stageDir, "data", ".pi"), { recursive: true });
  copyFileSync(piSettings, join(stageDir, "data", ".pi", "settings.json"));
}

// skills/ (for skill-inject)
const skillsDir = join(root, "skills");
if (existsSync(skillsDir)) {
  cpSync(skillsDir, join(stageDir, "data", "skills"), { recursive: true });
}

// vendor/ source (provenance; excludes vendor/pi/ which is a build artifact)
const vendorSrc = join(root, "vendor");
if (existsSync(vendorSrc)) {
  mkdirSync(join(stageDir, "data", "vendor"), { recursive: true });
  for (const name of readdirSync(vendorSrc)) {
    if (name === "pi") continue; // pi binaries are separate release assets
    const src = join(vendorSrc, name);
    if (statSync(src).isDirectory()) {
      cpSync(src, join(stageDir, "data", "vendor", name), { recursive: true });
    }
  }
}

// Extensions: use compiled index.js
for (const name of readdirSync(extDist)) {
  const compiledIndex = join(extDist, name, "index.js");
  if (!existsSync(compiledIndex)) continue;
  mkdirSync(join(stageDir, "data", ".pi", "extensions", name), { recursive: true });
  copyFileSync(compiledIndex, join(stageDir, "data", ".pi", "extensions", name, "index.js"));
}

// Pack
const tarR = spawnSync("tar", ["-czf", dataOut, "-C", stageDir, "data"], { stdio: "inherit" });
rmSync(stageDir, { recursive: true, force: true });
if (tarR.status !== 0) { console.error("tar failed"); process.exit(1); }

// ---------------------------------------------------------------------------
// 5. Summary
// ---------------------------------------------------------------------------
console.log(`\nRelease artifacts for v${version}:`);
for (const f of [
  !dataOnly && join(dist, `little-coder-${osName}-${cpuName}`),
  !dataOnly && join(dist, `pi-${osName}-${cpuName}`),
  dataOut,
].filter(Boolean) as string[]) {
  if (existsSync(f)) {
    const sz = (statSync(f).size / 1024 / 1024).toFixed(1);
    console.log(`  ${f.replace(root + "/", "")}  (${sz} MB)`);
  }
}
