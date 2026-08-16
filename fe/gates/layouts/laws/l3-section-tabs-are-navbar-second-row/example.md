---
id: fe-layouts-laws-l3-section-tabs-are-navbar-second-row-example
title: example.md
slug: /gates/layouts/laws/l3-section-tabs-are-navbar-second-row/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi trường hợp, ngoại lệ và thứ trông giống của bảy mã L3-N, đọc thẳng từ contract và layout đang chạy.
---

# example.md

> Phiên bản: `1.00` · Mô-đun: `l3-section-tabs-are-navbar-second-row` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là mã thật trong repo sống `D:\Repositories\starci-academy-fe` nhánh `main`.
Không có ví dụ bịa: một mã không có chỗ nào đang chạy thì phần ví dụ của nó ghi thẳng là chưa có.

---

## `L3-1` — navbar mang hàng tabs của chính nó

### Trường hợp: dashboard, hai hàng trong một container

```ts
"double-navbar": {
    classes: ["sticky", "top-0", "z-50", "w-full", "border-b", "border-separator", "bg-background"],
    children: {
        primary: { contract: "brand-links-then-tools-bar" },
        bottom: { contract: "underlined-tab-strip", optional: true },
    },
    why: "The active page's tab strip is the navbar's second layer, so both rows move as one sticky landmark and share one bottom border instead of drawing two unrelated bars.",
},
```

Bốn tiêu chí đạt bằng cấu trúc chứ không bằng căn chỉnh. `sticky top-0` thuộc container nên hai hàng
ghim cùng nhau. `border-b` thuộc container nên chỉ có một nét. `w-full` thuộc container nên hàng tabs
rộng bằng navbar. Và không có class khoảng cách nào giữa `primary` với `bottom`, nên không có chỗ nào
để hở.

Neo: `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:1691-1698`.

### Trường hợp: layout của cụm tự tính được tập tab

```tsx
const dashboardTabs: ReadonlyArray<ShellNavTab> | undefined = pathname.startsWith("/dashboard")
    ? DASHBOARD_TABS.map((tab) => ({
        ...tab,
        label: t(`tabs.${tab.id}`),
        isCurrent: tab.id === (searchParams.get("tab") ?? "overview"),
    }))
    : undefined
const tabs = dashboardTabs
```

Đây là chỗ `L3-1` và `L3-2` tách nhau, và nó tách bằng dữ liệu. `ShellNav` chỉ cần pathname là dựng
xong tập tab, không chờ gì cả. Dòng cuối nói rõ phạm vi: hôm nay đúng một cụm đi lối này.

Neo: `D:\Repositories\starci-academy-fe\src\components\layouts\ShellNav\index.tsx:122-129`.

### Trông giống nhưng không phải `L3-1`

Một trang trong cụm `dashboard` mà tự dựng thêm một dải tab nữa. Slot `bottom` đã được điền ở tầng
navbar rồi, nên dải thứ hai không phải là tầng hai của navbar, nó là một hàng chrome thứ ba trôi
trong body và rơi vào `L3-4`.

---

## `L3-2` — trang dựng `nav` riêng rồi dán lên navbar

### Trường hợp sống: chi tiết khoá học

```ts
"course-section-navigation": {
    host: "nav",
    classes: ["sticky", "top-16", "z-50", "-mt-px", "flex", "w-full", "border-b", "border-separator", "bg-background", "px-6"],
    children: { tabs: { leaf: "choice-tabs" } },
    why: "… Their sticky layer stays directly under the primary navbar while scrolling, and its opaque surface overlaps the primary navbar's bottom stroke by exactly one pixel, leaving the same single divider below the complete two-row navbar as Dashboard; …",
},
```

Ba class làm ba việc và bỏ đi bất kỳ cái nào là hỏng một tiêu chí. `sticky top-16` ghim đúng ở chiều
cao hàng navbar, nên hàng tabs không cuộn mất và cũng không chui lên dưới. `-mt-px` kéo lên một pixel
để mặt đục của nó phủ nét kẻ của hàng trên, nên người đọc còn thấy một nét chứ không thấy hai.
`w-full` giữ nó rộng bằng navbar trong khi body bên dưới bị chặn ở `max-w-6xl`.

Neo: `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:2226-2231`.

### Trường hợp: hàng tabs là anh em của body, không phải con đầu lòng của body

```tsx
render={defineContractComponent("course-detail-page", {
    navigation: defineContractComponent("course-section-navigation", { tabs: … }),
    body: defineContractComponent("main-then-rail", { main: hero, rail: CoursePricingRail({ … }) }),
    action: …,
})}
```

`navigation` và `body` là hai slot ngang hàng của cùng một contract. Đây là điều kiện cấu trúc để
`sticky top-16` có nghĩa: nếu `navigation` nằm bên trong `body`, nó sẽ ghim theo ngữ cảnh cuộn của
body chứ không theo trang.

Neo: `D:\Repositories\starci-academy-fe\src\components\pages\CourseDetailPage\component.tsx:459-475`.

### Ngoại lệ: hai landmark thay vì một

