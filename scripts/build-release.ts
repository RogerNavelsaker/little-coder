#!/usr/bin/env bun
// Build release artifacts:
//   dist/little-coder-linux-x64      (compiled binary, current platform only in local mode)
//   dist/data.tar.gz                 (data archive — extensions, vendor, AGENTS.md, etc.)
//
// Usage:
//   bun scripts/build-release.ts              # binary for current platform + data archive
//   bun scripts/build-release.ts --data-only  # data archive only (for CI cross-build)

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { arch, platform } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(import.meta.url), "../..");
const dist = join(root, "dist");
mkdirSync(dist, { recursive: true });

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));
const version: string = pkg.version;

const dataOnly = process.argv.includes("--data-only");

// ---- Binary ----
if (!dataOnly) {
  const os = { linux: "linux", darwin: "darwin" }[platform()] ?? platform();
  const cpu = { x64: "x64", arm64: "arm64", aarch64: "arm64" }[arch()] ?? arch();
  const outfile = join(dist, `little-coder-${os}-${cpu}`);
  console.log(`Building binary → ${outfile}`);
  const r = spawnSync(
    "bun",
    ["build", "--compile", "bin/little-coder.ts", "--outfile", outfile],
    { cwd: root, stdio: "inherit" },
  );
  if (r.status !== 0) process.exit(r.status ?? 1);
}

// ---- Data archive ----
// Dereferences symlinks so the tarball contains real files (works on any tar).
// Excludes: node_modules, dist, .git, dev scripts, test fixtures.
const dataOut = join(dist, "data.tar.gz");
console.log(`Building data archive → ${dataOut}`);

const includes = [
  "AGENTS.md",
  "package.json",
  "bun.lock",
  "scripts/patch-pi.ts",
  ".pi/extensions",
  "vendor",
];

// Filter to paths that actually exist
const existing = includes.filter(p => existsSync(join(root, p)));

const tarArgs = [
  "-czf", dataOut,
  "--dereference",          // resolve symlinks to real files
  "--exclude=*.test.ts",
  "--exclude=test-helpers.ts",
  "--exclude=invoke.ts",
  "--transform", `s,^,data/,`,   // wrap everything under data/ so --strip-components=1 works
  "-C", root,
  ...existing,
];

const tr = spawnSync("tar", tarArgs, { cwd: root, stdio: "inherit" });
if (tr.status !== 0) process.exit(tr.status ?? 1);

console.log(`\nRelease artifacts for v${version}:`);
for (const f of [dataOut, ...(!dataOnly ? [join(dist, `little-coder-${({ linux: "linux", darwin: "darwin" }[platform()] ?? platform())}-${({ x64: "x64", arm64: "arm64", aarch64: "arm64" }[arch()] ?? arch())}`)] : [])]) {
  if (existsSync(f)) {
    const { statSync } = await import("node:fs");
    const sz = (statSync(f).size / 1024 / 1024).toFixed(1);
    console.log(`  ${f.replace(root + "/", "")}  (${sz} MB)`);
  }
}
