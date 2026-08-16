#loại an toàn

## Định nghĩa

Hệ thống loại là công cụ đánh giá rẻ nhất mà cơ sở mã này có: nó đọc từng dòng, không bao giờ mệt mỏi,
và các đối tượng trước khi mã chạy. Mọi quy tắc ở đây đều là **không tắt** — bởi vì mỗi quy tắc
trong số những cách để làm điều đó có vẻ hợp lý cục bộ và sau đó vô hình.`any`là điều hiển nhiên. Những cái khác yên tĩnh hơn: một diễn viên kép rửa sai loại thông qua`unknown`, một kiểu đối tượng nội tuyến mà không gì khác có thể tham chiếu, một enum bị xóa khi biên dịch
thời gian và không thể đọc lại khi chạy.

Câu hỏi giải quyết một trường hợp: **sau dòng này, trình biên dịch có còn biết nó có gì không?** Nếu
Câu trả lời là không, dòng đó đã có sự đảm bảo rồi, và nó cần một lý do tốt hơn là sự thuận tiện.

Điều giữ luật này là[`sources/be/type-safety.mjs`](../../../sources/be/type-safety.mjs).

## Quy tắc

**LOẠI-1 · Không`any`. Thu hẹp từ`unknown`thay vì.**`any`không có nghĩa là "Tôi không biết loại này" — nó có nghĩa là "ngưng kiểm tra" và mức chênh lệch dừng:
mọi thuộc tính đều đọc nó, mọi giá trị bắt nguồn từ nó và mọi lệnh gọi nó được chuyển đến đều
cũng không được chọn.`unknown`cũng nói điều trung thực tương tự và buộc việc thu hẹp xảy ra một lần, trong
mở, nơi người đọc có thể thấy những gì đã được giả định.

**TYPE-2 · Không dùng chiêu kép`unknown`.**

`x as unknown as T`là trình biên dịch cho bạn biết dàn diễn viên sai và bị ghi đè hai lần. Đó là
tệ hơn`any`theo một cách cụ thể: nó tạo ra một giá trị YÊU CẦU được`T`, vậy là mọi thứ
hạ lưu hoàn toàn tin tưởng vào nó và sự cố xảy ra cách xa đường gây ra nó.

**TYPE-3 · Kiểu của tham số bị hủy cấu trúc là loại được đặt tên, không phải là kiểu chữ trong dòng.**`({ userId, courseId }: { userId: string, courseId: string })`không thể được tham chiếu, tái sử dụng,
được mở rộng hoặc được nhập - vì vậy người gọi thứ hai viết lại và hai bản sao lặng lẽ trôi đi
bởi vì không có gì kết nối họ. Một loại được đặt tên trong thư mục loại của mô-đun có cùng thông tin
với một tay cầm trên đó.

**TYPE-4 · Một enum là một enum đơn giản, không bao giờ`const enum`.**

MỘT`const enum`được nội tuyến tại thời điểm biên dịch và không có đối tượng thời gian chạy, vì vậy nó không thể lặp lại,
không thể được ánh xạ ngược và không thể vượt qua ranh giới các mô-đun biệt lập mà kho lưu trữ này biên dịch
dưới. Chi phí mà nó tiết kiệm được là một vài byte; chi phí mà nó áp đặt là một tập hợp những việc đơn giản chỉ cần làm
không làm việc.

**TYPE-5 · Một liên minh bị phân biệt đối xử đánh bại một túi boolean.**

Bốn boolean thừa nhận mười sáu kết hợp, trong đó có lẽ tồn tại ba kết hợp. Mười ba người còn lại
kiểm tra loại và một trong số đó là nội dung người gọi chuyển vào lúc bốn giờ sáng. Một liên minh của các bang
tồn tại không thể diễn đạt một trạng thái không tồn tại.

**TYPE-6 · Các lối thoát bị xử phạt được nêu rõ khi áp dụng.**

