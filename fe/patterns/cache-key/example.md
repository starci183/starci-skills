---
id: fe-patterns-cache-key-example
title: example.md
slug: /fe/patterns/cache-key/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi case và ngoại lệ của từng mã CACHE-N, viết bằng hook và TSX thường.
---

# example.md

> Version: `2.00` · Module: `cache-key` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **hook thường trên TSX thường**. Không component library, không design system
riêng, không registry key. Một luật chỉ đúng khi nó đúng ở bất kỳ front end nào — nên nếu một ví dụ
cần tên riêng của một sản phẩm để đọc được, ví dụ đó sai chỗ.

Mỗi mã có **nhiều case**, mỗi case đặt **ĐÚNG** cạnh **SAI**, rồi tới mục **ngoại lệ và nhầm lẫn**.
Phần cuối trang ánh xạ từ yêu cầu bằng lời sang một quyết định key duy nhất.

---

## `CACHE-1` — mọi giá trị làm đổi câu trả lời đều nằm trong key

### Case: danh sách có bộ lọc

Người dùng đổi bộ lọc, và **server trả về một tập khác**. Nếu bộ lọc không nằm trong key thì hai bộ
lọc là một entry: cái nào fetch trước thì cái sau đọc ké, và bảng đứng yên.

```tsx
// ĐÚNG — mỗi bộ lọc là một câu hỏi khác, nên là một key khác
const useOrderListSwr = (status: OrderStatus, page: number) =>
    useSWR([ORDER_LIST_KEY, status, page], async ([, filter, at]: [string, OrderStatus, number]) =>
        queryOrders({ request: { status: filter, page: at } }),
    )
```

```tsx
// SAI — hai bộ lọc dùng chung một tên, nên dùng chung một câu trả lời
const useOrderListSwr = (status: OrderStatus, page: number) =>
    useSWR(ORDER_LIST_KEY, async () => queryOrders({ request: { status, page } }))
```

Chúng khác nhau đúng một chỗ: đổi bộ lọc có phải là **hỏi một câu khác** hay không.

### Case: fetcher đọc tham số ra từ key

Cùng một `courseId` viết ở hai nơi là **hai bản sao của một sự thật**. Sau một lần re-render chúng có
thể lệch — và entry lúc đó mang tên câu hỏi này nhưng giữ câu trả lời của câu hỏi kia.

```tsx
// ĐÚNG — fetcher chỉ biết những gì key đã nói
useSWR([ITEM_DETAIL_KEY, itemId], async ([, id]: [string, string]) =>
    queryItemDetail({ request: { itemId: id } }),
)
```

```tsx
// SAI — tên entry và request đã lấp đầy nó có thể bất đồng
useSWR([ITEM_DETAIL_KEY, itemId], async () => queryItemDetail({ request: { itemId } }))
```

Bản SAI **chạy đúng trong hầu hết trường hợp**, và đó chính là vấn đề: nó chỉ sai vào đúng khoảnh
khắc key đã đổi mà closure chưa kịp — tức là lúc khó tái hiện nhất.

### Case: mảnh bị bỏ quên là một ngôn ngữ

Câu trả lời có chữ trong đó, và chữ đổi theo locale đang phục vụ.

```tsx
// ĐÚNG — nội dung đã dịch là một câu trả lời khác
useSWR([ARTICLE_KEY, slug, locale], async ([, id, lang]: [string, string, string]) =>
    queryArticle({ request: { slug: id, locale: lang } }),
)
```

```tsx
// SAI — đổi ngôn ngữ, màn hình vẫn giữ nguyên bản dịch cũ cho tới khi reload
useSWR([ARTICLE_KEY, slug], async ([, id]: [string, string]) =>
    queryArticle({ request: { slug: id, locale } }),
)
```

Bản SAI hỏng **hai lần**: thiếu mảnh trong key, và fetcher lại đọc `locale` từ closure — đúng hai lỗi
mà case trên đã tách riêng.

### Case: nhiễu trong key

Chiều ngược lại cũng là lỗi, chỉ là lỗi rẻ hơn. Một giá trị server không dùng tới mà nằm trong key sẽ
xé một entry thành nhiều entry giống hệt nhau.

