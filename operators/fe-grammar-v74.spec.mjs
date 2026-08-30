import assert from 'node:assert/strict';
import test from 'node:test';
import { validateGrammarAudit } from '../runtime/contracts/grammar-audit.mjs';
import { fingerprintGrammarDecision, validateGrammarDecision } from '../runtime/contracts/grammar-decision.mjs';

const binding = (name) => ({ package: name, version: '0.4.0', integrity: `sha256:${'a'.repeat(64)}`, exportMapFingerprint: `sha256:${'b'.repeat(64)}` });
const base = () => {
  const manifest = {
    schemaVersion: 1, contractVersion: '7.4.0', manifestId: 'grammar://personal-project', targetRef: 'surface://personal-project',
    grammar: { common: binding('@starci/grammar-common'), selected: binding('@starci/grammar-core') },
    semanticComposition: [
      { instanceRef: 'composition://intro', patternRef: 'pattern://ContextIntro', ownerRef: 'owner://intro', ownerLayer: 'grammar', authorityRef: 'grammar://core/SectionHeader', slots: [
        { slotRef: 'eyebrow', semanticRole: 'context', cardinality: 'one', order: 0 }, { slotRef: 'heading', semanticRole: 'identity', cardinality: 'one', order: 1 }, { slotRef: 'description', semanticRole: 'support', cardinality: 'one', order: 2 }] },
      { instanceRef: 'composition://rail', patternRef: 'pattern://RightRail', ownerRef: 'owner://rail', ownerLayer: 'grammar', authorityRef: 'grammar://core/Rail', slots: [{ slotRef: 'content', semanticRole: 'support', cardinality: 'many', order: 0 }] }],
    requiredDecisionRefs: ['decision://eyebrow', 'decision://heading', 'decision://description', 'decision://rail-space', 'decision://rail-sticky'],
    decisions: [
      { decisionRef: 'decision://eyebrow', ownerRef: 'owner://intro', kind: 'typography', semanticRole: 'context-intro.eyebrow', tokenRefs: ['token://type/text-xs', 'token://color/accent'], evidenceRefs: ['request://teacher'] },
      { decisionRef: 'decision://heading', ownerRef: 'owner://intro', kind: 'typography', semanticRole: 'context-intro.heading', tokenRefs: ['token://type/contextual-heading'], evidenceRefs: ['request://teacher'] },
      { decisionRef: 'decision://description', ownerRef: 'owner://intro', kind: 'typography', semanticRole: 'context-intro.description', tokenRefs: ['token://type/text-sm', 'token://color/muted'], evidenceRefs: ['request://teacher'] },
      { decisionRef: 'decision://rail-space', ownerRef: 'owner://rail', kind: 'spacing', semanticRole: 'navigation.right-rail.content', tokenRefs: ['token://space/inline-3', 'token://space/block-6'], evidenceRefs: ['request://teacher'] },
      { decisionRef: 'decision://rail-sticky', ownerRef: 'owner://rail', kind: 'sticky', semanticRole: 'navigation.right-rail.persistence', tokenRefs: ['token://position/persistent-support'], evidenceRefs: ['request://teacher'], sticky: { scrollOwnerRef: 'scroll://page', edge: 'block-start', offsetTokenRef: 'token://space/shell-header', collisionBoundaryRef: 'boundary://content', stopRef: 'stop://content-end', fallbackPatternRef: 'pattern://flow-below-primary' } }],
    responsiveBindings: ['owner://intro', 'owner://rail'].flatMap((ownerRef) => ['wide', 'intermediate', 'compact'].map((range) => ({ ownerRef, range, patternRef: `pattern://${range}` }))),
    gapRefs: [], manifestFingerprint: ''
  };
  manifest.manifestFingerprint = fingerprintGrammarDecision(manifest); return manifest;
};

