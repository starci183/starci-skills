---
title: Event-delivery · Vietnamese
---

# Chuyển phát sự kiện

Đầu vào là mã đã viết xong — một tệp, một mẩu diff. Đầu ra là một **phán quyết**: tệp có nằm trong
phạm vi hay không, luật máy nào đã nổ, nó phát thông điệp nào và trên nút nào, thông điệp ấy giữ mã
luật nào, và cửa còn mở nào lẽ ra đã che đúng cái hỏng ấy. Mô-đun này không chọn gì cả. Nó từ chối, và
nó phải chỉ được tay vào những vị trí ký tự mà nó lấy làm căn cứ.

## Luật

Điều luật ở đây quyết đúng một câu hỏi về một dữ kiện đi qua giữa các bản chạy của ứng dụng: **cùng
một phong bì có được phép quay về chính nơi sinh ra nó, hay tới hai lần, mà hậu quả cục bộ không xảy
ra hai lần hay không?** Cây cầu phải bỏ phong bì tự vọng về và phải nhận dấu vân tay chuyển phát
**trước** khi trao bất cứ thứ gì cho bộ phát sự kiện trong tiến trình.

Luật nêu sáu mã. **Có đúng một luật máy, và nó gánh hai mã trong số đó.** Tệp nguồn công bố đúng một
mục ở `rules` và đúng một mục ở `recommended`, hai chỗ khớp nhau; con số dự kiến là một, và thực tế
đúng một. Luật máy duy nhất ấy mang hai định danh thông điệp, nên giữ hai mã cùng lúc. Bốn mã còn lại
không được gì ở đây giữ cả.

Điều đáng nói ngay từ đầu là **luật máy này không đọc cây cú pháp.** Nó chặn ở đúng một đường dẫn tệp,
rồi so ba vị trí ký tự bên trong văn bản thô của tệp. Không gì được phân tích, không gì được giải, và
không nút nào được xem xét ngoài nút `Program` mà nó báo lên. Lựa chọn ấy làm luật máy rẻ và hoàn toàn
sống sót qua mọi lần tái cấu trúc phần ruột của tệp — và cũng chính là nguồn gốc của mọi cửa còn mở
bên dưới, vì văn bản không phân biệt được một câu chặn với một dòng chú thích nói về câu chặn.

## Luật máy đã xuất bản

| Tên luật máy | Mã luật | Bắt gì |
|---|---|---|
| `nats-bridge-delivery-contract` | `DELIVERY-3` (thông điệp `origin`) và `DELIVERY-4` (thông điệp `digest`) | `origin` khi phép so danh tính nơi sinh không có, hoặc nằm sau lời gọi phát sự kiện đầu tiên tính theo vị trí ký tự trong văn bản tệp; `digest` khi chuỗi `parsed.digest` không có, hoặc nằm sau lời gọi ấy. Cả hai đều báo lên nút `Program` |

Một luật máy gánh hai mã không phải là lỗi, nhưng là dữ kiện người đọc phải mang theo: nhật ký dựng in
ra **tên luật**, mà tên ấy là cùng một chuỗi cho cả trường hợp thiếu câu chặn tự vọng lẫn trường hợp
thiếu phép nhận dấu vân tay. Chỉ câu thông điệp mới tách chúng ra.

`DELIVERY-1` (mọi phong bì mang danh tính nơi sinh và dấu vân tay), `DELIVERY-2` (`useLocal` và
`useNats` khai theo từng sự kiện), `DELIVERY-5` (bên nhận khẳng định người nhận và nội dung, không
phải số bộ lắng nghe) và `DELIVERY-6` (hành vi xuyên bản chạy được chứng minh bằng hai bản chạy thật)
**không có luật máy nào** trong tệp nguồn này. Bốn trên sáu mã là **chưa được giữ**, chứ không phải đã
được phủ, và một lần chạy xanh không nói gì về chúng cả.

## Đọc một diff

