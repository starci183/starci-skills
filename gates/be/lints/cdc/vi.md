---
title: CDC · Vietnamese
---

# Bắt thay đổi dữ liệu

Đầu vào là code đã viết xong — một tệp bộ lắng nghe, một khúc diff. Đầu ra là một **phán quyết**: tệp
đó có thuộc phạm vi hay không, quy tắc đã công bố nào đã nổ, nó báo gì và báo tại nút nào, ứng với mã
luật nào, và cái cửa còn mở nào lẽ ra đã che được đúng lỗi ấy. Mô-đun này không chọn giúp ai cách dựng
một projection. Nó chỉ từ chối, và nó phải chỉ được vào đúng định danh mà nó từ chối.

## Luật

Luật có bảy mã, `CDC-1` đến `CDC-7`. **Ba mã có quy tắc**, và cả ba đều do đúng một quy tắc công bố
giữ. Quy tắc đó đọc một tên tệp, rồi đọc tên các thành viên mà một lớp khai báo. Hết. Tên là thứ duy
nhất về một bộ lắng nghe thay đổi dữ liệu mà một bộ phân tích cú pháp đọc **một tệp** có thể khẳng định
chắc chắn: lớp này có *kế thừa* lớp cơ sở chung không, có *khai* một nhóm tiêu thụ, một danh sách chủ
đề, một phương thức ánh xạ và một phương thức tính lại không, và có *khai* cái móc vòng đời mà nó không
được phép sở hữu không.

Còn tất cả những gì luật thật sự quan tâm ở phía sau mấy cái tên đó — nhóm tiêu thụ có ổn định qua các
lần khởi động lại không, danh sách chủ đề có đủ không, `recomputeTarget` dựng lại từ hàng nguồn hay
cộng thêm một lượng chênh lệch, bia mộ có bị bịa thành hàng rỗng không, một tin nhắn hỏng có làm đứng
cả vòng lặp không, đường giao nhận đã bao giờ được chứng minh qua một broker thật chưa — đều là **giá
trị hoặc thân hàm**, không phải tên. Quy tắc không đọc cái nào trong hai thứ đó.

Nói thẳng ra: **hình dạng của bộ lắng nghe được giữ, ngữ nghĩa của projection thì không.** Một bộ lắng
nghe hình dạng đúng với nhóm tiêu thụ sinh theo tiến trình vẫn đi qua cổng này sạch sẽ, rồi phát lại
toàn bộ lịch sử mỗi lần khởi động. Đó không phải khuyết điểm của quy tắc; đó là ranh giới của những gì
một cái tên chứng minh được, và nó được viết ra ở đây để không ai đọc một lần dựng xanh thành một
projection đúng.

## Luật máy đã xuất bản

| Quy tắc | Mã | Nó báo gì |
|---|---|---|
| `projection-listener-contract` | `CDC-1`, `CDC-2`, `CDC-3` | Một lớp trong tệp bộ lắng nghe không kế thừa `AbstractProjectionListener` (`base`); thiếu một trong bốn tên `groupId`, `topics`, `deriveTargets`, `recomputeTarget` (`member`, mỗi tên thiếu một báo cáo); tự khai `onModuleInit` (`lifecycle`) |

Nguồn công bố **đúng một** quy tắc. Một quy tắc giữ ba mã là chuyện cần nói thẳng thay vì làm cho bảng
trông cân đối giả tạo: ba phép kiểm bên trong nó độc lập, chúng báo độc lập, và người đọc nhật ký dựng
thấy `projection-listener-contract` vẫn phải đọc thông báo mới biết mã nào bị vi phạm. `CDC-1` cho
`base` và `lifecycle`; `CDC-2` cho hai tên `groupId` và `topics`; `CDC-3` cho hai tên `deriveTargets`
và `recomputeTarget`.

`CDC-4`, `CDC-5`, `CDC-6` và `CDC-7` **không có quy tắc nào**, và quy tắc ở đây không nhận vơ chúng.
Chúng là chưa có ai giữ chứ không phải đã được phủ, và một lần chạy xanh không nói gì về một
`recomputeTarget` cộng thêm lượng chênh lệch, một bia mộ bị bịa thành hàng rỗng, một lỗi làm đứng
consumer, hay một đường giao nhận chưa bao giờ chạy qua broker thật.

