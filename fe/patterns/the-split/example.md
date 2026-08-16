---
id: fe-patterns-the-split-example
title: example.md
slug: /fe/patterns/the-split/example
sidebar_label: example.md
sidebar_position: 2
description: Tất cả case và ngoại lệ của từng mã SPLIT-N, viết bằng TSX thường.
---

# example.md

> Version: `2.00` · Module: `the-split` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **TSX thường với props thường**. Không component library, không design system
riêng, không tên sản phẩm. Một luật chỉ đúng khi nó đúng ở bất kỳ front end nào — nên nếu một ví dụ
cần tên riêng của một sản phẩm mới đọc được, ví dụ đó sai chỗ.

Tên hook trong ví dụ (`useQuery*Swr`, `useTranslations`, `useLocale`, `useAppSelector`) là **đúng
những họ tên mà rule đọc**. Chúng ở đây để ví dụ kiểm được, không phải để giới thiệu một thư viện.

Mỗi mã có **nhiều case**, từng case có ĐÚNG và SAI đặt cạnh nhau, sau đó là **ngoại lệ và nhầm lẫn**.
Phần cuối trang ánh xạ từ yêu cầu bằng lời sang hai nửa.

---

## `SPLIT-1` — nửa vẽ nhận hết, không hỏi gì

### Case: một hàng số liệu

```tsx
// component.tsx — ĐÚNG: mọi giá trị đã được quyết định trước khi vào đây
export type SeatCounterProps =
    | { readonly state: "pending"; readonly props: { readonly label: string } }
    | { readonly state: "settled"; readonly props: { readonly label: string; readonly value: string } }

export const _SeatCounter = (input: SeatCounterProps) => (
    <p>
        <span>{input.props.label}</span>
        <span>{input.state === "settled" ? input.props.value : "—"}</span>
    </p>
)
```

```tsx
// component.tsx — SAI: file này chỉ render được khi cả thế giới đã được dựng lên
export const _SeatCounter = () => {
    const t = useTranslations("seat")
    const seats = useQuerySeatsSwr()
    return <p><span>{t("label")}</span><span>{seats.data?.remaining ?? "—"}</span></p>
}
```

Khác nhau đúng một điều: bản trên viết được test bằng một object props, bản dưới thì phải mock hai
thứ trước khi thấy được một dòng chữ.

### Case: đọc locale để format số

```tsx
// index.tsx — ĐÚNG: số được format ở nửa biết locale, rồi đi xuống dưới dạng chuỗi
export const OrderTotal = () => {
    const locale = useLocale()
    const order = useQueryOrderSwr()
    if (order.data === undefined) return <_OrderTotal state="pending" />
    return <_OrderTotal state="settled" props={{ total: order.data.total.toLocaleString(locale) }} />
}
```

```tsx
// component.tsx — SAI: đọc locale ở nửa vẽ là đúng cái phụ thuộc mà split sinh ra để cắt
export const _OrderTotal = (input: { readonly total: number }) => {
    const locale = useLocale()
    return <strong>{input.total.toLocaleString(locale)}</strong>
}
```

### Case: store toàn cục

```tsx
// index.tsx — ĐÚNG: đọc store là việc của nửa connected
export const CartBadge = () => {
    const count = useAppSelector((store) => store.cart.items.length)
    return <_CartBadge props={{ count }} />
}
```

```tsx
// component.tsx — SAI: nửa vẽ không render được nếu không có store provider
export const _CartBadge = () => {
    const count = useAppSelector((store) => store.cart.items.length)
    return <span>{count}</span>
}
```

### Ngoại lệ và nhầm lẫn

- **Hàm thuần thì không phải "hỏi thế giới".** Format một chuỗi đã có sẵn trong props là tính toán,
  không phải phụ thuộc:

  ```tsx
  // component.tsx — ĐÚNG: không có gì để mock, mọi đầu vào đều nằm trong props
  const initials = (name: string) => name.split(" ").map((part) => part[0]).join("")
  export const _MemberRow = (input: { readonly name: string }) => <span>{initials(input.name)}</span>
  ```

- **`useState` trong nửa vẽ vẫn hợp lệ.** Mở/đóng một chi tiết là trạng thái của việc vẽ, không phải
  của dữ liệu.
- **Rule chỉ soi tên file `component.tsx`.** Đưa request sang một file khác cùng folder rồi import
  vào nửa vẽ thì rule im lặng nhưng luật vẫn gãy — cái bị cấm là **phụ thuộc**, không phải cái tên.

