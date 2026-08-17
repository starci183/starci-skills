---
title: Naming · Vietnamese
---

# Đặt tên

Đầu vào là mã đã viết xong — một tệp, một khúc diff. Đầu ra là một **phán quyết**: tệp đó có được kiểm
hay không, quy tắc công bố nào lên tiếng, lên tiếng tại nút nào, ứng với mã luật nào, và cửa còn mở nào
lẽ ra đã che đúng lỗi ấy. Mô-đun này không chọn tên nào cả. Nó **từ chối** một cái tên, và nó phải chỉ
được đúng ký tự mà nó từ chối.

## Luật

Luật nằm ở `patterns/naming.md`. Luật nói ba điều: một hàm ở cấp mô-đun là một arrow const (`NAMING-1`),
thứ mà người đọc kích hoạt thì tên là `onX` chứ không bao giờ là `handleX` (`NAMING-2`), và tên tệp hay
tên tuyến đường được viết bằng thứ ngôn ngữ mà mọi người đọc kho mã đều dùng chung (`NAMING-3`).

Luật nêu **ba mã, và cả ba đều có quy tắc giữ.** Đó không phải lời khẳng định là đã phủ kín. Có hai
nghĩa vụ luật nói bằng lời mà không quy tắc nào giữ: đòi hỏi rằng dạng ở cấp mô-đun phải là **arrow**
cho đúng, và lệnh cấm đặt một cái tên nói ra nơi thứ đó được dùng. Trang này không chép lại luật; nó ghi
lại phần **thi hành** — đúng cái nút mà máy nhìn vào, và những cách viết đi ngang qua nó mà không hề hấn
gì. Một điều luật không có quy tắc nào giữ thì ai cũng biết là chưa được giữ, nên vẫn còn người đọc lại.
Một quy tắc **thủng** thì mọi người tin là cửa đã đóng nên không ai đọc lại nữa — vì vậy bảng những chỗ
còn lọt ở dưới mới là lý do trang này tồn tại, không phải phần phụ lục của nó.

## Luật máy đã xuất bản

| Quy tắc | Mã | Nó báo cái gì |
|---|---|---|
| `prefer-arrow-export` | `NAMING-1` | Một khai báo `function` đứng ở cấp mô-đun, được gọi đúng tên trong thông báo, kèm sẵn dạng viết lại bằng arrow const |
| `handler-on-prefix` | `NAMING-2` | Một biến, một thuộc tính JSX hay một trường của kiểu có tên bắt đầu bằng `handle` + một chữ hoa, kèm luôn cái tên `on…` mà nó lẽ ra phải mang từ lúc sinh ra |
| `no-second-language-in-path` | `NAMING-3` | Đúng một đoạn đường dẫn — chỉ đoạn phạm đầu tiên — mang ngôn ngữ thứ hai, bằng một chữ cái có dấu hoặc bằng phép trùng khít với một danh sách các đoạn phiên âm đã liệt kê |

Mọi quy tắc công bố đều ứng với một mã, và mọi mã luật nêu đều có quy tắc: **không mã nào ở đây bị bỏ
lại không có máy giữ.** Phần chưa được thi hành thì hẹp hơn một mã và tuyệt đối không được đọc thành đã
phủ — đòi hỏi **arrow** cho đúng trong `NAMING-1`, và lệnh cấm đặt tên nói ra nơi thứ đó được dùng, đều
không có quy tắc nào canh. Một lần chạy xanh không nói gì về hai điều đó.

Danh tính của mỗi quy tắc là cái tên nó công bố; không có mã số nào cho quy tắc, vì cái tên đã là chuỗi
ký tự hiện trong log build, trong dòng chú thích tắt quy tắc, và trong mọi cuộc trao đổi về lỗi đó rồi.

## Đọc một diff

1. **Quyết định phạm vi trước hết, và ghi lại.** Cấu hình glob của kho tiêu thụ mới là thứ quyết định
   tệp nào được kiểm. Một tệp không glob nào gọi tên không phải là tệp đã qua — nó là tệp mà ở đây không
   có quy tắc nào tồn tại cho nó, và nó **chưa được xét**.