```tsx
// ĐÚNG — server không hề biết tới trạng thái mở/đóng của panel
useSWR([SUMMARY_KEY, reportId], fetchSummary)
```

```tsx
// SAI — panel đóng mở một cái là fetch lại, dù câu trả lời không đổi
useSWR([SUMMARY_KEY, reportId, isPanelOpen], fetchSummary)
```

Phép thử duy nhất vẫn là câu hỏi cũ: nếu giá trị này khác đi, **server** có trả về thứ khác không?

### Case: một object làm mảnh key

Một object dựng mới mỗi lần render là một mảnh key **mới mỗi lần render**, kể cả khi nội dung y hệt.

```tsx
// ĐÚNG — các mảnh là giá trị nguyên thuỷ, so sánh được
useSWR([SEARCH_KEY, term, sort, page], fetchSearch)
```

```tsx
// SAI — `{ term, sort, page }` là một tham chiếu mới ở mỗi lần render
useSWR([SEARCH_KEY, { term, sort, page }], fetchSearch)
```

Đây là chỗ luật gặp cơ chế: key được so bằng cấu trúc nông, nên một object lồng biến "câu hỏi giống
nhau" thành "câu hỏi mới" liên tục.

### Ngoại lệ và nhầm lẫn

- **Key chỉ có prefix là hợp lệ** khi câu trả lời thật sự là một, cho tất cả, mãi mãi:

  ```tsx
  // ĐÚNG — changelog công khai, không đổi theo ai và theo tham số nào
  useSWR(PUBLIC_CHANGELOG_KEY, fetchChangelog)
  ```

- **Nó hết hợp lệ ngay khi có một tham số đầu tiên** — kể cả tham số "chỉ dùng cho lần đầu".
- **Đừng đưa `Date.now()` hay một `uuid` vào key** để "ép fetch lại". Đó là dựng một câu hỏi mới mỗi
  lần thay vì làm mất hiệu lực câu hỏi cũ:

  ```tsx
  // SAI — mỗi lần render là một entry mới, cache không còn tồn tại về mặt ý nghĩa
  useSWR([SUMMARY_KEY, reportId, Date.now()], fetchSummary)
  ```

---

## `CACHE-2` — câu trả lời riêng tư mang người đọc trong key

### Case: bảng số liệu cá nhân

```tsx
// ĐÚNG — câu trả lời là của riêng ai, nên key nói ra đó là của ai
const viewer = useViewerKey()
useSWR(viewer === undefined ? null : [MY_METRICS_KEY, viewer], fetchMyMetrics)
```

```tsx
// SAI — một entry cho tất cả: người tiếp theo trên tab này đọc số liệu của người trước
useSWR(MY_METRICS_KEY, fetchMyMetrics)
```

Chúng khác nhau đúng một chỗ: **đăng xuất có làm đổi câu hỏi đang được hỏi hay không**.

### Case: fingerprint chứ không phải credential

Key được đưa cho devtools, cho mọi công cụ soi cache, và cho bất cứ chỗ nào log key lại khi request
thất bại.

```ts
// ĐÚNG — gấp token lại thành một chuỗi ngắn, ổn định, không đảo ngược được
export const useViewerKey = (): string | undefined => {
    const token = useSessionToken()
    return token === undefined ? undefined : fingerprint(token)
}
```

```ts
// SAI — bearer token nằm trong key là đúng sai lầm của bearer token nằm trong web storage
export const useViewerKey = (): string | undefined => useSessionToken()
```

Fingerprint **không phải** biên giới bảo mật và không tự nhận là như vậy. Nó chỉ cần khác đi khi
người đọc khác đi — nên một hàm băm bốn dòng là đủ, và chọn một hàm mạnh hơn cũng không mua thêm được
tính chất nào ở đây.

### Case: dữ liệu chung nằm sau lớp đăng nhập

Nằm sau auth là một dữ kiện, được tính từ người đọc là một dữ kiện khác. Lẫn hai thứ này thì key phình
ra vô ích.

```tsx
// ĐÚNG — catalog giống hệt nhau với mọi người đọc, dù route có yêu cầu đăng nhập
useSWR([CATALOG_KEY, categoryId], fetchCatalog)
```

```tsx
// SAI — nhân bản một entry giống hệt nhau cho từng người, và mất hết cache khi token gia hạn
const viewer = useViewerKey()
useSWR([CATALOG_KEY, categoryId, viewer], fetchCatalog)
```

