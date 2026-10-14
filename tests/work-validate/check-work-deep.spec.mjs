import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {runTimeOf} from '../../scripts/work/validate/check-work-deep.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

test('a work/evidence@1 run object is read by its minted id, never joined as a runs/ directory', () => {
  const run = {id: '20260919T155312Z-5c10a673', outcome: 'pass', result: {name: 'result.md', sha256: 'a'.repeat(64)}, screens: [], videos: []};
  assert.equal(runTimeOf(run)?.toISOString(), '2026-09-19T15:53:12.000Z');
  assert.equal(runTimeOf(undefined), null);
  assert.equal(runTimeOf('runs/20260919T155312Z-5c10a673'), null, 'a path string is not the run object');
  assert.equal(runTimeOf({id: 'not-a-run-id'}), null);
});

test('check-work-deep.mjs over the shipped examples reports findings and never crashes on a run object', () => {
  const run = spawnSync(process.execPath, ['scripts/work/validate/check-work-deep.mjs'], {cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 300000});
  assert.ok(run.status === 0 || run.status === 1, `exit ${run.status}\n${run.stderr}`);
  assert.doesNotMatch(run.stderr, /TypeError|ERR_INVALID_ARG_TYPE/);
  assert.match(run.stdout, /\d+ refused, \d+ suspect, \d+ info/);
});

/** An app whose .starciwork holds three records: a fresh evidence, a stale evidence and a requiresProof, each naming a dead spec. */
function proofTree(t) {
  const app = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-work-deep-'));
  t.after(() => fs.rmSync(app, {recursive: true, force: true}));
  const write = (rel, text) => { fs.mkdirSync(path.dirname(path.join(app, rel)), {recursive: true}); fs.writeFileSync(path.join(app, rel), text); };
  write('package.json', JSON.stringify({name: 'app', private: true, scripts: {test: 'cd be && jest'}}));
  write('be/src/live.service.spec.ts', 'it("x", () => {});\n');
  write('.starciwork/index.yaml', 'schema: work/index@1\n');
  write('.starciwork/workspace.yaml', 'repositories:\n  - {role: be, name: be}\n');
  const record = (slug, extra = '') => write(`.starciwork/features/f/fr/${slug}/index.yaml`,
    `schema: work/functional-requirement@1\nid: fr.f.${slug}\nstate: done\n${extra}`);
  const evidence = (slug, stale) => write(`.starciwork/features/f/fr/${slug}/evidence.yaml`, [
    'schema: work/evidence@1', `record: fr.f.${slug}`, ...(stale ? ['stale: true'] : []),
    'assertions:', '  - id: a', '    command: npx jest be/src/gone.service.spec.ts', '',
  ].join('\n'));
  record('fresh'); evidence('fresh', false);
  record('stale'); evidence('stale', true);
  record('required', 'requiresProof:\n  unit:\n    command: npx jest be/src/deleted.service.spec.ts\n');
  record('alive', 'requiresProof:\n  unit:\n    command: npx jest be/src/live.service.spec.ts\n');
  return path.join(app, '.starciwork');
}

test('PROOF_COMMAND_DEAD judges only the commands that must run now: requiresProof and fresh evidence, never stale evidence', t => {
  const run = spawnSync(process.execPath, ['scripts/work/validate/check-work-deep.mjs', '--tree', proofTree(t)], {cwd: ROOT, encoding: 'utf8', windowsHide: true});
  const dead = run.stdout.split('\n').filter(l => l.startsWith('REFUSE') && l.includes('[PROOF_COMMAND_DEAD]'));
  assert.ok(dead.some(l => l.includes('/fr/fresh/evidence.yaml') && l.includes('gone.service.spec.ts')), run.stdout);
  assert.ok(!dead.some(l => l.includes('/fr/stale/')), `stale evidence is history, not refused:\n${run.stdout}`);
  assert.ok(dead.some(l => l.includes('/fr/required/index.yaml') && l.includes('requiresProof.unit')), run.stdout);
  assert.ok(!dead.some(l => l.includes('/fr/alive/')), run.stdout);
  assert.equal(run.status, 1, run.stderr);
});

function liteTree(t, { brand = true } = {}) {
  const app = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-work-deep-lite-'));
  t.after(() => fs.rmSync(app, {recursive: true, force: true}));
  const write = (rel, body) => { const file = path.join(app, rel); fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, body); };
  write('hfs.json', JSON.stringify({kind: 'app', edition: 'lite'}));
  if (brand) write('.starciwork/brand/index.yaml', 'schema: work/brand@1\nid: brand\nstate: todo\n');
  return {app, workRoot: path.join(app, '.starciwork'), write};
}

test('lite deep checks accept workspace plus brand without a catalog and skip retired records and baselines', t => {
  const {workRoot, write} = liteTree(t);
  write('.starciwork/workspace.yaml', 'schema: work/workspace@1\nid: example\nproject: example\nrepositories:\n  - {role: fe, name: fe}\n');
  for (const rel of ['index.yaml', 'shell/index.yaml', 'features/retired/index.yaml'])
    write(`.starciwork/${rel}`, 'retired: [unreadable\n');
  write('.starciwork/_derived/deep-baseline.json', 'retired baseline is not JSON');
  write('.starciwork/features/retired/evidence.yaml', 'schema: work/evidence@1\nrecord: brand\nassertions:\n  - command: npm run gone\n');
  const run = spawnSync(process.execPath, ['scripts/work/validate/check-work-deep.mjs', '--tree', workRoot], {cwd: ROOT, encoding: 'utf8', windowsHide: true});
  assert.equal(run.status, 0, run.stderr + run.stdout);
  assert.match(run.stdout, /0 refused, 0 suspect, 0 info/);
  assert.doesNotMatch(run.stdout, /CATALOG_DRIFT|NO_BASELINE|PROOF_COMMAND_DEAD/);
});

test('lite deep baseline writes refuse before creating _derived', t => {
  const {workRoot} = liteTree(t);
  const run = spawnSync(process.execPath, ['scripts/work/validate/check-work-deep.mjs', '--tree', workRoot, '--write-baseline'], {cwd: ROOT, encoding: 'utf8', windowsHide: true});
  assert.equal(run.status, 1, run.stderr + run.stdout);
  assert.match(run.stdout, /lite \.starciwork holds only workspace\.yaml and brand\//);
  assert.match(run.stdout, /\[HFS_STARCIWORK_LITE_FORBIDDEN\]/);
  assert.equal(fs.existsSync(path.join(workRoot, '_derived')), false);
});

test('lite deep checks accept an absent optional Work tree', t => {
  const {workRoot} = liteTree(t, {brand: false});
  const run = spawnSync(process.execPath, ['scripts/work/validate/check-work-deep.mjs', '--tree', workRoot], {cwd: ROOT, encoding: 'utf8', windowsHide: true});
  assert.equal(run.status, 0, run.stderr + run.stdout);
  assert.equal(fs.existsSync(workRoot), false);
});
