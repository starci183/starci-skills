# Resources

Ai chạy operator nào, bằng gì, và dưới những chính sách thường trực nào. Hai file đóng mang việc đó:

- `agents.json`: các profile thực thi, gồm provider, model, cách cô lập, và những quyền lúc chạy mà
  mỗi profile được dùng ở đây.
- `assignments.json`: mỗi operator một mục, ghi profile nào chạy từng vai trò, operator thật sự cần
  những quyền nào, và câu trả lời của nó cho ba câu hỏi thường trực.

`scripts/validate-resources.mjs` chạy bên trong `npm test`. Nó từ chối operator không có assignment,
vai trò trỏ tới profile không tồn tại, quyền được yêu cầu mà không profile nào được cấp, câu trả lời
chính sách mâu thuẫn với quyền, và model mà schema của operator đã ghim nhưng không profile nào dùng.
Nhờ vậy sổ đăng ký và hợp đồng operator không thể lặng lẽ lệch nhau.

## Luật ràng buộc

Operator ràng profile theo vai trò, không theo từng lần gọi. Profile quyết model và cách cô lập;
`execute.md` của operator quyết công việc; assignment quyết công việc đó được chạm tới quyền nào.
Một quyền không nằm trong `requires` thì operator không dùng được dù profile có cho phép. Brainstorm
và review quan trọng luôn là một lần thực thi mới, không thừa hưởng lượt nào, và reviewer chỉ nhận
artifact với lời khai, không bao giờ nhận lý lẽ của người tạo ra.

## Ba câu hỏi thường trực

**Có tìm trên mạng khi trong cây không có tham chiếu không?** Chỉ ở nơi `policy.webSearch` là
`bounded`: các operator ra quyết định và bước brief của nội dung. Nghiên cứu bị giới hạn bởi đúng
khoảng trống phải lấp, ghi lại đã dùng gì, và không bao giờ chép một trang, một thương hiệu, một
bảng màu, hay giải phẫu một component. Một giá trị presentation mà knowledge không publish là
`RULE_MISSING`, không bao giờ là việc phải đi tìm.

**Có tuân thủ Grammar đã publish không?** Ở nơi `policy.grammarBound` là true: bốn operator
frontend. Direction ràng các composition của Grammar; presentation chỉ giải quyết dựa trên những
quan hệ Grammar đã sở hữu; apply chỉ ghi những class đã resolve; audit phán xét theo cùng một luật.
Thiếu một capability tái dùng là `GRAMMAR_REQUIRED` hay `COMMON_CAPABILITY_MISSING`, không bao giờ
là dựng bản nhái cục bộ.

**Có sinh hình không?** `required` chỉ ở sinh nội dung, nơi hình được tạo theo một tuyên bố đã nêu
và được kiểm độ trung thành với tuyên bố đó. `authority-only` ở direction frontend: bản thân
direction render một trang xem được, còn artwork sản phẩm chỉ được sinh khi thẩm quyền sản phẩm gọi
tên nó. Mọi nơi khác, `never`.

## Ma trận quy trình

| Operator | Vai trò → profile | Mạng | Grammar | Hình | Vì sao hình dạng này |
| --- | --- | --- | --- | --- | --- |
| `workspace.bind` | resolve → sonnet | không | không | không | Đọc file chuẩn và sổ đăng ký; không phán đoán |
| `business.decide` | decide → sol-fresh, critique → sol-reviewer | giới hạn | không | không | Mô hình kinh doanh lạ có thể cần tra cứu trước khi đóng băng độ phủ |
| `architecture.decide` | decide → sol-fresh, critique → sol-reviewer | giới hạn | không | không | Phương án thay thế và tương thích cần bằng chứng ngoài repo; schema đã ghim model |
| `backend.implement` | implement → opus | không | không | không | Ghi trong hợp đồng đã đóng băng, theo patterns/be |
| `fe.direction.decide` | decide → sol-fresh, visualReview → sol-reviewer | giới hạn | có | chỉ khi có thẩm quyền | Chỉ tra cứu khi lĩnh vực lạ; render một trang, không phải một bức hình |
| `fe.presentation.resolve` | resolve → sonnet | không | có | không | Tra cứu trên một danh sách đóng |
| `fe.source.apply` | apply → opus | không | có | không | Chỉ ghi thứ resolution đã chứa, theo patterns/fe |
| `fe.surface.audit` | capture → sonnet, judge → sol-reviewer | không | có | không | Chụp là cơ học; người phán chỉ thấy raster và lời khai |
| `quality.verify` | verify → sonnet | không | không | không | Chạy cổng, không sửa |
| `uat.verify` | drive → opus, judge → sol-reviewer | không | không | không | Hành trình thật với học viên tự cấp; phán quyết mới cho từng lane |
| `release.deploy` | operate → opus | không | không | không | Phát hành bất biến dưới authorization đã khai |
| `platform.operate` | operate → opus | không | không | không | Dịch vụ dùng chung từ bằng chứng chính xác |
| `content.generate` | brief → sol-fresh, produce → luna, critique → sol-reviewer | giới hạn | không | bắt buộc | Brief được tra cứu; production viết, code, vẽ theo tuyên bố; critique độc lập |
| `git.publish` | publish → sonnet | không | không | không | Publish không force; thao tác phá hoại không biểu diễn được |

## Profile

| Profile | Model | Được cấp | Dùng cho |
| --- | --- | --- | --- |
| `sol-fresh` | `gpt-5.6-sol` | mạng | Một quyết định hay brainstorm mới, từ đầu tới cuối |
| `sol-reviewer` | `gpt-5.6-sol` | trình duyệt | Một reviewer mới; chỉ artifact và lời khai |
| `luna` | `gpt-5.6-luna` | hình, source | Sản xuất nội dung có tác giả |
| `opus` | `claude-opus-5` | trình duyệt, source | Tác giả nặng và mutation rủi ro cao |
| `sonnet` | `claude-sonnet-5` | source | Việc xác định và cơ học |
| `fable` | `claude-fable-5-1` | source | Trích xuất và audit bám source |

`fable` được đăng ký cho việc audit và trích xuất đã tạo ra `patterns/`; hôm nay chưa vai trò
operator nào ràng nó.

## Thứ được phép đổi ở đây

Model hay quyền của một profile, vai trò của một operator, và bất kỳ câu trả lời chính sách nào đều
là quyết định của chủ. Đổi một thứ là sửa một dòng JSON cộng `npm test` xanh. Thêm một loại quyền
nghĩa là phải thêm nó tường minh vào mọi profile, vì validator từ chối profile nào bỏ trống một
quyền.
