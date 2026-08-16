---
id: be-lints-cqrs-changelog
title: changelog.md
slug: /be/lints/cqrs/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của hồ sơ thi hành ba quy tắc lint CQRS.
---

# changelog.md

> Current version: `2.00` · Mô-đun: `cqrs`

## Version Policy

Một thay đổi được chấp nhận về **những gì tài liệu này ghi** thì tăng cả mô-đun thêm `0.01` và cập
nhật **năm** tài liệu cùng lúc. Nguồn công bố thêm hoặc bớt một quy tắc, đổi tên một quy tắc, đổi mức
nghiêm khắc, hoặc đóng một cửa còn mở — mỗi việc đó đều là một thay đổi như vậy.

Đổi số chính (`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc thay đổi nhóm mà nó nằm trên.

**Danh tính của một quy tắc là tên nó công bố**, và tên đó không bao giờ được viết lại trong bất kỳ
tài liệu nào ở đây — kể cả khi nó chứa một từ gắn với sản phẩm. Đó là chuỗi in ra trong nhật ký dựng
và viết trong chú thích tắt quy tắc; một cái tên thứ hai nghĩa là một quy tắc hai tên và không cách
nào biết thông báo đến từ tên nào. Đổi tên một quy tắc trong nguồn là thay đổi phá vỡ tương thích và
phải được ghi ở đây kèm tên cũ.

## 2.00 — 2026-08-16

Mô-đun được **tạo mới** để ghi lại **việc thi hành**, không phải để chép lại luật. Luật CQRS đã có
chỗ của nó; thứ chưa ai viết ra là **máy nhìn thấy được đến đâu, và hết thấy từ chỗ nào**.

- **Ghi ba quy tắc có thật.** Các quy tắc ship trong gói `@starci/eslint-canon-be`, dưới không gian
  tên `starci-be`:

  | Quy tắc | Mã luật | Mức ship |
  |---|---|---|
  | `handler-overrides-process` | `CQRS-3` | `error` |
  | `message-carries-params-only` | `CQRS-2` | `error` |
  | `handler-has-twin-spec` | `CQRS-7` | `off` |

  Cả ba đều ánh xạ được vào một mã luật có thật. Không quy tắc nào phải bịa ánh xạ.

- **Lấy tên công bố làm danh tính.** Không đặt thêm mã số cho quy tắc; tiêu đề mục trong cả ba tài
  liệu nội dung là tên quy tắc, chép nguyên văn.

- **Ghi bốn mã chưa có ai giữ.** `CQRS-1`, `CQRS-4`, `CQRS-5` và `CQRS-6` không có quy tắc nào, và
  không quy tắc nào ở đây nhận vơ chúng. Ba mã sau là phán đoán và nên ở lại với con người; `CQRS-1`
  thì đo được và được ghi trong `audit.md` như một đề xuất, không phải một quy tắc.

- **Thêm bảng Cửa còn mở làm phần bắt buộc.** `INDEX.md` mang hai bảng: **Closed** (cách viết trông
  như lách được mà không lách được, kèm lý do) và **Open** (cách viết quy tắc thật sự không bắt).
  Bảng Open có **16 hàng**, phủ cả ba quy tắc — không quy tắc nào được ghi là kín.

  Ba cửa đắt nhất, tóm lại ở đây vì chúng đổi cách đọc cả mô-đun:

  1. **Trường của lớp là vô hình với mọi phép quét phương thức ở đây.** `execute` viết thành trường
     mũi tên vẫn bỏ khuôn mẫu; `isValid` viết thành trường vẫn là logic trong thông điệp. Không quy
     tắc nào thấy.
  2. **Có lớp cha là thoát nửa quy tắc `CQRS-3`.** Hình dạng lớp xử lý đúng chuẩn luôn kế thừa lớp cơ
     sở, nên hình dạng phổ biến nhất lại là hình dạng phép kiểm thiếu `process` không bao giờ soi.
  3. **Cổng tên tệp là sự tồn tại của quy tắc.** Hai trong ba quy tắc tắt hẳn khi tên tệp không khớp
     `[a-z0-9-]+` trước hậu tố. Không ai đổi tên tệp để né lint; người ta đổi vì thấy gọn hơn.

- **Ghi mức ship thật, không ghi mức mong muốn.** `handler-has-twin-spec` được ghi là `off` và trơ
  khi cấu hình không truyền danh sách thư mục, nên `CQRS-7` hiện **không** được chặn ở cổng dựng trừ
  khi kho mã tự nối danh sách vào.

- **Ghi ba miễn trừ kèm bằng chứng đứng sau chúng**: 10 báo cáo sai trên 3 đúng cho miễn trừ lớp cha,
  19 trên 21 cho miễn trừ decorator trong tệp thông điệp, và lý do tái lập được cho việc quy tắc cặp
  song sinh im lặng khi thiếu danh sách.

- **`example.md` mang code lách qua được, dán nhãn rõ.** Mỗi quy tắc có nhiều cặp **SAI**/**ĐÚNG**
  rồi tới mục **Cửa lách và nhầm lẫn**. Code trong mục đó là code **vi phạm luật mà quy tắc không
  thấy** — không phải code được phép viết.

- **Không có `prompt.md`.** Mô-đun đúng năm tài liệu: `INDEX.md`, `vi.md`, `example.md`, `audit.md`,
  `changelog.md`.
