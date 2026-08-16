---
id: be-lints-exceptions-audit
title: audit.md
slug: /be/lints/exceptions/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện phần cưỡng chế — quy tắc nào giữ được luật, quy tắc nào chỉ trông như giữ.
---

# audit.md

> Version: `2.00` · Mô-đun: `exceptions`

Phản biện này không hỏi luật có đúng không. Nó hỏi **máy giữ được bao nhiêu phần của luật**, giữ bằng
cơ chế nào, và phần không giữ được đã được nói ra chưa.

## Verdict

Chấp nhận, kèm năm phát hiện và mười lăm cửa còn mở.

Nguồn công bố **đúng bốn** quy tắc: `rules` liệt kê bốn khoá, `recommended` liệt kê bốn khoá cùng
tên, và hai danh sách khớp nhau. Con số kỳ vọng khi bắt đầu là "khoảng bốn", và đếm trên tệp cũng ra
bốn — không có chênh lệch nào phải ghi nhận ở đây.

Điều đáng ghi nhận là **luật có sáu mã, phần cưỡng chế có bốn**. Bốn quy tắc phủ `EXCEPTION-1` tới
`EXCEPTION-4`. `EXCEPTION-5` và `EXCEPTION-6` không có quy tắc nào giữ.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| Mỗi quy tắc có giữ đúng một mã luật không | Có. Bốn quy tắc, bốn mã, không chồng lấn |
| Có mã luật nào bị hai quy tắc cùng giữ không | Không |
| Có quy tắc nào không giữ mã nào không | Không. Cả bốn đều truy nguyên được về một mã |
| Cặp chỗ-ném / chỗ-khai-báo có đóng được lỗ của nhau không | Đóng được đúng một lỗ đã nêu: lớp kế thừa lớp nền framework. Không đóng được lỗ "ném một biến" |
| Tên quy tắc có mô tả đúng hành vi không | **Không, ở cả bốn.** Xem `## Findings` |
| Cổng miễn trừ có hẹp như lời văn của nguồn mô tả không | Không, ở cổng probe. Xem `## Findings` |
| Có quy tắc nào cần cấu hình mới chạy đúng không | Không. Cả bốn khai báo `schema: []` |
| Có quy tắc nào cần thông tin liên tệp không | `throw-abstract-exception` cần và không có — nguồn nói thẳng đó là heuristic |
| Suy luận từ im lặng có an toàn không | Không. Ba trong bốn quy tắc im ngay khi hình dạng cú pháp lệch |

## Findings

**F1 · `throw-abstract-exception` không kiểm thứ mà tên nó nói.** Tên hứa "ném một
`AbstractException`". Quy tắc không xác minh lớp được ném kế thừa gì — nó **không thể**, vì đọc mỗi
lần một tệp. Thực tế nó là một **danh sách chặn**: chuỗi `"Error"` cộng mười bảy tên viết tay. Mọi
thứ khác đều qua. Nguồn tự nhận đây là heuristic và nói rõ `exception-extends-abstract` là thứ làm
cho heuristic đó có căn cứ; phát hiện này không phải cáo buộc, mà là yêu cầu đừng đọc tên quy tắc như
một lời bảo đảm.

**F2 · Cổng probe rộng hơn lời văn của chính nguồn.** Chú thích nói "chỉ một health controller đủ
điều kiện, nên đây không thể trở thành chỗ một service lẩn tránh việc đặt tên cho thất bại của mình".
Biểu thức thật là `/\/health(?:z)?\.controller\.ts$|\/health\//` — nhánh thứ hai khớp **một đoạn thư
mục**. Mọi tệp dưới một thư mục tên `health` đều thừa hưởng miễn trừ: service, mapper, repository.
Đúng cái điều chú thích nói là không thể.