2. **Kiểm tra các miễn trừ.** Tệp sinh tự động hoặc tệp nhập từ nguồn ngoài nằm ngoài tầm mọi quy tắc ở
   đây bằng đường glob, không bằng bất kỳ miễn trừ nào ở mức quy tắc. `handle` dùng như một danh từ
   nghiệp vụ là một va chạm đã biết, không phải một sự cho phép.
3. **Đọc nút, đừng đọc chữ.** `prefer-arrow-export` đọc `FunctionDeclaration` và cha của nó;
   `handler-on-prefix` đọc đúng ba loại nút; `no-second-language-in-path` đọc `context.filename` trước
   khi có visitor nào. Một cái tên nằm trong chú thích, trong chuỗi hay trong giá trị thì cả ba đều
   không thấy.
4. **Mỗi phát hiện một khối.** `no-second-language-in-path` phát ra nhiều nhất một báo cáo cho mỗi tệp;
   hai quy tắc kia báo một lần cho mỗi nút phạm.
5. **Viết dòng `hatch` mỗi khi một cửa còn mở lẽ ra đã che đúng lỗi đó.** Một phán quyết `silent` với
   `hatch: none` là lời khẳng định rằng cách viết đã sạch; một phán quyết `silent` có gọi tên một cửa là
   lời khẳng định rằng cách viết **chưa được ai đọc lại**. Đó là hai sự thật khác nhau.
6. **Đừng báo cái mà không quy tắc nào canh.** Không có gì ở đây kiểm rằng dạng ở cấp mô-đun là arrow, và
   không có gì ở đây kiểm một cái tên nói ra nơi thứ đó được dùng.

## `prefer-arrow-export` — NAMING-1

**Nó báo cái gì.** Một khai báo `function` mà cha trực tiếp của nó là thân mô-đun, một lệnh `export` có
tên, hoặc một lệnh `export default`. Thông báo gọi đúng tên hàm và viết sẵn dạng thay thế:
`const <tên> = (...) => {...}`.

**Nó phát hiện bằng gì.** Thăm nút `FunctionDeclaration`. Đọc `node.parent.type` và chỉ tiếp tục khi giá
trị đó là `Program`, `ExportNamedDeclaration` hoặc `ExportDefaultDeclaration`. Báo lỗi tại `node.id`;
nếu hàm không có tên thì báo tại chính nút đó, và thông báo điền `node.id.name` hoặc chữ `default`.

**Nó không thấy gì.** Một khai báo `function` nằm trong thân một thành phần, trong một khối `if`, trong
một callback của test hay trong một khối tĩnh của lớp — cha là `BlockStatement` hoặc tương tự nên rào
chắn cấp mô-đun thoát ngay, trong khi hiện tượng hoisting, đúng cái hỏng mà luật chỉ tên, vẫn xảy ra
nguyên vẹn trong phạm vi đó. `const load = function () { … }` là một `FunctionExpression` chứ không phải
`FunctionDeclaration`: nó không bị hoisting nên phần lập luận về hoisting coi như thoả, nhưng nó không
phải arrow — chính cái tên quy tắc hứa nhiều hơn cái nó kiểm. `export default () => {}` không có nút
khai báo nào để báo, nên mối lo thứ hai mà luật nêu — một export không có tên để grep ở nơi gọi — hoàn
toàn không được giữ. `declare function fetchQuota(): void` và các chữ ký nạp chồng phân tích ra
`TSDeclareFunction`, một loại nút mà visitor không bao giờ nhận được.

**Ranh giới.** Quy tắc này xét **hình dạng** của một khai báo ở cấp mô-đun. Nó không bao giờ xét cái tên
mà khai báo ấy mang; một `function handleSubmit()` ở cấp mô-đun bị bắt ở đây vì hình dạng, và vô hình
với `handler-on-prefix`.

## `handler-on-prefix` — NAMING-2

