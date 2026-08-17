---
title: Type-safety · Vietnamese
---

# An toàn kiểu

Đầu vào là mã đã viết xong — một tệp, một mẩu diff. Đầu ra là một **phán quyết**: tệp có nằm trong
phạm vi hay không, rule đã xuất bản nào nổ, nó báo cái gì và ở nút nào, mã luật tương ứng là mã nào,
và cửa còn mở nào lẽ ra đã che đúng lỗi ấy. Mô-đun này không chọn gì cả. Nó từ chối, và nó phải chỉ
được ra đúng ký tự mà nó từ chối.

## Luật

Hệ kiểu là phần canon mà máy giữ hộ mà không cần ai nhắc. Phần lớn các luật khác được giữ bằng một
union đóng hoặc một alias kiểu chứ không phải bằng rule — nghĩa là giá trị của hệ kiểu ở đây không
phải "ít bug hơn" một cách chung chung, mà là phần lớn canon thôi không còn là tuỳ chọn nữa. Vì thế
rule ở tầng này chỉ có một việc: canh những chỗ có người **tắt hệ kiểu đi**.

Mô-đun này không chép lại luật. Nó ghi lại **việc thi hành**: máy nhìn thấy đúng cú pháp nào, và —
phần không ai chịu viết ra — cùng một phép xoá ấy còn viết được bằng những cách nào mà máy hoàn toàn
không thấy.

Luật nêu năm mã. **Đúng một mã có rule**, và một mã thứ hai được giữ dưới dạng sự vắng mặt của chính
rule ấy trên một tập tên tệp. Mô-đun rule nói rõ vì sao nó ở một mình: dạng viết tắt của phép xoá kiểu
và cách viết mảng đã có rule của bộ plugin TypeScript lo, mà chép lại rule của người khác thì có thêm
một bản phải giữ cho khớp — và bản không ai sửa chính là bản ngừng khớp. Cái còn lại là cast hai tầng,
thứ không bộ rule sẵn có nào từ chối, vì phần lớn codebase coi nó là một lối thoát chính đáng.

## Luật máy đã xuất bản

| Rule | Mã | Nó báo gì |
|---|---|---|
| `no-double-cast` | `TYPE-SAFETY-1` | `double` — một `TSAsExpression` mà toán hạng của nó lại là một `TSAsExpression` cast sang đúng từ khoá `unknown`, tức vế ngoài của cặp `value as unknown as Target`, trong tệp có `/src/` trên đường dẫn và không có đuôi `.test.ts`, `.test.tsx`, `.spec.ts` hay `.spec.tsx` |

`TYPE-SAFETY-4` (tệp kiểm thử được dựng giá trị sai có chủ đích) không có rule riêng: nó được thi hành
dưới dạng **vắng mặt** của rule trên bốn hậu tố tên tệp, nên nó không nằm trong bảng.

`TYPE-SAFETY-2` (dạng viết tắt của phép xoá kiểu) và `TYPE-SAFETY-3` (một cách viết duy nhất cho mảng)
**không có rule nào ở đây**. Chúng được uỷ thác cho một gói mà mô-đun này không phát hành — rule
no-explicit-any của bộ plugin TypeScript và rule array-type của nó với mặc định generic. Một kho nhận
gói này rồi cấu hình bộ plugin TypeScript lỏng tay vẫn qua cổng lint của mình trong khi phá hai mã đã
công bố, và không gói nào để ý. Uỷ thác không phải là được che.

`TYPE-SAFETY-5` (một phép cast sống sót qua review phải mang theo lý do ngay trên dòng) **không có rule
nào giữ**, ở đây cũng như ở chỗ được uỷ thác. Không có gì đọc comment viết cạnh một phép cast. Đó là
luật thật và nó hoàn toàn không được thi hành.

## Đọc một diff

1. **Quyết định phạm vi trước mọi thứ khác, và ghi lại.** Ngoài phạm vi ở đây không có nghĩa là tệp đã
   qua — nghĩa là cổng tệp hỏng, `create` trả về một object visitor rỗng, và rule **không tồn tại** với
   tệp đó.
