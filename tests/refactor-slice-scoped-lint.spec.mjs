import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { parseYaml } from '../engine/yaml.mjs';
import { withRepositoryAllLintLock } from '../scripts/checks/check-scoped-lint.mjs';

const op = parseYaml(fs.readFileSync(new URL('../modules/ops/ops/code.refactor.yaml', import.meta.url), 'utf8'));
const before = op.steps[0].action.en;
const after = op.steps[2].action.en;
const parity = op.proofs.find(proof => proof.id === 'regression-parity').requirement.en;

test('a cut slice measures its owned paths against its admission commit before and after', () => {
  assert.match(before, /context\.cut[\s\S]*?check-scoped-lint\.mjs[\s\S]*?--base <[^>]*admission commit[^>]*> -- <owned paths>/);
  assert.match(after, /SAME check-scoped-lint\.mjs[\s\S]*?--base[\s\S]*?slice\.status/);
  assert.match(parity, /scoped[\s\S]*?slice\.status[\s\S]*?new findings/i);
  assert.match(parity, /missing, different or narrowed check/);
});

test('the repo-wide lint run belongs to the ordinal that closes the cut set; uncut refactors retain all', () => {
  assert.match(before, /without context\.cut[\s\S]*?check-scoped-lint\.mjs[\s\S]*?--all/i);
  assert.match(after, /closes the (?:cut )?set[\s\S]*?check-scoped-lint\.mjs[\s\S]*?--all/);
  assert.match(parity, /full-regression-final[\s\S]*?check-scoped-lint\.mjs[\s\S]*?--all/);
  assert.match(op.policy.cutSetAuthority.permits, /CLOSES the set/);
});

test('two repo-wide checker processes enter one repository root in sequence', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-all-lint-lock-'));
  const events = path.join(root, 'events.txt');
  const checker = new URL('../scripts/checks/check-scoped-lint.mjs', import.meta.url).href;
  const script = `import fs from 'node:fs'; import {withRepositoryAllLintLock} from ${JSON.stringify(checker)};
    await withRepositoryAllLintLock(process.argv[1], async () => {
      fs.appendFileSync(process.argv[2], 'start\\n');
      await new Promise(resolve => setTimeout(resolve, 150));
      fs.appendFileSync(process.argv[2], 'end\\n');
    });`;
  const child = () => new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, ['--input-type=module', '-e', script, root, events], { windowsHide: true });
    let stderr = '';
    proc.stderr.on('data', chunk => { stderr += chunk; });
    proc.on('error', reject);
    proc.on('close', code => code === 0 ? resolve() : reject(Error(`checker child exited ${code}: ${stderr}`)));
  });
  try {
    await Promise.all([child(), child()]);
    assert.deepEqual(fs.readFileSync(events, 'utf8').trim().split(/\r?\n/), ['start', 'end', 'start', 'end']);
    assert.equal(fs.existsSync(path.join(root, '.starciwork', 'check-scoped-lint-all.lock')), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('a dead checker lock does not strand later repo-wide runs', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-stale-lint-lock-'));
  const state = path.join(root, '.starciwork');
  const lock = path.join(state, 'check-scoped-lint-all.lock');
  try {
    fs.mkdirSync(state);
    fs.writeFileSync(lock, JSON.stringify({ pid: 999999999, token: 'dead' }));
    const old = new Date(Date.now() - 10000);
    fs.utimesSync(lock, old, old);
    assert.equal(await withRepositoryAllLintLock(root, async () => 'measured'), 'measured');
    assert.equal(fs.existsSync(lock), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
