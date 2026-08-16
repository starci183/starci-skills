---
id: be-lints-e2e-flow-audit
title: audit.md
slug: /be/lints/e2e-flow/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức thực thi của luật luồng e2e — luật nào giữ được mã nào, và chỗ nào còn hở.
---

# audit.md

> Version: `2.00` · Mô-đun: `e2e-flow`

Bài phản biện này không hỏi văn bản luật có đúng không. Nó hỏi **máy có giữ được luật không**, và nếu
không thì hở ở đâu.

## Verdict

Chấp nhận, kèm mười một nhận định phải ghi ra chứ không được làm gọn.

Mô-đun luật công bố **năm** luật, đúng bằng con số dự kiến và đúng bằng con số mà chính văn bản luật
tự nhận ("năm trong mười hai"). Cả năm đều được ghi ở đây. Cả năm đều ánh xạ được vào một mã mà văn
bản luật thật sự công bố — nên trên kệ này **không có** luật nào thực thi một quyết định chưa được
viết ra, và cũng không mã nào bị bịa ra để khớp với một luật.

Điều đáng ghi nhận trước tiên: mô-đun luật mở đầu bằng một đoạn nói rõ **cái gì đã được đo và cố ý bỏ
lại**, kèm lý do cho từng mã. Đó là hình dạng đúng của một mô-đun thực thi. Nó ngăn người đọc sau
"làm nốt cho đủ" và biến một danh sách thiếu thành một danh sách **có chủ ý**.

Điều đáng lo tương ứng: cả năm luật đều có khoảng cách giữa **tên** và **cơ chế**, và ở ba luật khoảng
cách ấy đủ rộng để một người tin vào tên sẽ tin sai. Một luật rò mà người ta tưởng đã kín thì nguy hơn
một luật không tồn tại — luật không tồn tại thì ai cũng biết là chưa có gì giữ.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| Đếm số luật công bố | 5 — trùng dự kiến. Nguồn là bảng `rules` xuất ra cuối mô-đun |
| Con số này có khớp với văn bản luật không | Có. Văn bản luật nói "năm trong mười hai", và liệt kê đúng năm nửa mã |
| Mỗi luật có ánh xạ được vào một mã không | 5/5: `E2E-11`, `E2E-4`, `E2E-12`, `E2E-3`, `E2E-7` |
| Có mã nào bị bịa ra để khớp không | Không |
| Có luật nào được đặt thêm số định danh không | Không. Danh tính là tên công bố |
| Mỗi luật có ít nhất một cửa mở thật không | Có, cả năm. Không luật nào được ghi "không có" cho gọn |
| Luật nào giữ **trọn** mã của nó | Chỉ `no-branch-in-flow-step`, và chỉ ở mức cú pháp với tới được. Bốn luật còn lại tự khai là một nửa |
| Có miễn trừ theo tệp, allow-list hay thư mục được tha không | Không có cái nào. Mọi lối thoát là chuyện hình dạng, không phải chuyện được phép |
| Phát hiện có phụ thuộc phân giải mô-đun hay kiểu không | Không. Thuần cú pháp — nên nhanh, và nên dễ lách bằng cách đổi hình dạng cú pháp |
| Tên luật có tả đúng hành vi thật không | 2/5. `no-sleep-in-flow` và `no-branch-in-flow-step` gần đúng; ba luật kia lệch đáng kể |
| Hai luật có bao giờ mâu thuẫn trên cùng một dòng không | Có, một cặp thật: xem Findings mục 2 |

## Findings

1. **`e2e-uses-production-transport` cấm thẳng hai tên phương thức.** Nhánh `execute`/`process` không
   hề nhìn bên nhận. Nó báo mọi lời gọi thành viên viết bằng hai tên ấy, trên bất kỳ đối tượng nào,
   trong bất kỳ tệp luồng nào. Tên luật nói về **ranh giới vận chuyển**; cơ chế nói "trong lane này
   không phương thức nào được tên là `execute` hay `process`".

