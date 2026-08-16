---
id: fe-layouts-proof-courses
title: courses
slug: /gates/layouts/proofs/courses
sidebar_label: courses
description: Chấm gate layouts trên trang kho khóa học — không có rail là đúng, nhưng sáu vùng của trang không được liệt kê và tập trạng thái năm mức bị bỏ.
---

# courses · gate layouts

> Ngày: 2026-08-16 · Chuỗi: layouts → blocks → principles → patterns → lints

## IN

```
Người học của StarCi, kể cả khách chưa đăng nhập, vào đây khi họ muốn tìm một khóa học đáng mua
nhưng chưa biết chính xác là khóa nào, nên việc của trang là giúp họ so sánh và chốt được một
khóa rồi rời đi. Mỗi khóa phải nói đủ để so được: tên khóa, ảnh nhận diện, đã có bao nhiêu người
ghi danh, giá phải trả hôm nay cùng giá gốc và số tiền tiết kiệm nếu đang có ưu đãi, và những
điều khóa đó cam kết mang lại. Giá phải đúng với chính người đang xem: khách thấy mức giá của
đợt bán đang chạy, người đã đăng nhập có thể được giảm thêm theo mức thân thiết, và trong mọi
trường hợp họ phải có đường xem giá ấy được tính ra sao. Người học cần gõ từ khóa để thu hẹp
kho, biết còn lại bao nhiêu kết quả, đi qua kho lớn theo từng chặng, và vì có người lướt nhanh
hai chục khóa còn có người cân nhắc kỹ vài khóa nên cách đọc phải hợp với từng kiểu người và
được nhớ cho lần sau. Khóa nào người học đã sở hữu thì tuyệt đối không được chào bán lại lần
nữa; thay vào đó họ thấy mình đang học dở tới đâu, còn với khóa chưa mua thì luôn có hai lối:
bỏ vào giỏ để mua, hoặc mở ra đọc kỹ trước.
```

## EXPECTED OUT

| Mục | Kỳ vọng | Neo |
|---|---|---|
| archetype | `browse-and-filter` (BROWSE-1..5). Bộ sưu tập LÀ nội dung nên KHÔNG có rail | `.claude/fe/layers/browse-and-filter/INDEX.md` |
| root | `courses-catalog-page`, `mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-6` | `contracts/index.ts` |
| vùng header | `page-header-stack` — BẮT BUỘC | `CoursesCatalogPage/component.tsx` |
| vùng toolbar | `catalog-search-count-view-row` — BẮT BUỘC, đứng trên CẢ HAI nhóm | như trên |
| vùng owned | `course-progress-list`, optional, chỉ khi `hasOwned` và không có notice | như trên |
| vùng discover | `catalog-section-group`, optional | như trên |
| vùng notice | composite `empty-notice`, optional | như trên |
| vùng pager | leaf `pagination`, optional; hiện cả khi chỉ 1 trang, vắng khi pending hoặc có notice | như trên |
| vắng là VẮNG SLOT | `...(cond ? {} : { key })` — không phải slot giữ null | như trên |
| 5 state | pending · ready · empty · filtered-empty · failed | `index.tsx` |
| suy state | `failed` khi `error` hoặc `data === null`; `null` ≠ `undefined` | `index.tsx` |
| lưới | `grid-cols-1 → sm:grid-cols-2 → lg:grid-cols-3`, KHÔNG có `md` | `contracts/index.ts` |
| header/toolbar không nghỉ | hai vùng này render như chính nó trong khi thẻ nghỉ | `component.tsx` |
| landmark | `main` do `routed-page-main` ở `courses/layout.tsx` mở | `app/[lang]/courses/layout.tsx` |

## ACTUAL OUT

Chỉ một phương án đi qua ranh giới; ba phương án còn lại không có trong chuỗi mù. Bằng chứng đọc lại được từ gate lints còn MỎNG HƠN dashboard: gate lints trang này mang `contractEntries` qua bằng tham chiếu ("mười tám entry còn lại, không đổi") nên tôi chỉ đọc được những entry nó trích và những file nó đặt tên.

