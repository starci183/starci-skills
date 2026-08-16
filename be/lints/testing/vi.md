---
id: be-lints-testing-vi
title: vi.md
slug: /be/lints/testing/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng quy tắc lint của luật kiểm thử — bắt gì, giữ mã luật nào, và cửa nào còn mở.
---

# vi.md

> Version: `2.00` · Mô-đun: `testing`

# Kiểm thử — phần luật có máy giữ

Luật kiểm thử có mười một mã. **Phần lớn luật đó máy không kiểm được**, và chính đầu tệp quy tắc nói
thẳng điều này: không quy tắc nào biết một tệp có đại diện cho một luồng nghiệp vụ hay không, một
đường thất bại có kéo theo một luồng trọng yếu hay không, các nhánh quyết định đã phủ chưa, hay một
bản giả có trả về đúng hình dạng mà bộ phân tích cú pháp chờ đợi hay không. Những thứ đó do **người**
đọc.

Năm quy tắc dưới đây chỉ giữ những hình dạng **sai ngay trên mặt chữ**, bất kể ý định. Tài liệu này
nói rõ mỗi quy tắc **nhìn vào cái gì** — và quan trọng hơn, **không nhìn thấy cái gì**.

Một quy tắc im lặng **không** chứng minh tệp đúng. Nó chỉ chứng minh tệp không trình ra đúng cái hình
dạng duy nhất mà quy tắc nhìn được.

## Bảng tra nhanh

| Quy tắc | Mã luật | Bắt gì |
|---|---|---|
| `no-call-only-spec` | `TESTING-6` | Một unit spec mà **mọi** khẳng định đều nói về một lời gọi, không nói về kết quả |
| `e2e-asserts-persisted-state` | `TESTING-2` | Một e2e mà **không có** tên nào của lớp đọc trạng thái xuất hiện trong tệp |
| `no-model-call-in-e2e` | `TESTING-9` | Một e2e **nhập khẩu** gói SDK của nhà cung cấp mô hình, hoặc trợ giúp mô hình nội bộ |
| `e2e-uses-production-transport` | `TESTING-3` | Một e2e nhập khẩu bộ điều phối ứng dụng, hoặc gọi `.execute()` / `.process()` |
| `harness-calls-provider-directly` | `TESTING-10` | Một harness chất lượng mô hình không gọi thẳng SDK, hoặc giả trang cổng sản xuất, hoặc dùng chứng thư người dùng cuối |

Cả năm đều chạy ở mức `error`. Hai quy tắc mang ghi chú đốt nợ trong nguồn: quy tắc call-only về 0 từ
1 phát hiện, quy tắc đọc trạng thái về 0 từ 1 phát hiện.

**Định danh của một quy tắc là cái TÊN nó công bố.** Không có mã số thứ hai. Tên đó là chuỗi in ra
trong log build và là chuỗi phải viết đúng trong một dòng vô hiệu hoá; đặt thêm một mã số nữa nghĩa
là một quy tắc có hai tên và không ai truy được thông báo đến từ đâu.

## Cách chọn làn — chung cho cả năm quy tắc

Trước mọi thứ khác, mỗi quy tắc hỏi tệp này thuộc làn nào, **chỉ bằng tên tệp**. Đường dẫn được đổi
gạch chéo ngược thành gạch chéo xuôi trước khi so, để đường dẫn trên mọi hệ điều hành so như nhau.

| Làn | Điều kiện tên tệp |
|---|---|
| unit | kết thúc `.spec.ts` **và không** kết thúc `.e2e-spec.ts`, `.int-spec.ts`, `.harness-spec.ts` |
| luồng | kết thúc `.e2e-spec.ts` |
| harness | kết thúc `.harness-spec.ts` |
| trợ giúp harness | đường dẫn chứa `/src/tests/helpers/` |

Đây đúng là `TESTING-7` — làn tách bằng hậu tố, không tách bằng thư mục. Hệ quả: **đổi tên tệp là
cách rẻ nhất để một quy tắc thôi tồn tại.** Cửa này mở với cả năm quy tắc và không nhắc lại ở từng
mục dưới.

---

## `no-call-only-spec`

**Bắt gì.** Một unit spec mà đếm hết các khẳng định thì con số bằng đúng số khẳng định về **lời gọi**.
Nghĩa là cả tệp không nói gì về kết quả trả ra hay trạng thái đã đổi — nó chép lại mã nguồn của
handler.

**Giữ mã nào.** `TESTING-6`.

**Cách phát hiện.**

