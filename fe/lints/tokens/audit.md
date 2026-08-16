---
id: fe-lints-tokens-audit
title: audit.md
slug: /fe/lints/tokens/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện xem bốn luật máy có thật sự giữ được luật token, và chỗ nào chúng chỉ trông như đang giữ.
---

# audit.md

> Version: `2.00` · Mô-đun: `tokens`

Phản biện này hỏi đúng một câu: **một máy nhìn thấy được bao nhiêu phần của luật token, và phần còn
lại thì ai giữ?**

## Verdict

Chấp nhận, có bảo lưu.

Bốn luật đều **chỉ tay được** vào mã nguồn, đều khớp theo hình dạng chứ không theo phán đoán, và
đều xứng đáng ở mức `error` như chính bộ luật tự đề xuất. Bảo lưu nằm ở chỗ khác: **tên của ba
trong bốn luật hứa rộng hơn phạm vi thật của chúng**, và một luật có thể tự tắt hoàn toàn mà bản
chạy vẫn xanh. Cả hai đều là rủi ro về **niềm tin**, không phải về tính đúng đắn — và một luật rò
mà người ta tin là kín thì nguy hiểm hơn một luật không tồn tại, vì luật không tồn tại thì ai cũng
biết là không có ai canh.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| Số luật tệp nguồn công bố | **Bốn**, đúng như dự kiến: `no-fractional-step`, `no-arbitrary-value`, `no-hand-rolled-heading`, `no-unresolved-token-class` |
| Mỗi luật có một mã trong luật văn bản không | Có — `TOKEN-3`, `TOKEN-4`, `TOKEN-5`, `TOKEN-9`. Không luật nào phải bịa ánh xạ |
| Mỗi mã có tối đa một luật không | Có. Không có mã nào bị hai luật cùng canh |
| Mã nào trong luật văn bản không có luật máy | `TOKEN-1`, `TOKEN-2`, `TOKEN-6`, `TOKEN-7`, `TOKEN-8` — xem *Nhận định* |
| Định danh của luật là gì | **Tên đã công bố.** Không sinh mã số riêng; tên là chuỗi xuất hiện trong nhật ký bản dựng và trong chú thích tắt luật |
| Luật có đọc được hằng số không | Có, qua `VariableDeclarator`. Đây là ca đã sinh ra bộ luật, và nó đóng |
| Luật có đọc được mảng không | Có, các phần tử được nối bằng dấu cách trước khi khớp |
| Luật có đọc được template không | Chỉ khi template **không có biểu thức nào**. Một biểu thức là mù cả chuỗi |
| Luật có đọc được lời gọi hàm gộp class không | **Không.** Bộ đọc không có ca cho `CallExpression` |
| Cổng phạm vi là gì | Đường dẫn chứa `/src/`, phân biệt hoa thường. Ngoài cổng: không luật nào chạy |

## Findings

**F1 — Luật thứ tư không có biển `-- TOKEN-n --`.** Ba luật đầu có biển ngăn cách ghi rõ mã luật
trong tệp nguồn; `no-unresolved-token-class` thì không. Ánh xạ sang `TOKEN-9` được đọc từ chú thích
tài liệu và từ nội dung thông điệp — cả hai trùng khớp gần như từng chữ với luật văn bản, kể cả ví
dụ `max-w-app-lg` → `--container-app-lg` và cả phần miễn trừ tên framework tự phân giải. Ánh xạ là
chắc chắn; **cái thiếu là dấu hiệu, không phải bằng chứng**.

**F2 — Chú thích `recommended` nói "cả ba" trong khi có bốn luật.** Đoạn chú thích cuối tệp giải
thích vì sao mọi luật nên ở mức `error` và đếm nhầm số luật. Bản thân đoạn mã thì đúng: nó suy ra
danh sách từ `Object.keys(rules)`, nên luật thứ tư vẫn được đặt `error`. Đây là chú thích lạc hậu
sau khi luật thứ tư được thêm vào, không phải lỗi hành vi.

