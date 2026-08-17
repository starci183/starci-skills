---
title: Icon · Vietnamese
---

# Biểu tượng

Đầu vào là mã đã viết xong — một tệp nguồn, một mẩu diff. Đầu ra là một **phán quyết**: tệp đó có nằm
trong phạm vi hay không, luật lint nào đã nổ, nó báo cái gì và trên nút nào, mã luật tương ứng là gì,
và cửa mở nào lẽ ra đã che đúng lỗi ấy. Mô-đun này không chọn hình nào, nhà cung cấp nào hay cỡ nào.
Nó từ chối một cách viết, và nó phải chỉ được vào đúng chuỗi mà nó từ chối.

## Luật

Biểu tượng là một ý nghĩa sản phẩm đã đóng. Người gọi nêu **ý nghĩa** và **vai trò**; một chiếc lá duy
nhất đổi cặp đó thành hình vẽ thật. Kiểu dữ liệu đã đóng được hai tập ý nghĩa và vai trò, nên phần
escape còn lại đúng là phần kiểu dữ liệu không nhìn thấy: một chỗ gọi nhập thẳng gói hình, một chiếc lá
lặng lẽ thêm nhà cung cấp thứ hai, và một cỡ viết ra không nằm trong các bậc mà vai trò đưa ra.

Mô-đun luật có năm luật lint, và tài liệu này ghi đúng năm. Danh tính của một luật là **tên công bố**
của nó — chuỗi in ra trong log build và chuỗi viết trong dòng tắt luật — nên ở đây không đặt thêm số
cho luật nào. **Bốn trong năm luật giữ một mã luật**: `ICON-6`, `ICON-7`, `ICON-1` (chỉ nửa về cỡ) và
`ICON-10`. Luật thứ năm không giữ mã nào: mô-đun luật đề `rank-artwork-is-a-closed-set` bằng `ICON-11`,
nhưng trong văn bản luật `ICON-11` nói mỗi ô hình luôn mang hình vai trò dẫn dắt ở cỡ năm — một câu về
cỡ hình so với cỡ tấm nền, không liên quan gì tới tranh giải. Vậy là một luật và hai nhánh miễn trừ
đang thực thi một quyết định mà luật chưa từng công bố, còn người đọc lần theo mã từ thông điệp về tới
luật thì rơi vào một câu hoàn toàn khác. Ở đây ghi lại đúng như thế thay vì sửa, vì bịa ra ánh xạ chính
là bịa ra luật.

## Luật máy đã xuất bản

| Luật | Mã | Bắt gì |
|---|---|---|
| `no-vendor-icon-outside-icon-leaf` | `ICON-6` | Câu `import` trỏ vào một gói hình, viết từ một tệp nguồn không phải chiếc lá biểu tượng |
| `heroicons-is-the-glyph-vendor` | `ICON-7` | Câu `import` trỏ vào gói hình nằm ngoài hai họ đã duyệt — từ **mọi** tệp nguồn, kể cả chiếc lá biểu tượng |
| `no-off-scale-glyph-size` | `ICON-1` (chỉ nửa về cỡ) | Tiện ích `size-` viết bằng phân số thập phân hoặc bằng giá trị tuỳ ý trong ngoặc vuông, trong thuộc tính lớp hoặc trong một biến giữ chuỗi lớp tĩnh |
| `no-decorative-icon-in-metric-cell` | `ICON-10` | Thẻ JSX tên `Icon` bên trong đúng một tệp ô số liệu lặp lại |
| `rank-artwork-is-a-closed-set` | **không có mã trong luật** | Định danh tranh giải nêu ngoài chiếc lá xếp hạng, hoặc định danh nêu bên trong chiếc lá đó nhưng không thuộc bốn cái đã duyệt |

Những mã mà kệ này có nêu tên nhưng không luật nào giữ: `ICON-2`, `ICON-3` và `ICON-4` — vai trò nào đi
với cỡ nào — **hoàn toàn không có luật lint nào**, và cỡ nguyên lệch thang cũng vậy, nên `ICON-1` chỉ
được giữ đúng nửa mà luật lint của nó nhìn thấy. `ICON-11` — mỗi ô hình mang hình vai trò dẫn dắt ở cỡ
năm — cũng không có luật nào; luật đang dán nhãn đó lên mình thì thực thi chuyện khác. `ICON-13` được
viết thành tài liệu, được đặt kiểu và được xuất ra dưới dạng tập định danh phản ứng đã đóng, mà không
luật nào đọc tới. Từng mã trong số này là **chưa được thực thi**, không phải đã được phủ, và một lần
chạy sạch không nói gì về bất kỳ mã nào trong đó.

