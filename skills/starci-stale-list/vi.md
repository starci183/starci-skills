---
title: starci-stale-list
---

# starci-stale-list

## LOADS

| Alias | Target | Kind | Vì sao |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape` | module | output và authority contract chung |
| `@stale-registry` | `stale` | registry | taxonomy/router duy nhất dùng chung với repair |
| `@export-state` | `scripts/export-console-state.mjs` | script | workspace measurement read-only deterministic |

## NESTED SKILLS

Không có. Skill này gọi tên owner và không invoke họ.

## Chạy

Đọc `@skill-shape`, `@stale-registry`, rồi mọi module registry route tới. Chỉ dùng `Evidence cho stale list`
của từng module; không apply inventory, apply hay proof step.

Plan-only: report vừa repair thì không còn ai tin measurement của nó.

## PROCESS

### 1 — Lập boundary read-only

`Phase` là `plan`; `Touching` không có gì. Đọc `.workspace/config.json` và mọi declared role. Nếu workspace
root absent, report fact đó và dừng.

### 2 — Chạy shared scanner

```bash
node @export-state --stale
```

Script đo route, contract, manifest, lint adoption, first-party formatter integration, local assurance
wiring, retired structure và remnant. Nó exit non-zero khi stale; exit đó là verdict, không phải lý do
reimplement scan trong conversation.

### 3 — Report verdict từ registry

Group theo project, role nằm dưới. Dùng category/verdict name từ `@stale-registry`. Với mỗi module, emit
`Evidence cho stale list`, current count/fact và clearing owner. Report clean và `not required` rõ ràng khi
silence sẽ giống scan bị bỏ.

### 4 — Giữ project gate unmeasured

Với `@stale-source-gates`, chỉ list declared format/lint/typecheck/build/unit entrypoint. Không chạy chúng.
Typecheck/build/test có thể ghi state; chỉ chạy lint sẽ làm report trông rộng hơn thực tế.

### 5 — Giữ external assurance trung thực

Với `@stale-assurance`, chỉ đọc tên và local wiring. Không decrypt record hoặc đọc provider value. Required
check, expected-app binding và secret existence/value giữ `unmeasured external` trừ khi authorized API cho evidence.

### 6 — Dừng mà không repair

Trả mọi category, evidence và owner. Không refresh route, edit reason, install package, bỏ Prettier, tạo
assurance state, move component hoặc delete remnant. Fix sau đó là request `starci-repair`/`starci-init`
riêng với approval riêng.

## Stops

- `.workspace` absent → report không có route và kết thúc.
- Route JSON invalid → report `invalid`, không phải `absent` hay `stale`.
- Category không đọc an toàn được → report `unmeasured` kèm reason; không guess.
- Reader hỏi repair → finish inventory; capability khác sở hữu write.

## OUTPUT

Prose gọn theo project/category; không status table. Bao gồm clean, `not required`, `unmeasured` khi cần.
Không bao gồm credential value.
