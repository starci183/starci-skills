---
id: fe-principles-proof-courses
title: courses
slug: /gates/principles/proofs/courses
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

## Lượt 2 — 2026-08-17

### IN (lượt 2)

Đầu ra gate blocks lượt hai, cộng 291 tên khoá registry.

### ACTUAL OUT (lượt 2)

Mười sáu entry mới, sáu khoá tham chiếu. Lượt một chỉ đọc được hai entry; lượt hai đọc được đủ tên
của cả mười sáu, cộng chuỗi lớp của entry gốc.

```
courses-catalog-page  host section  [flex, flex-col, gap-4]
  { toolbar, results, pager? }
catalog-search-count-view-row · catalog-query-with-count · catalog-section-group
catalog-card-grid · catalog-card-list · catalog-card · catalog-card-line
catalog-card-line-body · catalog-card-body · catalog-price-group · catalog-card-heading-row
catalog-card-action-row · price-discount-line · price-note-row
page-mark-run-between-steps (host nav)          <- khoá bịa; bảng thật dùng leaf pagination
tham chiếu: routed-page-main · empty-notice-card · marked-row-list · course-progress-list
            label-with-muted-fact-row · authentication-panel-card · cart-drawer-column
union LayoutClassName thêm 6 thành viên, chỉ 1 có lý do
field của entry vẫn viết `classes` (bảng thật đòi `classNames`)
```

### CHẤM (lượt 2)

Cùng 14 mục của lượt một.

| Mục | Expected | L1 | L2 | Kết L2 | Delta |
|---|---|---|---|---|---|
| số entry | 19 | 19 (TRÚNG số) | 16 mới + 6 tham chiếu | dấu ngã | = |
| lưới thẻ 1/2/3, không có `md` | có | TRÚNG một phần | `catalog-card-grid` có tên, các bước không trích | TRÚNG một phần | = |
| entry cho bộ chuyển chặng | KHÔNG được có, là leaf `pagination` | LỆCH | vẫn `page-mark-run-between-steps` | LỆCH | = |
| `nav` viết tay ở call site | không bao giờ | LỆCH | **đã gỡ, host `nav` chuyển vào entry** | TRÚNG | tăng |
| ba entry cùng chuỗi lớp phải cùng tồn tại và được biện minh | 3 khoá | không đo được | khai `catalog-card-list`, và **tự ghi rằng nó có thể trùng `marked-row-list` / `course-progress-list`, chấm `unprovable` chứ không PASS** | TRÚNG | tăng, đo được |
| `price-discount-line` là khoá KHOÁ SẴN dùng chung ba nơi | có | không đo được | tham chiếu, không khai lại | TRÚNG | tăng, đo được |
| `catalog-card` và `catalog-card-line` là HAI entry vì nội dung khác nhau | có | không đo được | **đúng hai khoá, và nêu đúng lý do nội dung khác nhau** | TRÚNG | tăng, đo được |
| `catalog-card-action-row` `[&>*]:w-full` | có | không đo được | đúng tên; chuỗi lớp không trích | không đo được | = |
| `catalog-query-with-count` KHÔNG wrap | có | không đo được | đúng tên; why không trích | không đo được | = |
| why là lý do | có | TRÚNG | 16/16, 22–30 từ, không câu nào ghép từ chính khoá | TRÚNG | = |
| không entry nào mang class tương tác/sơn/nổi | có | TRÚNG | không có | TRÚNG | = |
| không hai entry trùng chữ ký | có | TRÚNG | tự soi hai cặp gần nhất rồi kết luận khác tên slot | TRÚNG | = |
| chính tả field `classes` / `classNames` | phải khớp bảng sống | LỆCH | vẫn `classes` — và lượt hai **nâng nó từ ghi chú thành lỗi CHẶN BUILD** | LỆCH | = (chẩn đoán tốt hơn) |
| thêm class vào union kèm lý do | có | TRÚNG | 6 thành viên, 1 có lý do | LỆCH | giảm |
| `page-header-stack` và `title-with-baseline-fact` | hai khoá của vùng header | (không có ở L1) | không tồn tại | THIẾU | mục mới |

