---
title: Frontend delivery assurance
---

# Frontend delivery assurance

## LOADS

| Alias | Target | Kind | Vì sao |
|---|---|---|---|
| `@canon-fe` | `@starci/eslint-canon-fe` | npm package | cung cấp frontend lint machine check-only |

## Record

Input là frontend repository có lint, typecheck, build và unit lane đã khai báo. Output là một delivery
fence gồm pre-push refusal nhanh, PR CI reproducible, một LCOV producer, Codecov/SonarQube blocking,
credential custody mã hóa, merge enforcement và deploy ordering. Dùng `@canon-fe` làm check-only lint
machine; bản thay thế riêng trong repository không đạt pattern này.

## Applicability

Frontend assurance mặc định required. Chỉ tracked `starci.deliveryAssurance.required: false` kèm `reason`
không rỗng mới là `not required`. Policy thiếu hoặc invalid vẫn giữ full profile required.

## Situations

| Code | Tình huống | Refusal bắt buộc |
|---|---|---|
| `ASSURANCE-FE-1` | Developer push | Husky pre-push chạy full lint check-only và unit |
| `ASSURANCE-FE-2` | Pull request đổi | Install lockfile rồi chạy lint zero-warning, typecheck, production build, mature unit coverage và mọi E2E suite đã khai báo mà không skip/lane rỗng |
| `ASSURANCE-FE-3` | Có coverage | Đúng một unit run sinh `coverage/lcov.info`, đạt statements/functions/lines 80%, branches 75% và từng new-code/patch metric 90%; Codecov dùng và project/patch status block |
| `ASSURANCE-FE-4` | Chạy quality analysis | Local authenticated scan của đúng checkout dùng cùng LCOV, chứng minh strict Sonar profile và đợi `OK`; SonarQube CI lặp blocking gate |
| `ASSURANCE-FE-5` | Provider cần credential | Có encrypted Source-owner record và GitHub secret của repo; workflow chỉ gọi tên |
| `ASSURANCE-FE-6` | Pull request merge | Required check bind CI, Codecov và SonarQube vào protected branch |
| `ASSURANCE-FE-7` | Có deploy | Deploy phụ thuộc verification; không invent deploy khi absent |

## Badge surface

README phải có Codecov graph badge token-free và đủ SonarQube metric cho cùng project key:
`alert_status`, `coverage`, `bugs`, `vulnerabilities`, `code_smells`, `sqale_rating`,
`reliability_rating`, `security_rating`. Mọi image endpoint trả SVG và link provider dashboard. Badge thiếu,
unreachable hoặc URL chứa credential giữ assurance stale.

## Credential custody

Mỗi frontend repo nhận GitHub Secrets `CODECOV_TOKEN`, `SONAR_TOKEN` và repository variable
`SONAR_HOST_URL`. Khi frontend cố ý không có product stack, encrypted owner có thể là routed Source stack;
fixed record phải namespace theo frontend project để không overwrite custody của repo khác. Không value nào
đi qua source, chat, command argument hay output.

## Blocking quality profile

Mọi routed frontend có zero lint error/warning, statements/functions/lines >=80%, branches >=75%, và
new-code/patch >=90% cho từng metric từ một unit LCOV. Mọi E2E lane đã khai báo phải tìm thấy test thật và
pass mà không `skip`, `todo`, `passWithNoTests`, zero-test success hay cheaper substitute. Sonar trên
đúng revision phải trả Quality Gate `OK`, bugs/vulnerabilities/code smells bằng 0, hotspots reviewed 100%,
ba rating A, duplicated-lines density ≤3% overall/new, native coverage >=80% overall và >=90% new.
Jest/Vitest sở hữu bốn coverage metric riêng; Codecov và Sonar dùng cùng LCOV và chỉ chứng minh native
project/new coverage metric của chúng.

## Rules

1. Hook và CI gọi command check-only, không fix source; readiness đòi zero lint warning.
2. Pre-push local chỉ lint+unit; typecheck và build ở CI, còn repair chạy coverage và analysis local trước khi tin CI.
3. Một unit coverage run đạt mature threshold sinh LCOV cho cả hai provider.
4. CI build production frontend trước provider upload/scan.
5. Repair chạy local Sonar analysis với `sonar.qualitygate.wait=true`; gate đỏ là source finding, không đẩy sang CI.
6. README có đủ badge bắt buộc mà không token.
7. Wiring filesystem không chứng minh required check; authorized provider/GitHub API mới chứng minh.
8. Deploy hiện có không được outrun verification.

## Proof

Chạy local lint zero-warning, typecheck, build, mature unit coverage và mọi E2E gate đã khai báo; sinh
LCOV, chạy local Sonar analysis có xác thực và đợi gate xanh;
prove hook refuse controlled failure; parse CI graph; prove một LCOV path được consume hai lần; verify encrypted record name, GitHub secret/variable name, mọi badge SVG endpoint,
required check và deploy dependency. Fact đã chạm còn unmeasured làm profile incomplete.
Proof ghi exact lint count, bốn project/new-code coverage metric, E2E suite/test count và mọi exact-SHA
strict Sonar condition; aggregate hoặc badge-only evidence là incomplete.
