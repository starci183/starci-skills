---
id: fe-lints-icon-vi
title: vi.md
slug: /gates/lints/icon/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng luật lint của biểu tượng — bắt gì, giữ mã nào, phát hiện bằng gì, và cửa nào còn mở.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `icon`

# Máy giữ luật biểu tượng

Luật nói: người gọi nêu **ý nghĩa** và **vai trò**, một chiếc lá duy nhất đổi cặp đó thành hình vẽ
thật. Kiểu dữ liệu đã đóng được hai tập ý nghĩa và vai trò. Phần còn lại — nhập thẳng thư viện hình
tại chỗ gọi, đổi nhà cung cấp từ bên trong chiếc lá, và viết một cỡ không nằm trong thang — là phần
kiểu dữ liệu không nhìn thấy, nên mới cần máy.

Tài liệu này không chép lại luật. Nó ghi **mức thực thi**: mỗi luật lint nhìn vào cú pháp nào, và
quan trọng hơn, viết kiểu gì thì nó **không** nhìn thấy.

Mô-đun luật công bố năm luật, và ở đây ghi đúng năm. Tên của một luật chính là danh tính của nó —
đó là chuỗi in ra trong log build và chuỗi viết trong dòng tắt luật — nên ở đây không đặt thêm số cho
luật nào cả.

## Bảng tra nhanh

| Luật | Mã luật | Bắt gì |
|---|---|---|
| `no-vendor-icon-outside-icon-leaf` | `ICON-6` | Câu `import` trỏ vào một gói hình, viết từ một tệp nguồn không phải chiếc lá biểu tượng |
| `heroicons-is-the-glyph-vendor` | `ICON-7` | Câu `import` trỏ vào gói hình nằm ngoài hai họ đã duyệt — từ **mọi** tệp nguồn, kể cả chiếc lá |
| `no-off-scale-glyph-size` | `ICON-1` (chỉ nửa về cỡ) | Tiện ích `size-` viết bằng phân số thập phân hoặc giá trị tuỳ ý trong ngoặc vuông |
| `no-decorative-icon-in-metric-cell` | `ICON-10` | Thẻ JSX tên `Icon` bên trong đúng một tệp ô số liệu lặp lại |
| `rank-artwork-is-a-closed-set` | **không có mã trong luật — xem phần phát hiện** | Định danh tranh giải nêu ngoài chiếc lá xếp hạng, hoặc định danh lạ nêu bên trong nó |

---

## `no-vendor-icon-outside-icon-leaf`

**Bắt gì?** Một tệp nguồn bất kỳ, trừ chiếc lá biểu tượng, viết `import` từ một gói hình. Nhập ở chỗ
gọi là quyết định cùng lúc ba việc — thư viện nào, hình nào, to bao nhiêu — và màn hình kế tiếp sẽ
trả lời cả ba khác đi.

**Giữ mã nào?** `ICON-6`.

**Phát hiện thế nào?** Duyệt nút `ImportDeclaration`, đọc chuỗi nguồn. Một nguồn bị coi là gói hình khi
nó bằng hoặc **bắt đầu bằng** một trong mười tiền tố gói đã liệt kê, hoặc khi nó là gói ngoài (không
mở đầu bằng `.` hay `@/`) mà tên có chứa `icon`, `glyph`, `lucide`, `feather`, `tabler` hay
`fortawesome`. Cổng tệp: đường dẫn đã đổi hết dấu chéo ngược thành chéo xuôi, phải chứa `/src/` và
không được kết thúc bằng `/leaves/Icon/index.tsx`. Một miễn trừ duy nhất: tệp kết thúc bằng
`/leaves/RankMark/index.tsx` **và** nguồn đúng bằng gói tranh giải.

**Vì sao nên để máy giữ luật này?** Kiểu dữ liệu đóng được tập tên ý nghĩa, nhưng không hề biết một
tệp vừa nhập gì. Escape mở màn cho cả mô-đun này là một chiếc lá nhập thẳng một hình từ thư viện, ở
một cỡ ngoài thang — không có gì báo cả, vì luật canh thư viện thành phần chỉ gọi tên thư viện đó,
còn luật canh thang chỉ đọc tiện ích khoảng cách. Bài học đáng chép lại: một luật gọi tên một nhà
cung cấp thì bảo vệ đúng nhà cung cấp đó, và khe giữa hai luật chính là chỗ bậc thứ ba ra đời.

