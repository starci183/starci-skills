// proves: HFS_STARCIWORK_LITE_FORBIDDEN@lite
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { mkdtemp } from '../helpers/tmpdir.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { checkRepo } from '../../scripts/hfs/check.mjs';

// The witness-mutation fixtures (alpha.15, batch C05): the counter-examples of analysis/ops-security.md
// section 3 and the 2026-10-14 owner rulings as `mutate` lists over a temp copy of examples/lite-app, each
// naming the code the a15 rules must emit. A fixture whose code has no enforcer yet carries `pending: R<n>`
// and is skipped; Z01 removes the mark as the rules land. The same fixtures back the `witness:` entries the
// meta-enforcer applies on the release cut.

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const FIXTURES = path.join(ROOT, 'tests', 'fixtures', 'mutations');
const OPS = new Set(['add', 'edit', 'delete']);
const SAFE_PATH = /^(?!\/)[a-zA-Z0-9._\-\/[\]]+$/;

const fixtures = fs.readdirSync(FIXTURES)
  .filter((file) => file.endsWith('.yaml'))
  .sort()
  .map((file) => ({ file, ...parseYaml(fs.readFileSync(path.join(FIXTURES, file), 'utf8')) }));

/** A private copy of the fixture's base with its mutate list applied. */
const mutatedCopy = (t, fixture, { apply = true } = {}) => {
  const dir = mkdtemp(t, 'hfs-mutation-');
  fs.cpSync(path.join(ROOT, fixture.base), dir, { recursive: true });
  if (!apply) return dir;
  for (const step of fixture.mutate) {
    const target = path.join(dir, step.path);
    if (step.op === 'delete') {
      assert.ok(fs.existsSync(target), `${fixture.name}: delete path ${step.path} is not in ${fixture.base}`);
      fs.rmSync(target, { recursive: true, force: true });
      continue;
    }
    if (step.op === 'edit') assert.ok(fs.statSync(target, { throwIfNoEntry: false })?.isFile(), `${fixture.name}: edit path ${step.path} is not a file of ${fixture.base}`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, step.content ?? '');
  }
  return dir;
};

/** Every file of `dir` as a sorted list of repo-relative posix paths (what git ls-files would say). */
const trackedFilesOf = (dir) => {
  const out = [];
  const descend = (rel) => {
    for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      const child = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) descend(child);
      else if (entry.isFile()) out.push(child);
    }
  };
  descend('');
  return out.sort();
};

const codesOf = (repoRoot, files) => new Set(checkRepo({ repoRoot, files, tree: false }).findings.map((finding) => finding.code));

test('every mutation fixture is well formed and its mutate list applies to a copy of its base', (t) => {
  assert.ok(fixtures.length > 0, 'tests/fixtures/mutations holds no fixture');
  for (const fixture of fixtures) {
    const label = `${fixture.file} (${fixture.name ?? 'unnamed'})`;
    assert.match(fixture.name ?? '', /^[a-z0-9][a-z0-9-]*$/, `${label}: name`);
    assert.ok(fixture.name === fixture.file.replace(/\.yaml$/, ''), `${label}: the name is the file name`);
    assert.ok(['lite', 'full'].includes(fixture.edition), `${label}: edition`);
    assert.equal(fixture.base, 'examples/lite-app', `${label}: the witness base is the lite example`);
    assert.ok(Array.isArray(fixture.mutate) && fixture.mutate.length > 0, `${label}: a non-empty mutate list`);
    assert.ok(Array.isArray(fixture.expect) && fixture.expect.length > 0 && fixture.expect.every((code) => /^[A-Z][A-Z0-9_]*$/.test(code)), `${label}: expect names codes`);
    assert.ok(fixture.pending === undefined || /^R\d+$/.test(fixture.pending), `${label}: pending names the rule that will emit the code`);
    for (const step of fixture.mutate) {
      assert.ok(OPS.has(step.op), `${label}: op ${step.op}`);
      assert.ok(SAFE_PATH.test(step.path) && !step.path.split('/').includes('..'), `${label}: unsafe path ${step.path}`);
      if (step.op !== 'delete') assert.equal(typeof step.content, 'string', `${label}: ${step.path} needs content`);
    }
    mutatedCopy(t, fixture);
  }
});

for (const fixture of fixtures) {
  test(`${fixture.name} -> ${fixture.expect.join(', ')}`, { skip: fixture.pending ? `pending: ${fixture.pending}` : false }, (t) => {
    const dir = mutatedCopy(t, fixture);
    const mutated = codesOf(dir, trackedFilesOf(dir));
    for (const code of fixture.expect) {
      assert.ok(mutated.has(code), `${fixture.name}: the mutated ${fixture.base} did not produce ${code} (saw ${[...mutated].sort().join(', ') || 'no findings'})`);
    }
    const plainDir = mutatedCopy(t, fixture, { apply: false });
    const plain = codesOf(plainDir, trackedFilesOf(plainDir));
    for (const code of fixture.expect) {
      assert.ok(!plain.has(code), `${fixture.name}: ${code} already fires on the unmutated ${fixture.base}; it is no witness of this mutation`);
    }
  });
}