## Đọc một diff

1. **Quyết phạm vi trước mọi thứ khác, và ghi lại.** Ngoài phạm vi ở đây không có nghĩa là tệp đã qua —
   nghĩa là không bộ duyệt nào được lắp và luật đó không tồn tại cho tệp đó. Bốn trong năm luật đòi
   đường dẫn có `/src/`; `no-decorative-icon-in-metric-cell` đòi đúng đường dẫn của riêng nó và không
   gì khác.
2. **Xem lại các miễn trừ, vốn đều là cặp.** Chiếc lá biểu tượng chỉ được miễn luật dành cho chỗ gọi.
   Chiếc lá xếp hạng được miễn cả hai luật nhập, cho đúng một gói. Tệp kiểm thử được miễn luật tranh
   giải. Không tệp nào được miễn trọn một luật.
3. **Đọc đúng những nút mà các luật đứng canh** — chuỗi nguồn trên `ImportDeclaration`, chuỗi lớp tĩnh
   rút từ thuộc tính lớp hoặc từ khởi tạo của một biến, tên thẻ `JSXIdentifier`, và mọi `Literal`
   chuỗi. Một giá trị không bao giờ đi qua một trong các nút ấy thì chưa hề được xét.
4. **Xuất một khối cho mỗi lần báo.** Một câu `import` sai từ một tệp thường vi phạm **cả hai** luật
   nhập và bị báo hai lần, với hai thông điệp khác nhau — đúng theo thiết kế.
5. **Viết dòng `hatch`** mỗi khi có một cửa mở lẽ ra đã che đúng lỗi ấy.
6. **Đừng báo thứ không luật nào canh.** Vai-trò-sang-cỡ, cỡ nguyên lệch thang, tập định danh phản ứng
   và câu về hình trên ô đều không có máy nào giữ; một phán quyết nói khác đi là nói sai về mô-đun.

## `no-vendor-icon-outside-icon-leaf` — ICON-6

**Nó báo cái gì.** `vendor` — một lần báo cho mỗi câu `import` phạm luật: bất kỳ tệp nguồn nào trừ
chiếc lá biểu tượng mà gọi tên một gói hình. Nhập tại chỗ gọi là quyết định cùng lúc ba việc — thư viện
nào, hình nào, to bao nhiêu — và màn hình kế tiếp sẽ trả lời cả ba khác đi.

**Nó phát hiện bằng gì.** Duyệt `ImportDeclaration`, đọc `node.source.value`. Một nguồn bị coi là gói
hình khi nó bằng hoặc **bắt đầu bằng** một trong mười tiền tố gói đã liệt kê, hoặc khi nó là gói ngoài
(không mở đầu bằng `.` hay `@/`) mà tên khớp `/(?:icon|glyph|lucide|feather|tabler|fortawesome)/i`.
Cổng tệp: `context.filename`, đổi hết dấu chéo ngược thành chéo xuôi, phải chứa `/src/` và không được
kết thúc bằng `/leaves/Icon/index.tsx`. Một miễn trừ duy nhất: tệp kết thúc bằng
`/leaves/RankMark/index.tsx` **và** nguồn đúng bằng gói tranh giải.

**Nó không thấy gì.** `require("lucide-react")`, `await import("lucide-react")` và một thành phần nạp
trễ dựng từ import động: chỉ nút `ImportDeclaration` được duyệt.
`export { Caret } from "lucide-react"` — xuất lại cũng mang nguồn, nhưng là một loại nút khác, nên một
tệp trung chuyển một dòng là giặt sạch cả gói. Mọi thứ nằm ngoài một đoạn đường dẫn `/src/`: một thư
mục kiểu gói, một thư mục route ở gốc hay một workspace anh em đều không bị soi, và một tệp ở đó được
nhập tự do rồi xuất lại dưới cái tên trung tính. Và một chiếc lá biểu tượng **thứ hai** — cổng là phép
so đuôi đường dẫn, nên bất kỳ thư mục nào ở đâu kết thúc bằng `leaves/Icon/index.tsx` cũng được tự do y
hệt chiếc lá thật.

**Ranh giới.** Luật này hỏi tệp có phải chiếc lá biểu tượng không. Còn gói đó có được phép tồn tại hay
không là việc của `heroicons-is-the-glyph-vendor`.

