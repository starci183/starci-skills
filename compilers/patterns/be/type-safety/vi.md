---
title: Type-safety · Vietnamese
---

# An toàn kiểu

Đầu vào là một shape đã được duyệt — một capability, một contract, một operation, một bản ghi lưu trữ. Pattern này không mở lại quyết định đó. Nó hạ quyết định ấy xuống source: file nào giữ giá trị, giá trị được khai kiểu gì, cái gì đứng sau lời khai ấy, tầng nào sở hữu mối bận tâm này, và file nằm ở làn nào. Shape đã duyệt nói hệ thống làm gì; pattern này nói sau khi code viết xong thì trình biên dịch còn được phép biết những gì.

## Luật

Trình biên dịch là người review rẻ nhất mà một back end có: nó đọc từng dòng, không bao giờ mệt, và nó phản đối trước khi code chạy. Mọi mã dưới đây đều xoay quanh một việc: **đừng tắt nó đi** — vì mỗi cách tắt đều trông hợp lý ngay tại lúc viết, và vô hình ngay từ lúc đó trở đi.

`any` là cách lộ liễu. Những cách còn lại kín tiếng hơn: một cặp cast rửa một kiểu sai qua `unknown`, một kiểu object viết inline mà không gì khác tham chiếu được, một enum bị xoá lúc biên dịch nên lúc chạy không đọc lại được, một tập boolean cho phép những tổ hợp chưa ai từng thấy.

Câu hỏi phân định mọi trường hợp: **sau dòng này, trình biên dịch còn biết thứ nó vừa có không?** Nếu câu trả lời là không, dòng đó đã tiêu mất một bảo đảm, và tiêu một bảo đảm cần lý do tốt hơn "cho tiện". Lý do ấy là thứ người đọc có quyền tìm thấy ngay tại dòng đó.

**Đây là luật bắt buộc, không phải lời khuyên.** Mọi giá trị đi qua một ranh giới, mọi danh sách tham số, mọi enum và mọi trạng thái đều mang đúng một mã dưới đây. Không có ranh giới nào nhỏ đến mức được miễn: một params hai field trả lời `TYPE-3` đúng cùng cái lý do mà một kết quả chấm bốn trạng thái trả lời `TYPE-5`. Câu "có mỗi cái helper thôi mà" là chỗ luật này bị bỏ qua nhiều nhất, và helper chính là thứ có thêm caller thứ hai mà không ai đọc lại.

Một nửa luật này máy kiểm được, một nửa thì không, và ranh giới ấy không phải do lười. Bảng `Tầng giữ` nói rõ nửa nào là nửa nào thay vì để người đọc tưởng chỗ nào cũng có cưỡng chế đều nhau, vì một luật để người đọc tin rằng có lint canh trong khi không có gì canh thì còn tệ hơn không có luật: nó mua sự yên tâm bằng con số không.

## Mã tình huống

Mọi tình huống module này quản đều mang một mã, `TYPE-<n>`. Các con số là CỐ ĐỊNH: chúng được trích dẫn từ các luật anh em, từ comment trong lint config và từ hồ sơ task cũ, nên đánh số lại là âm thầm làm hỏng một trích dẫn mà ai đó đã viết.

| Mã | Tình huống | Source phải trông như thế nào |
|---|---|---|
| `TYPE-1` | Một giá trị chưa biết hình dạng đi vào từ chỗ code không kiểm soát | Nó vào bằng `unknown` và được thu hẹp một lần, công khai, ở nơi người đọc nhìn thấy giả định. Không `any` ở bất kỳ vị trí nào — tham số, giá trị trả về, field, tham số generic, đích của cast |
| `TYPE-2` | Trình biên dịch từ chối một cast vì hai kiểu không giao nhau | Cast được sửa tại kiểu, hoặc được thu hẹp bằng một guard thật sự kiểm tra. Không `x as unknown as T` — cặp cast mà nửa sau đáp xuống một kiểu cụ thể |
| `TYPE-3` | Một hàm nhận một object và destructure ngay tại chữ ký | Tham số mang một kiểu có tên, khai ở nơi caller thứ hai import được. Không kiểu object literal viết inline trên tham số đã destructure |
| `TYPE-4` | Một tập hằng có tên | Enum khai thường, giữ lại object lúc chạy để duyệt được, map ngược được và truyền như một giá trị được. Không `const enum`, ở mọi vị trí kể cả khai lại dạng ambient |
| `TYPE-5` | Một tình huống có nhiều trạng thái | Tình huống ấy là union phân biệt của những trạng thái có thật. Không phải một tập boolean hay các field cùng optional mô tả một tình huống |
| `TYPE-6` | Một làn code cần lối thoát hợp lệ | Lối thoát khai một lần tại làn nó áp dụng, ở nơi người đọc tìm ra được mọi chỗ nó đang có hiệu lực. Không phải suppression từng dòng đứng thay cho một lối thoát cấp làn |

Sáu mã, và dừng ở sáu. Một tình huống thật sự không có mã là một thay đổi luật được ghi lại, không phải con số thứ bảy thêm vào cho tiện.

