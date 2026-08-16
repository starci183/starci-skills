---
id: be-lints-transport-vi
title: vi.md
slug: /be/lints/transport/vi
sidebar_label: vi.md
sidebar_position: 1
description: Hai quy tắc giữ luật cửa vào — bắt gì, nhìn bằng gì, và cửa nào còn mở.
---

# vi.md

> Version: `2.00` · Mô-đun: `transport`

# Hai quy tắc giữ luật cửa vào

Luật nói hai câu. Một: **một cửa REST chỉ được phép tồn tại ở chỗ GraphQL không đi được, và chính tệp
đó phải cho thấy nó thuộc trường hợp nào.** Hai: **một cửa là một cửa, bất kể nó nói giao thức gì, và
mọi cửa đều nằm cùng một tầng trên đĩa.**

Tài liệu này không nhắc lại luật. Nó ghi lại **phần cưỡng chế**: máy nhìn thấy gì trong một tệp, nhìn
bằng cơ chế nào, và — phần thường không ai viết ra — cách viết nào đi lọt qua máy mà không bị chạm
tới.

Tên quy tắc chính là **danh tính** của nó. Không có mã số riêng cho quy tắc, vì tên đó mới là chuỗi
in ra trong log build, trong dòng tắt cảnh báo và trong mọi cuộc trao đổi về lỗi.

Điểm thiết kế đáng nói: **không quy tắc nào tra một danh sách.** Lý do một cửa REST được phép được
đọc thẳng từ chuỗi route, từ đường dẫn tệp và từ chính văn bản của tệp — đúng thứ bằng chứng mà một
người đọc sẽ dùng. Lựa chọn đó đúng, và nó cũng là gốc của gần như mọi cửa còn mở bên dưới: bằng
chứng đọc dưới dạng văn bản thô thì không phân biệt được **dùng** với **nhắc tới**, nên một dòng chú
thích biện minh cho một cửa hệt như một interceptor thật.

## Bảng tra nhanh

| Quy tắc | Mã luật | Bắt gì |
|---|---|---|
| `rest-door-needs-a-reason` | `TRANSPORT-2` | Mọi `@Controller` trong một tệp không cho thấy dấu hiệu nào của năm lý do: probe, hệ thống ngoài, byte, máy, danh tính vận hành |
| `door-lives-in-features` | `TRANSPORT-3` | Mọi `@Controller` trong một tệp có đường dẫn chứa `/src/modules/` |

`TRANSPORT-1` — cửa mặc định là GraphQL — **không có quy tắc nào giữ**. Không có gì báo động khi một
thao tác lẽ ra là một query lại được viết thành một route. Và cả hai quy tắc chỉ nhận đúng **một**
decorator, nên một socket gateway hay một consumer hàng đợi — vốn cũng là cửa theo đúng định nghĩa
của luật — hoàn toàn vô hình. Cả hai khoảng trống nằm trong `audit.md`.

---

## `rest-door-needs-a-reason`

**Bắt gì.** Một thông điệp duy nhất, `unjustified`, bắn tại chính node decorator. Nó bắn khi tệp
chứa `@Controller` không cho thấy dấu hiệu nào trong năm lý do được chấp nhận:

| Lý do | Bằng chứng quy tắc đòi |
|---|---|
| probe | route đúng bằng `health` hoặc `healthz`, **hoặc** đường dẫn chứa một đoạn `health`/`healthz` |
| hệ thống ngoài | route **hoặc** đường dẫn chứa `webhook`, không phân biệt hoa thường |
| byte | **văn bản tệp** chứa `FileInterceptor`, `FilesInterceptor`, `AnyFilesInterceptor`, `StreamableFile`, `@Res (` hoặc `createReadStream` |
| máy | route bắt đầu bằng `pods/`, `internal/` hoặc `agents/` |
| danh tính vận hành | route bắt đầu bằng `api/ops`, **hoặc** văn bản tệp chứa một định danh dạng `Operator…Guard`, `ServiceToken`, `OPS_TOKEN` |

Năm phép thử chạy **theo thứ tự và dừng ở phép đầu tiên khớp**. Vì vậy thông điệp không bao giờ nói
lý do nào đã cứu cửa đó — nó chỉ im.

**Giữ mã nào.** `TRANSPORT-2`.

**Cách phát hiện.** Đọc `context.filename` và **toàn bộ văn bản tệp** qua `sourceCode.getText()` một
lần trong `create`. Thăm nút `Decorator`. Tên decorator lấy từ một `Identifier`, hoặc từ `callee` của
một `CallExpression` khi callee là `Identifier`; mọi hình dạng khác trả về `null`. Chuỗi route chỉ
được lấy khi `arguments[0]` là một `Literal` có `value` kiểu chuỗi — mọi hình dạng khác thành `""`.
Sau đó chạy năm phép thử ở trên; không phép nào khớp thì báo lỗi.

