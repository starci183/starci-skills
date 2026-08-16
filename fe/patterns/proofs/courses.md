---
id: fe-patterns-proof-courses
title: courses
slug: /fe/patterns/proofs/courses
sidebar_label: courses
description: Chấm gate patterns trên trang kho khóa học — split và cây file trúng, nhưng ba nửa nối cùng tự đọc lại địa chỉ và một import treo đi qua cả bốn ranh giới.
---

# courses · gate patterns

> Ngày: 2026-08-16 · Chuỗi: layouts → blocks → principles → patterns → lints

## IN

Đầu ra gate principles: 19 entry và ba khối. Không có nguyên văn trong chuỗi mù.

## EXPECTED OUT

| Mục | Kỳ vọng | Neo |
|---|---|---|
| cây file | `pages/CoursesCatalogPage/{index,component,component.test}.tsx`, `blocks/courses/CourseCatalogCard/{index,component}.tsx`, `app/[lang]/courses/{page,layout}.tsx` | `expected.patterns.file_tree` |
| đúng hai file mỗi thư mục surface | test là ngoại lệ được phép; KHÔNG file thứ ba mang logic | như trên |
| split page | `index.tsx` đọc `useQueryCoursesSwr`, `useQueryMyCoursesSwr`, hai namespace `courses.catalog` và `courses`, `useLocale`, `useRouter`, giữ state `query`/`page`/`view`/`pricedCourseId`, tính `priceOf` và `discover`, mount overlay | `index.tsx` |
| split block | `index.tsx` đọc `useQueryCoursePricePreviewSwr`, `useMutateAddToCartSwr`, giữ `isInCart` | `CourseCatalogCard/index.tsx` |
| props page | khai TƯỜNG MINH chứ không dùng `BlockProps`, vì `on` cần index signature cho handler động `view:<id>` và `priceDetail:<id>` | `component.tsx` |
| props block | `BlockProps<State, Data> & { on? }` | như trên |
| danh tính component ổn định | `CatalogLineList = defineContractComponent("catalog-card-list", View)` ở module scope | như trên |
| meta | bốn file, bốn meta, cùng `domain: "courses"` | như trên |
| resting | `RESTING_COUNT = 3` khớp `restingCount` của cả grid lẫn list | như trên |
| phân trang | 1-based ở UI, 0-based ở request, đổi đúng MỘT chỗ; `PAGE_SIZE = 9` | như trên |
| sort | `filters.sorts = []` CÓ CHỦ Ý — index ES theo locale không có `title.keyword` | như trên |
| view persistence | `localStorage` key `starci.courses.view`, hydrate trong `useEffect` sau mount, ghi trong try/catch | như trên |

## ACTUAL OUT

```
pages/CoursesCatalogPage/{index,component}.tsx
blocks/courses/CourseCatalogCard/{index,component}.tsx
blocks/courses/CatalogToolbar/{index,component}.tsx
blocks/courses/CatalogPager/index.tsx                      ← MỘT file
leaves/ViewModeSwitch, leaves/TextLink                     ← khai đường dẫn, KHÔNG có thân
overlays/CoursePriceOverlay                                ← khai đường dẫn, KHÔNG có thân
hooks/swr/useMutateAddToCartSwr.ts, useQueryCourseCatalogSwr.ts
app/[lang]/courses/page.tsx
contracts/index.ts (sửa)
+ 5 file test, 3 thao tác GraphQL, hook viewer, 2 catalogue locale  — chỉ có đường dẫn

29 file tổng; 14 file có mã thật, 15 file chỉ có đường dẫn
meta: 9 export meta, hình dạng { shape, world, domain } / { world, domain }
"Ba file connected cùng gọi useQueryCourseCatalogSwr với ba lần tự bóc query và page từ địa chỉ"
CourseCatalogCard/index.tsx import useQueryCourseRowSwr — KHÔNG được định nghĩa ở đâu
```

## CHẤM

