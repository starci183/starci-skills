---
title: Transport · Vietnamese
---

# Cửa vào hệ thống

Đầu vào của pattern này là một shape đã được duyệt — một năng lực, một hợp đồng, một thao tác mà sản
phẩm đã đồng ý mở ra. Việc nó nên tồn tại là chuyện đã khép lại và pattern này không mở lại. Đầu ra
là kiến trúc source: cửa ấy nói giao thức nào, file nào giữ nó, file ấy nằm dưới thư mục nào, và
token nào trong chính file chứng minh lựa chọn đó.

## Luật

**Cửa** là bất kỳ file nào mà thế giới bên ngoài có thể chạm tới: một resolver, một controller, một
socket gateway, một broker consumer. Module này chỉ giải **một** câu hỏi về cửa: **khi nào một cửa
được phép không phải GraphQL** — cùng với việc câu trả lời ấy nằm ở đâu trên đĩa.

Câu hỏi này quan trọng vì đáp án gần như luôn là "không được". Mặt sản phẩm là một schema GraphQL
code-first; client nào nói chuyện được với nó thì đã cầm sẵn một GraphQL client, một schema, một bộ
type sinh ra và đúng một endpoint. Mỗi route REST dựng thêm bên cạnh là một giao thức thứ hai cũng
client ấy phải học, một chỗ thứ hai để đặt xác thực, và một hình dáng mà không type sinh ra nào phủ.
Cái giá đó chỉ đáng trả khi GraphQL **không làm nổi** việc — không bao giờ chỉ vì viết một route thì
nhanh tay hơn.

Thứ luật này ngăn không phải là một controller tồi. Nó là dáng vẻ của một codebase sau hai mươi lần
quyết định theo từng ca mà không ai ghi lại: hai tầng cửa, không có ranh giới nào được nói ra, và
người đọc sau không cách nào biết một route là REST vì có lý do hay vì tình cờ. Đo vào lúc bản luật
phẳng được viết: mười lăm trong mười tám cửa có lý do nhìn thấy được ngay trong file, ba cái thì
không — nên thiết kế phần lớn là mạch lạc mà **trông** như một mớ hỗn độn, tức là tệ cả hai bề.

**Đây là luật bắt buộc, không phải lời khuyên.** Mỗi cửa mang đúng một mã tình huống bên dưới, và
không có cửa nào nhỏ đến mức được miễn. Câu "chỉ là một endpoint thôi mà" chính là chỗ luật này bị bỏ
qua nhiều nhất — và hai mươi lần như vậy đúng là mớ hỗn độn mà luật sinh ra để ngăn.

## Mã tình huống

Mọi tình huống module này quản đều mang một mã, `TRANSPORT-<n>`. Các số là cố định và được trích dẫn
từ những file luật khác cũng như từ hồ sơ công việc; một mã giữ nguyên số và nguyên nghĩa của nó
chừng nào nó còn tồn tại.

| Mã | Tình huống | Source phải trông như thế nào |
|---|---|---|
| `TRANSPORT-1` | Một thao tác nhận field và trả lời bằng field | Nó được khai báo là mutation hoặc query. Không có giao thức thứ hai chọn cho tiện; không có cửa nào bị lý luận ra khỏi schema mà thiếu một lối ra trong `TRANSPORT-2` |
| `TRANSPORT-2` | Một cửa **không thể** là GraphQL | Một `@Controller` mà chính file của nó nói ra nó đi lối nào trong bốn lối: một hệ thống ngoài post vào một URL ta phát ra, byte chứ không phải field, một cỗ máy không mang phiên người dùng nào, hoặc một danh tính không phải phiên người dùng. Cấm một controller không chỉ ra được lối nào, và cấm luôn cái lý do nằm trong sổ đăng ký, allow-list hay tài liệu thay vì nằm trong file |
| `TRANSPORT-3` | Một cửa, bất kể giao thức gì | Nó nằm dưới `features/`. Không có `@Controller` nào dưới `modules/**`, nơi nó đọc như một năng lực rồi bị import như một năng lực |

