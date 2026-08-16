---
id: fe-principles-typography-changelog
title: changelog.md
slug: /fe/principles/typography/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật Kiểu chữ.
---

# changelog.md

> Phiên bản hiện tại: `2.00` · Mô-đun: `typography`

Tài liệu này ghi các thay đổi luật đã được chấp nhận; riêng nhận định không tự làm đổi bộ quy tắc.

## Quy tắc phiên bản

Một thay đổi luật được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc nhóm mà nó nằm trên.

## 2.00 — 2026-08-16

Đổi số chính vì hai thứ đổi cùng lúc: nhóm và hình dạng mô-đun.

- **Chuyển nhóm.** `fe/design/typography/` → `fe/principles/typography/`. Nhóm `design` bị tách làm
  ba: `principles/` giữ các nguyên tắc dựng hình bắt buộc, `senses/` giữ những gì người đọc cảm nhận,
  `governance/` giữ ngoại lệ và tính đồng nhất. Toàn bộ `id` và `slug` của năm tài liệu đổi theo nhóm mới;
  không còn dấu vết nào của nhóm cũ trong frontmatter.
- **Đặt mã tình huống.** Mỗi tình huống mang một mã `TYPOGRAPHY-<index>`, từ `TYPOGRAPHY-1` tới
  `TYPOGRAPHY-12`. Mô-đun này **không có thang số** như các mô-đun khoảng cách, nên mã được đánh theo
  **thứ tự người đọc gặp**: bốn bậc dàn ý, hai loại tiêu đề đối tượng, hai loại phần thân, nội dung hỗ trợ,
  phần phân chia, chữ do thành phần điều khiển sở hữu, rồi sàn khi chưa nêu chủ sở hữu. Mã đặt tên cho **tình huống**, công thức
  đặt tên cho **dáng chữ**; hai thứ không phải một, và `TYPOGRAPHY-11` không phát ra công thức nào.
- **Nâng luật thành bắt buộc.** Bổ sung tuyên bố rằng mọi dòng chữ hiển thị ra đều rơi vào đúng một mã,
  và không có dòng nào ngắn tới mức được miễn — kể cả một chú thích một chữ.
- **Gộp `prompt.md` vào `example.md`.** Mười sáu yêu cầu đã có lời giải, bảng phân định ranh giới và
  danh sách lỗi bịa nay nằm cùng chỗ với ví dụ mà chúng phân định. Mô-đun còn năm tài liệu.
- **Viết lại `vi.md` theo từng mã.** Mỗi mã có tình huống nghiệp vụ, dấu hiệu nhận biết, câu tự hỏi,
  ranh giới với từng mã kề, và một danh sách rộng các tình huống nghiệp vụ hay gặp.
- **Viết lại `example.md` cho đủ trường hợp.** Mỗi mã nhiều trường hợp, kèm mục ngoại lệ và mục "trông giống
  nhưng không phải mã này". Thêm một cây **nhiều mã lồng nhau** cùng hai biến thể khung chờ và lỗi cục
  bộ, vì luật *một dòng, một quyền sở hữu* và luật tính đồng nhất trạng thái chỉ nhìn thấy được theo cách đó.
- **Rút mọi ví dụ về `className` thuần.** Bỏ toàn bộ bản xem trước trực tiếp dựng bằng thành phần của một sản
  phẩm cụ thể, cùng các ID ví dụ minh hoạ đi kèm. Một luật ở nhóm này phải đúng với bất kỳ giao diện nào; ví
  dụ cần tên riêng của một sản phẩm mới đọc được là ví dụ đứng sai chỗ.
- **Không đổi một công thức nào.** Mười một công thức của `1.03` cùng ngoại lệ thành phần điều khiển-owned được giữ
  nguyên từng ký tự. Lần này chỉ đổi cách đặt tên tình huống, độ phủ ví dụ và độ rõ của ranh giới.

## 1.03 — 2026-08-16

### Đã thay đổi

- Đóng khung kiểu chữ thành dữ kiện thiết kế bất biến thay vì lý lẽ gắn với một sản phẩm.
- Đóng vốn từ về phần tử ngữ nghĩa cộng công thức `className` thường.
- Thay tính từ thị giác bằng dàn ý, quyền sở hữu, tính lặp lại và mối quan hệ.
- Thêm `prompt.md` với mười sáu phân loại thuần nghiệp vụ và danh sách bẫy bịa.
- Chuẩn hoá `vi.md` thành định nghĩa, bảng quyết định, luật, TSX tổng quát và ngoại lệ.
- Thay điểm dừng giả công khai bằng một công thức đọc được; câu hỏi làm rõ chỉ nằm trong yêu cầu.

### Được giữ nguyên

- Trần bốn bậc tiêu đề, luật một dòng dẫn cho một vùng, cặp nội dung hỗ trợ giảm nhấn và tính đồng nhất trạng thái.

### Phản biện quyết định

- Thiếu quyền sở hữu, xin bậc thứ năm và chữ do thành phần điều khiển sở hữu thì dừng lại thay vì chế ra kiểu chữ
  cục bộ.

## 1.02 — 2026-08-16

- Thêm sáu ví dụ minh hoạ kiểu chữ và các ranh giới trường hợp áp dụng / không áp dụng.
- Mở rộng độ phủ ví dụ minh hoạ.

## 1.01 — 2026-08-16

- Dựng phân loại vai trò cho tiêu đề, tiêu đề, phần thân, nội dung hỗ trợ và tính đồng nhất trạng thái.
