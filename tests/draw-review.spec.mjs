import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { parseYaml, stringifyYaml } from '../engine/yaml.mjs';
import { inspectLedger, ledgerFileFor, openLedger } from '../engine/ledger-db.mjs';
import { composeDirection } from '../scripts/work/compose-direction.mjs';
import { layoutTreeMain, lockupSourceOf, layoutSettlement, loadUiRecords, nodeById } from '../scripts/work/layout-tree.mjs';
import { blankImage, drawOver, encodePng } from '../scripts/work/png.mjs';
import { drawingAcceptance } from '../scripts/work/direction-part.mjs';
import { applyDrawReview, drawReviewMain, drawReviewQuestion, drawReviewStatus, drawReviewsOwed } from '../scripts/work/draw-review.mjs';
import { autoAcceptDecision } from '../scripts/kernel/ask-recommendation.mjs';
import { repeatedAnswerOf } from '../scripts/kernel/owner-answers.mjs';
import { buildProduct, layoutCapture, uiSkeleton } from './fixtures/layout-tree.mjs';

// mia inc-a4b5b1abdd90 (owner-gate inc-60e05a1c204c): brand.decide a7 could not crop the greenfield lockup. The
// planned layout ui.learning.app-layout was drawn (interface.draw passed) but stayed todo: with candidatesPerScreen 1
// interface.draw parked no owner ask, work-layout reserves done for the final reconciliation, and review.verify runs
// after a7 - nothing could ever accept the drawing. interface.draw now parks one draw-review ask of the drawn parts
// (desktop and mobile, light) for a drawing another leg waits on, and the owner's accept answer writes it done.
const ROOT = path.resolve(import.meta.dirname, '..');
const API = path.join(ROOT, 'scripts', 'kernel', 'api.mjs');
const SERVE = path.join(ROOT, 'scripts', 'kernel', 'serve-ask.mjs');
const APP = '/(app)';
const DESIGN = 'ui.home.app-layout';
const CHROME = [20, 40, 160, 255];
const MARK = [250, 200, 0, 255];
const Ajv2020 = (() => { const loaded = createRequire(path.join(ROOT, 'package.json'))('ajv/dist/2020.js'); return loaded?.default ?? loaded; })();
const validateUi = new Ajv2020({ strict: false, allErrors: true, logger: false }).compile(parseYaml(fs.readFileSync(path.join(ROOT, 'modules/schemas/work-ui-screen.schema.yaml'), 'utf8')));
const env = (() => { const e = { ...process.env, STARCI_CONNECTORS_OFF: '1' }; for (const k of ['ORCA_TERMINAL_HANDLE', 'STARCI_ROLE', 'STARCI_OP_JOB']) delete e[k]; return e; })();
const readTree = (p) => parseYaml(fs.readFileSync(path.join(p.work, 'shell', 'index.yaml'), 'utf8'));
const writeTree = (p, tree) => fs.writeFileSync(path.join(p.work, 'shell', 'index.yaml'), stringifyYaml(tree));
const readRecord = (dir) => parseYaml(fs.readFileSync(path.join(dir, 'index.yaml'), 'utf8'));

/** brand.decide a6 on a greenfield product: a planned tree whose visible layout /(app) is drawn by DESIGN. */
function greenfield(t) {
  const p = buildProduct(t, { files: {} });
  const planned = layoutTreeMain(['plan', '--work', p.work, '--node', APP, '--files', 'layout,page', '--design', DESIGN, '--write']);
  assert.equal(planned.exitCode, 0, planned.text);
  const tree = readTree(p);
  tree.breakpoints = [{ name: 'desktop', width: 40, height: 30 }, { name: 'mobile', width: 20, height: 30 }];
  tree.personas = [{ role: 'student', default: true, workspace: 'Mia', user: 'An Nguyen', currency: 'VND', dateFormat: 'dd/MM/yyyy' }];
  writeTree(p, tree);
  return { ...p, repo: path.dirname(p.work) };
}

