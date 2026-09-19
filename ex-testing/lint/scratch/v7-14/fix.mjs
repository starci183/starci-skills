/**
 * v7-14 mechanical fixer. Default is a dry run that prints every line it would change; --apply writes.
 *
 * Every rule is a line-anchored exact replacement with an assertion on the expected count, so an
 * unexpected tree state aborts the whole run instead of half-editing it. Nothing here rewrites a digest,
 * a `stale:` marker, or an evidence file.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {parseYaml} from '../../../../core/yaml.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const HOST = path.resolve(here, '../../../..');
const APPLY = process.argv.includes('--apply');
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

const TODO = 'examples/todo-app-backend/.starciwork';
const walk = rel => {
  const dir = path.join(HOST, rel);
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(e => e.isDirectory()
    ? (['_derived', '_local'].includes(e.name) ? [] : walk(`${rel}/${e.name}`))
    : [`${rel}/${e.name}`]);
};

/** A rule: {file, label, from: RegExp, to: string|fn, expect: n, must: (text)=>void} */
const rules = [];
const add = (file, label, from, to, expect, must) => rules.push({file, label, from, to, expect, must});

// ---- R1: every todo backend impl record names the repository the directory and its id already name ----
const beImpls = walk(TODO).filter(f => /\/impl\/todo-app-backend\/[^/]+\/index\.yaml$/.test(f)).sort();
for (const f of beImpls) {
  add(f, 'repository-dir-mismatch', /^repository: todo-app$/m, 'repository: todo-app-backend', 1, (text) => {
    const rec = parseYaml(text);
    if (!String(rec.id).startsWith(`impl.`) || !rec.id.includes('.todo-app-backend.')) {
      throw new Error(`${f}: id ${rec.id} does not embed todo-app-backend, so the field is not the odd one out`);
    }
    if (rec.repository !== 'todo-app') throw new Error(`${f}: repository is already ${rec.repository}`);
  });
}

// ---- R2: the workspace document declares the be repository by the name the directory has ----
add(`${TODO}/workspace.yaml`, 'workspace-be-entry-name', /^(\s*)name: todo-app$/m, '$1name: todo-app-backend', 1, (text) => {
  const ws = parseYaml(text);
  const be = ws.repositories.find(r => r.role === 'be');
  if (be?.name !== 'todo-app') throw new Error(`workspace.yaml be entry is ${be?.name}`);
  if (ws.repositories.some(r => r.name === 'todo-app-backend')) throw new Error('workspace.yaml already declares todo-app-backend');
  const hits = text.match(/^\s*name: todo-app$/mg) ?? [];
  if (hits.length !== 1) throw new Error(`workspace.yaml has ${hits.length} lines matching "name: todo-app" (id:/project: use a different indent) — refusing to guess`);
});

// ---- R3/R4: machine-absolute paths → repo-relative, in brand + the todo ui records ----
// Both prefixes name a *different* Orca worktree of this same host (`ex-draw-v3`, `ex-lint`); the files
// under them are byte-present in this checkout, which the pin check verified before this rule was written.
const ABS_RULES = [
  {label: 'abs-grammar-root', re: /C:\/Users\/Hi\/orca\/workspaces\/\.claude\/ex-draw-v3\/examples\/todo-app-frontend\/?/g,
    to: m => `examples/todo-app-frontend${m.endsWith('/') ? '/' : ''}`},
  {label: 'abs-lint-root', re: /C:\/Users\/Hi\/orca\/workspaces\/\.claude\/ex-lint\//g, to: () => ''},
];
const absTargets = [`${TODO}/brand/index.yaml`,
  ...walk(TODO).filter(f => /\/ui\/[^/]+\/index\.yaml$/.test(f)).sort()];
for (const f of absTargets) {
  const text = fs.readFileSync(path.join(HOST, f), 'utf8');
  let projected = text;
  for (const rule of ABS_RULES) {
    const hits = projected.match(new RegExp(rule.re.source, 'g')) ?? [];
    projected = projected.replace(new RegExp(rule.re.source, 'g'), rule.to);
    if (hits.length) add(f, rule.label, rule.re, rule.to, hits.length);
  }
  const leftover = projected.match(/[A-Za-z]:[\\/](?:Users|Program Files)[^\s"',\]]*/g) ?? [];
  if (leftover.length) console.log(`NOTE ${f}: ${leftover.length} other machine path(s) left alone: ${[...new Set(leftover)].slice(0, 3).join(' , ')}`);
}

// ---- R5: impl revision as the full sha the schema's own pattern requires ----
const REVISIONS = {
  '750bd4b1': '750bd4b1502aa47f44462f16e68a693c0a7d3803',
  '5ff83e19': '5ff83e1986186965c1272290830323ef2bc2db2d',
  'b104d717': 'b104d71744a67bd6c231e374292c12d78fa7ca9a',
};
for (const f of walk(TODO).filter(x => x.endsWith('/index.yaml'))) {
  const text = fs.readFileSync(path.join(HOST, f), 'utf8');
  const m = text.match(/^revision: ([a-f0-9]{8})$/m);
  if (!m || !REVISIONS[m[1]]) continue;
  add(f, 'revision-short-sha', /^revision: ([a-f0-9]{8})$/m, `revision: ${REVISIONS[m[1]]}`, 1);
}

// ---- apply ----
const byFile = new Map();
for (const r of rules) {
  if (!byFile.has(r.file)) byFile.set(r.file, fs.readFileSync(path.join(HOST, r.file), 'utf8'));
  const text = byFile.get(r.file);
  if (r.must) { try { r.must(text); } catch (e) { console.error(`ABORT ${r.label}: ${e.message}`); process.exitCode = 2; continue; } }
  const re = new RegExp(r.from.source, r.from.flags.includes('g') ? r.from.flags : r.from.flags + 'g');
  const hits = text.match(re) ?? [];
  if (hits.length !== r.expect) {
    console.error(`ABORT ${r.file} ${r.label}: matched ${hits.length}, expected ${r.expect}`);
    process.exitCode = 2;
    continue;
  }
  byFile.set(r.file, text.replace(re, r.to));
}
if (process.exitCode === 2) { console.error('nothing written'); process.exit(2); }

const touched = [...byFile.keys()];
console.log(`${APPLY ? 'applying' : 'dry run'}: ${rules.length} rule(s) across ${touched.length} file(s)`);
for (const f of touched) {
  const before = fs.readFileSync(path.join(HOST, f), 'utf8');
  const after = byFile.get(f);
  const evPath = path.join(HOST, path.dirname(f), 'evidence.yaml');
  const evFresh = fs.existsSync(evPath) ? (() => {
    try { return parseYaml(fs.readFileSync(evPath, 'utf8'))?.recordDigest === sha(path.join(HOST, f)); } catch { return null; }
  })() : null;
  const changed = before.split(/\r?\n/).map((l, i) => [l, (after.split(/\r?\n/)[i] ?? '')]).filter(([a, b]) => a !== b);
  console.log(`\n# ${f}${evFresh === null ? ' (no sibling evidence)' : evFresh ? ' (evidence recordDigest FRESH — this edit will stale it)' : ' (evidence already stale)'}`);
  for (const [a, b] of changed) console.log(`  - ${a}\n  + ${b}`);
  if (APPLY) fs.writeFileSync(path.join(HOST, f), after);
}
console.log(APPLY ? `\nwrote ${touched.length} file(s)` : '\ndry run: nothing written');
