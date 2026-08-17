---
title: Testing · Vietnamese
---

# Kiểm thử

## LOADS

None.


## Bản ghi

Gate này nhận mã đã viết xong — một tệp spec, một khoảnh diff. Kết quả là một **phán quyết**: tệp rơi vào
làn nào, quy tắc đã công bố nào nổ, nó báo cái gì và trên nút nào, mã luật tương ứng là mã nào, và cửa
nào còn mở đủ sức che chính thất bại ấy. Mô-đun này không chọn giúp ai cách thiết kế một bài kiểm thử.
Nó từ chối một hình dạng, và nó phải chỉ được ra đúng cái tên hay cái nút mà nó từ chối.

## Luật

Luật là `patterns/testing.md`. Nó mang mười một mã, `TESTING-1` đến `TESTING-11`.

**Phần lớn luật đó máy không kiểm được, và chính đầu tệp quy tắc nói thẳng điều này.** Không quy tắc
nào biết một tệp có đại diện cho một luồng nghiệp vụ hay không, một đường thất bại có kéo theo một
luồng trọng yếu hay không, các nhánh quyết định đã phủ chưa, hay một bản giả có trả về đúng hình dạng
mà bộ phân tích cú pháp chờ đợi hay không. Những thứ đó do người đọc.

Luật nêu mười một mã. **Năm mã trong đó có quy tắc.** Mô-đun này chỉ ghi lại nửa còn lại ở chỗ một hình
dạng sai ngay trên mặt chữ bất kể ý định: quy tắc nhìn vào cái gì để thấy nó, và — phần không ai chịu
viết ra — nó không nhìn thấy cái gì. Sáu mã luật hoàn toàn không có quy tắc nào, và khoảng trống đó
được ghi ở đây chứ không được che đi.

## Luật máy đã xuất bản

Năm quy tắc được công bố. Mỗi quy tắc giữ đúng một mã luật; không quy tắc nào mồ côi.

| Quy tắc | Mã | Nó báo cái gì |
|---|---|---|
| `no-call-only-spec` | `TESTING-6` | Một unit spec mà mọi khẳng định đều là matcher về lời gọi, nên tệp chép lại mã nguồn của handler thay vì kiểm thử nó. Thông báo nêu tên các matcher đã thấy. |
| `e2e-asserts-persisted-state` | `TESTING-2` | Một e2e mà không có tên nào của lớp đọc trạng thái xuất hiện ở bất cứ đâu, nên luồng có thể ngừng ghi dữ liệu mà tệp vẫn xanh. |
| `no-model-call-in-e2e` | `TESTING-9` | Một e2e nhập khẩu gói SDK của nhà cung cấp mô hình, hoặc trợ giúp mô hình nội bộ. Thông báo nêu nguồn nhập khẩu. |
| `e2e-uses-production-transport` | `TESTING-3` | Hai thứ: nhập khẩu một bộ điều phối ứng dụng từ gói CQRS của khung, và bất kỳ lời gọi `.execute()` hay `.process()` nào không tính toán. |
| `harness-calls-provider-directly` | `TESTING-10` | Bốn thứ trong một harness chất lượng mô hình: không có dòng nhập khẩu SDK nhà cung cấp được chấp nhận nào, một ký hiệu hoặc một lần ghi đè nhà cung cấp giả trang cổng sản xuất, một trợ giúp nội bộ giấu lời gọi, và một chuỗi chứng thư người dùng cuối hoặc dòng lệnh. |

`TESTING-1`, `TESTING-4`, `TESTING-5`, `TESTING-7`, `TESTING-8` và `TESTING-11` **không có quy tắc
nào**. Chúng là không được canh, chứ không phải đã được phủ, và một lần chạy xanh không nói gì về bất
kỳ mã nào trong số đó. `TESTING-7` là trường hợp gắt nhất: làn tách bằng hậu tố tên tệp chính là điều
luật mà mọi cổng trên kệ này dựa vào để quyết định có chạy hay không, vậy mà không quy tắc nào báo về
nó.

Định danh của một quy tắc là cái tên nó công bố. Plugin phơi chúng dưới tiền tố `starci-be/`, đó là
chuỗi in ra trong log build và là chuỗi phải viết đúng trong một dòng vô hiệu hoá. Cả năm chạy ở mức
`error`. Hai quy tắc mang ghi chú đốt nợ trong nguồn: quy tắc call-only về 0 từ một phát hiện, và quy
tắc đọc trạng thái về 0 từ một phát hiện.

## Đọc một diff

1. **Quyết định làn trước mọi thứ khác, và ghi lại.** Làn chỉ đến từ `context.filename`. Ngoài phạm vi
   không có nghĩa là tệp đã qua — nó nghĩa là không có bộ duyệt nào được cài và quy tắc không tồn tại
   đối với tệp đó.
2. **Kiểm tra các ngoại lệ mà làn ban ra.** Trong một tệp trợ giúp harness chỉ có phép kiểm chứng thư
   chạy; mọi nhánh khác của `harness-calls-provider-directly` đều khoá theo làn harness. Làn
   integration không có quy tắc nào canh.
