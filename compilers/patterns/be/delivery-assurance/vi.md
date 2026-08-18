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

Mọi backend repository phải cài đủ machine. Cài một phần là stale, không phải profile nhỏ hơn: Codecov
không có coverage thì không có evidence; SonarQube không có quality gate chỉ để bình luận; CI không có
branch protection chỉ khuyên; deploy chạy song song CI có thể phát hành source đỏ.

Credential bên thứ ba có hai nơi cho hai consumer khác nhau. Source record mã hóa nằm dưới
`.stacks/dev/runtime/files/`; GitHub Actions nhận external secret projection vì CI cố ý không giữ SOPS
master identity. Không nơi nào cho phép plaintext vào source, workflow argument, terminal output hay chat.

## Situation codes

| Code | Tình huống | Repository phải có gì |
|---|---|---|
| `ASSURANCE-1` | Developer sắp push | Husky đã cài; `pre-push` chạy full lint check-only và fast unit lane, fail một cái là dừng |
| `ASSURANCE-2` | Pull request được mở hoặc cập nhật | PR workflow active, install từ lockfile rồi chạy lint check-only, typecheck/build và unit; CI không sửa source |
| `ASSURANCE-3` | Unit test chạy trong CI | Run sinh LCOV, upload qua Codecov và có patch/project coverage status để block |
| `ASSURANCE-4` | Cùng revision cần quality/security analysis | SonarQube scan bằng LCOV đó và trả blocking quality gate |
| `ASSURANCE-5` | Codecov hoặc SonarQube cần credential | Có `codecov-token.key.enc` và `sonarqube-token.key.enc` dưới `.stacks/dev/runtime/files/`; workflow chỉ gọi tên GitHub secret, không decrypt stacks |
| `ASSURANCE-6` | Pull request sẵn sàng merge | GitHub branch protection hoặc ruleset bắt CI, Codecov và SonarQube check từ đúng app phải pass |
| `ASSURANCE-7` | Có deploy workflow | Deploy phụ thuộc verification thành công qua `needs`, reusable workflow hoặc successful workflow-run trigger |

## Đọc accepted shape

1. Đọc manifest và giữ package manager cùng gate name của repository. Thiếu check-only alias thì thêm;
   hook và CI không bao giờ trỏ vào autofix command.
2. Local lane phải nhanh: full lint cộng unit. Typecheck/build, coverage upload và remote analysis ở CI.
3. Sinh một LCOV report rồi đưa cùng evidence cho Codecov và SonarQube. Chạy test hai lần cho hai dashboard
   là drift, không phải assurance mạnh hơn.
4. Service creation, GitHub secret, repository variable và branch rule là external mutation. Chúng cần
   approval và access; thiếu access phải để boundary incomplete rõ ràng, không âm thầm bỏ check.
5. Không hỏi token trong conversation. Dùng hidden-input stack-secret entrypoint hoặc secret provider đã
   được cấp quyền; publish sang GitHub Secrets mà không in hay đặt value vào command-line argument.

## Bảy refusal

`ASSURANCE-1` là local latency, không phải authority. `.husky/pre-push` phải gọi `lint:check` và `test:ci`
hoặc `test:unit` từ manifest. `--no-verify` là lý do code 6 vẫn tồn tại.

`ASSURANCE-2` là reproducibility. PR trigger active, dependency đến từ lockfile và workflow gọi repository
scripts. Trigger bị comment hoặc workflow manual-only chưa phải CI adoption.

`ASSURANCE-3` sở hữu coverage movement. Unit CI sinh `coverage/lcov.info`; Codecov upload đúng file đó và
patch/project status được dùng để block. Coverage percentage thuộc service policy, không thuộc một Jest run
thứ hai.

`ASSURANCE-4` sở hữu analysis. SonarQube dùng cùng revision và LCOV report. Scan success và quality-gate
success là hai fact khác nhau; workflow phải chờ hoặc nhận kết quả gate.

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
| coverage | một LCOV path được Codecov và SonarQube dùng chung |
| secrets | tên encrypted stack file và symbolic workflow reference, không bao giờ là value |
| external enforcement | GitHub API/UI evidence cho required checks và expected apps |

## Rules

1. Mọi backend repository cài đủ bảy tình huống; thiếu service access là việc chưa xong, không phải exemption.
2. Hook và CI gọi command check-only, không sửa source.
3. Local pre-push chỉ có lint cộng unit; gate đắt và remote ở CI.
4. Codecov và SonarQube dùng cùng LCOV report từ cùng một unit run thành công.
5. Provider token được mã hóa trong stacks rồi project sang GitHub Secrets mà không đi plaintext qua source hay chat.
6. Local scan không tuyên bố branch protection đã cấu hình nếu chưa có external evidence.
7. Deploy không thể bắt đầu trước khi verification pass.

## Ngoại lệ

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
situations: <ASSURANCE-1 ... ASSURANCE-7 reached by this repository>
verdict: <complete | stale | needs external authority>
```

## Scope

Pattern này quản delivery assurance của backend repository. Nó không quyết định business test case,
provider-specific quality threshold, deployment infrastructure hay chính secret value.
