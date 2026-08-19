---
title: StarCi trust-tree reorganization and quality roadmap
---

# Kế hoạch sắp xếp `.claude` và hoàn thiện quality

## Trạng thái của tài liệu

Đây là **migration roadmap dành cho người vận hành**, không phải runtime law và không được thêm vào
`INDEX.md`, `LOADS`, dependency graph hay context manifest. Mọi luật tiếp tục sống đúng một nơi trong
module sở hữu nó. Xóa tài liệu này khi các acceptance criteria cuối cùng đã đạt và lịch sử commit đã giữ
đủ bằng chứng thay thế.

Roadmap này bao phủ trust tree StarCi và sáu product role: MiAmia FE/BE, Nivo FE/BE và StarCi Academy
FE/BE. Nó không cho phép in, thay hoặc rotate credential; mọi provider mutation vẫn cần approval boundary
riêng và bằng chứng API.

## Ground truth trước migration

- Runtime, English và Vietnamese dependency graphs đang pass; vấn đề chính là khả năng định hướng và
  ownership, không phải graph đã vỡ.
- Bốn operational shelf `readiness`, `deployment`, `mcp` và `runbooks` có ownership khác nhau nhưng
  chưa được nhóm logic rõ trong INDEX/README, làm người đọc khó biết bắt đầu từ đâu.
- Delivery assurance trải qua compiler pattern, staleness registry và operator runbook; ba nơi này có
  mục đích khác nhau nhưng chưa có một ownership map ngắn để ngăn chép luật qua lại.
- Scanner assurance hiện chưa đo FE đầy đủ, không theo được coverage script qua manifest, chưa hiểu
  Codecov OIDC và chỉ kiểm badge theo HTTP/SVG thay vì metric semantic.
- Nivo BE đang có 9 ESLint errors và 2 warnings; MiAmia BE có 23 errors. Không lỗi nào được đóng bằng
  disable, severity relaxation, `any`, test skip hoặc fake import.
- Coverage đo gần nhất: Nivo BE 37.47% statements / 38.10% lines; Nivo FE 0.37% / 0.37%; StarCi BE
  35.80% / 36.06%; StarCi FE 76.14% / 76.87%. StarCi BE đang kéo test/E2E vào production denominator.
- Sáu route MiAmia/Nivo/StarCi hiện verify được; mọi execution vẫn phải reverify recorded head/branch
  ngay trước write vì route là machine evidence, không phải trạng thái vĩnh viễn.
- Trust tree hiện có thay đổi dở trong `readiness/staleness/assurance/{en.md,vi.md,context.md}` và
  `context-manifest.json`; mọi migration phải giữ nguyên và không ghi chồng các hunk đó.
- Một trust tree legacy riêng còn tồn tại tại `<Source>/.claude_legacy`, đang dirty và dùng remote khác;
  nó phải được archive có kiểm chứng, không merge vào canonical `.claude`.
- Runtime/build debris hiện diện vật lý trong trust tree: stale `scheduled_tasks.lock`, Python bytecode,
  empty `registries/`, cùng ignored `docs/node_modules`, `.next`, `out` và generated `content`.

## Information architecture đích

Giữ nguyên canonical paths vì dependency graphs hiện xanh. Sắp xếp bằng một logical map trong router và
human docs, không đổi hàng trăm path chỉ để giảm số thư mục ở root:

```text
.claude/
  INDEX.md                 # router duy nhất, không chứa luật chi tiết
  contexts/                # locate: đọc/ghi ở đâu
  brainstorms/             # choose: 3–4 candidates
  compilers/               # compile: một đáp án từ shape đã nhận
  gates/                   # judge: pass hoặc refusal có evidence
  readiness/               # measure/setup readiness
  deployment/              # portable stack/deploy law
  mcp/                     # routed source-context law
  runbooks/                # human operator procedures
  skills/                  # binding capability; chỉ load runtime context
  scripts/                 # deterministic machines và regression tests
  docs/                    # publication tooling và human-only migration material
```

INDEX và README phải trình bày bốn shelf trên dưới một nhóm logic **Operate**, nhưng path vật lý không đổi.
Chỉ move một shelf nếu có evidence rằng logical routing vẫn không giải quyết được ambiguity; move khi đó
phải là migration riêng, không shim hoặc duplicate copy.

## Ownership map bắt buộc

- `compilers/**/delivery-assurance`: shape repository phải được sinh ra như thế nào.
- `operations/readiness/staleness/assurance`: khi nào shape hiện có là stale, inventory/apply/proof.
- `operations/runbooks/delivery-assurance-cloud`: thao tác provider và recovery như thế nào.
- `gates`: source hiện có bị từ chối ở ký tự/evidence nào; không chứa repair procedure.
- `skills`: orchestration và approval boundary; không chép category law.
- `scripts`: enforcement executable; mỗi behavior mới có regression test.
- `INDEX.md`: chỉ route alias/capability; không chứa coverage threshold, provider policy hay procedure.

## Chương trình triển khai

### Wave 0 — khóa route và baseline