2. **Cổng là hai phép thử trên một chuỗi.** Đường dẫn, đã đổi sang gạch chéo, phải **chứa** `/src/` và
   **không** kết thúc bằng `.test.ts`, `.test.tsx`, `.spec.ts` hay `.spec.tsx`. Chỉ bốn hậu tố ấy được
   miễn trừ; không gì khác cấp được miễn trừ này.
3. **Đọc nút, đừng đọc câu lệnh.** Thăm từng `TSAsExpression`, đọc `node.expression`, đòi nó cũng là
   `TSAsExpression`, và đòi `typeAnnotation` của cast bên trong đúng là `TSUnknownKeyword`.
4. **Mỗi phát hiện một khối**, neo ở cast **ngoài**, một nút vi phạm là một báo cáo.
5. **Viết dòng `hatch` mỗi khi một cửa còn mở lẽ ra đã che đúng lỗi ấy** — nhất là khi sự im lặng đến
   từ một từ khoá khác ở giữa, một nút chen vào giữa hai phép cast, một phép xoá bị tách thành hai câu
   lệnh, hoặc một đường dẫn nằm ngoài `/src/`.
6. **Đừng báo thứ không rule nào canh.** Hai trong năm mã nằm ở gói khác và một mã không có máy nào
   giữ; một phán quyết nói khác đi là nói sai về mô-đun này.

## `no-double-cast` — TYPE-SAFETY-1

**Nó báo cái gì.** `double` — mỗi nút ngoài vi phạm một báo cáo, neo ở cast ngoài, nên một comment tắt
rule đặt trên câu lệnh che đúng một phép xoá. Không có bản vá tự động, vì mọi bản sửa thật đều phải cho
giá trị một hình dạng mà nó chưa từng có, và máy không chọn được hình dạng ấy.

**Nó phát hiện bằng gì.** Cổng tệp, xét một lần trong `create` trước khi cài bất kỳ visitor nào: lấy
`context.filename` (không có thì `context.getFilename()`), ép chuỗi bằng `String(… || "")`, đổi mọi dấu
gạch ngược thành gạch chéo, rồi đòi kết quả **chứa** chuỗi con `/src/` và **không** khớp
`/\.(?:test|spec)\.(?:ts|tsx)$/`. Cổng hỏng thì `create` trả về một object visitor rỗng. Phép thử nút:
thăm `TSAsExpression`, đọc `node.expression`, đòi `node.expression.type === "TSAsExpression"`, rồi đòi
`typeAnnotation.type` của cast bên trong đúng là `TSUnknownKeyword`. Khớp thì báo tại nút **NGOÀI**, với
`messageId: "double"`.

**Nó không thấy gì.** Ba tính chất của cách phát hiện ấy quyết định tất cả. Nó thuần cú pháp — không
giải module, không hỏi kiểu, không chạy code. Nó khớp **một nút từ khoá**, không khớp một ý nghĩa:
`payload as any as Target`, `payload as never as Target`, `payload as {} as Target`, và
`payload as Loose as Target` với `type Loose = unknown`, đều xoá đúng ngần ấy và đều vô hình ở đây. Và
nó khớp một quan hệ **kề nhau**: `(payload as unknown)! as Target` chen một nút vào giữa cha và con,
cặp ấy thôi không còn tồn tại, giá đúng một ký tự. Cách viết ngoặc nhọn `<Target><unknown>payload` được
phân tích thành `TSTypeAssertion`, một loại nút rule này không bao giờ thăm.
`payload as Array<unknown> as Array<Target>` đẩy từ khoá xuống sâu một tầng trong chú thích, mà rule chỉ
đọc nút trên cùng. Còn một giá trị vốn đã mang dạng viết tắt thì gán thẳng vào hình dạng đã khai báo,
không có nút cast nào — không có gì về mặt cú pháp để báo.

**Ranh giới.** Chú thích vế trong đúng là từ khoá `unknown` mới là thứ khiến một phép xoá thuộc phần
việc của rule này; dạng viết tắt thuộc rule được uỷ thác của bộ plugin TypeScript, với mức nghiêm khắc
riêng, cấu hình riêng và comment tắt rule riêng. Cast một tầng, và cast mở rộng sang riêng từ khoá,
cũng cố ý hợp lệ và cũng không phải việc của rule này.

