---
id: be-patterns-transport-vi
title: vi.md
slug: /be/patterns/transport/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống TRANSPORT-N, nhận diện bằng nghiệp vụ chứ không bằng thói quen gõ route.
---

# vi.md

> Version: `2.00` · Module: `transport`

# Transport

**Cửa** là bất kỳ file nào mà thế giới bên ngoài có thể chạm tới: một resolver, một controller, một socket
gateway, một broker consumer.

Module này chỉ giải **một** câu hỏi về cửa: **khi nào một cửa được phép không phải
GraphQL** — cùng với việc câu trả lời ấy nằm ở đâu trên đĩa.

Câu hỏi này quan trọng vì đáp án gần như luôn là "không được". Mặt sản phẩm là một schema GraphQL
code-first; client nào nói chuyện được với nó thì đã cầm sẵn một GraphQL client, một schema, một bộ
type sinh ra và đúng một endpoint. Mỗi route REST dựng thêm bên cạnh là **một giao thức thứ hai**
cũng client ấy phải học, **một chỗ thứ hai** để đặt xác thực, và một hình dáng mà không type sinh
ra nào phủ.

Cái giá đó chỉ đáng trả khi GraphQL **không làm nổi** việc — không bao giờ chỉ vì viết một route
thì nhanh tay hơn.

Thứ luật này ngăn không phải là một controller tồi. Nó là dáng vẻ của một codebase sau hai mươi lần
quyết định theo từng ca mà không ai ghi lại: hai tầng cửa, không có ranh giới nào được nói ra, và
người đọc sau không cách nào biết một route là REST **vì có lý do** hay **vì tình cờ**. Đo vào lúc
bản luật phẳng được viết: mười lăm trong mười tám cửa có lý do nhìn thấy được ngay trong file, ba cái
thì không — nên thiết kế phần lớn là mạch lạc mà **trông** như một mớ hỗn độn, tức là tệ cả hai bề.

**Đây là luật bắt buộc.** Không có cửa nào nhỏ đến mức được miễn khai báo mã. Câu "chỉ là một
endpoint thôi mà" chính là chỗ luật này bị bỏ qua nhiều nhất — và hai mươi lần "chỉ là một endpoint"
đúng là mớ hỗn độn mà luật sinh ra để ngăn.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Kết quả |
|---|---|---|
| `TRANSPORT-1` | Một thao tác nhận field và trả về field | Mutation hoặc query, không hỏi thêm câu nào |
| `TRANSPORT-2` | Một cửa **không thể** là GraphQL | `@Controller`, và file phải tự nói nó thuộc ca nào trong bốn ca |
| `TRANSPORT-3` | Một cửa, bất kể giao thức gì | Nằm dưới `features/`, không bao giờ nằm trong `modules/` |

---

## `TRANSPORT-1` — cửa mặc định là GraphQL

**Tình huống.** Một thao tác nhận vào các field và trả lời bằng các field. Nó là một mutation hoặc
một query. **Không có câu hỏi thứ hai để hỏi.**

**Dấu hiệu nhận biết**

- Payload vào là JSON có cấu trúc; payload ra là JSON có cấu trúc.
- Người gọi là client sản phẩm — thứ đã cầm sẵn schema và bộ type sinh ra.
- Danh tính đi kèm request là một phiên người dùng bình thường.
- Không có byte nào, không có máy nào, không có ai posting tới URL ta phát ra.

**Tự hỏi.** Có bất kỳ ca nào trong bốn ca của `TRANSPORT-2` áp vào đây không? Nếu không — thì vào
schema, và chuyện đó khép lại.

**Ranh giới**

- ↔ `TRANSPORT-2`: đây là **cùng một quyết định nhìn từ hai phía**. `TRANSPORT-1` nói mặc định,
  `TRANSPORT-2` nói danh sách lối ra khỏi mặc định ấy. Nếu không chỉ ra được một lối ra thì không có
  lối ra.
- ↔ `TRANSPORT-3`: `TRANSPORT-1` chọn **giao thức**, `TRANSPORT-3` chọn **địa chỉ**. Trả lời đúng
  câu này không miễn cho ta câu kia.

**Những lý do không được tính là lý do**