- Chỉ chạy trong làn unit.
- Duyệt `CallExpression` có `callee` là `Identifier` tên đúng `expect`.
- Leo ngược chuỗi `MemberExpression` chừng nào nút hiện tại còn là `object` của cha, rồi lấy **tên
  thuộc tính cuối cùng** làm matcher. Nhờ vậy `.not` và `.resolves` đi xuyên qua:
  `expect(x).not.toHaveBeenCalled()` trả về `toHaveBeenCalled`, `expect(p).resolves.toBe(1)` trả về
  `toBe`.
- Cộng một bộ đếm tổng, và cộng bộ đếm thứ hai khi matcher nằm trong tập chín tên.
- Tại `Program:exit`: nếu tổng bằng 0 thì thôi; nếu hai bộ đếm khác nhau thì thôi; bằng nhau và khác
  0 thì báo, kèm danh sách matcher đã thấy.

**Vì sao luật này đáng có máy giữ.** Một khẳng định về lời gọi đảo ngược quan hệ nhân quả của bộ
kiểm thử: đổi tên phương thức của cộng tác viên thì tệp đỏ, còn đổi con số nghiệp vụ thành sai thì
tệp vẫn xanh. Đó là lý do một bộ kiểm thử có thể rất to mà chứng minh rất ít. Con người đọc lướt
không phát hiện được vì mỗi dòng riêng lẻ **trông** đúng; chỉ có phép đếm cả tệp mới lộ ra.

**Cửa còn mở.**

- **Một khẳng định ngoại phạm là đủ gỡ ngòi cả tệp.** Ba mươi ca call-only cộng một
  `expect(result).toBeDefined()` ở bất kỳ đâu ⇒ im lặng. Bộ đếm tính theo **tệp**, quy tắc không có
  khái niệm "một ca kiểm thử".
- **Tên matcher không cần được gọi.** `expect(result).toEqual` — quên cặp ngoặc — không khẳng định
  gì lúc chạy nhưng vẫn được đếm là khẳng định thật và gỡ ngòi cả tệp.
- **Matcher viết theo tên ngoài tập chín.** `toHaveBeenCalledOnce`, `toHaveBeenCalledExactlyOnceWith`,
  `toHaveReturnedWith`, `toHaveReturnedTimes`. Rò hai lần: không bị tính là khẳng định lời gọi, **và**
  làm hai bộ đếm lệch nhau nên tha luôn mọi khẳng định lời gọi thật trong tệp.
- **Cùng một phép thử viết lại thành khẳng định giá trị.**
  `expect(charge.mock.calls[0][0]).toEqual({ amount: 5000 })` chép lại mã nguồn y hệt, nhưng matcher
  là `toEqual`. Quy tắc nhìn **matcher**, không nhìn **chủ ngữ**.
- **Khẳng định dời vào hàm trợ giúp, hoặc `expect` bị đặt bí danh.** `expect.soft(spy)` có callee là
  `MemberExpression` nên bị bỏ qua hoàn toàn; hàm trợ giúp ở tệp khác thì tệp spec đếm được 0 khẳng
  định, mà 0 khẳng định là trường hợp quy tắc **cố ý** không báo.
- **`.test.ts`, `.spec.tsx`, và cả làn integration.** Làn integration bị loại bằng hậu tố ngay ở cổng.

---

## `e2e-asserts-persisted-state`

**Bắt gì.** Một e2e mà trong toàn tệp không xuất hiện tên nào thuộc nhóm đọc trạng thái. Nghĩa là bài
kiểm thử chỉ khẳng định trên phản hồi, nên luồng có thể ngừng ghi dữ liệu mà tệp vẫn xanh.

**Giữ mã nào.** `TESTING-2`.

**Cách phát hiện.**

- Chỉ chạy trong làn luồng.
- Duyệt **mọi** nút `Identifier`, so `name` với một biểu thức chính quy neo hai đầu gồm sáu tên: bộ
  quản lý thực thể, nguồn dữ liệu, cả hai dạng viết hoa kiểu tên lớp, hàm lấy repository, và bộ chạy
  truy vấn.
- Thấy một cái là bật cờ. Tại `Program:exit`, cờ chưa bật thì báo.

**Vì sao luật này đáng có máy giữ.** `status === 200` chứng minh máy chủ còn sống, không chứng minh
một hàng đã đổi. Một luồng ngừng ghi dữ liệu là hỏng lặng lẽ đúng nghĩa: không có ngoại lệ, không có
log, chỉ có bộ kiểm thử báo xanh mãi mãi. Đây là hình dạng người đọc dễ bỏ qua nhất vì bài kiểm thử
**trông** rất đầy đủ.