1. **Quyết phạm vi trước mọi thứ khác, và ghi lại.** Nằm ngoài phạm vi ở đây không có nghĩa là tệp đã
   qua — nghĩa là một bộ thăm rỗng đã được cài và luật máy không tồn tại đối với tệp ấy. Trạng thái đó
   vô hình trong nhật ký dựng.
2. **Luật máy đòi đúng hậu tố đường dẫn `/event/nats/nats-bridge.service.ts`**, sau khi `\` được đổi
   thành `/`. Tên khác, thư mục khác, cây cầu thứ hai: không kiểm gì cả.
3. **Đọc phần miễn trừ ngay sau đó.** Không có làn kiểm thử: một bản dữ liệu mẫu, một bản sao lưu hay
   một bản dựng ra ở cùng hậu tố bị kiểm y như mã sản phẩm; đặt ở đường dẫn khác thì không bị kiểm.
4. **Đọc ba vị trí ký tự, không đọc logic** — `originIndex`, `digestIndex`, `emitIndex`, lấy từ toàn
   bộ tệp gộp thành một chuỗi. Không bao giờ báo theo thứ tự lúc chạy; luật máy chỉ biết thứ tự trên
   trang.
5. **Mỗi phát hiện một khối.** Hai thông điệp được tính độc lập nên có thể cùng nổ trên một tệp.
6. **Viết dòng `hatch` mỗi khi một cửa còn mở lẽ ra đã che đúng cái hỏng ấy**, và ghi ở dòng `evidence`
   rằng một câu lệnh sống, một chú thích, một chuỗi ký tự và mã chết là không phân biệt được ở đây.
7. **Không báo cái mà không luật máy nào canh.** Bốn trong sáu mã không có máy nào; một phán quyết nói
   khác đi là nói sai về mô-đun.

## `nats-bridge-delivery-contract` — DELIVERY-3 và DELIVERY-4

**Nó báo cái gì.** Hai việc, hai thông điệp riêng, tính độc lập nên có thể cùng nổ một lúc. `origin` —
không tìm thấy phép so danh tính nơi sinh, hoặc tìm thấy nhưng nó nằm **sau** lời gọi phát sự kiện đầu
tiên trong văn bản tệp. `digest` — không tìm thấy chuỗi `parsed.digest`, hoặc tìm thấy nhưng nó nằm
sau lời gọi ấy. Cả hai đều báo lên nút `Program`, tức là lên đầu tệp, nên một lần hỏng chỉ tay vào đầu
tệp chứ không bao giờ vào lời gọi phát sự kiện có lỗi.

**Nó phát hiện bằng gì.** Cổng tên tệp trước. Lấy `context.filename`, rỗng thì lấy
`context.getFilename()`, đổi hết `\` thành `/`, rồi đòi chuỗi kết quả thoả
`endsWith("/event/nats/nats-bridge.service.ts")`. Không khớp thì trả về **bộ thăm rỗng**, nên tệp
không bị kiểm một phần mà là không bị kiểm gì cả. Khớp thì đăng ký đúng một bộ thăm, `Program:exit`,
và bên trong lấy `sourceCode.getText()` — **toàn bộ tệp gộp thành một chuỗi** — rồi tính ba vị trí:
`originIndex = text.search(/parsed\.id\s*===\s*this\.instanceService\.getId\(\)/)`,
`digestIndex = text.indexOf("parsed.digest")`, `emitIndex = text.indexOf("this.eventEmitter.emit")`.
Báo `origin` khi `originIndex < 0 || emitIndex < 0 || originIndex > emitIndex`, và báo `digest` khi
`digestIndex < 0 || emitIndex < 0 || digestIndex > emitIndex`.

**Nó không thấy gì.** Không thấy được rằng phép so đã khớp có thật sự **bỏ qua** gì không: luật máy
chứng minh phép so tồn tại, không bao giờ chứng minh nó chặn, nên
`if (parsed.id === this.instanceService.getId()) { }` không `continue`, không `return` thì cổng im
lặng trong khi mọi bản vọng về chính mình đều được phát. Không thấy được rằng một chú thích, một chuỗi
ký tự, một khối đã tắt hay một phương thức riêng đã chết cũng thoả hai chuỗi ấy vĩnh viễn, vì các vị
trí được lấy từ văn bản thô và không mang theo xuất xứ. Không thấy một lần đọc dấu vân tay mà không có
lần ghi tương ứng — `await this.cacheService.get({ key, args: [parsed.digest] })` vẫn qua, mà đó đúng
là cuộc đua `DELIVERY-4` sinh ra để đóng. Không thấy mọi lời gọi phát sự kiện từ lần thứ hai trở đi,
vì `indexOf` dừng ở lần xuất hiện đầu tiên. Không thấy thứ tự lúc chạy, vì vị trí ký tự không phải thứ
tự thực thi: một câu chặn đúng nằm trong hàm phụ trợ viết dưới phần xử lý thì bị báo, còn một câu chặn
sai viết ở trên thì được duyệt. Không thấy khác biệt giữa `parsed.digest` và một định danh dài hơn
cùng tiền tố — `parsed.digestedAt`, `parsed.digestion` — hay chuỗi `"parsed.digest"` trong một dòng
ghi nhật ký, vì `indexOf` là tìm chuỗi con, không ranh giới từ, không kiểu nút. Không thấy rằng
`parsed` có thật là phong bì hay không: `const parsed = { id: "x", digest: "y" }` qua sạch, vì không
lệnh nhập nào được giải, không kiểu nào được đọc, và không gì xác nhận `getId()` trả về danh tính bản
chạy chứ không phải tên chủ đề. Không thấy phần phát sự kiện thật đã dời sang tệp cộng tác —
`this.localFanOut.publish(...)` ở tệp khác — trong khi một lời gọi đủ thoả chuỗi vẫn nằm lại. Không
thấy tệp nào tên khác, cây cầu thứ hai nào, ứng dụng thứ hai nào. Và không thấy gì trong một lần chạy
không có tên tệp: `normalizePath(undefined)` trả về `""`, mà `""` trượt phép kiểm hậu tố.

**Ranh giới.** Luật máy này xét **những chuỗi ký tự theo một thứ tự** bên trong một tệp. Còn hậu quả
có thật sự xảy ra hai lần hay không — đúng cái mà điều luật nói tới — thì không gì trong mô-đun này
xét cả.

## Cách phát hiện

| Bộ phận | Cơ chế |
|---|---|
| cổng tên tệp | `context.filename`, rỗng thì `context.getFilename()`, `\` đổi thành `/`, rồi `endsWith("/event/nats/nats-bridge.service.ts")`. Không khớp thì trả về bộ thăm rỗng |
| bộ duyệt | Đúng một bộ thăm, `Program:exit`. Không nút con nào được thăm và không thuộc tính nào của `Program` được xem; nó chỉ là chỗ neo báo lỗi |
| bộ đọc | `sourceCode.getText()`, rỗng thì `context.getSourceCode()` — toàn bộ tệp gộp thành một chuỗi, dùng cho cả ba vị trí |
| vị trí origin | `text.search(/parsed\.id\s*===\s*this\.instanceService\.getId\(\)/)` — một cách viết cố định của ba định danh, đóng cứng tên biến cục bộ `parsed`, đường dẫn thành viên `this.instanceService.getId()`, toán tử `===` và thứ tự hai vế. `\s*` nuốt khoảng trắng và xuống dòng quanh toán tử; ngoài ra không gì co giãn |
| vị trí digest | `text.indexOf("parsed.digest")` — tìm chuỗi con trần, không ranh giới từ, không kiểu nút |
| vị trí emit | `text.indexOf("this.eventEmitter.emit")` — chỉ lần xuất hiện **đầu tiên**. Mọi lời gọi phát sự kiện phía sau trong cùng tệp không được so với gì cả |
| với ra ngoài tệp | Không có. Không lệnh nhập nào được giải, không kiểu nào được đọc, không tệp thứ hai nào được mở, không cấu hình và không danh sách sự kiện được phép |

"Trước" ở đây là trước trong văn bản, không phải trước lúc chạy. Phương thức trong lớp được nâng lên,
hàm phụ trợ gọi từ đâu cũng được, nên chỗ một câu lệnh **nằm** và lúc nó **chạy** là hai dữ kiện độc
lập, và luật máy chỉ biết dữ kiện thứ nhất. Luật máy khai `schema: []` nên không có tuỳ chọn, và không
khai `fixable`, không khai `hasSuggestions`, nên không có bản vá.

## Lối thoát hợp lệ

**Đóng** — người đọc có thể tưởng những cách viết này lọt, nhưng chúng không lọt.

| Cách viết | Vì sao nó không lọt |
|---|---|
| `if (parsed.id !== this.instanceService.getId()) continue` — cách viết đảo ngược, bỏ hết mọi thứ **trừ** bản tự vọng về | Biểu thức chính quy đòi `===`. `!==` không khớp, `originIndex` bằng `-1`, và `origin` nổ. Cách sai tai hại nhất vẫn bị bắt, dù chỉ bắt dưới dạng "không có câu chặn nào" |
| Dời một câu chặn đúng xuống dưới lời gọi phát sự kiện | Thứ tự là một nửa phép kiểm. `originIndex > emitIndex` báo to đúng bằng lúc không có câu chặn |
| Ghi dấu vân tay sau khi đã trao sự kiện cho bộ phát | Cùng hình dạng ấy ở thông điệp kia. `digestIndex > emitIndex` báo `digest` |
| Xoá lời gọi phát sự kiện cho luật im | `emitIndex < 0` làm **cả hai** điều kiện đúng, nên bỏ phần phát ra lại thành hai báo thay vì không báo nào |
| Đặt bí danh cho bộ phát — `const bus = this.eventEmitter` rồi `bus.emit(...)` | Chuỗi emit biến mất, `emitIndex` bằng `-1`, và cả hai thông điệp nổ. Đổi tên không mua được sự im lặng |
| Nâng danh tính bản chạy thành một biến cục bộ — `const selfId = this.instanceService.getId()` rồi `if (parsed.id === selfId)` | Biểu thức chính quy không còn khớp và `origin` nổ. Đây là chiều ngược của cửa rửa-hằng-số thường gặp: gom một giá trị vào hằng số làm luật máy này **to hơn**, không bao giờ nhỏ đi |
| Định dạng lại — thêm xuống dòng hay khoảng trắng quanh `===` | `\s*` ở cả hai bên nuốt hết, nên một lần chạy trình định dạng không tắt được phép kiểm |
| Đường dẫn kiểu Windows với dấu gạch ngược | Mọi dấu phân cách được chuẩn hoá trước phép kiểm hậu tố, nên cổng xử sự y hệt trên mọi nền |
| Một bản sao của cây cầu nằm trong thư mục dữ liệu mẫu, bản sao lưu hay thư mục dựng ra, nếu đường dẫn vẫn kết thúc bằng đúng ba đoạn ấy | Cổng là phép khớp hậu tố trần, không có khoảng trừ cho làn kiểm thử hay cho mã dựng ra. Bản sao cùng hình dạng bị kiểm y như bản gốc |
| Truyền một tuỳ chọn để nới phép kiểm | `schema: []`. Không có gì để truyền. Cách nới duy nhất là một dòng tắt luật, mà dòng tắt luật thì nhìn thấy được trong tệp |

**Mở** — phần mù đã xuất xưởng. Một phán quyết không được nói rằng những chỗ này đã được xét.

| Cách viết | Vì sao luật máy không bắt được |
|---|---|
| `if (parsed.id === this.instanceService.getId()) { /* nothing */ }` — phép so không `continue`, không `return` | Luật máy chứng minh phép so **tồn tại**. Nó không bao giờ chứng minh phép so **bỏ qua**. Mọi bản vọng về chính mình đều được phát, văn bản vẫn khớp, và cổng im. Đây là cửa nặng nhất mô-đun |
| `// legacy path: parsed.id === this.instanceService.getId()` trong một dòng chú thích gần đầu tệp | Các vị trí lấy từ văn bản thô. Một chú thích, một khối đã tắt, một chuỗi ký tự hay một phương thức riêng đã chết thoả phép kiểm origin vĩnh viễn, còn phần xử lý sống thì có thể không làm gì cả |
| `await this.cacheService.get({ key, args: [parsed.digest] })` mà không có lần ghi tương ứng | Phép kiểm dấu vân tay chỉ đòi chuỗi ấy xuất hiện trước lời gọi phát. Đọc mà không nhận đúng là cuộc đua `DELIVERY-4` sinh ra để đóng: hai bản sao cùng trượt bộ nhớ đệm, cùng phát, mà luật máy báo sạch |
| Một lời gọi phát sự kiện thứ hai ở phía dưới — đường thử lại, vòng đăng ký thứ hai, một sự kiện vòng đời | `emitIndex` chỉ là lần xuất hiện **đầu tiên**. Chặn kỹ lời gọi thứ nhất là mọi lời gọi sau đó không được đo, mãi mãi |
| Một câu chặn nằm trong hàm phụ trợ viết **dưới** phần xử lý, hoặc một phần xử lý viết trên một câu chặn chạy trước nó | Vị trí ký tự không phải thứ tự thực thi. Luật máy xét chỗ mã nằm trên trang. Điều này cắt cả hai chiều: nó từ chối mã đúng và nó duyệt mã sai |
| Đổi tên tệp thành `nats-bridge.ts`, dời sang `event/bridge/`, hay tách phần xử lý ra `nats-bridge.consumer.ts` | Cổng là đúng một hậu tố ba đoạn. Tên tệp là thứ rẻ nhất trong một kho mã để đổi, mà trong nhật ký dựng thì bộ thăm rỗng trông y hệt một tệp sạch |
| Một cây cầu thứ hai: `event/nats/nats-bridge-v2.service.ts`, `event/kafka/kafka-bridge.service.ts`, hay chính tệp ấy trong một ứng dụng thứ hai | Luật quản mọi cây cầu xuyên bản chạy. Cổng gọi tên đúng một đường dẫn. Không gì khác trong cây được nhìn tới, bao giờ cũng vậy |
| Dời phần phát sự kiện thật sang tệp cộng tác — `this.localFanOut.publish(...)` ở tệp khác — trong khi một lời gọi đủ thoả chuỗi vẫn nằm lại trong tệp cầu | Luật máy chỉ đọc một tệp và không giải lệnh nhập nào. Những chuỗi nó cần vẫn còn và vẫn đúng thứ tự; lời gọi phát không được chặn giờ nằm ngoài tầm với |
| `parsed.digestedAt`, `parsed.digestion`, hay chuỗi `"parsed.digest"` trong một dòng ghi nhật ký | `indexOf` là tìm chuỗi con, không ranh giới từ, không kiểu nút. Mọi định danh dài hơn cùng tiền tố ấy, và mọi lần nhắc trong dấu nháy, đều thoả `DELIVERY-4` |
| `const parsed = { id: "x", digest: "y" }` — một mẩu giả không phải phong bì | Không lệnh nhập nào được giải và không kiểu nào được đọc. Không gì xác nhận `parsed` là phong bì đã giải, `this.instanceService` là dịch vụ danh tính bản chạy, hay `getId()` trả về danh tính bản chạy chứ không phải tên chủ đề |
| Một lần chạy không đưa tên tệp cho luật máy, hoặc một tên tệp không có `/` trước `event` | Cổng cần dấu gạch dẫn đầu và một tên không rỗng; `normalizePath(undefined)` là `""`, mà `""` trượt phép kiểm hậu tố. Hẹp, nhưng đó là phụ thuộc vào cách bộ chạy đặt tên tệp chứ không phải vào chỗ tệp nằm |
| `// eslint-disable-next-line starci-be/nats-bridge-delivery-contract` | Luật máy không phải loại không tắt được. Mọi dòng đóng ở bảng trên cũng mở lại được bằng một dòng, bởi một người đang vội |
| toàn bộ phần còn lại của luật | **`DELIVERY-1`, `DELIVERY-2`, `DELIVERY-5` và `DELIVERY-6`** — một phong bì không mang danh tính nơi sinh và dấu vân tay, một sự kiện không khai `useLocal`/`useNats`, một bên nhận khẳng định số bộ lắng nghe thay vì người nhận và nội dung, hành vi xuyên bản chạy chưa bao giờ được chứng minh bằng hai bản chạy thật |