## `heroicons-is-the-glyph-vendor` — ICON-7

**Nó báo cái gì.** `vendor` — một gói hình nằm ngoài hai họ đã duyệt (họ nét 24 cho vai trò tiêu đề và
dẫn dắt, họ đặc 16 cho vai trò chip) bị nhập từ **bất kỳ** tệp nguồn nào. Luật này cố tình không miễn
trừ cho chiếc lá: quyền sở hữu bản đồ ý nghĩa không phải giấy phép mở thêm một bộ từ vựng hình thứ hai
ngay bên trong.

**Nó phát hiện bằng gì.** Cùng bộ duyệt `ImportDeclaration` và cùng phép thử gói hình như luật trên,
nhưng bỏ cổng chiếc lá: mọi tệp chứa `/src/` đều bị quét. Một lần trúng chỉ được tha khi nguồn đúng
bằng `@heroicons/react/24/outline` hoặc `@heroicons/react/16/solid`, hoặc khi đúng cặp
chiếc-lá-xếp-hạng-cộng-gói-tranh-giải.

**Nó không thấy gì.** Một bộ hình mà tên gói không mang sáu dấu hiệu tên nào và cũng không nằm trong
danh sách thì lọt sạch — các gói pictogram, emoji hay mark thường rơi đúng vào ô đó. Tệp `.svg` cục bộ
và thành phần SVG viết tay cũng lọt: mọi nguồn tương đối bị loại trước khi thử, nên cả một bộ từ vựng
hình thứ hai có thể được lắp hoàn toàn bằng tệp cục bộ. Theo chiều ngược lại,
`import type { Icon } from "lucide-react"` vẫn bị báo dù chẳng có gì được đóng gói ra — khiếm khuyết
soi gương, một lần báo ở nơi không có escape nào.

**Ranh giới.** Cùng nhà cung cấp là chưa đủ: chỉ hai chuỗi họ đúng nguyên văn được tha, nên họ 20 là
một họ thứ ba và vẫn bị báo.

## `no-off-scale-glyph-size` — ICON-1

**Nó báo cái gì.** `offScale` — một tiện ích `size-` viết bằng phân số thập phân (`size-4.5`) hoặc bằng
giá trị tuỳ ý trong ngoặc vuông (`size-[18px]`). Bậc thứ ba là bậc không ai áp dụng nhất quán: người
viết chọn nó vì một lý do đúng trên màn hình của họ, và mọi người sau đó chép lại cái gần nhất trong
ba.

**Nó phát hiện bằng gì.** Duyệt `JSXAttribute` có `name.name` là `className` hoặc `class`, và duyệt
**mọi** `VariableDeclarator`. Rút chuỗi tĩnh ra từ `Literal` chuỗi, từ `TemplateLiteral` không có biểu
thức nào, hoặc xuyên qua `JSXExpressionContainer` bọc một trong hai. Thử chuỗi đó với
`/\bsize-(?:\d+\.\d+|\[[^\]]+\])/` và chỉ báo lần trúng **đầu tiên**.

**Nó không thấy gì.** Đây là luật rò nhất trên kệ. Tên luật nói "cỡ hình", nhưng phép phát hiện không
có lấy một mẩu ngữ cảnh hình nào: nó chỉ là "một tiện ích `size-` viết bằng phân số hoặc ngoặc vuông",
nên một ảnh đại diện `size-[44px]` bị báo còn `size-9` trên một hình thì không. **Cỡ nguyên lệch thang
lọt hết**, và đó chính là cách dễ viết hơn của cùng một sai lầm — một cỡ cao hơn vai trò lớn nhất hai
bậc, hay thấp hơn vai trò nhỏ nhất một bậc, đi qua im lặng. Dạng hai tiện ích rộng-cao riêng, ở bất kỳ
đơn vị nào, không phải tiện ích mà mẫu canh. Object và mảng lọt: chuỗi lớp nằm trong `{ icon: "…" }`
hay `["…"]` không phải thuộc tính lớp mà cũng không phải hằng khởi tạo bằng chuỗi, nên chỗ gọn gàng
nhất để cất chuỗi lớp lại là chỗ mù nhất. Mọi hàm nối lớp — một helper, một bộ dựng biến thể, một danh
sách có điều kiện — đều lọt, vì chuỗi tĩnh không bao giờ được rút ra từ một lời gọi hàm. Cỡ nội suy
lọt: template có dù chỉ một biểu thức thì trả về rỗng, không còn gì để thử. Và vì phép so không toàn
cục, kẻ vi phạm thứ hai trong cùng một chuỗi không bao giờ được đọc tới.

