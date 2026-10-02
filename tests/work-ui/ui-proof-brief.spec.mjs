import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { readSnapshot } from '../../scripts/work/ui/grammar-geometry.mjs';
import { briefText, buildBrief, classifyCase, classValue, loadKnowledge, spacingChecks, surfaceElements, uiProofBriefMain } from '../../scripts/work/ui/ui-proof-brief.mjs';
import { buildGeometryRepo, snapshotOf } from '../fixtures/grammar-geometry.mjs';

// The 2026-09-27 draw bake-off found every drawing's padding wrong: the presentation knowledge was never
// loaded into the brief. ui-proof-brief.mjs emits every knowledge/ui case a surface's elements bring into
// play, with the numbers the product CSS resolves them to, names conflicts instead of picking, and scores a
// render with a padding/spacing section.
const knowledge = loadKnowledge();
const FORM_RECORD = {
  schema: 'work/ui-screen@1', id: 'ui.fixture.handoff',
  ui: {
    intent: 'A mobile form inside a joined SurfaceCard with bands',
    coverage: { map: [{ components: ['SurfaceCard (composition: joined)', 'Input (variant: secondary)', 'Button (variant: primary)', 'Badge (tone: neutral)'] }] },
    states: [{ name: 'prepared', behavior: 'handoff prepared, not sent' }],
  },
};
const PLAIN_RECORD = { schema: 'work/ui-screen@1', id: 'ui.fixture.plain', ui: { intent: 'A reading page', coverage: { map: [{ components: ['Heading (level 1)', 'Text'] }] } } };
const caseOf = (brief, file, rule, id) => brief.topics.find((t) => t.path.endsWith(file))?.cases.find((c) => c.rule === rule && c.case === id);
const skippedOf = (brief, file, key) => brief.topics.find((t) => t.path.endsWith(file))?.skipped.find((s) => s.id === key);

test('a surface declares its element kinds and components from its record', () => {
  const e = surfaceElements(FORM_RECORD);
  for (const k of ['field', 'button', 'card', 'nested', 'badge', 'control', 'heading', 'text', 'page']) assert.ok(e.kinds.has(k), k);
  assert.equal(e.kinds.has('selection'), false);
  for (const c of ['SurfaceCard', 'Input', 'Button', 'Badge', 'PageContainer']) assert.ok(e.components.has(c), c);
  const plain = surfaceElements(PLAIN_RECORD, { extra: ['row'] });
  assert.equal(plain.kinds.has('field'), false);
  assert.equal(plain.kinds.get('row'), '--elements');
});

test('a case applies only when every kind its `when` names is present; lens and run bookkeeping are listed, not dropped', () => {
  const e = surfaceElements(FORM_RECORD);
  assert.equal(classifyCase({ governs: 'x' }, { when: 'An input sits inside a surface (card, panel, band)' }, e).applies, true);
  assert.match(classifyCase({ governs: 'x' }, { when: 'An input sits inside a surface (card, panel, band)' }, surfaceElements(PLAIN_RECORD)).reason, /needs field/);
  assert.equal(classifyCase({ governs: 'x' }, { when: 'The lens runs' }, e).reason, 'evaluation lens bookkeeping');
  assert.equal(classifyCase({ governs: 'x' }, { when: 'The run submits a deliberately wrong value' }, e).reason, 'observed only in a running UAT');
  assert.match(classifyCase({ governs: 'x' }, { when: 'Content inside a card', owner: '`EmptyNotice`' }, e).reason, /owner EmptyNotice/);
  assert.equal(classifyCase({ governs: 'x' }, { when: 'Content inside a card', owner: '`App`' }, e).applies, true, 'App owns a class the application writes; it is never a component to look for');
});