Mười hai dòng cách viết còn mở, và mười một trong số đó cùng một hình dạng: luật máy nhìn thấy **những
chuỗi ký tự theo một thứ tự**, còn luật nói về **một hậu quả không được xảy ra hai lần**. Viết được
chuỗi mà không chặn được hậu quả, và chặn được hậu quả mà không viết đúng chuỗi, đều là chuyện thường
ngày.

## Đầu vào

| Đầu vào | Bằng chứng phải có |
|---|---|
| `context.filename` | Đường dẫn đúng như luật máy nhìn thấy, dấu gạch ngược đã đổi thành `/`, rồi khớp hậu tố với `/event/nats/nats-bridge.service.ts`. Rỗng thì lấy `context.getFilename()` |
| quyết định cổng | Hậu tố có khớp không, hay một bộ thăm rỗng đã được trả về |
| `sourceCode.getText()` | Toàn văn tệp, gộp thành một chuỗi, dùng cho cả ba vị trí. Rỗng thì lấy `context.getSourceCode()` |
| `originIndex` | Vị trí biểu thức chính quy khớp, hoặc không có |
| `digestIndex` | Vị trí chuỗi con `parsed.digest`, hoặc không có |
| `emitIndex` | Vị trí lời gọi `this.eventEmitter.emit` ĐẦU TIÊN, hoặc không có |
| xuất xứ | Mỗi chuỗi khớp là câu lệnh sống, chú thích, chuỗi ký tự hay mã chết — và dữ kiện rằng luật máy không phân biệt được |
| nút `Program` | Chỉ dùng làm **chỗ neo báo lỗi**. Không thuộc tính nào của nó được xem xét |

