# Resources

Ai chạy operator nào, bằng gì, và dưới những chính sách thường trực nào. Hai chỗ đóng mang việc đó:

- `agents/profiles/<runtime>.json`: mỗi runtime một file (`openai.json`, `claude.json`); file giữ provider,
  profile mang model, cách cô lập, model làm được gì ở đây
  (`capabilities`), và một operator trên profile đó được phép dùng gì (`permits`).
- `operators/<id>/operator.json` → `resources`: nằm trong chính operator: đúng một profile chạy nó từ
  đầu tới cuối, những quyền nó thật sự cần, và câu trả lời cho ba câu hỏi thường trực. `context.md`
  của mỗi operator nói cùng ràng buộc đó bằng văn xuôi. Không có file assignment trung tâm.

`scripts/validate-resources.mjs` chạy bên trong `npm test`. Nó từ chối operator mà `operator.json` không khai
`resources`, operator trỏ tới profile không tồn tại, một id profile khai ở hai runtime, quyền được yêu cầu mà không profile nào được cấp, profile cho phép
thứ model không làm được, câu trả lời
chính sách mâu thuẫn với quyền, model mà schema của operator đã ghim nhưng không phải model của profile nó, và một dòng trong ma
trận bên dưới lệch với operator mà nó tóm tắt. Nhờ vậy sổ đăng ký, các operator và bản tóm tắt này
không thể lặng lẽ lệch nhau.

## Luật ràng buộc

Operator ràng đúng một profile và chạy trọn trên đó, không theo từng lần gọi và không chia cho
nhiều profile: một bước phản biện, review hay phán xét bên trong operator là một bước của chính lần
thực thi đó, và đưa model thứ hai vào là thành workflow. Profile quyết model và cách cô lập;
`execute.md` của operator quyết công việc; `resources.requires` quyết công việc đó được chạm tới quyền nào.
Một quyền không nằm trong `requires` thì operator không dùng được dù profile có cho phép. Năng lực là sự thật về model; quyền là chính sách về operator:
`gpt-5.6-sol` tìm được, vẽ được, lái được trình duyệt và ghi được source, nên `sol-fresh` được dùng cả
bốn, còn `sol-reviewer` trên cùng model đó chỉ được trình duyệt, vì một reviewer mà tự tạo ra thì
không còn là reviewer. Brainstorm
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

Bản tóm tắt những gì mỗi `operator.json` khai; validator từ chối dòng nào lệch.

| Operator | Profile | Mạng | Grammar | Hình | Vì sao hình dạng này |
| --- | --- | --- | --- | --- | --- |
| `workspace.bind` | sonnet | không | không | không | Đọc file chuẩn và sổ đăng ký; không phán đoán |
| `business.decide` | sol-fresh | giới hạn | không | không | Mô hình kinh doanh lạ có thể cần tra cứu trước khi đóng băng độ phủ |
| `architecture.decide` | sol-fresh | giới hạn | không | không | Phương án thay thế và tương thích cần bằng chứng ngoài repo; schema đã ghim model |
| `backend.implement` | opus | không | không | không | Ghi trong hợp đồng đã đóng băng, theo patterns/be |
| `fe.direction.decide` | sol-fresh | giới hạn | có | chỉ khi có thẩm quyền | Chỉ tra cứu khi lĩnh vực lạ; render một trang, không phải một bức hình |
| `fe.presentation.resolve` | sonnet | không | có | không | Tra cứu trên một danh sách đóng |
| `fe.source.apply` | opus | không | có | không | Chỉ ghi thứ resolution đã chứa, theo patterns/fe |
| `fe.surface.audit` | sol-reviewer | không | có | không | Chỉ trình duyệt, không ghi source: người audit không sửa được thứ mình đo |
| `quality.verify` | sonnet | không | không | không | Chạy cổng, không sửa |
| `uat.verify` | sol-reviewer | không | không | không | Lái hành trình thật trong trình duyệt và không được ghi gì; phán quyết mới cho từng lane |
| `release.deploy` | opus | không | không | không | Phát hành bất biến dưới authorization đã khai |
| `platform.operate` | opus | không | không | không | Dịch vụ dùng chung từ bằng chứng chính xác |
| `content.generate` | luna | giới hạn | không | bắt buộc | Tra cứu brief trong giới hạn, rồi viết, code và vẽ theo tuyên bố; schema ghim model này |
| `git.publish` | sonnet | không | không | không | Publish không force; thao tác phá hoại không biểu diễn được |

## Profile

### Runtime `openai` (provider `openai`)

| Profile | Model | Năng lực | Được cấp | Dùng cho |
| --- | --- | --- | --- | --- |
| `sol-fresh` | `gpt-5.6-sol` | mạng, hình, trình duyệt, source | mạng, hình, trình duyệt, source | Quyết định và direction, từ đầu tới cuối |
| `sol-reviewer` | `gpt-5.6-sol` | mạng, hình, trình duyệt, source | trình duyệt | Audit và UAT; chỉ quan sát, không bao giờ ghi |
| `luna` | `gpt-5.6-luna` | mạng, hình, source | mạng, hình, source | Nội dung có tác giả, từ đầu tới cuối |

### Runtime `claude` (provider `anthropic`)

| Profile | Model | Năng lực | Được cấp | Dùng cho |
| --- | --- | --- | --- | --- |
| `opus` | `claude-opus-5` | mạng, trình duyệt, source | trình duyệt, source | Tác giả nặng và mutation rủi ro cao |
| `sonnet` | `claude-sonnet-5` | mạng, trình duyệt, source | source | Việc xác định và cơ học |
| `fable` | `claude-fable-5-1` | mạng, trình duyệt, source | source | Trích xuất và audit bám source |

`fable` được đăng ký cho việc audit và trích xuất đã tạo ra `patterns/`; hôm nay chưa operator nào
ràng nó.

## Thứ được phép đổi ở đây

Model hay quyền của một profile, profile của một operator, và bất kỳ câu trả lời chính sách nào đều
là quyết định của chủ. Đổi một thứ là sửa file profile hay `operator.json` của operator, dòng tương ứng trong `context.md`
của nó, cộng `npm test` xanh. Thêm một loại quyền
nghĩa là phải thêm nó tường minh vào mọi profile, vì validator từ chối profile nào bỏ trống một
quyền.