**Cửa còn mở.**

- **Dòng nhập khẩu là đủ thoả mãn.** `import { DataSource } from "typeorm"` ở đầu một luồng chỉ khẳng
  định mã trạng thái vẫn được coi là có đọc trạng thái. Định danh trong nhập khẩu cũng là
  `Identifier`; chú thích kiểu, mã thông báo tiêm phụ thuộc, và dòng đóng kết nối trong dọn dẹp cũng
  vậy.
- **Đọc mà không khẳng định.** `const rows = await entityManager.find(Order)` rồi không `expect` gì
  lên `rows` vẫn qua. Quy tắc bật một cờ khi thấy một cái tên; nó không truy giá trị đó tới một
  khẳng định.
- **Tên thuộc tính trùng chữ.** `config.dataSource`, `options.queryRunner` — thuộc tính không tính
  toán cũng là `Identifier`, và quy tắc không quan tâm vị trí.
- **Một lần đọc thật mà danh sách không biết.** Repository đặt tên `repo`, bộ quản lý thực thể đặt
  tên `em`, một truy vấn thứ hai đi qua chính transport, một kho khác hẳn. Đây là **báo nhầm**, và
  cách rẻ nhất để dập là đổi tên biến chứ không phải thêm khẳng định — tức là đo **từ vựng**, không
  đo hành vi.

---

## `no-model-call-in-e2e`

**Bắt gì.** Một e2e nhập khẩu SDK của một nhà cung cấp mô hình, hoặc nhập khẩu trợ giúp mô hình nội
bộ vốn sinh ra để chạm tới nhà cung cấp.

**Giữ mã nào.** `TESTING-9`.

**Cách phát hiện.**

- Chỉ chạy trong làn luồng.
- Duyệt `ImportDeclaration`, lấy chuỗi `source.value`, so với hai biểu thức chính quy: một danh sách
  tiền tố gói nhà cung cấp, và một mẫu **hậu tố** cho trợ giúp mô hình nội bộ.
- Mẫu hậu tố **cố ý không neo đầu**, vì tệp e2e nằm cạnh thư mục trợ giúp nên đường dẫn nó thật sự
  viết là tương đối; một mẫu neo theo đường dẫn tuyệt đối sẽ không bao giờ thấy nó.

**Vì sao luật này đáng có máy giữ.** Một lời gọi mô hình tốn tiền, mất vài giây, và trả lời khác nhau
mỗi lần. Cả ba tính chất đều chí mạng trong một bài kiểm thử luồng, và hậu quả không dừng ở chậm: khẳng
định buộc phải nới lỏng dần cho tới lúc nó thôi bắt được gì. Quá trình nới lỏng đó diễn ra qua nhiều
lần sửa nhỏ, không ai nhìn thấy nó ở một lần xem lại mã.

**Cửa còn mở.**

- **Mọi thứ không phải nhập khẩu tĩnh.** `await import("openai")`, `require("openai")`, hoặc một lời
  gọi `fetch` thẳng tới điểm cuối HTTPS của nhà cung cấp. Chỉ `ImportDeclaration` được duyệt.
- **Nhà cung cấp không có trong danh sách.** Kể cả bản SDK mới hơn của **cùng một hãng** có bản cũ
  đang nằm trong danh sách. Nặng hơn: quy tắc harness ở cùng tệp nguồn **chấp nhận** một gói mà quy
  tắc này **không cấm** — hai danh sách trong một tệp không khớp nhau.
- **Chạm tới mô hình mà không nhập khẩu gì.** Luồng lấy cổng sản xuất ra từ vùng chứa ứng dụng và
  không ai nhớ đặt bản giả. Đây đúng là thất bại mà luật gọi tên — *một luật phải nhờ trí nhớ là một
  luật chỉ cách một buổi chiều đãng trí* — và **không quy tắc nào canh nó**.
- **Đổi tên hoặc dời trợ giúp một tầng.** `helpers/model.service`, `helpers/llm-client`,
  `helpers/models/index`. Mẫu đòi đường dẫn **kết thúc** bằng đúng một chữ.

---

## `e2e-uses-production-transport`

**Bắt gì.** Hai hình dạng khác nhau trong một quy tắc.

1. Nhập khẩu một bộ điều phối ứng dụng từ gói CQRS của khung — bus lệnh, bus truy vấn, bus sự kiện.
2. **Bất kỳ** lời gọi `.execute()` hoặc `.process()` nào có thuộc tính không tính toán.

**Giữ mã nào.** `TESTING-3`.

**Cách phát hiện.**

