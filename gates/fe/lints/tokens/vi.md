---
title: Tokens · Vietnamese
---

# Biến thiết kế

Đầu vào là code đã viết rồi — một file, một khúc diff. Đầu ra là một **phán quyết**: với mỗi phát
hiện, rule nào đã bắn, nó thi hành mã luật nào, bắn trên nút nào, và khớp đúng đoạn chữ nào. Mô-đun
này không chọn gì cả. Nó từ chối, và nó phải chỉ được vào đúng ký tự mà nó từ chối.

## Luật

Luật biến thiết kế được giữ bằng một union đóng trước đã. Mọi tầng phía trên lá đều lấy class từ một
mục đã định kiểu, nên một giá trị lệch thang ở đó không phải chờ review mới hỏng — nó không biên dịch
được, và chẳng còn gì để một rule đi tuần.

Mấy rule này tồn tại cho đúng một chỗ mà union không với tới: thư mục lá, nơi tự viết chuỗi class của
mình và được chính sách miễn khỏi luật của mục định kiểu. Đó là chỗ một bước thập phân, một độ dài
trong ngoặc vuông, hay một tiêu đề lắp tay vẫn gõ được và vẫn qua được trình biên dịch.

Hai sự thật đi ra từ đó, và cả hai định hình mọi rule bên dưới.

**Chúng đọc cả hằng số chứ không chỉ markup.** Giá trị lệch thang cuối cùng trong đoạn source mà mấy
rule này được viết cho nằm trong một hằng số của module, chỗ mà mọi rule chỉ đi trên thuộc tính JSX
đều nhìn xuyên qua. Nhấc một giá trị ra ngoài là **giấu** nó đi, không phải **cho phép** nó.

**Có một rule kiểm tra một lời hứa, không phải một hình dạng.** Một class gọi tên biến chủ đề là một
**yêu cầu** tới một biến CSS. Khi biến đó không tồn tại thì class vẫn được phát ra, phần tử vẫn vẽ
được, và union vẫn thoả — đúng loại giá trị chết mà một kiểu đóng không bắt được.

Luật mà chúng thi hành mang tiền tố `TOKEN-` và thuộc sở hữu của khuôn mẫu tokens, không thuộc file
này. Tên rule là danh tính duy nhất của mô-đun này; mã luật chỉ là một ánh xạ, không phải một cái tên
thứ hai.

## Luật máy đã xuất bản

| Rule | Mã luật | Nó báo cái gì |
|---|---|---|
| `no-fractional-step` | `TOKEN-3` | Phép đo thập phân **đầu tiên** trong một chuỗi class tĩnh — `gap-1.5`, `p-2.5`, `size-3.5` — và gọi tên class đã khớp trong thông điệp |
| `no-arbitrary-value` | `TOKEN-4` | Hai thông điệp riêng biệt từ cùng một chuỗi: một độ dài trong ngoặc vuông thuộc họ khoảng cách hoặc kích thước, và một màu hex `#` thuộc họ màu |
| `no-hand-rolled-heading` | `TOKEN-5` | Một thông điệp khi một cỡ chữ lớn và một độ đậm nặng cùng nằm trong một chuỗi class tĩnh; không gọi tên class nào, vì phát hiện chính là **cặp** đó |
| `no-unresolved-token-class` | `TOKEN-9` | Mỗi class gọi tên một biến chủ đề mà biến CSS của nó không được khai báo ở đâu trong stylesheet nó tìm thấy, gọi tên cả class lẫn biến bị thiếu |

Bốn rule được xuất bản, mỗi mã một rule, và file xuất ra đúng bốn.

Năm mã trong luật hoàn toàn không có rule nào, và đó là một quyết định chứ không phải một lỗ hổng.
`TOKEN-1` và `TOKEN-2` do union giữ và không cần rule. `TOKEN-6` là câu giải thích vì sao file này tồn
tại. `TOKEN-7` và `TOKEN-8` là luật không có máy — chúng do người soát, và người đọc không được hiểu
sự im lặng ở đây là được phép.

## Đọc một diff

1. **Kiểm cổng trước.** Nếu đường dẫn file không chứa `/src/` thì không rule nào ở đây chạy. File đó
   không sạch, nó **chưa được xét**. Phải nói rõ là cái nào, vì trong báo cáo hai thứ đó giống hệt nhau.
2. **Gom chữ class tĩnh**, không chỉ trong markup: thuộc tính class, giá trị khởi tạo của một biến, và
   thuộc tính `classes` đều mang nó.
