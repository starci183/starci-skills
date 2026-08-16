---
id: be-lints-testing-changelog
title: changelog.md
slug: /be/lints/testing/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của hồ sơ thực thi luật kiểm thử.
---

# changelog.md

> Current version: `2.00` · Mô-đun: `testing`

## Version Policy

Một thay đổi được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu:
`INDEX.md`, `vi.md`, `example.md`, `audit.md`, `changelog.md`. Đổi số chính (`x.00`) dành cho thay
đổi cấu trúc mô-đun hoặc nhóm mà nó nằm trên.

Những thay đổi bắt buộc phải tăng phiên bản:

- Một quy tắc được thêm vào hoặc gỡ khỏi bảng công bố của tệp nguồn.
- Một tên quy tắc đổi. Tên là **định danh**, nên đổi tên là đổi luật chứ không phải sửa chính tả.
- Một tập tên đóng đổi, hoặc một cổng chọn làn đổi biểu thức chính quy.
- Một mức nghiêm trọng rời khỏi `error`.
- Một **cửa còn mở** được phát hiện thêm, được đóng lại, hoặc được lập luận là không đáng đóng.

Điều cuối là điều dễ bỏ qua nhất và là lý do mô-đun này tồn tại. Một cửa mở chưa ai ghi lại thì nguy
hiểm hơn một luật chưa có quy tắc nào: luật chưa có quy tắc thì ai cũng biết là chưa được canh, còn
quy tắc rò thì ai cũng tưởng đã đóng.

## 2.00 — 2026-08-16

Lập mới mô-đun. Đây là kệ đầu tiên trong nhóm này ghi **mức thực thi** thay vì ghi **luật**: máy nhìn
thấy gì, và máy **không** nhìn thấy gì.

- **Ghi năm quy tắc, đúng tên đã công bố.** `no-call-only-spec`, `e2e-asserts-persisted-state`,
  `no-model-call-in-e2e`, `e2e-uses-production-transport`, `harness-calls-provider-directly`. Cả năm
  ship trong gói `@starci/eslint-canon-be` dưới tiền tố `starci-be/`, và cả năm ở mức `error`.
- **Định danh là TÊN, không đặt thêm mã số.** Tiêu đề mục trong ba tài liệu là tên quy tắc nguyên
  văn, vì đó là chuỗi in ra trong log build và chuỗi phải viết đúng trong một dòng vô hiệu hoá. Một
  quy tắc mang hai tên là một quy tắc không truy được nguồn thông báo.
- **Ánh xạ đủ năm quy tắc sang năm mã luật.** `TESTING-6`, `TESTING-2`, `TESTING-9`, `TESTING-3`,
  `TESTING-10`. Không quy tắc nào mồ côi.
- **Ghi thẳng sáu mã luật không có quy tắc nào.** `TESTING-1`, `TESTING-4`, `TESTING-5`, `TESTING-7`,
  `TESTING-8`, `TESTING-11` nằm ở `audit.md`, không nằm trong bảng `Rules`. Một quy tắc không chỉ ra
  được là một đề xuất, không phải một luật.
- **Dựng bảng `Detection` đọc từ mã cài đặt.** Loại nút cú pháp, tên trường, chuỗi so bằng, mẫu đường
  dẫn, phép quét dòng token. Không mô tả theo tên quy tắc.
- **Dựng hai bảng cửa lách.** **Đóng**: 11 hàng — cách viết trông như lách được nhưng không lách
  được, kèm lý do. **Mở**: **23** hàng — cách viết quy tắc **thật sự không bắt**. Không quy tắc nào
  có 0 hàng mở; không quy tắc nào trên kệ này là kín.
- **Bốn phát hiện trong `audit.md`.** Hai danh sách gói nhà cung cấp trong cùng một tệp không khớp
  nhau; chú thích đầu tệp giữ một con số đã bị chính tệp đó rút lại; chú thích đầu tệp mô tả một pha
  `warn` mà cấu hình đã ship không có; và một quy tắc có hành vi thật lệch xa tên của nó.
- **`example.md` viết bằng mã thật, và mỗi quy tắc có một mục cửa lách riêng.** Mã trong mục đó được
  gắn nhãn rõ là **thứ quy tắc bỏ sót**, không phải thứ được phép viết. Luật vẫn cấm; chỉ có máy là
  không bắt được.
- **Không có `prompt.md`.** Mô-đun đúng năm tài liệu.
- **Văn xuôi và ví dụ không nêu tên sản phẩm.** Riêng định danh có ship — tên quy tắc, tiền tố
  plugin, tên gói — thì giữ nguyên văn, vì đó là chuỗi máy in ra.
