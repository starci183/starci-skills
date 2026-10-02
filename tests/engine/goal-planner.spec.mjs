import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const ROUTE_PLAN = path.join(ROOT, 'scripts', 'route', 'route-plan.mjs');
const run = text => spawnSync(process.execPath, [ROUTE_PLAN, '--text', text, '--json'], {
  cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 60000,
});
const body = result => JSON.parse(result.stdout);

test('Work and stack canonicalization derives the migration chain without generic record authoring', () => {
  const result = run('refactor and canonicalize .starciwork and .starcistacks against the current contracts');
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  const plan = body(result);
  assert.equal(plan.status, 'ok');
  assert.equal(plan.scopeKind, 'workspace-canonicalization');
  assert.deepEqual(plan.legs.map(leg => leg.op), [
    'scope.define',
    'test.author',
    'code.refactor',
    'workspace.manage',
    'review.verify',
    'handover.review',
  ]);
  assert.ok(!plan.legs.some(leg => leg.op === 'work.author'));
});

test('a canonical product landing request remains a feature scope', () => {
  const result = run('build the canonical NIVO public landing page');
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  const plan = body(result);
  assert.equal(plan.scopeKind, 'feature-build-with-ui');
  assert.ok(plan.legs.some(leg => leg.op === 'interface.implement'));
  const ops = plan.legs.map(leg => leg.op);
  assert.ok(ops.indexOf('interface.implement') < ops.indexOf('interface.audit'));
  // e2e runs manually only (owner ruling 2026-09-29): no uat.verify unless the prompt asks for it.
  assert.ok(ops.indexOf('interface.audit') < ops.indexOf('review.verify'));
  assert.ok(!ops.includes('uat.verify') && !ops.includes('e2e.verify'));
  assert.ok(!plan.legs.some(leg => leg.op === 'workspace.manage'));
});

test('e2e.verify and uat.verify join a chain only when the prompt explicitly asks for them', () => {
  const ops = prompt => body(run(prompt)).legs.map(leg => leg.op);
  const proofs = list => list.filter(op => op === 'e2e.verify' || op === 'uat.verify');
  assert.deepEqual(proofs(ops('build the backend API for wishlist')), []);
  assert.deepEqual(proofs(ops('build the wishlist screen frontend')), []);
  assert.deepEqual(proofs(ops('build Collab group chat end to end')), []);
  assert.deepEqual(proofs(ops('build the backend API for wishlist with e2e tests')), ['e2e.verify']);
  assert.deepEqual(proofs(ops('build the wishlist screen frontend and run UAT')), ['uat.verify']);
  assert.deepEqual(proofs(ops('build Collab group chat backend and frontend, e2e and uat')), ['e2e.verify', 'uat.verify']);
  assert.deepEqual(proofs(ops('build the backend API for wishlist, skip e2e')), []);
  const explicit = ops('build the wishlist screen frontend and run UAT');
  assert.ok(explicit.indexOf('interface.audit') < explicit.indexOf('uat.verify'), 'audit still precedes uat');
  assert.deepEqual(proofs(ops('prepare assisted UAT for the bank approval journey')), [], 'assisted UAT is its own lane');
});

test('assisted UAT preparation is a separate existing-build workflow', () => {
  const result = run('prepare assisted UAT for the bank approval journey');
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  const plan = body(result);
  assert.equal(plan.status, 'ok');
  assert.equal(plan.scopeKind, 'assisted-uat-prepare');
  assert.deepEqual(plan.legs.map(leg => leg.op), ['request.analyze', 'uat.assisted.prepare', 'handover.review']);
  assert.ok(!plan.legs.some(leg => leg.op === 'interface.implement'));
});

test('assisted UAT verification consumes the exact prepared package before acceptance', () => {
  const result = run('verify assisted UAT receipt for the bank approval journey');
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  const plan = body(result);
  assert.equal(plan.status, 'ok');
  assert.equal(plan.scopeKind, 'assisted-uat-verify');
  assert.deepEqual(plan.legs.map(leg => leg.op), ['request.analyze', 'uat.assisted.prepare', 'uat.assisted.verify', 'handover.review']);
  assert.ok(!plan.legs.some(leg => leg.op === 'uat.verify'));
});

