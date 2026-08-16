# cache key

## Định nghĩa

Cache key là TÊN của một câu trả lời. Mọi thứ dùng chung một key đều dùng chung câu trả lời đó — dữ
liệu, lỗi và với mutation là cả trạng thái đang chạy — nên key không phải nhãn gắn vào request sau
khi request đã được gọi. Key chính là câu hỏi được viết ra.

Vì thế key là một khẳng định có thể kiểm chứng: *câu trả lời này đúng với bất kỳ ai đặt câu hỏi này.*
Nếu hai caller tạo ra cùng một key nhưng cần hai câu trả lời khác nhau, key đang đặt tên cho thứ thô
hơn câu trả lời nó lưu, và một caller sẽ đọc phải câu trả lời của caller kia.

Câu hỏi quyết định một mảnh có thuộc key không là: **nếu value này khác đi, câu trả lời có khác đi
không?** Nếu có, mảnh đó phải nằm trong key. Nếu không, nó chỉ là nhiễu: tách một entry thành nhiều
entry rồi fetch lại vô ích.

Một key cũng chỉ có hai trạng thái: đầy đủ hoặc vắng mặt. Không có key một phần, vì key được ghép từ
một mảnh chưa đến là một câu hỏi khác — câu hỏi không ai đặt — và câu trả lời bị cache dưới cái tên
mà không caller nào tạo lại.

Phần biên của luật này được giữ bởi [`sources/fe/the-split.mjs`](../../../sources/fe/the-split.mjs):
hook nằm ở connected half, nơi có viewer và route parameter để dựng key. Rule không nhìn thấy key
CONTAINS gì, nên phần đó thuộc về review; file này là cơ sở để review lập luận.

Implementation anchors in `starci-academy-fe`: `src/hooks/swr/useQueryCoursePricePreviewSwr.ts` and
`src/hooks/swr/useMutateAddToCartSwr.ts`.

## Luật

**CACHE-1 · Key đặt tên cho một câu trả lời, nên mọi value làm đổi câu trả lời đều nằm IN key.**

Cache không so sánh request mà so sánh key. Hai lần gọi có cùng key là một entry, và caller thứ hai
nhận câu trả lời của caller thứ nhất mà không phát sinh request — đó là mục đích của cache, đồng
thời cũng là toàn bộ cách cache hỏng. Mảnh mà câu trả lời phụ thuộc vào nhưng key bỏ sót không chỉ
thỉnh thoảng tạo dữ liệu cũ; nó luôn tạo entry SAI, nhưng trông vẫn đúng vì câu trả lời hợp lý cho
câu hỏi sai không thể phân biệt bằng mắt với câu trả lời đúng.

Cùng lý do đó, fetcher phải đọc argument từ key thay vì đóng (closure) parameter mà nó được gọi cùng.
Key và closure là hai bản sao của một sự thật; sau re-render chúng có thể lệch nhau, khiến entry
được xếp dưới tên câu hỏi này nhưng chứa câu trả lời của câu hỏi kia.

**CACHE-2 · Câu trả lời riêng tư phải mang viewer trong key.**

Câu trả lời được tính từ người đang hỏi không phải dữ liệu chung tình cờ nằm sau auth; đó là câu trả
lời khác nhau cho từng người. Key không nhắc đến viewer đang hứa điều ngược lại. Đăng nhập không đổi
key nên người vừa đăng nhập tiếp tục đọc lời từ chối được fetch một giây trước. Đăng xuất cũng không
đổi key nên người tiếp theo trên tab đọc được số liệu của người trước — và số liệu đó trông hoàn toàn
hợp lý.

Cả hai lỗi đều không thể xảy ra khi viewer là một mảnh của key: đổi viewer là đổi key, còn key chưa
được fetch thì không có gì để phục vụ.

Mảnh đưa vào phải là fingerprint ổn định, không thể đảo ngược của session, không bao giờ là credential.
Key đi tới devtools, cache inspector và log ghi key khi request fail; đặt bearer token ở đó cũng sai
như đặt bearer token trong web storage. Fingerprint không phải security boundary và không được tuyên
bố là như vậy — nó chỉ cần khác khi viewer khác.

**CACHE-3 · Action trên từng item phải mang item trong key.**

Các hook dùng chung key sẽ dùng chung STATE, không chỉ dùng chung data. Với mutation, state đó có
`isMutating`, thứ control đọc để hiển thị nó đang chạy. Vì vậy một key dùng cho cả list sẽ khiến bấm
một row đặt mọi control khác vào trạng thái running: một lần bấm, cả cột spinner, và mọi button khác
bị disable vì một lần bấm người đọc không thực hiện.

Item giúp phân biệt lần bấm này với lần bấm ở row bên cạnh. Không có item trong key, cache coi cả list
chỉ có một button.

**CACHE-4 · Key chưa sẵn sàng là `null`, không phải key có một mảnh bị khuyết.**

Mọi mảnh phải được biết trước khi câu hỏi tồn tại. Khi một mảnh còn `undefined` — viewer trước khi
session resolve, id của placeholder đang nghỉ hoặc parameter của surface chưa mở — hook truyền `null`
và không fetch gì.

