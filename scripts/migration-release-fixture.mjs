// Isolated integration evidence: a committed fake source runner changes only an ignored JSON journal.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { migrationFiles } from '../operators/backend-generate/self-test.mjs';
import { confirmed } from '../operators/architecture-decide/self-test.mjs';
import { migrationDigest as hash, migrationConnectionFingerprint } from './migration-release.mjs';
import { writeMigrationReleaseProducers } from './migration-release-producers-fixture.mjs';

const runtime = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const write = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value, null, 2)); };
export const fixtureConnection = { driver: 'postgres', host: 'fixture.invalid', port: 5432, database: 'fixture', schema: 'public', username: 'fixture' };
const runnerSource = (mode) => `import fs from 'node:fs';
import {createHash} from 'node:crypto';
const hash = x => 'sha256:' + createHash('sha256').update(JSON.stringify(x)).digest('hex');
if (${JSON.stringify(mode)} === 'early-exit') process.exit(0);
let raw = ''; for await (const chunk of process.stdin) raw += chunk;
const input = JSON.parse(raw), file = '.migration-state.json';
const rows = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
const exists = fs.existsSync(file), names = rows.map(x => x.name).sort();
const pending = input.migrations.map(x => x.name).filter(x => !names.includes(x)).sort();
const before = hash(rows), same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
if (input.connectionFingerprint !== ${JSON.stringify(migrationConnectionFingerprint(fixtureConnection))}) process.exit(3);
if (input.operation === 'apply') {
  if (${JSON.stringify(mode)} === 'malformed-apply') { process.stdout.write('untrusted output'); process.exit(0); }
  if (${JSON.stringify(mode)} === 'cas-refusal') process.exit(4);
  // The source-owned runner repeats its gate immediately before its simulated effect.
  if (input.expected.journalExists !== exists || input.expected.journalFingerprint !== before || !same(input.expected.journal,names) || !same(input.expected.pending,pending)) process.exit(5);
  if (!exists && !input.journal.allowInitialization) process.exit(6);
  if (pending.length) { for (const name of pending) rows.push({id:rows.length + 1,timestamp:200,name}); fs.writeFileSync(file,JSON.stringify(rows)); }
}
const changed = input.operation === 'apply';
process.stdout.write(JSON.stringify({schemaVersion:1,operation:input.operation,planSha256:input.planSha256,sourceHead:input.sourceHead,connectionFingerprint:input.connectionFingerprint,
journalExistsBefore:exists,journalExistsAfter:fs.existsSync(file),journalBefore:names,journalAfter:rows.map(x => x.name).sort(),
pendingBefore:pending,pendingAfter:changed ? [] : pending,applied:changed ? pending : [],journalFingerprintBefore:before,journalFingerprintAfter:hash(rows),preservedJournalFingerprint:before}) + '\\n');
`;