Mức nghiêm trọng được công bố là `error`, với lý do mọi phép kiểm đều là so tên trong đúng một tệp và
không cần cấu hình gì để chạy. Nguồn ship mức đó và **không kèm số đo nào bên cạnh** — không có con số
người vi phạm nào được ghi lại để mua lấy mức `error` ấy.

## Đọc một diff

1. **Quyết định phạm vi trước mọi thứ, và ghi lại.** Ngoài phạm vi ở đây không có nghĩa là tệp đã qua
   — nghĩa là quy tắc trả về `{}`, không visitor nào được cài, và quy tắc **không tồn tại** với tệp đó.
2. **Quy tắc cần một đường dẫn kết thúc bằng `projection.listener.ts`.** Mọi tên khác — `order.listener.ts`,
   `.tsx`, `.mts`, một bộ lắng nghe khai trong `index.ts`, một bộ lắng nghe sống trong một tệp
   `*.service.ts` — đều tắt hẳn quy tắc.
3. **Kiểm miễn trừ duy nhất.** Đường dẫn đã chuẩn hoá `.endsWith("/abstract-projection.listener.ts")`
   bị loại trừ; chính lớp cơ sở chung được miễn quy tắc của nó.
4. **Đọc mọi `ClassDeclaration` trong tệp**, không riêng lớp được xuất, và không bao giờ đọc
   `ClassExpression`. Đọc định danh lớp cha đúng như cách viết tại `extends`, và đọc `key` của mọi nút
   thành viên.
5. **Xuất một khối cho mỗi phát hiện.** Ba phép kiểm độc lập, không có lệnh thoát sớm nào ở giữa, nên
   một lớp có thể gom `base`, bốn báo cáo `member` và `lifecycle` trong cùng một lượt.
6. **Viết dòng `hatch`** mỗi khi một cửa còn mở lẽ ra đã che được đúng lỗi ấy — nhất là khi phán quyết
   là im lặng.
7. **Không báo cái mà không quy tắc nào canh.** Bốn trong bảy mã không có máy nào giữ; một phán quyết
   nói khác đi là nói sai về mô-đun này.

## `projection-listener-contract` — CDC-1, CDC-2, CDC-3

**Nó báo cái gì.** Ba chuyện khác nhau, ba thông báo khác nhau, không cái nào chặn cái nào. `base` —
một lớp trong tệp bộ lắng nghe không kế thừa `AbstractProjectionListener`, báo tại `node.id || node`.
`member` — thiếu một trong bốn tên `groupId`, `topics`, `deriveTargets`, `recomputeTarget`, mỗi tên
thiếu một báo cáo riêng, tất cả đặt tại tên lớp. `lifecycle` — lớp tự khai `onModuleInit`, báo tại
`member.key`.

**Nó phát hiện bằng gì.** Cổng tên tệp chạy trước: lấy `context.filename || context.getFilename()`, ép
về chuỗi bằng `String(… || "")`, đổi hết dấu gạch chéo ngược thành `/`, rồi khớp
`/projection\.listener\.ts$/` — biểu thức **không neo bên trái**, nên `a-projection.listener.ts`,
`a.projection.listener.ts` và cả `aprojection.listener.ts` đều khớp. Đúng một ngoại lệ: đường dẫn đã
chuẩn hoá `.endsWith("/abstract-projection.listener.ts")`. Không khớp thì quy tắc trả về `{}`. Trong
phạm vi, visitor duy nhất là `ClassDeclaration`, và ba phép kiểm chạy liên tiếp, **không có lệnh thoát
sớm nào ở giữa**: (a) `!node.superClass || node.superClass.name !== "AbstractProjectionListener"` báo
`base`; (b) `node.body.body` được ánh xạ qua `member.key && (member.key.name || member.key.value)` vào
một `Set`, mỗi tên trong bốn tên vắng mặt khỏi `Set` đó là một báo cáo `member`; (c) thành viên đầu
tiên có tên ánh xạ ra `onModuleInit` báo `lifecycle`.

