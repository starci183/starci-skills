---
id: be-lints-transport-audit
title: audit.md
slug: /be/lints/transport/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện phần cưỡng chế của luật cửa vào — hai quy tắc giữ được gì, và bỏ trống chỗ nào.
---

# audit.md

> Version: `2.00` · Mô-đun: `transport`

Phản biện này kiểm một câu hỏi duy nhất: **máy giữ được bao nhiêu phần của luật cửa vào, và phần
không giữ được đã được nói ra chưa.**

## Verdict

Chấp nhận, có bảo lưu.

Hai quy tắc đúng như những gì chúng làm được: một phép thử đường dẫn thì gần như không thể sai, và
việc đọc lý do **từ tệp** thay vì từ một danh sách được duyệt sẵn là lựa chọn kiến trúc đúng — một
danh sách như thế mục ngay lần đầu có người thêm route rồi quên cập nhật.

Bảo lưu nằm ở chỗ khác. Phần "bằng chứng đọc từ tệp" hiện được cài bằng **so khớp văn bản thô trên
toàn bộ nội dung tệp**, mà văn bản thô thì không phân biệt được **dùng** với **nhắc tới**. Hệ quả là
lý do mạnh nhất trong bốn trường hợp của luật — "byte, không phải trường" — cũng là lý do dễ giả mạo
nhất, và giả mạo được **mà không cần cố ý**: một chú thích còn sót hay một import bỏ quên là đủ.

Nguồn công bố **đúng hai** quy tắc trong `rules` và **đúng hai** trong `recommended`, hai danh sách
khớp nhau. Con số này trùng với con số dự kiến; không có quy tắc nào bị đếm thiếu hay đếm thừa.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| Cửa REST có lý do so với cửa REST tiện tay | Phân định được, **nếu** bằng chứng là route hoặc đường dẫn. Không phân định được khi bằng chứng là văn bản tệp |
| Cửa đúng tầng so với cửa đậu giữa năng lực | Phân định được sạch. Một phép thử đường dẫn, không có chỗ để lý luận |
| `TRANSPORT-2` so với `TRANSPORT-3` | Hai quy tắc độc lập, không quy tắc nào miễn cho quy tắc nào. Đúng như luật |
| Một cửa so với nhiều cửa trong một tệp | **Không phân định được.** Bằng chứng tính theo tệp; cửa thứ hai luôn đi nhờ |
| Route dạng chuỗi literal so với mọi dạng route khác | Chỉ dạng thứ nhất đọc được. Ba lý do dựa trên route im lặng biến mất ở mọi dạng còn lại |
| Cửa REST so với cửa nói giao thức khác | **Không phân định được.** Chỉ `@Controller` được nhận ra |
| Ứng dụng chính so với ứng dụng riêng | **Không phân định được.** Cổng chặn không biết ranh giới mà luật đã vạch |

## Findings

1. **`TRANSPORT-1` không có quy tắc nào giữ.** Luật nói cửa mặc định là GraphQL; không có gì báo động
   khi một thao tác lẽ ra là query được viết thành route. Trên thực tế `rest-door-needs-a-reason`
   che được phần lớn, vì một cửa REST không lý do sẽ bị bắt — nhưng nó chỉ bắt được cửa mang
   `@Controller`. Một cửa nói giao thức khác đi qua cả ba mã.
2. **Thông điệp `unjustified` kể bốn lý do, trong khi nguồn chấp nhận năm.** Lý do probe được chấp
   nhận trong im lặng. Người đọc thông báo lỗi không học được rằng một route kiểm tra sống cũng hợp
   lệ, nên họ sẽ hoặc bỏ probe đi, hoặc tắt cảnh báo.
3. **`door-lives-in-features` rộng hơn luật.** Luật miễn một ứng dụng riêng tự lắp cửa của nó; cổng
   chặn khớp **mọi** đường dẫn chứa `/src/modules/`, kể cả của ứng dụng riêng đó. Đây là báo oan có
   hệ thống, và báo oan có hệ thống là cách nhanh nhất để một bộ quy tắc bị tắt cả cụm.
4. **`door-lives-in-features` hẹp hơn cái tên của nó.** Tên nói "cửa"; chú thích trong nguồn nói
   thẳng "một cửa là một cửa, bất kể giao thức"; thứ nó kiểm là đúng một decorator REST. Đây là quy
   tắc duy nhất trong mô-đun có hành vi thật lệch khỏi cái tên hứa, và lệch theo chiều nguy hiểm:
   người đọc tin rằng tầng đã được giữ.
5. **Bằng chứng "byte" và "vận hành" đọc trên văn bản thô toàn tệp.** Chú thích, import thừa, chuỗi
   trong bảng cấu hình, tên biến — tất cả đều tính. Không có bước nào phân biệt định danh đang được
   dùng với định danh chỉ được nhắc tới.
