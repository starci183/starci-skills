---
id: fe-principles-proof-courses
title: courses
slug: /fe/principles/proofs/courses
sidebar_label: courses
description: Chấm gate principles trên trang kho khóa học — 19 entry, hai entry đọc lại được đều lệch, và ba khoá cùng chuỗi lớp của bảng thật không entry nào nhận ra.
---

# courses · gate principles

> Ngày: 2026-08-16 · Chuỗi: layouts → blocks → principles → patterns → lints

## IN

Đầu ra gate blocks. Không có nguyên văn. Đọc lại được: `CourseCatalogCard`, `CatalogToolbar`, `CatalogPager`, leaf `ViewModeSwitch`.

## EXPECTED OUT

19 khoá, và điểm căng nhất được ghi thẳng vào `expected.lints`:

```
courses-catalog-page            mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-6
catalog-search-count-view-row   flex flex-row flex-wrap items-center justify-between gap-4
catalog-query-with-count        flex flex-row items-center gap-3 [&>*:last-child]:shrink-0
                                — KHÔNG wrap, vì search-box tự fill full-width
catalog-section-group           flex flex-col gap-3
catalog-card-grid               grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2   (KHÔNG có md)
catalog-card-list       ┐
course-progress-list    ├─ BA entry có chuỗi lớp GIỐNG HỆT nhau: overflow-hidden divide-y
marked-row-list         ┘  divide-separator p-0 [&>*]:px-4 [&>*]:py-3 [&>*:first-child]:pt-4
                           [&>*:last-child]:pb-4   → điểm soi của no-duplicate-entry-shape
catalog-card            flex grow flex-col gap-4 p-4      (host branch SurfaceCard, có promises)
catalog-card-line       flex flex-row items-center gap-4 [&>*:first-child]:w-36 …  (KHÔNG promises)
catalog-card-body · catalog-card-line-body · catalog-card-heading-row ·
catalog-price-group · price-discount-line (KHOÁ SẴN, dùng chung với course-detail) ·
price-note-row · catalog-card-action-row ([&>*]:w-full — hai lối cùng chiều rộng) ·
page-header-stack · title-with-baseline-fact (fact bị entry cố định size sm tone muted)
```

Bộ chuyển chặng KHÔNG có entry: nó là leaf `pagination`.

## ACTUAL OUT

19 entry. Chuỗi mù mang chúng qua bằng tham chiếu ("mười tám entry còn lại, không đổi"), nên chỉ hai entry đọc được nguyên văn:

```
prev-position-next-row   host nav   [flex, flex-wrap, items-center, justify-center, gap-2]
                         { backward: leaf button, position: leaf text, forward: leaf button }
   why: "neither edge of the reading column owns this trio, so it rides the spare space in the
         middle and is allowed to fall onto a second line when the width finally runs out"

catalog-card-grid        (nhận thêm lg:grid-cols-3 vào union LayoutClassName)

Union thêm 3 thành viên: aspect-video, mt-auto, lg:grid-cols-3
Field của entry viết là `classes` (canon template viết `classNames`)
```

## CHẤM

| Mục | Expected | Actual | Kết | Gốc / kế thừa |
|---|---|---|---|---|
| số entry | 19 | 19 | TRÚNG (số) | gốc |
| lưới thẻ 1/2/3, không có `md` | có | có `lg:grid-cols-3`, các bước khác không đọc được | TRÚNG (một phần) | gốc |
| entry cho bộ chuyển chặng | KHÔNG có — là leaf `pagination` | `prev-position-next-row`, host `nav` | LỆCH | kế thừa (blocks đẻ CatalogPager) |
| `nav` viết tay ở call site | không bao giờ | có, gate lints chặn lại | LỆCH | gốc |
| ba entry cùng chuỗi lớp phải cùng tồn tại và được biện minh | `catalog-card-list` + `course-progress-list` + `marked-row-list` | không đọc được entry nào trong ba | không đo được | — |
| `price-discount-line` là khoá KHOÁ SẴN dùng chung ba nơi | có | không đọc được | không đo được | — |
| `catalog-card` và `catalog-card-line` là HAI entry vì nội dung khác nhau | có | không đọc được | không đo được | — |
| `catalog-card-action-row` `[&>*]:w-full` | có | không đọc được, nhưng union thêm `mt-auto` gợi ý cách khác | không đo được | — |
| `catalog-query-with-count` KHÔNG wrap | có | không đọc được | không đo được | — |
| why là lý do | có | 19/19 đạt, ngắn nhất 33 từ, không câu nào ghép từ chính khoá | TRÚNG | gốc |
| không entry nào mang class tương tác/sơn/nổi | có | không có; `bg-background` trên dải dính đi qua hợp lệ | TRÚNG | gốc |
| không hai entry trùng chữ ký | có | không có trong 19 | TRÚNG | gốc |
| chính tả field | `classes` hay `classNames` phải nhất quán với bảng sống | viết `classes`; gate lints ghi đây là lỗi biên dịch tiềm tàng | LỆCH | gốc |
| thêm class vào union kèm lý do | có | 3 thành viên, mỗi nhóm có comment | TRÚNG | gốc |

**Điểm: 5 TRÚNG (+1 một phần) · 3 LỆCH · 6 mục không đo được trên 14 = 5.5/8 mục đo được.**

Cảnh báo về chất lượng bằng chứng: **6 trên 14 mục không đo được** vì chuỗi mù chỉ mang entry qua bằng tham chiếu. Điểm này KHÔNG so được với dashboard, nơi cả 25 entry được viết ra.

## GATE THIẾU GÌ

- **Nếu bảng thật đã có một khoá cùng hình dạng, entry mới phải bị từ chối tại đây chứ không phải ở gate lints.** `prev-position-next-row` đi qua gate principles trót lọt và chỉ đổ ở cổng cuối, sau khi đã kéo theo một khối, một leaf và một landmark không tên.
- **Một entry mở host landmark (`nav`, `aside`, `section`) phải nói được nhãn đọc được của nó đến từ đâu.** Frame chỉ phát `data-node`, `data-why`, `className`. Gate principles là chỗ duy nhất biết nó đang mở landmark, và nó không có ô nào để nói rằng landmark đó sẽ không có tên.
- **Chính tả của field entry phải được chốt một lần trong canon.** `contracts.ts` viết `classNames`, `tokens.mjs` chỉ đọc `classes`, `contract.mjs` đọc cả hai. Gate principles không có cách nào biết mình đang viết đúng cái nào.
- **Khi nhiều entry buộc phải trùng chuỗi lớp, gate phải liệt kê chúng thành một cụm và nêu vì sao chúng không được gộp.** Bảng thật có ba entry như thế trên đúng trang này; kế hoạch không nhận ra cụm đó tồn tại.

## GATE IM LẶNG Ở ĐÂU

Từ `uncertain` của gate lints trang này:

> "Bảng entry: kế hoạch viết field `classes`, template canon tại `.claude/sources/fe/contracts.ts` viết `classNames`, và tài liệu gate lints §1.1 lại nói `classes`. `contract.mjs` cố ý nhận cả hai nên lint không phân xử được. Tôi cần biết bảng sống dùng chính tả nào."

> "Sau khi gỡ nav viết tay, vùng phân trang thành một landmark không có tên đọc được… Gate im lặng: `contract/INDEX.md:152` chỉ nói về semantic element, và không câu nào nói một landmark có buộc phải có tên hay không."

Cả hai câu hỏi thuộc về gate principles và cả hai chỉ được nêu ra ở gate cuối.