### Case: một màn hình có cả hai loại

Một trang thường trộn lẫn. Tách theo **từng câu trả lời**, không theo từng trang.

```tsx
// ĐÚNG — giá niêm yết là chung, quyền truy cập là riêng
const { data: listing } = useSWR([LISTING_KEY, itemId], fetchListing)
const { data: access } = useSWR(
    viewer === undefined ? null : [MY_ACCESS_KEY, viewer, itemId],
    fetchMyAccess,
)
```

```tsx
// SAI — gộp thành một câu trả lời, nên phần chung cũng bị khoá theo người đọc
useSWR([LISTING_WITH_ACCESS_KEY, viewer, itemId], fetchListingWithAccess)
```

### Ngoại lệ và nhầm lẫn

- **Token gia hạn làm fingerprint đổi và tốn một lần fetch lại.** Chấp nhận có chủ đích. Phương án
  còn lại là giải mã credential để lấy claim định danh, tức là đẩy một hook cache vào việc phân tích
  credential.
- **Đừng dùng một id người dùng "đang hiển thị" thay cho fingerprint phiên:**

  ```tsx
  // SAI — id này còn `undefined` lâu hơn phiên, và không đổi khi phiên bị thu hồi
  useSWR([MY_METRICS_KEY, profile?.id], fetchMyMetrics)
  ```

- **Đừng chỉ thêm người đọc vào một vài query "quan trọng".** Một câu trả lời riêng tư bị bỏ sót là đủ
  để rò rỉ giữa hai người đọc trên cùng một tab.

---

## `CACHE-3` — hành động trên từng dòng mang dòng đó trong key

### Case: nút hành động trên từng thẻ

```tsx
// ĐÚNG — một hook cho một dòng, nên một cú bấm chỉ chạy đúng dòng được bấm
const useAddItemSwr = (itemId?: string) =>
    useSWRMutation(
        itemId === undefined ? null : [ADD_ITEM_KEY, itemId],
        async (_key: readonly [string, string], { arg }: { arg: { itemId: string } }) =>
            mutationAddItem({ itemId: arg.itemId }),
    )
```

```tsx
// SAI — cả lưới dùng chung một trạng thái chạy: một cú bấm, mười hai spinner
const useAddItemSwr = () =>
    useSWRMutation(ADD_ITEM_KEY, async (_key: string, { arg }: { arg: { itemId: string } }) =>
        mutationAddItem({ itemId: arg.itemId }),
    )
```

Chúng khác nhau đúng một chỗ: **cache có phân biệt được cú bấm ở dòng này với cú bấm ở dòng bên
cạnh** hay không.

### Case: nơi hook được gọi

Key đúng vẫn hỏng nếu hook được gọi ở sai tầng. Gọi một lần ở cha rồi phát xuống cho mọi dòng thì lại
quay về đúng một trạng thái chạy.

```tsx
// ĐÚNG — mỗi row tự dựng hook của nó, với id của chính nó
const ItemRow = ({ item }: { item: Item }) => {
    const { trigger, isMutating } = useAddItemSwr(item.id)
    return <button disabled={isMutating} onClick={() => trigger({ itemId: item.id })}>Thêm</button>
}
```

```tsx
// SAI — một hook cho cả danh sách, `isMutating` là của cả danh sách
const ItemList = ({ items }: { items: readonly Item[] }) => {
    const { trigger, isMutating } = useAddItemSwr()
    return items.map((item) => (
        <button key={item.id} disabled={isMutating} onClick={() => trigger({ itemId: item.id })}>Thêm</button>
    ))
}
```

### Case: hành động có hai chiều trên cùng một dòng

Theo dõi và bỏ theo dõi là **một** hành động hai chiều trên **một** chủ thể, nên một key.

```tsx
// ĐÚNG — chủ thể là hồ sơ đó, chiều là tham số của cú bấm
useSWRMutation([SET_FOLLOW_KEY, profileId], async (_key, { arg }: { arg: { follow: boolean } }) =>
    mutationSetFollow({ profileId, follow: arg.follow }),
)
```

