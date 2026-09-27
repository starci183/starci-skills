import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { readSnapshot } from '../scripts/checks/grammar-geometry.mjs';
import { briefText, buildBrief, classifyCase, classValue, loadKnowledge, spacingChecks, surfaceElements, uiProofBriefMain } from '../scripts/checks/ui-proof-brief.mjs';
import { buildGeometryRepo, snapshotOf } from './fixtures/grammar-geometry.mjs';

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
  assert.match(skippedOf(plain, 'proof/anatomy-source.yaml', 'ANATOMY-2 case-1').reason, /needs field/);
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

test('the CLI fails closed on a bad argument', async () => {
  assert.equal((await uiProofBriefMain(['--surface', 'x'])).exitCode, 2);
  assert.equal((await uiProofBriefMain(['--elements', 'widget', '--repo', '.'])).exitCode, 2);
  assert.equal((await uiProofBriefMain(['--surface', path.join('no', 'such', 'record'), '--repo', '.'])).exitCode, 2);
  assert.ok(fs.existsSync(path.join(import.meta.dirname, '..', 'knowledge', 'ui', 'proof', 'anatomy-source.yaml')));
});
