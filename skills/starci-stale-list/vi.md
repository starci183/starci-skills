---
title: starci-stale-list
---

# starci-stale-list

## LOADS

| Alias | Target | Kind | Vì sao |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/vi.md` | vi | output và authority contract chung |
| `@staleness` | `readiness/staleness/vi.md` | vi | taxonomy/router duy nhất dùng chung với repair |
| `@export-state` | `scripts/export-console-state.mjs` | script | workspace measurement read-only deterministic |
| `@port-offset-check` | `scripts/check-port-offsets.mjs` | script | Source allocation và collision measurement deterministic |
| `@source-quality` | `scripts/check-source-quality.mjs` | script | phép đo deterministic cho routed lint, coverage, E2E và strict Sonar |
| `@stale-debts` | `readiness/staleness/debts/vi.md` | vi | validate và report debt project/role hiện tại mà không repair |

## NESTED SKILLS

Không có. Skill này gọi tên owner và không invoke họ.

## Chạy

Đọc `@skill-shape`, `@staleness`, rồi mọi module registry route tới. Chỉ dùng `Evidence cho stale list`
của từng module; không apply inventory, apply hay proof step.

Measurement-only: local check command có thể sinh cache/build output ignored, nhưng report vừa repair
tracked source hoặc external state thì không còn ai tin measurement của nó.

## PROCESS

### 1 — Lập boundary read-only

`Touching` không có gì. Đọc `.workspace/config.json` và mọi declared role. Nếu workspace root absent,
report fact đó và dừng.

### 2 — Chạy shared scanner

```bash
node @export-state --stale
```

Script đo route, contract, manifest, lint adoption, first-party formatter integration, local assurance
wiring, retired structure và remnant. Nó exit non-zero khi stale; exit đó là verdict, không phải lý do
reimplement scan trong conversation.

Sau đó chạy `node @port-offset-check`. Exit non-zero của nó là verdict `port-offset`. Gọi tên rõ mọi project
được exclude có chủ ý; không làm family bị exclude biến mất khỏi report.

Chạy `node @source-quality --debts` và report riêng mọi Markdown debt active, invalid hoặc expired.

### 3 — Report verdict từ registry

Group theo project, role nằm dưới. Dùng category/verdict name từ `@staleness`. Với mỗi module, emit
`Evidence cho stale list`, current count/fact và clearing owner. Report clean và `not required` rõ ràng khi
silence sẽ giống scan bị bỏ.

### 4 — Đo local readiness gate

Với module source-gates, chạy mọi entrypoint đã khai báo cho mọi routed role theo thứ tự: format, lint, typecheck,
build, unit coverage, E2E, Sonar. Ghi exact command/exit status, lint 0/0, coverage metric, E2E entrypoint/test/
pass count và Sonar verdict. Unit phải S/L/F ≥80%, branches ≥75%, patch/new metric ≥90%; E2E phải có test thật
và mọi test pass. State ignored được phép sinh; tracked source đổi thì dừng report. Thiếu prerequisite hoặc gate
unmeasured/fail khiến project không được gọi ready.
Dùng `node @source-quality`; exit non-zero của nó là verdict source fence có thứ tự, không phải quyền
reimplement, skip hoặc hạ failed fact.
Report đúng verdict `debt` và `deliveryAllowed`; không đổi tên thành `pass` hay `ready`.

### 5 — Giữ external assurance trung thực

Với module assurance, chỉ đọc tên và local wiring. Không decrypt record hoặc đọc provider value. Required
check, expected-app binding và secret existence/value giữ `unmeasured external` trừ khi authorized API cho evidence.

### 6 — Dừng mà không repair

Trả mọi category, evidence và owner. Không refresh route, edit reason, install package, bỏ Prettier, tạo
assurance state, move component hoặc delete remnant. Fix sau đó là repair/initialization request riêng với
authority riêng.

## Stops

- `.workspace` absent → report không có route và kết thúc.
- Route JSON invalid → report `invalid`, không phải `absent` hay `stale`.
- Category không đọc an toàn được → report `unmeasured` kèm reason; không guess.
- Reader hỏi repair → finish inventory; capability khác sở hữu write.

## OUTPUT

Prose gọn theo project/category; không status table. Bao gồm clean, `not required`, `unmeasured` khi cần.
Không bao gồm credential value.
