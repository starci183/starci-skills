---
title: Stale registry
---

# Stale registry

## LOADS

| Alias | Target | Kind | Vì sao |
|---|---|---|---|
| `@stale-source-gates` | `readiness/staleness/source-gates/vi.md` | vi | declared project gate và source finding |
| `@stale-port-offset` | `readiness/staleness/port-offset/vi.md` | vi | family offset, application slot và collision proof do Source sở hữu |
| `@stale-lint-machine` | `readiness/staleness/lint-machine/vi.md` | vi | canon adoption và vendored-rule detection |
| `@stale-strict-fix` | `readiness/staleness/strict-fix/vi.md` | vi | first-party Prettier integration |
| `@stale-why` | `readiness/staleness/why/vi.md` | vi | contract index findability |
| `@stale-assurance` | `readiness/staleness/assurance/vi.md` | vi | applicability và delivery fence của frontend lẫn backend |
| `@stale-retired-structure` | `readiness/staleness/retired-structure/vi.md` | vi | component tier đã bỏ, kể cả path rỗng |
| `@stale-remnant` | `readiness/staleness/remnant/vi.md` | vi | legacy `.claude/` tree nested |

## Mục đích

Registry route qua `@stale-source-gates`, `@stale-port-offset`, `@stale-lint-machine`, `@stale-strict-fix`, `@stale-why`,
`@stale-assurance`, `@stale-retired-structure` và `@stale-remnant`.

Cho `starci-repair` và `starci-stale-list` dùng một vocabulary. Stale list đo các category này; repair áp
owner được nêu ở đây. Category bị copy vào một trong hai skill là second home và phải bỏ.

Cả hai skill đọc registry này trước. `starci-stale-list` sau đó đọc mọi module và chỉ dùng `Evidence cho
stale list`; `starci-repair` chỉ đọc module mà routed source chạm tới và dùng inventory, apply cùng proof.
Route staleness không có repair module ở đây vì owner của nó là `starci-init`.

## Categories

| Category | Stale khi | Được clear bởi |
|---|---|---|
| `route` | checkout, contract, branch hoặc recorded head không còn mô tả đúng máy này | `starci-init` |
| `port-offset` | Source allocation absent/invalid, product sở hữu offset, projection lệch hoặc local listener collision | `starci-repair`, port-offset pass |
| `source` | routed role thiếu hoặc fail fence format→lint→typecheck→build→unit coverage→E2E→Sonar, gồm lint warning, coverage dưới ngưỡng, E2E giả/rỗng hoặc thiếu Sonar | `starci-repair`, source-gates pass |
| `index` | contract `why` mô tả shape thay vì need dùng để tìm nó | `starci-repair`, why pass |
| `machine` | thiếu published lint canon hoặc config import vendored rule copy | `starci-repair`, lint-machine pass |
| `formatter` | strict-fix scope còn first-party Prettier integration | `starci-repair`, strict-fix pass |
| `assurance` | assurance bắt buộc và delivery-fence fact đã chạm bị thiếu hoặc không blocking | `starci-repair`, assurance pass |
| `structure` | tier đã retire vẫn tồn tại, kể cả directory rỗng | `starci-repair`, retired-structure pass |
| `remnant` | routed checkout chứa `.claude/` nested từ tree cũ | `starci-repair`, remnant pass hoặc owner decision |

## Luật dùng chung

- `stale-list` chỉ report; không repair. `repair` phải đo trước khi ghi.
- `ready` cần evidence chạy local trên checkout hiện tại cho mọi routed role. Fence source là
  format→lint→typecheck→build→unit coverage→E2E→Sonar; lint 0 error/0 warning, unit S/L/F ≥80%, branches
  ≥75%, patch/new metric ≥90%, E2E phải có entrypoint đã khai báo và tồn tại, test thật, mọi test pass.
  `skip`, `todo`, `passWithNoTests`, zero-test và check substitute bị reject. Gate chỉ discover mà chưa chạy là
  `unmeasured` và không bao giờ đủ cho ready.
- Mỗi finding mang category, evidence, applicability và owner.
- `absent`, `invalid`, `stale`, `not required`, `unmeasured external` và `clean` là các verdict khác nhau.
- Route finding kết thúc repair trước khi đọc target source. Repair source qua stale route là nhắm vào
  checkout chưa verify.
- Decision được trả về; không giả làm defect để run tiếp tục.

## Output

Report theo project và role, rồi category. Silence không có nghĩa layer đã chạy: ghi `clean`, `not required`
hoặc `unmeasured external` khi bỏ trống sẽ gây hiểu sai.