**Những chỗ còn lọt.** `require()` và `import()` động không phải `ImportDeclaration`, nên không bị nhìn.
`export { X } from "gói-hình"` cũng vậy — một tệp trung chuyển một dòng là giặt sạch cả gói. Mọi tệp
không nằm dưới `/src/` hoàn toàn không bị soi, nên đặt phần nhập ở một thư mục gói khác rồi xuất lại
dưới cái tên trung tính là đi lọt. Và cổng tệp là phép so **đuôi** đường dẫn, nên bất kỳ thư mục nào
kết thúc bằng `leaves/Icon/index.tsx` cũng được tự do y hệt chiếc lá thật.

---

## `heroicons-is-the-glyph-vendor`

**Bắt gì?** Một gói hình nằm ngoài hai họ đã duyệt — họ nét 24 cho vai trò tiêu đề và dẫn dắt, họ
đặc 16 cho vai trò chip — bị nhập từ **bất kỳ** tệp nguồn nào. Luật này cố tình không miễn trừ cho
chiếc lá biểu tượng: quyền sở hữu bản đồ ý nghĩa không phải giấy phép mở thêm một bộ từ vựng hình
thứ hai ngay bên trong.

**Giữ mã nào?** `ICON-7`.

**Phát hiện thế nào?** Cùng nút `ImportDeclaration` và cùng phép thử gói hình như luật trên, nhưng bỏ
cổng chiếc lá: mọi tệp chứa `/src/` đều bị quét. Một lần trúng chỉ được tha khi nguồn đúng bằng
`@heroicons/react/24/outline` hoặc `@heroicons/react/16/solid`, hoặc khi đúng cặp
chiếc-lá-xếp-hạng-cộng-gói-tranh-giải.

**Vì sao nên để máy giữ luật này?** Vì luật trên một mình thì để lộ đúng một chỗ, và đó là chỗ nguy
nhất: người sửa chiếc lá là người tin rằng mình có thẩm quyền. Hai luật chồng lên nhau cũng có nghĩa
là một câu `import` sai từ một trang thường sẽ bị báo **hai lần**, mỗi lần một thông điệp khác —
đúng theo thiết kế, nhưng người đọc log nên biết trước.

**Những chỗ còn lọt.** Một bộ hình mà tên gói không mang sáu dấu hiệu tên nào và cũng không nằm trong danh
sách thì lọt sạch — các gói pictogram, emoji hay mark thường rơi vào đúng ô đó. Tệp `.svg` cục bộ và
thành phần SVG viết tay cũng lọt, vì mọi nguồn tương đối bị loại trước khi thử. Theo chiều ngược lại,
`import type` từ một gói hình vẫn bị báo dù chẳng có gì được đóng gói ra — một lần báo nhầm nơi
không có escape nào.

---

## `no-off-scale-glyph-size`

**Bắt gì?** Một tiện ích `size-` viết bằng phân số thập phân (`size-4.5`) hoặc bằng giá trị tuỳ ý
trong ngoặc vuông (`size-[18px]`). Bậc thứ ba là bậc không ai áp dụng nhất quán: người viết chọn nó
vì một lý do đúng trên màn hình của họ, và mọi người sau đó chép lại cái gần nhất trong ba.

**Giữ mã nào?** `ICON-1`, và chỉ nửa về cỡ của nó. Việc vai trò nào đi với cỡ nào — `ICON-2`,
`ICON-3`, `ICON-4` — không có luật lint nào giữ.

**Phát hiện thế nào?** Duyệt `JSXAttribute` tên `className` hoặc `class`, và duyệt **mọi**
`VariableDeclarator`. Rút chuỗi tĩnh ra từ `Literal` chuỗi, từ `TemplateLiteral` không có biểu thức
nào, hoặc xuyên qua `JSXExpressionContainer` bọc một trong hai. Thử chuỗi đó với mẫu
`/\bsize-(?:\d+\.\d+|\[[^\]]+\])/` và chỉ báo lần trúng **đầu tiên**.