```tsx
// SAI — hai key cho một cái nút, nên trạng thái chạy nhảy giữa hai entry và nút chớp
useSWRMutation([follow ? FOLLOW_KEY : UNFOLLOW_KEY, profileId], fetchToggle)
```

### Ngoại lệ và nhầm lẫn

- **Hành động hàng loạt không mang item**, vì chủ thể thật sự là cả danh sách:

  ```tsx
  // ĐÚNG — một cú bấm, một trạng thái chạy, không có dòng nào riêng
  useSWRMutation(CLEAR_ALL_KEY, mutationClearAll)
  ```

- **Per-row và bulk là hai hành động khác nhau**, không phải một hành động đánh key theo hai kiểu.
  Nếu màn hình có cả hai, viết hai hook.
- **Đừng lấy index của `map` làm mảnh key.** Sắp xếp lại danh sách là đổi ý nghĩa của key mà không đổi
  chủ thể:

  ```tsx
  // SAI — sort lại một cái, cú bấm đang chạy thuộc về nhầm dòng
  useSWRMutation([ADD_ITEM_KEY, index], fetchAdd)
  ```

---

## `CACHE-4` — chưa đủ mảnh thì key là `null`

### Case: hai mảnh, cả hai đều bắt buộc

```tsx
// ĐÚNG — chưa biết đủ thì chưa có câu hỏi, nên không có request nào
useSWR(
    viewer === undefined || itemId === undefined ? null : [PRICE_QUOTE_KEY, viewer, itemId],
    fetchPriceQuote,
)
```

```tsx
// SAI — một key thật, một entry thật, một câu trả lời cho câu hỏi không ai hỏi
useSWR([PRICE_QUOTE_KEY, viewer ?? "guest", itemId ?? ""], fetchPriceQuote)
```

Chúng khác nhau đúng một chỗ: **một câu hỏi chưa hoàn chỉnh có bị hỏi ra hay không**.

### Case: placeholder có mọi hình dạng

Placeholder không phải lúc nào cũng là chuỗi rỗng. Bất cứ giá trị nào được bịa ra để lấp một chỗ
trống đều là cùng một lỗi.

```tsx
// ĐÚNG — mảnh chưa tới thì cả key chưa tồn tại
useSWR(reportId === undefined ? null : [REPORT_KEY, reportId], fetchReport)
```

```tsx
// SAI — số không là một id hợp lệ về mặt cú pháp, và entry nó tạo ra không đọc ra vẻ hỏng
useSWR([REPORT_KEY, reportId ?? 0], fetchReport)
```

### Case: surface chưa được mở

Một modal chưa bật, một tab chưa chọn — chưa ai hỏi thì chưa nên fetch. Điều kiện mở là một phần của
cái gate, không phải một mảnh của key.

```tsx
// ĐÚNG — gate quyết định có câu hỏi hay không; key chỉ nói câu hỏi đó là gì
useSWR(isOpen && itemId !== undefined ? [ITEM_DETAIL_KEY, itemId] : null, fetchItemDetail)
```

```tsx
// SAI — trạng thái mở/đóng là chuyện của màn hình, không phải của câu trả lời
useSWR([ITEM_DETAIL_KEY, itemId, isOpen], fetchItemDetail)
```

Bản SAI vừa fetch khi chưa nên fetch, vừa tạo hai entry cho cùng một câu trả lời.

### Case: vòng retry tự báo là đang tải

Đây là lý do `CACHE-4` tồn tại chứ không phải chỉ để tiết kiệm một request.

```tsx
// ĐÚNG — đã đăng xuất thì không có gì đang chờ, nên không có skeleton nào
const { data, isLoading } = useSWR(viewer === undefined ? null : [MY_FEED_KEY, viewer], fetchMyFeed)
if (viewer === undefined) return <SignedOutNotice />
```

```tsx
// SAI — request bị từ chối, retry theo backoff, và mỗi vòng lại báo `isLoading`
const { data, isLoading } = useSWR([MY_FEED_KEY], fetchMyFeed)
if (isLoading) return <FeedSkeleton />
```

Màn hình ở bản SAI nhấp nháy skeleton **mãi mãi**, trước mặt một người không hề chờ đợi gì.

### Ngoại lệ và nhầm lẫn

