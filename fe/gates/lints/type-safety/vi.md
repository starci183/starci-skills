---
id: fe-lints-type-safety-vi
title: vi.md
slug: /gates/lints/type-safety/vi
sidebar_label: vi.md
sidebar_position: 1
description: Luật type-safety có đúng một rule; đây là thứ nó bắt, thứ nó không bắt, và vì sao.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `type-safety`

Hệ kiểu là phần canon mà máy giữ hộ mà không cần ai nhắc. Phần lớn các luật khác được giữ bằng một
union đóng hoặc một alias kiểu chứ không phải bằng rule — nghĩa là giá trị của hệ kiểu ở đây không
phải "ít bug hơn" một cách chung chung, mà là **phần lớn canon thôi không còn là tuỳ chọn nữa**.

Vì thế rule ở tầng này chỉ có một việc: canh những chỗ có người **tắt hệ kiểu đi**.

Tầng tài liệu này không chép lại luật. Nó ghi lại **việc thi hành**: máy nhìn thấy đúng cái gì, và —
phần không ai chịu viết ra — cùng một lỗi ấy còn viết được bằng những cách nào mà máy hoàn toàn
không thấy.

Mô-đun rule công bố **đúng một rule**, và trang này ghi đúng một. Bản thân mô-đun rule nói rõ vì sao
nó ở một mình: dạng viết tắt của phép xoá kiểu và cách viết mảng đã có rule của bộ plugin TypeScript
lo, mà chép lại rule của người khác thì có thêm một bản phải giữ cho khớp — và bản không ai sửa
chính là bản ngừng khớp. Cái còn lại là cast hai tầng, thứ không bộ rule sẵn có nào từ chối, vì phần
lớn codebase coi nó là một lối thoát chính đáng.

## Bảng tra nhanh

| Rule | Mã luật | Bắt gì |
|---|---|---|
| `no-double-cast` | `TYPE-SAFETY-1` | Cặp `giá_trị as unknown as Đích` trong tệp có `/src/` trên đường dẫn và không có đuôi `.test.ts`, `.test.tsx`, `.spec.ts`, `.spec.tsx` |

`TYPE-SAFETY-4` (tệp kiểm thử được dựng giá trị sai có chủ đích) cũng đang được thi hành, nhưng dưới
dạng **vắng mặt**: nó là cái cổng đường dẫn của chính rule này, không phải một rule riêng.
`TYPE-SAFETY-2` và `TYPE-SAFETY-3` được uỷ thác cho bộ plugin TypeScript. `TYPE-SAFETY-5` **không có
rule nào giữ**, ở đây cũng như ở chỗ được uỷ thác.

---

## `no-double-cast`

**Bắt gì?** Đúng một hình dạng cú pháp: một phép cast mà toán hạng của nó lại là một phép cast sang
đúng từ khoá `unknown`. Nói cách khác là vế ngoài của cặp `giá_trị as unknown as Đích`.

Cast một tầng **không** bị bắt, và đó là chủ ý. `giá_trị as Đích` là một khẳng định mà trình biên
dịch còn kiểm được một phần: hai kiểu vẫn phải có phần chung. Cặp hai tầng thì khác hẳn — nó tồn tại
**chỉ vì** hai kiểu không có gì chung, nên nó không phải một phép thu hẹp, nó là một phép xoá.

Cast sang riêng `unknown` cũng không bị bắt, và cũng là chủ ý: đó chính là hình dạng mà luật đang
đòi. Nói "tôi chưa biết giá trị này là gì" là một câu trung thực; nói "nó là `Đích`" ngay sau đó mà
không kiểm gì mới là câu nói dối.

**Giữ mã nào?** `TYPE-SAFETY-1`, trọn vẹn một mã và chỉ một mã.

**Phát hiện thế nào?**

1. **Cổng tệp, xét một lần trước khi cài visitor.** Lấy `context.filename` (không có thì
   `context.getFilename()`), ép về chuỗi, đổi mọi dấu gạch ngược thành gạch chéo, rồi đòi đường dẫn
   **chứa** `/src/` và **không** khớp `/\.(?:test|spec)\.(?:ts|tsx)$/`. Cổng hỏng thì `create` trả về
   một object rỗng — rule không phải là im lặng, mà là **không tồn tại** với tệp đó.
