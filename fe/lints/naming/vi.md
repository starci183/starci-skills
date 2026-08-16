---
id: fe-lints-naming-vi
title: vi.md
slug: /fe/lints/naming/vi
sidebar_label: vi.md
sidebar_position: 1
description: Ba quy tắc đặt tên — bắt gì, phát hiện bằng cách nào, và cửa nào còn mở.
---

# vi.md

> Version: `2.00` · Module: `naming`

# Đặt tên — phần máy giữ được

Tài liệu luật nói **nên viết thế nào**. Tài liệu này nói **máy nhìn thấy được đến đâu**, và quan trọng
hơn: **máy không nhìn thấy chỗ nào**.

Một điều luật không có quy tắc nào giữ thì ai cũng biết là chưa được giữ, nên vẫn còn người đọc lại.
Một quy tắc **thủng** thì nguy hiểm hơn hẳn: mọi người tin là cửa đã đóng nên không ai đọc lại nữa.
Vì vậy mục **Cửa còn mở** dưới mỗi quy tắc mới là phần chính của trang này, không phải phần phụ lục.

Danh tính của một quy tắc là **cái tên nó công bố**. Không có mã số nào cho quy tắc, vì cái tên đã là
chuỗi ký tự hiện trong log build, trong dòng chú thích tắt quy tắc, và trong mọi cuộc trao đổi về lỗi
đó rồi. Đặt thêm một mã số nữa là tạo ra một quy tắc có hai tên và không ai biết thông báo vừa rồi
đến từ tên nào.

## Bảng tra nhanh

| Quy tắc | Mã luật | Bắt gì |
|---|---|---|
| `prefer-arrow-export` | `NAMING-1` | Một khai báo `function` đứng ở cấp mô-đun |
| `handler-on-prefix` | `NAMING-2` | Một tên bắt đầu bằng `handle` + một chữ hoa, ở biến, ở thuộc tính JSX, hoặc ở trường của một kiểu |
| `no-second-language-in-path` | `NAMING-3` | Một đoạn đường dẫn viết bằng ngôn ngữ thứ hai — có dấu, hoặc trùng khít một từ trong danh sách đã liệt kê |

---

## `prefer-arrow-export`

**Bắt gì.** Một khai báo `function` mà cha trực tiếp của nó là thân mô-đun, một lệnh `export` có tên,
hoặc một lệnh `export default`. Thông báo gọi đúng tên hàm và viết sẵn dạng thay thế:
`const <tên> = (...) => {...}`.

**Giữ mã nào.** `NAMING-1`.

**Cách phát hiện.** Thăm nút `FunctionDeclaration`, đọc `node.parent.type`, chỉ tiếp tục khi giá trị
đó nằm trong tập ba loại cha kể trên. Báo lỗi tại `node.id`; nếu hàm không có tên thì báo tại chính
nút đó và điền chữ `default` vào thông báo.

**Vì sao luật này đáng có máy giữ.** Vì cả hai cách viết đều chạy được. Không có gì hỏng, không có
test nào đỏ, nên không có lực tự nhiên nào kéo hai cách viết về một. Chỉ sau vài tháng là một tệp
viết hôm nay đọc khác hẳn tệp bên cạnh, và mọi diff về sau đều mang thêm nhiễu không liên quan gì
đến thay đổi thật. Đây đúng là loại luật mà con người bỏ qua và máy thì không.

**Cửa còn mở.**

- **Khai báo lồng bên trong.** Một `function` nằm trong thân một hàm khác, trong một khối `if`, trong
  một callback của test, hay trong một khối tĩnh của lớp thì cha là `BlockStatement`, quy tắc thoát
  ngay. Mà hiện tượng hoisting — đúng cái hỏng mà luật chỉ tên — vẫn xảy ra nguyên vẹn trong phạm vi
  đó.
- **Biểu thức hàm.** `const load = function () {}` là `FunctionExpression`, không phải khai báo. Nó
  không bị hoisting nên phần lập luận về thứ tự đọc coi như thoả; nhưng nó **không phải arrow**, mà
  tên quy tắc lại hứa là arrow. Đây là chỗ hành vi thật hẹp hơn cái tên.
- **`export default () => {}` không tên.** Không có nút khai báo nào để báo. Mối lo thứ hai mà luật
  nêu — một export không có tên để grep ở nơi gọi — hoàn toàn không được giữ.
- **Chữ ký khai báo kiểu.** `declare function` và các chữ ký nạp chồng phân tích ra `TSDeclareFunction`,
  một loại nút mà visitor không bao giờ nhận được.

---

## `handler-on-prefix`

**Bắt gì.** Một cái tên khớp `/^handle[A-Z]/` ở đúng ba vị trí: một `VariableDeclarator` mà `id` là
`Identifier`, một thuộc tính JSX, và một `TSPropertySignature` mà khoá là `Identifier`. Thông báo tự
cắt tiền tố `handle` và đọc lại thành `on…`.

