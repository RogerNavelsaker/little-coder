import { describe, test, expect } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dir, '..');

describe('Workflow & Quality Gate Contracts', () => {
  test('package.json scripts define authoritative verify:ci and check:all gates', () => {
    const pkg = JSON.parse(readFileSync(resolve(REPO_ROOT, 'package.json'), 'utf-8'));
    const scripts = pkg.scripts || {};

    expect(scripts['verify:ci']).toBeDefined();
    expect(scripts['check:all']).toBeDefined();
    expect(scripts['check:precommit']).toBeDefined();
    expect(scripts['check:tool-contracts']).toBeDefined();

    expect(scripts['verify:ci']).toContain('bun run check:all');
    expect(scripts['check:all']).toContain('bun run check:tool-contracts');
  });

  test('.github/workflows/ci.yml runs verify:ci gate', () => {
    const ciYamlPath = resolve(REPO_ROOT, '.github/workflows/ci.yml');
    if (existsSync(ciYamlPath)) {
      const content = readFileSync(ciYamlPath, 'utf-8');
      expect(content).toContain('bun run verify:ci');
    }
  });
});
