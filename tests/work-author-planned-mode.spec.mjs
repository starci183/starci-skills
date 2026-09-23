import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseYaml } from '../engine/yaml.mjs';
import { validateWork } from '../scripts/checks/work-validate.mjs';

const root = path.resolve(import.meta.dirname, '..');
const readYaml = rel => parseYaml(fs.readFileSync(path.join(root, rel), 'utf8'));
const flat = text => String(text ?? '').replace(/\s+/g, ' ');
const op = id => readYaml(`modules/ops/ops/${id}.yaml`);
const stepsText = doc => doc.steps.map(s => flat(s.action.en));

test('work.author declares planned mode for greenfield records in exactly one step, and the proof holds both modes', () => {
  const doc = op('work.author');
  const owners = stepsText(doc).filter(t => t.includes('Planned mode applies'));
  assert.equal(owners.length, 1, 'the planned-mode condition lives in one step');
  assert.match(owners[0], /owning source path does not exist yet and the approved chain still runs its implementing op \(backend\.implement, interface\.implement, e2e\.verify or uat\.verify\) after this one/);
  assert.match(owners[0], /paths the accepted design prescribes - its sds-component owners and the architecture module layout - each traced to that design record by id, and the record stays todo/);
  assert.match(owners[0], /Existing mode applies when the owning source path exists/);

  const checks = stepsText(doc).filter(t => t.includes('runner this repository already exposes'));
  assert.equal(checks.length, 1);
  assert.match(checks[0], /In planned mode the check is that runner's command plus the test path the implementing op must create, and the implementing op creates exactly that test/);
  assert.match(checks[0], /A runner the repository does not have at all is a reported blocker in both modes/);

  const identity = doc.steps.find(s => (s.writes ?? []).includes('identity'));
  assert.match(flat(identity.action.en), /declared as a planned slot under \.starciwork\/_resources\/\{identities,environments,fixtures\}\/<slug>\/, which the implementing op seeds/);
  assert.match(flat(identity.action.en), /A credential for a real outside system is never a planned slot and stays an owner provision/);
  assert.equal(doc.writes.find(w => w.id === 'identity').path, '.starciwork/_resources/identities/<identity>/resource.yaml');
  assert.equal(doc.writes.find(w => w.id === 'accounts').path, '.starciwork/features/<feature>/uat/<name>/accounts.yaml');

  const scope = flat(doc.proofs.find(p => p.id === 'inspected-scope').requirement.en);
  assert.match(scope, /In existing mode every path in the write scope was inspected in the actual source/);
  assert.match(scope, /In planned mode the record is todo, the implementing op still follows in the approved chain, every write-scope path and planned test path traces to an accepted design record by id, and every check names a runner and config that exist in the repository/);

  const runnerMissing = doc.blockers.find(b => b.code === 'CHECK_RUNNER_MISSING');
  assert.match(flat(runnerMissing.condition.en), /no runner in this repository .* no existing script and no test framework or config/);
  assert.ok(!stepsText(doc).some(t => /Never write a path that was not inspected/.test(t)), 'the existing-only rule is replaced, not kept beside planned mode');
});

test('every implementing op after work.author creates the planned paths a todo record names', () => {
  assert.match(stepsText(op('backend.implement')).join(' '), /for a todo target work\.author wrote in planned mode, create exactly the owner paths and test paths its owners and checks name/);
  assert.match(stepsText(op('interface.implement')).join(' '), /first creating exactly the owner paths and test paths a todo target work\.author wrote in planned mode names/);
  assert.match(stepsText(op('e2e.verify')).join(' '), /for a todo target work\.author wrote in planned mode, exactly the spec paths its checks name/);
  const uat = stepsText(op('uat.verify')).join(' ');
  assert.match(uat, /for a todo flow work\.author wrote in planned mode, exactly the automation spec its checks name/);
  assert.match(uat, /Planned identity slots are the identity resources the flow's accounts\.yaml already names, never new ones; seed exactly their roles/);
});

function write(base, rel, content) {
  const file = path.join(base, ...rel.split('/'));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

function plannedTree(implState) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-planned-'));
  const work = path.join(repo, '.starciwork');
  const files = {
    'index.yaml': 'schema: work/catalog@1\nid: fixture\nfeatures: []\n',
    'features/collab/sds/chat/index.yaml': 'schema: work/sds-component@1\nid: sds.collab.chat\ntitle: Collab chat\nstate: todo\nowners: [{role: module, path: src/features/collab}]\n',
    'features/collab/impl/nivo-be/chat/index.yaml': [
      'schema: work/implementation@1', 'id: impl.collab.nivo-be.chat', 'title: Collab chat', `state: ${implState}`,
      'repository: nivo-be', 'owners: [{role: module, path: src/features/collab}]', 'proves: [sds.collab.chat]',
      ...(implState === 'done' ? ['verificationSource: authored-claim', 'because: c'] : []),
      'requiresProof:',
      '  unit: {required: true, command: "npx jest --config jest.config.ts test/collab/chat.spec.ts", note: "planned test path backend.implement creates"}', '',
    ].join('\n'),
    '_resources/environments/dev/resource.yaml': 'schema: work/resource@1\nid: environment.nivo.dev\nkind: environment\nowner: nivo-be\nrevision: dev@2026-09-23\ntarget:\n  origins: {web: "http://localhost:3000"}\nprobes:\n  - {id: web-reachable, method: http-get, target: "http://localhost:3000", expect: 200}\n',
    '_resources/identities/collab/resource.yaml': 'schema: work/resource@1\nid: identity.nivo.collab\nkind: identity\nowner: nivo-be\nrevision: planned@2026-09-23\ndisposable: true\ncustody: {provider: keycloak, sealed: .starcistacks/dev/secrets/collab-uat.enc}\nroles: [host, member]\nblockers:\n  - "Planned identity slot: uat.verify seeds the host and member roles before the flow runs."\n',
    'features/collab/uat/chat-flow/index.yaml': 'schema: work/uat-flow@1\nid: uat.collab.chat-flow\ntitle: Host and member chat\nstate: todo\nentry: /collab\nactor: host\naccounts: accounts.yaml\nenvironment: environment.nivo.dev\nsteps:\n  - {order: 1, actor: host, action: "Open the room.", expected: "the room loads", checks: [{id: loading, expected: yes}]}\neffects: ["one disposable room"]\ncleanup: ["delete the run-owned room"]\nproves: [sds.collab.chat]\n',
    'features/collab/uat/chat-flow/accounts.yaml': 'schema: work/disposable-accounts@1\ndisposable: true\naccounts:\n  - {role: host, identity: identity.nivo.collab}\n  - {role: member, identity: identity.nivo.collab}\n',
  };
  for (const [rel, content] of Object.entries(files)) write(work, rel, content);
  return { repo, work };
}

test('starci validate warns, never refuses, a todo planned record whose owner path, test path and sealed identity do not exist yet', (t) => {
  const { repo, work } = plannedTree('todo');
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  const report = validateWork(work);
  assert.equal(report.ok, true, report.refused.join('\n'));
  assert.ok(report.suspect.some(s => s.includes('impl/nivo-be/chat') && s.includes('OWNER_PATH_MISSING')), report.suspect.join('\n'));
  assert.ok(report.suspect.some(s => s.includes('collab-uat.enc') && s.includes('EVIDENCE_ARTIFACT_GHOST')), report.suspect.join('\n'));
  assert.ok(!report.refused.some(r => r.includes('identity.nivo.collab')), 'the planned identity slot resolves as an identity resource');
});

test('the same planned owner path is refused once the record claims done', (t) => {
  const { repo, work } = plannedTree('done');
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  const report = validateWork(work);
  assert.equal(report.ok, false);
  assert.ok(report.refused.some(r => r.includes('impl/nivo-be/chat') && r.includes('OWNER_PATH_MISSING')), report.refused.join('\n'));
});
