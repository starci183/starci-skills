// Owner mission 2026-09-27: "the owner checks the images; any image that is wrong gets feedback -> redraw -> until
// golden" (scripts/work/draw-feedback.mjs). Covers: an owner redraw answer records every note as a ruling and makes the
// leg owe a redraw; a redraw that does not address a note fails DRAW_FEEDBACK_UNADDRESSED; an owner accept promotes the
// drawing into brand.direction.golden with its receipt; a product-direction note persists into brand.direction.learned
// as proposed until the owner next accepts the direction; auto-accept never touches a draw review; the owner answers
// on Telegram by replying.
import test from 'node:test';
import { putBundle } from '../../engine/db/blob.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseYaml, stringifyYaml } from '../../engine/yaml.mjs';
import { ledgerFileFor, openLedger, ensureWorkflow, changeWorkflowPhase, createUnit, enqueueJob, setJobStatus, startAttempt, writeContract, fileReport } from '../../engine/db/ledger.mjs';
import { applyDrawReview, drawReviewQuestion } from '../../scripts/work/draw-review.mjs';
import {
  DRAW_FEEDBACK_UNADDRESSED, DRAW_OWNER_RULING, DRAW_REDRAW_OWED, KNOWLEDGE_CHANGE_REQUESTED, briefBlock, classifyNote, classifyNoteInRecord,
  drawReviewBoard, feedbackFindings, notesOfReceipt, openKnowledgeRequests, recordDrawAnswer, reportFeedbackFindings,
} from '../../scripts/work/draw-feedback.mjs';
import { rubricFor } from '../../scripts/work/draw-critic.mjs';
import { applyDirectionReview, directionReviewQuestion, promoteGolden } from '../../scripts/work/brand-direction.mjs';
import { checkDirection } from '../../scripts/work/brand/brand.mjs';
import { autoAcceptDecision } from '../../scripts/machine/ask-recommendation.mjs';
import { answerDrawReviewByReply, autoAcceptAsk, drawReplyDecision } from '../../scripts/kernel/ask-server.mjs';
import { loadWorkSchemaValidators } from '../../scripts/work/validate/check-work-schemas.mjs';
import { translator } from '../../scripts/lib/i18n.mjs';

const trv = translator('vi');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GRAMMAR = path.join(ROOT, 'knowledge', 'grammars');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const SHAPE = 'TodoListBase#default';
const LOOP = 'assets/directions/draw-loop/TodoListBase--default';
const BRIEF = 'assets/directions/TodoListBase#default.prompt.txt';
const ON = { autoAcceptRecommended: true, excludes: [] };
const WF = 'wf-draw-feedback';

