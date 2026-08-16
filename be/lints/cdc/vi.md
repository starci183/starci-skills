---
id: be-lints-cdc-vi
title: vi.md
slug: /be/lints/cdc/vi
sidebar_label: vi.md
sidebar_position: 1
description: Một quy tắc lint giữ luật CDC - bắt gì, phát hiện bằng cách nào, và cửa nào còn mở.
---

# vi.md

> Version: `2.00` · Mô-đun: `cdc`

# Một cái máy giữ hình dạng, không giữ ngữ nghĩa

Luật CDC có bảy mã, `CDC-1` đến `CDC-7`. Nguồn công bố **đúng một** quy tắc, và quy tắc đó đọc **tên**:
tên tệp, tên lớp cha, tên các thành viên mà một lớp khai báo. Hết.

Tên là thứ duy nhất về một bộ lắng nghe thay đổi dữ liệu mà một bộ phân tích cú pháp đọc **một tệp**
có thể khẳng định chắc chắn: lớp này có kế thừa lớp cơ sở chung không, có khai `groupId` không, có khai
`topics` không, có khai `deriveTargets` và `recomputeTarget` không, và có tự khai cái móc vòng đời mà
nó không được phép sở hữu không.

Còn tất cả những gì luật thật sự quan tâm ở phía sau mấy cái tên đó — nhóm tiêu thụ có ổn định qua các
lần khởi động lại không, danh sách chủ đề có đủ không, `recomputeTarget` dựng lại từ hàng nguồn hay
cộng thêm một lượng chênh lệch, bia mộ có bị bịa thành hàng rỗng không, một tin nhắn hỏng có làm đứng
cả vòng lặp không, đường giao nhận đã bao giờ được chứng minh qua một broker thật chưa — đều là **giá
trị hoặc thân hàm**, không phải tên. Quy tắc không đọc cái nào trong hai thứ đó.

Nói thẳng ra: **hình dạng của bộ lắng nghe được giữ, ngữ nghĩa của projection thì không.** Một bộ lắng
nghe hình dạng hoàn hảo với `groupId` sinh ngẫu nhiên mỗi tiến trình sẽ đi qua cổng này sạch sẽ, rồi
phát lại toàn bộ lịch sử mỗi lần khởi động. Đó không phải khuyết điểm của quy tắc; đó là ranh giới của
những gì một cái tên chứng minh được, và nó được viết ra ở đây để không ai đọc một lần dựng xanh thành
một projection đúng.

Một mã không có quy tắc thì ai cũng biết là chưa có ai giữ, nên vẫn còn được đọc bằng mắt. Một quy tắc
bị tin là kín mà thật ra hở thì tệ hơn: nó mua sự im lặng và trả bằng cảm giác đã được che.

## Bảng tra nhanh

| Quy tắc | Mã luật | Bắt gì |
|---|---|---|
| `projection-listener-contract` | `CDC-1`, `CDC-2`, `CDC-3` | Lớp trong tệp bộ lắng nghe không kế thừa `AbstractProjectionListener` (`base`); thiếu một trong bốn tên `groupId`, `topics`, `deriveTargets`, `recomputeTarget` (`member`, mỗi tên thiếu một báo cáo); tự khai `onModuleInit` (`lifecycle`) |

Một quy tắc gánh **ba mã** — chuyện này phải nói ra chứ không được làm cho tròn. Ba phép kiểm bên trong
nó độc lập, nổ độc lập, và người đọc nhật ký dựng thấy `projection-listener-contract` vẫn phải đọc
thông báo mới biết mã nào bị vi phạm.

`CDC-4`, `CDC-5`, `CDC-6` và `CDC-7` **không có quy tắc nào**, và quy tắc ở đây không nhận vơ chúng.

---

## `projection-listener-contract`

**Bắt gì.** Ba chuyện khác nhau, ba thông báo khác nhau, không cái nào chặn cái nào.

- `base` — một lớp trong tệp bộ lắng nghe không kế thừa `AbstractProjectionListener`. Lớp cơ sở đó sở
  hữu kết nối, đăng ký chủ đề, bóc phong bì thay đổi và cô lập lỗi. Một bộ lắng nghe tự cắm ống của
  riêng nó rồi sẽ bất đồng với những bộ khác về offset hoặc về bia mộ, và ngày đó không ai nhớ ra là
  vì nó không đứng chung một lớp cơ sở.
