// The no-install example render judges tracked source obligations. Ordinary app checks also judge ignored codegen output.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { exampleRenderFindings } from '../../scripts/checks/check-example-render.mjs';
import { trackedFiles } from '../../scripts/hfs/check.mjs';
import { appFrontendFindings, wireSchemaDigest, WIRE_SCHEMA_STAMP } from '../../scripts/hfs/rules/frontend-tree.mjs';
import { withoutGitLocalEnv } from '../../scripts/lib/git.mjs';
import { hfsTreeRulesFixture } from '../helpers/hfs-hfs-tree-rules-fixture.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const SNAPSHOT = 'be/contracts/api/schema.graphql';
const GENERATED = 'fe/apps/web/src/modules/api/graphql/__generated__';
const QUERY = 'fe/apps/web/src/modules/api/graphql/queries/query-ping.ts';
const CODEGEN = { codegen: 'node scripts/codegen.mjs' };
const hfs = hfsTreeRulesFixture();
test.after(() => hfs.cleanup());

function put(dir, relative, text) {
  const target = path.join(dir, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text);
}

const wireFindings = (findings) => findings.filter((finding) => finding.code === 'FE_WIRE_GENERATED');
const wirePaths = (findings) => wireFindings(findings).map((finding) => finding.path);

function frontendFixture(t, edition) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-example-phases-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const declaration = {
    hfs: 3, kind: 'app', project: 'phases', edition,
    sides: {
      be: { kinds: ['api'], apps: [{ name: 'api', kind: 'api' }] },
      fe: { apps: [{ name: 'web', kind: 'next' }], reads: ['be/contracts/'] },
    },
  };
  const files = ['.gitignore', 'hfs.json', 'package.json', 'fe/apps/web/package.json', SNAPSHOT, QUERY];
  put(dir, '.gitignore', 'fe/apps/*/src/modules/api/graphql/__generated__/\n');
  put(dir, 'hfs.json', JSON.stringify(declaration));
  put(dir, 'fe/apps/web/package.json', JSON.stringify({ dependencies: { 'next-intl': '4.0.0' } }));
  put(dir, SNAPSHOT, 'type Query { ping: String }\n');
  put(dir, QUERY, 'export const ping = gql`query Ping { ping }`;\n');
  const scripts = (value) => put(dir, 'package.json', JSON.stringify({ scripts: value }));
  scripts(CODEGEN);
  return {
    dir, files, declaration, scripts,
    frontend: (phase) => appFrontendFindings({ repoRoot: dir, files, repo: declaration, phase }),
    check: (phase) => hfs.checkRepo({ repoRoot: dir, files, declaration, phase }),
  };
}

function generatedWire(dir, digest = wireSchemaDigest(dir, [SNAPSHOT])) {
  put(dir, `${GENERATED}/graphql.ts`, 'export type Query = { ping: string };\n');
  put(dir, `${GENERATED}/${WIRE_SCHEMA_STAMP}`, `${digest}\n`);
}

function trackFixture(dir) {
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: dir, env: withoutGitLocalEnv(process.env), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  };
  git('init', '-q', '-b', 'main');
  git('add', '-A', '--', '.');
  return () => git('add', '-A', '--', '.');
}

for (const edition of ['lite', 'full']) {
  test(`frontend source phase (${edition}) still requires the tracked snapshot codegen script`, (t) => {
    const fixture = frontendFixture(t, edition);
    fixture.scripts({});
    const findings = wireFindings(fixture.frontend('source'));
    assert.deepEqual(findings.map((finding) => finding.path), ['package.json']);
    assert.match(findings[0].message, /no `codegen` script/);
    generatedWire(fixture.dir);
    assert.deepEqual(wirePaths(fixture.frontend('source')), ['package.json']);
    fixture.scripts(CODEGEN);
    assert.deepEqual(fixture.frontend('source'), []);
  });

  test(`frontend source phase (${edition}) is independent of ignored missing, stale and valid output`, (t) => {
    const fixture = frontendFixture(t, edition);
    const source = fixture.frontend('source');
    assert.deepEqual(source, []);
    assert.deepEqual(wirePaths(fixture.frontend()), [GENERATED], 'the default phase requires generated output');
    put(fixture.dir, `${GENERATED}/${WIRE_SCHEMA_STAMP}`, `${wireSchemaDigest(fixture.dir, [SNAPSHOT])}\n`);
    assert.deepEqual(fixture.frontend('source'), source, 'a stamp without types cannot change source findings');
    generatedWire(fixture.dir, '0'.repeat(64));
    assert.deepEqual(fixture.frontend('source'), source);
    assert.match(wireFindings(fixture.frontend('workspace'))[0].message, /different schema digest/);
    generatedWire(fixture.dir);
    assert.deepEqual(fixture.frontend('source'), source);
    assert.deepEqual(fixture.frontend(), [], 'the default phase accepts output matching the schema digest');
  });

  test(`checkRepo (${edition}) forwards source and defaults to workspace presence and freshness checks`, (t) => {
    const fixture = frontendFixture(t, edition);
    const source = fixture.check('source').findings;
    assert.deepEqual(wirePaths(source), []);
    const missing = wireFindings(fixture.check().findings);
    assert.deepEqual(missing.map((finding) => finding.path), [GENERATED]);
    assert.match(missing[0].message, /no generated wire types/);
    assert.deepEqual(wireFindings(fixture.check('workspace').findings), missing);
    generatedWire(fixture.dir, '0'.repeat(64));
    const stale = wireFindings(fixture.check().findings);
    assert.deepEqual(stale.map((finding) => finding.path), [GENERATED]);
    assert.match(stale[0].message, /different schema digest/);
    assert.deepEqual(fixture.check('source').findings, source);
    generatedWire(fixture.dir);
    assert.deepEqual(wirePaths(fixture.check().findings), []);
  });

  test(`checkRepo source phase (${edition}) retains codegen and tracked generated-file obligations`, (t) => {
    const fixture = frontendFixture(t, edition);
    fixture.scripts({});
    assert.deepEqual(wirePaths(fixture.check('source').findings), ['package.json']);
    generatedWire(fixture.dir);
    const output = `${GENERATED}/graphql.ts`;
    fixture.files.push(output);
    fixture.scripts(CODEGEN);
    const findings = fixture.check('source').findings;
    assert.deepEqual(wirePaths(findings), []);
    const trackedOutput = findings.filter((finding) => finding.code === 'HFS_TRACKED_MUST_BE_IGNORED');
    assert.deepEqual(trackedOutput.map((finding) => finding.path), [output]);
    assert.equal(trackedOutput[0].level, 'error');
  });

  test(`example render (${edition}) judges source without depending on ignored local generated output`, async (t) => {
    const fixture = frontendFixture(t, edition);
    const track = trackFixture(fixture.dir);
    const render = () => exampleRenderFindings(root, 'phases', fixture.dir);
    const source = await render();
    assert.deepEqual(wirePaths(source), []);
    generatedWire(fixture.dir, '0'.repeat(64));
    assert.ok(!trackedFiles(fixture.dir).some((file) => file.startsWith(`${GENERATED}/`)));
    assert.deepEqual(await render(), source);
    generatedWire(fixture.dir);
    assert.deepEqual(await render(), source);
    fixture.scripts({});
    track();
    const missingScript = wireFindings(await render());
    assert.deepEqual(missingScript.map((finding) => finding.path), ['package.json']);
    assert.match(missingScript[0].message, /no `codegen` script/);
  });
}
