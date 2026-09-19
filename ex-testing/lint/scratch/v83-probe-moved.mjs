// v8-3 scratch: reproduce the moved-directory fixture and dump what each git listing actually returns.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const TMP = path.join(path.parse(process.cwd()).root, 'starci-tmp');
const dir = path.join(TMP, `probe-moved-${process.pid}`);
fs.rmSync(dir, {recursive: true, force: true});
fs.mkdirSync(path.join(dir, '.starciwork', 'features', 'f', 'br'), {recursive: true});
const write = (rel, text) => {
  const file = path.join(dir, '.starciwork', ...rel.split('/'));
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, text, 'utf8');
};
const revOne = 'schema: work/business-rule\nid: br.f.a\ntitle: t\nstate: todo\n'
  + 'trigger: The owner opens the list.\nstatements:\n  - A completed task is never reopened.\n'
  + 'change: {rev: 1, kind: initial, at: 2026-09-18T00:00:00.000Z}\n';
const revTwo = 'schema: work/business-rule\nid: br.f.a\ntitle: t\nstate: todo\n'
  + 'trigger: The owner opens the list.\nstatements:\n  - The owner may reopen a completed task.\n'
  + 'change:\n  rev: 2\n  kind: breaking\n  at: 2026-09-19T00:00:00.000Z\n'
  + '  withdraws: ["A completed task is never reopened."]\n';
const gitRun = args => {
  const run = spawnSync('git', ['-c', 'user.name=f', '-c', 'user.email=f@e', '-c', 'commit.gpgsign=false', ...args],
    {cwd: dir, encoding: 'utf8'});
  if (run.status !== 0) console.log(`git ${args.join(' ')} -> ${run.status} ${run.stderr.trim()}`);
  return run.stdout ?? '';
};
write('index.yaml', 'schema: work/catalog\nid: fixture\nfeatures: []\n');
write('features/f/br/a/index.yaml', revOne);
gitRun(['init', '-q', '--initial-branch=main']);
gitRun(['add', '-A']);
gitRun(['commit', '-q', '-m', 'rev 1 at the old path']);
fs.mkdirSync(path.join(dir, '.starciwork', 'features', 'f', 'br', 'kept'), {recursive: true});
gitRun(['mv', '.starciwork/features/f/br/a/index.yaml', '.starciwork/features/f/br/kept/index.yaml']);
write('features/f/br/kept/index.yaml', revTwo);
gitRun(['add', '-A']);
gitRun(['commit', '-q', '-m', 'rev 2, moved directory']);

const newPath = '.starciwork/features/f/br/kept/index.yaml';
console.log('=== raw bulk log (tree pathspec, --first-parent --name-status -z) ===');
const bulk = gitRun(['log', '--first-parent', '--format=\x1f%H', '--name-status', '-z', '-n', '50', '--', '.starciwork']);
console.log(JSON.stringify(bulk).slice(0, 700));
console.log('\n=== raw follow log (path pathspec, --follow --name-status -z) ===');
const follow = gitRun(['log', '--format=\x1f%H', '--name-status', '-z', '--follow', '-n', '50', '--', newPath]);
console.log(JSON.stringify(follow).slice(0, 900));
console.log('\n=== follow without --name-status ===');
console.log(JSON.stringify(gitRun(['log', '--format=%h %s', '--name-status', '--follow', '-n', '50', '--', newPath])));
