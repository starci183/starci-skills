// frontend.mjs - the front-end tree checks of hfs check. Per app of the fe side (`apps/<app>`, kind next, side-relative paths):
//   FE_I18N_PLACEMENT (R59)     next-intl with the `[locale]` segment: every route file sits under `src/app/[locale]/` (the root
//                               redirect page, global-error and health probes excepted), locale routing is `src/proxy.ts` and never
//                               `middleware.ts`, and the default locale's catalog `vi.json` exists
//   FE_I18N_CATALOG (R60)       every `modules/i18n/messages/<locale>.json` has the same key set
// Over the whole app (the root scope, app-relative paths: the one package.json and the be contract snapshots sit outside the fe side):
//   FE_WIRE_GENERATED (R52)     wire types come from the be contract snapshots the fe side reads in place (its declared reads,
//                               `be/contracts/`): the root package.json declares the `codegen` script, and each fe app's generated
//                               types on disk (`modules/api/__generated__/`, never tracked) are not older than any snapshot
//   FE_I18N_PLACEMENT (R59)     `next-intl` is a dependency of the root package.json or of a shared i18n package under fe/packages/
// The files each app must hold (routing.ts, navigation.ts, request.ts, messages/, the [locale] layout) are the slot manifest's requires
// (HFS_SLOT_REQUIRED_MISSING); which source may hold display text and how copy resolves is eslint-fe's.
import fs from 'node:fs';
import path from 'node:path';
import { found, readJson } from './read.mjs';

export const WIRE_GENERATED = 'FE_WIRE_GENERATED';
export const I18N_PLACEMENT = 'FE_I18N_PLACEMENT';
export const I18N_CATALOG = 'FE_I18N_CATALOG';
export const DEFAULT_LOCALE = 'vi';
const ROUTE_FILE = /\/(?:page|layout|template|loading|error|not-found)\.[jt]sx?$/;
const LOCALE = /^[a-z]{2,3}(?:-[A-Za-z0-9]+)*$/;
const STALE_MS = 1000;

/** Every leaf key of a parsed catalog as a dotted path. */
export function catalogKeys(value, prefix = '') {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  const entries = Object.entries(value);
  return entries.length ? entries.flatMap(([key, child]) => catalogKeys(child, prefix ? `${prefix}.${key}` : key)) : [prefix];
}

/** The newest modification time (ms) of any file below `dir`, or null when it holds none. */
function newestBelow(dir) {
  let newest = null;
  const walk = (current) => {
    let entries;
    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) walk(target);
      else try { newest = Math.max(newest ?? 0, fs.statSync(target).mtimeMs); } catch { /* vanished while reading */ }
    }
  };
  walk(dir);
  return newest;
}

const scriptsOf = (repoRoot, file) => readJson(repoRoot, file)?.scripts ?? {};

/** R52 over the app: the codegen script of the root and the age of each fe app's generated types against the be snapshots. */
function wireFindings({ repoRoot, files, apps, reads }) {
  const snapshots = files.filter((file) => reads.some((read) => file.startsWith(read)));
  if (!snapshots.length) return [];
  const findings = [];
  if (typeof scriptsOf(repoRoot, 'package.json').codegen !== 'string') findings.push(found(WIRE_GENERATED, 'package.json', `the app keeps contract snapshots (${reads.join(', ')}) but its package.json declares no \`codegen\` script; wire types are generated from the snapshots, never typed by hand`));
  for (const app of apps) {
    const generated = `fe/apps/${app}/src/modules/api/__generated__`;
    const built = newestBelow(path.join(repoRoot, generated));
    if (built === null) continue;
    for (const snapshot of snapshots) {
      let changed;
      try { changed = fs.statSync(path.join(repoRoot, snapshot)).mtimeMs; } catch { continue; }
      if (built + STALE_MS < changed) findings.push(found(WIRE_GENERATED, generated, `${generated} is older than ${snapshot}; run \`npm run codegen\` so the wire types match the contract snapshot`, { app, snapshot }));
    }
  }
  return findings;
}

