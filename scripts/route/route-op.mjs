#!/usr/bin/env node
// route-op.mjs — resolve which modules/ops/<id>.yaml operation serves a structured
// routing request. Selection is deterministic and reads ONLY the `route:` blocks;
// an agent must not need to read a whole op file to route (tinkle/_common.md).
//
// CLI:
//   node scripts/route/route-op.mjs --kind <opKind>
//       [--nodeKind <ui|business|architecture|...>]
//       [--phase <pre-implementation|implementation|...>]
//       [--intent <token>[,<token>...]]   (repeatable)
//       [--opsDir <dir>]                 (default: <skill>/modules/ops)
//       [--json]
//
// Scoring (higher wins, ties broken by op id for determinism):
//   exact kind match          +1000
//   kind family match         +100   (a.b vs query a.* — family token equality)
//   nodeKind match            +10
//   phase match               +5
//   each overlapping intent   +2
// An op with no `route:` block cannot be routed and is skipped with a note.
// Exit 1 when zero candidates match; the printed reasons say which key failed.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';

const skillRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

function usage(code) {
  console.error('use: node scripts/route/route-op.mjs --kind <opKind> [--nodeKind <k>] [--phase <p>] [--intent <t>[,<t>...]] [--opsDir <dir>] [--json]');
  process.exit(code);
}

function parseArgs(argv) {
  const args = { intents: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const take = () => {
      const v = argv[++i];
      if (v === undefined) usage(2);
      return v;
    };
    if (a === '--kind') args.kind = take();
    else if (a === '--nodeKind') args.nodeKind = take();
    else if (a === '--phase') args.phase = take();
    else if (a === '--intent') args.intents.push(...take().split(','));
    else if (a === '--opsDir') args.opsDir = take();
    else if (a === '--json') args.json = true;
    else if (a === '--help' || a === '-h') usage(0);
    else usage(2);
  }
  args.intents = [...new Set(args.intents.map(s => s.trim()).filter(Boolean))];
  return args;
}

const asList = v => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v])
  .map(s => String(s).trim()).filter(Boolean);

function yamlFiles(dir, sub) {
  const root = sub ? path.join(dir, sub) : dir;
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root)
    .filter(f => f.endsWith('.yaml') && f !== 'registry.yaml' && !f.startsWith('_'))
    .sort()
    .map(f => path.join(root, f));
}

function loadOps(opsDir) {
  // Per-op files live at <opsDir>/<id>.yaml or <opsDir>/ops/<id>.yaml (tinkle-1 layout).
  const files = [...yamlFiles(opsDir), ...yamlFiles(opsDir, 'ops')];
  const ops = [], skipped = [];
  for (const full of files) {
    const file = path.basename(full);
    let doc;
    try {
      doc = parseYaml(fs.readFileSync(full, 'utf8'));
    } catch (e) {
      skipped.push({ file, reason: `unparseable yaml: ${e.message}` });
      continue;
    }
    const id = String(doc?.id ?? file.replace(/\.yaml$/, ''));
    const route = doc?.route;
    if (!route || typeof route !== 'object') {
      skipped.push({ file, reason: 'no route: block — not routable' });
      continue;
    }
    ops.push({
      id,
      file: path.relative(skillRoot, full),
      route: {
        nodeKinds: asList(route.nodeKinds ?? route.nodeKind),
        phase: asList(route.phase),
        intent: asList(route.intent ?? route.intents),
        prerequisites: asList(route.prerequisites),
        riskHints: asList(route.riskHints),
      },
      goal: typeof doc?.goal === 'string' ? doc.goal : (doc?.goal?.en ?? null),
    });
  }
  return { ops, skipped };
}

const family = id => String(id).split('.')[0];