3. **Đọc đúng những nút mà mỗi quy tắc thật sự duyệt**, không đọc ý định của tệp: chuỗi lời gọi
   `expect`, mọi `Identifier`, chuỗi nguồn và các specifier của `ImportDeclaration`, các `Literal`
   chuỗi, thuộc tính `provide`, và — đúng một lần — dòng token thô.
4. **Xuất một khối cho mỗi phát hiện.** Hai quy tắc chỉ nói ở `Program:exit`, nên phán quyết của chúng
   là về cả tệp và chỉ một dòng thêm vào là đổi kết luận.
5. **Viết dòng `hatch` mỗi khi một cửa còn mở đủ sức che chính thất bại ấy.** Một quy tắc im lặng không
   chứng minh tệp đúng; nó chỉ chứng minh tệp không trình ra đúng cái hình dạng duy nhất quy tắc nhìn
   được.
6. **Không báo cái mà không quy tắc nào canh.** Sáu trong mười một mã không có máy; một phán quyết nói
   khác là nói sai về mô-đun này.

## `no-call-only-spec` — TESTING-6

**Nó báo cái gì.** Một unit spec mà đếm hết khẳng định thì tổng bằng đúng số khẳng định về lời gọi và
khác không, nghĩa là cả tệp không nói gì về giá trị trả ra hay trạng thái đã đổi. Thông báo nêu tên các
matcher đã thấy.

**Nó phát hiện bằng gì.** Chỉ làn unit: `context.filename` khớp `/\.spec\.ts$/` và **không** khớp
`/\.(?:e2e|int|harness)-spec\.ts$/`. Nó duyệt `CallExpression` có `callee.type === "Identifier"` và
`callee.name === "expect"`, leo ngược chuỗi `MemberExpression` chừng nào nút hiện tại còn là `object`
của cha, rồi lấy tên thuộc tính CUỐI CÙNG làm matcher — nhờ vậy `.not` và `.resolves` đi xuyên qua, và
`expect(x).not.toHaveBeenCalled()` trả về `toHaveBeenCalled`. Nó cộng một bộ đếm khẳng định tính theo
cả tệp, và cộng bộ đếm thứ hai khi matcher nằm trong tập chín tên. Tại `Program:exit` nó chỉ báo khi
hai bộ đếm bằng nhau và khác không.

**Điểm mù.** Một khẳng định ngoại phạm là đủ gỡ ngòi cả tệp: ba mươi ca call-only cộng một
`expect(result).toBeDefined()` ở bất kỳ đâu là im lặng, vì bộ đếm tính theo tệp và quy tắc không có
khái niệm một ca kiểm thử. Một tên matcher chưa từng được gọi vẫn được đếm — `expect(result).toEqual`
quên cặp ngoặc thì lúc chạy không khẳng định gì mà vẫn làm cả tệp im. Một khẳng định lời gọi viết theo
tên ngoài tập — `toHaveBeenCalledOnce`, `toHaveBeenCalledExactlyOnceWith`, `toHaveReturnedWith`,
`toHaveReturnedTimes` — rò hai lần: không bị tính là khẳng định lời gọi, và làm hai bộ đếm lệch nhau
nên tha luôn mọi khẳng định lời gọi thật trong tệp. Cùng một phép thử viết lại thành khẳng định giá
trị, `expect(charge.mock.calls[0][0]).toEqual({ amount: 5000 })`, chép lại mã nguồn y hệt như cũ nhưng
matcher là `toEqual`: quy tắc nhìn matcher, không nhìn chủ ngữ. Một khẳng định dời vào hàm trợ giúp,
hoặc `expect.soft(spy)`, bị bỏ qua vì callee phải là một `Identifier` trần tên đúng `expect` — và một
tệp đếm được không khẳng định nào là trường hợp quy tắc cố ý không báo. Cuối cùng `.test.ts`,
`.spec.tsx`, `.spec.mts` và cả làn integration đều rơi ra ngoài cổng.

**Ranh giới.** Quy tắc này xét từ vựng khẳng định bên trong một unit spec. Nó không nói gì về việc làn
luồng khẳng định cái gì, đó là `TESTING-2`.

## `e2e-asserts-persisted-state` — TESTING-2

**Nó báo cái gì.** Một e2e mà trong toàn tệp không xuất hiện tên nào thuộc nhóm đọc trạng thái, nghĩa
là bài kiểm thử chỉ khẳng định trên phản hồi và luồng có thể ngừng ghi dữ liệu mà vẫn xanh.

**Nó phát hiện bằng gì.** Chỉ làn luồng: `context.filename` khớp `/\.e2e-spec\.ts$/`. Nó duyệt mọi nút
`Identifier` và so `name` với một biểu thức chính quy neo hai đầu gồm sáu tên — bộ quản lý thực thể,
nguồn dữ liệu, cả hai dạng viết hoa kiểu tên lớp, hàm lấy repository và bộ chạy truy vấn. Thấy một cái
là bật cờ. Tại `Program:exit` nó báo khi cờ chưa từng bật.

