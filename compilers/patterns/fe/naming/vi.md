---
title: Naming · Vietnamese
module: naming
kind: pattern
codes: [NAMING-1, NAMING-2, NAMING-3]
---

# Đặt tên

Đầu vào của pattern này là một shape đã có người duyệt — một layout, một block, một capability, một
contract. Quyết định đó đã đóng ở đây; pattern này không mở lại nó. Đầu ra là **kiến trúc source**:
đoạn code nằm ở file nào, khai báo viết ra sao, thứ chạy do người đọc tác động được gọi là gì ở mọi
ranh giới nó đi qua, và đoạn đường dẫn viết bằng thứ tiếng nào. Mọi vị trí đặt tên mà một shape đã
duyệt sinh ra đều rơi vào đúng một mã dưới đây, hoặc rơi vào luật theo từng layer mà module này chỉ
gọi tên chứ không chép lại.

## Luật

Đây là **nửa cơ học** của việc đặt tên: những cách viết phải giống nhau ở mọi file, bất kể file đó
làm gì. Một hàm ở mức module được khai báo thế nào, một thứ chạy khi người dùng bấm thì tên là gì, và
đường dẫn viết bằng ngôn ngữ nào.

Đây không phải sở thích. Cả hai cách viết của mỗi cặp đều chạy, và chính vì thế chúng phải thành
luật: không có gì tự sửa cách viết thứ hai, nên một file viết hôm thứ Ba đọc khác hẳn file bên cạnh,
và mọi diff về sau mang theo nhiễu không liên quan gì tới thay đổi thật.

**Đây là luật bắt buộc, không phải lời khuyên.** Mọi khai báo ở mức module, mọi hàm chạy do người dùng
tác động, và mọi đoạn đường dẫn đều rơi vào đúng một mã dưới đây. Không có file nào nhỏ tới mức được
miễn: một helper ba dòng là `NAMING-1` vì đúng cái lý do khiến một thư mục route là `NAMING-3`.

Một component được đặt tên **theo cái gì** — theo bản thân nó, chứ không theo người gọi đầu tiên —
thì cố ý **không** chốt ở đây. Câu đó được trả lời ở **từng layer**, vì cái hỏng mà nó ngăn ở mỗi
layer là khác nhau, và một câu trả lời duy nhất viết ở đây sẽ sai ở bốn layer để đúng ở một layer.

## Mã tình huống

Mọi tình huống module này quản đều mang một mã, `NAMING-<n>`. Mã gọi tên **TÌNH HUỐNG**. Các mã được
trích dẫn từ những file luật khác và từ các bản ghi công việc, nên một con số đã phát ra thì không bao
giờ dùng lại cho nghĩa khác và không bao giờ đánh số lại.

| Mã | Tình huống | Source phải trông thế nào |
|---|---|---|
| `NAMING-1` | Một hàm được khai báo ở mức module, ai cũng gọi được từ file khác | Hàm ở mức module là một arrow const, export theo tên. Cấm: `function X() {}` ở mức module; `export default function` |
| `NAMING-2` | Một hàm chạy khi người dùng bấm, gõ, chọn — và nó sẽ được truyền đi | Thứ chạy do hành động của người đọc thì tên là `onX` — ở chỗ khai báo, ở chỗ gọi, và trong kiểu props. Cấm: `handleX` làm biến cục bộ, làm prop, hoặc làm field trong kiểu props |
| `NAMING-3` | Tên file, tên thư mục, đoạn route — thứ nằm trên URL và trong stack trace | Tên file, thư mục và đoạn route viết bằng một thứ tiếng mà mọi người đọc đều có. Cấm: một đoạn đường dẫn bằng thứ tiếng thứ hai, dù còn dấu hay đã bỏ dấu |

MODULE NÀY CÓ BA MÃ VÀ DỪNG Ở BA. Bộ luật phẳng mà nó viết lại còn mang một điều cấm thứ tư — một cái
tên nói **NƠI** nó được dùng thay vì nói nó là gì — và điều cấm đó không kèm mã, vì luật ấy được phát
biểu ở từng layer chứ không ở đây. Không phát con số thứ tư là một quyết định, không phải sơ suất: một
mã phát ra ở đây sẽ bị trích dẫn ở đây, trong khi câu trả lời lại thiếu ở đúng cái layer thật sự sở
hữu nó.

## Đọc một shape đã duyệt

