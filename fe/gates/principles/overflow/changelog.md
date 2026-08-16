---
id: fe-principles-overflow-changelog
title: changelog.md
slug: /gates/principles/overflow/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật Tràn nội dung.
---

# changelog.md

> Phiên bản hiện tại: `2.00` · Mô-đun: `overflow`

## Quy tắc phiên bản

Một thay đổi luật được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc nhóm mà nó nằm trên.

## 2.00 — 2026-08-16

Mô-đun mới, sinh ra ở số `2.00` vì nó ra đời trực tiếp trên nhóm `principles/` và mang sẵn hình dạng
năm tài liệu của nhóm này. Không có lịch sử `1.x`: trước đó câu hỏi mà nó nhận không thuộc về ai cả, và
đó chính là vấn đề.

- **Nhận lấy một câu hỏi đang vô chủ.** Câu hỏi là: *khi hết chỗ thì ai nhường — nội dung bị cắt, nội
  dung xuống dòng, hộp cuộn, hay hộp nở ra?* Trước mô-đun này, mỗi lần câu hỏi đó xuất hiện nó được trả
  lời bằng cách nhìn một màn hình đang vỡ rồi thêm một class CSS cho hết vỡ. Kết quả là cùng một tình huống
  nhận những câu trả lời khác nhau ở những chỗ khác nhau, và không ai sai được vì không có gì để sai.
- **Nằm trên nhóm `principles/`, cạnh `gap` và `padding`.** Ba mô-đun này cùng trả lời câu hỏi "hộp
  này chiếm chỗ thế nào": `gap` chia khoảng giữa các phần tử cùng cấp, `padding` chia khoảng trong lòng một hộp,
  `overflow` xử lý lúc chỗ **không đủ**. Chúng dùng chung hình dạng năm tài liệu và chung một quy ước: mã
  đặt tên cho **tình huống**, class CSS đặt tên cho **kết quả**, và hai thứ đó không phải một.
- **Tám mã, đánh số liên tục `OVERFLOW-0` … `OVERFLOW-7`, cố ý không thủng.** Đây là khác biệt có chủ ý
  so với `gap`. Thang của `gap` thủng ở `5` và `7` vì nó **là một thang** — các bậc lớn dần và một thang
  liền mời người ta chia đôi. Ở đây không có thang: `OVERFLOW-3` không lớn hơn `OVERFLOW-1`, nó là một
  kết luận khác về cùng một câu hỏi. Số ở đây chỉ là **tên**, nên chúng liền và không mang thứ tự.
- **Thứ tự đánh số đi theo mức độ nội dung bị mất, từ không mất tới không giới hạn.** `0` không có gì
  để mất; `1` mất đuôi một dòng; `2` mất phần sau vài dòng; `3` không được mất gì nên phải xuống dòng;
  `4` và `5` không mất gì và giữ phần thừa lại bằng cách cuộn, dọc rồi ngang; `6` không nói về mất mát
  của một ô mà nói về **ai** mất trong một hàng; `7` không mất gì và cũng không chặn gì. Đọc theo thứ
  tự này là đọc được lý do tồn tại của từng mã.
- **Hai mã không phát ra class CSS và chúng không thay nhau được.** `OVERFLOW-0` nói tràn *không thể xảy
  ra*; `OVERFLOW-7` nói tràn *được phép xảy ra* và trần thuộc về tổ tiên. Gộp lại thì mất đúng câu cần
  nói khi đánh giá thấy hai thanh cuộn lồng nhau, nên chúng được tách từ đầu.
- **Nâng `min-w-0` và `min-h-0` lên mức luật.** Đây là hai chỗ duy nhất trong mô-đun mà một khai báo
  đúng về ý định vẫn không làm gì cả. Hỏng im lặng qua được đánh giá, nên nó phải nằm trong luật chứ
  không nằm trong kinh nghiệm.
- **Đặt điều kiện "cắt phải kèm đường lấy lại".** `OVERFLOW-1` không còn là một lựa chọn hiển thị mà là
  một hợp đồng: không có chú giải, không có liên kết, không có trang chi tiết thì không được cắt.
- **Cấm cắt số, mã và định danh, kể cả khi ô bên cạnh được cắt.** Đây là ranh giới duy nhất trong mô-đun
  mà chọn sai tạo ra thông tin **sai** thay vì thông tin thiếu, nên nó được nhắc lại ở cả bốn tài liệu.
- **Tách hộp cuộn khỏi bề mặt thành một hệ quả cấu trúc, không phải một sở thích.** Bề mặt giữ khoảng đệm trong,
  bo góc, đổ bóng và phần tử phải-luôn-thấy; hộp bên trong chỉ làm một việc là cuộn.
- **Viết `example.md` bằng `className` thuần.** Không thư viện thành phần, không hệ thống thiết kế riêng,
  không khoá đăng ký. Một luật ở nhóm này phải đúng với bất kỳ giao diện nào; ví dụ cần tên riêng của
  một sản phẩm mới đọc được là ví dụ đứng sai chỗ.

### Những gì mô-đun này cố ý để lại cho hàng xóm

- **Khoảng cách giữa các phần tử cùng cấp** thuộc về `gap`. Ở đây chỉ nói ai nhường bề rộng, không nói khoảng cách giữa các phần tử giữa
  chúng rộng bao nhiêu.
- **Khoảng đệm bên trong trong lòng một hộp** thuộc về `padding`. Mô-đun này chỉ nói khoảng đệm trong **không được nằm trong**
  hộp cuộn, không nói nó nên là bao nhiêu.
- **Đổi bố cục theo bề rộng màn hình** thuộc về `responsive`. Ở đây khung nhìn bị loại khỏi tiêu chí phân
  loại: màn hẹp làm tràn dễ xảy ra hơn, không làm nó thành một tình huống khác.
- **Ghim, xếp lớp và toạ độ** thuộc về `position`. Mô-đun này chỉ phân định phần tử dính nào được nằm
  trong hộp cuộn, không nói cách ghim.
- **Cắt góc để bo bề mặt** là một quyết định về vẽ, không phải về độ dài nội dung, nên nó không mang mã
  ở đây. Lý do và rủi ro của việc để nó ngoài phạm vi được ghi trong `audit.md`.
- **Số dòng cụ thể của một giới hạn dòng** vẫn là một quyết định nghiệp vụ do màn hình đó tự nêu. Luật chỉ buộc
  nó phải là một quyết định, và cấm chỉnh nó theo khung nhìn.
