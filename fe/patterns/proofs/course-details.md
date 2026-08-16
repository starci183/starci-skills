---
id: fe-patterns-proof-course-details
title: course-details
slug: /fe/patterns/proofs/course-details
sidebar_label: course-details
description: Chấm gate patterns trên trang chi tiết khóa học — split một-chỗ-chạm-thế-giới trúng đúng bản thật, nhưng sáu định danh được gọi mà không file nào khai chúng.
---

# course-details · gate patterns

> Ngày: 2026-08-16 · Chuỗi: layouts → blocks → principles → patterns → lints

## IN

Đầu ra gate principles: 28 entry, chín khối, một leaf mới. Không có nguyên văn trong chuỗi mù.

## EXPECTED OUT

| Mục | Kỳ vọng | Neo |
|---|---|---|
| cây file page | `index.tsx`, `component.tsx`, `index.test.tsx`, `component.test.tsx` | `pages/CourseDetailPage/` |
| khối | `CoursePricingRail/component.tsx` (+test, **KHÔNG có index.tsx**), `CourseMobileEnrollBar`, `CourseValuePropositionList`, `CoursePrerequisiteList`, `CourseReviewBlock`, `CoursePriceDetail` | `blocks/courses/` |
| ba khối định nghĩa CỤC BỘ trong page | `CoursePrerequisiteList`, `CourseModuleList`, `CourseFaqList` là view bind slot | `component.tsx` |
| route | `app/[lang]/courses/[displayId]/page.tsx` — server component chỉ await params rồi mount; `generateMetadata` không gọi lại query | như trên |
| tham số route | `displayId` chứ KHÔNG phải `course.id` (server trả `COURSE_NOT_FOUND_EXCEPTION` cho primary key) | `index.tsx` |
| split | `index.tsx` giữ 4 mutation + 4 query hook, `useState` cho `selectedSection` và `isPriceDetailOpen`, `Intl.NumberFormat` VND, giải mọi chuỗi và mọi số tiền TRƯỚC khi truyền xuống | như trên |
| ngoại lệ đã ghi | `CoursePricingRail/component.tsx` là world pure nhưng vẫn `"use client"` + `useState` vì `selectedIntent` là lựa chọn thuần UI | như trên |
| props | `CourseDetailPageProps` = `{ state, props, on }` readonly; block dùng `BlockProps<State, Data>`; list view dùng `LeafProps<D>` | như trên |
| handler | mọi handler qua object `on` với tên động từ (`act`, `trial`, `addToCart`, `openPriceDetail`, `selectSection`, `retry`, `navigateHome`, `navigateCourses`) — không prop nào tên `onClick` | như trên |
| resting đọc từ CONTRACTS | 6 / 5 / 5 / 3 / 3 — không viết số trong file trang | như trên |
| i18n | 5 namespace: `courses.detail`, `courses`, `courses.catalog`, `cart` | như trên |
| meta không nhất quán (đã ghi) | `pages/` và 2 khối dùng `{world, domain}`; block/branch khác dùng `{shape, world}` | như trên |

## ACTUAL OUT

```
app/[lang]/courses/[slug]/page.tsx          CourseDetailRoute, không meta
pages/CourseDetailPage/{index,component}.tsx + 2 test
blocks/courses/*/component.tsx  ×9 (+ twin test mỗi khối)   — mỗi khối MỘT file, không index
leaves/DisclosureQuestion/index.tsx         (leaf mới, sở hữu primitive disclosure)
hooks/swr/use-query-course-detail-swr.ts
contracts/index.ts, app/globals.css, messages/{vi,en}.json

split: pureExport _CourseDetailPage, connectedExport CourseDetailPage,
       worldReachedFrom "chi-nua-connected", reExportsComponent false
       — "cả trang chỉ có MỘT chỗ đọc thế giới"
meta:  page { world: "connected"|"pure", domain: "courses", shape: "page" }
       block { shape: "block", world: "pure", domain: "courses" }
       leaf  { shape: "leaf", world: "pure" }
props: mọi field readonly, handler onCommit / onAddToCart / onOpenPriceDetail / onToggle
23 khoá dịch, TẤT CẢ giải ở tầng page
hook key: ["course-detail", slug, viewerKey], null khi chưa biết viewer
```

## CHẤM

