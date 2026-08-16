---
id: fe-patterns-translation-example
title: example.md
slug: /gates/patterns/translation/example
sidebar_label: example.md
sidebar_position: 2
description: Tất cả case và ngoại lệ của từng mã COPY-N, viết bằng TSX thường.
---

# example.md

> Version: `2.00` · Module: `translation` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **TSX thường**. Không component library, không design system riêng, không tên
sản phẩm. Một luật chỉ đúng khi nó đúng ở bất kỳ front end nào — nên nếu một ví dụ cần tên riêng của
một dự án mới đọc được, ví dụ đó nằm sai chỗ.

Mỗi mã có **nhiều case**, từng case đặt **ĐÚNG** cạnh **SAI**, sau đó là mục ngoại lệ và những thứ trông
giống nhưng không phải mã đó. Phần cuối trang ánh xạ từ yêu cầu bằng lời sang một quyết định.

Quy ước đọc: `index.tsx` là **nửa connected** — nó gọi dữ liệu và biết tình huống. `component.tsx` là
**nửa drawing** — nó chỉ nhận và vẽ.

---

## `COPY-1` — nửa connected chọn từng chữ

### Case: một block có nhiều state, mỗi state một câu khác

ĐÚNG — nửa biết mình đang ở state nào cũng là nửa chọn câu:

```tsx
// index.tsx
export const QuotaRow = () => {
    const t = useTranslations("quota")
    const quota = useQuotaRequest()

    if (quota.error) return <_QuotaRow state="empty" />
    if (!quota.data) return <_QuotaRow state="pending" props={{ label: t("weeklyCredit") }} />

    return (
        <_QuotaRow
            state="settled"
            props={{
                label: t("weeklyCredit"),
                value: t("remainingOf", { remaining: quota.data.remaining, limit: quota.data.limit }),
            }}
        />
    )
}
```

SAI — nửa vẽ phải tự biết cả tình huống lẫn từ điển:

```tsx
// component.tsx
export const _QuotaRow = (input: QuotaRowProps) => {
    const t = useTranslations("quota")
    return <FactRow props={{ label: t("weeklyCredit"), endText: input.value }} />
}
```

Khác nhau đúng một điều: nửa vẽ có dựng được khi không có runtime dịch hay không.

### Case: câu phụ thuộc quyền của người đọc

ĐÚNG — quyền là một dữ kiện của request, nên câu đi cùng nơi biết quyền:

```tsx
// index.tsx
export const UpgradeCallout = () => {
    const t = useTranslations("billing")
    const me = useViewerRequest()
    if (!me.data) return null

    return (
        <_UpgradeCallout
            props={{
                title: me.data.isTrial ? t("trialEndsSoon") : t("planLimitReached"),
                action: t("comparePlans"),
            }}
        />
    )
}
```

SAI — nửa vẽ nhận cờ rồi tự suy ra câu, tức là nó đang settle tình huống:

```tsx
// component.tsx
export const _UpgradeCallout = ({ isTrial }: { readonly isTrial: boolean }) => {
    const t = useTranslations("billing")
    return <Callout props={{ title: isTrial ? t("trialEndsSoon") : t("planLimitReached") }} />
}
```

Cờ `isTrial` không phải là dữ liệu vẽ, nó là **tình huống chưa được quyết**. Đẩy nó xuống là đẩy
quyết định xuống theo.

### Case: đọc locale hiện hành để chọn chữ

ĐÚNG — mọi thứ phụ thuộc ngôn ngữ được resolve ở trên và xuống dưới dưới dạng chuỗi xong:

```tsx
// index.tsx
export const PublishedAtRow = () => {
    const format = useFormatter()
    const post = usePostRequest()
    if (!post.data) return null
    return <_PublishedAtRow props={{ publishedAt: format.dateTime(post.data.publishedAt) }} />
}
```

SAI — đọc locale là cùng một phụ thuộc, chỉ im hơn một bậc:

```tsx
// component.tsx
export const _PublishedAtRow = ({ publishedAt }: { readonly publishedAt: Date }) => {
    const locale = useLocale()
    return <time>{publishedAt.toLocaleDateString(locale)}</time>
}
```

### Ngoại lệ và nhầm lẫn