## Cách phát hiện

| Bộ phận | Cơ chế |
|---|---|
| cổng tệp | Xét một lần trong `create`, trước khi cài bất kỳ visitor nào. `context.filename`, không có thì `context.getFilename()`, ép chuỗi bằng `String(… \|\| "")` |
| chuẩn hoá dấu phân cách | Mọi gạch ngược đổi thành gạch chéo trước hai phép thử chuỗi con và hậu tố, nên cổng xử sự y hệt nhau trên cả hai kiểu dấu phân cách |
| phép thử phạm vi | Đường dẫn phải chứa chuỗi con `/src/` |
| phép thử miễn trừ | Đường dẫn **không** được khớp `/\.(?:test\|spec)\.(?:ts\|tsx)$/` |
| ngoài phạm vi | `create` trả về một object visitor rỗng. Rule không phải là im lặng — nó **không tồn tại** với tệp đó |
| bộ duyệt nút | Thăm `TSAsExpression`; đọc `node.expression`; đòi `node.expression.type === "TSAsExpression"`; đòi `typeAnnotation.type` của cast bên trong đúng là `TSUnknownKeyword`; báo tại nút NGOÀI với `messageId: "double"` |

Không bộ phận nào ở đây với ra ngoài tệp đang lint. Không giải module, không hỏi kiểu, không chạy code.

## Lối thoát hợp lệ

**Đã đóng** — người đọc có thể tưởng những cách viết này lọt qua, nhưng không.

| Viết thế này | Vì sao vẫn nổ |
|---|---|
| `(value as unknown) as Target` | Dấu ngoặc không sinh ra nút nào trong cây cú pháp này, nên cast trong vẫn là toán hạng trực tiếp của cast ngoài. Gom vào ngoặc không rửa được gì |
| Đường dẫn dấu gạch ngược ở cổng | Tên tệp được chuẩn hoá sang gạch chéo trước hai phép thử chuỗi con và hậu tố |
| Không có tên tệp | Cổng ép bằng `String(value \|\| "")` chứ không đọc thuộc tính trên nó, nên một lượt chạy không có tên tệp cho ra chuỗi rỗng và trượt phép thử `/src/` — rule im chứ không ném lỗi |
| `const ROW = payload as unknown as Target`, dùng ở tận đâu | Hằng số không rửa được rule này. Nó canh một nút cú pháp, không canh một vị trí thuộc tính, nên gom giá trị vào hằng chỉ mang nút vi phạm vào phần khởi tạo của hằng |
| `[payload as unknown as Target]` hoặc `{ row: payload as unknown as Target }` | Phần tử mảng và thuộc tính object là những vị trí biểu thức bình thường, và visitor nổ ở nút dù nút nằm đâu |
| Cast trong tham số một lời gọi, trong thuộc tính thẻ, trong câu trả về, trong giá trị mặc định hay trong một lỗ template | Không có vị trí nào trong một biểu thức giấu được nút này khỏi một visitor theo nút |
| `value as unknown as A as B` | Vế ngoài qua — chú thích của toán hạng nó là `A`, không phải `unknown` — nhưng vế GIỮA lại là một `TSAsExpression` có toán hạng cast sang `unknown`, và nút ấy nổ |
| Cast hai tầng trong một tệp TRỢ GIÚP cho kiểm thử nhưng không mang tên kiểm thử | Ghi ở đây chỉ để bác bỏ: miễn trừ là hậu tố tên tệp và chỉ có thế, nên tệp trợ giúp bị quản như production. Đó là một lần báo oan, và vì thế nó nằm trong bảng còn mở |

**Còn mở** — chỗ mù đã phát hành. Một phán quyết không được nói rằng những chỗ này đã được xét.

