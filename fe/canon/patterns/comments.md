# comment

## Định nghĩa

Comment nói điều mà code không thể tự nói. Code đã cho biết chuyện gì xảy ra; comment giải thích vì
sao nó phải xảy ra như vậy, điều gì sẽ hỏng nếu bỏ nó và phương án nào đã bị từ chối. Comment chỉ
đổi tên cho dòng ngay bên dưới là nhiễu, và nhiễu khiến người đọc bỏ qua đúng comment đáng lẽ phải
đọc.

Hai câu hỏi quyết định mọi trường hợp. **Một người lạ chỉ đọc code có tự đi đến cùng kết luận không?**
Nếu có, comment không cần thiết. **Người đọc không dùng chung tiếng mẹ đẻ với tác giả có đọc được
không?** Nếu không, comment vẫn chưa được viết đúng.

Câu hỏi thứ hai là nơi file này nghiêm khắc nhất. Chuẩn không phải là "dùng English khi tiện": source
phải là English, đủ rõ với người lạ; các ngoại lệ chỉ có ba loại, hẹp và được nêu tên bên dưới.

Luật này được bảo đảm bởi [`sources/fe/comments.mjs`](../../../sources/fe/comments.mjs). Rule chạm
đến identifier, comment, JSDoc, diagnostic và string literal — mọi nơi prose có thể ẩn — vì nếu chỉ
kiểm comment, cùng một câu vẫn có thể hợp lệ khi được chuyển xuống một dòng dưới thành tên biến.

Implementation anchors in `starci-academy-fe`: `src/components/branches/SurfaceCard/index.tsx` and
`plugins/eslint/index.mjs`.

## Luật

**COMMENTS-1 · Mọi export đều mở đầu bằng documentation block.**

Export là thứ file khác phụ thuộc vào, nên contract của nó được đọc thường xuyên hơn được viết và
thường bởi người sẽ không mở body. Block phải nêu ROLE — đây là gì và dùng để làm gì — thay vì lặp
lại signature mà chính signature đã nói rõ.

Phạm vi được giới hạn có chủ ý: chỉ export. Bắt mọi helper nội bộ phải có block sẽ tạo ra file mà
một nửa số dòng là nghi thức và chẳng block nào còn được đọc.

**COMMENTS-2 · Source phải là English, đủ rõ với người lạ.**

Quy tắc áp dụng cho comment, JSDoc, identifier và diagnostic message. Chuẩn không dựa trên team hiện
tại mà dựa trên người sẽ tham gia sau một năm và không dùng chung tiếng mẹ đẻ với tác giả. Codebase
có hai ngôn ngữ sẽ tạo ra hai nhóm người đọc, rồi nhóm nhỏ hơn âm thầm bỏ qua những phần họ không đọc
được.

**COMMENTS-3 · Có ba ngoại lệ, và mỗi ngoại lệ phải được nêu đúng nơi áp dụng.**

Locale content không phải authoring: translation dictionary LÀ ngôn ngữ còn lại, áp rule này vào đó
sẽ làm rỗng product. Test fixture tái hiện một string thật phải giữ nguyên string đó, nếu không nó
đang test thứ khác. Literal mà chương trình dùng để match hoặc emit — một value, không phải prose —
được giữ lại và phải có lý do trên chính dòng đó.

Việc đánh dấu là điểm cốt lõi của ngoại lệ thứ ba. Literal không được đánh dấu trông không khác một
comment bị quên dịch, khiến mỗi người đọc phải tự quyết định và mỗi người có thể quyết định khác nhau.

**COMMENTS-4 · Không dùng Unicode emoji trong source.**

Không dùng trong identifier, comment, diagnostic hay string không phải content. Pictograph hiển thị
khác nhau trên từng platform, sắp xếp khó đoán, có thể phá terminal và mang ý nghĩa khác nhau giữa
các quốc gia. Mark giao diện chung thuộc về icon vocabulary. Product reaction là trường hợp artwork
hẹp duy nhất: dùng SVG asset đã kiểm tra và commit qua reaction leaf, không dùng pictograph Unicode
trong source hay locale data.

