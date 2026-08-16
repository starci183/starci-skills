---
id: fe-layouts-laws-l2-assistant-and-content-are-different-axes-example
title: example.md
slug: /fe/layouts/laws/l2-assistant-and-content-are-different-axes/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi trường hợp, ngoại lệ và thứ trông giống của sáu mã L2-N, đọc thẳng từ một chủ trợ lý, ba consumer và trang duy nhất đang mượn nó.
---

# example.md

> Phiên bản: `1.00` · Mô-đun: `l2-assistant-and-content-are-different-axes` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là mã thật trong repo sống `D:\Repositories\starci-academy-fe` nhánh `main`. Một
mã không có chỗ nào đang chạy thì phần ví dụ của nó ghi thẳng là chưa có.

Toàn bộ trục trợ lý trong repo sống gồm một chủ ở `src/components/layouts/GlobalAiChatLayout/`, một
context ở `src/modules/ai/global-ai-chat-context.tsx`, một predicate ở
`src/modules/ai/content-ai-route-context.ts`, ba consumer ở `blocks/ai/StarCiAiChat`,
`blocks/ai/StarCiAiSelectionAsk` và `overlays/ai/StarCiAiDrawer`, cộng đúng một trang mượn nó là
`pages/CourseLearnContentPage`. Cả tám chỗ đều được đọc để viết tài liệu này.

---

## `L2-1` — hai trục, một chủ ở gốc

### Trường hợp: trang là hành khách kiểu component

```tsx
/** One routed surface mounted below the persistent locale-root AI owner. */
export type GlobalAiChatLayoutProps = {
    readonly surface: ComponentType
}
```

Trợ lý không nhận `children`, nó nhận một `ComponentType`. Chỗ đổi từ `children` của framework sang
component ấy nằm ở `RouteShell` và chỉ ở đó, với `const Surface = useCallback(() => <>{children}</>,
[children])` rồi `<Frame {...(input.props as P)} surface={Surface} />`.

Neo: `…\layouts\GlobalAiChatLayout\index.tsx:23-25` và `…\shells\RouteShell\index.tsx:48-52`.

### Trường hợp: contract tự nói ra quan hệ anh em

```ts
"global-ai-layout": {
    classes: ["relative", "w-full"],
    children: {
        surface: { leaf: "page" },
        selection: { contract: "selection-ai-actions", optional: true },
        trigger: { contract: "floating-ai-trigger", optional: true },
        drawer: { contract: "starci-ai-drawer-column", optional: true },
    },
    why: "The routed surface and its one persistent AI owner are siblings, so navigation can replace the lesson without replacing the active conversation.",
}
```

Bốn slot, và `surface` là một trong bốn chứ không phải cái bọc ba cái kia. Ba slot còn lại đều
`optional`, vì trục trợ lý được phép có mặt mà không vẽ đủ.

Neo: `…\components\contracts\index.ts:2714-2722`.

### Trường hợp: đúng một điểm mount, ở gốc locale

```tsx
<AppProviders locale={lang} messages={messages}>
    <RouteShell frame={GlobalAiChatLayout} props={{}}>
        {children}
    </RouteShell>
</AppProviders>
```

Neo: `…\src\app\[lang]\layout.tsx:101`.

### Trông giống nhưng không phải `L2-1`

`ShellNav` cũng đứng trên nhiều trang và cũng trông như một trục thứ hai, nhưng nó mount sáu lần
theo cụm route và đọc lại mọi thứ nó cần từ địa chỉ. Nó không phải một trục song song mà là chrome
được vẽ lại, và chuyện ấy thuộc `L1-3` chứ không thuộc mã này.

---

## `L2-2` — trợ lý không phải một mặt của trang

### Trường hợp: hàng mặt nội dung khai ba giá trị

```ts
/** One face of the content - a tab the content actually carries. */
export type ContentFaceId = "reading" | "source" | "challenge"
```

Union đóng, ba giá trị, không có giá trị nào là trợ lý. Đây là chỗ lời bác `:710` đáp xuống mã.

Neo: `…\blocks\learn\ContentTabRow\component.tsx:26`.

### Trường hợp: dispatch bên dưới cũng chỉ biết ba mặt ấy