2. **Phép thử nút.** Thăm `TSAsExpression`; đọc `node.expression`; đòi nó cũng là `TSAsExpression`;
   đòi `typeAnnotation` của cast bên trong đúng là `TSUnknownKeyword`. Khớp thì báo lỗi ngay tại nút
   **ngoài**, với `messageId` là `double`.

Ba tính chất của cách phát hiện ấy quyết định toàn bộ phần "cửa còn mở": nó thuần cú pháp (không giải
module, không hỏi kiểu, không chạy code); nó khớp **một từ khoá**, không khớp một ý nghĩa; và nó khớp
một quan hệ **kề nhau** — hai phép cast phải là cha con trực tiếp.

**Vì sao nên để máy giữ luật này?**

Câu hỏi quyết định là: *trình biên dịch đang biết gì mà dòng này bảo nó quên đi?* Nếu câu trả lời là
"không gì cả, hai kiểu vốn khớp" thì phép cast là thừa. Nếu câu trả lời là bất cứ thứ gì khác thì
phép cast đang **giấu** thứ đó.

Ba lý do khiến việc này không nên để cho người soát tay:

- **Chỗ nó xoá đúng là chỗ đáng kiểm nhất.** Cast hai tầng gần như luôn nằm ở đường biên: dữ liệu
  vừa từ ngoài chương trình đi vào. Đó là nơi duy nhất mà kiểu còn là một lời hứa chưa được kiểm.
- **Người soát tay đọc nó thành một chi tiết kỹ thuật.** `as unknown as` trông như thủ tục, không
  trông như một quyết định. Nó trượt qua review theo đúng cái cách một dòng thừa trượt qua.
- **Đến lúc có người để ý thì nó đã gánh việc.** Gỡ một cast hai tầng nghĩa là **cho giá trị ấy một
  hình dạng mà nó chưa từng có** — nên rule này không có bản vá tự động, và một kho có lịch sử nên
  chuẩn bị tinh thần rằng mỗi báo cáo là một khoản việc thật.

**Những chỗ còn lọt.** Đây mới là phần đáng đọc của trang này.

- **Cách viết ngoặc nhọn.** `<Đích><unknown>giá_trị` xoá y hệt nhưng là một loại nút khác
  (`TSTypeAssertion`), rule không hề thăm. Đây là cách viết cũ hơn, nên nó thường đến cùng người đang
  chuyển code sang chứ không phải người đang né rule.
- **Đổi từ khoá ở giữa.** `as any as`, `as never as`, `as {} as` — cùng một mức xoá, không cái nào bị
  bắt. Cái đầu tiên đáng lẽ do rule được uỷ thác lo, mà rule ấy có mức nghiêm khắc riêng, cấu hình
  riêng và **comment tắt riêng**: tắt nó là tắt luôn đường biên này.
- **Đặt tên khác cho từ khoá.** `type Loose = unknown` biến vế trong thành một tham chiếu kiểu, mà
  tham chiếu kiểu thì không phải nút từ khoá. `giá_trị as Loose as Đích` trông còn gọn hơn thứ nó
  thay thế — đó chính là lý do có người viết nó.
- **Chèn bất cứ thứ gì vào giữa.** Rule khớp quan hệ kề nhau, nên `(giá_trị as unknown)! as Đích` phá
  cặp bằng đúng một ký tự.
- **Tách phép xoá thành hai câu lệnh.** Khai báo `const loose: unknown = giá_trị` rồi `const row =
  loose as Đích` xoá đúng bằng ngần ấy mà không có cast hai tầng nào. Đây là cửa nguy hiểm nhất, vì
  **bản sửa mà rule khuyên** — thu hẹp từ `unknown` — nhìn về mặt cú pháp giống hệt cách né. Thứ phân
  biệt hai bên là **phép kiểm ở giữa**, và không có gì bắt buộc phải có phép kiểm ấy.
- **Một hàm generic.** `const coerce = <T,>(value: unknown): T => value as T` chứa một cast hợp lệ;
  từ đó mọi nơi gọi `coerce<Đích>(giá_trị)` sạch bong. Một hàm rửa sạch mọi phép xoá trong cả cây, và
  nó không trông như một chiêu lách — nó trông như một tiện ích.
- **Từ khoá nằm sâu một tầng trong kiểu.** `as Array<unknown> as Array<Đích>` chú thích một tham
  chiếu kiểu **có tham số** là từ khoá. Rule chỉ đọc nút trên cùng của chú thích, nên cả một tập hợp
  bị xoá vẫn lọt.
