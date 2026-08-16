# đặt tên

## Định nghĩa

Naming ở đây là phần cơ học: cách viết phải giống nhau trong mọi file, bất kể file dùng để làm gì —
cách khai báo một function ở cấp module và cách đặt tên cho thứ phản hồi hành động của người đọc.

Đây không phải vấn đề sở thích. Cả hai cách viết trong mỗi cặp đều hoạt động, và chính vì vậy chúng
phải trở thành rule: không có gì tự sửa cách viết thứ hai, nên một file viết hôm nay sẽ đọc khác file
bên cạnh, còn mọi diff về sau đều mang theo nhiễu không liên quan đến thay đổi.

Tên của một component phải nói component đó là gì, không phải nó được caller đầu tiên gọi ở đâu. Câu
hỏi này được quyết định theo từng layer, vì lỗi cần ngăn chặn khác nhau ở mỗi layer.

Luật này được bảo đảm bởi [`sources/naming.mjs`](../../../sources/fe/naming.mjs).

Implementation anchors in `starci-academy-fe`:
`src/components/blocks/dashboard/CreditStatRow/index.tsx` and
`src/components/blocks/dashboard/CreditStatRow/component.tsx`.

## Luật

**NAMING-1 · Function cấp module là arrow const.**

`export const X = () => {}`, không dùng `function X() {}` và không dùng `export default function`.
Một cách viết duy nhất giúp người đọc quét file thấy cùng một hình dạng cho mọi khai báo, còn grep
theo tên sẽ tìm đúng định nghĩa thay vì gặp một bất ngờ do hoisting.

Lý do sâu hơn là hoisting. Function declaration tồn tại trước dòng khai báo, nên file có thể gọi
một thứ được viết bên dưới mà vẫn xanh. Khi đó thứ tự trong file không còn mang ý nghĩa, vì không có
gì buộc một thứ phải được định nghĩa trước khi dùng. Const không thể được dùng trước khi tồn tại,
nên file được đọc từ trên xuống theo đúng thứ tự nó thực sự chạy.

**NAMING-2 · Thứ phản hồi hành động của người đọc phải có tên `onX`, không bao giờ `handleX`.**

Quy tắc này áp dụng cho cả prop lẫn local. `handleSubmit` và `onSubmit` mô tả cùng một function,
nhưng codebase dùng cả hai sẽ có hai vocabulary cho một ý, buộc mỗi tác giả phải quyết định file này
đang nói theo vocabulary nào.

`on` là tên đi xuyên suốt được. Prop vốn đã là `on.press`, DOM attribute vốn đã là `onClick`, và
slot nhận function vốn đã dùng `on`; vì vậy local tên `handlePress` sẽ bị đổi tên ở boundary mỗi lần
được truyền đi, và mỗi lần đổi tên là một cơ hội mắc lỗi. Đặt tên `onPress` ngay từ đầu giúp tên giữ
nguyên ở declaration, call site và props type.

**NAMING-3 · Tên file và tên route dùng ngôn ngữ mà mọi người đọc đều chia sẻ.**

Rule này được giữ bởi
[`sources/fe/naming.mjs`](../../../sources/fe/naming.mjs)'s `no-second-language-in-path`.

Rule đọc source nhìn thấy identifier, comment và string nhưng không nhìn thấy tên file đang đọc. Vì
thế route có thể là `app/cap-phat/page.tsx`, bên trong toàn identifier tiếng Anh mà không có gì cảnh
báo — trong khi URL, import specifier, folder trong sidebar của editor và path trong stack trace
đều dùng ngôn ngữ mà một nửa người đọc không biết.

Route segment cũng là một tên PUBLIC: đó là địa chỉ khách hàng trích dẫn trong ticket hỗ trợ. Đây
không chỉ là chuyện authoring; URL của sản phẩm cũng phải đọc được. Những từ người dùng nhìn thấy
thuộc về locale catalogue, nơi ngôn ngữ thứ hai là content và việc chuyển ngôn ngữ là mục đích. Path
không phải content; nó là địa chỉ và được nhiều người đọc hơn code bên trong.