**Ranh giới.** Luật này không thử vai trò và cũng không thử hình. Vai trò nào đi với cỡ nào — `ICON-2`,
`ICON-3`, `ICON-4` — không phải câu hỏi của nó, và cũng không phải câu hỏi của ai cả.

## `no-decorative-icon-in-metric-cell` — ICON-10

**Nó báo cái gì.** `decorative` — một thẻ JSX đúng chữ `Icon` bên trong đúng một tệp: ô số liệu lặp lại
có nhãn và tiến độ. Bản tham chiếu của ô đó thuần chữ, nên một hình ở đây là bịa ra nhấn mạnh và lặp
lại nghĩa mà chữ đã đóng, nhân lên trên khắp lưới.

**Nó phát hiện bằng gì.** Duyệt `JSXOpeningElement`, báo khi `node.name.type === "JSXIdentifier"` và
`node.name.name === "Icon"`. Cổng tệp **là** toàn bộ luật: đường dẫn phải kết thúc bằng
`/composites/LabelledProgressRow/index.tsx`, không thì bộ duyệt còn chẳng được lắp.

**Nó không thấy gì.** Tên tệp. Cả luật chỉ tồn tại cho một đường dẫn, nên đổi tên tệp, hoặc chuyển phần
đánh dấu sang một tệp anh em cùng thư mục, là xoá được luật mà không chạm một dòng nào vào luật. Mọi
thẻ không đúng chữ `Icon`: bí danh lúc nhập, gọi qua thuộc tính của một object, một thành phần tile hay
badge tự vẽ hình bên trong, hay một hình truyền xuống bằng prop. Và mọi ô dữ kiện gọn khác trong sản
phẩm: luật viết chung cho mọi ô, máy giữ đúng một ô, còn ô số liệu thứ mười viết tuần sau nằm ngoài
theo mặc định.

**Ranh giới.** Luật không phân biệt hình tính năng với hình trạng thái. Trong tệp đó, mọi thẻ `Icon`
đều bị báo.

## `rank-artwork-is-a-closed-set` — none

**Nó báo cái gì.** Hai chuyện, bằng hai thông điệp. `outside` — một định danh tranh giải nêu **ngoài**
chiếc lá xếp hạng, vì bản đồ hạng-sang-tranh phải nằm một chỗ để màn hình thứ hai không trả lời khác
đi. Và `unknown` — một định danh nêu **bên trong** chiếc lá đó nhưng không thuộc bốn cái đã duyệt, vì
miễn trừ mua về bốn tấm huy chương chứ không mua về nguyên một catalog.

**Nó phát hiện bằng gì.** Duyệt **mọi** `Literal`; bỏ qua giá trị không phải chuỗi và mọi chuỗi không
mở đầu bằng tiền tố bộ sưu tập `fluent-emoji-flat:`. Cổng tệp: phải chứa `/src/`, không được khớp
`/\.test\.tsx?$/`. Tệp kết thúc bằng `/leaves/RankMark/index.tsx` đi nhánh kiểm tập đóng; mọi tệp khác
đi nhánh "nêu ngoài chiếc lá".

**Nó không thấy gì.** Định danh ghép bằng template: dựng chuỗi từ số thứ hạng làm **cả hai** nhánh biến
mất cùng lúc — tập đóng và cả quyền sở hữu — mà ghép chuỗi lại đúng là cách tự nhiên nhất để viết một
bản đồ hạng-sang-tranh. Một bộ sưu tập tranh khác: chỉ một tiền tố được nhận ra, nên một tấm huy chương
hay một chiếc cúp lấy từ bộ sưu tập khác trong cùng catalog lọt cả trong lẫn ngoài chiếc lá. Tệp kiểm
thử, theo tên: miễn trừ này có lập luận nhưng không có biên — mọi tệp kết thúc `.test.tsx` ở bất kỳ đâu
đều được gọi tên bất kỳ định danh nào. Và một chiếc lá xếp hạng thứ hai, theo đúng lối so đuôi đường
dẫn như chiếc lá biểu tượng.

**Ranh giới.** Cùng một chuỗi mang hai thông điệp khác nhau tuỳ chỗ nó đứng. Nhánh nào chạy là do tên
tệp quyết, trước cả khi giá trị được đọc.