```tsx
const selectFace = (
    faces: ReadonlyArray<ContentFaceTab>,
    on: ContentTabRowActions | undefined,
    faceId: string,
) => {
    const face = faces.find((candidate) => candidate.id === faceId)
    if (face === undefined || face.disabled === true || face.locked === true) return
    if (face.id === "reading") on?.selectReading?.()
    if (face.id === "source") on?.selectSource?.()
    if (face.id === "challenge") on?.selectChallenge?.()
}
```

Ba nhánh, ba producer. Muốn thêm trợ lý vào hàng này thì phải sửa cả union lẫn ba nhánh dưới, và đó
là một tín hiệu tốt: cái sai không viết được bằng một dòng.

Neo: `…\blocks\learn\ContentTabRow\component.tsx:62-73`.

### Trường hợp sai: giữ lại một mặt AI đang disable

```ts
// SAI - không có trong repo sống, dựng lại từ lời bác :710
export type ContentFaceId = "reading" | "source" | "challenge" | "ai"
//                                                              ^^^^
// và trong danh sách faces: { id: "ai", label: "StarCi AI", disabled: true }
```

Nó hỏng ở chỗ khó thấy nhất. Người đọc nhìn thấy một mặt trong hàng, tưởng bấm vào sẽ đổi phần thân
như ba mặt kia, nhưng nó không đổi gì cả vì cuộc hội thoại không phải một cách đọc của bài học. Bản
sửa thật không phải là bật cái mặt ấy lên mà là bỏ nó đi và cho `source` vào chỗ đó, còn trợ lý ở
lại dưới dạng nút nổi và drawer.

Neo từ chối: `.workflows\designs\starci-academy\global-ai-chatbot.md:710`.

### Trông giống nhưng không phải `L2-2`

Hàng ngôn ngữ đứng cạnh hàng mặt trong cùng một toolbar không phải một vi phạm. Nó là tham số của
cùng một mặt chứ không phải một mặt mới, nên nó thuộc trục nội dung và câu hỏi về nó là `L4`, không
phải mã này.

---

## `L2-3` — trang mượn trợ lý

### Trường hợp: trang giữ mặt của nó, chủ giữ hội thoại

```tsx
const ai = useGlobalAiChat()
…
const [selectedFace, setSelectedFace] = useState<ContentFaceId>("reading")
```

Hai dòng cách nhau sáu dòng trong cùng một component, và chúng thuộc hai trục. `ai` là cái mượn
được, `selectedFace` là cái trang sở hữu.

Neo: `…\pages\CourseLearnContentPage\index.tsx:95` và `:101`.

### Trường hợp: nạp ngữ cảnh rồi mở, không giữ gì thêm

```tsx
ai.setCodeContext({
    kind: "code",
    quote: selection.text,
    path: selection.path,
    startLine: selection.startLine,
    endLine: selection.endLine,
    hasLocalEdit: editedSourcePaths.includes(selection.path),
})
ai.open()
```

Trang gọi đúng hai hàm rồi thôi. Nó không nhận lại session id, không nhận lại transcript, và không
biết drawer đang mở hay đóng sau lời gọi ấy.

Neo: `…\pages\CourseLearnContentPage\index.tsx:365-373`, và lần thứ hai cho lỗi runtime ở `:378-385`.

### Trường hợp sai: trang giữ trạng thái mở của trợ lý

```tsx
// SAI - không có trong repo sống
const ai = useGlobalAiChat()
const [isAiOpen, setIsAiOpen] = useState(false)
…
<Button onPress={() => { setIsAiOpen(true); ai.open() }} />
```

Bây giờ có hai nguồn sự thật cho một cánh cửa. Người đọc đóng drawer bằng nút đóng của chính nó thì
`ai.isOpen` về `false` còn `isAiOpen` của trang vẫn `true`, và lần bấm kế tiếp không mở được gì.
Trạng thái mở đóng là một trong ba mẩu state của chủ, và ba mẩu ấy đều thuộc trục trợ lý.

Neo cho ba mẩu ấy: `…\layouts\GlobalAiChatLayout\index.tsx:32-34`.

### Trông giống nhưng không phải `L2-3`

`StarCiAiSelectionAsk` cũng đọc vùng chọn và cũng đưa nó cho chủ, nhưng nó không phải một trang mượn
trợ lý. Nó là consumer nằm sẵn trong khung của chủ, được chủ mount ở slot `selection`, nên nó ở phía
bên kia của ranh giới.

