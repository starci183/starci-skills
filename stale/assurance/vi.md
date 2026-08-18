---
title: Delivery assurance
---

# Delivery assurance

## LOADS

| Alias | Target | Vì sao |
|---|---|---|
| `@assurance-be` | `compilers/patterns/be/delivery-assurance` | backend fence bảy phần có thẩm quyền |

## Dấu hiệu stale

Backend assurance mặc định bắt buộc. Chỉ tracked `starci.deliveryAssurance.required: false` kèm `reason`
không rỗng mới cho verdict `not required`. Thiếu policy, `required: true`, hoặc false không reason vẫn là
required. Với backend required, thiếu hoặc không blocking một `ASSURANCE-*` fact đã chạm là stale; partial
adoption không phải profile nhỏ hơn.

## Evidence cho stale list

Đọc manifest policy trước. Với `not required`, report exact reason và dừng module. Nếu không, đọc
`@assurance-be` rồi chỉ inspect tên/wiring: Husky check-only pre-push, active PR CI, một unit LCOV producer,
Codecov consumer, Sonar scan cộng quality gate, fixed encrypted stack record, symbolic GitHub secret
reference, required check và deploy dependency. Không decrypt credential. Provider value và required-check
app binding giữ `unmeasured external` nếu không có authorized API evidence.

## Inventory cho repair

Chỉ chạy sau khi source gate xanh. Trình repository write tách external mutation: manifest/lockfile, hook,
workflow, coverage/provider config, encrypted record, provider project creation, GitHub Secrets/Variables
và required check. Hiện command `scripts/publish-secret.mjs --plan` không có value.

## Apply

Áp `@assurance-be` thành một graph: local pre-push lint+unit; active PR CI có check-only lint,
typecheck/build và đúng một coverage run; một `coverage/lcov.info` cho Codecov lẫn Sonar; Codecov
project/patch cùng Sonar quality gate blocking; encrypted stack custody và GitHub projection; required
check; mọi deploy hiện có phụ thuộc verification. Repository không có deploy thì không invent.

Secret đến từ process env theo tên hoặc hidden input qua `scripts/publish-secret.mjs`; không qua chat,
stdout, command argument hay plaintext tracked file. Repository token chỉ target một repository trừ khi
provider thật sự cấp scope rộng hơn.

## Proof

Prove hook refuse controlled failure, exact CI graph, một LCOV dùng hai lần, encrypted filename không có
plaintext twin, external secret name/required check qua API và deploy dependency. External enforcement
chưa đo làm module chưa complete.
