import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appHasDbTypes, dbTypesEmitter, dbTypesPath, emitDbTypes, writeDbTypes } from '../../packages/hfs/emit/db-types.mjs';
import { emitContracts } from '../../packages/hfs/emit/contracts.mjs';
import { openHfs } from '../../packages/hfs/runtime/scripts/hfs/slots.mjs';
import { checkDatabase } from '../../scripts/hfs/rules/database.mjs';

// `supabase/types/database.types.ts` (slot app.supabase.types, design 4.2 L09 DB_TYPES_DRIFT): emitContracts writes it
// through writeDbTypes on the real write pass when the app declares a connection with provider supabase, and
// dbTypesEmitter is the `emitTypes` callback checkDatabase compares the committed file against. Every `supabase` call
// goes through an injected runner, so no spec starts Docker.

const made = [];
test.after(() => { for (const dir of made) fs.rmSync(dir, { recursive: true, force: true }); });

const GENERATED = 'export type Database = { public: { Tables: {} } };\n';
const CONFIG = '[api]\nenabled = true\nschemas = ["public", "storage"]\n';

/** A fake command runner answering `text` (or `failure`) and recording its calls: {file, args, cwd}. */
const fakeRun = (calls, text = GENERATED, failure = null) => (file, args, opts) => {
  calls.push({ file, args, cwd: opts?.cwd });
  return failure ?? { status: 0, stdout: text, stderr: '' };
};

const CONNECTION = { name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'core', isolation: 'database' };
const declaration = (provider) => ({
  hfs: 2, kind: 'app', project: 'demo',
  sides: {
    be: { apps: [{ name: 'core', kind: 'api' }, { name: 'cli', kind: 'cli' }], connections: [{ ...CONNECTION, ...(provider ? { provider } : {}) }] },
    fe: { apps: [{ name: 'web', kind: 'next' }] },
  },
});

/** A temp app root holding `files` ({path: text}) plus an hfs.json; `provider` null declares a connection without one. */
function appRoot(files, provider = null) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-db-types-'));
  made.push(dir);
  fs.writeFileSync(path.join(dir, 'hfs.json'), JSON.stringify(declaration(provider)));
  for (const [file, text] of Object.entries(files)) {
    const target = path.join(dir, ...file.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  }
  return dir;
}

test('emitDbTypes returns the generated text and narrows it to the [api] schemas of config.toml', () => {
  const dir = appRoot({ 'supabase/config.toml': CONFIG }, null);
  const calls = [];
  assert.equal(emitDbTypes({ root: dir, run: fakeRun(calls) }), GENERATED);
  assert.deepEqual(calls, [{ file: 'supabase', args: ['gen', 'types', 'typescript', '--local', '--schema', 'public,storage'], cwd: dir }]);
});

test('emitDbTypes passes no --schema without a config.toml, and a failing run raises HFS_EMIT_DB_TYPES_FAILED naming the first stderr line', () => {
  const dir = appRoot({}, null);
  const calls = [];
  assert.equal(emitDbTypes({ root: dir, run: fakeRun(calls) }), GENERATED);
  assert.deepEqual(calls[0].args, ['gen', 'types', 'typescript', '--local']);
  const failing = () => ({ status: 1, stdout: '', stderr: 'docker is not running\nmore detail here\n' });
  const thrown = (fn) => { try { fn(); } catch (e) { return e; } return null; };
  const error = thrown(() => emitDbTypes({ root: dir, run: failing }));
  assert.equal(error?.code, 'HFS_EMIT_DB_TYPES_FAILED');
  assert.match(error.message, /docker is not running/);
  assert.equal(error.message.includes('more detail here'), false, 'only the first stderr line names the failure');
  assert.throws(() => emitDbTypes({ root: dir, run: () => { throw new Error('spawn ENOENT'); } }), (e) => e.code === 'HFS_EMIT_DB_TYPES_FAILED' && /spawn ENOENT/.test(e.message));
  assert.throws(() => emitDbTypes({ root: dir, run: () => ({ status: 0, stdout: '  \n', stderr: '' }) }), (e) => e.code === 'HFS_EMIT_DB_TYPES_FAILED');
});

test('writeDbTypes writes the file and a re-run over the same text is a no-op on disk', () => {
  const dir = appRoot({ 'supabase/config.toml': CONFIG }, null);
  const calls = [];
  const run = fakeRun(calls);
  assert.deepEqual(writeDbTypes({ root: dir, run }), { path: dbTypesPath, changed: true });
  assert.equal(fs.readFileSync(path.join(dir, dbTypesPath), 'utf8'), GENERATED);
  assert.deepEqual(writeDbTypes({ root: dir, run }), { path: dbTypesPath, changed: false }, 'the second emit regenerates but does not rewrite');
  assert.equal(calls.length, 2, 'the text is regenerated, the write is skipped');
});

