// Every .starciwork path an op manifest reads, writes or cites in a proof is a
// path the Work layout admits and, when it is a YAML record, one a schema binds.
//
// Two live kernels stalled on the same op (workspace.manage) because its
// contract named Work paths the layout did not admit: a root-level
// .starciwork/<scope>/index.yaml record (inc-7de1fb976e34, 3edefde1b) and then
// .starciwork/_resources/repositories/<resource>/resource.yaml (inc-5c968fe64492).
// A preflight that compares the contract with the layout refuses such a path, so
// the contradiction surfaces as a stalled workflow hours later. This spec makes
// it surface here instead: it walks all 37 manifests (op-level and every
// policy.executionModes.<mode>) and unifies each .starciwork path against
//   - admitted: modules/schemas/work-layout.yaml shape (its leading path per
//     entry - each family through its own entry, so ac is br/<rule>/ac/<name>, not a flat ac/);
//   - schema:   modules/schemas/index.yaml schemas[].binds (.yaml records only).
//
// KNOWN pins the contradictions that exist today and are not a one-line fix
// (each needs a layout/schema decision of its own). It is a ratchet: a new
// finding fails, and so does a KNOWN entry that no longer reproduces - fixing
// one means deleting its line here.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../engine/yaml.mjs';

const root = path.resolve(import.meta.dirname, '..');
const readYaml = (rel) => parseYaml(fs.readFileSync(path.join(root, rel), 'utf8'));
const layout = readYaml('modules/schemas/work-layout.yaml');
const catalog = readYaml('modules/schemas/index.yaml');
const opsDir = path.join(root, 'modules/ops/ops');
const ops = fs.readdirSync(opsDir).filter((f) => f.endsWith('.yaml')).sort()
  .map((f) => ({ file: `modules/ops/ops/${f}`, doc: readYaml(`modules/ops/ops/${f}`) }));

// ------------------------------------------------------------------ patterns
// A path token: slash-separated segments, where a segment may be a {a,b} brace
// group (the layout writes `{index.yaml,accounts.yaml, assets/}` with spaces).
const TOKEN = /(?:\{[^}]*\}|[\w.<>*@-])+(?:\/(?:\{[^}]*\}|[\w.<>*@-])*)*/y;
const tokenAt = (text, index) => { TOKEN.lastIndex = index; return TOKEN.exec(text)?.[0] ?? null; };

/** Expand the first-level brace groups of a path token into plain paths. */
function expand(token) {
  const m = /\{([^}]*)\}/.exec(token);
  if (!m) return [token];
  return m[1].split(',').map((s) => s.trim()).filter(Boolean)
    .flatMap((alt) => expand(token.slice(0, m.index) + alt + token.slice(m.index + m[0].length)));
}