/** R59 over the app: next-intl is a dependency of the one package.json or of a shared fe/packages/* manifest. */
function intlDependencyFindings({ repoRoot, files }) {
  const declares = (file) => { const pkg = readJson(repoRoot, file); return pkg ? ['dependencies', 'devDependencies'].some((section) => pkg[section]?.['next-intl'] !== undefined) : false; };
  const shared = files.filter((file) => /^fe\/packages\/[^/]+\/package\.json$/.test(file));
  return ['package.json', ...shared].some(declares) ? [] : [found(I18N_PLACEMENT, 'package.json', 'the app does not depend on next-intl (nor does a shared fe package); every fe app uses next-intl with the [locale] segment')];
}

function placementFindings({ repoRoot, app, tracked }) {
  const base = `apps/${app}`;
  const findings = [];
  if (!tracked.includes(`${base}/src/proxy.ts`)) findings.push(found(I18N_PLACEMENT, `${base}/src/proxy.ts`, `${app} has no src/proxy.ts; locale routing lives in proxy.ts`, { app }));
  for (const file of tracked.filter((f) => new RegExp(`^${base}/src/middleware\.[cm]?[jt]s$`).test(f))) findings.push(found(I18N_PLACEMENT, file, `${file} is a middleware file; Next 16 routes through src/proxy.ts`, { app }));
  const appDir = `${base}/src/app/`;
  for (const file of tracked.filter((f) => f.startsWith(appDir) && ROUTE_FILE.test(f))) {
    const rel = file.slice(appDir.length);
    if (rel.startsWith('[locale]/') || rel.startsWith('health/') || ['page.tsx', 'not-found.tsx', 'layout.tsx'].includes(rel)) continue;  // next-intl's root not-found and its layout
    findings.push(found(I18N_PLACEMENT, file, `${file} is a route file outside the [locale] segment; every page, layout and boundary sits under src/app/[locale]/`, { app }));
  }
  const messages = `${base}/src/modules/i18n/messages/`;
  const catalogs = tracked.filter((f) => f.startsWith(messages) && f.endsWith('.json'));
  if (!catalogs.includes(`${messages}${DEFAULT_LOCALE}.json`)) findings.push(found(I18N_PLACEMENT, `${messages}${DEFAULT_LOCALE}.json`, `${app} has no ${DEFAULT_LOCALE}.json catalog; the default locale is ${DEFAULT_LOCALE}`, { app }));
  for (const file of catalogs) {
    const name = path.posix.basename(file, '.json');
    if (path.posix.dirname(file) + '/' !== messages || !LOCALE.test(name)) findings.push(found(I18N_PLACEMENT, file, `${file} is not a <locale>.json catalog directly under modules/i18n/messages/`, { app }));
  }
  return findings;
}

function catalogFindings({ repoRoot, app, tracked }) {
  const messages = `apps/${app}/src/modules/i18n/messages/`;
  const catalogs = tracked.filter((f) => f.startsWith(messages) && f.endsWith('.json') && f.slice(messages.length).indexOf('/') === -1);
  const keys = new Map();
  for (const file of catalogs) {
    const parsed = readJson(repoRoot, file);
    if (parsed !== null) keys.set(file, new Set(catalogKeys(parsed)));
  }
  if (keys.size < 2) return [];
  const all = new Set([...keys.values()].flatMap((set) => [...set]));
  const findings = [];
  for (const [file, set] of keys) {
    const missing = [...all].filter((key) => !set.has(key)).sort();
    if (missing.length) findings.push(found(I18N_CATALOG, file, `${file} lacks ${missing.length} key${missing.length === 1 ? '' : 's'} another locale has (${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ', ...' : ''}); every catalog holds the same keys`, { app, missing }));
  }
  return findings;
}

/** The fe side's tree findings of R59 and R60 for every `next` app; `repoRoot` is the fe side folder, `files` side-relative. */
export function frontendFindings({ repoRoot, files, repo }) {
  return repo.apps.filter((a) => a.kind === 'next').flatMap((a) => [placementFindings, catalogFindings].flatMap((check) => check({ repoRoot, app: a.name, tracked: files })));
}

/** The app's front-end findings that read the root (R52, R59's dependency); `repoRoot` is the app root, `files` app-relative. */
export function appFrontendFindings({ repoRoot, files, repo }) {
  const apps = repo.sides.fe.apps.filter((a) => a.kind === 'next').map((a) => a.name);
  // The snapshots are the paths the fe side declares it reads of the be side (hfs.json sides.fe.reads: be/contracts/).
  return [...wireFindings({ repoRoot, files, apps, reads: repo.sides.fe.reads }), ...intlDependencyFindings({ repoRoot, files })];
}