3. **Chạy từng rule trên phần chữ nó đọc được.** Một chuỗi có thể sinh phát hiện từ nhiều rule, và
   riêng `no-arbitrary-value` có thể tự sinh hai.
4. **Mỗi phát hiện phát ra một khối phán quyết**, gọi tên đoạn chữ đã khớp. Một phát hiện mà người đọc
   không định vị được thì không phải phát hiện.
5. **Khi chữ không tĩnh, ghi là chưa đọc được chứ không phải sạch.** Một phép nội suy, một hàm gộp
   class hay một phép nối chuỗi làm cả chuỗi tàng hình với mọi rule ở đây.
6. **Không nới một rule sang trường hợp nó không gọi tên.** Những lỗ hổng mở bên dưới là hành vi đã
   xuất xưởng; một phán quyết báo trúng một trong số đó là phán quyết sai về cái máy.

## `no-fractional-step` — TOKEN-3

**Nó báo cái gì.** Phép đo thập phân đầu tiên trong một chuỗi class tĩnh, gọi tên class đã khớp.

**Nó phát hiện bằng gì.** Một regex trên phần chữ đã ghép: một danh sách 25 tên họ — `gap`, `gap-x`,
`gap-y`, `p`, `px`, `py`, `pt`, `pb`, `pl`, `pr`, `m`, `mx`, `my`, `mt`, `mb`, `ml`, `mr`, `space-x`,
`space-y`, `inset`, `top`, `bottom`, `left`, `right`, `size`, `w`, `h` — theo sau bởi `-\d+\.\d+`, hai
đầu chặn bằng `\b`. Nó dùng `String.match`, nên chỉ báo lần khớp đầu tiên.

**Nó không thấy gì.** Bốn họ kích thước vắng mặt trong danh sách: `min-w-3.5`, `min-h-1.5`,
`max-w-2.5` và `max-h-1.5` là bước thập phân thuộc những họ mà regex không gọi tên. Các thuộc tính
logic và theo trục cũng vắng — `ps-1.5`, `pe-1.5`, `ms-1.5`, `me-1.5`, `inset-x-1.5`, `inset-y-1.5`.
Và vì `match` trả về lần khớp đầu, `"gap-1.5 p-2.5 size-3.5"` chỉ báo một lần: ba lượt mới dọn xong
một chuỗi, còn tác giả sửa đúng class được gọi tên rồi thấy hiện thông điệp mới thì có quyền hiểu là
rule đã bỏ sót lần trước.

**Ranh giới.** Độ dài trong ngoặc vuông là `TOKEN-4`, không phải rule này. Rule này chỉ thấy một bước
thập phân trong một họ có tên.

## `no-arbitrary-value` — TOKEN-4

**Nó báo cái gì.** Hai thông điệp độc lập từ cùng một chuỗi: một độ dài trong ngoặc vuông thuộc họ
khoảng cách hoặc kích thước, và một màu hex thuộc họ màu.

**Nó phát hiện bằng gì.** Hai regex trên cùng một đoạn chữ. Regex độ dài gọi tên 21 họ — bộ khoảng
cách và kích thước cộng thêm `min-w`, `min-h`, `max-w`, `max-h`, trừ đi nhóm định vị — theo sau bởi
`-\[` cho tới dấu `]` đầu tiên. Regex màu gọi tên `text`, `bg`, `border`, `ring`, `from`, `to`, `via`,
`fill`, `stroke`, `shadow` và `decoration`, theo sau bởi đúng ba ký tự `-[#` và một chữ số hex.

**Nó không thấy gì.** Kiểu chữ, giãn chữ, giãn dòng, lưới, thời lượng và tỷ lệ dùng ngoặc vuông thoải
mái: `text-[28px]`, `tracking-[0.2em]`, `leading-[1.15]`, `grid-cols-[14rem_1fr]`, `duration-[250ms]`,
`aspect-[4/3]` đều không nằm trong danh sách nào và đều không mang `#`. Một màu thô không phải hex thì
ở đây không tính là màu thô: `bg-[rgb(37,99,235)]`, `text-[hsl(210_20%_98%)]` và
`shadow-[0_1px_2px_rgba(0,0,0,.08)]` đều thoát khỏi bảng màu và đều qua. Còn style nội tuyến thì không
phải class: `style={{padding: "6px", color: "#2563eb"}}` là cách trực tiếp nhất để viết đúng cả hai
thứ rule này cấm.

**Ranh giới.** Tên rule hứa cả hệ thống; regex của nó phủ khoảng cách, kích thước và màu hex. Cái gì
ngoài những họ đó thì không phải sự im lặng của rule này phải giải thích.