1. Đọc xem shape **nói gì**. Nó nói bề mặt, các block, các slot, những hành động người đọc làm được,
   và địa chỉ mà những bề mặt ấy nằm. Đó chính là các đầu vào ở bảng bên dưới.
2. Đọc xem shape **không nói gì**, và do đó không giải quyết. Một shape không nói một component được
   đặt tên **theo cái gì** — theo bản thân nó chứ không theo người gọi đầu tiên. Câu đó trả lời ở từng
   layer, không mang mã nào ở đây, nên nó vẫn để mở khi pattern này chạy xong.
3. Giải từ **ngoài vào**. Đoạn route và đường dẫn file được chốt trước mọi khai báo bên trong file, vì
   địa chỉ là cái tên một người trích lại và một cỗ máy phân giải, còn các khai báo thì nằm bên trong
   nó.
4. Hỏi câu hỏi của từng mã, lần lượt. `NAMING-1`: cha của khai báo là chính module hay là thân một
   hàm? `NAMING-2`: cái chạy nó là hành động của người đọc, hay nó tính ra một giá trị? `NAMING-3`:
   đoạn này là **địa chỉ** hay là **nội dung**?
5. Khi hai mã cùng khớp thì **cả hai cùng áp dụng**. Các mã đọc độc lập nhau: `NAMING-1` nói **cách
   khai báo**, `NAMING-2` nói **chữ**. Một arrow const tên `handleClaim` đúng `NAMING-1` và vẫn sai
   `NAMING-2`. Xuất một khối đầu ra cho mỗi vị trí, không phải mỗi file một khối.

## `NAMING-1` — hàm ở mức module là một arrow const

**Tình huống.** Bạn đang khai báo một hàm ở **mức ngoài cùng** của file: một helper, một component,
một hàm định dạng, một route. Hai cách viết đều chạy, nhưng chỉ một cách giữ được lời hứa về **thứ
tự** của file.

**Nó sinh ra gì trong source.** Một arrow const, export theo tên, xuất hiện phía trên chỗ dùng đầu
tiên của nó. Không `function X() {}` ở mức module, và không `export default function`. Lý do sâu hơn
nằm ở **hoisting**: một khai báo `function` tồn tại **trước** dòng khai báo ra nó, nên một file có thể
gọi xuống dưới mà vẫn xanh — và thứ tự của file lập tức không còn nghĩa gì, vì không có gì bắt buộc
một thứ phải được định nghĩa trước khi được dùng. Một `const` thì không thể dùng trước khi tồn tại,
nên file đọc từ trên xuống đúng theo thứ tự nó thật sự chạy. `export default function` còn thêm một
cái giá nữa: bản export **không có tên để grep** ở phía các call site.

**Dấu hiệu nhận biết.** Khai báo nằm sát lề trái, cha của nó là chính module hoặc một câu `export`.
Trong file có chỗ gọi tới một cái tên được định nghĩa ở **phía dưới** mà vẫn chạy. Bạn phải cuộn lên
rồi cuộn xuống mới biết một cái tên đến từ đâu. Tự hỏi: nếu tôi đọc file này từ trên xuống, có chỗ nào
dùng một cái tên chưa hề xuất hiện chưa?

**Ranh giới.** Đây không phải khai báo lồng: một `function` nằm **trong thân** một hàm khác thì không
phải mức module, vì hoisting trong một thân duy nhất không phá thứ tự của file — thân đó được đọc như
một khối. Và đây cũng không phải `NAMING-2`: mã này nói **cách khai báo**, không nói **chữ**.

**Tình huống nghiệp vụ hay gặp.** Component export ra ngoài · hàm định dạng số tiền, ngày, đơn vị ·
custom hook · guard/validator · adapter gọi API · route mặc định của một trang · helper dựng chuỗi
class · factory tạo cấu hình.

## `NAMING-2` — thứ chạy do người dùng thì tên là `onX`

**Tình huống.** Một hàm chạy **vì người dùng đã làm gì đó**: bấm, gõ, chọn, gửi, đóng. Nó gần như luôn
được **truyền đi** — vào một slot, vào một prop, vào một thuộc tính DOM.