## Cách phát hiện

| Bộ phận | Cơ chế |
|---|---|
| chuẩn hoá dấu chéo | `context.filename` (hoặc `getFilename()`) được đổi hết dấu chéo ngược thành chéo xuôi trước mọi phép so đuôi, nên cổng đường dẫn cư xử như nhau trên cả hai nền |
| cổng `/src/` | Bốn trong năm luật đòi đường dẫn chứa `/src/`; `no-decorative-icon-in-metric-cell` tự có cổng đường dẫn riêng và không gì khác |
| phép thử nguồn gói hình | Dùng chung cho hai luật nhập: một nguồn trúng khi nó bằng hoặc bắt đầu bằng một trong mười tiền tố gói, hoặc khi nó là gói ngoài (không mở đầu bằng `.` hay `@/`) khớp `/(?:icon\|glyph\|lucide\|feather\|tabler\|fortawesome)/i` |
| bộ rút chuỗi tĩnh | Đọc `Literal` chuỗi, `TemplateLiteral` không biểu thức, hoặc một trong hai xuyên qua `JSXExpressionContainer`; một lời gọi hàm không cho ra gì |
| mẫu cỡ | `/\bsize-(?:\d+\.\d+\|\[[^\]]+\])/`, chỉ lần trúng đầu tiên, không toàn cục |
| tiền tố tranh giải | Đúng một tiền tố bộ sưu tập `fluent-emoji-flat:`; chuỗi không mở đầu bằng nó bị bỏ qua trước khi bất kỳ nhánh nào chạy |
| hình dạng miễn trừ | Mọi miễn trừ là một cặp — một tệp **và** một giá trị — và mọi cổng đường dẫn là phép so đuôi, nên nó đặt tên cho một hình dạng đường dẫn chứ không phải một tệp duy nhất |

Phát hiện thuần cú pháp: không phân giải mô-đun, không hỏi kiểu, không chạy mã, và không với ra ngoài
tệp đang bị lint.

## Lối thoát hợp lệ

**Đã đóng** — người đọc có thể tưởng những cách viết này đi lọt, nhưng không.

| Cách viết | Vì sao vẫn bị báo |
|---|---|
| `import { X } from "@phosphor-icons/react/dist/ssr"` | Gói được so bằng **tiền tố**, không phải bằng đẳng thức. Đường dẫn con đúng là escape mà cả mô-đun được viết ra sau khi phát hiện |
| Đường dẫn kiểu Windows ở cổng | Mọi tên tệp được đổi sang dấu chéo xuôi trước mọi phép so đuôi |
| `class="size-[18px]"` thay vì `className` | Phép thử thuộc tính chấp nhận cả hai cách viết |
| `className={"size-[18px]"}` hoặc `` className={`size-[18px]`} `` | Bộ rút chuỗi tĩnh bóc lớp expression container và đọc được template literal không mang biểu thức nào |
| `const ICON = "size-[18px]"`, dùng ở tận đâu | Mọi `VariableDeclarator` có khởi tạo là chuỗi tĩnh đều bị quét, nên kiểu giặt literal đơn giản nhất đã bị bịt sẵn cho riêng luật này |
| Một bộ hình không ai liệt kê | Một gói ngoài mang `icon`, `glyph`, `lucide`, `feather`, `tabler` hay `fortawesome` trong tên vẫn bị coi là gói hình dù không nằm trong danh sách nào |
| Chiếc lá xếp hạng nhập một nhà cung cấp *khác* | Miễn trừ là một cặp — đúng tệp đó **và** đúng gói đó. Gói khác từ tệp đó vẫn bị báo |
| Thêm tấm huy chương thứ năm ngay trong chiếc lá xếp hạng | Bên trong chiếc lá, một định danh mang tiền tố tranh giải phải là một trong bốn; khác đi là bị báo |
| Chép các định danh xếp hạng sang tệp khác | Ngoài chiếc lá, mọi định danh mang tiền tố đó bị báo ngay, nên bản đồ không thể bị trả lời lần thứ hai |
| Thêm nhà cung cấp từ bên trong chiếc lá biểu tượng | Luật nhà cung cấp cố tình không giữ miễn trừ cho chiếc lá, nên chiếc lá bị ràng buộc y như mọi tệp khác |

**Còn mở** — chỗ mù đã xuất xưởng. Một phán quyết không được nói rằng những chỗ này đã được xét.