**Điểm mù.** Dòng nhập khẩu là đủ thoả mãn: `import { DataSource } from "typeorm"` ở đầu một
luồng chỉ khẳng định mã trạng thái vẫn được coi là có đọc trạng thái, vì định danh trong nhập khẩu cũng
là `Identifier` — chú thích kiểu, mã thông báo tiêm phụ thuộc và dòng đóng kết nối trong dọn dẹp cũng
vậy. Đọc mà không khẳng định thì qua: `const rows = await entityManager.find(Order)` rồi không `expect`
gì lên `rows`, vì quy tắc bật một cờ khi thấy một cái tên và không bao giờ truy giá trị đó tới một
khẳng định. Tên thuộc tính trùng chữ cũng qua: `config.dataSource`, `options.queryRunner`, vì thuộc
tính không tính toán cũng là `Identifier` và vị trí không được xét. Và một lần đọc thật mà danh sách
không biết — repository đặt tên `repo`, bộ quản lý thực thể đặt tên `em`, một truy vấn thứ hai đi qua
chính transport, một bộ khách bộ nhớ đệm, bất kỳ kho nào sáu cái tên kia không mô tả — sẽ nổ thành BÁO
NHẦM, mà cách dập rẻ nhất là đổi tên biến chứ không phải thêm khẳng định. Cái được đo là từ vựng.

**Ranh giới.** Quy tắc này chỉ hỏi trong tệp có một cái tên đọc trạng thái hay không. Luồng có vào ứng
dụng qua transport sản xuất hay không là `TESTING-3`.

## `no-model-call-in-e2e` — TESTING-9

**Nó báo cái gì.** Một e2e nhập khẩu gói SDK của một nhà cung cấp mô hình, hoặc một trợ giúp mô hình
nội bộ vốn sinh ra để chạm tới nhà cung cấp. Thông báo nêu nguồn nhập khẩu.

**Nó phát hiện bằng gì.** Chỉ làn luồng. Nó duyệt `ImportDeclaration`, lấy chuỗi hằng `source.value` và
so với hai biểu thức chính quy: một danh sách tiền tố gói nhà cung cấp, và một mẫu hậu tố cho trợ giúp
mô hình nội bộ, cố ý không neo đầu để một đường dẫn tương đối `../helpers/models.service` vẫn được
thấy.

**Điểm mù.** Mọi thứ không phải nhập khẩu tĩnh: `await import("openai")`, `require("openai")`,
hoặc một lời gọi `fetch` thẳng tới điểm cuối HTTPS của nhà cung cấp — chỉ `ImportDeclaration` được
duyệt, một nhập khẩu động là nút khác và một lời gọi mạng thì không phải nhập khẩu. Nhà cung cấp không
có trong danh sách, kể cả bản SDK mới hơn của cùng một hãng có bản cũ đang nằm trong danh sách, cộng
thêm mọi cổng, mọi nhà tổng hợp và mọi máy suy luận chưa được liệt kê; quy tắc anh em trên cùng kệ này
chấp nhận một gói mà quy tắc này không cấm, nên hai danh sách chép tay ấy không khớp nhau ngay trong
một tệp. Chạm tới mô hình mà không nhập khẩu gì — luồng lấy cổng sản xuất ra từ vùng chứa ứng dụng và
không ai nhớ đặt bản giả — đúng là thất bại mà luật gọi tên, và không quy tắc nào canh nó: quy tắc chỉ
chứng minh một dòng nhập khẩu vắng mặt, không chứng minh không có lời gọi nào. Và trợ giúp đổi tên hay
dời một tầng, `helpers/model.service`, `helpers/llm-client`, `helpers/models/index`, thoát khỏi một mẫu
hậu tố đòi đường dẫn phải KẾT THÚC bằng đúng một chữ.

**Ranh giới.** Quy tắc này xét nguồn nhập khẩu trong làn luồng. Một harness chất lượng mô hình được
nhập khẩu cái gì là nghĩa vụ ngược lại và thuộc về `TESTING-10`.

## `e2e-uses-production-transport` — TESTING-3

**Nó báo cái gì.** Hai hình dạng độc lập: nhập khẩu một bộ điều phối ứng dụng — bus lệnh, bus truy vấn,
bus sự kiện — từ gói CQRS của khung, và bất kỳ lời gọi `.execute()` hay `.process()` nào có thuộc tính
không tính toán.

**Nó phát hiện bằng gì.** Chỉ làn luồng, với hai bộ duyệt độc lập. `ImportDeclaration` đòi
`source.value` phải bằng đúng một chuỗi gói, rồi so tên `imported` của mỗi `ImportSpecifier` với một
tập ba tên — tên phía gói, không phải bí danh cục bộ. `CallExpression` đòi callee là một
`MemberExpression` không tính toán rồi so tên thuộc tính với một tập hai tên, hoàn toàn không kiểm tra
đối tượng là gì.