**F3 — Tên luật rộng hơn phạm vi.** `no-arbitrary-value` bỏ qua ngoặc vuông ở mọi họ ngoài giãn
cách và kích thước, và bỏ qua mọi màu không viết bằng hex. `no-hand-rolled-heading` bỏ qua
`font-semibold` và mọi cỡ từ `6xl` trở lên. `no-unresolved-token-class` chỉ kiểm ba họ trong khi
`TOKEN-9` nói về mọi class gọi tên token. Chỉ `no-fractional-step` là gần đúng với tên của nó, và
nó cũng thiếu bốn họ kích thước cùng nhóm thuộc tính logic.

**F4 — Một luật có thể tự tắt mà không ai biết.** `no-unresolved-token-class` trả về rỗng khi không
tìm thấy tệp kiểu dáng nào trong 12 cấp thư mục phía trên. Lựa chọn im lặng là **đúng** — thà không
nói gì còn hơn tuyên bố mọi token là chết — nhưng bản chạy im lặng và bản chạy sạch trông giống hệt
nhau, và không có thông điệp nào nói "tôi đã không chạy".

**F5 — `VariableDeclarator` duyệt mọi khai báo biến, không chỉ biến chứa class.** Đây là điều làm
luật mạnh, và cũng là nguồn báo nhầm duy nhất đáng kể: một chuỗi tài liệu hay một chuỗi cấu hình có
chứa đúng hình dạng ấy — ví dụ một câu hướng dẫn viết `dùng p-2 thay cho p-1.5` — sẽ bị báo. Rủi ro
thấp và dễ nhận ra khi xảy ra.

**F6 — Bộ nhớ đệm tệp kiểu dáng theo thư mục, sống suốt lượt chạy.** Sửa tệp kiểu dáng giữa chừng
một tiến trình lint dài, hoặc trong chế độ theo dõi dùng chung tiến trình, có thể để lại kết luận
cũ. Chấp nhận được với một lượt chạy một lần; đáng nhớ khi chẩn đoán một phát hiện "không chịu biến
mất".

## Decisions

- **Giữ đúng bốn luật, tên giữ nguyên từng chữ.** Tên là định danh; đổi tên là đổi chuỗi xuất hiện
  trong nhật ký bản dựng và trong mọi chú thích tắt luật đang có.
- **Không sinh mã số riêng cho luật.** Một luật hai tên là một luật không truy được nguồn thông điệp.
- **Giữ mức `error` cho cả bốn.** Cả bốn khớp theo hình dạng; không luật nào mang rủi ro báo nhầm đủ
  lớn để biện minh cho `warn`.
- **Không mở rộng luật trong bản này.** Mọi khoảng thiếu ở F3 được ghi xuống *Rủi ro còn mở* thay vì
  vá vội. Mở rộng một biểu thức chính quy là đổi hành vi cổng chất lượng của mọi kho đang dùng, và
  đó là một quyết định có phiên bản riêng.
- **Ghi cửa mở ra tài liệu, không giấu.** Một luật rò mà được tin là kín thì tệ hơn một luật không
  tồn tại.
- **Không tài liệu hoá luật chưa có.** `TOKEN-7` và `TOKEN-8` không xuất hiện trong bảng `## Rules`,
  chỉ xuất hiện ở đây. Luật không chỉ tay vào được là một **đề xuất**, không phải một luật.

## Rủi ro còn mở

Mỗi mục nêu cửa còn mở và nói rõ **luật sẽ phải soi thêm cái gì** mới đóng được nó — hoặc vì sao
đóng đắt hơn để mở.

**R1 — Chuỗi có nội suy và lời gọi hàm gộp class.** Đây là cửa lớn nhất, và nó áp cho **cả bốn
luật**. Muốn đóng, bộ đọc phải: với template có biểu thức, ghép các phần chữ tĩnh lại và khớp trên
đó; với lời gọi hàm, khớp trên **mọi đối số** là chuỗi tĩnh, không cần biết hàm tên gì. Cả hai đều
làm được mà không cần suy luận kiểu, và cả hai đều làm số phát hiện tăng vọt trên một kho có lịch
sử. Đề xuất: đóng, nhưng ở một phiên bản riêng và có lượt đo trước.

