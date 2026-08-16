---
id: fe-layouts-proof-dashboard
title: dashboard
slug: /gates/layouts/proofs/dashboard
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

## Lượt 2 — 2026-08-17

### IN (lượt 2)

Cùng một câu nghiệp vụ, không đổi một chữ.

### ACTUAL OUT (lượt 2)

Chuỗi mù lượt hai lại chỉ mang **một** đối tượng qua ranh giới cho mỗi trang, và đối tượng đó là
đầu ra gate cuối. Không có tập phương án của gate layouts trong chuỗi. Khác lượt một ở đúng một
điểm, và điểm đó quyết định: đầu ra lints lần này mang theo `source.files[]` với **văn bản mã đầy
đủ của cả 23 file**, nên bố cục đọc lại được từng ký tự thay vì đọc qua tên khoá.

```
src/app/[lang]/dashboard/layout.tsx
  Tree "nav-over-body-page"
    nav  -> projection "underlined-tab-strip"  -> <DashboardTabStrip />
    body -> projection "routed-page-main" -> Tree "routed-page-main"
              page -> defineLeafComponent("page", {}, () => children)

src/app/[lang]/dashboard/page.tsx            -> <DashboardOverviewPage />   (một dòng)
src/app/[lang]/dashboard/explore/page.tsx    -> <DashboardExplorePage />
src/app/[lang]/dashboard/courses/page.tsx    -> <DashboardCoursesPage />
src/app/[lang]/dashboard/community/page.tsx  -> <DashboardCommunityPage />
src/app/[lang]/dashboard/landmark.test.tsx   -> đếm đúng MỘT main, nav nằm ngoài main

dashboard-rail-then-main
  mx-auto flex w-full max-w-6xl flex-col gap-6 md:gap-8 px-6 py-6 md:flex-row md:items-start
  md:[&>*:first-child]:w-72 md:[&>*:first-child]:shrink-0
  md:[&>*:last-child]:min-w-0 md:[&>*:last-child]:grow
  { rail: dashboard-rail, main: stacked-label-row-sections | centred-empty-notice }

dashboard-rail   flex w-full flex-col gap-6      { identity: profile-over-stat-rows }
DashboardOverviewPage   main = 7 section
DashboardCommunityPage  main = 1 section
DashboardExplorePage / DashboardCoursesPage  chỉ có route file, không có thân
```

### CHẤM (lượt 2)

Cùng 16 mục của lượt một, không thêm không bớt.

| Mục | Expected | L1 | L2 | Kết L2 | Δ | Gốc / kế thừa |
|---|---|---|---|---|---|---|
| archetype | rail-then-main | TRÚNG | `dashboard-rail-then-main` | TRÚNG | = | gốc |
| tên khoá archetype | trùng ký tự | TRÚNG | trùng ký tự | TRÚNG | = | gốc |
| bề rộng rail | `w-72` + `shrink-0` | TRÚNG | trên CHA bằng `md:[&>*:first-child]:` | TRÚNG | = | gốc |
| thứ tự rail trước main | rail trước | TRÚNG | rail trước | TRÚNG | = | gốc |
| trục khi hẹp | `flex-col` → `md:flex-row` | TRÚNG | có | TRÚNG | = | gốc |
| main co giãn | `min-w-0` + `grow` | TRÚNG | trên CHA, đúng con cuối | TRÚNG | = | gốc |
| seam | `gap-6` → `md:gap-8` | LỆCH | **có cả hai** | TRÚNG | ↑ | gốc |
| `md:items-start` | có | THIẾU | **có** | TRÚNG | ↑ | gốc |
| measure của trang | `mx-auto w-full max-w-6xl px-6 py-6` | THIẾU | **có đủ năm** | TRÚNG | ↑ | gốc |
| main là union 3 khoá | 3 | LỆCH (1) | 2, thiếu `dashboard-tab-main`, khoá đầu đổi tên | LỆCH | ↑ nửa | gốc |
| 4 mode | overview/explore/courses/community | TRÚNG | đúng bốn, đúng tên | TRÚNG | = | gốc |
| nguồn của mode | `searchParams.tab`, kẹp về overview | TRÚNG | **bốn URL riêng** + `useSelectedLayoutSegment` | LỆCH | ↓ | gốc |
| state chưa đăng nhập | `null` + `router.replace` | THIẾU | không một dòng nào | THIẾU | = | gốc |
| nhánh fallback | có (dù chết) | KHÁC MÀ ĐƯỢC | `centred-empty-notice` có trong union, không nhánh nào dựng | KHÁC MÀ ĐƯỢC | = | gốc |
| page giữ request | không | TRÚNG | không, và viết thành lý do | TRÚNG | = | gốc |
| chủ landmark | layout của route family | LỆCH | `layout.tsx` có mặt, `routed-page-main` host `main`, có test đếm | TRÚNG | ↑ | gốc |

**Điểm best-of-set: vẫn không đo được.** Lược đồ `output` của gate layouts đã được vá thành tập
phương án, nhưng thứ đi qua ranh giới sang người chấm vẫn là **một** đối tượng của gate cuối. Ô vá
nằm ở lược đồ; chỗ hỏng nằm ở đường truyền.

**Điểm recommended: 12.5/16 = 78%** (12 TRÚNG, 0.5 khác-mà-được, 2 LỆCH, 1 THIẾU).
**Δ so với lượt một: 9.5/16 = 59% → 78%, +19 điểm phần trăm.**

Toàn bộ mức tăng nằm trong một cụm: bốn mục về measure và seam. Lượt một trang này mất measure,
mất `md:items-start`, mất `gap-6`; lượt hai có đủ, đúng thứ tự, đúng breakpoint. Đổi lại có đúng
một mục tụt: nguồn của mode chuyển từ `searchParams` sang bốn URL.

### GATE THIẾU GÌ (lượt 2)

- **Bốn mặt của một màn hình là bốn giá trị của một tham số hay bốn địa chỉ — gate phải hỏi, không
  được chọn.** Lượt một chọn `searchParams` và trúng; lượt hai chọn bốn route và trượt, với một lý
  do viết ra rất chỉnh ("một chỉ số tab trong bộ nhớ thì không gửi cho ai được"). Cả hai lần đều
  không có căn cứ trong câu nghiệp vụ. Đây là mục số một của phần *hỏi ngược*, không phải mục cần
  thêm luật.
- **Một trạng thái người-xem (chưa đăng nhập) là một VÙNG của bố cục, không phải một chi tiết của
  khối.** Hai lượt liên tiếp mất nó ở cùng chỗ. Câu luật: *bố cục phải liệt kê tập người xem trước
  khi liệt kê vùng, và mỗi người xem phải được gán một cây — kể cả cây rỗng.*
- **Union của một slot phải được liệt kê đủ, và một thành viên bị bỏ là một mặt của sản phẩm biến
  mất.** `dashboard-tab-main` rơi ở cả hai lượt, và hệ quả là ba mặt tab không có hình dạng riêng.

### GATE IM LẶNG Ở ĐÂU (lượt 2)

Từ `uncertain` của bước cuối, nguyên văn, phần chạm tới bố cục:

> "Tôi không đọc được bảng contract có sẵn của repo sống, nên host của `routed-page-main`, chữ ký
> của mọi entry cũ, và sự tồn tại của các leaf `tab`, `task-mark`, `select`, `day-cell` đều là giả
> định lấy từ `contractEntries` của gate patterns chứ không phải từ đo."

Câu này thuộc về gate layouts: nó là câu hỏi "bảng thật đang có gì" và nó phải được hỏi TRƯỚC khi
đặt vùng, chứ không phải sau khi mã đã viết.