**Nó báo cái gì.** Một cái tên khớp `/^handle[A-Z]/` ở đúng ba vị trí, với thông báo dựng từ
`name.slice("handle".length)` và đọc lại thành `on…`.

**Nó phát hiện bằng gì.** Thăm đúng ba loại nút. `VariableDeclarator`, chỉ khi
`node.id.type === "Identifier"`. `JSXAttribute`, đọc `node.name.name`. `TSPropertySignature`, chỉ khi
`node.key.type === "Identifier"`. Ba visitor, một hàm kiểm chung. Không đọc giá trị khởi tạo, không đọc
kiểu, không truy vết import — chỉ có chuỗi ký tự của cái tên và loại nút chứa nó.

**Nó không thấy gì.** `const Row = ({ handleClick }) => …` có `id` là `ObjectPattern` trong khi điều kiện
đòi `Identifier`, mà props phá cấu trúc lại chính là đường tên hàm phản hồi **thường đến nhất**.
`(handleClick) => …` và `function f(handleClick)` không phải một `VariableDeclarator` nào cả; không nút
tham số nào được thăm. `function handleSubmit() {}` nằm trong thân một thành phần là một
`FunctionDeclaration` chứ không phải một declarator — `prefer-arrow-export` chỉ bắt **hình dạng** của nó
ở cấp mô-đun và không bao giờ bắt **cái tên**, còn lồng bên trong thì nó vô hình với cả hai quy tắc.
`const handlers = { handleClick: fn }` là một `Property` và phương thức lớp `handleClick() {}` là một
`MethodDefinition`; cả hai đều không được thăm. `type Props = { handleClick(): void }` là một
`TSMethodSignature` chứ không phải `TSPropertySignature` — cùng một ý nghĩa, khác một loại nút, và im
lặng. `type Props = { "handleClick": () => void }` có khoá là chuỗi ký tự trong khi điều kiện đòi
`Identifier`. `clickHandler`, `submitHandler`, `doSubmit` và `handle_click` đều rơi ra ngoài một regex
neo vào `handle` rồi một chữ hoa, mà cách viết hậu tố lại là **từ vựng thay thế phổ biến nhất** cho đúng
ý niệm luật muốn thống nhất. `<Field {...{ handleChange }} />` là một `JSXSpreadAttribute`; quy tắc chỉ
thấy một thuộc tính có tên.

**Ranh giới.** Quy tắc này bám vào một cái tên ở chỗ khai báo, không bám vào giá trị đó là gì hay làm gì.
Một `onSubmit` đặt tên đúng nhưng giữ một hàm sai hình dạng không thuộc việc của nó.

## `no-second-language-in-path` — NAMING-3

**Nó báo cái gì.** Đúng **một** đoạn đường dẫn — chỉ đoạn phạm đầu tiên — của chính tệp đang được kiểm,
báo một lần tại nút `Program`.