test('Vietnamese prompts select archetypes through the archetypes.yaml phrase data', () => {
  const cases = [
    ['\u1ee9ng d\u1ee5ng h\u01a1i ch\u1eadm khi m\u1edf kho\u00e1 h\u1ecdc', 'investigate-first'],
    ['t\u00edch h\u1ee3p VNPay cho thanh to\u00e1n kho\u00e1 h\u1ecdc', 'external-integration'],
    ['t\u00e1i c\u1ea5u tr\u00fac module enrolment', 'refactor'],
    ['l\u00e0m giao di\u1ec7n m\u00e0n h\u00ecnh \u0111\u0103ng k\u00fd kho\u00e1 h\u1ecdc', 'feature-build-with-ui'],
    ['x\u00e2y d\u1ecbch v\u1ee5 \u0111\u0103ng k\u00fd kho\u00e1 h\u1ecdc', 'feature-build-backend'],
    ['ki\u1ec3m tra lint to\u00e0n repo', 'verify-only'],
  ];
  for (const [prompt, scopeKind] of cases) {
    for (const form of [prompt, prompt.normalize('NFD')]) {
      const result = run(form);
      assert.equal(result.status, 0, result.stderr || result.error?.message);
      assert.equal(body(result).scopeKind, scopeKind, `${JSON.stringify(form)} should select ${scopeKind}`);
    }
  }
});

test('diacritics are kept: "ch\u1ea5m \u0111i\u1ec3m" (grade) is not the "ch\u1eadm" (slow) signal', () => {
  const result = run('ch\u1ea5m \u0111i\u1ec3m b\u00e0i n\u1ed9p');
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  const plan = body(result);
  assert.equal(plan.status, 'needs-owner');
  assert.equal(plan.ambiguity?.tier, 'INTENT');
});

test('an ordinary behavior-invariant refactor retains the Work remap', () => {
  const result = run('refactor the enrolment service without changing behavior');
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  const plan = body(result);
  assert.equal(plan.scopeKind, 'refactor');
  assert.ok(plan.legs.some(leg => leg.op === 'work.author'));
  assert.ok(!plan.legs.some(leg => leg.op === 'workspace.manage'));
});