**R2 — Object lồng một cấp.** `{ root: "gap-1.5" }` đi qua, `{ classes: "gap-1.5" }` thì không.
Muốn đóng, thị giác `Property` phải bỏ điều kiện khoá và đọc mọi thuộc tính có giá trị là chuỗi
tĩnh — cùng một cơ chế đã dùng cho `VariableDeclarator`, và cùng một mức rủi ro báo nhầm ở F5.
Đây là cửa **rẻ nhất để đóng** trong toàn bộ danh sách.

**R3 — Khoá viết bằng dấu nháy hoặc khoá tính toán.** `{ "classes": … }` và `{ ["classes"]: … }`
đều bị bỏ qua. Muốn đóng, chỉ cần nhận thêm khoá dạng `Literal` chuỗi. Khoá tính toán thì để mở, vì
nó cần suy luận giá trị.

**R4 — Thuộc tính bản đồ theo phần.** Một thuộc tính JSX tên khác `className`/`class`, mang một
object ánh xạ từng phần của thành phần sang chuỗi class, không bị nhìn tới ở cả hai lớp: tên thuộc
tính không khớp, và giá trị object trả về rỗng. Đóng R2 sẽ đóng luôn phần lớn cửa này, vì lúc đó các
thuộc tính bên trong object được đọc bất kể object ấy nằm ở đâu.

**R5 — Cổng đường dẫn `/src/`.** Một bố cục không có thư mục `src`, một cây truyện hoặc tài liệu,
một gói để nguồn ở `lib/` — tất cả đều không có luật nào, và không có thông điệp nào nói vậy. Đóng
bằng cách nới cổng thì đổi phạm vi ở mọi kho cùng lúc; **cách đúng là để cổng ở cấu hình chứ không ở
luật** — đường dẫn nào được lint là việc của từng kho, còn luật là luật. Ghi lại như một khoản nợ
thiết kế, không sửa trong luật.

**R6 — Bốn họ kích thước và nhóm thuộc tính logic thiếu trong `no-fractional-step`.** `min-w`,
`min-h`, `max-w`, `max-h`, `ps`, `pe`, `ms`, `me`, `inset-x`, `inset-y`. Đóng chỉ là thêm tên vào
danh sách đã có; không cần cơ chế mới. Đây là khoảng thiếu **rẻ và thuần tuý là bỏ sót**.

**R7 — Giá trị tuỳ ý ngoài họ giãn cách và kích thước.** `text-[…]`, `tracking-[…]`, `leading-[…]`,
`grid-cols-[…]`, `duration-[…]`, `aspect-[…]`. Đóng thì phải quyết một chuyện luật văn bản chưa
quyết: **có phải mọi họ đều thuộc một thang đóng không?** Bố cục dạng lưới với chiều rộng cột tuỳ ý
có thể là chính đáng, còn cỡ chữ tuỳ ý thì gần như chắc chắn không. Đây là câu hỏi cho luật văn bản
trước, cho biểu thức chính quy sau.

**R8 — Màu không viết bằng hex.** `rgb()`, `hsl()`, `oklch()`, `var()` và bóng đổ có màu bên trong
đều thoát. Đóng bằng cách đổi `-[#` thành "bất kỳ ngoặc vuông nào ở một họ màu" — nhưng như vậy sẽ
bắt luôn `bg-[url(...)]` và các ca hợp lệ khác, nên cần danh sách miễn trừ. Đáng làm, không miễn phí.

**R9 — `font-semibold` và cỡ chữ từ `6xl` trở lên.** Đóng chỉ là thêm vào hai biểu thức chính quy —
nhưng thêm `semibold` sẽ làm số phát hiện tăng mạnh nhất trong toàn bộ danh sách này, vì đó là cách
viết tiêu đề phổ biến nhất. Cần một lượt đo và một đợt sửa trước khi bật.

**R10 — Cặp cỡ/nét đậm nằm ở hai nút khác nhau.** Cỡ ở cha, nét đậm ở con; hoặc nét đậm đến từ chính
thẻ. Đóng thì phải theo dõi trạng thái xuyên cây JSX và xét cả tên thẻ — **đắt hơn nhiều so với giá
trị thu được**, và mở đường cho báo nhầm ở mọi bố cục lồng nhau. Đề xuất: **để mở**, và ghi vào tài
liệu.