`TYPE-1` và `TYPE-2` trông như một mã nói hai lần, và chúng vẫn là hai vì chúng hỏng ở hai khoảng cách khác nhau. `any` hỏng theo hướng lan ra và hỏng ngay: mọi thứ đọc ra từ nó và mọi thứ dẫn xuất từ nó đều không được kiểm tra kể từ dòng đó, và người đọc rơi vào bất kỳ dòng nào trong số ấy vẫn lần ngược lại thấy được chữ `any`. Cặp cast hỏng theo hướng lặn xuống và hỏng muộn: nó tạo ra một giá trị TỰ NHẬN là `T`, nên phía sau chẳng có lý do gì để nghi ngờ, và lỗi nổ ra ở một dòng chẳng làm gì sai.

`TYPE-5` là mã lạ. Mọi mã khác cấm một cách tắt trình biên dịch; `TYPE-5` đòi một hình dạng bật nó lên mạnh hơn — union của những trạng thái có thật khiến một trạng thái không có thật không viết ra được. Nó nằm trong module này vì cái hỏng nó ngăn cũng là cái hỏng đó: một túi boolean biên dịch sạch ở cả mười sáu tổ hợp, trong đó có lẽ ba tổ hợp tồn tại, và trình biên dịch đã bị làm cho vô dụng đúng ở chỗ quan trọng nhất.

## Đọc một shape đã duyệt

1. **Đọc xem shape nói gì.** Nó nói những giá trị đi qua ranh giới, những operation nhận tham số, những tập hằng có tên, và những trạng thái mà một tình huống được phép ở trong. Đó là dữ kiện; nhận lấy như đã cho.
2. **Đọc xem shape không nói gì, và vì vậy không giải quyết gì.** Một shape đã duyệt gần như không bao giờ nói xuất xứ của một giá trị, nói có ai kiểm chứng lời khai kiểu chưa, nói có caller thứ hai hay không, nói có gì duyệt enum không, hay nói file nằm ở làn nào. Đó chính là phần `Đầu vào` của pattern này, và từng thứ phải được thu thập làm bằng chứng trước khi gán mã.
3. **Giải từ ngoài vào.** Bắt đầu ở ranh giới mà giá trị đi vào, rồi tới danh sách tham số mang nó, rồi tới các tập hằng và các trạng thái bên trong. Một giá trị còn là `any` ngay tại ranh giới khiến mọi mã áp vào phía trong chỉ còn là trang trí.
4. **Hỏi câu hỏi của từng mã, theo thứ tự.** Có giá trị chưa biết hình dạng đi vào ở đây không (`TYPE-1`)? Có cast nào bị ép qua `unknown` không (`TYPE-2`)? Có tham số nào destructure ngay tại chữ ký không (`TYPE-3`)? Có tập hằng có tên nào được khai không (`TYPE-4`)? Có tình huống nào mang nhiều trạng thái không (`TYPE-5`)? Làn này có cần lối thoát hợp lệ không (`TYPE-6`)?
5. **Khi hai mã cùng khớp, tách chúng bằng điều mà dòng code tự nhận.** `any` thú nhận rằng nó không kiểm gì; cặp cast tự nhận là `T`, nên `TYPE-2` lấy mọi dòng đi qua `unknown` rồi đáp xuống một kiểu cụ thể, còn `TYPE-1` lấy phần còn lại. Kiểu inline trên tham số đã destructure vẫn được kiểm tra đầy đủ, nên nó là `TYPE-3`, không bao giờ là `TYPE-1`. Một trục giá trị đơn là `TYPE-4`; những nhánh mà mỗi nhánh mang dữ liệu khác nhau là `TYPE-5`. Và một spec dựng giá trị sai cố ý không phải là `TYPE-2` được tha — nó không thuộc phạm vi `TYPE-2` ngay từ đầu, và thứ nó trả lời là `TYPE-6`.

## `TYPE-1` — dùng unknown, không dùng any

**Tình huống.** Một giá trị đi vào từ chỗ mình không kiểm soát: body của một webhook, lỗi mà SDK của nhà cung cấp ném ra, một cột `jsonb` đọc lên từ database, một file cấu hình do người khác sửa. Mình không biết hình dạng của nó.

**Nó sinh ra gì trong source.** Giá trị được khai `unknown` ngay tại chỗ nó đi vào, và đúng một lần thu hẹp nhìn thấy được — `typeof`, `instanceof` hoặc một predicate — đứng giữa nó và lần đọc cụ thể đầu tiên. `any` không xuất hiện ở đâu cả: không ở tham số, giá trị trả về, field, tham số generic hay đích của cast. `any` không có nghĩa là "tôi không biết kiểu này". Nó có nghĩa là **thôi đừng kiểm tra nữa**, và cái "thôi" ấy lan ra: mọi property đọc ra từ nó, mọi giá trị dẫn xuất từ nó, mọi chỗ nó được truyền vào đều không còn được kiểm tra. Một `any` ở tầng parser có thể làm mù cả một chuỗi gọi mà không ai viết thêm chữ `any` nào nữa.

