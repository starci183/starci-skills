---
id: be-lints-e2e-flow-vi
title: vi.md
slug: /be/lints/e2e-flow/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng luật lint của luồng e2e — bắt gì, giữ mã nào, phát hiện bằng gì, và cửa nào còn mở.
---

# vi.md

> Version: `2.00` · Mô-đun: `e2e-flow`

# Máy giữ luật luồng e2e

Luật nói: một tệp luồng biến **một câu nghiệp vụ** thành một bài kiểm thử chỉ đỏ khi nghiệp vụ hỏng,
và không đỏ vào lúc nào khác. Luật đó có mười hai mã. Tám mã trong số ấy phụ thuộc vào **ý nghĩa** —
một cái tên nói gì, cái gì đang được khẳng định, ai đang hành động — nên cố tình không có máy giữ:
một luật nổ vào phán đoán là luật mà người viết học cách tắt đi, và lúc đó luật còn tệ hơn khi chẳng
có gì giữ cả.

Tài liệu này không chép lại luật. Nó ghi **mức thực thi**: mỗi luật lint nhìn vào cú pháp nào, và
quan trọng hơn, viết kiểu gì thì nó **không** nhìn thấy.

Mô-đun luật công bố năm luật, và ở đây ghi đúng năm — trùng với con số mà chính văn bản luật tự nhận.
Tên của một luật chính là danh tính của nó: đó là chuỗi in ra trong log build và chuỗi viết trong dòng
tắt luật. Ở đây không đặt thêm số cho luật nào cả.

## Bảng tra nhanh

| Luật | Mã luật | Bắt gì |
|---|---|---|
| `e2e-uses-production-transport` | `E2E-11` (chỉ nửa "gọi thẳng diễn viên nội bộ") | Nhập tên bộ điều phối từ gói CQRS; **mọi** lời gọi thành viên tên `execute` hoặc `process`; lời gọi có bên nhận là định danh kết thúc bằng `Worker` hay `Handler` |
| `e2e-asserts-persisted-state` | `E2E-4` (chỉ nửa "đọc lại trạng thái đã lưu") | Một tệp luồng mà **không** có lấy một trong sáu tên định danh lưu trữ xuất hiện ở bất kỳ đâu |
| `no-model-call-in-e2e` | `E2E-12` (chỉ nửa "nhập gói nhà cung cấp") | Câu `import` có nguồn khớp một trong sáu mẫu gói nhà cung cấp mô hình |
| `no-sleep-in-flow` | `E2E-3` (chỉ nửa "đừng ngủ") | Lời gọi tới một trong năm định danh ngủ, hoặc `new Promise` mà **văn bản nguồn** có chứa `setTimeout` |
| `no-branch-in-flow-step` | `E2E-7` | `if`, toán tử ba ngôi, `switch`, hoặc toán tử logic đứng thành nguyên một câu lệnh, nằm trong thân `it`/`test` |

Cả năm đều ánh xạ được vào một mã mà luật thật sự công bố, nên kệ này không ghi luật nào thực thi một
quyết định chưa được viết ra. Nhưng cả năm đều có khoảng cách giữa **tên** và **cơ chế**, và tên mới
là thứ người ta tin khi bản báo lỗi không nằm trước mặt.

---

## `e2e-uses-production-transport`

**Bắt gì.** Ba chuyện khác nhau dưới một cái tên, bằng ba thông điệp. Một, tên bộ điều phối nội bộ
được nhập từ gói CQRS. Hai, **bất kỳ** lời gọi thành viên nào có phương thức tên `execute` hoặc
`process`. Ba, một lời gọi thành viên mà bên nhận là định danh kết thúc bằng `Worker` hoặc `Handler`.

**Giữ mã nào.** `E2E-11`, và chỉ nửa "gọi thẳng diễn viên nội bộ" của nó. Nửa còn lại — bài kiểm thử
có **đi vào bằng cổng sản xuất** hay không — là một dữ kiện về cách bài kiểm thử được kích hoạt, không
phải một hình dạng cú pháp, nên không luật nào giữ.

