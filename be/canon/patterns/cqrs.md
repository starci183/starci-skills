# cqrs

## Định nghĩa

Mọi hoạt động mà phần phụ trợ này hiển thị là một thông báo CQRS có trình xử lý. Một đột biến gửi đi một
lệnh; một truy vấn gửi một truy vấn; một tác dụng phụ phải tồn tại lâu hơn yêu cầu là một sự kiện. các
trình phân giải không thực hiện công việc và dịch vụ không thực hiện công việc - chúng chuyển yêu cầu đến một
trình xử lý và trình xử lý là nơi tác phẩm tồn tại.

Hình dạng không phải là trang trí. Đặt công việc đằng sau một thông báo có nghĩa là thao tác tương tự có thể được thực hiện
đạt được từ trình phân giải, bộ điều khiển, lệnh CLI, công việc hoặc bài kiểm tra ** mà không ai trong số họ biết
về nhau**, và điều đó có nghĩa là nơi duy nhất để đọc những gì "đăng ký học viên" thực sự làm là một
tập tin được đặt tên sau khi đăng ký một người học.

Câu hỏi quyết định liệu thứ gì đó có thuộc về nơi này hay không: **điều này có thể được gọi từ nhiều hơn một không
cửa?** Nếu có — và hầu hết mọi thứ đều có thể, bởi vì CLI và bộ thử nghiệm đều là cửa — đó là một
tin nhắn bằng trình xử lý chứ không phải phương thức trên dịch vụ.

Điều giữ luật này là[`sources/be/cqrs.mjs`](../../../sources/be/cqrs.mjs).

## Quy tắc

**CQRS-1 · Một thao tác, một thư mục và thư mục đó chứa toàn bộ thao tác.**
```
add-to-cart/
    add-to-cart.command.ts             the message
    add-to-cart.handler.ts             the work
    add-to-cart.service.ts             the dispatch
    add-to-cart.resolver.ts            the door
    add-to-cart.module.ts              the wiring
    add-to-cart.module-definition.ts   the wiring's own definition
    add-to-cart.handler.spec.ts        the twin
```
Mỗi tệp được đặt tên cho thao tác, do đó, người đọc biết thao tác sẽ biết mọi tên tệp,
và một grep cho nó tìm thấy toàn bộ chứ không phải một phần của nó. Một tập tin trong thư mục này là
không được đặt tên cho hoạt động này là thứ được phát minh ở đây và thuộc về một nơi nào đó có thể tìm thấy được.

**CQRS-2 · Thông báo mang ngữ cảnh yêu cầu và không có gì khác.**

Một lệnh hoặc truy vấn chứa một`params`trường và trường đó mang yêu cầu, được xác thực
người dùng và miền địa phương. Nó không có phương thức, không có mặc định và không có logic: một thông báo tính toán một cái gì đó
đã chuyển một quyết định đến một nơi không ai có thể nhìn thấy, và sau đó hai người gửi cùng một tin nhắn sẽ
không đồng ý về ý nghĩa của nó.

**CQRS-3 · Trình xử lý ghi đè`process`, không bao giờ`execute`.**

`ICQRSHandler`là một phương thức mẫu:`execute`là mục công khai và nó gọi được bảo vệ`process`một trình xử lý thực hiện. Đường nối đó tồn tại nên có một mối quan tâm xuyên suốt - thời gian, nhật ký,
giao dịch, thử lại - có thể được thêm một lần vào cơ sở thay vì trong hàng trăm trình xử lý.

Một trình xử lý ghi đè`execute`tự lấy nó ra khỏi khuôn mẫu và thực hiện điều đó một cách vô hình: nó
biên dịch, nó chạy và nó là trình xử lý duy nhất mà thay đổi xuyên suốt tiếp theo bị âm thầm bỏ qua.

**CQRS-4 · Dịch vụ gửi đi và chỉ có vậy thôi.**