`TRANSPORT-1` VÀ `TRANSPORT-2` LÀ MỘT QUYẾT ĐỊNH NHÌN TỪ HAI PHÍA, KHÔNG PHẢI HAI QUYẾT ĐỊNH.
`TRANSPORT-1` nói mặc định, `TRANSPORT-2` nói danh sách đầy đủ các lối ra khỏi mặc định ấy. Chúng là
hai mã vì chúng hỏng theo hai kiểu: `TRANSPORT-1` hỏng khi không ai đặt câu hỏi, còn `TRANSPORT-2`
hỏng khi có người đặt câu hỏi rồi để câu trả lời nằm ngoài file.

Bốn lối ra trong `TRANSPORT-2` là một danh sách **đóng**. Cửa nào không khớp lối nào thì không được
cãi — nó vào schema. Liveness probe (`health`, `healthz`) là thứ duy nhất đứng ngoài bốn lối, vì nó
phải trả lời được khi ứng dụng đang hỏng, thậm chí trước cả lúc tầng feature kịp lên.

## Đọc một shape đã duyệt

1. Đọc xem shape nói gì. Nó nói ra một thao tác, payload của thao tác ấy, người gọi và danh tính mà
   request mang theo — đủ để gọi tên cửa và việc nó làm.
2. Ghi lại những gì shape **không** nói, và do đó không giải. Một shape đã duyệt không chọn giao
   thức, không chọn thư mục, và không cấp cho ta cái token trong file sẽ chứng minh lựa chọn. Những
   thứ ấy là đầu ra của pattern này, không phải của shape.
3. Giải từ ngoài vào trong: địa chỉ trước, giao thức sau. `TRANSPORT-3` được quyết chỉ bởi việc đây
   là một cửa, nên nó chốt trước cả khi ta biết cửa này có phải REST hay không; sau đó `TRANSPORT-1`
   và `TRANSPORT-2` mới chốt giao thức.
4. Hỏi đúng câu hỏi của từng mã. `TRANSPORT-3`: có thứ gì ngoài tiến trình này chạm được vào file
   không? Nếu có thì nó là cửa, và cửa nằm dưới `features/`. `TRANSPORT-2`: có lối nào trong bốn lối
   áp vào không, và bằng chứng có đọc được ngay trong chính file không? `TRANSPORT-1`: nếu không chỉ
   ra được lối ra nào thì mặc định thắng và thao tác vào schema.
5. Khi hai mã cùng khớp thì chúng không mâu thuẫn — chúng trả lời hai câu hỏi khác nhau và một file
   phải thoả cả hai. `TRANSPORT-3` quyết địa chỉ, còn `TRANSPORT-1`/`TRANSPORT-2` quyết giao thức;
   một webhook hoàn toàn chính đáng theo `TRANSPORT-2` vẫn trượt `TRANSPORT-3` nếu nó nằm trong
   `modules/`. Giữa `TRANSPORT-1` và `TRANSPORT-2` thì không bao giờ có hoà: chúng là một quyết định
   nhìn từ hai phía, và nếu không chỉ ra được lối ra nào thì `TRANSPORT-1` thắng.

## `TRANSPORT-1` — cửa mặc định là GraphQL

**Tình huống.** Một thao tác nhận vào các field và trả lời bằng các field. Nó là một mutation hoặc
một query. Không có câu hỏi thứ hai để hỏi.

**Nó sinh ra gì trong source.** Một `@Resolver` nằm dưới `features/`, khai báo một mutation hoặc một
query trong schema code-first. Không controller, không endpoint thứ hai, không route song song.

**Dấu hiệu nhận biết.** Payload vào là JSON có cấu trúc; payload ra là JSON có cấu trúc. Người gọi là
client sản phẩm — thứ đã cầm sẵn schema và bộ type sinh ra. Danh tính đi kèm request là một phiên
người dùng bình thường. Không có byte nào, không có máy nào, không có ai posting tới URL ta phát ra.

