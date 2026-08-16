---
id: be-lints-type-safety-changelog
title: changelog.md
slug: /be/lints/type-safety/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của hồ sơ thực thi luật an toàn kiểu.
---

# changelog.md

> Current version: `2.00` · Mô-đun: `type-safety`

## Version Policy

Một thay đổi được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Đổi số chính
(`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc kệ mà nó nằm trên.

Với kệ thực thi này, những thứ sau đều là thay đổi phải ghi:

- Một luật được thêm, bớt hoặc **đổi tên** trong bảng `rules` xuất ra. Đổi tên là thay đổi danh tính,
  vì tên chính là chuỗi in ra trong log build và chuỗi viết trong dòng tắt luật.
- Một cửa còn mở được đóng lại, hoặc một cửa mới bị phát hiện. Bảng **Open** và bảng **Closed** trong
  `INDEX.md` phải đổi cùng nhau.
- Một miễn trừ được thêm, được dời từ thân luật ra cấu hình, hoặc mọc thêm / mất đi vế giá trị.
- Ánh xạ giữa một luật và một mã trong văn bản luật thay đổi.
- Khối mức nghiêm đề nghị thêm, bớt hoặc đổi mức một mục — kể cả những mục thuộc plugin khác.

## 2.00 — 2026-08-16

Lập mô-đun. Đây là hồ sơ **thực thi** đầu tiên của luật an toàn kiểu: nó không chép lại luật, mà ghi
lại máy nhìn thấy gì và không nhìn thấy gì. Các luật được ghi ở đây đóng gói trong
`@starci/eslint-canon-be`.

- **Ghi ba luật, đúng bằng số mà mô-đun luật công bố.** Đếm từ bảng `rules` xuất ra: `no-double-cast`,
  `no-inline-param-type`, `no-const-enum`.
- **Danh tính là tên công bố.** Không đặt số cho luật nào. Tiêu đề mỗi mục là tên luật, nguyên văn.
- **Ánh xạ mã: ba trên ba.** `TYPE-2`, `TYPE-3`, `TYPE-4` đều khớp, và `no-double-cast` gánh thêm nửa
  phần kiểm thử của `TYPE-6`. Không mã nào bị bịa ra để khớp với một luật.
- **Ghi hai luật đi mượn mà không tả ruột gan chúng.** `@typescript-eslint/no-explicit-any` giữ
  `TYPE-1` và `@typescript-eslint/array-type` giữ lối viết kiểu mảng. Cả hai được gọi tên trong khối
  mức nghiêm đề nghị, không cái nào do mô-đun này công bố, nên không cái nào có mục riêng — một luật
  mô-đun này không sở hữu là một luật mô-đun này không thể bảo đảm hành vi.
- **Bảng Detection viết theo nút cú pháp thật**, không viết theo tên luật: nút được duyệt, thuộc tính
  được đọc, mẫu được thử, và cổng tệp quyết định luật có được lắp hay không. Ghi rõ rằng
  `no-double-cast` trả về một bộ duyệt **rỗng** cho cả tệp khi cổng kiểm thử khớp, và rằng hai luật
  còn lại **không có cổng tệp nào**.
- **Bảng Escape Hatches tách làm hai.** Bảng **Closed** ghi mười cách viết trông như sẽ lọt mà không
  lọt. Bảng **Open** ghi **mười tám** cửa còn mở thật, trải trên cả ba luật — không luật nào được ghi
  "không có".
- **Ghi bốn nhận định mà tên luật không nói ra.** `no-inline-param-type` chỉ nhìn tham số được rã cấu
  trúc, nên lối viết phổ biến hơn đi lọt hoàn toàn; `no-double-cast` bắt một lối viết chứ không bắt
  một ý nghĩa, nên `as never as` và một hàm ép kiểu tổng quát đều thoát; miễn trừ duy nhất trên kệ là
  lối ra cho cả tệp chứ không phải một cặp tệp-cộng-giá-trị; và `TYPE-6` được cài đặt trái với chính
  câu chữ cho phép nó.
- **Ghi hai mã không có luật nhà nào giữ.** `TYPE-1` đi mượn; `TYPE-5` cố ý bỏ trống, với lập luận
  ghi ngay ở đầu mô-đun luật. Cả hai nằm ở "Rủi ro còn mở" chứ không được ghi thành luật ở đây: thứ
  không chỉ tay vào được là một đề nghị, không phải một luật.
- **Ghi một quyết định đang được thực thi mà luật chưa công bố mã.** `array-type` bắt buộc một lối
  viết kiểu mảng, và văn bản luật không có mã nào cho nó.
- **`example.md` viết bằng mã thật**, mỗi luật nhiều cặp SAI/ĐÚNG, và mỗi luật có một mục mang mã đi
  lọt — có dán nhãn rõ đó là chỗ luật **không nhìn thấy**, không phải cách viết được phép.
- **Năm tài liệu, không có `prompt.md`.** Phần ánh xạ yêu cầu và bảng phân định ranh giới nằm cuối
  `example.md`, cạnh chính những ví dụ mà chúng phân định.
