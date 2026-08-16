---
id: fe-layouts-laws-l9-sticky-offset-is-page-local-changelog
title: changelog.md
slug: /fe/layouts/laws/l9-sticky-offset-is-page-local/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật L9.
---

# changelog.md

> Phiên bản hiện tại: `1.00` · Mô-đun: `l9-sticky-offset-is-page-local`

## Quy tắc phiên bản

Một thay đổi luật được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Thêm
một mã tình huống là bump nhỏ. Đổi câu `Law` là bump lớn cho cả kệ, vì `L3` và `L10` đều phân xử dựa
trên cái mốc nghỉ mà luật này cố định.

## Nghiệm thu — 2026-08-17

Đợt kiểm sau khi lập mô-đun. Không đổi câu `Law`, không thêm bớt mã tình huống, nên **không bump
phiên bản**.

- **Ghi một mâu thuẫn chéo với `L10`** vào [`audit.md`](./audit.md), ghi đối xứng bên ấy. Ngoại lệ
  "Two pinned siblings on one page" gọi con cuối đang ghim của `content-reader-frame` là hợp lệ và
  "not a conflict", trong khi `L10-2` gọi đúng selector ấy là vi phạm đang chạy vì con cuối
  `outline` là `optional` và trang bỏ hẳn slot đó khi bài học không có heading.
- **Thu hẹp câu "đang tuân ở cả chín chỗ".** Nó đúng cho giá trị offset và trần, không đúng cho việc
  chỗ ghim rơi trúng vùng nào. Bản sửa nằm ở phía mô-đun này nhưng là thay đổi luật, nên được ghi
  chứ chưa làm.

## 1.00 — 2026-08-17

Mô-đun được lập lần đầu trên kệ `fe/layouts/`, từ năm dòng từ chối trên hai hồ sơ và từ một lần đếm
đủ chín chỗ đặt `sticky` trong registry của repo sống.

- **Phát biểu offset là chiều cao chrome, không phải khoảng cách.** Đây là điều bốn trong năm dòng
  từ chối cùng nói, và là lý do một con số dùng chung cho hai trang luôn sai ở trang thứ hai.
- **Buộc ghim và trần thành một quyết định.** Bản nói riêng từng cái là bản đã để `80dvh` phẳng đi
  qua: nó ghim đúng nhưng trần không trừ navbar, và lỗi chỉ lộ ra ở cuối một rail dài.
- **Đặt bảy mã tình huống.** `L9-1` đến `L9-7`, trong đó `L9-5` phát ra **không gì cả** và vẫn là
  tình huống được phân loại, còn `L9-7` là lối thoát trung thực khi chrome chưa được đo.
- **Tách `L9-6` khỏi `L9-5`.** Hai thanh ghim đáy có ghim nhưng không có offset, nên gộp chúng vào
  mã "không ghim" sẽ làm mất chính cái phần đang ghim.
- **Đếm chrome bằng số hàng ghim, không bằng số băng nhìn thấy.** Trang hồ sơ có dải tab riêng trên
  body mà dải đó không sticky, nên nó đếm là một hàng. Đây là phép thử duy nhất tách được `L9-3`
  khỏi `L9-4` mà không cần nhìn màn hình.
- **Thêm `capOwner` vào `Inputs`** sau khi đo ra rail giá là chỗ duy nhất ghim do khung giữ còn trần
  do stylesheet giữ. Không có trường này thì nửa thứ hai của `L9-4` rơi mất một cách im lặng.
- **Ghi hai khoản nợ gate** vào `audit.md`, vì `stickyOffsetToken` và `maxHeightToken` trong
  `gate.schema.json` chưa diễn tả được `L9-4` và `L9-6`, thay vì để luật nói như thể chúng đã khai
  được.
