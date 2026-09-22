#!/usr/bin/env node
// build-ops-registry.mjs — regenerate modules/ops/registry.yaml from the per-op
// yamls. The registry is GENERATED (see its header); never hand-edit it.
//
// CLI:
//   node scripts/route/build-ops-registry.mjs            # rewrite registry.yaml
//   node scripts/route/build-ops-registry.mjs --check    # diff only, no write (CI)
//   node scripts/route/build-ops-registry.mjs --opsDir <dir> [--out <file>]
//
// Entry shape: {id, family, goal one-liner, params {default, setBy},
// nodeKinds, completionProfile, sideEffects summary, reads/writes scope, route keys,
// lifecycle position}. Fields absent from a per-op yaml are omitted, never invented;
// the shape a per-op yaml may carry is modules/schemas/op.schema.yaml, enforced by
// scripts/checks/check-op-manifest.mjs.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml, stringifyYaml } from '../../engine/yaml.mjs';

const skillRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

// Lifecycle stages (inferred from goal/reads/writes — reading order,
// not a runtime DAG; no op self-dispatches). route.phase[0] maps onto these ids.
const STAGES = {
  intake: 'classify the request into typed intake/scope facts; zero effects',
  scope: 'bound the work — scope record, workspace bootstrap, launchable nodes',
  decide: 'settle authority — SRS, SDS, brand, owner decisions, provisions',
  direct: 'image-first UI direction + artwork slots before frontend code',
  implement: 'write product/test/content/knowledge source inside ceilings',
  verify: 'independent evidence-bound proof; never repairs',
  release: 'publish/deploy/migrate — terminal external effect',
  operate: 'runtime/service lifecycle, goal maintenance, end-of-life closeout',
};

// Coarse lifecycle terms allowed in route.phase alongside a stage id.
const COARSE = {
  intake: 'pre-implementation', scope: 'pre-implementation', decide: 'pre-implementation',
  direct: 'pre-implementation', implement: 'implementation',
  verify: 'post-implementation', release: 'post-implementation', operate: 'cross-cutting',
};

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--check') args.check = true;
    else if (a === '--opsDir') args.opsDir = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else { console.error(`unknown arg ${a}`); process.exit(2); }
  }
  return args;
}

const asList = v => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v])
  .map(s => String(s).trim()).filter(Boolean);
const firstLine = s => String(s ?? '').replace(/\s+/g, ' ').trim().split(/(?<=\.)\s/)[0].slice(0, 200);
const ids = list => (Array.isArray(list) ? list : [])
  .map(item => String(typeof item === 'object' && item ? item.id ?? item.path ?? '' : item).trim())
  .filter(Boolean);

