// frontend.mjs - the front-end tree checks of hfs check, per app (`apps/<app>`, kind next):
//   FE_WIRE_GENERATED (R52)     wire types come from the contract copy: an app that keeps `modules/api/contract/*` declares the
//                               `codegen` script and runs it before `build` and `typecheck` (prebuild, pretypecheck), and its
//                               generated types on disk (`modules/api/__generated__/`, never tracked) are not older than the copy
//   FE_I18N_PLACEMENT (R59)     next-intl with the `[locale]` segment: `next-intl` is a dependency (of the app, the root or the shared
//                               i18n package under `packages/`), every route file sits under
//                               `src/app/[locale]/` (the root redirect page, global-error and health probes excepted), locale
//                               routing is `src/proxy.ts` and never `middleware.ts`, and the default locale's catalog `vi.json` exists
//   FE_I18N_CATALOG (R60)       every `modules/i18n/messages/<locale>.json` has the same key set
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

function wireFindings({ repoRoot, app, tracked }) {
  const base = `apps/${app}`;
  const copies = tracked.filter((file) => file.startsWith(`${base}/src/modules/api/contract/`));
  if (!copies.length) return [];
  const findings = [];
  const manifest = `${base}/package.json`;
  const scripts = scriptsOf(repoRoot, manifest);
  const rootScripts = scriptsOf(repoRoot, 'package.json');
  // A root script that only fans out to the workspaces (`npm run x --workspaces`, the managed FE root) is not this app's
  // script: the app's own manifest must declare it.
  const delegates = (script) => /(?:^|\s)--workspaces?(?:\s|=|$)/.test(String(script ?? ''));
  const wired = (name) => scripts[name] ?? (delegates(rootScripts[name]) ? undefined : rootScripts[name]);
  if (typeof wired('codegen') !== 'string') findings.push(found(WIRE_GENERATED, manifest, `${app} keeps a contract copy but declares no \`codegen\` script; wire types are generated from the copy, never typed by hand`, { app }));
  else for (const hook of ['prebuild', 'pretypecheck']) {
    if (!/\bcodegen\b/.test(String(wired(hook) ?? ''))) findings.push(found(WIRE_GENERATED, manifest, `${app} does not run codegen in \`${hook}\`; generate the wire types before build and typecheck`, { app, script: hook }));
  }
  const generated = `${base}/src/modules/api/__generated__`;
  const built = newestBelow(path.join(repoRoot, generated));
  if (built !== null) {
    for (const copy of copies) {
      let changed;
      try { changed = fs.statSync(path.join(repoRoot, copy)).mtimeMs; } catch { continue; }
      if (built + STALE_MS < changed) findings.push(found(WIRE_GENERATED, generated, `${generated} is older than ${copy}; run \`npm run codegen\` so the wire types match the contract copy`, { app, copy }));
    }
  }
  return findings;
}

function placementFindings({ repoRoot, app, tracked }) {
  const base = `apps/${app}`;
  const findings = [];
  const declares = (file) => { const pkg = readJson(repoRoot, file); return pkg ? ['dependencies', 'devDependencies'].some((section) => pkg[section]?.['next-intl'] !== undefined) : false; };
  const manifest = `${base}/package.json`;
  // The next-intl stack is written once per repository: in the app, or in the shared `packages/<family>-i18n` the apps call.
  const shared = tracked.filter((file) => /^packages\/[^/]+\/package\.json$/.test(file));
  if (tracked.includes(manifest) && ![manifest, 'package.json', ...shared].some(declares)) findings.push(found(I18N_PLACEMENT, manifest, `${app} does not depend on next-intl (nor does the root or a shared package); every app uses next-intl with the [locale] segment`, { app }));
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

/** The front-end tree findings of R52, R59 and R60 for every `next` app of the repository. */
export function frontendFindings({ repoRoot, files, repo }) {
  return repo.apps.filter((a) => a.kind === 'next').flatMap((a) => [wireFindings, placementFindings, catalogFindings].flatMap((check) => check({ repoRoot, app: a.name, tracked: files })));
}
