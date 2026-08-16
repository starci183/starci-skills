---
id: be-lints-exception-identity-changelog
title: changelog.md
slug: /be/lints/exception-identity/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của mô-đun tài liệu phần máy giữ danh tính ngoại lệ.
---

# changelog.md

> Current version: `2.00` · Mô-đun: `exception-identity`

## Version Policy

Một thay đổi được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu cho khớp số.
Đổi số chính (`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc nhóm mà nó nằm trên.

Mô-đun này tài liệu hoá **phần máy giữ**, nên nó có thêm một nguồn thay đổi mà các mô-đun luật không
có: **tệp quy tắc đổi thì mô-đun này đổi, kể cả khi văn bản luật đứng yên**. Một luật máy được thêm,
bị bỏ, bị đổi tên, đổi cơ chế phát hiện hay đổi mức nghiêm đều là một thay đổi ở đây. Đóng được một
cửa trong bảng **Cửa còn mở** cũng vậy — bảng ấy là nội dung chính của mô-đun, không phải phần phụ
lục.

Tên luật máy **không bao giờ được viết lại** trong bất kỳ tài liệu nào của mô-đun. Tên là danh tính:
nó là chuỗi in ra trong nhật ký dựng, chuỗi viết trong một dòng tắt luật, và chuỗi mọi người dùng để
gọi cùng một thất bại. Đặt thêm một con số hay một cái tên thứ hai là tạo ra hai cách gọi một luật mà
không cách nào biết thông điệp đến từ đâu.

## 2.00 — 2026-08-16

Dựng mới. Mô-đun này ra đời để tài liệu hoá **phần máy giữ được** của luật danh tính ngoại lệ, tách
hẳn khỏi văn bản luật: các trang luật nói điều gì là đúng, mô-đun này nói máy nhìn thấy điều đó bằng
cách nào và **không** nhìn thấy điều đó ở đâu.

- **Tài liệu hoá đúng ba luật máy**, đúng bằng số luật mà tệp quy tắc công bố, tất cả ship trong gói
  `@starci/eslint-canon-be` và tất cả đặt ở mức `error`:
  - `exception-name-ends-in-exception` — giữ `IDENTITY-1`, thông điệp `suffix`.
  - `exception-code-matches-class-name` — giữ `IDENTITY-2`, thông điệp `mismatch` và `notLiteral`.
  - `exception-metadata-type-named-for-class` — giữ `IDENTITY-4`, thông điệp `untyped` và `named`.
- **Ba trên ba luật gắn được vào một mã của luật**, không luật nào phải bịa ánh xạ.
- **Ghi rõ hai mã không có luật máy**: `IDENTITY-3` (đổi tên lớp kéo theo đổi mã trên đường truyền)
  và `IDENTITY-5` (mã trạng thái không phải danh tính). Cả hai do người rà soát giữ, và bảng ánh xạ
  trong `example.md` nói thẳng như vậy thay vì suy chúng vào một luật gần giống.
- **Ghi ba nhận định** vào `audit.md`: dòng phân đoạn trong nguồn đề luật máy thứ ba là `IDENTITY-3`
  trong khi điều nó giữ là `IDENTITY-4`; câu đếm trong văn bản luật thấp hơn số luật máy thực có; và
  không luật máy nào so được mã của hai lớp với nhau, nên hai lớp trùng tên vẫn phát ra một mã.
- **Mở bảng `Escape Hatches` với hai phần.** Phần **Closed** ghi tám cách viết mà người đọc tưởng sẽ
  lọt nhưng không lọt — đáng kể nhất là mã cất vào hằng số hoặc bảng liệt kê, cửa quen thuộc nhất của
  loại luật khớp chuỗi, và ở đây nó đóng.
- **Ghi ra mười bốn cửa còn mở**, mỗi cửa kèm một mẫu mã trong `example.md` được dán nhãn rõ là thứ
  luật máy **bỏ sót**, không phải thứ được cho phép. Mười một trong mười bốn cửa ấy là cùng một hình
  dạng: một lệnh `return` sớm, mà trong nhật ký dựng thì `return` sớm với tệp sạch trông giống hệt
  nhau. Nặng nhất là lớp nền trung gian — một thao tác dọn dẹp bình thường tắt cả ba luật cùng lúc.
- **Mỗi cửa còn mở trong `audit.md` nêu luật máy phải soi thêm cái gì mới đóng được**, và một cửa duy
  nhất được kết luận là đóng chặt thì đắt hơn để mở: phép kiểm dấu gạch dưới, vì chính chỗ lỏng đó là
  thứ giữ cho luật im lặng trước những cách tách từ viết tắt khác nhau.
- **Chép nguyên văn tên luật máy** ở cả năm tài liệu, kể cả bản tiếng Việt. Lệnh cấm tên sản phẩm áp
  vào lời văn và ví dụ, không áp vào một định danh có thật đang được ship.
