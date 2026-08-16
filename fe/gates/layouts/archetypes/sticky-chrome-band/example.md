---
id: fe-layouts-archetypes-sticky-chrome-band-example
title: example.md
slug: /gates/layouts/archetypes/sticky-chrome-band/example
sidebar_label: example.md
sidebar_position: 2
description: Từng ca của mọi mã CHROME-N, từ câu founder gõ đến mảnh LayoutPlan mà gate trả ra.
---

# example.md

> Phiên bản: `1.00` · Mô-đun: `sticky-chrome-band` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mỗi ví dụ đi đúng một đường: **đầu vào thật → câu phân định → mã → mảnh `LayoutPlan`**. Mảnh
`LayoutPlan` viết đúng theo [`../gate.schema.json`](../../gate.schema.json), vì đó là thứ gate `blocks`
sẽ đọc, không phải bản tóm tắt cho người.

---

## `CHROME-1` — băng một hàng

### Ca: "làm trang giỏ hàng"

Câu phân định: giỏ hàng có tập mục đóng nào của cùng một tài liệu không? Không. → `CHROME-1`.

```json
{
  "pageId": "cart",
  "archetype": "sticky-chrome-band",
  "routeCluster": "cart",
  "frameContract": "double-navbar",
  "reusesLayout": "ShellNav",
  "opensMainLandmark": false,
  "regions": [
    {
      "role": "primary",
      "host": "header",
      "persistence": "dung-yen-pixel",
      "narrowBehaviour": "bien-mat",
      "narrowMeasure": "viewport-md",
      "replacementWhenGone": "khong-co",
      "selector": "khong-dung-selector",
      "stickyOffsetToken": "khong-sticky",
      "maxHeightToken": "khong-gioi-han",
      "ownsScroll": false,
      "reason": {
        "why": "Brand, ba đích đến và bộ công cụ tài khoản đứng yên qua mọi route trong cụm, nên chúng thuộc băng chứ không thuộc trang.",
        "anchorKind": "neo-code",
        "anchor": "D:\\Repositories\\starci-academy-fe\\src\\components\\contracts\\index.ts:1691"
      }
    },
    {
      "role": "main",
      "host": "main",
      "persistence": "ve-lai-theo-route",
      "narrowBehaviour": "khong-doi",
      "narrowMeasure": "khong-do",
      "selector": "khong-dung-selector",
      "stickyOffsetToken": "khong-sticky",
      "maxHeightToken": "khong-gioi-han",
      "ownsScroll": false,
      "reason": {
        "why": "Route file mở landmark main chứ không phải layout, nếu không tài liệu sẽ có hai main.",
        "anchorKind": "neo-code",
        "anchor": "D:\\Repositories\\starci-academy-fe\\src\\components\\layouts\\LearnShellLayout\\component.tsx:13-15"
      }
    }
  ]
}
```

`opensMainLandmark` là `false` ở **kế hoạch của layout**: chính route file mở `main`. Nếu cụm route
đã tự bọc `routed-page-main` thì trang bên dưới **không** được khai `host: "main"` lần nữa — đó đúng
là vi phạm đang sống trong repo.

---

## `CHROME-2` — băng hai hàng

### Ca: "trang chi tiết khoá học có bốn mục"

Câu phân định: bốn mục có thuộc cùng một tài liệu không? Có — vẫn cùng một khoá học. → `CHROME-2`.

```json
{
  "pageId": "course-detail",
  "archetype": "sticky-chrome-band",
  "routeCluster": "courses",
  "frameContract": "double-navbar",
  "opensMainLandmark": false,
  "regions": [
    { "role": "primary", "host": "header", "persistence": "dung-yen-pixel", "narrowBehaviour": "bien-mat", "narrowMeasure": "viewport-md", "selector": "khong-dung-selector", "reason": { "why": "Hàng một giữ brand và tools, và bỏ ba đích đến vì hàng hai đã mang điều hướng ngữ cảnh của chính trang này.", "anchorKind": "neo-tu-choi", "anchor": "D:\\Repositories\\starci-academy-backend\\.workflows\\fidel\\starci-academy\\courses-runtime-projection-i18n-20260815-01.md:521", "quote": "với tabs này thì bỏ mấy cái nội dung ở navbars ở trên đi" } },
    { "role": "bottom", "host": "nav", "persistence": "dung-yen-pixel", "narrowBehaviour": "khong-doi", "narrowMeasure": "khong-do", "selector": "khong-dung-selector", "stickyOffsetToken": "khong-sticky", "reason": { "why": "Bốn control di chuyển trong một tài liệu khoá học nên chúng chia nhau một landmark điều hướng và một baseline chạy hết ngang ngay dưới hàng một.", "anchorKind": "neo-code", "anchor": "D:\\Repositories\\starci-academy-fe\\src\\components\\contracts\\index.ts:2226-2230" } },
    { "role": "rail", "host": "aside", "persistence": "dung-yen-pixel", "narrowBehaviour": "khong-doi", "narrowMeasure": "viewport-md", "widthOwner": "chinh-vung-nay", "widthClass": "w-80", "selector": "vi-tri-first-child", "stickyOffsetToken": "top-course-rail", "maxHeightToken": "khong-gioi-han", "ownsScroll": false, "reason": { "why": "Rail dính dưới một băng hai hàng nên phải trừ đúng chiều cao của băng đó chứ không dùng token chung của băng một hàng.", "anchorKind": "neo-tu-choi", "anchor": "D:\\Repositories\\starci-academy-backend\\.workflows\\fidel\\starci-academy\\course-pricing-rail-trial-phase-density-20260815-01.md:279", "quote": "Generic offset khiến rail chui lên dưới course navbar." } }
  ]
}
```