/** interface.draw of the planned layout: its drawn parts at desktop and mobile light, composed, with a coverage map. */
function drawLayout(p, { mark = MARK } = {}) {
  const dir = path.join(p.work, 'features', 'home', 'ui', 'app-layout');
  fs.mkdirSync(path.join(dir, 'assets', 'directions'), { recursive: true });
  const prior = fs.existsSync(path.join(dir, 'index.yaml')) ? readRecord(dir) : null;
  const record = prior ?? uiSkeleton(DESIGN, {
    route: APP, surface: 'layout', shell: { ref: 'shell', rev: readTree(p).rev, layouts: [] },
    ui: { status: 'Proposed visual direction.', intent: 'Frame the student destinations around one page slot.', surfaces: [{ name: 'app-layout', route: APP, purpose: 'Frame the page slot.', actors: ['student'] }],
      states: [{ name: 'default', trigger: 'The student opens a route.', behavior: 'Show the chrome.' }],
      coverage: { scale: 'bounded', representativeScreens: ['app-layout'], map: [{ screen: 'app-layout', state: 'default', viewport: '40x30 desktop light', breakpoint: 'desktop', theme: 'light', components: ['TopBar'] }, { screen: 'app-layout', state: 'default', viewport: '20x30 mobile light', breakpoint: 'mobile', theme: 'light', components: ['TopBar', 'BottomNav'] }] },
      accessibility: ['One banner landmark.'], responsive: ['BottomNav below 48rem.'], observations: ['Proposed direction.'], gaps: [] },
  });
  fs.writeFileSync(path.join(dir, 'index.yaml'), stringifyYaml({ ...record, assets: [] }));
  const assets = [];
  for (const [bp, w, h, slot] of [['desktop', 40, 30, { x: 10, y: 6, width: 30, height: 24 }], ['mobile', 20, 30, { x: 0, y: 6, width: 20, height: 24 }]]) {
    const drawing = layoutCapture(w, h, slot, CHROME);
    drawOver(drawing, blankImage(6, 4, mark), 1, 1);
    const content = path.join(dir, 'assets', 'directions', `default--page--${bp}--light.content.png`);
    fs.writeFileSync(content, encodePng(drawing));
    fs.writeFileSync(content.replace(/\.png$/, '.prompt.txt'), 'App layout chrome. Product locale: en.');
    const result = composeDirection({ uiDir: dir, content, breakpoint: bp, theme: 'light' });
    assert.equal(result.ok, true, result.error);
    assets.push({ ...result.contentAsset, generation: { tool: 'image_gen.imagegen', promptPath: `assets/directions/default--page--${bp}--light.content.prompt.txt`, mode: 'slot' } }, { ...result.asset, selected: true });
  }
  fs.writeFileSync(path.join(dir, 'index.yaml'), stringifyYaml({ ...record, assets }));
  return { dir, composite: assets[1].path };
}

/** What serve-ask writes when the owner submits: the starci/ask-answer@1 receipt (with the question's review). */
function receiptFor(p, question, { optionIndex = 0, answeredBy = 'owner', note = null, dispatchId = 'ctx_draw_review', review = question.review } = {}) {
  const dir = path.join(p.work, 'kernel-evidence', 'wf-draw', 'serve-ask');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `answer-${dispatchId}-${optionIndex}-${answeredBy}.json`);
  fs.writeFileSync(file, JSON.stringify({ schema: 'starci/ask-answer@1', workflowId: 'wf-draw', dispatchId, opId: 'interface.draw', option: question.options[optionIndex], optionIndex,
    picks: null, answeredBy, custodyWritten: [], envWritten: [], pointersWritten: [], bridge: null, errors: [], note, at: '2026-09-25T01:02:03.000Z', ...(review ? { review } : {}) }, null, 2));
  return file;
}