/** A product repo: a brand record carrying the (proposed) Nivo direction, and one ui record drawing SHAPE. */
function product(t) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-draw-feedback-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  const work = path.join(repo, '.starciwork');
  const brandDir = path.join(work, 'brand');
  fs.mkdirSync(brandDir, { recursive: true });
  const direction = parseYaml(fs.readFileSync(path.join(ROOT, 'knowledge', 'ui', 'examples', 'brand-direction.example.yaml'), 'utf8')).direction;
  fs.writeFileSync(path.join(brandDir, 'index.yaml'), stringifyYaml({ schema: 'work/brand@1', id: 'brand', kind: 'brand', state: 'todo', rev: 1,
    brand: { identity: { name: 'Nivo', family: 'starci' }, direction }, review: { reviewer: 'owner', authority: 'fixture', reviewedAt: '2026-09-27T00:00:00Z' } }));
  const dir = path.join(work, 'features', 'todo', 'ui', 'list');
  fs.mkdirSync(path.join(dir, LOOP, 'round-1'), { recursive: true });
  const base = {
    schema: 'work/ui-screen@1', id: 'ui.todo.list', kind: 'ui', state: 'todo', title: 'Todo list', route: '/todos', surface: 'page',
    ui: { status: 'Proposed direction.', intent: 'Show the todos.', shapes: [{ base: 'TodoListBase', state: 'default' }],
      states: [{ name: 'default', trigger: 'open', behavior: 'list' }], coverage: { scale: 'bounded', map: [{ screen: 'list', state: 'default' }] } },
  };
  const file = path.join(dir, 'index.yaml');
  fs.writeFileSync(file, stringifyYaml({ ...base, assets: [] }));
  const read = () => parseYaml(fs.readFileSync(file, 'utf8'));
  /** interface.draw's loop output: the two parts, their render sources, the brief and the best round's critique. */
  const draw = (tag, { brief = 'Draw the todo list.', checks = [] } = {}) => {
    const record = read();
    const assets = [];
    for (const [bp, size] of [['desktop', '1280x800'], ['mobile', '390x844']]) {
      const rel = `assets/directions/${SHAPE}--${size}--light.png`;
      const bytes = Buffer.from(`\x89PNG-${tag}-${bp}`);
      fs.writeFileSync(path.join(dir, rel), bytes);
      fs.writeFileSync(path.join(dir, rel.replace(/\.png$/, '.html')), `<main data-grammar-component="PageContainer">${tag}</main>`);
      assets.push({ path: rel, role: 'direction-content', breakpoint: bp, theme: 'light', sha256: sha(bytes),
        generation: { tool: 'draw-render', promptPath: BRIEF, mode: 'draw-loop', loop: { path: `${LOOP}/loop.json`, round: 1 } } },
      { path: rel.replace(/\.png$/, '.html'), role: 'render-source' });
    }
    fs.writeFileSync(path.join(dir, BRIEF), brief);
    fs.writeFileSync(path.join(dir, LOOP, 'loop.json'), JSON.stringify({ schema: 'starci/draw-loop@1', base: 'TodoListBase', state: 'default', rounds: [{ n: 1, dir: 'round-1' }], best: 1 }));
    fs.writeFileSync(path.join(dir, LOOP, 'round-1', 'critique.json'), JSON.stringify({ schema: 'starci/draw-critique@1', verdict: { checks, beauty: 8 } }));
    const loopSha = putBundle(path.join(dir, LOOP));
    for (const a of assets) if (a.generation?.loop) a.generation.loop = { sha256: loopSha, round: 1 };
    fs.writeFileSync(file, stringifyYaml({ ...record, assets }));
  };
  let n = 0;
  const receipt = (question, { optionIndex = 0, note = null, partNotes = null, golden = false, answeredBy = 'owner', dispatchId = 'ctx_review_1' } = {}) => {
    const d = path.join(work, 'kernel-evidence', WF, 'serve-ask');
    fs.mkdirSync(d, { recursive: true });
    const f = path.join(d, `answer-${Date.now()}${n += 1}.json`);
    fs.writeFileSync(f, JSON.stringify({ schema: 'starci/ask-answer@1', workflowId: WF, dispatchId, opId: 'interface.draw', option: question.options[optionIndex], optionIndex,
      answeredBy, note, ...(partNotes ? { partNotes } : {}), ...(golden ? { golden: true } : {}), at: '2026-09-27T12:00:00.000Z', review: question.review }, null, 2));
    return f;
  };
  const ledger = () => openLedger({ file: ledgerFileFor(repo) });
  // The ask an interface.draw attempt files: on the migrated schema a reports row keys the dispatch's
  // op_attempts row, so the whole workflow → unit → job → leased → attempt → reported chain is seeded
  // through the ledger helpers, then the ask itself filed with fileReport.
  const fileAsk = (l, dispatchId, question) => {
    const jobId = `job-${dispatchId}`, at = Date.now();
    l.transaction(db => {
      ensureWorkflow(db, { workflowId: WF, phase: 'queued', title: 'draw feedback', by: 'test-fixture', reason: 'seed', at });
      changeWorkflowPhase(db, { workflowId: WF, to: 'running', by: 'test-fixture', reason: 'seed', at });
      createUnit(db, { workflowId: WF, unitId: `unit-${jobId}`, opId: 'interface.draw', subjectKey: `unit-${jobId}`, goalRevision: 1, createdAt: at });
      enqueueJob(db, { jobId, workflowId: WF, unitId: `unit-${jobId}`, opId: 'interface.draw', kind: 'op',
        payload: { opId: 'interface.draw', owned_paths: [], orca: { dispatchId } }, createdAt: at });
      setJobStatus(db, { jobId, to: 'ready', reason: 'seed', at });
      setJobStatus(db, { jobId, to: 'leased', reason: 'seed', at });
      const attempt = startAttempt(db, { workflowId: WF, jobId, dispatchId, dispatchedAt: at, startedAt: at, at });
      writeContract(db, { attemptId: attempt.attempt_id, markdown: '# contract', context: {}, createdAt: at });
      setJobStatus(db, { jobId, to: 'running', reason: 'seed', at });
      setJobStatus(db, { jobId, to: 'reported', reason: 'report-filed:ask', attemptId: attempt.attempt_id, at });
      fileReport(db, { attemptId: attempt.attempt_id, outcome: 'ask',
        report: { outcome: 'ask', summary: 'draw review', dispatch: dispatchId, from: jobId, question }, createdAt: at });
    });
    return l.db.prepare('SELECT * FROM reports WHERE workflow_id=? AND dispatch_id=?').get(WF, dispatchId);
  };
  const answered = (l, report, receiptPath, optionIndex) => l.appendEvent({ workflowId: WF, entityType: 'report', entityId: report.dispatch_id, kind: 'ask-answered',
    payload: { dispatchId: report.dispatch_id, receiptPath, answeredBy: 'owner', optionIndex } });
  const readBrand = () => parseYaml(fs.readFileSync(path.join(brandDir, 'index.yaml'), 'utf8'));
  return { repo, work, dir, brandDir, draw, read, receipt, ledger, fileAsk, answered, readBrand };
}

