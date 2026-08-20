---
title: Business authority
---

# Business authority

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@feature-schema` | `contexts/business/schema.json` | file | từ chối business claim không được hỗ trợ hoặc truy vết |
| `@registry-schema` | `contexts/business/registry.schema.json` | file | validate stable feature head và immutable object |
| `@business-registry` | `scripts/business-registry.mjs` | script | validate, hash, publish và check business snapshot |

## Record

Business root là product model có evidence dùng chung cho frontend, backend và design. Nó ghi lại điều
source đã route thực sự làm: actor, flow, rule, state, entity, operation, surface, acceptance và unknown
rõ ràng. Nó không copy raw source hoặc nâng design idea, tài liệu mẫu hay suy luận của agent thành product truth.

## Law

Mỗi project sở hữu `<Source>/.worktrees/<project>/business`, linked worktree đã lock trên
`codex/business/<project>`. Stable `featureId` head trỏ tới immutable SHA-256 object. Mỗi feature hiện
hành còn publish `model.json` cho máy, `CONTEXT.md` gọn, Markdown module route theo task, aggregate
`spec.md` và `evidence.json`.

Mọi claim ảnh hưởng flow, rule, state, API, surface hoặc acceptance phải cite ít nhất một evidence row
đã bind vào role được route và exact source head. Thiếu evidence trở thành `unknown`, không trở thành
representative content. Target dirty chỉ được phép khi mọi dirty path nằm ngoài cited evidence boundary
và snapshot bind committed `HEAD`, không bind working-tree bytes.

Trước khi skill phụ thuộc business suy luận từ feature, nó check feature head hiện tại với routed FE/BE
head. Truth thiếu hoặc stale được refresh bởi `starci-business-analyze`; consumer không tự sửa ngầm.
Design preview dùng selected surface/region từ business object hiện hành, còn layout vẫn impressionistic
và block design vẫn sở hữu anatomy cuối.

## Rules

1. `featureId` ổn định; SHA-256 head là version.
2. Business state là durable và versioned; preview pack sinh lại được vẫn ở project cache.
3. FE/BE evidence đọc từ workspace route đã verify tại committed head.
4. Mọi claim không phải unknown cite evidence có trong cùng object.
5. Example import chỉ cho cấu trúc, không cho business fact.
6. `CONTEXT.md`, task module, `spec.md` và `evidence.json` là view sinh từ `model.json`; immutable object mới là authority.
7. LLM load `CONTEXT.md` trước, rồi chỉ load flow/surface module task cần.
8. Consumer từ chối feature stale thay vì bịa representative data.
9. Update business không cấp quyền sửa product source.

## Output

```text
business: <project>/<featureId>@<hash>
sources: <role@head ...>
surfaces: <surface ids>
unknowns: <count>
path: .worktrees/<project>/business/features/<featureId>/
```
