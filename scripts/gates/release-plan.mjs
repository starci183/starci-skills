// Publication planning reads canon package pins and the final root version from package.json.
// Dependencies precede consumers; the root runtime follows the committed package binding phase.
// The registry is an owned API seam, allowing focused specs without provider effects.
import fs from 'node:fs';
import path from 'node:path';
import { byCodeUnit } from '../lib/list.mjs';
import { isSriSha512 } from '../lib/hash.mjs';
import { loadPins } from './canon-pins.mjs';
import { posixPath } from '../lib/path-key.mjs';

const SKIP = new Set(['node_modules', 'dist', 'storybook-static', 'reference-renders', 'coverage', '.git']);
/** The file a package carries when it bundles the runtime's canon-pins copy. */
const BUNDLED_PINS = 'runtime/knowledge/hfs/canon-pins.yaml';

/** Every package folder under packages/ (runtime-relative, posix); the walk stops at a package, so templates inside one are not packages. */
function packageFolders(root) {
  const found = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || SKIP.has(entry.name)) continue;
      const sub = path.join(dir, entry.name);
      if (fs.existsSync(path.join(sub, 'package.json'))) found.push(posixPath(path.relative(root, sub))); else walk(sub);
    }
  };
  if (fs.existsSync(path.join(root, 'packages'))) walk(path.join(root, 'packages'));
  return found;
}

/** The kind of one manifest row: set | pin-mismatch | source-mismatch | private | outside. */
const rowKind = (manifest, entry, dir) => {
  if (manifest.private) return 'private';
  if (!entry) return 'outside';
  if (entry.dir !== dir) return 'source-mismatch';
  if (entry.pin !== manifest.version) return 'pin-mismatch';
  return 'set';
};

const readRow = (root, set, dir) => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, dir, 'package.json'), 'utf8'));
  const entry = set.get(manifest.name);
  return { name: manifest.name, dir, version: manifest.version, pin: entry?.pin ?? '-', kind: rowKind(manifest, entry, dir),
    prepack: Boolean(manifest.scripts?.prepack), lock: fs.existsSync(path.join(root, dir, 'package-lock.json')),
    last: fs.existsSync(path.join(root, dir, BUNDLED_PINS)),
    deps: Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies, ...manifest.devDependencies, ...manifest.optionalDependencies }).filter((k) => k.startsWith('@starci/')) };
};

/**
 * The local rows: [{name, dir, version, pin, kind, prepack, lock, last, deps}]. kind: set | pin-mismatch | source-mismatch |
 * missing (in the publish set) or private | outside (not published here).
 */
export function readRows(root) {
  const set = new Map(Object.entries(loadPins(root)?.pins ?? {}).filter(([, p]) => p?.group === 'starci' && p.source)
    .map(([name, p]) => [name, { pin: String(p.version), dir: path.posix.dirname(p.source) }]));
  const rows = [];
  for (const dir of packageFolders(root)) rows.push(readRow(root, set, dir));
  for (const [name, entry] of set) {
    if (!rows.some((r) => r.name === name)) rows.push({ name, dir: entry.dir, version: '-', pin: entry.pin, kind: 'missing', prepack: false, lock: false, last: false, deps: [] });
  }
  return rows;
}

/** Dependencies precede consumers; ready leaves precede ready bundlers and name order breaks ties. */
export function publishOrder(rows) {
  const inPlan = rows.filter((r) => r.kind === 'set' || r.kind === 'pin-mismatch');
  const pending = new Map(inPlan.map((row) => [row.name, row]));
  const ordered = [];
  while (pending.size) {
    const ready = [...pending.values()].filter((row) => !row.deps.some((name) => pending.has(name)))
      .sort((a, b) => Number(a.last) - Number(b.last) || a.name.localeCompare(b.name));
    if (!ready.length) throw new Error(`dependency cycle among ${[...pending.keys()].sort(byCodeUnit).join(', ')}`);
    const row = ready[0];
    ordered.push(row);
    pending.delete(row.name);
  }
  return ordered;
}

/** The verdicts decided before a row is known published: a judged row, or null when the registry holds the version. */
function earlyVerdict(row, out) {
  if (row.kind === 'pin-mismatch') return { ...out, action: 'blocked', blocker: `${row.name}: local ${row.version} differs from its canon-pins version ${row.pin} (bump the pin first)` };
  if (out.registry.state === 'unreachable') return { ...out, action: 'unreachable', blocker: `${row.name}: registry unreachable (${out.registry.detail ?? 'no answer'})` };
  if (row.runtimePackage && !['absent', 'present'].includes(out.registry.state)) return { ...out, action: 'blocked', blocker: `${row.name}@${row.version}: unknown runtime registry state` };
  if (out.registry.state !== 'present') return out;
  if (row.runtimePackage && !isSriSha512(out.registry.integrity)) return { ...out, action: 'blocked', blocker: `${row.name}@${row.version}: registry returned no immutable runtime integrity` };
  return null;
}