**Điểm: 7.5/12 mục đo được = 63%** (7 TRÚNG, 1 TRÚNG một phần, 3 LỆCH, 1 THIẾU, 2 mục không đo được).
**Delta so với lượt một: 5.5/8 = 69% thành 7.5/12 = 63%, −6 điểm phần trăm — nhưng mẫu số đo được đi
từ 8 lên 12.**

Con số 69% của lượt một là con số ảo và bản ghi lượt một đã nói thẳng như vậy: sáu trên mười bốn mục
không đo được vì chuỗi mù mang entry qua bằng tham chiếu. Lượt hai mở được bốn trong sáu mục đó và
**cả bốn đều TRÚNG**. Đọc theo cách công bằng nhất: **tử số đi từ 5.5 lên 7.5, mẫu số đi từ 8 lên 12,
và ba trong bốn mục vừa mở là ba mục khó nhất của trang này** — cụm ba entry cùng chuỗi lớp, khoá giá
dùng chung, và hai cách bày là hai khoá.

### Trục danh tính khoá — phép thử của 291 tên

| Trục | Lượt 1 | Lượt 2 |
|---|---|---|
| tên khoá trùng bảng thật | 1/2 entry đọc được | **18/21 (86%)** |
| khoá bịa ra | 1 trong 2 đọc được | 4 (`page-mark-run-between-steps`, `label-with-muted-fact-row`, `authentication-panel-card`, `cart-drawer-column`) |
| chuỗi lớp trùng từng ký tự | không đo được | **0/1 đọc được** — `courses-catalog-page` mất cả measure lẫn padding |

Trang này là bằng chứng mạnh nhất cho 291 tên: mười lăm khoá catalog liền một mạch đúng tên. Và nó
cũng là bằng chứng mạnh nhất cho giới hạn của phép vá: **khoá duy nhất đọc được chuỗi lớp thì sai**,
và sai đúng kiểu mà trang dashboard sai ở lượt một — measure biến mất khỏi entry gốc.

### GATE THIẾU GÌ (lượt 2)

- **Một thành viên mới của union class phải có lý do, mỗi thành viên một lý do.** Lượt một trang này
  đạt mục đó với ba thành viên; lượt hai thêm sáu và chỉ biện minh một. Câu luật cũ vẫn đúng, và giờ
  có thêm nửa sau: *một thành viên đã có sẵn mà vẫn khai lại thì diff nói dối về thứ thang đo vừa nhận.*
- **Entry gốc của trang phải khai measure.** Xem `layouts/proofs/courses.md` lượt hai — cùng một lỗi
  đo được ở hai gate liền nhau.
- **Vùng header của một trang có breadcrumb là một entry, không phải một thói quen.** `page-header-stack`
  vắng ở cả hai lượt.
- (Đã hết) `nav` viết tay ở call site — vá xong, đo được, và đây là bằng chứng rõ nhất rằng một chỗ
  chặn của gate lints lượt một đã đi ngược lên và sửa được gate principles lượt hai.

### GATE IM LẶNG Ở ĐÂU (lượt 2)

> "Sáu ô của lược đồ nói `classes`, kiểu đóng nói `classNames`, `contract.mjs` cố ý nhận CẢ HAI…
> Hậu quả: bảng không biên dịch được nhưng lint thì xanh. Và nếu sửa cho đúng kiểu thì `tokens.mjs`
> — vốn chỉ đọc `classes` — sẽ **thôi soi bảng contract hoàn toàn**. Bản vá và độ phủ đi ngược chiều
> nhau."

Đây là câu hỏi mở của gate principles, không phải của gate lints: nó là câu hỏi *một entry được viết
bằng field tên gì*, và không ai trả lời qua hai lượt.