## `no-hand-rolled-heading` — TOKEN-5

**Nó báo cái gì.** Một thông điệp khi một cỡ chữ lớn và một độ đậm nặng cùng nằm trong một chuỗi class
tĩnh. Nó không gọi tên class nào, vì phát hiện là **cặp**, không phải từng nửa.

**Nó phát hiện bằng gì.** Hai regex, cả hai đều phải `test` đúng trên cùng một chuỗi:
`text-(xl|2xl|3xl|4xl|5xl)` và `font-(bold|extrabold|black)`.

**Nó không thấy gì.** `font-semibold` ở đây không phải độ đậm nặng, nên `text-2xl font-semibold` — cách
viết tiêu đề lắp tay phổ biến nhất trong source thường — không bắn. Danh sách cỡ dừng ở `5xl`, nên
`text-6xl font-bold` qua được, còn `text-[2rem] font-bold` thì không rule nào trên kệ này nhìn thấy.
Cặp đó cũng phải nằm trong một chuỗi: cỡ ở cha còn độ đậm ở con, cỡ trong hằng số còn độ đậm ở chỗ gọi,
hay một thẻ `<strong>` cấp độ đậm bằng chính thẻ — mỗi nửa đứng riêng đều hợp lệ.

**Ranh giới.** Từng nửa một mình không phải vi phạm, và không rule nào ở đây nâng nó lên thành vi phạm.

## `no-unresolved-token-class` — TOKEN-9

**Nó báo cái gì.** Mỗi class gọi tên một biến chủ đề mà biến CSS của nó không được khai báo ở đâu
trong stylesheet rule tìm thấy, gọi tên cả class lẫn biến bị thiếu.

**Nó phát hiện bằng gì.** Hệ thống tệp, không phải AST. Từ thư mục của file đang lint, nó đi ngược lên
tối đa 12 tầng, mỗi tầng thử `existsSync` với năm đường dẫn tương đối — `src/app/globals.css`,
`apps/app/src/app/globals.css`, `apps/expert/src/app/globals.css`, `apps/landing/src/app/globals.css`,
`packages/ui/src/styles/globals.css` — đọc và ghép mọi file tìm được, có nhớ đệm theo thư mục cho cả
lượt chạy. Không tìm thấy gì thì rule trả về `{}`. Ngược lại nó tách chữ class theo khoảng trắng, bóc
**một** tiền tố biến thể `[a-z-]+:` và **một** dấu `!` ở đầu, rồi thử ba khuôn: `^max-w-app-(...)$`,
`^max-h-(...)$`, `^min-h-(...)$`. Phần bắt được nằm trong tập dành riêng — `screen full fit auto none
min max prose dvh svh lvh dvw svw lvw px` — thì bỏ qua. Còn lại, biến suy ra là `--container-app-<n>`,
`--max-height-<n>` hoặc `--min-height-<n>`, và được tìm bằng `String.includes` trên chữ của stylesheet.

**Nó không thấy gì.** Không có stylesheet thì không có rule: nếu trong 12 tầng không có ứng viên nào
tồn tại, rule không báo gì, và điều đó không phân biệt được với một lượt chạy sạch. Chỉ ba họ được
kiểm, nên một biến chết kiểu `w-app-*`, `rounded-*`, `shadow-*`, `text-*` hay `gap-*` — cùng một loại
hỏng, cùng một sự im lặng — nằm ngoài phạm vi, và `max-w-*` không có đoạn `app-` cũng vậy. Biến thể thứ
hai làm nó tắt, vì chỗ bóc chỉ bóc một tiền tố `[a-z-]+:`: `lg:hover:min-h-panel` vẫn còn `hover:` khi
khuôn neo hai đầu chạy, còn `2xl:min-h-panel` thì không bao giờ được bóc. Cuối cùng, **được dùng cũng
tính là được khai báo**: phép kiểm là `String.includes`, nên một chỗ tham chiếu `var(--min-height-panel)`,
một dòng khai báo đã bị chú thích, hay một cái tên dài chứa cái tên ngắn đều làm nó đọc thành đã khai báo.

**Ranh giới.** Đây là rule duy nhất ở đây kiểm một lời hứa thay vì một hình dạng, và cũng là rule duy
nhất lấy bằng chứng từ bên ngoài file đang lint.

## Cách phát hiện

Ba trong bốn rule dùng chung một cái máy; hiểu nó là hiểu ba phần tư kệ này.

