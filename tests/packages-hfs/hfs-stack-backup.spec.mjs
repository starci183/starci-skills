import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { backupVolumes } from '../../packages/hfs/stack/backup.mjs';
import { fakeHost } from '../helpers/stack-fakes.mjs';
import { IMAGE, RECIPIENT, fakeRunner, makeApp, shellWords } from '../helpers/stack-fakes-C.mjs';

const apps = [];
const appWith = (options) => {
  const app = makeApp(options);
  apps.push(app);
  return app;
};
after(() => { for (const app of apps) app.cleanup(); });

const NOW = Date.UTC(2027, 0, 15, 8, 0, 0);
const STAMP = '20270115-080000';
const ok = (stdout = '') => ({ status: 0, stdout, stderr: '' });
const failed = (stderr) => ({ status: 1, stdout: '', stderr });

/** A manager that records the archive scripts and the retention sweep. */
function manager({ jobs = () => ok(), age = () => ok(), find = () => ok() } = {}) {
  const host = fakeHost();
  const scripts = [];
  const run = fakeRunner(host, {
    'command -v age': age,
    'bash -c': (command) => { const script = shellWords(command)[2]; scripts.push(script); return jobs(script); },
    'find ': find,
  });
  return { host, run, scripts, deps: { ssh: run }, ctx: host.ctx({ now: () => NOW }) };
}

const volumeScript = (name, volume, dir = '/var/backups/shop') => {
  const final = `${dir}/${name}-${STAMP}.tgz.age`;
  return [
    'set -o pipefail', 'umask 077', `mkdir -p '${dir}'`,
    `docker run --rm -v '${volume}:/src:ro' '${IMAGE}' tar czf - -C /src . | age -r '${RECIPIENT}' -o '${final}.partial' && mv '${final}.partial' '${final}' || { rm -f '${final}.partial'; exit 1; }`,
  ].join('; ');
};

test('a deploy block without backup is refused', async () => {
  const { config } = appWith({ deploy: { backup: null } });
  await assert.rejects(backupVolumes(manager().ctx, config, { execute: true }, manager().deps), (error) => error.code === 'STACK_BACKUP_UNDECLARED' && error.exit === 2);
});

test('the recipient must come from the .sops.yaml creation_rules', async () => {
  const noFile = appWith({ sops: null });
  const noAge = appWith({ sops: 'not-an-age-recipient' });
  const broken = appWith();
  fs.writeFileSync(path.join(broken.root, '.sops.yaml'), 'a: [unclosed');
  const rulesless = appWith();
  fs.writeFileSync(path.join(rulesless.root, '.sops.yaml'), `stores:\n  note: ${RECIPIENT}\n`);
  await Promise.all([noFile, noAge, broken, rulesless].map(({ config }) => assert.rejects(
    backupVolumes(manager().ctx, config, {}, manager().deps),
    (error) => error.code === 'STACK_BACKUP_NO_RECIPIENT' && error.exit === 2,
  )));
});

test('without --execute backup prints the plan and runs nothing', async () => {
  const { config } = appWith();
  const m = manager();
  const result = await backupVolumes(m.ctx, config, undefined, undefined);
  assert.equal(result.ok, true);
  assert.equal(m.host.calls.length, 0);
  assert.deepEqual(result.lines, [
    'dry run: nothing was backed up',
    'volumes: data, cache',
    'target on the manager: /var/backups/shop (keep 14 days)',
    `age recipient: ${RECIPIENT.slice(0, 12)}... (public recipient of .sops.yaml)`,
    `files: data-${STAMP}.tgz.age, cache-${STAMP}.tgz.age`,
  ]);
  assert.deepEqual(result.data, { files: [], planned: [`data-${STAMP}.tgz.age`, `cache-${STAMP}.tgz.age`] });
  assert.equal(m.run.commands.length, 0);
  const withSwarm = await backupVolumes(m.ctx, config, { swarmState: true, execute: false }, m.deps);
  assert.ok(withSwarm.lines.includes('volumes: data, cache and the swarm state'));
  assert.equal(withSwarm.data.planned.at(-1), `swarm-state-${STAMP}.tgz.age`);
});

