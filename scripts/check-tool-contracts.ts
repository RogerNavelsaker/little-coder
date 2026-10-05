#!/usr/bin/env bun
/**
 * Tool Contract & Coverage Checker.
 * Inspired by NacoSolutions/senshac verification standards.
 *
 * Enforces across all extension tool implementations:
 * 1. Co-located unit test file: foo.ts → foo.test.ts
 * 2. Exported `execute<Verb>Op` function for invocation harnesses and dispatchers.
 * 3. Parameters schema with `ops[]` universal array support.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dir, '..');
const EXTENSIONS_DIR = resolve(REPO_ROOT, '.pi/extensions');

const HELPER_FILES = new Set([
  'bridge.ts',
  'continuous-gc.ts',
  'discover.ts',
  'display.ts',
  'effort.ts',
  'episode-storage.ts',
  'file-checkpoint.ts',
  'file-reference.ts',
  'governor.ts',
  'invoke.ts',
  'knowledge-inject.ts',
  'linehash.ts',
  'local-estimate.ts',
  'orientation.ts',
  'output-machete.ts',
  'output-parser.ts',
  'output.ts',
  'quality-monitor.ts',
  'read-guard.ts',
  'read-guard-edit.ts',
  'schema.ts',
  'settings.ts',
  'skill-inject.ts',
  'storage.ts',
  'test-helpers.ts',
  'toon.ts',
  'turn-cap.ts',
  'turn-transition.ts',
  'unified.ts',
  'watchdog.ts',
  'write-guard.ts',
]);

function toPascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

let errorsCount = 0;

if (!existsSync(EXTENSIONS_DIR)) {
  console.error(`❌ Extensions directory missing: ${EXTENSIONS_DIR}`);
  process.exit(1);
}

const groups = readdirSync(EXTENSIONS_DIR, { withFileTypes: true })
  .filter(dirent => dirent.isDirectory() && !dirent.name.startsWith('_'))
  .map(dirent => dirent.name);

for (const group of groups) {
  const srcDir = join(EXTENSIONS_DIR, group, 'src');
  if (!existsSync(srcDir)) continue;

  const files = readdirSync(srcDir)
    .filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts') && !HELPER_FILES.has(f));

  for (const file of files) {
    const verb = file.replace(/\.ts$/, '');
    const pascalVerb = toPascalCase(verb);
    const filePath = join(srcDir, file);
    const testFilePath = join(srcDir, `${verb}.test.ts`);
    const content = readFileSync(filePath, 'utf-8');

    // 1. Check co-located test file
    if (!existsSync(testFilePath)) {
      console.error(`❌ [${group}/${file}] Missing co-located test file: ${verb}.test.ts`);
      errorsCount++;
    }

    // 2. Check execute<Verb>Op export
    const expectedExport = `execute${pascalVerb}Op`;
    if (!content.includes(`export async function ${expectedExport}`) && !content.includes(`export function ${expectedExport}`)) {
      console.error(`❌ [${group}/${file}] Missing exported function: ${expectedExport}`);
      errorsCount++;
    }

    // 3. Check ops[] schema support
    if (!content.includes('ops:') && !content.includes('ops?:')) {
      console.error(`❌ [${group}/${file}] Missing ops[] parameter in schema definition`);
      errorsCount++;
    }
  }
}

if (errorsCount > 0) {
  console.error(`\n❌ Tool contract validation failed with ${errorsCount} error(s).`);
  process.exit(1);
}

console.log('✅ All extension tools comply with the Universal Tool Contract!');
