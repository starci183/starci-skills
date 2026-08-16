---
id: fe-lints-typography-vi
title: vi.md
slug: /fe/lints/typography/vi
sidebar_label: vi.md
sidebar_position: 1
description: Luật lint của typography — bắt gì, giữ mã nào, phát hiện bằng gì, và cửa nào còn mở.
---

# vi.md

> Version: `2.00` · Mô-đun: `typography`

# Máy giữ luật typography

Luật nói: chữ mang **thứ bậc**, và một tiêu đề không phải một cỡ đứng cạnh một độ đậm — nó là một
**bậc**, và bậc đó quyết định cả cái thẻ mà trình đọc màn hình dựng dàn ý, lẫn cái cỡ mà người đọc
nhìn thấy.

Phần lớn luật này là một **tập đóng** nằm trên hai thành phần chữ, và tập đóng thì không cần lint:
hệ thống kiểu đã từ chối bậc thứ năm, đã từ chối một độ đậm đẩy thêm lên tiêu đề.

Thứ mà không kiểu nào nhìn thấy là một **thẻ tiêu đề viết tay**. Một tệp không hề nhắc tới thành
phần tiêu đề, chỉ viết `<h2 className="text-2xl font-bold">`, thì kiểm kiểu xanh sạch — trong khi
vừa thêm một dòng vào dàn ý mà thang chữ chưa bao giờ cho phép.

Tài liệu này không chép lại luật. Nó ghi **mức thực thi**: luật lint nhìn vào cú pháp nào, và quan
trọng hơn, viết kiểu gì thì nó **không** nhìn thấy.

Mô-đun luật công bố **một** luật, và ở đây ghi đúng một. Tên của luật chính là danh tính của nó —
đó là chuỗi in ra trong log build và chuỗi viết trong dòng tắt luật — nên ở đây không đặt thêm số
cho nó.

## Bảng tra nhanh

| Luật | Mã luật | Bắt gì |
|---|---|---|
| `no-heading-tag-outside-heading-component` | `TYPESET-1` (thông điệp `tag`) và `TYPESET-2` (thông điệp `tooDeep`) | Một thẻ `h1`–`h6` viết thường, mở ra trong tệp nguồn không phải tệp kiểm thử và không phải chiếc lá tiêu đề. `h1`–`h4` báo `tag`; `h5`–`h6` báo `tooDeep` |

---

## `no-heading-tag-outside-heading-component`

**Bắt gì.** Một thẻ tiêu đề nội tại — `h1`, `h2`, `h3`, `h4`, `h5`, `h6` — được mở ra bằng tay ở một
tệp nguồn bất kỳ, trừ tệp kiểm thử và trừ thư mục chiếc lá tiêu đề. Viết như vậy là tách rời hai dữ
kiện vốn là một: cái thẻ dựng dàn ý và cái cỡ người đọc thấy. Tách ra thì chúng trôi, và dòng chữ to
thứ ba trên màn hình trở thành tiêu đề số một của trang.

Luật có **hai** thông điệp, chọn bằng một phép so duy nhất trên độ sâu:

- `tag` — cho `h1` đến `h4`: hãy dựng thành phần tiêu đề với một bậc; một prop quyết cả hai thứ nên
  chúng không thể mâu thuẫn.
- `tooDeep` — cho `h5` và `h6`: thang dừng ở bốn, nên bậc thứ năm không phải chuyện cỡ chữ mà là
  chuyện **cấu trúc** — phần nội dung đã lồng sâu hơn mức người đọc giữ nổi trong đầu. Hãy làm phẳng
  phần đó trước, rồi mới đặt tiêu đề bằng một bậc mà thang có.

**Giữ mã nào.** `TYPESET-1` cho thông điệp `tag`, `TYPESET-2` cho thông điệp `tooDeep`. Đây không
phải ánh xạ bịa ra ở đây: câu chữ của hai thông điệp là câu chữ của hai mã đó, gần như nguyên văn.
Một luật giữ hai mã, và cả hai đều chỉ tay được vào văn bản luật.

**Cách phát hiện.** Cổng tệp chạy **một lần** trong `create`, không phải trên từng nút: lấy
`context.filename` (dự phòng `context.getFilename()`), đổi hết dấu chéo ngược thành chéo xuôi, rồi
ba phép thử — đường dẫn phải chứa `/src/`; không được kết thúc bằng `.test.ts`, `.test.tsx`,
`.spec.ts` hay `.spec.tsx`; và không được chứa `/src/components/leaves/Heading/`. Trượt một phép
thử là `create` trả về object rỗng, tức là luật **không được lắp** cho tệp đó.

Qua được cổng thì luật duyệt nút `JSXOpeningElement`. Tên thẻ chỉ được lấy khi `node.name` có
`type === "JSXIdentifier"` **và** chuỗi tên bằng đúng dạng viết thường của chính nó; mọi trường hợp
khác trả `null`. Đây là toàn bộ phép phân biệt "thẻ nội tại" với "thành phần". Tên lấy được phải nằm
trong tập sáu thẻ tiêu đề. Cuối cùng, `Number(tag.slice(1))` so với hằng `4`: lớn hơn thì báo
`tooDeep`, còn lại báo `tag`.

