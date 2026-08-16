---
id: be-patterns-e2e-flow-changelog
title: changelog.md
slug: /be/patterns/e2e-flow/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật e2e flow.
---

# changelog.md

> Current version: `2.00` · Module: `e2e-flow`

## Version Policy

Một thay đổi luật được chấp nhận thì tăng cả module thêm `0.01` và cập nhật **năm** record. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc module hoặc shelf mà nó nằm trên.

**Mã `E2E-<n>` không bao giờ được đánh số lại.** Chúng được trích dẫn từ các file luật khác và từ các
task record cũ; đổi số một mã là làm hỏng lặng lẽ một trích dẫn đã có người viết ra. Bỏ một mã cũng
vậy. Cả hai đều là thay đổi cấu trúc và ăn vào số chính.

## 2.00 — 2026-08-16

Đổi số chính vì hình dạng của luật đổi, trong khi **nội dung luật giữ nguyên**.

- **Từ một file phẳng thành module năm record.** `be/canon/patterns/e2e-flow.md` được diễn đạt lại
  thành `be/patterns/e2e-flow/` với `INDEX.md`, `vi.md`, `example.md`, `audit.md`, `changelog.md`.
  File luật phẳng không bị xoá và không bị sửa: module này là một cách **diễn đạt đầy đủ hơn** cùng
  một luật, không phải một luật mới.
- **Giữ nguyên mười hai mã.** `E2E-1` … `E2E-12`, đúng số và đúng nghĩa của luật phẳng. Không mã nào
  được thêm, bớt, gộp hay đánh số lại. Mọi bất đồng với một quyết định cũ đi vào mục "Rủi ro còn mở"
  của `audit.md`, không đi vào một lần sửa im lặng.
- **Thêm bảng `Tầng giữ`.** Mỗi mã ghi rõ tầng thật sự đang giữ nó: `enforced` (có rule, và rule được
  **gọi tên**), `documented` (chỉ người đọc), `unrepresentable` (kiểu đóng — không mã nào ở đây, và
  `INDEX.md` nói rõ vì sao không thể). Kết quả đo được: **5 `enforced`, 7 `documented`, 0
  `unrepresentable`**. Ba trong năm mã `enforced` chỉ được giữ **một nửa**, và nửa không được giữ
  được ghi ra ngay trên dòng đó.
- **Thêm bảng `Anchor`.** Mỗi mã trỏ vào code thật kiểm chứng được: một đường dẫn, và **thứ cần tìm**
  ở đó. Mười hai mã, mười hai neo; không mã nào phải ghi `chưa neo được`. Luật không neo được vào
  code thật là một đề xuất, không phải một luật.
- **Viết lại `vi.md` theo từng mã.** Mỗi mã có tình huống nghiệp vụ, dấu hiệu nhận biết, câu tự hỏi,
  ranh giới với các mã kề, và danh sách tình huống nghiệp vụ hay gặp. Bảng tra nhanh mang thêm cột
  tầng giữ, để người đọc biết mã nào có máy canh và mã nào chỉ có mình họ.
- **Viết lại `example.md` cho đủ case.** Mỗi mã nhiều case, mỗi case đặt **ĐÚNG** cạnh **SAI**, kèm
  mục "Ngoại lệ và nhầm lẫn". Thêm một ví dụ **qua rule mà vẫn sai luật** cho `E2E-4`, để không ai
  tưởng rule là đủ. Cuối trang có ánh xạ yêu cầu, bảng phân định ranh giới và danh sách sai lầm lặp
  lại.
- **Tổng quát hoá mọi ví dụ.** Luật phẳng gọi tên một service nội bộ và một số cổng thanh toán cụ
  thể; module này gọi bằng **vai trò** — "bộ chọn nhà cung cấp", "client ngoài của cổng thanh toán" —
  vì vai trò chuyển được sang hệ thống khác còn tên thì không. Không tên sản phẩm, không tên
  repository, không tên module riêng.
- **Không có `prompt.md`.** Ánh xạ từ một yêu cầu bằng lời sang một quyết định nằm cùng chỗ với các
  ví dụ mà nó phân định. Module đúng **năm** record.
- **Ghi nhận drift trích dẫn thay vì sửa lén.** Hai file hạ tầng trong code thật còn dẫn tiền tố cũ
  `FLOW-` với **đúng số** của `E2E-`. Việc này được ghi ở `audit.md` như một finding, không được xử
  lý bằng cách đổi luật.

## Các phiên bản trước

`e2e-flow.md` phẳng dựng mười hai rule, bảng `Forbidden` với mười dòng, và ba ví dụ đối chiếu (bẫy
sleep, bẫy fan-out, bước phủ định). Nó cũng là nơi con số "năm trên mười hai" lần đầu được tuyên bố
là **con số trung thực chứ không phải một khoảng trống** — tuyên bố đó được mang nguyên sang `2.00`.