| Mục | Expected | Actual | Kết | Gốc / kế thừa |
|---|---|---|---|---|
| page bốn file | index + component + 2 test | đúng bốn | TRÚNG | gốc |
| khối một file `component.tsx` khi không đọc gì | có (`CoursePricingRail` không có index) | chín khối đều một file, có lý do viết ra | TRÚNG | gốc |
| twin test cho từng khối | có | có | TRÚNG | gốc |
| một chỗ duy nhất chạm thế giới | có | có, khai thành `worldReachedFrom` | TRÚNG | gốc |
| chữ và tiền giải ở nửa nối | có | 23 khoá đều ở page; `Intl.NumberFormat` ở nửa nối | TRÚNG | gốc |
| tham số route | `displayId`, KHÔNG phải id | `slug` | LỆCH | gốc |
| thư mục route | `courses/[displayId]/` | `courses/[slug]/` | LỆCH | gốc |
| `layout.tsx` của route courses | có | không có trong danh sách | THIẾU | kế thừa |
| ba list view định nghĩa cục bộ trong page | có | tách thành khối riêng | KHÁC MÀ ĐƯỢC | gốc |
| `CoursePricingRail` là pure nhưng giữ `useState` | có | có (`selectedIntent`) — nhưng trial bị bỏ nên state này rỗng nghĩa | LỆCH | kế thừa |
| resting đọc từ CONTRACTS chứ không viết số | có | có, ghi thành luật | TRÚNG | gốc |
| props readonly, handler trong `on` | có | có | TRÚNG | gốc |
| tên handler | động từ trần (`act`, `trial`, `addToCart`) | tiền tố `on` (`onCommit`, `onAddToCart`) | LỆCH | gốc |
| meta có mặt mọi file | có | có | TRÚNG | gốc |
| meta nhất quán | KHÔNG nhất quán trong bản thật | nhất quán hơn bản thật | KHÁC MÀ ĐƯỢC | gốc |
| `globals.css` khai biến cùng lúc với class dùng nó | — | có | TRÚNG | gốc |
| hai file locale có trong `files` | phải | CÓ (khác dashboard) | TRÚNG | gốc |
| mọi định danh được gọi đều có file khai | có | `useQueryCoursePricePreviewSwr`, `useViewerIdentity`, `checkoutPathOf`, `setPricedCourseId`, `courseDetailSituationOf`, `courseDetailCopyOf` — **6 định danh treo**; `useRouter` còn thiếu hẳn | LỆCH | gốc |
| `ScrollViewport` được đặt tầng | branch, có meta | chữ ký "chưa đọc được", tầng không xác định | THIẾU | gốc |

**Điểm: 11 TRÚNG · 2 KHÁC MÀ ĐƯỢC · 5 LỆCH · 2 THIẾU trên 20 = 12/20.**

## GATE THIẾU GÌ

- **Mọi định danh được gọi trong `sourceSketch` phải trỏ về một file trong `files`, và gate phải chạy phép đối chiếu đó trước khi giao.** Sáu định danh treo trên một trang là đủ để cổng typecheck đỏ ngay dòng đầu, và gate lints đã nói thẳng rằng lint không nhìn thấy loại lỗi này.
- **Tham số định tuyến phải lấy từ hợp đồng backend, không từ tên chung.** `slug` và `displayId` là hai khoá khác nhau; server trả `COURSE_NOT_FOUND_EXCEPTION` cho cái sai. Gate không có đầu vào nào về backend nên nó không thể biết — nghĩa là gate cần một ô HỎI, không phải một luật.
- **Quy ước tên handler phải chốt một lần** (giống dashboard) — bảng thật dùng động từ trần trong `on`.
- **Một branch được dùng thì phải được đặt tầng và khai chữ ký, kể cả khi nó đã tồn tại.** `ScrollViewport` giữ trần chiều cao, bo góc và nền của cả cột chào giá mà không ai biết nó ngồi ở tầng nào — nếu nó ngoài `leaves`/shell/`Surface*Card` và có import vendor thì rule `vendor-boundary` đỏ ở một file kế hoạch không hề liệt kê.

## GATE IM LẶNG Ở ĐÂU

Từ `uncertain` và `owed` của gate lints trang này:

> "Gate không nói `SurfaceListCard` có nhận một làn props runtime bên cạnh cặp contract cộng render hay không: `props.ts` mô tả `ContractBranchProps` là contract, render, isLoading, còn kế hoạch truyền thêm props và isLoading. Tôi tạm coi đây là lane hợp lệ."

> "Gate không nói khối được nhận làn hành động bằng cách nào: `BlockProps` chỉ có state và props, mà chín khối vẫn cần handler."

> "`ScrollViewport` chưa đọc được từ gate: không biết nó ở tầng nào, chữ ký ra sao, và nó có import vendor hay không."

Ba câu, ba cơ chế cốt lõi của tầng branch, và cả ba đều không có câu trả lời trong cây trust ở thời điểm gate patterns phải viết mã.
