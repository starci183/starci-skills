// hfs sync --init: the first source tree of a new repository (entrypoint, platform config/logging/errors, the health
// endpoint; for a front end the next-intl [locale] shell with vi default, as-needed prefix and proxy.ts).
// Unlike the managed files it is written once and never overwritten: an existing file is skipped, so re-running --init
// on a repository that already grew its own source changes nothing.
import fs from 'node:fs';
import path from 'node:path';
import { TEMPLATES_DIR, SyncError, render, validateHfs } from './index.mjs';

const APP_DIR = '__app__';
const pascal = name => name.split('-').map(part => part[0].toUpperCase() + part.slice(1)).join('');

function listFiles(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full, base) : [path.relative(base, full).split(path.sep).join('/')];
  });
}

/** The apps that get a skeleton: a back end's `api` apps, every front-end app. */
export const skeletonApps = hfs => hfs.apps.filter(app => hfs.profile === 'fe' || app.kind === 'api');

/** Every skeleton file for this repository: [{ path, content }], the shared ones once and the per-app ones per app. */
export function skeletonFiles(hfs, dir = path.join(TEMPLATES_DIR, hfs.profile, 'skeleton')) {
  validateHfs(hfs);
  if (!fs.existsSync(dir)) throw new SyncError('HFS_SYNC_SKELETON_MISSING', `no skeleton templates for profile ${hfs.profile}`);
  const files = [];
  for (const rel of listFiles(dir)) {
    const source = fs.readFileSync(path.join(dir, rel), 'utf8').replace(/\r\n/g, '\n');
    if (!rel.includes(APP_DIR)) {
      files.push({ path: rel, content: render(source, {}) });
      continue;
    }
    for (const app of skeletonApps(hfs)) {
      files.push({ path: rel.split(APP_DIR).join(app.name), content: render(source, { app: app.name, appPascal: pascal(app.name) }) });
    }
  }
  return files;
}

/** Writes the skeleton under `root`, skipping every file that exists: { created, skipped } path lists. */
export function initSkeleton(root, hfs) {
  const created = [], skipped = [];
  for (const file of skeletonFiles(hfs)) {
    const target = path.join(root, file.path);
    if (fs.existsSync(target)) {
      skipped.push(file.path);
      continue;
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, file.content);
    created.push(file.path);
  }
  return { created, skipped };
}