**Vì sao nên để máy giữ luật này?** Vì một cỡ lệch không bao giờ tự nhận mình là quyết định thiết
kế; nó trông như một con số. Người sau đọc `size-[18px]` không thấy một luật bị phá, chỉ thấy một
lựa chọn có vẻ chín, và chép lại. Việc quét cả `VariableDeclarator` là điểm đáng khen: nó bịt sẵn
kiểu giặt literal đơn giản nhất — gom chuỗi lớp vào một hằng rồi rải đi khắp nơi.

**Những chỗ còn lọt.** Đây là luật rò nhất trên kệ. Tên luật nói "cỡ hình", nhưng phép phát hiện không có
lấy một mẩu ngữ cảnh hình nào: nó chỉ là "một tiện ích `size-` viết bằng phân số hoặc ngoặc vuông" —
nên một ảnh đại diện `size-[44px]` bị báo, còn `size-9` trên một hình thì không. **Cỡ nguyên lệch
thang lọt hết**, và đó chính là cách dễ viết hơn của cùng một sai lầm. Dạng hai tiện ích rộng-cao
riêng cũng lọt. Chuỗi lớp nằm trong object hay mảng lọt, vì đó không phải thuộc tính lớp mà cũng
không phải hằng khởi tạo bằng chuỗi. Mọi hàm nối lớp lọt, vì chuỗi tĩnh không bao giờ được rút ra từ
một lời gọi hàm. Template có biểu thức lọt. Và vì phép so không toàn cục, kẻ vi phạm thứ hai trong
cùng một chuỗi không bao giờ được đọc tới.

---

## `no-decorative-icon-in-metric-cell`

**Bắt gì?** Một thẻ JSX tên `Icon` bên trong đúng một tệp: ô số liệu lặp lại có nhãn và tiến độ. Bản
tham chiếu của ô đó thuần chữ, nên một hình ở đây là bịa ra nhấn mạnh và lặp lại nghĩa mà chữ đã
đóng, nhân lên trên khắp lưới.

**Giữ mã nào?** `ICON-10`.

**Phát hiện thế nào?** Duyệt `JSXOpeningElement`, báo khi `node.name.type === "JSXIdentifier"` và
`node.name.name === "Icon"`. Cổng tệp **là** toàn bộ luật: đường dẫn phải kết thúc bằng
`/composites/LabelledProgressRow/index.tsx`, không thì bộ duyệt còn chẳng được lắp.

**Vì sao nên để máy giữ luật này?** Vì thêm một hình nhỏ vào một ô số liệu là việc nhìn qua thấy tử
tế. Nó chỉ hỏng khi ô đó lặp mười lần và lưới mọc ra một hệ chỉ mục thị giác thứ hai, lúc đó thì một
lần dọn dẹp đã biến thành một lần vẽ lại.

**Những chỗ còn lọt.** Đây là "phạm vi theo tên tệp" ở dạng thuần khiết nhất: luật chỉ tồn tại cho một
đường dẫn, nên đổi tên tệp, hoặc chuyển phần đánh dấu sang một tệp anh em cùng thư mục, là xoá được
luật mà không chạm vào luật. Tên thẻ cũng phải đúng chữ `Icon`: đặt bí danh khi nhập, gọi qua thuộc
tính của một object, dùng một thành phần khác tự vẽ hình bên trong, hay truyền hình xuống bằng prop
— tất cả đều lọt. Và mọi ô dữ kiện gọn khác trong sản phẩm nằm ngoài luật theo mặc định: luật viết
chung cho mọi ô, còn máy giữ đúng một ô.

---

## `rank-artwork-is-a-closed-set`

**Bắt gì?** Hai chuyện, bằng hai thông điệp. Một định danh tranh giải nêu **ngoài** chiếc lá xếp
hạng — vì bản đồ hạng-sang-tranh phải nằm một chỗ, để màn hình thứ hai không trả lời khác đi. Và một
định danh nêu **bên trong** chiếc lá đó nhưng không thuộc bốn cái đã duyệt — vì miễn trừ mua về bốn
tấm huy chương chứ không mua về nguyên một catalog.

**Giữ mã nào?** Không mã nào. Mô-đun luật đề `ICON-11` cho luật này, nhưng `ICON-11` trong văn bản
luật nói mỗi ô hình luôn mang hình vai trò dẫn dắt ở cỡ năm — một câu về cỡ hình so với cỡ tấm nền,
không liên quan gì tới tranh giải. Toàn bộ lập luận về bộ từ vựng tranh giải chỉ nằm trong chú thích
của mô-đun luật. Ở đây ghi lại đúng như thế thay vì bịa ra một ánh xạ.