// The two owner prompts observed on one spec-and-scaffold project, verbatim.
// Both once derived the same generic ui+backend build chain because
// "frontend"/"backend" appear as repository nouns.
const SPEC_PROMPT = "Ho\u00e0n thi\u1ec7n .starciwork v\u00e0 .starcistacks cho Ecommerce App (Ecommerce App 2.0) trong repo m\u1edbi ecommerce-app (backend, s\u1edf h\u1eefu Work) v\u00e0 ecommerce-app-fe (frontend). Ngu\u1ed3n nghi\u1ec7p v\u1ee5: Work EcommerceApp hi\u1ec7n c\u00f3 \u1edf shop-be/.starciwork (16 feature: authoring, challenges, commerce, community, concepts, cv, gamification, identity, interviews, learning-paths, mentoring, operations, profiles, projects, rag, recruitment; 265 node, 209 SRS, status draft, ch\u01b0a c\u00f3 SDS) v\u00e0 t\u1ea7m nh\u00ecn Ecommerce App 2.0: Concepts theo 7 mi\u1ec1n (Frontend, Backend, System Design, Testing, DevOps, Cloud, AI Harness) n\u1ed1i th\u00e0nh l\u1ed9 tr\u00ecnh theo n\u0103ng l\u1ef1c v\u00e0 m\u1ee5c ti\u00eau ngh\u1ec1; b\u00e0i h\u1ecdc \u0111i t\u1eeb b\u1ed1i c\u1ea3nh ph\u1ecfng v\u1ea5n → l\u00fd thuy\u1ebft → s\u01a1 \u0111\u1ed3 → source code → th\u1ef1c h\u00e0nh, c\u00f3 tr\u1eafc nghi\u1ec7m gi\u1ea3i th\u00edch; track AI Automation v\u00e0 AI Harness; StarCi RAG tr\u1ea3 l\u1eddi t\u1eeb Concepts c\u00f3 ngu\u1ed3n v\u00e0 ch\u1ec9 v\u1ec1 ch\u1ed7 y\u1ebfu; ba c\u1ea5p th\u1ef1c h\u00e0nh Challenge, Code challenge ch\u1ea1y test, Personal Project theo m\u1ed1c, v\u1edbi AI review n\u1ed9p → review theo ti\u00eau ch\u00ed → s\u1eeda → n\u1ed9p l\u1ea1i; c\u1ed9ng \u0111\u1ed3ng th\u1ea3o lu\u1eadn t\u1ea1i Concept, nh\u00f3m h\u1ecdc, peer review, showcase, nhi\u1ec7m v\u1ee5 v\u00e0 XP; h\u1ed3 s\u01a1 n\u0103ng l\u1ef1c c\u00f3 b\u1eb1ng ch\u1ee9ng, CV theo m\u1ee5c ti\u00eau, luy\u1ec7n ph\u1ecfng v\u1ea5n c\u00f9ng AI; marketplace tuy\u1ec3n d\u1ee5ng kh\u1edbp b\u1eb1ng ch\u1ee9ng v\u1edbi y\u00eau c\u1ea7u c\u00f4ng vi\u1ec7c; subscription \u0111\u1ed3ng h\u00e0nh d\u00e0i h\u1ea1n. T\u01b0 li\u1ec7u tham kh\u1ea3o ch\u1ec9 \u0111\u1ecdc: n\u1ed9i dung \u0111ang ch\u1ea1y \u1edf starci-lab-data (2 kho\u00e1 Fullstack v\u00e0 System Design, 122 b\u00e0i, 457 challenge, 40 milestone, 96 coding problem, 30 b\u1ed9 flashcard, catalog AI model); b\u00e0i m\u1eabu format m\u1edbi \u1edf data2 (brief, b\u00e0i h\u1ecdc \u0111i t\u1eeb c\u00e2u h\u1ecfi ph\u1ecfng v\u1ea5n, contract E2E \u0111a ng\u00f4n ng\u1eef, review.json ch\u1ea5m n\u1ed9i dung); schema Concept hi\u1ec7n c\u00f3 trong shop-be thi\u1ebfu domain v\u00e0 thi\u1ebfu li\u00ean k\u1ebft prerequisite, ch\u01b0a c\u00f3 d\u1eef li\u1ec7u Concept n\u00e0o; RAG hi\u1ec7n c\u00f3 (Qdrant, chunk theo n\u1ed9i dung kho\u00e1 h\u1ecdc, ch\u01b0a c\u00f3 \u0111\u1ecbnh d\u1ea1ng tr\u00edch d\u1eabn); rubric ch\u1ea5m challenge, milestone, mock interview, CV \u0111\u00e3 c\u00f3 trong backend c\u0169. Vi\u1ec7c c\u1ea7n l\u00e0m: t\u00e1i l\u1eadp m\u1ed9t .starciwork chu\u1ea9n trong ecommerce-app t\u1eeb Work ngu\u1ed3n (gi\u1eef provenance, kh\u00f4ng s\u1eeda b\u1ea3n g\u1ed1c \u1edf shop-be); r\u00e0 v\u00e0 b\u1ed5 sung SRS cho \u0111\u1ee7 v\u00e0 kh\u1edbp t\u1ea7m nh\u00ecn; vi\u1ebft SDS/architecture cho m\u1ecdi feature, trong \u0111\u00f3 c\u00f3 m\u00f4 h\u00ecnh Concept (domain, li\u00ean k\u1ebft prerequisite, l\u1ed9 tr\u00ecnh theo m\u1ee5c ti\u00eau ngh\u1ec1) v\u00e0 h\u1ee3p \u0111\u1ed3ng tr\u00edch d\u1eabn c\u1ee7a StarCi RAG; khai b\u00e1o .starcistacks cho dev v\u00e0 prod (Next.js FE, NestJS BE, Postgres, Redis, Qdrant, Keycloak, MinIO v\u00e0 c\u00e1c dependency SDS ch\u1ecdn) theo knowledge/application-stacks.yaml; validate b\u1eb1ng c\u00e1c check c\u1ee7a runtime. Code s\u1ea3n ph\u1ea9m Ecommerce App c\u0169 ch\u1ec9 l\u00e0 tham kh\u1ea3o, kh\u00f4ng ph\u1ea3i authority. \u0110\u01b0\u1ee3c commit v\u00e0 push l\u00ean origin main c\u1ee7a ecommerce-app.";
const SCAFFOLD_PROMPT = "Setup source cho Ecommerce App, kh\u00f4ng c\u00f3 nghi\u1ec7p v\u1ee5: d\u1ef1ng base repo ecommerce-app l\u00e0 NestJS backend v\u00e0 ecommerce-app-fe l\u00e0 Next.js frontend d\u00f9ng @starci/grammar. Stack theo chu\u1ea9n trong CONTEXT.md, toolchain theo repository baseline: TypeScript strict, @starci/eslint-canon-be v\u00e0 @starci/eslint-canon-fe v\u1edbi zero warnings, jest cho BE v\u00e0 vitest cho FE, husky + lint-staged \u1edf pre-commit, typecheck + test \u1edf pre-push, GitHub Actions CI ch\u1ea1y lint, typecheck, test, build, c\u1ea5u h\u00ecnh Codecov v\u00e0 Sonar. M\u1ed7i repo ch\u1ec9 c\u00f3 layout r\u1ed7ng v\u00e0 m\u1ed9t endpoint health ch\u1ea1y \u0111\u01b0\u1ee3c; module nghi\u1ec7p v\u1ee5, DB, cache, vector store v\u00e0 auth \u0111\u1ec3 c\u00e1c op implement sau n\u00e0y th\u00eam theo SDS. Ch\u1ea1y song song v\u1edbi workflow ho\u00e0n thi\u1ec7n .starciwork/.starcistacks, kh\u00f4ng ch\u1edd n\u00f3. \u0110\u01b0\u1ee3c commit v\u00e0 push l\u00ean origin main c\u1ee7a ecommerce-app v\u00e0 ecommerce-app-fe.";
const BUILD_LEG = /.(implement|draw|audit)$|^(uat|e2e).verify$/;

