---
id: fe-layouts-archetypes-subject-and-evidence-audit
title: audit.md
slug: /fe/layouts/archetypes/subject-and-evidence/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định của luật khung danh tính, và trạng thái thiếu nhánh còn sống.
---

# audit.md

> Phiên bản: `1.00` · Mô-đun: `subject-and-evidence`

Phản biện này kiểm xem luật có chọn được đúng một mã từ **chủ thể của trang và tập trạng thái**, và
chỉ từ đó.

## Kết luận

Chấp nhận, kèm một cảnh báo về nền mẫu: archetype này hiện chỉ có **một** thành viên.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| Cột danh tính so với cột đích đến | Loại trừ được: cột này chứa **một chủ thể**, cột kia chứa **nơi để đi** |
| `IDENT-2` so với hành vi hẹp của các archetype khác | Loại trừ được: chỉ ở đây cột **nhảy lên trên** và chỉ ở đây phép đo là container query |
| `IDENT-3` | Loại trừ được khi đã nêu mỗi vùng trả lời câu hỏi nào |
| `IDENT-4` so với `CHROME-5` | Loại trừ được khi đã nêu mỗi mặt có địa chỉ riêng hay không |
| `IDENT-5` | Loại trừ được khi đã liệt kê đủ union trạng thái **trước** khi vẽ |
| `IDENT-6` | Loại trừ được bằng phép thử gộp: gộp lớp nào thì cái gì hỏng |

## Nhận định

- **`IDENT-5` là phần có giá trị nhất của mô-đun**, vì nó là chỗ duy nhất trong shelf mà trạng thái
  **thay cả khung** chứ không thay nội dung. Ba archetype kia chỉ đổi cái bên trong.
- **`IDENT-2` là chỗ duy nhất trong cả shelf dùng container query.** Vì thế nó dễ bị đồng hoá thành
  `md:` khi ai đó chép khuôn từ mô-đun khác sang.
- **`IDENT-3` đến từ một màn hình KHÁC** — global search overlay, ba phán quyết liên tiếp về danh sách
  giữa và panel phải. Đây là luật đúng ở mọi bố cục nhiều vùng, và nó được đặt ở đây vì đây là
  archetype nhiều vùng duy nhất có một chủ thể chung để phân xử. Nội thất overlay vẫn còn nợ, xem
  `Owed` của shelf.
- **`IDENT-6` bốn lớp trông thừa** cho tới khi làm phép thử gộp. Mô-đun giữ phép thử đó chứ không giữ
  lời khẳng định, vì lời khẳng định sẽ thua trong lần dọn dẹp đầu tiên.

## Vi phạm còn sống

| Vi phạm | Bằng chứng | Mức |
|---|---|---|
| `loading` không có nhánh | Union năm state ở `PublicProfileLayout\component.tsx:15`; nhánh tường minh chỉ có ở `:38`, `:54`, `:70`, `:101`. Nửa connected vẫn tính ra `"loading"` ở `index.tsx:43-44` | Trạng thái xảy ra thật và vẽ tab strip + cột + body lên dữ liệu chưa có |
| Thiếu marker `shape: "layout"` | `PublicProfileLayout\component.tsx:123` khai `{ world: "pure", domain: "profile" }` | 3/6 layout sống có marker, 3 không. Không đo được gate nào đọc marker này |
| Ba lớp bọc chỉ để đặt một cặp | `contracts\index.ts:781-810` | Không phải vi phạm — phép thử gộp cho thấy mỗi lớp cần thiết. Ghi lại vì nó **trông** như vi phạm và sẽ bị đề xuất dọn |

## Quyết định

- Giữ sáu mã.
- Ma trận trạng thái là một phần của luật layout, không đẩy xuống tầng block.
- `IDENT-2` viết rõ **vì sao** container query, không chỉ viết là container query.
- `IDENT-6` giữ ở dạng phép thử gộp.
- Ghi thẳng rằng `IDENT-3` mượn neo từ một màn hình khác, thay vì để người đọc tưởng nó đo trên hồ sơ.

## Rủi ro còn mở

- **Một thành viên duy nhất.** Mọi câu trong mô-đun viết về một CON NGƯỜI. Thành viên thứ hai có chủ
  thể không phải người sẽ cho biết "danh tính" là trừu tượng đúng hay chỉ là instance duy nhất.
- **`IDENT-5` liệt kê đúng năm trạng thái vì repo sống khai năm.** Một trạng thái thứ sáu — ví dụ
  "đã chặn" — sẽ đổi nghĩa của "đủ".
- **Chưa xác minh `@app-md` resolve ra giá trị nào tại runtime.** Mọi câu về gập đọc từ chuỗi class.
- **Vùng `main` khai `host: "section"` trong ví dụ.** Chưa đo host thật của nó trong registry; nếu nó
  là `main` thì trang này cũng nằm trong bài toán `<main>` lồng nhau của cụm `/profile`.

## Điều kiện phản biện lại

- Archetype có thành viên thứ hai.
- Union trạng thái đổi.
- `loading` được cấp nhánh riêng.
- Có người đề xuất gộp bốn lớp bọc.
- Đo được host thật của vùng bằng chứng và của cụm `/profile`.