**Nó không thấy gì.** Giá trị đứng sau một cái tên: `` protected readonly groupId = `projection-${randomUUID()}` ``
khai đủ tên rồi phát lại toàn bộ lịch sử mỗi lần khởi động, còn `protected readonly topics = []` khai
đủ tên rồi không theo dõi gì cả. Thân hàm: một `recomputeTarget` cộng thêm lượng chênh lệch mà sự kiện
mang theo thay vì dựng lại từ hàng nguồn, và một `deriveTargets` phát lệnh nghiệp vụ, gửi thông báo hay
ghi một hàng, đều không bao giờ được thăm. Mọi móc vòng đời khác cái tên chữ nguyên văn duy nhất
`onModuleInit` — `onApplicationBootstrap`, `onModuleDestroy`, một phương thức chạy theo lịch, một
phương thức đăng ký sự kiện, chính hàm dựng — đều là cửa mở dẫn thẳng tới đúng cái chỗ tách đôi ngữ
nghĩa đăng ký và ngữ nghĩa lỗi mà `CDC-1` cấm. Biểu thức lớp:
`export const OrderTotalsListener = class extends AbstractProjectionListener { … }` không bao giờ được
thăm. `import`: phép so là `node.superClass.name`, định danh đúng như viết tại lớp, nên
`import { AbstractProjectionListener as Base }` rồi `extends Base` cho ra một báo cáo sai, còn một lớp
cùng tệp đặt tên `AbstractProjectionListener` thì làm quy tắc im. Đồ thị nối dây: một bộ lắng nghe hình
dạng hoàn hảo mà không mô-đun nào khai trong providers thì không báo gì và cũng không chiếu gì.

**Ranh giới.** Quy tắc này xét các khai báo bên trong đúng một tệp. Còn projection mà mấy khai báo đó
đặt tên có đúng lúc chạy hay không là `CDC-4` đến `CDC-7`, và không quy tắc nào giữ mã nào trong số đó.

## Cách phát hiện

| Phần | Cơ chế |
|---|---|
| cổng tên tệp | `context.filename \|\| context.getFilename()`, ép chuỗi bằng `String(… \|\| "")`, đổi gạch chéo ngược thành `/`, khớp `/projection\.listener\.ts$/` — không neo bên trái |
| loại trừ | Đường dẫn đã chuẩn hoá `.endsWith("/abstract-projection.listener.ts")` |
| ngoài phạm vi | Quy tắc trả về `{}`. Nó không tồn tại với tệp đó, chứ không phải cho tệp đó qua |
| visitor | Chỉ `ClassDeclaration` — không bao giờ `ClassExpression` — và mọi lớp khai trong tệp, không riêng lớp được xuất |
| phép so lớp cha | `!node.superClass \|\| node.superClass.name !== "AbstractProjectionListener"`, báo tại `node.id \|\| node` |
| phép quét thành viên | `node.body.body` ánh xạ qua `member.key && (member.key.name \|\| member.key.value)` vào một `Set`, đối chiếu với `groupId`, `topics`, `deriveTargets`, `recomputeTarget` |
| phép kiểm vòng đời | Thành viên đầu tiên có tên ánh xạ ra `onModuleInit`, báo tại `member.key` |

Hai tính chất của cơ chế này quyết định mọi thứ phía sau.

**Nó đọc tên thành viên, không đọc loại thành viên.** Hàm ánh xạ nhận bất kỳ nút nào có `key`, nên một
phương thức, một trường của lớp, một getter, một thành viên tĩnh và một khai báo trừu tượng đều là cùng
một bằng chứng. Đây là đánh đổi ngược với một phép quét chỉ nhìn phương thức: ở đây không có gì trốn
được trong một trường của lớp.

**Nó đọc tên và không đọc gì khác.** Không giá trị, không thân hàm, không kiểu, không `import`, không
tệp thứ hai, không đồ thị mô-đun, không hệ thống tệp. Một quy tắc mà câu trả lời phụ thuộc cây làm việc
thì không ai tái lập được lúc rà soát; một quy tắc chỉ phụ thuộc đúng tệp trước mặt thì tái lập được —
và trả giá bằng từng hàng trong bảng cửa còn mở.

## Lối thoát hợp lệ

**Đã đóng** — người đọc có thể nghĩ mấy cách viết này lọt được, nhưng không.