**Ranh giới.** Đây không phải `TRANSPORT-2`: nó là cùng một quyết định nhìn từ phía bên kia.
`TRANSPORT-1` nói mặc định, `TRANSPORT-2` nói danh sách lối ra khỏi mặc định ấy; nếu không chỉ ra
được một lối ra thì không có lối ra. Nó cũng không phải `TRANSPORT-3` — `TRANSPORT-1` chọn **giao
thức**, `TRANSPORT-3` chọn **địa chỉ**, và trả lời đúng câu này không miễn cho ta câu kia. Những lý
do không được tính là lý do: "REST test bằng curl cho nhanh" là tiện cho người viết, không phải giới
hạn của GraphQL; "bên tích hợp quen REST hơn" không đứng được nếu bên đó là client sản phẩm, vì nó đã
có schema rồi; "chỉ là một endpoint nhỏ" đúng hai mươi lần thì thành hai tầng cửa; "đang gấp, mai
refactor" quên mất rằng route sống lâu hơn cái deadline sinh ra nó.

**Tình huống nghiệp vụ hay gặp.** Đọc hồ sơ · cập nhật cài đặt · liệt kê đơn hàng có phân trang · tạo
bản nháp · huỷ đăng ký · đổi mật khẩu qua phiên hiện tại · tìm kiếm có bộ lọc · đếm số liệu tổng quan.

## `TRANSPORT-2` — cửa REST chỉ ở chỗ GraphQL không tới được

**Tình huống.** GraphQL **không làm nổi** việc, và file phải tự nói ra nó thuộc ca nào. Bốn ca, không
có ca thứ năm.

**Nó sinh ra gì trong source.** Một `@Controller` nằm dưới `features/`, mang ngay trong file cái
token chỉ ra lối ra của nó:

| Ca | Nhìn thấy gì trong file | Vì sao GraphQL không tới được |
|---|---|---|
| **hệ thống ngoài post vào một URL ta phát ra** | route hoặc tên file có chữ `webhook` | một cổng thanh toán post vào một URL cố định. Nó sẽ không bao giờ gửi một GraphQL document, và ta không có quyền yêu cầu nó gửi |
| **byte, không phải field** | `FileInterceptor`, `StreamableFile`, `@Res(`, `createReadStream` | upload multipart và download dạng stream. GraphQL chở JSON |
| **một cỗ máy tự đăng ký** | route bắt đầu bằng `pods/`, `internal/`, `agents/` | một pod gọi về lúc khởi động không mang theo phiên người dùng nào cả |
| **một danh tính không phải phiên người dùng** | route bắt đầu bằng `api/ops`, hoặc file dùng guard operator / service token | một operator nền tảng hay một service token là **chủ thể khác** với người dùng của sản phẩm; treo nó lên cùng một guard là mở đường cho quản trị viên của một tenant vận hành cả nền tảng |

**Dấu hiệu nhận biết.** Bằng chứng đọc được **ngay trong file**, không phải trong một tài liệu nào
khác. Bỏ dòng bằng chứng ấy đi thì không còn ai biết vì sao cửa này không phải GraphQL. Hỏi thẳng:
nếu người đọc tiếp theo chỉ mở đúng file này, họ có thấy được lý do không? Nếu phải hỏi người khác thì
lý do chưa nằm trong file, và luật coi như chưa có lý do. Bằng chứng đọc từ file, không đọc từ sổ đăng
ký: một danh sách route "đã được duyệt" mục ngay lần đầu có người thêm route rồi quên cập nhật, và nó
cho phép một cửa được biện minh bằng **một tài liệu** thay vì bằng **việc nó làm**. Sổ đăng ký còn tạo
ra một trạng thái tệ hơn cả không có: một route sai nằm trong sổ trông y hệt một route đúng.

**Ranh giới.** Đây không phải `TRANSPORT-1`: xem trên — không chỉ được ca nào thì mặc định thắng. Nó
cũng không phải `TRANSPORT-3`: một cửa REST đúng luật `TRANSPORT-2` vẫn có thể nằm sai chỗ. Hai mã
kiểm hai chuyện khác nhau và một file có thể qua cái này, trượt cái kia. Thứ duy nhất đứng ngoài bốn
ca là liveness probe: route `health` hay `healthz` phải trả lời được **khi ứng dụng đang hỏng**, có
thể trước cả lúc tầng feature kịp lên, và một probe cần tầng feature sống mới chạy được thì không bao
giờ báo được rằng tầng feature đã chết.

