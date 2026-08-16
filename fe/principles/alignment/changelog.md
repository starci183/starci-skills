---
id: fe-principles-alignment-changelog
title: changelog.md
slug: /fe/principles/alignment/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật Căn chỉnh.
---

# changelog.md

> Phiên bản hiện tại: `2.00` · Mô-đun: `alignment`

## Quy tắc phiên bản

Một thay đổi luật được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc nhóm mà nó nằm trên.

## 2.00 — 2026-08-16

Mô-đun mới, mở ở `2.00` để nằm ngang hàng với các mô-đun khác trên cùng nhóm. Không có lịch sử
trước đó: câu hỏi này vốn không có chủ, và đó chính là vấn đề nó ra đời để giải quyết.

- **Nhận câu hỏi chưa ai nhận.** Mô-đun này nhận trách nhiệm trả lời: *trên trục chéo, các con treo
  vào đâu* — và kèm theo đó, *trên trục chính, cả cụm nằm ở đâu và chỗ trống thừa thuộc về ai*. Trước
  đó hai câu hỏi này được trả lời bằng phản xạ. Bằng chứng: `items-*` xuất hiện chín mươi mốt lần,
  `justify-*` ba mươi tư lần, không lần nào phải nêu lý do. Một quyết định lặp lại hơn một trăm lần
  mà không có tiêu chí là một quyết định chưa từng được đưa ra.
- **Đặt trên nhóm `principles/`.** Cùng chỗ với `gap`, `padding`, `margin`, `position`, `overflow`,
  `typography`, `colour`, `responsive` và `surface-in-surface`. Nhóm này giữ các nguyên tắc dựng
  hình **bắt buộc**: mỗi mô-đun nhận một câu hỏi, đóng tập câu trả lời, và không mô-đun nào được để
  một tình huống thật rơi ra ngoài.
- **Chia mã theo hai trục, không theo một thang.** Khác `gap` và `padding` — nơi một nút DOM mang đúng
  một mã — một vùng chứa ở đây trả lời **hai** câu hỏi độc lập và mang **hai** mã. Đó là lý do bảng
  mã trong `INDEX.md` được cắt làm ba khối có tiêu đề riêng, chứ không phải một bảng liền.
- **Đánh số theo thứ tự người đọc gặp.** `ALIGN-0` … `ALIGN-4` là trục chéo, vì đó là câu hỏi mô-đun
  này nhận. `ALIGN-5` đứng ngay sau vì nó là ngoại lệ **của chính tập ấy**: đúng một con đi chệch
  khỏi luật cha vừa tuyên bố. `ALIGN-6` … `ALIGN-9` là trục chính. `ALIGN-10` đứng cuối vì nó chỉ tồn
  tại sau khi vùng chứa đã được gán một chiều đo trục chéo mà nó phải biện minh — tình huống hiếm
  nhất, và thường là dấu hiệu của một chiều cao không kiếm được.
- **Hai mã không phát ra class CSS nào.** `ALIGN-0` (kéo dãn) và `ALIGN-6` (bắt đầu ở mép nội dung) là
  mặc định, và `items-stretch` cùng `justify-start` bị cấm viết vì chúng nói lại đúng điều mặc định
  đã nói. Mã vẫn tồn tại vì một mặc định không được gọi tên là một mặc định không ai chứng minh được
  là đã chọn sai — và kéo dãn là mặc định có hậu quả nặng nhất trong mô-đun, do nó âm thầm đổi kích
  thước những con sở hữu nền, viền hoặc vùng bấm.
- **Lấy đường chân chữ làm ví dụ dẫn đường.** `ALIGN-4` là mã cho thấy rõ nhất vì sao luật này không chọn
  được bằng mắt: một con số và đơn vị của nó chỉ đọc thành **một** giá trị khi hai mẩu chữ khác cỡ
  đứng chung một chân chữ. `items-center` cho chúng chung tâm hộp, mà tâm hộp của hai cỡ chữ không
  trùng chân chữ — nên cụm bị đọc thành hai mẩu tin rời.
- **Nối ranh giới sang luật lề ngoài thay vì giành phần.** Một con **tự đẩy mình** về mép cuối bằng
  khoảng trắng tự động là quyết định của con, thuộc luật lề ngoài, và không đổi mã trục chính của
  vùng chứa. Mô-đun này chỉ nói khi **cả cụm** di chuyển. Phép thử con thứ ba là thứ giữ ranh giới ấy
  trả lời được thay vì phải tranh luận.
- **Trả ba thứ về đúng chủ.** Khoảng cách giữa các con thuộc luật khoảng cách, không phải `justify-*`. Căn
  hình dạng ký tự bên trong một hộp thuộc luật kiểu chữ, không phải `items-*`. Con phải rộng bằng anh em nó
  là quyết định kích thước, không phải `items-stretch`. Cả ba đều có một dòng trong bảng ánh xạ của
  `example.md` để chỉ sang chỗ đúng, vì cách chúng bị dùng sai là cách người viết đi tìm một class CSS
  căn chỉnh cho một câu hỏi không phải căn chỉnh.
- **Để lại cho hàng xóm.** Ai nhường bề rộng khi các con tranh nhau một hàng thuộc luật tràn nội dung;
  khoảng cách giữa các phần tử cùng cấp thuộc luật khoảng cách; phần đệm bên trong một ranh giới thuộc luật khoảng đệm trong;
  việc đẩy một phần tử đơn lẻ thuộc luật lề ngoài; và việc một hàng đổi thành cột ở điểm ngắt nào
  thuộc luật thiết kế đáp ứng. Mô-đun này chỉ nói **cái đã có chỗ rồi thì treo vào đâu**.
- **Viết năm tài liệu, không có `prompt.md`.** Ánh xạ yêu cầu và bảng phân định ranh giới nằm cùng chỗ
  với ví dụ mà chúng phân định.
