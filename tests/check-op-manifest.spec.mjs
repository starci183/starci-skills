import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkOpManifest, opManifestMain } from '../scripts/checks/check-op-manifest.mjs';

const root = path.resolve(import.meta.dirname, '..');

/** A manifest that holds starci/op@1; each test bends exactly one thing. */
const validOp = () => ({
  schema: 'starci/op@1',
  id: 'sample.op',
  goal: { en: 'Establish one sample outcome from accepted inputs.' },
  nodeKinds: ['business'],
  completionProfile: 'business',
  sideEffects: ['writes the sample evidence bundle'],
  graphPolicy: { mode: 'read-only' },
  reads: [{ id: 'target', path: '.starciwork/features/<feature>/index.yaml', purpose: { en: 'Read the selected record, its scope and its refs.' } }],
  writes: [{ id: 'evidence', path: 'E/**', content: { en: 'Retain the observed bytes and their provenance.' } }],
  steps: [{ reads: ['target'], writes: ['evidence'], action: { en: 'Read the selected record and retain what was observed.' } }],
  proofs: [{ id: 'binding', requirement: { en: '`starci validate` passes and every cited path exists.' } }],
  blockers: [{ code: 'DECLARED_DEPENDENCY_UNMET', condition: { en: 'A declared prerequisite is absent.' } }],
  route: { nodeKinds: ['business'], phase: ['verify'], intent: ['sample'] },
});

