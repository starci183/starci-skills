---
id: fe-layouts-laws-l4-tab-switches-panel-route-switches-page-example
title: example.md
slug: /gates/layouts/laws/l4-tab-switches-panel-route-switches-page/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi trường hợp, ngoại lệ và thứ trông giống của bảy mã L4-N, đọc thẳng từ mã sống.
---

# example.md

> Phiên bản: `1.00` · Mô-đun: `l4-tab-switches-panel-route-switches-page` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là mã thật trong repo sống `D:\Repositories\starci-academy-fe` nhánh `main`.
Không có ví dụ bịa: một mã không có chỗ nào đang chạy thì phần ví dụ của nó ghi thẳng là chưa có.

Cặp mạnh nhất của luật này nằm ở hai handler cạnh nhau trong cùng một file, cùng một router, khác
nhau đúng một chữ. Đọc `L4-1` và `L4-2` liền nhau trước khi đọc các mã còn lại.

---

## `L4-1` — đổi trang

### Trường hợp: destination trên navbar

```tsx
const navigate = useCallback((id: string) => {
    const destination = ROUTES.find((route) => route.id === id)
    if (destination !== undefined) router.push(destination.path)
}, [router])
```

`ShellNav\index.tsx:136-139`. Một path, một `push`, một bước lịch sử. Đầu kia là một route file thật.

### Trường hợp: một hàng trong cột điều hướng của trang học

```tsx
openRow: (id: string) => {
    const row = GROUPS.flatMap((group) => group.rows).find((candidate) => candidate.id === id)
    if (row === undefined) return
    router.push(`${base}${row.at}`)
},
```

`LearnShellLayout\index.tsx:187-191`. Đích được ghép từ `base` của khoá học và địa chỉ của hàng, nên
mỗi mode của trang học là một trang riêng có chủ riêng.

### Trông giống nhưng không phải `L4-1`

Một `push` tới một route mà đầu kia chỉ `redirect()` đi tiếp. Đó là một cái cửa, và cửa được phán ở
[`SPINE-6`](../../archetypes/destination-column/INDEX.md), không phải ở đây. Luật này chỉ hỏi cái nút làm gì,
`SPINE-6` mới hỏi đích có nội dung hay không.

---

## `L4-2` — đổi panel và giữ lại được trong link

### Trường hợp sống: bốn tab của dashboard, và nửa thứ nhất của cơ chế

```tsx
const selectTab = useCallback((key: string) => {
    router.replace(key === "overview" ? "/dashboard" : `/dashboard?tab=${key}`)
}, [router])
```

`ShellNav\index.tsx:131-133`. `replace` chứ không `push`, nên URL đổi mà lịch sử không dài thêm. Đặt
ngay dưới đoạn này là `navigate` ở `:136-139` với `push`, và đó là toàn bộ khác biệt giữa hai mã.

Panel nghỉ không xuất hiện trong URL: `overview` ghi ra `/dashboard` trần chứ không ghi
`/dashboard?tab=overview`, nên địa chỉ mặc định chỉ có một dạng.

### Trường hợp sống: nửa thứ hai, trang tự đọc key

```tsx
const requestedTab = searchParams.get("tab")
const selectedTab = TAB_IDS.some((id) => id === requestedTab) ? requestedTab! : "overview"
```

`DashboardPage\index.tsx:30-31`. Key lạ rơi về `overview`. Không blank vùng chính, không redirect,
không 404. Navbar chỉ ghi key, còn nơi biết key nghĩa là gì là trang.

Vùng bị thay là cột chính chứ không phải một hình cột thứ hai, và contract nói thẳng điều đó:

> "the tab orchestrates the order without owning any child request. Which sections a tab names is the
> tab's own content and not a second column shape."

`contracts\index.ts:1075`, contract `dashboard-tab-main` tại `:1070-1076`.

### Trông giống nhưng không phải `L4-2`

Cùng cơ chế nhưng dùng `push`. Nhìn giống hệt, chạy giống hệt, và người đọc bấm Back bốn lần vẫn
chưa ra khỏi dashboard.

### Ngoại lệ: đây là `L4-2` duy nhất đang sống, và nó có tật

Danh sách bốn key nằm trong navbar chứ không nằm trong trang:

```tsx
const DASHBOARD_TABS: ReadonlyArray<{ id: string, icon: IconName }> = [
    { id: "overview", icon: "home" },
    { id: "explore", icon: "explore" },
    { id: "courses", icon: "course" },
    { id: "community", icon: "community" },
]
```

`ShellNav\index.tsx:36-41`, và đường `/dashboard` bị viết cứng ở `:132`. Một trang thứ hai muốn panel
gửi được sẽ phải sửa navbar. Đó là nợ đo được, chép sang trang mới là nhân đôi cái tật.

---

## `L4-3` — đổi panel, không đụng URL

### Trường hợp sống: dải tab dưới đáy của trang học trên màn hình hẹp

```tsx
openMobileTab: (id: string) => {
    const next = validViews.find((view) => view === id)
    if (next !== undefined) setMobileView(next)
},
```

