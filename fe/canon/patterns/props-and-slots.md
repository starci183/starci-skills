# đạo cụ và slot

## Định nghĩa

Đạo cụ của một thành phần là một tập hợp ĐÓNG các vị trí được đặt tên và tập hợp này được viết dưới dạng bí danh loại cho mỗi
lớp thay vì được lắp ráp trên mỗi thành phần. Do đó, thứ mà người gọi có thể giao một thành phần không phải là một
quy ước mà bất cứ ai cũng phải nhớ - đó là thứ duy nhất được biên dịch.

Sự khác biệt quan trọng: **quy tắc ngày nay là đúng; một hàng rào sẽ đúng vào tháng tới.** Một
giao diện đánh vần`props`Và`isLoading`là một quy tắc - đúng khi viết, một`extends`đi xa
từ việc mang phong cách riêng của người gọi. Một bí danh LÀ toàn bộ hình dạng là một hàng rào: không có nơi nào
để đặt một ô thứ tư, do đó tác giả muốn có một ô đó phải quyết định xem chúng thực sự thuộc lớp nào
viết.

Năm vị trí tồn tại trên toàn bộ hệ thống và không có thành phần nào có đủ năm vị trí.`props`là những gì nó vẽ ra.`on`đó là những gì nó làm.`contract`là chìa khóa mà nó hiển thị và`render`là một thành phần được đặt tên trên mỗi vị trí
khóa đó khai báo - có hai cái đó là điều làm cho một thùng chứa trở thành một thùng chứa.`isLoading`được trao
xuống, không bao giờ quyết định tại địa phương.`render`là nội dung hợp đồng có thương hiệu, không bao giờ đánh dấu hoặc thành phần React tùy ý. Cây có thể mất
ràng buộc`ContractSlots<K>`hoặc`ContractProjection<K>`. Một máy chủ bề mặt mất`ContractComponent<K, LeafProps<D,A>>`: một loại thành phần thực mang khóa chính xác khi thay đổi
dữ liệu thời gian chạy tiếp tục thông qua thông thường`props`, `on`, Và`isLoading`khe cắm. Trang web cuộc gọi thực hiện
không xây dựng lại descriptor hoặc đóng data vào callback. Xem [`contract`](contract.md), CONTRACT-11.

Điều giữ luật này là[`sources/fe/props.ts`](../../../sources/fe/props.ts), đó là hàng rào
chính nó, và[`sources/fe/props-and-slots.mjs`](../../../sources/fe/props-and-slots.mjs)cho một
thứ mà hàng rào không thể nhìn thấy: một hình được viết nội tuyến tại tham số, nơi nó không có tên để đọc
bởi.

Implementation anchors in `starci-academy-fe`: `src/components/contracts/props.ts` and `src/components/branches/SurfaceListCard/index.tsx`.

## Quy tắc

**SLOTS-1 · Khe dữ liệu mang DỮ LIỆU và một chức năng không đáp ứng được.**

Bất kể tài liệu JSON nào có thể chứa được. Ràng buộc duy nhất đó là thứ ngăn chặn một thành phần bị buôn lậu
thông qua khe dữ liệu, đó là lý do tại sao trình xử lý di chuyển trong khe riêng của chúng thay vì bên cạnh các giá trị
họ hành động tiếp. Một thành phần đến dưới dạng dữ liệu sẽ khiến người gọi nó trở thành tác giả của một hình dạng mà không ai có thể
tìm từ bên ngoài.

**SLOTS-2 · Dữ liệu được khai báo bằng bí danh loại, không bao giờ có giao diện.**

Không phải là một sở thích phong cách. Bí danh loại có chữ ký chỉ mục ngầm còn giao diện thì không, vì vậy
một giao diện âm thầm phá vỡ hàng rào dữ liệu - nó biên dịch khi khai báo và ngừng đáp ứng
ràng buộc giữ cho các chức năng bị loại bỏ. Bí danh là ràng buộc đang hoạt động; giao diện là
ràng buộc lặng lẽ vắng mặt.