| Bộ phận | Cơ chế |
|---|---|
| cổng dùng chung | `context.filename` được chuẩn hoá sang dấu gạch chéo xuôi rồi kiểm bằng `.includes("/src/")`. File nào có đường dẫn không chứa đoạn đó thì không nhận visitor nào — mọi rule ở đây trả về `{}` |
| bộ duyệt dùng chung | Ba visitor: `JSXAttribute` với `node.name.name` đúng bằng `className` hoặc `class`; mọi `VariableDeclarator`, đọc `node.init`; và `Property` với `node.computed` bằng false và `node.key.type === "Identifier"` mang `node.key.name === "classes"` |
| bộ đọc dùng chung | Một nút chỉ nhả ra chữ khi nó là `Literal` chuỗi, một `TemplateLiteral` có `expressions.length === 0`, một `JSXExpressionContainer` bọc một trong hai thứ đó, hoặc một `ArrayExpression` mà các phần tử rút được về chữ rồi ghép bằng đúng một dấu cách. Mọi thứ khác nhả ra `null` |

## Lối thoát hợp lệ

**Đã đóng** — người đọc có thể tưởng mấy cách viết này lọt, nhưng không.

| Viết kiểu này | Vì sao vẫn bắn |
|---|---|
| `const GLUE = "inline-flex gap-1.5"` | Visitor `VariableDeclarator` đọc giá trị khởi tạo của mọi khai báo, dù có markup hay không. Đây chính là ca mà mấy rule này được viết ra để bắt |
| `["flex", "p-1.5"]` | Các phần tử `ArrayExpression` được rút gọn và ghép bằng dấu cách trước khi bất kỳ regex nào chạy |
| `{classes: ["gap-4", "size-3.5"]}` | Visitor `Property` khớp khoá `classes` và đọc mảng của nó y hệt |
| `` const G = `gap-1.5` `` | `TemplateLiteral` không có biểu thức được đọc như chữ |
| `md:gap-1.5`, `hover:p-2.5` | `\b` khớp ngay sau dấu `:`, nên tên họ vẫn neo được |
| `!py-1.5` | Cùng ranh giới đó; `!` không phải ký tự từ |
| `-mt-1.5` | Cùng ranh giới đó; dấu gạch trước `mt` không phải ký tự từ |
| Viết `class` thay vì `className` | Phép kiểm tên thuộc tính chấp nhận cả hai cách viết |
| `["text-2xl", "font-bold"]` | Các phần tử được ghép trước, nên cả hai regex tiêu đề cùng nhìn một chuỗi |
| `lg:max-w-[62rem]` | Regex độ dài không neo hai đầu nên khớp được ở giữa chuỗi |
| `min-h-screen` | Cố tình bỏ qua ở `no-unresolved-token-class`. Đó là cái tên do chính framework phân giải, báo nó lên là đẩy tác giả đi khai một biến chẳng ai đọc |

**Còn mở** — chỗ mù đã xuất xưởng. Một phán quyết không được nhận là đã xét mấy chỗ này.

| Phạm vi | Cái gì lọt |
|---|---|
| cả bốn | **Một phép nội suy giặt sạch cả chuỗi.** `TemplateLiteral` có bất kỳ biểu thức nào cũng nhả `null`, nên `` className={`gap-1.5 ${extra}`} `` là tàng hình — kể cả phần chữ tĩnh mà lẽ ra đứng một mình đã hỏng |
| cả bốn | **Hàm gộp class là một bức tường.** `className={cn("p-1.5", state)}` là `CallExpression`; bộ đọc không có nhánh nào cho nó. Đây là cách viết class có điều kiện thông thường, nên nó không phải mánh né — nó là mặc định |
| cả bốn | **Mọi khoá đối tượng không phải `classes`.** `const S = {root: "gap-1.5"}` lọt, và đặt khoá trong nháy hay khoá tính toán — `{"classes": …}`, `{["classes"]: …}` — cũng tắt rule bằng đúng hai chốt chặn đó |
| cả bốn | **Bản đồ slot không phải thuộc tính class.** `classNames={{base: "p-1.5"}}` trượt phép kiểm tên, và giá trị đối tượng của nó dù sao cũng nhả `null` |
| cả bốn | **Chặn theo tên file.** Mọi thứ gác ở chỗ đường dẫn phải chứa `/src/`, và phân biệt hoa thường. Một package để source ở `lib/`, một cây tài liệu hay story, hoặc `/Src/` trên hệ tệp không phân biệt hoa thường đều nằm ngoài phạm vi một cách im lặng, không thông điệp nào nói ra |
| cả bốn | **Phép nối chuỗi.** `"gap-" + step` là `BinaryExpression` còn `[wide && "p-1.5"]` là `LogicalExpression`; cả hai nhả `null`, và trong ca mảng thì các phần tử còn lại vẫn được kiểm, nên file báo sạch trên một lượt đọc dở dang |

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc |
|---|---|
| tên file | `context.filename`, đã chuẩn hoá; phải chứa `/src/` |
| chữ class | Một chuỗi tĩnh tới được từ thuộc tính class, giá trị khởi tạo của một biến, hoặc thuộc tính `classes` |
| stylesheet | Chỉ dành cho `no-unresolved-token-class`: chữ của mọi stylesheet ứng viên tìm được phía trên file |