const events = (l, kind) => l.db.prepare('SELECT payload_json FROM events WHERE kind=? ORDER BY seq').all(kind).map((r) => JSON.parse(r.payload_json));
const REDRAW_NOTE = 'Title too small\nTodoListBase#default: never paint the primary button red, always use the brand black';

/** Round 1: drawn, asked, and the owner answers redraw with two note lines and one note on the mobile image. */
function redrawRound(t) {
  const p = product(t);
  p.draw('v1');
  const question = drawReviewQuestion(p.dir);
  const mobile = question.review.parts.find((x) => x.breakpoint === 'mobile');
  const receiptPath = p.receipt(question, { optionIndex: 1, note: REDRAW_NOTE, partNotes: [{ path: mobile.path, shape: mobile.shape, note: 'The header is cramped on mobile' }] });
  return { p, question, receiptPath, receipt: JSON.parse(fs.readFileSync(receiptPath, 'utf8')) };
}

test('an owner redraw answer records every note as an owner ruling bound to its shape and makes the leg owe a redraw', (t) => {
  const { p, question, receiptPath, receipt } = redrawRound(t);
  const notes = notesOfReceipt(receipt);
  assert.deepEqual(notes.map((n) => [n.text, n.shape, n.part ? path.basename(n.part) : null, n.owed]), [
    ['Title too small', null, null, true],
    ['never paint the primary button red, always use the brand black', SHAPE, null, true],
    ['The header is cramped on mobile', SHAPE, `${SHAPE}--390x844--light.png`, true],
  ]);
  assert.deepEqual(notes.map((n) => n.class), ['one-off', 'product-direction', 'one-off']);
  assert.ok(notes.every((n) => n.parts.every((x) => x.sha256)), 'each ruling binds the digests the owner saw');
  const l = p.ledger();
  try {
    const report = p.fileAsk(l, 'ctx_review_1', question);
    p.answered(l, report, receiptPath, 1);
    const r = recordDrawAnswer(l, { workflowId: WF, report, receipt, receiptPath, repo: p.repo });
    assert.equal(r.rulings.length, 3);
    assert.deepEqual(r.redrawOwed.noteIds, notes.map((n) => n.id));
    assert.equal(recordDrawAnswer(l, { workflowId: WF, report, receipt, receiptPath, repo: p.repo }).rulings.length, 0, 'idempotent');
    assert.equal(events(l, DRAW_OWNER_RULING).length, 3);
    assert.equal(events(l, DRAW_REDRAW_OWED).length, 1);
    assert.ok(events(l, DRAW_OWNER_RULING).every((e) => e.receipt && e.receiptSha256 && e.record === 'ui.todo.list'));
    // The board: the leg owes a redraw, every note unaddressed.
    const [board] = drawReviewBoard(l.db, { workflowId: WF, repo: p.repo });
    assert.equal(board.state, 'redraw-owed');
    assert.deepEqual([board.shapes[0].shape, board.shapes[0].openNotes.length, board.shapes[0].unaddressed], [SHAPE, 3, 3]);
    // Before the answer is applied to the record, an ask/done report of it is refused.
    const before = reportFeedbackFindings(l.db, { repo: p.repo, report: { outcome: 'ask', question } });
    assert.equal(before.findings[0].code, DRAW_FEEDBACK_UNADDRESSED);
    assert.match(before.findings[0].detail, /redraw answer to ask ctx_review_1 is not applied/);
  } finally { l.close(); }
  // apply writes the rulings into ui.review.feedback (not the record's state) and learns the product rule.
  const applied = applyDrawReview(p.dir, receiptPath, { write: true });
  assert.deepEqual([applied.decision, applied.written, applied.feedback.written, applied.feedback.round], ['redraw', false, true, 1]);
  const record = p.read();
  assert.equal(record.state, 'todo');
  assert.deepEqual(record.ui.review.feedback.rounds[0].notes.map((n) => n.id), notes.map((n) => n.id));
  // The next loop's brief and the critic's rubric carry every note as a gate check.
  const brief = briefBlock(p.dir, { shape: SHAPE });
  for (const n of notes) assert.ok(brief.text.includes(n.id), `the brief carries ${n.id}`);
  const { rubric, ownerChecks } = rubricFor({ workRoot: p.work, archetype: 'list', record, shape: SHAPE });
  for (const n of notes) {
    assert.ok(ownerChecks.includes(n.id));
    assert.equal(rubric.checks.find((c) => c.id === n.id).gate, true);
  }
});