Ngoài ra không gì được đọc. Không nút con, không thông tin kiểu, không đồ thị lệnh nhập, không tệp thứ
hai, không cấu hình, không danh sách sự kiện được phép.

## Quy tắc

1. Danh tính của một luật máy là **tên đã công bố** của nó. Không có định danh bằng số cho luật máy;
   tên là thứ nhật ký dựng in ra, thứ một dòng tắt luật mang theo, và thứ mọi cuộc trao đổi về một lần
   hỏng dùng tới.
2. Luật máy này giữ hai mã của luật, tách nhau bằng định danh thông điệp và bằng không gì khác.
3. Luật máy đọc **đúng một tệp**. Mọi tệp khác trong kho mã đều nằm ngoài, và nằm ngoài một cách im
   lặng.
4. Cổng tên tệp trả về **bộ thăm rỗng**, nên một tệp bị chặn không bị kiểm một phần — nó không bị kiểm
   gì cả, và trạng thái ấy vô hình trong nhật ký dựng.
5. Hai thông điệp được tính độc lập và có thể cùng nổ trên một tệp.
6. Cả hai báo đều rơi lên `Program`, nên một lần hỏng chỉ tay vào đầu tệp chứ không bao giờ vào lời gọi
   phát sự kiện có lỗi.
7. Luật máy không có tuỳ chọn: `schema: []`. Muốn nới thì chỉ còn cách tắt hẳn, và tắt hẳn thì nhìn
   thấy được.
