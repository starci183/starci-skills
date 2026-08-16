---
id: be-lints-event-delivery-changelog
title: changelog.md
slug: /be/lints/event-delivery/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của mô-đun tài liệu phần máy giữ hợp đồng chuyển phát sự kiện.
---

# changelog.md

> Current version: `2.00` · Mô-đun: `event-delivery`

## Version Policy

Một thay đổi được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu cho khớp số.
Đổi số chính (`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc nhóm mà nó nằm trên.

Mô-đun này tài liệu hoá **phần máy giữ**, nên nó có thêm một nguồn thay đổi mà các mô-đun luật không
có: **tệp quy tắc đổi thì mô-đun này đổi, kể cả khi văn bản luật đứng yên**. Một luật máy được thêm,
bị bỏ, bị đổi tên, đổi cơ chế phát hiện, đổi định danh thông điệp hay đổi mức nghiêm đều là một thay
đổi ở đây. Đóng được một cửa trong bảng **Cửa còn mở** cũng vậy — bảng ấy là nội dung chính của
mô-đun, không phải phần phụ lục.

Ở mô-đun này có thêm một nguồn thay đổi thứ hai, riêng của nó: **cổng là một đường dẫn tệp**. Tệp cầu
bị đổi tên hay bị tách là một thay đổi hành vi của luật máy, dù không ai chạm vào tệp quy tắc. Trường
hợp ấy phải được ghi vào đây như một thay đổi thật.

Tên luật máy **không bao giờ được viết lại** trong bất kỳ tài liệu nào của mô-đun. Tên là danh tính:
nó là chuỗi in ra trong nhật ký dựng, chuỗi viết trong một dòng tắt luật, và chuỗi mọi người dùng để
gọi cùng một thất bại. Đặt thêm một con số hay một cái tên thứ hai là tạo ra hai cách gọi một luật mà
không cách nào biết thông điệp đến từ đâu.

## 2.00 — 2026-08-16

Dựng mới. Mô-đun này ra đời để tài liệu hoá **phần máy giữ được** của luật chuyển phát sự kiện, tách
hẳn khỏi văn bản luật: trang luật nói điều gì là đúng, mô-đun này nói máy nhìn thấy điều đó bằng cách
nào và **không** nhìn thấy điều đó ở đâu.

- **Tài liệu hoá đúng một luật máy**, đúng bằng số luật mà tệp quy tắc công bố, ship trong gói
  `@starci/eslint-canon-be` và đặt ở mức `error`:
  - `nats-bridge-delivery-contract` — hai thông điệp, `origin` và `digest`.
- **Con số dự kiến là một, và thực tế đúng một.** Đếm ở `rules` và ở `recommended`, hai chỗ khớp
  nhau, không có tên nào công bố ở một chỗ mà thiếu ở chỗ kia.
- **Một luật máy gánh hai mã luật**, tách nhau bằng định danh thông điệp: `origin` giữ `DELIVERY-3`,
  `digest` giữ `DELIVERY-4`. Không phải bịa ánh xạ nào, nhưng hệ quả được ghi thành **F-1** trong
  `audit.md`: nhật ký dựng in ra tên luật, mà tên ấy là một chuỗi duy nhất cho hai điều luật.
- **Ghi rõ bốn mã không có luật máy**: `DELIVERY-1` (phong bì mang danh tính nơi sinh và dấu vân
  tay), `DELIVERY-2` (khai `useLocal` và `useNats` cho từng sự kiện), `DELIVERY-5` (bản kiểm khẳng
  định người nhận và nội dung, không đếm số lần gọi) và `DELIVERY-6` (chứng minh bằng hai bản chạy
  thật). Bảng ánh xạ trong `example.md` nói thẳng "không có luật máy" thay vì suy chúng vào một luật
  gần giống.
- **Ghi bảy nhận định** vào `audit.md`: một tên gánh hai mã; phạm vi là đúng một tệp; "trước" trong
  luật máy là trước trong văn bản chứ không phải trước lúc chạy; thiếu hẳn lời gọi phát sự kiện bị
  báo bằng câu chữ nói về thứ tự; biểu thức chính quy đóng cứng cách viết chứ không đóng cứng ý
  nghĩa; mọi thất bại báo lên dòng đầu tệp; và tên luật máy hứa nhiều hơn cơ chế của nó.
- **Mở bảng `Escape Hatches` với hai phần.** Phần **Closed** ghi mười cách viết mà người đọc tưởng sẽ
  lọt nhưng không lọt — đáng kể nhất là hai cái đi ngược trực giác: xoá lời gọi phát sự kiện làm luật
  máy nổ **hai** lỗi thay vì im, và gom giá trị vào hằng số làm nó **to tiếng hơn** chứ không êm đi.
  Ở phần lớn luật khớp chuỗi, hằng số là cửa lách quen thuộc nhất; ở đây nó là nguồn báo thừa.
- **Ghi ra mười hai cửa còn mở**, mỗi cửa kèm một mẫu mã trong `example.md` được dán nhãn rõ là thứ
  luật máy **bỏ sót**, không phải thứ được cho phép. Mười một trong mười hai cửa ấy cùng một hình
  dạng: luật máy nhìn thấy **chuỗi ký tự theo thứ tự xuất hiện**, còn luật nói về **một hậu quả không
  được xảy ra hai lần**. Nặng nhất là phép so được viết ra mà không kèm câu lệnh bỏ qua — văn bản
  khớp, cổng im, và mọi bản vọng về chính mình đều được phát.
- **Mỗi cửa còn mở trong `audit.md` nêu luật máy phải soi thêm cái gì mới đóng được**, và nêu thứ tự
  đáng làm: chuyển từ tìm chuỗi sang đọc cây cú pháp đóng bốn cửa cùng lúc và là việc đầu tiên. Một
  cửa duy nhất được kết luận là đóng thì đắt hơn để mở: cấm dòng tắt luật, vì một cổng không tắt được
  sẽ bị gỡ khỏi cấu hình thay vì bị tắt tại chỗ, mà gỡ khỏi cấu hình thì khó nhìn thấy hơn nhiều.
- **Ghi thêm hai rủi ro không phải cửa lách**: bộ kiểm song sinh chỉ phủ trường hợp **thiếu hẳn** và
  chưa có trường hợp nào chứng minh chiều **thứ tự sai**; và `DELIVERY-2` là mã dễ nhất trong cả luật
  để giao cho máy mà hiện chưa có ai giữ.
- **Chép nguyên văn tên luật máy**, hai định danh thông điệp, tiền tố `starci-be/` trong bảng
  `recommended`, và ba chuỗi mà cơ chế phát hiện thật sự tìm. Lệnh cấm tên sản phẩm áp vào lời văn và
  ví dụ, không áp vào một định danh có thật đang được ship.