- "REST test bằng curl cho nhanh." Đó là tiện cho người viết, không phải giới hạn của GraphQL.
- "Bên tích hợp quen REST hơn." Nếu bên đó là client sản phẩm thì nó đã có schema rồi.
- "Chỉ là một endpoint nhỏ." Đúng hai mươi lần thì thành hai tầng cửa.
- "Đang gấp, mai refactor." Route sống lâu hơn cái deadline sinh ra nó.

**Tình huống nghiệp vụ hay gặp.** Đọc hồ sơ · cập nhật cài đặt · liệt kê đơn hàng có phân trang · tạo
bản nháp · huỷ đăng ký · đổi mật khẩu qua phiên hiện tại · tìm kiếm có bộ lọc · đếm số liệu tổng quan.

---

## `TRANSPORT-2` — cửa REST chỉ ở chỗ GraphQL không tới được

**Tình huống.** GraphQL **không làm nổi** việc, và file phải tự nói ra nó thuộc ca nào. Bốn ca, không
có ca thứ năm.

| Ca | Nhìn thấy gì trong file | Vì sao GraphQL không tới được |
|---|---|---|
| **hệ thống ngoài post vào một URL ta phát ra** | route hoặc tên file có chữ `webhook` | một cổng thanh toán post vào một URL cố định. Nó sẽ không bao giờ gửi một GraphQL document, và ta không có quyền yêu cầu nó gửi |
| **byte, không phải field** | `FileInterceptor`, `StreamableFile`, `@Res(`, `createReadStream` | upload multipart và download dạng stream. GraphQL chở JSON |
| **một cỗ máy tự đăng ký** | route bắt đầu bằng `pods/`, `internal/`, `agents/` | một pod gọi về lúc khởi động không mang theo phiên người dùng nào cả |
| **một danh tính không phải phiên người dùng** | route bắt đầu bằng `api/ops`, hoặc file dùng guard operator / service token | một operator nền tảng hay một service token là **chủ thể khác** với người dùng của sản phẩm; treo nó lên cùng một guard là mở đường cho quản trị viên của một tenant vận hành cả nền tảng |

**Dấu hiệu nhận biết**

- Bằng chứng đọc được **ngay trong file**, không phải trong một tài liệu nào khác.
- Bỏ dòng bằng chứng ấy đi thì không còn ai biết vì sao cửa này không phải GraphQL.

**Tự hỏi.** Nếu người đọc tiếp theo chỉ mở đúng file này, họ có thấy được lý do không? Nếu phải hỏi
người khác — thì lý do chưa nằm trong file, và luật coi như chưa có lý do.

**Ranh giới**

- ↔ `TRANSPORT-1`: xem trên. Không chỉ được ca nào thì mặc định thắng.
- ↔ `TRANSPORT-3`: một cửa REST đúng luật `TRANSPORT-2` vẫn có thể nằm sai chỗ. Hai mã kiểm hai
  chuyện khác nhau và một file có thể qua cái này, trượt cái kia.

**Bằng chứng đọc từ file, không đọc từ sổ đăng ký.** Một danh sách route "đã được duyệt" mục ngay lần
đầu có người thêm route rồi quên cập nhật, và nó cho phép một cửa được biện minh bằng **một tài liệu**
thay vì bằng **việc nó làm**. Sổ đăng ký còn tạo ra một trạng thái tệ hơn cả không có: một route sai
nằm trong sổ trông y hệt một route đúng.

**Ngoại lệ đứng ngoài bốn ca: liveness probe.** Route `health` hay `healthz` phải trả lời được **khi
ứng dụng đang hỏng**, có thể trước cả lúc tầng feature kịp lên. Một probe cần tầng feature sống mới
chạy được thì không bao giờ báo được rằng tầng feature đã chết.

**Tình huống nghiệp vụ hay gặp.** Webhook cổng thanh toán · webhook thông báo bucket lưu trữ · upload
ảnh đại diện · tải hoá đơn PDF · phát video theo range · pod đăng ký lúc boot · agent xin cấu hình ·
bảng điều khiển vận hành nội bộ · probe cho load balancer.

---

## `TRANSPORT-3` — cửa nào cũng nằm dưới `features/`

