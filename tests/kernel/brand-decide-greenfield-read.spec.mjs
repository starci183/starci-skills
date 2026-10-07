// brand.decide's reads.direction is bound to direction mode (params.directionArchetype):
// a greenfield identity run has no brand record and no <family> binding, so the first
// brand.decide must dispatch. Direction mode binds <family> from the bound brand
// record's brand.identity.family; when that binding cannot resolve, the refusal is a
// typed missing-binding refusal - never a literal 'knowledge/grammars/<family>/DNA.yaml'
// missing-file refusal (op-brand.decide-6faaeb6990).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { selectDispatchContract, captureDispatchInputs } from '../../scripts/kernel/dispatch-admission.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const OP = 'brand.decide';

const repo = (t, brandYaml = null) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-brand-greenfield-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, '.starciwork'), { recursive: true });
  if (brandYaml !== null) {
    fs.mkdirSync(path.join(dir, '.starciwork', 'brand'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.starciwork', 'brand', 'index.yaml'), brandYaml);
  }
  return dir;
};

const BRAND = (identity = 'family: starci') => `schema: work/brand@1\nkind: brand\nid: brand\nstate: done\nrev: 1\nbrand:\n  identity:\n    ${identity}\n`;

const admit = (dir, params) => {
  const selected = selectDispatchContract(ROOT, OP, { records: [], params });
  const packet = { context: { records: [], owned_paths: [], selected_op: selected.selected } };
  return captureDispatchInputs({ skillRoot: ROOT, op: OP, packet, briefDoc: selected.brief,
    params: selected.params, repo: dir, stateDir: path.join(dir, '.starciwork'), workerCwd: dir });
};

test('identity mode on a greenfield product (no brand record) is admitted', (t) => {
  const dir = repo(t);
  const { inputs } = admit(dir, {});
  assert.ok(inputs.digests.length > 0, 'the admission binds input digests');
  assert.ok(!inputs.digests.some((d) => d.path.includes('DNA.yaml')), 'identity mode binds no family DNA read');
});

test('direction mode binds <family> from the brand record and requires its DNA', (t) => {
  const dir = repo(t, BRAND());
  const { inputs } = admit(dir, { directionArchetype: 'dashboard' });
  const dna = inputs.digests.find((d) => d.path === 'knowledge/grammars/starci/DNA.yaml');
  assert.ok(dna, 'the direction-mode read resolves knowledge/grammars/<family>/DNA.yaml');
  assert.notEqual(dna.digest, 'absent');
});

test('direction mode with no resolvable family refuses naming the missing binding', (t) => {
  const dir = repo(t, BRAND('name: nivo'));
  assert.throws(() => admit(dir, { directionArchetype: 'dashboard' }), (error) => {
    assert.equal(error.code, 'op-context-refused');
    assert.match(error.message, /<family>/, 'the refusal names the missing binding');
    assert.doesNotMatch(error.message, /knowledge\/grammars\/<family>\/DNA\.yaml/, 'never a literal <family> missing-file path');
    return true;
  });
});
