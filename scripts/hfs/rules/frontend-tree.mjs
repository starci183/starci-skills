// frontend.mjs - the front-end tree checks of starci app check. Per app of the fe side (`apps/<app>`, kind next, side-relative paths):
//   FE_I18N_PLACEMENT (R59)     next-intl with the `[locale]` segment: every route file sits under `src/app/[locale]/` (the root
//                               redirect page, global-error and health probes excepted), locale routing is `src/proxy.ts` and never
//                               `middleware.ts`, and the default locale's catalog `vi.json` exists
//   FE_I18N_CATALOG (R60)       every `modules/i18n/messages/<locale>.json` has the same key set
// Over the whole app (the root scope, app-relative paths: the one package.json and the be contract snapshots sit outside the fe side):
//   FE_WIRE_GENERATED (R52)     wire types come from the be contract snapshots the fe side reads in place (its declared reads,
//                               `be/contracts/`): the root package.json declares the `codegen` script, and each fe app's generated
//                               types on disk (`modules/api/graphql/__generated__/`, never tracked) record the schema digest
//   FE_I18N_PLACEMENT (R59)     `next-intl` is a dependency of an fe workspace (an fe app manifest, or a shared i18n package under fe/packages/)
// The files each app must hold (routing.ts, navigation.ts, request.ts, messages/, the [locale] layout) are the slot manifest's requires
// (HFS_SLOT_REQUIRED_MISSING); which source may hold display text and how copy resolves is eslint-fe's.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { found, readJson, readText } from './read.mjs';
import { byCodeUnit } from '../../lib/list.mjs';

const WIRE_GENERATED = 'FE_WIRE_GENERATED';
const I18N_PLACEMENT = 'FE_I18N_PLACEMENT';
const I18N_CATALOG = 'FE_I18N_CATALOG';
export const DEFAULT_LOCALE = 'vi';
const ROUTE_FILE = /\/(?:page|layout|template|loading|error|not-found)\.[jt]sx?$/;
const LOCALE = /^[a-z]{2,3}(?:-[A-Za-z0-9]+)*$/;
export const WIRE_SCHEMA_STAMP = '.schema-sha256';

/** Every leaf key of a parsed catalog as a dotted path. */
function catalogKeys(value, prefix = '') {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  const entries = Object.entries(value);
  return entries.length ? entries.flatMap(([key, child]) => catalogKeys(child, prefix ? `${prefix}.${key}` : key)) : [prefix];
}

/** Digest protocol for codegen: sorted app-relative schema path, NUL, LF-normalized source, NUL. */
export function wireSchemaDigest(repoRoot, snapshots) {
  const hash = createHash('sha256');
  for (const snapshot of [...snapshots].sort(byCodeUnit)) {
    let source;
    try { source = fs.readFileSync(path.join(repoRoot, snapshot), 'utf8'); } catch { return null; }
    hash.update(`${snapshot}\0${source.replace(/\r\n/g, '\n')}\0`);
  }
  return hash.digest('hex');
}

/** Generated output is untracked, so inspect disk; the digest sidecar alone is not generated wire types. */
function hasGeneratedTypes(directory) {
  let entries;
  try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch { return false; }
  return entries.some((entry) => entry.isDirectory() ? hasGeneratedTypes(path.join(directory, entry.name)) : entry.isFile() && entry.name.endsWith('.ts'));
}

const scriptsOf = (repoRoot, file) => readJson(repoRoot, file)?.scripts ?? {};

function wireDigestProblem(digest, stamped) {
  if (digest === null) return 'cannot be verified against unreadable contract snapshots';
  if (!/^[0-9a-f]{64}$/.test(stamped ?? '')) return 'has no valid schema digest recorded by codegen';
  if (stamped !== digest) return 'records a different schema digest from the contract snapshots';
  return null;
}