8. Luật máy không có bộ tự sửa. Câu thông điệp là chữ, không phải bản vá.
9. `meta.type` là `"problem"` và `recommended` đặt luật máy ở mức `error`.
10. Mọi cửa còn mở ở trên là cửa của **luật máy**, không bao giờ là phép của **luật**. Mã lọt qua vẫn
    là mã sai.

## Ngoại lệ

Mọi ngoại lệ ở đây đều viết vào trong luật máy, không phải ban bên cạnh nó.

- **Mọi tệp trừ một tệp đều được miễn.** Cổng chỉ nhận đúng một hậu tố đường dẫn. Đây không phải một
  khoảng trừ dành cho mã kiểm thử hay mã sinh tự động; đây là **toàn bộ phạm vi** của luật máy, và nó
  có nghĩa là mô-đun đang giữ một luật về một loại hành vi bằng cách khẳng định nội dung của đúng một
  tệp. Nó thả mọi cây cầu khác, trong ứng dụng này và trong bất kỳ ứng dụng nào khác, khỏi `DELIVERY-3`
  và `DELIVERY-4`.
- **Không có làn kiểm thử.** Một bản sao trong thư mục dữ liệu mẫu, một bản sao lưu hay một bản chép
  vào cây, nếu đường dẫn vẫn kết thúc bằng ba đoạn ấy, bị kiểm y như mã sản phẩm. Đặt ở đường dẫn khác
  thì không.