2. **Hai luật trên kệ mâu thuẫn nhau trên cùng một dòng.** Phép đọc trạng thái thông thường của thư
   viện lưu trữ là `createQueryBuilder(…)….execute()`. `e2e-asserts-persisted-state` đòi hỏi chính
   phép đọc đó; `e2e-uses-production-transport` báo nó. Người viết đứng giữa hai luật `error` và lối
   thoát rẻ nhất là một dòng tắt luật — mà dòng tắt luật ấy tắt luôn cả hai nhánh còn lại của luật vận
   chuyển trên dòng đó.

3. **`e2e-asserts-persisted-state` kiểm một lần **nhắc tên**, không kiểm một phép khẳng định.** Cờ được
   bật bởi **bất kỳ** `Identifier` nào mang một trong sáu tên: một câu nhập không dùng, một chú thích
   kiểu, một tham số, một biến khai rồi bỏ. Hệ quả cụ thể và khó chịu: xoá một câu nhập thừa làm một
   tệp đang xanh hoá đỏ mà không đụng vào bài kiểm thử nào. Đó là bằng chứng đủ rằng thứ đang được đo
   không phải thứ luật muốn đo.

4. **Cùng luật ấy phạt đúng hình dạng mà `E2E-8` khuyên.** Luật văn bản bảo dựng một chỗ đứng lên cả
   thế giới, rồi tệp luồng gọi qua nó; luật lint lại đòi tệp luồng phải tự gọi tên một trong sáu định
   danh lưu trữ. Một luồng đọc trạng thái đàng hoàng qua bộ khung dùng chung bị báo. Đây là mâu thuẫn
   giữa **luật và luật**, không phải giữa luật và người viết.

5. **`no-model-call-in-e2e` phát hiện một câu nhập, không phát hiện một lời gọi.** Hai hình thái đắt
   nhất của chính sai lầm nó mang tên đều không nhập gì: gọi thẳng nhà cung cấp bằng HTTP, và **không
   kịch bản hoá gì cả** để chính sách của ứng dụng tự phân giải khách hàng thật. Cả hai đều là tiền
   thật và kết quả không tất định, bên trong một lần chạy xanh.

6. **`no-sleep-in-flow` giữ đúng nửa mã của nó.** `E2E-3` là hai lời khẳng định: đừng ngủ, và **hỏi
   vòng có hạn chót**. Vế thứ hai không có máy giữ, nên chính cái thay thế được khuyên, viết dở, thì
   qua sạch — và nó hỏng theo đúng kiểu mà luật viết ra để chặn: một cái timeout không gọi tên trạng
   thái nào.

7. **Hai luật báo thừa ở chỗ không có lối thoát nào.** `import type` từ một gói nhà cung cấp bị báo dù
   không đóng gói ra gì; và nhánh `new Promise` so bằng **văn bản nguồn**, nên một promise chỉ *nhắc
   tới* `setTimeout` trong một dòng chú thích cũng bị báo. Cái giá của phép thử thuần cú pháp, và nó
   rơi trúng người đang làm đúng.

8. **Một cổng bị loại trước cả hai nhánh mà không có lập luận.** `callee.computed` làm luật vận chuyển
   thoát ngay: `worker["process"]()` không bị nhìn. Mọi quyết định khác trong mô-đun đều có chú thích
   giải thích; riêng chỗ này đọc như sơ suất.

9. **Chú thích mức nghiêm đã cũ.** Đoạn giải thích `recommended` viết "Both are exact and both fire on
   a syntactic shape", trong khi bảng `rules` có **năm** mục. Câu chữ còn đúng về tinh thần, con số
   thì không — cùng một kiểu lệch mà kệ này tồn tại để bắt.