**Vì sao luật này đáng có máy giữ.** Đây không phải loại lỗi ai đó cố tình gây ra. Một route mới
luôn nhanh hơn một trường mới trong lược đồ — nhanh hơn đúng một lần, ngay hôm đó. Cái giá trả sau:
client phải học giao thức thứ hai, xác thực có chỗ thứ hai để đặt, và hình dạng trả về không có kiểu
sinh tự động nào phủ. Không ai từ chối được một quyết định như thế trong review, vì mỗi lần nhìn
riêng ra đều hợp lý. Cái vỡ là **hai mươi lần** như vậy, không ai ghi lại lần nào — và kết cục là hai
tầng cửa, không có ranh giới nào được phát biểu, và người đọc không phân biệt nổi một route REST là
có lý do hay là do tiện tay. Một cảnh báo lúc gõ là chỗ rẻ nhất để bắt buộc lý do phải nằm **trong
tệp**.

**Cửa còn mở.**

- **Văn bản thô rửa sạch mọi thứ.** Một dòng chú thích `// TODO: sau này đổi sang StreamableFile`,
  một `import { FileInterceptor }` bỏ quên sau lần dọn dẹp, một chuỗi `"OPS_TOKEN"` nằm trong bảng
  cấu hình — mỗi thứ đó đều đủ để biện minh cho **mọi** `@Controller` trong tệp, vĩnh viễn và không
  ai thấy.
- **Bằng chứng tính theo tệp, không theo cửa.** Hai controller trong một tệp: cái đầu stream byte,
  cái sau đọc JSON thuần. Cái sau đi nhờ lý do của cái đầu.
- **Đường dẫn tuyệt đối cũng là bằng chứng.** Bất kỳ thư mục tổ tiên nào tên có chứa `webhook`, hay
  bất kỳ đoạn `health/` nào trên đường dẫn, đều biện minh cho mọi controller nằm dưới nó, sâu bao
  nhiêu cũng được.
- **Tiền tố route là toàn bộ bằng chứng của lý do "máy" và "vận hành".** `@Controller("internal/reports")`
  cho một truy vấn người dùng bình thường vẫn im. Không có gì kiểm rằng ở đó thật sự không có phiên
  người dùng nào được mang theo.
- **`@Controller("healthz")` trả về dữ liệu nghiệp vụ** vẫn im: phép thử probe so đúng chuỗi route,
  không ai nhìn handler trả về gì.
- **Decorator viết dưới dạng khác thì quy tắc không tồn tại.** `@Nest.Controller(…)` là một
  `MemberExpression`; `import { Controller as Route }` rồi `@Route(…)` là một định danh khác;
  `const Door = Controller` cũng vậy. Cả ba đều im hoàn toàn.
- **Cửa không có decorator thì không có gì để thăm.** Một handler đăng ký tay trong tệp khởi động —
  `app.use(…)`, `server.get("/api/theme", …)` — là một cửa REST đầy đủ mà quy tắc không bao giờ chạy
  qua.
- **Route không phải chuỗi literal thì mất luôn ba lý do dựa trên route.** Template literal, hằng
  số, phép nối chuỗi, hay dạng object `{ path: "…" }` đều thành `""`. Đây là cửa mở theo chiều
  ngược: một cửa **đúng luật** bị báo sai, và cách sửa nhanh nhất mà người ta sẽ chọn là tắt cảnh
  báo.
- **Route ở cấp phương thức không bao giờ được đọc.** `@Controller()` rỗng cộng `@Post("webhook/…")`
  ở phương thức là một webhook thật, và quy tắc báo lỗi nó.
- **`// eslint-disable-next-line`.** Không quy tắc nào ở đây là không tắt được.

---

## `door-lives-in-features`

**Bắt gì.** Một thông điệp duy nhất, `wrongTree`, bắn tại chính node decorator, cho **mọi**
`@Controller` nằm trong một tệp có đường dẫn chứa `/src/modules/`. Không có ngoại lệ nào bên trong:
route là gì, tệp tên gì, lớp tên gì, có lý do `TRANSPORT-2` hợp lệ hay không — không thứ nào được
hỏi tới.

**Giữ mã nào.** `TRANSPORT-3`.

