import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseYaml } from '../engine/yaml.mjs';
import { checkWorkTree, DEFAULT_MIN_ID_SEGMENTS, FAMILIES, MIN_ID_SEGMENTS, placeDepthFinding } from '../scripts/checks/check-example-work.mjs';

// starci-next inc-f2cfd86685a3: the place rule derived impl.<feature> for impl/index.yaml and
// impl.<feature>.<repository> for impl/<repository>/index.yaml, while work/implementation@1 admits only
// impl.<feature>.<repository>.<name>. Following the place rule kept the ordinary gate green and --strict red;
// following the schema made the ordinary gate refuse "id vs place". The one place both accept is
// impl/<repository>/<name>/, and the ordinary gate now names it as a PLACE_TOO_SHALLOW suspect.
const ROOT = path.resolve(import.meta.dirname, '..');
const Ajv2020 = (() => { const loaded = createRequire(path.join(ROOT, 'package.json'))('ajv/dist/2020.js'); return loaded?.default ?? loaded; })();
const schemaOf = (file) => parseYaml(fs.readFileSync(path.join(ROOT, 'modules/schemas', file), 'utf8'));

const workTree = (t, records) => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-place-depth-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const work = path.join(base, '.starciwork');
  const put = (rel, body) => { const file = path.join(work, rel); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, body); };
  put('index.yaml', 'schema: work/catalog@1\nid: fixture\nfeatures: []\n');
  for (const [rel, body] of Object.entries(records)) put(rel, body);
  return work;
};
const impl = (id, proves) => `schema: work/implementation@1\nid: ${id}\ntitle: A module\nstate: todo\nrepository: web\nowners:\n  - {role: module, path: src}\nproves:\n  - ${proves}\n`;
const nfr = 'schema: work/non-functional-requirement@1\nid: nfr.baseline.toolchain\ntitle: The toolchain gates hold\nstate: todo\nquality: maintainability\nobservableCriterion: lint, typecheck, test and build exit 0\nmeasurement: {method: the baseline gate commands, threshold: every gate exits 0}\n';

test('MIN_ID_SEGMENTS is the {N,} of every family schema id pattern', () => {
  const byFamily = new Map();
  for (const file of fs.readdirSync(path.join(ROOT, 'modules/schemas')).filter((f) => /^work-.*\.schema\.yaml$/.test(f))) {
    const pattern = schemaOf(file)?.properties?.id?.pattern ?? '';
    const match = /^\^\(?(?:\?:)?([a-z|]+)\)?\(\?:\\\.\[a-z0-9\]\+\(\?:-\[a-z0-9\]\+\)\*\)\{(\d+),\}\$$/.exec(pattern);
    if (!match) continue;
    for (const family of match[1].split('|')) byFamily.set(family, Number(match[2]));
  }
  for (const family of FAMILIES) {
    if (!byFamily.has(family)) continue;
    assert.equal(MIN_ID_SEGMENTS[family] ?? DEFAULT_MIN_ID_SEGMENTS, byFamily.get(family), `${family} depth drifted from its schema`);
  }
  assert.equal(byFamily.get('impl'), 3);
});

test('impl scope records above impl/<repository>/<name>/ are PLACE_TOO_SHALLOW suspects, never refusals', (t) => {
  const work = workTree(t, {
    'features/baseline/impl/index.yaml': impl('impl.baseline', 'impl.baseline.web'),
    'features/baseline/impl/web/index.yaml': impl('impl.baseline.web', 'impl.baseline.web.base'),
    'features/baseline/impl/web/base/index.yaml': impl('impl.baseline.web.base', 'nfr.baseline.toolchain'),
    'features/baseline/nfr/toolchain/index.yaml': nfr,
  });
  const refused = []; const suspect = [];
  checkWorkTree(work, refused, suspect);
  assert.deepEqual(refused.filter((r) => /place says|PLACE_TOO_SHALLOW/.test(r)), [], 'the ids match their places, so the ordinary gate does not refuse');
  const shallow = suspect.filter((s) => s.includes('[PLACE_TOO_SHALLOW]'));
  assert.equal(shallow.length, 2, shallow.join('\n'));
  assert.ok(shallow.some((s) => s.includes('features/baseline/impl/index.yaml') && s.includes('derives impl.baseline,')));
  assert.ok(shallow.some((s) => s.includes('features/baseline/impl/web/index.yaml') && s.includes('features/<feature>/impl/<repository>/<name>/index.yaml')));
  assert.ok(!suspect.some((s) => s.includes('impl/web/base/index.yaml') && s.includes('PLACE_TOO_SHALLOW')), 'the leaf sits at its family depth');
});

test('the place both gates accept: a leaf impl id compiles under its schema and proves a requirement record', (t) => {
  const validate = new Ajv2020({ strict: false, allErrors: true, logger: false }).compile(schemaOf('work-implementation.schema.yaml'));
  const leaf = parseYaml(impl('impl.baseline.web.base', 'nfr.baseline.toolchain'));
  assert.equal(validate(leaf), true, JSON.stringify(validate.errors));
  assert.equal(validate({ ...leaf, id: 'impl.baseline.web' }), false, 'the repository-scope id the old place rule accepted');
  assert.equal(validate({ ...leaf, proves: ['impl.baseline'] }), false, 'a feature-scope impl id is not a record id either');
  const work = workTree(t, {
    'features/baseline/impl/web/base/index.yaml': impl('impl.baseline.web.base', 'nfr.baseline.toolchain'),
    'features/baseline/nfr/toolchain/index.yaml': nfr,
  });
  const refused = []; const suspect = [];
  checkWorkTree(work, refused, suspect);
  assert.deepEqual([...refused, ...suspect].filter((s) => /place says|PLACE_TOO_SHALLOW|dangl|does not resolve/i.test(s)), []);
});

test('placeDepthFinding follows each family minimum', () => {
  assert.equal(placeDepthFinding('x', 'ui.login.sign-in'), null);
  assert.match(placeDepthFinding('x', 'ui.login'), /lives at features\/<feature>\/ui\/<name>\/index\.yaml .*\[PLACE_TOO_SHALLOW\]$/);
  assert.equal(placeDepthFinding('x', 'ac.task.owner.visible'), null);
  assert.match(placeDepthFinding('x', 'ac.task.owner'), /br\/<rule>\/ac\/<name>/);
});
