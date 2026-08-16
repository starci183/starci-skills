---
id: fe-layouts-laws-l1-persistent-owner-mounts-once-example
title: example.md
slug: /gates/layouts/laws/l1-persistent-owner-mounts-once/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi trường hợp, ngoại lệ và thứ trông giống của bảy mã L1-N, đọc thẳng từ mã sống.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `l1-persistent-owner-mounts-once` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là mã thật trong repo sống `D:\Repositories\starci-academy-fe` nhánh `main`.
Không có ví dụ bịa: mã nào chưa có chỗ nào đang chạy thì phần ví dụ của nó ghi thẳng là chưa có.

---

## `L1-1` — một mount ở locale root

### Trường hợp: chủ hội thoại của trợ lý

```tsx
const [isOpen, setIsOpen] = useState(false)
const [codeContext, setCodeContext] = useState<ContentAiSelectionContext>()
const [tangentVersion, setTangentVersion] = useState(0)
```

Neo: `D:\Repositories\starci-academy-fe\src\components\layouts\GlobalAiChatLayout\index.tsx:32-34`.

Ba mẩu này là toàn bộ lý do của một mount. Không mẩu nào đọc được ra từ URL, nên mount lại ở cụm kế
tiếp là mất cả ba. Chính file đó nói ra mục đích của mình ở `:27`: giữ một chủ hội thoại AI sống
trong khi các mặt sản phẩm bên dưới đổi theo route.

### Trường hợp: chỗ mount duy nhất

```tsx
<RouteShell frame={GlobalAiChatLayout} props={{}}>
    {children}
</RouteShell>
```

Neo: `D:\Repositories\starci-academy-fe\src\app\[lang]\layout.tsx:101`.

Một chỗ, nằm trên mọi cụm, và đi qua đúng cái shell chuyển `children` thành component. Grep cả cây
`src/app` chỉ ra đúng một lần mount `GlobalAiChatLayout`.

### Trông giống nhưng không phải `L1-1`

Một chủ hiện ở cả 51 trang. Độ phủ không phải bằng chứng: `ShellNav` cũng gần như thế mà vẫn là
`L1-3`. Bằng chứng là mẩu state nào không có hook nào đọc nó ra từ địa chỉ.

---

## `L1-2` — giấu phần nhìn thấy, giữ mount

### Trường hợp: route đăng nhập và route chấm bài trực tiếp

```tsx
if (token === undefined || isContentAiRouteHidden(pathname)) {
    return (
        <GlobalAiChatContext.Provider value={value}>
            <Surface />
        </GlobalAiChatContext.Provider>
    )
}
```

Neo: `D:\Repositories\starci-academy-fe\src\components\layouts\GlobalAiChatLayout\index.tsx:56-62`.

Nhánh này trả về provider và routed surface, bỏ hẳn `Tree` mang nút, drawer và ô chọn. Chủ vẫn
mount, context vẫn còn, nên hội thoại đi qua bài thi mà không đứt.

### Trường hợp: một hàm cho mọi bên phải giấu

```ts
export const isContentAiRouteHidden = (pathname: string): boolean => {
    const path = normalizeContentAiPath(pathname)
    if (path === "/authentication" || path.startsWith("/authentication/")) return true
    return isLiveAssessmentRoute(path)
}
```

Neo: `D:\Repositories\starci-academy-fe\src\modules\ai\content-ai-route-context.ts:64-68`.

### Trông giống nhưng không phải `L1-2`

Tháo chủ ra khỏi cây để giấu nó. Đó là `L1-4`, và dùng nhầm nó cho một chủ `L1-1` thì người đọc thi
xong quay lại thấy hội thoại trống.

---

## `L1-3` — lặp theo route group

### Trường hợp: sáu layout, một navbar

```tsx
navigation: defineContractProjection("double-navbar", () => <ShellNav />),
```

Neo: `D:\Repositories\starci-academy-fe\src\app\[lang]\cart\layout.tsx:31`, và cùng một dòng ở
`dashboard\layout.tsx:29`, `courses\layout.tsx:31`, `league\layout.tsx:30`,
`practice\layout.tsx:30`, `profile\layout.tsx:11`.

### Trường hợp: vì sao lặp mà không mất gì

```tsx
isCurrent: pathname === route.path || pathname.startsWith(`${route.path}/`),
```

```tsx
isCurrent: tab.id === (searchParams.get("tab") ?? "overview"),
```

Neo: `D:\Repositories\starci-academy-fe\src\components\layouts\ShellNav\index.tsx:120` và `:126`.

Hai dòng này là toàn bộ phần "trạng thái" mà navbar phát ra ngoài, và cả hai đều là hàm của địa chỉ.
Mount lại cho ra đúng kết quả cũ.

### Ngoại lệ: chính chỗ lặp này lại đang giữ state sống

Xem `L1-7`. Phần điều hướng của `ShellNav` là `L1-3` sạch, nhưng bốn `useState` cho overlay ở
`:53-56` thì không, và hai chuyện đó nằm trong cùng một file.

---

## `L1-4` — không mount ở đâu cả

### Trường hợp: họ route `authentication`

```ts
expect(readAppFile("layout.tsx")).not.toContain("ShellNav")
```

```ts
for (const family of ["dashboard", "league"]) {
    const layout = readAppFile(join(family, "layout.tsx"))
    expect(layout).toContain("from \"@/components/layouts/ShellNav\"")
    expect(layout).toContain("<ShellNav />")
}
```