| Viết theo cách này | Vì sao vẫn nổ |
|---|---|
| Đường dẫn gạch chéo ngược trên một bản checkout Windows | Tên tệp được chuẩn hoá về gạch chéo xuôi trước cả phép khớp lẫn phép loại trừ, nên cổng cư xử y hệt trên mọi nền tảng |
| Đổi tên từ `a.projection.listener.ts` thành `a-projection.listener.ts`, hoặc ngược lại | Biểu thức cổng không neo bên trái; nó chỉ đòi đường dẫn kết thúc bằng `projection.listener.ts`, nên dấu phân cách đứng trước không có ý nghĩa gì |
| Khai `groupId` bằng một trường của lớp thay vì một getter, hoặc ngược lại | Phép quét thành viên đọc `key.name` trên **bất kỳ** nút thành viên nào. `PropertyDefinition`, `MethodDefinition`, getter, setter và khai báo trừu tượng đều không phân biệt được với nó |
| `onModuleInit = async () => { … }` viết như một trường mũi tên thay vì một phương thức | Cùng phép quét, cùng kết quả. Một trường của lớp vô hình với quy tắc chỉ nhìn phương thức; nó không vô hình với quy tắc này |
| Khoá dạng chuỗi: `"groupId" = "orders"` hay `["topics"] = []` | Hàm ánh xạ quay về `key.value` khi không có `key.name`, nên một khoá chuỗi — tính toán hay không — vẫn ra đúng cái tên đó |
| `private`, `protected`, `override`, `async`, `readonly` trên bất kỳ thành viên nào | Không bổ từ nào được tra cứu ở bất cứ đâu trong quy tắc |
| Giấu bộ lắng nghe sau các lớp khác trong cùng tệp | Mọi `ClassDeclaration` trong một tệp khớp đều được thăm; không có suy đoán "lớp đầu tiên" hay "lớp được xuất" |
| `export default class extends AbstractProjectionListener { … }` không tên | Một xuất mặc định vô danh vẫn là `ClassDeclaration`; báo cáo lùi từ `node.id` về chính nút lớp |
| Khai đủ bốn thành viên rồi mong nó bù cho việc thiếu lớp cha | Ba phép kiểm độc lập, không thoát sớm; một lớp có thể gom `base`, bốn báo cáo `member` và `lifecycle` trong cùng một lượt |
| Kế thừa lớp cơ sở rồi thêm `onModuleInit` "chỉ để ghi một dòng nhật ký" | Phép kiểm vòng đời không quan tâm phép kiểm lớp cha có qua hay không. Sở hữu cái móc đó thôi đã là báo cáo |

**Còn mở** — chỗ mù đã ship. Một phán quyết không được nói rằng những chỗ này đã được xét.