- `member` — thiếu một trong bốn tên `groupId`, `topics`, `deriveTargets`, `recomputeTarget`. Mỗi tên
  thiếu là một báo cáo riêng, tất cả đặt tại tên lớp.
- `lifecycle` — lớp tự khai `onModuleInit`. Vòng đời Kafka thuộc về lớp cơ sở; khai lại cái móc đó là
  bước đầu tiên của việc tách đôi hợp đồng giao nhận.

**Giữ mã nào.** `CDC-1` cho `base` và `lifecycle`; `CDC-2` cho hai tên `groupId` và `topics`; `CDC-3`
cho hai tên `deriveTargets` và `recomputeTarget`.

**Cách phát hiện.**

Cổng tên tệp trước tiên. Lấy `context.filename || context.getFilename()`, ép về chuỗi, đổi hết dấu gạch
chéo ngược thành gạch chéo, rồi khớp `/projection\.listener\.ts$/`. Biểu thức này **không neo bên
trái**, nên `a-projection.listener.ts`, `a.projection.listener.ts` và cả `aprojection.listener.ts` đều
khớp. Đúng một ngoại lệ: đường dẫn đã chuẩn hoá `.endsWith("/abstract-projection.listener.ts")`. Không
khớp thì quy tắc trả về `{}` — nó **không tồn tại** với tệp đó.

Khớp rồi mới thăm `ClassDeclaration`, và **chỉ** `ClassDeclaration` — không bao giờ `ClassExpression`
— với **mọi** lớp khai trong tệp, không riêng lớp được xuất. Ba phép kiểm chạy liên tiếp, **không có
lệnh thoát sớm nào ở giữa**:

1. `!node.superClass || node.superClass.name !== "AbstractProjectionListener"` → báo `base` tại
   `node.id || node`.
2. `node.body.body` được ánh xạ qua `member.key && (member.key.name || member.key.value)` vào một
   `Set`; mỗi tên trong bốn tên vắng mặt khỏi `Set` đó là một báo cáo `member` tại tên lớp.
3. Thành viên đầu tiên có tên ánh xạ ra `onModuleInit` → báo `lifecycle` tại `member.key`.

Hai tính chất của cơ chế này quyết định mọi thứ phía sau.

**Nó đọc tên thành viên, không đọc loại thành viên.** Hàm ánh xạ nhận bất kỳ nút nào có `key`, nên một
phương thức, một trường của lớp, một getter, một thành viên tĩnh và một khai báo trừu tượng đều là
cùng một bằng chứng. Đây là đánh đổi ngược với một phép quét chỉ nhìn phương thức: ở đây **không có gì
trốn được trong một trường của lớp**.

**Nó đọc tên và không đọc gì khác.** Không giá trị, không thân hàm, không kiểu, không `import`, không
tệp thứ hai, không đồ thị mô-đun, không hệ thống tệp. Một quy tắc mà câu trả lời phụ thuộc cây làm
việc thì không ai tái lập được lúc rà soát; một quy tắc chỉ phụ thuộc đúng tệp trước mặt thì tái lập
được — và trả giá bằng từng hàng trong bảng cửa còn mở.

**Vì sao luật này đáng có máy giữ.**

Vì đây đúng là loại sai lầm mà con người không nhìn ra và trình biên dịch cũng không.

Hãy tách hai trường hợp. Khi một lớp **có** kế thừa lớp cơ sở, bốn thành viên kia là thành viên trừu
tượng — trình biên dịch đã đòi rồi, và phép kiểm `member` ở đây gần như chỉ nói lại. Nhưng khi một lớp
**không** kế thừa lớp cơ sở, trình biên dịch không nói gì cả: một lớp tự cắm `KafkaService`, tự gọi
`consumer.run` trong `onModuleInit`, tự bắt lỗi theo cách riêng — nó biên dịch sạch, chạy được, và
trông hoàn toàn hợp lý khi đọc một mình. Nó chỉ sai khi đặt cạnh mười bộ lắng nghe khác, và không ai
đọc mười tệp cùng lúc.

