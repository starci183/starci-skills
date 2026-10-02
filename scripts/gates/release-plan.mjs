// release-plan.mjs - what a release would publish, decided from the tree and the registry's answers: the publish set (every
// `group: starci` pin of knowledge/hfs/canon-pins.yaml that names a source), its order (leaves by @starci dependency, then
// the packages that bundle the runtime's canon-pins copy, last), and the blockers. No process is started here: the registry
// is a seam (release-registry.mjs), so the plan is judged on fakes in specs.
import fs from 'node:fs';
import path from 'node:path';
import { loadPins } from './canon-pins.mjs';
import { posixPath } from '../lib/path-key.mjs';

const SKIP = new Set(['node_modules', 'dist', 'storybook-static', 'reference-renders', 'coverage', '.git']);
/** The file a package carries when it bundles the runtime's canon-pins copy: such a package is published after every other one. */
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
      deps: Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies, ...manifest.devDependencies }).filter((k) => k.startsWith('@starci/')) });
  }
  for (const [name, entry] of set) if (!rows.some((r) => r.name === name)) rows.push({ name, dir: entry.dir, version: '-', pin: entry.pin, kind: 'missing', prepack: false, lock: false, last: false, deps: [] });
  return rows;
}

/** The publish order of the rows in the set: leaves by @starci dependency (name order breaks ties), then the bundling packages by name. */
export function publishOrder(rows) {
  const inPlan = rows.filter((r) => r.kind === 'set' || r.kind === 'pin-mismatch');
  const leaves = inPlan.filter((r) => !r.last).sort((a, b) => a.name.localeCompare(b.name));
  const ordered = [];
  const seen = new Set();
  const visit = (row, trail = []) => {
    if (seen.has(row.name)) return;
    if (trail.includes(row.name)) throw new Error(`dependency cycle ${[...trail, row.name].join(' > ')}`);
    for (const dep of row.deps) { const found = leaves.find((x) => x.name === dep); if (found) visit(found, [...trail, row.name]); }
    seen.add(row.name);
    ordered.push(row);
  };
  leaves.forEach((row) => visit(row));
  return [...ordered, ...inPlan.filter((r) => r.last).sort((a, b) => a.name.localeCompare(b.name))];
}

/** One ordered row judged against the registry: {...row, registry, action: publish | published | drift | blocked | unreachable, note, blocker?}. */
function judge(row, registry) {
  const out = { ...row, registry: registry.state(row.name, row.version), action: 'publish', note: '' };
  if (row.kind === 'pin-mismatch') return { ...out, action: 'blocked', blocker: `${row.name}: local ${row.version} differs from its canon-pins version ${row.pin} (bump the pin first)` };
  if (out.registry.state === 'unreachable') return { ...out, action: 'unreachable', blocker: `${row.name}: registry unreachable (${out.registry.detail ?? 'no answer'})` };
  if (out.registry.state !== 'present') return out;
  out.action = 'published';
  const local = registry.localShasum(row.dir);
  if (!local) return { ...out, note: 'local pack could not be listed' };
  if (local === out.registry.shasum) return { ...out, note: 'shasum matches' };
  const content = registry.contentClass(row.name, row.version, row.dir);
  if (content === 'same') return { ...out, note: 'every file is identical; only the pack metadata differs' };
  if (content.startsWith('crlf')) return { ...out, note: 'differs only by CRLF line endings of the working tree' };
  if (content.startsWith('dist')) return { ...out, note: `WARN ${content}: stale build output here; publish rebuilds` };
  if (content.startsWith('drift')) return { ...out, action: 'drift', note: content, blocker: `${row.name}@${row.version} is on the registry but the source differs (${content}): bump it, republish, rebind` };
  return { ...out, action: 'blocked', note: `content check inconclusive: ${content}`, blocker: `${row.name}@${row.version}: shasum differs and the content check was inconclusive (${content})` };
}

/**
 * The plan: {rows, others, blockers, toPublish}. Each ordered row carries its registry answer and action; `blockers` are the
 * reasons a release must not go on. registry: the seam of release-registry.mjs.
 */
export function buildPlan({ root, registry }) {
  const rows = readRows(root);
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
    for (const row of ordered.filter((r) => r.last && r.action === 'published')) {
      blockers.push(`${row.name}@${row.version} is already published, but a publish or version bump of another package changes the canon-pins copy it bundles: bump it, resync its runtime copy, rebind`);
    }
  }
  return { rows: ordered, others, blockers, toPublish: ordered.filter((r) => r.action === 'publish') };
}