```
19 entry; các entry đọc được:
  prev-position-next-row   host nav   [flex, flex-wrap, items-center, justify-center, gap-2]
  catalog-card-grid        (thêm lg:grid-cols-3 vào union LayoutClassName)
Thêm vào union: aspect-video, mt-auto, lg:grid-cols-3
Khối: CourseCatalogCard, CatalogToolbar, CatalogPager (+ leaf ViewModeSwitch, TextLink)
Trang: CoursesCatalogPage index/component
"Ba file connected cùng gọi useQueryCourseCatalogSwr với ba lần tự bóc query và page từ địa chỉ"
```

Không đọc được: danh sách sáu vùng, tập state, vùng owned, quy tắc vắng-là-vắng-slot, measure.

## CHẤM

| Mục | Expected | Actual | Kết | Gốc / kế thừa |
|---|---|---|---|---|
| archetype | browse-and-filter, không rail | không có rail nào xuất hiện | TRÚNG | gốc |
| lưới 1/2/3 | `grid-cols-1 sm:2 lg:3` | có `lg:grid-cols-3` được thêm vào union | TRÚNG (một phần) | gốc |
| header là vùng bắt buộc | có | không đọc được | không đo được | — |
| toolbar là vùng bắt buộc, trên cả hai nhóm | có | có block `CatalogToolbar` | TRÚNG (về sự tồn tại) | gốc |
| owned là một vùng riêng | `course-progress-list` | không có dấu vết | THIẾU | gốc |
| khóa đã sở hữu không được chào bán lại | dedupe theo `ownedIds` | không có dấu vết | THIẾU | gốc |
| pager | leaf `pagination` | block `CatalogPager` + entry `prev-position-next-row` | LỆCH | gốc |
| pager hiện cả khi 1 trang | có | không đọc được | không đo được | — |
| công tắc cách đọc | leaf `choice-tabs` variant primary | leaf mới `ViewModeSwitch` | LỆCH | gốc |
| nhớ cách đọc cho lần sau | `localStorage` + hydrate sau mount | không có dấu vết | THIẾU | gốc |
| 5 state | pending/ready/empty/filtered-empty/failed | không đọc được | không đo được | — |
| vắng là vắng slot | có | không đọc được | không đo được | — |
| ai giữ query/page/view | PAGE giữ | ba file connected tự đọc lại `searchParams` | LỆCH | gốc |
| measure của trang | `max-w-6xl px-6 py-6` | không đọc được | không đo được | — |
| landmark ở layout của route | có | khai nhưng `layout.tsx` KHÔNG có trong danh sách file | LỆCH | gốc |

**Điểm best-of-set: không đo được.** **Điểm recommended: 3/10 mục đo được** (3 TRÚNG, 4 LỆCH, 3 THIẾU; 5 mục không đo được vì chuỗi mù không mang entry qua).

## GATE THIẾU GÌ

- **Trang phải liệt kê từng vùng cấp một cùng với việc vùng đó bắt buộc hay tùy chọn, và "tùy chọn" nghĩa là slot KHÔNG TỒN TẠI chứ không phải slot giữ null.** Không có danh sách đó thì vùng khóa-đã-sở-hữu biến mất mà không ai đếm được là thiếu.
- **Một câu nghiệp vụ nói "tuyệt đối không được chào bán lại" là một luật về DỮ LIỆU của vùng, phải xuất hiện thành một vùng riêng chứ không phải một điều kiện trong thẻ.** Gate đã đọc câu đó và không sinh ra vùng nào.
- **Một trạng thái do người dùng tạo ra (lọc còn 0 kết quả) khác trạng thái kho rỗng, và cả hai khác trạng thái hỏng.** Gate phải liệt kê năm mức chứ không được gộp về "có/không có dữ liệu".
- **Preference của người đọc phải nói rõ nó sống ở đâu và ai hydrate nó.** "Được nhớ cho lần sau" là một câu nghiệp vụ, và không vùng nào của kế hoạch nhận trách nhiệm đó.
- **Một điều khiển đã có leaf trong từ vựng thì không được đẻ leaf mới.** `ViewModeSwitch` và `CatalogPager` đều là bản sao của `choice-tabs` và `pagination` đã tồn tại.