| Cái gì lọt qua | Vì sao cơ chế không thấy |
|---|---|
| `` protected readonly groupId = `projection-${randomUUID()}` `` | Phép kiểm hỏi chữ `groupId` có xuất hiện trong thân lớp không. **Giá trị** không bao giờ được đọc. `CDC-2` sinh ra để cấm đúng một nhóm sinh theo tiến trình — thứ phát lại toàn bộ lịch sử mỗi lần khởi động — và đó đúng là cách viết quy tắc không nhìn thấy |
| `protected readonly topics = []`, hay một danh sách chủ đề dựng từ một biến rỗng | Cùng khoảng hở ở nửa còn lại của `CDC-2`. Một projection không theo chủ đề nào thì lặng lẽ cũ đi mãi mãi, mà vẫn khai đủ cái tên quy tắc đòi |
| Một consumer riêng mở từ `onApplicationBootstrap`, `onModuleDestroy`, một phương thức chạy theo lịch, một phương thức đăng ký sự kiện, hay chính hàm dựng | Phép kiểm vòng đời chỉ là một cái tên chữ nguyên văn, `onModuleInit`. Mọi móc khác mà framework cung cấp đều là cửa mở dẫn thẳng tới đúng cái chỗ tách đôi ngữ nghĩa đăng ký và ngữ nghĩa lỗi mà `CDC-1` cấm |
| `recomputeTarget` cộng thêm lượng chênh lệch mà sự kiện mang theo, thay vì dựng lại từ hàng nguồn | Thân hàm không bao giờ được thăm. Đây là `CDC-4` — giao nhận trùng thì nhân đôi, giao nhận thiếu thì không bao giờ tự lành — và quy tắc chỉ thấy một phương thức đặt đúng tên |
| `deriveTargets` phát lệnh nghiệp vụ, gửi thông báo hay ghi một hàng | Cùng khoảng hở. `CDC-3` nói bộ lắng nghe chỉ trả về danh tính; quy tắc chỉ xác nhận rằng có một thứ tên là `deriveTargets` |
| `export const OrderTotalsListener = class extends AbstractProjectionListener { … }` | Khoá thăm là `ClassDeclaration`. Một `ClassExpression` — gán vào một const, trả về từ một factory, truyền vào một hàm trợ giúp decorator — không bao giờ được thăm, nên quy tắc không tồn tại với nó |
| `order-totals.listener.ts`, `order-totals-projection.listener.tsx`, `.mts`, một lớp bộ lắng nghe khai trong `index.ts`, hay một bộ lắng nghe sống trong một tệp `*.service.ts` | Cổng tên tệp **chính là** sự tồn tại của quy tắc. Không ai đổi tên tệp để né lint; người ta đổi vì thấy đặt cạnh các tệp anh em thì đọc hợp hơn |
| `import { AbstractProjectionListener as Base }` rồi `extends Base` — và theo chiều ngược lại, một biểu thức lớp cùng tệp đặt tên `AbstractProjectionListener` mà bộ lắng nghe kế thừa | Phép so là `node.superClass.name`, định danh **đúng như cách viết tại lớp**. Không `import` nào được phân giải. Đổi tên lúc nhập cho ra một báo cáo sai; một lớp thế thân cùng tệp đặt đúng tên cho ra sự im lặng |
| Một lớp bộ lắng nghe trung gian: `class OrderTotalsListener extends AbstractOrderProjectionListener`, trong đó lớp kia mới kế thừa lớp cơ sở chung | Quy tắc đọc một tệp và so một định danh. Một họ hai tầng hoàn toàn hợp lệ sẽ bị báo `base` ở mọi lá, và cách chữa rẻ nhất — một chú thích tắt quy tắc ở đầu tệp — tắt luôn cả phép kiểm thành viên lẫn phép kiểm vòng đời trong cùng tệp |
| `constructor(protected readonly groupId: string, protected readonly topics: Array<string>) { … }` | Tham số thuộc tính không phải thành viên thân lớp. Chúng khai thành viên đó với trình biên dịch; phép quét đi qua `node.body.body` nên vẫn báo thiếu cả hai tên. Báo cáo sai dạy tác giả tắt quy tắc, và đó là cách một báo cáo đúng bị mất về sau |
| `static groupId = "orders"`, `static topics = []` | Một thành viên tĩnh thoả phép quét tên và không thoả gì lúc chạy — hợp đồng ở mức thực thể vẫn chưa được cài. Quy tắc nhận vì nó không bao giờ hỏi thành viên nó tìm thấy thuộc loại nào |
| Một bộ lắng nghe hình dạng hoàn hảo mà không mô-đun nào khai trong providers | Quy tắc đọc một tệp, không đọc đồ thị nối dây. Thứ không ai khởi tạo thì không tiêu thụ gì, không chiếu gì, và không báo gì. Dựng xanh, projection chết |
| Một bia mộ bị xử lý bằng cách bịa ra một hàng hiện tại rỗng, trong bất kỳ bộ lắng nghe nào đã đi vòng qua lớp cơ sở | `CDC-5` không có quy tắc. Lớp cơ sở chung bỏ qua một payload không có ảnh sau; một bộ lắng nghe thoát khỏi phép kiểm lớp cha qua bất kỳ hàng nào ở trên thì mang luôn hành vi đó đi |
| Một lỗi phân tích hay lỗi tính lại làm đứng consumer, và bất kỳ projection nào chưa bao giờ được chạy thử đường giao nhận qua một broker | `CDC-6` và `CDC-7` không có quy tắc nào. Cái đầu là hành vi của một khối `catch`, cái sau là tính chất của một lần chạy kiểm thử — không cái nào là một cái tên trong thân lớp |

Hai trong số này là cùng một khuyết điểm mặc hai bộ áo, nên đáng gọi tên một lần. **Quy tắc giữ khai
báo chứ không bao giờ giữ giá trị hay thân hàm**, và đó là lý do mọi mã ngữ nghĩa trong luật đều còn
mở. Và **lớp cha được so bằng cách viết tại chỗ trong đúng một tệp**, khiến quy tắc vừa báo oan một lớp
cơ sở trung gian hợp lệ vừa im trước một lớp thế thân cùng tệp. Không cái nào là phá hoại. Cả hai đều
là hình dạng của việc tái cấu trúc bình thường.