**Điểm mù.** Một lời gọi qua thuộc tính tính toán, `bus["execute"](command)` hay
`bus[method](command)`, vì phép kiểm callee thoát ngay khi `computed` là đúng. Mọi lối vào ứng dụng
khác: `eventBus.publish(event)`, `handler.handle(command)`, `resolver.findThing(args)`,
`service.enroll(...)`, `worker.run()` — đẩy thẳng một sự kiện lên bus là vào đúng chỗ luật cấm mà không
bị báo, vì tập chỉ có hai tên phương thức. Bộ điều phối nhập khẩu từ nơi khác: một tệp barrel của dự án
tái xuất khẩu nó, một đường dẫn sâu vào thư mục biên dịch của gói, hoặc
`import * as cqrs from "@nestjs/cqrs"` rồi dùng `cqrs.CommandBus`, vì phép kiểm nhập khẩu là so BẰNG
chuỗi trên đúng một tên gói và một namespace specifier không phải `ImportSpecifier`. Và báo nhầm trên
đúng hai chữ đó — `connection.execute(sql)` của một trình điều khiển cơ sở dữ liệu dùng để đọc trạng
thái về, `queue.process(handler)` đăng ký trong phần dựng, `execute` của một bộ khách kiểm thử — vì đối
tượng không bao giờ được nhìn tới, chỉ tên thuộc tính. Đây là quy tắc có hành vi thật lệch xa cái tên
nhất trên kệ này: tên nói về transport, nửa sau chỉ là một phép so tên phương thức không nhìn kiểu.

**Ranh giới.** Quy tắc này canh lối vào ứng dụng. Luồng sau đó có khẳng định trên trạng thái đã lưu hay
không là `TESTING-2`.

## `harness-calls-provider-directly` — TESTING-10

**Nó báo cái gì.** Bốn hình dạng trong một harness chất lượng mô hình: không nhập khẩu SDK nhà cung cấp
được chấp nhận nào; một ký hiệu hoặc một lần ghi đè nhà cung cấp giả trang cổng sản xuất — nhập khẩu
chính lớp cổng, khai báo `provide` bằng lớp đó, ghi đè nhà cung cấp bằng lớp đó, hoặc dựng một kiểu
`Pick<...>` từ lớp đó; một trợ giúp nội bộ có tên bị cấm giấu lời gọi; và một chứng thư người dùng cuối
hoặc dòng lệnh dùng thay cho khoá API máy chủ.

**Nó phát hiện bằng gì.** Phạm vi rộng hơn các quy tắc khác: làn harness, `context.filename` khớp
`/\.harness-spec\.ts$/`, **hoặc** một tệp trợ giúp có đường dẫn chứa `/src/tests/helpers/` — nhưng
trong tệp trợ giúp chỉ phép kiểm chứng thư chạy, vì ba nhánh còn lại đều khoá theo làn harness. Bốn bộ
duyệt cộng một lần quét token. `ImportDeclaration` bật cờ khi tiền tố gói thuộc danh sách được chấp
nhận, báo khi đường dẫn khớp mẫu hậu tố trợ giúp sau khi bỏ đuôi `.ts`/`.js`, và báo khi một tên
specifier nhập khẩu hoặc cục bộ nằm trong tập ba tên. `Literal` báo khi một giá trị chuỗi khớp danh
sách chứng thư người dùng cuối, không phân biệt hoa thường. `Property` báo khi khoá tên `provide` có
giá trị là `Identifier` đúng tên lớp cổng. `CallExpression` báo khi thuộc tính tên `overrideProvider`
nhận lớp đó làm đối số đầu. Tại `Program:exit` nó đi hết dòng token thô lấy từ
`sourceCode.getTokens(sourceCode.ast)` để tìm chuỗi ba token `Pick` `<` `AiInvokeService`, rồi báo nếu
cờ nhà cung cấp chưa từng bật.

**Điểm mù.** Một dòng nhập khẩu không dùng cũng thoả mãn yêu cầu nhà cung cấp:
`import "openai"` ở đầu tệp, rồi cả harness chạy qua một bộ khách nội bộ đặt tên khác — cờ bật vì có
dòng nhập khẩu, còn SDK có được gọi hay không thì không ai kiểm. Chứng thư đọc theo cách thông thường
thì vô hình: `process.env.CLAUDE_CODE_OAUTH_TOKEN` là một thuộc tính thành viên, chỉ dạng ngoặc vuông
`process.env["CLAUDE_CODE_OAUTH_TOKEN"]` mới là chuỗi hằng, và chuỗi mẫu cũng vô hình vì mảnh chuỗi
trong đó là `TemplateElement`. Cổng khoác kiểu hoặc mã thông báo khác thì qua: `Partial<AiInvokeService>`,
`Omit<AiInvokeService, "x">`, một `interface FakeInvoke { run(...) }` tự viết, `provide: AI_INVOKE_TOKEN`,
`overrideProvider(AI_INVOKE_TOKEN)`, hoặc nhập khẩu mặc định module cổng dưới một tên cục bộ — lần quét
token chỉ tìm đúng một chuỗi ba token, còn các phép kiểm kia đều so với đúng một tên lớp. Trợ giúp đổi
tên là ra khỏi lệnh cấm: trợ giúp mô hình nội bộ dời sang `./judge-client` thì mã y hệt vẫn hợp lệ, vì
mẫu chỉ liệt kê hai tên. Và trợ giúp nằm ngoài đúng một thư mục thì ngoài tầm hoàn toàn: chỉ
`/src/tests/helpers/` nằm trong phạm vi chứng thư, nên `test/helpers/`, `test/helpers/` và bất kỳ
`helpers/` lồng nào dưới một gốc khác đều không chạy phép kiểm nào, kể cả phép kiểm chứng thư.

**Ranh giới.** Quy tắc này đòi một lời gọi nhà cung cấp thật trong làn harness. Làn luồng đòi điều
ngược lại, và đó là `TESTING-9`.

## Cách phát hiện

