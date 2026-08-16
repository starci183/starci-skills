---
id: fe-layouts-laws-l8-one-field-one-region-changelog
title: changelog.md
slug: /fe/layouts/laws/l8-one-field-one-region/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật L8.
---

# changelog.md

> Phiên bản hiện tại: `1.00` · Mô-đun: `l8-one-field-one-region`

## Quy tắc phiên bản

Một thay đổi luật được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Thêm
một mã tình huống là bump nhỏ. Đổi câu `Law` là bump lớn cho cả kệ, vì `L8-5` chạy trước mọi mã đặt
chỗ khác và `L10` đọc đầu ra của luật này.

Một mã đang ở dạng cố định mà sau này thầy phán ngược thì nó chuyển thành *criterion* và đó là bump
lớn, không phải một dòng sửa nhỏ. Hôm nay `L8-7` là ứng viên gần nhất cho việc đó.

## 1.00 — 2026-08-17

Mô-đun được lập lần đầu trên kệ `fe/layouts/`, từ bốn dòng từ chối trên ba hồ sơ và từ một lần đọc
registry contract của repo sống ở nhánh `main`.

- **Đặt bảy mã tình huống.** `L8-1` đến `L8-7`, trong đó `L8-6` và `L8-7` là hai đường duy nhất cho
  phép một trường xuất hiện ở hai vùng, và cả hai đều hẹp, có tên, có neo.
- **Tách chuyện đếm ra khỏi chuyện đặt chỗ, và cho nó chạy trước.** Bản đầu tiên của phát biểu chỉ
  nói "mỗi trường thuộc đúng một vùng", nhưng dòng từ chối tại
  `.workflows\fidel\starci-academy\courses-runtime-projection-i18n-20260815-01.md:360` cho thấy chỗ
  hỏng nằm sớm hơn thế: phần tiết kiệm được và cái link giải thích nó bị vẽ thành hai sibling dọc,
  tức là một ý bị đếm thành hai dữ kiện trước khi có ai hỏi nó ở vùng nào. Nên `L8-5` được đặt riêng
  và được nói rõ là chạy trước.
- **Buộc class loại trừ nằm trên chính vùng khai trùng.** `L8-6` không chỉ đòi hai vùng loại trừ
  nhau, mà đòi bằng chứng loại trừ đọc được ngay tại chỗ bản sao xuất hiện. Repo sống làm đúng như
  vậy tại `contracts\index.ts:2582`, còn một wrapper mang class thay thì người đọc phải leo hai tầng
  mới biết luật có bị phá không.
- **Buộc vùng mất dữ kiện phải sửa `why` của chính nó.** Đây là nửa sau của `L8-2` và là khoản nợ đầu
  tiên trong [`audit.md`](./audit.md): `contracts\index.ts:2260` đã ghi lần chuyển, nhưng
  `:2262-2268` vẫn kể về rating như một hàng xóm chưa dọn đi.
- **Không viết ngoại lệ cho một trường không có vùng nào.** Vùng chi tiết của Global Search là nhà duy
  nhất của `snippet` và tự ẩn dưới `md`, nên dưới breakpoint đó trường này có không vùng nào. Bản này
  từ chối gọi đó là `L8-6` và ghi thẳng thành nợ, vì nếu nhận thì `L8-6` trở thành giấy phép bỏ
  trường.
- **Ghi ba khoản nợ đo được** vào `audit.md` thay vì để luật nói như thể chúng đã xong, trong đó
  khoản thứ ba nằm ngay trên dải sáu ô, tức là trên chính ví dụ mà `L8-4` dùng làm chỗ dựa.

### Ghi chú về neo

Hai dòng từ chối được giao cho mô-đun này kèm số dòng không còn tồn tại. Neo đúng sau khi đo lại là
`global-search-modal-spacing-listbox-20260815-01.md:466` và
`courses-runtime-projection-i18n-20260815-01.md:360`; hai hồ sơ đó dài 812 và 605 dòng. Nội dung cột
`Why` khớp nguyên văn với bản được giao, nên đây là lệch số dòng chứ không phải lệch bằng chứng.