**Tình huống nghiệp vụ hay gặp.** Webhook cổng thanh toán · webhook thông báo bucket lưu trữ · upload
ảnh đại diện · tải hoá đơn PDF · phát video theo range · pod đăng ký lúc boot · agent xin cấu hình ·
bảng điều khiển vận hành nội bộ · probe cho load balancer.

## `TRANSPORT-3` — cửa nào cũng nằm dưới `features/`

**Tình huống.** `modules/` giữ **năng lực** — những thứ mà cửa gọi tới. `features/` giữ **cửa**. Giao
thức chưa bao giờ là thứ quyết định địa chỉ; **việc là một cửa** mới quyết định.

**Nó sinh ra gì trong source.** File nằm dưới `features/`, bất kể nó mang gì: `@Controller`,
`@Resolver`, `@WebSocketGateway` hay một handler nhận message từ broker. Không cửa nào được viết dưới
`modules/**`.

**Dấu hiệu nhận biết.** File có `@Controller`, `@Resolver`, `@WebSocketGateway` hoặc một handler nhận
message từ broker. Nó là điểm **bắt đầu** của một request, không phải chỗ được ai đó gọi vào. Hỏi
thẳng: có thứ gì ngoài tiến trình này chạm được vào file này không? Nếu có thì nó là cửa, và cửa thì
nằm dưới `features/`. Một cửa nằm nhầm trong `modules/` rất đắt vì nó **đọc như một năng lực** rồi
**bị import như một năng lực**: module khác kéo nó vào để dùng ké service bên trong, và từ giờ xoá cái
route đó làm vỡ một thứ chẳng liên quan gì tới HTTP. Tệ hơn nữa là hai tầng cửa nằm ở hai cây khác
nhau mà không ở đâu ghi lý do — đúng cái tình trạng "trông như mớ hỗn độn" mà `TRANSPORT-1` mô tả.

**Ranh giới.** Đây không phải `TRANSPORT-2`: `TRANSPORT-2` hỏi *cửa này có được phép là REST không*,
`TRANSPORT-3` hỏi *file này nằm ở đâu*. Một webhook hoàn toàn chính đáng nằm trong `modules/` thì vẫn
sai `TRANSPORT-3`. Nó cũng không phải luật về năng lực: service, repository, adapter, client bên thứ
ba **vẫn ở** `modules/`. Luật này không kéo chúng đi đâu cả; nó chỉ kéo **cửa**.

**Tình huống nghiệp vụ hay gặp.** Resolver mutation · resolver query · controller webhook · gateway
socket · consumer đọc topic · controller phục vụ file tĩnh · controller vận hành.

## Tầng giữ

Tầng nào thật sự giữ từng mã. `unrepresentable` nghĩa là không thể viết ra giá trị sai;
`enforced` nghĩa là một rule có tên trong `@starci/eslint-canon-be` báo lỗi; `documented` nghĩa là
không có cơ chế nào giữ, chỉ có người đọc giữ.

| Mã | Tầng | Ai giữ |
|---|---|---|
| `TRANSPORT-1` | `documented` | Không có gì đếm được những thao tác lẽ ra phải tồn tại. Một rule báo được một cửa đi lối ra mà không trưng ra được lối ấy, đó là `TRANSPORT-2`; không rule nào thấy được một thao tác mà ai đó quyết định không đưa vào schema, vì sự vắng mặt của một resolver không phải là một token. |
| `TRANSPORT-2` | `enforced` | `rest-door-needs-a-reason` — báo mọi `@Controller` mà route, tên file hay nội dung file không chỉ ra được lối nào trong bốn lối và cũng không phải probe. Bằng chứng được đọc thẳng từ file, một cách cố ý, vì đó đúng là bằng chứng mà một người đọc sẽ dùng. |
| `TRANSPORT-3` | `enforced` | `door-lives-in-features` — báo mọi `@Controller` có đường dẫn chứa `/src/modules/`. Nó dựa trên hình dáng đường dẫn nên không cần biết gì về file khác và không cãi được. |

