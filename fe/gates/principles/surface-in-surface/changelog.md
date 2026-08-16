---
id: fe-principles-surface-in-surface-changelog
title: changelog.md
slug: /gates/principles/surface-in-surface/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật Bề mặt in bề mặt.
---

# changelog.md

> Phiên bản hiện tại: `2.00` · Mô-đun: `surface-in-surface`

## Quy tắc phiên bản

Một thay đổi luật được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc nhóm mà nó nằm trên.

## 2.00 — 2026-08-16

Đổi số chính vì hai thứ đổi cùng lúc: nhóm và hình dạng mô-đun.

- **Chuyển nhóm.** `fe/design/surface-in-surface/` → `gates/principles/surface-in-surface/`. Nhóm
  `design` bị tách làm ba: `principles/` giữ các nguyên tắc dựng hình bắt buộc, `senses/` giữ những
  gì người đọc cảm nhận, `governance/` giữ ngoại lệ và tính đồng nhất. Toàn bộ `id` và `slug` đổi theo nhóm
  mới, và không còn tiền tố hay đường dẫn nào của nhóm cũ sống sót trong mô-đun.
- **Đặt mã tình huống.** Sáu cách thể hiện cũ (`PAGE_SURFACE`, `PAGE_JOINED_LIST`, `FRAMELESS_SECTION`,
  `FLAT`, `NESTED_OUTLINE`, `SECONDARY_CONTROL`) nay mang mã `SURFACE-IN-SURFACE-1` …
  `SURFACE-IN-SURFACE-6`, đánh số theo **thứ tự người đọc gặp**: từ nền trang đi vào trong. Mã đặt
  tên cho **tình huống**, className đặt tên cho **ranh giới**; hai thứ không phải một, và hai mã
  không vẽ ranh giới nào.
- **Nâng luật thành bắt buộc.** Bổ sung tuyên bố rằng mọi vùng chứa hiển thị ra đều rơi vào đúng một
  mã, và không có kích thước nào nhỏ tới mức được miễn. "Chỉ là cái div bọc thôi mà" được nêu đích
  danh là chỗ luật bị bỏ qua nhiều nhất.
- **Gộp `prompt.md` vào `example.md`.** Bảng ánh xạ yêu cầu và bảng phân định ranh giới nay nằm cùng
  chỗ với những ví dụ mà chúng phân định. Mô-đun còn **năm** tài liệu; `prompt.md` đã bị xoá.
- **Viết lại `vi.md` theo từng mã.** Mỗi mã có tình huống nghiệp vụ, dấu hiệu nhận biết, một câu tự
  hỏi phân định, ranh giới với từng mã kề, và danh sách tình huống nghiệp vụ hay gặp.
- **Viết lại `example.md` cho đủ trường hợp.** Mỗi mã nhiều trường hợp, kèm mục ngoại lệ và mục "trông giống
  nhưng không phải mã này". Thêm hẳn một mục **mã lồng mã** — trang đầy đủ, thẻ đầy đủ, phần tử chồng lớp đầy
  đủ, cùng một tập liền mạch dưới hai bề mặt chứa, và tính đồng nhất khung chờ — vì luật *một vùng chứa, một tuyên bố*
  chỉ nhìn thấy được khi hai mã nằm trong nhau.
- **Bỏ bản xem trước trực tiếp gắn với một sản phẩm.** Năm khối bản xem trước hiển thị bằng thành phần riêng của một ứng
  dụng đã bị rút hẳn; mọi ví dụ nay là `className` thuần trên mã đánh dấu thường. Một luật ở nhóm này
  phải đúng với bất kỳ giao diện nào; ví dụ cần tên riêng của một sản phẩm mới đọc được là ví dụ
  đứng sai chỗ.
- **Nêu rõ biến thiết kế là ngữ nghĩa, không phải tên sản phẩm.** `bg-card`, `bg-background`, `border-border`,
  `text-foreground` và `shadow-surface` được mô tả là năm tên mà giao diện nào cũng tự định nghĩa
  được: nền bề mặt, nền trang, một màu ranh giới, một màu chữ, một mức độ nổi.

### Giữ nguyên

- Sáu cách thể hiện và sáu chuỗi className, không đổi một ký tự nào.
- Độ nổi và dàn ý loại trừ lẫn nhau; trang bề mặt không đường viền; dàn ý lồng nhau không bóng.
- Quan hệ nhóm trùng bề mặt chứa và quan hệ nhóm không gọi được tên đều về phẳng.
- Phần nội dung chứa phần tử ngang hàng đã có ranh giới dùng nền trang.
- Phần tử chồng lớp đã sở hữu ranh giới tác vụ; nội dung thường bên trong phẳng.
- Một thành phần điều khiển không bao giờ được bọc bề mặt; ưu tiên vẫn thuộc cảm nhận về hành động.
- Chỉ **quan hệ nhóm liền mạch** được nhận làm lồng ranh giới. Phản đối đối với quyết định này được ghi
  ở `audit.md` mục "rủi ro còn mở", không được tự sửa trong lần viết lại này.
- `gap`, `padding`, `margin` nằm ngoài mô-đun, cả ô nhập liệu lẫn đầu ra.
- Tính đồng nhất trạng thái: đang tải, rỗng, lỗi và thiết kế đáp ứng giữ nguyên quyền sở hữu ranh giới.

## 1.03 — 2026-08-16

- Định hình lại mô-đun thành luật bề mặt-ngữ cảnh bất biến, đầu ra là `className` tổng quát.
- Đóng sáu cách thể hiện: trang, phẳng, frameless, liền mạch-danh sách, lồng nhau-dàn ý, phụ-thành phần điều khiển.
- Làm lồng nhau cách thể hiện thành chính xác: một đường viền, nền trong suốt, không bóng.
- Thêm mặc định phụ cho thành phần điều khiển cục bộ, để nghĩa "chính" cho cảm nhận về hành động.
- Thêm `prompt.md` với trường hợp thuần nghiệp vụ và các bẫy bịa.
- Chuẩn hoá `vi.md` thành định nghĩa, bảng quyết định, luật, TSX tổng quát và ngoại lệ.
- Thay kết quả công khai cho quan hệ nhóm thiếu bằng mặc định phẳng; phần hỏi lại chỉ còn trong yêu cầu.
- Chuẩn hoá biến thiết kế ranh giới thành `bg-background`, `bg-card`, `border-border`.
- Gỡ mọi quyền sở hữu `gap`, `padding`, `margin` khỏi luật bề mặt.

## 1.02 — 2026-08-16

- Thêm năm ví dụ minh hoạ bề mặt sống và các ranh giới trường hợp áp dụng/không áp dụng đầy đủ.
- Giữ ngoại lệ hẹp cho liền mạch danh sách.

## 1.01 — 2026-08-16

- Dựng lần đầu: quyền sở hữu ranh giới, flattening, split/merge và luật phần tử chồng lớp.