## Đầu vào

| Đầu vào | Bằng chứng cần có |
|---|---|
| tên tệp | Đường dẫn đúng như linter báo, chuẩn hoá về gạch chéo xuôi; cổng duy nhất quyết định quy tắc có tồn tại hay không |
| quyết định phạm vi | Phép kiểm tên tệp nào đã khớp, hay không cái nào khớp, hay phép loại trừ đã nổ |
| định danh lớp cha | Cái tên đúng như viết tại `extends`, không phải như nhập vào và không phải như đã phân giải |
| thành viên của lớp | `key` của mọi nút thành viên — loại, bổ từ và tính tĩnh không phải bằng chứng ở đây |
| tên thành viên | Bốn chuỗi chữ nguyên văn `groupId`, `topics`, `deriveTargets`, `recomputeTarget`, cộng thêm `onModuleInit` |

Giá trị, thân hàm, kiểu, `import`, tệp khác và đồ thị mô-đun **không** phải đầu vào. Nói điều đó ra
thành một danh sách đầu vào thay vì một dòng chú thích chính là mục đích của bản ghi này.

## Quy tắc

1. Danh tính của một quy tắc là tên nó công bố. Không đặt thêm mã số cho quy tắc.
2. Một quy tắc chỉ báo cái mà cơ chế của nó nhìn thấy được, và mô-đun này ghi đúng ranh giới đó thay vì
   ghi tham vọng của luật.
3. Không quy tắc nào đọc hệ thống tệp, phân giải `import`, hay mở tệp thứ hai. Một câu trả lời phụ
   thuộc cây làm việc thì không tái lập được.
4. Ba phép kiểm trong quy tắc độc lập: một báo cáo không bao giờ dập tắt báo cáo khác.
5. Một quy tắc chỉ ship ở mức `error` khi số đo bằng không; trên không thì ship ở `warn` kèm con số bên
   cạnh, hoặc `off` khi nó cần cấu hình mới chạy được.
6. Một mã chưa có ai giữ được ghi là chưa có ai giữ. Không bao giờ gán bừa cho quy tắc gần nhất.
7. Một báo cáo sai được ghi là nhận định, không được coi là sai số làm tròn: phản ứng với một báo cáo
   sai là một chú thích tắt quy tắc, và chú thích đó trả giá bằng mọi phép kiểm khác trong cùng tệp.

## Ngoại lệ

Mỗi miễn trừ dưới đây là cố ý và đóng.

- **Chính lớp cơ sở được miễn quy tắc của nó.** Tệp duy nhất có quyền khai `onModuleInit` và có quyền
  không kế thừa ai được loại trừ theo đường dẫn. Loại trừ là một phép
  `endsWith("/abstract-projection.listener.ts")` chính xác, nghĩa là nó phụ thuộc vào việc tệp đó giữ
  nguyên tên **và** có ít nhất một thư mục đứng trước. Nó thả `base` và `lifecycle` cho đúng đường dẫn
  ấy, không thả gì thêm.
- **Tệp không phải bộ lắng nghe thì không bị kiểm.** Cổng là tên tệp, nên hàm ánh xạ, kiểu dữ liệu và
  lớp dịch vụ nằm cạnh một bộ lắng nghe đều ở ngoài quy tắc — kể cả khi chúng chứa đúng phần logic mà
  luật thật sự nói về. Nó thả toàn bộ quy tắc cho những tệp đó.
- **Loại của thành viên không bị đòi hỏi và cũng không được miễn.** Quy tắc cố ý nhận một trường ở chỗ
  lớp cơ sở khai một thuộc tính và nhận một phương thức ở chỗ lớp cơ sở khai một phương thức, vì trong
  thực tế bốn thành viên trừu tượng kia được cài bằng cả hai cách, và một phép kiểm theo loại sẽ báo
  vào code đúng. Nó thả loại của một thành viên, không bao giờ thả tên của nó.

## Đầu ra

Một khối cho mỗi phát hiện:

```text
rule: projection-listener-contract
code: <CDC-1 | CDC-2 | CDC-3 | none>
message: <base | member | lifecycle>
mechanism: <filename gate, superclass identifier or member name>
verdict: <reports | silent>
hatch: <the way of writing that would make this silent, or "none found">
```

