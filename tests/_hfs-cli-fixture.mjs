import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createSlotResolver, loadSlotManifest, resolveRepoDeclaration } from '../scripts/lib/hfs-slots.mjs';

export const BE = { hfs: 1, profile: 'be', project: 'demo', apps: [{ name: 'core', kind: 'api' }] };
export const FE = { hfs: 1, profile: 'fe', project: 'demo', apps: [{ name: 'web', kind: 'next' }, { name: 'admin', kind: 'next' }] };

/** A clean product repository for `declaration`: every path the manifest requires, plus one BE feature. Not yet a Git repository. */
export function writeCleanRepo(declaration, { declare = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-cli-'));
  const manifest = loadSlotManifest();
  const resolver = createSlotResolver(manifest, resolveRepoDeclaration(manifest, declaration));
  const put = (relative, text = '') => {
    const target = path.join(dir, ...relative.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (!fs.existsSync(target)) fs.writeFileSync(target, text);
  };
  put('package.json', `${JSON.stringify({ name: 'demo', private: true })}\n`);
  for (const entry of resolver.requiredPaths().paths) if (!entry.path.endsWith('/')) put(entry.path, entry.path === 'hfs.json' ? '' : 'export {};\n');
  if (declaration.profile === 'fe') for (const app of declaration.apps) put(`apps/${app.name}/src/modules/i18n/messages/en.json`, '{}');
  if (declaration.profile === 'be') {
    put('src/features/orders/index.ts', 'export {};\n');
    put('src/features/orders/orders.module.ts', 'export {};\n');
    put('src/features/orders/application/place-order.use-case.ts', 'export {};\n');
  }
  if (declare) fs.writeFileSync(path.join(dir, 'hfs.json'), `${JSON.stringify(declaration, null, 2)}\n`);
  return dir;
}

export function gitAdd(dir) {
  execFileSync('git', ['-C', dir, 'init', '-q'], { stdio: 'ignore' });
  execFileSync('git', ['-C', dir, 'add', '-A', '-f'], { stdio: 'ignore' });
  return dir;
}

export function cleanup(dirs) {
  for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
}