test('appHasDbTypes reads the slot view: enabled by a supabase connection only, false for a side view or no resolver', () => {
  const withSupabase = openHfs({ declaration: declaration('supabase') });
  assert.equal(appHasDbTypes(withSupabase), true);
  assert.equal(appHasDbTypes(openHfs({ declaration: declaration('postgres') })), false);
  assert.equal(appHasDbTypes(openHfs({ declaration: declaration('supabase'), side: 'be' })), false, 'a side resolver holds no app-scope slot');
  assert.equal(appHasDbTypes(null), false);
  assert.equal(appHasDbTypes({}), false);
});

test('emitContracts: an app without the supabase provider is untouched - byte-identical output, run never called', () => {
  const calls = [];
  const run = fakeRun(calls);
  const plain = appRoot({ 'supabase/config.toml': CONFIG }, 'postgres');
  const result = emitContracts({ repoRoot: path.join(plain, 'be'), declaration: { apps: [] }, run });
  assert.deepEqual(result, { written: [], skipped: [], standIns: {}, types: null });
  assert.equal(calls.length, 0, 'the supabase CLI is never spawned');
  assert.equal(fs.existsSync(path.join(plain, dbTypesPath)), false);
  const bare = appRoot({}, null);
  assert.deepEqual(emitContracts({ repoRoot: path.join(bare, 'be'), declaration: { apps: [] }, run }), { written: [], skipped: [], standIns: {}, types: null });
  assert.equal(calls.length, 0);
  // a redirected pass (the R23 check mode) never emits the app-level types either, supabase provider or not
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-db-types-out-'));
  made.push(scratch);
  const supa = appRoot({ 'supabase/config.toml': CONFIG }, 'supabase');
  assert.deepEqual(emitContracts({ repoRoot: path.join(supa, 'be'), declaration: { apps: [] }, outDir: scratch, run }), { written: [], skipped: [], standIns: {}, types: null });
  assert.equal(calls.length, 0);
});

test('emitContracts: an app with provider supabase gets supabase/types/database.types.ts written; a second emit is a no-op', () => {
  const dir = appRoot({ 'supabase/config.toml': CONFIG }, 'supabase');
  const calls = [];
  const run = fakeRun(calls);
  const first = emitContracts({ repoRoot: path.join(dir, 'be'), declaration: { apps: [] }, run });
  assert.deepEqual(first.types, { path: dbTypesPath, changed: true });
  assert.equal(fs.readFileSync(path.join(dir, dbTypesPath), 'utf8'), GENERATED);
  assert.deepEqual(calls.map((c) => [c.file, c.cwd]), [['supabase', dir]]);
  assert.deepEqual(calls[0].args, ['gen', 'types', 'typescript', '--local', '--schema', 'public,storage']);
  const second = emitContracts({ repoRoot: path.join(dir, 'be'), declaration: { apps: [] }, run });
  assert.deepEqual(second.types, { path: dbTypesPath, changed: false });
  assert.equal(fs.readFileSync(path.join(dir, dbTypesPath), 'utf8'), GENERATED);
});

test('dbTypesEmitter is the emitTypes of checkDatabase: drift and emit-failed are findings, identical text is clean', async () => {
  const noRemote = () => ({ ok: false, stdout: '' });
  const dir = appRoot({ 'supabase/config.toml': CONFIG, [dbTypesPath]: 'export type Database = { old: true };\n' }, 'supabase');
  const stale = await checkDatabase({ repoRoot: dir, files: [dbTypesPath], git: noRemote, emitTypes: dbTypesEmitter({ run: fakeRun([]) }) });
  assert.deepEqual(stale.map((f) => [f.code, f.drift]), [['DB_TYPES_DRIFT', 'stale']]);
  fs.writeFileSync(path.join(dir, dbTypesPath), GENERATED);
  assert.deepEqual(await checkDatabase({ repoRoot: dir, files: [dbTypesPath], git: noRemote, emitTypes: dbTypesEmitter({ run: fakeRun([]) }) }), []);
  const failed = await checkDatabase({ repoRoot: dir, files: [dbTypesPath], git: noRemote, emitTypes: dbTypesEmitter({ run: () => ({ status: 1, stdout: '', stderr: 'no stack\n' }) }) });
  assert.deepEqual(failed.map((f) => [f.code, f.drift]), [['DB_TYPES_DRIFT', 'emit-failed']]);
  // the check passes its app root: the runner runs in repoRoot, not the bound fallback
  const calls = [];
  await dbTypesEmitter({ root: path.join(dir, 'elsewhere'), run: fakeRun(calls) })({ repoRoot: dir, declaration: {} });
  assert.deepEqual(calls.map((c) => c.cwd), [dir]);
});
