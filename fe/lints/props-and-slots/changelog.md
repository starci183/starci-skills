---
id: fe-lints-props-and-slots-changelog
title: changelog.md
slug: /fe/lints/props-and-slots/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của bản ghi thực thi cho luật props và slot.
---

# changelog.md

> Current version: `2.00` · Mô-đun: `props-and-slots`

## Version Policy

Một thay đổi được chấp nhận về **phần thực thi được ghi ở đây** thì tăng mô-đun thêm `0.01` và cập
nhật cả **năm** bản ghi. Đổi số chính (`x.00`) dành cho thay đổi về hình dạng mô-đun hoặc về shelf mà
nó nằm trên.

Bản ghi này mô tả **cái đang chạy**, không mô tả cái nên chạy. Nếu một rule đổi hành vi thì bản ghi
đổi theo và tăng số; nếu một rule **đáng lẽ nên có** thì nó đi vào mục "Rủi ro còn mở" của
[`audit.md`](./audit.md) và **không** làm tăng số ở đây. Luật cao nhất của bộ luật này: một rule
không chỉ tay vào được là một đề xuất, không phải một rule.

## 2.00 — 2026-08-16

Lập mô-đun. Đây là bản ghi đầu tiên tách riêng phần **thực thi** ra khỏi phần **luật**: luật nói cái
gì bị cấm, bản ghi này nói máy nhìn thấy được bao nhiêu phần trong đó.

- **Phạm vi.** Ghi đúng ba rule mà nguồn của luật này công bố, mỗi rule dưới **tên nó công bố**:
  `no-inline-parameter-type`, `no-children-slot`, `no-surface-list-items-slot`. Không đặt thêm mã số
  cho rule, vì tên là chuỗi đã xuất hiện trong log build, trong comment tắt rule và trong mọi cuộc
  trao đổi về lần đỏ đó; một định danh thứ hai chỉ tạo ra một rule hai tên.
- **Gói xuất bản.** Ba rule này đi trong `@starci/eslint-canon-fe`, dưới tiền tố định danh
  `starci-fe/`, và cả ba được gói tự đề nghị ở mức `error`.
- **Ánh xạ luật.** Ba trên ba rule giữ đúng một mã: `SLOTS-3`, `SLOTS-4`, `SLOTS-7`. Bốn mã còn lại
  của luật — `SLOTS-1`, `SLOTS-2`, `SLOTS-5`, `SLOTS-6` — được ghi rõ là **không có rule trong mô-đun
  này**, hai mã đầu vì hàng rào kiểu giữ chặt hơn, hai mã sau vì hiện không ai giữ.
- **Bảng phát hiện.** Ghi cơ chế thật của từng rule: loại node được duyệt, cách đọc `context.filename`,
  chuỗi mẫu của đường dẫn import, và cách gom ràng buộc tên tại chỗ gọi JSX.
- **Bảng cửa còn mở.** Ghi **mười tám** cửa còn mở trên ba rule, cùng mười ràng buộc đã đóng.
  Trong đó có bốn cửa được coi là nặng nhất: bọc hình dạng vô danh vào một kiểu tiện ích; kế thừa
  slot từ file khác; đổi tên slot hoặc đổi tên làn dữ liệu; và trải object tại chỗ gọi.
- **Ghi lệch giữa tên và hành vi.** Ba lệch được ghi ở `audit.md`: một rule **rộng hơn** tên nó gợi
  ra vì không có cổng tên file; một rule có chuỗi mô tả nói "ba shell" trong khi mã miễn **bốn**; và
  một rule mang chữ "slot" trong tên nhưng chỉ canh **chỗ gọi**, không bao giờ đọc kiểu của bề mặt.
- **Không có `prompt.md`.** Mô-đun đúng năm bản ghi: `INDEX.md`, `vi.md`, `example.md`, `audit.md`,
  `changelog.md`.
