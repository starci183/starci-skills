import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
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

// The two nivo goal prompts of the 2026-09-23 night log (04:40 request, 05:05
// re-plan), in their original shape: each asks to close missing SRS/SDS AND to
// deliver backend + frontend to green tests, e2e and browser UAT; the modules
// prompt also names a WIP refactor branch as reference. Reconstructed from the
// log's description — the log does not quote them.
const NIVO_MODULES_PROMPT = 'Hoàn thiện ba module Sales, Accounting, Chatbot và quản lý instance AgentOS trong nivo: đóng SRS/SDS còn thiếu, backend và frontend đúng thiết kế, test và e2e xanh, UAT trình duyệt. Nhánh WIP refactor/accounting (206 file) chỉ tham khảo, không merge.';
const NIVO_COLLAB_PROMPT = 'Làm trọn tính năng chat nhóm Collab trong nivo: SRS/SDS còn thiếu được đóng, backend và frontend đúng thiết kế, test và e2e xanh, UAT trình duyệt, tới sản phẩm chạy được.';

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
    assert.deepEqual(plan.legs.map(leg => leg.op), FULLSTACK_LEGS, prompt);
  }
  // A course named "Fullstack" and a contract named "E2E" are nouns, not a delivery demand.
  assert.equal(body(run(SPEC_PROMPT)).scopeKind, 'spec-foundation');
  assert.equal(body(run(SCAFFOLD_PROMPT)).scopeKind, 'greenfield-scaffold');
});

test('a settled brand record drops brand.decide as an out-of-band assumption; an absent or unsettled one keeps it', t => {
  const settled = body(runWith(NIVO_COLLAB_PROMPT, '--work', workRoot(t, 'done')));
  assert.deepEqual(settled.legs.map(leg => leg.op), FULLSTACK_LEGS.filter(op => op !== 'brand.decide'));
  const draw = settled.legs.find(leg => leg.op === 'interface.draw');
  assert.ok(draw.assumed.includes('brand: settled record brand/index.yaml state done — satisfied out-of-band, no chain leg'));
  assert.deepEqual(body(runWith(NIVO_COLLAB_PROMPT, '--work', workRoot(t, null))).legs.map(leg => leg.op), FULLSTACK_LEGS);
  assert.deepEqual(body(runWith(NIVO_COLLAB_PROMPT, '--work', workRoot(t, 'todo'))).legs.map(leg => leg.op), FULLSTACK_LEGS);
});