1. Reverify sáu route; chỉ dùng `starci-init` nếu route lại stale, không edit target repositories.
2. Ghi HEAD, branch, dirty paths và gate commands của sáu role.
3. Giữ nguyên mọi dirty change không thuộc run; MiAmia compose và trust-tree assurance hunk là protected.
4. Chạy dependency graphs, context contract và script tests làm baseline.

### Wave 1 — làm `.claude` dễ đọc trước khi move

1. Thêm ownership map vào human documentation, không vào runtime records.
2. Chuẩn hóa tên shelf/module theo một vocabulary: locate, choose, compile, judge, operate, execute,
   enforce, publish.
3. Xóa empty/retired root chỉ sau khi `git ls-files`, ignore ownership và consumer search chứng minh không
   còn reader.
4. Không đổi behavior trong commit taxonomy/documentation.

### Wave 2 — gom logic operational shelves và retire duplicate state

1. Nhóm `readiness`, `deployment`, `mcp`, `runbooks` dưới heading Operate trong INDEX/README/docs mà không
   đổi canonical path.
2. Sửa README installation tree và docs README để phản ánh đúng toàn bộ shelf/build behavior hiện có.
3. Xác minh `.claude_legacy` không còn live consumer/session/branch cần giữ, rồi archive ra khỏi Source
   bằng boundary/destructive approval riêng; không merge hai trust tree.
4. Di chuyển launcher/settings/lock về machine/app state phù hợp; xóa stale lock, bytecode và empty
   `.claude/registries` chỉ sau exact-target verification.
5. Ignored docs build output là disposable cache; cleanup riêng, không commit và không coi là authority.

Mỗi commit phải pass:

```text
node scripts/check-deps.mjs --all
node scripts/compile-context.mjs --check .
node --test "scripts/*.test.mjs"
npm --prefix docs run build
```

Sau mỗi pass, tìm active reference tới legacy/runtime path; kết quả phải bằng 0 trước khi retire target.

### Wave 3 — chuẩn hóa assurance machine

1. Scanner đo cả FE và BE.
2. Coverage detection resolve manifest script transitively, kể cả `npm run test:ci`.
3. Credential mode là union rõ ràng: GitHub OIDC, named secret hoặc not applicable; không suy OIDC thành
   missing token.
4. Badge validator đọc semantic SVG và từ chối `unknown`, `Project has not been found`, `NONE` hoặc
   no-analysis result dù HTTP là 200.
5. Public project dùng direct token-free badge. Private project dùng declared Cloudflare badge proxy:
   allowlist project/metric, credential server-side, cache/rate-limit, không trả source hay issue detail.
6. CI/deploy checker đọc dependency graph/capability, không dựa vào tên job.
7. Scanner chứng minh ESLint config import canon package name, không chỉ package tồn tại trong manifest.
8. `clean`, `stale`, `unmeasured external`, `private` và `not required` là các verdict tách biệt.
9. Đồng bộ `en.md`, `vi.md`, curated `context.md`, manifest và regression tests trong cùng pass; thêm
   `scripts/export-console-state.test.mjs` cho FE, `test:ci`, OIDC, central custody, deploy dependency,
   semantic badges, canon import và informational-coverage decision.
10. Coverage blocking/informational là tracked owner decision trong manifest và hạ xuống Codecov lẫn
    Sonar cùng lúc; năm `codecov.yml` informational hiện tại không được coi là policy nếu declaration
    chưa tồn tại.

### Wave 4 — clear ESLint đúng kiến trúc

1. Chạy format/autofix riêng và đọc mọi hunk.
2. Sửa deep import/mechanical findings riêng.
3. E2E phải đi qua production transport, dùng shared world helper và assert persisted consequence thật.
4. AI harness gọi declared provider client thật; không thêm unused SDK import để lừa rule.
5. REST machine/identity door phải có route/security boundary thật. Plain JSON brand/theme/GPU/admin/
   payment door chuyển sang GraphQL qua `starci-be-plan` và `starci-be-approve`.
6. MiAmia FE có `lint:check`; pre-push chỉ lint + unit, còn typecheck/build ở CI; hook và CI không gọi
   autofix entrypoint.
7. Rerun cùng lint command; acceptance là 0 error và 0 warning cho cả sáu role.

### Wave 5 — sửa coverage truth rồi mới nâng coverage

1. Mỗi repo sinh đúng một `coverage/lcov.info`; Codecov và Sonar đọc cùng artifact.
2. Production denominator loại test, config, generated output và declarations bằng rule chung có test;
   không loại production file chỉ vì coverage thấp.
3. StarCi BE bỏ `src/tests/**`/E2E khỏi denominator. Nivo FE giữ 127 production file chưa test trong mẫu
   số và bổ sung test thật.
4. Risk order: auth/payment/credential custody; provisioning/lifecycle; persistence/concurrency; external
   clients; FE state/API/realtime; page rendering cuối cùng.
5. Completion floor: statements, lines và functions của mọi repo >= 50%. Branch threshold được chốt từ
   measured DI-metadata ceiling, không làm tròn xuống để vừa số hiện tại. New-code coverage >= 80% cho cả
   bốn metric; milestone kế tiếp đưa overall lên >= 70%.

