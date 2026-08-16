# bản dịch

## Định nghĩa

Copy là dữ liệu. Nó đến từ dictionary, có thể thay đổi mà không cần deploy, khác nhau theo từng
người đọc — và cũng như mọi dữ liệu khác trong hệ thống, nó được resolve bởi nửa sở hữu request rồi
truyền xuống dưới ở trạng thái đã được quyết định.

Hệ quả cần nói rõ, vì đây là rule mà người viết thường tìm cách bỏ qua: **không component nào bên
dưới một block tự nói ra một từ.** Leaf render string được truyền vào. Composite sắp xếp các string
được truyền vào. Cả hai không biết string đang ở ngôn ngữ nào và không thể bị ảnh hưởng bởi việc bản
dịch đến muộn.

Câu hỏi quyết định là: **người đọc bằng ngôn ngữ khác có thấy điều gì khác ở đây không?** Nếu có, đó
là copy, và copy phải được resolve ở file bên trên một tầng.

Luật này được bảo đảm bởi [`sources/fe/translation.mjs`](../../../sources/fe/translation.mjs), cùng
với rule split giữ cho nửa drawing không truy cập runtime dịch.

Implementation anchors in `starci-academy-fe`:
`src/components/blocks/dashboard/CreditStatRow/index.tsx` and
`src/components/blocks/dashboard/CreditStatRow/component.tsx`.

## Luật

**COPY-1 · Connected half resolve mọi từ.**

Block sở hữu request cũng sở hữu các từ mô tả câu trả lời, vì chỉ block biết người đọc đang ở tình
huống nào và câu nào là đúng. Mọi component bên dưới chỉ nhận string.

**COPY-2 · Component bên dưới block không giữ literal nào mà người đọc có thể thấy.**

Không phải trong label, placeholder, aria-label hay title attribute. Đây là những nơi copy thường
ẩn nhất vì trong markup chúng không trông như câu văn — nhưng người dùng screen reader nghe
aria-label như văn bản chính, nên một label tiếng Anh trên surface tiếng Việt không phải lỗi nhỏ.

**COPY-3 · Key không bao giờ đi qua ranh giới.**

Truyền `labelKey="quest.title"` chỉ chuyển việc lookup thay vì chuyển quyết định; lúc đó nửa drawing
cần toàn bộ translation runtime mới render được từ fixture. Thứ đi qua ranh giới là string, không
phải key.

**COPY-4 · String đã resolve là một value, nên tuân theo data fence.**

Nó đi trong `props` như mọi value khác. Nhờ vậy component có thể được render từ fixture với từ
`"anything"` mà vẫn đúng.

**COPY-5 · Dictionary là ngôn ngữ còn lại, nên không phải source.**

File trong thư mục locale là content, không phải authoring, nên rule English-only không áp dụng cho
nó. Đây là ngoại lệ duy nhất, và được xác định bằng path thay vì phán đoán, vì ngoại lệ theo phán
đoán sẽ bị tranh luận mãi ở từng file.

**COPY-6 · Từ mà chương trình MATCH trên đó không phải copy.**

Status server gửi và screen dùng để so sánh là một value; dịch nó sẽ làm hỏng phép so sánh. Value đó
giữ nguyên và được đánh dấu ngay trên dòng kèm lý do — dấu đánh dấu cho người đọc sau biết đây là
quyết định có chủ ý, không phải câu bị quên dịch.

## Forbidden

| Không bao giờ | Vì sao bị từ chối | Thay vào đó |
|---|---|---|
| Gọi translation bên dưới một block | Component cần runtime mới render được nên không thể test từ fixture | Resolve ở connected half |
| Đọc locale hiện tại để chọn từ | Cùng một dependency, chỉ được che dưới tên khác | Làm như trên |
| Literal hiển thị trong leaf hoặc composite | Đó là copy, nên người đọc dùng ngôn ngữ khác sẽ thấy tiếng Anh | Truyền string đã resolve qua `props` |
| Literal trong `aria-label`, `placeholder`, `title` hoặc `alt` | Nó không trông như câu văn nhưng screen reader coi là văn bản chính | Làm như trên |
| Truyền translation KEY xuống dưới | Nó chuyển lookup chứ không chuyển quyết định, đồng thời kéo runtime theo | Truyền string đã resolve |
| Dịch value mà chương trình dùng để so sánh | Phép so sánh hỏng và lỗi diễn ra im lặng | Giữ nguyên và ghi rõ lý do trên dòng |
| Áp dụng rule English-only cho dictionary | Dictionary LÀ ngôn ngữ còn lại | Để nguyên locale content |

## Ví dụ

### Nơi chọn từ

```tsx
// index.tsx: the half that knows which situation this is knows which sentence is true
return <_DailyQuest state="failed" props={{ label: t("label"), message: t("failed") }} />
```

```tsx
// component.tsx: it would have to know the situation AND the dictionary
const t = useTranslations("quest")
return <SurfaceCard props={{ label: t("label") }} contract="quest-rows" render={questRows} />
```

Chúng chỉ khác nhau ở một điểm: nửa drawing có thể render mà không cần translation runtime hay không.

### Literal không trông giống literal

```tsx
<Icon props={{ name: "search" }} />
<Input props={{ placeholder: props.searchPlaceholder }} />
```

```tsx
<Input props={{ placeholder: "Search courses" }} />
```

Chúng chỉ khác nhau ở một điểm: người đọc bằng ngôn ngữ khác nhìn thấy gì — và với `aria-label`,
screen reader sẽ nói gì.

### Giá trị không phải copy

```ts
// vn-ok: the server sends this status verbatim and the screen matches on it
const CANCELLED = "Da huy"
```

```ts
const CANCELLED = t("status.cancelled")
```

Chúng chỉ khác nhau ở một điểm: phép so sánh có còn hoạt động sau khi dictionary thay đổi hay không.