**Giữ mã nào.** `NAMING-2`.

**Cách phát hiện.** Ba visitor, một hàm kiểm chung. Không đọc giá trị khởi tạo, không đọc kiểu, không
truy vết import. Chỉ có chuỗi ký tự của cái tên và loại nút chứa nó.

**Vì sao luật này đáng có máy giữ.** Vì cái tên bị đổi ở mọi ranh giới nó đi qua. Ô nhận đã tên là
`on`, thuộc tính DOM đã tên là `onClick`, kiểu của props đã tên là `on…` — nên một biến cục bộ tên
`handleX` sẽ bị đổi tên đúng một lần ở mỗi lần truyền, và mỗi lần đổi tên là một cơ hội sai. Đặt tên
`onX` ngay từ lúc sinh ra thì tên ở chỗ khai báo, chỗ gọi và trong kiểu là cùng một chuỗi.

**Cửa còn mở.**

- **Props phá cấu trúc.** `({ handleClick }) => …` có `id` là `ObjectPattern`, mà điều kiện đòi
  `Identifier`. Đây là cửa nặng nhất, vì tên hàm phản hồi **thường đến bằng đường này**.
- **Tham số hàm.** `(handleClick) => …` không phải một `VariableDeclarator` nào cả; không nút tham số
  nào được thăm.
- **Khai báo hàm.** `function handleSubmit() {}` nằm trong thân một thành phần thì không quy tắc nào
  thấy: `prefer-arrow-export` chỉ nhìn **hình dạng** ở cấp mô-đun và không bao giờ nhìn **cái tên**,
  còn quy tắc này thì không thăm nút đó.
- **Thuộc tính đối tượng và phương thức lớp.** `{ handleClick: fn }` là `Property`, `handleClick() {}`
  trong lớp là `MethodDefinition` — cả hai đều ngoài tầm.
- **Trường kiểu viết dạng phương thức.** `{ handleClick(): void }` là `TSMethodSignature`, không phải
  `TSPropertySignature`. Cùng một ý nghĩa, khác một loại nút, và im lặng.
- **Khoá dạng chuỗi.** `{ "handleClick": () => void }` có khoá là `Literal`, không phải `Identifier`.
- **Cách viết hậu tố.** `clickHandler`, `submitHandler`, `changeHandler` — đây là **từ vựng thay thế
  phổ biến nhất** cho đúng ý niệm mà luật muốn thống nhất, và quy tắc hoàn toàn không thấy nó.
- **Viết liền hoặc gạch dưới.** `handleclick`, `handle_click` không khớp vì regex đòi một chữ hoa ngay
  sau `handle`.
- **Trải thuộc tính.** `<Field {...{ handleChange }} />` là `JSXSpreadAttribute`.
- **Bắt nhầm.** `handle` còn là một danh từ nghiệp vụ: tên định danh công khai của một người. Vậy nên
  `const handleAvailable = …` sẽ bị bắt dù luật không có ý kiến gì về nó. Đây là chỗ duy nhất phải
  đổi tên biến để né quy tắc, thay vì tắt quy tắc cho cả tệp.

---

## `no-second-language-in-path`

**Bắt gì.** Đúng **một** đoạn đường dẫn — đoạn đầu tiên phạm — của chính tệp đang được kiểm. Đoạn đó
phạm khi nó chứa một chữ cái có dấu thuộc bảng chữ đã mã hoá sẵn, **hoặc** khi bỏ đi `(`, `)`, `[`,
`]` rồi trùng khít một phần tử trong danh sách hai mươi đoạn đã viết thẳng vào quy tắc.

**Giữ mã nào.** `NAMING-3`.