- **Không phải mọi hook trong nửa vẽ đều là vi phạm.** Hook đo kích thước, hook quản lý focus không
  resolve chữ nào cả. Mã này chỉ nói về những hook trả về **từ**.
- **Một page cũng là nửa connected.** Nó được phép resolve chữ; nó không được phép ném literal xuống
  cho leaf, vì lúc đó lỗi là `COPY-2` chứ không phải `COPY-1`.

---

## `COPY-2` — dưới block thì không giữ chữ nào người đọc thấy

### Case: placeholder của ô tìm kiếm

ĐÚNG:

```tsx
// composites/SearchField/index.tsx
export const SearchField = ({ props }: SearchFieldProps) => (
    <input className="rounded-md border px-3 py-2" placeholder={props.placeholder} />
)
```

SAI:

```tsx
// composites/SearchField/index.tsx
export const SearchField = () => (
    <input className="rounded-md border px-3 py-2" placeholder="Search courses" />
)
```

Khác nhau đúng một điều: người đọc ở ngôn ngữ khác nhìn thấy gì.

### Case: nút chỉ có icon, chữ nằm trong `aria-label`

ĐÚNG:

```tsx
// leaves/IconButton/index.tsx
export const IconButton = ({ props }: IconButtonProps) => (
    <button aria-label={props.label} className="rounded-md p-2" type="button">
        <Icon props={{ name: props.icon }} />
    </button>
)
```

SAI:

```tsx
// leaves/IconButton/index.tsx
export const IconButton = ({ props }: IconButtonProps) => (
    <button aria-label="Close dialog" className="rounded-md p-2" type="button">
        <Icon props={{ name: props.icon }} />
    </button>
)
```

Đây là case tốn kém nhất trong cả mã. Trên màn hình, không ai thấy gì sai: nút vẫn là cái icon đó.
Nhưng screen reader đọc `aria-label` như **văn bản chính**, nên người dùng screen reader ở ngôn ngữ
khác là người duy nhất nghe thấy lỗi, và cũng là người ít có cách xoay xở nhất.

### Case: empty state nằm trong một composite

ĐÚNG:

```tsx
// composites/ResultList/index.tsx
export const ResultList = ({ props }: ResultListProps) =>
    props.items.length === 0 ? (
        <p className="p-6 text-center text-sm text-neutral-500">{props.emptyText}</p>
    ) : (
        <ul className="divide-y">{props.items.map((item) => <li className="p-4" key={item.id}>{item.title}</li>)}</ul>
    )
```

SAI:

```tsx
// composites/ResultList/index.tsx
export const ResultList = ({ props }: ResultListProps) =>
    props.items.length === 0 ? (
        <p className="p-6 text-center text-sm text-neutral-500">No results found</p>
    ) : (
        <ul className="divide-y">{props.items.map((item) => <li className="p-4" key={item.id}>{item.title}</li>)}</ul>
    )
```

Empty state là chỗ copy trốn kỹ nhất, vì nó là nhánh **ít được mở ra xem nhất** khi review.

### Ngoại lệ và nhầm lẫn

- **Token không phải chữ.** Không dấu cách, không ai đọc lên, không đổi theo ngôn ngữ:

  ```tsx
  <Icon props={{ name: "search" }} />
  <Badge props={{ tone: "warning" }} />
  ```

- **`alt` rỗng của ảnh trang trí là đúng, không phải thiếu chữ:**

  ```tsx
  <img alt="" aria-hidden="true" src={props.decorationSrc} />
  ```

  Ảnh trang trí không mang thông tin, nên `alt=""` là câu trả lời đầy đủ chứ không phải chỗ quên
  dịch.

- **Ký tự và số không phải copy:**

  ```tsx
  <span className="tabular-nums">{props.value}</span>
  <span aria-hidden="true">·</span>
  ```

- **Page và block được giữ chữ, tier dưới thì không.** Cùng một câu, nằm ở hai chỗ, một chỗ hợp lệ và
  một chỗ không — đó là toàn bộ nội dung của mã này.

---

## `COPY-3` — key không được vượt biên

### Case: nhãn của một nút

ĐÚNG — chuỗi vượt biên:

```tsx
// index.tsx
<_ExportButton props={{ label: t("exportCsv") }} />
```

SAI — key vượt biên:

```tsx
// index.tsx
<_ExportButton props={{ labelKey: "report.exportCsv" }} />

// component.tsx
export const _ExportButton = ({ props }: ExportButtonProps) => {
    const t = useTranslations()
    return <button type="button">{t(props.labelKey)}</button>
}
```

Nhìn thì như đã "tách i18n ra ngoài", nhưng cái được dời là **chỗ tra cứu**, không phải **quyết
định**. Nửa vẽ vẫn cần cả runtime dịch, nên nó vẫn không dựng được từ fixture.

### Case: một mảng cấu hình menu — chỗ key đi lậu dễ nhất

ĐÚNG:

```tsx
// index.tsx
const items = [
    { id: "profile", label: t("menu.profile") },
    { id: "billing", label: t("menu.billing") },
    { id: "signOut", label: t("menu.signOut") },
]
return <_AccountMenu props={{ items }} />
```

SAI:

```tsx
// component.tsx
const ITEMS = [
    { id: "profile", labelKey: "menu.profile" },
    { id: "billing", labelKey: "menu.billing" },
    { id: "signOut", labelKey: "menu.signOut" },
]
```

Mảng hằng số **trông như dữ liệu**, nên nó qua được review dễ hơn một prop đơn lẻ. Nó vẫn là key nằm
dưới ranh giới, chỉ là nằm theo lô.

### Ngoại lệ và nhầm lẫn

- **`selectedKey` không phải key từ điển.** Nó tra vào chính danh sách đang render, không tra vào từ
  điển nào cả:

  ```tsx
  <ChoiceTabs
      props={{
          selectedKey: props.selectedKey,
          items: props.items, // mỗi item đã mang `label` là chuỗi đã resolve
      }}
  />
  ```

  Phép thử: xoá hết từ điển khỏi dự án — `selectedKey` vẫn render đúng, `labelKey` thì không.

- **Một union đóng của tên biến thể cũng không phải key.** `tone: "warning"` chọn màu, không chọn chữ.

---

## `COPY-4` — chữ đã resolve là một value

### Case: kiểu của nửa vẽ chỉ nói về chuỗi

ĐÚNG:

```tsx
// component.tsx
export type QuotaRowProps =
    | { readonly state: "empty" }
    | { readonly state: "pending"; readonly props: { readonly label: string } }
    | { readonly state: "settled"; readonly props: { readonly label: string; readonly value: string } }
```

SAI:

```tsx
// component.tsx
export type QuotaRowProps = {
    readonly state: "empty" | "pending" | "settled"
    readonly messageNamespace: string
    readonly remaining?: number
}
```

Kiểu thứ hai bắt nửa vẽ tự ghép câu từ số liệu, nên nó vừa phải biết ngữ pháp của ngôn ngữ đang hiển
thị vừa phải biết state nào thì ghép câu nào.

### Case: bài test là bằng chứng của mã này

ĐÚNG — không mount provider nào, chữ là chuỗi bịa:

```tsx
// component.test.tsx
it("renders the settled row", () => {
    render(<_QuotaRow state="settled" props={{ label: "anything", value: "anything else" }} />)
    expect(screen.getByText("anything")).toBeInTheDocument()
})
```

SAI — test phải dựng cả thế giới ngôn ngữ mới chạy được:

```tsx
// component.test.tsx
it("renders the settled row", () => {
    render(
        <TranslationProvider locale="en" messages={messages}>
            <_QuotaRow state="settled" />
        </TranslationProvider>,
    )
    expect(screen.getByText("Weekly credit")).toBeInTheDocument()
})
```

Test thứ hai đổi màu mỗi lần ai đó sửa một câu trong từ điển. Nó không còn kiểm nửa vẽ nữa, nó kiểm
bản dịch.

### Ngoại lệ và nhầm lẫn

- **Chữ chui xuống bằng context toàn cục vẫn là vi phạm**, kể cả khi nó đã được resolve đúng chỗ:

  ```tsx
  {/* SAI */}
  const { emptyText } = useCopyContext()
  return <p>{emptyText}</p>
  ```

  Đúng chỗ chọn, sai đường đi: nửa vẽ lại cần một provider mới render được, đúng cái giá mà `COPY-4`
  bỏ tiền ra mua.