---

## `SPLIT-2` — nửa connected chốt tình huống, không chốt hình thức

### Case: trạng thái rỗng

```tsx
// index.tsx — ĐÚNG: nó nói ĐÂY LÀ TÌNH HUỐNG GÌ và dừng lại ở đó
export const InvoiceList = () => {
    const t = useTranslations("invoice")
    const invoices = useQueryInvoicesSwr()
    if (invoices.data === undefined) return <_InvoiceList state="pending" />
    if (invoices.data.length === 0) return <_InvoiceList state="empty" props={{ hint: t("noneYet") }} />
    return <_InvoiceList state="settled" props={{ rows: invoices.data }} />
}
```

```tsx
// index.tsx — SAI: nó đang quyết định trạng thái rỗng TRÔNG thế nào
export const InvoiceList = () => {
    const invoices = useQueryInvoicesSwr()
    if (invoices.data?.length === 0) {
        return <_InvoiceList state="empty" props={{ hint: t("noneYet"), align: "center", spacing: "loose" }} />
    }
    return <_InvoiceList state="settled" props={{ rows: invoices.data ?? [] }} />
}
```

`align` và `spacing` sai được khi mạng vẫn tốt, nên chúng thuộc nửa vẽ. Nửa connected không nhìn thấy
cạnh nó có gì, nên nó đang chọn khoảng cách trong tình trạng mù.

### Case: hai lý do rỗng khác nhau

```tsx
// index.tsx — ĐÚNG: hai tình huống nghiệp vụ khác nhau, hai cái tên khác nhau
export const SearchResults = (input: { readonly keyword: string }) => {
    const t = useTranslations("search")
    const results = useQuerySearchSwr(input.keyword)
    if (results.data === undefined) return <_SearchResults state="pending" />
    if (results.data.length > 0) return <_SearchResults state="settled" props={{ rows: results.data }} />
    return input.keyword === ""
        ? <_SearchResults state="idle" props={{ hint: t("typeToSearch") }} />
        : <_SearchResults state="noMatch" props={{ hint: t("noMatch", { keyword: input.keyword }) }} />
}
```

```tsx
// index.tsx — SAI: gộp hai tình huống thành một rồi bù lại bằng một prop hình thức
export const SearchResults = (input: { readonly keyword: string }) => {
    const results = useQuerySearchSwr(input.keyword)
    return <_SearchResults state="empty" props={{ rows: results.data ?? [], variant: input.keyword === "" ? "muted" : "bold" }} />
}
```

Phân biệt "chưa gõ gì" với "gõ rồi mà không ra" là việc **chỉ** nửa connected làm được. Chọn `muted`
hay `bold` thì ngược lại.

### Ngoại lệ và nhầm lẫn

- **Sắp xếp và lọc theo nghiệp vụ vẫn là việc của nửa connected.** Sắp theo ngày đến hạn là một quyết
  định về dữ liệu, không phải về hình thức:

  ```tsx
  // index.tsx — ĐÚNG: thứ tự này sai được KHI DỮ LIỆU SAI, nên nó thuộc nửa này
  const rows = [...invoices.data].sort((left, right) => left.dueAt.localeCompare(right.dueAt))
  ```

- **Cắt bớt danh sách cho vừa chỗ thì không.** "Chỉ hiện 5 dòng" là quyết định của cái nhìn thấy chỗ
  trống, tức là nửa vẽ.
- **Một prop tên nghiệp vụ nhưng nghĩa hình thức vẫn phá `SPLIT-2`.** `density="compact"` chỉ đổi tên
  chứ không đổi bản chất.

---

## `SPLIT-3` — tình huống băng qua dưới dạng một cái tên

### Case: vòng đời một request

```tsx
// component.tsx — ĐÚNG: tập đóng, mỗi thành viên mang đúng dữ liệu của tình huống đó
export type PriceSummaryProps =
    | { readonly state: "pending" }
    | { readonly state: "failed"; readonly props: { readonly message: string; readonly retryLabel: string } }
    | { readonly state: "settled"; readonly props: { readonly total: string; readonly items: ReadonlyArray<Line> } }
```

```tsx
// component.tsx — SAI: mười sáu tổ hợp, phần lớn chưa ai từng thấy
export type PriceSummaryProps = {
    readonly isLoading: boolean
    readonly hasError: boolean
    readonly isEmpty: boolean
    readonly items: ReadonlyArray<Line>
}
```

