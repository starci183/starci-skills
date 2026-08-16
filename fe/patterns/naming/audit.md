---
id: fe-patterns-naming-audit
title: audit.md
slug: /fe/patterns/naming/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định, tầng giữ và khả năng neo vào code thật của luật Naming.
---

# audit.md

> Version: `2.00` · Module: `naming`

Audit này kiểm hai thứ. Một: ba mã có phân định được **từ dữ kiện đã nêu**, và chỉ từ đó, hay không.
Hai: bảng `Tầng giữ` có nói thật hay không — vì một bảng làm tròn "giữ được một nửa" thành `enforced`
là cách một repository tin rằng mình đang được bảo vệ.

## Verdict

Chấp nhận, kèm bốn chênh lệch giữa **luật** và **rule** được ghi lại nguyên vẹn ở dưới. Không chênh
lệch nào được sửa lặng lẽ trong lần chuyển shelf này: luật gốc quyết định nội dung, và bất đồng thì
xuống mục "Rủi ro còn mở".

Ba mã, đúng ba, giữ nguyên số và nguyên nghĩa. Ba rule, mỗi mã một rule gọi được tên. Không mã nào ở
tầng `documented`. Nhưng **không mã nào được giữ trọn**: cả ba rule đều hẹp hơn luật chúng giữ, và
chỗ hẹp nằm ngay trong bảng.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `NAMING-1` vs khai báo lồng | Loại trừ được bằng một dữ kiện cứng: cha của node là module hay một thân hàm |
| `NAMING-1` vs `NAMING-2` | Loại trừ được: một mã nói **cách khai báo**, mã kia nói **chữ**. Một arrow const tên `handleX` vi phạm đúng một mã |
| `NAMING-2` vs một giá trị | Loại trừ được: hỏi cái gì chạy nó — hành động của người đọc, hay lượt render |
| `NAMING-2` vs `handled` / `handler` | Loại trừ được bằng hình dạng: sau `handle` có chữ hoa hay không |
| `NAMING-3` vs catalogue locale | Loại trừ được: địa chỉ hay nội dung. Tên file catalogue vẫn là địa chỉ |
| `NAMING-3` vs từ tiếng Anh trùng hình dạng | Loại trừ được bằng một danh sách có tên, không bằng phán đoán |
| Câu hỏi "đặt tên theo cái gì" | **Không** thuộc module này. Chuyển sang luật của layer tương ứng và dừng |

## Findings

- **Ba mã đều có rule, và đó là điều hiếm ở shelf này.** Hầu hết module ở đây có mã không ai giữ.
  Ở đây tỉ lệ là ba trên ba — nhưng con số ấy nói về **số lượng** rule, không nói về **độ phủ**, và
  phần còn lại của mục này là về độ phủ.

- **`NAMING-1` chỉ với tới hình dạng `FunctionDeclaration`.** `preferArrowExport` báo khi cha của một
  `FunctionDeclaration` nằm trong `MODULE_LEVEL_PARENTS`. Hai chỗ lọt: `const X = function () {}` giữ
  nguyên từ khoá luật từ chối nhưng là một `FunctionExpression`, và `export default () => {}` là một
  arrow **không tên** — mà "không có tên để grep ở call site" chính là một nửa lý do
  `export default function` bị từ chối. Cả hai đi qua rule.

- **Chính file rule là bằng chứng mạnh nhất của `NAMING-1`.**
  [`sources/fe/naming.mjs`](../../../sources/fe/naming.mjs) tuân thủ đúng luật nó phát ra: mọi khai
  báo là const, và không cái nào được dùng trước dòng tạo ra nó. Đây là anchor tự chứng minh — đọc từ
  trên xuống là thấy, không cần ai khẳng định.

- **`NAMING-2` với đúng ba loại node.** `VariableDeclarator` có `id` là `Identifier`, `JSXAttribute`,
  và `TSPropertySignature`. Ba loại đó **chính là** ba vị trí mà twin test dựng thành ba invalid case,
  và bộ ba ấy là lập luận cho tầm với của rule. Ngoài ba loại đó: một property trong object literal,
  một tham số destructure, một method của class — cùng chữ `handle`, không ai ghé thăm.

- **`NAMING-2` chỉ giữ được nửa cấm, không giữ được nửa đòi.** Rule bắt tiền tố `handle`. Nó **không**
  đòi tên phải là `on`. Một handler tên `submit`, `doClaim` hay `runIt` đi qua sạch sẽ, trong khi luật
  nói rõ thứ chạy do người đọc thì tên là `onX`. Đây là chênh lệch lớn nhất giữa luật và rule trong
  module này.

