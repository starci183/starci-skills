---
id: be-lints-type-safety-audit
title: audit.md
slug: /be/lints/type-safety/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức thực thi của luật an toàn kiểu — luật nào giữ được mã nào, và chỗ nào còn hở.
---

# audit.md

> Version: `2.00` · Mô-đun: `type-safety`

Bài phản biện này không hỏi văn bản luật có đúng không. Nó hỏi **máy có giữ được luật không**, và nếu
không thì hở ở đâu.

## Verdict

Chấp nhận, kèm bốn nhận định phải ghi ra chứ không được làm gọn.

Mô-đun luật công bố **ba** luật, đúng bằng con số dự kiến. Cả ba đều được ghi ở đây, và cả ba đều ánh
xạ được vào một mã mà văn bản luật thật sự có: `TYPE-2`, `TYPE-3`, `TYPE-4`. Không luật nào bị bịa
thêm mã, và không mã nào được bịa ra để khớp với một luật.

Vấn đề của kệ này không nằm ở ba luật đó mà nằm ở **bốn mã xung quanh** chúng. `TYPE-1` do một luật đi
mượn giữ. `TYPE-5` cố ý không có luật, và cố ý ấy được lập luận đúng chỗ. `TYPE-6` được cài đặt trái
với chính câu chữ cho phép nó. Và khối mức nghiêm đề nghị đang bật một quyết định mà văn bản luật chưa
hề công bố mã nào cho nó.

Về độ chặt: đây là một kệ có **ba luật hẹp và chính xác**, chứ không phải ba luật rộng. Cả ba đều bắt
đúng thứ chúng nói, và cả ba đều bắt **đúng một lối viết** của thứ đó. Mọi lối viết khác của cùng ý
nghĩa đều đi lọt, và số lối viết khác thì nhiều hơn số lối viết bị bắt.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| Đếm số luật công bố | 3 — trùng dự kiến. Nguồn là bảng `rules` xuất ra cuối mô-đun |
| Số mục trong khối mức nghiêm đề nghị | 5. Ba mục nhà, hai mục thuộc plugin TypeScript |
| Mỗi luật có ánh xạ được vào một mã không | 3/3. `TYPE-2`, `TYPE-3`, `TYPE-4` |
| Có mã nào bị bịa ra để khớp không | Không |
| Có luật nào được đặt thêm số định danh không | Không. Danh tính là tên công bố |
| Mọi mã trong luật có luật giữ không | Không. `TYPE-1` đi mượn, `TYPE-5` cố ý bỏ trống, `TYPE-6` chỉ giữ được nửa kiểm thử |
| Có luật nào đang giữ một quyết định luật không công bố không | Có — `@typescript-eslint/array-type` với `default: "generic"` |
| Mỗi luật có ít nhất một cửa mở thật không | Có, cả ba. Không luật nào được ghi "không có" cho gọn |
| Miễn trừ có đóng theo cặp (tệp + giá trị) không | **Không.** Miễn trừ duy nhất là lối ra cho cả tệp, chỉ theo hình dạng đường dẫn |
| Phát hiện có phụ thuộc phân giải mô-đun hay kiểu không | Không. Thuần cú pháp, nên nhanh và nên dễ lách bằng cách đổi hình dạng cú pháp |
| Tên luật có tả đúng hành vi thật không | 1/3 tả đúng hoàn toàn. `no-const-enum` đúng; hai luật kia hẹp hơn tên chúng |

## Findings

1. **`no-inline-param-type` hẹp hơn hẳn cái tên nó mang.** Tên nói "kiểu viết thẳng trên tham số".
   Luật chỉ nhìn tham số **được rã cấu trúc**, và chỉ khi chú thích là một literal **trần**. Lối viết
   phổ biến hơn — `(params: { userId: string })` — hoàn toàn không bị nhìn, dù cái hại mà `TYPE-3` nêu
   tên là y nguyên: không tham chiếu được, không import được, người gọi thứ hai gõ lại. Đây là phát
   hiện nặng nhất trên kệ, vì nó khiến một luật đang bật trông như đã đóng một cửa mà thực ra chỉ đóng
   một nửa cánh.
