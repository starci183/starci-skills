---
id: be-patterns-testing-changelog
title: changelog.md
slug: /be/patterns/testing/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật Testing.
---

# changelog.md

> Current version: `2.00` · Module: `testing`

## Version Policy

Một thay đổi luật được chấp nhận thì tăng cả module thêm `0.01` và cập nhật **năm** record. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc module hoặc shelf mà nó nằm trên.

Thêm, bớt hoặc đánh số lại một mã `TESTING-<n>` **luôn** là thay đổi số chính, kể cả khi nội dung
luật không đổi. Số của một mã là thứ được trích dẫn từ nơi khác; đổi nó là làm hỏng một citation đã
có người viết ra, và một thay đổi làm hỏng citation không được phép trông như một lần tăng nhỏ.

## 2.00 — 2026-08-16

Đổi số chính vì hai thứ đổi cùng lúc: hình dạng module và shelf.

- **Chuyển từ một file luật phẳng sang module năm record.** `be/canon/patterns/testing.md` là nguồn
  gốc và vẫn nằm nguyên chỗ cũ; module này **diễn đạt lại** nó đầy đủ hơn chứ không thay thế nó.
  Không quyết định nào của luật phẳng bị bỏ, và không quyết định nào bị sửa trong im lặng — chỗ nào
  audit không đồng ý thì viết vào "Rủi ro còn mở".
- **Giữ nguyên mười một mã.** `TESTING-1` … `TESTING-11`, nguyên số và nguyên nghĩa. Luật phẳng đã
  đánh số chúng; module này không đánh số lại một mã nào, và không thêm mã thứ mười hai.
- **Thêm bảng `Tầng giữ`.** Mỗi mã khai đúng một tầng: `unrepresentable`, `enforced` hay
  `documented`. Kết quả thật là **5 enforced, 6 documented, 0 unrepresentable**, và con số đó được
  viết ra thay vì được làm mờ đi. Năm mã enforced nêu đích danh rule giữ chúng:
  `e2e-asserts-persisted-state` (`TESTING-2`), `e2e-uses-production-transport` (`TESTING-3`),
  `no-call-only-spec` (`TESTING-6`), `no-model-call-in-e2e` (`TESTING-9`),
  `harness-calls-provider-directly` (`TESTING-10`). Không mã nào được gắn nhãn `enforced` mà không
  tìm ra được rule.
- **Thêm bảng `Anchor`.** Mỗi mã trỏ vào code thật cùng với thứ cần tìm ở đó: file e2e mang tên câu
  chuyện và file mang tên nhóm resolver, các helper dựng thế giới và chờ trạng thái, ba config phân
  lane bằng hậu tố, hai script seed, và stub provider mặc định. Cả mười một mã đều neo được; không mã
  nào phải ghi `chưa neo được`. Đây là điều kiện để một mã còn là luật thay vì thành một đề xuất.
- **Viết lại `vi.md` theo từng mã.** Mỗi mã có tình huống nghiệp vụ, dấu hiệu nhận biết, câu tự hỏi,
  ranh giới với các mã kề, và danh sách tình huống nghiệp vụ hay gặp.
- **Viết lại `example.md` cho đủ case.** Mỗi mã nhiều case, mỗi case đặt ĐÚNG cạnh SAI với đúng một
  điểm khác biệt được nêu tên, cộng mục "ngoại lệ và nhầm lẫn". Thêm phần ánh xạ yêu cầu sang lane và
  mã, bảng phân định ranh giới, và danh sách sai lầm lặp lại.
- **Tổng quát hoá mọi ví dụ.** Bỏ tên sản phẩm, tên repository và tên khoá học; nghiệp vụ nền chuyển
  sang những thứ mọi back-end đều có — đơn hàng, quyền truy cập, ví, hạn mức, bài nộp được chấm. Chỉ
  giữ nguyên những symbol mà rule **thật sự khớp theo tên**, vì đổi chúng sẽ dạy sai điều rule làm.
- **Ghi nhận hai finding thay vì sửa luật.** Hai file e2e đang mang đúng hình dạng mà `TESTING-1` từ
  chối, và cờ "qua khi rỗng" đang có mặt trên hai script test. Cả hai đi vào `audit.md`; luật không
  đổi vì thực tế lệch khỏi luật.
- **Không có `prompt.md`.** Ánh xạ yêu cầu nằm cùng chỗ với ví dụ mà nó phân định. Module có đúng năm
  record.

## Trước 2.00

Luật sống dưới dạng một file phẳng `be/canon/patterns/testing.md`, với mười một mã trong mục `Rules`,
một bảng `Forbidden` và một mục `Examples` chia theo bẫy. Phần máy kiểm được đã tách sang
`sources/be/testing.mjs` và burn down về `error` cho cả năm rule trước lần chuyển này. File đó vẫn là
nguồn gốc của mọi câu trong module này.