**Nó sinh ra gì trong source.** Cùng một chữ ở cả ba chỗ: biến cục bộ lúc khai báo, chỗ gọi, và field
trong kiểu props. `handleSubmit` và `onSubmit` mô tả **cùng một hàm**, nhưng một codebase dùng cả hai
thì có **hai bộ từ vựng cho một ý**, và mỗi người viết phải tự quyết file này đang nói thứ tiếng nào.
`on` là chữ **sống sót được qua chuyến đi**: slot đã là `on`, thuộc tính DOM đã là `onClick`, kiểu
props đã khai `on…` — nên một biến cục bộ tên `handlePress` **bị đổi tên ở ranh giới, mỗi lần**, và
mỗi lần đổi tên là một dịp để sai.

**Dấu hiệu nhận biết.** Nó không trả về giá trị để hiển thị; nó **gây ra** một việc. Nó xuất hiện ở vế
phải của một prop hoặc một thuộc tính DOM. Trong cùng một màn hình, cái tên này đang tồn tại ở hai
dạng chữ khác nhau. Tự hỏi: cái chạy nó là **hành động của người đọc**, hay là quá trình render?

**Ranh giới.** Đây không phải một giá trị: nếu nó **tính ra** một thứ thì `on` là nói dối, và luật này
**không** đòi — một nhãn dựng từ dữ liệu là một giá trị, không phải handler. Đây cũng không phải chữ
`handled`, `handler`: đó là **từ**, không phải khuôn `handle` + chữ hoa, và nới ra tới chúng thì bắt
thêm được một ca mà mất toàn bộ sự chú ý của người đọc. Và đây không phải `NAMING-1`, mã quản **cách
khai báo** chứ không quản chữ.

**Tình huống nghiệp vụ hay gặp.** Nút gửi form · nút huỷ trong modal · chọn một dòng trong danh sách ·
đổi tab · đổi trang · đóng overlay · thả file vào vùng upload · nhấn phím tắt · xác nhận xoá · nhận
một phần thưởng.

## `NAMING-3` — đường dẫn viết bằng thứ tiếng mọi người cùng đọc

**Tình huống.** Bạn đang đặt tên một **file**, một **thư mục**, hoặc một **đoạn route**.

**Nó sinh ra gì trong source.** Một đoạn đường dẫn viết bằng thứ tiếng mà mọi người đọc repository này
cùng có. Luật soi source đọc được định danh, comment và chuỗi — nhưng **không đọc được tên của chính
file nó đang đọc**. Nên một route có thể là `app/cap-phat/page.tsx` với mọi định danh bên trong bằng
tiếng Anh, và không có gì báo một tiếng — trong khi URL, chuỗi import, cái thư mục hiện trên sidebar
của mọi editor, và đường dẫn trong mọi stack trace vẫn nằm ở một thứ tiếng mà một nửa người đọc không
có. Một đoạn route còn là một **cái tên công khai**: nó là địa chỉ khách hàng trích lại trong ticket hỗ
trợ. Phép kiểm là **hai phần**, vì đường dẫn không mang được dấu: `cấp phát` xuống tới filesystem
thành `cap-phat`. Dấu thanh bắt dạng thứ nhất; một **danh sách có tên** bắt dạng đã bỏ dấu. Danh sách
là cố ý chứ không phải là lười: đoán theo hình dạng chữ sẽ từ chối luôn `capacity` và `dangerous`, mà
một luật báo lỗi trên từ tiếng Anh là một luật bị tắt — và một luật đã tắt thì không giữ gì cả.

**Dấu hiệu nhận biết.** Đoạn đường dẫn có dấu thanh, hoặc là một từ đã bỏ dấu của thứ tiếng khác. Chữ
trên URL trùng với chữ hiển thị trên màn hình — dấu hiệu ai đó đã lấy nội dung làm địa chỉ. Import
specifier đọc lên nghe như một câu, không như một địa chỉ. Tự hỏi: đoạn này là **địa chỉ** hay là **nội
dung**? Nội dung thì thuộc về catalogue locale.

**Ranh giới.** Đây không phải catalogue locale: từ điển dịch **chính là** thứ tiếng kia, đó là nội
dung, và đổi được nó là mục đích của nó — còn tên của chính file catalogue thì vẫn là địa chỉ. Và đây
cũng không phải một từ tiếng Anh trông giống chữ đã bỏ dấu: `capacity`, `dangerous` mở đầu bằng đúng
những chữ cái ấy, và luật **không** đụng tới chúng.

