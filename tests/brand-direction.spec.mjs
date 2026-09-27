// brand.direction (owner rulings 2026-09-27): the composition taste a product's brand record carries, accepted by
// the owner one archetype at a time. Covers the work/brand@1 $defs.direction shape, scripts/checks/brand.mjs
// `direction`, scripts/work/brand-direction.mjs question/apply, and the knowledge-side Nivo example.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseYaml, stringifyYaml } from '../engine/yaml.mjs';
import { CHECK_IDS, DIRECTION_REVIEW_KIND, DIRECTION_REVIEW_SCHEMA, checkDirection, grammarComponentNames, runBrandChecks } from '../scripts/checks/brand.mjs';
import { applyDirectionReview, directionReviewQuestion, directionStatus } from '../scripts/work/brand-direction.mjs';
import { AUTO_ACCEPTED_BY, autoAcceptDecision } from '../scripts/kernel/ask-recommendation.mjs';
import { loadWorkSchemaValidators } from '../scripts/checks/check-work-schemas.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GRAMMAR = path.join(ROOT, 'knowledge', 'grammars');
const EXAMPLE = path.join(ROOT, 'knowledge', 'ui', 'examples', 'brand-direction.nivo.yaml');
const example = () => parseYaml(fs.readFileSync(EXAMPLE, 'utf8')).direction;
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

/** A full work/brand@1 record around one direction block. */
const record = (direction) => ({
  schema: 'work/brand@1', id: 'brand', kind: 'brand', state: 'todo', rev: 1,
  brand: { identity: { name: 'Nivo', family: 'starci' }, direction },
  review: { reviewer: 'owner', authority: 'fixture', reviewedAt: '2026-09-27T00:00:00Z' },
});

/** A repository with .starciwork/brand/index.yaml carrying `direction`, one golden PNG for `list`, and receipts. */
function repo(t, direction = example()) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-direction-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const brandDir = path.join(root, '.starciwork', 'brand');
  fs.mkdirSync(path.join(brandDir, 'assets', 'direction'), { recursive: true });
  const png = Buffer.from('89504e470d0a1a0a-list-desktop', 'utf8');
  fs.writeFileSync(path.join(brandDir, 'assets', 'direction', 'list--desktop.png'), png);
  fs.writeFileSync(path.join(brandDir, 'assets', 'direction', 'list--desktop.html'), '<main data-grammar-component="PageContainer"></main>');
  const withGolden = { ...direction, golden: [{ archetype: 'list', html: 'assets/direction/list--desktop.html', png: 'assets/direction/list--desktop.png', sha256: sha(png), breakpoint: 'desktop' }] };
  fs.writeFileSync(path.join(brandDir, 'index.yaml'), stringifyYaml(record(withGolden)));
  const receipt = (question, { answeredBy = 'owner', optionIndex = 0, dispatchId = 'ctx_dir_1', note = null } = {}) => {
    const dir = path.join(root, '.starciwork', 'kernel-evidence', 'wf-1', 'serve-ask');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `answer-${Date.now()}${Math.floor(Math.random() * 1000)}.json`);
    fs.writeFileSync(file, JSON.stringify({ schema: 'starci/ask-answer@1', workflowId: 'wf-1', dispatchId, opId: 'brand.decide', option: question.options[optionIndex], optionIndex, answeredBy, note, at: '2026-09-27T10:00:00.000Z', review: question.review }));
    return file;
  };
  return { root, work: path.join(root, '.starciwork'), brandDir, receipt, readDirection: () => parseYaml(fs.readFileSync(path.join(brandDir, 'index.yaml'), 'utf8')).brand.direction };
}

