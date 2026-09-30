// The machine resolves workspaces the way npm does: a `*` segment admits the directories that hold a package.json and skips an
// empty folder (nivo-fe `apps/landing-draft`, untracked and empty, made the machine analyse ZERO files); a literal path must resolve.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { loadArchitectureConfig } from '../scripts/checks/architecture/config.mjs';

const tree = (workspaces, extra = () => {}) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-ws-'));
  const write = (rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
  write('hfs.json', JSON.stringify({ hfs: 1, profile: 'fe', project: 'ws', apps: [{ name: 'web', kind: 'next' }] }));
  write('package.json', JSON.stringify({ name: 'ws', private: true, workspaces }));
  write('tsconfig.json', '{"compilerOptions":{"strict":true},"include":[]}');
  write('apps/web/package.json', '{"name":"@ws/web"}');
  write('apps/web/tsconfig.json', '{"compilerOptions":{"strict":true},"include":["src"]}');
  write('apps/web/src/app/[locale]/page.tsx', 'export default function Page() { return null }\n');
  extra(root);
  return root;
};

test('a `*` workspace skips a folder with no package.json; the real workspaces are analysed', () => {
  const root = tree(['apps/*'], (r) => fs.mkdirSync(path.join(r, 'apps', 'landing-draft')));
  const config = loadArchitectureConfig(root);
  assert.deepEqual(config.workspaces, ['apps/web']);
});

test('a literal workspace path that does not hold a package.json is still refused', () => {
  const root = tree(['apps/web', 'apps/landing-draft'], (r) => fs.mkdirSync(path.join(r, 'apps', 'landing-draft')));
  assert.throws(() => loadArchitectureConfig(root), /workspace apps\/landing-draft must resolve to a regular package.json/);
});

test('a package that keeps src/hooks beside its grammar tiers is package source, not a second hooks root (nivo-fe packages/nivo-ui)', () => {
  const root = tree(['apps/*', 'packages/*'], (r) => {
    for (const [rel, text] of [
      ['packages/nivo-ui/package.json', '{"name":"@ws/ui"}'],
      ['packages/nivo-ui/tsconfig.json', '{"compilerOptions":{"strict":true},"include":["src"]}'],
      ['packages/nivo-ui/src/leaves/Button/index.tsx', 'export const Button = () => null\n'],
      ['packages/nivo-ui/src/hooks/useToggle.ts', 'export const useToggle = () => null\n'],
      ['apps/web/src/hooks/lesson/index.ts', 'export {}\n'],
    ]) { fs.mkdirSync(path.dirname(path.join(r, rel)), { recursive: true }); fs.writeFileSync(path.join(r, rel), text); }
  });
  const config = loadArchitectureConfig(root);
  assert.deepEqual(config.frontend.hooks, ['apps/web/src/hooks']);
  assert.ok(config.frontend.components.includes('packages/nivo-ui/src'));
});
