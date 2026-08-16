---
id: be-lints-comments-changelog
title: changelog.md
slug: /be/lints/comments/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của mô-đun tài liệu thực thi luật chú thích.
---

# changelog.md

> Current version: `2.00` · Mô-đun: `comments`

## Version Policy

Một thay đổi được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Đổi số chính
(`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc kệ mà nó nằm trên.

Mô-đun này ghi **cơ chế thực thi**, không ghi luật. Nên nó tăng phiên bản vì một lý do mà mô-đun luật
không có: **quy tắc trong tệp nguồn đổi thì tài liệu này sai ngay lập tức**, kể cả khi luật không
đổi một chữ. Một quy tắc được thêm, bớt, đổi tên, hoặc đổi cơ chế phát hiện đều là thay đổi ở đây.

Điều ngược lại cũng đúng và quan trọng hơn: **một cửa còn mở mới được phát hiện là một thay đổi phải
ghi**, dù không dòng mã nào của quy tắc đổi. Cửa đó đã mở sẵn từ đầu; thứ đổi là chúng ta đã biết.

## 2.00 — 2026-08-16

Dựng mới mô-đun. Số chính là `2` để đứng cùng thế hệ tài liệu hiện hành, không phải vì có bản `1`
nào trước đó.

**Vì sao có mô-đun này.** Luật chú thích đã được ghi ở tầng luật, và tầng đó trả lời câu hỏi "phải
viết thế nào". Nó không trả lời câu hỏi mà một bản dựng xanh đặt ra: **màu xanh vừa chứng minh được
điều gì.** Kệ này ghi phần đó — máy nhìn thấy gì, và phần nào nó không nhìn thấy.

**Phủ những quy tắc nào.** Ba quy tắc, đúng bằng số quy tắc mà tệp nguồn công bố trong `rules` và đặt
mức `error` trong `recommended`. Chúng ship trong gói `@starci/eslint-canon-be` dưới tiền tố
`starci-be/`:

- `require-export-jsdoc` — giữ `COMMENT-1`.
- `require-enum-member-jsdoc` — giữ `COMMENT-2`, chỉ nửa "khối tài liệu có tồn tại".
- `no-non-ascii-source` — giữ `COMMENT-4`, mang `COMMENT-5` làm cửa miễn qua dấu `vn-ok`.

**Ghi nhận hai khoảng trống, thay vì lấp cho tròn.**

- `COMMENT-3` không có quy tắc nào giữ, và không giữ được bằng máy. Ghi là **chưa có máy giữ** chứ
  không gán tạm cho quy tắc gần nhất.
- Nửa sau của `COMMENT-2` — thành viên phải nói ra **hệ quả** chứ không phải cái tên — nằm ngoài tầm
  của mọi phép kiểm tự động. Chính thông điệp của quy tắc đã tự khai điều này, và tài liệu chép lại
  đúng như vậy.

**Số cửa còn mở: hai mươi bốn dòng khác nhau**, chia theo quy tắc:

| Quy tắc | Cửa còn mở | Đáng chú ý nhất |
|---|---|---|
| `require-export-jsdoc` | 11 | Xuất lại qua tệp đầu mối thì không có gì bị đòi; một hàm bọc qua lời gọi bị xếp chung với hằng số dữ liệu |
| `require-enum-member-jsdoc` | 5 | Tách từ khoá `export` ra dòng sau là tắt cả quy tắc; đối tượng `as const` thoát cả hai quy tắc cùng lúc |
| `no-non-ascii-source` | 10 | Bỏ dấu thì lọt sạch; mọi ngôn ngữ khác đều lọt; miễn theo thư mục thì miễn luôn phần chú thích |

Cộng lại là hai mươi sáu chứ không phải hai mươi bốn, vì **hai** cửa — khối `/** */` rỗng, và khối
tài liệu chép lại cái tên — thuộc về cả hai quy tắc `jsdoc` cùng lúc và chỉ chiếm một dòng mỗi cửa.

Không cửa nào trong số đó là suy đoán. Từng cấu trúc đã được chạy qua chính ba quy tắc đó với bộ phân
tích cú pháp thật và ghi lại nổ hay im, rồi mới viết vào tài liệu.

**Ghi thêm một báo nhầm đã đo được.** Khối tài liệu đặt **trên** một bộ trang trí thì lớp bên dưới
vẫn bị báo thiếu; đặt **giữa** bộ trang trí và `export` thì qua. Trong một nền tảng dùng bộ trang trí
dày đặc, đây là báo nhầm phổ biến nhất, và cách "sửa" mà nó dạy lại đẩy tài liệu tới chỗ người đọc
không tìm.

**Quyết định về danh tính quy tắc.** Danh tính của một quy tắc là **cái tên nó công bố**; mô-đun này
không đặt thêm mã số cho quy tắc. Tên được chép nguyên văn, kể cả tiền tố mang tên riêng, vì đó là
chuỗi mà nhật ký bản dựng in ra và là chuỗi phải gõ đúng trong một chú thích tắt quy tắc. Lệnh cấm
tên sản phẩm áp cho **văn xuôi** và **ví dụ**, không áp cho định danh đang chạy.

**Quyết định không đổi tên `no-non-ascii-source`.** Tên này hứa nhiều hơn hành vi: nó không cấm ký tự
ngoài ASCII, nó cấm ba lớp ký tự được liệt kê tay, và dấu gạch dài, nháy cong, `naïve`, `façade`,
khung kẻ hộp đều qua — đúng như chủ ý ghi trong tệp nguồn. Chênh lệch được ghi ở `audit.md` dưới dạng
nhận định, không sửa bằng một lần đổi chữ: cái tên đã nằm trong nhật ký bản dựng và trong các chú
thích tắt quy tắc đã viết, nên đổi nó là thay đổi luật và phải đi qua một lần tăng phiên bản riêng.

**Hình dạng mô-đun.** Đúng năm tài liệu: `INDEX.md`, `vi.md`, `example.md`, `audit.md`,
`changelog.md`. Không có `prompt.md` — phần ánh xạ yêu cầu và bảng phân định ranh giới nằm cuối
`example.md`, cùng chỗ với những ví dụ mà chúng phân định.
