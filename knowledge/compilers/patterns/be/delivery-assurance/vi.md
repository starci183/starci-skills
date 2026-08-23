---
title: Delivery assurance
module: delivery-assurance
kind: pattern
stack: be
codes: [ASSURANCE-1, ASSURANCE-2, ASSURANCE-3, ASSURANCE-4, ASSURANCE-5, ASSURANCE-6, ASSURANCE-7]
---

# Delivery assurance

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-be` | `@starci/eslint-canon-be` | npm package | cung cấp lint machine check-only mà delivery gate backend gọi |

## Record

Đầu vào là backend repository đã có source và test lane. Đầu ra là delivery machine bao quanh chúng:
local refusal nhanh, CI lặp lại được, coverage evidence, static analysis, secret custody, merge enforcement
và deploy không thể chạy trước verification.

## Luật

**Command xanh chưa phải assurance cho tới khi một boundary từ chối dựa trên nó.** Husky phản hồi nhanh
nhưng có thể bypass. CI chạy lại command check-only của repository. Required checks biến kết quả đó thành
điều kiện merge. Deploy chỉ bắt đầu sau khi điều kiện ấy pass.

Backend repository mặc định phải cài đủ machine. Cài một phần là stale, không phải profile nhỏ hơn: Codecov
không có coverage thì không có evidence; SonarQube không có quality gate chỉ để bình luận; CI không có
branch protection chỉ khuyên; deploy chạy song song CI có thể phát hành source đỏ.

Project có thể khai báo rõ delivery assurance là không bắt buộc. Declaration nằm trong manifest được
track, không nằm trong workspace route cục bộ theo máy, để mọi reader thấy cùng một quyết định của owner.
Chỉ `starci.deliveryAssurance.required: false` kèm `reason` không rỗng mới là exemption. Thiếu declaration,
gõ sai hoặc `false` không có lý do vẫn có nghĩa assurance bắt buộc; repository không tự được miễn chỉ vì
đang thiếu machine.

Credential bên thứ ba có hai nơi cho hai consumer khác nhau. Source record mã hóa nằm dưới
`.stacks/dev/runtime/files/`; GitHub Actions nhận external secret projection vì CI cố ý không giữ SOPS
master identity. Không nơi nào cho phép plaintext vào source, workflow argument, terminal output hay chat.

Helper chuẩn của Source `scripts/publish-secret.mjs` là cầu nối giữa hai nơi. Nó in plan không có value,
đọc process environment variable theo tên hoặc mở hidden prompt, đưa value vào entrypoint `secret:set` và
`gh secret set` qua stdin, rồi xóa bản sao khỏi process environment. Provider token scoped theo repository
chỉ target một repository; batch nhiều repository đòi credential có scope thật sự phủ mọi repository đã nêu.

## Applicability

Đọc `package.json` trước khi đánh giá bất kỳ situation `ASSURANCE-*` nào:

```json
{
  "starci": {
    "deliveryAssurance": {
      "required": false,
      "reason": "Lý do đã được owner duyệt cho việc project này không cần delivery assurance."
    }
  }
}
```

- Không có declaration hoặc `required: true` → `required`; đánh giá mọi situation đã chạm.
- Đúng `required: false` kèm `reason` không rỗng → `not required`; báo reason và không cài, đo hay yêu cầu
  bất kỳ assurance service nào.
- `required: false` nhưng thiếu reason không rỗng → exemption không hợp lệ; báo manifest policy stale và
  vẫn xem assurance là bắt buộc.

## Situation codes

| Code | Tình huống | Repository phải có gì |
|---|---|---|
| `ASSURANCE-1` | Developer sắp push | Husky đã cài; `pre-push` chạy full lint check-only và fast unit lane, fail một cái là dừng |
| `ASSURANCE-2` | Pull request được mở hoặc cập nhật | PR workflow active, install từ lockfile rồi chạy lint check-only zero-warning, typecheck/build, mature unit coverage và mọi E2E suite đã khai báo; CI không sửa source, skip suite hay chấp nhận lane rỗng |
| `ASSURANCE-3` | Unit test chạy trong CI | Một run sinh LCOV, độc lập đạt statements/functions/lines 80% và branches 75%, bắt new-code/patch 90% cho cả bốn metric, upload Codecov, có patch/project status blocking và README link badge Codecov an toàn, reachable |
| `ASSURANCE-4` | Cùng revision cần quality/security analysis | Local authenticated scan của đúng checkout dùng LCOV, chứng minh strict Sonar profile và đợi `OK` trước CI; SonarQube CI lặp blocking gate và README expose full metric set an toàn |
| `ASSURANCE-5` | Codecov hoặc SonarQube cần credential | Có `codecov-token.key.enc` và `sonarqube-token.key.enc` dưới `.stacks/dev/runtime/files/`; workflow chỉ gọi tên GitHub secret, không decrypt stacks |
| `ASSURANCE-6` | Pull request sẵn sàng merge | GitHub branch protection hoặc ruleset bắt CI, Codecov và SonarQube check từ đúng app phải pass |
| `ASSURANCE-7` | Có deploy workflow | Deploy phụ thuộc verification thành công qua `needs`, reusable workflow hoặc successful workflow-run trigger |

## Đọc accepted shape

1. Đọc manifest và giữ package manager cùng gate name của repository. Thiếu check-only alias thì thêm;
   hook và CI không bao giờ trỏ vào autofix command.
2. Pre-push local phải nhanh: full lint cộng unit. Typecheck/build ở CI; repair còn chạy coverage và authenticated
   local analysis trước khi tin CI.
3. Sinh một LCOV report rồi đưa cùng evidence cho Codecov và SonarQube. Chạy test hai lần cho hai dashboard
   là drift, không phải assurance mạnh hơn.
4. Service creation, GitHub secret, repository variable và branch rule là external mutation. Chúng cần
   approval và access; thiếu access phải để boundary incomplete rõ ràng, không âm thầm bỏ check.
5. Không hỏi token trong conversation. Dùng hidden-input stack-secret entrypoint hoặc secret provider đã
   được cấp quyền; publish sang GitHub Secrets mà không in hay đặt value vào command-line argument.

## Blocking quality profile

Profile đầy đủ bắt buộc cho mọi routed source và không có informational mode:

- lint kết thúc với zero error và zero warning;
- một unit run thành công sinh `coverage/lcov.info`, độc lập chứng minh statements, functions và lines
  tối thiểu 80%, branches tối thiểu 75%, new-code/patch tối thiểu 90% cho từng metric;
- mọi E2E entrypoint đã khai báo phải tồn tại, tìm thấy test thật và pass mà không `skip`, `todo`,
  `passWithNoTests`, zero-test success hay cheaper substitute;
- Sonar analyse đúng checkout revision, trả Quality Gate `OK`, bugs/vulnerabilities/code smells bằng 0,
  security hotspots reviewed 100%, maintainability/reliability/security rating A, duplicated-lines
  density không quá 3% overall và new code, native coverage tối thiểu 80% overall và 90% new code.

Jest sở hữu bốn coverage metric riêng. Codecov và Sonar dùng cùng LCOV và chỉ gate native project/new
coverage metric chúng thật sự expose; không được mô tả hai provider như bằng chứng độc lập cho Jest
statements/functions/branches. Badge,
analysis uploaded, `NONE`, stale revision hoặc provider value chưa đo đều không phải proof.

## Tách lane

Unit là lane duy nhất sinh coverage. E2E là behavioral refusal riêng và không bao giờ đóng góp, merge hay
rewrite LCOV mà Sonar dùng. CI có thể chạy unit, E2E rồi Sonar theo thứ tự, nhưng phải ghi ba verdict độc
lập: E2E pass không phải Sonar evidence, Sonar pass không phải E2E evidence, và failure của lane nào không
được đổi tên thành lane kia.

## Bảy refusal

`ASSURANCE-1` là local latency, không phải authority. `.husky/pre-push` phải gọi `lint:check` và `test:ci`
hoặc `test:unit` từ manifest. `--no-verify` là lý do code 6 vẫn tồn tại.

`ASSURANCE-2` là reproducibility. PR trigger active, dependency đến từ lockfile và workflow gọi repository
scripts. Trigger bị comment hoặc workflow manual-only chưa phải CI adoption.

`ASSURANCE-3` sở hữu coverage movement. Unit CI sinh `coverage/lcov.info`; Codecov upload đúng file đó và
patch/project status được dùng để block. README expose badge Codecov thật của repository; image URL phải
reachable và không dùng credential ngoài badge token read-only, scope riêng cho project do provider cấp
khi project private cần nó. Token này chỉ nằm trên official image endpoint và không có quyền upload hay API.
Coverage percentage thuộc service policy, không thuộc Jest run thứ hai.

`ASSURANCE-4` sở hữu analysis. Repair scan checkout local hiện tại trước với `sonar.qualitygate.wait=true`;
gate đỏ được sửa trong source rồi scan lại trước CI. SonarQube CI dùng cùng revision và LCOV report. Scan success và quality-gate
success là hai fact khác nhau; workflow phải chờ hoặc nhận kết quả gate. README expose badge reachable cho
quality gate, coverage, bugs, vulnerabilities, code smells, maintainability, reliability và security của
cùng project key. Badge public token-free; badge private chỉ được dùng cùng badge capability read-only do
provider cấp, không bao giờ dùng scan token, API token hay admin credential.

`ASSURANCE-5` sở hữu custody. Stack giữ provider token mã hóa bằng tên cố định. GitHub Secrets là projection
cho CI; `SONAR_HOST_URL` là repository variable trừ khi installation xem nó là secret; workflow không giải
mã `.stacks`.

`ASSURANCE-6` là external fence. Workflow xanh trên disk không chứng minh GitHub ruleset tồn tại, nên local
scan phải ghi code này là unmeasured tới khi GitHub API hoặc UI cung cấp evidence.

`ASSURANCE-7` đóng race cuối. Deploy theo push-to-main mà không phụ thuộc verification có thể phát hành
revision khi check đỏ; `paths-ignore` không thay được dependency.

## Layer held

| Code | Tier | Cái gì giữ nó |
|---|---|---|
| `ASSURANCE-1` | `enforced` | Husky `pre-push` và exit code khác zero |
| `ASSURANCE-2` | `enforced` | active CI workflow chạy repository scripts |
| `ASSURANCE-3` | `enforced` | LCOV generation, Codecov upload và required Codecov statuses |
| `ASSURANCE-4` | `enforced` | SonarQube scan cộng quality-gate result |
| `ASSURANCE-5` | `enforced` | encrypted stack records cộng symbolic GitHub secret references |
| `ASSURANCE-6` | `external` | GitHub branch protection hoặc ruleset; filesystem không chứng minh được |
| `ASSURANCE-7` | `enforced` | dependency graph của deploy workflow |

## Inputs

| Input | Evidence bắt buộc |
|---|---|
| manifest | package manager, check-only lint, unit, typecheck/build và coverage scripts |
| hooks | nội dung Husky hook tracked |
| CI | active workflow trigger, command và dependency graph |
| coverage | một LCOV path được Codecov và SonarQube dùng chung; README badge an toàn, reachable cho cả hai |
| secrets | tên encrypted stack file và symbolic workflow reference, không bao giờ là value |
| external enforcement | GitHub API/UI evidence cho required checks và expected apps |

## Rules

1. Backend assurance mặc định là bắt buộc; chỉ declaration trong manifest ở Applicability mới có thể miễn.
2. Hook và CI gọi command check-only, không sửa source; readiness đòi zero lint warning.
3. Local pre-push chỉ có lint cộng unit; repair chạy local coverage và waited Sonar analysis riêng.
4. Codecov và SonarQube dùng cùng LCOV report từ cùng một unit run đạt mature threshold; README expose badge an toàn,
   reachable cho kết quả của cả hai provider.
5. Provider token được mã hóa trong stacks rồi project sang GitHub Secrets mà không đi plaintext qua source hay chat.
6. Local Sonar scan xanh không tuyên bố branch protection đã cấu hình nếu chưa có external evidence.
7. Deploy không thể bắt đầu trước khi verification pass.
8. Unit là LCOV producer duy nhất; E2E là behavioral lane độc lập bị loại khỏi Sonar analysis và coverage,
   không bao giờ thay thế Sonar verdict.

## Ngoại lệ

- Declaration `starci.deliveryAssurance.required: false` hợp lệ làm cả assurance pattern thành `not required`
  cho project đó. Đây không phải partial adoption, và `starci-repair` không được cài bất kỳ phần nào.
- Backend repository không có deploy workflow không chạm `ASSURANCE-7`; nó không tạo dummy deploy.
- Provider outage tạm thời có thể làm required check unavailable, nhưng không bao giờ gỡ hoặc đổi check thành optional.
- Provider có tokenless identity đã được duyệt có thể thay GitHub secret projection tương ứng; encrypted owner record vẫn còn trừ khi owner quyết định retire credential.

## Output

```text
repository: <resolved backend checkout>
local: <Husky pre-push entrypoints>
ci: <check-only gates and active trigger>
coverage: <LCOV producer and Codecov consumer>
analysis: <SonarQube scan and quality gate>
secrets: <encrypted stack record names and symbolic CI references>
merge: <required checks evidence | unmeasured external>
deploy: <verification dependency | not applicable>
safety: <lint zero-warning, mature unit metric, full E2E và strict Sonar proof exact-SHA>
situations: <ASSURANCE-1 ... ASSURANCE-7 reached by this repository>
verdict: <complete | stale | needs external authority | not required>
reason: <bắt buộc khi verdict là not required>
```

## Scope

Pattern này quản delivery assurance của backend repository. Nó không quyết định business test case,
provider-specific quality threshold, deployment infrastructure hay chính secret value.