## GATE IM LẶNG Ở ĐÂU

Từ `uncertain` của gate lints trang này (không có `uncertain` của gate layouts trong chuỗi mù):

> "Sau khi gỡ nav viết tay, vùng phân trang thành một landmark không có tên đọc được. Tôi cần biết cây trust muốn gì ở đây: chấp nhận nav không tên, hay bỏ luôn host nav và để bộ chuyển chặng là một div. Gate im lặng: contract/INDEX.md:152 chỉ nói về semantic element, và không câu nào nói một landmark có buộc phải có tên hay không."

Câu hỏi đó lẽ ra phải được hỏi ở đây, tại gate layouts, lúc quyết định vùng pager là gì — chứ không phải ở gate cuối, sau khi mã đã được viết ra.

## Lượt 2 — 2026-08-17

### IN (lượt 2)

Không đổi một chữ so với lượt một.

### ACTUAL OUT (lượt 2)

Vẫn một phương án qua ranh giới. Nhưng chứng cứ dày hơn hẳn lượt một: bước cuối lần này liệt kê
**mười sáu entry mới theo tên**, trích nguyên chuỗi lớp của entry gốc, và mô tả cây con của root.

```
courses-catalog-page   host section   [flex, flex-col, gap-4]
  { toolbar: catalog-search-count-view-row,
    results: catalog-section-group,
    pager:   page-mark-run-between-steps  (optional) }

catalog-search-count-view-row · catalog-query-with-count · catalog-section-group
catalog-card-grid · catalog-card-list · catalog-card · catalog-card-line
catalog-card-line-body · catalog-card-body · catalog-price-group
catalog-card-heading-row · catalog-card-action-row · price-discount-line · price-note-row
page-mark-run-between-steps  (host nav)

Trạng thái trang: pending · settled · empty          (ba, không phải năm)
VIEW_STORAGE_KEY                                     (nhớ cách đọc — MỚI so với lượt một)
Test: "hides the step control while there is only one page of answers"
src/app/[lang]/courses/layout.tsx  <ShellNav/> + <MainFrame contract="routed-page-main">
```

### CHẤM (lượt 2)

Cùng 15 mục của lượt một. Điểm đáng chú ý nhất của bảng này không phải các ô Kết mà là cột Δ ở
những dòng ghi "không đo được" lượt một: **năm mục chuyển từ không-đo-được sang đo-được**, và bốn
trong năm đó hoá ra SAI. Đó là điều một fixture cần: biến sự im lặng thành một kết quả.

| Mục | Expected | L1 | L2 | Kết L2 | Δ |
|---|---|---|---|---|---|
| archetype | browse-and-filter, không rail | TRÚNG | không rail | TRÚNG | = |
| lưới 1/2/3 | `grid-cols-1 sm:2 lg:3` | TRÚNG một phần | `catalog-card-grid` có mặt, `lg:grid-cols-3` trong union | TRÚNG một phần | = |
| header là vùng bắt buộc | `page-header-stack` | không đo được | root chỉ có 3 vùng, **không có header** | THIẾU | ↓ đo được |
| toolbar bắt buộc, trên cả hai nhóm | có | TRÚNG | có, và why nói đúng "One toolbar narrows both groups at once" | TRÚNG | = |
| owned là một vùng riêng | `course-progress-list` | THIẾU | vẫn không có | THIẾU | = |
| không chào bán lại khoá đã sở hữu | dedupe theo `ownedIds` | THIẾU | vẫn không có | THIẾU | = |
| pager | leaf `pagination` | LỆCH | `page-mark-run-between-steps`, host `nav` | LỆCH | = |
| pager hiện cả khi 1 trang | có | không đo được | test khẳng định pager **VẮNG** khi 1 trang | LỆCH | ↓ đo được |
| công tắc cách đọc | leaf `choice-tabs` variant primary | LỆCH | `CatalogToolbar` giữ `gridLabel`/`listLabel` | LỆCH | = |
| nhớ cách đọc cho lần sau | `localStorage` + hydrate sau mount | THIẾU | **`VIEW_STORAGE_KEY`** | TRÚNG | ↑ |
| 5 state | pending/ready/empty/filtered-empty/failed | không đo được | ba: pending/settled/empty | LỆCH | ↓ đo được |
| vắng là vắng slot | `...(cond ? {} : { key })` | không đo được | `pager` khai `optional` ở entry, test kiểm vắng | TRÚNG | ↑ đo được |
| ai giữ query/page/view | PAGE giữ | LỆCH | **PAGE giữ**, block nhận chuỗi đã giải | TRÚNG | ↑ |
| measure của trang | `mx-auto max-w-6xl px-6 py-6` | không đo được | `flex flex-col gap-4` — **không có measure nào** | LỆCH | ↓ đo được |
| landmark ở layout của route | `routed-page-main` | LỆCH | có `layout.tsx`, có khoá, nhưng mở bằng `MainFrame` — một frame canon không biết | TRÚNG một phần | ↑ |