Một dòng ghi `documented`, và đó là trạng thái thật thà chứ không phải một lỗ hổng được che đi.
`TRANSPORT-1` là mã duy nhất ở đây mà vi phạm của nó là một **sự vắng mặt** — một thao tác không bao
giờ được viết vào schema vì người ta đã viết một route thay cho nó. Parser thấy những token có tồn
tại; nó không thấy được một mutation mà ai đó chọn không khai. Thứ giữ `TRANSPORT-1` trên thực tế là
rule của `TRANSPORT-2` tấn công cùng một quyết định từ đầu bên kia: cái route thay chỗ cho mutation
vẫn phải tự biện minh, và phần lớn thì không biện minh nổi.

Tầng sở hữu mối quan tâm này là tầng cửa dưới `features/`; mọi tầng dưới `modules/` — service,
repository, adapter, client bên thứ ba — phải hoàn toàn không biết gì về giao thức, vì một năng lực
mà biết giao thức nào vừa chạm tới nó thì đã thành một cửa.

## Điểm neo

Một bộ luật không chỉ được vào code thật thì chỉ là một đề xuất. Mỗi mã nêu một đường dẫn trong kho
tham chiếu và thứ cần tìm ở đó.

| Mã | Điểm neo | Cần nhìn gì |
|---|---|---|
| `TRANSPORT-1` | `features/api/core/graphql/` đặt cạnh `features/api/core/http/` | Tỉ lệ chính là luật được nhìn thấy: hàng trăm file mang `@Resolver` so với mười chín file mang `@Controller`. Mặc định không phải một sở thích ai đó phát biểu; nó là cái cây vốn đã như vậy. |
| `TRANSPORT-2` | `features/api/core/http/*/webhook/webhook.controller.ts` và `features/api/core/http/mount/foundations/mount-foundations.controller.ts` | Năm cổng thanh toán và lưu trữ có lối ra viết thẳng trong tên thư mục và tên file, cùng một file có lối ra là cái `@Res(` trong chữ ký hàm. Ở mỗi cái, lý do đọc được mà không cần rời khỏi file. |
| `TRANSPORT-3` | `modules/**` | Grep `@Controller` khắp cây năng lực và không nhận về gì. Điểm neo của mã này là **một sự vắng mặt đứng vững** — mọi cửa trong kho đều nằm dưới `features/`, và cái cây tự chứng minh điều đó mà không cần tra tài liệu nào. |

Mã nào cũng có neo. Neo là đường dẫn trong kho tham chiếu và chỉ tồn tại để kiểm chứng.

## Đầu vào

| Đầu vào | Bằng chứng cần có |
|---|---|
| door | Thuộc loại nào: resolver, controller, gateway, consumer |
| payload | Thao tác chở field hay chở byte |
| caller | Ai chạm tới cửa này: một client cầm schema, một hệ thống ngoài, một cỗ máy, một operator |
| identity | Request mang chủ thể nào, và guard nào xác lập chủ thể ấy |
| exit | Ca nào trong bốn ca áp vào, nếu có, và token nào trong file chỉ ra nó |
| address | Đường dẫn `features/` mà file sẽ nằm ở đó |

## Quy tắc

1. Thao tác nhận field và trả field thì vào schema. Không có câu hỏi thứ hai.
2. `@Controller` chỉ tồn tại ở một trong bốn ca, cộng liveness probe. Danh sách **đóng**.
3. Bằng chứng của ca ấy phải đọc được **trong chính file** — từ route, từ tên file, hoặc từ một token
   trong nội dung.
4. Không sổ đăng ký, không allow-list, không tài liệu thiết kế nào được dùng làm lý do.
5. Cửa nào cũng nằm dưới `features/`, bất kể giao thức.
6. Năng lực ở lại `modules/` và được cửa gọi tới, không bao giờ tự nhận request.
7. Không chỉ ra được lối ra thì mặc định thắng: nó vào schema.
8. Việc là một cửa quyết định địa chỉ; giao thức thì không.
9. Mỗi cửa quy về đúng một mã cho mỗi tình huống. Không cửa nào nằm ngoài phạm vi.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ đều đóng và nêu rõ mã nó áp
vào.

- **Liveness probe.** Thuộc `TRANSPORT-2`. Một route khớp `health` hay `healthz` là lối ra đứng ngoài
  bốn lối. Nó tồn tại vì probe phải trả lời khi ứng dụng đang hỏng, và một probe cần tầng feature
  sống mới chạy được thì không báo được rằng tầng feature đã chết.
