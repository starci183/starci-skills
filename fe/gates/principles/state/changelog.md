---
id: fe-principles-state-changelog
title: changelog.md
slug: /gates/principles/state/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật Trạng thái.
---

# changelog.md

> Phiên bản hiện tại: `2.00` · Mô-đun: `state`

## Quy tắc phiên bản

Một thay đổi luật được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc nhóm mà nó nằm trên.

## 2.00 — 2026-08-16

Mô-đun dựng mới ở số chính `2.00`, ngang bằng với các mô-đun cùng nhóm, vì nó ra đời đã mang sẵn
hình dạng năm tài liệu của `principles-v2` chứ không đi lên từ một hình dạng cũ.

- **Nhận câu hỏi.** Mô-đun trả lời: *một phần tử sở hữu bao nhiêu lớp hình ảnh, và lớp nào là bắt
  buộc*. Trước đây câu hỏi này không có nhà: nó nằm rải trong đánh giá từng màn hình, và mỗi lần lại
  được trả lời bằng trí nhớ của người đang đánh giá.
- **Chỗ đứng trên nhóm.** Nằm ở `gates/principles/`, cùng chỗ với các nguyên tắc dựng hình bắt buộc.
  Đây là mô-đun đầu tiên trên nhóm mà **cái sai của nó không nhìn thấy được**: sai `gap` hay sai
  `overflow` thì tấm ảnh tự tố cáo, còn thiếu một lớp trạng thái thì tấm ảnh im lặng. Vì vậy luật
  được phát biểu thành một **phép đếm** — đếm cái phần tử có thể vào, đếm cái nó vẽ ra, so hai số —
  chứ không thành một danh sách khuyến nghị.
- **Đặt mã tình huống.** Mười mã `STATE-0`…`STATE-9`. Chỉ số không tuỳ tiện. `STATE-0` là chỗ **không
  tồn tại** trục trạng thái. `STATE-1` là **gốc** của trục. `STATE-2`, `STATE-3`, `STATE-4` là ba lớp
  **tạm thời** do thiết bị nhập điều khiển, đánh số theo đúng thứ tự người dùng gặp chúng — con trỏ
  tới, bàn phím rơi vào, cú nhấn cam kết — và đó cũng là **thứ tự khai báo an toàn** trong class CSS
  danh sách, vì cùng độ đặc hiệu thì cái viết sau thắng. `STATE-5`…`STATE-9` là các lớp **khai báo**, do
  dữ liệu, quyền hạn hoặc bộ kiểm tra quyết, và chúng **đè** nhóm tạm thời.
- **Phát biểu sàn bắt buộc.** Bốn lớp `STATE-1`…`STATE-4` là sàn của mọi phần tử thao tác được,
  không miễn theo kích thước hay tầm quan trọng. Mỗi mã khai báo bắt buộc theo đúng một câu hỏi năng
  lực có/không, nên "đủ hay thiếu" là một con số chứ không phải một ý kiến.
- **Thêm `STATE-9`, đọc-không-sửa.** Không có nó thì mọi giá trị trưng ra mà không sửa ở đây bị dồn
  vào `STATE-5`, và cái giá là ba tổn thất cùng lúc cho một điều đáng lẽ chỉ mất một. Lý do đầy đủ
  nằm ở `audit.md`.
- **Gộp thay vì tách ở `STATE-6`.** Được chọn, đang là trang hiện tại, đang vạch chia, đang bật, đang mở —
  cùng một mã, vì cả năm đều là một điều kiện **bền do dữ liệu quyết** và cùng qua được một phép thử:
  buông con trỏ, tải lại trang, nó còn.
- **Bắt trạng thái phải có mặt trong DOM.** `disabled`, `readOnly`, `aria-current`, `aria-selected`,
  `aria-pressed`, `aria-expanded`, `aria-busy`, `aria-invalid`. Một trạng thái chỉ sống trong CSS là
  một trạng thái mà mắt thấy còn trình đọc màn hình không nghe.
- **Cấm lớp trạng thái đổi hình học.** Một họ lỗi trông rất khác nhau — `hover:border`,
  `active:font-bold`, thẻ tab chỉ có viền khi được chọn, biểu tượng đang tải thay chữ trên nút — được quy về đúng một
  luật: lớp trạng thái không được đi tính lại bố cục.
- **Viết `example.md` bằng `className` thuần.** Không thư viện thành phần, không hệ thống thiết kế riêng,
  không khoá đăng ký. Mỗi mã nhiều trường hợp, kèm mục ngoại lệ và mục "trông giống nhưng không phải mã
  này", và một mục **mã lồng mã** để nói rõ luật *một phần tử, một tập mã*.

**Để lại cho mô-đun hàng xóm, có chủ ý:**

- **Màu của một trạng thái.** Mô-đun này quyết lớp nào **tồn tại**; mô-đun màu quyết lớp đó **màu
  gì**. Cùng một tình huống tiêu điểm có mặt ở cả hai nơi mà không mâu thuẫn, vì hai bên trả lời hai câu
  hỏi khác nhau về nó.
- **Khoảng cách và kích thước của chỉ báo trạng thái.** Bề dày vòng, khoảng hở của `ring-offset`,
  chỗ chừa cho thông báo lỗi — mô-đun này chỉ đòi **giữ chỗ**, không đòi giữ bao nhiêu.
- **Nội dung của một vùng chưa có dữ liệu.** Khung chờ, trạng thái rỗng, màn hình tải hỏng đều là nội
  dung của vùng, không phải lớp trạng thái của một phần tử. `STATE-7` dừng lại ở công việc của chính
  phần tử, và ngoại lệ *bận ở cấp vùng* tồn tại đúng để giữ ranh giới đó không bị bước qua.
- **Chuyển động giữa hai lớp.** Mô-đun này chỉ đòi chuyển động không được chạy trên thuộc tính tính
  lại bố cục. Thời lượng, đường cong và việc tôn trọng `prefers-reduced-motion` thuộc về nơi khác.
