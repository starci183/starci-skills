---
id: be-patterns-authorization-changelog
title: changelog.md
slug: /be/patterns/authorization/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật Authorization.
---

# changelog.md

> Current version: `2.00` · Module: `authorization`

## Version Policy

Một thay đổi luật được chấp nhận thì tăng cả module thêm `0.01` và cập nhật **năm** record. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc module hoặc shelf mà nó nằm trên.

Thêm, bớt hoặc đánh lại số một mã `AUTHZ-<n>` là **thay đổi lớn**, không phải một lần tăng nhỏ. Số mã
được trích dẫn từ các luật anh em và từ task record cũ, nên đánh lại số là làm hỏng một trích dẫn ai
đó đã viết.

## 2.00 — 2026-08-16

Đổi số chính vì hình dạng của luật đổi, không phải vì nội dung luật đổi.

- **Chuyển từ một file phẳng sang module năm record.** `be/canon/patterns/authorization.md` được
  diễn đạt lại thành `be/patterns/authorization/` với `INDEX.md`, `vi.md`, `example.md`, `audit.md`,
  `changelog.md`. Không mã nào bị thêm, bớt hay đổi nghĩa; mọi quyết định của bản phẳng được giữ
  nguyên. File phẳng không bị xoá trong lần này.
- **Giữ nguyên sáu mã.** `AUTHZ-1` (handler tự sở hữu điều kiện tiên quyết), `AUTHZ-2` (cửa đọc danh
  tính thì mang guard), `AUTHZ-3` (sở hữu quyết định trên dòng đã load), `AUTHZ-4` (từ chối làm lộ sự
  tồn tại thì trả not-found), `AUTHZ-5` (entitlement là trạng thái, không phải dòng), `AUTHZ-6`
  (operator là chủ thể khác với người dùng). Số và nghĩa không đổi.
- **Thêm bảng `Tầng giữ`.** Mỗi mã nói rõ tầng nào đang thật sự giữ nó: `unrepresentable`, `enforced`
  hay `documented`. Kết quả: **một `enforced`, năm `documented`, không có `unrepresentable`**. Mã
  `enforced` duy nhất là `AUTHZ-2`, giữ bởi rule `identity-needs-guard` (export `identityNeedsGuard`)
  trong `sources/be/authorization.mjs`.

  Bảng này tồn tại để khoảng cách 1/6 **đọc được** thay vì phải suy ra. Bản phẳng đã nói đúng điều
  này bằng văn xuôi ("nửa máy kiểm được là `AUTHZ-2` và chỉ `AUTHZ-2`"); bảng chỉ làm cho nó không
  trượt khỏi mắt người đọc vội.
- **Thêm bảng `Anchor`.** Mỗi mã chỉ vào code thật kèm điều cần tìm ở đó, vì một luật không chỉ được
  vào code thật là một đề xuất chứ không phải một luật. **Cả sáu mã đều neo được; không mã nào ghi
  `chưa neo được`.** Đáng chú ý là `AUTHZ-5` neo vào một **cặp** guard trên cùng một quan hệ — một
  guard tạo dòng dùng thử và luôn cho qua, một guard đọc cột đã trả tiền — vì cặp đó chứng minh dòng
  và trạng thái là hai sự thật khác nhau rõ hơn bất kỳ câu văn nào.
- **Viết lại `vi.md` theo từng mã.** Mỗi mã có tình huống nghiệp vụ, dấu hiệu nhận biết, câu tự hỏi,
  ranh giới với các mã kề, và danh sách tình huống hay gặp.
- **Viết lại `example.md` cho đủ case.** Mỗi mã nhiều case, ĐÚNG và SAI đặt cạnh nhau, kèm mục "Ngoại
  lệ và nhầm lẫn". Thêm bảng ánh xạ yêu cầu bằng lời sang mã, bảng câu hỏi phân định ranh giới, và
  danh sách sai lầm lặp lại.
- **Rút mọi ví dụ về TypeScript NestJS tổng quát.** Bản phẳng minh hoạ bằng tên module riêng và tên
  entity của một sản phẩm cụ thể; các tên đó được tổng quát hoá. Tên decorator đọc danh tính giữ
  nguyên vì nó là danh tính thi hành của lint rule. Chỉ bảng `Anchor` mang đường dẫn thật.
- **Nâng luật thành bắt buộc một cách tường minh.** Bổ sung tuyên bố rằng mọi cửa đọc danh tính và mọi
  handler với tới một bản ghi đều rơi vào đúng một mã, và không có operation nào nhỏ tới mức được
  miễn.
- **Ghi rủi ro thay vì im lặng sửa.** `audit.md` nêu lại từng mã `documented` kèm điều một rule sẽ
  phải nhìn thấy để giữ được nó — hoặc lý do không rule nào giữ được — cùng hai rủi ro không thuộc mã
  nào: danh sách tên decorator cứng trong rule `AUTHZ-2`, và việc `AUTHZ-4` gánh hai lỗi ngược chiều
  trong một mã.
- **Không có `prompt.md`.** Module đúng năm record.

## Các phiên bản trước

Bản phẳng `be/canon/patterns/authorization.md` dựng định nghĩa authentication-vs-authorization, sáu
luật `AUTHZ-1`…`AUTHZ-6`, bảng Forbidden và bốn ví dụ đối chiếu. Rule `identity-needs-guard` được
viết cùng thời điểm ấy, kèm ghi chú nói rõ vì sao `AUTHZ-1`, `AUTHZ-3`, `AUTHZ-4` và `AUTHZ-5` được
đo rồi cố ý để yên. Mọi quyết định đó đi nguyên vẹn vào `2.00`.