**F3 · `require-exception-object-arg` đòi một object *literal*, không phải một object.** Luật viết
"hàm khởi tạo nhận MỘT object metadata". Quy tắc kiểm `arguments[0].type === "ObjectExpression"` tại
chỗ gọi. Hệ quả là `const meta = { id }` rồi `throw new XException(meta)` — hình dạng đúng hoàn toàn
— bị báo `notObject`, và `{ … } as SomeMeta` cũng vậy. Đây là **phát hiện sai**, loại nguy hiểm nhất
theo chính lời của nguồn: một quy tắc bắn vào mã đúng dạy người sau thói quen cuộn qua nó.

**F4 · `exception-extends-abstract` cấm cả lớp nền trung gian hợp lệ.** Quy tắc chỉ chấp nhận lớp cha
trực tiếp đúng bằng `AbstractException`. Một cây hai tầng — `DomainRuleException extends
AbstractException`, rồi `CourseAlreadyEnrolledException extends DomainRuleException` — thoả luật khi
xét bắc cầu nhưng vẫn bị báo. Có thể đây là ý đồ (cây phẳng dễ đọc hơn), nhưng ý đồ đó **không nằm ở
đâu trong luật**, nên hiện tại quy tắc đang cưỡng chế một điều khoản chưa được viết ra.

**F5 · `exception-in-errors-folder` cưỡng chế cách đánh vần, không cưỡng chế "một chỗ".** Lý do của
luật là "câu hỏi *ứng dụng này ném ra những gì* có một chỗ để tra". Quy tắc khớp cặp thư mục theo tên
ở bất kỳ vị trí nào trong đường dẫn, nên hai mươi thư mục `exceptions/errors/` rải khắp các module
vẫn xanh. Nới rộng này là **cố ý và đúng** — bản trước neo vào một đường dẫn tuyệt đối của đúng một
repo và báo 83 phát hiện sai ở một back end khác — nhưng cái giá phải trả thì chưa được ghi ở đâu cả
trước tài liệu này.

## Decisions

- Ghi lại **đúng bốn** quy tắc có thật trong nguồn. Quy tắc đáng có mà chưa có thì nằm ở
  `## Rủi ro còn mở`, không nằm trong bảng `## Rules`.
- Dùng **tên đã công bố** làm danh tính, không đặt mã số cho quy tắc. Một quy tắc hai tên là một quy
  tắc không truy nguyên được từ log build về tài liệu.
- Giữ nguyên chính tả mọi định danh xuất hiện trong nguồn: tên quy tắc, `messageId`, tên lớp trong
  danh sách chặn. Lệnh cấm tên riêng áp cho **lời văn và ví dụ**, không áp cho chuỗi được in ra.
- Bắt buộc mỗi quy tắc có ít nhất một dòng trong bảng **Open** của `INDEX.md`. Không quy tắc nào được
  ghi là kín.
- Phân biệt ba trạng thái trong `example.md`: **SAI** (quy tắc bắn), **ĐI LỌT** (quy tắc không thấy,
  mã vẫn sai), **BÁO NHẦM** (quy tắc bắn vào mã đúng). Gộp trạng thái hai vào "được phép" là cách một
  tài liệu cưỡng chế biến thành danh sách mẹo lách.

## Rủi ro còn mở

Mỗi mục nêu **quy tắc phải nhìn thêm cái gì mới đóng được**, hoặc vì sao đóng đắt hơn để mở.

### Luật không có quy tắc

- **`EXCEPTION-5` — metadata mang thứ người đọc thất bại sẽ cần.** Không quy tắc nào đọc nội dung
  object. Để đóng, quy tắc phải biết trường nào là *có nghĩa* cho từng lớp ngoại lệ — tức là phải có
  một lược đồ khai báo cho mỗi lớp và kiểm chỗ ném theo lược đồ đó. **Đóng đắt hơn giá trị**: chi phí
  là một lược đồ cho mọi ngoại lệ, còn `{}` vẫn hợp lệ theo `EXCEPTION-2` nên không có ranh giới máy
  đọc được giữa "rỗng vì không có gì để nói" và "rỗng vì lười".