- **`null` của key và `null` của kết quả không liên quan gì nhau.** Đây là chỗ đọc nhầm nhiều nhất
  của module này:

  ```tsx
  // key là null  ⇒ chưa hỏi
  // data là null ⇒ đã hỏi, và câu trả lời là không có gì
  ```

- **Đừng thay `null` bằng `undefined` cho key.** Một cái là "chưa hỏi", cái kia dễ bị đọc thành "quên
  truyền".
- **Đừng bọc gate vào trong fetcher.** Trả về sớm trong fetcher thì request đã không đi ra, nhưng
  entry vẫn được tạo dưới một cái tên sai:

  ```tsx
  // SAI — key vẫn hoàn chỉnh về mặt cấu trúc, và vẫn giữ một câu trả lời rỗng dưới tên sai
  useSWR([MY_FEED_KEY, viewer], async ([, who]) => (who === undefined ? null : fetchMyFeed(who)))
  ```

---

## `CACHE-5` — thất bại và rỗng là hai câu trả lời khác nhau

### Case: `catch` nuốt lỗi

```tsx
// ĐÚNG — request hỏng là error của hook; `null` nghĩa là server không tính được mức giá riêng
async ([, , id]: [string, string, string]) => {
    const result = await queryPriceQuote({ request: { itemId: id } })
    return result.data?.priceQuote?.data ?? null
}
```

```tsx
// SAI — một request bị từ chối và một mức giá không tồn tại về tới nơi dưới cùng một giá trị
async ([, , id]: [string, string, string]) => {
    try {
        const result = await queryPriceQuote({ request: { itemId: id } })
        return result.data?.priceQuote?.data ?? null
    } catch {
        return null
    }
}
```

Chúng khác nhau đúng một chỗ: **người gọi có còn phân biệt được thất bại với rỗng hay không**.

### Case: nghĩa của `null` được ghi ở đâu

Người gọi không suy ra được nghĩa của `null` từ kiểu dữ liệu, và không được phép phải đoán.

```ts
/**
 * Đọc mức giá riêng của người đang hỏi cho một mặt hàng.
 *
 * `null` nghĩa là **không tính được mức giá riêng** cho người này — màn hình lấy giá niêm yết mà
 * hiển thị. Đó là câu trả lời trung thực, không phải một lỗi bị nuốt. Request hỏng thì nằm ở
 * `error`.
 */
export const usePriceQuoteSwr = (itemId?: string) => { /* … */ }
```

```ts
/** Đọc mức giá. */
export const usePriceQuoteSwr = (itemId?: string) => { /* … */ }
```

Bản dưới không sai một dòng code nào. Nó chỉ đẩy một quyết định cho **mọi** người gọi về sau tự quyết
lại — và họ sẽ không quyết giống nhau.

### Case: màn hình nói ra sự khác biệt

Nếu hook giữ được sự khác biệt mà màn hình vẫn gộp lại, thì công sức ở tầng dưới là vô ích.

```tsx
// ĐÚNG — ba trạng thái, ba câu chữ
if (error) return <RetryNotice onRetry={() => mutate()} />
if (isLoading) return <QuoteSkeleton />
if (data === null) return <ListPriceNotice />
return <QuoteAmount value={data.amount} />
```

```tsx
// SAI — mạng hỏng và "không có ưu đãi" hiện ra cùng một dòng chữ
if (!data) return <ListPriceNotice />
return <QuoteAmount value={data.amount} />
```

### Case: `null` là thất bại theo hợp đồng

Ngoại lệ này hẹp, và nó chỉ hợp lệ khi **server** phân biệt được, còn hook thì ghi sự phân biệt ấy
xuống.

```ts
// ĐÚNG — server nói rõ "chưa từng có phiên nào", đó là một câu trả lời chứ không phải một lỗi
const result = await queryLatestSession({ request: { itemId: id } })
if (result.data?.latestSession?.reason === "NEVER_STARTED") return null
return result.data?.latestSession?.data ?? null
```

```ts
// SAI — mọi thứ hỏng đều thành "chưa từng có phiên nào"
try {
    return (await queryLatestSession({ request: { itemId: id } })).data?.latestSession?.data ?? null
} catch {
    return null
}
```

### Ngoại lệ và nhầm lẫn

- **Một `catch` không có kiểu không bao giờ là ngoại lệ hợp đồng.** Nó bắt cả lỗi mạng, lỗi parse, lỗi
  lập trình, rồi gọi tất cả là "rỗng".