**Cách phát hiện.** Ở nút `ImportDeclaration`: chỉ hành động khi `node.source.value` **đúng bằng**
`@nestjs/cqrs`, rồi với mỗi `ImportSpecifier` đọc `imported.name || imported.value` và báo khi tên đó
là `CommandBus`, `QueryBus` hay `EventBus`. Ở nút `CallExpression`: bắt buộc `callee` là
`MemberExpression` và `computed === false`; nếu `callee.property.name` là `execute` hoặc `process` thì
báo ngay rồi **thoát**. Nếu không, bóc `callee.object` qua `TSAsExpression`, `TSTypeAssertion`,
`ChainExpression`, và báo khi thứ còn lại là `Identifier` khớp `/(?:Worker|Handler)$/`.

**Vì sao luật này đáng có máy giữ.** Vì một lời gọi thẳng vào diễn viên nội bộ **trông giống hệt** một
bài kiểm thử tốt. Nó ngắn hơn, nhanh hơn, ổn định hơn, và nó xanh. Thứ nó lặng lẽ xoá đi — tuần tự
hoá, khoá, thử lại, xác nhận đã nhận, tranh chấp giữa các tiêu thụ — chính là toàn bộ hành vi mà một
luồng vận hành sinh ra để chứng minh. Người viết không thể thấy phần bị xoá, vì phần bị xoá không để
lại dấu vết nào trong tệp.

**Cửa còn mở.** Bên nhận phải là **một định danh trần**: `app.get(OrderWorker).handle()`,
`workers.order.handle()`, `this.orderWorker.handle()` đều lọt vì bên nhận không phải `Identifier`.
Phép thử tên là phép so **đuôi** và có phân biệt hoa thường, nên `const worker`, `const consumer`,
`const projector` giữ đúng cái đối tượng luật cấm gọi mà vẫn qua. Ngoài hai tên phương thức cứng, mọi
phương thức nội bộ khác — kể cả `finalize`, chính cái tên mà văn bản luật nêu đích danh — chỉ bị bắt
qua nhánh tên bên nhận. Gọi bằng ngoặc vuông, `worker["process"]()`, thoát ở ngay cổng `computed`
trước cả hai nhánh: hai dấu ngoặc xoá được vi phạm ồn ào nhất trong lane. Và về phía nhập, phép thử là
**bằng đúng một chuỗi**, nên `import * as cqrs`, nhập mặc định, `require`, `export … from`, một đường
dẫn con, hay một tệp trung chuyển cục bộ đều đi lọt.

Theo chiều ngược lại, luật này **báo thừa rất nhiều**: `builder.execute()` trên một trình dựng truy
vấn và `stream.process()` trên một bộ phân tích đều bị báo dù chẳng có gì bị đi tắt. Đây không phải
cửa lách mà là khiếm khuyết ngược — và nó chính là thứ dạy người ta viết dòng tắt luật, rồi dòng tắt
luật đó cũng tắt luôn hai nhánh kia.

---

## `e2e-asserts-persisted-state`

**Bắt gì.** Một tệp luồng mà trong toàn bộ mã nguồn **không** xuất hiện lấy một trong sáu tên:
`entityManager`, `dataSource`, `EntityManager`, `DataSource`, `getRepository`, `queryRunner`. Đúng một
báo cáo cho mỗi tệp, neo ở nút `Program`.

**Giữ mã nào.** `E2E-4`, và chỉ nửa "đọc lại từ nơi nó sống". Nửa còn lại — **hệ quả** được khẳng định
có đúng là hệ quả nghiệp vụ không — là ý nghĩa, không phải cú pháp.

**Cách phát hiện.** Duyệt **mọi** `Identifier`, thử `node.name` với
`/^(?:entityManager|dataSource|EntityManager|DataSource|getRepository|queryRunner)$/` và bật một cờ
phạm vi tệp. Tới `"Program:exit"`, nếu cờ vẫn tắt thì báo tại nút `Program`.

**Vì sao luật này đáng có máy giữ.** Vì khẳng định vào phong bì phản hồi là sai lầm **dễ chịu** nhất
trong lane này: nó luôn xanh, nó chạy nhanh, và nó chứng minh đúng một điều là máy chủ có trả lời. Một
máy đếm được rằng tệp này chưa từng chạm tới nơi trạng thái thật sự sống là thứ rẻ nhất có thể làm,
và nó bắt được cả một hạng lỗi trong một dòng.