test('--execute streams each volume through age into a partial file and renames it only on success', async () => {
  const { config } = appWith();
  const m = manager();
  const result = await backupVolumes(m.ctx, config, { execute: true, swarmState: false, sshCmd: null }, m.deps);
  assert.equal(result.ok, true);
  assert.deepEqual(m.scripts, [volumeScript('data', 'shop-data'), volumeScript('cache', 'shop-cache')]);
  for (const script of m.scripts) {
    assert.doesNotMatch(script, /\.tgz(?!\.age)/u, 'no plaintext tarball path');
    assert.doesNotMatch(script, />/u, 'no redirection to a file');
  }
  assert.deepEqual(m.run.commands.map((entry) => entry.command.split(' ')[0]), ['command', 'bash', 'bash', 'find']);
  assert.equal(m.run.commands.at(-1).command, String.raw`find '/var/backups/shop' -type f \( -name '*.age' -o -name '*.age.partial' \) -mtime +14 -delete`);
  assert.deepEqual(result.data.files, [`data-${STAMP}.tgz.age`, `cache-${STAMP}.tgz.age`]);
  assert.ok(result.lines.includes(`ok    data-${STAMP}.tgz.age`));
  assert.ok(result.lines.includes('ok    removed backups older than 14 days'));
  assert.ok(result.lines.some((line) => line.includes('copy them to storage in another failure domain')));
  assert.ok(result.lines.some((line) => line.includes('restore proof')));
});

test('--swarm-state adds the swarm archive and says it is not a database backup', async () => {
  const { config } = appWith();
  const m = manager();
  const result = await backupVolumes(m.ctx, config, { execute: true, swarmState: true }, m.deps);
  assert.equal(m.scripts.length, 3);
  assert.ok(m.scripts[2].includes("sudo tar czf - -C /var/lib/docker swarm | age -r '" + RECIPIENT + "'"));
  assert.ok(m.scripts[2].includes(`/var/backups/shop/swarm-state-${STAMP}.tgz.age.partial`));
  assert.ok(result.data.files.includes(`swarm-state-${STAMP}.tgz.age`));
  assert.ok(result.lines.some((line) => line.includes('not a database backup')));
});

test('the backup directory defaults to /var/backups/<stack> and the stamp is UTC', async () => {
  const { config } = appWith({ deploy: { backup: { image: IMAGE, volumes: [{ name: 'data', volume: 'shop-data' }] } } });
  const m = manager();
  const result = await backupVolumes({ ...m.ctx, now: () => Date.UTC(2026, 0, 2, 3, 4, 5) }, config, { execute: true }, m.deps);
  assert.equal(result.ok, true);
  assert.ok(m.scripts[0].includes("mkdir -p '/var/backups/shop'"));
  assert.ok(m.scripts[0].includes('data-20260102-030405.tgz.age'));
  assert.ok(m.run.commands.at(-1).command.endsWith('-mtime +14 -delete'));
});

test('a failed archive fails the run, is reported and keeps the old backups', async () => {
  const { config } = appWith();
  const m = manager({ jobs: (script) => (script.includes('shop-cache') ? failed('tar: disk full\nmore') : ok()) });
  const result = await backupVolumes(m.ctx, config, { execute: true }, m.deps);
  assert.equal(result.ok, false);
  assert.deepEqual(result.data.files, [`data-${STAMP}.tgz.age`]);
  assert.ok(result.lines.includes(`FAIL  cache-${STAMP}.tgz.age: tar: disk full`));
  assert.ok(result.lines.includes('old backups were kept because this run did not finish'));
  assert.equal(m.run.commands.some((entry) => entry.command.startsWith('find')), false);
});

test('backup refuses when age is not installed on the manager and runs no archive', async () => {
  const { config } = appWith();
  const m = manager({ age: () => failed('') });
  await assert.rejects(backupVolumes(m.ctx, config, { execute: true }, m.deps), (error) => error.code === 'STACK_BACKUP_NO_AGE' && error.exit === 2);
  assert.equal(m.scripts.length, 0);
});

test('a failing retention sweep is a failure with exit 1', async () => {
  const { config } = appWith();
  const m = manager({ find: () => failed('find: permission denied') });
  await assert.rejects(backupVolumes(m.ctx, config, { execute: true }, m.deps), (error) => error.code === 'STACK_BACKUP_PRUNE' && error.exit === 1 && /permission denied/u.test(error.message));
});

test('the notes of the transport lead the output and the default transport is the ssh alias', async () => {
  const { config } = appWith();
  const m = manager();
  const noted = Object.assign((command) => m.run(command), { notes: ['owner session note'] });
  const result = await backupVolumes(m.ctx, config, { execute: true }, { ssh: noted });
  assert.equal(result.lines[0], 'owner session note');
  let route;
  const host = fakeHost({ overrides: { ssh: (args) => route(args.at(-1)) } });
  route = fakeRunner(host, { 'command -v age': () => ok(), 'bash -c': () => ok(), 'find ': () => ok() });
  const viaAlias = await backupVolumes(host.ctx({ now: () => NOW }), config, { execute: true });
  assert.equal(viaAlias.ok, true);
  assert.equal(host.calls[0].args.at(-2), 'vps');
});