export async function migrationReleaseFixture(t, { mode = 'valid', sealed = false } = {}) {
  const host = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-release-full-'));
  assert.equal(path.dirname(path.resolve(host)), path.resolve(os.tmpdir()));
  t.after(() => fs.rmSync(host, { recursive: true, force: true }));
  const root = path.join(host, '.claude'); fs.mkdirSync(root);
  for (const directory of ['operators', 'templates', 'resources', 'readiness', 'knowledge', 'alias']) fs.cpSync(path.join(runtime, directory), path.join(root, directory), { recursive: true });
  fs.copyFileSync(path.join(runtime, 'routing.json'), path.join(root, 'routing.json'));
  const checkout = path.join(host, 'source'); fs.mkdirSync(checkout);
  const git = (...args) => execFileSync('git', ['-C', checkout, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const files = migrationFiles(), mutation = files['response/data/mutations.json'];
  const writer = mutation.operations[0].writerRef, spec = writer.replace('.ts', '.spec.ts');
  for (const [name, value] of Object.entries({
    '.gitignore': '.migration-state.json\n', 'runner.mjs': runnerSource(mode), 'config.json': fixtureConnection,
    'package.json': { name: 'migration-release-fixture', version: '1.0.0', private: true, type: 'module' },
    'package-lock.json': { name: 'migration-release-fixture', version: '1.0.0', lockfileVersion: 3, packages: {} },
    [writer]: 'export class AddScope {}\n', [spec]: '// Measured fixture migration replay.\n',
  })) write(path.join(checkout, name), value);
  execFileSync(process.execPath, ['--check', path.join(checkout, 'runner.mjs')], { stdio: 'pipe' });
  git('init', '-b', 'session/s-test'); git('add', '.');
  git('-c', 'user.name=Migration Fixture', '-c', 'user.email=migration-fixture@example.invalid', 'commit', '-m', 'fixture: pinned migration runner');
  const head = git('rev-parse', 'HEAD');
  const fileHash = (name) => hash(fs.readFileSync(path.join(checkout, name)));
  for (const [name, content] of Object.entries(files)) {
    if (name === 'producer') continue;
    const replaced = JSON.stringify(content).replaceAll('a1b2'.repeat(10), head).replaceAll(`sha256:${'1'.repeat(64)}`, fileHash(writer)).replaceAll(`sha256:${'2'.repeat(64)}`, fileHash(spec));
    files[name] = JSON.parse(replaced);
  }
  files['request/request.json'].requirements.mutableFileRefs.push('runner.mjs');
  files['response/data/mutations.json'].changes.push({ path: 'runner.mjs', change: 'added', operationId: mutation.operations[0].operationId, beforeHash: null, afterHash: fileHash('runner.mjs') });
  // The runner row belongs to the Changes table, which the Widened section follows when the receipt carries one.
  files['response/response.md'] = files['response/response.md'].replace(/\r?\n\r?\n## (Widened|Findings)/, `\n| \`runner.mjs\` | added | \`${mutation.operations[0].operationId}\` | — | ${fileHash('runner.mjs')} |\n\n## $1`);
  files['response/changes.md'] = files['response/changes.md'].replace(/\r?\n\r?\n## What the next step must know/, '\n| `runner.mjs` | created | fixed migration runner | BE-1 |\n\n## What the next step must know');
  const session = path.join(host, '.worktrees/sessions/s-test'), backend = path.join(session, 'step-1/parallel-1');
  // The done architecture producer is a confirmed re-entry at step-1/parallel-2; the branch it resumes,
  // blocked on RESTATEMENT_UNCONFIRMED, sits beside it at step-1/parallel-3.
  const [producer, patch] = confirmed(files.producer);
  for (const [name, content] of Object.entries(producer)) {
    if (content === null) continue;
    if (name.endsWith('request.json') || name.endsWith('response.json')) { content.step = 1; content.parallel = 2; }
    if (name === 'request/request.json') content.resume = { step: 1, parallel: 3, token: 't-1' };
    if (name === 'critique/request/request.json') content.inputs = Object.fromEntries(Object.entries(content.inputs).map(([k, v]) => [k, String(v).replace('step-2/parallel-1/', 'step-1/parallel-2/')]));
    write(path.join(session, 'step-1/parallel-2', name), content);
  }
  for (const [name, content] of Object.entries(patch.session)) {
    const blocked = { ...content, step: 1, parallel: 3 };
    write(path.join(session, name.replace('step-1/parallel-1/', 'step-1/parallel-3/')), blocked);
  }
  for (const [name, content] of Object.entries(files)) if (name !== 'producer' && content !== null) write(path.join(backend, name), content);
  const state = { id: 's-test', project: 'migration-fixture', startedAt: '2026-09-04T00:00:00Z', status: 'running', chain: [['1/1','1/2','1/3'],['2/1'],['3/1'],['4/1']], steps: {}, requestHashes: {}, current: '4/1', resumes: { '1/2': { resumes: '1/3', stop: 'RESTATEMENT_UNCONFIRMED' } }, choices: patch.state.choices };
  write(path.join(session, 'state.json'), state);
  const { routeRef, qualityRef } = await writeMigrationReleaseProducers({ root, session, checkout, head, backendRef: 'step-1/parallel-1/response/response.md' });
  const connectionFingerprint = migrationConnectionFingerprint(fixtureConnection), connectionRef = 'secret-ref://fixture/primary';
  const connection = sealed ? { ...fixtureConnection, usernameRef: 'secret-ref://fixture/primary/username' } : { ...fixtureConnection };
  if (sealed) delete connection.username;
  const environment = { schemaVersion: 9, env: 'dev', production: false, authorization: { release: 'declared' }, migrationTargets: [{ project: 'migration-fixture', target: 'migration-fixture/dev', connectionRef, connection, ...(sealed ? { connectionFingerprint } : {}) }] };
  const environmentFile = path.join(host, '.stacks/dev/environment.json'); write(environmentFile, environment);
  const plan = { schemaVersion: 1, project: 'migration-fixture', env: 'dev', target: 'migration-fixture/dev', sourceHead: head,
    contractFingerprint: files['request/request.json'].requirements.contractFingerprint, environmentSha256: hash(fs.readFileSync(environmentFile)),
    runner: { path: 'runner.mjs', sha256: fileHash('runner.mjs') }, configuration: ['package.json', 'package-lock.json', 'config.json'].map(name => ({ path: name, sha256: fileHash(name) })),
    connectionRef, connectionFingerprint, migrations: [{ name: 'AddScope', path: writer, sha256: fileHash(writer) }],
    journal: { schema: 'public', table: 'migrations', allowInitialization: true }, journalBefore: [], journalExistsBefore: false, journalFingerprintBefore: hash('[]') };
  const branch = path.join(session, 'step-4/parallel-1');
  const request = { schemaVersion: 9, operatorId: 'migration.release', step: 4, parallel: 1, sessionId: 's-test',
    contexts: [{ alias: '@workspaces/be', head }, { alias: '@workspaces/device-state', head: null }],
    requirements: { release: 'release:fixture', target: plan.target, approval: `.stacks/dev/environment.json#${plan.environmentSha256}`, migration: null, resume: null },
    inputs: { route: routeRef, 'backend-source-application': 'step-1/parallel-1/response/response.md', 'quality-verification': qualityRef }, resume: null };
  const freeze = () => {
    write(path.join(branch, 'request/migration-release.json'), plan);
    request.requirements.migration = { planRef: 'request/migration-release.json', sha256: hash(fs.readFileSync(path.join(branch, 'request/migration-release.json'))) };
    write(path.join(branch, 'request/request.json'), request);
    for (const key of state.chain.flat()) {
      const [step, parallel] = key.split('/'), file = path.join(session, `step-${step}/parallel-${parallel}/request/request.json`);
      state.steps[key] = JSON.parse(fs.readFileSync(file, 'utf8')).operatorId; state.requestHashes[key] = hash(fs.readFileSync(file));
    }
    write(path.join(session, 'state.json'), state);
  };
  freeze();
  const finish = () => write(path.join(branch, 'response/response.json'), { schemaVersion: 9, operatorId: 'migration.release', step: 4, parallel: 1, status: 'done', fallbacks: [], fields: { 'migration-release': 'response/migration-release.md', 'migration-release-proof': 'response/data/migration-release.json' }, commits: [], next: [] });
  return { host, root, session, branch, checkout, head, request, plan, environment, environmentFile, freeze, finish, write };
}