**Nó phát hiện bằng gì.** Đọc `context.filename` (lùi về `context.getFilename()`) **trước khi** trả về
bất kỳ visitor nào. Đổi `\` thành `/`, hạ chữ thường toàn bộ chuỗi, tách theo `/`, bỏ đoạn rỗng. Một
đoạn phạm khi một regex chữ cái có dấu của một bảng chữ duy nhất khớp nó, **hoặc** khi đoạn đó sau khi
bỏ `(`, `)`, `[` và `]` trùng khít một phần tử trong danh sách hai mươi đoạn phiên âm. Chỉ đoạn phạm đầu
tiên sống sót qua `.find`. Khi không đoạn nào phạm, quy tắc trả về một đối tượng visitor rỗng và tệp
không bị duyệt lần nào; ngược lại nó báo một lần tại `Program`.

**Nó không thấy gì.** Một đoạn phiên âm ngoài danh sách hai mươi phần tử — `bai-hoc`, `nguoi-dung`,
`dat-hang` — đi lọt, vì phép thuộc là trùng khít danh sách. Danh sách ấy là lựa chọn **cố ý**, không phải
cẩu thả: đoán theo hình dạng sẽ từ chối `capacity` và `dangerous`, mà một quy tắc bắt nhầm từ của ngôn
ngữ chung là quy tắc bị kho mã tắt đi. `dang-nhap-v2`, `auth-dang-nhap`, `dangnhap` và `dang_nhap` đều
lọt, vì phép so là bằng nhau nguyên đoạn; thêm một tiền tố, một hậu tố hay đổi dấu phân cách là đủ.
`[...dang-nhap]` và `@dang-nhap` cũng lọt, vì tập bóc chỉ đúng `(`, `)`, `[`, `]`, nên ba dấu chấm của
đoạn bắt-tất-cả và dấu `@` của tuyến song song còn lại và phá phép so bằng. Một thư mục không chứa tệp
nào được kiểm — tài liệu, ảnh, tệp tĩnh — thì trình kiểm không bao giờ bước vào, vì quy tắc chỉ phát ra
từ bên trong một tệp đang được kiểm. Một tuyến khai báo bằng chuỗi — một bảng chuyển hướng, một bảng
tuyến, một cấu hình router, một `href` ghép tay — là vô hình, vì quy tắc đọc **tên tệp**, trong khi địa
chỉ công khai, đúng phần luật nhắc đến khách hàng và phiếu hỗ trợ, nằm trong chuỗi. Một ngôn ngữ thứ hai
có bảng chữ khác với bảng đã mã hoá, hoặc một hệ chữ không có chữ Latin nào, đều lọt: nhánh dấu liệt kê
chữ cái của **một** ngôn ngữ, danh sách liệt kê từ của **một** ngôn ngữ, nên tên quy tắc thì nói chung
còn hiểu biết của nó thì không. Một đường dẫn có hai đoạn phạm chỉ cho ra một thông báo, vì `.find` dừng
ở đoạn đầu — sửa xong đoạn đó thì quy tắc lại kêu ở đoạn sau, đúng, nhưng ai đọc một thông báo sẽ ước
lượng thiếu khối lượng phải sửa. Và quy tắc với tay quá xa: toàn bộ đường dẫn tuyệt đối bị quét, kể cả
phần nằm **ngoài** kho mã, nên một bản làm việc đặt dưới một thư mục có dấu sẽ làm mọi tệp trong kho báo
lỗi cùng lúc, ở một đoạn không ai trong kho sửa được.

**Ranh giới.** Quy tắc này quyết định một lần cho mỗi tệp, chỉ từ đường dẫn, trước khi duyệt cây. Không
gì bên trong tệp đổi được phán quyết của nó, và không quy tắc nào khác ở đây đọc đường dẫn.

## Cách phát hiện

| Phần | Cơ chế |
|---|---|
| `prefer-arrow-export` | Thăm `FunctionDeclaration`. Đọc `node.parent.type` và chỉ tiếp tục khi giá trị đó là `Program`, `ExportNamedDeclaration` hoặc `ExportDefaultDeclaration`. Báo tại `node.id`, lùi về chính nút đó khi khai báo không tên; thông báo điền `node.id.name`, hoặc chữ `default`. |
| `handler-on-prefix` | Thăm đúng ba loại nút. `VariableDeclarator`, chỉ khi `node.id.type === "Identifier"`. `JSXAttribute`, đọc `node.name.name`. `TSPropertySignature`, chỉ khi `node.key.type === "Identifier"`. Mỗi tên được kiểm bằng `/^handle[A-Z]/`; thông báo dựng từ `name.slice("handle".length)`. |
| `no-second-language-in-path` | Đọc `context.filename` (lùi về `context.getFilename()`) TRƯỚC khi trả về bất kỳ visitor nào. Đổi `\` thành `/`, hạ chữ thường toàn bộ, tách theo `/`, bỏ đoạn rỗng. Một đoạn phạm khi regex chữ cái có dấu của một bảng chữ duy nhất khớp nó, HOẶC khi đoạn đó sau khi bỏ `(`, `)`, `[` và `]` trùng khít một phần tử trong danh sách hai mươi đoạn phiên âm. Chỉ đoạn phạm đầu tiên sống sót qua `.find`. Khi không đoạn nào phạm, quy tắc trả về visitor rỗng và tệp không bị duyệt; ngược lại báo một lần tại `Program`. |
| Cái duy nhất với ra ngoài tệp | Chỉ `context.filename`. Không quy tắc nào đọc thông tin kiểu, phân giải import hay xem xét một giá trị; mọi thứ còn lại quyết định từ hình dạng bên trong tệp. |

## Lối thoát hợp lệ

**Đã đóng** — người đọc dễ tưởng là lọt, nhưng không lọt.

| Viết thế này | Quy tắc | Vì sao vẫn bị bắt |
|---|---|---|
| `export async function load() {}` | `prefer-arrow-export` | `async` không đổi loại nút; nó vẫn là `FunctionDeclaration` dưới `ExportNamedDeclaration` |
| `function* walk() {}` | `prefer-arrow-export` | Cùng loại nút; hàm sinh không phải một trường hợp riêng |
| `export default function () {}` | `prefer-arrow-export` | Không tên nên `node.id` là null — báo cáo lùi về chính nút đó và thông báo ghi `default` thay vì im lặng bỏ qua |
| `let handleClick = …` / `var handleClick = …` | `handler-on-prefix` | Visitor là `VariableDeclarator`, thứ mà mọi kiểu khai báo đều sinh ra; `const` không được xét riêng |
| `const handleClick = useCallback(() => {}, [])` | `handler-on-prefix` | Giá trị khởi tạo không bao giờ bị xem; chỉ có định danh được khai báo |
| `<Field handleChange={fn} />` | `handler-on-prefix` | Một thuộc tính JSX bị kiểm bằng chính tên nó, độc lập với kiểu của thành phần nhận |
| `app/(marketing)/dang-nhap/page.tsx` | `no-second-language-in-path` | Ngoặc của nhóm tuyến và ngoặc vuông của đoạn động bị bóc trước khi so với danh sách |
| `app/DANG-KY/page.tsx` | `no-second-language-in-path` | Toàn bộ đường dẫn bị hạ chữ thường trước mọi phép so |
| `src/components/Đăng nhập/index.tsx` | `no-second-language-in-path` | Nhánh dấu khớp ở bất kỳ đâu trong đoạn; không đòi dấu phân cách hay ranh giới từ |

**Còn mở** — điểm mù đã xuất xưởng. Một phán quyết không được khẳng định là những chỗ này đã được xét.

| Viết thế này | Quy tắc | Vì sao quy tắc không thấy |
|---|---|---|
| Một khai báo `function` trong thân một thành phần, trong một khối `if`, trong một callback của test hay trong một khối tĩnh của lớp | `prefer-arrow-export` | Cha là `BlockStatement` hoặc tương tự nên rào chắn cấp mô-đun thoát ngay. Hoisting — đúng cái hỏng mà luật chỉ tên — vẫn xảy ra nguyên vẹn trong phạm vi đó |
| `const load = function () { … }` | `prefer-arrow-export` | `FunctionExpression` không phải `FunctionDeclaration`. Nó không bị hoisting nên lập luận về hoisting coi như thoả, nhưng nó không phải arrow — chính tên quy tắc hứa nhiều hơn cái nó kiểm |
| `export default () => {}` | `prefer-arrow-export` | Không có gì để báo: không có nút khai báo nào. Mối lo thứ hai luật nêu — một export không có tên để grep ở nơi gọi — không được giữ |
| `declare function fetchQuota(): void` và các chữ ký nạp chồng | `prefer-arrow-export` | Chúng phân tích ra `TSDeclareFunction`, một loại nút visitor không bao giờ nhận được |
| `const Row = ({ handleClick }) => …` | `handler-on-prefix` | `id` của declarator là `ObjectPattern`, mà điều kiện đòi `Identifier`. Props phá cấu trúc lại là đường tên hàm phản hồi thường đến nhất |
| `(handleClick) => …` và `function f(handleClick)` | `handler-on-prefix` | Một tham số không phải `VariableDeclarator` nào cả; không nút tham số nào được thăm |
| `function handleSubmit() {}` trong một thành phần | `handler-on-prefix` | Một `FunctionDeclaration`, không phải declarator. `prefer-arrow-export` bắt được HÌNH DẠNG của nó ở cấp mô-đun nhưng không bao giờ bắt CÁI TÊN, còn lồng bên trong thì vô hình với cả hai |
| `const handlers = { handleClick: fn }` và phương thức lớp `handleClick() {}` | `handler-on-prefix` | `Property` và `MethodDefinition` đều không được thăm |
| `type Props = { handleClick(): void }` | `handler-on-prefix` | Một trường viết dạng phương thức là `TSMethodSignature`, không phải `TSPropertySignature` |
| `type Props = { "handleClick": () => void }` | `handler-on-prefix` | Khoá là một chuỗi ký tự, mà điều kiện đòi `Identifier` |
| `clickHandler`, `submitHandler`, `doSubmit`, `handle_click` | `handler-on-prefix` | Regex neo vào `handle` rồi một chữ hoa. Cách viết hậu tố là từ vựng thay thế phổ biến nhất và hoàn toàn vô hình |
| `<Field {...{ handleChange }} />` | `handler-on-prefix` | Một phép trải là `JSXSpreadAttribute`; quy tắc chỉ thấy thuộc tính có tên |
| Một đoạn phiên âm ngoài danh sách hai mươi phần tử — `bai-hoc`, `nguoi-dung`, `dat-hang` | `no-second-language-in-path` | Phép thuộc là trùng khít danh sách. Danh sách là cố ý, không phải cẩu thả: đoán theo hình dạng sẽ từ chối `capacity` và `dangerous`, mà một quy tắc bắt nhầm từ của ngôn ngữ chung là quy tắc bị tắt |
| `dang-nhap-v2`, `auth-dang-nhap`, `dangnhap`, `dang_nhap` | `no-second-language-in-path` | Phép so là bằng nhau nguyên đoạn. Bất kỳ tiền tố, hậu tố hay dấu phân cách khác đều thoát |
| `[...dang-nhap]` và `@dang-nhap` | `no-second-language-in-path` | Tập bóc đúng là `(`, `)`, `[`, `]`. Ba dấu chấm của đoạn bắt-tất-cả và dấu `@` của tuyến song song còn lại và phá phép so bằng |
| Một thư mục không chứa tệp nào được kiểm — tệp tĩnh, tài liệu, ảnh | `no-second-language-in-path` | Quy tắc phát ra từ bên trong một tệp đang được kiểm. Một thư mục ngôn ngữ thứ hai không chứa tệp nào như thế thì trình kiểm không bao giờ bước vào |
| Một tuyến khai báo bằng chuỗi: bảng chuyển hướng, bảng tuyến, cấu hình router, một `href` ghép tay | `no-second-language-in-path` | Quy tắc đọc TÊN TỆP. Địa chỉ công khai — đúng phần luật nhắc đến khách hàng và phiếu hỗ trợ — có thể bằng ngôn ngữ thứ hai mà không có tệp nào để chỉ vào |
| Một ngôn ngữ thứ hai có bảng chữ khác bảng đã mã hoá, hoặc một hệ chữ không có chữ Latin | `no-second-language-in-path` | Nhánh dấu liệt kê chữ cái của một ngôn ngữ; danh sách liệt kê từ của một ngôn ngữ. Tên quy tắc thì nói chung, hiểu biết của nó thì không |
| Một đường dẫn có hai đoạn phạm | `no-second-language-in-path` | `.find` dừng ở đoạn đầu. Sửa xong đoạn đó thì quy tắc lại kêu ở đoạn sau — đúng, nhưng ai đọc một thông báo sẽ ước lượng thiếu khối lượng phải sửa |
| Một bản làm việc đặt dưới một thư mục có dấu nằm ngoài kho mã | `no-second-language-in-path` | Toàn bộ đường dẫn tuyệt đối bị quét, kể cả phần ngoài kho, nên mọi tệp báo lỗi cùng lúc ở một đoạn không ai trong kho sửa được |

## Đầu vào

| Đầu vào | Bằng chứng cần có |
|---|---|
| mã nguồn | Một tệp đã phân tích; mọi quy tắc ở đây làm việc trên cây cú pháp, không dùng thông tin kiểu |
| bộ phân tích | TypeScript có bật JSX — hai trong ba visitor của `handler-on-prefix` là nút TypeScript hoặc JSX, và nếu không thì chúng lặng lẽ không bao giờ được chạm tới |
| `context.filename` | Một đường dẫn tuyệt đối đúng như trình kiểm báo về, thứ mà `no-second-language-in-path` đọc trước khi trả về bất kỳ visitor nào |
| glob | Cấu hình của kho tiêu thụ quyết định tệp nào được kiểm. Một tệp không glob nào gọi tên là một tệp mà ở đây không có quy tắc nào tồn tại cho nó |
| mức nghiêm trọng | Ý kiến của chính các quy tắc là `error` cho cả ba; cấu hình của kho tiêu thụ vẫn là nơi quyết định cái gì được bật |

## Quy tắc

1. Danh tính của một quy tắc là cái tên nó công bố. Không quy tắc nào mang mã số, và không thông báo nào
   được gọi bằng gì khác ngoài tên quy tắc.
2. Mọi quy tắc đều báo tại một nút mà người đọc đặt được con trỏ vào: định danh của khai báo, thuộc tính
   hay khoá phạm lỗi, hoặc nút `Program` của tệp.
3. Không quy tắc nào đọc thông tin kiểu, phân giải import hay xem xét một giá trị. Mọi thứ trong mô-đun
   này quyết định từ hình dạng cú pháp và từ đường dẫn của chính tệp.
4. `no-second-language-in-path` là một quyết định cho mỗi tệp, làm một lần, trước khi duyệt cây, và cho
   ra nhiều nhất một báo cáo mỗi tệp.
5. Thông báo phải nêu cách viết thay thế, không chỉ nêu lỗi. Mỗi thông báo chứa đúng cách viết lại mà
   tác giả nên dùng.
6. Đây đều là quy tắc hình dạng và không thấy được ý định; mỗi quy tắc hẹp một cách cố ý vì điều đó, và
   cái giá của sự hẹp ấy chính là bảng còn mở ở trên.
7. Tên quy tắc không bao giờ được viết lại, kể cả khi nó chứa một từ gắn với sản phẩm, vì đó là chuỗi mà
   bản build in ra.

## Ngoại lệ

- **Khai báo lồng không phải ngoại lệ mà là điểm mù.** Không ai cho phép nó; quy tắc chỉ đơn giản không
  với tới. Hãy coi đó là luật chưa được giữ, không phải cách viết được duyệt.
- **Từ phiên âm ngoài danh sách không phải được phép.** Danh sách giới hạn điều máy dám khẳng định, không
  giới hạn điều luật cấm. Phần còn lại vẫn do người đọc lại giữ.
- **`handle` là danh từ nghiệp vụ** — tên định danh công khai của một người, một handle tài nguyên — thì
  va vào regex. `const handleAvailable = …` bị bắt dù luật không có ý kiến gì về nó. Đây là chỗ duy nhất
  một cái tên đúng phải viết né quy tắc; đổi tên biến để né tiền tố, đừng tắt quy tắc cho cả tệp, vì tắt
  một lần cho cả tệp là mở luôn cửa cho mọi tên hàm phản hồi viết sai trong tệp đó.
- **Tệp sinh tự động hoặc tệp nhập từ nguồn ngoài** nằm ngoài tầm mọi quy tắc ở đây bằng đường cấu hình
  glob của kho tiêu thụ, không bằng bất kỳ miễn trừ nào ở mức quy tắc.

## Đầu ra

Mỗi phát hiện một khối:

```text
rule: <prefer-arrow-export | handler-on-prefix | no-second-language-in-path>
code: <NAMING-1 | NAMING-2 | NAMING-3>
node: <the exact node the rule visits>
verdict: <fires | silent>
hatch: <none | the open row from the table above that explains the silence>
```

Một tệp sạch phát ra mỗi quy tắc một khối với `verdict: silent` và `hatch: none` — lời khẳng định rằng
cách viết đã được xét và đã qua. Một tệp không glob nào gọi tên thì không phát ra khối nào cả; hãy ghi
quyết định phạm vi bằng lời thay vào đó, vì không visitor nào được cài và quy tắc không tồn tại cho tệp
ấy. Một phán quyết `silent` có gọi tên một cửa là lời khẳng định rằng cách viết chưa được ai đọc lại —
một sự thật khác, và đúng là sự thật mà mô-đun này tồn tại để giữ cho còn nói ra được.

## Ví dụ đã giải

**Đầu vào.** Một tệp tuyến, `src/app/(marketing)/dang-nhap/page.tsx`:

```tsx
export function LoginPage() {
  const handleSubmit = () => {}
  return <Form handleChange={handleSubmit} />
}
```

Đường dẫn được đọc trước khi có visitor nào nên quy tắc đường dẫn quyết định trước; sau đó cây mới bị
duyệt cho hai quy tắc còn lại.

```text
rule: no-second-language-in-path
code: NAMING-3
node: Program
verdict: fires
hatch: none
```

```text
rule: prefer-arrow-export
code: NAMING-1
node: node.id of FunctionDeclaration LoginPage, parent ExportNamedDeclaration
verdict: fires
hatch: none
```

```text
rule: handler-on-prefix
code: NAMING-2
node: VariableDeclarator handleSubmit
verdict: fires
hatch: none
```

```text
rule: handler-on-prefix
code: NAMING-2
node: JSXAttribute handleChange
verdict: fires
hatch: none
```

**Đã sửa**, `src/app/(marketing)/sign-in/page.tsx`:

```tsx
export const LoginPage = () => {
  const onSubmit = () => {}
  return <Form onChange={onSubmit} />
}

