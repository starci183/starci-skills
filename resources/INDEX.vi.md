# Resources

Câu hỏi và lựa chọn đã ghi nhận tuân theo [tương tác](interaction.vi.md).
Provision danh tính tuân theo [custody bind theo provider](identity.vi.md).

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
bảng Các bước trong `operator.md` của operator quyết công việc; `resources.requires` quyết công việc đó được chạm tới quyền nào.
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

| Operator | Profile | Grammar | Tool | Chế độ | Vì sao |
| --- | --- | --- | --- | --- | --- |
| `environment.preflight` | sol-fresh | không | `fileread:context-aliases`, `git:read`, `shell:declared-commands`, `http:probe`, `secrets:resolve-by-name`, `container:read` | inline | Đọc khai báo, checkout, custody, sổ đăng ký và máy chủ một lần rồi báo mọi bức tường cùng lúc; không sửa gì |
| `workspace.bind` | sol-fresh | không | `fileread:context-aliases`, `git:read`, `shell:declared-commands`, `secrets:resolve-by-name` | inline | Đọc file chuẩn và một sổ đăng ký; không phán xét |
| `business.decide` | sol-fresh | không | `fileread:context-aliases`, `sourcewrite:declared-write-set`, `git:read`, `websearch:bounded` | isolated | Một mô hình nghiệp vụ lạ có thể cần tra cứu tham chiếu trước khi chốt coverage |
| `architecture.decide` | sol-fresh | không | `fileread:context-aliases`, `git:read`, `websearch:bounded`, `visualize:html` | isolated | Phương án và tương thích cần bằng chứng ngoài repo; schema ghim model |
| `interface.plan` | sol-fresh | có | `fileread:context-aliases`, `git:read` | isolated | Đọc tham chiếu, source và lời hứa một lần rồi gọi tên mọi trang và modal với một shell chung; không quyết gì bên trong một đơn vị |
| `interface.generate` | sol-fresh | có | `fileread:context-aliases`, `git:commit-session-branch`, `websearch:bounded`, `imagegen:judged`, `visualize:html`, `host:loopback`, `print:decision-points`, `registry:read`, `sourcewrite:declared-write-set`, `shell:declared-commands` | isolated | Một agent mù dựng, render và in các ứng viên, resolve theo inventory đóng và ghi cây một lần |
| `interface.audit` | sol-reviewer | có | `fileread:context-aliases`, `git:read`, `websearch:bounded`, `visualize:html`, `browsercontrol:required`, `http:probe`, `host:loopback`, `secrets:resolve-by-name`, `print:decision-points` | isolated | Chỉ trình duyệt, không ghi source: người chấm không được sửa thứ mình đo, và đăng nhập bằng tên credential để tới route có cổng canh |
| `interface.fix` | sol-fresh | có | `fileread:context-aliases`, `sourcewrite:declared-write-set`, `shell:declared-commands`, `git:commit-session-branch` | inline | Một finding, một commit nhỏ từ inventory của generator; lớn hơn là FIX_TOO_LARGE |
| `library.update` | sol-fresh | không | `fileread:context-aliases`, `sourcewrite:declared-write-set`, `git:commit-session-branch`, `shell:declared-commands` | isolated | Sửa package của owner với bằng chứng trước/sau, đóng gói bản phát hành và tiêu thụ nó bằng metadata chính xác ở phía dùng; `mode` chạy cả hai nửa (`full`), riêng nửa owner và dừng ở bản phát hành đã ghi (`publish`), hoặc riêng nửa consumer trên bản phát hành đã bind (`consume`), nên hai repository là hai route |
| `backend.plan` | sol-fresh | không | `fileread:context-aliases`, `git:read` | isolated | Đọc contract đã đóng băng và source một lần rồi gom các thao tác thành module với proof, migration và thứ tự của chúng; không điền gì |
| `backend.generate` | sol-fresh | không | `fileread:context-aliases`, `sourcewrite:declared-write-set`, `git:commit-session-branch`, `shell:declared-commands` | isolated | Ghi bên trong một contract đã đóng băng theo patterns/be, trọn vẹn hay dưới dạng fix |
| `identity.provision` | sol-fresh | không | `fileread:context-aliases`, `shell:declared-commands`, `http:probe`, `secrets:resolve-by-name`, `sourcewrite:declared-write-set`, `browsercontrol:required` | inline | Tạo tài khoản của luồng tại provider đã khai bằng credential resolve theo tên và chứng minh đăng nhập được; chỉ ghi tên |
| `data.plan` | sol-fresh | không | `fileread:context-aliases`, `git:read` | isolated | Đọc goal, kế hoạch UAT, bản đồ và các kho một lần rồi gọi tên mỗi luồng hay họ dữ liệu một đơn vị seed với namespace và đích riêng; không đặt gì |
| `data.seed` | sol-fresh | không | `fileread:context-aliases`, `sourcewrite:declared-write-set`, `secrets:resolve-by-name`, `http:probe`, `database:namespaced-write` | inline | Ghi và áp seed của một luồng theo luật cô lập, mọi dòng quy được nguồn, kèm rollback |
| `runtime.serve` | sol-fresh | không | `fileread:context-aliases`, `git:merge-into-integration-branch`, `shell:declared-commands`, `http:probe`, `container:operate`, `secrets:resolve-by-name` | inline | Merge một phiên vào nhánh tích hợp, khởi động lại đúng một server theo head, chứng thực entry, giữ lease |
| `migration.release` | sol-fresh | không | `fileread:context-aliases`, `git:read`, `shell:declared-commands`, `secrets:resolve-by-name` | inline | Áp bộ migration đã khai đúng một lần qua runner do source sở hữu, giữ nguyên journal |
| `business.reconcile` | sol-fresh | không | `fileread:context-aliases`, `sourcewrite:declared-write-set`, `git:read` | isolated | So head lời hứa đã công bố với source đã giao và ghi lại mọi sai lệch |
| `quality.verify` | sol-fresh | không | `fileread:context-aliases`, `git:read`, `shell:declared-commands`, `http:probe` | inline | Chạy gate, không sửa gì |
| `uat.plan` | sol-fresh | không | `fileread:context-aliases` | isolated | Đọc goal và bản đồ một lần rồi gọi tên mỗi hành trình một luồng với alias và namespace riêng; không đi thử gì |
| `uat.verify` | sol-fresh | không | `fileread:context-aliases`, `sourcewrite:declared-write-set`, `git:read`, `websearch:bounded`, `visualize:html`, `browsercontrol:required`, `http:probe`, `secrets:resolve-by-name`, `database:namespaced-write`, `print:decision-points` | isolated | Đi hành trình thật trong trình duyệt và không được ghi gì; verdict mới cho từng làn |
| `release.deploy` | sol-fresh | không | `fileread:context-aliases`, `git:read`, `shell:declared-commands`, `http:probe`, `container:operate`, `ci:read`, `secrets:resolve-by-name` | inline | Phát hành image bất biến dưới uỷ quyền đã khai, kèm probe và rollback |
| `content.generate` | sol-fresh | không | `fileread:context-aliases`, `shell:declared-commands`, `websearch:bounded`, `imagegen:required`, `objectstorage:read` | isolated | Tra cứu brief trong giới hạn, rồi viết, code và vẽ theo một claim; schema ghim model này |
| `git.publish` | sol-fresh | không | `fileread:context-aliases`, `git:merge-and-push`, `shell:declared-commands`, `ci:read` | inline | Publish không force; thao tác huỷ diệt không biểu diễn được |

