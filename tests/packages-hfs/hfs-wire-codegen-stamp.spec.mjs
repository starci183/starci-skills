import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { render } from '../../packages/hfs/sync/index.mjs';
import { appFrontendFindings, wireSchemaDigest, WIRE_SCHEMA_STAMP } from '../../scripts/hfs/rules/frontend-tree.mjs';

const RUNTIME = path.resolve(import.meta.dirname, '..', '..');
const GENERATED = 'fe/apps/web/src/modules/api/graphql/__generated__';
const QUERY = 'fe/apps/web/src/modules/api/graphql/queries/query-ping.ts';
const SCHEMAS = ['be/contracts/api/schema.graphql', 'be/contracts/extra/schema.graphql'];
// An injected CLI fixture isolates the template's stamping protocol; the app still calls its real generate API.
const GENERATOR = String.raw`
import fs from 'node:fs';
import path from 'node:path';
export async function generate(config, write) {
  if (fs.existsSync('refuse-codegen')) throw new Error('codegen refused the operation');
  if (!write) throw new Error('the template must request output on disk');
  for (const [directory, options] of Object.entries(config.generates)) {
    if (options.preset !== 'client') throw new Error('the template must use the client preset');
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'graphql.ts'), 'export type PingQuery = { ping: string };\n');
  }
}
`;

function put(root, file, text) {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text);
}

function fixture(t, edition) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-wire-codegen-stamp-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const template = edition === 'lite' ? 'app/codegen-lite/scripts/codegen.mjs' : 'app/skeleton/scripts/codegen.mjs';
  const source = fs.readFileSync(path.join(RUNTIME, 'packages/hfs/templates', template), 'utf8');
  put(root, 'scripts/codegen.mjs', render(source, { appBinary: 'starci app' }));
  put(root, 'node_modules/@graphql-codegen/cli/package.json', '{"type":"module","exports":"./index.mjs"}\n');
  put(root, 'node_modules/@graphql-codegen/cli/index.mjs', GENERATOR);
  put(root, SCHEMAS[0], 'type Query { ping: String! }\r\n');
  put(root, SCHEMAS[1], 'extend type Query { extra: String }\n');
  put(root, QUERY, 'export const ping = gql`query Ping { ping }`;\n');
  const files = ['package.json', ...SCHEMAS, QUERY];
  put(root, 'package.json', '{"scripts":{"codegen":"node scripts/codegen.mjs"}}\n');
  const repo = { edition, sides: { fe: { reads: ['be/contracts/'], apps: [{ name: 'web', kind: 'next' }] } } };
  const wire = () => appFrontendFindings({ repoRoot: root, files, repo }).filter(finding => finding.code === 'FE_WIRE_GENERATED');
  const run = () => spawnSync(process.execPath, ['scripts/codegen.mjs', '--graphql'], { cwd: root, encoding: 'utf8', windowsHide: true });
  return { root, run, wire, stamp: path.join(root, GENERATED, WIRE_SCHEMA_STAMP) };
}

for (const edition of ['lite', 'full']) {
  test(`${edition} codegen stamps successful wire output with R52's schema digest`, t => {
    const { root, run, wire, stamp } = fixture(t, edition);
    assert.match(wire()[0].message, /no generated wire types/);
    const first = run();
    assert.equal(first.status, 0, first.stderr);
    const expected = wireSchemaDigest(root, SCHEMAS);
    assert.equal(fs.readFileSync(stamp, 'utf8'), `${expected}\n`);
    assert.deepEqual(wire(), []);
    put(root, SCHEMAS[0], 'type Query { ping: String! }\n');
    assert.equal(run().status, 0);
    assert.equal(fs.readFileSync(stamp, 'utf8'), `${expected}\n`, 'checkout line endings do not change the digest');
  });

  test(`${edition} failed codegen cannot stamp absent output or refresh stale output`, t => {
    const { root, run, wire, stamp } = fixture(t, edition);
    put(root, 'refuse-codegen', 'refuse\n');
    assert.notEqual(run().status, 0);
    assert.equal(fs.existsSync(stamp), false);
    fs.rmSync(path.join(root, 'refuse-codegen'));
    assert.equal(run().status, 0);
    const previous = fs.readFileSync(stamp, 'utf8');
    put(root, SCHEMAS[0], 'type Query { ping: String! changed: String }\n');
    put(root, 'refuse-codegen', 'refuse\n');
    assert.notEqual(run().status, 0);
    assert.equal(fs.readFileSync(stamp, 'utf8'), previous);
    assert.match(wire()[0].message, /different schema digest/);
  });
}