2. **`no-double-cast` bắt một *lối viết*, không bắt một *ý nghĩa*.** Nó bắt đúng chuỗi
   `as unknown as`. Cùng một phép giặt viết bằng `as never as`, bằng hai câu lệnh, bằng ngoặc nhọn,
   hay bằng một hàm generic `<T,>(v: unknown): T => v as T` đều đi lọt. Dạng generic đáng lo nhất:
   nó không phải phá hoại, nó là **một lần dọn dẹp**, và nó xoá luật ở mọi chỗ gọi cùng lúc.
3. **`TYPE-6` được cài đặt trái với câu chữ cho phép nó.** Văn bản luật nói lối ra cho kiểm thử phải
   "viết vào cấu hình chứ không rắc thành các dòng tắt luật từng chỗ". Luật lại nhét lối ra vào bên
   trong `create`, và tự lập luận: dựng một giá trị sai có chủ đích là thuộc tính của **làn kiểm thử**
   chứ không phải của bố cục thư mục ở một kho cụ thể. Lập luận này tốt. Vị trí thì mâu thuẫn với câu
   đã cho phép nó. Một trong hai phải dời.
4. **Miễn trừ duy nhất trên kệ không đóng theo cặp.** Nó trả về một bộ duyệt **rỗng** cho cả tệp, nên
   bên trong một tệp được miễn thì luật không tồn tại, chứ không phải luật cho phép một cấu trúc. Hệ
   quả trực tiếp: đổi tên một mô-đun sản phẩm thành `.spec.ts` là tắt luật cho toàn bộ nội dung của
   nó, và đoạn `/src/tests/` miễn cho mọi tệp nằm dưới nó mãi mãi — kể cả một factory mà mã sản phẩm
   đang import.
5. **Khối mức nghiêm đề nghị đang bật một quyết định luật chưa công bố.**
   `@typescript-eslint/array-type` với `default: "generic"` bắt buộc một lối viết kiểu mảng. Văn bản
   luật chạy từ `TYPE-1` tới `TYPE-6` và không mã nào nói về chuyện đó. Một bản build sẽ báo vi phạm
   một luật mà lập luận của nó chỉ sống trong chú thích của mô-đun. Ghi thành phát hiện chứ không ghi
   bừa một ánh xạ.
6. **Hai mục trong khối đề nghị là một phụ thuộc cứng.** Nếu plugin TypeScript không được đăng ký ở
   kho tiêu thụ, hai mục đó không im lặng không làm gì — cấu hình hỏng vì không phân giải nổi tên
   luật. Điều đó **đúng theo hướng an toàn**, nhưng nó có nghĩa là mô-đun này không cài đặt được một
   mình, và điều đó phải được nói ra.
7. **`TYPE-1` — mã ồn nhất trong luật — do một luật mô-đun này không sở hữu giữ.** Quyết định không
   viết lại một luật ai cũng có là đúng. Hệ quả là mã trung tâm của cả văn bản luật được giữ bởi thứ
   mô-đun này không tả được ruột gan, không đánh phiên bản được, và không bảo đảm được là đã bật.
8. **`TYPE-5` không có luật, và đó là quyết định đúng, ghi đúng chỗ.** Muốn biết một tập boolean đang
   tả một tình huống hay nhiều tình huống độc lập thì phải hiểu mã đang nói gì; một luật đoán mò sẽ nổ
   trên mọi bản ghi có hai lá cờ. Ghi lại ở đây để người đọc không đi tìm luật giữ nó.
9. **Một nhánh phòng thủ gần như không bao giờ chạy.** `unwrapParam` bóc `TSParameterProperty` để lấy
   `.parameter`, nhưng TypeScript đã cấm khai báo một tham số-thuộc-tính bằng binding pattern, nên
   nhánh đó không thể sinh ra một `ObjectPattern` từ mã hợp lệ. Vô hại, và nên giữ — nhưng nó là mã
   phòng thủ chứ không phải một phép kiểm, và ai đọc luật cần biết điều đó trước khi tin rằng
   constructor đã được canh.
10. **Cổng kiểm thử báo nhầm theo chiều ngược lại.** Mẫu hậu tố chỉ nhận `.ts`, nên một bài spec viết
    ở `.mts`, `.cts` hay `.spec.tsx` **không** được miễn. Đây là báo thừa chứ không phải escape, và
    nó rẻ hơn nhiều so với rủi ro ngược lại — nhưng nó sẽ làm một người viết spec bối rối, vì luật im
    ở tệp bên cạnh.

