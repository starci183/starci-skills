---
id: be-lints-naming-changelog
title: changelog.md
slug: /be/lints/naming/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của mô-đun cưỡng chế luật đặt tên.
---

# changelog.md

> Current version: `2.00` · Mô-đun: `naming`

## Version Policy

Một thay đổi được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Đổi số chính
(`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc kệ mà nó nằm trên.

Ba loại sự kiện bắt buộc phải tăng phiên bản ở đây, kể cả khi lời văn của luật không đổi:

1. Một quy tắc được **thêm, xoá hoặc đổi tên** trong nguồn. Tên quy tắc là danh tính của nó, nên đổi
   tên là đổi mọi thứ mà người đọc dùng để nói về nó.
2. **Mức nghiêm trọng khi xuất xưởng đổi.** Mức là khác biệt giữa một báo cáo và một cổng chặn.
3. Một **cửa còn mở** được đóng lại, hoặc một cửa mới bị phát hiện. Danh sách cửa mở là nội dung chính
   của mô-đun này, không phải phần phụ lục.

Sửa lỗi chính tả và sắp xếp lại câu chữ không tăng phiên bản.

## 2.00 — 2026-08-16

Mô-đun được **tạo mới** để ghi lại phần **cưỡng chế** của luật đặt tên. Luật nằm ở kệ `patterns`; kệ
này không nhắc lại luật, nó ghi lại máy nhìn thấy gì, nhìn bằng cơ chế nào, và cách viết nào đi lọt.

- **Ghi lại đúng hai quy tắc**, cả hai xuất xưởng trong gói `@starci/eslint-canon-be`:
  `no-version-in-name` (giữ `NAME-2`) và `no-bare-verb-export` (giữ `NAME-5`). Đếm trong nguồn ra
  đúng hai, khớp với con số dự kiến. Không quy tắc nào khác được ghi vào bảng.
- **Tên quy tắc là danh tính.** Không đặt mã số riêng cho quy tắc. Mọi tiêu đề mục là tên quy tắc,
  chép nguyên văn, vì đó là chuỗi in ra trong log build và trong dòng tắt cảnh báo.
- **Ghi rõ năm điều luật không có quy tắc**: `NAME-1`, `NAME-3`, `NAME-4`, `NAME-6`, `NAME-7`. Hai
  trên bảy điều luật được máy giữ là tỷ lệ thấp nhất kệ, và là con số **đúng** — nguồn từ chối làm giả
  phần còn lại, vì chúng đòi biết thứ đó thực sự là gì.
- **Ghi lại quy tắc thứ ba đã bị xoá.** Một bản đòi tên tệp đánh vần cả tên lớp, đo được 616 vi phạm
  trên 4430 tệp, và bị xoá vì quy ước thực tế ngược lại: đường dẫn mang vai trò và phạm vi, tệp gọi
  tên chủ thể. Phần xoá được ghi vì nó là bằng chứng duy nhất trên kệ rằng một quy tắc **chạy được**
  vẫn bị từ chối khi phép đo nói nó đang cãi lại mã nguồn.
- **Ghi mức `warn` lên câu đầu tiên của bảng quy tắc.** Không quy tắc nào ở mô-đun này chặn được một
  commit. Ở mọi mô-đun khác trên kệ, "cổng xanh" gần nghĩa với "không có phát hiện"; ở đây thì không,
  và câu đó phải đứng ở chỗ đọc thấy đầu tiên.
- **Bảng cửa còn mở có 22 dòng**, đối lại 10 dòng cửa đã đóng. Phân bố: 11 dòng cho
  `no-version-in-name`, 10 dòng cho `no-bare-verb-export`, và một dòng chung về việc không quy tắc
  nào đọc tên tệp. `audit.md` thu gọn chúng thành **14 rủi ro** có tên, mỗi rủi ro kèm câu trả lời
  cho "quy tắc phải nhìn thêm cái gì để đóng", và ba trong số đó được đánh giá là **đáng đóng ngay**:
  thăm `VariableDeclarator`, đọc `node.specifiers` khi không có `declaration`, và thăm
  `ExportDefaultDeclaration`.
- **Nêu tên một ứng viên quy tắc thứ ba** trong `audit.md` mà không ghi nó vào bảng: hậu tố tệp phải
  khớp vai trò của thứ nó export (`*.service.ts` → `*Service`). Đây là nửa còn cưỡng chế được của
  `NAME-1`, và nó vẫn chỉ là **đề xuất** cho tới khi có người đo trên một cây thật. Một quy tắc không
  chỉ tay vào được thì không được vào bảng.
- **Nêu hai phát hiện dễ đọc nhầm.** `NAME-6` trông như đã có người giữ và thật ra không: từ `check`
  bị bắt tình cờ dưới `NAME-5` vì nó là động từ trơ, còn `checkVerified` — đúng hình dạng mà `NAME-6`
  cấm — không bị gì. Và nhánh `_V[0-9]+` của biểu thức chính quy gần như không bao giờ chạy được, vì
  không visitor nào chạm tới một hằng số viết hoa.
- **Năm tài liệu, không có `prompt.md`.** Phần ánh xạ yêu cầu và bảng phân định ranh giới nằm trong
  `example.md`, cùng chỗ với ví dụ mà chúng phân định.
- **Lời văn và ví dụ không mang tên sản phẩm.** Ngoại lệ duy nhất là định danh đã xuất xưởng: tên quy
  tắc và tên gói. Một cái tên in ra trong log build thì phải chép đúng chữ, kể cả khi nó chứa tên sản
  phẩm — chép sai một định danh là tạo ra một quy tắc hai tên, tức là một quy tắc không truy nguyên
  được.