| Luật | Cách viết KHÔNG bị bắt |
|---|---|
| `no-vendor-icon-outside-icon-leaf` | `require("lucide-react")`, `await import("lucide-react")`, và một thành phần nạp trễ dựng từ import động. Chỉ nút `ImportDeclaration` được duyệt |
| `no-vendor-icon-outside-icon-leaf` | `export { Caret } from "lucide-react"`. Xuất lại cũng mang nguồn, nhưng là loại nút khác, nên một tệp trung chuyển một dòng là giặt sạch cả gói |
| `no-vendor-icon-outside-icon-leaf` | Mọi thứ ngoài đoạn đường dẫn `/src/`. Một thư mục kiểu gói, một thư mục route ở gốc hay một workspace anh em đều không bị soi, và tệp ở đó nhập tự do rồi xuất lại dưới cái tên trung tính |
| `no-vendor-icon-outside-icon-leaf` | Một chiếc lá biểu tượng **thứ hai**. Cổng là phép so đuôi, nên bất kỳ thư mục nào kết thúc bằng `leaves/Icon/index.tsx` cũng được tự do y hệt chiếc lá thật |
| `heroicons-is-the-glyph-vendor` | Một bộ hình mà tên gói không mang sáu dấu hiệu tên nào và cũng không nằm trong danh sách — các gói pictogram, emoji và mark thường rơi đúng vào ô đó |
| `heroicons-is-the-glyph-vendor` | Tệp `.svg` cục bộ hoặc thành phần SVG viết tay. Nguồn tương đối bị loại trước mọi phép thử, nên cả một bộ từ vựng hình thứ hai có thể lắp hoàn toàn bằng tệp cục bộ |
| `heroicons-is-the-glyph-vendor` | `import type { Icon } from "lucide-react"` vẫn bị báo dù chẳng có gì được đóng gói ra — khiếm khuyết soi gương, một lần báo ở nơi không có escape nào |
| `no-off-scale-glyph-size` | Cỡ nguyên lệch thang. Mẫu chỉ nhận phân số thập phân hoặc giá trị trong ngoặc vuông, nên một cỡ cao hơn vai trò lớn nhất hai bậc, hay thấp hơn vai trò nhỏ nhất một bậc, đi qua im lặng. Đây chính là sai lầm mà luật sinh ra để chặn, viết theo cách dễ hơn |
| `no-off-scale-glyph-size` | Dạng hai tiện ích rộng-cao riêng, ở bất kỳ đơn vị nào, không phải tiện ích mà mẫu canh |
| `no-off-scale-glyph-size` | Object và mảng. Chuỗi lớp trong `{ icon: "…" }` hay `["…"]` không phải thuộc tính lớp mà cũng không phải hằng khởi tạo bằng chuỗi, nên chỗ gọn gàng nhất để cất chuỗi lớp là chỗ mù nhất |
| `no-off-scale-glyph-size` | Mọi hàm nối lớp — một helper, một bộ dựng biến thể, một danh sách có điều kiện. Tham số là một lời gọi hàm, và chuỗi tĩnh không bao giờ được rút ra từ đó |
| `no-off-scale-glyph-size` | Cỡ nội suy. Template có dù chỉ một biểu thức thì trả về rỗng, không còn gì để thử |
| `no-off-scale-glyph-size` | Kẻ vi phạm thứ hai trong cùng một chuỗi: phép so không toàn cục, nên chỉ một lần báo được xuất và phần còn lại của danh sách lớp không bao giờ được đọc tới |
| `no-decorative-icon-in-metric-cell` | Tên tệp. Luật chỉ tồn tại cho một đường dẫn; đổi tên tệp, hoặc chuyển phần đánh dấu sang tệp anh em cùng thư mục, là xoá được luật mà không chạm một dòng nào vào luật |
| `no-decorative-icon-in-metric-cell` | Mọi thẻ không đúng chữ `Icon`: bí danh lúc nhập, gọi qua thuộc tính của object, một thành phần tile hay badge tự vẽ hình bên trong, hay một hình truyền xuống bằng prop |
| `no-decorative-icon-in-metric-cell` | Mọi ô dữ kiện gọn khác trong sản phẩm. Luật viết chung cho mọi ô; máy giữ đúng một tệp, còn ô số liệu thứ mười viết tuần sau nằm ngoài theo mặc định |
| `rank-artwork-is-a-closed-set` | Định danh ghép bằng template. Dựng chuỗi từ số thứ hạng làm cả hai nhánh biến mất cùng lúc — tập đóng và quyền sở hữu — mà đó lại là cách tự nhiên nhất để viết một bản đồ hạng-sang-tranh |
| `rank-artwork-is-a-closed-set` | Một bộ sưu tập tranh khác. Chỉ một tiền tố được nhận ra, nên huy chương hay cúp lấy từ bộ sưu tập khác trong cùng catalog lọt cả trong lẫn ngoài chiếc lá |
| `rank-artwork-is-a-closed-set` | Tệp kiểm thử, theo tên. Miễn trừ có lập luận nhưng không có biên: mọi tệp kết thúc `.test.tsx` ở bất kỳ đâu đều được gọi tên bất kỳ định danh nào |
| `rank-artwork-is-a-closed-set` | Một chiếc lá xếp hạng thứ hai, theo đúng lối so đuôi đường dẫn như chiếc lá biểu tượng |
| không luật nào | Mọi thứ mà `ICON-2`, `ICON-3`, `ICON-4`, `ICON-11` và `ICON-13` phát biểu — vai trò nào đi với cỡ nào, hình vai trò dẫn dắt ở cỡ năm trên mỗi ô, và tập định danh phản ứng đã đóng. Có tài liệu, có kiểu, có xuất ra, không được thực thi |

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc |
|---|---|
| đường dẫn tệp | `context.filename` (hoặc `getFilename()`), đã chuẩn hoá sang dấu chéo xuôi |
| nguồn nhập | giá trị chuỗi trên một `ImportDeclaration` |
| chuỗi lớp | chuỗi tĩnh rút từ thuộc tính lớp hoặc từ khởi tạo của một biến |
| tên phần tử | `JSXIdentifier` trên một `JSXOpeningElement` |
| giá trị chuỗi | mọi `Literal` chuỗi trong tệp |

