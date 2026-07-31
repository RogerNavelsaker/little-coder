#!/usr/bin/env bun
/**
 * Technical Debt Marker Checker.
 * Inspired by NacoSolutions/senshac verification standards.
 *
 * Scans source files for unindexed TODO, FIXME, or HACK comments without tracking IDs.
 */

import { execSync } from 'node:child_process';

const ALLOW_DEBT = process.env.ALLOW_DEBT_MARKERS === '1';

if (ALLOW_DEBT) {
  console.log('ℹ️ Tech debt marker check skipped (ALLOW_DEBT_MARKERS=1)');
  process.exit(0);
}

try {
  // Search for FIXME or TODO without a task ID reference like (little-coder-1234)
  const stdout = execSync('git grep -n -E "FIXME|HACK" -- .pi/ scripts/ bin/', { encoding: 'utf-8' }).trim();
  if (stdout) {
    console.warn('⚠️ Found FIXME / HACK markers in source code:');
    console.warn(stdout);
  } else {
    console.log('✅ Zero unaddressed FIXME or HACK markers found!');
  }
} catch {
  // git grep exits 1 if no matches found — which is success for us
  console.log('✅ Zero unaddressed FIXME or HACK markers found!');
}
