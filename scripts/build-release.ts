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

const binOnly = process.argv.includes("--bin-only");

// ---------------------------------------------------------------------------
// Platform
// ---------------------------------------------------------------------------
const osName   = ({ linux: "linux", darwin: "darwin" } as Record<string, string>)[platform()] ?? platform();
const cpuName  = ({ x64: "x64", arm64: "arm64", aarch64: "arm64" } as Record<string, string>)[arch()] ?? arch();
const bunTarget = `bun-${osName}-${cpuName}`;

// ---------------------------------------------------------------------------
// 1. Compile little-coder launcher binary
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// 2. Patch + compile pi runtime binary
//
//    Patches are applied to pi's dist files before compilation so they are
//    baked into the binary — no postinstall or runtime patching needed.
// ---------------------------------------------------------------------------
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
const rPi = spawnSync("bun", [
  "build",
  "--compile",
  `--target=${bunTarget}`,
  "--bytecode",
  "--minify",
  "--format=esm",
  piEntry,
  "--outfile", piOutfile,
], { cwd: root, stdio: "inherit" });
if (rPi.status !== 0) process.exit(rPi.status ?? 1);

if (binOnly) process.exit(0);

// ---------------------------------------------------------------------------
// 3. Pre-compile extensions to dist/extensions/
//
//    All dependencies (typebox, toon, diff, pi-tui) are BUNDLED inline.
//    Nix and distribution load directly from store share path.
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
  const rExt = spawnSync("bun", [
    "build",
    entry,
    "--outfile", join(outDir, "index.js"),
    "--format=esm",
    "--target=bun",
    "--minify",
  ], { cwd: root, stdio: "inherit" });
  if (rExt.status !== 0) {
    console.error(`  Error compiling ${name}`);
    process.exit(rExt.status ?? 1);
  }
}

// ---------------------------------------------------------------------------
// 4. Summary
// ---------------------------------------------------------------------------
console.log(`\nRelease artifacts for v${version}:`);
for (const f of [outfile, piOutfile]) {
  if (existsSync(f)) {
    const sz = (statSync(f).size / 1024 / 1024).toFixed(1);
    console.log(`  ${f.replace(root + "/", "")}  (${sz} MB)`);
  }
}