**Dấu hiệu nhận biết.** Giá trị đến từ mạng, từ SDK bên thứ ba, từ `JSON.parse`, từ một cột jsonb, từ `catch`. Lý do định gõ `any` là "kiểu thật dài quá" hoặc "SDK khai báo sai". Sau dòng đó, IDE ngừng gợi ý — dấu hiệu trực quan nhất của một bảo đảm vừa mất. Tự hỏi: nếu khai `unknown` ở đây, dòng nào sẽ đỏ? Mỗi dòng đỏ đó là một giả định mình vừa định giấu đi.

**Ranh giới.** Không phải `TYPE-2`: `any` thú nhận rằng nó không kiểm tra gì, còn double cast nói dối rằng giá trị là `T`; `any` hỏng theo hướng lan ra, double cast hỏng theo hướng lặn xuống. Không phải `TYPE-3`: kiểu inline trên một tham số vẫn kiểm tra đầy đủ — nó không tham chiếu được chứ không phải không an toàn — và gộp hai thứ lại là mất đúng cái phân biệt ấy.

**Tình huống nghiệp vụ hay gặp.** Parser webhook của cổng thanh toán · `catch (error)` quanh một lệnh gọi provider AI · đọc cột jsonb lưu snapshot · parse front-matter của file nội dung · kết quả `JSON.parse` từ response của model · payload của một message queue · biến môi trường trước khi validate.

## `TYPE-2` — không double cast qua unknown

**Tình huống.** Mình viết `x as T`, trình biên dịch từ chối vì hai kiểu không giao nhau, và mình trả lời lời từ chối ấy bằng cách chèn `unknown` vào giữa: `x as unknown as T`.

**Nó sinh ra gì trong source.** Chuỗi `as unknown as` không tồn tại trong code sản phẩm. Thay vào đó kiểu được sửa — một interface cấu trúc tối thiểu, một hàm map thật — hoặc giá trị được thu hẹp bằng một guard thật sự kiểm tra. Đây là trình biên dịch bị bác bỏ hai lần. Lần một: "hai kiểu này không liên quan". Lần hai: "kệ". Nó tệ hơn `any` ở đúng một điểm, và điểm đó quyết định. `any` nói "đừng tin tôi", nên mọi thứ phía sau đều được xét lại; double cast tạo ra một giá trị tự nhận là `T`, nên mọi thứ phía sau tin nó tuyệt đối, và lỗi nổ ra ở một dòng chẳng làm gì sai, cách chỗ gây lỗi hàng chục file.

**Dấu hiệu nhận biết.** Chuỗi `as unknown as` xuất hiện trong code sản phẩm. Mình đang ép một object thiếu field thành một entity đầy đủ. Mình đang ép kết quả của một query thô thành kiểu entity mà không kiểm gì. Lý do trong đầu là "tôi biết chắc lúc chạy nó đúng mà". Tự hỏi: nếu điều mình "biết chắc" sai, ai là người phát hiện? Nếu câu trả lời là "khách hàng", thì đây là `TYPE-2`.

**Ranh giới.** Không phải `TYPE-1`: xem trên. Không phải một cast đơn: `as unknown` một mình là nới rộng ra ngoài, và đó là hành động thật thà — nó vứt thông tin đi chứ không nhận thêm thứ gì; một cast thu hẹp một mình là câu hỏi khác, nhỏ hơn, và mã này không trả lời. Không phải `TYPE-6`: trong spec và test tree, double cast là hợp lệ và cần thiết, và đó là tính chất của làn code, không phải của dòng code.

**Tình huống nghiệp vụ hay gặp.** Ép raw row từ query thô thành entity · ép một object rỗng thành collaborator trong code sản phẩm · ép request của framework này thành request của framework kia · "vá" một kiểu SDK khai sai · ép DTO thành entity để tiết kiệm một hàm map.

## `TYPE-3` — tham số destructure phải có kiểu được đặt tên

**Tình huống.** Một hàm nhận một object và destructure ngay tại chữ ký: `({ userId, courseId }: { userId: string, courseId: string })`.

**Nó sinh ra gì trong source.** Một kiểu có tên trong thư mục `types/` của module, một kiểu cho mỗi operation, tài liệu hoá theo từng field, và chữ ký tham chiếu tới nó. Kiểu viết thẳng tại chỗ thì không tham chiếu được, không import được, không extend được, không index được. Cho nên caller thứ hai gõ lại nó, và hai bản sao trôi ra xa nhau trong im lặng vì không có gì nối chúng với nhau; khi field thứ ba xuất hiện, chỉ một trong hai bản sao nhận được nó. Một kiểu có tên mang đúng lượng thông tin đó, nhưng có tay cầm.

**Dấu hiệu nhận biết.** Chữ ký hàm dài hơn thân hàm. Có hai chỗ trong repo cùng khai một object gần giống nhau. Muốn viết `Params["field"]` mà không có gì để index vào. Muốn viết một hàm bọc ngoài mà không gọi tên được kiểu tham số của hàm bên trong. Tự hỏi: nếu ngày mai có caller thứ hai, họ import cái gì? Nếu không có câu trả lời, đây là `TYPE-3`.

**Ranh giới.** Không phải `TYPE-1`: kiểu inline vẫn được kiểm tra đầy đủ; vấn đề là tái sử dụng, không phải an toàn. Không phải tham số positional: `(params: { userId: string })` không thuộc mã này. Mã này nói về dạng đã destructure, vì đó là dạng bị caller sau gõ lại; kiểu inline trên một tham số positional là vấn đề nhỏ hơn và thuốc khác.

