---
id: fe-blocks-proof-courses
title: courses
slug: /fe/blocks/proofs/courses
sidebar_label: courses
description: Chấm gate blocks trên trang kho khóa học — thẻ khóa học trúng tên, nhưng hai điều khiển đã có leaf bị dựng lại thành khối và nhóm khóa đã sở hữu biến mất.
---

# courses · gate blocks

> Ngày: 2026-08-16 · Chuỗi: layouts → blocks → principles → patterns → lints

## IN

Đầu ra gate layouts, không có nguyên văn trong chuỗi mù. Phần đọc lại được: một trang không rail, một lưới thẻ có bước `lg:grid-cols-3`, một thanh công cụ, một bộ chuyển chặng. Cộng câu nghiệp vụ (`.claude/fe/layouts/proofs/courses.md` § IN).

## EXPECTED OUT

| Vùng | Ai vẽ | Chi tiết đáng chấm | Neo |
|---|---|---|---|
| header | PAGE | `page-header-stack` = leaf `breadcrumbs` + leaf `heading` level 1 | `CoursesCatalogPage/component.tsx` |
| toolbar | PAGE | leaf `search-box` + leaf `text` (count, optional) + leaf `choice-tabs` variant **primary** | như trên |
| owned | projection sang **`MyCoursesProgress`** | page CHỈ quyết vùng này có xuất hiện không; block tự fetch, tự phrasing, tự trạng thái | như trên |
| discover | PAGE | `catalog-section-group` = heading level 2 + MỘT TRONG `catalog-card-grid` \| `catalog-card-list` | như trên |
| thẻ | block **`CourseCatalogCard`** | 3 state pending·ready·**adding**; hai cách bày grid/line; `adding` do lớp connected tự đặt | `blocks/courses/CourseCatalogCard/index.tsx` |
| giá cá nhân | trong block | `useQueryCoursePricePreviewSwr` chỉ ĐÈ khi `isPersonalPrice`, không bao giờ nháy skeleton lên giá đang đúng | như trên |
| overlay giá | PAGE giữ | "Hai mươi card không được giữ hai mươi focus trap" | như trên |
| notice | PAGE | ba câu khác nhau cho failed / filtered-empty / empty | như trên |
| pager | leaf `pagination` | 1-based ở UI, 0-based ở request, đổi đúng một chỗ | như trên |
| dedupe | PAGE | lọc `isEnrolled` và `ownedIds` khỏi discover | như trên |

## ACTUAL OUT

Một phương án đi qua; các phương án còn lại không có trong chuỗi mù. Đọc lại được:

```
Khối: CourseCatalogCard   (index + component; giữ isInCart, useMutateAddToCartSwr,
                           import useQueryCourseRowSwr — hook KHÔNG có trong danh sách file)
      CatalogToolbar      (index + component)
      CatalogPager        (một file index.tsx; Tree contract prev-position-next-row;
                           backward/position/forward là 3 leaf Button+Text)
Leaf mới: ViewModeSwitch, TextLink (được gọi, không có thân)
"Ba file connected cùng gọi useQueryCourseCatalogSwr với ba lần tự bóc query và page từ địa chỉ"
Union thêm: aspect-video, mt-auto, lg:grid-cols-3
```

Không thấy: `MyCoursesProgress`, vùng owned, dedupe, notice ba câu, price preview, overlay giá, `catalog-card-line`.

## CHẤM

