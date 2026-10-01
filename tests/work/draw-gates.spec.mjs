// The drawer's one "run every gate" command (scripts/work/draw-gates.mjs, lane op-draw): the gates api settle and api
// check judge an interface.draw pass by, their report.checks entries with `failing` files, and the owner gate apart.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GATES_SCHEMA, drawGates, refusalsOf } from '../../scripts/work/draw-gates.mjs';

const tmp = (t) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-draw-gates-')); t.after(() => fs.rmSync(d, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 })); return d; };
const write = (root, rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); return path.join(root, rel); };

test('validate refusal lines become failing files and codes', () => {
  const cwd = path.join(os.tmpdir(), 'skill');
  const repo = path.join(os.tmpdir(), 'repo');
  const line = `${path.relative(cwd, path.join(repo, '.starciwork/features/login/ui/session-ending/index.yaml'))}: ui.shapes lists X#pending, which is the data status loading [DATA_STATUS_DRAWN]`;
  assert.deepEqual(refusalsOf([line, 'no path here'], cwd, repo), [
    { file: '.starciwork/features/login/ui/session-ending/index.yaml', code: 'DATA_STATUS_DRAWN', message: 'ui.shapes lists X#pending, which is the data status loading' },
    { file: null, code: null, message: 'no path here' },
  ]);
});

test('every gate runs; a red gate names its failing files; the owner gate is reported apart, never red', async (t) => {
  const repo = tmp(t);
  const uiRel = '.starciwork/features/login/ui';
  write(repo, `${uiRel}/index.yaml`, JSON.stringify({ schema: 'work/ui-screen@1', id: 'ui.login', state: 'todo', surface: 'page', ui: { shapes: [{ base: 'SignInBase', state: 'ready' }] }, assets: [] }));
  const child = `${uiRel}/session-ending/index.yaml`;
  const runners = {
    validate: async () => ({ exitCode: 1, doc: { ok: false, refused: [`${path.relative(path.resolve(import.meta.dirname, '..', '..'), path.join(repo, child))}: data status [DATA_STATUS_DRAWN]`] } }),
    shell: async () => ({ exitCode: 0, doc: { ok: true, refused: [], findings: [] } }),
    metrics: async () => ({ findings: [], loops: [] }),
  };
  const r = await drawGates({ ui: path.join(repo, uiRel), repo, runners });
  assert.equal(r.schema, GATES_SCHEMA);
  assert.deepEqual(r.gates.map((g) => g.name), ['draw-acceptance', 'draw-metrics', 'validate-strict', 'shell-conformance', 'draw-layer', 'draw-loop']);
  const strict = r.checks.find((c) => c.name === 'validate-strict');
  assert.equal(strict.exitCode, 1);
  assert.deepEqual(strict.failing, [child], 'the child record is named so api check can attribute it (foreign)');
  assert.deepEqual(strict.codes, ['DATA_STATUS_DRAWN']);
  assert.equal(r.checks.find((c) => c.name === 'shell-conformance').exitCode, 0);
  assert.equal(r.ok, false);
  assert.match(r.next, /validate-strict/);
  // Each check is a valid report.checks entry: {name, command, exitCode, evidence} (+ codes, failing when red).
  for (const c of r.checks) { assert.equal(typeof c.name, 'string'); assert.ok(Number.isInteger(c.exitCode)); assert.equal(typeof c.command, 'string'); assert.equal(typeof c.evidence, 'string'); }
  // --no-remeasure skips the render.
  const quick = await drawGates({ ui: path.join(repo, uiRel), repo, runners, remeasure: false });
  assert.ok(!quick.gates.some((g) => g.name === 'draw-metrics'));
});