**Điểm best-of-set: vẫn không đo được** — cùng lý do trang dashboard.
**Điểm recommended: 6/15 = 40%.** (5 TRÚNG, 2 TRÚNG một phần, 5 LỆCH, 3 THIẾU.)
**Δ so với lượt một: 3/10 mục đo được = 30% → 6/15 = 40%, +10 điểm phần trăm — và mẫu số đo được
tăng từ 10 lên 15.**

Mức tăng thật của trang này nằm ở mẫu số nhiều hơn ở tử số. Lượt một có 5 mục không đo được vì
chuỗi mù chỉ mang entry qua bằng tham chiếu; lượt hai đo được cả 15. Bốn trong năm mục vừa mở ra
đều đỏ, nghĩa là lượt một đang **giấu** bốn lỗi chứ không phải không có chúng.

### GATE THIẾU GÌ (lượt 2)

- **Root của một trang phải khai measure, hoặc phải chỉ ra node nào ở trên nó giữ measure.** Lượt
  một trang dashboard mất measure; lượt hai trang courses mất measure. Cùng một lỗi, hai trang, hai
  lượt. Câu luật: *không entry gốc nào được rời gate mà không trả lời được câu "chiều rộng đọc của
  trang này do ai đặt".*
- **Số vùng cấp một của trang là một con số phải khai và phải khớp.** Kỳ vọng sáu, kế hoạch ba, và
  không có ô nào trong lược đồ để nói "ba vùng này là đủ vì …". Vùng `owned` chết lần thứ hai liên
  tiếp ở đúng chỗ đó.
- **Một trạng thái do người dùng tạo ra (lọc còn 0) phải tách khỏi kho rỗng và tách khỏi hỏng.**
  Nêu ở lượt một, chưa được vá, và lượt hai còn tụt thêm: `failed` biến mất luôn.
- **Một điều khiển đã có leaf trong từ vựng thì không được đẻ khoá bố cục cho nó.** Lượt một đẻ
  `ViewModeSwitch` + `CatalogPager`; lượt hai bỏ được `ViewModeSwitch` nhưng vẫn giữ
  `page-mark-run-between-steps`. Nửa bước.

### GATE IM LẶNG Ở ĐÂU (lượt 2)

> "Gate tự mâu thuẫn về thành viên của union class. `sources/fe/contracts.ts:34-49` giữ khoảng bốn
> mươi lăm thành viên và không có `divide-y`, `divide-separator`, `overflow-hidden`, `min-w-0`,
> `flex-1`; còn §1.2 của chính đề bài liệt kê tất cả những cái đó là họ đã có… Tôi không phân biệt
> được nếu không mở được file."

Đây là câu hỏi của gate layouts: *thang lớp của nhà đang có gì?* Nếu gate bố cục không được cấp
union thật thì mọi entry nó viết ra đều là một canh bạc, và lượt hai đánh cược sáu lần.