Neo: `…\layouts\GlobalAiChatLayout\index.tsx:70` và `…\blocks\ai\StarCiAiSelectionAsk\index.tsx:27`.

---

## `L2-4` — nạp thì phải dọn

### Trường hợp: chủ dọn theo địa chỉ

```tsx
useEffect(() => {
    setCodeContext(undefined)
}, [anchor.path])
```

Đổi trang thì ngữ cảnh mã biến mất, còn `isOpen` và `tangentVersion` thì không bị đụng tới. Đúng một
trong ba mẩu state bị xoá, và đó là mẩu duy nhất trỏ vào thứ vừa rời khỏi màn hình.

Neo: `…\layouts\GlobalAiChatLayout\index.tsx:36-38`.

### Trường hợp: trang dọn theo mặt của nó

```tsx
useEffect(() => {
    if (selectedFace !== "source") ai.clearCodeContext()
}, [ai, selectedFace])
```

Mặt nào nạp thì mặt ấy dọn. Trang còn dọn thêm hai chỗ nữa, khi sandbox được reset ở `:356` và khi
vùng chọn bị bỏ ở `:360`.

Neo: `…\pages\CourseLearnContentPage\index.tsx:143`, `:356`, `:360`.

### Trường hợp sai: nạp mà không dọn

```tsx
// SAI - dựng lại bằng cách bỏ đúng effect ở :143
// Người đọc bôi đen một đoạn ở mặt source, chuyển sang mặt reading, rồi hỏi.
// Trợ lý trả lời về đoạn mã họ không còn nhìn thấy, và không có gì trên màn hình
// giải thích vì sao câu trả lời lại nói về mã.
```

Đây là hỏng đo được bằng hành vi chứ không bằng mắt: màn hình trông đúng ở mọi khung hình, chỉ có
câu trả lời là sai chỗ.

### Trông giống nhưng không phải `L2-4`

`setSelectedFace("reading")` chạy khi `input.contentId` đổi ở `:134-140` không phải một lần dọn ngữ
cảnh. Nó đưa trục nội dung về mặt nghỉ, còn ô ngữ cảnh thì do effect ở `:143` và do chủ dọn. Hai
việc chạy gần nhau và dễ bị kể thành một.

---

## `L2-5` — một cuộc hội thoại, không có cái thứ hai

### Trường hợp: ba consumer, không ai giữ hội thoại

```tsx
const owner = useGlobalAiChat()      // StarCiAiChat
const chat = useGlobalAiChat()       // StarCiAiSelectionAsk
const owner = useGlobalAiChat()      // StarCiAiDrawer
```

Cả ba đều đọc từ một chủ. `StarCiAiChat` có state của riêng nó cho mode, session đang chọn và ô soạn
thảo, nhưng cái nó không có là một cuộc hội thoại thứ hai: `isOpen`, ngữ cảnh mã và bộ đếm tangent
vẫn nằm ở chủ.

Neo: `…\blocks\ai\StarCiAiChat\index.tsx:42`, `…\blocks\ai\StarCiAiSelectionAsk\index.tsx:27`,
`…\overlays\ai\StarCiAiDrawer\index.tsx:12`.

### Trường hợp sai: một trợ lý riêng cho mặt mã nguồn

```tsx
// SAI - đúng thứ bị bác ở :417
const [sourceChat, setSourceChat] = useState<SourceChatSession>()
// một luồng riêng, một transcript riêng, chỉ dùng cho mặt source
```

Lời bác nói thứ được yêu cầu là StarCi AI giải thích mã, không phải một hệ thống trợ lý thứ hai. Bản
đúng là dùng lại đúng cuộc hội thoại đang mở và đưa ngữ cảnh mã vào cho nó, và hôm nay mã sống làm
đúng như vậy bằng `setCodeContext` cộng `open`.

Neo từ chối: `.workflows\designs\starci-academy\global-ai-chatbot.md:417`.

### Trông giống nhưng không phải `L2-5`

`startTangent` mở một nhánh hỏi mới bằng cách nạp ngữ cảnh, tăng `tangentVersion` và mở drawer. Nó
trông như sinh ra một luồng thứ hai nhưng ba việc ấy đều xảy ra trong đúng một chủ, và bộ đếm là một
số nằm cạnh hai mẩu state kia chứ không phải một session mới.