const contentVerdict = (row, out, content) => {
  if (content.startsWith('crlf')) return { ...out, note: 'differs only by CRLF line endings of the working tree' };
  if (content.startsWith('dist')) return { ...out, note: `WARN ${content}: stale build output here; publish rebuilds` };
  if (content.startsWith('drift')) return { ...out, action: 'drift', note: content, blocker: `${row.name}@${row.version} is on the registry but the source differs (${content}): bump it, republish, rebind` };
  return { ...out, action: 'blocked', note: `content check inconclusive: ${content}`, blocker: `${row.name}@${row.version}: integrity differs and the content check was inconclusive (${content})` };
};

/** The verdicts for a row whose version the registry already holds: a published row's note, drift or block. */
function publishedVerdict(row, registry, out) {
  const local = registry.localIntegrity(row.dir);
  if (row.runtimePackage && !local) return { ...out, action: 'blocked', blocker: `${row.name}@${row.version}: local runtime pack could not be listed` };
  if (!local) return { ...out, note: 'local pack could not be listed' };
  if (local === out.registry.integrity) return { ...out, note: 'integrity matches' };
  const content = registry.contentClass(row.name, row.version, row.dir);
  if (content === 'same') return { ...out, note: 'every file is identical; only the pack metadata differs' };
  if (row.runtimePackage) return { ...out, action: 'blocked', note: content, blocker: `${row.name}@${row.version}: published runtime bytes differ or cannot be proved (${content}); its version is immutable` };
  return contentVerdict(row, out, content);
}

/** One ordered row judged against the registry: {...row, registry, action: publish | published | drift | blocked | unreachable, note, blocker?}. */
function judge(row, registry) {
  const out = { ...row, registry: registry.state(row.name, row.version), action: 'publish', note: '' };
  const early = earlyVerdict(row, out);
  if (early) return early;
  out.action = 'published';
  return publishedVerdict(row, registry, out);
}

/** The root runtime row a non-'packages' plan appends, its deps the publish-set package rows. */
const runtimeRow = (root, rows) => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  if (manifest.name !== 'starci' || manifest.private || typeof manifest.version !== 'string' || !manifest.version) throw new Error('root package.json must declare the public starci runtime version');
  return { name: manifest.name, dir: '.', version: manifest.version, pin: '-', kind: 'set', runtimePackage: true,
    prepack: Boolean(manifest.scripts?.prepack), lock: fs.existsSync(path.join(root, 'package-lock.json')), last: true,
    deps: rows.filter((row) => ['set', 'pin-mismatch'].includes(row.kind)).map((row) => row.name) };
};

// A publish (or a forced bump) changes the canon-pins copy the bundling packages carry: each must carry a new version too.
const bundlingBlockers = (ordered) =>
  ordered.some((r) => !r.last && (r.action === 'publish' || r.action === 'drift'))
    ? ordered.filter((r) => r.last && !r.runtimePackage && r.action === 'published')
      .map((row) => `${row.name}@${row.version} is already published, but a publish or version bump of another package changes the canon-pins copy it bundles: bump it, resync its runtime copy, rebind`)
    : [];

const runtimeBlockers = (runtime, upstream, scope) => {
  const blockers = [];
  if (runtime?.action === 'published' && upstream.some((row) => ['publish', 'drift'].includes(row.action))) blockers.push(`${runtime.name}@${runtime.version} is already published before final package bindings; changed runtime payload needs a new root package version`);
  if (scope === 'runtime') for (const row of upstream.filter((entry) => entry.action !== 'published')) blockers.push(`${runtime.name}: publish and bind ${row.name}@${row.version} before the runtime package phase`);
  return blockers;
};

/**
 * The plan: {rows, others, blockers, toPublish}. Each ordered row carries its registry answer and action; `blockers` are the
 * reasons a release must not go on. registry: the seam of release-registry.mjs.
 */
export function buildPlan({ root, registry, scope = 'all' }) {
  if (!['all', 'packages', 'runtime'].includes(scope)) throw new Error(`unknown publication scope ${scope}`);
  const rows = readRows(root);
  if (scope !== 'packages') rows.push(runtimeRow(root, rows));
  const blockers = [];
  const others = rows.filter((r) => !['set', 'pin-mismatch'].includes(r.kind));
  for (const row of others) {
    if (row.kind === 'source-mismatch') blockers.push(`${row.name}: canon-pins source is not ${row.dir}`);
    if (row.kind === 'missing') blockers.push(`${row.name}: source ${row.dir} has no package.json`);
  }
  const ordered = publishOrder(rows).map((row) => judge(row, registry));
  for (const row of ordered) if (row.blocker) blockers.push(row.blocker);
  blockers.push(...bundlingBlockers(ordered));
  const runtime = ordered.find((row) => row.runtimePackage);
  const upstream = ordered.filter((row) => !row.runtimePackage);
  blockers.push(...runtimeBlockers(runtime, upstream, scope));
  const selected = scope === 'runtime' ? ordered.filter((row) => row.runtimePackage) : ordered;
  return { rows: selected, others, blockers, toPublish: selected.filter((r) => r.action === 'publish') };
}
