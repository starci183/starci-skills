---
id: fe-principles-optical-changelog
title: changelog.md
slug: /gates/principles/optical/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật Thị giác.
---

# changelog.md

> Phiên bản hiện tại: `2.00` · Mô-đun: `optical`

## Quy tắc phiên bản

Một thay đổi luật được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc nhóm mà nó nằm trên.

## 2.00 — 2026-08-16

Mô-đun mới. Mở ở `2.00` chứ không ở `1.00`, vì nó sinh ra đã đứng trên nhóm `principles/` và mang
sẵn hình dạng năm-tài liệu của nhóm này; không có lịch sử `1.x` nào để kể.

- **Câu hỏi nó nhận về.** "Khi nào con mắt phủ quyết con số." Trước mô-đun này, mọi cú nhúc nhích một
  điểm ảnh đều là chuyện riêng của người viết ra nó: không ai cấm, không ai kiểm, và cũng không ai chỉ ra
  được nó sai ở đâu. Mô-đun đặt câu hỏi ấy thành một tập mã đóng và một mặc định từ chối.
- **Vị trí trên nhóm.** `gates/principles/optical/`. Nó ngồi cạnh những nguyên tắc dựng hình bắt buộc
  khác của nhóm, và cố tình ngồi **sau** chúng: những mô-đun kia quyết con số, mô-đun này chỉ được
  hỏi một câu duy nhất là con số đã quyết ấy có được phép cố ý đi lệch không, và lệch bao nhiêu.
- **Đây là mô-đun bất thường và nó tự nói ra điều đó.** Đây là chỗ duy nhất trên nhóm mà một giá trị
  đã đo bị cố ý làm cho sai. Cái giá của quyền đó được viết thẳng vào `Law`: mỗi mã phải gọi tên được
  **dấu hiệu đo được** biện minh cho việc ghi đè, và mỗi mã trong `vi.md` mang thêm một mục **Phép đo**
  mà các mô-đun khác trên nhóm không có.
- **Bảy mã.** `OPTICAL-0` số đo đúng · `OPTICAL-1` tâm tính ra không phải tâm nhìn thấy ·
  `OPTICAL-2` hộp bằng nhau nhưng khối lượng không bằng · `OPTICAL-3` hộp của chữ không phải mực của
  chữ · `OPTICAL-4` chữ giãn theo một cỡ nó không còn đứng · `OPTICAL-5` góc lồng góc · `OPTICAL-6`
  cạnh dùng chung.
- **Vì sao đánh số như vậy.** Thứ tự theo **tầm với của ghi đè**: `1`–`2` sửa một dấu so với hộp của
  chính nó (vị trí, rồi kích thước), `3`–`4` sửa một đoạn chữ so với số liệu đo của chính nó (dọc, rồi
  ngang), `5`–`6` sửa một thứ so với cái nằm ngoài nó (góc của khung chứa, rồi cạnh chia với hàng xóm).
  Ba cặp, tầm với tăng dần theo chỉ số.
- **Vì sao dãy số liên tục, không thủng.** Ở mô-đun khoảng cách, thang thủng là để chặn việc chia đôi
  giữa hai bậc. Ở đây không có bậc nào để chia đôi: các mã không phải mức độ của cùng một đại lượng mà
  là sáu thứ khác nhau mà mắt đang đo, cộng với một phán quyết từ chối. Không có gì để một cái lỗ ngăn
  lại, nên không đục lỗ.
- **`OPTICAL-0` là phán quyết mặc định, không phải mã còn thừa.** Phần lớn đề nghị nhúc nhích kết thúc
  ở đây. Nó được đặt tên vì một lời từ chối không có tên thì không viện dẫn được, không đánh giá được, và
  không ai chứng minh được là mình đã từ chối đúng.
- **Đơn vị xét là một dấu hiệu trên một thuộc tính,** không phải một phần tử. Nhờ vậy một thẻ có thể mang
  hai mã trên hai thuộc tính khác nhau mà tập mã vẫn đóng và vẫn tổng quát; `example.md` có các ví dụ
  mã lồng mã để nói rõ chỗ này.
- **Những gì cố ý để lại cho mô-đun hàng xóm.**
  - *Khoảng cách giữa hai phần tử cùng cấp* thuộc luật khoảng cách. Ở đây có một điều kiện bất biến cấm hẳn: ghi đè quang
    học không bao giờ được thực hiện bằng cách bóp khoảng cách giữa các phần tử. Khoảng trống ma phía trên một tiêu đề lớn được
    sửa trên `leading` của chính chữ đó, không sửa bằng `gap`.
  - *Chọn cỡ chữ nào* thuộc luật kiểu chữ. `OPTICAL-3` và `OPTICAL-4` chỉ sửa số liệu đo của một cỡ **đã
    được chọn**, không bao giờ đề xuất đổi cỡ.
  - *Màu, tương phản và cảm giác chữ nặng hơn trên nền tối* thuộc nhóm cảm nhận. Đó cũng là "mắt phủ
    quyết số", nhưng số bị phủ quyết là số của màu, và phép đo là phép đo tương phản — không nằm trong
    bất kỳ mã nào ở đây.
  - *Ngôn ngữ hình dạng* — bo bao nhiêu cho hợp thương hiệu — không thuộc mô-đun này. `OPTICAL-5` chỉ
    biết một phép trừ, và chỉ khi đã có một bán kính ngoài do người khác quyết.
  - *Bố cục theo khung nhìn* thuộc luật bố cục. Ghi đè quang học không đổi theo bề rộng màn hình, trừ khi
    chính cái dấu đổi.
- **Ví dụ để ở `className` thuần.** Không thư viện thành phần, không khoá đăng ký, không tên sản phẩm.
  Một luật ở nhóm này phải đúng với bất kỳ giao diện nào; ví dụ cần tên riêng của một sản phẩm mới đọc
  được là ví dụ đứng sai chỗ.
- **Không có `prompt.md`.** Ánh xạ từ yêu cầu bằng lời sang một ghi đè, bảng phân định ranh giới và
  danh sách sai lầm lặp lại nằm cùng chỗ với ví dụ mà chúng phân định. Mô-đun gồm năm tài liệu.
