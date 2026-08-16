---
id: fe-governance-refactor-parity-audit
title: audit.md
slug: /fe/governance/refactor-parity/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện AI cho module refactor-parity.
---

# audit.md

> Version được audit: `1.02` · Trạng thái: **Advisory** · Người quyết định cuối: **Canon owner**

## Kết luận

| Phần | Đánh giá | Nhận định |
|---|---|---|
| `INDEX.md` | Tốt | Required evidence và review output buộc parity vượt khỏi screenshot |
| `vi.md` | Tốt | Bao phủ semantic primitive, landmark, exact evidence, state matrix, selection và overflow |
| `example.md` | Tốt, cần live review | Tám demo IDs dùng course/reviews có dữ liệu thật và các interaction trap cụ thể |
| Live UI | **Đã integration** | Tám ID render HeroUI thật; build/route đạt, keyboard/accessibility/source-order vẫn cần semantic verification |

## Điểm tốt

- Giữ đầy đủ tám luật source, đồng thời biến thành checklist output có thể review.
- Course content và student reviews có count, order, state, action, semantics cụ thể; không dùng generic
  placeholder card.
- Tách rõ refactor khỏi redesign, kể cả khi thay đổi được gọi là accessibility improvement.

## Giới hạn

- Exact computed styles/assets cần reference thật trong target repository; module không cung cấp chúng.
- HeroUI live demos chỉ minh họa principle, không phải parity evidence cho một migration cụ thể.
- Screenshot cannot verify roles, focus, names, selected state hoặc overflow interaction; automated and
  manual interaction checks remain required.
- Complete matrix có thể lớn. Project plan phải chọn applicable axes nhưng không được bỏ silently.

## Điểm chờ cân nhắc

| ID | Câu hỏi | Ưu tiên |
|---|---|---:|
| R-01 | Có cần template machine-readable cho parity evidence matrix không? | P1 |
| R-02 | Có cần accessibility-tree snapshot trong verification baseline không? | P1 |
| R-03 | Có cần tách overflow parity thành module interaction riêng khi evidence tăng? | P2 |

Audit không tự cấp pass. Project-specific parity chỉ pass sau khi reference matrix được kiểm.
