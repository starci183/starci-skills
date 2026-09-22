import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
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
  assert.ok(ops.indexOf('interface.audit') < ops.indexOf('uat.verify'));
  assert.ok(!plan.legs.some(leg => leg.op === 'workspace.manage'));
});

test('assisted UAT preparation is a separate existing-build workflow', () => {
  const result = run('prepare assisted UAT for the bank approval journey');
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  const plan = body(result);
  assert.equal(plan.status, 'ok');
  assert.equal(plan.scopeKind, 'assisted-uat-prepare');
  assert.deepEqual(plan.legs.map(leg => leg.op), ['request.analyze', 'uat.assisted.prepare']);
  assert.ok(!plan.legs.some(leg => leg.op === 'interface.implement'));
});

test('assisted UAT verification consumes the exact prepared package before acceptance', () => {
  const result = run('verify assisted UAT receipt for the bank approval journey');
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  const plan = body(result);
  assert.equal(plan.status, 'ok');
  assert.equal(plan.scopeKind, 'assisted-uat-verify');
  assert.deepEqual(plan.legs.map(leg => leg.op), ['request.analyze', 'uat.assisted.prepare', 'uat.assisted.verify']);
  assert.ok(!plan.legs.some(leg => leg.op === 'uat.verify'));
});

test('Vietnamese prompts select archetypes through the archetypes.yaml phrase data', () => {
  const cases = [
    ['ứng dụng hơi chậm khi mở khoá học', 'investigate-first'],
    ['tích hợp VNPay cho thanh toán khoá học', 'external-integration'],
    ['tái cấu trúc module enrolment', 'refactor'],
    ['làm giao diện màn hình đăng ký khoá học', 'feature-build-with-ui'],
    ['xây dịch vụ đăng ký khoá học', 'feature-build-backend'],
    ['kiểm tra lint toàn repo', 'verify-only'],
  ];
  for (const [prompt, scopeKind] of cases) {
    for (const form of [prompt, prompt.normalize('NFD')]) {
      const result = run(form);
      assert.equal(result.status, 0, result.stderr || result.error?.message);
      assert.equal(body(result).scopeKind, scopeKind, `${JSON.stringify(form)} should select ${scopeKind}`);
    }
  }
});