test('the draw-review question shows the owner the drawn parts only - desktop and mobile light - with their digests and no recommendation', (t) => {
  const p = greenfield(t);
  const { dir } = drawLayout(p);
  const status = drawReviewStatus(dir);
  assert.equal(status.owed, true, status.why);
  assert.deepEqual(status.gates.map((g) => g.kind), ['planned-layout']);
  const q = drawReviewQuestion(dir);
  assert.equal(q.kind, 'draw-review');
  assert.equal(q.options.length, 2);
  assert.equal(q.recommended, undefined, 'the owner reviews a drawing: nothing to auto-accept');
  assert.deepEqual(q.assets.map((a) => a.path), [
    '.starciwork/features/home/ui/app-layout/assets/directions/default--page--desktop--light.content.png',
    '.starciwork/features/home/ui/app-layout/assets/directions/default--page--mobile--light.content.png',
  ], 'parts, never the composites');
  for (const a of q.assets) assert.ok(fs.existsSync(path.join(p.repo, a.path)), `${a.path} resolves against the repository serve-ask reads`);
  assert.equal(q.review.record, DESIGN);
  assert.deepEqual(q.review.parts.map((x) => `${x.breakpoint}/${x.theme}`), ['desktop/light', 'mobile/light']);
  for (const x of q.review.parts) assert.match(q.text, new RegExp(x.sha256.slice(0, 8)), 'a redraw is a new question');
  assert.equal(JSON.parse(drawReviewMain(['question', '--ui', dir]).text).kind, 'draw-review');
  // A page nothing waits on owes no draw review of its own.
  const pageDir = path.join(p.work, 'features', 'home', 'ui', 'dashboard');
  fs.mkdirSync(pageDir, { recursive: true });
  fs.writeFileSync(path.join(pageDir, 'index.yaml'), stringifyYaml(uiSkeleton('ui.home.dashboard', { route: `${APP}/dashboard`, routeParent: APP, surface: 'page' })));
  assert.equal(drawReviewStatus(pageDir).owed, false);
  // ... unless another record dependsOn it.
  const implDir = path.join(p.work, 'features', 'home', 'impl', 'web', 'dashboard');
  fs.mkdirSync(implDir, { recursive: true });
  fs.writeFileSync(path.join(implDir, 'index.yaml'), stringifyYaml({ schema: 'work/implementation@1', id: 'impl.home.web.dashboard', state: 'todo', dependsOn: ['ui.home.dashboard'] }));
  assert.deepEqual(drawReviewStatus(pageDir).gates.map((g) => g.kind), ['depends-on']);
  // An incomplete draw is refused a question: the owner reviews desktop AND mobile.
  const record = readRecord(dir);
  fs.writeFileSync(path.join(dir, 'index.yaml'), stringifyYaml({ ...record, assets: record.assets.filter((a) => a.breakpoint !== 'mobile') }));
  assert.throws(() => drawReviewQuestion(dir), /no drawn part at default mobile\/light/);
  assert.equal(drawReviewStatus(dir).owed, false, 'an incomplete draw is drawn first, then reviewed');
});

