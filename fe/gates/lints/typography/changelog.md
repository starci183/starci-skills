---
id: fe-lints-typography-changelog
title: changelog.md
slug: /gates/lints/typography/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của hồ sơ thực thi luật typography.
---

# changelog.md

> Phiên bản hiện tại: `2.00` · Mô-đun: `typography`

## Quy ước phiên bản

Một thay đổi được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Đổi số chính
(`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc kệ mà nó nằm trên.

Với kệ thực thi này, những thứ sau đều là thay đổi phải ghi:

- Một luật được thêm, bớt hoặc **đổi tên** trong bảng `rules` xuất ra. Đổi tên là thay đổi danh tính,
  vì tên chính là chuỗi in ra trong log build và chuỗi viết trong dòng tắt luật.
- Một **thông điệp** được thêm, bớt hoặc tách ra. Ở mô-đun này mã luật đi theo thông điệp chứ không
  đi theo tên luật, nên một thông điệp mới là một ánh xạ mã mới.
- Một cửa còn mở được đóng lại, hoặc một cửa mới bị phát hiện. Bảng **Open** và bảng **Closed** trong
  `INDEX.md` phải đổi cùng nhau.
- Một miễn trừ được thêm, hoặc đổi hình dạng — chẳng hạn từ chuỗi con của một đoạn thư mục sang một
  đường dẫn tệp duy nhất.
- Ánh xạ giữa một thông điệp và một mã trong văn bản luật thay đổi.
- Hằng độ sâu hoặc tập thẻ tiêu đề đổi giá trị.

## 2.00 — 2026-08-16

Lập mô-đun. Đây là hồ sơ **thực thi** đầu tiên của luật typography: nó không chép lại luật, mà ghi
lại máy nhìn thấy gì và không nhìn thấy gì. Luật được ghi ở đây đóng gói trong
`@starci/eslint-canon-fe`.

- **Ghi một luật, đúng bằng số mà mô-đun luật công bố.** Đếm từ bảng `rules` xuất ra:
  `no-heading-tag-outside-heading-component`. Không luật nào khác tồn tại ở mô-đun luật này, nên
  không luật nào khác được ghi.
- **Danh tính là tên công bố.** Không đặt số cho luật. Tiêu đề mỗi mục là tên luật, nguyên văn.
- **Ánh xạ mã: một luật giữ hai mã, qua hai thông điệp.** `tag` giữ `TYPESET-1`, `tooDeep` giữ
  `TYPESET-2`, và phép chia hai nhánh là đúng một phép so trên độ sâu thẻ. Ghi rõ rằng **thông điệp**
  mới là đơn vị mang mã, vì hai thông điệp đòi hai hành động khác hẳn nhau: một cái đổi cách gọi, một
  cái đổi cấu trúc trang.
- **Ghi ra bảy mã không có máy nào giữ.** `TYPESET-3` tới `TYPESET-9` được công bố trong văn bản luật
  và không luật nào ở mô-đun này giữ. Một phần được tập đóng trên hai thành phần chữ giữ; phần còn
  lại cần biết quan hệ giữa một dòng với hàng xóm của nó, thứ lint không thấy. Cả bảy nằm ở mục
  "Rủi ro còn mở" của `audit.md`, không được ghi thành luật.
- **Bảng Detection viết theo nút cú pháp thật**, không viết theo tên luật: cổng tệp chạy một lần
  trong `create`, nút được duyệt là `JSXOpeningElement`, phép phân biệt thẻ nội tại là so chuỗi tên
  với dạng viết thường của chính nó, và phép chia nhánh là `Number(tag.slice(1))` so với hằng `4`.
- **Bảng Escape Hatches tách làm hai.** Bảng **Closed** ghi chín cách viết trông như sẽ lọt mà không
  lọt. Bảng **Open** ghi **mười hai** cửa còn mở thật — không có mục nào ghi "không có".
- **Ghi rõ cửa mở rộng nhất là thẻ động.** Một biến viết hoa giữ chuỗi thẻ làm luật biến mất hoàn
  toàn, và viết hoa là cách **duy nhất** để dùng một thẻ nội tại tính được trong JSX. Nghĩa là thành
  ngữ chuẩn của việc đổi bậc theo biến rơi đúng vào điểm mù — không phải phá hoại, mà là cách viết
  thông thường.
- **Ghi khe giữa luật này và luật sinh đôi ở mô-đun luật khác.** Luật kia đòi cỡ to **và** độ đậm
  nặng cùng lúc; luật này đòi một cái thẻ. Một tiêu đề dựng bằng cỡ vừa và độ đậm vừa đi lọt cả hai,
  và khe đó không thuộc trách nhiệm của kệ nào khác nên được ghi ở đây.
- **Ghi rằng hai miễn trừ đều đóng theo tệp chứ không theo cặp tệp-cộng-giá-trị**, và rằng cổng chiếc
  lá là phép so **chuỗi con** một đoạn thư mục chứ không phải phép so đuôi một tệp — nên nó cấp quyền
  cho cả một cây, kể cả cây thứ hai trùng hình dạng đường dẫn.
- **`example.md` viết bằng mã thật**, nhiều cặp SAI/ĐÚNG cho luật duy nhất, và một mục mang mã đi lọt
  — có dán nhãn rõ đó là chỗ luật **không nhìn thấy**, không phải cách viết được phép.
- **Năm tài liệu, không có `prompt.md`.** Phần ánh xạ yêu cầu và bảng phân định ranh giới nằm cuối
  `example.md`, cạnh chính những ví dụ mà chúng phân định.