- **Fixture được phép viết chuỗi thật nguyên văn**, vì nó tái hiện dữ liệu chứ không tác quyền.

---

## `COPY-5` — từ điển là ngôn ngữ kia, nên nó không phải source

### Case: nội dung từ điển

ĐÚNG — file trong thư mục locale chứa đúng thứ nó phải chứa:

```json
{
  "quota": {
    "weeklyCredit": "Hạn mức tuần này",
    "remainingOf": "Còn {remaining} trên {limit}"
  }
}
```

SAI — đem luật ngôn ngữ của source vào áp lên nội dung, rồi "sửa" nó:

```json
{
  "quota": {
    "weeklyCredit": "Weekly credit",
    "remainingOf": "{remaining} of {limit} remaining"
  }
}
```

File thứ hai không sai cú pháp, nó sai **danh tính**: đây là catalogue của ngôn ngữ kia, và một
catalogue chỉ chứa tiếng Anh thì không dịch gì cả.

### Case: miễn trừ là đường dẫn, không phải phán đoán

```js
// .claude/sources/fe/comments.mjs
export const CONTENT_PATHS = [
  /\/messages\/[a-z-]+\.json$/i,
  /\/src\/resources\//,
  /\/__fixtures?__\//,
  /\.test\.(ts|tsx|js|mjs|cjs)$/i,
]
```

Đây là chỗ quyết định đắt nhất của mã này nằm lộ ra: miễn theo **danh sách đường dẫn**. Một miễn trừ
dựa trên phán đoán ("file này rõ ràng là nội dung mà") sẽ được đem ra cãi lại ở từng file, mãi mãi,
và mỗi lần cãi lại là một lần luật mềm đi một chút.

### Ngoại lệ và nhầm lẫn

- **Một file `.ts` xuất ra hằng số chữ tiếng Việt không nằm trong miễn trừ**, kể cả khi tác giả gọi nó
  là "từ điển của tôi":

  ```ts
  // SAI: đây là source, không phải thư mục locale
  export const LABELS = { weeklyCredit: "Hạn mức tuần này" }
  ```

  Muốn được miễn thì phải nằm đúng chỗ được miễn. Đó chính là ý nghĩa của việc miễn theo đường dẫn.

---

## `COPY-6` — chữ mà chương trình so khớp thì không phải copy

### Case: trạng thái server gửi verbatim

ĐÚNG:

```ts
// vn-ok: server gửi nguyên văn trạng thái này và màn hình so khớp với nó
const CANCELLED = "Da huy"

export const isCancelled = (order: Order) => order.status === CANCELLED
```

SAI:

```ts
const CANCELLED = t("status.cancelled")

export const isCancelled = (order: Order) => order.status === CANCELLED
```

Khác nhau đúng một điều: phép so sánh còn đúng không sau khi từ điển đổi. Và cái hỏng ở bản SAI là
**im lặng** — không lỗi biên dịch, không exception, chỉ có một nhánh không bao giờ chạy nữa.

### Case: một chuỗi vừa được so khớp vừa được hiển thị

SAI — dùng một chuỗi cho cả hai việc:

```tsx
<span>{order.status}</span>
{order.status === "Da huy" && <RefundNotice />}
```

ĐÚNG — tách value dùng để so, khỏi chữ dùng để hiện:

```tsx
// index.tsx
const STATUS_CANCELLED = "Da huy" // vn-ok: giá trị server gửi, dùng để so khớp

<_OrderRow
    props={{ statusText: t(`status.${order.status === STATUS_CANCELLED ? "cancelled" : "active"}`) }}
    state={order.status === STATUS_CANCELLED ? "cancelled" : "active"}
/>
```

Một chuỗi không thể vừa là hợp đồng với server vừa là câu cho người đọc: hai bên đổi vì hai lý do
khác nhau, vào hai thời điểm khác nhau.

### Ngoại lệ và nhầm lẫn

- **Dấu không biến copy thành value.** Đây là cách mã này bị dùng sai nhiều nhất:

  ```tsx
  {/* SAI: đây là copy, chỉ đang được đánh dấu để lọt cổng ngôn ngữ */}
  const title = "Đã hoàn tất ôn tập" // vn-ok: localized interface copy
  ```

  Phép thử của `COPY-6` là **có đoạn code nào so sánh với chuỗi này không**. Nếu không có, nó là copy,
  và nó thuộc từ điển — dù dòng đó đã được đánh dấu. Không có gì trong hệ thống bắt được chỗ này; xem
  `audit.md`.