6. **Bằng chứng tính theo tệp, không theo decorator.** Hai controller trong một tệp thì cái sau đi
   nhờ lý do của cái trước, và không có thông điệp nào được sinh ra để ai đó nhìn thấy.
7. **Bằng chứng đường dẫn tính trên đường dẫn tuyệt đối.** Một thư mục tổ tiên tên chứa `webhook`,
   hay một đoạn `health/` bất kỳ, cấp lý do cho toàn bộ cây bên dưới. Tên thư mục là thứ rẻ nhất
   trong một kho mã để thay đổi, và ở đây nó là bằng chứng kiến trúc.
8. **`routeOf` chỉ đọc `Literal` chuỗi.** Template literal, hằng số, phép nối chuỗi và dạng object
   `{ path: "…" }` đều thành `""`. Ba lý do dựa trên route chết theo, nên những cửa **đúng luật**
   viết ở các dạng đó bị báo oan.
9. **Route ở cấp phương thức không bao giờ được đọc.** Một webhook thật khai `@Controller()` rỗng và
   đặt route ở `@Post` sẽ bị báo oan.
10. **Không có làn kiểm thử.** Khác với các mô-đun cưỡng chế khác trong cây này, spec và fixture
    không được miễn. Đây có thể là chủ ý, nhưng nguồn không nói ra, nên nó là một khoảng lặng chứ
    chưa phải một quyết định.
11. **Hai quy tắc nhất quán về hình thức.** Cả hai `meta.type: "problem"`, cả hai `schema: []`, cả
    hai `error` trong `recommended`, cả hai chuẩn hoá dấu gạch ngược trước mọi phép thử đường dẫn.
    Không có drift giữa `rules` và `recommended`.

## Decisions

- Giữ đúng hai quy tắc, hai tên đã công bố. **Tên là danh tính**; không đặt thêm mã số cho quy tắc.
- Giữ nguyên tắc "bằng chứng đọc từ tệp". Vấn đề nằm ở **cách đọc**, không nằm ở nguyên tắc.
- Ghi `TRANSPORT-1` là **không được cưỡng chế**, thay vì gán nó cho `rest-door-needs-a-reason` cho
  đủ bảng. Một ánh xạ bịa ra còn tệ hơn một ô trống, vì nó làm người đọc tin rằng đã có người canh.
- Ghi cả hai chiều sai số: đi lọt (mục "Cửa còn mở" của `INDEX.md`) và báo oan (mục **BÁO OAN** của
  `example.md`). Một bộ quy tắc chỉ đo bằng số lần bắt được là bộ quy tắc sắp bị tắt.
- Không đề xuất quy tắc mới trong tài liệu này. Một quy tắc chưa tồn tại thì không được viết vào
  shelf cưỡng chế; nó nằm ở mục dưới đây, đúng chỗ của một đề xuất.

## Rủi ro còn mở

Mỗi mục ghi **quy tắc phải nhìn thêm cái gì** thì mới đóng được cửa — hoặc vì sao đóng thì đắt hơn
để mở.

- **Văn bản thô không phân biệt dùng với nhắc tới.** Để đóng, phép thử "byte" và "vận hành" phải
  chuyển từ so khớp chuỗi sang duyệt AST: `FileInterceptor` phải là một `CallExpression` bên trong
  một `Decorator` là `UseInterceptors`; `StreamableFile` phải là callee của một `NewExpression`;
  `@Res` phải là một decorator tham số; guard phải là một tham số của `UseGuards`. Việc này khả thi
  trong một tệp và không cần thông tin kiểu. **Nên đóng.** Đây là cửa mở nghiêm trọng nhất của
  mô-đun.
- **Bằng chứng theo tệp thay vì theo cửa.** Để đóng, lý do phải tính trong phạm vi **lớp mang
  decorator**, không phải toàn tệp: duyệt từ node `Decorator` lên `ClassDeclaration` cha rồi chỉ xét
  thân lớp đó. Chi phí thấp, và nó xoá luôn cửa "cửa thứ hai đi nhờ". **Nên đóng cùng lúc với mục
  trên**, vì cả hai là cùng một thay đổi: đọc cây thay vì đọc chuỗi.
- **Đường dẫn tuyệt đối cấp lý do cho cả cây con.** Để đóng, phép thử đường dẫn phải chạy trên đường
  dẫn **tương đối tính từ gốc kho mã**, hoặc chỉ trên **tên tệp**. Đóng bằng tên tệp là rẻ nhất và
  vẫn giữ đúng ý định của luật ("tên tệp nói `webhook`"). **Nên đóng.**
