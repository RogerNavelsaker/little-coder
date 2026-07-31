#!/usr/bin/env bun
/**
 * Repo Cleanliness Checker.
 * Inspired by NacoSolutions/senshac verification standards.
 *
 * Verifies that build outputs or unexpected untracked files are clean.
 */

import { execSync } from 'node:child_process';

const allowUnstaged = process.env.CHECK_CLEAN_ALLOW_UNSTAGED === '1' || process.env.CHECK_CLEAN_ALLOW_STAGED === '1';

if (allowUnstaged) {
  console.log('ℹ️ Cleanliness check skipped during WIP (CHECK_CLEAN_ALLOW_UNSTAGED=1)');
  process.exit(0);
}

try {
  const status = execSync('git status --porcelain', { encoding: 'utf-8' }).trim();
  if (status) {
    console.error('❌ Repo has uncommitted or untracked changes:');
    console.error(status);
    console.error('\nRun `git add .` or commit changes before running full clean verification.');
    process.exit(1);
  }
  console.log('✅ Repo is clean!');
} catch (err) {
  console.error('❌ Failed to check repository cleanliness:', err);
  process.exit(1);
}