test('the Nivo example is a valid proposed direction with the owner corrections applied and the main colour left open', () => {
  const direction = example();
  const validators = loadWorkSchemaValidators(ROOT);
  assert.equal(validators.error, null, validators.error);
  const validate = validators.validators.get('work/brand@1').validate;
  assert.equal(validate(record(direction)), true, JSON.stringify(validate.errors, null, 2));
  assert.equal(direction.status, 'proposed');
  assert.deepEqual(Object.keys(direction.archetypes).sort(), ['dashboard', 'detail', 'empty', 'form', 'list', 'wizard']);
  assert.ok(Object.values(direction.archetypes).every((a) => a.status === 'proposed'), 'nothing in the example is accepted');
  assert.deepEqual(direction.golden, []);
  assert.deepEqual(direction.vocabulary.notice.dna, ['Alert'], 'notices are DNA Alert');
  assert.deepEqual(direction.vocabulary.meter.dna, ['Meter'], 'ratios are DNA Meter');
  assert.deepEqual(direction.vocabulary.meter.proposals.map((p) => [p.component, p.variant, p.status]), [['Meter', 'segmented', 'pending']]);
  assert.match(direction.vocabulary.iconTile.tones.neutral, /identity/, 'identity tiles are neutral');
  assert.equal(direction.vocabulary.iconTile.tones.accent, undefined, 'no accent identity tone');
  assert.equal(direction.geometry.canvas.token, '--background', 'HeroUI default canvas');
  const pending = direction.pendingRulings.find((r) => r.id === 'main-colour');
  assert.equal(pending.status, 'open');
  assert.match(pending.question, /#040d1c/);
  const result = checkDirection({ brand: { direction }, family: 'starci', grammarRoot: GRAMMAR, brandDir: ROOT });
  assert.equal(result.outcome, 'pass', result.detail);
  assert.deepEqual(result.evidence.ready, []);
  assert.deepEqual(result.evidence.pendingRulings, ['main-colour']);
});

test('every example recipe and archetype component is one the starci DNA renders', () => {
  const names = new Set(grammarComponentNames({ family: 'starci', grammarRoot: GRAMMAR }).names);
  assert.ok(names.has('Alert') && names.has('Meter') && names.has('IconTile'));
  const direction = example();
  for (const [name, recipe] of Object.entries(direction.vocabulary)) for (const c of recipe.dna) assert.ok(names.has(c), `${name}: ${c}`);
  for (const [name, a] of Object.entries(direction.archetypes)) for (const c of a.components ?? []) assert.ok(names.has(c), `${name}: ${c}`);
});

test('direction check: absent passes, an invented component, a bad archetype and an accepted archetype without the owner fail', () => {
  const run = (direction) => checkDirection({ brand: { direction }, family: 'starci', grammarRoot: GRAMMAR, brandDir: ROOT });
  assert.equal(run(undefined).outcome, 'pass');
  assert.equal(CHECK_IDS.at(-1), 'direction');
  const invented = example();
  invented.vocabulary.notice.dna = ['CalloutCard'];
  assert.match(run(invented).detail, /CalloutCard/);
  const odd = example();
  odd.archetypes.landing = { ...odd.archetypes.list };
  delete odd.archetypes.list.whenNotToUse;
  const oddResult = run(odd);
  assert.equal(oddResult.outcome, 'fail');
  assert.match(oddResult.detail, /landing is not one of/);
  assert.match(oddResult.detail, /list lacks whenNotToUse/);
  const selfAccepted = example();
  selfAccepted.archetypes.list.status = 'accepted';
  const selfResult = run(selfAccepted);
  assert.equal(selfResult.outcome, 'fail');
  assert.match(selfResult.detail, /no golden render/);
  assert.match(selfResult.detail, /no acceptance names the owner answer/);
  const dupe = example();
  dupe.rubric.checks.push({ ...dupe.rubric.checks[0] });
  assert.match(run(dupe).detail, /declared twice/);
});

test('the review question is never auto-accepted, and only the owner accepting it makes the archetype ready', (t) => {
  const fx = repo(t);
  const question = directionReviewQuestion(fx.work, { archetype: 'list' });
  assert.equal(question.kind, DIRECTION_REVIEW_KIND);
  assert.equal(question.review.schema, DIRECTION_REVIEW_SCHEMA);
  assert.equal(question.review.archetype, 'list');
  assert.equal(question.review.directionRev, 1);
  assert.equal(question.recommended, undefined);
  assert.deepEqual(question.assets.map((a) => a.path), ['.starciwork/brand/assets/direction/list--desktop.png']);
  const auto = autoAcceptDecision({ question: { ...question, recommended: 0 }, opId: 'brand.decide', secretFields: { files: [], vars: [] }, policy: { autoAcceptRecommended: true, excludes: [] } });
  assert.equal(auto.accept, false, 'a direction review is never answered automatically');
  assert.throws(() => directionReviewQuestion(fx.work, { archetype: 'dashboard' }), /no golden render/);
  assert.throws(() => directionReviewQuestion(fx.work, { archetype: 'landing' }), /must be one of/);

  assert.throws(() => applyDirectionReview(fx.work, fx.receipt(question, { answeredBy: AUTO_ACCEPTED_BY }), { write: true }), /only the owner accepts/);
  const revise = applyDirectionReview(fx.work, fx.receipt(question, { optionIndex: 1, note: 'tighter summary' }), { write: true });
  assert.deepEqual([revise.decision, revise.written, revise.brief], ['revise', false, 'tighter summary']);
  assert.equal(fx.readDirection().archetypes.list.status, 'proposed');

  const accepted = applyDirectionReview(fx.work, fx.receipt(question), { write: true });
  assert.equal(accepted.decision, 'accept');
  const direction = fx.readDirection();
  assert.equal(direction.status, 'accepted');
  assert.equal(direction.archetypes.list.status, 'accepted');
  assert.deepEqual(direction.archetypes.list.acceptance, { acceptedBy: 'ctx_dir_1', receipt: accepted.acceptance.receipt, acceptedAt: '2026-09-27T10:00:00.000Z', rev: 1 });
  assert.deepEqual(directionStatus(fx.work).ready, ['list']);
  const validate = loadWorkSchemaValidators(ROOT).validators.get('work/brand@1').validate;
  assert.equal(validate(parseYaml(fs.readFileSync(path.join(fx.brandDir, 'index.yaml'), 'utf8'))), true, JSON.stringify(validate.errors));
  const checks = runBrandChecks({ tree: fx.work, grammarRoot: GRAMMAR });
  const result = checks.checks.find((c) => c.id === 'direction');
  assert.equal(result.outcome, 'pass', result.detail);
  assert.deepEqual(result.evidence.ready, ['list']);
});

test('an acceptance goes stale when the golden is redrawn, the rev moves, or the receipt is not the owner answer', (t) => {
  const fx = repo(t);
  const question = directionReviewQuestion(fx.work, { archetype: 'list' });
  applyDirectionReview(fx.work, fx.receipt(question), { write: true });
  const file = path.join(fx.brandDir, 'index.yaml');
  const saved = fs.readFileSync(file, 'utf8');
  const direction = () => runBrandChecks({ tree: fx.work, grammarRoot: GRAMMAR }).checks.find((c) => c.id === 'direction');

  fs.writeFileSync(path.join(fx.brandDir, 'assets', 'direction', 'list--desktop.png'), 'redrawn');
  assert.match(direction().detail, /no longer hashes/);
  const redrawn = parseYaml(saved);
  redrawn.brand.direction.golden[0].sha256 = sha('redrawn');
  fs.writeFileSync(file, stringifyYaml(redrawn));
  assert.match(direction().detail, /changed after the owner reviewed it/);

  fs.writeFileSync(path.join(fx.brandDir, 'assets', 'direction', 'list--desktop.png'), Buffer.from('89504e470d0a1a0a-list-desktop', 'utf8'));
  const bumped = parseYaml(saved);
  bumped.brand.direction.rev = 2;
  fs.writeFileSync(file, stringifyYaml(bumped));
  assert.match(direction().detail, /has not seen this revision/);

  const forged = parseYaml(saved);
  const autoReceipt = fx.receipt(question, { answeredBy: AUTO_ACCEPTED_BY, dispatchId: 'ctx_dir_auto' });
  forged.brand.direction.archetypes.list.acceptance = { acceptedBy: 'ctx_dir_auto', receipt: path.relative(fx.root, autoReceipt).split(path.sep).join('/'), acceptedAt: '2026-09-27T10:00:00Z', rev: 1 };
  fs.writeFileSync(file, stringifyYaml(forged));
  assert.match(direction().detail, /not the owner/);
});
