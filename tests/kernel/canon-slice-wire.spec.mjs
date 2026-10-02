// A canon-conformance slice is granted the relocation destinations its findings need, contested relocations
// and config files go to ONE canon-wire leg per wave (HFS has no shared registration file: owners are derived
// from knowledge/hfs/slots.yaml, so policy sharedRoots is empty), and a blocked slice is redone from its commit
// (scripts/kernel/seam-policy.mjs canonCutPlanOf / canonRedispatchOf; modules/kernel/driver-loop.yaml
// enqueue.cutExecution). A canon slice (7/34) committed
// 9 -> 7 findings, then blocked shared-change - the rest needed its product-shells owners MOVED into
// features/layouts, none of which it owned; 22 of 56 slices failed so.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ledgerFileFor, openLedger } from '../../engine/db/ledger.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { resolveOpParams } from '../../scripts/kernel/dispatch-op.mjs';
import { canonCutPlanOf, canonRedispatchOf, canonSettleFollowUpOf, relocationOf, canonConformancePolicy } from '../../scripts/kernel/seam-policy.mjs';
import { seedWorkflow } from '../helpers/ledger-fixture.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const SEAM_POLICY = path.join(ROOT, 'scripts', 'kernel', 'seam-policy.mjs');
const SRC = 'apps/app/src';
const shells = `${SRC}/components/product-shells`;
const route = `${SRC}/app/[locale]/(console)/layout.tsx`;

/** The fe-canon shape: slice 2 holds the console route + three product-shell owners, slice 3 a block. */
const scan = ({ seamOwnsFeatures = false } = {}) => ({
  schema: 'starci/canon-findings@1',
  slices: [
    { ordinal: 1, wave: 'foundation', paths: [`${SRC}/modules/slot`, ...(seamOwnsFeatures ? [`${SRC}/features`] : [])] },
    { ordinal: 2, wave: 'shared', paths: [route, `${shells}/ConsoleLayout`, `${shells}/ConsoleTopBar`, `${shells}/Sidebar`] },
    { ordinal: 3, wave: 'surfaces', paths: [`${SRC}/components/blocks/sales`] },
  ],
  findings: [
    { machine: 'eslint', ruleId: 'starci-fe/drawing', family: 'drawing', file: `${SRC}/modules/slot/index.ts`, line: 1 },
    { machine: 'architecture', ruleId: 'FE_SOURCE_LAYOUT_INVALID', family: 'architecture', file: `${shells}/Sidebar/component.tsx`, line: 1 },
    { machine: 'architecture', ruleId: 'FE_SOURCE_LAYOUT_INVALID', family: 'architecture', file: `${shells}/ConsoleTopBar/component.tsx`, line: 1 },
    { machine: 'architecture', ruleId: 'FE_SOURCE_LAYOUT_INVALID', family: 'architecture', file: `${shells}/ConsoleLayout/index.tsx`, line: 3 },
    { machine: 'eslint', ruleId: 'starci-fe/naming', family: 'naming', file: `${SRC}/components/blocks/sales/Handoff/index.tsx`, line: 1 },
  ],
});

test('a relocation finding names the file that moves and the canon homes it may land in', () => {
  const { relocations } = canonConformancePolicy();
  const layout = relocationOf({ ruleId: 'FE_SOURCE_LAYOUT_INVALID', file: `${shells}/Sidebar/component.tsx` }, relocations);
  assert.equal(layout.home, `${shells}/Sidebar`);
  assert.ok(layout.destinations.includes(`${SRC}/features/layouts/Sidebar`));
  assert.equal(relocationOf({ ruleId: 'FE_APP_INTERNAL_IMPORT_OUTSIDE_FEATURES', file: route, related: `${shells}/ConsoleLayout/index.tsx` }, relocations), null, 'a retired rule has no relocation entry: a tier violation is not a relocation');
  assert.deepEqual(canonConformancePolicy().sharedRoots, [], 'HFS has no shared registration file: owners are derived from slots');
  assert.equal(relocationOf({ ruleId: 'starci-fe/naming', file: `${SRC}/components/blocks/sales/Handoff/index.tsx` }, relocations), null, 'a finding fixed in place needs no destination');
});

