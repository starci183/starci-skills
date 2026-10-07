import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { mkdtemp } from '../helpers/tmpdir.mjs';
import { OWNER_FILE, reclaimStaleStack, removeProjectStack, stackIsStale } from '../helpers/supabase-project-stack.mjs';

/** A docker double holding containers [{ project, name, workdir }]; records every removal. */
function fakeDocker(containers) {
  const calls = [];
  const run = (args) => {
    calls.push(args.join(' '));
    const filter = args.find((arg) => arg.startsWith('label=com.supabase.cli.project='))?.split('=').pop();
    if (args[0] === 'ps') return { stdout: containers.filter((c) => c.project === filter).map((c) => `${c.name}\t${c.workdir}`).join('\n') };
    if (args[0] === 'rm') { const at = containers.findIndex((c) => c.name === args.at(-1)); if (at >= 0) containers.splice(at, 1); return { stdout: '' }; }
    if (args[0] === 'volume' || args[0] === 'network') return { stdout: args[1] === 'ls' ? `${args[0]}_${filter}` : '' };
    return { stdout: '' };
  };
  return { run, calls };
}

test('a stack whose working directory is gone, or whose owner process is dead, is stale; a live owner or a bare directory is not', (t) => {
  const dir = mkdtemp(t, 'starci-stack-stale-');
  const workdir = path.join(dir, 'litedemo');
  assert.equal(stackIsStale(workdir), true, 'no working directory');
  fs.mkdirSync(workdir);
  assert.equal(stackIsStale(workdir), false, 'a directory nobody claims is not ours to remove');
  fs.writeFileSync(path.join(dir, OWNER_FILE), String(process.pid));
  assert.equal(stackIsStale(workdir), false, 'the owner is this live process');
  fs.writeFileSync(path.join(dir, OWNER_FILE), '2147483646');
  assert.equal(stackIsStale(workdir), true, 'the owner process is dead');
});

test('reclaim removes the project own stale stack with its volumes and networks, and nothing of another project', (t) => {
  const containers = [
    { project: 'litedemo', name: 'supabase_kong_litedemo', workdir: path.join(mkdtemp(t, 'starci-stack-gone-'), 'gone', 'litedemo') },
    { project: 'litedemo', name: 'supabase_db_litedemo', workdir: path.join(mkdtemp(t, 'starci-stack-gone-'), 'gone', 'litedemo') },
    { project: 'nivo-lite', name: 'supabase_kong_nivo-lite', workdir: 'D:/work/nivo' },
  ];
  const docker = fakeDocker(containers);
  const removed = reclaimStaleStack('litedemo', { run: docker.run });
  assert.deepEqual(removed, ['supabase_kong_litedemo', 'supabase_db_litedemo', 'volume_litedemo', 'network_litedemo']);
  assert.deepEqual(containers.map((c) => c.name), ['supabase_kong_nivo-lite']);
  assert.ok(docker.calls.every((call) => !call.includes('nivo-lite') || call.startsWith('ps ')), 'no command names another project');
});

test('reclaim leaves a stack whose working directory is alive, and a stack of no project of its own', (t) => {
  const live = mkdtemp(t, 'starci-stack-live-');
  const containers = [{ project: 'litedemo', name: 'supabase_kong_litedemo', workdir: path.join(live, 'litedemo') }];
  fs.mkdirSync(path.join(live, 'litedemo'));
  const docker = fakeDocker(containers);
  assert.deepEqual(reclaimStaleStack('litedemo', { run: docker.run }), []);
  assert.equal(containers.length, 1, 'a live run is never torn down by another');
  assert.deepEqual(reclaimStaleStack('absent', { run: docker.run }), []);
});

test('teardown selection removes only the containers it selects and keeps the volumes while another container remains', () => {
  const containers = [
    { project: 'litedemo', name: 'mine', workdir: 'C:/t/mine/litedemo' },
    { project: 'litedemo', name: 'other-run', workdir: 'C:/t/other/litedemo' },
  ];
  const docker = fakeDocker(containers);
  const removed = removeProjectStack('litedemo', { run: docker.run, select: (c) => c.workdir.startsWith('C:/t/mine') });
  assert.deepEqual(removed, ['mine']);
  assert.deepEqual(containers.map((c) => c.name), ['other-run']);
});
