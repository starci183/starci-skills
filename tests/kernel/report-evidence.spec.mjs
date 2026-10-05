import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as reportEvidence from '../../scripts/kernel/verbs/shared/report-evidence.mjs';
const { stageReportEvidence, readReportEnvelope } = reportEvidence;

const scratch = t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-attachment-inventory-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
};

test('2001 attachments fail before blob staging and every original remains recoverable', t => {
  const root = scratch(t), dir = path.join(root, 'attachments'); fs.mkdirSync(dir);
  for (let i = 0; i < 2001; i += 1) fs.writeFileSync(path.join(dir, `${i}.txt`), 'fixture');
  assert.throws(() => stageReportEvidence({ report: {}, scratch: root, attach: [dir] }), error => error.code === 'report-attachment-invalid');
  assert.equal(fs.readdirSync(dir).length, 2001);
});

test('an unreadable nested attachment inventory fails visibly and retains scratch', t => {
  const root = scratch(t), dir = path.join(root, 'attachments'), nested = path.join(dir, 'nested'); fs.mkdirSync(nested, { recursive: true });
  fs.writeFileSync(path.join(nested, 'proof.txt'), 'retained');
  const read = fs.readdirSync;
  t.mock.method(fs, 'readdirSync', (target, ...args) => { if (target === nested) throw Object.assign(new Error('fixture access denied'), { code: 'EACCES' }); return read(target, ...args); });
  assert.throws(() => stageReportEvidence({ report: {}, scratch: root, attach: [dir] }), error => error.code === 'report-attachment-missing');
  assert.equal(fs.readFileSync(path.join(nested, 'proof.txt'), 'utf8'), 'retained');
});

test('sparse oversized report and attachment files are refused before whole-payload reads', t => {
  const root = scratch(t), report = path.join(root, 'report.json'), media = path.join(root, 'video.mp4');
  fs.writeFileSync(report, '{}'); fs.truncateSync(report, 5 * 1024 * 1024);
  fs.writeFileSync(media, ''); fs.truncateSync(media, 257 * 1024 * 1024);
  assert.throws(() => readReportEnvelope(report), error => error.code === 'report-invalid');
  assert.throws(() => stageReportEvidence({ report: {}, scratch: root, attach: [media] }), error => error.code === 'report-attachment-invalid');
  assert.equal(fs.statSync(media).size, 257 * 1024 * 1024);
});

test('text attachments have their own byte budget and growth during a read retains the source', t => {
  const root = scratch(t), text = path.join(root, 'transcript.txt'), report = path.join(root, 'report.json');
  fs.writeFileSync(text, ''); fs.truncateSync(text, 17 * 1024 * 1024);
  assert.throws(() => stageReportEvidence({ report: {}, scratch: root, attach: [text] }), error => error.code === 'report-attachment-invalid');
  fs.writeFileSync(report, '{}');
  const read = fs.readSync;
  let grew = false;
  t.mock.method(fs, 'readSync', (...args) => {
    const n = read(...args);
    if (!grew) { grew = true; fs.appendFileSync(report, ' grew-after-inventory'); }
    return n;
  });
  assert.throws(() => readReportEnvelope(report), error => error.code === 'report-invalid');
  assert.equal(fs.readFileSync(report, 'utf8'), '{} grew-after-inventory');
});