Dịch vụ bên cạnh bộ xử lý tồn tại nên cửa không nhập xe buýt và nó dài một dòng
mục đích. Logic nghiệp vụ xuất hiện có logic ở một nơi không có thông báo, điều đó có nghĩa là nó
không thể được gọi ra bởi bất kỳ cánh cửa nào khác và không thể được kiểm tra nếu không đứng lên cánh cửa mà nó thuộc về.

Độ mỏng trông vô nghĩa cho đến khi có cánh cửa thứ hai - CLI và dây nịt
đã là cánh cửa thứ hai.

**CQRS-5 · Trình xử lý gây ra lỗi và lỗi này là một ngoại lệ của miền.**

Trình xử lý không thể thực hiện công việc của mình sẽ đưa ra ngoại lệ miền cho biết lý do. Nó không trở lại`null`và nó không trả về hình dạng thành công mang theo chuỗi lỗi: cả hai đều đưa ra quyết định
tới người gọi có ít thông tin hơn người xử lý vừa thực hiện cuộc gọi đó.

**CQRS-6 · Một sự kiện dành cho những gì phải xảy ra MỌI LÚC NÀO, không phải dành cho những gì người gọi đang chờ đợi.**

Gửi đi một sự kiện khi công việc phải diễn ra cho dù người gọi có còn ở đó hay không - một thư, một
trình chiếu, đồng bộ. Bất kỳ câu trả lời nào của người gọi đều phụ thuộc vào việc duy trì lệnh, bởi vì
sự kiện người gọi phải đợi là một lệnh có tính công thái học kém hơn và không có giá trị trả về.

**CQRS-7 · Trình xử lý có thông số kỹ thuật kép bên cạnh.**`<operation>.handler.spec.ts`, trong cùng một thư mục. Người xử lý là nơi đưa ra các quyết định, vì vậy nó là
nơi kiểm tra đơn vị - và đặt thông số kỹ thuật bên cạnh tệp có nghĩa là bất kỳ ai cũng tìm thấy thông số kỹ thuật đó
chỉnh sửa trình xử lý chứ không phải bởi bất kỳ ai tìm kiếm trong cây thử nghiệm.

## Bị cấm

| Không bao giờ | Tại sao nó bị từ chối | Thay vào đó |
|---|---|---|
| Làm việc trong trình phân giải hoặc bộ điều khiển | Sau đó, nó có thể truy cập được từ chính xác một cửa và CLI, công việc và bài kiểm tra không thể truy cập được | Gửi tin nhắn; đưa công việc vào bộ xử lý |
| Làm việc trong dịch vụ bên cạnh người xử lý | Tương tự, xuống một lớp - nó không có thông báo nên không có gì khác có thể gọi nó | Di chuyển nó vào trình xử lý |
| Ghi đè`execute`trên một người xử lý | Nó rời khỏi mẫu một cách im lặng và thay đổi xuyên suốt tiếp theo bỏ sót chính xác tệp này | ghi đè`process`|
| Lệnh hoặc truy vấn có phương thức, giá trị mặc định hoặc logic | Một thông báo tính toán sẽ chuyển quyết định đến nơi không ai đọc | Giữ nó để`params`; tính toán trong trình xử lý |
| Một người xử lý quay trở lại`null`có nghĩa là thất bại | Người gọi phải đoán xem điều gì đã xảy ra với ít thông tin hơn người xử lý có | Ném ngoại lệ tên miền đặt tên cho nó |
| Một người xử lý quay trở lại`{ ok: false, error }`| Tương tự, mặc một hình dạng - và mỗi người gọi giải mã nó theo cách khác nhau | Ném |
| Một sự kiện mà người gọi chờ đợi | Đó là một lệnh không có giá trị trả về và tính công thái học kém hơn | Biến nó thành một lệnh |
| Một tập tin trong thư mục thao tác không được đặt tên cho thao tác | Một thứ có thể tái sử dụng đã được phát minh ở nơi không ai có thể tìm thấy | Di chuyển nó đến`modules/`dưới một cái tên cho biết nó là gì |
| Một trình xử lý không có thông số kỹ thuật bên cạnh | Các quyết định tồn tại ở đây, vì vậy một trình xử lý chưa được kiểm tra là một quyết định chưa được kiểm tra | Viết song sinh |