function entryFor(file, doc) {
  const id = String(doc?.id ?? file.replace(/\.yaml$/, ''));
  const entry = { id, family: id.split('.')[0] };
  const goal = typeof doc?.goal === 'string' ? doc.goal : doc?.goal?.en;
  if (goal) entry.goal = firstLine(goal);
  // Tunables are the registry's one numeric column: a reader sees what an owner
  // or the kernel may set without opening the manifest. The doc prose stays in
  // the manifest — the registry is an index.
  if (doc?.params && typeof doc.params === 'object') {
    const params = {};
    for (const [name, def] of Object.entries(doc.params)) {
      params[name] = def?.required === true
        ? { required: true, setBy: String(def?.setBy ?? '') }
        : { default: def?.default ?? null, setBy: String(def?.setBy ?? '') };
    }
    if (Object.keys(params).length) entry.params = params;
  }
  if (doc?.nodeKinds) entry.nodeKinds = asList(doc.nodeKinds);
  if (doc?.completionProfile) entry.completionProfile = String(doc.completionProfile);
  const side = asList(doc?.sideEffects);
  if (side.length) entry.sideEffects = { count: side.length, summary: firstLine(side[0]) };
  const reads = ids(doc?.reads), writes = ids(doc?.writes);
  if (reads.length) entry.reads = reads;
  if (writes.length) entry.writes = writes;
  const route = doc?.route && typeof doc.route === 'object' ? doc.route : null;
  if (route) {
    entry.route = {};
    for (const k of ['nodeKinds', 'phase', 'intent', 'prerequisites', 'riskHints']) {
      const v = asList(route[k]);
      if (v.length) entry.route[k] = v;
    }
    // Lifecycle position is the route phase an agent would file this op under;
    // richer analysis stays in the per-op yaml — the registry stays an index.
    if (entry.route.phase?.length) entry.lifecyclePosition = entry.route.phase.join(' | ');
  }
  entry.kindInferred = id.split('.').at(-1) ?? entry.family; // the verb: draw|implement|decide|verify|ask|...
  return entry;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const opsDir = path.resolve(args.opsDir ?? path.join(skillRoot, 'modules', 'ops'));
  const out = path.resolve(args.out ?? path.join(opsDir, 'registry.yaml'));
  if (!fs.existsSync(opsDir)) { console.error(`ops catalog missing: ${opsDir}`); process.exit(1); }

  // Per-op files live at <opsDir>/<id>.yaml or <opsDir>/ops/<id>.yaml.
  const files = [opsDir, path.join(opsDir, 'ops')]
    .filter(d => fs.existsSync(d))
    .flatMap(d => fs.readdirSync(d)
      .filter(f => f.endsWith('.yaml') && f !== 'registry.yaml' && !f.startsWith('_'))
      .map(f => path.join(d, f)))
    .sort();
  const entries = [], problems = [];
  for (const file of files) {
    try {
      const entry = entryFor(path.basename(file), parseYaml(fs.readFileSync(file, 'utf8')));
      if (!entry.route) problems.push(`${path.basename(file)}: no route: block`);
      else if (entry.route.phase?.length && !STAGES[entry.route.phase[0]] && !Object.values(COARSE).includes(entry.route.phase[0]))
        problems.push(`${path.basename(file)}: route.phase[0] '${entry.route.phase[0]}' is not a known stage`);
      entries.push(entry);
    } catch (e) {
      problems.push(`${path.basename(file)}: ${e.message}`);
    }
  }
  entries.sort((a, b) => a.id.localeCompare(b.id));

  const doc = {
    schema: 'starci/module-ops-registry@1',
    generatedBy: 'scripts/route/build-ops-registry.mjs',
    origin: {
      canonicalRegistry: '.claude/modules/ops/registry.yaml (this generated file)',
      commonDocument: '.claude/modules/ops/_common.yaml',
      perOpSources: 'modules/ops/ops/<id>.yaml (authored operator contract, starci/op@1 — modules/schemas/op.schema.yaml)',
      note: 'modules/ops is the authored operator source; _common.yaml keeps the shared pre-module policy prose. An op summary is this index, generated — no manifest carries one.',
    },
    stages: STAGES,
    coarsePhases: COARSE,
    count: entries.length,
    ops: entries,
  };
  const body = stringifyYaml(doc);
  const header = [
    '# GENERATED FILE — do not hand-edit.',
    '# regenerate: node scripts/route/build-ops-registry.mjs',
    '# check only: node scripts/route/build-ops-registry.mjs --check',
    '',
  ].join('\n');
  const next = header + body;

  if (args.check) {
    const cur = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : null;
    if (cur === next) { console.log(`registry.yaml is current (${entries.length} ops)`); }
    else {
      console.error(`registry.yaml is STALE — rerun build-ops-registry.mjs (${entries.length} ops in sources)`);
      if (cur) {
        const a = cur.split('\n'), b = next.split('\n');
        for (let i = 0; i < Math.max(a.length, b.length); i++) {
          if (a[i] !== b[i]) { console.error(`first diff at line ${i + 1}:\n  old: ${a[i]}\n  new: ${b[i]}`); break; }
        }
      }
      process.exitCode = 1;
    }
  } else {
    fs.writeFileSync(out, next);
    console.log(`wrote ${path.relative(skillRoot, out)} (${entries.length} ops)`);
  }
  for (const p of problems) console.error(`note: ${p}`);
  if (problems.length && args.check) process.exitCode = 1;
}

main();