Chú ý `"selector": "vi-tri-first-child"` — khai đúng cái đang chạy, kể cả khi nó là thứ đã bị bác ở
nơi khác. Khai sai để cho đẹp là cách một vi phạm biến mất khỏi sổ.

### Sai, và vì sao

```text
pt-6 trên page root, tabs bắt đầu ở 88.8px      → tabs thành một khối nội dung, không phải tầng hai
position: relative cho tab layer                → tabs trôi mất khi cuộn
border-b ở cả hai hàng                          → hai bar rời nhau, không phải một landmark
bỏ breadcrumb vì "đã có tabs"                   → đã bị bác: hai vùng khác vai trò
top-rail cho rail của trang hai hàng            → rail chui lên dưới hàng thứ hai
```

---

## `CHROME-3` versus `CHROME-4` — hai nhánh của một phân loại

### Ca: "thêm chỗ đổi tab ở dashboard: tổng quan / khoá học / hoạt động"

Câu phân định: sau khi bấm, vùng nội dung của trang đã đổi. → `CHROME-3`.

```json
{
  "id": "dashboard-tabs",
  "region": "bottom",
  "order": 0,
  "renderForm": "global-touchpoint",
  "reason": {
    "why": "Điều khiển này thay cả vùng nội dung của bảng điều khiển nên nó chạy hết chiều ngang như một line của shell, và sống ở hàng hai của băng.",
    "anchorKind": "neo-tu-choi",
    "anchor": "D:\\Repositories\\starci-academy-backend\\.workflows\\fidel\\starci-academy\\dashboard-contribution-primary-tabs.md:82",
    "quote": "nó phải là 1 line dài như shellnav"
  }
}
```

### Ca: "cho chọn năm cho lịch đóng góp"

Cùng một trang, cùng một founder, ngược kết quả. Câu phân định: sau khi bấm, vẫn là lịch đóng góp,
chỉ khác tham số năm. → `CHROME-4`.

```json
{
  "id": "contribution-year",
  "region": "main",
  "order": 1,
  "renderForm": "owned-item",
  "reason": {
    "why": "Điều khiển đổi một tham số của một hình chứ không đổi vùng nội dung, nên nó đứng gọn ở mép phải hàng tiêu đề của chính hình đó.",
    "anchorKind": "neo-tu-choi",
    "anchor": "D:\\Repositories\\starci-academy-backend\\.workflows\\fidel\\starci-academy\\dashboard-contribution-primary-tabs.md:242",
    "quote": "It changes one visualization parameter, not the page's content region."
  }
}
```

### Bảng phân định

| Yêu cầu | Sau khi bấm | Mã | Kết quả |
|---|---|---|---|
| Tab tổng quan / hoạt động của một trang | Vùng nội dung đổi | `CHROME-3` | `underlined-tab-strip` `w-full` ở hàng hai |
| Chọn năm cho lịch đóng góp | Một hình vẽ lại | `CHROME-4` | `choice-tabs` gọn cạnh hình |
| Chọn khoảng thời gian cho một biểu đồ | Một hình vẽ lại | `CHROME-4` | gọn cạnh biểu đồ |
| Bốn mục của một tài liệu khoá học | Vùng nội dung đổi | `CHROME-3` | hàng hai của băng |
| Bộ lọc `Tất cả / Đang học / Đã xong` cho một danh sách | Một hình vẽ lại (cùng danh sách, khác tham số) | `CHROME-4` | gọn trên đầu danh sách đó |

Dòng cuối là dòng dễ chọn sai nhất: bộ lọc **trông** như tab. Câu phân định vẫn nguyên: danh sách vẫn
là danh sách đó, chỉ khác tham số lọc.

---

## `CHROME-5` — tab hay route

| Yêu cầu | Câu hỏi | Mã | Cơ chế |
|---|---|---|---|
| "Đổi giữa nội dung, bài học và dàn ý trên mobile" | Có sinh trang mới không? Không | `CHROME-5` tab | state cục bộ `setMobileView` |
| "Bốn mục trang khoá học" | Có sinh trang mới không? Không | `CHROME-5` tab | `useState` |
| "Các mặt hồ sơ công khai: overview, projects, cv…" | Có route thật cho từng mặt không? Có | `CHROME-5` route | `router.push` |
| "Tab dashboard, muốn share được link" | Chủ sở hữu route có đổi không? Không | `CHROME-5` tab ghi query | `router.replace("?tab=")` |

