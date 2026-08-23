# Accountability rule-binding frontend

## LOADS

None.

## Record

Module này chứng minh frontend pattern situations, gate routes và machine
`@starci/eslint-canon-fe` đã publish vẫn accountable với nhau. Nó sở hữu identity/parity, không chép
lại design law hoặc gate law.

## Rules

1. Mọi frontend rule đã publish xuất hiện đúng một lần trong frontend gate router.
2. Mọi rule được route phải tới gate runtime record có thật.
3. Shared hoặc machine-only identity được ghi rõ, không gán pattern code giả; upstream machine-test proof
   vẫn external khi installed package không ship tests.
4. Consumer phải import package đã publish; chỉ có dependency trong manifest vẫn là adoption vắng.
5. Source disable directive không thay thế missing binding.

## Proof

Chạy `node runtime/machines/rule-bindings/check.mjs --fe` và test suite của canon package.

## Output

```text
rule: <published identity>
situations: <pattern codes hoặc machine-only identity>
gate: <runtime record>
owner: <published law owner>
verdict: <bound | missing>
```