Việc kiểm tra có hai phần vì path không thể giữ dấu: `cấp phát` đi vào filesystem thành `cap-phat`.
Dấu bắt được dạng đầu tiên, còn một danh sách tên rõ ràng bắt được dạng Latin hóa. Danh sách này có
chủ ý thay vì đoán mò — đoán các chuỗi ASCII có hình dạng tiếng Việt sẽ từ chối `capacity` và
`dangerous`, khiến rule bắt cả từ tiếng Anh và rồi bị repository tắt đi.

## Forbidden

| Không bao giờ | Vì sao bị từ chối | Thay vào đó |
|---|---|---|
| `function X() {}` ở cấp module | Nó được hoist, nên thứ tự file không còn bảo đảm điều gì tồn tại tại mỗi dòng | `export const X = () => {}` |
| Route hoặc folder có tên bằng ngôn ngữ thứ hai | Địa chỉ được nhiều người đọc hơn code và không thể lướt qua như comment | Đổi tên segment; đưa từ người dùng thấy vào locale catalogue |
| `export default function` | Tương tự, đồng thời export không có tên để grep ở call site | Arrow const có tên và export theo tên |
| `handleX` làm local | Nó bị đổi tên ở boundary mỗi lần truyền đi, và việc đổi tên có thể sai | `onX`, cùng từ mà slot dùng |
| `handleX` làm prop | Hai vocabulary cho một ý, buộc mỗi tác giả tự chọn cách nói | `onX` |
| Tên chỉ nói nơi nó được dùng | Nó mất ý nghĩa ở caller thứ hai, rồi bị sao chép hoặc bỏ lại | Đặt tên theo bản chất; rule cho việc này được nêu theo từng layer |

## Ví dụ

### Trường hợp thông thường — một hình dạng cho mỗi khai báo

```tsx
// Every declaration in the file has the same shape, and nothing exists before its own line.
export const formatQuota = (value: number) => `${value} left`

export const CreditStatRow = ({ props }: CreditStatRowProps) => (
    <StatRow props={{ label: props.label, value: formatQuota(props.remaining) }} />
)
```

```tsx
// Wrong: the component calls a helper declared below it and stays green, so the file's order
// promises nothing to whoever reads it next.
export function CreditStatRow({ props }: CreditStatRowProps) {
    return <StatRow props={{ label: props.label, value: formatQuota(props.remaining) }} />
}

function formatQuota(value: number) {
    return `${value} left`
}
```

Chúng chỉ khác nhau ở một điểm: một tên có thể được dùng trước dòng tạo ra nó hay không.

### Bẫy handler — đổi tên ở boundary

```tsx
// The name is the same at the declaration, at the slot, and in the props type.
const onClaim = () => claim.trigger()

return <_DailyQuest state="claimable" props={frame} on={{ claim: onClaim }} />
```

```tsx
// Wrong: the function is called one thing here and another thing one line later, and nothing
// but habit keeps the two in step.
const handleClaim = () => claim.trigger()

return <_DailyQuest state="claimable" props={frame} on={{ claim: handleClaim }} />
```

Chúng chỉ khác nhau ở một điểm: tên có giữ nguyên khi function được truyền đi hay không.

### Trường hợp ranh giới — một handler không phải là handler

```tsx
// Not a handler: it computes a value. `on` would be a lie, and this rule does not ask for it.
const claimLabel = buildClaimLabel(quest.data)
```

```tsx
// Wrong: named as though a reader triggers it, when nothing does.
const onClaimLabel = buildClaimLabel(quest.data)
```

Chúng chỉ khác nhau ở một điểm: action của người đọc có phải là thứ làm nó chạy hay không.