## Decisions

- **Ghi đúng ba luật đang tồn tại.** Một luật đáng lẽ nên có mà chưa có thì không được ghi ở đây; nó
  nằm dưới "Rủi ro còn mở". Luật cao nhất của kệ này: thứ không chỉ tay vào được là một đề nghị,
  không phải một luật.
- **Danh tính là tên công bố.** Không đặt số cho luật. Tên đã là chuỗi in ra trong log build và chuỗi
  viết trong dòng tắt luật; đặt thêm số là cho một luật hai tên và mất khả năng biết thông điệp đến
  từ đâu.
- **Không tả ruột gan hai luật đi mượn.** Chúng được gọi tên ở phần "Ngoại lệ" và ở đây, và không có
  mục riêng. Một luật mô-đun này không sở hữu là một luật mô-đun này không thể bảo đảm hành vi.
- **Giữ nguyên chính tả mọi định danh** — tên luật, tên nút cú pháp, tên gói — kể cả khi nó mang tên
  một sản phẩm. Lệnh cấm tên sản phẩm áp vào **câu chữ** và **ví dụ**, không áp vào chuỗi mà bản build
  in ra.
- **Giữ tên nút AST và mẫu chuỗi nguyên văn trong bảng Detection.** Chúng là dữ liệu chịu lực của
  phép phát hiện; thay bằng cách nói vòng sẽ làm bảng phát hiện vô dụng.
- **Không luật nào được ghi "không có cửa mở".** Cả ba đều có ít nhất một hàng thật, và luật hẹp nhất
  lại là luật có nhiều hàng nhất.

## Rủi ro còn mở

Mỗi mục dưới đây là một cửa còn mở, kèm thứ mà luật sẽ phải soi thêm để đóng nó — hoặc lý do đóng nó
đắt hơn giá trị nó mang lại.

- **Phép ép kép tách làm hai câu lệnh.** Để đóng: cần theo dõi được rằng định danh đang bị ép có kiểu
  khai báo là `unknown`, tức là phải hỏi kiểu (`type-aware linting`) chứ không chỉ đọc cú pháp. Đây là
  bước nhảy đắt nhất trên kệ — nó buộc cả bộ luật chuyển sang chế độ cần chương trình biên dịch, làm
  lint chậm hẳn. Cách rẻ hơn và gần đúng: báo mọi `TSAsExpression` mà toán hạng là định danh của một
  biến khai báo `: unknown` **trong cùng phạm vi**. Rẻ, bắt được đúng lối viết phổ biến nhất, và bỏ
  sót khi biến đi qua ranh giới hàm.
- **Cầu nối không phải `unknown`.** `as never as`, `as any as`, `as {} as`, `as object as` đều lọt.
  Để đóng: thay phép so một nút bằng một danh sách kiểu-cầu-nối và báo mọi phép ép kép bất kể cầu nối
  là gì. Rẻ — một dòng — và **nên làm**, vì `as never as` giặt mạnh y hệt mà không có luật thứ hai nào
  đứng chờ như trường hợp `any`.
- **Lối ngoặc nhọn `<T><unknown>x`.** Để đóng: duyệt thêm `TSTypeAssertion` với cùng phép thử lồng
  nhau. Rẻ, và chi phí thật là nhớ rằng lối này chỉ hợp lệ ngoài tệp `.tsx`.
- **Hàm ép kiểu tổng quát.** `<T,>(value: unknown): T => value as T` chứa đúng một phép ép và hợp lệ ở
  mọi nơi. Để đóng: báo khi một hàm generic ép thẳng một tham số `unknown` sang chính tham số kiểu của
  nó — một mẫu cú pháp hẹp, nhận diện được, và đáng làm, vì đây là **cách một lần dọn dẹp xoá luật ở
  mọi chỗ gọi**.
- **Type guard không kiểm gì.** `(row: unknown): row is T => true` tạo ra đúng niềm tin đó với không
  một phép ép nào. Để đóng: không có cách đóng bằng cú pháp cho trường hợp tổng quát. Có thể bắt được
  trường hợp thô nhất — thân hàm là một literal `true` — nhưng mọi biến thể hơi khôn hơn thì thoát, và
  một luật chỉ bắt được trường hợp thô nhất sẽ dạy người ta viết khôn hơn chứ không dạy họ kiểm thật.
  Đây là chỗ **con người phải review**, và nó phải được nói thẳng như vậy.