**SLOTS-3 · Hình dạng của tham số có tên.**

Một loại đối tượng nội tuyến tại tham số là một hình dạng không thể đọc được từ đâu: nó không thể được
được nhập, không thể được tham chiếu bởi bản sao kiểm tra nó và không thể được tìm thấy bởi bất kỳ ai đang tìm kiếm
những gì thành phần này chấp nhận. Việc đặt tên nó tốn một dòng và là sự khác biệt giữa hợp đồng và
chữ ký.

Tên là`XProps`cho thành phần`X`và nó đặt tên đầu vào hoàn chỉnh trước hàm. Một
ngã tư như`Frame & { signOutLabel: string }`được viết nội tuyến tại tham số vẫn là một
hình dạng ẩn danh và bị từ chối vì lý do tương tự như đối tượng nội tuyến.

**SLOTS-4 · Sự hiện diện của`contract`Và`render`là ranh giới lớp và là ranh giới duy nhất
điều đó không bao giờ cần phải tranh cãi.**

Một hình khép kín không có; một container mở có cả hai. Cả hai hướng đều có thể nhìn thấy trong đạo cụ
bí danh, do đó, một tệp đã vượt qua ranh giới sẽ được hiển thị từ loại của nó chứ không phải từ một
xem xét. Một vùng chứa mà người gọi không thể điền vào sẽ thuộc một lớp bên dưới bất kể nó được gọi là gì, và một
các khe đã cho có hình dạng đóng đã trở thành một thùng chứa bất kỳ thư mục nào nó nằm trong đó.

Khe cắm không được gọi`children`và cái tên không mang tính thẩm mỹ.`children`chấp nhận đánh dấu có
đã được xây dựng - một`.map`, một cây ba, một cây con không ai đặt tên — vậy bên trong thùng chứa có gì
không bao giờ có thể được nêu ở bất cứ đâu.`render`chấp nhận một thành phần cho mỗi vị trí được đặt tên, điều này cho phép
ranh giới là một thực tế mà trình biên dịch nắm giữ chứ không phải là một thói quen mà người đánh giá giữ.

**SLOTS-5 ·`isLoading`được nhận, không bao giờ được quyết định.**

Một thành phần bên dưới lớp sở hữu một yêu cầu sẽ được thông báo liệu thứ mà nó vẽ đã đến hay chưa. Nó
không hỏi. Lớp sở hữu yêu cầu sẽ ghi cờ một lần khi nó hạ cây và
không bao giờ nhận được chính nó - đó là lý do tại sao các đạo cụ riêng của khối thay vào đó lại mang một tình huống.

**SLOTS-6 · Không có khe xuất hiện.**

Không có tên lớp, không có kiểu dáng, không có khoảng cách, không có móc kiểu dáng cho mỗi phần. Người gọi có thể định kiểu lại một nút có
trở thành chủ sở hữu thứ hai của nó và thành phần này hiện có hai tác giả không bao giờ lên tiếng. Dù người gọi là ai
đang cố gắng nói là một BIẾN THỂ có tên, được quyết định bên trong.

**SLOTS-7 · Bề mặt danh sách nhận các bộ sưu tập miền thông qua tên miền`props`, không bao giờ`items`.**

`SurfaceListCard`là máy chủ hợp đồng, không phải là mô hình dữ liệu. Thương hiệu ổn định của nó`render`thành phần sở hữu
hình dạng đạo cụ miền, vì vậy`tasks`, `courses`hoặc bất kỳ bộ sưu tập nào sau này được chuyển dưới tên thật của nó
bên trong`props`. Cấp cao nhất chung`items`khe cắm sẽ tạo làn dữ liệu thứ hai và dạy chia sẻ
hiển thị mô hình của mọi người gọi. Quy tắc nghiêm ngặt từ chối làn đường đó tại địa điểm gọi JSX.

## Forbidden

