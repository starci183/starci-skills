---
id: be-patterns-naming-changelog
title: changelog.md
slug: /be/patterns/naming/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật naming.
---

# changelog.md

> Current version: `2.00` · Module: `naming`

## Version Policy

Một thay đổi luật được chấp nhận thì tăng cả module thêm `0.01` và cập nhật **năm** record. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc module hoặc shelf mà nó nằm trên. Thêm, bỏ hoặc đánh số lại
một mã `NAME-<n>` là **thay đổi lớn**, không phải một lần tăng `0.01`: số mã được trích dẫn từ luật
anh em và từ task record cũ, nên đánh số lại là làm gãy lặng lẽ một trích dẫn ai đó đã viết ra.

## 2.00 — 2026-08-16

Đổi số chính vì hình dạng của luật đổi: từ **một file phẳng** thành **module năm record**.

- **Chuyển shelf.** `be/canon/patterns/naming.md` → `be/patterns/naming/`. File phẳng cũ không bị
  xoá và không bị sửa; module này **diễn đạt lại** nó đầy đủ hơn, không thay nó bằng một luật khác.
- **Giữ nguyên bảy mã.** `NAME-1` … `NAME-7` giữ đúng số và đúng nghĩa của bản phẳng. Không mã nào
  được thêm, bỏ hay đánh số lại. Mọi bất đồng về hình dạng mã được ghi ở `audit.md` §"Rủi ro còn mở"
  thay vì sửa lặng lẽ — đáng kể nhất là việc `NAME-1` gánh hai nghĩa vụ (path mang vai trò; hậu tố
  khớp vai trò export) nên một trích dẫn `NAME-1` không nói được nửa nào đã hỏng.
- **Thêm bảng `Tầng giữ`.** Mỗi mã ghi rõ nó được giữ ở tầng nào: `unrepresentable`, `enforced` hay
  `documented`. Kết quả **hai enforced, năm documented, không có unrepresentable** —
  `NAME-2` → `no-version-in-name`, `NAME-5` → `no-bare-verb-export`, còn lại chỉ có người đọc giữ.
  Cột `unrepresentable` rỗng vì lý do cấu trúc: identifier không phải giá trị, nên không union đóng
  nào làm cho một cái tên sai trở nên không viết được.
- **Nói rõ hai rule hẹp hơn luật.** `no-version-in-name` không thăm biến và property, nên
  `const isV2Task = …` lọt; `no-bare-verb-export` giữ một danh sách đóng mười tám động từ, nên
  `export const judge` lọt. Bảng ghi `enforced` theo nghĩa "rule tồn tại và bắt được", còn phần thiếu
  được nêu ngay dưới bảng và nêu lại trong `audit.md`.
- **Thêm bảng `Anchor`.** Mỗi mã trỏ vào mã nguồn thật kèm câu "nhìn cái gì ở đó". Cả bảy mã đều neo
  được; không mã nào phải ghi `chưa neo được`. Ở những chỗ có, module neo **cả hai phía**: một anchor
  đúng luật và một vi phạm còn sống — `ProjectEvaluationV2PromptInput` cho `NAME-2`, `checkEnrollment`
  cho `NAME-6` — vì một luật chỉ neo vào ví dụ đẹp là một luật chưa bị thử.
- **Viết lại `vi.md` theo từng mã.** Mỗi mã có tình huống nghiệp vụ, dấu hiệu nhận biết, câu tự hỏi,
  ranh giới với mã kề, và danh sách tình huống hay gặp — thay cho bảy đoạn văn nối nhau của bản
  phẳng.
- **Viết lại `example.md` cho đủ case.** Mỗi mã nhiều case, mỗi case đặt ĐÚNG và SAI cạnh nhau và chỉ
  khác nhau đúng một thứ, kèm mục "ngoại lệ và nhầm lẫn". Bốn ví dụ của bản phẳng được giữ lại nguyên
  ý và mở rộng thành hơn bốn mươi khối mã.
- **Tách ngoại lệ thành một mục đóng.** Năm ngoại lệ, mỗi ngoại lệ nêu rõ mã nó áp vào: cơ chế chính
  là chủ thể, phiên bản chính là giá trị, thư mục chính là chủ thể, động từ trần trong phạm vi file,
  bề mặt chính là miền nghiệp vụ. Bản phẳng có ngoại lệ nằm rải trong văn xuôi.
- **Giữ nguyên quyết định lịch sử 616/4430.** Rule thứ ba từng đòi tên file đánh vần trọn tên class
  và đo được 616 vi phạm trên 4430 file; mười bốn phần trăm một cây mã là **quy ước**, không phải nợ,
  nên rule bị xoá và luật ghi cái mã nguồn làm. Quyết định này được chép sang nguyên vẹn và là lý do
  `NAME-1` không có lint ở nửa "path mang vai trò".
- **Rút mọi ví dụ về TypeScript/NestJS tổng quát.** Không tên sản phẩm, không tên repository, không
  tên khoá học; chỗ bản phẳng gọi tên một module riêng thì được tổng quát hoá. Đường dẫn repository
  chỉ còn xuất hiện trong bảng `Anchor`, vì anchor bắt buộc phải là đường dẫn thật — đó chính là thứ
  làm nó thành anchor.
- **Không có `prompt.md`.** Ánh xạ từ yêu cầu bằng lời sang một cái tên và bảng phân định ranh giới
  nằm cùng chỗ với ví dụ mà chúng phân định. Module có đúng năm record.

## Trước 2.00

Luật sống dưới dạng một file phẳng `be/canon/patterns/naming.md`: một mục `Definition`, bảy mã trong
mục `Rules`, một bảng `Forbidden` và bốn ví dụ. File đó vẫn còn nguyên tại chỗ; module này là bản
diễn đạt lại đầy đủ của nó, không phải bản thay thế.