**Tình huống nghiệp vụ hay gặp.** Params của một handler CQRS · params của một service method có ba tham số trở lên · options của một hàm tiện ích · payload của một job · tham số của một hàm projection · input của một step trong pipeline xử lý.

## `TYPE-4` — enum thường, không bao giờ const enum

**Tình huống.** Một tập hằng có tên: trạng thái đơn hàng, loại thông báo, nhà cung cấp model.

**Nó sinh ra gì trong source.** Một khai báo `enum` thường, sống tới lúc chạy dưới dạng một object. `const enum` được nội tuyến lúc biên dịch và không để lại object nào lúc chạy. Cái nó tiết kiệm là vài byte. Cái nó lấy đi là cả một họ việc đơn giản: không `Object.values()` được, nên không duyệt được để dựng danh sách chọn; không map ngược từ giá trị về member được, nên không hồi phục được một giá trị đã lưu trong DB; không truyền chính enum đó như một giá trị vào một hàm generic được; và không đi qua được ranh giới `isolatedModules` mà bản biên dịch này đang chạy dưới đó.

**Dấu hiệu nhận biết.** Có ai đó thêm `const` vào trước `enum` "cho nhẹ bundle" — trong một tiến trình Node. Một hàm coerce nhận `enumObject` làm tham số: đó là bằng chứng enum phải tồn tại lúc chạy. Một `registerEnumType` hoặc một cột enum trong DB: cả hai đều cần object thật. Tự hỏi: có chỗ nào duyệt, map ngược, hoặc truyền chính enum này như một giá trị không? Trong một back end, câu trả lời gần như luôn là có, kể cả khi hôm nay chưa có.

**Ranh giới.** Không phải `TYPE-5`: enum là một trục giá trị, còn union phân biệt là nhiều trạng thái mà mỗi trạng thái mang dữ liệu khác nhau — nếu mỗi nhánh cần field riêng thì enum không đủ và tình huống là `TYPE-5`. Không phải `declare enum`: khai báo ambient mô tả một thứ đã tồn tại ở nơi khác và không phát sinh gì, nên nằm ngoài mã này.

**Tình huống nghiệp vụ hay gặp.** Trạng thái đơn hàng · loại giao dịch · nhà cung cấp model AI · kênh thông báo · loại lỗi được phân nhóm để retry · vai trò người dùng · cách sắp xếp của một query danh sách.

## `TYPE-5` — union phân biệt thắng một túi boolean

**Tình huống.** Một tình huống có vài trạng thái, được mô tả bằng mấy cái cờ: `isPending`, `isGraded`, `isFailed`, cộng thêm `score?`.

**Nó sinh ra gì trong source.** Một union của những trạng thái có thật, phân biệt bằng discriminant, để một trạng thái không có thật không viết ra được. Bốn boolean cho phép mười sáu tổ hợp. Có lẽ ba trong số đó tồn tại. Mười ba tổ hợp còn lại biên dịch sạch sẽ, và một trong số chúng là thứ một caller truyền vào lúc bốn giờ sáng. `isGraded && isFailed` biên dịch. `isGraded` mà không có `score` biên dịch. Không cái nào là một trạng thái thật của nghiệp vụ, nhưng trình biên dịch không có cách nào biết — mình chưa hề nói cho nó biết. Đây là mã duy nhất trong module này không cấm điều gì cả: nó bật trình biên dịch lên mạnh hơn thay vì ngăn ai đó tắt bớt.

**Dấu hiệu nhận biết.** Hai boolean trở lên cùng mô tả **một** thứ. Có field optional mà "chỉ có khi cờ kia bật", và điều đó chỉ được viết trong comment. Code đọc lên có `if (a && !b && c)` để tái tạo lại một trạng thái lẽ ra phải có tên. Có một comment giải thích tổ hợp nào là hợp lệ: comment đó chính là kiểu dữ liệu bị viết nhầm chỗ. Tự hỏi: liệt kê hết những trạng thái thật sự tồn tại, rồi đếm xem hình dạng hiện tại cho phép viết ra bao nhiêu trạng thái. Phần chênh lệch là bề mặt lỗi mình vừa tự tạo ra.

**Ranh giới.** Không phải `TYPE-4`: xem trên. Không phải nhiều boolean độc lập: mã này nói về nhiều boolean mô tả một tình huống; hai boolean trả lời hai câu hỏi độc lập thì đúng là hai boolean. Không phải kiểu transport: một class response đã đăng ký schema hoặc một cột lưu trữ không mang được union — union sống ở kết quả nội bộ, hình dạng transport mang bản phẳng, và việc map giữa hai bên xảy ra một lần, một chỗ.

**Tình huống nghiệp vụ hay gặp.** Kết quả chấm bài · kết quả một bước đăng nhập (challenge hay đã có session) · trạng thái thanh toán · kết quả đồng bộ (thành công / lệch / hỏng) · trạng thái một job nền · kết quả gọi model (có nội dung / bị chặn / hết quota).