const MULTI = new Set(['**', '<node>', '<uat-node>']);
const segs = (p) => {
  const parts = p.replace(/^\.starciwork\//, '').split('/');
  if (parts.at(-1) === '') parts[parts.length - 1] = '**'; // a trailing slash grants the directory
  return parts;
};
const isLiteral = (s) => !/[<*]/.test(s);
const segRegex = (s) => new RegExp(`^${s.split(/(<[^>]*>|\*)/).map((part) =>
  (part === '*' || /^<.*>$/.test(part) ? '.+' : part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))).join('')}$`);

// One op segment against one layout segment. An op placeholder is a slot the
// layout must also leave open - `<docs-dir>` does not become `brand` - while a
// literal on either side only meets an equal literal or a pattern that admits it.
function segMatch(op, lay) {
  if (isLiteral(op) && isLiteral(lay)) return op === lay;
  if (isLiteral(op)) return segRegex(lay).test(op);
  if (isLiteral(lay)) return false;
  return true;
}

// Segment-list unification. Layout `**`/<node> spans any run of op segments;
// an op `**` ("some record below here") spans any run of layout segments. A
// <node> is a record directory, so it never spans the reserved _resources/,
// evidence/ or assets/ folders a node cannot live in (engine/index.mjs LAYOUT).
const NOT_NODE = new Set(['_resources', 'evidence', 'assets']);
function unify(op, lay) {
  const memo = new Map();
  const go = (i, j) => {
    const k = `${i},${j}`;
    if (memo.has(k)) return memo.get(k);
    let r;
    if (i === op.length && j === lay.length) r = true;
    else if (j < lay.length && MULTI.has(lay[j])) {
      r = go(i, j + 1) || (i < op.length && !(lay[j] !== '**' && NOT_NODE.has(op[i])) && go(i + 1, j));
    }
    else if (i < op.length && op[i] === '**') r = go(i + 1, j) || (j < lay.length && go(i, j + 1));
    else r = i < op.length && j < lay.length && segMatch(op[i], lay[j]) && go(i + 1, j + 1);
    memo.set(k, r);
    return r;
  };
  return go(0, 0);
}

// Payload patterns (a node's assets/ or a uat flow's runs/) admit files, not
// records: they only meet an op path that itself names assets/ or runs/.
const PAYLOAD = new Set(['assets', 'runs']);
const isPayload = (s) => s.some((x) => PAYLOAD.has(x));

// familiesNote and designReview are prose about the executable families array
// and legacy fields; their first path is illustrative, not an admission.
const PROSE_KEYS = new Set(['familiesNote', 'designReview']);
const leadingPath = (text) => {
  const lead = tokenAt(text, 0);
  if (lead && (lead.includes('/') || /\.\w+$/.test(lead))) return lead;
  const at = text.indexOf('.starciwork/');
  if (at >= 0) return tokenAt(text, at);
  const node = text.search(/<node>\//);
  return node >= 0 ? tokenAt(text, node) : null;
};
export const admitted = [
  ...Object.entries(layout.shape).filter(([k, v]) => typeof v === 'string' && !PROSE_KEYS.has(k))
    .flatMap(([k, v]) => { const lead = leadingPath(v); return lead ? expand(lead).map((p) => ({ key: k, segs: segs(p) })) : []; }),
];
// The layout's own catalog entry binds .starciwork/** as a shape, not a record
// body, so it is no schema for any one file.
export const schemaBinds = catalog.schemas.filter((s) => typeof s.binds === 'string' && s.id !== layout.schema)
  .flatMap((s) => [...s.binds.matchAll(/\.starciwork\//g)].flatMap((m) => {
    const token = tokenAt(s.binds, m.index);
    return token ? expand(token).map((p) => ({ id: s.id, segs: segs(p) })) : [];
  }));

// ------------------------------------------------------------------ op paths
// `<family>` in an op path is each layout family in the folder its own shape
// entry spells: br/<rule>/ac for ac, impl/<repository> for impl.
export const familyFolders = layout.shape.families.map((f) => {
  const m = /^features\/<feature>\/(.+?)\/<name>\//.exec(leadingPath(String(layout.shape[f] ?? '')) ?? '');
  return m ? m[1] : null;
});
const expandFamily = (p) => (p.includes('<family>') ? familyFolders.map((f) => p.replace('<family>', f ?? '<missing-family-entry>')) : [p]);

/** Every .starciwork path token in one string, with its brace alternatives. */
function workTokens(text) {
  return [...String(text ?? '').matchAll(/\.starciwork\//g)]
    .map((m) => tokenAt(text, m.index)).filter(Boolean);
}

/** {where, token} for every .starciwork path a manifest reads, writes or proves. */
export function workPathsOf(doc) {
  const sections = [['', doc], ...Object.entries(doc.policy?.executionModes ?? {}).map(([mode, c]) => [`executionModes.${mode}.`, c])];
  const out = [];
  for (const [prefix, contract] of sections) {
    for (const kind of ['reads', 'writes']) {
      for (const entry of contract?.[kind] ?? []) for (const token of workTokens(entry.path)) out.push({ where: `${prefix}${kind}.${entry.id}`, token });
    }
    for (const proof of contract?.proofs ?? []) {
      for (const text of [proof.check, proof.requirement?.en]) for (const token of workTokens(text)) out.push({ where: `${prefix}proofs.${proof.id}`, token });
    }
  }
  return out;
}

/** The findings for one manifest: PATH_UNADMITTED or PATH_UNSCHEMED per token. */
export function checkWorkPaths({ file, doc }) {
  const findings = [];
  for (const { where, token } of workPathsOf(doc)) {
    const paths = expand(token).flatMap(expandFamily).map(segs);
    // Brace alternatives and <family> are one declared path: every alternative must hold.
    const unadmitted = paths.filter((p) => !admitted.some((a) => (isPayload(p) || !isPayload(a.segs)) && unify(p, a.segs)));
    if (unadmitted.length) { findings.push(`${file} ${where} PATH_UNADMITTED ${token}`); continue; }
    const records = paths.filter((p) => /\.ya?ml$/.test(p.at(-1)) && !isPayload(p));
    if (records.some((p) => !schemaBinds.some((b) => unify(p, b.segs)))) findings.push(`${file} ${where} PATH_UNSCHEMED ${token}`);
  }
  return findings;
}

// The contradictions on main when this spec landed. Each needs its own layout
// or schema decision, so it is listed rather than silently tolerated.
const KNOWN = [
  // Documentation under .starciwork has no layout folder (docs belong in the repository or a record's assets/).
  'modules/ops/ops/docs.author.yaml writes.docs PATH_UNADMITTED .starciwork/<docs-dir>/<doc>.md',
  // Sealed secrets: singular identity/ folder and a secrets file; the identity kind holds only a custody ref.
  'modules/ops/ops/integration.verify.yaml reads.credential PATH_UNADMITTED .starciwork/_resources/identity/<slug>/secrets.enc.yaml',
  // An operations family the layout says does not exist; the audit record needs a catalog/feature home.
  'modules/ops/ops/interface.audit.yaml reads.target PATH_UNADMITTED .starciwork/features/<feature>/operations/<audit>/index.yaml',
  'modules/ops/ops/interface.audit.yaml writes.node PATH_UNADMITTED .starciwork/features/<feature>/operations/<audit>/index.yaml',
  // Resource kinds outside environment|identity|fixture: release, design, runtime, service, import.
  'modules/ops/ops/release.deliver.yaml executionModes.deploy.reads.release PATH_UNADMITTED .starciwork/_resources/releases/<resource>/resource.yaml',
  'modules/ops/ops/release.deliver.yaml executionModes.deploy.writes.resource PATH_UNADMITTED .starciwork/_resources/releases/<resource>/resource.yaml',
  'modules/ops/ops/review.verify.yaml executionModes.visual.reads.design PATH_UNADMITTED .starciwork/_resources/design/<resource>/resource.yaml',
  'modules/ops/ops/runtime.operate.yaml executionModes.serve.reads.runtime PATH_UNADMITTED .starciwork/_resources/runtimes/<resource>/resource.yaml',
  'modules/ops/ops/runtime.operate.yaml executionModes.serve.writes.resource PATH_UNADMITTED .starciwork/_resources/runtimes/<resource>/resource.yaml',
  'modules/ops/ops/runtime.operate.yaml executionModes.service.reads.service PATH_UNADMITTED .starciwork/_resources/services/<resource>/resource.yaml',
  'modules/ops/ops/runtime.operate.yaml executionModes.service.writes.resource PATH_UNADMITTED .starciwork/_resources/services/<resource>/resource.yaml',
  'modules/ops/ops/workspace.manage.yaml executionModes.import.writes.resources PATH_UNADMITTED .starciwork/_resources/imports/<resource>/resource.yaml',
  'modules/ops/ops/workspace.manage.yaml executionModes.import.writes.resources PATH_UNADMITTED .starciwork/_resources/imports/<resource>/assets/<asset>',
];

test('the layout and schema catalog parse into path patterns this spec can use', () => {
  const keys = new Set(admitted.map((a) => a.key));
  for (const k of ['workspace', 'brand', 'featureCatalog', 'feature', 'resources', 'uatFlow', 'uatRun', 'workflowRunState', 'impl', 'ac'])
    assert.ok(keys.has(k), `shape.${k} yields no admitted path`);
  assert.equal(ops.length, 37, 'every op manifest is walked');
  assert.ok(familyFolders.every(Boolean), 'every family in shape.families has its own shape entry');
  assert.ok(familyFolders.includes('br/<rule>/ac') && familyFolders.includes('impl/<repository>'));
  const resources = admitted.filter((a) => a.key === 'resources').map((a) => a.segs.join('/')).sort();
  assert.deepEqual(resources, ['_resources/environments/<name>/resource.yaml', '_resources/fixtures/<name>/resource.yaml', '_resources/identities/<name>/resource.yaml']);
  assert.ok(schemaBinds.some((b) => b.id === 'work/resource@1'));
});

test('the matcher refuses the two paths that stalled live kernels and admits their replacements', () => {
  const run = (paths) => checkWorkPaths({ file: 'synthetic.yaml', doc: { writes: paths.map((p, i) => ({ id: `w${i}`, path: p })) } });
  assert.deepEqual(run([
    '.starciwork/_resources/repositories/<resource>/resource.yaml',
    '.starciwork/import-cv-seam/index.yaml',
    '.starciwork/features/<feature>/operations/<audit>/index.yaml',
    '.starciwork/<docs-dir>/<doc>.md',
  ]), [
    'synthetic.yaml writes.w0 PATH_UNADMITTED .starciwork/_resources/repositories/<resource>/resource.yaml',
    'synthetic.yaml writes.w1 PATH_UNADMITTED .starciwork/import-cv-seam/index.yaml',
    'synthetic.yaml writes.w2 PATH_UNADMITTED .starciwork/features/<feature>/operations/<audit>/index.yaml',
    'synthetic.yaml writes.w3 PATH_UNADMITTED .starciwork/<docs-dir>/<doc>.md',
  ]);
  assert.deepEqual(run([
    '.starciwork/workspace.yaml',
    '.starciwork/index.yaml extensions.work3.setup.<workflow>.prepare',
    '.starciwork/features/<feature>/<family>/<name>/index.yaml',
    '.starciwork/features/<feature>/{sds,contract,integration}/**/index.yaml',
    '.starciwork/features/<feature>/**/index.yaml',
    '.starciwork/_resources/{identities/<identity>,fixtures/<fixture>}/resource.yaml',
    '.starciwork/features/<feature>/impl/<repository>/<name>/assets/running-page.png',
    '.starciwork/features/<feature>/uat/<flow>/runs/<runId>/**',
    '.starciwork/features/<feature>/uat/<name>/accounts.yaml',
    '.starciwork/brand/assets/<asset>',
    '.starciwork/runtime.sqlite',
  ]), []);
});

test('every op manifest reads, writes and proves only Work paths the layout admits and a schema binds', () => {
  const findings = ops.flatMap(checkWorkPaths);
  const fresh = findings.filter((f) => !KNOWN.includes(f));
  const stale = KNOWN.filter((k) => !findings.includes(k));
  assert.deepEqual(fresh, [], 'new contradiction(s) between an op contract and work-layout.yaml / the schema catalog');
  assert.deepEqual(stale, [], 'KNOWN entries that no longer reproduce - delete them');
});

test('no op authors a _resources repository record: repository identity is workspace.yaml repositories[] and the project binding', () => {
  const offenders = ops.flatMap(({ file, doc }) => workPathsOf(doc)
    .filter(({ token }) => /_resources\/repositories\//.test(token)).map(({ where }) => `${file} ${where}`));
  assert.deepEqual(offenders, []);
});
