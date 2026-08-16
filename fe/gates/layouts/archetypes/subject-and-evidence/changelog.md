---
id: fe-layouts-archetypes-subject-and-evidence-changelog
title: changelog.md
slug: /gates/layouts/archetypes/subject-and-evidence/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của mô-đun khung danh tính bao quanh bằng chứng.
---

# changelog.md

> Phiên bản hiện tại: `1.00` · Mô-đun: `subject-and-evidence`

## Quy tắc phiên bản

Một thay đổi luật được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Thêm
một trạng thái vào union là thay đổi luật, vì `IDENT-5` liệt kê cả ma trận và trạng thái thứ sáu làm
đổi nghĩa của chữ "đủ".

## 1.00 — 2026-08-16

Lần đầu. Sinh ra từ mũi đo scope `layouts` trên repo sống `D:\Repositories\starci-academy-fe`
(branch `main`) cộng kho phán quyết `D:\Repositories\starci-academy-backend\.workflows`.

- **Đặt archetype.** `subject-and-evidence` phục vụ 10 page dưới
  `/profile/[username]` qua `profile-tabs-over-body` và `profile-rail-then-main`.
- **Sáu mã tình huống.** `IDENT-1` cột danh tính cạnh bằng chứng, `IDENT-2` gập bằng container query
  của chính vùng, `IDENT-3` mỗi dữ kiện một vùng, `IDENT-4` tab ở đây là route thật, `IDENT-5` ma
  trận trạng thái toàn màn, `IDENT-6` bốn lớp bọc một quyết định mỗi lớp.
- **Nhận một luật LAYOUT.** L8 vào `IDENT-3`.
- **Tách khỏi mô-đun cột đích đến bằng NỘI DUNG của cột**, không bằng vị trí của nó: cột này giữ một
  chủ thể, cột kia giữ nơi để đi. Hai archetype nhìn giống nhau trong ảnh chụp và khác nhau trong
  luật.
- **Đưa ma trận trạng thái vào tầng layout.** Đây là archetype duy nhất mà trạng thái thay cả khung,
  nên nó không được đẩy xuống tầng block. `IDENT-5` liệt kê đủ năm trạng thái, mỗi trạng thái khai
  chrome còn lại.
- **Ghi `loading` thiếu nhánh là vi phạm sống**, không phải một cách xuống cấp mềm: nửa connected vẫn
  tính ra trạng thái đó thật.
- **`IDENT-6` viết ở dạng phép thử gộp** thay vì lời khẳng định, vì lời khẳng định sẽ thua trong lần
  dọn dẹp đầu tiên.
- **Khai thẳng rằng `IDENT-3` mượn neo từ màn hình global search.** Nó là luật của mọi bố cục nhiều
  vùng và được đặt ở đây vì đây là archetype nhiều vùng duy nhất có một chủ thể chung để phân xử.