| Mục | Expected | Actual | Kết | Gốc / kế thừa |
|---|---|---|---|---|
| tên khối thẻ | `CourseCatalogCard` | `CourseCatalogCard` | TRÚNG | gốc |
| thẻ giữ giỏ hàng của chính nó | `useMutateAddToCartSwr` + `isInCart` cục bộ | y hệt | TRÚNG | gốc |
| state `adding` do connected tự đặt | có | có (`cart.isMutating`) | TRÚNG | gốc |
| khóa cache theo từng thẻ | một hook một khóa | `[MUTATE_ADD_TO_CART_SWR_KEY, courseId]`, "một press không được đẻ 12 spinner" | TRÚNG | gốc |
| giá cá nhân hóa | `useQueryCoursePricePreviewSwr`, chỉ đè khi là giá riêng | không có dấu vết | THIẾU | gốc |
| lối xem cách tính giá | `priceDetailLabel` → overlay do PAGE giữ | không có dấu vết | THIẾU | gốc |
| hai cách bày | `catalog-card` (grid) và `catalog-card-line` (line), KHÁC nhau về nội dung | chỉ đọc được `catalog-card-grid` | không đo được | — |
| công tắc cách đọc | leaf `choice-tabs` có sẵn | leaf MỚI `ViewModeSwitch` | LỆCH | gốc |
| bộ chuyển chặng | leaf `pagination` có sẵn | khối MỚI `CatalogPager` + entry mới | LỆCH | gốc |
| toolbar do PAGE vẽ | có | khối `CatalogToolbar` | LỆCH | gốc |
| nhóm khóa đã sở hữu | projection `MyCoursesProgress` | không tồn tại | THIẾU | gốc |
| dedupe khóa đã mua khỏi kho bán | có | không tồn tại | THIẾU | gốc |
| ba câu notice khác nhau | có | không đọc được | không đo được | — |
| ai giữ query/page/view | PAGE | ba file connected tự đọc lại | LỆCH | gốc |
| header có breadcrumb thật | leaf `breadcrumbs` | không đọc được | không đo được | — |

**Điểm best-of-set: không đo được.** **Điểm recommended: 4/12 mục đo được** (4 TRÚNG, 4 LỆCH, 4 THIẾU).

Đây là trang tệ nhất của gate blocks. Bốn TRÚNG đều nằm trong một khối duy nhất, `CourseCatalogCard`, và cả bốn đều là những thứ nghiệp vụ nói ra bằng chữ. Mọi thứ nghiệp vụ nói ra nhưng KHÔNG gắn với một thẻ — nhóm khóa đã sở hữu, giá theo người, cách nhớ preference — đều rơi.

## GATE THIẾU GÌ

- **Một câu nghiệp vụ ràng buộc hai nhóm với nhau ("khóa đã sở hữu tuyệt đối không được chào bán lại") phải sinh ra CẢ hai nhóm và một luật dedupe giữa chúng.** Gate chỉ sinh ra nhóm bán.
- **Một điều khiển đã có leaf trong từ vựng thì không được dựng lại thành khối.** Cả `CatalogPager` lẫn `ViewModeSwitch` là bản dựng lại của `pagination` và `choice-tabs`; giá phải trả là một entry `prev-position-next-row` mới, một host `nav` viết tay và một landmark không tên — chính ba chỗ gate lints sau đó chặn lại.
- **Ai giữ tham số truy vấn phải được chốt ở đúng một tầng, và mọi khối khác nhận nó xuống.** Ba file connected cùng tự bóc `searchParams` là ba nguồn sự thật cho một câu hỏi.
- **Nếu một con số hiển thị phụ thuộc danh tính người xem, khối phải nói rõ nó chờ ai và nó KHÔNG được nháy một con số tạm.** Nghiệp vụ nói "giá phải đúng với chính người đang xem"; kế hoạch không có chỗ nào cho việc đó.

## GATE IM LẶNG Ở ĐÂU

Từ owed mà gate lints trang này ghi lại:

> "CourseCatalogCard/index.tsx import useQueryCourseRowSwr từ useQueryCourseCatalogSwr, nhưng hook đó KHÔNG có trong danh sách file và không được định nghĩa ở đâu cả."

Một khối gọi một hook không tồn tại đi qua ba ranh giới và chỉ bị phát hiện ở gate cuối, bằng mắt, vì lint không phân giải module. Ranh giới blocks là chỗ lẽ ra phải liệt kê từng nguồn dữ liệu của từng khối và đối chiếu với danh sách file.