### Wave 6 — clear Sonar trên exact HEAD

1. Scan tuần tự, mỗi repo có `SONAR_BINARY_CACHE` riêng và `sonar.qualitygate.wait=true`.
2. Sửa theo thứ tự Bugs, Vulnerabilities, Security Hotspots, correctness smells, complexity, duplication,
   rồi coverage conditions.
3. Không coi `analysis uploaded` hoặc quality gate `NONE` là pass.
4. Acceptance: Quality Gate xanh, Bugs/Vulnerabilities bằng 0, Hotspots reviewed 100%, new-code smells bằng
   0, new duplication < 3%, maintainability/reliability/security rating A.
5. False-positive chỉ đóng trên Sonar khi có source/test evidence và lý do cụ thể; không mass-dismiss.

### Wave 7 — provider, badges và merge/deploy fence

1. Codecov dùng GitHub OIDC khi provider/repository hỗ trợ; token mode chỉ dùng named encrypted custody.
2. Sonar token là project-scoped, lấy từ encrypted record và publish qua stdin/hidden input; không in hoặc
   đưa value vào command argument.
   Credential twin không `.enc` chỉ được retire trong approval boundary riêng sau khi chứng minh encrypted
   owner tồn tại; không mở file để kiểm tra bằng mắt.
3. Reconcile project keys, GitHub variables/secrets, Codecov/Sonar statuses và required checks qua API.
4. Badge direct/proxy phải trả metric thật cho cùng project/revision và link dashboard đúng.
5. Mọi deploy workflow phụ thuộc verification bằng `needs`, reusable workflow hoặc successful
   workflow-run trigger.

### Wave 8 — proof và retirement

1. Rerun sáu role: formatter, lint, typecheck, build, unit, coverage.
2. Rerun local Sonar current HEAD và semantic badge probes.
3. Prove required checks và deploy dependency bằng authorized external API evidence.
4. Báo before/after metrics và commits tách pass; unresolved external authority phải được nêu rõ.
5. Khi mọi acceptance criterion đạt, xóa roadmap này trong commit retirement riêng.

## Commit discipline

Không trộn các pass: taxonomy docs; mỗi operational shelf move; assurance machine; formatter; mechanical
lint; source defects; coverage denominator; tests/coverage growth; Sonar defects; repository assurance;
external enforcement. Coordinator là writer duy nhất của `INDEX.md`, root `README.md`,
`context-manifest.json`, docs publication và shared gate runs.

## One-shot orchestration prompt cho 10 Luna agents

> Hãy điều phối đúng 10 subagent `gpt-5.6-luna` với `fork_turns=none`, reasoning `medium`, chạy theo batch phù hợp concurrency và refill slot cho đến khi đủ 10 agent hoàn tất; mọi agent phải đọc toàn bộ `<Source>/.claude/INDEX.md`, verify route, bảo toàn dirty changes, không đọc/in/rotate secret, không disable gate, không tự spawn agent và ghi result/proof vào `.worktrees/starci-skills/sessions/<session>/results/<agent-id>/`; Agent 1 chỉ audit toàn cây và trả ownership/legacy/runtime-debris map; Agent 2 chỉ đề xuất contexts/readiness parity; Agent 3 chỉ đề xuất brainstorms/compilers parity; Agent 4 chỉ lập gates law-to-published-rule parity; Agent 5 chỉ lập skills LOADS/stop/output parity; Agent 6 chỉ lập logical Operate map cho `deployment`, `mcp`, `runbooks` và retirement plan, không move canonical paths; Agent 7 chỉ đề xuất và test scanner assurance/coverage/OIDC/badge/CI-graph dưới `scripts/**`; Agent 8 chỉ lập/apply approved Nivo FE/BE ESLint và coverage boundary; Agent 9 chỉ lập/apply approved MiAmia FE/BE boundary; Agent 10 chỉ lập/apply approved StarCi FE/BE denominator/quality boundary; coordinator duy nhất ghi shared `INDEX.md`, `README.md`, `context-manifest.json`, schemas, gates, publication, manifests/lockfiles/config/workflows, refresh route, tích hợp conflict, chạy global proofs và thực hiện mọi provider/GitHub/Cloudflare mutation sau approval; agent nào cần nở boundary phải STOP và handoff, không tự sửa.

## Final acceptance

- Root taxonomy có một đường đọc rõ từ INDEX tới locate/choose/compile/judge/operate/execute/enforce/publish.
- Không active reference tới `.claude_legacy`, runtime debris, duplicate law, shim hay orphan context sau
  migration; canonical shelf paths chỉ đổi khi có migration evidence riêng.
- Runtime/EN/VI graphs, context contract, script tests và docs build đều pass.
- Sáu role ESLint 0/0 và declared source gates xanh.
- Coverage denominator đúng, mọi repo đạt floor, Codecov/Sonar dùng chung LCOV.
- Sonar current HEAD xanh theo các metric đã nêu.
- Badge hiển thị metric thật cho cả public và private policy mà không lộ credential.
- Required checks chặn merge và deploy không thể outrun verification.
