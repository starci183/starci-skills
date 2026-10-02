// rights-policy.spec.mjs - R223 RIGHTS_ROLE_DENIED and R224 RIGHTS_PROTECTED_ZONE judge the DATA the guard enforces: the command
// policy table and the protected zone declaration. A violating table and a passing one, then the real files of this tree.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { policyFindings, rightsPolicyFindings, zoneFindings } from '../../scripts/hfs/runtime-rules/rights-policy.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const policy = () => parseYaml(read('modules/kernel/command-policy.yaml'));
const zone = () => parseYaml(read('modules/kernel/protected-zone.yaml'));
const codes = read('modules/kernel/failure-codes.yaml');
const catalogued = (code) => new RegExp(`^${code}:`, 'm').test(codes);

test('the real command policy and protected zone are sound', () => {
  assert.deepEqual(policyFindings({ policy: policy() }), []);
  assert.deepEqual(zoneFindings({ zone: zone(), tracked: (file) => fs.existsSync(path.join(ROOT, file)), catalogued }), []);
});

test('a refusal of the table names an R223 code and a starci verb to use', () => {
  const broken = policy();
  broken.git.deny.push = { code: 'RIGHTS_GIT_PUSHH', use: 'starci git backup' };
  broken.git.deny.commit = { code: 'RIGHTS_GIT_COMMIT' };
  broken['raw-tools'].docker = {};
  const messages = policyFindings({ policy: broken }).map((f) => f.message);
  assert.equal(messages.length, 3);
  assert.ok(messages.some((m) => /RIGHTS_GIT_PUSHH, which is not a code of rule R223/.test(m)));
  assert.ok(messages.some((m) => /commit names no `use`/.test(m)));
  assert.ok(messages.some((m) => /raw tool docker names no `use`/.test(m)));
  for (const f of policyFindings({ policy: broken })) assert.equal(f.code, 'RIGHTS_ROLE_DENIED');
});

test('the bound roles are roles the guard resolves, and the runtime verbs keep starci', () => {
  const broken = policy();
  broken.roles.bound = ['op', 'owner'];
  broken.runtime = ['api'];
  assert.equal(policyFindings({ policy: broken }).length, 2);
  assert.equal(policyFindings({ policy: null }).length, 1);
});

test('the zone declares unique zones with paths, tracked catalog files and catalogued codes', () => {
  const broken = zone();
  broken.zones.push({ id: broken.zones[0].id, paths: ['x/**'] }, { id: 'empty', paths: [] });
  broken.catalogEntries.push({ file: 'knowledge/no-such-file.yaml', ids: [], codes: ['RIGHTS_NOT_A_CODE'] });
  const messages = zoneFindings({ zone: broken, tracked: (file) => fs.existsSync(path.join(ROOT, file)), catalogued }).map((f) => f.message);
  assert.equal(messages.length, 4);
  assert.ok(messages.some((m) => /repeats one/.test(m)));
  assert.ok(messages.some((m) => /zone empty lists no paths/.test(m)));
  assert.ok(messages.some((m) => /no-such-file.yaml is not a tracked file/.test(m)));
  assert.ok(messages.some((m) => /RIGHTS_NOT_A_CODE is not in modules\/kernel\/failure-codes.yaml/.test(m)));
  for (const f of zoneFindings({ zone: broken, tracked: () => false, catalogued: () => false })) assert.equal(f.code, 'RIGHTS_PROTECTED_ZONE');
  assert.equal(zoneFindings({ zone: null, tracked: () => true, catalogued: () => true }).length, 1);
});

test('over a tree (ctx), the two data files are judged and a tree without them has nothing to judge', () => {
  const files = new Map([['modules/kernel/command-policy.yaml', read('modules/kernel/command-policy.yaml')], ['modules/kernel/protected-zone.yaml', read('modules/kernel/protected-zone.yaml')],
    ['modules/kernel/failure-codes.yaml', codes], ['knowledge/hfs/rules.yaml', 'x'], ['scripts/guards/rights.mjs', 'x']]);
  const ctx = (map) => ({ fileSet: new Set(map.keys()), read: (file) => map.get(file) ?? null });
  assert.deepEqual(rightsPolicyFindings(ctx(files)), []);
  assert.deepEqual(rightsPolicyFindings(ctx(new Map())), []);
  const broken = new Map(files);
  broken.set('modules/kernel/command-policy.yaml', 'git:\n  deny:\n    push: {code: RIGHTS_GIT_PUSH}\nroles: {bound: [op]}\nruntime: [starci]\n');
  assert.equal(rightsPolicyFindings(ctx(broken)).length, 1);
});
