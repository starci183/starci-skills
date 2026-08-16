---
id: fe-principles-focus-order-changelog
title: changelog.md
slug: /fe/principles/focus-order/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật Thứ tự lấy tiêu điểm.
---

# changelog.md

> Phiên bản hiện tại: `2.00` · Mô-đun: `focus-order`

## Quy tắc phiên bản

Một thay đổi luật được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc nhóm mà nó nằm trên.

## 2.00 — 2026-08-16

Mô-đun mới, mở ở `2.00` để nằm ngang hàng với các mô-đun đã có trên nhóm `principles/`: nó ra đời
với hình dạng năm tài liệu và hệ mã tình huống, chứ không phải trải qua chúng.

- **Câu hỏi mà mô-đun này tiếp quản.** Đường đi của bàn phím qua một màn hình — `Tab` dừng ở đâu,
  dừng theo thứ tự nào, có nhìn thấy chỗ dừng không — và tiêu điểm đi đâu khi một lớp mở ra rồi đóng lại.
  Trước đây câu hỏi này không có nhà: nó bị hỏi lẻ tẻ trong từng lần đánh giá một màn hình cụ thể, nên
  mỗi lần lại được trả lời khác đi, và không lần nào trích dẫn được.
- **Nhóm.** `fe/principles/focus-order/`. Nằm cùng nhóm với các nguyên tắc dựng hình bắt buộc, vì
  nó cũng quyết định mã đánh dấu được viết ra sao chứ không quyết định người đọc cảm nhận thế nào. Đây
  không phải một nguyên tắc thẩm mỹ và không được đọc như một gợi ý.
- **Tuyên bố trung tâm: luật này nằm ở THỨ TỰ DOM, không nằm ở `className`.** Sáu trên tám mã không
  phát ra class CSS nào. Chỉ `FOCUS-2` (chỉ báo tiêu điểm) và `FOCUS-5` (đường tắt) thật sự có class CSS; phần
  còn lại được quyết bởi vị trí của nút DOM, bởi một thuộc tính, hoặc bởi đoạn mã chạy lúc chuyển
  tiếp. Ghi rõ điều này ngay ở `Law` vì đó cũng là lý do luật bị bỏ sót: không có gì trong class CSS danh sách
  để soi ra.
- **Đặt mã tình huống.** Tám mã `FOCUS-0` … `FOCUS-7`. Mã đặt tên cho **tình huống**; class CSS — nếu có
  — đặt tên cho **hình dạng**. `FOCUS-0` và `FOCUS-1` không phát ra class CSS nào và vẫn là mã đầy đủ:
  "không bao giờ được dừng ở đây" và "dừng đúng ở chỗ này" là hai điều một reviewer phải trích dẫn
  được, còn một tình huống không có tên là tình huống không ai bị bắt lỗi được.
- **Vì sao đánh số như vậy.** `FOCUS-0` … `FOCUS-5` là phần lõi rút thẳng từ bốn chuẩn được trích
  dẫn: `0` là mã vắng mặt, `1` là mặc định, `2` là trạng thái của mặc định, `3`–`4` là cặp mở–đóng
  của một lớp, `5` là câu hỏi ở cấp tài liệu. `FOCUS-6` và `FOCUS-7` được **nối vào cuối**, không
  chèn vào giữa, để một trích dẫn viết theo bản trước vẫn giữ nguyên nghĩa. Thang này liền mạch
  `0`–`7` — khác với thang quan hệ có lỗ thủng ở nhóm này — vì ở đây các số là **danh mục tình
  huống**, không phải bậc của một đại lượng đo được; không có "chia đôi khoảng cách" nào để mời gọi.
- **Hai mã thêm so với tập gợi ý ban đầu.** `FOCUS-6` (một thành phần tiện ích hợp thành là một điểm dừng) và
  `FOCUS-7` (đưa tiêu điểm tới nội dung vừa xuất hiện). Không có chúng thì tập mã không đóng: một danh sách thẻ tab
  năm thẻ tab và một cú đổi tuyến trang trong ứng dụng một trang không rơi vào mã nào cả. Lý do đầy đủ nằm ở
  `audit.md`, mục "Rủi ro còn mở".
- **2.1.2 không thành mã riêng.** "Không có bẫy bàn phím" được cài vào `FOCUS-3` như điều kiện hợp lệ
  của việc giam: không `Escape`, không nút đóng nhìn thấy được thì đó không phải `FOCUS-3` làm sai —
  đó không phải `FOCUS-3`. Một mã mà không ai chọn có chủ ý là một mã chết.
- **Đơn vị phân loại là một quyết định, không phải một phần tử.** Một cái nút làm phát sinh hai quyết
  định trên hai câu hỏi khác nhau: nó đứng ở đâu trong đường đi (`FOCUS-1`) và có nhìn thấy được lúc
  nó giữ tiêu điểm không (`FOCUS-2`). Mỗi quyết định vẫn rơi vào đúng một mã.
- **Không có mặc định an toàn cho chuyển tiếp.** Ở các mô-đun chọn theo bậc, thiếu dữ kiện thì lấy
  bậc nhỏ hơn. Ở đây đoán bừa sinh ra một màn hình mất dấu tiêu điểm, nên thiếu dữ kiện thì hỏi **một**
  câu về quyền sở hữu màn hình rồi dừng.
- **Mọi ví dụ ở dạng `className` thuần và mã đánh dấu thuần.** Không thư viện thành phần, không hệ thống thiết kế
  riêng, không khoá đăng ký. Một luật ở nhóm này phải đúng với bất kỳ giao diện nào; ví dụ cần tên
  riêng của một sản phẩm mới đọc được là ví dụ đứng sai chỗ.

### Cố ý để lại cho mô-đun khác

- **Khoảng cách giữa các thành phần điều khiển** — một thanh công cụ nên thở bao nhiêu là câu hỏi của mô-đun quan hệ giữa
  phần tử cùng cấp. Ở đây chỉ quan tâm thanh công cụ đó chiếm mấy điểm dừng.
- **Màu, độ dày và độ tương phản của chỉ báo tiêu điểm** — `FOCUS-2` buộc phải **có** một chỉ báo nhìn
  thấy được và cấm bỏ nó đi; còn nó dày mấy điểm ảnh, màu gì, tương phản bao nhiêu thuộc về mô-đun màu
  và mô-đun tương phản.
- **Tên gọi và vai trò ARIA** — mô-đun này dùng `role`, `aria-modal`, `aria-selected`, `aria-hidden`
  đúng ở mức cần để nói về đường đi bàn phím. Cây tên gọi, thông báo cho trình đọc màn hình và quan
  hệ nhãn–thành phần điều khiển là chuyện của mô-đun ngữ nghĩa.
- **Phím tắt và tổ hợp phím toàn cục** — `FOCUS-6` chỉ nói phím mũi tên đi trong một thành phần tiện ích hợp
  thành. Bảng phím tắt cấp ứng dụng nằm ngoài phạm vi.
- **Hoạt ảnh của lớp phủ** — thời lượng, nhịp chuyển động và `prefers-reduced-motion` là chuyện của mô-đun
  chuyển động. Mô-đun này chỉ giữ đúng một điều: trong suốt thời gian lớp đang thoát, nó phải đã ở
  ngoài đường đi.