Khác nhau đúng một điều: bản dưới cho phép viết ra `isLoading` và `hasError` cùng `true`, và không ai
trả lời được lúc đó phải vẽ gì.

### Case: dữ liệu chỉ tồn tại ở một tình huống

```tsx
// component.tsx — ĐÚNG: `message` chỉ tồn tại ở nhánh thất bại, nên không cần kiểm tra ở nhánh khác
export const _PriceSummary = (input: PriceSummaryProps) => {
    if (input.state === "pending") return <output>…</output>
    if (input.state === "failed") return <output>{input.props.message}</output>
    return <output>{input.props.total}</output>
}
```

```tsx
// component.tsx — SAI: mọi thứ optional, nên mọi nhánh đều phải phòng thủ và không nhánh nào chắc chắn
export const _PriceSummary = (input: { readonly total?: string; readonly message?: string; readonly isLoading?: boolean }) => {
    if (input.isLoading) return <output>…</output>
    if (input.message !== undefined) return <output>{input.message}</output>
    return <output>{input.total ?? "—"}</output>
}
```

### Ngoại lệ và nhầm lẫn

- **Cờ nằm DƯỚI đường ranh thì hợp lệ.** Nửa vẽ suy ra cờ từ tên rồi đưa xuống một thứ nhỏ hơn:

  ```tsx
  // component.tsx — ĐÚNG: `state` băng qua đường ranh, `isLoading` chỉ sống bên trong nửa vẽ
  export const _SeatCounter = (input: SeatCounterProps) => (
      <FactRow label={input.props.label} isLoading={input.state === "pending"} />
  )
  ```

- **Một boolean nghiệp vụ độc lập không phải là cờ vòng đời.** `isPinned` không nằm trên cùng một
  vòng đời với `pending`/`failed`, nên nó không tạo ra tổ hợp vô nghĩa nào.
- **`state` là tên, không phải chuỗi tự do.** `state: string` mở lại đúng cánh cửa mà union vừa đóng.

---

## `SPLIT-4` — chữ được dịch xong trước khi băng qua

### Case: nhãn và thông báo lỗi

```tsx
// index.tsx — ĐÚNG: chữ đi qua đường ranh ở dạng người đọc được
return <_DailyGoal state="failed" props={{ label: t("label"), message: t("failed"), retryLabel: t("retry") }} />
```

```tsx
// index.tsx — SAI: chữ đi qua ở dạng lời hứa, và nửa vẽ phải tự đi thực hiện lời hứa đó
return <_DailyGoal state="failed" props={{ labelKey: "goal.label", messageKey: "goal.failed" }} />
```

Khác nhau đúng một điều: bản dưới bắt nửa vẽ mang theo cả runtime dịch chỉ để hiện một câu.

### Case: chuỗi phụ thuộc số lượng

```tsx
// index.tsx — ĐÚNG: dạng số nhiều được quyết định ở nơi biết cả số lượng lẫn ngôn ngữ
const summary = t("remaining", { count: quota.data.remaining })
return <_QuotaRow state="settled" props={{ summary }} />
```

```tsx
// component.tsx — SAI: nửa vẽ ghép chuỗi, và luật số nhiều của ngôn ngữ khác lập tức sai
export const _QuotaRow = (input: { readonly count: number; readonly noun: string }) => (
    <span>{input.count} {input.noun}{input.count > 1 ? "s" : ""}</span>
)
```

### Ngoại lệ và nhầm lẫn

- **Chuỗi định danh không phải copy.** Đây là dữ liệu, không phải chữ, và nó băng qua bình thường:

  ```tsx
  // component.tsx — ĐÚNG: `selectedId` để so sánh, không để hiển thị
  export const _ResultList = (input: { readonly selectedId?: string; readonly rows: ReadonlyArray<Row> }) => …
  ```

- **Nội dung do người dùng nhập không đi qua tầng dịch.** Tên khoá học, tiêu đề bài viết là dữ liệu.
- **Prop tên `*Key` không tự động sai; prop `*Key` mà nửa vẽ đem đi tra mới sai.** Hãy nhìn chỗ dùng,
  đừng nhìn cái tên.

---

## `SPLIT-5` — nửa connected không tự vẽ gì

### Case: block một dòng

