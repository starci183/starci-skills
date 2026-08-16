---
id: fe-patterns-proofs-index
title: Bằng chứng gate patterns
slug: /gates/patterns/proofs
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

## Lượt 2 — 2026-08-17

### Bảng điểm

| Trang | Lượt 1 | Lượt 2 | Delta | File có mã thật |
|---|---|---|---|---|
| [dashboard](./dashboard.md) | 14.5/22 · **66%** | 14.5/21 · **69%** | **+3** | 8/60 → **23/23** |
| [courses](./courses.md) | 6.5/13 · **50%** | 9.5/14 · **68%** | **+18** | 14/29 → 0/19 (chỉ có `fixedCode`) |
| [course-details](./course-details.md) | 12/20 · **60%** | `null` · **0%** | **−60** | — |
| **Trung bình hai trang chạy được** | **58%** | **68.5%** | **+10.5** | |
| **Trung bình ba trang** | **58.7%** | **45.7%** | **−13** | |

### Ô `SourceFile.source` — vá một nửa

Trường `source` được đặt thành **bắt buộc**. Kết quả chia đôi:

- **dashboard: ăn.** Cả 23 file có văn bản mã đầy đủ, so với 8 trên 60 ở lượt một. Cùng một điểm số
  (66% → 69%), gần gấp ba lượng mã được soi. Đây là ô vá trả về đúng thứ nó hứa.
- **courses: trượt.** Bước phát một khối `fixedCode` chứa mã đã sửa thay vì `files[].source`, và
  không có gì bắt được. Một trường bắt buộc mà một trong hai bước phớt lờ thì chưa phải một trường
  bắt buộc.

Bốn mục tăng của trang courses đều là bốn thứ lượt một để trống: layout của route, thân overlay, ai
giữ trạng thái truy vấn, cách nhớ preference. Ba trong bốn cái đó là những thứ **câu nghiệp vụ nói ra
bằng chữ** và lượt một đánh rơi.

### Chất lượng mã đang xấu đi trong khi điểm đang lên

Đây là cảnh báo quan trọng nhất của gate patterns ở lượt hai. Ba lớp lỗi mới, cả ba đều là lỗi làm
mã không chạy được, và cả ba đều nằm ngoài tầm mọi rule:

1. **Định danh treo: một chỗ ở lượt một, hai chỗ ở lượt hai.** `restingCard()` và `restingLine()`
   được gọi ở nhánh chờ của mọi thẻ trong lưới và không được khai ở đâu.
2. **Fixture test không thoả kiểu nó giả làm** — thiếu trường bắt buộc `lessonCount`.
3. **Khẳng định test truy vấn thuộc tính không tồn tại.** Frame sơn `data-node`, `data-why`,
   `data-tier`; hai test hỏi `data-testid`. Một cái ném lỗi; cái kia — `queryByTestId('badge')` —
   **xanh vĩnh viễn**, tức nó vẫn xanh khi mọi thẻ đều vẽ badge. Một khẳng định không bao giờ đỏ được
   thì tệ hơn không có khẳng định.

### Gate còn thiếu luật gì

| # | Câu luật lẽ ra đã ngăn được | Trang | Trạng thái |
|---|---|---|---|
| 1 | **Mọi định danh được gọi phải được khai hoặc import trong cùng kế hoạch.** | 2/3 | chưa vá, **đang xấu đi** (1 → 2 chỗ) |
| 2 | **Một khẳng định test phải truy vấn thứ frame thật sự sơn ra: `data-node`, không phải `data-testid`.** | 1/3 | **mới ở lượt 2** |
| 3 | **Fixture của test phải thoả kiểu của dữ liệu nó giả làm.** | 1/3 | mới ở lượt 2 |
| 4 | **`SourceFile.role` phải có ô cho cây thông điệp locale.** | 2/3 | nêu lượt 1, chưa vá — lượt 2 hứa 21 khoá dịch và không file nào khai chúng |
| 5 | **`export const meta` phải được hoà giải với `require-export-jsdoc` một lần cho cả nhà.** | 2/3 | nêu lượt 1, chưa vá — 18 chỗ ở dashboard, 9 ở courses |
| 6 | **Miền của một khối là dữ kiện của bảng thật, không phải suy luận ngữ nghĩa.** | 1/3 | **mới ở lượt 2** — `blocks/profile/IdentityRail` nghe hợp lý và vẫn sai |
| 7 | **Một cây có thứ tự đọc do sản phẩm quy định phải có phép khẳng định đếm được, kể cả khi page không có nửa nối.** | 1/3 | **mới ở lượt 2** — page bỏ nửa vẽ và bỏ luôn twin test của page |
| 8 | **`meta.shape` chỉ có ba giá trị được đặt tên; `page` và `overlay` là giá trị thứ tư và thứ năm.** | 2/3 | chưa vá |
| 9 | **`SourceFile.source` bắt buộc: một bước phát `fixedCode` thay cho `source` phải bị từ chối.** | 1/3 | **mới ở lượt 2** |

### Gate im lặng ở đâu

Hai câu, cả hai đều là câu về hình dạng props và cả hai đều nguyên vẹn qua hai lượt:

> "Tôi không đọc được `props.ts` nên không biết literal props của slot có được trộn vào lane props lúc
> render hay không; điều đó quyết định `size` trong `DayCellData` là thừa hay bắt buộc."

> "`export const meta` … §2.6 kết thúc bằng câu đừng phát minh trục thứ tư — nó không nói phải làm gì
> với một giá trị thứ ba trên một trục đã có."