// The Mia Mia work-and-stacks goal of 2026-09-23, verbatim: a specification
// goal that also asks for a brand (offset-pop family, pink token, mascot Mia).
const MIAMIA_SPEC_PROMPT = 'Hoàn thiện .starciwork và .starcistacks cho Mia Mia trong repo mia-mia-backend (backend, sở hữu Work) và miamia-fe (frontend); source cũ đã được xoá để viết lại, bản cũ nằm ở tag legacy/pre-rewrite-2026-09-23 và worktree chỉ đọc D:/Repositories/mia-mia-backend-legacy, D:/Repositories/miamia-fe-legacy. Tầm nhìn sản phẩm theo bộ 8 slide "Sổ tay ôn thi của Mia" (ảnh gốc ở miamia-fe-legacy/design/mia-mia-pink-series): ôn tiếng Anh THPT như một cuộc phiêu lưu; học theo cụm từ (chọn chủ đề → học nghĩa, ví dụ trong đề, cụm đi kèm → chơi để nhớ → dùng trong đề; sai thì cụm quay lại đúng lúc theo lịch hôm nay, sau 3 ngày, sau 1 tuần); luyện đề thật THPTQG với hai chế độ luyện tự do (chọn chủ đề, số câu, tạm dừng, không áp lực thời gian) và thi mô phỏng (40 câu, 50 phút, giao diện như đề thật), sai câu nào xem giải thích rồi tự động thêm vào ôn tập và thử câu tương tự; Mia AI giải thích có bằng chứng trong đoạn, phân tích bài sau khi nộp, gợi ý bài ôn vừa sức, nhắc lại đúng lúc; game Vocab Defense, Vocab Race, Match Pairs, Couple Quiz (ý tưởng mở rộng: Thám tử đáp án, Thoát phòng đọc hiểu); bản đồ năng lực (từ vựng, ngữ pháp, đọc hiểu, điền từ, sắp xếp câu) và nhiệm vụ hôm nay; học cùng bạn: chuỗi ngày học, đấu đội 2v2 tính điểm theo đóng góp, Mia Wrapped, bạn bè; gói Miễn phí và Pro, sắp có Cambridge, IELTS, TOEIC. Nguồn nghiệp vụ tham khảo chỉ đọc: biz.md và docs trong mia-mia-backend-legacy (free/Pro, credit, xếp hạng, luật chấm), nội dung ở study-with-mia-english và kho dữ liệu miamia-data (39 đề THPTQG, cụm từ, ngữ pháp). Code cũ chỉ là tham khảo, không phải authority. Việc cần làm: tạo một .starciwork chuẩn trong mia-mia-backend; viết SRS cho mọi feature theo tầm nhìn trên và biz.md; viết SDS/architecture cho mọi feature (NestJS monorepo gồm API GraphQL và máy chủ game thời gian thực Colyseus, Next.js frontend, Postgres, Redis, Qdrant, MinIO, Keycloak, OpenRouter qua bộ cân bằng key, thanh toán PayOS và SePay); brand theo family offset-pop của @starci/grammar với token brand hồng của Mia Mia và mascot Mia; khai báo .starcistacks dev và prod; validate bằng các check của runtime. Được commit và push lên origin main của mia-mia-backend.';
const SPEC_LEGS = ['workspace.manage', 'business.decide', 'architecture.decide', 'workspace.manage#stacks', 'review.verify'];
const SPEC_BRAND_LEGS = ['workspace.manage', 'business.decide', 'architecture.decide', 'brand.decide', 'workspace.manage#stacks', 'review.verify'];
const legIds = plan => plan.legs.map(leg => leg.op + (leg.instance ? '#' + leg.instance : ''));
const BRAND_ASSUMED = 'brand: settled record brand/index.yaml state done — satisfied out-of-band, no chain leg';

test('spec-foundation carries brand.decide only on brand intent and only while no brand record is settled', t => {
  const unsettled = body(run(MIAMIA_SPEC_PROMPT));
  assert.equal(unsettled.scopeKind, 'spec-foundation');
  assert.deepEqual(legIds(unsettled), SPEC_BRAND_LEGS);
  assert.equal(unsettled.legalityFindings, undefined);
  assert.deepEqual(legIds(body(runWith(MIAMIA_SPEC_PROMPT, '--work', workRoot(t, 'todo')))), SPEC_BRAND_LEGS);
  const settled = body(runWith(MIAMIA_SPEC_PROMPT, '--work', workRoot(t, 'done')));
  assert.deepEqual(legIds(settled), SPEC_LEGS);
  assert.deepEqual(settled.assumed, [BRAND_ASSUMED]);
  // No brand intent: the StarCi Next specification prompt keeps its five legs.
  assert.deepEqual(legIds(body(run(SPEC_PROMPT))), SPEC_LEGS);
  assert.deepEqual(legIds(body(run('viết SDS, khai báo .starcistacks và bộ nhận diện có linh vật'))), SPEC_BRAND_LEGS);
});

test('define-goal --plan lists a settled brand record of a spec-foundation goal under assumed and writes nothing', t => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-spec-brand-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  fs.mkdirSync(path.join(repo, '.starciwork', 'brand'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.starciwork', 'brand', 'index.yaml'), 'schema: work/brand@1\nid: fixture.brand\nstate: done\n');
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'goal', 'define-goal.mjs'), '--repo', repo,
    '--text', MIAMIA_SPEC_PROMPT, '--title', 'x', '--plan', '--json'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000 });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.deepEqual(out.opChain.includes('brand.decide'), false);
  assert.deepEqual(out.assumed, [BRAND_ASSUMED]);
  assert.deepEqual(fs.readdirSync(path.join(repo, '.starciwork')), ['brand'], '--plan writes nothing');
});