- **Thiếu hẳn lời gọi phát sự kiện bị coi là vi phạm, không phải được miễn.** Một tệp không phát gì cả
  nhận **cả hai** thông điệp, mà câu chữ của chúng lại nói về thứ tự. Khoảng lệch giữa nguyên nhân và
  câu thông điệp là một nhận định về phần máy giữ, không phải một phép cho mã.
- **Không gì phân biệt một lần dùng với một lần nhắc.** Một chú thích, một chuỗi ký tự và một nhánh
  chết được nhận làm bằng chứng do bỏ sót chứ không do thiết kế; luật máy không có cách nào tách chúng
  ra. Chỗ này thả mọi tệp mà hai chuỗi của nó chỉ là lần nhắc.
- **Cách viết hai vế đảo chiều** — `this.instanceService.getId() === parsed.id` — không phải ngoại lệ:
  nó **bị báo**, dù nó đúng nghĩa hệt nhau. Ghi ở đây vì đây là báo thừa mà người đọc hay gặp nhất, và
  cách chữa đúng là sửa biểu thức chính quy chứ không phải viết lại đoạn mã đang đúng.

## Đầu ra

Mỗi phát hiện một khối:

```text
rule:     nats-bridge-delivery-contract
code:     <DELIVERY-3 | DELIVERY-4>
file:     <path as the rule normalized it>
gate:     <matched | empty visitor: file is not checked>
origin:   <offset | absent>
digest:   <offset | absent>
emit:     <offset of the FIRST emitter call | absent>
evidence: <live statement | comment | string | dead code | unknown — the rule cannot tell>
message:  <origin | digest>
verdict:  <fires | silent: hatch <name from the Open table>>
```

