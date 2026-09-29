import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import * as preset from './index.mjs';

test('a workspace lane is jsdom with globals, spec-only, React and HeroUI deduped', () => {
  const lane = preset.starciVitestProject({ name: '@x/app', root: '/r/apps/app', alias: { '@': '/r/apps/app/src' }, setupFiles: ['../../vitest.setup.ts'], plugins: ['plugin'] });
  assert.equal(lane.test.name, '@x/app');
  assert.equal(lane.test.root, '/r/apps/app');
  assert.equal(lane.test.environment, 'jsdom');
  assert.equal(lane.test.globals, true);
  assert.deepEqual(lane.test.include, ['src/**/*.spec.{ts,tsx}']);
  assert.deepEqual(lane.resolve.dedupe, ['react', 'react-dom', '@heroui/react', '@heroui/styles']);
  assert.equal(lane.resolve.alias['@'], '/r/apps/app/src');
  assert.deepEqual(lane.plugins, ['plugin']);
});

test('grammar and next-intl are inlined; extra inline deps are added, not replacing', () => {
  const lane = preset.starciVitestProject({ name: 'n', root: '/r', inline: ['extra'] });
  const inline = lane.test.server.deps.inline;
  assert.ok(inline.includes('next-intl') && inline.includes('extra'));
  const grammar = inline.find((entry) => entry instanceof RegExp);
  assert.ok(grammar.test('C:\\repo\\node_modules\\@starci\\grammar\\dist\\x.js'));
  assert.ok(grammar.test('/repo/node_modules/@starci/grammar/dist/x.js'));
});

test('the root config runs every lane as a project and writes one lcov report', () => {
  const root = preset.starciVitestWorkspace({ rootDir: path.resolve('/r') });
  assert.deepEqual(root.test.projects, ['apps/*/vitest.config.ts', 'packages/*/vitest.config.ts']);
  assert.equal(root.test.coverage.provider, 'v8');
  assert.ok(root.test.coverage.reporter.includes('lcov'));
  assert.equal(root.test.coverage.reportsDirectory, path.resolve('/r', 'coverage'));
  assert.equal('thresholds' in root.test.coverage, false, 'Codecov owns the gate, not the preset');
});

test('coverage denominators: same set Sonar counts', () => {
  assert.deepEqual(preset.COVERAGE_INCLUDE, ['apps/*/src/**/*.{ts,tsx}', 'packages/*/src/**/*.{ts,tsx}']);
  const sonar = [...preset.sonarExclusions().split(','), ...preset.sonarCoverageExclusions().split(',')];
  assert.deepEqual([...sonar].sort(), [...preset.COVERAGE_EXCLUDE].sort());
  for (const g of ['**/*.spec.ts', '**/*.spec.tsx', '**/.next/**', '**/src/messages/**', '**/*.d.ts']) assert.ok(preset.COVERAGE_EXCLUDE.includes(g), g);
});