- **`EXCEPTION-6` — một assertion của bộ chạy kiểm thử không phải một thất bại nghiệp vụ.** Điều này
  hiện chỉ tồn tại như **miễn trừ** trong `EXCEPTION-1`, không như cưỡng chế. Không có gì ngăn một
  tệp kiểm thử ném một ngoại lệ nghiệp vụ thật để giả lập, việc làm bẩn từ vựng thất bại theo đúng
  chiều ngược lại. Để đóng, cần một quy tắc riêng cấm khởi tạo lớp `*Exception` trong làn kiểm thử,
  và phải phân biệt được "ném để giả lập" với "bắt để khẳng định" — khả thi, chưa ai viết.
- **Hậu tố `.test.ts` không được coi là làn kiểm thử.** Cổng nhận `.spec.ts`, `-spec.ts` và
  `/src/tests/`. Một repo dùng quy ước `.test.ts` sẽ thấy `EXCEPTION-1` bắn vào chính những dòng mà
  `EXCEPTION-6` đã tha trong lời văn — đúng dạng bất đồng giữa lời văn và artifact mà nguồn nói là
  tệ nhất. Đóng bằng cách thêm một nhánh vào biểu thức: rẻ, nên rủi ro này **đáng đóng**.

### Cửa mở của từng quy tắc

- **Ném một biến, không ném một `new`.** `const e = new Error(...); throw e` đi lọt cả hai quy tắc
  chỗ ném. Để đóng, quy tắc phải lần ngược định danh về chỗ gán trong cùng phạm vi — làm được bằng
  `context.sourceCode.getScope()` và phân tích tham chiếu, không cần thông tin kiểu. **Đáng đóng**,
  và là cửa mở lớn nhất còn lại.
- **Thất bại đi ra ngoài `throw`.** `Promise.reject(new Error(...))`, `subscriber.error(...)`,
  `callback(err)`. Để đóng, phải thăm `NewExpression` ở mọi vị trí thay vì thăm `ThrowStatement`, rồi
  loại trừ những chỗ khởi tạo hợp lệ. Đổi bề mặt của quy tắc và có nguy cơ phát hiện sai; **cần đo
  trước** trên một repo thật.
- **Danh sách framework là mười bảy chuỗi viết tay.** Mọi lớp vận chuyển ngoài danh sách đi lọt, và
  danh sách sẽ lỗi thời theo phiên bản framework. Để đóng thật, phải phân giải import và hỏi lớp đó
  đến từ đâu — tức là cần trình phân giải module. **Rẻ hơn:** thay so tên bằng một mẫu chung cho hậu
  tố vận chuyển cộng một danh sách cho phép, và ghim danh sách theo phiên bản framework.
- **Đổi tên khi import.** `import { X as Y }` vô hiệu hoá danh sách chặn cho cả tệp. Đóng bằng cách
  đọc `ImportSpecifier` và ánh xạ định danh cục bộ về tên đã import — chỉ cần cùng một tệp, nên
  **đáng đóng**.
- **`callee` là `MemberExpression`.** `new errors.XException()` đi lọt cả ba quy tắc chỗ ném. Đóng
  bằng cách đọc thuộc tính cuối của member expression khi nó không tính toán động. Rẻ.
- **`ClassExpression` không được thăm.** Cả hai quy tắc khai báo mù với
  `const X = class XException extends … {}`. Đóng bằng cách thêm `ClassExpression` vào bộ thăm và lấy
  tên từ `node.id` hoặc từ định danh được gán. Rẻ, **đáng đóng**.
- **Lớp cha không phải `Identifier`.** `extends mixin(Base)` và `extends ns.Base` là im lặng. Đóng
  cần đánh giá lời gọi hoặc phân giải namespace — với mixin thì **không đóng được trong một tệp**;
  với member expression thì rẻ.
