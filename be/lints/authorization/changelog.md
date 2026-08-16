---
id: be-lints-authorization-changelog
title: changelog.md
slug: /be/lints/authorization/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của tài liệu thi hành luật authorization.
---

# changelog.md

> Current version: `2.00` · Mô-đun: `authorization`

## Version Policy

Một thay đổi được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu:
`INDEX.md`, `vi.md`, `example.md`, `audit.md` và tệp này. Đổi số chính (`x.00`) dành cho thay đổi cấu
trúc mô-đun hoặc nhóm mà nó nằm trên.

Thứ khiến mô-đun này phải tăng phiên bản là thay đổi ở **nguồn**, không phải ở văn phong: thêm hoặc
bớt một quy tắc trong `sources/be/authorization.mjs`, đổi tập decorator danh tính, đổi chuỗi nhận diện
cổng, đổi mức độ khuyến nghị, hoặc phát hiện một cửa còn mở chưa được ghi. Sửa chính tả thì không.

## 2.00 — 2026-08-16

Dựng mới mô-đun. Nhóm `lints/` ghi **việc thi hành**, không ghi luật: máy nhìn thấy được cái gì, và —
phần không ai chịu viết ra — máy **không** nhìn thấy cái gì.

- **Phủ đúng một quy tắc.** `identity-needs-guard`, giữ `AUTHZ-2`, ship trong gói
  `@starci/eslint-canon-be` ở mức khuyến nghị `error` dưới tên đầy đủ
  `starci-be/identity-needs-guard`. Nguồn công bố đúng một quy tắc và tài liệu ghi đúng một quy tắc;
  con số khớp với dự kiến.
- **Ghi năm mã còn lại là không có máy giữ.** `AUTHZ-1`, `AUTHZ-3`, `AUTHZ-4`, `AUTHZ-5` và `AUTHZ-6`
  không được gán cho quy tắc gần nhất. `AUTHZ-1` được ghi rõ là **cố tình** không giữ, khác hẳn với
  "chưa giữ".
- **Định danh của quy tắc là tên công bố.** Không đúc mã số riêng cho quy tắc; tiêu đề mục chính là
  tên quy tắc, nguyên văn.
- **Tách bảng `Detection` khỏi bảng `Escape Hatches`.** Cửa lách suy ra trực tiếp từ cơ chế, nên cơ
  chế phải được viết bằng loại nút cú pháp và chuỗi ký tự cụ thể, không bằng ý định.
- **Ghi mười một cửa đóng và mười một cửa còn mở.** Trong đó có ba cửa hở nặng nhất: danh tính đọc qua
  ngữ cảnh thay vì qua decorator, decorator viết dạng có không gian tên hoặc đổi tên lúc nhập khẩu, và
  `UseGuards` được tính bằng **sự có mặt** chứ không bằng tác dụng.
- **Ghi thêm bốn hình dạng quy tắc nổ vào code đúng**, đo được: cổng có không gian tên, decorator gộp,
  cổng ở lớp cơ sở, và lớp không phải cửa. Báo nhầm được xử như lỗ hổng ngang hàng với bỏ lọt, vì nó
  sinh ra dòng `eslint-disable` che mất trường hợp thật tiếp theo.
- **Đo thay vì suy.** Mọi khẳng định hành vi trong bốn tài liệu kia đều được đo bằng cách chạy quy tắc
  qua trình kiểm với bộ phân tích cú pháp mà gói đang dùng.
- **Ghi một khiếm khuyết trong nguồn.** Nhánh dự phòng cho `TSParameterProperty` không bao giờ chạy —
  mọi nút tham số đều có sẵn khoá `decorators` là mảng, và mảng rỗng là giá trị đúng. Hiện vô hại;
  nguy hiểm nếu bộ phân tích chuyển chỗ đặt decorator. Chi tiết và cách sửa nằm ở `audit.md`.
- **Không có `prompt.md`.** Ánh xạ yêu cầu và bảng phân định ranh giới nằm chung với ví dụ mà chúng
  phân định. Mô-đun có đúng năm tài liệu.
- **Không tên sản phẩm trong văn xuôi và ví dụ.** Ngoại lệ duy nhất là các định danh **ship thật**:
  tên quy tắc, tên gói, không gian tên trình cắm, và bốn chuỗi mà quy tắc so khớp từng ký tự —
  `KeycloakGraphQLUser`, `KeycloakUser`, `CurrentUser`, `UseGuards`. Đổi cách viết chúng trong tài
  liệu là mô tả sai cái máy.