| Phạm vi | Cái gì lọt |
|---|---|
| `no-double-cast` | **Cách viết ngoặc nhọn.** `<Target><unknown>payload` xoá y hệt nhưng được phân tích thành `TSTypeAssertion` — loại nút rule này không bao giờ thăm. Đây là cách viết cũ hơn, nên nó đến cùng người đang chuyển code sang chứ không phải người đang né rule |
| `no-double-cast` | **Đổi từ khoá xoá ở giữa.** `payload as any as Target`, `payload as never as Target` và `payload as {} as Target`. Cái đầu tiên đáng lẽ do rule viết-tắt được uỷ thác lo — một rule có mức nghiêm khắc riêng, cấu hình riêng và comment tắt riêng, nên tắt nó là tắt luôn đường biên này |
| `no-double-cast` | **Đặt tên khác cho từ khoá.** `type Loose = unknown` biến chú thích vế trong thành một tham chiếu kiểu, mà tham chiếu kiểu không phải nút từ khoá. `payload as Loose as Target` trông còn gọn hơn thứ nó thay thế |
| `no-double-cast` | **Chèn bất cứ thứ gì vào giữa hai phép cast.** `(payload as unknown)! as Target` phá quan hệ kề nhau bằng đúng một ký tự |
| `no-double-cast` | **Tách phép xoá thành hai câu lệnh.** `const loose: unknown = payload` rồi `const row = loose as Target`. Đây là cửa sắc nhất trên tầng này: bản sửa mà chính rule khuyên — thu hẹp từ `unknown` — nhìn về cú pháp giống hệt cách né. Thứ phân biệt hai bên là PHÉP KIỂM ở giữa hai dòng, và không có gì bắt buộc phải có phép kiểm ấy |
| `no-double-cast` | **Một hàm generic.** `const coerce = <T,>(value: unknown): T => value as T` chỉ chứa một cast hợp lệ; từ đó mọi nơi gọi đọc thành `coerce<Target>(payload)` không còn cast nào. Một hàm rửa sạch mọi phép xoá trong cả cây, vĩnh viễn, và nó trông như một tiện ích |
| `no-double-cast` | **Từ khoá nằm sâu một tầng trong kiểu.** `payload as Array<unknown> as Array<Target>` và `payload as Record<string, unknown> as Config` chú thích một tham chiếu kiểu có THAM SỐ là từ khoá |
| `no-double-cast` | **Xoá mà không có cast nào để nhìn.** Giá trị vốn đã mang dạng viết tắt — trả về của một hàm phân tích chuỗi, một module không có kiểu, một khai báo nhà cung cấp viết sai — được gán thẳng vào hình dạng đã khai báo. Đường biên bị vượt qua trong im lặng |
| `no-double-cast` | **Mọi thứ ngoài một đoạn đường dẫn `/src/`.** Thư mục gói, thư mục route ở gốc, script dựng, tệp cấu hình hay một workspace anh em đều không được soi. Đây là cửa rộng nhất: một tệp ở đó cast thoải mái rồi export kết quả ra dưới một cái tên trông lương thiện |
| `no-double-cast` | **Cùng chuỗi ký tự ấy, ở một thư mục tổ tiên.** Cổng là `includes("/src/")` chứ không phải phép thử đường dẫn tương đối với gốc kho. Một checkout nằm dưới thư mục tên `src` kéo mọi tệp vào phạm vi — lỗi ngược chiều, báo ở chỗ không có lỗi |
| `no-double-cast` | **Tên tệp, dùng để thoát.** Đổi tên một tệp đang bị quản thành đuôi `.spec.ts` là xoá rule khỏi tệp đó, không để lại dòng diff nào trong rule và không có gì để ai soát |
| `no-double-cast` | **Tên tệp, dùng để báo oan.** Tệp trợ giúp kiểm thử, tệp dữ liệu mẫu, xưởng dựng giá trị sai có chủ đích, cách bố trí kiểm thử theo thư mục, hay một kiểm thử viết với phần mở rộng module khác đều bị quản như production. Thiếu tầm và quá tầm là cùng một dòng lệnh |
| được uỷ thác | **`TYPE-SAFETY-2` và `TYPE-SAFETY-3`** — do một gói mà mô-đun này không phát hành giữ, nên cấu hình lỏng tay ở đó phá hai mã đã công bố trong khi cổng ở đây vẫn xanh |
| không ai | **`TYPE-SAFETY-5`.** Rule báo theo hình dạng và không bao giờ đọc thứ viết cạnh nó, nên một phép cast có lời giải thích cẩn thận và một phép cast không có gì được đối xử y hệt nhau. Không có gì ở đâu kiểm rằng một phép cast sống sót có mang theo lý do |