test('a redraw that does not address an owner note fails DRAW_FEEDBACK_UNADDRESSED until every note is addressed', (t) => {
  const { p, receiptPath } = redrawRound(t);
  applyDrawReview(p.dir, receiptPath, { write: true });
  const ids = p.read().ui.review.feedback.rounds[0].notes.map((n) => n.id);
  // Not redrawn: the owner's rejected bytes are still the parts.
  assert.throws(() => drawReviewQuestion(p.dir), (e) => e.code === DRAW_FEEDBACK_UNADDRESSED && /still the image the owner rejected/.test(e.message));
  // Redrawn, but the brief lacks one note and the critic fails another.
  p.draw('v2', { brief: `Redraw.\n${ids[0]} ${ids[1]}`, checks: [{ id: ids[0], pass: true }, { id: ids[1], pass: false, evidence: 'the primary is still red' }, { id: ids[2], pass: true }] });
  const findings = feedbackFindings(p.dir);
  assert.deepEqual(findings.map((f) => f.note).sort(), [ids[1], ids[2]].sort());
  assert.match(findings.find((f) => f.note === ids[1]).detail, /critic fails .* the primary is still red/);
  assert.match(findings.find((f) => f.note === ids[2]).detail, /does not carry/);
  assert.throws(() => drawReviewQuestion(p.dir), /DRAW_FEEDBACK_UNADDRESSED/);
  // Every note in the brief and passed by the critic: the owner is asked again, round 2.
  p.draw('v3', { brief: briefBlock(p.dir, { shape: SHAPE }).text, checks: ids.map((id) => ({ id, pass: true })) });
  assert.deepEqual(feedbackFindings(p.dir), []);
  const again = drawReviewQuestion(p.dir);
  assert.equal(again.review.round, 2);
  assert.deepEqual(again.review.addresses, ids);
  assert.match(again.text, /Round 2; this redraw addresses your notes/);
});