test('the brief carries every applicable proof case, the presentation numbers, and names each conflict', (t) => {
  const fx = buildGeometryRepo();
  t.after(fx.cleanup);
  const brief = buildBrief({ record: FORM_RECORD, repo: fx.repo, knowledge });
  assert.equal(brief.geometry.ok, true);
  assert.ok(caseOf(brief, 'proof/anatomy-source.yaml', 'ANATOMY-2', 'case-1'), 'a field inside a surface brings ANATOMY-2 case-1');
  assert.ok(caseOf(brief, 'proof/contrast.yaml', 'COLOR-3', 'case-6'));
  const p = caseOf(brief, 'presentation/padding.yaml', 'PADDING-4', 'case-2');
  assert.ok(p.numbers.some((n) => /1rem = 16px/.test(n.text)), JSON.stringify(p.numbers));
  const band = caseOf(brief, 'presentation/padding.yaml', 'PADDING-3', 'case-3');
  assert.ok(band.numbers.some((n) => n.text === 'py-3 = 12px'), JSON.stringify(band.numbers));
  const gap = caseOf(brief, 'presentation/gap.yaml', 'GAP-2', 'case-4');
  assert.ok(gap.numbers.some((n) => /--grammar-inline-gap in the product CSS/.test(n.what) && /8px at 390px/.test(n.text)), JSON.stringify(gap.numbers));
  assert.ok(brief.topics.find((t2) => t2.path.endsWith('presentation/padding.yaml')).guidance.some((g) => g.id === 'side-contact' && /\.75rem \(12px\)/.test(g.requirement)));
  const kinds = brief.conflicts.map((c) => c.kind);
  assert.ok(!brief.conflicts.some((c) => /--nivo-surface-radius/.test(c.text)), 'a declared, unread family token is a geometry fact, not a conflict');
  assert.match(briefText(brief), /read by nothing, so never drawn: --nivo-surface-radius 1.5rem/);
  assert.ok(brief.conflicts.some((c) => c.kind === 'knowledge-vs-css' && /SurfaceCard "content, composition!="joined"/.test(c.text) && /20px/.test(c.text)), kinds.join(', '));
  assert.ok(!brief.conflicts.some((c) => /TASTE-7/.test(c.text)), 'a pill button inside a 16px card is its own shape under TASTE-7 case-4');
  const text = briefText(brief);
  assert.match(text, /^UI PROOF BRIEF - ui\.fixture\.handoff/);
  assert.match(text, /knowledge\/ui\/proof\/anatomy-source\.yaml ANATOMY-2 case-1/);
  assert.match(text, /not applicable: /);
  const plain = buildBrief({ record: PLAIN_RECORD, repo: fx.repo, knowledge });
  assert.match(skippedOf(plain, 'proof/contrast.yaml', 'COLOR-3 case-6').reason, /needs field/);
});

// Owner, 2026-09-28 (StarCi Next SignInBase#signed-out): the sign-in card stretched the full 1184px content region
// and a Checkbox on the card kept the primary variant. MEASURE-4 case-3 read "a game table" as needing a row, so a
// form never got it; the measure and layer cases now apply by component presence (`elements`), not by prose.
const SIGN_IN_RECORD = {
  schema: 'work/ui-screen@1', id: 'ui.identity.sign-in',
  ui: { intent: 'Sign in', coverage: { map: [{ components: ['Input (kind: email)', 'Checkbox', 'Button (variant: primary)'] }] } },
};

test('a case with `elements` applies by component presence: every shape brings MEASURE-4 and ANATOMY-2', () => {
  const e = surfaceElements(SIGN_IN_RECORD);
  assert.equal(e.kinds.has('row'), false);
  assert.equal(e.kinds.has('card'), false, 'the record names no card: the case must still reach the brief');
  assert.equal(classifyCase({ governs: 'x' }, { when: 'a game table', elements: ['field', 'row'] }, e).applies, true);
  assert.equal(classifyCase({ governs: 'x' }, { when: 'a game table', elements: ['field', 'row'] }, e).from, 'elements');
  assert.match(classifyCase({ governs: 'x' }, { when: 'a form', elements: ['field'] }, surfaceElements(PLAIN_RECORD)).reason, /needs field/);
  const brief = buildBrief({ record: SIGN_IN_RECORD, knowledge });
  for (const [file, rule, id] of [['presentation/measure.yaml', 'MEASURE-4', 'case-3'], ['presentation/measure.yaml', 'MEASURE-4', 'case-4'],
    ['proof/anatomy-source.yaml', 'ANATOMY-2', 'case-1'], ['proof/anatomy-source.yaml', 'ANATOMY-2', 'case-3']]) {
    assert.ok(caseOf(brief, file, rule, id), `${rule} ${id} reaches a shape with fields`);
  }
  assert.match(briefText(brief), /MEASURE-4 case-4/);
  assert.match(briefText(brief), /DRAW_NESTED_VARIANT/);
  const plain = buildBrief({ record: PLAIN_RECORD, knowledge });
  assert.ok(caseOf(plain, 'presentation/measure.yaml', 'MEASURE-4', 'case-4'), 'the measure and layer rules are standard principles of every shape');
  assert.ok(caseOf(plain, 'proof/anatomy-source.yaml', 'ANATOMY-2', 'case-3'));
});

test('class values resolve through the family: spacing, radius ramp, type scale', (t) => {
  const fx = buildGeometryRepo();
  t.after(fx.cleanup);
  const brief = buildBrief({ record: PLAIN_RECORD, repo: fx.repo, knowledge });
  const g = brief.geometry;
  const root = g.resolver.memo('root-390', [g.chains.html, g.chains.root], 390);
  const scope = { variable: (n) => root.variable(n) };
  assert.equal(classValue('px-4', scope).px, 16);
  assert.equal(classValue('sm:px-6', scope).variant, 'sm');
  assert.equal(classValue('rounded-3xl', scope).px, 24);
  assert.equal(classValue('rounded-full', scope).px, Infinity);
  assert.deepEqual([classValue('text-xl', scope).px, classValue('text-xl', scope).lineHeight], [20, 28]);
  assert.equal(classValue('bg-surface', scope), null);
});

test('the spacing section measures page inset, joined band side-contact, field gaps and the closed scale', () => {
  const ctx = { knowledge, pageInset: 16, cardInset: 16, edgeInset: 16, separatorInset: 12, inputGap: 8, fieldGap: 16, badgeGap: 8, width: 390, height: 844 };
  const hair = { w: 1, style: 'solid', color: [230, 230, 230, 1] };
  const none = { w: 0, style: 'none', color: [0, 0, 0, 0] };
  const snap = snapshotOf([
    { tag: 'main', x: 0, y: 0, w: 390, h: 900 },
    { parent: 0, tag: 'section', x: 16, y: 24, w: 358, h: 200, style: { bg: [255, 255, 255, 1], radius: 16, shadow: 'rgba(0, 0, 0, 0.04) 0px 2px 4px 0px' } },
    { parent: 1, x: 16, y: 24, w: 358, h: 48, style: { padding: [16, 16, 12, 16] } },
    { parent: 2, tag: 'p', x: 32, y: 40, w: 300, h: 20, own: 'Prepared, not sent' },
    { parent: 1, x: 16, y: 72, w: 358, h: 152, style: { padding: [12, 16, 16, 16], border: [hair, none, none, none], rowGap: 10 } },
    { parent: 4, tag: 'label', x: 32, y: 85, w: 200, h: 20, own: 'Fingerprint', labelText: null },
    { parent: 4, tag: 'input', x: 32, y: 113, w: 326, h: 40, labelText: 'Fingerprint', style: { bg: [236, 235, 235, 1], radius: 12 } },
    { parent: 4, tag: 'label', x: 32, y: 163, w: 200, h: 20, own: 'Revision' },
    { parent: 4, tag: 'input', x: 32, y: 187, w: 326, h: 21, labelText: 'Revision', style: { bg: [236, 235, 235, 1], radius: 12, padding: [0, 10, 0, 10] } },
  ]);
  const v = readSnapshot(snap);
  const rows = spacingChecks(v, ctx);
  const by = (id) => rows.filter((r) => r.id === id);
  assert.equal(by('page-inset')[0].status, 'pass');
  assert.equal(by('band separators edge to edge')[0].status, 'pass');
  assert.deepEqual(by('band 1 top').map((r) => [r.got, r.status]), [[16, 'pass']]);
  assert.deepEqual(by('band 1 bottom').map((r) => [r.got, r.status]), [[12, 'pass']]);
  assert.deepEqual(by('band 2 top').map((r) => [r.got, r.status]), [[12, 'pass']]);
  assert.deepEqual(by('label to control').map((r) => r.got), [8, 4]);
  assert.equal(by('label to control')[1].status, 'fail');
  assert.equal(by('field to field')[0].got, 10);
  assert.equal(by('band 2 bottom')[0].got, 16);
  const scale = by('closed-scale')[0];
  assert.equal(scale.status, 'fail');
  assert.match(scale.evidence, /row-gap 10px/);
  assert.doesNotMatch(scale.evidence, /input/, 'a control owns its inner padding; the closed scale judges app-owned boxes');
});

// Two product pages - a login and a subscription one - showed it: the page inset is PageContainer's
// inline padding, not the x of a card a capped measure centres (MEASURE-4 case-3) or a centred page's auto margin.
test('page-inset reads the page box padding: a centred compact card and a centred PageContainer pass, a card in the padding fails', () => {
  const ctx = { knowledge, pageInset: 32, cardInset: 16, edgeInset: 16, separatorInset: 12, inputGap: 8, fieldGap: 16, badgeGap: 8, width: 1440, height: 900 };
  const card = { bg: [255, 255, 255, 1], radius: 16, shadow: 'rgba(0, 0, 0, 0.04) 0px 2px 4px 0px', padding: [16, 16, 16, 16] };
  const insetOf = (els) => spacingChecks(readSnapshot(snapshotOf(els, { width: 1440, height: 900 })), ctx).find((r) => r.id === 'page-inset');
  // nivo: <main> pads 32px, a 440px formCompact card centred in it at x=500.
  const compact = insetOf([
    { tag: 'main', x: 0, y: 0, w: 1440, h: 900, style: { padding: [32, 32, 32, 32] } },
    { parent: 0, tag: 'section', x: 500, y: 200, w: 440, h: 400, style: card },
    { parent: 1, tag: 'p', x: 516, y: 216, w: 300, h: 20, own: 'Sign in' },
  ]);
  assert.deepEqual([compact.got, compact.status], [32, 'pass'], compact.evidence);
  // A second product page: an 80rem .page centred by margin-inline:auto at x=80 with 32px padding; the card at 112 = 80 + 32.
  const centred = insetOf([
    { tag: 'div', x: 0, y: 0, w: 1440, h: 900 },
    { parent: 0, tag: 'main', x: 80, y: 0, w: 1280, h: 900, style: { padding: [32, 32, 32, 32], margin: [0, 80, 0, 80] } },
    { parent: 1, tag: 'section', x: 112, y: 100, w: 808, h: 400, style: card },
    { parent: 2, tag: 'p', x: 128, y: 116, w: 300, h: 20, own: 'Benefits' },
  ]);
  assert.deepEqual([centred.got, centred.status], [32, 'pass'], centred.evidence);
  // A card pulled into the padding by a negative margin is measured where it sits.
  const intruding = insetOf([
    { tag: 'main', x: 0, y: 0, w: 1440, h: 900, style: { padding: [32, 32, 32, 32] } },
    { parent: 0, tag: 'section', x: 8, y: 100, w: 1400, h: 400, style: card },
    { parent: 1, tag: 'p', x: 24, y: 116, w: 300, h: 20, own: 'Wide' },
  ]);
  assert.deepEqual([intruding.got, intruding.status], [8, 'fail']);
  // A page box padded off the inset still fails, and a card with no padded page is measured from the viewport.
  assert.equal(insetOf([
    { tag: 'main', x: 0, y: 0, w: 1440, h: 900, style: { padding: [24, 24, 24, 24] } },
    { parent: 0, tag: 'section', x: 500, y: 100, w: 440, h: 400, style: card },
    { parent: 1, tag: 'p', x: 516, y: 116, w: 300, h: 20, own: 'Off' },
  ]).status, 'fail');
  assert.deepEqual((({ got, status }) => [got, status])(insetOf([
    { tag: 'main', x: 0, y: 0, w: 1440, h: 900 },
    { parent: 0, tag: 'section', x: 500, y: 100, w: 440, h: 400, style: card },
    { parent: 1, tag: 'p', x: 516, y: 116, w: 300, h: 20, own: 'Bare' },
  ])), [500, 'fail']);
});

test('a disclosure card is measured at its trigger padding (PADDING-4 case-3), never as SurfaceCard content', () => {
  const ctx = { knowledge, pageInset: 16, cardInset: 16, edgeInset: 16, separatorInset: 12, inputGap: 8, fieldGap: 16, badgeGap: 8, width: 390, height: 844 };
  const shell = { bg: [255, 255, 255, 1], radius: 16, shadow: 'rgba(0, 0, 0, 0.04) 0px 2px 4px 0px' };
  const rows = (summaryPad) => spacingChecks(readSnapshot(snapshotOf([
    { tag: 'main', x: 0, y: 0, w: 390, h: 844, style: { padding: [16, 16, 16, 16] } },
    { parent: 0, tag: 'details', x: 16, y: 100, w: 358, h: 52, style: shell },
    { parent: 1, tag: 'summary', x: 16, y: 100, w: 358, h: 52, own: 'Payment and access', style: { padding: summaryPad } },
  ])), ctx);
  const good = rows([16, 16, 16, 16]);
  assert.equal(good.filter((r) => /^card-inset/.test(r.id)).length, 0, 'the <details> root owns no inset');
  assert.deepEqual(good.filter((r) => /^disclosure trigger inset/.test(r.id)).map((r) => r.status), ['pass', 'pass', 'pass', 'pass']);
  const tight = rows([12, 16, 12, 16]);
  assert.deepEqual(tight.filter((r) => /^disclosure trigger inset (top|bottom)$/.test(r.id)).map((r) => [r.got, r.status]), [[12, 'fail'], [12, 'fail']], 'Grammar\'s trigger is row-inset 1rem');
});

test('an inline badge on a band\'s first line is read at the band\'s content edge, not its line-box offset', () => {
  const ctx = { knowledge, pageInset: 16, cardInset: 16, edgeInset: 16, separatorInset: 12, inputGap: 8, fieldGap: 16, badgeGap: 8, width: 390, height: 844 };
  const hair = { w: 1, style: 'solid', color: [230, 230, 230, 1] };
  const none = { w: 0, style: 'none', color: [0, 0, 0, 0] };
  const band1 = (pad, badgeY) => spacingChecks(readSnapshot(snapshotOf([
    { tag: 'main', x: 0, y: 0, w: 390, h: 900, style: { padding: [16, 16, 16, 16] } },
    { parent: 0, tag: 'section', x: 16, y: 100, w: 358, h: 200, style: { bg: [255, 255, 255, 1], radius: 16, shadow: 'rgba(0, 0, 0, 0.04) 0px 2px 4px 0px' } },
    { parent: 1, x: 16, y: 100, w: 358, h: 60, style: { padding: [pad, 16, 12, 16], fontSize: 16, lineHeight: null } },
    { parent: 2, tag: 'span', x: 32, y: badgeY, w: 68, h: 20, own: 'AVAILABLE', style: { display: 'inline-flex', bg: [238, 238, 255, 1], padding: [0, 4, 0, 4], radius: 999 } },
    { parent: 1, x: 16, y: 160, w: 358, h: 140, style: { padding: [12, 16, 16, 16], border: [hair, none, none, none] } },
    { parent: 4, tag: 'p', x: 32, y: 173, w: 300, h: 20, own: 'Details' },
  ])), ctx).find((r) => r.id === 'band 1 top');
  assert.deepEqual((({ got, status }) => [got, status])(band1(16, 118)), [16, 'pass'], 'padding-top 16px; the badge sits 2px lower in its line box');
  assert.deepEqual((({ got, status }) => [got, status])(band1(24, 126)), [24, 'fail'], 'a wrong band padding still fails');
});

test('the CLI fails closed on a bad argument', async () => {
  assert.equal((await uiProofBriefMain(['--surface', 'x'])).exitCode, 2);
  assert.equal((await uiProofBriefMain(['--elements', 'widget', '--repo', '.'])).exitCode, 2);
  assert.equal((await uiProofBriefMain(['--surface', path.join('no', 'such', 'record'), '--repo', '.'])).exitCode, 2);
  assert.ok(fs.existsSync(path.join(import.meta.dirname, '..', '..', 'knowledge', 'ui', 'proof', 'anatomy-source.yaml')));
});
