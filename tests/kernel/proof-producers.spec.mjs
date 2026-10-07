// A done report is refused while its op's mechanism proofs cannot be satisfied (the producer command missing from
// report.checks, its document not attached), and the settler tells an attached digest with no observed run from an absent one.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { proofsOwedByReport } from '../../scripts/kernel/proof-producers.mjs';
import { judgeJobProofs } from '../../scripts/kernel/mechanism-proofs.mjs';
import { greenDocGate, greenReadDigest } from '../helpers/sonar-scan.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const READ = 'starci gate read --root D:/work/app --touch .starciwork/features/a/index.yaml --out D:/tmp/starci-job-scratch/x/read-digest.json';
const check = (command) => ({ name: 'c', command, exitCode: 0 });
const report = (...commands) => ({ outcome: 'done', checks: commands.map(check) });
const dir = (t) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-proof-producers-')); t.after(() => fs.rmSync(d, { recursive: true, force: true })); return d; };
const attach = (d, name, doc) => { const abs = path.join(d, name); fs.writeFileSync(abs, JSON.stringify(doc)); return { abs, name }; };
const owed = (extra) => proofsOwedByReport({ op: 'scope.define', skillRoot: ROOT, ...extra });

test('the audited scope.define report (digest attached, no gate read in report.checks) is refused at report time with the command to run', (t) => {
  const files = [attach(dir(t), 'read-digest.json', greenReadDigest())];
  const rows = owed({ report: report('starci runtime validate .starciwork --json --strict'), files });
  assert.deepEqual(rows.map((r) => [r.proof, r.code]), [['read-knowledge', 'report-proof-producer-missing']]);
  assert.match(rows[0].detail, /starci gate read --root/);
  assert.match(rows[0].detail, /List that command as a report check/);
});

test('the right flow passes: READ listed as a check, its digest attached', (t) => {
  const files = [attach(dir(t), 'read-digest.json', greenReadDigest())];
  assert.deepEqual(owed({ report: report(READ, 'starci runtime validate .starciwork --json --strict'), files }), []);
});

test('a listed producer without its attached document is refused as a missing document, not a missing producer', (t) => {
  const rows = owed({ report: report(READ), files: [attach(dir(t), 'other.json', { schema: 'x' })] });
  assert.deepEqual(rows.map((r) => r.code), ['report-proof-document-missing']);
});

test('a shell-wrapped or placeholder READ command is no producer the runtime can re-run', (t) => {
  const files = [attach(dir(t), 'read-digest.json', greenReadDigest())];
  for (const command of ['starci gate read --root <app> --out $STARCI_JOB_SCRATCH/read-digest.json', 'starci gate read --root app | tee x']) {
    assert.equal(owed({ report: report(command), files })[0]?.code, 'report-proof-producer-missing', command);
  }
});

test('only a done report owes proofs; an op without proofs owes none', (t) => {
  const files = [attach(dir(t), 'read-digest.json', greenReadDigest())];
  assert.deepEqual(owed({ report: { outcome: 'blocked', checks: [] }, files }), []);
  assert.deepEqual(proofsOwedByReport({ op: 'goal.revise', report: report(), files, skillRoot: ROOT }), []);
});

test('a document gate is a producer only with --scope docs, and each owed proof is judged on its own', (t) => {
  const d = dir(t);
  const files = [attach(d, 'read-digest.json', greenReadDigest()), attach(d, 'doc-gate.json', greenDocGate())];
  const codeGate = 'starci gate run --root D:/work/app --changed a.ts';
  const docGate = 'starci gate run --scope docs --tree D:/work/app/.starciwork';
  const op = 'docs.author';
  assert.deepEqual(proofsOwedByReport({ op, report: report(READ, codeGate), files, skillRoot: ROOT }).map((r) => r.proof), ['doc-gate']);
  assert.deepEqual(proofsOwedByReport({ op, report: report(READ, docGate), files, skillRoot: ROOT }), []);
});

test('settle: a digest attached without an observed run says so and what satisfies it, apart from an absent digest', (t) => {
  const d = dir(t);
  const attached = [attach(d, 'read-digest.json', greenReadDigest())];
  const context = { admittedAt: 0, reportAt: null, roots: [], readRefs: [], selected: { contract: { reads: [] } } };
  const unobserved = judgeJobProofs({ op: 'scope.define', files: attached, context, observations: [] });
  const absent = judgeJobProofs({ op: 'scope.define', files: [], context, observations: [] });
  assert.equal(unobserved.judged.code, 'op-read-digest-missing');
  assert.equal(absent.judged.code, 'op-read-digest-missing');
  assert.match(unobserved.judged.detail, /is attached but no observed native run/);
  assert.match(unobserved.judged.detail, /report\.checks/);
  assert.doesNotMatch(absent.judged.detail, /is attached but no observed native run/);
  assert.match(absent.judged.detail, /no READ digest/);
});