Một tệp sạch phát ra một khối với `gate: matched`, cả ba vị trí đều có và đúng thứ tự, `message` không
gọi tên thông điệp nào, và `verdict: silent` kèm cửa còn mở vẫn có thể đang che cái hỏng. Một tệp nằm
ngoài phạm vi phát ra một khối với `gate: empty visitor: file is not checked`, cả ba vị trí đều không
có, và `verdict: silent: hatch renaming or moving the file`. Nó chưa qua.

Dòng `evidence` không phải trang trí. Kết quả mạnh nhất và kết quả yếu nhất mà luật máy này có thể cho
là **cùng một kết quả**, vì vị trí ký tự không mang theo xuất xứ. Báo một chuỗi tìm thấy trong chú
thích ngang bằng một câu chặn tìm thấy trong phần xử lý chính là cách một dòng bỏ quên trở thành một
lời bảo đảm chuyển phát.

## Ví dụ đã giải

**Đầu vào.** `src/event/nats/nats-bridge.service.ts`, đúng như đã viết:

```ts
private async onMessage(raw: Buffer) {
  const parsed = JSON.parse(raw.toString()) as EventEnvelope
  this.eventEmitter.emit(parsed.name, parsed.payload)
  if (parsed.id === this.instanceService.getId()) return
  await this.cacheService.set({ key: parsed.digest, value: 1 })
}
```