test('a canon slice needing a relocation nobody else holds is planned as slice-with-destinations and no wire leg', () => {
  const plan = canonCutPlanOf(scan(), { cutId: 'fe-canon' });
  const slice = plan.slices.find((item) => item.ordinal === 2);
  for (const owner of ['Sidebar', 'ConsoleTopBar', 'ConsoleLayout']) {
    assert.ok(slice.owned.includes(`${SRC}/features/layouts/${owner}`), `slice 2 is granted features/layouts/${owner}`);
  }
  assert.ok(!slice.owned.some((p) => /(?:architecture|hfs)\.json$/.test(p)), 'no slice owns a shared root file');
  // Grants never collide: every owned path of one slice is disjoint from every other slice's.
  const within = (a, b) => a === b || a.startsWith(`${b}/`);
  for (const a of plan.slices) for (const b of plan.slices) {
    if (a === b) continue;
    for (const p of a.owned) assert.ok(!b.owned.some((q) => within(p, q) || within(q, p)), `${p} (ordinal ${a.ordinal}) overlaps ordinal ${b.ordinal}`);
  }
  assert.deepEqual(plan.wires, [], 'no shared registration and no contested destination: nothing for a wire leg to own');
  assert.ok(!plan.commands.some((command) => command.includes('"canonWire":true')));
  assert.ok(plan.commands.some((command) => command.startsWith(`api enqueue --op code.refactor --paths ${slice.owned.join(',')} --cut-id fe-canon --cut-ordinal 2 --cut-total 3`)));
});

test('a destination a sibling already owns is never granted: the move goes to the wave\'s wire leg', () => {
  const plan = canonCutPlanOf(scan({ seamOwnsFeatures: true }), { cutId: 'fe-canon' });
  const slice = plan.slices.find((item) => item.ordinal === 2);
  assert.ok(!slice.grants.some((p) => p.startsWith(`${SRC}/features/`)), 'ordinal 1 owns apps/app/src/features, so nothing under it is granted to ordinal 2');
  const wire = plan.wires.find((item) => item.wave === 'shared');
  assert.ok(wire.paths.includes(`${SRC}/features/layouts/Sidebar`) && wire.paths.includes(`${shells}/Sidebar`), 'the wire moves the contested owner once the slices land');
  assert.ok(!wire.paths.some((p) => p.endsWith('architecture.json')), 'the wire carries the contested move, no retired registration file');
  assert.deepEqual(wire.after, [2]);
  assert.match(plan.commands.find((command) => command.includes('"canonWire":true')), /^api enqueue --op code\.refactor --paths .*--params '\{"canonWire":true\}' --after /);
});

test('a blocked slice routes config files to the wire and no registration file is assumed', () => {
  const payload = { cut: { id: 'fe-canon', ordinal: 2, total: 3 }, params: { canonFamilies: 'all' }, owned_paths: [route, `${shells}/ConsoleLayout`] };
  const report = { outcome: 'blocked', summary: 'needs apps/app/package.json and hfs.json', blocker: { kind: 'shared-change' } };
  const plan = canonSettleFollowUpOf({ payload, report, destinations: ['apps/app/package.json', 'apps/app/tsconfig.json', 'hfs.json', `${SRC}/features/layouts/ConsoleLayout`] });
  assert.deepEqual(plan.wire.sort(), ['apps/app/package.json', 'apps/app/tsconfig.json', 'hfs.json']);
  assert.deepEqual(plan.grants, [`${SRC}/features/layouts/ConsoleLayout`]);
  assert.ok(!plan.wire.some((p) => p.endsWith('architecture.json')), 'the default shared roots are empty');
  assert.equal(plan.resumeFrom, null, 'no preserved work: a follow-up, not a continuation');
  const named = canonSettleFollowUpOf({ payload, report: { ...report, head: 'a'.repeat(40), summary: 'committed 1729' + '7b7 the in-ceiling part' }, destinations: [] });
  assert.equal(named.resumeFrom, null, 'a head or commit the report names is never a continuation point: ops never commit');
  const preserved = 'refs/heads/preserved/wf-canon-wire/op-code.refactor-2';
  assert.equal(canonSettleFollowUpOf({ payload, report, destinations: [], preserved }).resumeFrom, preserved, 'the continuation starts from the preserved ref');
});