**R11 — Luật token chỉ kiểm ba họ.** `TOKEN-9` nói về mọi class gọi tên token; luật kiểm
`max-w-app-*`, `max-h-*`, `min-h-*`. Đóng thì phải suy được tên biến từ tên class cho từng họ, và
chính chú thích trong tệp nguồn đã nêu lý do không làm: một họ mà framework cũng tự phân giải qua
thang riêng của nó sẽ sinh ra phát hiện trên những class đang chạy tốt. Mở rộng an toàn chỉ khi đi
kèm danh sách tên dành riêng cho từng họ.

**R12 — Hai biến thể chồng nhau, và biến thể bắt đầu bằng chữ số.** `lg:hover:min-h-panel` và
`2xl:min-h-panel` đều thoát. Đóng bằng cách gỡ **lặp** tiền tố và chấp nhận chữ số ở đầu tên biến
thể. Rẻ, không đổi ngữ nghĩa, không rủi ro báo nhầm — **khoản sửa đáng làm sớm nhất cùng với R6**.

**R13 — Dùng biến được tính là định nghĩa biến.** Phép kiểm là tìm chuỗi con. Muốn đóng, phải khớp
đúng dạng khai báo — tên biến đứng trước dấu hai chấm, ngoài chú thích. Cần một bộ đọc tệp kiểu dáng
thật thay vì `includes`, và phải xử lý chú thích cùng ký hiệu lồng nhau. Trung bình về chi phí, cao
về giá trị: hiện tại một biến chỉ được **đọc** ở khắp nơi và không được **khai báo** ở đâu vẫn qua.

**R14 — Không có tệp kiểu dáng thì không có luật.** Xem F4. Không đóng được bằng cách báo lỗi — một
gói không có chủ đề riêng là chuyện bình thường. Cách đóng đúng là **nói ra**: phát một thông điệp
một lần cho mỗi lượt chạy, hoặc bắt đường dẫn tệp kiểu dáng thành tuỳ chọn cấu hình để một kho phải
khai báo có chủ đích. Tuỳ chọn cấu hình là hướng nên đi.

**R15 — Hai mã luật không có luật máy nào.** `TOKEN-7` (màu ngữ nghĩa phải đi theo cặp nền/chữ) và
`TOKEN-8` (cỡ nút chọn theo vị trí đặt, không theo mức ưu tiên). `TOKEN-7` **kiểm được bằng máy**:
một class `bg-*-soft` đi cùng một class `text-*-soft` trên cùng một chuỗi là một cặp sai, và đó đúng
hình dạng mà bộ duyệt hiện có đã đọc được. `TOKEN-8` thì **không**, vì nó cần biết một hành động
đang nằm nhúng trong hàng hay đứng một mình — một dữ kiện về quan hệ, không phải về chuỗi. Đề xuất:
đề xuất một luật cho `TOKEN-7` ở phiên bản sau; ghi nhận `TOKEN-8` là luật do người giữ.

**R16 — Chỉ báo hit đầu tiên mỗi nút.** Một chuỗi ba bậc lẻ cần ba lượt sửa. Đóng bằng cách đổi
`match` sang khớp toàn cục và báo từng hit. Rẻ, và cải thiện rõ trải nghiệm sửa lỗi.

## Re-audit Triggers

- Tệp nguồn công bố thêm hoặc bớt một luật, hoặc đổi tên bất kỳ luật nào.
- Bất kỳ danh sách họ nào trong bốn biểu thức chính quy được sửa.
- Danh sách đường dẫn tệp kiểu dáng ứng viên, hoặc giới hạn 12 cấp, được sửa.
- Tập tên framework tự phân giải được thêm hoặc bớt một phần tử.
- Bộ đọc chuỗi tĩnh nhận thêm một dạng nút mới — template có biểu thức, lời gọi hàm, hay thuộc tính
  object bất kỳ khoá.
- Cổng đường dẫn `/src/` chuyển thành tuỳ chọn cấu hình.
- Luật văn bản thêm, bỏ hoặc đánh số lại bất kỳ mã `TOKEN-` nào.
- Có luật máy đầu tiên cho `TOKEN-7`.
- Một kho báo cáo bản chạy sạch mà sau đó tìm thấy vi phạm bằng tay: kiểm R5, R14 trước tiên.