**COMMENTS-5 · Comment lặp lại dòng code thì bị xóa, không được cải thiện.**

`// increment the counter` đặt trên một lệnh increment tốn một dòng mà không dạy điều gì. Tệ hơn,
người đọc gặp ba comment như vậy sẽ bỏ qua comment thứ tư — dù đó có thể là comment giải thích vì
sao counter reset vào Chủ nhật.

**COMMENTS-6 · Comment phải tranh luận là comment đang ghi lại một quyết định, và phải gọi tên quyết định đó.**

Comment đáng giữ là comment ghi lại một điều đã bị từ chối: đã thử gì, cái giá là gì, vì sao shape
hiển nhiên lại sai ở đây. Đó chính là những quyết định mà người đọc sau nếu không biết sẽ dễ hoàn tác.

## Forbidden

| Không bao giờ | Vì sao bị từ chối | Thay vào đó |
|---|---|---|
| Export không có documentation block | Contract của nó được đọc bởi người không mở body | Nêu role, không lặp signature |
| Block lặp lại signature | Signature đã nói điều đó theo cách không thể stale | Nói vì sao nó tồn tại, hoặc xóa block |
| Comment bằng ngôn ngữ thứ hai | Codebase tạo ra nhóm người đọc bỏ qua một phần source | English, đủ rõ với người lạ |
| Identifier bằng ngôn ngữ thứ hai | Cùng lỗi đó nhưng nằm thấp hơn một dòng, nơi rule comment không nhìn tới | Làm như trên |
| Diagnostic message bằng ngôn ngữ thứ hai | Người đọc nó là người on-call, không nhất thiết là người viết | Làm như trên |
| Unicode emoji ở bất cứ đâu trong source | Hiển thị khác nhau và mang ý nghĩa khác nhau ở các nơi khác nhau | Semantic icon, hoặc reaction artwork đã commit khi product meaning là reaction |
| Functional literal bằng ngôn ngữ khác nhưng không đánh dấu | Không thể phân biệt với prose bị quên dịch | Giữ lại và ghi lý do trên dòng |
| Comment lặp lại dòng ngay bên dưới | Không dạy gì và khiến người đọc bỏ qua comment kế tiếp | Xóa comment |

## Ví dụ

### Trường hợp thông thường — block nói điều signature không thể nói

```ts
/**
 * Read the table that governs a linted file.
 *
 * Returns null when none sits above it. A rule that gets null must do NOTHING: a table nobody can
 * read is a reason to stay quiet, never a reason to call every call site wrong.
 */
```

```ts
/**
 * Reads the table.
 *
 * @param filename - The filename.
 * @returns The table.
 */
```

Chúng chỉ khác nhau ở một điểm: người đọc biết phải làm gì với kết quả hay không.

### Bẫy ngôn ngữ — lệch một dòng

```ts
const isOverdue = (dueAt: Date) => dueAt < now
```

```ts
// han cuoi da qua
const isOverdue = (dueAt: Date) => dueAt < now
```

Chúng chỉ khác nhau ở một điểm: người đọc sau có hiểu lý do hay không. Rule cũng chạm identifier vì
đưa câu đó vào tên không khiến nó được dịch.

### Ngoại lệ literal chức năng

```ts
// vn-ok: the server sends this status verbatim and the screen matches on it
const CANCELLED = "Da huy"
```

```ts
const CANCELLED = "Da huy"
```

Chúng chỉ khác nhau ở một điểm: người đọc có phân biệt được value với comment chưa dịch hay không.

### Bẫy lặp lại nguyên văn

```ts
// The rungs are not evenly spaced, so adding one lands between them.
const next = STEPS[index + 1]
```

```ts
// get the next step
const next = STEPS[index + 1]
```

Chúng chỉ khác nhau ở một điểm: comment có nói điều mà dòng code chưa nói hay không.