### Sai, và vì sao

```text
Dùng route links làm mobile tab                → đã bị bác: legacy đổi view mà không đổi route
Tab viết lại breadcrumb                        → breadcrumb giữ tổ tiên route, tab không sở hữu nó
Bỏ breadcrumb vì đã có tab                     → đã bị bác trực tiếp
```

---

## `CHROME-6` — băng khi hẹp

```json
{
  "role": "primary",
  "narrowBehaviour": "bien-mat",
  "narrowMeasure": "viewport-md",
  "replacementWhenGone": "khong-co",
  "reason": {
    "why": "Route pills và cụm search/locale/theme biến mất theo cụm ở cùng một breakpoint, còn lại brand và các nút tài khoản, và không có gì thay thế chúng.",
    "anchorKind": "neo-code",
    "anchor": "D:\\Repositories\\starci-academy-fe\\src\\components\\contracts\\index.ts:1716"
  }
}
```

**Đừng khai `"replacementWhenGone": "thanh-day-mobile"` ở đây.** Đó là hành vi của cột learn, không
phải của băng. Enum có hai giá trị vì có hai hành vi thật, không phải để chọn cái nghe hợp lý hơn.

---

## `CHROME-7` — panel của băng

```json
{
  "overlays": [
    { "name": "GlobalSearchOverlay", "mountOwner": "layout", "triggerRegion": "primary", "width": "cover", "buildsCardInside": false, "reason": { "why": "Search workspace cần đủ chiều rộng để vừa đổi nhóm vừa xem ngữ cảnh, nên bề rộng là một lựa chọn sản phẩm chứ không phải mặc định của modal.", "anchorKind": "neo-tu-choi", "anchor": "D:\\Repositories\\starci-academy-backend\\.workflows\\designs\\starci-academy\\global-search-modal-20260815.md:259", "quote": "Thầy ưu tiên dễ thao tác, không bắt modal hẹp" } },
    { "name": "CartDrawer", "mountOwner": "layout", "triggerRegion": "primary", "width": "chua-do-duoc", "buildsCardInside": false, "reason": { "why": "Điều khiển mở nằm trong chrome nên panel phải sống lâu hơn route dưới nó, và một drawer mỗi trang là một focus trap mỗi trang.", "anchorKind": "neo-code", "anchor": "D:\\Repositories\\starci-academy-fe\\src\\components\\layouts\\ShellNav\\index.tsx:163-168" } },
    { "name": "SignInOverlay", "mountOwner": "layout", "triggerRegion": "primary", "width": "chua-do-duoc", "buildsCardInside": false, "reason": { "why": "Overlay đăng nhập mở được từ mọi route trong cụm nên nó thuộc băng, còn bề rộng của nó chưa từng được đo hay phán quyết.", "anchorKind": "suy-luan-khong-co-neo" } }
  ]
}
```

`"width": "chua-do-duoc"` là câu trả lời đúng khi chưa đo. `"cover"` chỉ dành cho cái đã đo thật.

---

## Ánh xạ yêu cầu sang mã

| Founder gõ | Câu phân định | Mã |
|---|---|---|
| "làm trang landing" | Người đọc có lối ra không? | `CHROME-1` nếu có băng; nếu founder muốn trang đứng ngoài mọi cụm thì `routeCluster: khong-thuoc-cum-nao` và phải khai `owed` |
| "trang này cần 4 mục" | Bốn mục cùng một tài liệu? | `CHROME-2` |
| "cho cái tab dài như shellnav" | Bấm xong vùng nội dung đổi? | `CHROME-3` nếu có; nếu không thì hỏi lại **một** câu chứ không chiều theo hình dáng |
| "để cái chọn năm gọn thôi" | Bấm xong một hình vẽ lại? | `CHROME-4` |
| "bỏ mấy cái ở navbar trên đi" | Hàng hai đã mang đích đến chưa? | `CHROME-8` |
| "modal tìm kiếm rộng ra" | Bên trong panel có bao nhiêu việc? | `CHROME-7`, `width: cover` |
| "thu nhỏ màn hình thì giấu bớt" | Cụm nào biến mất trọn cụm? | `CHROME-6` |

## Sai lầm lặp lại nhiều nhất

1. Chọn `CHROME-3` vì điều khiển **trông** như tab, chứ không vì vùng nội dung đổi.
2. Dùng chung một token offset cho trang một hàng và trang hai hàng.
3. Cho hàng hai một `border-b` riêng, thành hai bar rời.
4. Mount overlay trong page thay vì trong layout, rồi có một focus trap mỗi trang.
5. Bỏ breadcrumb khi thêm tab.
6. Khai `selector: dinh-danh-data-node` cho một vùng đang thật sự nhắm bằng `*:first-child`.
7. Chép vi phạm đang sống của `ShellNav` vào kế hoạch mới vì "repo đang làm thế".