**Tình huống nghiệp vụ hay gặp.** Route đăng nhập/đăng ký · trang khoá học · trang thanh toán · giỏ
hàng · hồ sơ · cài đặt · thư mục component · file util · route group đặt trong ngoặc · thư mục ảnh và
tài nguyên tĩnh.

## Tầng giữ

Tầng nào thật sự giữ từng mã. `unrepresentable` nghĩa là một union đóng hoặc một branded type khiến
giá trị sai không viết ra được; `enforced` nghĩa là một luật trong `@starci/eslint-canon-fe` báo nó;
`documented` nghĩa là không có gì cơ học giữ nó, chỉ có người đọc giữ.

| Mã | Tầng | Ai giữ | Tầng này không với tới đâu |
|---|---|---|---|
| `NAMING-1` | `enforced` | `starci-fe/prefer-arrow-export` | Chỉ hình dạng `FunctionDeclaration`. `const X = function () {}` vẫn giữ đúng cái từ khoá luật từ chối nhưng là một `FunctionExpression` nên không bao giờ được ghé thăm; `export default () => {}` là arrow không có tên để grep ở các call site — đúng một nửa lý do `export default function` bị từ chối — mà vẫn qua |
| `NAMING-2` | `enforced` | `starci-fe/handler-on-prefix` | Ba loại node — một declarator có id là `Identifier`, một tên thuộc tính JSX, một khoá `TSPropertySignature`. Một property trong object literal, một tham số destructure và một method của class mang đúng tiền tố ấy mà không ai ghé. Nửa khẳng định thì hoàn toàn không được đọc: `submit` và `doClaim` thoả luật lint mà không thoả luật |
| `NAMING-3` | `enforced` | `starci-fe/no-second-language-in-path` | `ROMANISED` là một danh sách cố định gồm hai mươi đoạn, nên một đoạn tiếng thứ hai đã bỏ dấu mà nằm ngoài danh sách thì vẫn qua. Một thư mục không chứa file nào bị lint thì không bao giờ được ghé, và một thứ tiếng khác với thứ tiếng dùng để dựng danh sách thì hoàn toàn không được phủ |

Cả ba mã đều có một luật có tên. Không mã nào ở tầng `documented`. Cái **không** đúng là nói bất kỳ mã
nào trong ba mã được giữ **trọn vẹn** — mỗi luật đều hẹp hơn phần luật nó giữ, và mọi khoảng hở ở trên
đều là khoảng hở đã được ghi lại kèm điều một luật sẽ phải nhìn thấy, vì một bảng tầng làm tròn "một
phần" lên thành "enforced" chính là cách một repository đi tới chỗ tin rằng mình đang được bảo vệ.

## Điểm neo

Code thật để đối chiếu từng mã. Một luật không chỉ được vào code thật thì là một đề xuất, không phải
một luật.

| Mã | Điểm neo | Nhìn cái gì |
|---|---|---|
| `NAMING-1` | `@starci/eslint-canon-fe` | File tuân đúng luật nó phát ra. Mọi khai báo trong đó — `MODULE_LEVEL_PARENTS`, `segmentsOf`, cả ba object luật — đều là const, và mỗi cái đều xuất hiện phía trên chỗ dùng đầu tiên. Đọc từ trên xuống thì không có gì được nhắc tới trước khi nó tồn tại; chính tính chất đó là toàn bộ lập luận, và nó nhìn thấy được chứ không phải nói suông |
| `NAMING-1` | `@starci/eslint-canon-fe` | Bộ ba ca sai: một export theo tên, một khai báo trần ở mức module, và `export default function Route()`. Bên cạnh là ca đúng `export const E = () => { function inner() {…} }` — đúng cái khai báo lồng được cố ý cho phép, viết thành test chứ không thành một câu |
| `NAMING-2` | `@starci/eslint-canon-fe` | Bộ ba ca sai là **một** hàm ở ba vị trí: một biến cục bộ, một thuộc tính JSX, một field trong kiểu props. Bộ ba đó là lập luận cho tầm với của luật. Các ca đúng `handled` và `handler` là lập luận cho sự hẹp của nó — một luật nổ trên chúng sẽ là nhiễu, mà nhiễu thì không ai đọc |
| `NAMING-2` | `@starci/eslint-canon-fe` | `flag` cùng phép thử `/^handle[A-Z]/` của nó, và ba visitor gọi tới nó. Danh sách visitor **chính là** tầm với; thứ gì không nằm trong đó thì nằm ngoài luật, bất kể nó tên là gì |
| `NAMING-3` | `@starci/eslint-canon-fe` | `SECOND_LANGUAGE_PATH` và `ROMANISED` — hai dụng cụ cho một luật, vì filesystem làm rụng dấu. Rồi tới `segmentsOf`, và cái `replace(/[()[\]]/g, "")` trong hàm dò: ngoặc của route group là dấu câu bọc quanh một cái tên, không phải một phần của cái tên |
| `NAMING-3` | `@starci/eslint-canon-fe` | Các ca đúng `capacity` và `DangerBadge`. Chúng là lý do `ROMANISED` là một danh sách chứ không phải một mẫu, và chúng là ca mà một luật khôn hơn sẽ trượt |