- **Tiền tố route là toàn bộ bằng chứng của lý do "máy" và "vận hành".** Để đóng thật, quy tắc phải
  chứng minh rằng cửa đó **không** dùng guard phiên người dùng — tức là phải biết mọi guard nào là
  guard phiên, và điều đó là một danh sách. **Không nên đóng bằng máy.** Đây là chỗ luật cố ý giao
  lại cho người đọc, và một danh sách guard sẽ mục đúng như danh sách route mà luật đã từ chối.
  Ghi lại là đủ.
- **`routeOf` chỉ đọc `Literal` chuỗi, gây báo oan.** Để đóng, cần đọc thêm hai hình dạng có thể
  quyết định tĩnh: `TemplateLiteral` không có biểu thức nội suy, và `ObjectExpression` có thuộc tính
  `path` là chuỗi. Hằng số và phép nối chuỗi thì không giải được nếu không đi theo import. **Nên
  đóng hai hình dạng đầu**; hai hình dạng sau để nguyên và ghi là giới hạn đã biết.
- **Route ở cấp phương thức không được đọc.** Để đóng, phải gom route lớp với mọi route phương thức
  trong lớp rồi thử lý do trên từng chuỗi ghép. Khả thi, chi phí trung bình. **Nên đóng** cùng lần
  chuyển sang phạm vi lớp.
- **Chỉ `@Controller` được nhận ra, trong khi luật định nghĩa cửa rộng hơn.** Để đóng, cả hai quy
  tắc phải thêm `@WebSocketGateway`, `@MessagePattern`, `@EventPattern` và `@Resolver` vào tập
  decorator chúng thăm — và với `rest-door-needs-a-reason` thì còn phải trả lời một câu hỏi luật
  chưa trả lời: **một socket gateway cần lý do gì để được phép tồn tại?** Bảng bốn trường hợp hiện
  viết cho REST. **Đây là thay đổi luật trước, thay đổi quy tắc sau**, không phải một lần sửa mã.
- **`door-lives-in-features` rộng hơn luật ở `apps/*`.** Để đóng, cổng chặn cần một điều kiện loại
  trừ cho đường dẫn có `/apps/`. Rẻ, một dòng. **Nên đóng** — báo oan có hệ thống là thứ đắt nhất
  trong tài liệu này, vì cái giá không phải một lỗi mà là niềm tin vào cả bộ quy tắc.
- **Đổi tên thư mục `modules/` làm quy tắc biến mất.** Không đóng được bằng một phép thử đường dẫn —
  nếu tên tầng là bằng chứng thì đổi tên tầng là thoát. Đóng thật đòi một khai báo tầng ở nơi khác
  (một tệp manifest, hoặc một quy ước hậu tố tệp), tức là đúng cái danh sách mà luật đã từ chối.
  **Không đóng.** Ghi lại và dựa vào review khi ai đó đổi tên thư mục.
- **Đổi tên decorator khi import, hoặc gọi qua `MemberExpression`, làm cả hai quy tắc im.** Để đóng,
  quy tắc phải khớp **binding của import** thay vì định danh cục bộ — đọc được từ phạm vi trong một
  tệp, nên khả thi. **Nên đóng**, chi phí thấp, và nó bịt một cửa mà một người đang vội có thể mở
  bằng một dòng mà không ai thấy trong diff.
- **Cửa REST đăng ký tay ngoài một lớp** (`app.getHttpAdapter().get(…)`, middleware gắn thẳng). Để
  đóng, quy tắc phải nhận ra một tập lời gọi trên đối tượng ứng dụng, và tập đó phụ thuộc framework
  và mở rộng theo thời gian. **Không đóng bằng mô-đun này.** Nếu cần, đây là một quy tắc riêng với
  tên riêng, không phải một nhánh nhét thêm vào hai quy tắc hiện có.
- **`// eslint-disable`.** Không đóng được, và không nên đóng: quyền tắt một cảnh báo là quyền của
  người viết mã. Cái đóng nó là review, và điều kiện để review làm được là dòng tắt phải kèm lý do.

## Re-audit Triggers

- Nguồn công bố thêm hoặc bớt một quy tắc, hoặc `rules` và `recommended` lệch nhau.
- Danh sách sáu định danh của phép thử "byte" hoặc ba định danh của phép thử "vận hành" thay đổi.
- Bảng bốn trường hợp trong luật thay đổi, hoặc lý do probe được đưa vào bảng.
- Một cửa nói giao thức khác (socket, hàng đợi) được đưa vào phạm vi luật.
- Có ai đó thêm một lý do mới đọc bằng so khớp văn bản thô — đúng cơ chế đã sinh ra cửa mở nặng nhất
  của phiên bản này.
- Có một tệp chứa nhiều hơn một `@Controller` được chấp nhận trong review.
- Có một dòng `eslint-disable` cho một trong hai quy tắc xuất hiện trong mã sản xuất.
- Thư mục `modules/` hoặc `features/` được đổi tên, hoặc một ứng dụng riêng mọc thêm thư mục
  `src/modules/` của nó.