- **Ứng dụng riêng tự lắp cửa của nó.** Thuộc `TRANSPORT-3`. Ràng buộc `modules/**` là toàn bộ
  luật này. Một ứng dụng dưới `apps/*` tự dựng root của nó và tự lắp cửa của nó, nên không thuộc phạm
  vi chia đôi này — vì nó không đứng giữa hai tầng cửa trong cùng một cây, nó chỉ có một.
- **Cửa REST có lý do không phải hạng hai.** Thuộc `TRANSPORT-1`. Bốn lối ra kia là **vĩnh viễn**:
  webhook sẽ không bắt đầu nói GraphQL, và file sẽ không thôi là byte. Không ai bị yêu cầu gỡ một cửa
  đã có lý do, cũng không ai được bọc một cửa như vậy vào resolver cho đẹp con số.
- **Nợ khi mới bật rule.** Một rule của module này ra mắt ở mức `warn` kèm số nợ bên cạnh chừng nào
  nợ còn lớn hơn không, được đốt về không, rồi mới lật sang `error`. Bật thẳng `error` khi còn nợ thì
  chặn mọi commit chạm vào file cũ — và đó là cách một rule đúng bị gỡ bỏ.

## Đầu ra

Mỗi file mà shape đã duyệt sinh ra thì một khối.

```text
door: <resolver | controller | gateway | consumer>
operation: <what it does>
situation: <TRANSPORT-1 | TRANSPORT-2 | TRANSPORT-3>
exit: <none | external | bytes | machine | operator | probe>
evidence: <the route, filename or token in the file that shows the exit>
address: features/<path>
reason: <why GraphQL cannot carry this, or "GraphQL can" for TRANSPORT-1>
```

## Ví dụ đã giải

Shape đã duyệt: một cổng thanh toán xác nhận một khoản đã thanh toán xong bằng cách post một callback
có chữ ký vào một URL do sản phẩm phát ra, và sau đó client sản phẩm đọc trạng thái thanh toán của
đơn hàng nó đang hiển thị.

Shape nói ra các thao tác, payload của chúng, người gọi và danh tính đi kèm. Nó không nói cửa nào sẽ
dùng giao thức nào, thư mục nào giữ file, hay token nào trong file sẽ chứng minh lựa chọn — những thứ
đó shape không giải, và chúng được giải ở đây.

```text
door: controller
operation: receive the gateway's settlement callback
situation: TRANSPORT-2
exit: external
evidence: filename webhook.controller.ts, route segment webhook
address: features/api/core/http/payment/webhook/webhook.controller.ts
reason: the gateway posts to a fixed URL we published and will never send a GraphQL document
```

`reason` loại `TRANSPORT-1` bằng đúng một sự kiện: người gọi không phải client sản phẩm đang cầm
schema — nó là một hệ thống ngoài post vào một URL ta phát ra, tức là ca thứ nhất trong bốn ca.

```text
door: resolver
operation: read the payment status of an order
situation: TRANSPORT-1
exit: none
evidence: no exit token in the file; structured JSON in, structured JSON out
address: features/api/core/graphql/payment/payment.resolver.ts
reason: GraphQL can
```

`reason` loại `TRANSPORT-2` bằng đúng một sự kiện: không token nào trong file này chỉ ra được ca nào
trong bốn ca — không route `webhook`, không byte, không tiền tố route của máy, không guard operator —
nên mặc định thắng.

Cả hai file đồng thời mang `TRANSPORT-3`, và đó không phải mâu thuẫn: `TRANSPORT-3` quyết địa chỉ cho
từng file và cả hai địa chỉ đều bắt đầu bằng `features/`, còn năng lực mà mỗi cửa gọi tới thì ở lại
dưới `modules/`.

## Phạm vi

Luật này đúng với mọi cửa cùng loại trong stack này — bất kỳ backend nào có mặt sản phẩm là một
schema. Nó không nêu tên một feature nào, không nêu sản phẩm, không nêu công ty, không nêu kho mã
nào. Bảng Điểm neo là nơi duy nhất mang đường dẫn kho, và nó mang những đường dẫn ấy để kiểm chứng,
không phải để minh hoạ.