- Chỉ chạy trong làn luồng.
- `ImportDeclaration`: `source.value` phải **bằng đúng** một chuỗi gói; rồi mỗi `ImportSpecifier` có
  tên phía gói nằm trong tập ba tên thì báo. Đọc `imported` chứ không đọc bí danh cục bộ, nên đổi tên
  khi nhập khẩu không thoát.
- `CallExpression`: callee phải là `MemberExpression` không tính toán, tên thuộc tính nằm trong tập
  hai tên thì báo — **không kiểm tra đối tượng là gì**.

**Vì sao luật này đáng có máy giữ.** Gọi thẳng bus hay handler là bắt đầu **sau** khi định tuyến, xác
thực, kiểm tra hợp lệ và tuần tự hoá đã thành công. Nghĩa là bốn lớp đó có thể vỡ trong khi bài kiểm
thử luồng vẫn xanh. Người đọc mã rất khó thấy điều này, vì dòng gọi bus đọc lên **giống hệt** một
dòng gọi nghiệp vụ hợp lệ.

**Cửa còn mở.**

- **Gọi qua thuộc tính tính toán.** `bus["execute"](command)` hoặc `bus[method](command)` — quy tắc
  thoát ngay khi `computed` là đúng.
- **Mọi lối vào ứng dụng khác.** `eventBus.publish(event)`, `handler.handle(command)`,
  `resolver.findThing(args)`, `service.enroll(...)`, `worker.run()`. Đẩy thẳng một sự kiện lên bus là
  vào đúng chỗ luật cấm mà không bị báo, vì tập chỉ có hai tên phương thức.
- **Bus nhập khẩu từ nơi khác.** Một tệp barrel của dự án tái xuất khẩu nó, một đường dẫn sâu vào
  thư mục biên dịch của gói, hoặc `import * as cqrs from "@nestjs/cqrs"` rồi dùng `cqrs.CommandBus` —
  `ImportNamespaceSpecifier` không phải `ImportSpecifier` nên bị bỏ qua.
- **Báo nhầm trên đúng hai chữ đó.** `connection.execute(sql)` của một trình điều khiển cơ sở dữ liệu
  dùng để **đọc trạng thái về**, `queue.process(handler)` đăng ký trong phần dựng, `execute` của một
  bộ khách kiểm thử. Quy tắc không phân biệt được nội bộ ứng dụng với thư viện, nên dập nó đôi khi
  chỉ là đổi tên một lời gọi hợp lệ.

**Đây là quy tắc có hành vi thật lệch xa cái tên nhất trên kệ này.** Tên nói về transport; nửa sau
của phần cài đặt chỉ là một phép so tên phương thức không nhìn kiểu.

---

## `harness-calls-provider-directly`

**Bắt gì.** Bốn hình dạng trong làn harness chất lượng mô hình:

1. **Không** nhập khẩu SDK nhà cung cấp nào được chấp nhận.
2. Giả trang hoặc thay thế cổng sản xuất — nhập khẩu chính lớp cổng, khai báo `provide` bằng lớp đó,
   ghi đè nhà cung cấp bằng lớp đó, hoặc dựng một kiểu `Pick<...>` từ lớp đó.
3. Giấu lời gọi sau một trợ giúp nội bộ có tên bị cấm.
4. Dùng chứng thư của người dùng cuối hoặc của công cụ dòng lệnh thay cho khoá API máy chủ.

**Giữ mã nào.** `TESTING-10`.

**Cách phát hiện.**

- Phạm vi rộng hơn các quy tắc khác: làn harness **hoặc** tệp trợ giúp trong `/src/tests/helpers/`.
  Nhưng trong tệp trợ giúp **chỉ** phép kiểm chứng thư chạy — ba nhánh còn lại đều khoá theo làn
  harness.
- `ImportDeclaration`: bật cờ khi tiền tố gói thuộc danh sách được chấp nhận; báo khi đường dẫn (sau
  khi bỏ đuôi `.ts`/`.js`) khớp mẫu hậu tố trợ giúp; báo khi tên định danh nhập khẩu nằm trong tập ba
  tên cổng.
- `Literal`: báo khi một chuỗi khớp danh sách chứng thư người dùng cuối, không phân biệt hoa thường.
- `Property`: báo khi khoá tên `provide` có giá trị là `Identifier` đúng tên lớp cổng.
- `CallExpression`: báo khi thuộc tính tên `overrideProvider` nhận lớp cổng làm đối số đầu.
- `Program:exit`: quét **dòng token thô** tìm đúng chuỗi ba token `Pick` `<` `AiInvokeService`, rồi
  báo nếu cờ nhà cung cấp chưa từng bật.