**Tình huống.** `modules/` giữ **năng lực** — những thứ mà cửa gọi tới. `features/` giữ **cửa**. Giao
thức chưa bao giờ là thứ quyết định địa chỉ; **việc là một cửa** mới quyết định.

**Dấu hiệu nhận biết**

- File có `@Controller`, `@Resolver`, `@WebSocketGateway` hoặc một handler nhận message từ broker.
- Nó là điểm **bắt đầu** của một request, không phải chỗ được ai đó gọi vào.

**Tự hỏi.** Có thứ gì ngoài tiến trình này chạm được vào file này không? Nếu có thì nó là cửa, và cửa
thì nằm dưới `features/`.

**Vì sao một cửa nằm nhầm trong `modules/` lại đắt.** Nó **đọc như một năng lực** và rồi **bị import
như một năng lực**: module khác kéo nó vào để dùng ké service bên trong, và từ giờ xoá cái route đó
làm vỡ một thứ chẳng liên quan gì tới HTTP. Tệ hơn nữa là hai tầng cửa nằm ở hai cây khác nhau mà
không ở đâu ghi lý do — đúng cái tình trạng "trông như mớ hỗn độn" mà `TRANSPORT-1` mô tả.

**Ranh giới**

- ↔ `TRANSPORT-2`: `TRANSPORT-2` hỏi *cửa này có được phép là REST không*, `TRANSPORT-3` hỏi *file
  này nằm ở đâu*. Một webhook hoàn toàn chính đáng nằm trong `modules/` thì vẫn sai `TRANSPORT-3`.
- ↔ năng lực: service, repository, adapter, client bên thứ ba **vẫn ở** `modules/`. Luật này không
  kéo chúng đi đâu cả; nó chỉ kéo **cửa**.

**Ngoại lệ.** Luật này ràng `src/modules/**` và chỉ chừng đó. Một ứng dụng riêng dưới `apps/*` tự
dựng root của nó và tự lắp cửa của nó, nên không thuộc phạm vi chia đôi này — vì nó không đứng giữa
hai tầng cửa trong cùng một cây, nó chỉ có một.

**Tình huống nghiệp vụ hay gặp.** Resolver mutation · resolver query · controller webhook · gateway
socket · consumer đọc topic · controller phục vụ file tĩnh · controller vận hành.

---

## Luật

1. Thao tác nhận field và trả field thì vào schema. Không có câu hỏi thứ hai.
2. `@Controller` chỉ tồn tại ở một trong bốn ca, cộng liveness probe. Danh sách **đóng**.
3. Bằng chứng của ca ấy phải đọc được **trong chính file** — từ route, từ tên file, hoặc từ một token
   trong nội dung.
4. Không sổ đăng ký, không allow-list, không tài liệu thiết kế nào được dùng làm lý do.
5. Cửa nào cũng nằm dưới `features/`, bất kể giao thức.
6. Năng lực ở lại `modules/` và được cửa gọi tới, không bao giờ tự nhận request.
7. Không chỉ ra được lối ra thì mặc định thắng: nó vào schema.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ
mã nó áp vào.

- **Liveness probe.** Thuộc `TRANSPORT-2`. `health`/`healthz` là lối ra thứ năm, tồn tại vì probe
  phải trả lời khi ứng dụng đang hỏng.
- **Ứng dụng riêng dưới `apps/*`.** Thuộc `TRANSPORT-3`. Chỉ `src/modules/**` bị ràng; một app riêng
  tự lắp cửa của nó.
- **Cửa REST có lý do không phải hạng hai.** Thuộc `TRANSPORT-1`. Bốn ca kia là **vĩnh viễn**:
  webhook sẽ không bắt đầu nói GraphQL, và file sẽ không thôi là byte. Không ai bị yêu cầu gỡ một cửa
  đã có lý do, cũng không ai được bọc một cửa như vậy vào resolver cho đẹp con số.
- **Nợ khi mới bật rule.** Rule ra mắt ở mức `warn` kèm số nợ, đốt về không, rồi mới lên `error`. Bật
  thẳng `error` khi còn nợ thì chặn mọi commit chạm vào file cũ — và đó là cách một rule đúng bị gỡ
  bỏ.
