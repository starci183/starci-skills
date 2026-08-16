---
id: fe-principles-text-expansion-changelog
title: changelog.md
slug: /gates/principles/text-expansion/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật Độ giãn văn bản.
---

# changelog.md

> Phiên bản hiện tại: `2.00` · Mô-đun: `text-expansion`

## Quy tắc phiên bản

Một thay đổi luật được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc nhóm mà nó nằm trên.

## 2.00 — 2026-08-16

Mô-đun mới, mở ở `2.00` để đứng ngang hàng với các mô-đun còn lại trên nhóm `principles/`. Không có
lịch sử `1.x`: câu hỏi này trước đây không có ai sở hữu, và đó chính là lý do nó được tạo.

- **Nhận lấy câu hỏi.** Mô-đun trả lời hai câu, và chỉ hai câu: **một chuỗi dài ra bao nhiêu khi đổi
  ngôn ngữ, ai chịu phần dài thêm đó**, và **cái gì soi gương khi ngôn ngữ chạy từ phải sang trái**.
  Trước đó hai câu này bị trả lời rải rác — một lần trong lúc dựng bố cục, một lần trong lúc sửa lỗi
  hiển thị ở một ngôn ngữ, và không lần nào để lại một cái tên có thể trích dẫn.
- **Chỗ đứng trên nhóm.** Nằm ở `gates/principles/` cùng với các nguyên tắc dựng hình bắt buộc, chứ
  không ở nhóm cảm nhận: chọn sai ở đây không làm giao diện xấu đi, nó làm một cái thành phần điều khiển **mất
  tên** hoặc làm một câu **đọc ra ngược**. Đó là lỗi đúng-sai, không phải lỗi thẩm mỹ.
- **Bảy mã, đánh số theo ba câu hỏi.** `EXPANSION-0` đến `EXPANSION-3` trả lời câu hỏi độ dài và là
  nhóm **phủ kín**: mọi đoạn liền mạch được hiển thị đều mang đúng một mã trong nhóm này. `EXPANSION-4` và
  `EXPANSION-5` trả lời câu hỏi chiều, và chỉ áp khi có hình học phụ thuộc chiều. `EXPANSION-6` trả
  lời câu hỏi hình dạng, và chỉ áp cho giá trị máy in ra. Số thứ tự chạy theo thứ tự câu hỏi, nên đọc
  từ `0` lên `6` là đọc đúng trình tự phải hỏi.
- **Hai mã không phát ra class CSS, và chúng không phải một mã.** `EXPANSION-0` nói **không có gì để
  chừa**; `EXPANSION-3` nói **không có gì để style** vì lỗi nằm ở mã đánh dấu. Gộp hai cái đó lại sẽ dẫn
  tới đúng sai lầm mà mô-đun tồn tại để chặn: coi một mảnh câu chưa dịch xong như một biến thiết kế không cần
  dịch.
- **Tách "lật" khỏi "không lật".** Một mã gộp cả hai không phân định được gì; và quan trọng hơn, một
  quyết định **cố ý không lật** chỉ tồn tại được trong đánh giá khi nó có tên riêng. Nếu không, "quên
  lật nút Phát" và "cố ý giữ nguyên nút Phát" là hai thứ giống hệt nhau trong nguồn.
- **Đưa bảng dải nở vào luật.** Chừa chỗ theo **độ dài chuỗi nguồn**, không theo cảm giác, và ghi rõ
  rằng chuỗi càng ngắn nở càng nhiều theo tỉ lệ. Đây là chỗ trực giác sai nhiều nhất: mắt nhìn thấy
  chỗ trống tuyệt đối, còn cái làm vỡ nút là tỉ lệ.
- **Ví dụ bắt buộc có nhiều hơn một ngôn ngữ.** Ở mọi mô-đun khác, một ví dụ một ngôn ngữ là đủ. Ở
  mô-đun này nó không chứng minh được gì, vì đúng cái được nói tới — sự chênh lệch giữa các bản dịch —
  không xuất hiện trong một bản dịch duy nhất.
- **Rút mọi ví dụ về `className` thuần.** Không thư viện thành phần, không khoá đăng ký, không thư viện
  i18n cụ thể. `t(…)` và `Intl.*` trong ví dụ là **hình dạng lời gọi**, và điều đáng đọc là dữ liệu
  nào được truyền vào chứ không phải ai cung cấp hàm.

### Để lại cho mô-đun bên cạnh

- **Cái gì nhường chỗ khi nội dung tràn khỏi hộp** — cắt, xuống dòng, cuộn hay giãn — thuộc mô-đun
  tràn. Mô-đun này chỉ nói **phần dài thêm đến từ đâu và lớn cỡ nào**. Một thư điện tử dài mang
  `EXPANSION-0` ở đây và vẫn cần một quyết định cắt ở đó.
- **Ai sở hữu bề rộng của một trục** thuộc mô-đun kích thước. Mô-đun này chỉ cấm **suy ra bề rộng đó
  từ một ngôn ngữ**.
- **Khoảng cách giữa các phần tử cùng cấp** thuộc mô-đun khoảng cách. `EXPANSION-4` chỉ nói khoảng cách ấy có bên và
  bên đó lật, không nói nó lớn bao nhiêu.
- **Cỡ chữ, độ cao dòng và độ dài dòng đọc** thuộc mô-đun chữ. Trần `max-w-[46ch]` xuất hiện trong ví
  dụ ở đây là để cho thấy vì sao đơn vị `ch` sống được qua đổi ngôn ngữ, không phải để đặt luật về độ
  dài dòng.
- **Thứ tự tiêu điểm khi bàn phím đi qua một bố cục đã lật** thuộc mô-đun thứ tự tiêu điểm.