## `TYPE-6` — lối thoát hợp lệ khai tại làn

**Tình huống.** Có những chỗ phải được phép làm điều luật cấm. Rõ nhất: spec và test tree được phép double cast, vì dựng một giá trị sai cố ý chính là cách chứng minh một API đóng biết từ chối. Không có lối thoát này thì không viết được test cho chính cái luật kia.

**Nó sinh ra gì trong source.** Một khai báo duy nhất tại làn — một predicate trong rule, hoặc một mục trong config — được tra đúng một lần, và từ đó suy ra được mọi chỗ lối thoát đang có hiệu lực. Vấn đề chưa bao giờ là có lối thoát; vấn đề là lối thoát được khai ở đâu. Khai một lần tại làn thì lối thoát đếm được: đọc một hàm là biết hết mọi chỗ nó đang có hiệu lực. Rắc `eslint-disable` từng dòng thì lối thoát thôi hiện hữu và bắt đầu thành thói quen: không ai biết có bao nhiêu cái, không ai biết cái nào còn cần, và cái thứ năm mươi được thêm vào vì bốn mươi chín cái trước đã ở đó rồi.

**Dấu hiệu nhận biết.** Một `eslint-disable-next-line` trong code sản phẩm cho một luật thuộc module này. Cùng một dòng suppression xuất hiện ở ba file trở lên — đó là một làn chưa được khai báo. Một file sản phẩm cần lối thoát của test: nghĩa là file đang nằm sai làn, không phải luật sai. Tự hỏi: nếu xoá hết mọi suppression trong repo, mình còn đọc ra được những chỗ nào được phép ngoại lệ không? Nếu không, lối thoát đang ở sai chỗ.

**Ranh giới.** Không phải `TYPE-2`: `TYPE-2` nói cái gì bị cấm, `TYPE-6` nói lệnh miễn trừ được viết ở đâu. Một spec double cast không phải là vi phạm `TYPE-2` rồi được tha — nó không thuộc phạm vi `TYPE-2` ngay từ đầu. Không phải một ngoại lệ nghiệp vụ: một ngoại lệ đóng đã nêu trong `Ngoại lệ` là một phần của luật, còn một suppression là một phần của sự mệt mỏi.

**Tình huống nghiệp vụ hay gặp.** Spec dựng collaborator thiếu method · e2e dựng payload sai để chứng minh validation chặn · harness gọi provider thật · helper trong test tree dựng entity giả · fixture cố tình thiếu field bắt buộc.

## Tầng giữ

Tầng nào thật sự giữ từng mã. `unrepresentable` nghĩa là một union đóng hoặc một branded type khiến giá trị sai không viết ra được; `enforced` nghĩa là một lint rule công bố bởi `sources/be/type-safety.mjs` bắt được nó; `documented` nghĩa là không có gì máy móc giữ nó, chỉ có người đọc giữ.

| Mã | Tầng | Cái gì giữ nó |
|---|---|---|
| `TYPE-1` | `enforced` | `@typescript-eslint/no-explicit-any` — một rule chuẩn được NÊU TÊN trong `recommended` của luật này thay vì viết lại trong luật |
| `TYPE-2` | `enforced` | `no-double-cast` (export `noDoubleCast`) |
| `TYPE-3` | `enforced` | `no-inline-param-type` (export `noInlineParamType`) |
| `TYPE-4` | `enforced` | `no-const-enum` (export `noConstEnum`) |
| `TYPE-5` | `documented` | — |
| `TYPE-6` | `documented` | — |

**Bốn enforced, hai documented, không có cái nào unrepresentable.**

Ba trong bốn dòng enforced là rule nhà viết; dòng thứ tư, `TYPE-1`, được giữ bởi một rule mà mọi repository TypeScript đều đã có. Luật nêu tên nó trong `recommended` thay vì viết một bản cài đặt thứ hai, và lựa chọn đó là cố ý: nhân bản một rule ai cũng có là chi phí bảo trì không đổi lại được gì, và `no-explicit-any` chính là cái mà nếu thiếu thì ba rule kia thành trang trí — `any` mang mọi vấn đề chúng cấm quay lại, chỉ bằng một từ khoá.

Hai dòng documented, và chúng documented vì hai lý do trái ngược. `TYPE-5` không cưỡng chế được về nguyên tắc: quyết định xem bốn boolean mô tả MỘT tình huống hay bốn dữ kiện độc lập thật sự thì phải hiểu code có nghĩa gì, và một rule đoán mò sẽ nổ ở mọi struct có hai cờ. `TYPE-6` không cưỡng chế được trên thực tế: một rule không phân biệt được suppression đứng thay cho một khai báo làn còn thiếu với suppression thật sự cục bộ, vì cả hai là cùng ba token.

Cột `unrepresentable` trống, và ô trống ấy là ô nhiều thông tin nhất trong bảng. `TYPE-5` chính là mã ĐÒI tầng `unrepresentable` — union phân biệt đúng là thiết bị chuyển một luật nghiệp vụ từ văn xuôi vào hệ kiểu — mà bản thân nó lại không được giữ ở đó, vì không kiểu nào cấm được bạn khai một kiểu sai. Đó là vòng lặp mà module này sống bên trong, và đó là lý do `TYPE-5` là văn xuôi kèm cái hỏng của nó chứ không phải một rule.

