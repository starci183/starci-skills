// evidence-host-path.spec.mjs - EVIDENCE_HOST_PATH, the settle refusal of scripts/kernel/job-artifacts.mjs evidenceHostPathGate:
// Work evidence that still names a host path is refused (the op fixes it), normalized evidence passes. The matcher is
// scripts/lib/host-path.mjs, the same one the RT_ABSOLUTE_PATH rule uses. Fixtures are built from the temp dir.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EVIDENCE_HOST_PATH, evidenceHostPathGate } from '../../scripts/kernel/job-artifacts.mjs';
import { hostPathHits, normalizeHostPaths } from '../../scripts/lib/host-path.mjs';
import { generateEvidence } from '../../scripts/example/example-evidence.mjs';
import { winPath } from '../fixtures/win-path.mjs';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-evidence-path-'));
test.after(() => fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }));

const BS = String.fromCharCode(92);
const ROOT = winPath('C', '');
const HOST = `${ROOT}Users${BS}someone${BS}work`; // a host location spelled the Windows way
const write = (rel, text) => { const file = path.join(TMP, ...rel.split('/')); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); return file; };
const filesOf = (...abs) => abs.map((a) => ({ abs: a, source: 'named' }));

test('EVIDENCE_HOST_PATH: evidence with a host path in its command is refused, naming the file and line', () => {
  const evidence = write('.starciwork/features/f/br/x/evidence.yaml', `schema: work/evidence@1\nassertions:\n  - id: ac.x\n    command: ${ROOT}PROGRA~1${BS}Git${BS}bin${BS}bash.exe -c "echo ok"\n    exit: 0\n`);
  const gate = evidenceHostPathGate({ files: filesOf(evidence) });
  assert.equal(gate.code, EVIDENCE_HOST_PATH);
  assert.equal(gate.detail.files, 1);
  assert.match(gate.missing[0], /evidence\.yaml:4 /);
});

test('EVIDENCE_HOST_PATH: a draw prompt and a visual review that read from a host path are refused', () => {
  const prompt = write('.starciwork/features/f/ui/a/assets/a.prompt.txt', `Knowledge read from ${HOST}${BS}knowledge${BS}x.yaml\n`);
  const review = write('.starciwork/features/f/ui/a/assets/visual-review.md', `retained from ${ROOT.split(BS).join('/')}lanes/wt/x.png\n`);
  const gate = evidenceHostPathGate({ files: filesOf(prompt, review) });
  assert.equal(gate.code, EVIDENCE_HOST_PATH);
  assert.equal(gate.detail.files, 2);
});

test('EVIDENCE_HOST_PATH: evidence normalized by the one normalizer settles (no refusal)', () => {
  const raw = `command: ${ROOT}PROGRA~1${BS}Git${BS}bin${BS}bash.exe -c "echo ${path.join(TMP, 'out')}"\nnote: read ${HOST}${BS}k.yaml\n`;
  assert.ok(hostPathHits(raw).length > 0, 'the fixture holds host paths before normalizing');
  const evidence = write('.starciwork/features/g/br/y/evidence.yaml', normalizeHostPaths(raw, { tmp: TMP, home: winPath('C', 'Users', 'someone') }));
  assert.equal(evidenceHostPathGate({ files: filesOf(evidence) }), null);
});

test('EVIDENCE_HOST_PATH: only text evidence under a .starciwork tree is read; other files and unreadable ones are ignored', () => {
  const outside = write('notes/plain.md', `${HOST}${BS}x\n`);
  const binary = write('.starciwork/features/h/assets/shot.png', `${HOST}${BS}x`);
  const missing = path.join(TMP, '.starciwork', 'gone.yaml');
  assert.equal(evidenceHostPathGate({ files: [...filesOf(outside, binary, missing), { source: 'recording' }] }), null);
  assert.equal(evidenceHostPathGate({ files: [] }), null);
});

test('EVIDENCE_HOST_PATH: the evidence recorder writes the command and observation without the host shell prefix', () => {
  const work = path.join(TMP, 'rec', '.starciwork');
  fs.mkdirSync(path.join(work, 'features', 'f', 'fr', 'thing'), { recursive: true });
  fs.writeFileSync(path.join(work, 'features', 'f', 'fr', 'thing', 'index.yaml'), 'schema: work/functional-requirement@1\nid: fr.f.thing\ntitle: t\nstate: todo\n');
  const command = `${path.join(TMP, 'rec', 'tool.cmd')} && exit 0`;
  const { evidence } = generateEvidence({ workRoot: work, recordId: 'fr.f.thing', cwd: path.join(TMP, 'rec'), assertions: [{ id: 'ac.f.thing.ok', command: process.platform === 'win32' ? command : 'true' }] });
  const [assertion] = evidence.assertions;
  assert.equal(hostPathHits(`${assertion.command}\n${assertion.observation}`).length, 0);
  if (process.platform === 'win32') assert.match(assertion.command, /^tool\.cmd && exit 0$/);
});