## Ví dụ

### Trường hợp thông thường — toàn bộ hoạt động, trong hình dạng
```ts
/** The message: request context, nothing else. */
export class AddToCartCommand {
    constructor(readonly params: ExecuteParams<AddToCartRequest>) {}
}
```

```ts
/** The dispatch: one line, so the door never imports the bus. */
@Injectable()
export class AddToCartService {
    constructor(private readonly commandBus: CommandBus) {}

    async execute(params: ExecuteParams<AddToCartRequest>): Promise<CartItemEntity> {
        return this.commandBus.execute(new AddToCartCommand(params))
    }
}
```

```ts
/** The work: `process`, never `execute`. */
@CommandHandler(AddToCartCommand)
@Injectable()
export class AddToCartHandler
    extends ICQRSHandler<AddToCartCommand, CartItemEntity>
    implements ICommandHandler<AddToCartCommand, CartItemEntity> {
    protected override async process(command: AddToCartCommand): Promise<CartItemEntity> { /* ... */ }
}
```
### Cái bẫy mẫu
```
ts
// handler: inside the template, so a timing or a transaction added to the base reaches it.
protected override async process(command: AddToCartCommand): Promise<CartItemEntity> {
    return this.entityManager.save(cartItem)
}
```

```ts
// Wrong: it compiles, it runs, and it is the one handler that never gets the cross-cutting
// change - because it stopped going through the base at all.
override async execute(command: AddToCartCommand): Promise<CartItemEntity> {
    return this.entityManager.save(cartItem)
}
```
Chúng khác nhau ở một điều: lớp cơ sở có còn chạy hay không.

### Cái bẫy phục vụ chất béo
```ts
// service: it carries the request to the bus, and knows nothing about carts.
async execute(params: ExecuteParams<AddToCartRequest>): Promise<CartItemEntity> {
    return this.commandBus.execute(new AddToCartCommand(params))
}
```

```ts
// Wrong: the rule about already-owned courses now lives in a place with no message, so the CLI
// that also enrolls people cannot reach it and will grow its own copy.
async execute(params: ExecuteParams<AddToCartRequest>): Promise<CartItemEntity> {
    if (await this.enrollments.owns(params.user.id, params.request.courseId)) {
        throw new CourseAlreadyEnrolledError({ courseId: params.request.courseId })
    }
    return this.commandBus.execute(new AddToCartCommand(params))
}
```
Chúng khác nhau ở một điều: liệu cánh cửa thứ hai có đạt được quy tắc hay không.

### Cái bẫy thất bại
```ts
// handler: it names the failure, and the name carries the data somebody will need.
if (!courseExists) {
    throw new CourseNotFoundException({ id: courseId })
}
```

```ts
// Wrong: the caller now guesses. A missing course, a deleted course and an unauthorised read all
// arrive as the same `null`.
if (!courseExists) {
    return null
}
```
Chúng khác nhau ở một điều: liệu lý do có còn tồn tại khi quay trở lại hay không.

### Bẫy sự kiện
```ts
// event: the mail must go whether or not the reader is still on the page.
this.eventBus.publish(new EnrollmentOpenedEvent({ userId, courseId }))
return enrollment
```

```ts
// Wrong: the caller needs the enrollment, so this is a command written as an event - it returns
// nothing, and the resolver now polls for a row it just asked to have created.
this.eventBus.publish(new OpenEnrollmentEvent({ userId, courseId }))
return null
```
Chúng khác nhau ở một điều: liệu câu trả lời của chính người gọi có phụ thuộc vào nó hay không.