Neo: `…\layouts\GlobalAiChatLayout\index.tsx:49-53`.

---

## `L2-6` — không vẽ gì vẫn phải phát context

### Trường hợp: nhánh sớm trả về provider bọc trang

```tsx
if (token === undefined || isContentAiRouteHidden(pathname)) {
    return (
        <GlobalAiChatContext.Provider value={value}>
            <Surface />
        </GlobalAiChatContext.Provider>
    )
}
```

Không `Tree`, không contract `global-ai-layout`, không nút nổi, không selection ask, không drawer.
Provider thì vẫn còn.

Neo: `…\layouts\GlobalAiChatLayout\index.tsx:56-62`.

### Trường hợp: một test ghim đúng nhánh ấy

```tsx
it("keeps context available without mounting AI for a signed-out viewer", () => {
    setSessionToken(undefined)
    render(<GlobalAiChatLayout surface={Surface} />)
    expect(screen.getByText("Surface: global")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Open AI" })).not.toBeInTheDocument()
})
```

Tên của test nói đúng cái luật muốn: context còn, phần vẽ ra thì không.

Neo: `…\layouts\GlobalAiChatLayout\index.test.tsx:44-49`.

### Trường hợp: route nào rơi vào nhánh đó

```ts
/** Auth and focused live-evaluation routes do not mount the global assistant. */
export const isContentAiRouteHidden = (pathname: string): boolean => {
    const path = normalizeContentAiPath(pathname)
    if (path === "/authentication" || path.startsWith("/authentication/")) return true
    return isLiveAssessmentRoute(path)
}
```

Đúng một hàm, và `L1` đọc lại chính hàm này thay vì giữ một danh sách riêng.

Neo: `…\modules\ai\content-ai-route-context.ts:63-68`.

### Trường hợp sai: bỏ provider ở nhánh không vẽ

```tsx
// SAI - dựng lại bằng cách bỏ Provider ở nhánh :56-62
if (token === undefined || isContentAiRouteHidden(pathname)) return <Surface />
```

Mọi thứ chạy đúng cho tới khi một trang nằm dưới predicate ấy gọi `useGlobalAiChat()`. Hook được
viết để ném khi đọc ngoài chủ, với đúng câu `useGlobalAiChat must be used inside GlobalAiChatLayout`,
nên lỗi hiện ra dưới dạng cây React vỡ chứ không dưới dạng một chỗ hiển thị sai.

Neo: `…\modules\ai\global-ai-chat-context.tsx:24-27`.

### Trông giống nhưng không phải `L2-6`

Trợ lý vắng mặt trên một route vì `ShellNav` vắng mặt ở cụm ấy là chuyện khác hẳn. Cụm
`authentication` không mount `ShellNav` và một test giữ ranh giới đó, nhưng trợ lý thì vẫn mount ở
gốc locale và chỉ bỏ phần vẽ. Hai sự vắng mặt trông giống nhau trên màn hình và khác nhau hoàn toàn
trong cây, và phân định giữa chúng là `L1-2` với `L1-4`.

---

## Ánh xạ từ yêu cầu sang mã

| Yêu cầu nghe được | Mã | Ghi chú |
|---|---|---|
| "thêm tab AI vào hàng tab bài học" | `L2-2` | trợ lý không phải một mặt; nếu hàng thiếu mặt thì thiếu mặt thật |
| "cái tab AI đang xám, bật lên đi" | `L2-2` | mặt disable vẫn là mặt; bản sửa là bỏ nó |
| "bôi đen đoạn code rồi hỏi StarCi AI" | `L2-3` | mượn: `setCodeContext` rồi `open` |
| "trang này tự mở drawer được không" | `L2-3` | được, nhưng không giữ `isOpen` |
| "làm một chat riêng cho phần source" | `L2-5` | đã bị bác; dùng lại cuộc hội thoại đang mở |
| "đổi bài rồi mà nó vẫn nói về code cũ" | `L2-4` | tìm chỗ nạp mà không dọn |
| "vào trang thi thì lỗi trắng màn" | `L2-6` | kiểm nhánh không vẽ còn phát context không |
| "trợ lý mount ở đâu" | không phải mã này | `L1` |
| "bấm tab thì URL có đổi không" | không phải mã này | `L4` |
| "trong drawer có nên bọc card không" | không phải mã này | `L6` |