- **Đừng biến lỗi thành một mảng rỗng** — đó là cùng một lỗi, mặc bộ đồ khác:

  ```ts
  // SAI — danh sách rỗng và danh sách không tải được nhìn giống hệt nhau
  catch { return [] }
  ```

- **Được phép lùi về một phương án khác, nhưng lùi ở chỗ người gọi**, sau khi đã biết đó là lỗi. Lùi
  bên trong fetcher là xoá mất dữ kiện trước khi ai kịp dùng nó.

---

## Ánh xạ yêu cầu sang một quyết định key

Nêu câu trả lời, các mảnh nó đổi theo, và mảnh nào còn có thể chưa tới. Nếu thiếu **một** dữ kiện
quyết định, hỏi **một** câu cụ thể rồi dừng.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| Danh sách đơn, lọc theo trạng thái, có phân trang | Câu trả lời đổi theo cả hai tham số | `CACHE-1` | `[ORDER_LIST_KEY, status, page]` |
| Bảng số liệu "của tôi" | Tính từ người đang hỏi | `CACHE-2` + `CACHE-4` | `viewer === undefined ? null : [MY_METRICS_KEY, viewer]` |
| Nút "Thêm" trên từng thẻ của một lưới | Nhiều nút cùng tồn tại, mỗi nút một trạng thái chạy | `CACHE-3` | `[ADD_ITEM_KEY, itemId]`, một hook mỗi dòng |
| Nút "Xoá sạch" cho cả giỏ | Một cú bấm, một trạng thái chạy | Ngoại lệ của `CACHE-3` | `CLEAR_ALL_KEY` |
| Chi tiết bản ghi, id đến từ route param | Mảnh có thể chưa parse xong | `CACHE-4` | `id === undefined ? null : [DETAIL_KEY, id]` |
| Xem trước giá riêng, có thể không có | Rỗng là một câu trả lời thật | `CACHE-5` | `?? null` tại chỗ bóc, nghĩa ghi ở doc comment |
| Catalog công khai trong route đã đăng nhập | Giống nhau với mọi người đọc | `CACHE-1` | `[CATALOG_KEY, categoryId]`, **không** thêm viewer |
| Nội dung bài viết theo ngôn ngữ đang phục vụ | Bản dịch là câu trả lời khác | `CACHE-1` | `[ARTICLE_KEY, slug, locale]` |

Dòng cuối cùng là chỗ hay bị bỏ sót nhất, vì màn hình vẫn hiển thị đúng cho tới lần đầu có người đổi
ngôn ngữ.

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `CACHE-1` / `CACHE-2` | Hai người **cùng đăng nhập** gọi query này có nhận về hai kết quả khác nhau không? |
| `CACHE-1` / `CACHE-3` | Thứ dùng chung sai ở đây là **dữ liệu** hay **trạng thái đang chạy**? |
| `CACHE-1` / `CACHE-4` | Mảnh này **thiếu trong key**, hay **chưa tồn tại** ở lần render đầu? |
| `CACHE-3` / ngoại lệ bulk | Trên màn hình có bao nhiêu nút của hành động này cùng lúc? |
| `CACHE-4` / `CACHE-5` | Chữ `null` này nằm ở vị trí **key** hay vị trí **kết quả**? |
| `CACHE-5` / ngoại lệ hợp đồng | Chính **server** có phân biệt được "hỏng" với "không có" không? |

## Sai lầm lặp lại nhiều nhất

1. Một key hằng cho một câu trả lời riêng tư — và nó chỉ lộ ra khi có người thứ hai dùng cùng một tab.
2. Fetcher đóng gói tham số thay vì đọc ra từ key.
3. Bịa một placeholder (`""`, `0`, `"guest"`) cho mảnh chưa tới.
4. Một key mutation trải khắp một danh sách, rồi một cú bấm làm cả cột quay spinner.
5. `catch { return null }` trong fetcher.
6. Đưa trạng thái chỉ có ý nghĩa với màn hình (mở/đóng, tab đang chọn) vào key.
7. Đưa bearer token vào key thay vì fingerprint của nó.
8. Bỏ quên `locale` trong key của nội dung có chữ.