test('a Vietnamese specification prompt derives spec-foundation with no build or proof-of-build leg', () => {
  const result = run(SPEC_PROMPT);
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  const plan = body(result);
  assert.equal(plan.status, 'ok');
  assert.equal(plan.scopeKind, 'spec-foundation');
  assert.deepEqual(plan.legs.map(leg => leg.op + (leg.instance ? '#' + leg.instance : '')), [
    'workspace.manage', 'business.decide', 'architecture.decide', 'workspace.manage#stacks', 'review.verify', 'handover.review',
  ]);
  assert.ok(!plan.legs.some(leg => BUILD_LEG.test(leg.op) || /scaffold/.test(leg.op)));
  assert.equal(plan.legalityFindings, undefined);
});

test('a Vietnamese base-repo prompt derives greenfield-scaffold with no decide leg', () => {
  const result = run(SCAFFOLD_PROMPT);
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  const plan = body(result);
  assert.equal(plan.status, 'ok');
  assert.equal(plan.scopeKind, 'greenfield-scaffold');
  assert.deepEqual(plan.legs.map(leg => leg.op), ['backend.scaffold', 'interface.scaffold', 'review.verify', 'handover.review']);
  assert.ok(!plan.legs.some(leg => /.decide$/.test(leg.op)), 'the stack and toolchain are fixed; no decide leg');
});

test('greenfield-scaffold adds package.scaffold only on a package phrase and keeps its architecture prerequisite', () => {
  const backendOnly = body(run('scaffold the enrolment api backend'));
  assert.deepEqual(backendOnly.legs.map(leg => leg.op), ['backend.scaffold', 'review.verify', 'handover.review']);
  const pkg = body(run('scaffold a shared package for the design tokens'));
  const ops = pkg.legs.map(leg => leg.op);
  assert.ok(ops.includes('package.scaffold'));
  assert.ok(!ops.includes('backend.scaffold') && !ops.includes('interface.scaffold'));
  assert.ok(ops.indexOf('architecture.decide') < ops.indexOf('package.scaffold'), 'a package surface is settled architecture');
});

test('an SDS mentioned beside a build verb stays a build, not a specification', () => {
  const plan = body(run('implement the enrolment api per the SDS'));
  assert.equal(plan.scopeKind, 'feature-build-backend');
  assert.ok(plan.legs.some(leg => leg.op === 'backend.implement'));
});

const FULLSTACK_LEGS = [
  'request.analyze', 'scope.define', 'business.decide', 'architecture.decide', 'brand.decide', 'interface.draw',
  'work.author', 'backend.implement', 'interface.implement', 'interface.audit', 'review.verify', 'handover.review',
];

const FULLSTACK_LEGS_WITH_PROOFS = FULLSTACK_LEGS.flatMap(op => (op === 'review.verify' ? ['e2e.verify', 'uat.verify', op] : [op]));