`LearnShellLayout\index.tsx:192-195`. Không router, không query, chỉ `setMobileView`. Đặt cạnh
`openRow` ở `:187-191` trong cùng một khối `on`, nên `L4-1` và `L4-3` sống cách nhau đúng một
handler.

Giá trị được phát xuống qua context ở `:161` và tab nào đang sáng đọc lại từ chính state đó ở `:181`,
nên không có nguồn thứ hai nào để lệch.

### Trông giống nhưng không phải `L4-3`

Một dải tab chỉ đổi cái gạch chân đang sáng mà panel bên dưới đứng yên. Thầy bác thẳng cách làm này,
và lý do đúng bằng một câu: panel phải đổi mà không cần URL đổi. Đổi gạch chân là đổi trạng thái của
cái nút, không phải đổi cái người đọc đang xem.

### Trông giống nhưng không phải `L4-3`

Một view cục bộ nhưng người đọc cần gửi đi. Nếu có yêu cầu gửi được thì mã là `L4-2`, và không có
cách nào nhìn component mà biết, phải hỏi.

---

## `L4-4` — tham số của một khối

### Trường hợp sống: chọn năm cho biểu đồ đóng góp

```ts
"contribution-calendar-heading-row": {
    classes: ["flex", "w-full", "flex-row", "flex-wrap", "items-center", "justify-between", "gap-3"],
    children: {
        total: { leaf: "text", props: { size: "xs", tone: "muted" } },
        years: { leaf: "choice-tabs" },
    },
},
```

`contracts\index.ts:1244-1251`, và `why` của nó ở `:1250` ghi nguyên văn ranh giới:

> "The activity total identifies one contribution plot while the year is a compact parameter of that
> same plot, so its primary segmented choice sits at the trailing edge rather than becoming a
> ShellNav-style secondary navigation line."

Chữ `primary` vẫn còn trong `why`, và đó là chủ ý: điều khiển này
được vẽ ở mức chính, nhưng nó ngồi ở mép cuối của hàng tiêu đề chứ không thành một line kiểu
ShellNav. Vai trò và bề rộng là hai chuyện.

### Trường hợp sống: đổi phạm vi bảng xếp hạng, kèm lý do viết sẵn trong mã

```ts
"scope-switch-row": {
    // A row, so the switch takes the width of its two words. In the page column it was a
    // direct child of a `flex-col`, which stretches its children - and a segmented control
    // spanning the whole measure reads as a band the page is divided by rather than as one
    // control the reader can press.
    classes: ["flex", "flex-row"],
    children: { tabs: { leaf: "choice-tabs" } },
},
```

`contracts\index.ts:1504-1510`. Bình luận này ghi lại đúng cơ chế hỏng: đứng thẳng trong một
`flex-col` thì điều khiển bị kéo giãn, và giãn hết measure thì nó được đọc như một dải chia trang.
Cái `flex-row` bọc ngoài tồn tại chỉ để chặn việc đó.

### Trường hợp sống: đổi lưới hay danh sách cho danh mục khoá

`catalog-search-count-view-row` tại `contracts\index.ts:2092-2098` đặt ô tìm kiếm ở một đầu và
`choice-tabs` chọn kiểu hiển thị ở đầu kia, trong một hàng `justify-between`. Điều khiển đổi hình
dạng của kết quả, không đổi trang và không đổi vùng.

### Ngoại lệ: một tham số được thầy gọi là primary

Đã phán hai chiều và chốt ở `L4-4`. Vòng đầu yêu cầu kéo dải chọn năm thành một line dài như
ShellNav; vòng sau bác chính kết quả đó. Xem [`changelog.md`](./changelog.md) cho hai neo và cho tiêu
chí tách hai vòng.

### Trông giống nhưng không phải `L4-4`

Một điều khiển đổi tham số nhưng lại quyết định cả nội dung của cột. Nếu bấm nó xong thì cột chính
đổi sang một tập section khác chứ không phải cùng một khối vẽ lại, thì đó là `L4-2` hoặc `L4-3`, và
câu hỏi về khả năng gửi link quay lại.

---

## `L4-5` — cuộn trong cùng một tài liệu

### Trường hợp sống: bốn nút section trên trang chi tiết khoá học

```tsx
const selectSection = (section: CourseDetailSection) => {
    setSelectedSection(section)
    const sections = document.querySelectorAll<HTMLElement>("[data-node=\"course-section\"]")
    const target = section === "overview"
        ? document.querySelector<HTMLElement>("[data-node=\"course-hero-heading\"]")
        : section === "curriculum" ? sections.item(2)
            : section === "reviews" ? sections.item(3) : sections.item(4)
    target?.scrollIntoView({ behavior: "smooth", block: "start" })
}
```

`CourseDetailPage\index.tsx:133-140`. Không router, không query, không panel nào bị thay. `state` chỉ
để biết nút nào đang sáng.

Dải chứa bốn nút này là chrome đầy đủ, dính đầu trang và rộng hết chiều ngang:

