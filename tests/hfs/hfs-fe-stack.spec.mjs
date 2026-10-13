import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkRepo } from '../../scripts/hfs/check.mjs';

// FE_STACK_FORBIDDEN (rules/fe-stack.mjs): a front-end manifest never declares a package knowledge/hfs/fe-stack.yaml lists under a
// concern's `forbids` (owner ruling 2026-10-13, lite = full). The fe side judges every package.json it holds; the app root's one
// package.json carries both sides, so a library the back end owns (be infraOwners, e.g. graphql-ws, moment) is not a fe finding there.
const BE = { apps: [{ name: 'core', kind: 'api' }, { name: 'cli', kind: 'cli' }], connections: [{ name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'core', isolation: 'database' }] };
const FE = { apps: [{ name: 'web', kind: 'next' }] };
const app = (edition) => ({ hfs: 2, kind: 'app', project: 'demo', ...(edition ? { edition } : {}), sides: { be: BE, fe: FE } });

const tree = (t, files) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-fe-stack-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), JSON.stringify(content));
  }
  return dir;
};
const stack = (repoRoot, files, edition) => checkRepo({ repoRoot, declaration: app(edition), files, tree: false }).findings.filter((f) => f.code === 'FE_STACK_FORBIDDEN');

test('FE_STACK_FORBIDDEN: the canonical libraries of every concern raise nothing, in the apps, the packages and the app root', (t) => {
  const files = {
    'package.json': { name: 'demo', dependencies: { graphql: '16.0.0', 'graphql-ws': '6.0.0', moment: '2.30.0' }, devDependencies: { typescript: '6.0.0' } },
    'fe/apps/web/package.json': { name: '@demo/web', dependencies: { next: '16.0.0', '@apollo/client': '4.0.0', swr: '2.3.0', axios: '1.12.0', 'react-hook-form': '7.60.0', zod: '4.0.0', '@reduxjs/toolkit': '2.8.0', zustand: '5.0.0', 'socket.io-client': '4.8.0', dayjs: '1.11.0', 'next-intl': '4.0.0' } },
    'fe/packages/demo-ui/package.json': { name: '@demo/ui', dependencies: { '@heroui/react': '3.0.0', '@phosphor-icons/react': '2.1.0', recharts: '3.0.0' } },
  };
  const repoRoot = tree(t, files);
  assert.deepEqual(stack(repoRoot, Object.keys(files)), []);
});

test('FE_STACK_FORBIDDEN: a forbidden alternative in an app or a package manifest, in any dependency section, is a finding naming the concern', (t) => {
  const files = {
    'package.json': { name: 'demo' },
    'fe/apps/web/package.json': { name: '@demo/web', dependencies: { urql: '4.0.0', '@tanstack/react-query': '5.0.0' }, devDependencies: { moment: '2.30.0' } },
    'fe/packages/demo-ui/package.json': { name: '@demo/ui', peerDependencies: { 'lucide-react': '0.400.0' }, optionalDependencies: { sonner: '2.0.0' } },
  };
  const repoRoot = tree(t, files);
  const found = stack(repoRoot, Object.keys(files));
  assert.deepEqual(found.map((f) => `${f.path}|${f.section}|${f.dependency}|${f.concern}`).sort(), [
    'fe/apps/web/package.json|dependencies|@tanstack/react-query|data',
    'fe/apps/web/package.json|dependencies|urql|graphql',
    'fe/apps/web/package.json|devDependencies|moment|dates',
    'fe/packages/demo-ui/package.json|optionalDependencies|sonner|toast',
    'fe/packages/demo-ui/package.json|peerDependencies|lucide-react|icons',
  ]);
  assert.ok(found.every((f) => f.level === 'error' && /fe-stack\.yaml/.test(f.message)), JSON.stringify(found, null, 1));
  assert.match(found.find((f) => f.dependency === 'urql').message, /@apollo\/client/, 'the finding names the canonical package');
});

test('FE_STACK_FORBIDDEN: the app root manifest is judged too, except a library the back end owns', (t) => {
  const files = { 'package.json': { name: 'demo', dependencies: { 'graphql-ws': '6.0.0', moment: '2.30.0', formik: '2.4.0' }, devDependencies: { 'react-toastify': '11.0.0' } } };
  const repoRoot = tree(t, files);
  assert.deepEqual(stack(repoRoot, Object.keys(files)).map((f) => f.dependency).sort(), ['formik', 'react-toastify']);
});

test('FE_STACK_FORBIDDEN judges a lite app exactly as a full one, and a back-end manifest never', (t) => {
  const files = {
    'package.json': { name: 'demo' },
    'fe/apps/web/package.json': { name: '@demo/web', dependencies: { 'graphql-ws': '6.0.0' } },
    'be/apps/core/package.json': { name: '@demo/core', dependencies: { 'graphql-ws': '6.0.0', moment: '2.30.0' } },
  };
  const repoRoot = tree(t, files);
  for (const edition of [undefined, 'lite']) {
    assert.deepEqual(stack(repoRoot, Object.keys(files), edition).map((f) => f.path), ['fe/apps/web/package.json'], `edition ${edition ?? 'full'}`);
  }
});