test('a feature named through both surfaces derives feature-build-fullstack with its own backend build', () => {
  for (const prompt of [
    'finish Sales, Accounting, Chatbot and MyApp instance management, backend and frontend',
    'build Collab group chat end to end',
    'l\u00e0m tr\u1ecdn t\u00ednh n\u0103ng nh\u00f3m chat, backend v\u00e0 frontend',
  ]) {
    const result = run(prompt);
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    const plan = body(result);
    assert.equal(plan.status, 'ok');
    assert.equal(plan.scopeKind, 'feature-build-fullstack', prompt);
    assert.deepEqual(plan.parseNotes, ['intent->S* via archetypes [feature-build-fullstack]'], 'ui and backend priors are superseded');
    assert.deepEqual(plan.legs.map(leg => leg.op), FULLSTACK_LEGS, prompt);
  }
});

test('repository nouns do not trigger fullstack, and no lifecycle prompt opens with test.author or code.refactor', () => {
  assert.equal(body(run(SPEC_PROMPT)).scopeKind, 'spec-foundation');
  assert.equal(body(run(SCAFFOLD_PROMPT)).scopeKind, 'greenfield-scaffold');
  for (const prompt of [SPEC_PROMPT, SCAFFOLD_PROMPT, 'finish Sales, Accounting, Chatbot and MyApp instance management, backend and frontend']) {
    const plan = body(run(prompt));
    assert.ok(!plan.parseNotes.join().includes('workspace-canonicalization'));
    assert.ok(!['test.author', 'code.refactor'].includes(plan.legs[0]?.op), `${plan.scopeKind} must not open with a migration leg`);
    assert.ok(!plan.legs.some(leg => leg.op === 'code.refactor'));
  }
});

// The two nivo goal prompts of a night log (an initial request, then a
// re-plan), in their original shape: each asks to close missing SRS/SDS AND to
// deliver backend + frontend to green tests, e2e and browser UAT; the modules
// prompt also names a WIP refactor branch as reference. Reconstructed from the
// log's description — the log does not quote them.
const NIVO_MODULES_PROMPT = 'Ho\u00e0n thi\u1ec7n ba module Sales, Accounting, Chatbot v\u00e0 qu\u1ea3n l\u00fd instance MyApp trong nivo: \u0111\u00f3ng SRS/SDS c\u00f2n thi\u1ebfu, backend v\u00e0 frontend \u0111\u00fang thi\u1ebft k\u1ebf, test v\u00e0 e2e xanh, UAT tr\u00ecnh duy\u1ec7t. Nh\u00e1nh WIP refactor/accounting (206 file) ch\u1ec9 tham kh\u1ea3o, kh\u00f4ng merge.';
const NIVO_COLLAB_PROMPT = 'L\u00e0m tr\u1ecdn t\u00ednh n\u0103ng chat nh\u00f3m Collab trong nivo: SRS/SDS c\u00f2n thi\u1ebfu \u0111\u01b0\u1ee3c \u0111\u00f3ng, backend v\u00e0 frontend \u0111\u00fang thi\u1ebft k\u1ebf, test v\u00e0 e2e xanh, UAT tr\u00ecnh duy\u1ec7t, t\u1edbi s\u1ea3n ph\u1ea9m ch\u1ea1y \u0111\u01b0\u1ee3c.';

const runWith = (text, ...extra) => spawnSync(process.execPath, [ROUTE_PLAN, '--text', text, '--json', ...extra], {
  cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 60000,
});
const workRoot = (t, brandState) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-work-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  if (brandState) {
    fs.mkdirSync(path.join(dir, 'brand'));
    fs.writeFileSync(path.join(dir, 'brand', 'index.yaml'), `schema: work/brand@1\nid: fixture.brand\nstate: ${brandState}\n`);
  }
  return dir;
};

test('a build prompt that also closes spec gaps keeps its implement legs (buildIntent excludes the lifecycle scopes)', () => {
  for (const prompt of [NIVO_MODULES_PROMPT, NIVO_COLLAB_PROMPT]) {
    const plan = body(run(prompt));
    assert.equal(plan.status, 'ok');
    assert.deepEqual(plan.parseNotes, ['intent->S* via archetypes [feature-build-fullstack]'], prompt);
    assert.deepEqual(plan.legs.map(leg => leg.op), FULLSTACK_LEGS_WITH_PROOFS, prompt);
  }
  // A course named "Fullstack" and a contract named "E2E" are nouns, not a delivery demand.
  assert.equal(body(run(SPEC_PROMPT)).scopeKind, 'spec-foundation');
  assert.equal(body(run(SCAFFOLD_PROMPT)).scopeKind, 'greenfield-scaffold');
});