| Bộ phận | Cơ chế |
|---|---|
| chuẩn hoá dấu phân cách | Chọn làn là một biểu thức chính quy trên tên tệp với gạch chéo ngược đổi thành gạch chéo xuôi, nên đường dẫn Windows so như mọi đường dẫn khác |
| cổng làn: unit | `context.filename` khớp `/\.spec\.ts$/` và **không** khớp `/\.(?:e2e\|int\|harness)-spec\.ts$/` |
| cổng làn: luồng | `context.filename` khớp `/\.e2e-spec\.ts$/` |
| cổng làn: harness | `context.filename` khớp `/\.harness-spec\.ts$/` |
| cổng làn: trợ giúp harness | `context.filename` chứa `/src/tests/helpers/` |
| phép leo matcher | Leo ngược chuỗi `MemberExpression` chừng nào nút còn là `object` của cha; tên thuộc tính CUỐI CÙNG là matcher, nên các bổ nghĩa đi xuyên qua |
| phép so tên | Không quy tắc nào biết kiểu. Không quy tắc nào hỏi một đối tượng là gì, chỉ hỏi một cái tên được viết ra sao |
| lần quét token | `sourceCode.getTokens(sourceCode.ast)`, dùng đúng một lần, để tìm một đối số kiểu tổng quát mà không cần thông tin kiểu |
| báo ở cuối tệp | Hai quy tắc đọc cả tệp rồi báo một lần ở `Program:exit`, nên một dòng ở bất kỳ đâu cũng đổi kết luận cho mọi dòng khác |

## Lối thoát hợp lệ

**Đã đóng** — người đọc tưởng những cách viết này lọt được, nhưng không.

| Quy tắc | Cách viết | Vì sao vẫn nổ |
|---|---|---|
| `no-call-only-spec` | `expect(spy).not.toHaveBeenCalled()` — một khẳng định lời gọi bị phủ định trông như matcher khác | Phép leo lấy thuộc tính CUỐI CÙNG trong chuỗi, nên `.not` đi xuyên qua và câu trả lời vẫn là matcher về lời gọi |
| `no-call-only-spec` | `await expect(promise).resolves.toBe(1)` — một chuỗi bổ nghĩa trông như không phân tích được | Cùng phép leo; câu trả lời là matcher thật, và tệp được tha đúng người |
| `no-call-only-spec` | Dời tệp vào thư mục con, hoặc đặt cạnh mã nó kiểm thử | Cổng làn đọc hậu tố tên tệp, không bao giờ đọc thư mục |
| `e2e-asserts-persisted-state` | Đọc trạng thái qua bộ chạy truy vấn thay vì bộ quản lý thực thể | Cả hai tên đều nằm trong biểu thức chính quy, cùng với nguồn dữ liệu và hàm lấy repository |
| `no-model-call-in-e2e` | `import { models } from "../helpers/models.service"` — đường dẫn tương đối mà một mẫu neo tuyệt đối sẽ bỏ sót | Mẫu trợ giúp cố ý không neo đầu và khớp theo hậu tố, đúng dạng mà một tệp e2e nằm cạnh thư mục trợ giúp thật sự viết |
| `no-model-call-in-e2e` | `import OpenAI from "openai/index"` — một nhập khẩu sâu | Mẫu nhà cung cấp chấp nhận cả tên gói trần lẫn tên gói theo sau bởi một gạch chéo |
| `e2e-uses-production-transport` | `const bus = app.get(CommandBus)`, không dựng trực tiếp | Phép kiểm lời gọi dựa trên tên phương thức, nên `bus.execute(...)` bị báo bất kể đối tượng là gì hay đến từ đâu |
| `e2e-uses-production-transport` | `import { CommandBus as Bus } from "@nestjs/cqrs"` — đổi tên khi nhập khẩu | Phép kiểm specifier đọc `imported`, tên phía gói, không đọc bí danh cục bộ |
| `harness-calls-provider-directly` | `import { AiInvokeService as Gateway }` — đổi tên cổng khi nhập khẩu | Phép kiểm lấy `imported` trước, nên cái được so là tên phía gói |
| `harness-calls-provider-directly` | `Pick<AiInvokeService, "run">` làm kiểu thay thế viết tay, thứ mà không bộ duyệt AST thông thường nào của bộ phân tích cú pháp này chạm tới | Một lần quét token thô ở `Program:exit` tìm đúng chuỗi ba token, nên kiểu đó bị bắt mà không cần thông tin kiểu |
| `harness-calls-provider-directly` | Khai báo cổng trong một module kiểm thử: `{ provide: AiInvokeService, useValue: fake }` | Bộ duyệt `Property` báo thẳng trên cặp khoá/giá trị |

**Còn mở** — mù đã xuất xưởng. Một phán quyết không được nói rằng những điều này đã được xét.

