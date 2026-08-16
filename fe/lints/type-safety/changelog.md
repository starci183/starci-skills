---
id: fe-lints-type-safety-changelog
title: changelog.md
slug: /fe/lints/type-safety/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của tầng thi hành luật type-safety.
---

# changelog.md

> Current version: `2.00` · Mô-đun: `type-safety`

## Version Policy

Một thay đổi được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc nhóm mà nó nằm trên.

Ở tầng này, những việc sau đều là một thay đổi phải ghi:

- Mô-đun rule thêm, xoá hoặc **đổi tên** một rule. Đổi tên là thay đổi nặng nhất, vì tên đã công bố
  chính là danh tính của rule: nó là chuỗi hiện ra trong log dựng và trong comment tắt rule.
- Một cửa còn mở được **đóng lại**, hoặc một cửa mới được phát hiện.
- Ánh xạ rule sang mã luật thay đổi, kể cả khi mã của rule không đổi một dòng nào.
- Mức nghiêm khắc mặc định mà mô-đun rule tự đề nghị thay đổi.

## 2.00 — 2026-08-16

Dựng mới mô-đun. Tầng `principles` và `patterns` ghi **luật**; tầng này ghi **việc thi hành**: máy
nhìn thấy đúng cái gì, và cùng một lỗi ấy còn viết được bằng những cách nào mà máy không thấy.

- **Ghi đúng một rule**, đúng bằng số rule mà tệp nguồn công bố: `no-double-cast`, giữ
  `TYPE-SAFETY-1`. Không đặt số cho rule; danh tính của nó là tên đã công bố.
- **Ghi rõ bốn mã còn lại đang ở đâu.** `TYPE-SAFETY-4` được thi hành dưới dạng **vắng mặt** — nó là
  cổng đường dẫn của chính rule này, không phải một rule riêng. `TYPE-SAFETY-2` và `TYPE-SAFETY-3`
  được uỷ thác cho bộ plugin TypeScript, tức nằm ngoài bảo đảm của gói này. `TYPE-SAFETY-5` **không
  có ai giữ**.
- **Ghi cách phát hiện ở mức nút cú pháp**: cổng tệp xét một lần trong `create` trước khi cài
  visitor, rồi `TSAsExpression` có toán hạng cũng là `TSAsExpression` với chú thích đúng là
  `TSUnknownKeyword`, báo tại nút ngoài.
- **Bảng cửa đã đóng, mười mục.** Trong đó có một mục đáng chú ý: gom giá trị vào hằng số, mảng hay
  object literal **không** rửa được rule này, vì nó thăm nút cú pháp chứ không thăm một vị trí thuộc
  tính — trái với phản xạ mà những rule khác tạo ra.
- **Bảng cửa còn mở, mười ba mục**, và đây là phần đáng đọc của mô-đun. Đủ mười ba đều là cách viết
  thật, không phải giả định: cách viết ngoặc nhọn, đổi từ khoá ở giữa, alias trỏ tới từ khoá, một nút
  chen vào giữa hai phép cast, phép xoá tách thành hai câu lệnh, một hàm generic rửa cả cây, từ khoá
  nằm trong tham số kiểu, phép xoá không có cast nào để nhìn, mọi thứ ngoài `/src/`, chuỗi `/src/`
  khớp nhầm ở thư mục tổ tiên, tên tệp dùng để thoát, tên tệp gây báo oan, và mệnh đề lý do không ai
  đọc.
- **`example.md` viết theo cặp SAI/ĐÚNG**, và có thêm một mục riêng cho mã **lọt qua rule mà vẫn
  sai** — ghi rõ đó là thứ rule không thấy, không phải thứ được phép.
- **`audit.md` xếp hạng từng cửa còn mở** theo việc rule sẽ phải nhìn thêm cái gì mới đóng được: ba
  cửa nên đóng ngay (ngoặc nhọn, nút chen giữa, đường dẫn tương đối gốc kho), một cửa nên tách thành
  rule mới (hàm generic), và phần còn lại là cái giá đã được cân nhắc có ý thức.

Bộ rule được ghi ở đây phát hành trong gói `@starci/eslint-canon-fe`. Tầng này không ghi rule nào
"đáng lẽ phải có": một rule không chỉ tay vào được là một đề xuất, và đề xuất nằm ở `audit.md` dưới
dạng rủi ro còn mở.