## Quy tắc

1. Danh tính của một luật là **tên công bố** của nó; ở đây không đặt thêm số cho luật nào.
2. Phát hiện thuần cú pháp: không phân giải mô-đun, không hỏi kiểu, không chạy mã.
3. Một tệp chỉ vào phạm vi khi đường dẫn có `/src/` — trừ luật ô số liệu, vốn tự có cổng đường dẫn
   riêng và không gì khác.
4. Mọi miễn trừ là một **cặp**: một tệp **và** một giá trị. Không tệp nào được miễn trọn một luật.
5. Cổng đường dẫn là phép so đuôi, nên nó đặt tên cho một **hình dạng đường dẫn**, không phải một tệp
   duy nhất.
6. Mức nghiêm mà mô-đun tự đề nghị là `error` cho cả năm; cấu hình của kho tiêu thụ mới là nơi quyết
   định thật sự bật cái gì.

## Ngoại lệ

Mỗi miễn trừ đều đóng, và đều được viết dưới dạng một cặp.

- **Chiếc lá biểu tượng** chỉ được miễn luật dành cho chỗ gọi. Nó được gọi tên một gói hình; nó không
  được gọi tên một gói ngoài hai họ đã duyệt, vì luật nhà cung cấp không giữ miễn trừ cho chiếc lá —
  đó là chủ ý, vì escape nguy nhất đến từ người tin mình có thẩm quyền.
- **Chiếc lá xếp hạng** được miễn cả hai luật nhập, cho đúng một gói. Gói khác từ tệp đó, hoặc gói đó
  từ tệp khác, vẫn bị báo.
- **Bốn định danh tranh giải** là toàn bộ từ vựng của chiếc lá xếp hạng. Cái thứ năm bị báo là
  `unknown`; một trong bốn nêu ở nơi khác bị báo là `outside`.
- **Tệp kiểm thử** được miễn luật tranh giải, để một bài kiểm thử sinh đôi chứng minh được tập đã đóng
  bằng cách gọi tên cả cái ở trong lẫn cái ở ngoài.
- **Mọi thứ ngoài `/src/`** không bị bốn trong năm luật soi tới. Đây là một quyết định phạm vi, không
  phải một giấy phép, và nó là cửa mở rộng nhất trên kệ này.

## Đầu ra

Một khối cho mỗi lần báo:

```text
rule:    <published rule name>
file:    <path as the gate saw it>
scope:   <in | out — the gate that decided it>
node:    <ImportDeclaration | JSXAttribute | VariableDeclarator | JSXOpeningElement | Literal>
value:   <the literal string that matched>
message: <vendor | offScale | decorative | unknown | outside | none>
hatch:   <the open hatch that would have hidden this, or none>
```