- **Sự hẹp của `NAMING-2` là cố ý và đã được ghi.** Chính comment đầu file rule nói ra: một rule âm
  thầm nới rộng còn tệ hơn một rule bỏ sót, vì ngày `handlerOnPrefix` bắt đầu báo trên một biến chỉ
  **mô tả** một hành động thì mọi người viết học được rằng rule này là nhiễu, và thôi đọc nó. Twin
  test khoá điều đó lại bằng hai valid case `handled` và `handler`.

- **`NAMING-3` chạy trên một danh sách hai mươi đoạn.** `ROMANISED` liệt kê đúng những đoạn sản phẩm
  đã thật sự sinh ra. Một đoạn ngôn ngữ thứ hai **không dấu** và **không nằm trong danh sách** đi qua
  hoàn toàn. Danh sách là lựa chọn đúng — twin test chứng minh bằng hai valid case `capacity` và
  `DangerBadge` — nhưng nó là một **danh sách**, và một danh sách thì thiếu.

- **`NAMING-3` chỉ nhìn thấy file được lint.** Rule đọc `context.filename`, nên một thư mục chỉ chứa
  ảnh, `.json` hoặc file không nằm trong glob của eslint thì **không bao giờ được ghé thăm**, kể cả
  khi tên thư mục ấy nằm nguyên trên URL.

- **`NAMING-3` gắn với một cặp ngôn ngữ cụ thể.** `SECOND_LANGUAGE_PATH` liệt kê chữ cái của một thứ
  tiếng, `ROMANISED` liệt kê từ của chính thứ tiếng ấy. Luật nói "một thứ tiếng mọi người cùng đọc" —
  tổng quát; rule giữ đúng một cặp. Với một repository có cặp ngôn ngữ khác, rule này im lặng.

- **Bảng Forbidden của bản phẳng có một dòng không mang mã.** Dòng "một cái tên nói **nơi** nó được
  dùng" bị cấm, nhưng chính bản phẳng đã nói câu trả lời nằm ở **từng layer**. Lần chuyển này **không**
  phát mã thứ tư cho nó. Đây là một quyết định, không phải một chỗ sót.

- **Anchor sản phẩm của bản phẳng không được chép sang.** Bản phẳng trỏ vào hai file trong một
  repository frontend cụ thể. Shelf này không gọi tên repository nào, và một đường dẫn repository này
  không mở được thì không phải thứ người đọc kiểm được. Mọi anchor ở đây nằm trong lint source của cây
  trust.

## Decisions

- Giữ đúng ba mã: `NAMING-1`, `NAMING-2`, `NAMING-3`, nguyên số, nguyên nghĩa. Không đổi số, không
  thêm mã, không phát mã thứ tư cho dòng Forbidden được giao cho từng layer.
- Giữ nguyên phạm vi hẹp của `NAMING-2` ở tầng **rule**. Nới rule ra là cách làm cho rule bị bỏ đọc.
  Luật thì vẫn rộng hơn rule, và bảng `Tầng giữ` nói ra khoảng cách đó.
- Giữ `ROMANISED` là một **danh sách** chứ không phải một khuôn đoán. Một rule báo lỗi trên từ tiếng
  Anh là một rule bị tắt.
- Giữ ngoại lệ "khai báo lồng" đúng như twin test đã khoá: cha là thân hàm thì không phải mức module.
- Bảng `Tầng giữ` ghi cả phần **không** với tới, ngay trong bảng. Một mã chỉ được ghi `enforced` khi
  đã tìm ra rule và gọi được tên nó.
- Mọi ví dụ là TSX thường. Chỗ luật chạm vào component riêng thì gọi **vai trò** của nó — leaf giữ
  state, slot nhận handler — không gọi tên định danh trong một codebase.
- Bốn chênh lệch luật/rule ở trên xuống "Rủi ro còn mở", không thành edit lặng lẽ.

## Rủi ro còn mở

### Các mã chỉ ở tầng `documented`

**Không có.** Cả ba mã đều có một rule mang tên gọi được. Đây là chỗ module này khác hầu hết module
cùng shelf, và nó **không** có nghĩa là ba mã đã an toàn — nó chỉ có nghĩa là không mã nào phải sống
hoàn toàn nhờ người đọc. Phần thật sự hở nằm ở mục kế tiếp.

### Các mã `enforced` nhưng chỉ một phần

- **`NAMING-1` — hai hình dạng lọt.** Để giữ nốt, rule phải thêm hai thứ. Một: báo `FunctionExpression`
  nằm ở vế phải của một khai báo mức module — thuần cơ học, không cần hiểu nghĩa. Hai: báo
  `ExportDefaultDeclaration` mà phần được export là một biểu thức vô danh (arrow hoặc function). Cái
  thứ hai cần một quyết định trước: luật hiện nói `export default function`, và mở rộng sang
  `export default () => {}` là **nới luật**, không phải sửa rule. Nên nó là một đề xuất rule change,
  không phải một lần đọc khác đi.