| Mục | Expected | Actual | Kết | Gốc / kế thừa |
|---|---|---|---|---|
| trang hai nửa | có | có | TRÚNG | gốc |
| thẻ hai nửa | có | có | TRÚNG | gốc |
| tên `_X` cho nửa vẽ | `_CoursesCatalogPage`, `_CourseCatalogCard` | y hệt | TRÚNG | gốc |
| nửa nối không vẽ gì ngoài twin | có (page là ngoại lệ vì còn mount overlay) | rule xanh, gate xác nhận CatalogToolbar buộc phải có twin | TRÚNG | gốc |
| `CatalogPager` một file | — (không tồn tại trong bảng thật) | một file `index.tsx`, export khớp thư mục | KHÁC MÀ ĐƯỢC | kế thừa |
| `layout.tsx` của route courses | có | không có trong danh sách file | THIẾU | kế thừa |
| overlay giá có thân | có | chỉ đường dẫn | THIẾU | kế thừa |
| props page khai tường minh, `on` có index signature | có, vì handler động theo id | không đọc được | không đo được | — |
| danh tính component ổn định ở module scope | có | không đọc được | không đo được | — |
| ai giữ `query`/`page`/`view` | PAGE, một chỗ | ba file connected tự bóc `searchParams` | LỆCH | kế thừa |
| view persistence | `localStorage` + hydrate sau mount | không tồn tại | THIẾU | kế thừa |
| `PAGE_SIZE` và quy đổi 1-based/0-based | đổi đúng một chỗ | không đọc được | không đo được | — |
| `sorts = []` có chủ ý | có, kèm lý do backend | không đọc được | không đo được | — |
| `RESTING_COUNT` khớp entry | 3 = 3 | không đọc được | không đo được | — |
| meta bốn file cùng domain | có | 9 export meta, hai hình dạng khác nhau | LỆCH | gốc |
| mọi import phân giải được | có | `useQueryCourseRowSwr` treo | LỆCH | gốc |
| khóa mutation theo từng thẻ | — | `[MUTATE_ADD_TO_CART_SWR_KEY, courseId]`, null khi chưa có id | TRÚNG | gốc |

**Điểm: 6 TRÚNG · 1 KHÁC MÀ ĐƯỢC · 3 LỆCH · 3 THIẾU · 5 không đo được trên 18 = 6.5/13 mục đo được.**

## GATE THIẾU GÌ

- **Mọi định danh được import phải có một file trong danh sách khai nó, và gate patterns là ranh giới cuối còn có thể đối chiếu điều đó.** `useQueryCourseRowSwr` đi qua đây, qua gate lints, và chỉ bị bắt bằng mắt vì lint không phân giải module. Một phép đối chiếu import ↔ `files` là một dòng luật.
- **Tham số truy vấn của một trang phải có đúng một chủ, và gate patterns phải nói ra chủ đó là ai bằng tên file.** Ba nửa nối cùng đọc `searchParams` là ba nguồn cho một câu hỏi; SWR gộp cache lại nên nó SẼ chạy, và vì nó chạy nên không ai sửa.
- **Nếu một file được liệt kê thì nó phải có mã; nếu chưa có mã thì nó phải nằm trong một danh sách "còn nợ mã" tách riêng.** 15 trên 29 file chỉ có đường dẫn, và hậu quả là 11 rule của gate lints rơi vào "không áp dụng" chỉ vì thân file không tồn tại.
- **Hình dạng `meta` phải là một, được chốt trong canon.** Trang này có hai hình dạng meta trên chín file, và không gate nào đọc meta nên cả hai đều xanh.

## GATE IM LẶNG Ở ĐÂU

Từ `uncertain` của gate lints trang này — cả bốn câu đều là câu hỏi thuộc ranh giới patterns:

> "`SourcePlan` không có ô nào cho VĂN BẢN mã: không tsx, không propTypes, không metaByFile. Tôi cần biết gate lints được cho là lint cái gì nếu đầu vào hợp lệ chỉ có danh sách đường dẫn."

> "Lược đồ gate lints đòi `output.source` mang nguyên SourcePlan, mà SourcePlan là 40KB và `additionalProperties:false`. Gate muốn source là mã NHẬN VÀO hay mã ĐÃ SỬA?"

> "Ô `at` bắt buộc file:dòng thật trong repo sống, nhưng mã này chưa được ghi vào repo sống và tôi bị cấm đọc repo đó."

Ba câu này lặp lại nguyên văn ở cả ba trang. Chúng không phải là chỗ gate patterns đoán sai — chúng là chỗ lược đồ của gate patterns không diễn đạt được thứ nó phải giao.
