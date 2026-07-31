#!/usr/bin/env bun
/**
 * Test Coverage Floor Checker.
 * Inspired by NacoSolutions/senshac verification standards.
 *
 * Verifies that test coverage metrics satisfy minimum safety thresholds.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const coverageSummaryPath = join(process.cwd(), 'coverage', 'coverage-summary.json');

// Default minimum thresholds (%)
const MIN_STATEMENTS = 80;
const MIN_FUNCTIONS = 80;
const MIN_BRANCHES = 70;

if (!existsSync(coverageSummaryPath)) {
  console.log('ℹ️ No coverage-summary.json found (run `bun run test:coverage` to generate). Skipping coverage check.');
  process.exit(0);
}

try {
  const summary = JSON.parse(readFileSync(coverageSummaryPath, 'utf-8'));
  const total = summary.total;

  if (!total) {
    console.error('❌ Invalid coverage summary format.');
    process.exit(1);
  }

  const statementsPct = total.statements?.pct ?? 0;
  const functionsPct = total.functions?.pct ?? 0;
  const branchesPct = total.branches?.pct ?? 0;

  console.log(`📊 Coverage Summary:`);
  console.log(`   Statements: ${statementsPct}% (min ${MIN_STATEMENTS}%)`);
  console.log(`   Functions:  ${functionsPct}% (min ${MIN_FUNCTIONS}%)`);
  console.log(`   Branches:   ${branchesPct}% (min ${MIN_BRANCHES}%)`);

  let failed = false;
  if (statementsPct < MIN_STATEMENTS) {
    console.error(`❌ Statements coverage (${statementsPct}%) is below minimum threshold (${MIN_STATEMENTS}%)`);
    failed = true;
  }
  if (functionsPct < MIN_FUNCTIONS) {
    console.error(`❌ Functions coverage (${functionsPct}%) is below minimum threshold (${MIN_FUNCTIONS}%)`);
    failed = true;
  }
  if (branchesPct < MIN_BRANCHES) {
    console.error(`❌ Branches coverage (${branchesPct}%) is below minimum threshold (${MIN_BRANCHES}%)`);
    failed = true;
  }

  if (failed) process.exit(1);
  console.log('✅ Coverage thresholds satisfied!');
} catch (err) {
  console.error('❌ Failed to check test coverage:', err);
  process.exit(1);
}