| Quy tắc | Cái lọt qua | Cái giá phải trả |
|---|---|---|
| cả năm | **Đổi tên tệp.** Làn là một hậu tố tên tệp, nên đổi tên là cách rẻ nhất để một quy tắc thôi tồn tại với tệp đó | Mọi phép kiểm trên kệ này, một cách lặng lẽ |
| `no-call-only-spec` | **Một khẳng định ngoại phạm gỡ ngòi cả tệp.** Ba mươi ca call-only cộng một `expect(result).toBeDefined()` ở bất kỳ đâu là im lặng | Bộ đếm tính theo tệp; quy tắc không có khái niệm một ca kiểm thử |
| `no-call-only-spec` | **Một tên matcher chưa từng được gọi vẫn được đếm.** `expect(result).toEqual` — quên cặp ngoặc — lúc chạy không khẳng định gì mà làm cả tệp im | Chuỗi có kết thúc bằng một lời gọi hay không thì không ai kiểm |
| `no-call-only-spec` | **Một khẳng định lời gọi ngoài tập.** `toHaveBeenCalledOnce`, `toHaveBeenCalledExactlyOnceWith`, `toHaveReturnedWith`, `toHaveReturnedTimes` | Rò hai lần: không bị tính là khẳng định lời gọi, và làm hai bộ đếm lệch nhau nên tha luôn mọi khẳng định lời gọi thật trong tệp |
| `no-call-only-spec` | **Cùng phép thử viết lại thành khẳng định giá trị.** `expect(charge.mock.calls[0][0]).toEqual({ amount: 5000 })` | Quy tắc nhìn matcher, không nhìn chủ ngữ |
| `no-call-only-spec` | **Khẳng định dời vào hàm trợ giúp, hoặc `expect` bị đặt bí danh.** `assertCharged(spy)`, `expect.soft(spy).toHaveBeenCalled()` | Callee là thành viên thì bị bỏ qua, và một tệp không có khẳng định nào được nhận diện thì cố ý không bị báo |
| `no-call-only-spec` | **`.test.ts`, `.spec.tsx`, `.spec.mts`, và cả làn integration** | Cổng đòi đúng phần đuôi `.spec.ts` và loại thẳng ba hậu tố |
| `e2e-asserts-persisted-state` | **Dòng nhập khẩu là đủ thoả mãn.** `import { DataSource } from "typeorm"` trên một luồng chỉ khẳng định mã trạng thái | Định danh trong nhập khẩu, chú thích kiểu, mã thông báo tiêm phụ thuộc và dòng dọn dẹp đều là `Identifier` |
| `e2e-asserts-persisted-state` | **Đọc mà không khẳng định.** `const rows = await entityManager.find(Order)` rồi không `expect` gì lên `rows` | Quy tắc bật một cờ khi thấy một cái tên; nó không truy giá trị tới một khẳng định |
| `e2e-asserts-persisted-state` | **Tên thuộc tính trùng chữ.** `config.dataSource`, `options.queryRunner` | Thuộc tính không tính toán cũng là `Identifier`, và vị trí không được xét |
| `e2e-asserts-persisted-state` | **Một lần đọc thật mà danh sách không biết.** Repository tên `repo`, bộ quản lý tên `em`, một truy vấn thứ hai qua transport, một bộ khách bộ nhớ đệm | Một BÁO NHẦM mà cách dập rẻ nhất là đổi tên biến chứ không phải thêm khẳng định |
| `no-model-call-in-e2e` | **Mọi thứ không phải nhập khẩu tĩnh.** `await import("openai")`, `require("openai")`, một `fetch` thẳng tới điểm cuối nhà cung cấp | Chỉ `ImportDeclaration` được duyệt |
| `no-model-call-in-e2e` | **Nhà cung cấp không có trong danh sách**, kể cả bản SDK mới hơn của hãng đang có bản cũ trong danh sách | Hai danh sách đều là tiền tố chép tay, và quy tắc harness chấp nhận một gói mà quy tắc này không cấm |
| `no-model-call-in-e2e` | **Chạm tới mô hình mà không nhập khẩu gì.** Luồng lấy cổng sản xuất ra từ vùng chứa và không ai nhớ đặt bản giả | Đúng thất bại mà luật gọi tên, và không quy tắc nào canh nó |
| `no-model-call-in-e2e` | **Trợ giúp đổi tên hoặc dời một tầng.** `helpers/model.service`, `helpers/llm-client`, `helpers/models/index` | Mẫu hậu tố đòi đường dẫn phải KẾT THÚC bằng đúng một chữ |
| `e2e-uses-production-transport` | **Gọi qua thuộc tính tính toán.** `bus["execute"](command)`, `bus[method](command)` | Phép kiểm callee thoát ngay khi `computed` là đúng |
| `e2e-uses-production-transport` | **Mọi lối vào ứng dụng khác.** `eventBus.publish(event)`, `handler.handle(command)`, `resolver.findThing(args)`, `service.enroll(...)`, `worker.run()` | Tập chỉ có hai tên phương thức |
| `e2e-uses-production-transport` | **Bộ điều phối nhập khẩu từ nơi khác.** Một tệp barrel của dự án, một đường dẫn sâu vào thư mục biên dịch, `import * as cqrs from "@nestjs/cqrs"` | So BẰNG chuỗi trên đúng một tên gói, và namespace specifier không phải `ImportSpecifier` |
| `e2e-uses-production-transport` | **Báo nhầm trên đúng hai chữ đó.** `connection.execute(sql)`, `queue.process(handler)`, `execute` của một bộ khách kiểm thử | Đối tượng không bao giờ được nhìn tới, nên dập nó đôi khi chỉ là đổi tên một lời gọi hợp lệ |
| `harness-calls-provider-directly` | **Một dòng nhập khẩu không dùng cũng thoả mãn yêu cầu nhà cung cấp.** `import "openai"`, rồi một bộ khách nội bộ đặt tên khác làm hết việc | Cờ bật vì có dòng nhập khẩu; SDK có được gọi hay không thì không ai kiểm |
| `harness-calls-provider-directly` | **Chứng thư đọc theo cách thông thường.** `process.env.CLAUDE_CODE_OAUTH_TOKEN`, hoặc một chuỗi mẫu | Chỉ `Literal` chuỗi được duyệt; thuộc tính thành viên là định danh và mảnh chuỗi mẫu là `TemplateElement` |
| `harness-calls-provider-directly` | **Cổng khoác kiểu hoặc mã thông báo khác.** `Partial<AiInvokeService>`, `Omit<AiInvokeService, "x">`, một interface tự viết, `provide: AI_INVOKE_TOKEN`, `overrideProvider(AI_INVOKE_TOKEN)`, một nhập khẩu mặc định đổi tên | Đúng một chuỗi ba token, đúng một tên lớp |
| `harness-calls-provider-directly` | **Trợ giúp đổi tên ra khỏi lệnh cấm.** Trợ giúp mô hình nội bộ dời sang `./judge-client` | Mẫu chỉ liệt kê hai tên |
| `harness-calls-provider-directly` | **Trợ giúp nằm ngoài đúng một thư mục.** `test/helpers/`, `test/helpers/`, bất kỳ `helpers/` lồng nào dưới gốc khác | Cổng trợ giúp là một mảnh đường dẫn viết cứng, và ngoài tầm nghĩa là mọi phép kiểm, kể cả phép kiểm chứng thư |
| không quy tắc nào | **Mọi điều `TESTING-1`, `TESTING-4`, `TESTING-5`, `TESTING-7`, `TESTING-8` và `TESTING-11` đòi hỏi** | Sáu trong mười một mã không có máy; một lần chạy xanh là im lặng về tất cả chúng |