Mỗi dòng enforced cũng hẹp hơn mã của nó. `no-double-cast` chỉ thấy một biểu thức, nên một pha rửa kiểu tách ra hai câu lệnh thì lọt. `no-inline-param-type` đi qua function declaration, function expression và arrow, nên một kiểu inline trong chữ ký ở vị trí kiểu thì lọt. `no-explicit-any` không đi vào một cast không kiểm tra, nên nửa sau của `TYPE-1` — rằng việc thu hẹp thật sự có thu hẹp — hoàn toàn không có rule nào. Một bảng tầng làm tròn "một phần" lên thành "enforced" chính là lời nói dối mà luật này nói về.

## Điểm neo

Code thật để đối chiếu từng luật. Một luật không chỉ tay vào được thì chỉ là một đề xuất.

| Mã | Điểm neo | Cần nhìn cái gì |
|---|---|---|
| `TYPE-1` | `src/modules/ai/balancer/utils/classify-ai-error.ts` → `extractStatus`, `extractRetryAfterMs`, `classifyAiError` | Ba hàm nhận `error: unknown` từ một ranh giới không ai kiểm soát và thu hẹp bằng `typeof` và `instanceof` trước khi đọc một property. Đọc xem chữ ký hứa gì với caller so với điều mà một `any` ở đó đã hứa |
| `TYPE-1` | `src/modules/ai/ping/utils/to-error-message.ts` → `extractResponseDetail` | Việc thu hẹp làm theo cách tốn kém một cách cố ý: từng tầng lồng nhau đều được `typeof`-check trước khi tầng sau được đọc. Đó là cái giá của `TYPE-1` khi hình dạng thật sự chưa biết, và cái giá ấy chính là điểm chính |
| `TYPE-1` | `eslint.config.mjs` → `'@typescript-eslint/no-explicit-any': 'error'` | Rule đặt ở mức `error`, với luật được trích dẫn ngay trên cùng dòng. Grep `: any` khắp `src` và đọc từng hit: tất cả đều là từ tiếng Anh nằm trong comment. Không có khai báo nào là phép đo cho phép mức là `error` chứ không phải `warn` |
| `TYPE-2` | `src/modules/platform/cookie/types/cookie.ts` → `CookieRequestLike` | Bản sửa, kèm lý do: một interface cấu trúc tối thiểu tồn tại để hai chỗ nối không double cast một túi header thành một `Request` đầy đủ của framework. Đọc doc comment — nó nêu đích danh cặp cast mà nó được viết ra để tránh |
| `TYPE-2` | `.claude/sources/be/type-safety.test.mjs` → danh sách `valid` của cặp test `TYPE-2` | Ranh giới của rule phát biểu dưới dạng các case chạy được: một `as unknown` đơn độc là nới rộng thật thà, một cast thu hẹp đơn độc là câu hỏi khác, và chỉ cặp cast đáp xuống một kiểu cụ thể mới là hành vi bác bỏ |
| `TYPE-3` | `src/modules/ai/types/grading-lane-validation-params.ts` → `ValidateGradingLaneParams`, được dùng ở dạng destructure trong `src/modules/ai/grading-lane-validation.service.ts` | Kiểu có tên và chỗ gọi nó, nằm ở hai file. Phần thú vị là tham chiếu thứ ba trong service: `NonNullable<ValidateGradingLaneParams["provider"]>`. Một kiểu inline không index được như vậy, nên dòng đó chính là thứ `TYPE-3` mua được |
| `TYPE-3` | `src/modules/platform/cookie/types/cookie.ts` → `AttachHttpOnlyCookieParams`, `AttachReadableCookieParams`, `ClearCookieParams` | Ba kiểu params trong một file `types/`, mỗi operation một kiểu, tài liệu hoá theo từng field. Đọc chúng như hình dạng mà thư mục `types/` của một module mang lấy khi luật được tuân theo thay vì bị tranh cãi |
| `TYPE-4` | `src/modules/databases/postgresql/primary/enums/mock-interview-kind.ts` → `normalizeMockInterviewKind` | `Object.values(MockInterviewKind)` bên trong một phép coerce biến một chuỗi đã lưu thành một member đã biết. Một `const enum` không có object nào để gọi `Object.values`, nên hàm này lẽ ra không viết ra được |
| `TYPE-4` | `src/modules/init/seeders/shared/extracts/coerce-md-scalar.service.ts` → `toNullableEnum`, `toRequiredEnum` | Dạng mạnh nhất: enum được truyền NHƯ MỘT GIÁ TRỊ, `enumObject: TEnum`, rồi khớp theo key và sau đó theo value. Mọi caller của helper này là một việc mà `const enum` làm cho bất khả thi |
| `TYPE-4` | `tsconfig.json` → `"isolatedModules": true` | Thiết lập của trình biên dịch biến mệnh đề cuối của `TYPE-4` từ một ý kiến thành một lỗi build. Điều luật khẳng định về ranh giới isolated-modules kiểm được ngay đây, trong một dòng |
| `TYPE-5` | `src/features/api/core/graphql/mutations/keycloak/sign-in/init/graphql-types/response.ts` → `SignInInitCommandResult` cạnh `SignInInitData` | Cả hai nửa của mã trong cùng một file. Kết quả nội bộ là một union phân biệt bằng `kind`, nơi một trạng thái lẫn lộn challenge/session không biên dịch được; class transport bên cạnh có mọi field optional, vì định dạng đi trên dây không mang được union. Đọc cặp này như ranh giới chính xác của ngoại lệ, không phải như một chỗ thiếu nhất quán |
| `TYPE-6` | `.claude/sources/be/type-safety.mjs` → `isTestFile` | Chính cái lối thoát: một predicate, một regex trên các hậu tố spec cộng với cây test, được tra đúng một lần lúc dựng rule. Mọi chỗ lối thoát đang có hiệu lực đều suy ra được từ hàm này, và đó chính là tính chất mà suppression từng dòng phá huỷ |
| `TYPE-6` | `src/features/api/core/graphql/mutations/keycloak/sign-in/init/sign-in-init.handler.spec.ts` → các cast `jest.Mocked<Pick<…>>` | Lối thoát lúc đang dùng, kèm lý do: một spec dựng một collaborator thiếu một cách cố ý để chứng minh handler chỉ chạm vào những method nó khai. Chú ý cái KHÔNG có ở đây — không một comment `eslint-disable` nào trên các dòng đó |

