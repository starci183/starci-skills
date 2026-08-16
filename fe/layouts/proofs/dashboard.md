---
id: fe-layouts-proof-dashboard
title: dashboard
slug: /fe/layouts/proofs/dashboard
sidebar_label: dashboard
description: Chấm gate layouts trên màn dashboard — archetype rail-then-main trúng, nhưng tập trạng thái màn hình và measure của trang bị bỏ.
---

# dashboard · gate layouts

> Ngày: 2026-08-16 · Chuỗi: layouts → blocks → principles → patterns → lints

## IN

Gate layouts nhận đúng một thứ: câu nghiệp vụ. Không anchor, không repo, không bảng contract.

```
Học viên đã đăng nhập quay lại StarCi Academy gần như mỗi ngày, và việc đầu tiên họ cần là
biết mình đang đứng ở đâu rồi học tiếp ngay chỗ đang dở. Màn hình mở đầu phải trả lời được
trong một lần đọc: họ là ai, chuỗi ngày học liên tiếp đang giữ được bao nhiêu, tuần này còn
bao nhiêu lượt dùng trợ lý, ví điểm thưởng còn bao nhiêu, bài học và bài tập nào đang dang dở,
nhiệm vụ hôm nay còn thiếu gì và hoàn thành thì được thưởng gì, sáu chỉ tiêu của tuần đạt tới
đâu, mức sẵn sàng đi làm được chấm ra sao và cần cải thiện gì, thử thách tuần đang chạy tới bao
giờ cùng những người vừa vượt qua, hoạt động học cả năm nhìn theo ngày, và sản phẩm vừa có thay
đổi gì. Ngoài bức tranh tổng quan đó, cùng một màn hình còn phải phục vụ ba mối quan tâm khác
khi học viên chủ động hỏi tới: nội dung đang được quan tâm cùng những người đáng theo dõi; các
khóa đã mua đang học tới đâu, khóa nào nên mua thêm và buổi phát trực tiếp nào sắp diễn ra;
bảng thi đua tuần và những người học dẫn đầu. Người chưa đăng nhập không được thấy bất kỳ phần
nào của màn hình này, kể cả một phiên bản rỗng. Mỗi mảng số liệu đến từ một nguồn riêng, nên
mảng nào có kết quả trước thì hiện trước, mảng nào trống hay hỏng thì tự nói ra và tự đưa lối
đi tiếp, không mảng chậm nào được giữ cả màn hình lại chờ; thứ tự đọc của các mảng là do sản
phẩm quy định và không được tự ý đảo hay bỏ bớt.
```

## EXPECTED OUT

Lấy từ code thật.

| Mục | Kỳ vọng | Neo |
|---|---|---|
| route file | chỉ mount, `const DashboardRoute = () => <DashboardPage />` | `src/app/[lang]/dashboard/page.tsx` |
| route family layout | `nav-over-body-page { navigation: double-navbar, body: routed-page-main }`, `routed-page-main` host `main` | `src/app/[lang]/dashboard/layout.tsx`; `contracts/index.ts:733-750` |
| page archetype | `dashboard-rail-then-main` — rail cố định trái + main co giãn phải, xếp chồng khi hẹp | `contracts/index.ts:1048-1082` |
| rail | slot `rail` → `dashboard-rail`, `md:[&>*:first-child]:w-72` + `shrink-0`, đứng TRƯỚC main | `contracts/index.ts:1048` |
| main | slot `main` → MỘT TRONG BA: `dashboard-main` \| `dashboard-tab-main` \| `centred-empty-notice` | `contracts/index.ts:1048` |
| measure | `mx-auto w-full max-w-6xl px-6 py-6` nằm trên chính node archetype | `contracts/index.ts:1048` |
| seam khi hẹp | `flex-col` → `md:flex-row md:items-start`, `gap-6` → `md:gap-8` | như trên |
| state: chưa đăng nhập | trả `null` (KHÔNG có bố cục signed-out) + `router.replace("/authentication")` | `DashboardPage/index.tsx:33-37` |
| state: tab | đọc `searchParams.tab`, kẹp về `overview` nếu ngoài `TAB_IDS` | `DashboardPage/index.tsx:19,30-31` |
| 4 mode | overview (8 section) · explore (1 section) · courses (tab-main) · community (tab-main) | `component.tsx:56-100` |
| fallback | nhánh cuối ternary dựng `centred-empty-notice` + `EmptyNotice` — nhánh CHẾT với route thật | `component.tsx:84-90` |
| quyền sở hữu request | PAGE không giữ request nào; chỉ giữ thứ tự đọc | `component.tsx` |
| landmark | `main` mở ở LAYOUT của route family, không ở page tier | `landmark.mjs` |

## ACTUAL OUT

Chuỗi mù chỉ mang **một** phương án đi tiếp. Ba phương án còn lại của gate layouts không tồn tại trong đầu vào tôi nhận — chúng bị bỏ ngay tại ranh giới layouts → blocks. Cái đọc lại được dưới đây là phương án ĐƯỢC KHUYÊN, tái dựng từ `output.source.contractEntries` và `output.source.files` mà gate lints mang qua.

