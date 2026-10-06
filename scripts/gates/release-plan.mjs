// Publication planning reads canon package pins and the final root version from package.json.
// Dependencies precede consumers; the root runtime follows the committed package binding phase.
// The registry is an owned API seam, allowing focused specs without provider effects.
import fs from 'node:fs';
import path from 'node:path';
import { byCodeUnit } from '../lib/list.mjs';
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

/**
 * The local rows: [{name, dir, version, pin, kind, prepack, lock, last, deps}]. kind: set | pin-mismatch | source-mismatch |
 * missing (in the publish set) or private | outside (not published here).
 */
export function readRows(root) {
  const set = new Map(Object.entries(loadPins(root)?.pins ?? {}).filter(([, p]) => p?.group === 'starci' && p.source)
    .map(([name, p]) => [name, { pin: String(p.version), dir: path.posix.dirname(p.source) }]));
  const rows = [];
  for (const dir of packageFolders(root)) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, dir, 'package.json'), 'utf8'));
    const entry = set.get(manifest.name);
    const kind = manifest.private ? 'private' : !entry ? 'outside' : entry.dir !== dir ? 'source-mismatch' : entry.pin !== manifest.version ? 'pin-mismatch' : 'set';
    rows.push({ name: manifest.name, dir, version: manifest.version, pin: entry?.pin ?? '-', kind,
      prepack: Boolean(manifest.scripts?.prepack), lock: fs.existsSync(path.join(root, dir, 'package-lock.json')),
      last: fs.existsSync(path.join(root, dir, BUNDLED_PINS)),
      deps: Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies, ...manifest.devDependencies, ...manifest.optionalDependencies }).filter((k) => k.startsWith('@starci/')) });
  }
  for (const [name, entry] of set) if (!rows.some((r) => r.name === name)) rows.push({ name, dir: entry.dir, version: '-', pin: entry.pin, kind: 'missing', prepack: false, lock: false, last: false, deps: [] });
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

/** One ordered row judged against the registry: {...row, registry, action: publish | published | drift | blocked | unreachable, note, blocker?}. */
function judge(row, registry) {
  const out = { ...row, registry: registry.state(row.name, row.version), action: 'publish', note: '' };
  if (row.kind === 'pin-mismatch') return { ...out, action: 'blocked', blocker: `${row.name}: local ${row.version} differs from its canon-pins version ${row.pin} (bump the pin first)` };
  if (out.registry.state === 'unreachable') return { ...out, action: 'unreachable', blocker: `${row.name}: registry unreachable (${out.registry.detail ?? 'no answer'})` };
  if (row.runtimePackage && !['absent', 'present'].includes(out.registry.state)) return { ...out, action: 'blocked', blocker: `${row.name}@${row.version}: unknown runtime registry state` };
  if (out.registry.state !== 'present') return out;
  if (row.runtimePackage && !/^[0-9a-f]{40}$/.test(String(out.registry.shasum ?? ''))) return { ...out, action: 'blocked', blocker: `${row.name}@${row.version}: registry returned no immutable runtime shasum` };
  out.action = 'published';
  const local = registry.localShasum(row.dir);
  if (row.runtimePackage && !local) return { ...out, action: 'blocked', blocker: `${row.name}@${row.version}: local runtime pack could not be listed` };
  if (!local) return { ...out, note: 'local pack could not be listed' };
  if (local === out.registry.shasum) return { ...out, note: 'shasum matches' };
  const content = registry.contentClass(row.name, row.version, row.dir);
  if (content === 'same') return { ...out, note: 'every file is identical; only the pack metadata differs' };
  if (row.runtimePackage) return { ...out, action: 'blocked', note: content, blocker: `${row.name}@${row.version}: published runtime bytes differ or cannot be proved (${content}); its version is immutable` };
  if (content.startsWith('crlf')) return { ...out, note: 'differs only by CRLF line endings of the working tree' };
  if (content.startsWith('dist')) return { ...out, note: `WARN ${content}: stale build output here; publish rebuilds` };
  if (content.startsWith('drift')) return { ...out, action: 'drift', note: content, blocker: `${row.name}@${row.version} is on the registry but the source differs (${content}): bump it, republish, rebind` };
  return { ...out, action: 'blocked', note: `content check inconclusive: ${content}`, blocker: `${row.name}@${row.version}: shasum differs and the content check was inconclusive (${content})` };
}

/**
 * The plan: {rows, others, blockers, toPublish}. Each ordered row carries its registry answer and action; `blockers` are the
 * reasons a release must not go on. registry: the seam of release-registry.mjs.
 */
export function buildPlan({ root, registry, scope = 'all' }) {
  if (!['all', 'packages', 'runtime'].includes(scope)) throw new Error(`unknown publication scope ${scope}`);
  const rows = readRows(root);
  if (scope !== 'packages') {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    if (manifest.name !== 'starci' || manifest.private || typeof manifest.version !== 'string' || !manifest.version) throw new Error('root package.json must declare the public starci runtime version');
    rows.push({ name: manifest.name, dir: '.', version: manifest.version, pin: '-', kind: 'set', runtimePackage: true,
      prepack: Boolean(manifest.scripts?.prepack), lock: fs.existsSync(path.join(root, 'package-lock.json')), last: true,
      deps: rows.filter((row) => ['set', 'pin-mismatch'].includes(row.kind)).map((row) => row.name) });
  }
  const blockers = [];
  const others = rows.filter((r) => !['set', 'pin-mismatch'].includes(r.kind));
  for (const row of others) {
    if (row.kind === 'source-mismatch') blockers.push(`${row.name}: canon-pins source is not ${row.dir}`);
    if (row.kind === 'missing') blockers.push(`${row.name}: source ${row.dir} has no package.json`);
  }
  const ordered = publishOrder(rows).map((row) => judge(row, registry));
  for (const row of ordered) if (row.blocker) blockers.push(row.blocker);
  // A publish (or a forced bump) changes the canon-pins copy the bundling packages carry: each must carry a new version too.
  if (ordered.some((r) => !r.last && (r.action === 'publish' || r.action === 'drift'))) {
    for (const row of ordered.filter((r) => r.last && !r.runtimePackage && r.action === 'published')) {
      blockers.push(`${row.name}@${row.version} is already published, but a publish or version bump of another package changes the canon-pins copy it bundles: bump it, resync its runtime copy, rebind`);
    }
  }
  const runtime = ordered.find((row) => row.runtimePackage);
  const upstream = ordered.filter((row) => !row.runtimePackage);
  if (runtime?.action === 'published' && upstream.some((row) => ['publish', 'drift'].includes(row.action))) blockers.push(`${runtime.name}@${runtime.version} is already published before final package bindings; changed runtime payload needs a new root package version`);
  if (scope === 'runtime') for (const row of upstream.filter((entry) => entry.action !== 'published')) blockers.push(`${runtime.name}: publish and bind ${row.name}@${row.version} before the runtime package phase`);
  const selected = scope === 'runtime' ? ordered.filter((row) => row.runtimePackage) : ordered;
  return { rows: selected, others, blockers, toPublish: selected.filter((r) => r.action === 'publish') };
}