Mọi mã đều đã có neo. Không mã nào chưa neo được.

## Đầu vào

| Đầu vào | Bằng chứng cần có |
|---|---|
| origin | Giá trị đến từ đâu — một body đã parse, một SDK nhà cung cấp, một cột đã lưu, một caller nội bộ — vì đó quyết định hình dạng của nó có được biết hay không |
| shape | Kiểu mà nó khai, và có gì kiểm chứng lời khai ấy không |
| narrowing | Guard, `typeof`, `instanceof` hay predicate đứng giữa `unknown` và lần đọc cụ thể |
| callers | Mọi caller của một danh sách tham số hôm nay, và liệu có caller thứ hai hoặc sẽ có một cách hợp lý |
| runtime need | Với một enum: có gì duyệt nó, map ngược nó hay truyền nó như một giá trị không |
| states | Với một tình huống: những trạng thái thật sự tồn tại, và những tổ hợp mà hình dạng hiện tại cũng cho phép |
| lane | File nằm ở làn nào, vì lối thoát hợp lệ là tính chất của làn, không phải của dòng |

## Quy tắc

1. `any` không xuất hiện trong một khai báo, một đích của cast hay một tham số generic.
2. Giá trị chưa biết hình dạng vào bằng `unknown` và được thu hẹp đúng một lần, công khai.
3. Cặp cast qua `unknown` không tồn tại ngoài các làn test.
4. Kiểu của một tham số đã destructure có tên và có nhà để caller thứ hai import.
5. Enum giữ lại object lúc chạy của nó.
6. Một tình huống nhiều trạng thái là union của những trạng thái ấy, không phải tích của mấy cái cờ.
7. Lối thoát hợp lệ khai tại làn, một lần, và suy ra được từ chính khai báo đó.
8. Mọi lần đi qua ranh giới đều quy về đúng một mã. Không giá trị nào nằm ngoài phạm vi.

## Ngoại lệ

Ngoại lệ là một phần của luật, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ mã nó áp dụng vào.

- **Các làn test được dựng giá trị sai cố ý.** `TYPE-2` không áp vào họ spec hay cây test: dựng một giá trị mà kiểu sản phẩm từ chối chính là cách một spec chứng minh một API đóng biết từ chối. Lối thoát thuộc về làn, không thuộc về dòng — nó khai một lần trong rule, và một suppression từng dòng bên trong một làn đã có lối thoát nghĩa là file đang nằm sai làn.
- **Nới rộng ra ngoài là thật thà.** `TYPE-2` cấm CẶP cast. `as unknown` một mình vứt thông tin đi và không nhận thêm gì, đó là chiều hỏng ngược lại; một cast thu hẹp đơn độc là câu hỏi khác, nhỏ hơn, và mã này không trả lời.
- **Tham số positional không phải tham số destructure.** `TYPE-3` quản dạng đã destructure, vì đó là chỗ một hình dạng bị caller sau gõ lại. Kiểu inline trên một tham số positional là vấn đề nhỏ hơn với thuốc khác và cố ý nằm ngoài mã này.
- **Kiểu transport không mang được union.** `TYPE-5` không nổ trên một hình dạng đi trên dây hay xuống ổ đĩa khi định dạng đó không có kiểu tổng — một class response đã đăng ký schema, một cột lưu trữ đơn. Union sống ở kết quả nội bộ, hình dạng transport mang bản phẳng, và việc map giữa hai bên xảy ra một lần, một chỗ, nơi đọc được.
- **Một phiên bản mô hình hoá thành dữ liệu không phải một cái cờ.** `TYPE-5` không nổ trên những boolean độc lập trả lời những câu hỏi độc lập. Mã này nói về nhiều boolean mô tả MỘT tình huống; hai boolean mô tả hai tình huống thì đúng là hai boolean.
- **Khai báo ambient không phải một khai báo.** Rule của `TYPE-4` cố ý cho `declare enum` đi qua, vì một enum ambient mô tả một thứ đã tồn tại ở nơi khác chứ không phát sinh gì.