/** Write one op into a tmp ops dir and run the check against it. */
function checkFixture(op, { name = 'sample.op' } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'op-manifest-'));
  try {
    fs.writeFileSync(path.join(dir, `${name}.yaml`), JSON.stringify(op, null, 2));
    return checkOpManifest({ root, opsDir: dir });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

const codes = (result) => result.findings.map((f) => f.code);

test('a manifest that holds the shape produces no finding', () => {
  const result = checkFixture(validOp());
  assert.deepEqual(result.findings, []);
  assert.equal(result.ok, true);
  assert.equal(result.opCount, 1);
});

test('an unknown top-level key, a missing section and a wrong id are SCHEMA_INVALID', () => {
  const stray = validOp();
  stray.commitPolicy = { mode: 'one-commit' };
  assert.ok(codes(checkFixture(stray)).includes('SCHEMA_INVALID'));

  const bare = validOp();
  delete bare.proofs;
  assert.ok(checkFixture(bare).findings.some((f) => f.code === 'SCHEMA_INVALID' && /missing proofs/.test(f.message)));

  const misnamed = validOp();
  misnamed.id = 'other.op';
  assert.ok(checkFixture(misnamed).findings.some((f) => f.code === 'SCHEMA_INVALID' && /but the file is/.test(f.message)));
});

test('a param carries a default or required: true, exactly one, and a known setter', () => {
  const undefaulted = validOp();
  undefaulted.params = { maxRounds: { type: 'integer', setBy: 'kernel', doc: { en: 'How many rounds.' } } };
  assert.ok(checkFixture(undefaulted).findings.some((f) => f.code === 'PARAM_DEFAULT' && /neither/.test(f.message)));

  const both = validOp();
  both.params = { subject: { type: 'string', default: 'x', required: true, setBy: 'kernel', doc: { en: 'What is asked.' } } };
  assert.ok(checkFixture(both).findings.some((f) => f.code === 'PARAM_DEFAULT' && /both/.test(f.message)));

  const required = validOp();
  required.params = { subject: { type: 'string', required: true, setBy: 'kernel', doc: { en: 'What is asked.' } } };
  assert.deepEqual(checkFixture(required).findings, [], 'a required param without a default holds the shape');

  const falseRequired = validOp();
  falseRequired.params = { subject: { type: 'string', default: 'x', required: false, setBy: 'kernel', doc: { en: 'What is asked.' } } };
  assert.ok(checkFixture(falseRequired).findings.some((f) => f.code === 'SCHEMA_INVALID' && /required/.test(f.message)), 'required is true or absent');

  const strangeSetter = validOp();
  strangeSetter.params = { maxRounds: { type: 'integer', default: 5, setBy: 'agent', doc: { en: 'How many rounds.' } } };
  assert.ok(checkFixture(strangeSetter).findings.some((f) => f.code === 'SCHEMA_INVALID' && /outside \[owner, kernel\]/.test(f.message)));
});

test('a number the params already carry, restated in a step or a proof, is PARAM_RESTATED', () => {
  const op = validOp();
  op.params = { maxRounds: { type: 'integer', default: 5, setBy: 'kernel', doc: { en: 'How many audit rounds the kernel schedules.' } } };
  op.steps[0].action.en = 'Run the five rounds and stop.';
  op.proofs[0].requirement.en = 'The audit never runs more than 5 rounds and a last round with drift cannot pass.';
  const result = checkFixture(op);
  assert.equal(codes(result).filter((c) => c === 'PARAM_RESTATED').length, 2);

  const cited = validOp();
  cited.params = op.params;
  cited.steps[0].action.en = 'Run at most `params.maxRounds` rounds and stop.';
  assert.ok(!codes(checkFixture(cited)).includes('PARAM_RESTATED'));
});

test('a number with no param behind it is left alone', () => {
  const op = validOp();
  op.steps[0].action.en = 'Generate three candidates for the selected screen.';
  assert.ok(!codes(checkFixture(op)).includes('PARAM_RESTATED'));
});

test('the same sentence written twice in one manifest is RULE_DUPLICATED', () => {
  const op = validOp();
  const rule = 'A missing product decision or accepted design behavior is a typed blocker, never filled with visual invention.';
  op.steps[0].action.en = `Read the selected record. ${rule}`;
  op.proofs[0].requirement.en = `${rule} The result cites its evidence.`;
  const result = checkFixture(op);
  assert.equal(codes(result).filter((c) => c === 'RULE_DUPLICATED').length, 1);
  assert.match(result.findings.find((f) => f.code === 'RULE_DUPLICATED').message, /\$\.proofs\[0\]\.requirement\.en repeats \$\.steps\[0\]\.action\.en/);
});

test('a short sentence repeated is not a duplicated rule', () => {
  const op = validOp();
  op.steps[0].action.en = 'Stop without dispatch. Read the record.';
  op.proofs[0].requirement.en = 'Stop without dispatch. Evidence is retained.';
  assert.ok(!codes(checkFixture(op)).includes('RULE_DUPLICATED'));
});

test('a rule inside a read purpose is RULE_IN_DATA at warn level', () => {
  const op = validOp();
  op.reads[0].purpose.en = 'Read the selected record. This operation never weakens its graph and must preserve accepted content.';
  const result = checkFixture(op);
  const finding = result.findings.find((f) => f.code === 'RULE_IN_DATA');
  assert.ok(finding);
  assert.equal(finding.level, 'warn');
  assert.match(finding.message, /reads\[0\] \(target\)/);
  assert.equal(result.ok, false, 'a warn-level finding still fails the check');
});

test('a writes path that joins several paths is PATH_JOINED', () => {
  const op = validOp();
  op.writes[0].path = 'E/manifest.yaml + E/result.md + E/screens/*.png';
  assert.ok(codes(checkFixture(op)).includes('PATH_JOINED'));

  const globbed = validOp();
  globbed.writes[0].path = 'E/screens/**/*.png';
  assert.ok(!codes(checkFixture(globbed)).includes('PATH_JOINED'));
});

test('a proof citing a check that is not on disk is CHECK_MISSING', () => {
  const op = validOp();
  op.proofs[0].check = 'scripts/checks/check-nothing-at-all.mjs';
  assert.ok(codes(checkFixture(op)).includes('CHECK_MISSING'));

  const real = validOp();
  real.proofs[0].check = 'scripts/checks/check-op-manifest.mjs';
  assert.ok(!codes(checkFixture(real)).includes('CHECK_MISSING'));
});

test('every op manifest in the tree holds starci/op@1', () => {
  const result = checkOpManifest({ root });
  assert.equal(result.findings.length, 0, `check-op-manifest is not clean on the real tree:\n${result.findings.slice(0, 20).map((f) => `  ${f.op} [${f.code}] ${f.message}`).join('\n')}`);
  assert.ok(result.opCount >= 30, `expected the full op catalog, saw ${result.opCount}`);
});

test('the cli exits 1 with a per-code tally and 0 when clean', () => {
  const clean = opManifestMain([]);
  assert.equal(clean.exitCode, 0);
  assert.match(clean.text, /^OK: \d+ op manifests hold starci\/op@1\./);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'op-manifest-cli-'));
  try {
    const op = validOp();
    op.writes[0].path = 'E/a.yaml + E/b.yaml';
    fs.writeFileSync(path.join(dir, 'sample.op.yaml'), JSON.stringify(op, null, 2));
    const failed = opManifestMain(['--opsDir', dir]);
    assert.equal(failed.exitCode, 1);
    assert.match(failed.text, /PATH_JOINED=1/);
    const json = JSON.parse(opManifestMain(['--opsDir', dir, '--json']).text);
    assert.equal(json.schema, 'starci/op-manifest-check@1');
    assert.equal(json.ok, false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('every declared placeholder names a <token> its manifest uses', async () => {
  const { parseYaml } = await import('../engine/yaml.mjs');
  const root = path.resolve(import.meta.dirname, '..');
  const dir = path.join(root, 'modules', 'ops', 'ops');
  const strings = (v) => typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(strings)
    : v && typeof v === 'object' ? Object.entries(v).flatMap(([k, x]) => (k === 'placeholders' ? [] : strings(x))) : [];
  const maps = (v) => Array.isArray(v) ? v.flatMap(maps)
    : v && typeof v === 'object' ? Object.entries(v).flatMap(([k, x]) => (k === 'placeholders' && x && typeof x === 'object' ? [x] : maps(x))) : [];
  const dead = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.yaml'))) {
    const doc = parseYaml(fs.readFileSync(path.join(dir, file), 'utf8'));
    const used = new Set(strings(doc).flatMap((s) => [...s.matchAll(/<([A-Za-z0-9_-]+)>/g)].map((m) => m[1])));
    for (const map of maps(doc)) for (const key of Object.keys(map)) if (!used.has(key)) dead.push(`${file}: ${key}`);
  }
  assert.deepEqual([...new Set(dead)], []);
});