Đó là lý do phép kiểm `base` là phép kiểm đáng giá nhất trong quy tắc: nó bắt đúng cái sai **vô hình
tại điểm gọi và đắt về sau**. Ngày nào đó lớp cơ sở nhận thêm một mối quan tâm cắt ngang — bỏ qua bia
mộ, một phép đo thời gian, một lần thử lại, một cách ghi nhật ký lỗi có `topic` và `groupId` — và đúng
những tệp không kế thừa nó là những tệp duy nhất không nhận được. Không có gì đỏ lên. Không có gì để
tìm.

Còn `lifecycle` là cùng một chuyện nhìn từ phía kia: một lớp **có** kế thừa lớp cơ sở nhưng vẫn khai
`onModuleInit` sẽ **che** cái móc của lớp cơ sở, và lớp cơ sở im lặng ngừng đăng ký. Kết quả là một
projection không bao giờ cập nhật, không có ngoại lệ nào ném ra, không có dòng nhật ký nào lạ.

**Cửa còn mở.**

- **`groupId` là tên, không phải giá trị.** `protected readonly groupId = \`projection-${randomUUID()}\``
  đi qua sạch. Phép kiểm hỏi chữ `groupId` có xuất hiện trong thân lớp không; giá trị **không bao giờ**
  được đọc. `CDC-2` sinh ra để cấm đúng một nhóm sinh theo tiến trình — thứ phát lại toàn bộ lịch sử
  mỗi lần khởi động — và đó đúng là cách viết quy tắc không nhìn thấy.
- **`topics` cũng vậy.** `protected readonly topics = []` khai đủ tên. Một projection không theo dõi
  chủ đề nào thì lặng lẽ cũ đi mãi mãi, và quy tắc im.
- **Chỉ đúng một cái tên móc vòng đời bị canh.** `onApplicationBootstrap`, `onModuleDestroy`, một
  phương thức chạy theo lịch, một phương thức đăng ký sự kiện, hay chính hàm dựng — tất cả đều mở được
  một consumer riêng mà quy tắc không thấy gì. `CDC-1` thoát qua bất kỳ cái móc nào khác.
- **Thân `recomputeTarget` không bao giờ được thăm.** Cộng thêm lượng chênh lệch mà sự kiện mang theo,
  thay vì dựng lại từ hàng nguồn, là vi phạm `CDC-4` — giao nhận trùng thì nhân đôi, giao nhận thiếu
  thì không bao giờ tự lành — và quy tắc chỉ thấy một phương thức đặt đúng tên.
- **Thân `deriveTargets` cũng không.** `CDC-3` nói bộ lắng nghe chỉ trả về danh tính; một `deriveTargets`
  phát lệnh nghiệp vụ, gửi thông báo hay ghi một hàng vẫn đi qua.
- **Biểu thức lớp không được thăm.** `export const Listener = class extends AbstractProjectionListener {}`
  là `ClassExpression`. Khoá thăm là `ClassDeclaration`, nên quy tắc **không tồn tại** với cách viết đó.
- **Đổi tên tệp là quy tắc biến mất.** `a.listener.ts`, `a-projection.listener.tsx`, `.mts`, một bộ
  lắng nghe khai trong tệp gom, hay một lớp bộ lắng nghe sống trong một tệp `*.service.ts` — cổng tên
  tệp **chính là** sự tồn tại của quy tắc. Không ai đổi tên tệp để né lint; người ta đổi vì thấy đặt
  cạnh các tệp anh em thì đọc hợp hơn.
- **Lớp cha được so bằng cách viết tại chỗ.** `import { AbstractProjectionListener as Base }` rồi
  `extends Base` cho ra một **báo cáo sai**; ngược lại, một lớp cùng tệp viết dưới dạng biểu thức và
  đặt tên `AbstractProjectionListener` làm quy tắc **im**. Không có `import` nào được phân giải.
- **Lớp cơ sở trung gian bị báo oan.** `class OrderTotalsListener extends AbstractOrderProjectionListener`,
  trong đó lớp trung gian kia mới kế thừa lớp cơ sở chung, vẫn bị báo `base`. Quy tắc đọc một tệp và so
  một định danh. Cách chữa rẻ nhất là một chú thích tắt quy tắc ở đầu tệp — và chú thích đó tắt luôn cả
  phép kiểm thành viên lẫn phép kiểm vòng đời trong cùng tệp.