## Đầu vào

| Đầu vào | Bằng chứng cần có |
|---|---|
| tên tệp | `context.filename`, lùi về `context.getFilename()`, chuẩn hoá thành gạch chéo xuôi. Nó quyết định làn và do đó quyết định có bộ duyệt nào chạy hay không |
| quyết định làn | Cổng làn nào đã khớp, hoặc không cổng nào khớp |
| nút AST | `CallExpression`, `Identifier`, `ImportDeclaration`, `ImportSpecifier`, `Literal`, `Property`, và các chuỗi `MemberExpression` |
| bằng chứng nhập khẩu | Chuỗi hằng `source.value`, và tên `imported` của từng specifier |
| dòng token | `sourceCode.getTokens(sourceCode.ast)`, dùng đúng một lần, để tìm một đối số kiểu tổng quát mà không cần thông tin kiểu |
| trạng thái cuối tệp | Các bộ đếm và cờ tích luỹ qua cả tệp, báo tại `Program:exit` |

Không gì khác. Không bộ kiểm kiểu, không phân giải liên tệp, không cấu hình bộ chạy kiểm thử, không
báo cáo độ phủ, không quan sát lúc chạy.

## Quy tắc

1. Định danh của một quy tắc là cái tên nó công bố. Không có mã số thứ hai, vì một quy tắc có hai tên
   thì không ai truy được từ log build ngược về tệp đã sinh ra nó.
2. Làn quyết định bằng hậu tố tên tệp và không bằng gì khác, đó chính là `TESTING-7` của luật. Một quy
   tắc chạy sai làn là lỗi ở cổng, không phải lỗi của tệp.
3. Quy tắc báo một HÌNH DẠNG, không bao giờ báo một ý định. Mọi thông báo đều nêu hình dạng và cách sửa.
4. Một khẳng định về lời gọi là hợp lệ khi đứng làm khẳng định thứ hai. Quy tắc call-only chỉ nổ khi cả
   tệp không có gì khác, và chỗ chừa đó là chủ ý chứ không phải sơ suất.
5. Không quy tắc nào biết kiểu, nên mọi phép kiểm đều là so với một cái tên đã viết ra.
6. Hai quy tắc đọc cả tệp rồi mới nói một lần ở cuối. Thêm một dòng ở bất kỳ đâu là đổi kết luận cho
   toàn tệp.
7. Một quy tắc không chỉ ra được thì là một đề xuất. Sáu mã luật không có quy tắc nào; chúng không được
   canh và được ghi lại đúng như vậy.

## Ngoại lệ

Ngoại lệ là một phần của việc thực thi, không phải sự nới tay.

- **Khẳng định thứ hai.** Một khẳng định về lời gọi đứng cạnh một khẳng định về kết quả là hình dạng
  được mong đợi, khi chính lời gọi mới là hệ quả quan sát được — một thư đã gửi, một sự kiện đã phát.
  Đây là lý do `no-call-only-spec` đếm cả tệp thay vì đếm từng ca, và nó chỉ tha đúng cặp ấy chứ không
  tha gì thêm.
- **Luồng thật sự không có hệ quả lưu trữ.** `e2e-asserts-persisted-state` chờ một dòng vô hiệu hoá kèm
  tên thứ mà luồng quan sát thay thế. Nó tha đúng một tệp đã nêu được thứ thay thế đó; một dòng vô hiệu
  hoá không nêu lý do là xoá luật, xoá dần từng tệp một.