| Không bao giờ | Tại sao nó bị từ chối | Thay vào đó |
|---|---|---|
| Một chức năng trong khe dữ liệu | Nó đưa lậu một thành phần thông qua dữ liệu và không thể tìm thấy hình dạng đó từ bên ngoài | Đặt nó vào khe xử lý |
| Giao diện cho dữ liệu của thành phần | Nó âm thầm làm hỏng hàng rào ngăn chặn các chức năng | Một bí danh loại |
| Loại đối tượng nội tuyến trên một tham số | Hình dạng không có tên nên không có gì có thể nhập, kiểm tra hoặc tìm thấy nó | Đặt tên cho nó trong mô-đun |
| Một vị trí mà bí danh không có | Bí danh LÀ hình dạng; muốn thêm một lớp nữa có nghĩa là lớp đã được chọn sai | Quyết định đây là lớp nào |
|`children`bên ngoài ModalShell/DrawerShell/DropdownShell | Đánh dấu đến nơi đã được xây dựng sẵn, vì vậy những gì vùng chứa chứa không bao giờ có thể được nêu hoặc kiểm tra |`contract`cộng với một thương hiệu`ContractComponent<K>` |
| `items`TRÊN`SurfaceListCard`| Nó tạo ra làn dữ liệu thứ hai và làm cho bề mặt chia sẻ biết mô hình thu thập của người gọi | Đặt bộ sưu tập dưới tên miền của nó trong tên của thành phần kết xuất`props`gõ |
|`render`trên một hình dạng khép kín | Nó đã trở thành một thùng chứa, bất kể thư mục của nó nói gì | Di chuyển nó đến lớp chứa |
| Một thành phần tự quyết định`isLoading`| Nó hỏi một câu hỏi lớp trên đã trả lời | Lấy cờ |
| Tên lớp, kiểu hoặc khoảng cách | Thành phần này có được tác giả thứ hai, người vô hình từ bên trong | Một biến thể được đặt tên |
| Móc tạo kiểu cho từng phần | Mọi phần tử bên trong đều trở thành bề mặt công khai và thành phần không bao giờ có thể thay đổi | Một biến thể được đặt tên, được quyết định bên trong |

## Ví dụ

### Hàng rào và rule trông giống nhau

```ts
type TextProps = LeafProps<TextData>
```

```ts
interface TextProps {
    props: TextData
    isLoading?: boolean
}
```
Chúng khác nhau ở một điều: liệu vị trí thứ tư có thể được bổ sung vào tháng tới mà không ai để ý hay không.

### Bẫy type alias

```ts
type TextData = {
    readonly content: string
}
```

```ts
interface TextData {
    readonly content: string
}
```
Chúng khác nhau ở một điều: liệu hàng rào dữ liệu có còn tồn tại hay không. Giao diện biên dịch ở đây và dừng lại
thỏa mãn ràng buộc lên một lớp.

### Bẫy đặt tên

```tsx
export const Row = ({ props }: RowProps) => /* ... */
```

```tsx
export const Row = ({ props }: { props: { label: string; value: string } }) => /* ... */
```
Chúng khác nhau ở một điều: liệu có điều gì khác có thể đề cập đến hình dạng hay không.

### Bẫy intersection

```tsx
export type DashboardPageProps = DashboardFrame & DashboardCopy
export const _DashboardPage = (input: DashboardPageProps) => /* ... */
```

```tsx
export const _DashboardPage = (
    input: DashboardFrame & { readonly signOutLabel: string; readonly unavailableMessage: string },
) => /* ... */
```
Chúng khác nhau ở một điều: liệu đầu vào công khai hoàn chỉnh có tên thành phần hay không.

### Bẫy lối thoát

```tsx
<StatRow props={{ label, value, isOwnRow: true }} />
```

```tsx
<StatRow props={{ label, value }} nameClassName={isMe ? "text-accent" : undefined} />
```
Chúng khác nhau ở một điều: liệu thành phần có quyết định điểm nhấn của chính nó trông như thế nào hay không.
