---
id: fe-patterns-proofs-index
title: Bằng chứng gate patterns
slug: /fe/patterns/proofs
sidebar_label: INDEX
description: Bảng điểm ba trang cho gate patterns — split và cây file trúng cao, chỗ hỏng nằm ở những file mà lược đồ không có ô để khai.
---

# Bằng chứng gate patterns

> Ngày: 2026-08-16 · Ba trang founder tự tin · Chuỗi: layouts → blocks → principles → patterns → lints

## Bảng điểm

| Trang | Điểm | TRÚNG | KHÁC MÀ ĐƯỢC | LỆCH | THIẾU | Không đo được |
|---|---|---|---|---|---|---|
| [dashboard](./dashboard.md) | **14.5/22 · 66%** | 14 | 1 | 3 | 4 | 0 |
| [courses](./courses.md) | **6.5/13 mục đo được · 50%** | 6 | 1 | 3 | 3 | 5 |
| [course-details](./course-details.md) | **12/20 · 60%** | 11 | 2 | 5 | 2 | 0 |
| **Trung bình** | **59%** | | | | | |

Đây là gate ổn định nhất trong bốn gate trước lints: ba trang nằm trong dải hẹp 50–66%, và cái nó làm đúng thì làm đúng ở cả ba trang.

**Trúng đều ở cả ba trang.** Split hai nửa với `_X` cho nửa vẽ · nửa nối không vẽ gì ngoài twin · một file mỗi thư mục khi khối không đọc gì · hai file mỗi thư mục surface, không thư mục helper · một hook một file dưới `hooks/swr` · props là `type` alias mọi field `readonly` · state gửi xuống là một TÊN chứ không phải túi cờ · không component skeleton song sinh · không nhận `children` · mọi export là arrow · chữ giải ở nửa nối.

**Hỏng đều ở cả ba trang.** Không trang nào liệt kê `layout.tsx` của route family, dù cả ba đều khai `mainLandmarkOwner`. Tên handler dùng tiền tố `on` trong khi bảng thật dùng động từ trần trong object `on`. Và mọi trang đều phải tự chế field ngoài lược đồ để giao được mã.

## Gate còn thiếu luật gì

| # | Câu luật lẽ ra đã ngăn được | Trang |
|---|---|---|
| 1 | **`SourcePlan` phải có ô cho VĂN BẢN mã.** Lược đồ `additionalProperties:false` không có `tsx`, `propTypes`, `metaByFile` hay `sourceSketch`; cả ba trang phải tự chế field, và hậu quả trực tiếp là gate lints chỉ lint được 8/60, 14/29 và một phần file. | 3/3 |
| 2 | **Quy ước tên handler phải chốt một lần.** Bảng thật dùng `on.resume`, `on.claim`, `on.act`; kế hoạch dùng `onCommit`, `onSelect`. Rule `handler-on-prefix` chỉ cấm `handleX` nên cả hai cách đều xanh mãi mãi. | 3/3 |
| 3 | **Enum `role` của `SourceFile` phải có ô cho kho copy theo locale, cho test chung, và cho `layout.tsx` của route family.** Ba loại file bắt buộc hiện không khai được. | 3/3 |
| 4 | **Mọi định danh được import hoặc gọi phải trỏ về một file trong `files`, và gate patterns phải chạy phép đối chiếu đó trước khi giao.** | 2/3 (courses: 1 hook treo; course-details: 6 định danh treo + `useRouter` không được tạo) |
| 5 | **Nếu một file được liệt kê thì nó phải có mã; nếu chưa có thì nó nằm trong danh sách "còn nợ mã" tách riêng.** courses: 15/29 file chỉ có đường dẫn → 11 rule của gate lints rơi vào "không áp dụng" chỉ vì thân file không tồn tại. | 2/3 |
| 6 | **Hình dạng `meta` phải là MỘT, chốt trong canon, và một gate phải đọc nó.** Repo sống có ba lược đồ meta; kế hoạch thêm lược đồ thứ tư; không rule nào đọc meta nên mọi lời khai đều xanh. | 3/3 |
| 7 | **Tham số định tuyến phải lấy từ hợp đồng backend.** `slug` vs `displayId` là hai khoá khác nhau và server trả `COURSE_NOT_FOUND_EXCEPTION` cho cái sai. | 1/3 |
| 8 | **Nếu một trang có nhiều hơn một kiểu mô hình state, gate phải nói ra tiêu chí chọn.** Bảng thật của dashboard có bốn khối dùng string union phẳng và ba khối dùng union phân biệt trên cùng một màn. | 1/3 |
| 9 | **Một branch được dùng thì phải được đặt tầng và khai chữ ký, kể cả khi nó đã tồn tại.** `ScrollViewport` giữ trần chiều cao, bo góc và nền của cả cột chào giá mà không ai biết nó ở tầng nào. | 1/3 |

## Gate im lặng ở đâu

Ba câu hỏi dưới đây được cả ba gate lints nêu lại gần như nguyên văn, và cả ba đều thuộc ranh giới patterns:

1. **"`SourcePlan` không có ô nào cho VĂN BẢN mã. Tôi cần biết gate lints được cho là lint cái gì nếu đầu vào hợp lệ chỉ có danh sách đường dẫn."** — 3/3 trang.
2. **"Gate muốn `output.source` là mã NHẬN VÀO hay mã ĐÃ SỬA? Lược đồ im lặng, vì nó vừa mô tả source là 'nguyên mã đến từ gate patterns' vừa nói 'sau gate này là code'."** — 3/3 trang.
3. **"Ô `at` bắt buộc file:dòng thật trong repo sống, nhưng mã này chưa được ghi vào repo sống và tôi bị cấm đọc repo đó."** — 3/3 trang.

Cộng một câu chỉ dashboard nêu, nhưng đúng với cả ba:

> "Nửa vẽ `_DashboardPage` KHÔNG render được từ một fixture thuần, vì con của nó là các khối nối tự gọi request. Lời hứa fixture của SPLIT-1 dừng lại ở seam khối, và không luật nào nói ra điều đó."