test('the canon-wire and resume params are kernel-set code.refactor params; the owner families stay the owner\'s', () => {
  const brief = parseYaml(fs.readFileSync(path.join(ROOT, 'modules', 'ops', 'ops', 'code.refactor.yaml'), 'utf8'));
  const resolved = resolveOpParams(brief, { leg: { canonFamilies: 'all' }, flag: { canonWire: true, resumeFrom: 'refs/heads/preserved/wf-canon-wire/op-code.refactor-7e9f7e20c1' }, enforceRequired: true });
  assert.equal(resolved.ok, true, resolved.detail);
  assert.deepEqual(resolved.params, { gateRounds: 5, canonFamilies: 'all', canonWire: true, resumeFrom: 'refs/heads/preserved/wf-canon-wire/op-code.refactor-7e9f7e20c1' }, 'the owner-set gateRounds resolves to its declared default');
  assert.equal(resolveOpParams(brief, { leg: { resumeFrom: 'x' } }).ok, false, 'a goal leg cannot carry a kernel param');
  const shared = String(brief.blockers.find((blocker) => blocker.code === 'SCOPE_WIDENING').condition.en).replace(/\s+/g, ' ');
  assert.match(shared, /reports done listing each such finding as owedToWire/);
  const cut = parseYaml(fs.readFileSync(path.join(ROOT, 'modules', 'kernel', 'driver-loop.yaml'), 'utf8')).tick.enqueue.cutExecution.replace(/\s+/g, ' ');
  assert.match(cut, /scripts\/kernel\/seam-policy\.mjs canon-plan --scan <that canon-scan json> --cut-id <id>/);
  assert.match(cut, /scripts\/kernel\/seam-policy\.mjs canon-redispatch --repo ROOT --job <job>/);
});

test('a blocked slice is redone from its preserved work: --retry-of with its preserved ref as resumeFrom (ops never commit)', (t) => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-canon-wire-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const workflowId = 'wf-canon-wire', jobId = 'op-code.refactor-7e9f7e20c1';
  const owned = [route, `${shells}/ConsoleLayout`, `${shells}/ConsoleTopBar`, `${shells}/Sidebar`];
  const ledger = openLedger({ file: ledgerFileFor(repo) });
  try {
    seedWorkflow(ledger,{id:workflowId,state:{phase:'running',job:'canon'},jobs:[{jobId,opId:'code.refactor',
      status:'failed',tryNo:1,result:{verdict:'blocked'},payload:{opId:'code.refactor',owned_paths:owned,
        params:{canonFamilies:'all'},cut:{id:'fe-canon',ordinal:7,total:34}}}]});
    assert.equal(canonRedispatchOf(ledger.db, jobId), null, 'no preserved work: a plain --retry-of');
    ledger.appendEvent({ workflowId, entityType: 'job', entityId: jobId, kind: 'workflow-op-preserved',
      payload: { kind: 'workflow-op-preserved', preservedRef: `refs/heads/preserved/${workflowId}/${jobId}`, resetTo: 'e406d812396f841ffa883627c3789039618cfb26', sha: '17297b729069697b405f475754a4cbc829b8dbf1' } });
    const redo = canonRedispatchOf(ledger.db, jobId, { extraPaths: [`${SRC}/features/layouts/Sidebar`] });
    assert.equal(redo.resumeFrom, `refs/heads/preserved/${workflowId}/${jobId}`);
    assert.equal('admissionBase' in redo, false);
    assert.equal(redo.command, `api enqueue --workflow ${workflowId} --op code.refactor --paths ${[...owned, `${SRC}/features/layouts/Sidebar`].join(',')} --cut-id fe-canon --cut-ordinal 7 --cut-total 34 --retry-of ${jobId} --params '{"resumeFrom":"refs/heads/preserved/${workflowId}/${jobId}"}'`);
  } finally { ledger.close(); }
  const cli = spawnSync(process.execPath, [SEAM_POLICY, 'canon-redispatch', '--repo', repo, '--job', jobId], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 60000 });
  assert.equal(cli.status, 0, cli.stderr);
  assert.match(JSON.parse(cli.stdout).command, /--retry-of op-code\.refactor-7e9f7e20c1 --params '\{"resumeFrom":"refs\/heads\/preserved\/wf-canon-wire\/op-code\.refactor-7e9f7e20c1"/);
});

test('the canon-plan CLI prints the enqueue commands from a canon-scan record', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-canon-plan-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'scan.json');
  fs.writeFileSync(file, JSON.stringify(scan({ seamOwnsFeatures: true })));
  const cli = spawnSync(process.execPath, [SEAM_POLICY, 'canon-plan', '--scan', file, '--cut-id', 'fe-canon'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 60000 });
  assert.equal(cli.status, 0, cli.stderr);
  const plan = JSON.parse(cli.stdout);
  assert.equal(plan.total, 3);
  assert.ok(plan.commands.some((command) => command.includes('"canonWire":true')));
});