## Profile

### Runtime `openai` (provider `openai`)

| Profile | Model | Năng lực | Được cấp | Dùng cho |
| --- | --- | --- | --- | --- |
| `sol-fresh` | `gpt-5.6-sol` | mạng, hình, trình duyệt, source | mạng, hình, trình duyệt, source | Quyết định và direction, từ đầu tới cuối |
| `sol-reviewer` | `gpt-5.6-sol` | mạng, hình, trình duyệt, source | trình duyệt | Audit và UAT; chỉ quan sát, không bao giờ ghi |

### Runtime `claude` (provider `anthropic`)

| Profile | Model | Năng lực | Được cấp | Dùng cho |
| --- | --- | --- | --- | --- |
| `opus` | `claude-opus-5` | mạng, trình duyệt, source | trình duyệt, source | Tác giả nặng và mutation rủi ro cao |
| `fable` | `claude-fable-5-1` | mạng, trình duyệt, source | source | Trích xuất và audit bám source |

`fable` được đăng ký cho việc audit và trích xuất đã tạo ra `patterns/`; hôm nay chưa operator nào
ràng nó.

## Thứ được phép đổi ở đây

Model hay quyền của một profile, profile của một operator, và bất kỳ câu trả lời chính sách nào đều
là quyết định của chủ. Đổi một thứ là sửa file profile hay `operator.json` của operator, dòng tương ứng trong `context.md`
của nó, cộng `npm test` xanh. Thêm một loại quyền
nghĩa là phải thêm nó tường minh vào mọi profile, vì validator từ chối profile nào bỏ trống một
quyền.
