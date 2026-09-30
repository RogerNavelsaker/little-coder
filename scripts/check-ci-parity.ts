#!/usr/bin/env bun
/**
 * CI Parity Checker.
 * Inspired by NacoSolutions/senshac verification standards.
 *
 * Verifies that CI steps in GitHub Actions workflows correspond to scripts
 * in package.json and are transitively reachable from verify:ci or check:all.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dir, '..');
const WORKFLOWS_DIR = resolve(REPO_ROOT, '.github/workflows');
const PACKAGE_JSON_PATH = resolve(REPO_ROOT, 'package.json');

const CI_ONLY = new Set<string>([
  'build',
  'test',
  'sync:source',
]);

if (!existsSync(PACKAGE_JSON_PATH)) {
  console.error(`❌ package.json missing at ${PACKAGE_JSON_PATH}`);
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf-8'));
const scripts = pkg.scripts || {};

const verifyCiScript = scripts['verify:ci'] || '';
const checkAllScript = scripts['check:all'] || '';

if (!verifyCiScript) {
  console.error('❌ Missing "verify:ci" script in package.json!');
  process.exit(1);
}

if (!checkAllScript) {
  console.error('❌ Missing "check:all" script in package.json!');
  process.exit(1);
}

// Check reachable targets from verify:ci
const reachable = new Set<string>();
function walk(scriptName: string) {
  if (reachable.has(scriptName)) return;
  reachable.add(scriptName);
  const command = scripts[scriptName] || '';
  const matches = command.matchAll(/bun run ([A-Za-z0-9_:-]+)/g);
  for (const m of matches) {
    walk(m[1]);
  }
}
walk('verify:ci');

let errors = 0;

if (existsSync(WORKFLOWS_DIR)) {
  const files = readdirSync(WORKFLOWS_DIR).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
  for (const f of files) {
    const content = readFileSync(resolve(WORKFLOWS_DIR, f), 'utf-8');
    const matches = content.matchAll(/bun run ([A-Za-z0-9_:-]+)/g);
    for (const m of matches) {
      const scriptName = m[1];
      if (!reachable.has(scriptName) && !CI_ONLY.has(scriptName)) {
        console.error(`❌ [${f}] Invokes "bun run ${scriptName}" which is NOT reachable from verify:ci or allowed in CI_ONLY!`);
        errors++;
      }
    }
  }
}

if (errors > 0) {
  console.error(`\n❌ CI Parity validation failed with ${errors} error(s).`);
  process.exit(1);
}

console.log('✅ CI Parity verified!');