```ts
"course-section-navigation": {
    host: "nav",
    classes: ["sticky", "top-16", "z-50", "-mt-px", "flex", "w-full", "border-b", "border-separator", "bg-background", "px-6"],
    children: { tabs: { leaf: "choice-tabs" } },
},
```

`contracts\index.ts:2226-2231`. Đây là lý do `L4-5` phải có mã riêng: về chỗ đặt nó giống `L4-2` hoàn
toàn, chỉ handler mới phân biệt được.

### Trông giống nhưng không phải `L4-5`

Dashboard. Cùng leaf `choice-tabs`, cùng dải dính đầu trang, nhưng handler là `router.replace` và
vùng chính bị thay hẳn. Đo bằng mắt thì hai cái này không phân biệt được, nên đừng đo bằng mắt.

### Nợ đã đo: đích gọi theo thứ tự

`sections.item(2)`, `.item(3)`, `.item(4)` gọi đích bằng vị trí trong một danh sách quét được. Chèn
thêm một section vào giữa là ba cái nút cuối trỏ sai, im lặng. Đây đúng là kiểu hỏng mà
[`SPINE-4`](../../archetypes/destination-column/INDEX.md) đã ghi cho chiều rộng, lặp lại ở một chỗ khác. Chi
tiết trong [`audit.md`](./audit.md).

---

## `L4-6` — xem trước rồi mới quyết

### Trường hợp sống: Global Search

```tsx
on={{
    scopeSelect: (key) => { setScope(key as GlobalSearchScope); setSelectedResult(undefined) },
    resultPreview: setSelectedResult,
    resultOpen: openResult,
}}
```

`GlobalSearchOverlay\index.tsx:183-185`. Ba handler, và chỉ một trong ba chạm router:

```tsx
const openResult = useCallback((key: string) => {
    const result = results.find((candidate) => candidate.key === key)
    if (result?.path === undefined || result.path === null) return
    on?.dismissed?.()
    router.push(result.path)
}, [on, results, router])
```

`GlobalSearchOverlay\index.tsx:144-149`. `resultPreview` chỉ ghi state, nên cột chi tiết nạp được và
đọc được. `resultOpen` mới đóng overlay rồi `push`.

Bàn phím tuân đúng cùng ranh giới: `previous` và `next` ở `:186-187` chỉ dời lựa chọn, còn `submit`
ở `:188` gọi lại chính `openResult`, nên Enter là hành vi commit và mũi tên là hành vi preview.

### Trông giống nhưng không phải `L4-6`

Bấm hàng là điều hướng luôn. Thầy bác với lý do người dùng sẽ không bao giờ đọc được panel chi tiết,
và một panel không ai đọc được thì không có lý do tồn tại.

### Ngoại lệ: panel preview có vòng đời riêng

Cột chi tiết được phép đang tải, hỏng và thử lại; `retry` ở `:189` gọi `detail.mutate()` khi đã có
hàng được chọn. Vòng đời đó không nới lỏng gì cho `resultOpen`.

---

## `L4-7` — chưa biết thì hỏi

### Trường hợp: yêu cầu chỉ nói số lượng tab

"Trang hồ sơ có ba tab" không nói được tab có gửi được hay không, và cả `L4-2` lẫn `L4-3` đều dựng
được từ câu đó.

### Chưa có ví dụ sống

Không có chỗ nào trong repo ghi lại một lần dừng để hỏi. Mọi tab đang chạy đều đã có phán quyết, nên
mã này hiện chỉ có phần yêu cầu chứ chưa có phần bằng chứng. Ghi thẳng là chưa có.

### Trông giống nhưng không phải `L4-7`

Yêu cầu đã nói rõ nhưng người viết chưa đọc kỹ. `L4-7` dành cho chỗ bằng chứng thật sự không tồn
tại, không phải chỗ chưa tìm.

---

## Ánh xạ từ yêu cầu sang mã

| Yêu cầu nghe được | Mã | Ghi chú |
|---|---|---|
| "bấm vào đây thì sang trang kia" | `L4-1` | `push` một path, và đầu kia phải có chủ thật |
| "gửi link cho bạn thì phải ra đúng tab này" | `L4-2` | `replace` một query, trang tự đọc key, key lạ về panel nghỉ |
| "trên mobile cho đổi qua lại giữa mấy view" | `L4-3` | state cục bộ, URL đứng yên |
| "cho chọn năm / chọn phạm vi / đổi lưới với danh sách" | `L4-4` | bề rộng tự nhiên, ngồi trong cột của khối |
| "làm cái tab để nhảy xuống phần đánh giá" | `L4-5` | cuộn theo danh tính section, không đổi panel |
| "bấm vào kết quả cho hiện chi tiết bên phải" | `L4-6` | preview và mở là hai nút |
| "trang này có ba tab" | `L4-7` | hỏi lại: *có bao giờ cần gửi đúng tab này cho ai đó không?* |
| "cái tab này vừa đổi panel vừa sang trang" | hỏi lại | một điều khiển hai đích thì gạch chân không sáng cho đích nào được |