**Cách phát hiện.** Đọc `context.filename` **trước khi** trả về bất kỳ visitor nào: đổi `\` thành `/`,
hạ chữ thường toàn bộ, tách theo `/`, bỏ đoạn rỗng. Nếu không có đoạn nào phạm thì trả về một đối
tượng visitor rỗng và tệp không bị duyệt lần nào. Nếu có thì báo một lần tại nút `Program`.

**Vì sao luật này đáng có máy giữ.** Vì quy tắc đọc mã nguồn nhìn được định danh, chú thích và chuỗi,
nhưng **không nhìn được tên của chính tệp nó đang đọc**. Nên một tuyến đường có thể mang tên bằng ngôn
ngữ thứ hai trong khi từng định danh bên trong đều bằng ngôn ngữ chung, và không có gì lên tiếng —
trong khi cái tên đó là URL người dùng dẫn lại trong một phiếu hỗ trợ, là thư mục hiện trong thanh bên
của mọi trình soạn thảo, là chuỗi lặp lại trong mọi câu lệnh import, và là dòng đường dẫn trong mọi
vết ngăn xếp. Một đoạn đường dẫn là **địa chỉ**, không phải nội dung; chữ mà người ta **đọc** thì thuộc
về danh mục ngôn ngữ, chỗ mà ngôn ngữ thứ hai là mục đích chứ không phải tai nạn.

**Cửa còn mở.**

- **Từ phiên âm ngoài danh sách.** Danh sách chỉ có hai mươi đoạn. Bất kỳ từ nào khác đều đi lọt. Đây
  là lựa chọn **cố ý**, không phải cẩu thả: đoán theo hình dạng sẽ từ chối `capacity` và `dangerous`,
  mà một quy tắc bắt nhầm từ của ngôn ngữ chung là quy tắc bị tắt.
- **So khớp là bằng nhau nguyên đoạn.** `dang-nhap-v2`, `auth-dang-nhap`, `dangnhap`, `dang_nhap` đều
  lọt. Thêm một hậu tố hay đổi dấu phân cách là đủ.
- **Tập ký tự bị bóc quá hẹp.** Chỉ bóc bốn ký tự ngoặc. Đoạn bắt-tất-cả `[...dang-nhap]` còn lại ba
  dấu chấm, và đoạn tuyến song song `@dang-nhap` còn lại `@` — cả hai đều phá phép so bằng.
- **Thư mục không chứa tệp nào được kiểm.** Quy tắc chỉ phát ra từ bên trong một tệp đang được kiểm.
  Một thư mục tên sai nhưng chỉ chứa tài liệu, ảnh hay tệp tĩnh thì trình kiểm không bao giờ bước vào.
- **Đường dẫn khai báo bằng chuỗi.** Một bảng chuyển hướng, một bảng tuyến, một `href` ghép tay — địa
  chỉ công khai nằm ở đó chứ không nằm ở tên tệp, và quy tắc này chỉ đọc tên tệp.
- **Ngôn ngữ khác.** Nhánh dấu liệt kê chữ cái của **một** ngôn ngữ, danh sách liệt kê từ của **một**
  ngôn ngữ. Tên quy tắc thì nói chung; hiểu biết của nó thì không.
- **Nhiều đoạn phạm cùng lúc.** `.find` dừng ở đoạn đầu. Sửa xong đoạn đó thì quy tắc lại kêu ở đoạn
  sau — đúng, nhưng ai đọc một thông báo sẽ ước lượng thiếu khối lượng phải sửa.
- **Với tay quá xa.** Toàn bộ đường dẫn tuyệt đối bị quét, kể cả phần nằm **ngoài** kho mã. Một bản
  làm việc đặt dưới một thư mục có dấu sẽ làm **mọi tệp** trong kho báo lỗi cùng lúc, ở một đoạn không
  ai trong kho sửa được.

---

## Luật

- Ba quy tắc, ba mã, ánh xạ một-một: `prefer-arrow-export` giữ `NAMING-1`, `handler-on-prefix` giữ
  `NAMING-2`, `no-second-language-in-path` giữ `NAMING-3`.
- Chỉ tài liệu hoá quy tắc **có thật trong tệp nguồn**. Một quy tắc đáng có mà chưa có thì không nằm ở
  đây; nó nằm ở `audit.md`, mục rủi ro.
- Tên quy tắc **không bao giờ được viết lại**, kể cả khi nó chứa một từ gắn với sản phẩm, vì đó là
  chuỗi mà bản build in ra.
- Không quy tắc nào đọc thông tin kiểu, không quy tắc nào phân giải import. Tất cả đều quyết định từ
  hình dạng cú pháp và từ đường dẫn của chính tệp.
- Mọi thông báo phải nêu **cách viết thay thế**, không chỉ nêu lỗi.

## Ngoại lệ

- **Khai báo lồng không phải ngoại lệ mà là điểm mù.** Không ai cho phép nó; quy tắc chỉ đơn giản
  không với tới. Hãy coi đó là luật chưa được giữ, không phải cách viết được duyệt.
- **Từ phiên âm ngoài danh sách không phải được phép.** Danh sách giới hạn điều **máy dám khẳng định**,
  không giới hạn điều **luật cấm**. Phần còn lại vẫn do người đọc lại giữ.
- **`handle` là danh từ nghiệp vụ** thì đổi tên biến để né tiền tố, đừng tắt quy tắc cho cả tệp — tắt
  một lần cho cả tệp là mở luôn cửa cho mọi tên hàm phản hồi viết sai trong tệp đó.
- **Tệp sinh tự động hoặc tệp nhập từ nguồn ngoài** nằm ngoài tầm mọi quy tắc ở đây bằng đường **cấu
  hình glob** của kho tiêu thụ, không bằng bất kỳ miễn trừ nào ở mức quy tắc.
