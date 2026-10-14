// proves: DB_TYPES_DRIFT@lite
// proves: DB_TYPES_DRIFT@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { main } from '../../packages/hfs/src/main.mjs';
import { TYPES_STAMP, dbTypesPath, migrationsDigest } from '../../packages/hfs/emit/db-types.mjs';
import { withoutGitLocalEnv } from '../../scripts/lib/git.mjs';
import { FORMATTED, PRESETS } from '../helpers/hfs-cli-fixture.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

const BODY = 'export type Database = { public: { Tables: Record<string, never> } };\n';
const STALE_BODY = 'export type Database = { public: { Tables: { removed: unknown } } };\n';
const ARGS = ['gen', 'types', 'typescript', '--local', '--schema', 'public,storage'];

function write(root, relative, text) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text);
}

function declaration(edition) {
  return {
    hfs: 3, kind: 'app', edition, project: 'proof',
    sides: {
      be: {
        apps: [{ name: 'api', kind: 'api' }, { name: 'cli', kind: 'cli' }],
        connections: [{ name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'api', isolation: 'schema', provider: 'supabase' }],
      },
      fe: { apps: [{ name: 'web', kind: 'next' }] },
    },
  };
}

function fixture(t, edition) {
  const into = mkdtemp(t, `hfs-types-${edition}-`);
  const root = path.join(into, 'proof');
  write(root, 'hfs.json', JSON.stringify(declaration(edition)));
  write(root, 'supabase/config.toml', '[api]\nenabled = true\nschemas = ["public", "storage"]\n');
  write(root, 'supabase/migrations/20261014120000_create_status.sql', "create schema app;\ncreate type app.status as enum ('ready');\n");
  write(root, dbTypesPath, `${TYPES_STAMP}${migrationsDigest(root)}\n${STALE_BODY}`);
  const options = { cwd: root, env: withoutGitLocalEnv(process.env), stdio: 'ignore' };
  execFileSync('git', ['init', '-q'], options);
  execFileSync('git', ['add', 'hfs.json', 'supabase'], options);
  return { into, root };
}

// Exercise the CLI's own dbTypesEmitter and spawnSync, with a local executable instead of a provider.
// On Windows the copied Node executable consumes `gen` as its script; the fixture supplies that file.
function localSupabase(t, into, root) {
  const bin = path.join(into, 'bin');
  const calls = path.join(into, 'calls.jsonl');
  const runner = [
    "const fs = require('node:fs');",
    'const args = process.argv.slice(2);',
    "if (args[0] !== 'gen') args.unshift('gen');",
    `fs.appendFileSync(${JSON.stringify(calls)}, JSON.stringify({ args, cwd: process.cwd() }) + String.fromCharCode(10));`,
    `process.stdout.write(${JSON.stringify(BODY)});`,
  ].join('\n');
  fs.mkdirSync(bin);
  if (process.platform === 'win32') {
    fs.copyFileSync(process.execPath, path.join(bin, 'supabase.exe'));
    write(root, 'gen', runner);
  } else {
    write(bin, 'supabase', `#!/usr/bin/env node\n${runner}\n`);
    fs.chmodSync(path.join(bin, 'supabase'), 0o755);
  }
  const originalPath = process.env.PATH;
  process.env.PATH = `${bin}${path.delimiter}${originalPath ?? ''}`;
  t.after(() => {
    if (originalPath === undefined) delete process.env.PATH;
    else process.env.PATH = originalPath;
  });
  return () => fs.existsSync(calls) ? fs.readFileSync(calls, 'utf8').trim().split('\n').map(line => JSON.parse(line)) : [];
}

async function check(root, dbTypes = true) {
  let output = '';
  let error = '';
  const argv = ['check', '--json', ...(dbTypes ? ['--db-types'] : [])];
  const exit = await main(argv, {
    cwd: root, presets: PRESETS, prettier: FORMATTED,
    stdout: text => { output += text; }, stderr: text => { error += text; },
  });
  assert.equal(error, '', 'the normal check reaches its JSON report');
  const report = JSON.parse(output);
  assert.equal(report.profile, 'app');
  return { exit, report, drift: report.findings.filter(finding => finding.code === 'DB_TYPES_DRIFT') };
}

for (const edition of ['lite', 'full']) {
  test(`${edition}: check --db-types rejects an edited generated body and accepts fresh CLI output`, async t => {
    const { into, root } = fixture(t, edition);
    const calls = localSupabase(t, into, root);
    const before = fs.readFileSync(path.join(root, dbTypesPath), 'utf8');

    const ordinary = await check(root, false);
    assert.deepEqual(ordinary.drift, [], 'type emission is opt-in on the ordinary check');
    assert.deepEqual(calls(), []);

    const stale = await check(root);
    assert.equal(stale.exit, 1);
    assert.equal(stale.report.ok, false);
    assert.deepEqual(stale.drift.map(({ code, level, path: file, drift }) => ({ code, level, path: file, drift })), [
      { code: 'DB_TYPES_DRIFT', level: 'error', path: dbTypesPath, drift: 'stale' },
    ]);
    assert.equal(fs.readFileSync(path.join(root, dbTypesPath), 'utf8'), before, 'checking never rewrites the stale file');
    assert.deepEqual(calls(), [{ args: ARGS, cwd: root }]);

    write(root, dbTypesPath, `${TYPES_STAMP}${migrationsDigest(root)}\n${BODY}`);
    const fresh = await check(root);
    assert.deepEqual(fresh.drift, [], 'the same CLI path accepts identical freshly generated types');
    assert.deepEqual(calls(), [{ args: ARGS, cwd: root }, { args: ARGS, cwd: root }]);
  });
}