test('the owner accept promotes the drawing into brand.direction.golden with its receipt; an automatic answer never does', async (t) => {
  const { p, question: first, receiptPath } = redrawRound(t);
  applyDrawReview(p.dir, receiptPath, { write: true });
  const ids = p.read().ui.review.feedback.rounds[0].notes.map((n) => n.id);
  p.draw('v3', { brief: briefBlock(p.dir).text, checks: ids.map((id) => ({ id, pass: true })) });
  const question = drawReviewQuestion(p.dir);
  // Auto-accept never answers a draw review, whatever the policy.
  assert.deepEqual(autoAcceptDecision({ question, opId: 'interface.draw', secretFields: { files: [], vars: [] }, policy: ON }).accept, false);
  const l = p.ledger();
  let report;
  try {
    p.answered(l, p.fileAsk(l, 'ctx_review_1', first), receiptPath, 1);
    report = p.fileAsk(l, 'ctx_review_2', question);
    const spy = { wake: () => ({ action: 'none' }), notify: async () => null, close: async () => null };
    const auto = await autoAcceptAsk({ ledger: l, ledgerFile: ledgerFileFor(p.repo), repo: p.repo, workflowId: WF, report, policy: ON, ...spy });
    assert.equal(auto.accepted, false, 'a draw review is the owner\'s, never auto-accepted');
    assert.deepEqual([events(l, 'ask-answered').map((e) => e.dispatchId), events(l, 'ask-auto-accepted')], [['ctx_review_1'], []], 'nothing is answered for the owner');
  } finally { l.close(); }
  // An automatic receipt cannot promote a golden.
  const autoReceipt = p.receipt(question, { answeredBy: 'auto-recommended', dispatchId: 'ctx_review_2' });
  assert.throws(() => promoteGolden(p.work, { uiDir: p.dir, archetype: 'list', parts: question.review.parts, receiptFile: autoReceipt, htmlOf: (x) => path.join(p.dir, x.path.replace(/\.png$/, '.html')) }), /only the owner's own accept promotes/);
  // The owner's accept: the list archetype has no golden yet, so the drawing is promoted.
  const acceptReceipt = p.receipt(question, { dispatchId: 'ctx_review_2' });
  const accepted = applyDrawReview(p.dir, acceptReceipt, { write: true });
  assert.equal(accepted.decision, 'accept');
  assert.deepEqual([accepted.golden.promoted, accepted.golden.archetype, accepted.golden.archetypeAccepted], [true, 'list', false]);
  const direction = p.readBrand().brand.direction;
  assert.deepEqual(direction.golden.map((g) => g.sha256).sort(), question.review.parts.map((x) => x.sha256).sort());
  for (const g of direction.golden) assert.ok(fs.existsSync(path.join(p.brandDir, g.png)) && fs.existsSync(path.join(p.brandDir, g.html)));
  assert.equal(direction.archetypes.list.status, 'proposed', 'the archetype waits for the owner to accept the direction');
  const record = p.read();
  assert.equal(record.state, 'done');
  assert.deepEqual(record.ui.review.golden.shapes, [SHAPE]);
  assert.equal(checkDirection({ brand: { direction }, family: 'starci', grammarRoot: GRAMMAR, brandDir: p.brandDir }).outcome, 'pass');
  // The board: accepted, golden.
  const l2 = p.ledger();
  try {
    p.answered(l2, report, acceptReceipt, 0);
    const [board] = drawReviewBoard(l2.db, { workflowId: WF, repo: p.repo });
    assert.deepEqual([board.state, board.rounds.map((r) => r.decision), board.shapes[0].golden, board.shapes[0].openNotes], ['accepted', ['redraw', 'accept'], 'golden', []]);
  } finally { l2.close(); }
});

test('a product-direction note persists into brand.direction.learned as proposed; the next owner acceptance of the direction accepts it', (t) => {
  const { p, receiptPath } = redrawRound(t);
  applyDrawReview(p.dir, receiptPath, { write: true });
  const learned = p.readBrand().brand.direction.learned;
  assert.equal(learned.length, 1);
  assert.deepEqual([learned[0].kind, learned[0].status, learned[0].source.shape], ['antiPattern', 'proposed', SHAPE]);
  const validate = loadWorkSchemaValidators(ROOT).validators.get('work/brand@1').validate;
  assert.equal(validate(p.readBrand()), true, JSON.stringify(validate.errors));
  // Every later draw of the product reads it - even of another record (the critic's rubric).
  assert.ok(rubricFor({ workRoot: p.work, archetype: 'list', record: null, shape: 'OtherBase#default' }).ownerChecks.includes(learned[0].id));
  // Promote a golden (owner accept), then the owner accepts the direction: the learned ruling is accepted with it.
  const ids = p.read().ui.review.feedback.rounds[0].notes.map((n) => n.id);
  p.draw('v3', { brief: briefBlock(p.dir).text, checks: ids.map((id) => ({ id, pass: true })) });
  applyDrawReview(p.dir, p.receipt(drawReviewQuestion(p.dir), { dispatchId: 'ctx_review_2' }), { write: true });
  const dq = directionReviewQuestion(p.work, { archetype: 'list' });
  assert.deepEqual(dq.review.learned, [learned[0].id]);
  assert.match(dq.text, /Rulings learned from your draw feedback/);
  const dirReceipt = path.join(p.work, 'kernel-evidence', WF, 'serve-ask', 'answer-direction.json');
  fs.writeFileSync(dirReceipt, JSON.stringify({ schema: 'starci/ask-answer@1', workflowId: WF, dispatchId: 'ctx_dir', opId: 'brand.decide', optionIndex: 0, answeredBy: 'owner', at: '2026-09-27T13:00:00.000Z', review: dq.review }));
  applyDirectionReview(p.work, dirReceipt, { write: true });
  const direction = p.readBrand().brand.direction;
  assert.equal(direction.learned[0].status, 'accepted');
  const verdict = checkDirection({ brand: { direction }, family: 'starci', grammarRoot: GRAMMAR, brandDir: p.brandDir });
  assert.equal(verdict.outcome, 'pass', verdict.detail);
  assert.deepEqual([verdict.evidence.ready, verdict.evidence.learned.accepted], [['list'], [learned[0].id]]);
  assert.equal(validate(p.readBrand()), true, JSON.stringify(validate.errors));
});

test('classification is structural; a reclassification must be confirmed by structure; grammar and knowledge notes become records', (t) => {
  assert.equal(classifyNote('Use ACCENT-6: the accent budget is off').class, 'knowledge');
  assert.equal(classifyNote('We need a segmented Meter variant', { dnaNames: ['Meter'] }).target, 'Meter');
  assert.equal(classifyNote('The spacing is off everywhere').class, 'product-direction');
  assert.equal(classifyNote('Move the logout link lower').class, 'one-off');
  const { p, question, receiptPath } = redrawRound(t);
  applyDrawReview(p.dir, receiptPath, { write: true });
  const [oneOff] = p.read().ui.review.feedback.rounds[0].notes;
  assert.throws(() => classifyNoteInRecord(p.dir, { noteId: oneOff.id, cls: 'grammar', target: 'Blob', write: true }), /not a component the grammar DNA renders/);
  assert.throws(() => classifyNoteInRecord(p.dir, { noteId: oneOff.id, cls: 'knowledge', write: true }), /names the rule id/);
  const r = classifyNoteInRecord(p.dir, { noteId: oneOff.id, cls: 'grammar', target: 'Meter', by: 'critic', write: true });
  assert.deepEqual([r.note.class, r.note.classifiedBy, p.read().ui.review.feedback.rounds[0].notes[0].class], ['grammar', 'critic', 'grammar']);
  // A grammar note is a grammar proposal record, a knowledge note a knowledge change request (ledger).
  const l = p.ledger();
  try {
    const report = p.fileAsk(l, 'ctx_kinds', question);
    const receipt = { ...JSON.parse(fs.readFileSync(receiptPath, 'utf8')), dispatchId: 'ctx_kinds', note: 'The Meter needs a new variant for segments\nFollow ACCENT-6 on every page', partNotes: undefined };
    recordDrawAnswer(l, { workflowId: WF, report, receipt, receiptPath, repo: p.repo });
    const proposals = events(l, 'grammar-proposal-filed').filter((e) => e.source === 'owner-draw-note');
    assert.equal(proposals.length, 1);
    assert.equal(proposals[0].status, 'proposed');
    assert.equal(events(l, KNOWLEDGE_CHANGE_REQUESTED)[0].target, 'ACCENT-6');
    assert.equal(openKnowledgeRequests(l.db, WF).length, 1);
  } finally { l.close(); }
});

test('the owner answers on Telegram by replying: ok/duy\u1ec7t accepts, anything else is feedback; the answer is the verified owner answer', async (t) => {
  assert.deepEqual(drawReplyDecision('ok'), { decision: 'accept', optionIndex: 0, golden: false, note: null });
  assert.deepEqual(drawReplyDecision('Duy\u1ec7t!').decision, 'accept');
  assert.deepEqual([drawReplyDecision('ok, l\u00e0m m\u1eabu chu\u1ea9n').decision, drawReplyDecision('ok golden').golden], ['accept', true]);
  assert.equal(drawReplyDecision('ok nh\u01b0ng n\u00fat ch\u00ednh ph\u1ea3i m\u00e0u \u0111en').decision, 'redraw');
  const p = product(t);
  p.draw('v1');
  const question = drawReviewQuestion(p.dir);
  const mobile = question.review.parts.find((x) => x.breakpoint === 'mobile');
  const l = p.ledger();
  try { p.fileAsk(l, 'ctx_tg', question); } finally { l.close(); }
  const woken = [];
  const r = await answerDrawReviewByReply({ repo: p.repo, workflowId: WF, dispatchId: 'ctx_tg', text: 'Header qu\u00e1 ch\u1eadt', partPath: mobile.path,
    telegram: { chatId: 42, messageId: 7, replyTo: 5 }, wake: (_l, x) => { woken.push(x); return { action: 'woken' }; }, close: async () => ({ ok: true }) });
  assert.deepEqual([r.ok, r.decision, r.rulings, r.redrawOwed], [true, 'redraw', 1, true]);
  const receipt = JSON.parse(fs.readFileSync(r.receiptPath, 'utf8'));
  assert.deepEqual([receipt.answeredBy, receipt.via, receipt.telegram.verified, receipt.partNotes[0].path], ['owner', 'telegram', true, mobile.path]);
  assert.equal(woken.length, 1);
  const again = await answerDrawReviewByReply({ repo: p.repo, workflowId: WF, dispatchId: 'ctx_tg', text: 'ok', wake: () => ({}), close: async () => ({}) });
  assert.deepEqual([again.ok, again.why], [false, 'already answered']);
  // The redraw answer applies like a form answer: the note binds the mobile image.
  const applied = applyDrawReview(p.dir, r.receiptPath, { write: true });
  assert.equal(applied.feedback.notes[0].shape, SHAPE);
  assert.equal(p.read().ui.review.feedback.rounds[0].notes[0].part, mobile.path);
});

test('the draw-review notice reaches the verified Telegram chat as an album; a reply to it (or to one image) is routed as the owner answer', async (t) => {
  const { notifyAsk, drawReplyHint } = await import('../../scripts/connectors/telegram.mjs');
  const { createBridge } = await import('../../scripts/supervisor/telegram-bridge.mjs');
  const p = product(t);
  p.draw('v1');
  const question = drawReviewQuestion(p.dir);
  const l = p.ledger();
  try { p.fileAsk(l, 'ctx_tg_album', question); } finally { l.close(); }
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-draw-tg-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const calls = [];
  let id = 500;
  const fetchImpl = async (url, init) => {
    const method = String(url).split('/').pop();
    calls.push({ method, body: typeof init?.body === 'string' ? JSON.parse(init.body) : null, form: init?.body instanceof FormData ? init.body : null });
    const result = method === 'sendMediaGroup' ? [{ message_id: ++id }, { message_id: ++id }] : { message_id: ++id };
    return { ok: true, status: 200, json: async () => ({ ok: true, result }) };
  };
  const EX = parseYaml(fs.readFileSync(path.join(ROOT, 'config.example.yaml'), 'utf8'));
  const config = { ...EX, language: 'vi', connectors: { secretsFile: null, cloudflare: { mode: 'named', hostname: 'response.example.org' }, telegram: { enabled: true, chatId: '4242' } } };
  const env = { LOCALAPPDATA: home, TELEGRAM_BOT_TOKEN: '123456789:AAFakeTokenForSpecsOnly_abcdefghijklmnop' };
  const sent = await notifyAsk({ ledgerFile: ledgerFileFor(p.repo), repo: p.repo, workflowId: WF, dispatchId: 'ctx_tg_album' }, { config, env, apiBase: 'http://bot.invalid', fetchImpl, sleepImpl: async () => {}, warn: () => {} });
  assert.equal(sent.ok, true, JSON.stringify(sent));
  const album = calls.find((c) => c.method === 'sendMediaGroup');
  assert.ok(album, 'the drawn desktop and mobile images go as one album');
  assert.equal(album.form.get('chat_id'), '4242', 'to the verified owner chat');
  const caption = JSON.parse(album.form.get('media'))[0].caption;
  assert.ok(caption.includes(SHAPE) && caption.includes(trv('Round {round}', { round: 1 })), caption);
  assert.ok(calls.find((c) => c.method === 'sendMessage').body.text.includes(drawReplyHint('vi')));
  // A reply to the mobile image, from the verified chat, is routed to the owner-answer path with that image.
  const routed = [];
  const bridge = createBridge({ env, apiBase: 'http://bot.invalid', fetchImpl, sleepImpl: async () => {}, timeoutS: 0, sweepEveryMs: -1,
    settings: () => ({ ready: true, token: env.TELEGRAM_BOT_TOKEN, chatId: '4242', language: 'vi' }), answerDraw: async (a) => { routed.push(a); return { ok: true, decision: 'redraw' }; } });
  const mobileMessage = 502; // the album's second photo
  const r = await bridge.handleUpdate({ update_id: 1, message: { message_id: 900, date: Math.floor(Date.now() / 1000), chat: { id: 4242, type: 'private' }, from: { id: 4242 }, text: 'Header qu\u00e1 ch\u1eadt', reply_to_message: { message_id: mobileMessage } } });
  assert.equal(r.handled, 'message');
  assert.deepEqual([routed.length, routed[0].dispatchId, path.basename(routed[0].partPath ?? '')], [1, 'ctx_tg_album', `${SHAPE}--390x844--light.png`]);
  // Another sender in the chat is dropped before any answer is recorded.
  const dropped = await bridge.handleUpdate({ update_id: 2, message: { message_id: 901, chat: { id: 4242, type: 'private' }, from: { id: 999 }, text: 'ok', reply_to_message: { message_id: mobileMessage } } });
  assert.deepEqual([dropped.dropped, routed.length], [true, 1]);
});