Mọi điểm neo ở trên đều là source lint nằm trong trust tree, tức là phần code repository này thật sự
mở ra được. Bộ luật phẳng còn nêu tên hai file nằm trong một repository sản phẩm; chúng không được
chép lại ở đây, vì kệ luật này không nêu tên repository nào và vì một đường dẫn repository này không mở
được thì không phải thứ người đọc kiểm tra được. Giới hạn đó được ghi lại đúng như một giới hạn, thay
vì che đi bằng một đường dẫn không ai xác minh nổi.

## Đầu vào

| Đầu vào | Bằng chứng cần có |
|---|---|
| position | Đây là một khai báo, một biến cục bộ, một prop, một field trong kiểu props, một thuộc tính JSX, hay một đoạn đường dẫn |
| scope | Cha của khai báo là chính module hay là thân một hàm |
| trigger | Cái chạy nó là hành động của người đọc, hay nó tính ra một giá trị |
| boundary | Cái tên được truyền vào slot nào, và slot đó đang gọi nó là gì |
| audience | Ai đọc cái tên: chỉ file này, mọi call site, hay mọi người trích lại URL |
| language | Những chữ đó là nội dung một người đọc, hay là địa chỉ mà cả người lẫn máy cùng phân giải |

## Quy tắc

1. Mọi khai báo ở mức module đều có cùng một dáng, để người đọc lướt file không phải phân tích hai thứ
   ngữ pháp cho một ý.
2. Một const không thể dùng trước khi tồn tại, nên thứ tự của file phát biểu một điều người đọc dựa
   vào được.
3. Một export có tên ngay tại chỗ nó được export, nên grep cái tên đó sẽ ra một định nghĩa.
4. Một cái tên đi qua ranh giới thì vẫn là cùng một chữ ở cả hai phía.
5. `on` đánh dấu rằng cái chạy thứ đó là hành động của người đọc. Một giá trị được tính ra thì không
   mang `on`.
6. Đường dẫn là **địa chỉ**, không phải nội dung. Chữ mà **người ta đọc** nằm trong catalogue locale.
7. Phép kiểm đường dẫn có hai phần, vì đường dẫn không mang được dấu và một nửa bằng chứng đã mất
   trước khi luật kịp nhìn thấy cái tên.
8. Mọi vị trí đặt tên rơi vào đúng một mã, hoặc rơi vào luật theo từng layer mà module này gọi tên
   chứ không chép lại.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ đều đóng và nêu rõ mã nó áp
dụng vào.

- **Khai báo lồng không thuộc mức module** (`NAMING-1`). Hoisting trong một thân duy nhất không phá
  thứ tự của file, vì thân đó được đọc như một khối. Ngoại lệ này có case chạy thật trong twin test,
  không chỉ là một câu viết ở đây.
- **Giá trị không phải handler** (`NAMING-2`). Đặt `on` cho một thứ không ai kích hoạt là nói sai về
  chính nó, và luật này không đòi điều đó.
- **`handled` và `handler` là từ, không phải khuôn** (`NAMING-2`). Khuôn là `handle` cộng một chữ hoa.
  Nới ra tới chúng thì bắt thêm được một ca và mất toàn bộ sự chú ý của người đọc.
- **Catalogue locale mang thứ tiếng thứ hai** (`NAMING-3`). Từ điển dịch **chính là** thứ tiếng kia;
  đó là nội dung, và đổi được nó là mục đích của nó.