**Cửa còn mở.** Đây là luật lỏng nhất trên kệ, vì nó kiểm **sự xuất hiện của một cái tên**, không kiểm
một phép khẳng định. Một câu `import { DataSource } from "typeorm"` không dùng tới, đặt ở đầu tệp, làm
luật im vĩnh viễn — và người dọn dẹp phần nhập, khi xoá nó đi, sẽ làm một tệp đang xanh hoá đỏ mà
không đụng vào bài kiểm thử nào. Theo chiều ngược lại, mọi lần đọc trạng thái **qua bộ khung dùng
chung** — `world.db.isEnrolled(…)`, `repo.findOne(…)`, một truy vấn tài liệu, một lần đọc cache — đều
bị báo dù đó chính là hình dạng mà `E2E-8` bảo người viết dựng ra. Hai điều luật kéo ngược nhau ở đúng
chỗ này. Và tên thoả mãn luật thường lại là tên đã **ghi** dữ liệu mẫu trong `beforeAll`, tức là một
lần đọc chẳng có gì: luật không phân biệt được dựng cảnh với khẳng định, vì nó không hề nhìn xem định
danh đó nằm ở đâu.

---

## `no-model-call-in-e2e`

**Bắt gì.** Một câu `import` có chuỗi nguồn khớp một trong sáu mẫu gói nhà cung cấp mô hình.

**Giữ mã nào.** `E2E-12`, và chỉ nửa "nhập gói nhà cung cấp". Nửa quan trọng hơn — **chính sách nội bộ
phải giữ nguyên**, chỉ kết quả bên ngoài mới được kịch bản hoá — không có máy nào giữ, vì "mô-đun này
là điều phối nội bộ hay là khách hàng bên ngoài" là một phán đoán.

**Cách phát hiện.** Duyệt `ImportDeclaration`, bắt buộc `node.source.value` là chuỗi, rồi thử với
`/^(?:@anthropic-ai\/|openai$|openai\/|ollama$|@google\/generative-ai|@mistralai\/|cohere-ai)/`. Ba
nhánh là tiền tố có dấu chéo, hai nhánh so bằng đúng (`openai`, `ollama`), và hai nhánh —
`@google/generative-ai`, `cohere-ai` — là tiền tố mở, nên chúng cũng khớp mọi tên gói dài hơn bắt đầu
bằng chuỗi đó.

**Vì sao luật này đáng có máy giữ.** Vì cái giá của lỗi này không nằm trong bài kiểm thử. Một lần gọi
thật tới nhà cung cấp trong bộ e2e là tiền thật, là độ trễ thật, và là một kết quả không tất định
được đem đi khẳng định — nghĩa là một bài kiểm thử đỏ ngẫu nhiên mà không ai tái hiện được. Đây đúng
là loại việc phải chặn bằng máy, vì nó không hỏng ngay: nó hỏng vào lần chạy thứ hai trăm.

**Cửa còn mở.** Chỉ `ImportDeclaration` bị nhìn, nên `require`, `import()` động và `export … from` lọt.
Danh sách sáu mẫu là một danh sách, mà danh sách thì phải được nuôi: các biến thể chạy trên nền tảng
đám mây, các cổng tổng hợp, các bản chạy tại chỗ, và **tên gói mới sau một lần đổi tên của chính nhà
cung cấp** đều nằm ngoài; một cái tên suýt trúng như `openai-edge` cũng lọt, vì nó trượt cả nhánh so
bằng lẫn nhánh có dấu chéo.

Hai cửa lớn nhất thì không dính gì tới danh sách. Thứ nhất, **gọi thẳng bằng HTTP**: một lời `fetch`
tới đường dẫn của nhà cung cấp không nhập gì cả, trong khi làm đúng cái việc luật cấm. Thứ hai, và đắt
nhất, là **không kịch bản hoá gì hết**: bài kiểm thử để nguyên khách hàng thật, chính sách của ứng
dụng tự phân giải nhà cung cấp đã cấu hình, và một lời gọi trả tiền thật xảy ra bên trong một lần chạy
xanh. Tên luật nói "không gọi mô hình"; cơ chế chỉ biết "không nhập gói mô hình".

