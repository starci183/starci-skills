// The machine resolves workspaces the way npm does: a `*` segment admits the directories that hold a package.json and skips an
// empty folder (nivo-fe `apps/landing-draft`, untracked and empty, made the machine analyse ZERO files); a literal path must resolve.
// In an app the one package.json at the app root lists the workspaces, and only the fe side's packages are workspaces
// (`fe/packages/*`); the side folder the machine judges reads them relative to itself (`packages/<name>`).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { loadArchitectureConfig } from '../../scripts/hfs/architecture/config.mjs';
import { appDeclaration } from '../helpers/hfs-arch-fixture.mjs';

/** The fe side folder of a temp app (removed when the test ends) whose root package.json lists `workspaces`. */
const tree = (t, workspaces, extra = () => {}) => {
  const app = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-ws-'));
  t.after(() => fs.rmSync(app, { recursive: true, force: true }));
  const root = path.join(app, 'fe');
  const write = (rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
  write('../../hfs.json', JSON.stringify(appDeclaration('fe', { apps: [{ name: 'web', kind: 'next' }], optionalSlots: ['fe.package.ui'] }, 'ws')));
  write('../../package.json', JSON.stringify({ name: 'ws', private: true, workspaces }));
  write('tsconfig.json', '{"compilerOptions":{"strict":true},"include":[]}');
  write('apps/web/tsconfig.json', '{"compilerOptions":{"strict":true},"include":["src"]}');
  write('apps/web/src/app/[locale]/page.tsx', 'export default function Page() { return null }\n');
  write('packages/web-ui/package.json', '{"name":"@ws/ui"}');
  write('packages/web-ui/tsconfig.json', '{"compilerOptions":{"strict":true},"include":["src"]}');
  write('packages/web-ui/src/leaves/Button/index.tsx', 'export const Button = () => null\n');
  extra(root);
  return root;
};

test('a `*` workspace skips a folder with no package.json; the real workspaces are analysed', (t) => {
  const root = tree(t, ['fe/packages/*'], (r) => fs.mkdirSync(path.join(r, 'packages', 'draft-ui')));
  const config = loadArchitectureConfig(root);
  assert.deepEqual(config.workspaces, ['packages/web-ui']);
});

test('a literal workspace path that does not hold a package.json is still refused', (t) => {
  const root = tree(t, ['fe/packages/web-ui', 'fe/packages/draft-ui'], (r) => fs.mkdirSync(path.join(r, 'packages', 'draft-ui')));
  assert.throws(() => loadArchitectureConfig(root), /workspace packages\/draft-ui must resolve to a regular package.json/);
});

test('a package that keeps src/hooks beside its grammar tiers is package source, not a second hooks root (nivo-fe packages/nivo-ui)', (t) => {
  const root = tree(t, ['fe/packages/*'], (r) => {
    for (const [rel, text] of [
      ['packages/web-ui/src/hooks/useToggle.ts', 'export const useToggle = () => null\n'],
      ['apps/web/src/hooks/lesson/index.ts', 'export {}\n'],
    ]) { fs.mkdirSync(path.dirname(path.join(r, rel)), { recursive: true }); fs.writeFileSync(path.join(r, rel), text); }
  });
  const config = loadArchitectureConfig(root);
  assert.deepEqual(config.frontend.hooks, ['apps/web/src/hooks']);
  assert.ok(config.frontend.components.includes('packages/web-ui/src'));
});