- **Ép một lần từ một giá trị vốn đã `any`.** `JSON.parse(raw) as T` không cần cầu nối nào. Để đóng:
  cần biết kiểu trả về của lời gọi, tức lại là lint cần kiểu. Cách rẻ: một luật riêng cho vài hàm đã
  biết là trả `any`. Hẹp, nhưng `JSON.parse` một mình đã đáng.
- **Miễn trừ theo tên tệp, cho cả tệp.** Đổi tên một mô-đun thành `.spec.ts` là tắt luật cho toàn bộ
  nội dung. Để đóng: không thể đóng bằng lint — tên tệp là thứ rẻ nhất trong một kho để đổi, và bất kỳ
  cổng nào cũng chỉ đặt tên cho một **hình dạng đường dẫn**. Cách giảm thiệt hại: chuyển lối ra ra
  cấu hình theo đúng câu chữ của `TYPE-6`, để phạm vi do kho tiêu thụ quyết và **nhìn thấy được** ở
  một chỗ, thay vì nằm ẩn trong thân luật.
- **Miễn trừ theo thư mục `/src/tests/`.** Nó miễn cho mọi tệp nằm dưới, mãi mãi, kể cả tệp không còn
  là kiểm thử. Để đóng: bỏ đoạn thư mục và chỉ giữ danh sách hậu tố có neo đuôi, để miễn trừ luôn gắn
  vào **cách một tệp tự khai báo mình là gì** chứ không gắn vào chỗ nó ngồi. Rẻ, và nó khôi phục đúng
  nguyên tắc "cấm thư mục không phải cấm tệp".
- **Tham số không rã cấu trúc.** Đây là cửa rộng nhất của `no-inline-param-type`, và là lối viết phổ
  biến hơn lối bị bắt. Để đóng: bỏ phép thử `ObjectPattern` và báo mọi tham số mang `TSTypeLiteral`,
  dù là `Identifier` hay pattern. Rẻ, một dòng, và **đây là hàng đáng làm nhất trong bảng** — nó nhân
  đôi tầm với của luật mà không mở thêm rủi ro báo nhầm nào.
- **Giá trị mặc định biến tham số thành `AssignmentPattern`.** Để đóng: bóc thêm `AssignmentPattern`
  trong `unwrapParam` bằng cách đọc `.left`. Rẻ, một dòng, và nó bịt đúng cái động tác mà người ta làm
  khi biến một tham số thành tuỳ chọn.
- **Literal bị bọc trong giao, hợp hoặc `Readonly<…>`.** Để đóng: đi xuống một tầng qua
  `TSIntersectionType`, `TSUnionType` và các tham số kiểu của `TSTypeReference`, rồi báo nếu bắt gặp
  một `TSTypeLiteral` bên trong. Rẻ ở hai loại đầu; ở `TSTypeReference` thì phải cân, vì
  `Record<string, string>` là một `TSTypeReference` hoàn toàn lành và không được báo.
- **Bốn loại nút hàm không được duyệt.** `TSFunctionType`, `TSMethodSignature`, `TSDeclareFunction`
  và thân rỗng của phương thức abstract. Để đóng: thêm bốn nút vào bộ duyệt, dùng lại đúng hàm `check`
  đã có. Rẻ, và **quan trọng hơn vẻ ngoài của nó**: hình dạng được chốt ở hợp đồng — interface, type
  alias, chữ ký nạp chồng — nên chỗ đáng canh nhất lại đang là chỗ không bị canh.
- **Alias cục bộ không export thoả mãn luật.** Luật giữ được chữ "có tên"; văn bản luật đòi một kiểu
  có tên **trong thư mục types của mô-đun**. Để đóng: cần biết một `type`/`interface` có được export
  không (đọc được bằng cú pháp, rẻ) **và** có nằm ở đường dẫn nào (phải neo vào bố cục thư mục, làm
  luật hết dùng lại được giữa các kho). Nên đóng nửa đầu, và để nửa sau cho review của người.
