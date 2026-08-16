---
id: fe-layouts-nguoi-giu-phien-vo-hinh-changelog
title: changelog.md
slug: /fe/layouts/nguoi-giu-phien-vo-hinh/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của mô-đun người giữ phiên vô hình.
---

# changelog.md

> Phiên bản hiện tại: `1.00` · Mô-đun: `nguoi-giu-phien-vo-hinh`

## Quy tắc phiên bản

Một thay đổi luật được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Một chỗ
mount mới — bất cứ đâu ngoài gốc locale và layout của một cụm — là thay đổi luật, vì `KEEPER-1` liệt
kê đủ ứng viên và bác hai cái bằng phán quyết.

## 1.00 — 2026-08-16

Lần đầu. Sinh ra từ mũi đo scope `layouts` trên repo sống `D:\Repositories\starci-academy-fe`
(branch `main`) cộng kho phán quyết `D:\Repositories\starci-academy-backend\.workflows`.

- **Đặt archetype.** `nguoi-giu-phien-vo-hinh` phục vụ `GlobalAiChatLayout` (toàn bộ 51 page trừ
  `/authentication` và bốn dạng route đánh giá trực tiếp) và `PlaygroundSessionLayout` (2 page).
- **Bảy mã tình huống.** `KEEPER-1` độ cao mount bằng phạm vi sống sót, `KEEPER-2` bạn đồng hành là
  hành tinh rời, `KEEPER-3` trục thường trực không phải mặt của trang, `KEEPER-4` cái đứng yên là dữ
  liệu, `KEEPER-5` reset hẹp và tường minh, `KEEPER-6` một predicate hai chủ sở hữu, `KEEPER-7` notice
  thay mặt trang.
- **Nhận hai luật LAYOUT.** L1 vào `KEEPER-1`, L2 vào `KEEPER-3`.
- **Giữ nguyên bảng ba ứng viên chỗ mount** kèm cả hai phán quyết bác — cây provider và chrome lặp
  theo cụm — thay vì rút gọn thành "mount ở gốc locale". Rút gọn làm mất đúng phần dạy được: chỗ
  mount là lời tuyên bố về tuổi thọ, không phải chuyện gọn gàng.
- **`KEEPER-4` tách thành mã riêng.** Nếu "đứng yên" chỉ có nghĩa là pixel thì một layout không vẽ gì
  sẽ bị coi là layout thừa. Đây là lý do archetype này tồn tại riêng.
- **`KEEPER-6` viết ở cả hai mô-đun** — ở đây và ở
  [`cot-dich-den-dung-canh-than-trang`](../cot-dich-den-dung-canh-than-trang/INDEX.md) — vì vi phạm
  chỉ xảy ra khi **một** bên tự nuôi danh sách route riêng.
- **Cấm khai hành vi hẹp cho frame không có breakpoint.** `playground-session-frame` không có một
  breakpoint nào, nên mọi vùng của nó khai `khong-doi`.
- **Không viết luật cho nội thất drawer.** Chưa mở, chưa đo; ghi vào [`audit.md`](./audit.md) và vào
  `Owed` của [shelf](../INDEX.md).