test('a settled brand record drops brand.decide as an out-of-band assumption; an absent or unsettled one keeps it', t => {
  const settled = body(runWith(NIVO_COLLAB_PROMPT, '--work', workRoot(t, 'done')));
  assert.deepEqual(settled.legs.map(leg => leg.op), FULLSTACK_LEGS_WITH_PROOFS.filter(op => op !== 'brand.decide'));
  const draw = settled.legs.find(leg => leg.op === 'interface.draw');
  assert.ok(draw.assumed.includes('brand: settled record brand/index.yaml state done — satisfied out-of-band, no chain leg'));
  assert.deepEqual(body(runWith(NIVO_COLLAB_PROMPT, '--work', workRoot(t, null))).legs.map(leg => leg.op), FULLSTACK_LEGS_WITH_PROOFS);
  assert.deepEqual(body(runWith(NIVO_COLLAB_PROMPT, '--work', workRoot(t, 'todo'))).legs.map(leg => leg.op), FULLSTACK_LEGS_WITH_PROOFS);
});

// A work-and-stacks goal, verbatim: a specification
// goal that also asks for a brand (offset-pop family, pink token, mascot Mia).
const BRANDED_SPEC_PROMPT = 'Ho\u00e0n thi\u1ec7n .starciwork v\u00e0 .starcistacks cho Todo App trong repo shop-be (backend, s\u1edf h\u1eefu Work) v\u00e0 ecommerce-app-fe (frontend); source c\u0169 \u0111\u00e3 \u0111\u01b0\u1ee3c xo\u00e1 \u0111\u1ec3 vi\u1ebft l\u1ea1i, b\u1ea3n c\u0169 n\u1eb1m \u1edf tag legacy/pre-rewrite-2026-09-23 v\u00e0 worktree ch\u1ec9 \u0111\u1ecdc shop-be-legacy, ecommerce-app-fe-legacy. T\u1ea7m nh\u00ecn s\u1ea3n ph\u1ea9m theo b\u1ed9 8 slide "S\u1ed5 tay \u00f4n thi c\u1ee7a Mia" (\u1ea3nh g\u1ed1c \u1edf ecommerce-app-fe-legacy/design/pink-series): \u00f4n ti\u1ebfng Anh THPT nh\u01b0 m\u1ed9t cu\u1ed9c phi\u00eau l\u01b0u; h\u1ecdc theo c\u1ee5m t\u1eeb (ch\u1ecdn ch\u1ee7 \u0111\u1ec1 → h\u1ecdc ngh\u0129a, v\u00ed d\u1ee5 trong \u0111\u1ec1, c\u1ee5m \u0111i k\u00e8m → ch\u01a1i \u0111\u1ec3 nh\u1edb → d\u00f9ng trong \u0111\u1ec1; sai th\u00ec c\u1ee5m quay l\u1ea1i \u0111\u00fang l\u00fac theo l\u1ecbch h\u00f4m nay, sau 3 ng\u00e0y, sau 1 tu\u1ea7n); luy\u1ec7n \u0111\u1ec1 th\u1eadt THPTQG v\u1edbi hai ch\u1ebf \u0111\u1ed9 luy\u1ec7n t\u1ef1 do (ch\u1ecdn ch\u1ee7 \u0111\u1ec1, s\u1ed1 c\u00e2u, t\u1ea1m d\u1eebng, kh\u00f4ng \u00e1p l\u1ef1c th\u1eddi gian) v\u00e0 thi m\u00f4 ph\u1ecfng (40 c\u00e2u, 50 ph\u00fat, giao di\u1ec7n nh\u01b0 \u0111\u1ec1 th\u1eadt), sai c\u00e2u n\u00e0o xem gi\u1ea3i th\u00edch r\u1ed3i t\u1ef1 \u0111\u1ed9ng th\u00eam v\u00e0o \u00f4n t\u1eadp v\u00e0 th\u1eed c\u00e2u t\u01b0\u01a1ng t\u1ef1; Mia AI gi\u1ea3i th\u00edch c\u00f3 b\u1eb1ng ch\u1ee9ng trong \u0111o\u1ea1n, ph\u00e2n t\u00edch b\u00e0i sau khi n\u1ed9p, g\u1ee3i \u00fd b\u00e0i \u00f4n v\u1eeba s\u1ee9c, nh\u1eafc l\u1ea1i \u0111\u00fang l\u00fac; game Vocab Defense, Vocab Race, Match Pairs, Couple Quiz (\u00fd t\u01b0\u1edfng m\u1edf r\u1ed9ng: Th\u00e1m t\u1eed \u0111\u00e1p \u00e1n, Tho\u00e1t ph\u00f2ng \u0111\u1ecdc hi\u1ec3u); b\u1ea3n \u0111\u1ed3 n\u0103ng l\u1ef1c (t\u1eeb v\u1ef1ng, ng\u1eef ph\u00e1p, \u0111\u1ecdc hi\u1ec3u, \u0111i\u1ec1n t\u1eeb, s\u1eafp x\u1ebfp c\u00e2u) v\u00e0 nhi\u1ec7m v\u1ee5 h\u00f4m nay; h\u1ecdc c\u00f9ng b\u1ea1n: chu\u1ed7i ng\u00e0y h\u1ecdc, \u0111\u1ea5u \u0111\u1ed9i 2v2 t\u00ednh \u0111i\u1ec3m theo \u0111\u00f3ng g\u00f3p, Mia Wrapped, b\u1ea1n b\u00e8; g\u00f3i Mi\u1ec5n ph\u00ed v\u00e0 Pro, s\u1eafp c\u00f3 Cambridge, IELTS, TOEIC. Ngu\u1ed3n nghi\u1ec7p v\u1ee5 tham kh\u1ea3o ch\u1ec9 \u0111\u1ecdc: biz.md v\u00e0 docs trong shop-be-legacy (free/Pro, credit, x\u1ebfp h\u1ea1ng, lu\u1eadt ch\u1ea5m), n\u1ed9i dung \u1edf study-app-english v\u00e0 kho d\u1eef li\u1ec7u shop-data (39 \u0111\u1ec1 THPTQG, c\u1ee5m t\u1eeb, ng\u1eef ph\u00e1p). Code c\u0169 ch\u1ec9 l\u00e0 tham kh\u1ea3o, kh\u00f4ng ph\u1ea3i authority. Vi\u1ec7c c\u1ea7n l\u00e0m: t\u1ea1o m\u1ed9t .starciwork chu\u1ea9n trong shop-be; vi\u1ebft SRS cho m\u1ecdi feature theo t\u1ea7m nh\u00ecn tr\u00ean v\u00e0 biz.md; vi\u1ebft SDS/architecture cho m\u1ecdi feature (NestJS monorepo g\u1ed3m API GraphQL v\u00e0 m\u00e1y ch\u1ee7 game th\u1eddi gian th\u1ef1c Colyseus, Next.js frontend, Postgres, Redis, Qdrant, MinIO, Keycloak, OpenRouter qua b\u1ed9 c\u00e2n b\u1eb1ng key, thanh to\u00e1n PayOS v\u00e0 SePay); brand theo family offset-pop c\u1ee7a @starci/grammar v\u1edbi token brand h\u1ed3ng c\u1ee7a Todo App v\u00e0 mascot Mia; khai b\u00e1o .starcistacks dev v\u00e0 prod; validate b\u1eb1ng c\u00e1c check c\u1ee7a runtime. \u0110\u01b0\u1ee3c commit v\u00e0 push l\u00ean origin main c\u1ee7a shop-be.';
const SPEC_LEGS = ['workspace.manage', 'business.decide', 'architecture.decide', 'workspace.manage#stacks', 'review.verify', 'handover.review'];
const SPEC_BRAND_LEGS = ['workspace.manage', 'business.decide', 'architecture.decide', 'brand.decide', 'workspace.manage#stacks', 'review.verify', 'handover.review'];
const legIds = plan => plan.legs.map(leg => leg.op + (leg.instance ? '#' + leg.instance : ''));
const BRAND_ASSUMED = 'brand: settled record brand/index.yaml state done — satisfied out-of-band, no chain leg';

