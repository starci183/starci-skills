---
title: Delivery assurance
---

# Delivery assurance

## LOADS

| Alias | Target | Kind | Vì sao |
|---|---|---|---|
| `@assurance-be` | `compilers/patterns/be/delivery-assurance` | module | backend fence bảy phần có thẩm quyền |
| `@assurance-fe` | `compilers/patterns/fe/delivery-assurance` | module | frontend fence bảy phần có thẩm quyền |

## Dấu hiệu stale

Backend và frontend assurance mặc định bắt buộc. Chỉ tracked `starci.deliveryAssurance.required: false` kèm `reason`
không rỗng mới cho verdict `not required`. Thiếu policy, `required: true`, hoặc false không reason vẫn là
required. Với backend required, thiếu hoặc không blocking một `ASSURANCE-*` fact đã chạm là stale; partial
adoption không phải profile nhỏ hơn.

## README badge bắt buộc

Mọi backend hoặc frontend required phải có đủ bộ token-free dưới đây trong README. Thiếu một badge vẫn là assurance
finding dù provider check đang xanh:

| Provider | Badge | Metric |
|---|---|---|
| Codecov | coverage | repository graph badge |
| SonarQube | quality gate | `alert_status` |
| SonarQube | coverage | `coverage` |
| SonarQube | bugs | `bugs` |
| SonarQube | vulnerabilities | `vulnerabilities` |
| SonarQube | code smells | `code_smells` |
| SonarQube | maintainability | `sqale_rating` |
| SonarQube | reliability | `reliability_rating` |
| SonarQube | security | `security_rating` |

Codecov dùng host `codecov.io` với path `/gh/<owner>/<repo>/graph/badge.svg`. SonarQube dùng
`<SONAR_HOST_URL>/api/project_badges/measure?project=<projectKey>&metric=<metric>`. URL không được chứa
`token`, credential hay secret query opaque. Mọi image endpoint phải trả SVG và mỗi badge phải link đúng
dashboard repository/project của provider.

## Evidence cho stale list

Đọc manifest policy trước. Với `not required`, report exact reason và dừng module. Nếu không, đọc
`@assurance-be` cho backend hoặc `@assurance-fe` cho frontend rồi chỉ inspect tên/wiring: Husky check-only pre-push, active PR CI, một unit LCOV producer,
Codecov consumer, Sonar scan cộng quality gate, fixed encrypted stack record, symbolic GitHub secret
reference, README badge không chứa token cho Codecov cùng SonarQube quality gate, coverage, bugs,
vulnerabilities, code smells, maintainability, reliability, security, required check và deploy dependency.
Không decrypt credential. Provider value và required-check app binding giữ `unmeasured
external` nếu không có authorized API evidence.

## Inventory cho repair

Chỉ chạy sau khi source gate xanh. Trình repository write tách external mutation: manifest/lockfile, hook,
workflow, coverage/provider config, encrypted record, provider project creation, GitHub Secrets/Variables
và required check. Hiện command `scripts/publish-secret.mjs --plan` không có value.

## Apply

Áp assurance pattern đã route thành một graph: local pre-push lint+unit; active PR CI có check-only lint,
typecheck/build và đúng một coverage run; một `coverage/lcov.info` cho Codecov lẫn Sonar; Codecov
project/patch cùng Sonar quality gate blocking; encrypted stack custody và GitHub projection; README badge
token-free và reachable cho Codecov cùng full SonarQube quality metric set; required check; mọi deploy hiện có phụ thuộc
verification. Repository không có deploy thì không invent.

Secret đến từ process env theo tên hoặc hidden input qua `scripts/publish-secret.mjs`; không qua chat,
stdout, command argument hay plaintext tracked file. Repository token chỉ target một repository trừ khi
provider thật sự cấp scope rộng hơn.

## Proof

Prove hook refuse controlled failure, exact CI graph, một LCOV dùng hai lần, encrypted filename không có
plaintext twin, mọi badge image endpoint bắt buộc trả image mà URL không có credential, external secret name/required
check qua API và deploy dependency. External enforcement hoặc badge endpoint chưa đo làm module chưa complete.