Một tệp sạch trong phạm vi xuất một khối với `verdict: silent` và `message: none`, kèm dòng `hatch` gọi
tên đúng cái mà sự im lặng đó không chứng minh được. Một tệp ngoài phạm vi xuất một khối với
`mechanism: filename gate`, `verdict: silent` và một dòng `hatch` nói rằng quy tắc không tồn tại với
tệp đó — ngoài phạm vi là chưa được xét, không phải sạch.

## Ví dụ đã giải

**Đầu vào.** `orders/order-totals.projection.listener.ts`:

```ts
export class OrderTotalsListener {
  private readonly consumer: Consumer

  constructor(private readonly kafka: KafkaService) {}

  async onModuleInit() {
    this.consumer = this.kafka.consumer({ groupId: `totals-${randomUUID()}` })
    await this.consumer.run({ eachMessage: (m) => this.handle(m) })
  }

  private async handle(message: EachMessagePayload) {
    // …
  }
}
```

Đường dẫn kết thúc bằng `projection.listener.ts` và không phải lớp cơ sở bị loại trừ, nên quy tắc tồn
tại ở đây. Một lớp khai, ba phép kiểm, không thoát sớm — sáu phát hiện trong một lượt.

```text
rule: projection-listener-contract
code: CDC-1
message: base
mechanism: superclass identifier
verdict: reports
hatch: none found
```

```text
rule: projection-listener-contract
code: CDC-2
message: member
mechanism: member name groupId
verdict: reports
hatch: static groupId = "orders", or a constructor parameter property, changes what is reported without changing what runs
```

Đúng khối đó lặp lại cho `topics` dưới `CDC-2`, và cho `deriveTargets` cùng `recomputeTarget` dưới
`CDC-3` — mỗi tên thiếu một báo cáo, tất cả đặt tại tên lớp.

```text
rule: projection-listener-contract
code: CDC-1
message: lifecycle
mechanism: member name onModuleInit
verdict: reports
hatch: the same subscription started from onApplicationBootstrap or the constructor is not watched at all
```

**Đã sửa.** Lớp kế thừa lớp cơ sở chung, khai đủ bốn thành viên và không sở hữu móc vòng đời nào:

```ts
export class OrderTotalsListener extends AbstractProjectionListener {
  protected readonly groupId = `order-totals-${randomUUID()}`
  protected readonly topics = ["orders.order_line"]

  protected deriveTargets(change: Change) {
    return [change.after.orderId]
  }

  protected async recomputeTarget(orderId: string) {
    await this.repo.increment({ orderId }, "total", 1)
  }
}
```

Mọi phép kiểm bây giờ đều qua, và mô-đun có nghĩa vụ nói rõ sự im lặng đó đáng giá bao nhiêu:

```text
rule: projection-listener-contract
code: none
message: none
mechanism: member name
verdict: silent
report: none
hatch: groupId is read as a name and never as a value, so a per-process group replays history on every boot; recomputeTarget's body is never visited, so an increment instead of a rebuild from source rows is CDC-4 and no rule holds CDC-4
```

Tệp đã sửa tuân thủ đúng mọi thứ mà máy giữ được, và vẫn phá `CDC-2` lẫn `CDC-4`. Sự im lặng ở đây là
ranh giới của một cái tên, không phải một tờ chứng nhận.

## Phạm vi

Mô-đun này ghi chuyện thực thi, không ghi chuyện sản phẩm. Nó không gọi tên sản phẩm nào, kho mã nào
hay thư viện thành phần nào. Tên quy tắc, mã thông báo, các mã luật và không gian tên plugin mà chúng
ship cùng là những định danh xuất hiện trong nhật ký dựng nên được chép lại nguyên văn; đó là miễn trừ
duy nhất, và nó không lan sang phần văn xuôi. Còn nhóm tiêu thụ có ổn định không, danh sách chủ đề có
đủ không, phép tính lại có dựng lại không, bia mộ có được bỏ qua không, một lỗi có được cô lập không và
đường giao nhận đã được chứng minh qua broker chưa là `CDC-2`, `CDC-4`, `CDC-5`, `CDC-6` và `CDC-7` —
do luật giữ bằng lời và không máy nào giữ cả.
