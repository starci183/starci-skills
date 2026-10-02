import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { runRealTool } from '../../scripts/api/process/run-real-tool.mjs';
import { resolveRealTool } from '../../scripts/api/process/resolve-real-tool.mjs';
import { guardRaw } from '../../scripts/guards/raw-verb.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

const ctx = (positionals = ['git', 'status']) => ({ positionals, cwd: path.resolve('repo'), env: { PATH: 'fixture-path' } });

test('guardRaw allows a decision, runs the resolved absolute tool with the original args and returns its code', async () => {
  const calls = [];
  const result = await guardRaw(ctx(['git', 'status', '--short']), {
    shimDecision: async (input) => { calls.push(['decision', input]); return { role: 'worker', verdict: null }; },
    resolver: (program, options) => { calls.push(['resolve', program, options]); return path.resolve('real-bin', 'git'); },
    runner: (target, args, options) => { calls.push(['run', target, args, options]); return 19; },
  });
  assert.deepEqual(result, { code: 19 });
  assert.equal(calls[0][0], 'decision');
  assert.deepEqual(calls[0][1], { program: 'git', args: ['status', '--short'], cwd: ctx().cwd, env: ctx().env });
  assert.equal(calls[1][1], 'git');
  assert.deepEqual(calls[2].slice(1, 3), [path.resolve('real-bin', 'git'), ['status', '--short']]);
});

test('guardRaw prints the shared refusal lines, returns 2 and never resolves or runs a tool', async () => {
  let resolved = false;
  let ran = false;
  const verdict = { code: 'RIGHTS_RAW_TOOL', command: 'docker compose up' };
  const result = await guardRaw(ctx(['docker', 'compose', 'up']), {
    shimDecision: async () => ({ role: 'worker', verdict }),
    shimRefusalLines: (received) => {
      assert.equal(received, verdict);
      return ['RIGHTS_RAW_TOOL first', 'use: starci docker up'];
    },
    resolver: () => { resolved = true; },
    runner: () => { ran = true; },
  });
  assert.deepEqual(result, { code: 2, stderr: 'RIGHTS_RAW_TOOL first\nuse: starci docker up\n' });
  assert.equal(resolved, false);
  assert.equal(ran, false);
});

test('resolveRealTool skips the canonical shim directory and selects the next PATH file', (t) => {
  const base = mkdtemp(t, 'starci-real-tool-');
  const home = path.join(base, 'home');
  const shim = path.join(home, '.starci', 'bin');
  const real = path.join(base, 'real-bin');
  fs.mkdirSync(shim, { recursive: true });
  fs.mkdirSync(real);
  const platform = process.platform;
  const name = platform === 'win32' ? 'fixture-tool.cmd' : 'fixture-tool';
  fs.writeFileSync(path.join(shim, name), 'shim');
  fs.writeFileSync(path.join(real, name), 'real');
  const env = {
    PATH: [shim, real].join(path.delimiter),
    ...(platform === 'win32' ? { PATHEXT: '.CMD;.EXE;.BAT' } : {}),
  };
  assert.equal(resolveRealTool('fixture-tool', { env, home, platform }), path.resolve(real, name));
});

test('guardRaw returns 127 when the shim is the only PATH match', async (t) => {
  const base = mkdtemp(t, 'starci-real-tool-recursion-');
  const home = path.join(base, 'home');
  const shim = path.join(home, '.starci', 'bin');
  fs.mkdirSync(shim, { recursive: true });
  const platform = process.platform;
  const name = platform === 'win32' ? 'fixture-tool.cmd' : 'fixture-tool';
  fs.writeFileSync(path.join(shim, name), 'shim');
  let ran = false;
  const result = await guardRaw({ positionals: ['fixture-tool'], cwd: base, env: {
    PATH: shim, ...(platform === 'win32' ? { PATHEXT: '.CMD;.EXE;.BAT' } : {}),
  } }, {
    home,
    platform,
    shimDecision: async () => ({ role: 'worker', verdict: null }),
    runner: () => { ran = true; },
  });
  assert.deepEqual(result, { code: 127, stderr: 'starci: fixture-tool not found on PATH outside the shim\n' });
  assert.equal(ran, false);
});

test('runRealTool uses inherited stdio without a shell and routes Windows command scripts through cmd.exe', () => {
  const calls = [];
  const spawn = (command, args, options) => { calls.push({ command, args, options }); return { status: 23 }; };
  const comspec = path.resolve('system', 'cmd.exe');
  assert.equal(runRealTool(path.resolve('bin', 'git.exe'), ['status'], { platform: 'win32', spawn }), 23);
  assert.equal(calls[0].command, path.resolve('bin', 'git.exe'));
  assert.deepEqual(calls[0].args, ['status']);
  assert.equal(calls[0].options.stdio, 'inherit');
  assert.equal(calls[0].options.shell, false);
  assert.equal(calls[0].options.windowsVerbatimArguments, undefined);

  assert.equal(runRealTool(path.resolve('bin with spaces', 'npm.cmd'), ['run', 'x & y'], {
    platform: 'win32', spawn, comspec,
  }), 23);
  assert.equal(calls[1].command, comspec);
  assert.deepEqual(calls[1].args.slice(0, 3), ['/d', '/s', '/c']);
  assert.match(calls[1].args[3], /npm\.cmd/);
  assert.match(calls[1].args[3], /\^&/);
  assert.equal(calls[1].options.windowsVerbatimArguments, true);
});
