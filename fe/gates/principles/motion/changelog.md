---
id: fe-principles-motion-changelog
title: changelog.md
slug: /gates/principles/motion/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật Chuyển động.
---

# changelog.md

> Phiên bản hiện tại: `2.00` · Mô-đun: `motion`

## Quy tắc phiên bản

Một thay đổi luật được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc nhóm mà nó nằm trên.

## 2.00 — 2026-08-16

Mô-đun được lập mới, và mở thẳng ở số chính vì nó sinh ra đã đứng trên nhóm `principles/` với hình
dạng năm tài liệu.

- **Câu hỏi mà mô-đun này nhận về.** Khi nào chuyển động **mang nghĩa**, nó **dài bao lâu**, và nó
  **giãn nhịp thế nào**. Trước đó, ba câu này được trả lời rải rác ở từng lần đánh giá, nên mỗi lần lại
  ra một con số khác, và không ai sai được vì không có gì để sai.
- **Nhóm.** `gates/principles/motion/`, cạnh các mô-đun dựng hình bắt buộc khác. `principles/` giữ
  những gì phải đúng trước khi bàn tới thẩm mỹ; chuyển động thuộc về đây chứ không thuộc về
  `senses/`, vì thời lượng và đường cong không phải chuyện cảm nhận — chúng là hệ quả của việc **cái
  gì đã đổi**.
- **Đặt mã tình huống.** Mỗi tình huống mang một mã `MOTION-<index>`: `MOTION-0`, `MOTION-1`,
  `MOTION-2`, `MOTION-3`, `MOTION-4`, `MOTION-5`. Mã đặt tên cho **tình huống**, class CSS đặt tên cho
  **cặp nhịp thời gian**; hai thứ không phải một, và `MOTION-0` không phát ra class CSS nào.
- **Cách đánh số.** `0` là sự vắng mặt, đứng trước vì nó là câu trả lời mặc định và là câu trả lời
  đúng nhiều nhất. `1`, `2`, `3` là ba thứ duy nhất có thể đổi giữa hai khung hình, xếp theo mức độ
  can thiệp vào cây: **sự có mặt**, rồi **lớp sơn**, rồi **hình học**. `4` đứng sau ba mã đó vì nó là
  trường hợp duy nhất **không có khung hình cuối** để chạy tới. `5` đứng cuối vì nó là mã duy nhất mà
  quyền quyết định không nằm ở người viết giao diện.
- **Đóng thang thời lượng.** `100 · 150 · 200 · 300`, thủng ở `250`, `500`, `700`, `1000`, và chặn
  cứng ở `300` cho mọi thứ trừ vòng lặp `MOTION-4`. Thang thủng bắt người ta quyết định ý nghĩa; thang
  liền mời người ta chia đôi.
- **Cho `MOTION-1` hai cặp nhịp thời gian.** Vào `200` giảm tốc, ra `100` tăng tốc. Đây là ngoại lệ duy nhất
  với luật "một mã một cặp nhịp thời gian", và nó là nội dung của mã chứ không phải một nhân nhượng.
- **Nâng nghĩa vụ giảm chuyển động thành một mã.** `MOTION-5` không phải một hậu tố dọn dẹp; nó là tình
  huống trong đó hệ điều hành đã trả lời thay người dùng. Đơn vị phân loại được đổi sang "một chuyển
  động dưới một tuỳ chọn" để tập mã vẫn loại trừ lẫn nhau.
- **Bắt mọi chuỗi class CSS mang sẵn vế `MOTION-5`.** Nghĩa vụ trợ năng không được hoãn sang một lượt
  sau, vì lượt sau là lượt không bao giờ tới.
- **Cấm `transition-all` tuyệt đối** và tách bốn họ class CSS không giao nhau, để đọc một chuỗi class CSS là
  đọc ra được mã của nó mà không cần xem mã đánh dấu.
- **Không có `prompt.md`.** Ánh xạ yêu cầu và bảng phân định ranh giới nằm cùng chỗ với ví dụ mà
  chúng phân định, trong `example.md`. Mô-đun có đúng năm tài liệu.
- **Mọi ví dụ là `className` thuần.** Không thư viện thành phần, không hệ thống thiết kế riêng, không
  khoá đăng ký. Một luật ở nhóm này phải đúng với bất kỳ giao diện nào; ví dụ cần tên riêng của một
  sản phẩm mới đọc được là ví dụ đứng sai chỗ.

### Cố ý để lại cho mô-đun khác

- **Khoảng cách giữa các phần tử cùng cấp** thuộc về mô-đun `gap`. Ở đây chỉ nói tới việc một khoảng cách
  **đổi**, và khi nó đổi thì đó là `MOTION-3`.
- **Màu của trạng thái** — rê chuột, chọn, lỗi, vô hiệu hoá — thuộc về mô-đun màu. `MOTION-2` chỉ quyết
  định thay đổi đó **kéo dài bao lâu**, không quyết định nó **thành màu gì**.
- **Việc một trạng thái có được phép tồn tại hay không** thuộc về mô-đun trạng thái. Mô-đun này giả
  định trạng thái đã đúng và chỉ hỏi cách đi từ trạng thái này sang trạng thái kia.
- **Thứ tự tiêu điểm, bẫy tiêu điểm trong phần tử chồng lớp và thông báo cho trình đọc màn hình** thuộc về mô-đun
  trợ năng. Ở đây chỉ có hai điều được giữ lại, vì chúng là quyết định về chuyển động: chỉ báo tiêu điểm
  không bao giờ được làm chậm, và chuyển động không bao giờ là thông tin duy nhất.
- **Ngưỡng chờ tính bằng mili giây** để một vòng lặp `MOTION-4` được phép xuất hiện vẫn để mở. Nó là
  một phép đo của từng sản phẩm, không phải một hằng số của luật.