test('spec-foundation carries brand.decide only on brand intent and only while no brand record is settled', t => {
  const unsettled = body(run(BRANDED_SPEC_PROMPT));
  assert.equal(unsettled.scopeKind, 'spec-foundation');
  assert.deepEqual(legIds(unsettled), SPEC_BRAND_LEGS);
  assert.equal(unsettled.legalityFindings, undefined);
  assert.deepEqual(legIds(body(runWith(BRANDED_SPEC_PROMPT, '--work', workRoot(t, 'todo')))), SPEC_BRAND_LEGS);
  const settled = body(runWith(BRANDED_SPEC_PROMPT, '--work', workRoot(t, 'done')));
  assert.deepEqual(legIds(settled), SPEC_LEGS);
  assert.deepEqual(settled.assumed, [BRAND_ASSUMED]);
  // No brand intent: the other specification prompt keeps its six legs.
  assert.deepEqual(legIds(body(run(SPEC_PROMPT))), SPEC_LEGS);
  assert.deepEqual(legIds(body(run('vi\u1ebft SDS, khai b\u00e1o .starcistacks v\u00e0 b\u1ed9 nh\u1eadn di\u1ec7n c\u00f3 linh v\u1eadt'))), SPEC_BRAND_LEGS);
});

test('define-goal --plan lists a settled brand record of a spec-foundation goal under assumed and writes nothing', t => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-spec-brand-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  fs.mkdirSync(path.join(repo, '.starciwork', 'brand'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.starciwork', 'brand', 'index.yaml'), 'schema: work/brand@1\nid: fixture.brand\nstate: done\n');
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'goal', 'define-goal.mjs'), '--repo', repo,
    '--text', BRANDED_SPEC_PROMPT, '--title', 'x', '--plan', '--json'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000 });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.deepEqual(out.opChain.includes('brand.decide'), false);
  assert.deepEqual(out.assumed, [BRAND_ASSUMED]);
  assert.deepEqual(fs.readdirSync(path.join(repo, '.starciwork')), ['brand'], '--plan writes nothing');
});

