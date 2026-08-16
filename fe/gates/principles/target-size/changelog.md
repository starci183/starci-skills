---
id: fe-principles-target-size-changelog
title: changelog.md
slug: /gates/principles/target-size/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật Kích thước mục tiêu.
---

# changelog.md

> Phiên bản hiện tại: `2.00` · Mô-đun: `target-size`

## Quy tắc phiên bản

Một thay đổi luật được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc nhóm mà nó nằm trên.

## 2.00 — 2026-08-16

Mô-đun được dựng mới ở phiên bản `2.00`, không phải `1.00`: nó sinh ra trực tiếp trên nhóm
`gates/principles/` với hình dạng năm tài liệu đã chốt, nên nó bắt nhịp với số phiên bản của nhóm thay vì
mở một dãy số riêng mà lịch sử của nó không có.

- **Nhận lấy một câu hỏi.** Mô-đun trả lời đúng hai điều: **một mục tiêu nhỏ nhất được bao nhiêu**, và
  **hai mục tiêu kề nhau phải cách nhau bao xa**. Trước đó hai câu này không có chủ; chúng được trả lời
  lại từ đầu ở mỗi lần đánh giá, bằng mắt, và không lần nào giống lần nào.
- **Neo vào nguồn công bố.** 44 × 44 CSS px của WCAG 2.5.5 (AAA), 24 × 24 của WCAG 2.5.8 (AA), 44 pt
  của Apple HIG, 48 dp của Chất liệu. Sàn của mô-đun là 44. Đây là lý do mô-đun đứng ở nhóm
  `principles/` chứ không ở `senses/`: nó không mô tả cảm nhận của người đọc, nó nêu một con số mà bất
  kỳ ai cũng đo lại được và cãi lại được bằng thước.
- **Xếp 44 và 24 thành hai mức nghiêm trọng, không thành hai lựa chọn.** Từ 24 đến 43 là lỗi bộ quy tắc;
  dưới 24 còn là lỗi tuân thủ và phải được gọi đúng tên đó khi báo cáo. Để hai con số cùng cấp là
  cấp sẵn giấy phép hạ sàn.
- **Tách hình vẽ khỏi vùng chạm.** Luật chỉ ràng buộc vùng chạm. Thiết kế muốn hình nhỏ thì luôn được
  phép có hình nhỏ; thứ không được phép là vùng chạm nhỏ. Gần như mọi phản đối "44 to quá" là phản đối
  một điều luật này không hề nói.
- **Đặt mã tình huống.** Sáu mã `TARGET-<index>`. Chỉ số đọc theo khoảng cách so với trường hợp phẳng:
  `0` không có mục tiêu, `1` là mục tiêu tự gánh sàn bằng hình vẽ của mình, `2` là mục tiêu mượn sàn từ một
  vùng nới ra ngoài, `3` rời khỏi một mục tiêu đơn lẻ để nói về khoảng cách giữa các phần tử giữa hai mục tiêu, còn `4` và `5` là
  hai đường thoát đóng — thoát bằng dòng chảy văn bản, và thoát bằng ý nghĩa của toạ độ. Ba trong sáu
  mã không phát ra class CSS nào, và đó chính là lý do chúng phải có mã: một sự miễn trừ không có tên là
  một sự miễn trừ không ai chứng minh được là đã lấy sai.
- **Thêm `TARGET-5` ngoài tập gợi ý.** Mật độ do dữ liệu áp đặt — ghim bản đồ, sơ đồ ghế, điểm trên
  biểu đồ, tay kéo trên vùng vẽ — không thuộc bất kỳ mã nào khác, và nếu bị nhét vào `TARGET-2` thì kết
  quả là một lớp vùng chạm chồng chéo vô hình. Mã này chỉ có hiệu lực khi có thành phần điều khiển tương đương đủ cỡ
  trên cùng màn hình, tức là nó gộp hai ngoại lệ của nguồn thành một điều khoản chặt hơn nguồn.
- **Chốt đúng một kỹ thuật nới.** Giả-phần tử phủ ra ngoài và không tham gia bố cục.
  `-m-* p-*` bị cấm vì lề ngoài âm trừ thẳng vào `gap`, nên nó sửa được kích thước bằng cách phá khoảng cách giữa các phần tử
  một cách im lặng — đúng cái lỗi mà `TARGET-3` sinh ra để chặn.
- **Viết số học của khoảng cách giữa các phần tử thành con số.** `gap` đo trên hình vẽ, luật đo trên vùng chạm, nên khoảng cách giữa các phần tử giữa
  hai hình vẽ phải là `2 × inset + 8`. Hai biểu tượng 24 px cần 28 px, không phải 8. Quan hệ này ngược với
  trực giác "biểu tượng bé thì xếp sát cho gọn", nên nó được nêu bằng ví dụ có số chứ không bằng lời khuyên.
- **Đóng ngoại lệ người dùng tác nhân.** Thành phần điều khiển chưa bị tác giả sửa kích thước không phát ra class CSS; chạm vào
  kích thước là mất ngoại lệ ngay. Đây là chỗ duy nhất một `TARGET-1` hợp lệ mà không có class CSS nào.

**Để lại cho mô-đun bên cạnh, có chủ ý.** Mô-đun này không nói gì về quan hệ nội dung giữa hai phần
tử — khoảng cách giữa các phần tử theo quan hệ thuộc về mô-đun khoảng cách, và khi hai mô-đun ra hai con số thì lấy con số lớn hơn.
Nó cũng không sở hữu khoảng đệm trong bên trong một thành phần điều khiển, hình dạng và độ tương phản của chỉ báo tiêu điểm,
thứ tự nhận tiêu điểm, kích cỡ chữ trong nhãn, hay việc một thành phần điều khiển có nên tồn tại hay không. Nó nhận đúng
một câu hỏi đo được và trả lại mọi câu hỏi còn lại.