const Row = ({ handleClick }) => <button onClick={handleClick} />

const redirects = { "/dang-nhap": "/sign-in" }
```

Cả hai cửa còn mở đều sống sót qua lần sửa, và không sự im lặng nào ở đây là tuân thủ:

```text
rule: handler-on-prefix
code: NAMING-2
node: VariableDeclarator Row, id ObjectPattern
verdict: silent
hatch: props phá cấu trúc — id của declarator là ObjectPattern trong khi điều kiện đòi Identifier, mà đó lại là đường tên hàm phản hồi thường đến nhất
```

```text
rule: no-second-language-in-path
code: NAMING-3
node: Program
verdict: silent
hatch: một tuyến khai báo bằng chuỗi — quy tắc đọc TÊN TỆP, nên địa chỉ công khai nằm trong bảng chuyển hướng vẫn bằng ngôn ngữ thứ hai mà không có tệp nào để chỉ vào
```

## Phạm vi

Mô-đun này chỉ tài liệu hoá những quy tắc có thật trong tệp nguồn công bố chúng. Một quy tắc đáng có mà
chưa có thì không nằm ở đây — nó là một phát hiện dành cho người đọc lại, và người đọc lại vẫn là nơi thi
hành mọi thứ máy bỏ sót: nửa **arrow** của `NAMING-1`, lệnh cấm đặt tên nói ra nơi thứ đó được dùng, và
mọi đoạn phiên âm ngoài danh sách. Một quy tắc không chỉ vào được là một đề xuất, không phải một quy tắc.
Mô-đun này chỉ xét tên và đường dẫn; nó không xét cấu trúc của tệp nào, hình dạng của thành phần nào, hay
quyết định sản phẩm nào.