test('greenfield sequence: brand a6 plans, interface.draw draws, the owner accepts, brand a7 crops the lockup', (t) => {
  const p = greenfield(t);
  const { dir, composite } = drawLayout(p);
  const from = `${DESIGN}:${composite}`;
  // Before the owner's answer the drawing is todo: a7 is refused, naming the path that accepts it.
  const early = layoutTreeMain(['lockup', '--work', p.work, '--from', from, '--rect', '1,1,6,4', '--write']);
  assert.equal(early.exitCode, 1);
  assert.match(early.text, /is todo, not done - the layout drawing is accepted before its lockup is taken: interface\.draw parks the owner draw-review ask/);
  const node = () => nodeById(readTree(p), APP);
  const settledReasons = () => layoutSettlement(readTree(p), { ...node(), layout: { ...node().layout, state: 'done' } }, { uiLoader: (id) => loadUiRecords(p.work).get(id) ?? null }).reasons;
  assert.ok(settledReasons().some((r) => /which is todo, not done - interface\.draw parks the owner draw-review ask/.test(r)));
  // The ask, the owner's accept answer, and the draw op's accept path.
  const q = drawReviewQuestion(dir);
  const receipt = receiptFor(p, q);
  const dry = applyDrawReview(dir, receipt);
  assert.equal(dry.written, false);
  assert.equal(readRecord(dir).state, 'todo', 'a dry run writes nothing');
  const applied = drawReviewMain(['apply', '--ui', dir, '--receipt', receipt, '--write']);
  assert.equal(applied.exitCode, 0, applied.text);
  const record = readRecord(dir);
  assert.equal(record.state, 'done');
  assert.equal(record.verificationSource, 'authored-claim');
  assert.match(record.because, /The owner accepted the drawn parts .* in draw-review ask ctx_draw_review/);
  assert.equal(record.ui.review.owner.decision, 'accepted');
  assert.equal(record.ui.review.owner.answeredBy, 'owner');
  assert.equal(record.ui.review.owner.receipt, '.starciwork/kernel-evidence/wf-draw/serve-ask/answer-ctx_draw_review-0-owner.json');
  assert.deepEqual(record.ui.review.owner.parts.map((x) => x.sha256), q.review.parts.map((x) => x.sha256));
  assert.equal(validateUi(record), true, JSON.stringify(validateUi.errors));
  const status = drawReviewStatus(dir);
  assert.equal(status.owed, false);
  assert.match(status.why, /accepted by owner in ask ctx_draw_review/);
  assert.deepEqual(settledReasons(), [], 'the planned layout settles on the accepted drawing');
  // brand.decide a7.
  const wet = layoutTreeMain(['lockup', '--work', p.work, '--from', from, '--rect', '1,1,6,4', '--write']);
  assert.equal(wet.exitCode, 0, wet.text);
  assert.equal(readTree(p).brand.lockups[0].source.kind, 'layout-drawing');
  // A redraw after the acceptance is not the drawing the owner accepted: it is unaccepted until reviewed again.
  drawLayout(p, { mark: [0, 250, 0, 255] });
  const redrawn = readRecord(dir);
  assert.equal(redrawn.state, 'done');
  assert.equal(drawingAcceptance(redrawn, dir).accepted, false);
  assert.match(lockupSourceOf(readTree(p), p.work, from).error, /done, but the owner-accepted drawing changed since .* was redrawn since the owner accepted it/);
  assert.equal(drawReviewStatus(dir).owed, true);
});

test('apply: a redraw answer writes nothing and hands back the note; only the owner accepts the current parts of this record', (t) => {
  const p = greenfield(t);
  const { dir } = drawLayout(p);
  const q = drawReviewQuestion(dir);
  const redraw = applyDrawReview(dir, receiptFor(p, q, { optionIndex: 1, note: 'Make the wordmark larger' }), { write: true });
  assert.deepEqual([redraw.decision, redraw.written, redraw.brief], ['redraw', false, 'Make the wordmark larger']);
  assert.equal(readRecord(dir).state, 'todo');
  assert.throws(() => applyDrawReview(dir, receiptFor(p, q, { answeredBy: 'auto-recommended' }), { write: true }), /only the owner accepts a drawing/);
  assert.throws(() => applyDrawReview(dir, receiptFor(p, q, { answeredBy: 'supervisor' }), { write: true }), /only the owner accepts a drawing/);
  assert.throws(() => applyDrawReview(dir, receiptFor(p, q, { review: null, dispatchId: 'ctx_other' }), { write: true }), /carries no draw review/);
  assert.throws(() => applyDrawReview(dir, receiptFor(p, q, { review: { ...q.review, record: 'ui.home.other' }, dispatchId: 'ctx_x' }), { write: true }), /reviews ui\.home\.other, not ui\.home\.app-layout/);
  // The owner reviewed these bytes; a part redrawn before the answer is applied is not what was accepted.
  const stale = receiptFor(p, q, { dispatchId: 'ctx_stale' });
  drawLayout(p, { mark: [0, 0, 250, 255] });
  assert.throws(() => applyDrawReview(dir, stale, { write: true }), /was redrawn after the owner reviewed it/);
  assert.equal(readRecord(dir).state, 'todo');
});