Theo chiều ngược lại, `import type` từ một gói nhà cung cấp vẫn bị báo dù chẳng có gì được đóng gói ra
— và nó rơi trúng người đang làm đúng, tức là người đang khai kiểu cho một kết quả đã kịch bản hoá.

---

## `no-sleep-in-flow`

**Bắt gì.** Một lời gọi tới định danh trần `sleep`, `delay`, `wait`, `pause` hoặc `setTimeout`; hoặc
một `new Promise` mà văn bản nguồn của nó có chứa `setTimeout`.

**Giữ mã nào.** `E2E-3`, và chỉ nửa "đừng ngủ". Nửa "hãy hỏi vòng **có hạn chót**" không có máy nào
giữ.

**Cách phát hiện.** Ở `CallExpression`: `callee` phải là `Identifier` và tên nằm trong tập năm. Sau đó
đi ngược chuỗi `parent`; nếu gặp một `NewExpression` có `callee.name === "Promise"` thì **thoát không
báo**, nhường ca đó cho nhánh dưới. Ở `NewExpression`: `callee.name` phải là `Promise`, rồi lấy **văn
bản nguồn thô** của nút bằng `sourceCode.getText(node)` và báo khi văn bản đó khớp `/setTimeout/`.

**Vì sao luật này đáng có máy giữ.** Vì một con số thời gian không bao giờ tự nhận mình là một lời
đoán. Nó trông như một tham số đã được cân nhắc. Nó hỏng theo cả hai chiều cùng lúc — quá ngắn thì bộ
kiểm thử đỏ vì một lý do không phải lỗi, quá dài thì mọi lần chạy đều trả giá — và cả hai đều được
"sửa" bằng cách nâng con số lên, tức là mua thêm chậm mà không mua được đúng. Chỗ đáng khen của luật
này là nó **không báo hai lần** cho một giấc ngủ bọc trong promise: hai phát hiện trên cùng một dòng
không dạy được ai nên sửa cái nào.

**Cửa còn mở.** Ngủ qua thành viên thì lọt hết: `timers.setTimeout(500)`, `world.sleep(500)`,
`clock.wait(500)` không phải định danh trần — mà bộ hẹn giờ dạng promise hiện đại lại **thường được
viết đúng như vậy**, nên cách viết mới nhất của thói quen bị cấm chính là cách đi lọt. Đổi tên cũng
lọt: `import { sleep as settle }` hay `const nap = sleep` đưa callee ra ngoài tập năm tên. Mọi cách
đốt thời gian khác đều lọt: `setImmediate`, `process.nextTick`, `promisify(setTimeout)(500)` — nơi
callee là một lời gọi hàm còn `setTimeout` chỉ là đối số — một vòng `while` trên `Date.now()`, hay một
vòng thử lại đếm lần mà không chờ gì cả.

Và cửa mở đáng kể nhất là **hỏi vòng không hạn chót**: chính cái thay thế mà luật khuyên, viết dở, thì
qua sạch — nó treo tới khi bộ chạy tự hết giờ, rồi báo một cái timeout không gọi tên trạng thái nào.

Theo chiều ngược lại, nhánh promise so bằng **văn bản**, nên một `new Promise` chỉ *nhắc tới*
`setTimeout` trong một dòng chú thích, hoặc đặt tên biến là `setTimeoutMs`, vẫn bị báo dù không hề ngủ.

---

## `no-branch-in-flow-step`

**Bắt gì.** `if`, toán tử ba ngôi, `switch`, và toán tử logic đứng thành nguyên một câu lệnh — khi
chúng nằm trong thân một lời gọi `it` hoặc `test`.

**Giữ mã nào.** `E2E-7`, trọn vẹn ở mức mà cú pháp với tới được.

**Cách phát hiện.** Duyệt `IfStatement`, `ConditionalExpression`, `SwitchStatement`, và
`LogicalExpression` — nút cuối chỉ khi `node.parent.type === "ExpressionStatement"`. Mỗi ứng viên đi
qua `insideStep`: đi ngược chuỗi `parent`, dừng ở `CallExpression` đầu tiên mà `callee.name` — hoặc,
nếu không có, `callee.object.name` — là `it` hay `test`.