- **`ArrayPattern` mang tuple viết thẳng.** Để đóng: thêm `ArrayPattern` vào phép thử hình dạng và
  chấp nhận `TSTupleType` bên cạnh `TSTypeLiteral`. Rẻ, giá trị thấp hơn các hàng trên, nhưng nó làm
  luật nhất quán với chính tên của mình.
- **`declare enum` không bị báo.** Một enum ambient không `const` cũng không có object lúc chạy. Để
  đóng: báo cả khi `node.declare` bật, với một thông điệp khác — vấn đề là "không có phần cài đặt",
  không phải "bị nội tuyến". Rẻ, và nó bịt đúng câu trả lời mà người ta sẽ nghĩ ra ngay sau khi bị
  `no-const-enum` chặn.
- **Const enum trong `.d.ts` và trong mã sinh tự động.** Luật không có cổng tệp nào của riêng nó, nên
  tầm với đúng bằng tập glob của kho tiêu thụ. Để đóng: mở rộng glob. Đây là thay đổi **cấu hình**
  chứ không phải thay đổi luật, và nó thuộc về kho tiêu thụ — nhưng nó phải được ai đó quyết, chứ
  không phải bị bỏ quên vì luật trông như đang chạy khắp nơi.
- **Const enum của một gói phụ thuộc.** Luật canh khai báo chứ không canh chỗ dùng, nên một const
  enum nhập từ ngoài mang đủ mọi thất bại tại mọi chỗ dùng mà không tệp nào trong cây này khai báo nó.
  Để đóng: cần phân giải mô-đun và hỏi kiểu. Đắt, và giá trị thì thấp — vì cách sửa thật không phải
  báo lỗi tại chỗ dùng mà là bọc gói đó lại sau một hằng của mình.
- **`TYPE-1` không có luật nhà nào giữ.** Nếu kho tiêu thụ không đăng ký plugin TypeScript, cấu hình
  hỏng — đúng theo hướng an toàn, nhưng nghĩa là mô-đun này không đứng một mình được. Để đóng: khai
  báo phụ thuộc đó ra thành văn bản ở chỗ ai đó sẽ đọc. Không nên viết lại luật; viết lại một luật ai
  cũng có là chi phí bảo trì không đổi lấy gì.
- **`TYPE-5` không có luật nào giữ.** Đây là quyết định có lập luận, không phải sơ suất. Để đóng: cần
  một dấu hiệu nhận ra "một tập boolean đang tả **một** tình huống" mà không cần hiểu nghiệp vụ —
  hiện chưa có dấu hiệu nào như vậy, nên chi phí là mở một khái niệm mới trong luật chứ không phải
  viết thêm mã.
- **`array-type` đang thực thi một quyết định không có mã.** Để đóng: hoặc thêm một mã vào văn bản
  luật cho lối viết kiểu mảng, hoặc bỏ mục đó khỏi khối đề nghị. Không được để nguyên: một người đọc
  thông điệp lỗi rồi đi tra văn bản luật sẽ không tìm thấy gì, và đó chính là cách một bộ luật mất uy.

## Re-audit Triggers

- Bảng `rules` xuất ra thêm, bớt hoặc **đổi tên** một luật.
- Một mã `TYPE-<n>` được thêm, bỏ hoặc viết lại trong văn bản luật — đặc biệt là `TYPE-6`, vốn đang
  nói lối ra nằm ở cấu hình trong khi luật cài nó vào thân.
- Khối mức nghiêm đề nghị thêm, bớt hoặc đổi mức một mục — kể cả hai mục đi mượn.
- Danh sách hậu tố kiểm thử được nới ra, hoặc đoạn thư mục `/src/tests/` bị đổi.
- Miễn trừ của `no-double-cast` chuyển từ thân luật ra cấu hình, hoặc mọc thêm vế giá trị.
- Một cửa mở ở trên được đóng lại: khi đó bảng **Open** trong `INDEX.md` phải mất đúng hàng đó, và
  bảng **Closed** phải mọc lên đúng hàng ấy.
- Bộ luật chuyển sang chế độ cần kiểu (`type-aware`) — khi đó gần một nửa bảng trên đóng được, và cả
  kệ phải viết lại.
- Một kho tiêu thụ hạ mức nghiêm của bất kỳ luật nào xuống dưới `error`, hoặc không đăng ký plugin
  TypeScript.
