---
id: fe-blocks-laws-b4-empty-is-a-state-audit
title: audit.md
slug: /fe/blocks/laws/b4-empty-is-a-state/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện luật B4 và chín khối đang trả null, trong đó năm khối chưa có lý do.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `b4-empty-is-a-state`

## Kết luận

Chấp nhận, với một câu hỏi còn mở phải do thầy trả lời.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `B4-1` so với `B4-3` | Loại trừ được bằng envelope: `null` là rỗng, `undefined` là chờ |
| `B4-1` so với `B4-2` | Loại trừ được bằng sự có mặt của nút đọc lại |
| `B4-4` so với `B4-5` | Loại trừ được bằng **điều kiện người xem có tên**; không có tên thì luôn là `B4-5` |
| `B4-6` so với `B4-1` | Loại trừ được: một câu không mang `globalId` của dữ liệu |

## Repo sống đang ở đâu

Mười một khối tuân. Chín khối trả `null` ở một trạng thái đã settle: `CreditStatRow`,
`RewardStatRow`, `StreakStatRow`, `ProfileIdentityRow`, `ChangelogList` (đều `empty`), và
`RecommendedCourses`, `TrendingContents`, `UpcomingLivestreamCard`, `WhoToFollow` (đều `hidden`).
Nhóm sáu file `profile/overview` dùng hình dạng `B4-6`.

## Nhận định

- Bốn khối danh tính có lý do viết ra nên là `B4-4` hợp lệ. Năm khối `hidden` thì không có lý do
  nào trong mã, và **không đo được từ mã** đâu là quyết định sản phẩm cố ý, đâu là lỗi. Đây là câu
  hỏi phải hỏi thầy, không phải chỗ để đoán.
- `B4-6` là vi phạm rõ ràng nhất trên kệ này nhưng cũng là chỗ ít được bảo vệ nhất: sáu file đó nằm
  ngoài phạm vi của luật file-layout trong lint, nên không có gate nào nhìn thấy chúng.
- Bài test pending-gate chỉ phủ mười ba khối dashboard. Các miền khác không có gate tương đương, nên
  `B4-3` ở `courses`, `coding`, `learn`, `profile` được giữ bằng thói quen.
- Chưa render khối nào để xác nhận notice rỗng thật sự giữ nguyên nhãn dưới cùng route, viewport,
  theme và persona. Mọi khẳng định ở đây đọc từ nguồn.