**Vì sao luật này đáng có máy giữ.** Vì một nhánh trong một bước làm bài kiểm thử **xanh trên cả hai
đường**, và lần chạy đi vào đường bỏ qua vẫn xanh trong khi chứng minh ít hơn. Không có gì trong bản
báo cáo nói cho ai biết điều đó đã xảy ra: số bài kiểm thử không đổi, màu không đổi, thời gian không
đổi. Đây đúng là loại sự thật chỉ máy mới nhìn ra, vì bằng chứng của nó là **thứ không xảy ra**. Việc
`insideStep` đọc cả `callee.object.name` là chi tiết đáng khen: `it.each`, `it.only`, `it.skip`,
`test.each` vẫn được tính là bước.

**Cửa còn mở.** `insideStep` là một phép đi ngược **theo văn bản**, nên một điều kiện nằm trong một hàm
mà bước gọi ra thì ở ngoài mọi luật trên kệ này — kể cả khi hàm đó khai báo ngay trong cùng tệp. Nhánh
trong `beforeAll`, `beforeEach`, `afterEach` hay trong thân `describe` cũng vậy, mà dựng cảnh có điều
kiện lại chính là cách một luồng hay rơi vào chỗ khẳng định khác nhau giữa các lần chạy. Những cách rẽ
không nằm trong bốn loại nút đều lọt: `try`/`catch`, `.catch(() => …)`, `Promise.allSettled`, chuỗi
truy cập có dấu hỏi trên chính giá trị đang được khẳng định, và `??` dùng để khởi tạo — vì toán tử vô
hiệu tuy là `LogicalExpression` nhưng chỉ vị trí câu lệnh mới bị báo. Toán tử logic nằm trong biểu
thức cũng được tha có chủ ý, nên `expect(a || b).toBe(true)` — một bài kiểm thử chuẩn bị sẵn cho cả hai
kết quả — đi qua. Cuối cùng, một phép khẳng định đủ lỏng để đúng trên cả hai đường mà **không cần toán
tử nào** thì cú pháp không với tới: khớp một tập con, khớp một giá trị bất kỳ, khẳng định vào `length`
thay vì vào nội dung.

## Luật

1. Danh tính của một luật là **tên công bố** của nó. Không đặt thêm số.
2. Phát hiện thuần cú pháp: không phân giải mô-đun, không hỏi kiểu, không chạy bài kiểm thử nào.
3. Một tệp chỉ vào phạm vi khi tên tệp kết thúc bằng `.e2e-spec.ts`. Không có cổng thứ hai, không có
   tuỳ chọn cấu hình: phạm vi của kệ này là một cái đuôi tên tệp.
4. Mỗi luật giữ nhiều nhất **một nửa** mã của nó, và mô-đun tự nói điều đó ở đầu tệp thay vì trình bày
   như đã phủ kín.
5. Hai luật trên kệ có thể mâu thuẫn nhau trên cùng một dòng, và đó là mâu thuẫn thật chứ không phải
   lỗi cấu hình.
6. Mức nghiêm mà mô-đun tự đề nghị là `error` cho cả năm; cấu hình của kho tiêu thụ mới là nơi quyết
   định thật sự bật cái gì.

## Ngoại lệ

Mô-đun này **không có** danh sách miễn trừ theo tệp, không có allow-list, không có thư mục được tha.
Điều đó đáng nói rõ, vì nó có nghĩa là mọi lối thoát đều là chuyện **hình dạng** chứ không phải chuyện
được phép — mà hình dạng là thứ người viết đổi mà không nhận ra mình vừa đổi.

Ba miễn trừ duy nhất nằm bên trong từng luật:

- **Giấc ngủ bọc trong `new Promise` được nhánh gọi hàm bỏ qua**, để nó chỉ bị báo một lần. Có lập
  luận, và lập luận đúng.
- **Toán tử logic chỉ bị báo ở vị trí câu lệnh**, nên cùng toán tử đó nằm trong một phép khẳng định
  thì được tha. Mua được sự yên tĩnh, trả bằng `expect(a || b)`.
- **Lời gọi thành viên bằng ngoặc vuông bị loại trước cả hai nhánh vận chuyển.** Chỗ này không được
  lập luận ở đâu và đọc như một sơ suất, không phải một quyết định.