```
dashboard-rail-then-main   host div   classes [flex, flex-col, gap-8, md:flex-row]
    rail -> dashboard-rail      host aside  [flex, flex-col, gap-4, shrink-0, md:w-72]
    main -> dashboard-mode-main host div    [flex, flex-col, gap-6, min-w-0, grow]

mode = "overview" | "explore" | "courses" | "community"   (đọc từ searchParams, kẹp về overview)
overview -> 7 section; explore/courses/community -> một khối tab
page giữ 0 request; main landmark khai là route-file
```

Không có: trạng thái chưa đăng nhập, nhánh fallback, measure của trang, layout file.

## CHẤM

| Mục | Expected | Actual | Kết | Gốc / kế thừa |
|---|---|---|---|---|
| archetype | rail-then-main | `dashboard-rail-then-main` | TRÚNG | gốc |
| tên khoá archetype | `dashboard-rail-then-main` | trùng từng ký tự | TRÚNG | gốc |
| bề rộng rail | `md:w-72` + `shrink-0` | `md:w-72` + `shrink-0` | TRÚNG | gốc |
| thứ tự rail trước main | rail trước | rail trước | TRÚNG | gốc |
| trục khi hẹp | `flex-col` → `md:flex-row` | `flex-col` → `md:flex-row` | TRÚNG | gốc |
| main co giãn | `min-w-0` + `grow` | `min-w-0` + `grow` | TRÚNG | gốc |
| seam | `gap-6` → `md:gap-8` | `gap-8` cố định | LỆCH | gốc |
| `md:items-start` | có | không | THIẾU | gốc |
| measure của trang | `mx-auto w-full max-w-6xl px-6 py-6` | không có node nào giữ | THIẾU | gốc |
| main là union 3 khoá | `dashboard-main` \| `dashboard-tab-main` \| `centred-empty-notice` | một khoá `dashboard-mode-main` | LỆCH | gốc |
| 4 mode | overview/explore/courses/community | đúng bốn, đúng tên | TRÚNG | gốc |
| nguồn của mode | `searchParams.tab`, kẹp về overview | y hệt | TRÚNG | gốc |
| state chưa đăng nhập | `null` + `router.replace` | không tồn tại | THIẾU | gốc |
| nhánh fallback | có (dù chết) | không tồn tại | KHÁC MÀ ĐƯỢC | gốc |
| page giữ request | không | không | TRÚNG | gốc |
| chủ landmark | layout của route family | khai `route-file` nhưng KHÔNG liệt kê layout.tsx | LỆCH | gốc |

**Điểm best-of-set: không đo được** — chuỗi mù chỉ mang 1 phương án qua ranh giới, ba phương án kia biến mất. Cận dưới bằng điểm recommended.
**Điểm recommended: 9.5/16** (9 TRÚNG, 0.5 cho fallback khác-mà-được, 3 LỆCH, 3 THIẾU).

Đọc thêm: hình dạng hai cột trúng gần như tuyệt đối. Cái hỏng là hai thứ KHÔNG nằm trong hình dạng: tập trạng thái màn hình, và ai giữ measure.

## GATE THIẾU GÌ

- **Tập state của một màn hình phải bao gồm người chưa đăng nhập, kể cả khi câu trả lời là không vẽ gì.** Câu nghiệp vụ nói thẳng "Người chưa đăng nhập không được thấy bất kỳ phần nào của màn hình này, kể cả một phiên bản rỗng" — gate vẫn không đẻ ra một thành viên state nào cho nó. Một trang thiếu state khách sẽ render rail rỗng cho người lạ và không rule nào báo.
- **Measure của một trang thuộc về đúng một node, và node đó phải được gọi tên tại gate layouts.** Không có `max-w-6xl`, cột đọc chạy hết bề ngang màn hình desktop và không đọc được — đúng lý do mà `nav-over-body-page` viết ra trong why của nó.
- **Nếu vùng main nhận nhiều hơn một hình dạng thì slot phải là một union được liệt kê, không phải một khoá gộp.** Gộp ba hình dạng vào `dashboard-mode-main` làm mất chỗ đứng của `centred-empty-notice`, và đó chính là chỗ trạng thái hỏng lẽ ra phải sống.
- **Gate phải chỉ đích danh file mở landmark.** Khai `mainLandmarkOwner: "route-file"` mà không có file nào tên `layout.tsx` trong danh sách là một lời khai không có chủ.

## GATE IM LẶNG Ở ĐÂU

`uncertain` của gate layouts không có trong chuỗi mù. Chỗ im lặng đọc được là gián tiếp, từ gate lints ở cuối chuỗi:

> "Kế hoạch nói mainLandmarkOwner là route-file, còn lý do của entry dashboard-mode-main lại nói route layout đã mở main bằng khoá routed-page-main. Hai lời khai này mâu thuẫn. Không rule nào phân xử được vì cả hai rule landmark đọc từng file một, và tôi bị cấm mở layout thật để xem ai đang giữ landmark."

Mâu thuẫn đó sinh ra ở đây, tại gate layouts, và đi suốt bốn ranh giới mà không ai bắt được.