**Vì sao luật này đáng có máy giữ.** Chủ đề của làn này là *câu mô hình trả lời có chấp nhận được
không*. Mỗi lớp đệm giữa harness và nhà cung cấp là một lớp có thể làm harness xanh trong khi sản
xuất hỏng: một tầng phân hạng, một lần ghi đè định tuyến, một lớp bọc nội bộ tự chọn mô hình. Một
lời gọi bị làm giả ở đây **không chứng minh gì cả**, và điều đó không nhìn ra được từ kết quả xanh —
kết quả xanh của một harness giả trông y hệt kết quả xanh của một harness thật.

**Cửa còn mở.**

- **Một dòng nhập khẩu không dùng cũng thoả mãn yêu cầu nhà cung cấp.** `import "openai"` ở đầu tệp,
  rồi cả harness chạy qua một bộ khách nội bộ đặt tên khác. Cờ bật vì **có** dòng nhập khẩu; SDK có
  được gọi hay không thì không ai kiểm.
- **Chứng thư đọc theo cách thông thường thì vô hình.** `process.env.CLAUDE_CODE_OAUTH_TOKEN` không
  bị bắt; chỉ dạng ngoặc vuông `process.env["CLAUDE_CODE_OAUTH_TOKEN"]` mới là chuỗi hằng. Chuỗi mẫu
  cũng vô hình vì mảnh chuỗi trong đó là `TemplateElement`.
- **Cổng khoác kiểu hoặc mã thông báo khác.** `Partial<...>`, `Omit<..., "x">`, một `interface` tự
  viết có đúng một phương thức, `provide: AI_INVOKE_TOKEN`, `overrideProvider(AI_INVOKE_TOKEN)`, hoặc
  nhập khẩu mặc định module cổng dưới một tên cục bộ.
- **Trợ giúp đổi tên là ra khỏi lệnh cấm.** Dời trợ giúp mô hình nội bộ sang `./judge-client` rồi nhập
  khẩu từ harness — mẫu chỉ liệt kê hai tên.
- **Trợ giúp nằm ngoài đúng một thư mục thì ngoài tầm hoàn toàn.** `test/helpers/`,
  `src/test/helpers/`, hay bất kỳ `helpers/` nào dưới một gốc khác đều rơi ra ngoài, và ngoài tầm
  nghĩa là **kể cả phép kiểm chứng thư cũng không chạy**.

---

## Luật

1. Định danh của quy tắc là tên nó công bố. Không đặt thêm mã số thứ hai.
2. Làn quyết định bằng **hậu tố tên tệp**, không bằng thư mục. Quy tắc chạy sai làn là lỗi ở cổng, không
   phải lỗi của tệp.
3. Quy tắc báo một **hình dạng**, không báo một **ý định**.
4. Một khẳng định về lời gọi là hợp lệ khi đứng làm khẳng định **thứ hai**. Đó là lý do quy tắc
   call-only đếm cả tệp thay vì đếm từng ca.
5. Không quy tắc nào biết kiểu. Mọi phép kiểm đều là so một cái **tên đã viết ra**.
6. Hai quy tắc đọc cả tệp rồi mới nói một lần ở cuối. Thêm **một** dòng ở bất kỳ đâu là đổi kết luận
   cho toàn tệp.
7. Một quy tắc không chỉ ra được thì là một đề xuất, không phải một luật. Sáu mã luật hiện **không có**
   quy tắc nào.

## Ngoại lệ

- **Khẳng định thứ hai.** Một khẳng định về lời gọi đứng cạnh một khẳng định về kết quả là hình dạng
  **được mong đợi**, khi chính lời gọi mới là hệ quả quan sát được — một thư đã gửi, một sự kiện đã
  phát. Đây là ngoại lệ được thiết kế, không phải sơ suất.
- **Luồng thật sự không có hệ quả lưu trữ.** Quy tắc đọc trạng thái chờ một dòng vô hiệu hoá **kèm
  tên thứ mà luồng quan sát thay thế**. Một dòng vô hiệu hoá không nêu lý do là xoá luật, xoá dần từng
  tệp một.
- **Phạm vi chứng thư rộng hơn phạm vi harness.** Trong tệp trợ giúp harness chỉ có phép kiểm chứng
  thư chạy; ba nhánh còn lại đều khoá theo làn.
- **Làn integration không có ai canh, và đó là chủ ý.** Luật tách bốn làn: ba quy tắc canh làn luồng,
  một canh làn unit, một canh làn harness. Không quy tắc nào canh integration.