test('diacritics are kept: "chấm điểm" (grade) is not the "chậm" (slow) signal', () => {
  const result = run('chấm điểm bài nộp');
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

// The two owner prompts observed on project starci-next (2026-09-23), verbatim.
// Both once derived the same generic ui+backend build chain because
// "frontend"/"backend" appear as repository nouns.
const SPEC_PROMPT = "Hoàn thiện .starciwork và .starcistacks cho StarCi Next (StarCi Academy 2.0) trong repo mới starci-next (backend, sở hữu Work) và starci-next-fe (frontend). Nguồn nghiệp vụ: Work StarCiNext hiện có ở starci-academy-backend/.starciwork (16 feature: authoring, challenges, commerce, community, concepts, cv, gamification, identity, interviews, learning-paths, mentoring, operations, profiles, projects, rag, recruitment; 265 node, 209 SRS, status draft, chưa có SDS) và tầm nhìn StarCi Next 2.0: Concepts theo 7 miền (Frontend, Backend, System Design, Testing, DevOps, Cloud, AI Harness) nối thành lộ trình theo năng lực và mục tiêu nghề; bài học đi từ bối cảnh phỏng vấn → lý thuyết → sơ đồ → source code → thực hành, có trắc nghiệm giải thích; track AI Automation và AI Harness; StarCi RAG trả lời từ Concepts có nguồn và chỉ về chỗ yếu; ba cấp thực hành Challenge, Code challenge chạy test, Personal Project theo mốc, với AI review nộp → review theo tiêu chí → sửa → nộp lại; cộng đồng thảo luận tại Concept, nhóm học, peer review, showcase, nhiệm vụ và XP; hồ sơ năng lực có bằng chứng, CV theo mục tiêu, luyện phỏng vấn cùng AI; marketplace tuyển dụng khớp bằng chứng với yêu cầu công việc; subscription đồng hành dài hạn. Tư liệu tham khảo chỉ đọc: nội dung đang chạy ở starci-lab-data (2 khoá Fullstack và System Design, 122 bài, 457 challenge, 40 milestone, 96 coding problem, 30 bộ flashcard, catalog AI model); bài mẫu format mới ở data2 (brief, bài học đi từ câu hỏi phỏng vấn, contract E2E đa ngôn ngữ, review.json chấm nội dung); schema Concept hiện có trong starci-academy-backend thiếu domain và thiếu liên kết prerequisite, chưa có dữ liệu Concept nào; RAG hiện có (Qdrant, chunk theo nội dung khoá học, chưa có định dạng trích dẫn); rubric chấm challenge, milestone, mock interview, CV đã có trong backend cũ. Việc cần làm: tái lập một .starciwork chuẩn trong starci-next từ Work nguồn (giữ provenance, không sửa bản gốc ở starci-academy-backend); rà và bổ sung SRS cho đủ và khớp tầm nhìn; viết SDS/architecture cho mọi feature, trong đó có mô hình Concept (domain, liên kết prerequisite, lộ trình theo mục tiêu nghề) và hợp đồng trích dẫn của StarCi RAG; khai báo .starcistacks cho dev và prod (Next.js FE, NestJS BE, Postgres, Redis, Qdrant, Keycloak, MinIO và các dependency SDS chọn) theo knowledge/application-stacks.yaml; validate bằng các check của runtime. Code sản phẩm StarCi Academy cũ chỉ là tham khảo, không phải authority. Được commit và push lên origin main của starci-next.";
const SCAFFOLD_PROMPT = "Setup source cho StarCi Next, không có nghiệp vụ: dựng base repo starci-next là NestJS backend và starci-next-fe là Next.js frontend dùng @starci/grammar. Stack theo chuẩn trong CONTEXT.md, toolchain theo repository baseline: TypeScript strict, @starci/eslint-canon-be và @starci/eslint-canon-fe với zero warnings, jest cho BE và vitest cho FE, husky + lint-staged ở pre-commit, typecheck + test ở pre-push, GitHub Actions CI chạy lint, typecheck, test, build, cấu hình Codecov và Sonar. Mỗi repo chỉ có layout rỗng và một endpoint health chạy được; module nghiệp vụ, DB, cache, vector store và auth để các op implement sau này thêm theo SDS. Chạy song song với workflow hoàn thiện .starciwork/.starcistacks, không chờ nó. Được commit và push lên origin main của starci-next và starci-next-fe.";
const BUILD_LEG = /.(implement|draw|audit)$|^(uat|e2e).verify$/;

test('a Vietnamese specification prompt derives spec-foundation with no build or proof-of-build leg', () => {
  const result = run(SPEC_PROMPT);
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  const plan = body(result);
  assert.equal(plan.status, 'ok');
  assert.equal(plan.scopeKind, 'spec-foundation');
  assert.deepEqual(plan.legs.map(leg => leg.op + (leg.instance ? '#' + leg.instance : '')), [
    'workspace.manage', 'business.decide', 'architecture.decide', 'workspace.manage#stacks', 'review.verify',
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
  assert.deepEqual(plan.legs.map(leg => leg.op), ['backend.scaffold', 'interface.scaffold', 'review.verify']);
  assert.ok(!plan.legs.some(leg => /.decide$/.test(leg.op)), 'the stack and toolchain are fixed; no decide leg');
});

test('greenfield-scaffold adds package.scaffold only on a package phrase and keeps its architecture prerequisite', () => {
  const backendOnly = body(run('scaffold the enrolment api backend'));
  assert.deepEqual(backendOnly.legs.map(leg => leg.op), ['backend.scaffold', 'review.verify']);
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
  'work.author', 'backend.implement', 'interface.implement', 'interface.audit', 'e2e.verify', 'uat.verify', 'review.verify',
];

test('a feature named through both surfaces derives feature-build-fullstack with its own backend build', () => {
  for (const prompt of [
    'finish Sales, Accounting, Chatbot and AgentOS instance management, backend and frontend',
    'build Collab group chat end to end',
    'làm trọn tính năng nhóm chat, backend và frontend',
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
  for (const prompt of [SPEC_PROMPT, SCAFFOLD_PROMPT, 'finish Sales, Accounting, Chatbot and AgentOS instance management, backend and frontend']) {
    const plan = body(run(prompt));
    assert.ok(!plan.parseNotes.join().includes('workspace-canonicalization'));
    assert.ok(!['test.author', 'code.refactor'].includes(plan.legs[0]?.op), `${plan.scopeKind} must not open with a migration leg`);
    assert.ok(!plan.legs.some(leg => leg.op === 'code.refactor'));
  }
});