**Phát hiện thế nào?** Duyệt **mọi** `Literal`; bỏ qua giá trị không phải chuỗi và mọi chuỗi không mở
đầu bằng tiền tố bộ sưu tập `fluent-emoji-flat:`. Cổng tệp: phải chứa `/src/`, không được khớp
`/\.test\.tsx?$/`. Tệp kết thúc bằng `/leaves/RankMark/index.tsx` đi nhánh kiểm tập đóng; mọi tệp
khác đi nhánh "nêu ngoài chiếc lá".

**Vì sao nên để máy giữ luật này?** Vì nếu không có nó, miễn trừ ở hai luật nhập kia sẽ tự nở ra:
một tệp được phép nhập một gói, rồi từ tệp đó gọi tên **bất kỳ** tranh nào trong gói — đúng thất bại
mà chiếc lá biểu tượng sinh ra để chặn, dựng lại nguyên vẹn ở thư mục bên cạnh. Luật này là thứ biến
một miễn trừ thành một **bộ từ vựng**.

**Những chỗ còn lọt.** Định danh ghép bằng template làm **cả hai** nhánh biến mất cùng lúc, và ghép chuỗi
lại chính là cách tự nhiên nhất để viết một bản đồ hạng-sang-tranh. Chỉ một tiền tố bộ sưu tập được
nhận ra, nên một tấm huy chương lấy từ bộ sưu tập khác trong cùng catalog lọt cả trong lẫn ngoài
chiếc lá. Miễn trừ theo tên tệp kiểm thử là có lập luận nhưng không có biên: mọi tệp `.test.tsx` ở
bất kỳ đâu đều được gọi tên bất kỳ định danh nào. Và chiếc lá xếp hạng cũng chỉ được nhận ra bằng
đuôi đường dẫn, nên một chiếc lá thứ hai cùng hình dạng đường dẫn là hợp lệ.

## Luật

1. Danh tính của một luật là **tên công bố** của nó. Không đặt thêm số.
2. Phát hiện thuần cú pháp: không phân giải mô-đun, không hỏi kiểu, không chạy mã.
3. Một tệp chỉ vào phạm vi khi đường dẫn có `/src/` — trừ luật ô số liệu, vốn tự có cổng riêng.
4. Mọi miễn trừ là một **cặp**: một tệp **và** một giá trị. Không tệp nào được miễn trọn một luật.
5. Cổng đường dẫn là phép so đuôi, nên nó đặt tên cho một **hình dạng đường dẫn**, không phải một tệp
   duy nhất.
6. Mức nghiêm mà mô-đun tự đề nghị là `error` cho cả năm; cấu hình của kho tiêu thụ mới là nơi quyết
   định thật sự bật cái gì.

## Ngoại lệ

Ngoại lệ là một phần của luật. Mỗi ngoại lệ dưới đây đều đóng và đều viết dưới dạng một cặp.

- **Chiếc lá biểu tượng** chỉ được miễn luật dành cho chỗ gọi. Nó vẫn bị luật nhà cung cấp ràng buộc
  y như mọi tệp khác — đó là chủ ý, vì escape nguy nhất đến từ người tin mình có thẩm quyền.
- **Chiếc lá xếp hạng** được miễn cả hai luật nhập, cho đúng một gói. Gói khác từ tệp đó, hoặc gói đó
  từ tệp khác, vẫn bị báo.
- **Bốn định danh tranh giải** là toàn bộ từ vựng của chiếc lá xếp hạng. Cái thứ năm bị báo là lạ;
  một trong bốn nêu ở nơi khác bị báo là đặt sai chỗ.
- **Tệp kiểm thử** được miễn luật tranh giải, để một bài kiểm thử sinh đôi chứng minh được tập đã
  đóng — muốn chứng minh thì phải gọi tên cả cái ở trong lẫn cái ở ngoài.
- **Mọi thứ ngoài `/src/`** không bị bốn trong năm luật soi tới. Đây là một quyết định phạm vi, không
  phải một giấy phép, và nó là cửa mở rộng nhất trên kệ này.