Một tệp trong phạm vi mà sạch thì xuất một khối với `scope: in`, `message: none` và cửa mở gần đúng
nhất. Một tệp ngoài phạm vi xuất `scope: out` kèm cổng đã loại nó và `message: none` — nó chưa được
xét, chứ không phải đã được tha.

## Ví dụ đã giải

**Đầu vào.** Một tệp block, `components/blocks/LeaderboardRow/index.tsx`:

```tsx
import { Flame } from "lucide-react"
import { Iconify } from "@/components/leaves/Iconify"

const GLYPH = "shrink-0 size-[18px] text-current"

export const LeaderboardRow = ({ place }: Props) => (
  <div className="flex items-center gap-2">
    <Flame className={GLYPH} />
    <Iconify icon="fluent-emoji-flat:1st-place-medal" className="size-5" />
  </div>
)
```

Đường dẫn có `/src/`, không phải chiếc lá biểu tượng, không phải chiếc lá xếp hạng và không phải tệp
kiểm thử, nên bốn trong năm luật được lắp. Luật ô số liệu thì không: đường dẫn này không kết thúc bằng
`/composites/LabelledProgressRow/index.tsx`, nên bộ duyệt của nó còn chưa từng được tạo ra.

```text
rule:    no-vendor-icon-outside-icon-leaf
file:    src/components/blocks/LeaderboardRow/index.tsx
scope:   in — contains /src/, does not end with /leaves/Icon/index.tsx
node:    ImportDeclaration
value:   lucide-react
message: vendor
hatch:   none
```

```text
rule:    heroicons-is-the-glyph-vendor
file:    src/components/blocks/LeaderboardRow/index.tsx
scope:   in — contains /src/
node:    ImportDeclaration
value:   lucide-react
message: vendor
hatch:   none
```

Một câu `import` sai từ một tệp thường bị báo hai lần, với hai thông điệp khác nhau. Đó là thiết kế,
không phải cấu hình bị lặp.

```text
rule:    no-off-scale-glyph-size
file:    src/components/blocks/LeaderboardRow/index.tsx
scope:   in — contains /src/
node:    VariableDeclarator
value:   shrink-0 size-[18px] text-current
message: offScale
hatch:   none
```

```text
rule:    rank-artwork-is-a-closed-set
file:    src/components/blocks/LeaderboardRow/index.tsx
scope:   in — contains /src/, does not match /\.test\.tsx?$/, not the rank leaf
node:    Literal
value:   fluent-emoji-flat:1st-place-medal
message: outside
hatch:   none
```

**Sau khi sửa.** Chỗ gọi nêu một ý nghĩa và một vai trò, rồi trao thứ hạng cho chiếc lá xếp hạng:

```tsx
import { Icon } from "@/components/leaves/Icon"
import { RankMark } from "@/components/leaves/RankMark"

const GLYPH = "shrink-0 size-9 text-current"

export const LeaderboardRow = ({ place }: Props) => (
  <div className="flex items-center gap-2">
    <Icon props={{ name: "streak", role: "leading" }} className={GLYPH} />
    <RankMark props={{ place }} />
  </div>
)
```

Hai lần báo về nhập và một lần báo về tranh giải đã mất. Lần báo về cỡ thì không được sửa — nó bị che:

```text
rule:    no-off-scale-glyph-size
file:    src/components/blocks/LeaderboardRow/index.tsx
scope:   in — contains /src/
node:    VariableDeclarator
value:   shrink-0 size-9 text-current
message: none
hatch:   an integer size off the scale matches neither the decimal-fraction nor the bracket branch of the pattern, so the same mistake written the easier way is invisible rather than compliant
```

## Phạm vi

Tài liệu này ghi mức thực thi, không ghi luật. Nó không ghi luật nào "đáng lẽ nên có": một luật không
chỉ tay vào được thì là một đề xuất, không phải một cổng. Tên luật, mã thông điệp, biểu thức chính quy
và các chuỗi đường dẫn là định danh có mặt trong bản build và được chép lại nguyên văn; mọi thứ viết
quanh chúng chỉ là đánh dấu thường và lời gọi thường. Một ý nghĩa có thuộc về bản đồ hay không, một vai
trò có xứng một cỡ hay không, và một ô hình có cần hình hay không đều là quyết định do văn bản luật sở
hữu, không máy nào ở đây giữ chúng.