## Quy tắc

1. Một rule chỉ báo thứ nó chỉ được vào trong chữ tĩnh của **một** nút; nó không bao giờ suy diễn bắc
   cầu qua nhiều nút.
2. Một file nằm ngoài cổng source không sinh phát hiện nào từ bất kỳ rule nào ở đây — không phải một
   tập phát hiện thiếu.
3. Một rule không có bằng chứng thì im, chứ không báo tất cả lên như đều đáng ngờ.
4. Tên rule đã xuất bản là danh tính duy nhất của rule. Mã luật nó thi hành là một ánh xạ, không phải
   một cái tên thứ hai.
5. Không rule nào ở đây có thẩm quyền với những tầng mà union đã giữ.

## Ngoại lệ

- **Tên của chính framework.** Ở `no-unresolved-token-class`, phần bắt được nằm trong tập dành riêng
  phân giải được mà không cần biến chủ đề, nên được bỏ qua có chủ ý chứ không phải do sót.
- **Thiếu stylesheet.** Cũng rule đó tự tắt mình thay vì tuyên bố mọi biến đều chết. Nó được ghi thành
  lỗ hổng mở ở trên vì im lặng và sạch sẽ trông giống hệt nhau.
- **Chữ không tĩnh.** Mọi rule coi một biểu thức không đọc được là **vắng mặt**, không bao giờ coi là
  một phát hiện. Chính lựa chọn đó làm cho lỗ hổng hàm gộp class là không tránh được ở thiết kế này.

## Đầu ra

Mỗi phát hiện một khối:

```text
rule: <no-fractional-step | no-arbitrary-value | no-hand-rolled-heading | no-unresolved-token-class>
code: <TOKEN-3 | TOKEN-4 | TOKEN-5 | TOKEN-9>
node: <JSXAttribute | VariableDeclarator | Property>
matched: <class được thông điệp gọi tên, hoặc cặp, hoặc biến bị thiếu>
```

File không có phát hiện thì không phát khối nào. File nằm ngoài cổng cũng không phát khối nào, và hai
kết quả đó không phải một.

## Ví dụ đã giải

**Đầu vào.** Một file lá ở `src/components/leaves/Row/index.tsx`:

```tsx
const GLUE = "inline-flex gap-1.5"

export function Row({label, children}) {
  return (
    <div className={GLUE}>
      <span className={cn("p-1.5", label && "font-bold")}>{label}</span>
      {children}
    </div>
  )
}
```

Đường dẫn có chứa `/src/` nên cổng mở và mọi rule đều chạy.

```text
rule: no-fractional-step
code: TOKEN-3
node: VariableDeclarator
matched: gap-1.5
```

Chỉ có đúng khối đó. Cái `p-1.5` ở dòng dưới cũng là bước thập phân trong một họ có tên mà vẫn không
bị báo: nó nằm trong `cn(...)`, một `CallExpression` mà bộ đọc không có nhánh nào, nên cả chuỗi nhả
`null`. Phán quyết nói file có một phát hiện; nó không nói file sạch.

Sửa xong, khai báo hằng số trở về đúng thang và rule im:

```tsx
const GLUE = "inline-flex gap-2"
```

Lời gọi `cn(...)` không đổi và vẫn chưa được đọc. Dọn sạch kệ này không đồng nghĩa với dọn sạch luật —
`TOKEN-3` ở đây chỉ được thi hành ở chỗ chữ là tĩnh.

## Phạm vi

Mô-đun này chỉ ghi phần thi hành. Nó không gọi tên sản phẩm nào và repository nào; các tên rule là
chuỗi đã xuất xưởng và được chép lại nguyên văn. Biến thiết kế **là gì**, và giá trị nào thuộc thang
nào, là quyết định của khuôn mẫu tokens chứ không phải của file này.
