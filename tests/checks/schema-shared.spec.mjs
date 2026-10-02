import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkSchemaShared } from '../../scripts/checks/check-schema-shared.mjs';

const skillRoot = path.resolve(import.meta.dirname, '..', '..');

// A disposable tree holding only the two families the checker reads:
// modules/schemas/work-*.schema.yaml and modules/ops/{_common.yaml,ops/*.yaml}.
function fixture(t, files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-schema-shared-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const [relative, body] of Object.entries(files)) {
    const file = path.join(dir, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body);
  }
  return dir;
}

// A subtree worth sharing: six rendered lines wherever it sits.
const SHARED_BLOCK = `    proof:
      type: object
      additionalProperties: false
      required: [id, because]
      properties:
        id: {type: string}
        because: {type: string, minLength: 1}
`;

const workSchema = (body) => `$schema: https://json-schema.org/draft/2020-12/schema
$id: urn:test:${Math.random()}
type: object
properties:
${body}`;

test('the installed tree carries no duplicated block past either mechanism', () => {
  const result = checkSchemaShared();
  assert.deepEqual(result.findings, [], result.findings.map((f) => f.message).join('\n'));
  assert.equal(result.ok, true);
});

test('an identical 5-line subtree in 3 work schemas is refused', t => {
  const dir = fixture(t, {
    'modules/schemas/work-alpha.schema.yaml': workSchema(SHARED_BLOCK),
    'modules/schemas/work-beta.schema.yaml': workSchema(SHARED_BLOCK),
    'modules/schemas/work-gamma.schema.yaml': workSchema(SHARED_BLOCK),
  });
  const result = checkSchemaShared({ root: dir });
  assert.equal(result.ok, false);
  const finding = result.findings.find((f) => f.code === 'RT_SCHEMA_NOT_SHARED');
  assert.ok(finding, 'expected an RT_SCHEMA_NOT_SHARED finding');
  for (const f of ['work-alpha.schema.yaml', 'work-beta.schema.yaml', 'work-gamma.schema.yaml'])
    assert.ok(finding.path.includes(f), `${finding.path} names ${f}`);
});

test('the same subtree in only 2 work schemas stays below the bar', t => {
  const dir = fixture(t, {
    'modules/schemas/work-alpha.schema.yaml': workSchema(SHARED_BLOCK),
    'modules/schemas/work-beta.schema.yaml': workSchema(SHARED_BLOCK),
    'modules/schemas/work-gamma.schema.yaml': workSchema(`    proof:
      $ref: "urn:work:common:1#/$defs/proof"
`),
  });
  const result = checkSchemaShared({ root: dir });
  assert.equal(result.ok, true, result.findings.map((f) => f.message).join('\n'));
});

const OPS_COMMON = `shared:
  reads:
    - id: alpha
      path: .starciwork/features/<feature>/{fr,nfr}/index.yaml
      purpose:
        en: Read the accepted requirements of the selected feature.
  placeholders:
    feature: the feature the operator picked
  graphPolicy:
    location: declared
`;

test('an op entry that restates its shared fragment verbatim is refused', t => {
  const dir = fixture(t, {
    'modules/ops/_common.yaml': OPS_COMMON,
    'modules/ops/ops/one.yaml': `id: op.one
reads:
  - id: alpha
    path: .starciwork/features/<feature>/{fr,nfr}/index.yaml
    purpose:
      en: Read the accepted requirements of the selected feature.
`,
  });
  const result = checkSchemaShared({ root: dir });
  assert.equal(result.ok, false);
  const finding = result.findings.find((f) => f.code === 'RT_OP_FIELD_NOT_COMMON');
  assert.ok(finding, 'expected an RT_OP_FIELD_NOT_COMMON finding');
  assert.ok(finding.path.includes('one.yaml'));
});

test('shared markers and a divergent literal pass; a shared placeholder literal is refused', t => {
  const dir = fixture(t, {
    'modules/ops/_common.yaml': OPS_COMMON,
    'modules/ops/ops/marked.yaml': `id: op.marked
reads:
  - id: alpha
    path: shared
`,
    'modules/ops/ops/divergent.yaml': `id: op.divergent
reads:
  - id: alpha
    path: .starciwork/features/<feature>/{br}/index.yaml
    purpose:
      en: Read the accepted business rules of the selected feature.
`,
    'modules/ops/ops/repeated.yaml': `id: op.repeated
placeholders:
  feature: the feature the operator picked
`,
  });
  const result = checkSchemaShared({ root: dir });
  assert.equal(result.ok, false);
  assert.equal(result.findings.length, 1);
  assert.ok(result.findings[0].message.includes('placeholders.feature'));
});

test('a shared purpose leaf restated by 3 manifests is refused', t => {
  const files = { 'modules/ops/_common.yaml': OPS_COMMON };
  for (const name of ['one', 'two', 'three'])
    files[`modules/ops/ops/${name}.yaml`] = `id: op.${name}
reads:
  - id: alpha
    path: .starciwork/${name}/index.yaml
    purpose:
      en: Read the accepted requirements of the selected feature.
`;
  const result = checkSchemaShared({ root: fixture(t, files) });
  assert.equal(result.ok, false);
  assert.ok(result.findings.some((f) => f.code === 'RT_OP_FIELD_NOT_COMMON' && f.message.includes('purpose.en')));
});

test('a shared purpose leaf restated by only 2 manifests stays below the bar', t => {
  const files = { 'modules/ops/_common.yaml': OPS_COMMON };
  for (const name of ['one', 'two'])
    files[`modules/ops/ops/${name}.yaml`] = `id: op.${name}
reads:
  - id: alpha
    path: .starciwork/${name}/index.yaml
    purpose:
      en: Read the accepted requirements of the selected feature.
`;
  const result = checkSchemaShared({ root: fixture(t, files) });
  assert.equal(result.ok, true, result.findings.map((f) => f.message).join('\n'));
});
