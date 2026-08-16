# bình luận

## Định nghĩa

Comment ở đây trả lời câu hỏi mà code không thể trả lời: **tại sao**. Code đã mô tả nó làm gì bằng một ngôn ngữ được thiết kế để chính xác; lặp lại điều đó bằng tiếng Anh chỉ tạo thêm một bản mô tả, rồi bản mô tả ấy sẽ lỗi thời ngay lần đầu code thay đổi mà không ai sửa comment bên cạnh.

Vì vậy, mọi export đều mở đầu bằng một documentation block mô tả nó là gì, mọi member của exported enum đều nêu hậu quả của việc chọn member đó, và toàn bộ source được viết bằng English ASCII để người đọc tiếp theo — kể cả người không dùng chung ngôn ngữ với tác giả — vẫn đọc được.

Câu hỏi quyết định comment có xứng đáng với vị trí của nó không là: **người đọc có thể tự giải quyết vấn đề từ code phía trước không?** Nếu có, hãy xóa comment. Nếu không — chẳng hạn một hạn chế từ nơi khác, một quyết định trông tùy ý, hoặc một bug mà hình dạng hiện tại ngăn chặn — hãy ghi lại, vì lý do đó sắp bị mất.

Rule này được giữ bởi [`sources/be/comments.mjs`](../../../sources/be/comments.mjs).

## Quy tắc

**BÌNH LUẬN-1 · Mọi export đều mở đầu bằng một documentation block.**

Class, interface, type, enum và function được export là những bề mặt mà file khác phụ thuộc vào. Vì vậy, đó là thứ người đọc cần thấy khi quyết định có nên sử dụng hay không: tên và signature cho biết nó cần gì, nhưng không cho biết nó dùng để làm gì hoặc khi nào nên dùng.

Data constant nằm ngoài phạm vi: `export const MAX_ATTEMPTS = 3` đã tự mô tả đầy đủ; thêm một câu cạnh nó chỉ lặp lại tên.

**BÌNH LUẬN-2 · Mọi member của exported enum đều nêu rõ HẬU QUẢ của nó.**

Không chỉ ghi member được gọi là gì, mà phải nói việc chọn nó làm gì. `Pending` được mô tả là “trạng thái chờ xử lý” thì không mang lại thông tin; “chưa thanh toán xong nên chưa cấp quyền và cart vẫn có thể chỉnh sửa” mới là sự thật mà tác giả sau cần biết nhưng không thể suy ra.

Enum đặc biệt cần điều này, vì member thường được chọn ở một call site xa switch nơi nó nhận được ý nghĩa.

**BÌNH LUẬN-3 · Comment nói lý do, code nói điều gì xảy ra.**

Comment viết lại dòng ngay bên dưới còn tệ hơn không có comment: nó nhân đôi chi phí bảo trì, rồi một nửa sẽ âm thầm cũ đi vì không có gì báo lỗi khi câu chữ không còn đúng.

Hãy viết comment khi lý do nằm BÊN NGOÀI file — hành vi khó hiểu của provider, một ràng buộc từ schema, thứ tự trông tùy ý nhưng thực ra bắt buộc, hoặc một bug mà hình dạng này ngăn chặn.

**BÌNH LUẬN-4 · Source là English ASCII.**

Không phải vì tiếng Anh tốt hơn, mà vì một codebase hai ngôn ngữ sẽ có người đọc không tiếp cận được một nửa lý do. Đáng tiếc là nửa không đọc được thường chính là nửa giải thích cho phần bất ngờ. Comment nên là thứ mà người không dùng chung ngôn ngữ với tác giả vẫn đọc được.

ASCII cũng là một phần của quy tắc: không emoji, không ký hiệu trang trí. Emoji truyền sắc thái hơn là thông tin, còn sắc thái được mỗi người đọc khác nhau.

**BÌNH LUẬN-5 · Text mà chương trình match hoặc emit không phải là comment.**

Language string, provider message và giá trị được so sánh là DATA được viết dưới dạng prose; dịch chúng sẽ phá vỡ chương trình. Hãy giữ nguyên, đồng thời thêm một dòng ngắn giải thích lý do để lần quét sau không “sửa” nhầm.

## Bị cấm

| Không bao giờ | Tại sao nó bị từ chối | Thay vào đó |
|---|---|---|
| Export không có documentation | Bề mặt mà code khác dựa vào chỉ nói nó cần gì, không nói nó dùng để làm gì | Mở đầu bằng documentation block |
| Enum member không có tài liệu hoặc chỉ nhắc lại tên | Member được chọn ở xa switch nơi nó nhận ý nghĩa | Nêu hậu quả của việc chọn member |
| Comment diễn giải lại code ngay bên dưới | Nó nhân đôi chi phí bảo trì và một nửa sẽ âm thầm lỗi thời | Xóa hoặc thay bằng lý do |
| Comment bằng ngôn ngữ khác tiếng Anh | Một số độc giả không tiếp cận được nửa lý do đáng ngạc nhiên | Tiếng Anh |
| Emoji hoặc ký hiệu trang trí | Nó truyền sắc thái chứ không truyền thông tin, và sắc thái được đọc khác nhau | Từ ngữ |
| Dịch một string mà chương trình match | Đó là data chứa prose; dịch nó sẽ phá vỡ hành vi | Giữ nguyên và đánh dấu lý do bằng một comment ngắn |

## Ví dụ

### Trường hợp thông thường — tài liệu nói điều code không thể nói

```ts
/**
 * Binds the PRIMARY postgres entity manager.
 *
 * Injecting the wrong connection would read and write the sandbox or the analytics replica instead
 * of live course data, and the type is identical either way.
 */
export const InjectPrimaryPostgreSQLEntityManager = () => InjectEntityManager(POSTGRESQL_PRIMARY)
```

```ts
/** Injects the primary postgres entity manager. */
export const InjectPrimaryPostgreSQLEntityManager = () => InjectEntityManager(POSTGRESQL_PRIMARY)
```

Chúng khác nhau ở việc người đọc có biết điều gì sẽ sai nếu bỏ documentation hay không.

### Bẫy enum

```ts
export enum PaymentState {
    /** No payment has settled, so nothing is granted and the cart is still editable. */
    Pending = "pending",
    /** Money is captured and the entitlement is open; a reversal from here is a refund, not a cancel. */
    Settled = "settled",
}
```

```ts
export enum PaymentState {
    /** The pending state. */
    Pending = "pending",
    /** The settled state. */
    Settled = "settled",
}
```

Chúng khác nhau ở việc member có cho caller biết hậu quả của lựa chọn hay không.

### Bẫy diễn giải lại code

```ts
// the provider sends this webhook twice for a single capture, so the second one must be a no-op
const existing = await this.entityManager.findOne(PaymentEntity, { where: { providerRef } })
```

```ts
// find the payment by provider ref
const existing = await this.entityManager.findOne(PaymentEntity, { where: { providerRef } })
```

Chúng khác nhau ở việc comment có nói thêm điều gì mà dòng code không thể nói hay không.

### Bẫy prose chứa data

```ts
// vn-ok: the provider returns this exact Vietnamese string and the comparison is against it
if (response.message === "Giao dich thanh cong") {
```

```ts
// Wrong: "fixed" by a translation sweep. It now compares against a string the provider never sends,
// and every successful payment falls through the branch.
if (response.message === "Transaction successful") {
```

Chúng khác nhau ở việc string đó có phải là dữ liệu thuộc về chúng ta để thay đổi hay không.
