#!/usr/bin/env node
// build-ops-registry.mjs — regenerate modules/ops/registry.yaml from the per-op
// yamls. The registry is GENERATED (see its header); never hand-edit it.
//
// CLI:
//   node scripts/route/build-ops-registry.mjs            # rewrite registry.yaml
//   node scripts/route/build-ops-registry.mjs --check    # diff only, no write (CI)
//   node scripts/route/build-ops-registry.mjs --opsDir <dir> [--out <file>]
//
// Entry shape is fixed by tinkle/_common.md + tinkle-1: {id, family, goal one-liner,
// nodeKinds, completionProfile, sideEffects summary, reads/writes scope, route keys,
// lifecycle position}. Fields absent from a per-op yaml are omitted, never invented.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml, stringifyYaml } from '../../engine/yaml.mjs';

const skillRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

// The registry only names machinery roles so an agent knows the catalog is
// declarative; the engines map covers the retired pre-module sources for history.
const ENGINES = {
  'basic-ops.mjs': 'shared operator plumbing helpers used by the contracts below',
  'contracts.mjs': 'builds the typed request/response contract each op executes under',
  'generate.mjs': 'emits per-op generated artifacts (not routing)',
  'select.mjs': 'picks an executionModes sub-contract for ops that declare modes',
  'validate.mjs': 'validates operator.yaml shape against the op contract schema',
  'role-authority.mjs': 'maps an op to the roles/models allowed to run it',
};

// Lifecycle stages (tinkle-1's inference from goal/reads/writes — reading order,
// not a runtime DAG; no op self-dispatches). route.phase[0] maps onto these ids.
const STAGES = {
  intake: 'classify the request into typed intake/scope facts; zero effects',
  scope: 'bound the work — scope record, workspace bootstrap, launchable nodes',
  decide: 'settle authority — SRS, SDS, brand, owner decisions, provisions',
  direct: 'image-first UI direction + artwork slots before frontend code',
  implement: 'write product/test/content/knowledge source inside ceilings',
  verify: 'independent evidence-bound proof; never repairs',
  release: 'publish/deploy/migrate — terminal external effect',
  operate: 'runtime/service lifecycle, goal maintenance, end-of-life retirement',
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
  entry.kindInferred = id.split('.')[1] ?? entry.family; // the verb: draw|implement|decide|verify|ask|...
  if (doc?.business?.question) entry.businessQuestion = firstLine(doc.business.question);
  const whenNeeded = asList(doc?.business?.whenNeeded);
  if (whenNeeded.length) entry.whenNeeded = firstLine(whenNeeded[0]);
  return entry;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const opsDir = path.resolve(args.opsDir ?? path.join(skillRoot, 'modules', 'ops'));
  const out = path.resolve(args.out ?? path.join(opsDir, 'registry.yaml'));
  if (!fs.existsSync(opsDir)) { console.error(`ops catalog missing: ${opsDir}`); process.exit(1); }

  // Per-op files live at <opsDir>/<id>.yaml or <opsDir>/ops/<id>.yaml (tinkle-1 layout).
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
      if (!entry.route) problems.push(`${path.basename(file)}: no route: block (required by tinkle/_common.md amendment)`);
      else if (entry.route.phase?.length && !STAGES[entry.route.phase[0]] && !Object.values(COARSE).includes(entry.route.phase[0]))
        problems.push(`${path.basename(file)}: route.phase[0] '${entry.route.phase[0]}' is not a known stage`);
      entries.push(entry);
    } catch (e) {
      problems.push(`${path.basename(file)}: ${e.message}`);
    }
  }
  entries.sort((a, b) => a.id.localeCompare(b.id));

  // Engines section: warn when an ops/*.mjs exists that is not described.
  const opsSourceDir = path.join(skillRoot, 'legacy', 'ops');
  const engines = {};
  if (fs.existsSync(opsSourceDir)) {
    for (const f of fs.readdirSync(opsSourceDir).filter(f => f.endsWith('.mjs')).sort()) {
      engines[f] = ENGINES[f] ?? 'UNDESCRIBED — add a role line in build-ops-registry.mjs ENGINES';
      if (!ENGINES[f]) problems.push(`engine ${f} has no declared role`);
    }
  }

  const doc = {
    schema: 'starci/module-ops-registry@1',
    generatedBy: 'scripts/route/build-ops-registry.mjs',
    origin: {
      canonicalRegistry: '.claude/modules/ops/registry.yaml (this generated file)',
      commonDocument: '.claude/modules/ops/_common.yaml',
      perOpSources: 'modules/ops/ops/<id>.yaml (authored operator contract + business: block + route: block)',
      note: 'modules/ops is the authored operator source; _common.yaml keeps the shared pre-module policy prose.',
    },
    stages: STAGES,
    coarsePhases: COARSE,
    count: entries.length,
    ops: entries,
    engines,
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
    console.log(`wrote ${path.relative(skillRoot, out)} (${entries.length} ops, ${Object.keys(engines).length} engines)`);
  }
  for (const p of problems) console.error(`note: ${p}`);
  if (problems.length && args.check) process.exitCode = 1;
}

main();
