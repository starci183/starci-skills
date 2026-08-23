---
title: Why index
---

# Why index

## LOADS

None.

## Dấu hiệu stale

`why` của contract entry mô tả business hoặc shape thay vì need dùng để retrieve nó. Gate surface có thể
xanh trong khi search sau đó miss entry và tạo duplicate.

## Evidence cho stale list

Đọc recorded miss trước. Sau đó classify mọi non-page entry theo chính key của nó:

| Finding | Nghĩa |
|---|---|
| `narrower` | key reusable nhưng `why` vẫn gọi tên feature |
| `vague` | `why` gọi tên shape thay vì need |
| `wider` | `why` hứa rộng hơn key/children có thể giữ; layout sở hữu key decision |
| `specific` | key và reason đều cố ý narrow; giữ nguyên |

Report total entry, page key, need-shaped reason và count từng classification. Không edit.

## Inventory cho repair

Recorded miss có trọng lượng cao hơn heuristic count. Batch entry còn lại theo family, so mỗi reason với
key, children và fixed class thật; hỏi thay vì invent need không có evidence.

## Apply

Chỉ đổi value `why`. Reason nói khi reader cần entry, thường là `if you need ...` hoặc condition tương
đương. Không làm nó rộng hơn key hoặc thứ entry thực sự fix. Route-scoped page key được exclude by construction.

## Proof

Diff chỉ đổi dòng `why`, classification đi từ stale sang need-shaped, recorded miss resolve và contract vẫn
typecheck/build. Key, class, child hoặc host bị đổi sẽ mở lại pass.