10. **Bài kiểm thử sinh đôi của mô-đun còn giữ một thứ không phải luật lint.** Ngoài các ca `valid`/
    `invalid`, tệp kiểm thử khai một danh sách tên luồng nghiệp vụ và khẳng định **mọi tên trong danh
    sách đều tồn tại thành một tệp** ở một đường dẫn cố định, đúng đuôi `.e2e-spec.ts`. Đây là thực
    thi thật và nó đóng được một phần cửa mở rộng nhất trên kệ — đổi tên một luồng **đã có tên trong
    danh sách** sẽ làm bài kiểm thử đỏ. Nhưng nó là một bài kiểm thử chứ không phải một luật, nó chỉ
    biết những luồng nó gọi tên, và nó neo vào một bố cục thư mục cụ thể. Ghi ra ở đây để không ai đọc
    cửa "đuôi tên tệp" nghiêm trọng hơn thực tế, và cũng để không ai nhầm nó là luật thứ sáu.

11. **Phép chuẩn hoá dấu chéo trong cổng tệp là mã chết.** `isE2eSpec` đổi `\` thành `/` rồi thử
    `/\.e2e-spec\.ts$/`. Cái đuôi ấy không chứa dấu chéo nào, nên phép chuẩn hoá không đổi kết quả ở
    bất kỳ đầu vào nào. Vô hại, nhưng nó làm người đọc tưởng cổng tệp có xét đường dẫn — trong khi nó
    chỉ xét đuôi tên.

## Decisions

- **Ghi đúng năm luật đang tồn tại.** Một luật đáng lẽ nên có mà chưa có thì không được ghi ở đây; nó
  nằm dưới "Rủi ro còn mở". Luật cao nhất của kệ này: thứ không chỉ tay vào được là một đề nghị, không
  phải một luật.
- **Danh tính là tên công bố.** Không đặt số cho luật. Tên đã là chuỗi in ra trong log build và chuỗi
  viết trong dòng tắt luật; đặt thêm số là cho một luật hai tên và mất khả năng biết thông điệp đến từ
  đâu.
- **Giữ nguyên chính tả mọi định danh**, kể cả khi nó mang tên một sản phẩm. Lệnh cấm tên sản phẩm áp
  vào **câu chữ** và **ví dụ**, không áp vào chuỗi mà bản build in ra.
- **Giữ tên gói, tên nút cú pháp và biểu thức chính quy trong bảng phát hiện.** Chúng là dữ liệu chịu
  lực của phép phát hiện; thay bằng tên giả sẽ làm bảng phát hiện vô dụng.
- **Ghi mâu thuẫn giữa hai luật ra thành một phát hiện**, không làm gọn nó thành một dòng ngoại lệ.
  Người đọc phải biết trước rằng hai luật `error` có thể cùng nói về một dòng.
- **Không luật nào được ghi "không có cửa mở".** Cả năm đều có ít nhất một hàng thật, và ba luật có
  cửa mở rộng hơn phần chúng đang giữ.

## Rủi ro còn mở

Mỗi mục dưới đây là một cửa còn mở, kèm thứ mà luật sẽ phải soi thêm để đóng nó — hoặc lý do đóng nó
đắt hơn giá trị nó mang lại.

- **Cổng tệp là một cái đuôi tên.** Toàn bộ kệ chỉ tồn tại cho `*.e2e-spec.ts`. Một bộ e2e đặt tên tệp
  là `*.spec.ts` dưới một thư mục riêng thì không nhận luật nào, và không cần sửa một dòng luật nào để
  sắp xếp như thế. **Để đóng:** đưa phạm vi ra cấu hình của kho tiêu thụ (`files:` trong khối cấu
  hình) thay vì chôn cứng một biểu thức chính quy trong luật. Đây là thay đổi cấu hình chứ không phải
  thay đổi luật, rẻ, và nên làm. **Đã đóng một phần ở nơi khác:** bài kiểm thử sinh đôi khẳng định một
  danh sách tên luồng phải tồn tại thành tệp đúng đuôi này, nên đổi tên một luồng **đã có tên trong
  danh sách** thì đỏ. Một luồng mới thêm dưới cái tên khác thì không.
- **Tệp trợ giúp.** Mọi cổng đều theo từng tệp. Chuyển lời gọi bus, giấc ngủ, nhánh rẽ hay câu nhập
  nhà cung cấp sang `world.ts` rồi nhập từ tệp luồng là làm cả năm luật biến mất. Trớ trêu là `E2E-8`
  bảo người viết dựng đúng cái tệp đó. **Để đóng:** cho phép cấu hình một tập tệp hạ tầng kiểm thử
  cũng chịu ba luật không cần ngữ cảnh bước (`no-sleep-in-flow`, `no-model-call-in-e2e`, nhánh nhập
  của luật vận chuyển). Không đóng được cho `no-branch-in-flow-step`, vì bên ngoài một bước thì "nhánh"
  không còn là một khái niệm có nghĩa.
- **Bên nhận không phải định danh trần.** `app.get(X).handle()`, `workers.settlement.finalize()`,
  `this.worker.run()` đều lọt. **Để đóng:** lần theo phần nhập và phần khai báo biến để biết định danh
  nào giữ một actor, thay vì so đuôi tên. Việc lần theo phần nhập là việc thật nhưng dùng lại được cho
  nhiều luật; so đuôi tên thì rẻ và **sai** ngay khi ai đó đặt tên biến là `worker`.
- **Chỉ hai tên phương thức bị cấm thẳng.** `finalize` — tên mà văn bản luật nêu đích danh — cùng
  `handle`, `run`, `consume`, `flush` chỉ bị bắt qua nhánh tên bên nhận. **Để đóng:** liệt kê thêm tên,
  hoặc bỏ hẳn danh sách tên và chỉ dựa vào việc nhận ra actor. Cách sau đúng hơn và cũng xoá luôn toàn
  bộ báo thừa ở mục dưới.
- **Báo thừa trên `execute`/`process`.** Đây là hàng **đáng làm nhất** trong bảng, vì nó vừa là báo
  thừa vừa là nguyên nhân sinh ra dòng tắt luật. **Để đóng:** buộc nhánh này phải có một bên nhận đã
  được nhận ra là actor — cùng đúng một việc lần theo phần nhập ở trên. Chi phí là mất khả năng bắt
  một lời gọi mà bên nhận không lần ra được nguồn; đổi lại, luật hết cãi nhau với luật kia.
- **Lời gọi thành viên bằng ngoặc vuông.** Hai dấu ngoặc xoá cả hai nhánh. **Để đóng:** khi
  `callee.computed` bật và `callee.property` là một chuỗi tĩnh thì vẫn đọc chuỗi đó. Rẻ, và nên làm
  ngay, vì đây là cửa duy nhất trên kệ mà người ta đi qua **có chủ ý**.
- **Câu nhập không phải `ImportDeclaration`.** `require()`, `import()` động và `export … from` lọt ở cả
  luật vận chuyển lẫn luật nhà cung cấp. **Để đóng:** duyệt thêm `ImportExpression`,
  `ExportNamedDeclaration`/`ExportAllDeclaration` có `source`, và `CallExpression` tên `require`. Rẻ,
  ba nút, dùng lại đúng phép thử chuỗi đã có.
- **Nguồn nhập bị so bằng đúng một chuỗi.** `@nestjs/cqrs/dist/index` và mọi tệp trung chuyển cục bộ
  lọt. **Để đóng:** đổi phép so bằng thành phép so tiền tố — chính cách mà luật nhà cung cấp bên cạnh
  đã làm. Một dòng.
- **`e2e-asserts-persisted-state` đo một cái tên, không đo một phép đọc.** Câu nhập không dùng làm luật
  im vĩnh viễn; phép đọc qua bộ khung dùng chung bị báo oan. **Để đóng thật sự** thì phải biết một lời
  gọi có chạm tới kho dữ liệu hay không, mà lint không biết. Cái **đóng được** là hình dạng yếu nhất
  của nó: đòi định danh phải xuất hiện ở vị trí bên nhận của một lời gọi bên trong một bước, chứ không
  phải ở bất kỳ đâu trong tệp. Việc đó xoá được cửa "câu nhập không dùng" và cửa "chỉ dùng để dựng
  cảnh", nhưng **không** xoá được cửa báo oan cho bộ khung dùng chung — cửa ấy chỉ đóng được bằng cách
  cho kho tiêu thụ khai tên bộ khung của mình qua tuỳ chọn của luật. Hiện `schema` của cả năm luật đều
  rỗng, nên chưa có chỗ để khai.
- **Sáu tên lưu trữ là một danh sách gắn với một thư viện.** Hệ quả sống ở kho tài liệu, ở cache, ở
  kho đối tượng hay ở trạng thái của broker đều không có tên trong danh sách. **Để đóng:** đưa danh
  sách ra `schema` của luật. Cùng một sửa đổi với mục trên.
- **Danh sách sáu mẫu nhà cung cấp phải được nuôi.** Biến thể trên nền tảng đám mây, cổng tổng hợp,
  bản chạy tại chỗ, và **tên gói mới sau một lần đổi tên của chính nhà cung cấp** đều nằm ngoài; tên
  suýt trúng như `openai-edge` cũng lọt. **Không có cách đóng bằng cú pháp** — danh sách là danh sách.
  Ghi lại như một rủi ro thường trực và đưa nó ra `schema` để kho tiêu thụ tự bồi.
- **Gọi nhà cung cấp bằng HTTP, và để nguyên khách hàng thật.** Hai hình thái đắt nhất đều không nhập
  gì. **Để đóng phần HTTP:** báo khi một chuỗi trong tệp luồng chứa tên miền của một nhà cung cấp — lại
  là một danh sách, và lần này còn dễ né hơn. **Phần "để nguyên khách hàng thật" thì lint không đóng
  được**: bằng chứng của nó là một thứ **không** có trong tệp. Chỗ này thuộc về một cổng chạy được —
  một lần chạy e2e không có khoá nhà cung cấp trong môi trường, đỏ khi có ai đó thật sự gọi ra ngoài.
  Đó là biện pháp đúng, và nó không phải một luật lint.
- **Ngủ qua thành viên.** `timers.setTimeout(500)` và `world.sleep(500)` lọt, mà đó lại là cách viết
  hiện đại nhất của thói quen bị cấm. **Để đóng:** khi callee là `MemberExpression`, thử
  `callee.property.name` với đúng tập năm tên. Rẻ, và nó bịt cửa được người ta đi qua nhiều nhất. Chi
  phí là báo thừa cho một phương thức nghiệp vụ vô tình tên `wait` hoặc `pause`.
- **Đổi tên và mọi cách đốt thời gian khác.** `const nap = sleep`, `setImmediate`,
  `promisify(setTimeout)(500)`, vòng `while` trên `Date.now()`. **Để đóng phần đổi tên:** lần theo phần
  nhập — lại đúng việc ấy. **Phần vòng quay không thì không đóng được**: một vòng lặp bận không khác gì
  một vòng lặp thật về mặt cú pháp.
- **Hỏi vòng không hạn chót.** Nửa còn lại của `E2E-3`. **Để đóng:** khó và đáng ngờ — luật sẽ phải
  nhận ra "một vòng lặp chờ trạng thái" rồi đòi nó mang một tham số thời hạn, mà cả hai vế đều là phán
  đoán. Chi phí đóng cao hơn giá trị: chỗ này thuộc về một hàm `until` dùng chung **bắt buộc có tham số
  `timeout`** ở mức kiểu dữ liệu, chứ không thuộc về lint.
- **Nhánh rẽ nằm ngoài thân bước.** Trong một hàm trợ giúp, trong `beforeAll`, trong `beforeEach`,
  trong thân `describe`. **Để đóng phần móc nối:** thêm `beforeAll`, `beforeEach`, `afterEach`,
  `afterAll` vào cùng phép nhận diện với `it`/`test` — rẻ, và dựng cảnh có điều kiện đúng là chỗ hay
  hỏng. Nhưng phải nói rõ: bài kiểm thử sinh đôi **cố ý** khai một nhánh ngoài bước là hợp lệ, với lập
  luận rằng ngoài một bước thì điều kiện là dựng cảnh chứ không phải một khẳng định lấp lửng. Vậy nên
  đóng cửa này là một **thay đổi luật**, không phải một lần sửa lỗi, và phải qua đúng đường đó.
  **Phần hàm trợ giúp thì phải lần theo lời gọi**, tức là ra ngoài khả năng của một luật đọc từng tệp.
- **Rẽ nhánh không phải bốn loại nút.** `try`/`catch`, `.catch(() => …)`, `Promise.allSettled`, `??`
  khởi tạo. **Để đóng:** thêm `TryStatement` và `CatchClause` vào danh sách nút — rẻ và đúng tinh thần,
  vì một `catch` nuốt lỗi trong một bước đúng là "chuẩn bị sẵn cho cả hai đường". `??` ở vị trí khởi
  tạo thì nên cân nhắc riêng: nó cũng là một giá trị dự phòng, nhưng nó xuất hiện nhiều ở chỗ vô hại.
- **Toán tử logic trong biểu thức, và phép khẳng định quá lỏng.** `expect(a || b).toBe(true)`, khớp
  một tập con, khẳng định vào `length`. **Không đóng được bằng cú pháp** — đây là ranh giới thật giữa
  cái máy nhìn được và cái chỉ người đọc mới thấy, và nó là lý do văn bản luật để lại tám mã không có
  máy giữ.
- **`E2E-1`, `E2E-2`, `E2E-5`, `E2E-6`, `E2E-8`, `E2E-9`, `E2E-10` không có luật nào trên kệ giữ.**
  Bảy mã. Mô-đun luật ghi rõ lý do cho phần lớn trong số đó và lý do đứng vững: tên tệp so với một câu
  nghiệp vụ, đếm số bước, cái gì đang được khẳng định, ai đang hành động — đều là ý nghĩa. Hai trường
  hợp đáng xét lại: `E2E-8` là một dữ kiện về **cây thư mục** nên thuộc về một cổng nhìn được cả kho,
  không phải một luật đọc từng tệp; và `E2E-10` cố ý để cho hai luật bên lane quan sát giữ, nên nó
  **đang** được giữ — chỉ là không phải ở đây. Ghi ra để lần sau không ai đếm nhầm là tám.

## Re-audit Triggers

- Bảng `rules` xuất ra thêm, bớt hoặc **đổi tên** một luật.
- Một mã `E2E-<n>` được thêm, bỏ hoặc viết lại trong văn bản luật — đặc biệt là `E2E-4` và `E2E-8`,
  vốn đang kéo ngược nhau qua `e2e-asserts-persisted-state`.
- `schema` của bất kỳ luật nào thôi rỗng: khi đó danh sách tên lưu trữ, danh sách nhà cung cấp và tập
  tệp hạ tầng đều có chỗ để khai, và nhiều hàng trong bảng trên đóng lại được cùng lúc.
- Cổng tệp đổi, hoặc phạm vi được chuyển ra cấu hình của kho tiêu thụ.
- Một cửa mở ở trên được đóng lại: khi đó bảng **Open** trong `INDEX.md` phải mất đúng hàng đó, và
  bảng **Closed** phải mọc lên đúng hàng ấy.
- Một kho tiêu thụ hạ mức nghiêm của bất kỳ luật nào xuống dưới `error`, hoặc bắt đầu xuất hiện dòng
  tắt luật cho `e2e-uses-production-transport` — dấu hiệu sớm nhất của mâu thuẫn ở Findings mục 2.
