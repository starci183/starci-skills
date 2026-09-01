import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { canonicalMachine } from '../skills/route-machine.mjs';

const machine = canonicalMachine('starci-fe-process');
const skill = readFileSync(new URL('../skills/starci-fe-process/SKILL.md', import.meta.url), 'utf8');
const target = (state, outcome, extra = {}) => machine.states[state].on.find((edge) =>
  edge.when?.outputEquals?.outcome === outcome
  && Object.entries(extra).every(([key, value]) => edge.when?.outputEquals?.[key] === value))?.target;

test('frontend machine is runtime-owned and exposes exactly the nine retained FE operators', () => {
  assert.equal(Object.isFrozen(machine), true);
  const refs = [...new Set(Object.values(machine.states).map(({ ref }) => ref).filter(Boolean))].sort();
  assert.deepEqual(refs, [
    'fe/authority-reconcile',
    'fe/capture-preflight',
    'fe/direction-generate',
    'fe/progress-guard',
    'fe/render-capture',
    'fe/request-compile',
    'fe/return-consume',
    'fe/source-apply',
    'fe/visual-fidelity',
  ]);
});

test('author-once compile selects apply, one dominant preview, or an evidence-required alternatives WAIT', () => {
  assert.equal(target('request-compile', 'compiled', { 'result.directionMode': 'none' }), 'apply');
  assert.equal(target('request-compile', 'compiled', { 'result.directionMode': 'dominant' }), 'generate-dominant');
  assert.equal(target('request-compile', 'compiled', { 'result.directionMode': 'alternatives' }), 'generate-alternatives');
  assert.equal(target('generate-dominant', 'generated'), 'apply');
  assert.equal(target('generate-alternatives', 'generated'), 'direction-choice');
  assert.equal(machine.states['direction-choice'].kind, 'wait');
  assert.equal(machine.states['direction-choice'].approval.resumeTarget, 'apply');
  assert.match(machine.states['direction-choice'].approval.prompt, /three or four rendered frontend directions/i);
});

test('Grammar gaps publish through the exact owner and resume compilation', () => {
  assert.equal(target('request-compile', 'grammar-required'), 'grammar-repair-publish');
  assert.equal(machine.states['grammar-repair-publish'].ref, 'fe/authority-reconcile');
  assert.equal(target('grammar-repair-publish', 'reconciled'), 'request-compile');
});

test('the direct UI spine has one apply-repair path and one bounded recapture path', () => {
  assert.equal(target('apply', 'applied'), 'capture-preflight');
  assert.equal(target('capture-preflight', 'source-repair'), 'reapply');
  assert.equal(target('capture-preflight', 'ready'), 'capture');
  assert.equal(target('capture', 'captured'), 'visual-fidelity');
  assert.equal(target('visual-fidelity', 'repair'), 'reapply');
  assert.equal(target('visual-fidelity', 'insufficient-evidence'), 'recapture-preflight');
  assert.equal(target('reapply', 'applied'), 'recapture-preflight');
  assert.equal(target('recapture-preflight', 'ready'), 'recapture');
  assert.equal(target('recapture', 'captured'), 'final-visual-fidelity');
  assert.equal(target('final-visual-fidelity', 'repair'), 'blocked');
  assert.equal(target('final-visual-fidelity', 'insufficient-evidence'), 'blocked');
});

test('business and backend authority leave through typed terminal handoffs only', () => {
  assert.equal(target('request-compile', 'business-required'), 'business-handoff');
  assert.equal(target('request-compile', 'backend-required'), 'backend-handoff');
  assert.equal(target('apply', 'backend-required'), 'backend-handoff');
  assert.equal(target('capture-preflight', 'backend-required'), 'backend-handoff');
  assert.equal(machine.states['business-handoff'].result, 'handoff');
  assert.equal(machine.states['backend-handoff'].result, 'handoff');
});

test('visual PASS can only hand off to Quality; completion remains behind Quality and UAT', () => {
  assert.equal(target('visual-fidelity', 'passed'), 'quality-handoff');
  assert.equal(target('final-visual-fidelity', 'passed'), 'quality-handoff');
  assert.notEqual(target('visual-fidelity', 'passed'), 'uat-handoff');
  assert.notEqual(target('visual-fidelity', 'passed'), 'complete');
  assert.equal(machine.states['quality-handoff'].result, 'handoff');
  assert.equal(machine.states['uat-handoff'].result, 'handoff');
  assert.equal(machine.states.complete.result, 'complete');
});

test('return correlation and no-progress protection are visible machine stages', () => {
  assert.equal(machine.states['consume-return'].ref, 'fe/return-consume');
  assert.equal(target('consume-return', 'consumed'), 'progress-guard');
  assert.equal(machine.states['progress-guard'].ref, 'fe/progress-guard');
  assert.equal(target('progress-guard', 'progress'), 'resume-route');
  assert.equal(target('progress-guard', 'cycle'), 'blocked');
});

test('skill narrative exposes the single compiled UI path without retired visible stages', () => {
  assert.match(skill, /request-compile/i);
  assert.match(skill, /direction-generate/i);
  assert.match(skill, /source-apply/i);
  assert.match(skill, /capture-preflight/i);
  assert.match(skill, /render-capture/i);
  assert.match(skill, /visual-fidelity/i);
  for (const retired of ['audit-route', 'direction-rank', 'finding-classify', 'source-repair', 'independent-review']) {
    assert.doesNotMatch(skill, new RegExp(`fe/${retired}\\b`, 'i'));
  }
});
