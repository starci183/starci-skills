---
id: fe-principles-distribution-changelog
title: changelog.md
slug: /fe/principles/distribution/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật Phân bố.
---

# changelog.md

> Phiên bản hiện tại: `2.00` · Mô-đun: `distribution`

## Quy tắc phiên bản

Một thay đổi luật được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc nhóm mà nó nằm trên.

## 2.00 — 2026-08-16

Mô-đun mới, mở ở `2.00` để đứng cùng số với các mô-đun đang sống trên cùng nhóm. Không có lịch sử
`1.x`: câu hỏi mà mô-đun này nhận về chưa từng thuộc về một mô-đun nào, nó nằm rải trong ghi chú của
vài mô-đun khác dưới dạng "nhớ thêm `min-w-0`".

- **Nhận về một câu hỏi.** Trong **một hàng**: ai giãn, ai co, ai đứng yên. Trước đó câu hỏi này
  không có chủ: mỗi lần một hàng vỡ, người ta thêm class CSS cho tới khi trông đúng, và lần sau lại thêm
  lại từ đầu.
- **Đứng trên nhóm `principles/`.** Đây là một nguyên tắc dựng hình bắt buộc, không phải cảm nhận và
  không phải ngoại lệ vận hành: một hàng chia sai thì nó **hỏng**, không phải nó **xấu**.
- **Đặt mã tình huống.** Bảy mã `DIST-0` … `DIST-6`. Số **không** phải một thang từ nhỏ tới lớn như
  ở mô-đun `gap`; đó là bảy vai trò rời nhau và số chỉ để trích dẫn. Thứ tự đánh số theo mức khai
  báo: `DIST-0` không khai báo gì, `DIST-1` và `DIST-2` khai báo quyền lấy phần dư, `DIST-3` và
  `DIST-4` khai báo hai chiều ngược nhau của phần thiếu, `DIST-5` khai báo một số đo, `DIST-6` khai
  báo rằng người nhận phần dư không phải một phần tử con.
- **Miền của mã là một người tham gia, không phải một hàng.** Nhờ vậy các mã loại trừ được lẫn nhau,
  và một hàng đọc ra thành một tổ hợp mã. Hình dạng "thanh dọc cố định cạnh vùng lỏng" — vốn được đề nghị
  làm **một** mã — nay là tổ hợp `DIST-5` + `DIST-1`.
- **Nhận cả khoảng cách giữa các phần tử làm người tham gia.** Đây là điều kiện để `DIST-6` tồn tại, và `DIST-6` là điều kiện
  để `flex-1` thôi bị dùng làm dụng cụ đẩy.
- **Chọn "phần thiếu quyết định mã" làm tiêu chí phân định duy nhất.** Một phần tử con có thể vừa lấy phần
  dư vừa từ chối nhường; không có luật ưu tiên này thì tập mã chồng lên nhau ngay ở trường hợp đầu tiên có
  mâu thuẫn.
- **Nâng `min-w-0` thành một mã có tên (`DIST-4`).** Nó là kiểu hỏng không phát ra lỗi: class CSS danh sách
  nhìn vẫn đúng, `truncate` vẫn nằm đó, hàng thì đã thôi là hàng. Một tình huống không có tên là tình
  huống không ai bị bắt lỗi được — nên nó được đặt tên, và kèm theo là luật *quyền được co không di
  truyền*.
- **Viết mô-đun thành năm tài liệu.** `INDEX.md` là luật máy đọc, `vi.md` là tình huống nghiệp vụ,
  `example.md` là trường hợp và ngoại lệ kèm ánh xạ yêu cầu, `audit.md` là phản biện, `changelog.md` là
  lịch sử. Không có `prompt.md`: ánh xạ từ yêu cầu bằng lời nằm cùng chỗ với ví dụ mà nó phân định.
- **Giữ mọi ví dụ ở `className` thuần.** Một luật ở nhóm này phải đúng với bất kỳ giao diện nào; ví
  dụ cần tên riêng của một sản phẩm mới đọc được là ví dụ đứng sai chỗ.

### Cố ý để lại cho mô-đun khác

- **`overflow`.** Chuyện gì xảy ra với nội dung **sau khi** một người tham gia đã nhường: cắt, xuống
  dòng, kẹp dòng, hay cuộn. Mô-đun này chỉ quyết định việc nhường **có được phép** hay không. `min-w-0`
  xuất hiện ở cả hai nơi vì cùng một class CSS trả lời hai câu hỏi khác nhau: ở đây nó là **quyền được
  co**, ở đó nó là điều kiện để một khai báo cắt/cuộn chạy được.
- **`gap`.** Khoảng cách **lúc nghỉ** giữa các phần tử cùng cấp và ý nghĩa quan hệ của nó. `DIST-6` chỉ nói
  phần dư rơi vào khoảng cách giữa các phần tử nào; nó không chọn khoảng cách giữa các phần tử đó to bao nhiêu khi hàng không có phần dư.
- **`responsive`.** Việc một phần tử cha đổi trục hoặc đổi số cột theo khổ màn. Mô-đun này chỉ nói rằng
  khi phần tử cha đổi thì người tham gia được gán mã lại, và khi phần tử cha không đổi thì mã không được đổi.
- **`padding`.** Khoảng thở bên trong một người tham gia. Một hàng chật không được chữa bằng cách đổi
  vai trò phân phối.
- **`typography`.** Kích thước và cân nặng chữ của phần nội dung bên trong. Một tiêu đề dài không
  được chữa bằng `flex-1`.