Neo: `D:\Repositories\starci-academy-fe\src\app\[lang]\authentication\layout-boundary.test.ts:18`
và `:24-25`.

Test này giữ cả hai chiều cùng lúc. Nó cấm chrome leo lên locale root, và nó bắt buộc chrome phải có
mặt trong họ route sở hữu nó. Đây cũng là bằng chứng mạnh nhất cho thấy bản luật cũ bắt nhầm: bản cũ
cấm đúng cái mà test đang bắt buộc.

### Trông giống nhưng không phải `L1-4`

Một chủ trả `null` ở vài route. Trả `null` mà vẫn nằm trong cây là `L1-2`, vì mount còn nguyên.
`L1-4` là không có dòng mount nào trong layout của họ route đó.

---

## `L1-5` — phạm vi một cụm

### Trường hợp: chủ phiên playground

```tsx
<RouteShell frame={PlaygroundSessionLayout} props={{ displayId, slug }}>
    {input.children}
</RouteShell>
```

Neo:
`D:\Repositories\starci-academy-fe\src\app\[lang]\courses\[displayId]\learn\playground\[slug]\layout.tsx:15`.

```tsx
const socket = usePlaygroundSocketIo()
const [session, setSession] = useState<PlaygroundSession | null>(null)
const [startFailed, setStartFailed] = useState(false)
```

Neo: `D:\Repositories\starci-academy-fe\src\components\layouts\PlaygroundSessionLayout\index.tsx:52-54`.

Socket và session không tính lại được từ địa chỉ, nên đây là chủ giữ trạng thái thật. Nhưng phạm vi
sống sót của nó dừng ở `slug`, nên nó mount ở biên `slug` chứ không leo lên root.

### Trông giống nhưng không phải `L1-5`

Một chủ mount ở layout của một cụm chỉ vì hôm nay chỉ cụm đó cần nó. Phạm vi là cái quyết định, chứ
không phải danh sách người dùng hiện tại. Ngày mai có cụm thứ hai cần cùng một trạng thái thì đó là
`L1-1` chứ không phải hai lần `L1-5`.

---

## `L1-6` — chủ không vẽ gì

### Trường hợp: cây provider

`AppProviders` bọc toàn bộ cây ở locale root và mang context. Chiều ngược lại bị bác hai lần trong
cùng hồ sơ chatbot: đưa phần nhìn thấy vào đó bị từ chối vì chủ ở đó chứa context chứ không chứa bố
cục.

Neo: `.workflows\designs\starci-academy\global-ai-chatbot.md:709` và `:122`.

### Trông giống nhưng không phải `L1-6`

`GlobalAiChatLayout` cũng phát một `Provider`, nhưng nó phát cả `Tree` với bốn slot nhìn thấy được.
Có phần nhìn thấy thì nó là layout, và chỗ của nó là biên layout chứ không phải cây provider.

---

## `L1-7` — chưa đo được, báo nợ

### Trường hợp: bốn state overlay trong chrome lặp

```tsx
const [isOpen, setIsOpen] = useState(false)
const [isCartOpen, setIsCartOpen] = useState(false)
const [searchIntent, setSearchIntent] = useState<GlobalSearchOpenIntent>()
const [authMode, setAuthMode] = useState<AuthMode>("signIn")
```

Neo: `D:\Repositories\starci-academy-fe\src\components\layouts\ShellNav\index.tsx:53-56`, và ba
overlay mount ở `:162`, `:169`, `:170`.

Biện hộ đang có nằm ngay trên chỗ mount drawer: điều khiển mở nó nằm trong chrome nên panel phải
sống lâu hơn route bên dưới, và một drawer cho mỗi trang là một focus trap cho mỗi trang.

### Chưa biểu diễn được

Mở drawer ở `courses` rồi đi sang `dashboard`: chrome mount lại, `isCartOpen` về `false`, drawer
đóng. Không có test, không có phán quyết, không có ảnh chụp nào nói đó là hành vi mong muốn. Đây là
*suy luận, không có neo*, nên `L1-7` báo nợ chứ không phát đáp án.

---

## Ánh xạ từ yêu cầu sang mã

| Yêu cầu nghe được | Mã | Ghi chú |
|---|---|---|
| "cái này phải hiện ở mọi trang" | `L1-3` | độ phủ không phải lý do mount một lần |
| "đang chat dở mà chuyển trang là mất" | `L1-1` | gọi tên mẩu state, rồi chỉ ra không hook nào đọc nó từ URL |
| "trang thi thì đừng hiện trợ lý" | `L1-2` | giấu phần nhìn thấy, giữ mount, và dùng chung hàm predicate |
| "trang đăng nhập không cần navbar" | `L1-4` | không mount, và viết một test giữ chuyện đó |
| "giữ kết nối khi đi từ setup sang chạy" | `L1-5` | biên của cụm, không phải root |
| "gom cái này vào AppProviders cho gọn" | `L1-6` | chỉ khi nó không vẽ gì |
| "sao navbar mount tận sáu chỗ" | `L1-3` | sáu cụm cần lối ra, hỏi lại trước khi hoist lên root |
| "drawer mở mà chuyển cụm thì sao" | `L1-7` | chưa đo, báo nợ, đừng phán |