- **Tham số thuộc tính của hàm dựng không phải thành viên thân lớp.**
  `constructor(protected readonly groupId: string)` khai thành viên đó với trình biên dịch, nhưng phép
  quét đi qua `node.body.body` nên vẫn báo thiếu. Lại một báo cáo sai, lại một chú thích tắt quy tắc,
  lại mất những phép kiểm đúng trong cùng tệp về sau.
- **Thành viên tĩnh được chấp nhận.** `static groupId = "orders"` thoả phép quét tên và không thoả gì
  lúc chạy — hợp đồng ở mức thực thể vẫn chưa được cài. Quy tắc nhận vì nó không bao giờ hỏi thành viên
  nó tìm thấy thuộc loại nào.
- **Một bộ lắng nghe không được đăng ký ở đâu cả vẫn qua.** Quy tắc đọc một tệp, không đọc đồ thị nối
  dây. Thứ không ai khởi tạo thì không tiêu thụ gì, không chiếu gì, và không báo gì. Dựng xanh,
  projection chết.
- **`CDC-5`, `CDC-6`, `CDC-7` không có quy tắc nào.** Bia mộ, cô lập một tin nhắn hỏng, và chứng minh
  đường giao nhận qua broker thật — cái đầu là hành vi của lớp cơ sở, cái thứ hai là hành vi của một
  khối `catch`, cái thứ ba là tính chất của một lần chạy kiểm thử. Không cái nào là một cái tên trong
  thân lớp.

---

## Luật

1. Danh tính của một quy tắc là **tên nó công bố**. Không đặt thêm mã số cho quy tắc; tên đó đã là
   chuỗi in ra trong nhật ký dựng, viết trong chú thích tắt quy tắc, và gọi trong mọi cuộc trao đổi.
2. Tài liệu này chỉ ghi những quy tắc **có thật** trong nguồn. Một quy tắc đáng có mà chưa có thì thuộc
   về `audit.md`, không thuộc về đây.
3. Một mã luật không có quy tắc được ghi là **chưa có ai giữ**, không được gán bừa cho quy tắc gần nhất.
4. Quy tắc không đọc hệ thống tệp, không phân giải `import`, không mở tệp thứ hai.
5. Ba phép kiểm trong quy tắc độc lập: một báo cáo không bao giờ dập tắt báo cáo khác.
6. Một quy tắc chỉ lên `error` khi số đo bằng không.
7. Một **báo cáo sai** được ghi là nhận định, không được coi là sai số làm tròn: phản ứng với một báo
   cáo sai là một chú thích tắt quy tắc, và chú thích đó trả giá bằng mọi phép kiểm khác trong cùng tệp.

## Ngoại lệ

Mỗi miễn trừ dưới đây là cố ý và đóng.

- **Chính lớp cơ sở được miễn quy tắc của nó.** Tệp duy nhất có quyền khai `onModuleInit` và có quyền
  không kế thừa ai được loại trừ theo đường dẫn. Loại trừ là một phép `endsWith("/abstract-projection.listener.ts")`
  chính xác, nghĩa là nó phụ thuộc vào việc tệp đó giữ nguyên tên **và** có ít nhất một thư mục đứng
  trước.
- **Tệp không phải bộ lắng nghe thì không bị kiểm.** Cổng là tên tệp, nên hàm ánh xạ, kiểu dữ liệu và
  lớp dịch vụ nằm cạnh một bộ lắng nghe đều ở ngoài quy tắc — kể cả khi chúng chứa đúng phần logic mà
  luật thật sự nói về.
- **Loại của thành viên không bị đòi hỏi và cũng không được miễn.** Quy tắc cố ý nhận một trường ở chỗ
  lớp cơ sở khai một thuộc tính và nhận một phương thức ở chỗ lớp cơ sở khai một phương thức, vì trong
  thực tế bốn thành viên trừu tượng kia được cài bằng cả hai cách, và một phép kiểm theo loại sẽ báo
  vào code đúng.
