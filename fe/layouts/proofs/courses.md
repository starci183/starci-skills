---
id: fe-layouts-proof-courses
title: courses
slug: /fe/layouts/proofs/courses
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
