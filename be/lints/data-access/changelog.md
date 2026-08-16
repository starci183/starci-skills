---
id: be-lints-data-access-changelog
title: changelog.md
slug: /be/lints/data-access/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của kệ enforcement cho luật truy cập dữ liệu.
---

# changelog.md

> Current version: `2.00` · Module: `data-access`

## Version Policy

Một thay đổi được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Đổi số chính
(`x.00`) dành cho việc tạo mô-đun hoặc thay đổi hình dạng của nó.

Ở kệ này, "một thay đổi" gồm cả ba loại sau, và loại thứ ba dễ bị bỏ quên nhất:

1. Tệp nguồn thêm, bớt hoặc đổi tên một quy tắc.
2. Một quy tắc đổi cái nó nhìn — thêm một loại nút, nới một biểu thức chính quy, nối thêm một tên vào
   danh sách được canh, công nhận thêm một dạng đối số.
3. **Một cửa còn mở được phát hiện hoặc được đóng lại.** Bảng cửa còn mở là nội dung chính của kệ này,
   không phải phần chú thích, nên nó đổi thì phiên bản đổi.

Số phiên bản của kệ enforcement **không** buộc phải bằng số phiên bản của tài liệu luật mà nó giữ. Luật
đứng yên trong khi quy tắc siết chặt là chuyện bình thường, và ngược lại cũng vậy.

## 2.00 — 2026-08-16

Tạo mô-đun. Kệ `principles` và `patterns` ghi **luật**; kệ này ghi **việc thi hành**: máy nhìn thấy được
đến đâu, và — phần không ai chịu viết ra — máy **không** nhìn thấy chỗ nào.

- **Phủ đúng ba quy tắc đang được công bố** trong gói `@starci/eslint-canon-be`:
  `must-inject-entity-manager` giữ `DATA-1`, `no-injected-repository` giữ `DATA-2`,
  `require-entity-table-name` giữ `DATA-3`. Ba quy tắc, ba mã, ánh xạ một-một, không quy tắc nào không
  có mã.
- **Ghi rõ hai mã luật cố ý không có quy tắc.** `DATA-4` và `DATA-5` nằm ở `audit.md` mục rủi ro, kèm
  cái mà một quy tắc sẽ phải soi để giữ được chúng — đồ thị lời gọi cho vế thứ nhất, mục đích của câu
  trả lời cho vế thứ hai. Chúng **không** được ánh xạ thành quy tắc: một quy tắc không chỉ tay vào được
  là một đề xuất, không phải một quy tắc.
- **Lấy tên công bố làm danh tính.** Không đặt mã số cho quy tắc. Cái tên đã là chuỗi hiện trong log
  build, trong dòng chú thích tắt quy tắc và trong mọi cuộc trao đổi về lỗi; đặt thêm một mã số nữa là
  tạo ra một quy tắc có hai tên và không ai biết thông báo đến từ tên nào. Tiêu đề mỗi mục là tên quy
  tắc, chép nguyên văn.
- **Ghi bảng `Detection` theo nút thật.** Mỗi quy tắc được ghi bằng đúng loại nút nó thăm, đúng điều
  kiện nó lọc và đúng chỗ nó báo — chứ không bằng ý định của nó. Ghi cả việc hai quy tắc dùng chung một
  vòng duyệt hàm dựng và một hàm gom decorator, nên chúng thống nhất tuyệt đối về việc thế nào là một
  tham số và một decorator tên là gì.
- **Ghi hai bảng cửa: `Closed` và `Open`.** Bảng `Closed` liệt kê **mười hai** cách viết trông như sẽ
  lọt mà không lọt. Bảng `Open` liệt kê **hai mươi hai** cách viết thật sự lọt: mười ở
  `must-inject-entity-manager`, tám ở `no-injected-repository` — ba trong số đó là dòng dùng chung với
  quy tắc trên, vì hai quy tắc dùng chung một vòng duyệt nên cũng dùng chung điểm mù — và bảy ở
  `require-entity-table-name`. Không dòng nào ghi "không có" cho gọn bảng.
- **Nói thẳng chỗ hành vi hẹp hơn cái tên, ở cả ba quy tắc.** `must-inject-entity-manager` không đòi ai
  phải tiêm gì và không đòi nêu tên kết nối — nó chỉ đòi một tên decorator **có hình dạng** như thể nêu
  tên, và biểu thức chính quy cho phần giữa rỗng nên chính decorator trần của khung nền đi lọt.
  `no-injected-repository` chỉ biết ba tên kiểu, nên một lớp kho lưu trữ tự viết vô hình.
  `require-entity-table-name` đòi một **chuỗi ký tự**, không đòi một **cái tên**.
- **Ghi lại một chỗ bắt nhầm** thay vì giả vờ không có: `@Entity(TABLES.cartItems)` và
  `@Entity({ name: TABLE_NAME })` đã đặt tên bảng mà vẫn bị báo lỗi. Đây là chỗ mẫu "hằng số rửa sạch
  chuỗi ký tự" chạy **ngược chiều**, và là rủi ro duy nhất trong mô-đun có thể khiến người ta tắt hẳn
  một quy tắc.
- **Ghi lại hai lỗ dẫn thẳng tới hậu quả mà luật gọi tên**: `@Entity("")` và chuỗi mẫu có thay thế, cả
  hai đi vào bằng chính nhánh chấp nhận của quy tắc. Cả hai đóng được bằng một dòng, và `audit.md` nói
  rõ dòng đó phải kiểm gì.
- **Ghi nhận khối chú thích đầu tệp nguồn còn khớp với tệp**: nó nói ba quy tắc, tệp công bố ba quy tắc,
  và nó nêu đúng hai điều luật cố ý không giữ. Chuyện đáng ghi nhận chứ không đáng coi là mặc định.
- **Ghi nhận `meta.type` và `recommended` nói cùng một điều**: cả ba khai `problem`, cả ba đặt ở mức
  `error`, đo được ở mức không nợ. Một kho tiêu thụ nhận bộ quy tắc này vào một cây đã có sẵn thì **đo
  trước**, rồi hạ những quy tắc còn nợ xuống mức cảnh báo kèm con số bên cạnh.
- **Năm tài liệu, không có `prompt.md`.** Phần ánh xạ yêu cầu và bảng phân định ranh giới nằm cùng chỗ
  với ví dụ mà chúng phân định.