test('a draw-review ask is never auto-accepted, and a redraw asks a new question rather than repeating the answered one', () => {
  const question = { kind: 'draw-review', text: 'Please review [default desktop aaaaaaaa]', options: ['Accept the drawn parts (recommended)', 'Redraw'], recommended: 0 };
  const decision = autoAcceptDecision({ question, opId: 'interface.draw', secretFields: { files: [], vars: [] }, policy: { autoAcceptRecommended: true, excludes: [] } });
  assert.deepEqual([decision.accept, decision.why], [false, 'excluded:draw-review']);
  const answers = [{ dispatchId: 'ctx_first', question: question.text, options: question.options }];
  assert.equal(repeatedAnswerOf({ ...question, text: 'Please review [default desktop bbbbbbbb]' }, answers), null, 'the same two options on a redrawn drawing');
  assert.equal(repeatedAnswerOf(question, answers)?.dispatchId, 'ctx_first');
});

/** A running interface.draw job bound to a contract admitted at `admittedAt`. */
function seedDrawJob(p, { wf = 'wf-draw', jobId = 'job-draw-1', attempt = 1, dispatchId = 'ctx_draw_1', admittedAt }) {
  const l = openLedger({ file: ledgerFileFor(p.repo) });
  try {
    l.ensureWorkflow({ workflowId: wf, title: 'draw review' });
    const at = Date.now();
    l.db.prepare(`INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,created_at,updated_at) VALUES(?,?,?,?,0,'op','op',?,'running',?,?)`)
      .run(jobId, wf, 'interface.draw', attempt, JSON.stringify({ opId: 'interface.draw', owned_paths: ['.starciwork/features/home/ui/app-layout/**'], orca: { dispatchId } }), at, at);
    l.db.prepare('INSERT INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?,?)')
      .run(wf, 'interface.draw', attempt, dispatchId, '# contract', JSON.stringify({ contract: { schema: 'starci/contract-version@1', admittedAt } }), at);
  } finally { l.close(); }
}
const runApi = (...args) => spawnSync(process.execPath, [API, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000, env });
const lastErr = (r) => { try { return JSON.parse(String(r.stderr).trim().split('\n').at(-1)); } catch { return null; } };

test('api report refuses a done interface.draw that leaves a gating drawing unreviewed; an older leg reports as it was admitted', (t) => {
  const p = greenfield(t);
  const { dir } = drawLayout(p);
  const files = ['.starciwork/features/home/ui/app-layout/index.yaml', '.starciwork/features/home/ui/app-layout/assets/directions/default--page--desktop--light.content.png'];
  assert.deepEqual(drawReviewsOwed(p.repo, files).map((o) => o.id), [DESIGN]);
  assert.deepEqual(drawReviewsOwed(p.repo, ['.starciwork/features/home/ui/**']).map((o) => o.id), [DESIGN], 'a glob reaches the records under it');
  const report = path.join(p.repo, 'report.json');
  fs.writeFileSync(report, JSON.stringify({ schema: 'starci/op-report@1', outcome: 'done', summary: 'Drew the planned layout.', files, checks: [], head: 'abcdef1234567' }));
  seedDrawJob(p, { admittedAt: Date.parse('2099-01-01T00:00:00Z') });
  const refused = runApi('report', '--repo', p.repo, '--job', 'job-draw-1', '--report', report, '--json');
  assert.equal(refused.status, 1, refused.stdout);
  assert.equal(lastErr(refused)?.code, 'draw-review-owed', refused.stderr);
  assert.match(lastErr(refused).error, /ui\.home\.app-layout .* gates another leg \(planned-layout\).*draw-review\.mjs question --ui/);
  // The ask itself is what the attempt files.
  const ask = path.join(p.repo, 'ask.json');
  fs.writeFileSync(ask, JSON.stringify({ schema: 'starci/op-report@1', outcome: 'ask', summary: 'The owner reviews the drawn parts.', files, checks: [], question: drawReviewQuestion(dir) }));
  const asked = runApi('report', '--repo', p.repo, '--job', 'job-draw-1', '--report', ask, '--json');
  assert.equal(asked.status, 0, asked.stderr);
  // After the owner's accept answer is applied, the done report is filed.
  applyDrawReview(dir, receiptFor(p, drawReviewQuestion(dir)), { write: true });
  seedDrawJob(p, { jobId: 'job-draw-2', attempt: 2, dispatchId: 'ctx_draw_2', admittedAt: Date.parse('2099-01-01T00:00:00Z') });
  const filed = runApi('report', '--repo', p.repo, '--job', 'job-draw-2', '--report', report, '--json');
  assert.equal(filed.status, 0, filed.stderr);
  // A leg admitted before the change is judged by the contract it was admitted under.
  drawLayout(p, { mark: [0, 250, 0, 255] });
  seedDrawJob(p, { jobId: 'job-draw-3', attempt: 3, dispatchId: 'ctx_draw_3', admittedAt: Date.parse('2020-01-01T00:00:00Z') });
  const older = runApi('report', '--repo', p.repo, '--job', 'job-draw-3', '--report', report, '--json');
  assert.equal(older.status, 0, older.stderr);
});

