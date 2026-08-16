---
id: fe-senses-hierarchy-audit
title: audit.md
slug: /fe/senses/hierarchy/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện AI cho module hierarchy.
---

# audit.md

> Version được audit: `1.02` · Trạng thái: **Advisory** · Người quyết định cuối: **Canon owner**

## Kết luận

| Phần | Đánh giá | Nhận định |
|---|---|---|
| `INDEX.md` | Tốt | Giữ đủ ten laws trong ordered decision và invariants ngắn |
| `vi.md` | Tốt | Reading order, emphasis budget và state parity được giải thích bằng dữ liệu course/review |
| `example.md` | Tốt, cần live review | Có sáu demo IDs, course content và student reviews đủ chi tiết để test lead/support/detail |
| Live UI | **Đã integration** | Sáu ID render HeroUI thật; build/route đạt, source order và responsive output vẫn cần semantic review |

## Điểm tốt

- Machine record bắt AI xuất first/second/third và đúng một lead thay vì review bằng cảm giác.
- Dữ liệu thật tránh lỗi title cộng placeholder: curriculum có progress, next item, duration; reviews
  có score, sample, recommendation, distribution và review evidence.
- Giữ nguyên các điểm khó của nguồn: colour-last, source/visual parity, fit trap, state parity,
  shallow depth và point-bearing headings.

## Giới hạn

- “What the surface exists for” phụ thuộc user/task context. Cùng course page có order khác cho learner
  và prospective buyer; canon không thể chọn thay product decision.
- Typography scale cụ thể không được quy định ở đây. Module chỉ quy định quan hệ rank.
- Live UI đã qua integration build; keyboard/source order và responsive vẫn cần semantic review,
  không thể kết luận chỉ từ screenshot desktop.
- Heading point-bearing có thể xung đột localization length; cần content review riêng.

## Điểm chờ cân nhắc

| ID | Câu hỏi | Ưu tiên |
|---|---|---:|
| H-01 | Có cần DOM-order test tự động cho demo two-column không? | P1 |
| H-02 | Có cần interactive state switch loading/empty/error/ready không? | P2 |
| H-03 | Có cần contrast-free/grayscale preview để test colour-last không? | P2 |

Audit không tự sửa canon. Mọi disposition được chấp nhận phải tăng version.