Dashboard có một landmark điều hướng; chi tiết khoá học có hai chồng lên nhau, vì `course-section-navigation`
khai `host: "nav"` trong khi `double-navbar` phía trên đã là một vùng điều hướng. Đây là cái giá được
chấp nhận của `L3-2`, và nó là cái giá duy nhất được phép khác: seam vẫn phải đạt đúng bốn tiêu chí.
Chính `why` của contract tự nhận điều đó khi phải viện đến chuyện chồng một pixel để giải thích vì
sao kết quả bằng với Dashboard.

### Trông giống nhưng không phải `L3-2`

Một hàng tabs có `sticky top-16` nhưng thiếu `-mt-px`. Nó ghim đúng chỗ, nó không cuộn mất, và ở ảnh
chụp đầu trang nó trông xong rồi. Nhưng nét kẻ dưới của hàng navbar và nét kẻ dưới của hàng tabs đều
còn, nên chỗ giáp có hai nét. Đây đúng là hình dạng đã bị bác một lần với lý do người đọc vẫn thấy
divider.

---

## `L3-3` — không có hàng thứ hai, và đó là câu trả lời

### Trường hợp: cụm `profile` mount navbar không kèm tabs

```tsx
const ProfileLayout = ({ children }: ProfileLayoutProps) => (
    <Tree
        contract="nav-over-body-page"
        render={defineContractComponent("nav-over-body-page", {
            navigation: defineContractProjection("double-navbar", () => <ShellNav />),
            body: defineContractProjection("routed-page-main", () => ( … )),
        })}
    />
)
```

`ShellNav` không nhận prop tabs nào ở đây, và bên trong nó `tabs` chỉ khác `undefined` trên
`/dashboard`. Slot `bottom` vì thế vắng mặt, đúng như `optional: true` cho phép. Năm trong sáu cụm
sản phẩm ở tình trạng này.

Neo: `D:\Repositories\starci-academy-fe\src\app\[lang]\profile\layout.tsx:11`.

### Trông giống nhưng không phải `L3-3`

Một cụm mà các "mục" của nó là những route riêng, mỗi route có breadcrumb và metadata của mình. Nhìn
qua thì giống một tập mục chưa được dựng tabs. Thật ra đó là những tài liệu khác nhau, và việc đi lại
giữa chúng là điều hướng chứ không phải chọn mục, nên nó thuộc `L4`.

---

## `L3-4` — hàng tabs trôi trong body

### Trường hợp đo được, chưa có phán quyết: cụm `profile`

```ts
"profile-tabs-over-body": {
    classes: ["flex", "w-full", "flex-col"],
    children: {
        tabs: { contract: "underlined-tab-strip" },
        body: { contract: "profile-page-measure" },
    },
    why: "Profile route chrome belongs to the persistent public-profile layout above its measured identity-and-evidence body; it is not a second layer owned by the global navbar.",
},
```

Không `sticky`, không `top-16`, không `-mt-px`, không `border-b`. Cụm này vẫn mount `double-navbar`
ở trên, nên trên màn hình có một navbar ghim và một hàng tabs không ghim nằm trong `routed-page-main`
bên dưới nó. Cuộn xuống thì navbar ở lại còn hàng tabs đi mất, tức là hỏng tiêu chí thứ hai.

Nhưng không có dòng từ chối nào nói về trang profile, và `why` của contract lập luận ngược lại một
cách có chủ ý. Nên đây ghi là **chênh lệch đã đo, chưa có phán quyết**, không ghi là vi phạm. Cách
đúng là hỏi, và [`audit.md`](./audit.md) giữ khoản này.

Neo: `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:781-788`.

### Trông giống nhưng không phải `L3-4`

Breadcrumb nằm trong phần narrative của trang chi tiết khoá học. Nó cũng là điều hướng, nó cũng trôi
theo body, và nó không ghim. Nhưng nó không phải hàng chọn mục: tabs đi lại **trong** một tài liệu
còn breadcrumb nói tài liệu này nằm ở đâu trong cây route. Việc gỡ breadcrumb vì đã có tabs đã bị bác
thẳng.

---

## `L3-5` — lặp token, không phải lặp hàng

### Vòng một: hiểu thành bỏ nội dung hàng trên

| Rejected | Instead | Why |
|---|---|---|
| Lặp `Trang chủ / Khóa học / Liên hệ` trên primary navbar ngay phía trên course-detail tabs. | Giữ brand + tools ở primary row và để tabs làm điều hướng ngữ cảnh. | "với tabs này thì bỏ mấy cái nội dung ở navbars ở trên đi" |

Neo: `.workflows\fidel\starci-academy\courses-runtime-projection-i18n-20260815-01.md:521`.

### Vòng hai: thầy lật, và đây là bản có hiệu lực

| Rejected | Instead | Why |
|---|---|---|
| Bỏ nội dung `Trang chủ / Khóa học / Liên hệ` khỏi primary navbar. | Giữ nguyên nội dung navbar; chỉ bỏ icon khỏi course-detail tabs. | `nhầm không phải bỏ nội dung, mà là bỏ icon` |

