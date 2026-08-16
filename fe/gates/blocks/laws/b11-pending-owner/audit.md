---
id: fe-blocks-laws-b11-pending-owner-audit
title: audit.md
slug: /gates/blocks/laws/b11-pending-owner/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện luật B11: được tuân ở cả mức khối lẫn mức hàng.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `b11-pending-owner`

## Kết luận

Chấp nhận. Đây là một trong hai luật chỉ bị bác một lần mà lại được tuân tốt, vì cái giá của việc vi
phạm đã được đo và ghi lại ngay trong mã.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `B11-1` so với `B10` | Loại trừ được: cờ chờ của một hành động không phải một tình huống nghiệp vụ |
| `B11-2` so với `B11-1` | Loại trừ được bằng việc có hay không một id hàng |
| `B11-4` so với `B10-1` | Loại trừ được: mutation đè tạm thời, không mở rộng tập state |

## Repo sống đang ở đâu

**Đang tuân** ở cả hai mức. Hai mươi lăm trên hai mươi lăm khối tự chủ dữ liệu có chủ pending riêng;
bốn khối lặp so theo id; `WeeklyChallengeCard` giữ cờ nhận thưởng ngoài `state`.

## Nhận định

- Luật này chưa nói gì về **lỗi của một hành động**. Một bản dựng mù đã phải tự đoán: lỗi nhận
  thưởng thì nâng cả khối lên `failed`, hay báo cục bộ cạnh nút? Đây là khoảng trống thật của
  `b11` và `b12` cộng lại.
- Cũng chưa nói gì về việc **kiểm mutation có tồn tại hay không**. `DailyQuest` có một nhánh
  `claimable` không đạt tới được từ đường sống vì toàn repo không có mutation nhận thưởng nào. Một
  control không có mutation là một nhánh chết, và luật hiện tại không bắt kiểm chuyện đó.