function score(op, q) {
  const parts = [];
  let total = 0;
  if (q.kind) {
    if (op.id === q.kind) { total += 1000; parts.push('exact-kind:+1000'); }
    else if (family(op.id) === family(q.kind) && family(q.kind) !== q.kind) { /* query has a family, no match */ }
    else if (family(op.id) === q.kind || op.id.startsWith(q.kind + '.')) { total += 100; parts.push('kind-family:+100'); }
  }
  if (q.nodeKind && op.route.nodeKinds.includes(q.nodeKind)) { total += 10; parts.push(`nodeKind(${q.nodeKind}):+10`); }
  if (q.phase && op.route.phase.includes(q.phase)) { total += 5; parts.push(`phase(${q.phase}):+5`); }
  const hits = q.intents.filter(t => op.route.intent.includes(t));
  if (hits.length) { total += hits.length * 2; parts.push(`intent(${hits.join('|')}):+${hits.length * 2}`); }
  return { total, parts, intentHits: hits };
}

function main() {
  const q = parseArgs(process.argv.slice(2));
  if (!q.kind && !q.nodeKind && !q.phase && !q.intents.length) usage(2);
  const opsDir = q.opsDir ? path.resolve(q.opsDir) : path.join(skillRoot, 'modules', 'ops');
  if (!fs.existsSync(opsDir)) {
    console.error(`ops catalog missing: ${opsDir}`);
    process.exit(1);
  }
  const { ops, skipped } = loadOps(opsDir);
  const scored = ops
    .map(op => ({ op, ...score(op, q) }))
    .filter(r => r.total > 0)
    .sort((a, b) => b.total - a.total || a.op.id.localeCompare(b.op.id));

  const result = {
    query: { kind: q.kind ?? null, nodeKind: q.nodeKind ?? null, phase: q.phase ?? null, intent: q.intents },
    catalog: { dir: path.relative(skillRoot, opsDir), ops: ops.length, skipped },
    pick: null,
    runnersUp: [],
  };

  if (!scored.length) {
    result.reasons = [
      `no op scored on the given keys`,
      q.kind ? `kind '${q.kind}' matched no op id or family` : 'no kind given',
      q.nodeKind ? `nodeKind '${q.nodeKind}' matched no route.nodeKinds` : 'no nodeKind given',
      q.phase ? `phase '${q.phase}' matched no route.phase` : 'no phase given',
      q.intents.length ? `intent [${q.intents}] matched no route.intent` : 'no intent given',
    ];
    if (q.json) console.log(JSON.stringify(result, null, 2));
    else {
      console.log('NO ROUTE — zero candidates matched.');
      for (const r of result.reasons) console.log(`  - ${r}`);
      for (const s of skipped) console.log(`  skipped ${s.file}: ${s.reason}`);
    }
    process.exit(1);
  }

  const [top, ...rest] = scored;
  result.pick = {
    op: top.op.id, score: top.total, breakdown: top.parts, yaml: top.op.file,
    prerequisites: top.op.route.prerequisites,
    riskHints: top.op.route.riskHints,
    goal: top.op.goal,
  };
  result.runnersUp = rest.slice(0, 4).map(r => ({ op: r.op.id, score: r.total, breakdown: r.parts, yaml: r.op.file }));

  if (q.json) { console.log(JSON.stringify(result, null, 2)); return; }
  console.log(`PICK ${result.pick.op}  (score ${result.pick.score})`);
  console.log(`  yaml: ${result.pick.yaml}`);
  console.log(`  breakdown: ${result.pick.breakdown.join('  ')}`);
  if (result.pick.prerequisites.length) console.log(`  prerequisites: ${result.pick.prerequisites.join(', ')}`);
  if (result.pick.riskHints.length) console.log(`  riskHints: ${result.pick.riskHints.join(', ')}`);
  if (result.pick.goal) console.log(`  goal: ${result.pick.goal.split('\n').join(' ').slice(0, 140)}`);
  if (result.runnersUp.length) {
    console.log('runners-up:');
    for (const r of result.runnersUp) console.log(`  ${r.op}  (score ${r.score})  ${r.breakdown.join('  ')}`);
  }
  for (const s of skipped) console.log(`skipped ${s.file}: ${s.reason}`);
}

main();