```tsx
// index.tsx — ĐÚNG: mọi nhánh đều băng qua đúng một sinh đôi
export const CreditRow = () => {
    const t = useTranslations("credit")
    const quota = useQueryQuotaSwr()
    if (quota.error !== undefined) return <_CreditRow state="empty" />
    if (quota.data === undefined) return <_CreditRow state="pending" props={{ label: t("label") }} />
    return <_CreditRow state="settled" props={{ label: t("label"), value: String(quota.data.remaining) }} />
}
```

```tsx
// index.tsx — SAI: "block này mỏng quá, tách làm gì" — và file vừa trở thành cả hai nửa
export const CreditRow = () => {
    const t = useTranslations("credit")
    const quota = useQueryQuotaSwr()
    return <FactRow label={t("label")} value={String(quota.data?.remaining ?? 0)} />
}
```

Khác nhau đúng một điều: mọi lần render của bản trên đều băng qua một file test được bằng fixture.

### Case: nhánh sớm

```tsx
// index.tsx — ĐÚNG: "không hiện gì" cũng là một tình huống có tên, và nửa vẽ quyết định nó trông sao
if (notifications.data?.length === 0) return <_NotificationBell state="empty" />
```

```tsx
// index.tsx — SAI: nhánh này không băng qua sinh đôi, nên có một trạng thái không test được từ fixture
if (notifications.data?.length === 0) return null
```

### Case: sinh đôi chỉ forward

```tsx
// component.tsx — ĐÚNG: dù chỉ forward, đây vẫn là điểm băng qua và là chỗ trạng thái thứ hai sẽ rơi vào
export const _MemberCard = (input: { readonly props: { readonly name: string; readonly role: string } }) => (
    <ProfileCard name={input.props.name} role={input.props.role} />
)
```

```tsx
// index.tsx — SAI: bỏ sinh đôi vì nó "chẳng làm gì", và lần thêm trạng thái sau sẽ phải sửa cả hai nửa cùng lúc
export const MemberCard = () => {
    const member = useQueryMemberSwr()
    return <ProfileCard name={member.data?.name ?? ""} role={member.data?.role ?? ""} />
}
```

### Ngoại lệ và nhầm lẫn

- **Fragment bọc ngoài không phải là vẽ, nhưng thứ nằm cạnh sinh đôi thì có.** Ở đây file đã sở hữu
  hai cây và rule sẽ báo `bypass`:

  ```tsx
  // index.tsx — SAI: overlay là một cây thứ hai do nửa connected tự vẽ
  return (
      <>
          <_CourseRow state="settled" props={{ rows }} />
          <PriceOverlay courseId={pricedId} />
      </>
  )
  ```

- **Sinh đôi mang đúng tên folder.** `_X` được cố định từ tên folder, nên đổi tên component mà không
  đổi tên folder là làm rule báo `missing` chứ không phải làm nó im.
- **Import sinh đôi rồi không render nó** là lỗi riêng, có message riêng (`unused`), vì nó thường là
  dấu vết của một lần refactor bỏ dở.

---

## `SPLIT-6` — không có request thì không tách

### Case: surface ghép từ các surface connected

```tsx
// index.tsx — ĐÚNG: cha không đọc gì, nên không có sinh đôi và không có file thứ hai
export const StatRail = () => (
    <aside>
        <StreakRow />
        <CreditRow />
        <RewardRow />
    </aside>
)
```

```tsx
// component.tsx — SAI: file thứ hai không giữ điều gì mà file thứ nhất có thể làm sai
export const _StatRail = (input: { readonly children: ReactNode }) => <aside>{input.children}</aside>
```

Ba con tự trả lời theo nhịp riêng của chúng. Nếu cha gom chúng lại thành một trạng thái chung, cả rail
sẽ chờ con chậm nhất — đó là một quyết định nghiệp vụ khác, và nó phải được nêu ra chứ không phải rơi
ra từ một lần tách file.

### Case: chỉ có state UI cục bộ

```tsx
// index.tsx — ĐÚNG: giữ tab đang chọn không đọc gì cả, nên chưa có nửa dữ liệu nào để tách
export const LibraryTabs = () => {
    const [tab, setTab] = useState<"all" | "mine">("all")
    return (
        <section>
            <TabBar value={tab} onChange={setTab} />
            {tab === "all" ? <AllCourses /> : <MyCourses />}
        </section>
    )
}
```

```tsx
// index.tsx — SAI: tách đôi một surface không fetch, và bây giờ mỗi lần sửa phải mở hai file
export const LibraryTabs = () => {
    const [tab, setTab] = useState<"all" | "mine">("all")
    return <_LibraryTabs props={{ tab }} on={{ change: setTab }} />
}
```

