---
id: fe-principles-margin-changelog
title: changelog.md
slug: /gates/principles/margin/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật Lề ngoài.
---

# changelog.md

> Phiên bản hiện tại: `2.00` · Mô-đun: `margin`

## Quy tắc phiên bản

Một thay đổi luật được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc nhóm mà nó nằm trong.

## 2.00 — 2026-08-16

Đổi số chính vì hai thứ đổi cùng lúc: nhóm và hình dạng mô-đun.

- **Chuyển nhóm.** `fe/design/margin/` → `gates/principles/margin/`. Nhóm `design` bị tách làm ba:
  `principles/` giữ các nguyên tắc dựng hình bắt buộc, `senses/` giữ những gì người đọc cảm nhận,
  `governance/` giữ ngoại lệ và tính đồng nhất. Toàn bộ `id` và `slug` đổi theo.
- **Đặt mã tình huống.** Mỗi tình huống mang một mã `MARGIN-<index>`: `MARGIN-0`, `MARGIN-1`,
  `MARGIN-2`, `MARGIN-3`, `MARGIN-4`. Mã đặt tên cho **tình huống**, class CSS đặt tên cho
  **giá trị**; hai thứ không phải một, và `MARGIN-0` không tạo class CSS nào. Mô-đun này không có
  thang đo như các mô-đun cùng nhóm — lề ngoài không phải một nhịp, nên con số trong mã chỉ là thứ tự
  đọc, không phải một bậc trên thang.
- **Bỏ mã chữ, dùng chỉ mục bằng số.** Bốn mã còn lại trước đây đặt tên bằng chữ theo việc hoặc theo
  class CSS chúng tạo ra — xoá lề ngoài, `mx-auto`, `ms-auto`, `mt-auto` — nay là `MARGIN-1`…`MARGIN-4`, giữ
  nguyên thứ tự đọc và không đổi nghĩa mã nào. Lý do: một mã chỉ **trích dẫn được** khi cách đặt tên
  không có ngoại lệ nào, mà bộ mã chữ có ngoại lệ ngay từ mã đầu tiên — `MARGIN-0` là số còn bốn mã
  kia là chữ, nên không phát biểu được một câu đúng cho cả năm; và ngay trong bốn mã chữ, mã xoá
  lề ngoài cũng không phản chiếu class CSS như ba mã kia. Không mất gì: nghĩa vốn đã nằm ở **cột Tình
  huống**, nơi việc xoá lề ngoài, `mx-auto`, `ms-auto` và `mt-auto` vẫn được gọi tên, và các tiêu đề trong `vi.md` /
  `example.md` vẫn mang đúng chữ đó.
- **Tách `MARGIN-0` khỏi `m-0`.** Trước đây "không khai báo lề ngoài" và `m-0` nằm cạnh nhau trong một
  bảng quyết định như hai đầu ra. Nay chúng là hai **mã** riêng, vì chúng là hai lời khẳng định khác
  nhau về thế giới: một cái nói *ở đây không ai đặt lề ngoài*, một cái nói *có người khác đặt và tôi
  gọi được tên*. Viết `m-0` để diễn đạt tình huống thứ nhất là bịa ra một sự thật về DOM.
- **Nâng luật thành bắt buộc.** Bổ sung tuyên bố rằng mọi phần tử hiển thị đều rơi vào đúng một mã,
  mã hay gặp nhất là mã không phát ra gì, và không có phần tử nào nhỏ, sâu hay tạm tới mức được miễn.
- **Gộp `prompt.md` vào `example.md`.** Bảng ánh xạ yêu cầu-sang-className, các worked yêu cầu và
  bảng phân định ranh giới nay nằm cùng chỗ với ví dụ mà chúng phân định. Mô-đun còn năm tài liệu.
- **Viết lại `vi.md` theo từng mã.** Mỗi mã có tình huống nghiệp vụ, dấu hiệu nhận biết, câu tự hỏi,
  ranh giới với từng mã kề, và danh sách tình huống nghiệp vụ hay gặp.
- **Viết lại `example.md` cho đủ trường hợp.** Mỗi mã có nhiều trường hợp, kèm mục ngoại lệ và mục
  “trông giống nhưng không phải mã này”, trong đó cặp SAI/ĐÚNG được viết cạnh nhau vì phần lớn lỗi
  của mô-đun này **hiển thị giống hệt bản đúng** và chỉ lộ ra khi cấu trúc đổi. Thêm các ví dụ **mã lồng mã** để
  nói rõ luật *một phần tử, một quyết định đặt chỗ*.
- **Rút mọi ví dụ về `className` thuần.** Bỏ hết khối xem trước trực tiếp được hiển thị bằng thành
  phần của một sản phẩm cụ thể — chín bản xem trước gắn với tên ví dụ riêng của một ứng dụng đã được
  thay bằng mã đánh dấu thông thường. Một luật ở nhóm này phải đúng với bất kỳ giao diện nào; ví dụ cần tên riêng của một sản
  phẩm mới đọc được là ví dụ đứng sai chỗ.
- **Giữ nguyên mọi quyết định luật cũ.** Tập className vẫn đóng ở không-class CSS, `m-0`, `mx-auto`,
  `ms-auto`, `mt-auto`. Lề ngoài đo bằng số và lề ngoài âm vẫn nằm ngoài mọi mã. Tràn toàn chiều rộng và
  phần tử chồng lớp vẫn là cấu trúc bố cục và bài toán định vị. Ưu tiên thuộc tính lô-gic vẫn giữ. Những gì được thêm là chiều
  sâu nhận diện, không phải một luật khác.

## 1.04 — 2026-08-16

- Làm bộ quy tắc tổng quát và ưu tiên `className`.
- Bỏ các công thức bố cục gắn tên ứng dụng và phần chi tiết chuyển đổi của lề ngoài đo bằng số.
- Đóng đầu ra thông thường ở không-lề ngoài, `m-0`, `mx-auto`, `ms-auto`, `mt-auto`.
- Định tuyến khoảng cách giữa các phần tử cùng cấp về Khoảng cách và khoảng đệm bên trong về Khoảng đệm trong.
- Thay các phỏng đoán đặt chỗ mơ hồ bằng một câu hỏi cụ thể về bố cục của phần tử cha.
- Lấy "không viết lề ngoài" làm mặc định công khai khi hình học chưa rõ.

## Các phiên bản trước

`1.01`–`1.03` xác lập quyền sở hữu vị trí bên ngoài, cách căn bằng lề ngoài tự động, và lệnh cấm dùng
lề ngoài làm nhịp thường giữa các phần tử cùng cấp.
