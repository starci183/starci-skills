---
id: fe-blocks-laws-b12-error-owner-audit
title: audit.md
slug: /fe/blocks/laws/b12-error-owner/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện luật B12 và bảy khối đang không theo.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `b12-error-owner`

## Kết luận

Chấp nhận, và đây là luật bị vi phạm nhiều nhất trên kệ so với số lần nó bị bác.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `B12-2` so với `B12-3` | Loại trừ được bằng một câu hỏi kiểm được: file này có đọc `.error` không |
| `B12-3` so với `B12-4` | Loại trừ được bằng `ownsRequest` |
| `B12-1` so với `b4` | Loại trừ được bằng sự có mặt của nút đọc lại |

## Repo sống đang ở đâu

**Đang vi phạm ở bảy khối.** Sáu khối gộp lỗi vào một bản vẽ vô hình (`CreditStatRow`,
`RewardStatRow`, `StreakStatRow`, `ProfileIdentityRow`, `TrendingContents`, `WhoToFollow`) — bốn
trong đó có lý do viết ra nên là `B12-2` hợp lệ, hai không. Một khối không đọc lỗi lần nào
(`ProfileHero`) nên shimmer vĩnh viễn.

## Nhận định

- Không có gate nào bắt `B12-3`. Một lint rule đếm được: "khối tự gọi hook `*Swr` thì phải đọc
  `.error`" là khả thi và chưa tồn tại.
- `B12-2` phụ thuộc vào một **câu chữ trong docstring**, thứ không máy nào kiểm được là thật hay
  cho đủ. Gate chỉ yêu cầu một `reason` có neo.
- Chưa đo được ý định sản phẩm sau hai khối `hidden` không có lý do. Chỗ này cần thầy trả lời.