## Đầu vào

| Đầu vào | Bằng chứng cần có |
|---|---|
| đường dẫn tệp | `context.filename`, không có thì `context.getFilename()`, chuẩn hoá sang gạch chéo |
| phép thử phạm vi | chuỗi con `/src/` có mặt trong đường dẫn ấy |
| phép thử miễn trừ | đường dẫn KHÔNG kết thúc bằng `.test.ts`, `.test.tsx`, `.spec.ts` hay `.spec.tsx` |
| nút ngoài | một `TSAsExpression` |
| nút trong | `expression` của nút ấy, bắt buộc là một `TSAsExpression` |
| chú thích vế trong | `typeAnnotation` của cast bên trong, bắt buộc là `TSUnknownKeyword` |

## Quy tắc

1. Danh tính của rule là **tên đã công bố** — chuỗi hiện ra trong log dựng và trong comment tắt rule.
   Không có chỗ nào ở đây gán cho nó một con số.
2. Phát hiện là thuần cú pháp. Không giải module, không hỏi kiểu, không chạy code.
3. Cổng tệp được xét một lần cho mỗi tệp, trước khi cài visitor. Ngoài phạm vi, rule không tồn tại chứ
   không phải im lặng — vì thế không báo cáo nào lấy lại được bằng cách chuyển tệp về chỗ cũ mà không
   chạy lint lại.
4. Miễn trừ là một đường dẫn và chỉ là đường dẫn. Không phán đoán, không comment và không tuỳ chọn cấu
   hình nào cấp được nó, và nó không cấp được theo từng nơi gọi.
5. Một nút ngoài vi phạm là một báo cáo, neo ở cast ngoài, nên một comment tắt rule trên câu lệnh che
   đúng một phép xoá.
6. Báo cáo là toàn bộ phương thuốc. Rule không phát hành bản vá tự động, vì mọi bản sửa thật đều cho
   giá trị một hình dạng mà nó chưa từng có, và máy không chọn được hình dạng ấy.
7. Ý kiến về mức nghiêm khắc của chính mô-đun là `error`; cấu hình bên tiêu thụ vẫn là nơi có thẩm
   quyền quyết định thứ gì thực sự được bật.

## Ngoại lệ

- **Tệp kiểm thử.** Bốn hậu tố tên tệp — `.test.ts`, `.test.tsx`, `.spec.ts`, `.spec.tsx` — miễn trừ
  trọn gói. Đây là `TYPE-SAFETY-4` viết thành đường dẫn, và mô-đun rule nói rõ vì sao **phải** là đường
  dẫn chứ không phải một phán đoán: chứng minh một API đóng từ chối dữ liệu sai thì phải dựng được dữ
  liệu sai, mà không có cách nào dựng một giá trị mà kiểu cấm nếu không bảo trình biên dịch quên kiểu
  đi. Bản dựa trên phán đoán sẽ bị đem ra cãi lại ở từng nơi gọi; một đường dẫn thì cãi một lần. Nó
  giải phóng `TYPE-SAFETY-1` khỏi những tệp ấy hoàn toàn.
- **Mọi thứ ngoài `/src/`.** Không phải một ân huệ cấp cho ai — là một quyết định về việc cái gì được
  tính là mã nguồn sản phẩm. Nó giải phóng `TYPE-SAFETY-1` khỏi mọi thư mục khác, và đó là nơi chứa
  khối lượng mã không được soi lớn nhất.
- **Cast một tầng.** Không phải sơ suất, cũng không phải ân huệ: một phép thu hẹp mà trình biên dịch
  còn kiểm được một phần là một hành vi khác hẳn một phép xoá, và bộ kiểm thử song sinh của rule ghim
  chính xác sự khác biệt đó. Nó không giải phóng gì cả, vì `TYPE-SAFETY-1` chưa bao giờ nhận phần ấy.