## Đầu ra

Mỗi file mà shape đã duyệt sinh ra thì một khối.

```text
value: <the thing crossing the boundary>
origin: <parsed body | provider SDK | stored column | internal caller>
situation: <TYPE-1 … TYPE-6>
shape: <the declared type after the line>
narrowing: <the guard that stands behind the claim, or none>
lane: <product | spec | test tree>
reason: <what the compiler still knows after this line, and what it would have lost>
```

## Ví dụ đã giải

**Shape đã duyệt.** Một capability chấm bài được duyệt: một operation kiểm tra một grading lane từ một tập tham số, gọi một nhà cung cấp model, và trả về một kết quả chấm hoặc đang chờ, hoặc đã chấm kèm điểm, hoặc thất bại.

Shape nói các tham số, lệnh gọi provider và ba trạng thái. Nó không nói lỗi của provider đến từ đâu và có hình dạng gì, không nói có caller thứ hai của tập tham số hay không, không nói có gì duyệt tập provider không, và không nói mỗi file nằm ở làn nào. Những thứ đó shape không giải quyết, và từng thứ phải được thu thập làm bằng chứng trước khi gán mã.

```text
value: the grading lane arguments
origin: internal caller
situation: TYPE-3
shape: ValidateGradingLaneParams, declared in the module's types/ folder and destructured at the signature
narrowing: none
lane: product
reason: the type has a name a second caller can import and index — NonNullable<ValidateGradingLaneParams["provider"]> is writable, which an inline type cannot be. It is not TYPE-1 because an inline type here was still fully checked; the fact that excludes TYPE-1 is that nothing was unchecked, only unreferenceable
```

```text
value: the error thrown by the model provider
origin: provider SDK
situation: TYPE-1
shape: unknown at entry, narrowed to a status and a retry hint before any property is read
narrowing: typeof and instanceof checks, one visible narrowing before the first concrete read
lane: product
reason: after the narrowing the compiler still knows the read is guarded; an any here would have left every derived value unchecked. It is not TYPE-2 because no cast lands on a concrete type — the fact that excludes TYPE-2 is that nothing here claims to be T
```

```text
value: the model provider identifier
origin: stored column
situation: TYPE-4
shape: a plain enum that keeps its runtime object
narrowing: a coercion that matches a stored string against Object.values of the enum
lane: product
reason: the stored value is reverse-mapped back to a member and the enum is passed as a value into the coercion, which a const enum makes impossible. It is not TYPE-5 because the providers are one axis of values with no per-branch data — the fact that excludes TYPE-5 is that no branch carries fields the others do not
```

```text
value: the grading result
origin: internal caller
situation: TYPE-5
shape: a kind-discriminated union of pending, graded and failed
narrowing: the discriminant
lane: product
reason: the three states that exist are the only three that can be written; a bag of isPending / isGraded / isFailed plus an optional score would have compiled in thirteen states that do not exist. It is not TYPE-4 because graded carries a score the other branches do not — the fact that excludes TYPE-4 is per-branch data
```

```text
value: a deliberately partial collaborator built to prove the handler only touches what it declares
origin: internal caller
situation: TYPE-6
shape: jest.Mocked<Pick<…>>, with no eslint-disable comment on any line
narrowing: none
lane: spec
reason: the exit is declared once at the lane by the rule's isTestFile predicate, so every place it is in force is derivable from that one function. It is not TYPE-2 because the spec lane was never inside TYPE-2's scope — the fact that excludes TYPE-2 is the lane, not the line
```

## Phạm vi

Quy tắc này đúng cho mọi code cùng loại trong stack này: bất kỳ back end nào được biên dịch bởi một hệ kiểu cấu trúc có cửa thoát trong đó, viết bằng TypeScript thông thường trong một ứng dụng dạng NestJS. Nó không nêu tên sản phẩm, repository, tính năng hay khoá học nào. Bốn rule id là những danh từ riêng duy nhất trong chính điều luật, vì một rule id là một danh tính cưỡng chế và một rule bị đổi tên thì không trích dẫn được trong config. Đường dẫn repository chỉ xuất hiện ở `Điểm neo` và không ở đâu khác — một điểm neo bắt buộc phải là một đường dẫn thật, và đó chính là thứ làm nó thành điểm neo.

MỘT ĐỊNH DANH ĐÃ SHIP KHÔNG PHẢI LÀ TÊN SẢN PHẨM THEO NGHĨA NÀY. Một rule được trích dẫn bằng tên đã công bố của nó, kèm cả prefix của plugin, vì đó là đúng chuỗi ký tự mà log build in ra và một comment disable mang theo. Một trích dẫn không dán được vào ô tìm kiếm thì không phải trích dẫn. Điều mà lệnh cấm ở trên cấm là VĂN XUÔI và VÍ DỤ cần một sản phẩm mới hiểu được — chứ không bao giờ là một định danh mà ai đó sẽ đọc thấy trong một lần lỗi và phải đi tra.