test('Grammar 7.4 accepts complete semantic composition authority', () => assert.deepEqual(validateGrammarDecision(base()), { valid: true, errors: [] }));
test('Grammar 7.4 rejects ContextIntro without the three-layer tokens', () => { const value = base(); value.decisions[0].tokenRefs = ['token://type/text-sm']; value.manifestFingerprint = fingerprintGrammarDecision(value); assert.match(validateGrammarDecision(value).errors.join('\n'), /text-xs|accent/); });
test('Grammar 7.4 rejects physical styling and incomplete sticky ownership', () => { const value = base(); value.decisions[3].tokenRefs = ['token://color/purple', 'token://space/px-3']; delete value.decisions[4].sticky; value.manifestFingerprint = fingerprintGrammarDecision(value); const errors = validateGrammarDecision(value).errors.join('\n'); assert.match(errors, /raw utility/); assert.match(errors, /sticky lifecycle/); });
test('Grammar 7.4 rejects unapproved proposals and misowned business anatomy', () => {
  const value = base();
  value.semanticComposition[0].patternRef = 'proposal://NewIntro';
  value.semanticComposition[1].ownerLayer = 'application-block';
  value.semanticComposition[1].authorityRef = 'grammar://core/Rail';
  value.manifestFingerprint = fingerprintGrammarDecision(value);
  const errors = validateGrammarDecision(value).errors.join('\n');
  assert.match(errors, /unapproved proposals/);
  assert.match(errors, /business creativity/);
});

const grammarAudit = () => ({
  schemaVersion: 1,
  targetRef: 'surface://learn-shell',
  grammarManifestRef: 'grammar://learn-shell',
  iconographyManifestRef: 'iconography://learn-shell',
  status: 'passed',
  checks: ['wide', 'intermediate', 'compact'].map((state) => ({
    ownerRef: 'owner://learn-rail',
    state,
    boundaryOwnerRefs: ['owner://learn-shell'],
    insetOwnerRefs: ['owner://learn-spine'],
    minimumInlineClearancePx: 12,
    inlineStartPx: 18,
    inlineEndPx: 18,
    dividerCount: 1,
    iconFamilyRefs: ['icon-family://heroicons-outline'],
    evidenceRefs: [`capture://${state}`]
  })),
  violations: [],
  evidenceRefs: ['capture://wide', 'capture://intermediate', 'capture://compact']
});

test('Grammar audit accepts one boundary, inset, divider, and icon family in every required responsive state', () => {
  assert.deepEqual(validateGrammarAudit(grammarAudit()), { valid: true, errors: [] });
});

test('Grammar audit rejects compounded owners, unsafe clearance, duplicate divider, and mixed icon families', () => {
  const value = grammarAudit();
  value.status = 'failed';
  value.checks[2].boundaryOwnerRefs.push('owner://learn-spine');
  value.checks[2].insetOwnerRefs.push('owner://learn-shell');
  value.checks[2].inlineEndPx = 4;
  value.checks[2].dividerCount = 2;
  value.checks[2].iconFamilyRefs.push('icon-family://custom-navigation');
  value.violations = [
    { kind: 'duplicate-boundary-owner', ownerRef: 'owner://learn-rail', state: 'compact', evidenceRefs: ['capture://compact'] },
    { kind: 'duplicate-inset-owner', ownerRef: 'owner://learn-rail', state: 'compact', evidenceRefs: ['capture://compact'] },
    { kind: 'unsafe-inline-clearance', ownerRef: 'owner://learn-rail', state: 'compact', evidenceRefs: ['capture://compact'] },
    { kind: 'duplicate-divider', ownerRef: 'owner://learn-rail', state: 'compact', evidenceRefs: ['capture://compact'] },
    { kind: 'mixed-icon-family', ownerRef: 'owner://learn-rail', state: 'compact', evidenceRefs: ['capture://compact'] }
  ];
  const errors = validateGrammarAudit(value).errors.join('\n');
  assert.match(errors, /duplicate boundary owners/);
  assert.match(errors, /duplicate inset owners/);
  assert.match(errors, /safe inline clearance/);
  assert.match(errors, /duplicate dividers/);
  assert.match(errors, /mixes icon families/);
});