test('serve-ask: the owner accepts in the form, the receipt keeps the review, and apply settles the record from it', async (t) => {
  const p = greenfield(t);
  const { dir } = drawLayout(p);
  const wf = 'wf-draw-form', dispatchId = 'ctx_draw_form';
  const question = drawReviewQuestion(dir);
  const l = openLedger({ file: ledgerFileFor(p.repo) });
  try {
    l.ensureWorkflow({ workflowId: wf, title: 'draw review form' });
    const at = Date.now();
    l.db.prepare(`INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,created_at) VALUES(?,?,?,?,0,'ask',?,?)`)
      .run(wf, dispatchId, 'interface.draw', 1, JSON.stringify({ outcome: 'ask', summary: 'owner review', dispatch: dispatchId, question }), at);
  } finally { l.close(); }
  const child = spawn(process.execPath, [SERVE, '--repo', p.repo, '--workflow', wf, '--dispatch', dispatchId, '--ttl', '60000'], { cwd: ROOT, env, windowsHide: true });
  t.after(() => { try { child.kill(); } catch { /* exited */ } });
  const exited = new Promise((resolve) => child.on('exit', resolve));
  const url = await new Promise((resolve, reject) => {
    let out = '', err = '';
    child.stdout.on('data', (c) => { out += c; const line = out.split('\n').find((x) => x.includes('"url"')); if (line) resolve(JSON.parse(line).url); });
    child.stderr.on('data', (c) => { err += c; });
    child.on('exit', (code) => reject(new Error(`serve-ask exited ${code}: ${out}${err}`)));
  });
  const page = await fetch(url).then((r) => r.text());
  assert.match(page, /default--page--desktop--light\.content\.png|default - desktop/, 'the form shows the drawn parts');
  const res = await fetch(`${url}/answer`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'option=0' });
  assert.equal(res.status, 200, await res.text());
  await exited;
  const r = inspectLedger({ file: ledgerFileFor(p.repo) });
  let answered;
  try { answered = JSON.parse(r.db.prepare("SELECT payload_json FROM events WHERE kind='ask-answered' AND json_extract(payload_json,'$.dispatchId')=?").get(dispatchId).payload_json); } finally { r.close(); }
  const receipt = JSON.parse(fs.readFileSync(answered.receiptPath, 'utf8'));
  assert.deepEqual([receipt.answeredBy, receipt.optionIndex], ['owner', 0]);
  assert.deepEqual(receipt.review, question.review);
  const applied = applyDrawReview(dir, answered.receiptPath, { write: true });
  assert.equal(applied.owner.dispatchId, dispatchId);
  assert.equal(readRecord(dir).state, 'done');
});