Key dựng quanh mảnh còn thiếu sẽ hỏi điều không ai muốn biết rồi cache câu trả lời dưới tên mà không
caller nào tạo lại. Query cần auth nhưng chạy khi chưa có token sẽ fail trong retry backoff và tự báo
loading mỗi lần; đó là cách surface đã sign out cứ shimmer trước người không hề chờ gì.

Placeholder thay cho mảnh thiếu là cùng một lỗi khoác lên key hợp lệ: `""`, `0` hoặc `guest` tạo ra
entry thật, chứa câu trả lời thật cho câu hỏi caller không đặt, và về sau không có dấu hiệu cho thấy
entry đó sai.

**CACHE-5 · Failure và rỗng là hai câu trả lời khác nhau; chỗ unwrapping phải nói `null` có nghĩa gì.**

"Request không tới nơi" và "thật sự không có gì" cần hai cách hiển thị khác nhau. Fetcher gộp error
thành `null` đã phá hủy khác biệt trước khi caller có thể phân biệt. Failure phải vẫn là failure —
nó thuộc về error của hook, nơi caller có thể retry, thông báo hoặc fallback có chủ ý.

Nhờ vậy `null` chỉ cần mang một nghĩa, và hook là nơi ghi nghĩa đó ngay cạnh đoạn unwrapping tạo ra
nó: price preview trả `null` khi không tính được giá riêng, nên dùng giá catalog của phase — đó là
câu trả lời trung thực, không phải error bị nuốt. Caller không thể suy ra nghĩa này từ type và không
được buộc phải đoán.

## Forbidden

| Không bao giờ | Vì sao bị từ chối | Thay vào đó |
|---|---|---|
| Dùng một chuỗi hằng làm toàn bộ key cho câu trả lời riêng tư | Hai viewer dùng chung entry và sign out để lại số liệu của viewer trước trên tab | Thêm mảnh viewer vào key |
| Dùng bearer token làm mảnh viewer | Key đi tới devtools, cache inspector và failure log, nơi credential tuyệt đối không được xuất hiện | Fingerprint ổn định, không thể đảo ngược |
| Dùng một mutation key cho cả list row | Hook cùng key chia sẻ `isMutating`, nên một lần bấm chạy control của mọi row | Đưa id của row vào key |
| Dựng key khi một mảnh còn `undefined` | Nó hỏi điều không ai hỏi, còn retry loop auth tự báo loading mãi | Truyền `null` cho tới khi mọi mảnh đã biết |
| Dùng placeholder cho mảnh còn thiếu | `""`, `0` hoặc `guest` là key hợp lệ chứa câu trả lời thật cho câu hỏi sai | Truyền `null` |
| Fetcher đóng parameter thay vì đọc key | Key và request là hai bản sao của một sự thật và có thể lệch sau re-render | Đọc argument từ key |
| Fetcher trả `null` khi failure | "Không tới nơi" và "không có" thành cùng một value, khiến surface báo không có gì | Để failure nằm trong error của hook |
| Chỉ giải thích nghĩa của `null` ở call site | Caller sau sẽ tự diễn giải lại và không thống nhất | Ghi nghĩa tại chỗ unwrapping tạo ra `null` |

## Ví dụ

### Viewer trong key

```ts
// the answer is personal, so the key says whose it is
useSWR(viewer === undefined ? null : [QUERY_MY_KPIS_SWR_KEY, viewer], fetcher)
```

```ts
// one entry for everybody: the next reader on this tab gets the last reader's figures
useSWR(QUERY_MY_KPIS_SWR_KEY, fetcher)
```

Chúng chỉ khác nhau ở một điểm: sign out có làm thay đổi câu hỏi hay không.

### Item trong key

```ts
// one hook per row, so a press runs only the row that was pressed
useSWRMutation([MUTATE_ADD_TO_CART_SWR_KEY, courseId], fetcher)
```

```ts
// every card on the grid shares one running state: one press, twelve spinners
useSWRMutation(MUTATE_ADD_TO_CART_SWR_KEY, fetcher)
```

Chúng chỉ khác nhau ở một điểm: cache có phân biệt được lần bấm của row này với row khác hay không.

### Chưa sẵn sàng nghĩa là `null`

```ts
// no question until both fragments are known
viewer === undefined || courseId === undefined ? null : [KEY, viewer, courseId]
```

```ts
// a real key, a real entry, an answer to a question nobody asked
[KEY, viewer ?? "guest", courseId ?? ""]
```

Chúng chỉ khác nhau ở một điểm: câu hỏi chưa hoàn chỉnh có bị hỏi hay không.

### Argument của fetcher

```ts
async ([, , id]: [string, string, string]) => queryCoursePricePreview({ request: { courseId: id } })
```

```ts
async () => queryCoursePricePreview({ request: { courseId } })
```

Chúng chỉ khác nhau ở một điểm: tên entry và request tạo ra entry có thể lệch nhau hay không.

### Thất bại không phải là rỗng

```ts
// the request failing is the hook's error; null means the server had no personal price
const result = await queryCoursePricePreview({ request: { courseId: id } })
return result.data?.coursePricePreview?.data ?? null
```

```ts
// a refused request and an absent price arrive as the same value, and the surface reads "none"
try {
    const result = await queryCoursePricePreview({ request: { courseId: id } })
    return result.data?.coursePricePreview?.data ?? null
} catch {
    return null
}
```

Chúng chỉ khác nhau ở một điểm: caller còn phân biệt được failure với câu trả lời rỗng hay không.