Đường dẫn khớp cổng nên luật máy chạy. Cả hai chuỗi đều có, và cả hai đều nằm sau lời gọi phát sự kiện.

```text
rule:     nats-bridge-delivery-contract
code:     DELIVERY-3
file:     src/event/nats/nats-bridge.service.ts
gate:     matched
origin:   present, after emit
digest:   present, after emit
emit:     first occurrence, before both
evidence: live statement
message:  origin
verdict:  fires
```

```text
rule:     nats-bridge-delivery-contract
code:     DELIVERY-4
file:     src/event/nats/nats-bridge.service.ts
gate:     matched
origin:   present, after emit
digest:   present, after emit
emit:     first occurrence, before both
evidence: live statement
message:  digest
verdict:  fires
```

**Đã sửa.** Câu chặn bỏ phong bì tự vọng về, và dấu vân tay được nhận trước khi phát ra:

```ts
private async onMessage(raw: Buffer) {
  const parsed = JSON.parse(raw.toString()) as EventEnvelope
  if (parsed.id === this.instanceService.getId()) return
  const claimed = await this.cacheService.claim({ key: parsed.digest })
  if (!claimed) return
  this.eventEmitter.emit(parsed.name, parsed.payload)
}
```

Luật máy đã im — và im không phải là đã tuân thủ. Thêm một đường thử lại ở phía dưới thì mô-đun vẫn
không nói gì:

```ts
private async onRetry(parsed: EventEnvelope) {
  this.eventEmitter.emit(parsed.name, parsed.payload)
}
```

```text
rule:     nats-bridge-delivery-contract
code:     DELIVERY-3
file:     src/event/nats/nats-bridge.service.ts
gate:     matched
origin:   present, before first emit
digest:   present, before first emit
emit:     first occurrence only
evidence: live statement
message:  none
verdict:  silent: hatch a second emitter call lower in the file
```

Chính sự im lặng ấy còn tới được mà không cần sửa gì cả: bỏ trống thân câu chặn thành `{ }`, hoặc dời
phép so vào một dòng chú thích ở đầu tệp, thì mọi vị trí vẫn đúng thứ tự trong khi mọi bản vọng về
chính mình đều được phát.

## Phạm vi

Mô-đun này ghi lại một luật máy của một điều luật phía sau. Nó không gọi tên sản phẩm nào, công ty nào
hay kho mã nào. Tên luật máy, các định danh thông điệp của nó, tiền tố gói trong bản đồ `recommended`
và những định danh mà biểu thức chính quy khớp là **những định danh xuất xưởng** và được chép nguyên
văn; khoảng miễn ấy không phủ gì khác. Còn phong bì có mang danh tính nơi sinh và dấu vân tay hay
không, `useLocal` và `useNats` có được khai theo từng sự kiện hay không, bên nhận khẳng định cái gì, và
hành vi xuyên bản chạy có được chứng minh bằng hai bản chạy thật hay không — những điều ấy không luật
máy nào ở đây sở hữu.