- **Cast mở rộng sang riêng từ khoá.** Hợp lệ theo thiết kế; đó là hình dạng luật đòi khi hình dạng
  thật sự chưa được biết.

## Đầu ra

Mỗi phát hiện một khối:

```text
rule:    no-double-cast
file:    <path as the gate saw it, forward-slashed>
scope:   <in | out — which half of the file gate decided it>
node:    TSAsExpression (outer)
inner:   TSAsExpression -> TSUnknownKeyword
message: double
report:  <double | none>
hatch:   <the open hatch that would have hidden this, or none>
```

Một tệp trong phạm vi mà sạch thì phát ra một khối với `scope: in`, `report: none`, các dòng `node:`,
`inner:` và `message:` viết là `—`, kèm một dòng `hatch` mỗi khi một cửa còn mở có thể đã tạo ra chính
sự im lặng ấy.

Một tệp ngoài phạm vi phát ra một khối với `scope: out`, `report: none`, và một dòng `hatch` gọi tên
nửa nào của cổng đã loại nó ra. Nó không hề "qua"; không visitor nào được cài.

## Ví dụ đã giải

**Đầu vào.** `src/data/profile.ts`, đúng chỗ dữ liệu từ ngoài chương trình đi vào:

```ts
const response = await fetch(url)
const row = (await response.json()) as unknown as ProfileRow

const SEED_ROW = fixture as unknown as ProfileRow
export const seed = () => insert(SEED_ROW)
```

Đường dẫn chứa `/src/` và không kết thúc bằng một trong bốn hậu tố, nên cổng qua và visitor được cài.
Hai nút ngoài vi phạm, hai khối.

```text
rule:    no-double-cast
file:    src/data/profile.ts
scope:   in — contains /src/, no test or spec suffix
node:    TSAsExpression (outer)
inner:   TSAsExpression -> TSUnknownKeyword
message: double
report:  double
hatch:   none
```

```text
rule:    no-double-cast
file:    src/data/profile.ts
scope:   in — contains /src/, no test or spec suffix
node:    TSAsExpression (outer)
inner:   TSAsExpression -> TSUnknownKeyword
message: double
report:  double
hatch:   none
```

Gom giá trị vào một hằng số không rửa được cái thứ hai: nút vi phạm đi theo vào phần khởi tạo của hằng
và bị thăm y như cũ.

**Bản đã sửa.** Phép xoá được thay bằng một phép mở rộng công khai cùng một phép kiểm mà máy đi theo
được, còn hàng dữ liệu mẫu do một hàm dựng có kiểu tạo ra:

```ts
const response = await fetch(url)
const payload: unknown = await response.json()
if (!isProfileRow(payload)) throw new InvalidPayloadError()
const row = payload

const SEED_ROW: ProfileRow = buildProfileRow({ id: "seed" })
export const seed = () => insert(SEED_ROW)
```

Nhưng cũng chính tệp ấy, sửa cho trông y hệt như trên rồi xoá đi phép kiểm, thì cũng im lặng:

```ts
const loose: unknown = await response.json()
const row = loose as ProfileRow
```

```text
rule:    no-double-cast
file:    src/data/profile.ts
scope:   in — contains /src/, no test or spec suffix
node:    —
inner:   —
message: —
report:  none
hatch:   the erasure split across two statements — no double cast exists, the erasure is intact, and
         the compliant shape and the evasion are syntactically identical. Only the check between the
         two lines separates them, and nothing requires a check
```

## Phạm vi

Mô-đun này ghi lại đúng một rule do mô-đun rule của luật type-safety công bố, phát hành trong
`@starci/eslint-canon-fe`. Nó không ghi rule đáng-lẽ-phải-có: một rule không chỉ ra được là một đề
xuất, không phải một sự thi hành. Nó không xét dạng viết tắt của phép xoá kiểu và cũng không xét cách
viết mảng — hai thứ ấy thuộc rule no-explicit-any của bộ plugin TypeScript và rule array-type của nó
với mặc định generic — và nó không xét việc một phép cast sống sót có mang theo lý do hay không, thứ
không mô-đun nào sở hữu.