Không thuộc tính nào được đọc. Không câu nhập nào được lần theo. Không kiểu nào được hỏi.

**Vì sao luật này đáng có máy giữ.** Vì đây đúng là chỗ mà kiểu dữ liệu mù. Tập bậc đóng chỉ bảo vệ
được những người **đã** gọi thành phần tiêu đề; nó không nói được gì về một tệp chưa từng nhắc tới
thành phần đó. Một `<h2>` viết tay đi qua kiểm kiểu, đi qua mọi luật canh prop, và đi thẳng vào dàn
ý mà không ai duyệt.

Chú ý thêm: luật này chỉ giữ **một trong hai** cách một tiêu đề bị dựng tay. Cách còn lại — tiêu đề
lắp từ một cỡ to cộng một độ đậm nặng trên một thẻ khác — do luật sinh đôi ở mô-đun luật khác giữ,
nên nó được ghi ở kệ của mô-đun đó chứ không phải ở đây. Hai luật cộng lại phủ được "đúng thẻ, sai
dáng" và "đúng dáng, không thẻ". Khe giữa chúng thì xem mục dưới.

**Cửa còn mở.** Rộng nhất là **thẻ động**: `const Tag = "h2"` rồi `<Tag>` — tên là `JSXIdentifier`
nhưng `"Tag"` không bằng `"tag"`, nên phép thử nội tại trả `null` và luật không hề thấy tiêu đề nào.
Đây không phải phá hoại: viết hoa là **cách duy nhất** để dùng một thẻ nội tại tính được trong JSX,
nên thành ngữ chuẩn để đổi bậc tiêu đề theo biến rơi đúng vào điểm mù.

Ngoài ra: `createElement("h2", …)` không sinh nút JSX nào; một chuỗi HTML nhét qua
`dangerouslySetInnerHTML` chỉ là `Literal`; một đường ống markdown hay MDX biến `## Tiêu đề` thành
`h2` lúc build mà không tệp nào có thẻ; mọi tệp không nằm dưới `/src/` hoàn toàn không bị lắp luật;
miễn trừ tệp kiểm thử chỉ theo **tên** nên mọi tệp `.test.tsx` ở bất kỳ đâu đều được viết thẻ tiêu
đề tuỳ ý; cổng chiếc lá là phép so **chuỗi con** nên bất kỳ thư mục nào chứa
`/src/components/leaves/Heading/` — kể cả một chiếc lá thứ hai ở nơi khác — đều nhận nguyên quyền
của bản gốc; `<Tags.h2>` là `JSXMemberExpression` nên trả `null` trước khi tập thẻ được hỏi tới; và
`<div role="heading" aria-level="2">` tạo ra đúng dòng dàn ý mà luật đang nói tới, nhưng với luật
lint thì đó chỉ là một cái hộp bình thường.

Cuối cùng là khe giữa hai luật sinh đôi: `<div className="text-lg font-semibold">` dùng làm tiêu đề
phần nội dung thì không có thẻ (luật này im) và cũng không đủ to cộng đủ nặng (luật kia im). Một
tiêu đề không có dàn ý, đi qua cả hai.

---

## Luật

1. Danh tính của một luật là **tên công bố**. Không đặt số.
2. Cổng tệp quyết định trước cả cú pháp: ngoài `/src/`, hoặc là tệp kiểm thử, hoặc nằm trong thư mục
   chiếc lá tiêu đề, thì luật không được lắp.
3. Chỉ `JSXIdentifier` **viết thường** mới được coi là thẻ nội tại. Mọi hình dạng khác trả `null`.
4. Sáu thẻ tiêu đề chia làm hai nhánh tại hằng `4`, và hai nhánh nói hai chuyện khác nhau: một chuyện
   về quyền sở hữu, một chuyện về cấu trúc.
5. Phát hiện thuần cú pháp. Nhanh, và vì thế dễ lách bằng cách đổi **hình dạng cú pháp** chứ không
   cần đổi ý đồ.
6. Mục "Cửa còn mở" là danh sách **chỗ mù**, không phải danh sách cách viết được phép.

## Ngoại lệ

Ngoại lệ ở đây đều đóng theo **tệp**, chứ không đóng theo cặp tệp-cộng-giá-trị. Đó là dạng miễn trừ
yếu hơn, và phải được đọc như vậy.

- **Chiếc lá tiêu đề.** Đây là nơi duy nhất mà thẻ và cỡ được quyết cùng một lúc, nên nó phải được
  quyền viết thẻ. Miễn trừ cấp cho một **đoạn đường dẫn**, nên nó cấp cho mọi tệp nằm dưới đoạn đó.
- **Tệp kiểm thử.** Một bài kiểm thử sinh đôi có thể dựng thẻ tiêu đề bằng tay để khẳng định điều gì
  đó về nó. Miễn trừ cấp cho một **hậu tố tên tệp**, nên nó cấp cho mọi tệp kiểm thử trong kho.
- **Mọi thứ ngoài `/src/`.** Đây không phải một ân huệ mà là một quyết định phạm vi, và nó là cách
  rộng nhất để bỏ luật lại phía sau.
- **Không có ngoại lệ thứ ba.** Không thuộc tính nào, không prop nào, không dòng chú thích nào tắt
  được luật từ bên trong một tệp đã nằm trong phạm vi.
