#!/usr/bin/env bun
// Build release artifacts:
//   dist/little-coder-<os>-<cpu>    compiled binary with bytecode
//   dist/data.tar.gz                data archive with pre-compiled extensions
//
// Usage:
//   bun scripts/build-release.ts              # binary (current platform) + data
//   bun scripts/build-release.ts --data-only  # data archive only (CI cross-build)
//   bun scripts/build-release.ts --bin-only   # binary only

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
const archName = ({ x64: "x64", arm64: "arm64", aarch64: "arm64" } as Record<string, string>)[arch()] ?? arch();
const bunTarget = `bun-${osName}-${archName}`;

// ---------------------------------------------------------------------------
// 1. Compile binary
//    --compile  --bytecode  --minify  --target
// ---------------------------------------------------------------------------
if (!dataOnly) {
  const outfile = join(dist, `little-coder-${osName}-${archName}`);
  console.log(`\nCompiling binary → ${outfile}`);
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

if (binOnly) process.exit(0);

// ---------------------------------------------------------------------------
// 2. Pre-compile extensions
//    Each extension: bun build → single bundled index.js
//    External: pi-provided packages + diff (all in node_modules)
//    Bundled: relative imports (src/*.ts), automatically inlined
// ---------------------------------------------------------------------------
const EXTERNALS = [
  "@earendil-works/pi-coding-agent",
  "@earendil-works/pi-tui",
  "@sinclair/typebox",
  "@toon-format/toon",
  "diff",
];
const externalArgs = EXTERNALS.flatMap(e => ["--external", e]);

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
    ...externalArgs,
  ], { cwd: root, stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`  Error compiling ${name}`);
    process.exit(r.status ?? 1);
  }
}

// ---------------------------------------------------------------------------
// 3. Data archive
//    Replaces .pi/extensions/*/index.ts with pre-compiled index.js
//    Excludes source .ts files to keep the archive lean
// ---------------------------------------------------------------------------
const dataOut = join(dist, "data.tar.gz");
console.log(`\nBuilding data archive → ${dataOut}`);

// Stage: copy everything needed for the data dir into a temp dir
const stageDir = join(dist, ".stage");
const { execSync } = await import("node:child_process");
const { rmSync, cpSync, writeFileSync } = await import("node:fs");

rmSync(stageDir, { recursive: true, force: true });
mkdirSync(join(stageDir, "data", ".pi", "extensions"), { recursive: true });
mkdirSync(join(stageDir, "data", "scripts"), { recursive: true });
mkdirSync(join(stageDir, "data", "vendor"), { recursive: true });

// Root files
for (const f of ["package.json", "bun.lock", "AGENTS.md"]) {
  if (existsSync(join(root, f))) {
    const { copyFileSync } = await import("node:fs");
    copyFileSync(join(root, f), join(stageDir, "data", f));
  }
}

// scripts/patch-pi.ts
const patchSrc = join(root, "scripts", "patch-pi.ts");
if (existsSync(patchSrc)) {
  const { copyFileSync } = await import("node:fs");
  copyFileSync(patchSrc, join(stageDir, "data", "scripts", "patch-pi.ts"));
}

// Extensions: use compiled index.js + keep non-ts supporting files (none needed — all bundled)
for (const name of readdirSync(extDist)) {
  const compiledIndex = join(extDist, name, "index.js");
  if (!existsSync(compiledIndex)) continue;
  mkdirSync(join(stageDir, "data", ".pi", "extensions", name), { recursive: true });
  const { copyFileSync } = await import("node:fs");
  copyFileSync(compiledIndex, join(stageDir, "data", ".pi", "extensions", name, "index.js"));
}

// vendor/ — kept for provenance and update reference
cpSync(join(root, "vendor"), join(stageDir, "data", "vendor"), { recursive: true });

// Pack
const tarR = spawnSync("tar", ["-czf", dataOut, "-C", join(stageDir), "data"], { stdio: "inherit" });
rmSync(stageDir, { recursive: true, force: true });
if (tarR.status !== 0) { console.error("tar failed"); process.exit(1); }

// ---------------------------------------------------------------------------
// 4. Summary
// ---------------------------------------------------------------------------
console.log(`\nRelease artifacts for v${version}:`);
for (const f of [
  !dataOnly && join(dist, `little-coder-${osName}-${archName}`),
  dataOut,
].filter(Boolean) as string[]) {
  if (existsSync(f)) {
    const sz = (statSync(f).size / 1024 / 1024).toFixed(1);
    console.log(`  ${f.replace(root + "/", "")}  (${sz} MB)`);
  }
}