- **Xoá mà không có cast nào để nhìn.** Giá trị trả về từ một hàm phân tích chuỗi, một module không
  có kiểu, một khai báo nhà cung cấp viết sai — gán thẳng vào hình dạng đã khai báo, không cần cast.
  Không có gì về mặt cú pháp để báo cả.
- **Mọi thứ ngoài `/src/`.** Thư mục gói, thư mục route ở gốc, script dựng, tệp cấu hình, một
  workspace anh em — không được soi. Đây là quyết định phạm vi có chủ ý, và cũng là cửa rộng nhất.
- **Cùng chuỗi ký tự ấy ở thư mục tổ tiên.** Cổng là `includes("/src/")` chứ không phải một phép thử
  tương đối với gốc kho. Một checkout nằm dưới thư mục tên `src` sẽ kéo **mọi** tệp vào phạm vi, kể
  cả thứ mà cổng định loại ra — lỗi ngược chiều: báo ở chỗ không có lỗi.
- **Tên tệp, dùng để thoát.** Miễn trừ là một hậu tố. Đổi tên tệp thành `.spec.ts` là xoá rule khỏi
  tệp đó, không để lại dòng diff nào cho ai soát.
- **Tên tệp, dùng để báo oan.** Miễn trừ chỉ nhận đúng bốn đuôi. Tệp trợ giúp cho kiểm thử, tệp dữ
  liệu mẫu, xưởng dựng giá trị sai có chủ đích, hoặc cách bố trí kiểm thử theo thư mục — tất cả bị
  quản như production dù dựng giá trị sai chính là việc của chúng. Thiếu tầm và quá tầm là cùng một
  dòng lệnh.
- **Mệnh đề giải thích.** Rule báo theo hình dạng và không bao giờ đọc thứ viết cạnh nó. Đấy là hành
  vi đúng của **rule này**, và cũng là lý do `TYPE-SAFETY-5` không có ai giữ.

---

## Luật

1. Danh tính của rule là **tên đã công bố**. Đó là chuỗi hiện ra trong log dựng và trong comment tắt
   rule; đặt thêm một con số là tạo ra một rule có hai tên và không cách nào biết thông báo đến từ tên
   nào.
2. Chỉ ghi rule **có thật** trong mô-đun rule. Rule đáng-lẽ-phải-có thì thuộc về `audit.md`, mục rủi
   ro còn mở.
3. Phát hiện là thuần cú pháp. Không giải module, không hỏi kiểu, không chạy code.
4. Cổng tệp xét **một lần** cho mỗi tệp, trước khi cài visitor. Ngoài phạm vi, rule không tồn tại chứ
   không phải im lặng.
5. Một nút vi phạm là một báo cáo, neo ở **cast ngoài**, nên một comment tắt rule che đúng một phép
   xoá.
6. Rule không phát hành bản vá tự động, vì mọi bản sửa thật đều phải chọn cho giá trị một hình dạng,
   và máy không chọn được hình dạng ấy.

## Ngoại lệ

Ngoại lệ là **một phần của rule**, không phải chỗ để lách.

- **Tệp kiểm thử.** Bốn hậu tố tên tệp, miễn trừ trọn gói. Đây là `TYPE-SAFETY-4` viết thành đường
  dẫn, và mô-đun rule nói rõ vì sao **phải** là đường dẫn: bản dựa trên phán đoán sẽ bị đem ra cãi lại
  ở từng nơi gọi, còn một đường dẫn thì cãi một lần, tại chỗ nó được viết.
- **Mọi thứ ngoài `/src/`.** Không phải một ân huệ cấp cho ai — là một quyết định về việc cái gì được
  tính là mã nguồn sản phẩm. Dù vậy đây vẫn là nơi chứa khối lượng mã không được soi lớn nhất.
- **Cast một tầng.** Không phải sơ suất, cũng không phải ân huệ: một phép thu hẹp mà trình biên dịch
  còn kiểm được một phần là một hành vi khác hẳn một phép xoá, và bộ kiểm thử song sinh của rule ghim
  chính xác sự khác biệt đó.
- **Cast mở rộng sang riêng `unknown`.** Hợp lệ theo thiết kế; đó là hình dạng luật đòi khi hình dạng
  thật sự chưa được biết.