Họ thông số kỹ thuật và cây thử nghiệm có thể sử dụng kiểu kép: việc xây dựng một giá trị sai có chủ ý là cách
bạn chứng minh rằng API đã đóng từ chối nó. Lối ra đó dành cho các bài kiểm tra chứ không phải nơi nào khác, và nó được ghi vào
cấu hình thay vì rải dưới dạng ngăn chặn trên mỗi dòng.

## Bị cấm

| Không bao giờ | Tại sao nó bị từ chối | Thay vào đó |
|---|---|---|
|`any`| Nó không nói "loại không xác định", nó nói "dừng kiểm tra" - và việc dừng lại lan sang mọi thứ bắt nguồn từ nó |`unknown`, thu hẹp một lần khi mở |
|`x as unknown as T`| Trình biên dịch đã từ chối tuyển chọn và bị ghi đè hai lần; kết quả YÊU CẦU được`T`, vậy là sự thất bại lại xuất hiện cách xa đây | Sửa loại hoặc thu hẹp bằng bộ bảo vệ kiểm tra |
| Loại đối tượng nội tuyến trên tham số bị hủy cấu trúc | Nó không thể được tham chiếu hoặc nhập, vì vậy người gọi thứ hai viết lại và các bản sao trôi | Một loại được đặt tên trong mô-đun`types/` |
| `const enum`| Nó không có đối tượng thời gian chạy: không thể lặp lại, không thể ánh xạ ngược và không thể vượt qua ranh giới mô-đun biệt lập | Một đồng bằng`enum`|
| Một tập hợp các boolean mô tả một tình huống | Chúng nhân lên thành các tổ hợp chưa ai từng thấy và tất cả chúng đều được biên dịch | Một liên minh phân biệt đối xử của các bang tồn tại |
| Ngăn chặn trên mỗi dòng chỉ dành cho nhu cầu kiểm tra | Lối ra không còn hiển thị và bắt đầu trở thành thói quen | Nêu rõ lối ra trong cấu hình, nằm trong phạm vi kiểm tra toàn cầu |

## Ví dụ

### Trường hợp thông thường — chưa biết, đã thu hẹp một lần
```ts
const parsePayload = (raw: unknown): WebhookPayload => {
    if (typeof raw !== "object" || raw === null || !("event" in raw)) {
        throw new WebhookPayloadInvalidException({})
    }
    return raw as WebhookPayload
}
```

```ts
// Wrong: nothing below this line is checked, including the things built out of it.
const parsePayload = (raw: any): WebhookPayload => raw
```
Chúng khác nhau ở một điều: giả định đó có được nêu ở bất kỳ nơi nào mà người đọc có thể tìm thấy hay không.

### Bẫy rửa tiền
```ts
// the guard checks the thing the type claims
if (isEnrollment(row)) {
    return row.courseId
}
```

```ts
// Wrong: the compiler said these types do not overlap, and was overruled. Everything downstream
// now trusts `row` completely, and the failure appears wherever it is finally used.
return (row as unknown as EnrollmentEntity).courseId
```
Chúng khác nhau ở một điều: liệu có điều gì thực sự được kiểm tra hay không.

### Bẫy kiểu nội tuyến
```ts
/** What granting XP needs. */
export interface GrantXpParams {
    userId: string
    amount: number
}

export const grantXp = ({ userId, amount }: GrantXpParams) => { /* ... */ }
```

```ts
// Wrong: the second caller cannot import this shape, so they retype it - and when a third field
// arrives, one of the two copies gets it.
export const grantXp = ({ userId, amount }: { userId: string, amount: number }) => { /* ... */ }
```
Chúng khác nhau ở một điều: hình dạng đó có tay cầm hay không.

### Bẫy nhà nước
```ts
type GradeState =
    | { kind: "pending" }
    | { kind: "graded"; score: number }
    | { kind: "failed"; reason: string }
```

```ts
// Wrong: `isGraded && isFailed` compiles, and `isGraded` with no score compiles too.
interface GradeState {
    isPending: boolean
    isGraded: boolean
    isFailed: boolean
    score?: number
}
```
Chúng khác nhau ở một điều: liệu một trạng thái không thể có có thể được viết ra hay không.
