---
id: fe-blocks-laws-b9-list-label-owner-audit
title: audit.md
slug: /gates/blocks/laws/b9-list-label-owner/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện luật B9 và chỗ vi phạm còn sống.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `b9-list-label-owner`

## Kết luận

Chấp nhận. Vi phạm cũ ở tầng trang đã sửa; còn đúng một chỗ lệch ở tầng overlay.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `B9-1` so với `B9-3` | Loại trừ được bằng câu hỏi có chủ ngoài vẽ đúng nhãn đó hay không |
| `B9-3` so với `B9-2` | Loại trừ được bằng `accessibleOnly`: tên cho trình đọc màn hình không phải nhãn đã vẽ |
| `B9` so với `b1` | Loại trừ được: `isNested` nói về viền, `isLabelHidden` nói về tên |

## Repo sống đang ở đâu

Chỉ còn hai chỗ dùng `isLabelHidden`, không còn chỗ nào ở tầng trang. `TopLearners` hợp lệ.
`GlobalSearchResults` không: nhãn bị ẩn không được vẽ ở đâu cả.

## Nhận định

- Gate bắt được phần hình thức — khai `labelHidden` thì phải khai `outerLabelDrawnBy`. Nhưng gate
  không kiểm được rằng chủ được nêu **thật sự đang vẽ** cái nhãn đó; đó vẫn là việc của người đọc.
- Luật này nhỏ (hai lần bị bác) nhưng nằm ở chỗ hiểm: sai của nó không nhìn thấy được ở chỗ thứ
  nhất, chỉ lộ ra ở chỗ thứ hai dùng lại.