- **Từ tiếng Anh trùng hình dạng với danh sách đã bỏ dấu thì ở lại** (`NAMING-3`). `capacity` và
  `dangerous` mở đầu bằng đúng những chữ cái của các mục trong danh sách. Một luật từ chối từ tiếng
  Anh là luật bị repository tắt đi, và một luật đã tắt thì không giữ gì cả.

## Đầu ra

Mỗi vị trí đặt tên mà shape đã duyệt sinh ra là một khối, gom theo từng file.

```text
position: <declaration | local | prop | type field | jsx attribute | path segment>
code: <NAMING-1 | NAMING-2 | NAMING-3>
tier: <enforced: <rule name> | documented>
verdict: <keep | rename | rewrite as an arrow const | move the words to the locale catalogue>
reason: <what the current spelling costs at the next boundary it crosses>
```

## Ví dụ đã giải

Shape đã duyệt: một trang phần thưởng nằm ở địa chỉ `cấp phát`, component trang của nó render một leaf
có một nút bấm, và hàm mà nút đó chạy được khai báo ngay trong trang rồi truyền vào slot của leaf.

Shape **không** nói leaf ấy được đặt tên **theo cái gì** — theo bản thân nó chứ không theo người gọi
đầu tiên — nên pattern này không giải câu đó. Câu đó trả lời ở từng layer, ở đây nó không mang mã nào,
và nó vẫn để mở sau khi các khối dưới đây được xuất ra.

Đoạn route, giải từ ngoài vào trước:

```text
position: path segment
code: NAMING-3
tier: enforced: starci-fe/no-second-language-in-path
verdict: move the words to the locale catalogue
reason: the segment reaches the filesystem as app/cap-phat/page.tsx, so the URL, the import string, the editor sidebar and every stack trace carry a language half the readers do not have; this is not the locale catalogue exception because the segment is the address, not the dictionary whose whole function is to hold the other language
```

Component export của trang:

```text
position: declaration
code: NAMING-1
tier: enforced: starci-fe/prefer-arrow-export
verdict: rewrite as an arrow const
reason: written as export default function the export has no name to grep at its call sites, and the hoisted declaration lets the file call downward so its order stops meaning anything; this is not the nested-declaration exception because the declaration's parent is the module, not the body of another function
```

Hàm mà nút chạy, ở cả ba vị trí nó chiếm:

```text
position: declaration
code: NAMING-2
tier: enforced: starci-fe/handler-on-prefix
verdict: rename
reason: the slot it is passed into is already spelled on, so a local named handleClaim is renamed at the boundary every time; this is not the value exception because a reader's click is what runs it, and it is not the handled/handler exception because the letters are handle followed by a capital
```

```text
position: prop
code: NAMING-2
tier: enforced: starci-fe/handler-on-prefix
verdict: rename
reason: the same function under a second spelling at the call site gives one idea two vocabularies within one screen
```

```text
position: type field
code: NAMING-2
tier: enforced: starci-fe/handler-on-prefix
verdict: rename
reason: the props type is the boundary the name is read at by every future call site, and a field spelled handleClaim there forces the rename to happen again on each one
```

Để ý rằng component export và câu chuyện handler được giải độc lập nhau: một arrow const tên
`handleClaim` sẽ đóng được `NAMING-1` mà vẫn để `NAMING-2` mở nguyên.

## Phạm vi

Module này phát biểu một luật đúng với bất kỳ front end nào. Nó không nêu tên sản phẩm nào, thư viện
component nào, khoá registry nào hay repository nào. Mọi ví dụ đều là TSX thường. Chỗ nào luật chạm
tới một component riêng tư, module gọi tên **VAI TRÒ** của component đó — cái leaf giữ một state, cái
slot mà handler được truyền vào — chứ không bao giờ gọi định danh của nó trong một codebase.

MỘT ĐỊNH DANH ĐÃ SHIP THÌ KHÔNG PHẢI LÀ TÊN SẢN PHẨM THEO NGHĨA NÀY. Một luật được trích dẫn bằng
đúng cái tên đã phát hành của nó, kèm cả tiền tố plugin, vì đó là chuỗi chính xác mà một build log in
ra và một comment disable mang theo. Một trích dẫn không dán được vào ô tìm kiếm thì không phải trích
dẫn. Cái mà lệnh cấm ở trên cấm là **VĂN XUÔI** và **VÍ DỤ** phải có một sản phẩm mới hiểu được — chứ
không bao giờ cấm một định danh mà người ta sẽ đọc thấy trong một lỗi và phải đi tra.