- **Phạm vi chứng thư rộng hơn phạm vi harness.** Trong một tệp trợ giúp harness dưới
  `/src/tests/helpers/`, chỉ phép kiểm chứng thư chạy. Mọi phép kiểm khác của
  `harness-calls-provider-directly` đều khoá theo làn harness, nên tệp trợ giúp muốn nhập khẩu và xuất
  khẩu gì cũng được.
- **Làn integration không có ai canh, và đó là chủ ý.** Luật tách bốn làn: ba quy tắc canh làn luồng,
  một canh làn unit, một canh làn harness. Không quy tắc nào canh integration, tức là cả làn đó được
  tha khỏi mọi phép kiểm trên kệ này.

## Đầu ra

Một phán quyết về một tệp. Một khối cho mỗi phát hiện:

```text
file: <path>
lane: <unit | flow | harness | harness helper | out of scope>
rule: <published rule name>
message: <messageId>
law: TESTING-<n>
verdict: <fires | silent>
reason: <the node or name that decided it>
hatch: <none | the open row that explains a silence>
```

Một tệp sạch xuất một khối cho mỗi quy tắc đã chạy trong làn của nó, mỗi khối mang `verdict: silent` và
một dòng `hatch` nêu cửa còn mở đủ sức tạo ra chính sự im lặng ấy, hoặc `none`. Một tệp ngoài phạm vi
xuất một khối với `lane: out of scope` và không có tên quy tắc: không bộ duyệt nào được cài, nên tệp là
chưa được xét chứ không phải đã được xét là sạch.

## Ví dụ đã giải

**Đầu vào.** Một unit spec, `orders/charge.handler.spec.ts`:

```ts
it("charges the order", async () => {
  await handler.execute(command)
  expect(gateway.charge).toHaveBeenCalledWith({ amount: 5000 })
  expect(repository.save).toHaveBeenCalledTimes(1)
})
```

```text
file: src/orders/charge.handler.spec.ts
lane: unit
rule: no-call-only-spec
message: callOnly
law: TESTING-6
verdict: fires
reason: Program:exit — 2 assertions, 2 call matchers (toHaveBeenCalledWith, toHaveBeenCalledTimes)
hatch: none
```

Bốn quy tắc còn lại không cài bộ duyệt nào ở đây: các quy tắc làn luồng đòi `.e2e-spec.ts`, còn quy tắc
harness đòi `.harness-spec.ts` hoặc `/src/tests/helpers/`.

```text
file: src/orders/charge.handler.spec.ts
lane: unit
rule: e2e-asserts-persisted-state | no-model-call-in-e2e | e2e-uses-production-transport | harness-calls-provider-directly
message: none
law: TESTING-2 | TESTING-9 | TESTING-3 | TESTING-10
verdict: silent
reason: lane gate did not match — out of scope for these rules
hatch: none
```

**Đã sửa.** Tệp giờ khẳng định cả kết quả lẫn lời gọi:

```ts
it("charges the order", async () => {
  const receipt = await handler.execute(command)
  expect(receipt.amount).toEqual(5000)
  expect(gateway.charge).toHaveBeenCalledWith({ amount: 5000 })
})
```

Hai bộ đếm giờ lệch nhau và quy tắc im lặng — im lặng đúng người, theo ngoại lệ khẳng định thứ hai.
Nhưng chính sự im lặng ấy có thể lấy được mà không cần sửa gì:

```ts
it("charges the order", async () => {
  await handler.execute(command)
  expect(gateway.charge).toHaveBeenCalledWith({ amount: 5000 })
  expect(receipt).toBeDefined()
})
```

```text
file: src/orders/charge.handler.spec.ts
lane: unit
rule: no-call-only-spec
message: none
law: TESTING-6
verdict: silent
reason: report none — the counters differed at Program:exit
hatch: one alibi assertion disarms the whole file — the counters are file-wide and must be exactly
  equal, so a single non-call matcher anywhere spares every call-only case in the file
```

Sự im lặng thứ hai không phải là tuân thủ. Không có gì được chứng minh về giá trị trả ra; tệp chỉ thôi
trình ra đúng cái hình dạng duy nhất mà quy tắc nhìn được.

## Phạm vi

Mô-đun này ghi lại việc thực thi cho một luật, không ghi lại chính luật đó. Nó không xét một tệp có đại
diện cho một luồng nghiệp vụ hay không, một đường thất bại có kéo theo một luồng trọng yếu hay không,
các nhánh quyết định đã phủ chưa, hay một bản giả có trả về đúng hình dạng mà bộ phân tích cú pháp chờ
đợi hay không — những thứ đó thuộc về `patterns/testing.md` và do người đọc. Nó gọi tên các quy tắc
bằng đúng định danh đã công bố, vì những định danh ấy xuất hiện trong đầu ra build và trong các dòng vô
hiệu hoá nên phải viết đúng từng chữ. Văn xuôi và ví dụ ở đây không nêu tên sản phẩm, công ty hay kho
mã nào: mọi ví dụ đều là một tệp spec bình thường với những dòng nhập khẩu bình thường.
