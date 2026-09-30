// hfs sync --init: the first source tree of a new repository (entrypoint, platform config/logging/errors, the health
// endpoint; for a front end the next-intl [locale] shell with vi default, as-needed prefix and proxy.ts).
// Unlike the managed files it is written once and never overwritten: an existing file is skipped, so re-running --init
// on a repository that already grew its own source changes nothing.
//
// A front end's skeleton is the templates/fe/skeleton tree (the app shell, common to every repository) plus ONE of two
// trees for what a repository writes once: with one app the app keeps its own i18n stack and its own API client
// (templates/fe/skeleton-app); with two or more apps the stack and the client are written once, as the packages
// `packages/<project>-i18n` and `packages/<project>-api`, and each app keeps a thin adapter over them
// (templates/fe/skeleton-shared). The choice is the number of apps in hfs.json, nothing else.
import fs from 'node:fs';
import path from 'node:path';
import { TEMPLATES_DIR, SyncError, render, validateHfs } from './index.mjs';

const APP_DIR = '__app__';
const FAMILY_DIR = '__family__';
/** The slots a multi-app front end must opt into in hfs.json before its shared packages are written. */
export const SHARED_PACKAGE_SLOTS = Object.freeze(['fe.package.i18n', 'fe.package.api']);
const pascal = name => name.split('-').map(part => part[0].toUpperCase() + part.slice(1)).join('');

function listFiles(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full, base) : [path.relative(base, full).split(path.sep).join('/')];
  });
}

/** The apps that get a skeleton: a back end's `api` apps, every front-end app. */
export const skeletonApps = hfs => hfs.apps.filter(app => hfs.profile === 'fe' || app.kind === 'api');

/** True when the repository writes its i18n stack and API client once, as packages: a front end with two or more apps. */
export const sharesPackages = hfs => hfs.profile === 'fe' && hfs.apps.length > 1;

/** The template directories of a repository, in order: the profile's skeleton, then (front end) the one-app or the shared-package tree. */
export const skeletonDirs = hfs => [path.join(TEMPLATES_DIR, hfs.profile, 'skeleton'), ...(hfs.profile === 'fe' ? [path.join(TEMPLATES_DIR, 'fe', sharesPackages(hfs) ? 'skeleton-shared' : 'skeleton-app')] : [])];

/** Every skeleton file for this repository: [{ path, content }], the shared ones once and the per-app ones per app. */
export function skeletonFiles(hfs, dirs = skeletonDirs(hfs)) {
  validateHfs(hfs);
  if (sharesPackages(hfs)) {
    const missing = SHARED_PACKAGE_SLOTS.filter(id => !(hfs.optionalSlots ?? []).includes(id));
    if (missing.length) throw new SyncError('HFS_SYNC_HFS_INVALID', `a front end with ${hfs.apps.length} apps writes its i18n stack and its API client once, as packages: list ${missing.join(' and ')} in hfs.json optionalSlots before hfs sync --init`);
  }
  const files = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) throw new SyncError('HFS_SYNC_SKELETON_MISSING', `no skeleton templates in ${path.relative(TEMPLATES_DIR, dir)}`);
    for (const rel of listFiles(dir)) {
      const source = fs.readFileSync(path.join(dir, rel), 'utf8').replace(/\r\n/g, '\n');
      const once = { family: hfs.project, project: hfs.project };
      if (!rel.includes(APP_DIR)) {
        files.push({ path: rel.split(FAMILY_DIR).join(hfs.project), content: render(source, once) });
        continue;
      }
      for (const app of skeletonApps(hfs)) {
        files.push({ path: rel.split(APP_DIR).join(app.name), content: render(source, { ...once, app: app.name, appPascal: pascal(app.name) }) });
      }
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
