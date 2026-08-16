---
id: fe-principles-size-changelog
title: changelog.md
slug: /gates/principles/size/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật Kích thước.
---

# changelog.md

> Phiên bản hiện tại: `2.00` · Mô-đun: `size`

## Quy tắc phiên bản

Một thay đổi luật được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc nhóm mà nó nằm trên.

## 2.00 — 2026-08-16

Mô-đun mới. Mở ở `2.00` chứ không ở `1.00` vì nó sinh ra **đã ở hình dạng v2**: năm tài liệu, mã tình
huống, luật bắt buộc, ví dụ `className` thuần — cùng số phiên bản với các mô-đun anh em trên cùng
nhóm, để một lần đọc chéo không phải diễn giải hai hình dạng khác nhau.

- **Nhận câu hỏi.** Mô-đun này nhận đúng một câu hỏi: **ai đo một hộp** — nội dung bên trong nó, phần
  tử cha đang mời chỗ, hay một mức chặn ai đó cố ý đặt ra. Trước khi có mô-đun này, câu hỏi ấy được
  trả lời rải rác mỗi lần một kiểu, và câu trả lời thường là một con số chứ không phải một chủ sở
  hữu — nên không có cách nào chứng minh một con số là sai.
- **Đứng trên nhóm `principles/`.** Cùng nhóm với các nguyên tắc dựng hình bắt buộc khác: `senses/`
  giữ những gì người đọc cảm nhận, `governance/` giữ ngoại lệ và tính đồng nhất, còn kích thước là một quyết
  định dựng hình có thể chứng minh đúng sai, nên nó thuộc về đây.
- **Đơn vị phán quyết là TRỤC, không phải hộp.** Đây là quyết định nền của mô-đun. Một hộp thật
  thường có hai chủ sở hữu khác nhau trên hai trục, và mọi tranh cãi về kích thước mà không nêu trục
  đều là hai người trả lời hai câu hỏi khác nhau. Mỗi trục mang đúng một mã; một hộp mang hai.
- **Đặt tám mã tình huống.** `SIZE-0` nội dung tự đo · `SIZE-1` lấp đầy cha · `SIZE-2` một trần ·
  `SIZE-3` một sàn · `SIZE-4` biến thiết kế ấn định · `SIZE-5` một phần chia của cha · `SIZE-6` gỡ sàn tự
  nhiên · `SIZE-7` trục kia suy ra.
- **Vì sao đánh số như vậy.** Sáu chỉ số đầu giữ nguyên nghĩa của tập hạt giống để một trích dẫn cũ
  vẫn đọc đúng; hai mã thêm vào nhận chỉ số kế tiếp thay vì chen vào giữa, vì chen số sẽ làm mọi
  trích dẫn `SIZE-4` và `SIZE-5` đã tồn tại trỏ sai chỗ. Hệ quả phải chấp nhận: chỉ số **không** phản
  ánh thứ tự lập luận. Mô-đun bù lại bằng một **thứ tự phân giải** công bố riêng ở `INDEX.md`
  — `SIZE-7` → `SIZE-4` → `SIZE-2` → `SIZE-3` → `SIZE-6` → `SIZE-5` → `SIZE-1` → `SIZE-0` — và nói
  thẳng rằng tập mã này **không phải một thang**: `SIZE-7` không lớn hơn `SIZE-1`.
- **Tách `SIZE-6` khỏi `SIZE-3`.** `min-w-0` và `min-h-0` dùng chung họ class CSS với sàn nhưng ngược ý
  định: một bên dựng mức chặn, một bên dỡ mức chặn mà trình duyệt tự dựng. Để chung thì mã sàn tự mâu
  thuẫn, và tình huống tốn kém nhất của mô-đun — cắt chữ và vùng cuộn trong flex — sẽ không có tên để
  bị bắt lỗi.
- **Thêm `SIZE-7`.** Dưới quy tắc mỗi-trục-một-mã, trục dọc của một khung ảnh giữ tỉ lệ không thuộc
  về nội dung, cha, trần, sàn, biến thiết kế hay phần chia. Không có mã này thì tập mã không **tổng**.
- **Nới `SIZE-4` ra khỏi phạm vi biểu tượng hình.** Chiều cao thành phần điều khiển, bề rộng thanh dọc và chiều cao phần đầu
  dính có cùng cấu trúc lập luận với biểu tượng: con số thuộc về hệ chứ không thuộc về chỗ dùng.
- **Loại đơn vị khỏi tập tiêu chí.** `ch`, `%`, `vh`, `rem`, `px` chỉ nói con số đến từ đâu. Nhờ vậy
  `min-h-screen` nằm yên ở `SIZE-3` thay vì sinh ra một mã "khung nhìn" trùng nghĩa với sàn.
- **Ghi luật cấm `w-full` thừa.** Con khối trong luồng thường đã là `SIZE-1` trên trục ngang. Class CSS
  chỉ được viết ở chỗ mặc định khác đi: con của flex và lưới, `inline-block`, phần tử biểu mẫu, và hộp
  định vị tuyệt đối.
- **Ghi trần dòng đọc thành luật, không thành gợi ý.** Văn bản chạy mà không có trần là một trục chưa
  ai quyết. Vùng an toàn quen thuộc — khoảng 45–75 ký tự một dòng — là lý do chức năng, không phải sở
  thích.
- **Mô-đun có năm tài liệu.** Ánh xạ yêu cầu và bảng phân định ranh giới nằm trong `example.md`, cùng
  chỗ với những ví dụ mà chúng phân định. Không có `prompt.md`.

### Những gì mô-đun này cố ý để lại cho hàng xóm

- **Khoảng cách giữa các phần tử cùng cấp** thuộc về mô-đun `gap`. Ở đây chỉ nói kích thước của một hộp; khoảng cách giữa các phần tử
  giữa hai hộp là quan hệ, không phải phép đo.
- **Khoảng đệm trong bên trong** không thuộc mô-đun này. Muốn một hộp "thoáng hơn" là việc của khoảng đệm trong; sửa
  bằng cách nới kích thước là dùng sai mã.
- **Số cột và thứ tự các rãnh của một lưới** là quyết định của bố cục cha. Mô-đun này chỉ nói con
  nhận gì trong ô của nó, và nói rõ rằng khi đã có khoảng cách giữa các phần tử thì tỉ lệ thuộc về rãnh chứ không thuộc con.
- **Cỡ chữ, chiều cao dòng và thang kiểu chữ** thuộc về mô-đun chữ. Trần dòng đọc ở `SIZE-2` là
  quyết định về **bề rộng cột**, không phải về cỡ chữ.
- **Cuộn, tràn và cách trình bày phần bị cắt** chỉ được nhắc ở `SIZE-6` đúng mức cần để giải thích vì
  sao phép đo của cha bị vô hiệu. Hành vi cuộn đầy đủ không phải việc của mô-đun này.
- **Ngưỡng điểm ngắt** thuộc về mô-đun thiết kế đáp ứng. Ở đây chỉ có một luật: mã chỉ đổi khi vai trò
  bố cục đổi.