function appWireFindings({ repoRoot, files, app, snapshots, digest }) {
  const graphql = `fe/apps/${app}/src/modules/api/graphql/`;
  const generated = `${graphql}__generated__`;
  if (!hasGeneratedTypes(path.join(repoRoot, generated))) {
    const operations = files.some((file) => file.startsWith(graphql) && /^(?:(?:queries|mutations)\/[^/]+\.ts|(?!(?:__generated__|node_modules)\/).*\.graphql)$/.test(file.slice(graphql.length)));
    if (operations) return [found(WIRE_GENERATED, generated, `${app} keeps GraphQL operations but ${generated} has no generated wire types; run \`npm run codegen\``, { app })];
    return [];
  }
  if (!snapshots.length) return [];
  const stamped = readText(repoRoot, `${generated}/${WIRE_SCHEMA_STAMP}`)?.trim();
  const problem = wireDigestProblem(digest, stamped);
  if (problem === null) return [];
  return [found(WIRE_GENERATED, generated, `${generated} ${problem}; run \`npm run codegen\` so its wire types and ${WIRE_SCHEMA_STAMP} match the schema`, { app, snapshots })];
}

/** R52 over the app: root codegen, required operation output, and its recorded schema digest. */
function wireFindings({ repoRoot, files, apps, reads }) {
  const snapshots = files.filter((file) => file.endsWith('/schema.graphql') && reads.some((read) => file.startsWith(read)));
  const findings = [];
  if (snapshots.length && typeof scriptsOf(repoRoot, 'package.json').codegen !== 'string') findings.push(found(WIRE_GENERATED, 'package.json', `the app keeps contract snapshots (${reads.join(', ')}) but its package.json declares no \`codegen\` script; wire types are generated from the snapshots, never typed by hand`));
  const digest = snapshots.length ? wireSchemaDigest(repoRoot, snapshots) : null;
  findings.push(...apps.flatMap((app) => appWireFindings({ repoRoot, files, app, snapshots, digest })));
  return findings;
}

/** R59 over the app: next-intl is a dependency of an fe workspace manifest (fe/apps/<app> or fe/packages/<pkg>; the workspace that imports it declares it, R146). */
function intlDependencyFindings({ repoRoot, files }) {
  const declares = (file) => { const pkg = readJson(repoRoot, file); return pkg ? ['dependencies', 'devDependencies'].some((section) => pkg[section]?.['next-intl'] !== undefined) : false; };
  const workspaces = files.filter((file) => /^fe\/(?:apps|packages)\/[^/]+\/package\.json$/.test(file));
  return workspaces.some(declares) ? [] : [found(I18N_PLACEMENT, 'package.json', 'no fe workspace depends on next-intl (an fe app or a shared fe package declares it); every fe app uses next-intl with the [locale] segment')];
}

function placementFindings({ app, tracked }) {
  const base = `apps/${app}`;
  const findings = [];
  if (!tracked.includes(`${base}/src/proxy.ts`)) findings.push(found(I18N_PLACEMENT, `${base}/src/proxy.ts`, `${app} has no src/proxy.ts; locale routing lives in proxy.ts`, { app }));
  for (const file of tracked.filter((f) => new RegExp(`^${base}/src/middleware.[cm]?[jt]s$`).test(f))) findings.push(found(I18N_PLACEMENT, file, `${file} is a middleware file; Next 16 routes through src/proxy.ts`, { app }));
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
  const catalogs = tracked.filter((f) => f.startsWith(messages) && f.endsWith('.json') && !f.slice(messages.length).includes('/'));
  const keys = new Map();
  for (const file of catalogs) {
    const parsed = readJson(repoRoot, file);
    if (parsed !== null) keys.set(file, new Set(catalogKeys(parsed)));
  }
  if (keys.size < 2) return [];
  const all = new Set([...keys.values()].flatMap((set) => [...set]));
  const findings = [];
  for (const [file, set] of keys) {
    const missing = [...all].filter((key) => !set.has(key)).sort(byCodeUnit);
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
