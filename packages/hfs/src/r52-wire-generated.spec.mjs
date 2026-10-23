// proves: FE_WIRE_GENERATED@lite
// proves: FE_WIRE_GENERATED@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { RuleTester } from 'eslint';
import parser from '@typescript-eslint/parser';
import { noHandTypedWire } from '../../eslint/fe/transport.mjs';
import { at, fixtureHfs, LITE_FE_DECLARATION } from '../../eslint/fe/fixtures/typed/tester.mjs';
import { appFrontendFindings, wireSchemaDigest, WIRE_SCHEMA_STAMP } from '../runtime/scripts/hfs/rules/frontend-tree.mjs';

const SNAPSHOT = 'be/contracts/api/schema.graphql';
const OPERATION = 'fe/apps/web/src/modules/api/graphql/queries/query-ping.ts';
const GENERATED = 'fe/apps/web/src/modules/api/graphql/__generated__';

function put(root, relative, source) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, source);
}

function wireFixture(t, edition) {
  const parent = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(parent, 'starci-r52-'));
  t.after(() => {
    assert.equal(path.dirname(root), parent);
    assert.ok(path.basename(root).startsWith('starci-r52-'));
    fs.rmSync(root, { recursive: true, force: true });
  });
  put(root, SNAPSHOT, 'type Query { ping: String! }\n');
  put(root, OPERATION, 'export const ping = "query Ping { ping }";\n');
  put(root, 'package.json', JSON.stringify({ scripts: { codegen: 'node scripts/codegen.mjs' } }));
  const files = ['package.json', SNAPSHOT, OPERATION];
  const repo = { edition, sides: { fe: { reads: ['be/contracts/'], apps: [{ name: 'web', kind: 'next' }] } } };
  return { root, files, repo };
}

function wireCodes(fixture, phase = 'workspace') {
  return appFrontendFindings({ repoRoot: fixture.root, files: fixture.files, repo: fixture.repo, phase })
    .filter((finding) => finding.code === 'FE_WIRE_GENERATED').map((finding) => finding.code);
}

function generatedWire(root) {
  put(root, `${GENERATED}/graphql.ts`, 'export type PingQuery = { ping: string };\n');
  put(root, `${GENERATED}/${WIRE_SCHEMA_STAMP}`, `${wireSchemaDigest(root, [SNAPSHOT])}\n`);
}

for (const edition of ['lite', 'full']) {
  test(`${edition} rejects a snapshot without codegen and accepts its declared source inputs`, (t) => {
    const fixture = wireFixture(t, edition);
    put(fixture.root, 'package.json', '{}');
    assert.deepEqual(wireCodes(fixture, 'source'), ['FE_WIRE_GENERATED']);
    put(fixture.root, 'package.json', JSON.stringify({ scripts: { codegen: 'node scripts/codegen.mjs' } }));
    assert.deepEqual(wireCodes(fixture, 'source'), []);
  });

  test(`${edition} rejects absent generated output and accepts matching generated wire types`, (t) => {
    const fixture = wireFixture(t, edition);
    assert.deepEqual(wireCodes(fixture), ['FE_WIRE_GENERATED']);
    generatedWire(fixture.root);
    assert.deepEqual(wireCodes(fixture), []);
  });

  test(`${edition} rejects stale generated wire types and accepts regenerated schema stamps`, (t) => {
    const fixture = wireFixture(t, edition);
    generatedWire(fixture.root);
    put(fixture.root, SNAPSHOT, 'type Query { ping: String! pong: String }\n');
    assert.deepEqual(wireCodes(fixture), ['FE_WIRE_GENERATED']);
    generatedWire(fixture.root);
    assert.deepEqual(wireCodes(fixture), []);
  });

  test(`${edition} accepts generated or unknown response types and rejects handwritten wire claims`, () => {
    const hfs = fixtureHfs(edition === 'lite' ? LITE_FE_DECLARATION : undefined, { lite: edition === 'lite' });
    const tester = new RuleTester({
      languageOptions: { parser, ecmaVersion: 2022, sourceType: 'module' },
      settings: { starci: { hfs } },
    });
    const filename = at('apps/web/src/modules/api/graphql/queries/query-ping.ts');
    tester.run('no-hand-typed-wire', noHandTypedWire, {
      valid: [
        { filename, code: 'const body = (await response.json()) as unknown' },
        { filename, code: 'import type { PingQuery } from "../__generated__/graphql"; const body: PingQuery = await response.json()' },
        { filename, code: 'export const ping = "query Ping { ping }"' },
      ],
      invalid: [
        { filename, code: 'const body = (await response.json()) as PingQuery', errors: [{ messageId: 'cast' }] },
        { filename, code: 'const body: PingQuery = await response.json()', errors: [{ messageId: 'cast' }] },
        { filename: at('apps/web/src/hooks/ping/usePing.ts'), code: 'const ping = "query Ping { ping }"', errors: [{ messageId: 'document' }] },
      ],
    });
  });
}