**Cách phát hiện.** Cổng chặn ở cấp tệp chạy trước: `/\/src\/modules\//` so với `context.filename`
đã chuẩn hoá dấu gạch. Không khớp thì trả về **visitor rỗng** — tệp đó không được kiểm một phần nào
cả. Khớp thì thăm `Decorator`, đòi tên là `Controller`, rồi báo lỗi ngay.

**Vì sao luật này đáng có máy giữ.** Vì cái sai ở đây không nhìn thấy được ở quy mô một tệp. Một
controller đặt cạnh những năng lực mà nó gọi thì **đọc lên như một năng lực** và bị import như một
năng lực; một tệp như vậy không có gì bất thường khi mở ra xem. Chỉ tới lúc có người hỏi "cửa vào của
hệ thống này nằm ở đâu" mới lộ ra là câu trả lời có hai chỗ, và không chỗ nào giải thích vì sao. Đây
đúng là loại luật con người bỏ sót còn máy giữ gần như miễn phí: một phép thử đường dẫn.

**Cửa còn mở.**

- **Đổi tên thư mục là tắt quy tắc.** `src/modules/` thành `src/services/`, `src/domains/` hay
  `src/capabilities/` — tầng vẫn còn nguyên, cửa vẫn đậu sai chỗ, quy tắc biến mất. Cấm một **thư
  mục** không phải cấm một **tầng**.
- **Chỉ `@Controller` được nhận ra.** Tên quy tắc nói "cửa", chú thích trong nguồn cũng nói "một cửa
  là một cửa, bất kể giao thức" — nhưng thứ nó kiểm chỉ là một decorator REST. `@Resolver`,
  `@WebSocketGateway`, `@MessagePattern`, `@EventPattern` nằm dưới `src/modules/` đều đi qua sạch sẽ.
  Đây là chỗ **hành vi thật hẹp hơn cái tên hứa** rõ nhất trong mô-đun này.
- **Cùng ba cách viết decorator ở trên** — `MemberExpression`, đổi tên khi import, gán qua biến —
  cũng làm quy tắc này im.
- **Cổng đòi một dấu gạch đứng trước `src`.** Đường dẫn tuyệt đối luôn có, nên khe này hẹp; nhưng nó
  là một phụ thuộc vào **cách trình chạy đặt tên tệp**, không phải vào vị trí thật của tệp.
- **`// eslint-disable-next-line`.**

**Chiều ngược lại cũng có sai số.** Luật nói phần này chỉ ràng buộc `src/modules/**`, và một ứng dụng
riêng tự lắp cửa của nó thì không thuộc phạm vi. Cổng chặn lại khớp **mọi** đường dẫn chứa
`/src/modules/`, kể cả của một ứng dụng riêng. Quy tắc rộng hơn luật ở đúng chỗ đó; xem `audit.md`.

## Luật

1. Cửa mặc định là GraphQL. Một thao tác nhận trường và trả về trường là một mutation hoặc một query,
   không có câu hỏi thứ hai.
2. `@Controller` chỉ được phép ở chỗ GraphQL không phục vụ được, và **tệp phải cho thấy** đó là
   trường hợp nào: hệ thống ngoài gọi vào một URL cố định; byte chứ không phải trường; một máy tự
   đăng ký, không mang phiên người dùng; một danh tính không phải phiên người dùng.
3. Một probe kiểm tra sống là thứ duy nhất nằm ngoài bảng bốn trường hợp, vì nó phải trả lời được
   khi ứng dụng đang suy yếu.
4. Bằng chứng đọc **từ tệp**, không đọc từ một danh sách được duyệt sẵn.
5. Một cửa nằm ở tầng cửa, bất kể giao thức của nó.

## Ngoại lệ

Mọi ngoại lệ dưới đây **nằm bên trong quy tắc**, không phải được cấp bên ngoài nó.

- **Năm lý do chính là ngoại lệ.** Ngoài chúng ra không có miễn trừ nào trong
  `rest-door-needs-a-reason`.
- **Thông điệp nói "bốn" trong khi có năm lối ra.** Lý do probe được chấp nhận trong im lặng, nên
  người đọc thông báo lỗi sẽ không học được rằng một route kiểm tra sống cũng hợp lệ.
- **Phép thử đầu tiên khớp thì dừng.** Không có chỗ nào ghi lại lý do nào đã cứu một cửa.
- **Mọi thứ ngoài `/src/modules/` được miễn `door-lives-in-features`** — kể cả một ứng dụng riêng có
  thư mục `src/modules/` của chính nó, thứ mà luật miễn còn cổng chặn thì không.
- **Không có làn kiểm thử.** Một `@Controller` dựng tạm trong spec hay fixture bị báo như mọi cửa
  thật.