Neo: `.workflows\fidel\starci-academy\courses-runtime-projection-i18n-20260815-01.md:598`.

### Repo sống mang bản vòng hai

```tsx
tabs: [
    { id: "overview", label: input.props.labels.overviewTab },
    { id: "curriculum", label: input.props.labels.curriculumTab },
    { id: "reviews", label: input.props.labels.reviewsTab },
    { id: "faq", label: input.props.labels.faqTab },
],
```

Bốn mục, chữ trơn, không `icon`. Và hàng chính vẫn map đủ ROUTES. Hai nửa của phán quyết vòng hai
đều đã đáp xuống mã.

Neo: `…\CourseDetailPage\component.tsx:465-470` và `…\ShellNav\index.tsx:113-121`.

### Ngoại lệ: một token đi vào rồi đi ra

Chính bộ icon đó từng được **yêu cầu thêm vào** ở hồ sơ trước, vì thiếu so với reference. Đọc rời
từng phán quyết thì thấy mâu thuẫn; đọc theo thứ tự thì thấy đúng: khi hàng trên còn giữ điểm đến,
bộ icon ở hàng dưới trở thành cái nói hai lần, nên nó là token phải đi.

Neo: `.workflows\fidel\starci-academy\course-detail-ownership-and-rail.md:1388`.

### Trông giống nhưng không phải `L3-5`

Hai hàng cùng có chữ. Chữ không phải một token bị lặp; nhãn của bốn mục và nhãn của ba điểm đến nói
hai chuyện khác nhau. `L3-5` chỉ nổ khi **cùng một thứ** xuất hiện hai lần, và bước bắt buộc là gọi
tên nó ra trước khi đề xuất gỡ bất cứ gì.

---

## `L3-6` — chưa đo thì chưa sạch

### Trường hợp: proof cũ bị dùng sai câu hỏi

| Rejected | Instead | Why |
|---|---|---|
| Gọi seam cũ là đã follow Dashboard | Đo hai border thật và sửa phần divider còn nhìn thấy | User vẫn thấy divider; proof cũ chỉ xác nhận tabs đã sát navbar, chưa xác nhận seam sạch. |

Neo: `.workflows\fidel\starci-academy\course-detail-ownership-and-rail.md:1387`.

Đây là mã duy nhất trên kệ này nói về **bằng chứng** chứ không nói về cấu trúc. Nó tồn tại vì cách
hỏng thật đã xảy ra không phải viết sai class, mà là tuyên bố xong việc dựa trên một phép đo trả lời
câu hỏi khác.

### Trông giống nhưng không phải `L3-6`

Đọc class trong contract và thấy có đủ `sticky top-16 -mt-px border-b`. Đó là bằng chứng tốt cho cấu
trúc và nó đủ để đóng `L3-2`. Nó không đóng `L3-6`, vì cái quyết định số nét kẻ nhìn thấy còn phụ
thuộc màu nền có thật đục hay không, theme nào đang bật, và trình duyệt làm tròn một pixel ra sao.

---

## `L3-7` — điều khiển của một biểu đồ

### Trường hợp: không có ví dụ nào trong mô-đun này

Mã này tồn tại để **đẩy việc đi**, không để xử. Một điều khiển đổi tham số của một hình thuộc `L4`,
và ví dụ của nó sống ở đó. Ở đây chỉ ghi phép thử: sau khi bấm, vùng nội dung của trang đổi hay một
hình được vẽ lại với tham số khác.

### Trông giống nhưng không phải `L3-7`

Một dải tab chạy hết chiều ngang và đổi hẳn phần nội dung đang hiện. Rộng không làm nó thành tham số,
và vendor gọi nó là gì cũng không đổi được câu trả lời. Đó là `L3-1` hoặc `L3-2` tuỳ ai nhìn thấy tập
mục.

---

## Ánh xạ từ yêu cầu sang mã

| Yêu cầu nghe được | Mã | Ghi chú |
|---|---|---|
| "cho trang này mấy cái tab ở trên" | `L3-1` | nếu layout của cụm gọi được tên tập mục |
| "tab của khoá học, mấy mục trong khoá" | `L3-2` | trang tự dựng `nav`, dán bằng `-mt-px` |
| "trang này không cần tab" | `L3-3` | bỏ trống slot `bottom`, không truyền mảng rỗng |
| "tab bị mất khi cuộn xuống" | `L3-4` | đang nằm trong body, phải chuyển lên |
| "sao có hai đường kẻ ở chỗ giáp" | `L3-2` | thiếu `-mt-px`, và kiểm lại bằng `L3-6` |
| "với tabs này thì bỏ mấy cái ở trên đi" | `L3-5` | hỏi lại: *bỏ token nào* — thầy đã lật đúng chỗ này |
| "seam follow Dashboard rồi" | `L3-6` | đọc hai giá trị border trên route, hoặc ghi `chưa đo` |
| "cho cái chọn năm thành một line dài" | `L3-7` | vùng đổi hay hình vẽ lại, rồi giao cho `L4` |