- **Hậu tố tên là toàn bộ tiêu chí nhận diện.** Đổi `XException` thành `XError` là ra khỏi tầm nhìn
  của cả ba quy tắc lọc theo `/Exception$/`. Đóng bằng cách nhận diện theo **lớp cha** thay vì theo
  tên — nhưng lớp cha ở tệp khác, nên lại quay về giới hạn một-tệp. **Rẻ hơn:** thêm một quy tắc đặt
  tên bắt buộc hậu tố `Exception` cho mọi lớp kế thừa lớp nền; khi đó ba quy tắc kia lại đủ.
- **Cổng theo tên tệp là thứ rẻ nhất trong repo để đổi.** Một tệp sản xuất tên `client-spec.ts` mất
  hẳn `EXCEPTION-1`. Đóng bằng cách gắn làn kiểm thử vào **cấu hình** (glob trong config của repo)
  thay vì vào biểu thức trong quy tắc — đây cũng là điều `recommended` đã ngụ ý khi nói repo tiêu thụ
  tự tắt quy tắc cho các glob đó. **Đáng đóng bằng cách chuyển chỗ, không phải bằng cách sửa quy
  tắc.**
- **Cổng probe khớp đoạn thư mục** (F2). Đóng bằng cách bỏ nhánh `\/health\/` và chỉ giữ nhánh tên
  tệp controller. Rẻ, và làm cho quy tắc khớp với chính chú thích của nó.
- **`notObject` bắn vào biến và vào `as`** (F3). Đóng bằng cách chấp nhận thêm `TSAsExpression` bọc
  một `ObjectExpression`, và lần ngược một định danh về chỗ gán trong cùng phạm vi. Cùng cơ chế với
  cửa "ném một biến", nên đóng một lần được cả hai. **Đáng đóng.**
- **`extra` không dừng lại**, nên `new X(1, 2)` báo hai lần cho một chỗ ném. Đóng bằng một câu
  `return` sau khi báo `extra`. Một dòng.
- **Không quy tắc nào đếm được số thư mục ngoại lệ** (F5). Để đóng, cần trạng thái liên tệp — ESLint
  không cho một quy tắc biết tập tệp đã kiểm. **Đóng ở đúng chỗ khác:** một kiểm tra ở tầng repo đếm
  số thư mục `exceptions/errors/` trên mỗi ứng dụng và gãy khi vượt một. Không phải việc của quy tắc
  lint.
- **Lớp ngoại lệ thật viết không kế thừa gì** đi lọt `exception-in-errors-folder` theo thiết kế.
  Đóng sẽ kéo theo mọi lớp dữ liệu tên `*Exception` vào tầm bắn. **Đóng đắt hơn giá trị.**
- **Mọi quy tắc đều tắt được bằng một dòng chú thích.** Không quy tắc nào đặt cờ chống tắt. Đây là
  đánh đổi cố ý của công cụ, nhưng nó có nghĩa là mọi con số "không nợ" đều phải đọc kèm số lần tắt
  cảnh báo trong repo.

## Re-audit Triggers

- Nguồn công bố thêm, bớt hoặc đổi tên một quy tắc trong `rules` hoặc `recommended`.
- Luật thêm một mã `EXCEPTION-<n>`, hoặc `EXCEPTION-5`/`EXCEPTION-6` có quy tắc giữ.
- Danh sách mười bảy tên framework thay đổi, hoặc framework phát hành một lớp vận chuyển mới.
- Bất kỳ cổng theo tên tệp nào đổi biểu thức, hoặc chuyển từ quy tắc ra cấu hình.
- Có người báo một phát hiện sai — mọi phát hiện sai đều là một dòng mới ở `## Findings`, không phải
  một lần tắt cảnh báo.
- Có mã lọt qua cổng xanh rồi hỏng ngoài môi trường chạy thật: cửa đã lọt phải được thêm vào bảng
  **Open**, kể cả khi không sửa quy tắc.
- Repo tiêu thụ đổi quy ước đặt tên tệp kiểm thử, hoặc đổi bố cục thư mục ứng dụng.