test('archetypes.yaml carries only the keys route-plan reads; the planner derives every chain', async () => {
  const { parseYaml } = await import('../../engine/yaml.mjs');
  const doc = parseYaml(fs.readFileSync(path.join(ROOT, 'modules', 'goal', 'archetypes.yaml'), 'utf8'));
  assert.deepEqual(Object.keys(doc).sort(), ['archetypes', 'schema', 'signalMatching']);
  const read = new Set(['id', 'signals', 'supersedes', 'variants', 'conditionalLegs', 'surfaces', 'surfaceRule']);
  const entries = doc.archetypes.flatMap(a => [a, ...(a.variants ?? [])]);
  for (const entry of entries) {
    const unread = Object.keys(entry).filter(key => !read.has(key));
    assert.deepEqual(unread, [], `${entry.id} declares keys no code reads: ${unread.join(', ')}`);
  }
});

test('integration.verify joins a chain only when the prompt explicitly asks for live verification', () => {
  const ops = prompt => body(run(prompt)).legs.map(leg => leg.op);
  const live = list => list.filter(op => op === 'integration.verify' || op === 'provision.ask');
  assert.deepEqual(live(ops('integrate Google OAuth sign-in and SMTP email into the auth backend')), []);
  assert.ok(ops('integrate Google OAuth sign-in and SMTP email into the auth backend').includes('backend.implement'));
  assert.deepEqual(live(ops('t\u00edch h\u1ee3p VNPay cho thanh to\u00e1n kho\u00e1 h\u1ecdc')), []);
  assert.deepEqual(live(ops('integrate Google OAuth into the auth backend and run the integration tests')), ['provision.ask', 'integration.verify']);
  assert.deepEqual(live(ops('integrate Google OAuth sign-in, verify OAuth live')), ['provision.ask', 'integration.verify']);
  assert.deepEqual(live(ops('t\u00edch h\u1ee3p VNPay cho thanh to\u00e1n, ki\u1ec3m th\u1eed t\u00edch h\u1ee3p')), ['provision.ask', 'integration.verify']);
  assert.deepEqual(live(ops('build the backend API for wishlist with live verification')), ['provision.ask', 'integration.verify']);
  assert.deepEqual(live(ops('integrate Stripe payments, skip integration tests')), []);
  const asked = ops('integrate Google OAuth into the auth backend and run the integration tests');
  assert.ok(asked.indexOf('backend.implement') < asked.indexOf('integration.verify') && asked.indexOf('integration.verify') < asked.indexOf('review.verify'));
});