- **`NAMING-2` — ba vị trí được nhìn, phần còn lại thì không.** Để với tới property trong object
  literal và tham số destructure, rule cần thêm visitor cho `Property` (đọc `key`) và cho
  `ObjectPattern` (đọc từng `key`/`value` là `Identifier`). Đây là mở rộng rẻ, cùng hình dạng regex,
  không đụng tới độ hẹp mà file rule cố ý giữ. Nên làm trước.

- **`NAMING-2` — nửa đòi thì không rule nào giữ được.** Rule phải phân biệt "hàm này chạy do hành động
  của người đọc" với "hàm này chạy do cái khác" thì mới đòi được tiền tố `on`. Trong cây cú pháp, một
  hàm được truyền vào một prop tên `onPress` **có thể** suy ra được; nhưng một hàm khai báo rồi mới
  truyền đi ở chỗ khác, hoặc truyền qua một biến trung gian, thì không. Xấp xỉ khả dĩ: báo khi một
  hàm được truyền trực tiếp vào một prop/thuộc tính bắt đầu bằng `on` mà **định danh** của nó không
  bắt đầu bằng `on`. Xấp xỉ đó bắt được đúng ca đắt nhất — cái tên bị dịch ở ranh giới — và không bắt
  được ca truyền gián tiếp. Đó là đề xuất đáng cân nhắc nhất trong toàn bộ module này.

- **`NAMING-3` — danh sách hai mươi đoạn.** Không có thay đổi rule nào làm cho danh sách đầy được;
  đầy là thuộc tính của một từ điển, không phải của một danh sách. Thứ có thể máy hoá là **quy trình**:
  mỗi lần một đoạn mới bị bắt trong review, nó được thêm vào `ROMANISED` cùng lần sửa. Thứ **không**
  nên làm là thay danh sách bằng một khuôn đoán theo hình dạng chữ — twin test đã ghi sẵn hai ca mà
  khuôn ấy báo sai.

- **`NAMING-3` — file không bị lint thì không được nhìn.** Muốn giữ, phép kiểm phải rời khỏi eslint và
  thành một cổng đi trên **cây thư mục** chứ không trên tập file được lint. Đó là một công cụ khác,
  không phải một rule khác.

### Các rủi ro khác

- **Một dòng Forbidden không có mã.** "Cái tên nói nơi nó được dùng" bị cấm ở bản phẳng, và câu trả
  lời được giao cho từng layer. Ai chỉ đọc module này sẽ không biết luật ấy tồn tại ở đâu; ai đi tìm
  `NAMING-4` sẽ không thấy gì. Cả `INDEX.md` và `example.md` đều nói rõ chỗ dừng này, nhưng nó vẫn là
  một mối nối cần một cái tên ở phía layer.
- **Luật tổng quát, rule gắn một cặp ngôn ngữ.** `NAMING-3` phát biểu "một thứ tiếng mọi người cùng
  đọc"; hai hằng số trong rule chỉ biết một thứ tiếng. Với một đội có cặp ngôn ngữ khác, mã vẫn đúng
  và rule vẫn im.
- **Anchor toàn bộ nằm trong lint source.** Neo được, và neo vào code thật, nhưng là code **thi hành
  luật** chứ không phải code **chịu luật**. Bản phẳng có hai anchor sản phẩm; chúng không được chép
  sang vì shelf này không gọi tên repository, nên mất mát này là có thật và được ghi ở đây thay vì
  giấu đi. Một anchor vào cây component sẽ mạnh hơn, và không kiểm được từ repository này.
- **`const X = function () {}` là ca dễ hiểu sai nhất.** Nó qua lint, nên rất dễ được đọc thành "được
  phép". `example.md` đặt hẳn một case cho nó vì lý do đó.

## Re-audit Triggers

- `sources/fe/naming.mjs` đổi `MODULE_LEVEL_PARENTS`, đổi danh sách visitor của `handlerOnPrefix`,
  hoặc đổi `ROMANISED`.
- Có đề xuất nới `NAMING-1` sang `export default () => {}` hoặc sang `FunctionExpression`.
- Có đề xuất bắt rule đòi tiền tố `on` chứ không chỉ cấm `handle`.
- Một `handleX` được tìm thấy trong object literal hoặc trong tham số destructure và không ai báo lỗi.
- Một đoạn đường dẫn ngôn ngữ thứ hai đi qua review vì nó không nằm trong danh sách.
- Repository thêm một cặp ngôn ngữ thứ hai khác với cặp mà `ROMANISED` được dựng cho.
- Câu hỏi "đặt tên component theo cái gì" bắt đầu bị hỏi ở module này thay vì ở layer sở hữu nó.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