### Ngoại lệ và nhầm lẫn

- **Thêm một request là hết `SPLIT-6`.** Đúng lúc dòng này xuất hiện, folder nợ một `component.tsx`:

  ```tsx
  // index.tsx — từ dòng này trở đi, SPLIT-5 bật lên và surface phải có sinh đôi
  const tabs = useQueryVisibleTabsSwr()
  ```

- **Nhận props từ cha không phải là đọc thế giới.** Một leaf nhận mọi thứ từ trên xuống vẫn là một
  file, và nó vốn đã là "nửa vẽ" của cả cây.
- **Đừng tách trước cho "sau này cần".** File thứ hai rỗng nghĩa không tạo ra đường ranh nào; nó chỉ
  tạo ra một chỗ để người sau tưởng rằng đường ranh đã có.

---

## Ánh xạ yêu cầu sang hai nửa

Nêu surface, nó có request hay không, và tập tình huống. Nếu thiếu **một** dữ kiện quyết định, hỏi
**một** câu cụ thể rồi dừng.

| Yêu cầu bằng lời | Lập luận | Mã quyết định | Kết quả |
|---|---|---|---|
| Hiện số credit còn lại tuần này | Có một request, có ba tình huống | `SPLIT-5` | `index.tsx` + `component.tsx`, sinh đôi `_CreditRow` |
| Danh sách hoá đơn, có lúc rỗng | Rỗng là một tình huống, không phải một kiểu trình bày | `SPLIT-2` | `state="empty"` do `index.tsx` chốt |
| Rỗng-vì-chưa-gõ khác rỗng-vì-không-ra | Hai sự thật nghiệp vụ khác nhau | `SPLIT-3` | Hai thành viên union, không phải một cờ |
| Nhãn phải đổi theo ngôn ngữ | Chữ đã dịch là một giá trị | `SPLIT-4` | `index.tsx` gọi tầng dịch, truyền chuỗi |
| Block chỉ có một dòng, một cây, không state | Mỏng là lý do để tách chứ không phải để bỏ qua | `SPLIT-5` | Vẫn hai file, vẫn `_X` |
| Rail ghép ba block đã tự fetch | Cha không đọc gì | `SPLIT-6` | Một file |
| Tab container giữ tab đang chọn | State UI không phải request | `SPLIT-6` | Một file |
| Bảng kết quả cần format số theo ngôn ngữ | Đọc locale là hỏi thế giới | `SPLIT-1` | Format ở `index.tsx`, gửi chuỗi xuống |

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `SPLIT-1` / `SPLIT-2` | File này đang **đi hỏi** thế giới, hay đang **quyết định** thứ nó không nhìn thấy? |
| `SPLIT-2` / `SPLIT-3` | Tình huống bị chốt sai, hay bị chốt đúng rồi gửi đi sai hình dạng? |
| `SPLIT-3` / `SPLIT-4` | Cái băng qua là một tình huống, hay là một chuỗi chưa đọc được? |
| `SPLIT-2` / `SPLIT-5` | Quyết định trình bày rò rỉ qua **props**, hay markup nằm thẳng trong file connected? |
| `SPLIT-5` / `SPLIT-6` | Surface này có tự đọc thế giới không? Không đọc thì không nợ sinh đôi. |
| `SPLIT-6` / mọi mã khác | Có request nào ở đây không? Không có request thì không có đường ranh để giữ. |

## Sai lầm lặp lại nhiều nhất

1. "Block này mỏng quá, tách làm gì" — rồi trạng thái thứ hai xuất hiện và cả hai nửa phải sửa cùng lúc.
2. Gửi `isLoading` + `hasError` thay vì một cái tên, rồi tự bịa ra thứ tự nhánh để bù.
3. Gửi key thay vì chữ, và nửa vẽ mang theo cả runtime dịch vào test.
4. Đọc locale ngay trong `component.tsx` vì "chỉ format một con số thôi".
5. Nhánh sớm `return null` trong file connected — một trạng thái không băng qua sinh đôi.
6. Nửa connected truyền xuống `variant`/`spacing` để "cho đẹp hơn tí".
7. Tách đôi một surface không fetch, rồi mọi lần sửa đều phải mở hai file.
8. Đổi tên component mà không đổi tên folder, khiến sinh đôi không còn khớp tên folder nữa.
