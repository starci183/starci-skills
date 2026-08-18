---
title: Stale registry
---

# Stale registry

## LOADS

| Alias | Target | Dùng khi |
|---|---|---|
| `@stale-source-gates` | `stale/source-gates` | declared project gate và source finding |
| `@stale-lint-machine` | `stale/lint-machine` | canon adoption và vendored-rule detection |
| `@stale-strict-fix` | `stale/strict-fix` | first-party Prettier integration |
| `@stale-why` | `stale/why` | contract index findability |
| `@stale-assurance` | `stale/assurance` | backend delivery assurance applicability và fence |
| `@stale-retired-structure` | `stale/retired-structure` | component tier đã bỏ, kể cả path rỗng |
| `@stale-remnant` | `stale/remnant` | legacy `.claude/` tree nested |

## Mục đích

Cho `starci-repair` và `starci-stale-list` dùng một vocabulary. Stale list đo các category này; repair áp
owner được nêu ở đây. Category bị copy vào một trong hai skill là second home và phải bỏ.

Cả hai skill đọc registry này trước. `starci-stale-list` sau đó đọc mọi module và chỉ dùng `Evidence cho
stale list`; `starci-repair` chỉ đọc module mà routed source chạm tới và dùng inventory, apply cùng proof.
Route staleness không có repair module ở đây vì owner của nó là `starci-init`.

## Categories

| Category | Stale khi | Được clear bởi |
|---|---|---|
| `route` | checkout, contract, branch hoặc recorded head không còn mô tả đúng máy này | `starci-init` |
| `source` | gate format/lint/type/build/unit đã khai báo fail, hoặc không có gate surface có nghĩa | `starci-repair`, source-gates pass |
| `index` | contract `why` mô tả shape thay vì need dùng để tìm nó | `starci-repair`, why pass |
| `machine` | thiếu published lint canon hoặc config import vendored rule copy | `starci-repair`, lint-machine pass |
| `formatter` | strict-fix scope còn first-party Prettier integration | `starci-repair`, strict-fix pass |
| `assurance` | assurance bắt buộc và delivery-fence fact đã chạm bị thiếu hoặc không blocking | `starci-repair`, assurance pass |
| `structure` | tier đã retire vẫn tồn tại, kể cả directory rỗng | `starci-repair`, retired-structure pass |
| `remnant` | routed checkout chứa `.claude/` nested từ tree cũ | `starci-repair`, remnant pass hoặc owner decision |

## Luật dùng chung

- `stale-list` chỉ report; không repair. `repair` phải đo trước khi ghi.
- Mỗi finding mang category, evidence, applicability và owner.
- `absent`, `invalid`, `stale`, `not required`, `unmeasured external` và `clean` là các verdict khác nhau.
- Route finding kết thúc repair trước khi đọc target source. Repair source qua stale route là nhắm vào
  checkout chưa verify.
- Decision được trả về; không giả làm defect để run tiếp tục.

## Output

Report theo project và role, rồi category. Silence không có nghĩa layer đã chạy: ghi `clean`, `not required`
hoặc `unmeasured external` khi bỏ trống sẽ gây hiểu sai.
