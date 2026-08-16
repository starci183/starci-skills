---
id: fe-principles-position-changelog
title: changelog.md
slug: /gates/principles/position/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật Vị trí.
---

# changelog.md

> Phiên bản hiện tại: `2.00` · Mô-đun: `position`

## Quy tắc phiên bản

Một thay đổi luật được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc nhóm mà nó nằm trên. Các mục cũ giữ nguyên.

## 2.00 — 2026-08-16

Đổi số chính vì hai thứ đổi cùng lúc: nhóm và hình dạng mô-đun.

- **Chuyển nhóm.** `fe/design/position/` → `gates/principles/position/`. Nhóm `design` bị tách làm
  ba: `principles/` giữ các nguyên tắc dựng hình bắt buộc, `senses/` giữ những gì người đọc cảm
  nhận, `governance/` giữ ngoại lệ và tính đồng nhất. Toàn bộ `id` và `slug` đổi sang nhóm mới; không còn
  dấu vết nào của nhóm cũ trong frontmatter của năm tài liệu.
- **Đặt mã tình huống.** Mỗi tình huống mang một mã `POSITION-<index>`: `POSITION-1` (luồng thường),
  `POSITION-2` (làm chủ hệ toạ độ), `POSITION-3` (bám phần tử tổ tiên được gọi tên), `POSITION-4` (bám
  khung nhìn), `POSITION-5` (bám cuộn phần tử tổ tiên tới ngưỡng), `POSITION-6` (vị trí gắn với vòng đời
  tương tác). Mã đặt tên cho **tình huống**, class CSS đặt tên cho **cách tham gia luồng**; hai thứ không
  phải một, và **hai** mã không phát ra class CSS nào — vì hai lý do ngược nhau.
  - Mô-đun này **không có thang số**. Số của mã là thứ tự người đọc gặp, không phải độ lớn, và không
    có tình huống nào nằm giữa hai mã.
  - `POSITION-2` được tách thành một mã riêng thay vì bị coi là chi tiết cài đặt của `absolute`, vì
    một `relative` thừa là vi phạm **vô hình**: nó hiển thị y hệt như khi không có, và chỉ lộ ra khi
    một `absolute` thêm vào sau này bám nhầm vào nó.
  - `POSITION-6` giữ nguyên quyết định cũ rằng trình đơn, chú giải và hộp thoại không được dựng lại bằng class CSS
    thô; điều đổi là quyết định đó nay có **tên** và có thể bị trích dẫn khi đánh giá, thay vì nằm lẫn
    trong danh sách ngoại lệ.
- **Nâng luật thành bắt buộc.** Bổ sung tuyên bố rằng mọi phần tử được hiển thị đều rơi vào đúng một
  mã — kể cả đa số phần tử rơi vào `POSITION-1` và không phát ra gì — và không có phần tử nào nhỏ
  tới mức được miễn.
- **Gộp `prompt.md` vào `example.md`.** Bảng ánh xạ yêu-cầu-sang-quyết-định (16 trường hợp cũ, gồm cả năm
  trường hợp chỉ được phép trả lời bằng một câu hỏi) và bảng phân định ranh giới nay nằm cùng chỗ với ví
  dụ mà chúng phân định. Mô-đun còn **năm** tài liệu; `prompt.md` bị xoá.
- **Viết lại `vi.md` theo từng mã.** Mỗi mã có tình huống nghiệp vụ, dấu hiệu nhận biết, một câu tự
  hỏi phân định, ranh giới với từng mã kề, và danh sách tình huống nghiệp vụ hay gặp.
- **Viết lại `example.md` cho đủ trường hợp.** Mỗi mã nhiều trường hợp, kèm mục ngoại lệ và mục "trông giống
  nhưng không phải mã này". Thêm các ví dụ **mã lồng mã** — `POSITION-1` chứa `POSITION-2` chứa
  `POSITION-3`, và `POSITION-4` chứa `POSITION-6` — vì luật "mỗi tầng khai đúng một vai trò" chỉ
  nhìn thấy được khi hai mã nằm trong nhau.
- **Rút mọi ví dụ về `className` thuần và bỏ bản xem trước trực tiếp.** Bỏ hết các khối bản xem trước nhúng cùng tám
  ID hiển thị của bản `1.02`–`1.03`: chúng hiển thị bằng thành phần của một sản phẩm cụ thể, thứ mà nhóm
  này cấm.
  Một luật ở đây phải đúng với bất kỳ giao diện nào; ví dụ cần tên riêng của một sản phẩm mới đọc
  được là ví dụ đứng sai chỗ. Quyết định cũ "giữ nguyên tám ID hiển thị" được ghi lại trong `audit.md`
  ở mục rủi ro còn mở thay vì bị xoá lặng lẽ.
- **Gác lại quyết định từ vựng màu chữ mờ.** Bản `1.03` chốt `text-muted-foreground`; bản này dùng
  `text-neutral-500` vì nhóm cấm những gì chỉ tồn tại khi có một chủ đề cấu hình cụ thể. Phản đối được
  ghi trong `audit.md`.

## 1.03 — 2026-08-16

### Đã thêm
- Thêm `prompt.md` với 16 trường hợp biên dịch yêu cầu thường.
- Thêm câu hỏi chủ-sở-hữu-toạ-độ cho các yêu cầu mơ hồ.

### Đã thay đổi
- Chuẩn hoá màu chữ mờ trong ví dụ về `text-muted-foreground`.
- Rút bộ quy tắc về luồng thường, `relative`, `absolute`, `fixed`, `sticky`.
- Viết lại hướng dẫn và ví dụ thành luật tổng quát, `className`-đầu tiên.
- Bỏ các quyết định về phân cấp, CTA và cách đặt gắn với một sản phẩm.
- Lấy luồng thường / không phát class CSS làm mặc định công khai khi chưa khai báo điểm neo.

### Phản biện các quyết định
- Giữ nguyên tám ID hiển thị đang có.
- Không bao giờ dùng vị trí để sửa căn chỉnh, khoảng cách hay thứ tự nguồn.
- Chỉ giữ cơ chế hỏi-một-câu trong `prompt.md`/`audit.md` cho yêu cầu không mặc định rõ ràng.

### Xác minh
- Sáu tệp cùng phiên bản `1.03`.
- Đã gỡ luật gắn với sản phẩm và các đầu ra giả mở.

## 1.02 — 2026-08-16

- Thêm tám bộ hiển thị sống và hoàn tất tích hợp mã thẻ tab.

## 1.01 — 2026-08-16

- Giới thiệu quyền sở hữu cách đặt, thứ tự nguồn và hướng dẫn phần tử chồng lớp.