- **Tên sự kiện analytics và khoá map cũng là value:**

  ```ts
  track("checkout_completed") // không ai đọc chuỗi này, một dashboard so khớp nó
  ```

---

## Ánh xạ yêu cầu sang một quyết định

Nêu file, tier của nó, và vai trò của chuỗi. Nếu thiếu **một** dữ kiện quyết định, hỏi **một** câu cụ
thể rồi dừng. Câu trả lời phải là một quyết định hoặc một câu hỏi — không bao giờ cả hai.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| Thêm nhãn "Hạn mức tuần này" cho một stat row | Câu mô tả câu trả lời của request | `COPY-1` | Resolve trong `index.tsx`, truyền `label` xuống |
| Thêm placeholder cho ô tìm kiếm trong một composite | Người đọc nhìn thấy chuỗi này | `COPY-2` | Nhận `placeholder` qua `props` |
| Nút icon-only cần nhãn cho screen reader | Screen reader đọc `aria-label` như văn bản chính | `COPY-2` | Nhận `label` qua `props` |
| "Để đỡ lặp, truyền `labelKey` xuống leaf" | Dời chỗ tra, không dời quyết định | `COPY-3` | Từ chối; truyền chuỗi đã resolve |
| Nửa vẽ cần biết còn bao nhiêu để ghép câu | Ghép câu là việc của nửa biết ngữ pháp và tình huống | `COPY-4` | Truyền chuỗi đã format, không truyền số |
| Lint báo tiếng Việt trong `messages/vi.json` | Đó là nội dung, không phải tác quyền | `COPY-5` | Miễn theo đường dẫn, không sửa file |
| Trạng thái server gửi bằng tiếng Việt, code so khớp với nó | Chương trình đọc chuỗi này, không phải người đọc | `COPY-6` | Giữ nguyên, đánh dấu lý do trên dòng |
| Một hằng số tiếng Việt trong page, không có chỗ nào so khớp | Chưa chứng minh được là value ⇒ mặc định là copy | `COPY-1` | Đưa vào từ điển, resolve tại nửa connected |

Ở dòng cuối, chỉ hỏi khi bên yêu cầu làm rõ chuỗi đó có bên thứ ba so khớp:
*"Có đoạn code hoặc hệ thống nào so sánh với đúng chuỗi này không?"*

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `COPY-1` / `COPY-2` | Chuỗi đang được **chọn** sai chỗ, hay đang **nằm** sai chỗ? |
| `COPY-1` / `COPY-3` | Nửa connected đã quyết định ra chữ, hay mới quyết định ra một cái tên để tra? |
| `COPY-2` / `COPY-6` | Người đọc đọc chuỗi này, hay chương trình so khớp nó? |
| `COPY-3` / `COPY-4` | Con có phải tra thêm một bước nữa mới ra chữ không? |
| `COPY-4` / `COPY-1` | Chữ đến bằng `props`, hay bằng một provider mà con phải có mới render được? |
| `COPY-5` / `COPY-6` | Được miễn vì **là nội dung**, hay được giữ vì **bị so khớp**? |
| `COPY-6` / mọi mã khác | Xoá phép so sánh đi thì chuỗi này còn lý do tồn tại nguyên văn không? |

## Sai lầm lặp lại nhiều nhất

1. Gọi hook dịch trong `component.tsx` vì "chỗ đó dùng chữ đó nhiều nhất".
2. Bỏ sót `aria-label`, `placeholder`, `title`, `alt` — bốn chỗ không trông giống câu.
3. Truyền `labelKey` xuống rồi tưởng như thế là đã tách i18n.
4. Giấu một lô key trong mảng hằng số, vì mảng trông như dữ liệu.
5. Truyền số xuống nửa vẽ rồi để nó tự ghép câu.
6. Sửa file trong thư mục locale cho "đúng luật tiếng Anh".
7. Dán `vn-ok:` lên một câu copy chỉ để nó lọt cổng ngôn ngữ.
8. Dùng một chuỗi vừa để so khớp vừa để hiển thị.
