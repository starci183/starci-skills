# backend.source.apply

## Việc

Cài đặt một kết quả backend bên trong một contract mutation đã đóng băng, theo đúng họ anh em quan
sát được, và trả về biên nhận conformance cùng proof đo được cho thấy ranh giới không bị nới ra.

## Contract đóng băng trước lần ghi đầu tiên

Contract tới dưới dạng Đầu vào `architecture-decision`, có fingerprint và đã đóng. Các operation,
writer, store, ranh giới giao dịch, kiểu idempotency và migration mà nó liệt kê là tập đầy đủ mà phần
cài đặt được chạm, và operator này chỉ trả lời một câu hỏi cho mỗi operation: đoạn code đang tồn tại
có làm đúng điều contract nói không, và phép đo nào cho thấy điều đó. Các operation không phải một
Yêu cầu, vì việc một người gõ lại contract vào request chính là cách contract và phần cài đặt lặng lẽ
tách nhau; bước 3 đọc chúng từ đầu vào đã đóng băng và ghi lại vào `response/data/mutations.json`. Ba
điều cấm gánh phần đó, và mỗi điều được cưỡng chế chứ không phải khuyên. Một operation, writer, store,
giao dịch, migration hay event nằm ngoài contract là `CONTRACT_WIDENED`, trả về cho chủ contract trước
mọi lần ghi vào sản phẩm. Một file ngoài trần file được sửa là `OWNER_CONFLICT`, kể cả khi thay đổi ở
đó chỉ một dòng. Một quy ước mà không pattern anh em nào đã ràng công bố thì bị từ chối và ghi lại là
`NEW_CONVENTION_REFUSED`, còn một khía cạnh không có pattern nào cả là `PATTERN_UNBOUND`. Phát hiện
giữa chừng rằng kết quả cần một ranh giới rộng hơn là cách kết thúc dự kiến của operator này, không
phải sự nhụt chí: chủ contract mở lại và đóng băng lại, rồi cùng kết quả ấy được cài đặt lại theo
fingerprint mới. Với tay ra ngoài danh sách không phải là thay đổi nhỏ hơn việc mở lại contract; nó là
cùng một thay đổi nhưng không có dấu vết.

## Không bao giờ ghi lên nhánh của người

Operator này không bao giờ ghi lên nhánh mà một người đang checkout. Orchestrator chuẩn bị một git
worktree riêng của checkout được route trên nhánh phiên `session/<sessionId>`, cắt từ head đã đóng
băng, và bước 3 ghi ở đó chứ không ở đâu khác, dưới một lease độc quyền trên `@workspaces/be`. Bước
cuối commit toàn bộ tập ghi đã khai đúng một lần, ghi sha ấy vào `response.json.commits`, và nêu cùng
sha ấy trong `response/data/mutations.json` ở trường `commit`, cạnh `base` nó xuất phát và `branch` nó
sống trên đó; `response/changes.md` nói đúng bước chuyển ấy ở hàng Binding, `@workspaces/be` tại
`<base>` → `<sha>` trên `session/<sessionId>`. Một commit, vì một bước mà công việc tới dưới dạng nhiều
commit thì bước sau không pin được trong request của nó, còn một lần ghi chưa commit thì không pin
được chút nào. Ở đây không push và không merge gì cả: `git.publish` merge nhánh phiên vào nhánh đích,
và nó là operator duy nhất nói chuyện với remote.

## Backend không bao giờ bịa hành vi nghiệp vụ

Mỗi operation dẫn các quyết định đã duyệt mà nó cài đặt. Khi đoạn code tới chỗ câu trả lời phụ thuộc
vào một luật nghiệp vụ chưa ai duyệt, nhánh dừng với `BUSINESS_AUTHORITY_MISSING` và nêu tên câu hỏi
còn mở. Nó không chọn cách đọc dễ dãi, không bắt chước feature bên cạnh tình cờ làm gì, và không chọn
nhánh nào làm test xanh. Đây là luật gánh nặng nhất của operator, vì một luật nghiệp vụ đoán ra mà qua
được test của chính nó thì không phân biệt nổi với một luật đã duyệt một khi đã ship. Vì vậy một biên
nhận đã cài đặt không thể mang finding `BUSINESS_QUESTION_RAISED`: nêu câu hỏi rồi vẫn cài đặt chính
là mâu thuẫn mà phép kiểm này sinh ra để bắt.

## Pattern anh em là nguồn quy ước duy nhất

Các pattern đã ràng nêu một họ cho mỗi khía cạnh, và phần cài đặt bắt chước họ mà codebase đang công
bố chứ không phải họ mà nó nhớ: command handler theo họ mà tầng mutation đang dùng, exception dẫn xuất
từ định danh exception đã công bố, truy cập entity qua entity manager chính được tiêm, migration dưới
datasource chính. Hai họ cùng ràng cho một khía cạnh nghĩa là không họ nào được ràng, và đoán họ từ
trí nhớ chính là cách một kiểu nhà thứ hai lọt vào codebase mà không ai để ý.

## Conformance là đo được, không phải khẳng định

Một bản ghi conformance không có bằng chứng chỉ là một câu nói về đoạn code, và một câu nói không mâu
thuẫn nổi với code. Mỗi facet đã khai của mỗi operation có file riêng,
`response/data/conformance/<operationId>.<facet>.json`, nên một facet không ai đo là một file thiếu
chứ không phải một dòng thiếu bên trong một file trông vẫn đầy đủ. Bằng chứng là thứ người đọc sau
dùng để phản đối biên nhận này, nên nó bắt buộc cho mọi facet, kể cả những facet đã qua. Cùng lý lẽ ấy
khiến một proof phải mang câu lệnh, mã thoát và output trong
`response/data/proofs/<operationId>.<kind>.json`: câu lệnh nói đã chạy gì và kết quả nói cái gì trả
về, còn mỗi thứ đứng một mình đều có thể do người chưa chạy gì viết ra. Một proof không chạy được
không bao giờ trở thành khẳng định rằng hành vi vẫn ổn, và một proof hỏng chặn biên nhận chứ không
được phân loại lại. Mỗi file bị chạm mang một bản ghi thay đổi kèm loại và hash trước/sau, vì một file
sửa mà hai hash bằng nhau ghi lại một mutation không hề xảy ra.

## Ranh giới

Operator chỉ ghi source sản phẩm bên trong trần file được sửa, chỉ bên trong worktree nhánh phiên của
`@workspaces/be`, và ghi mọi thứ khác vào `response/` của nhánh mình: `response.md`,
`response/changes.md`, `response/data/mutations.json`, một bản ghi conformance cho mỗi facet đã khai,
một bản ghi proof cho mỗi proof đã khai, và `response.json`. Nó không bao giờ thêm một operation,
writer, store, giao dịch, migration hay event mà contract đóng băng không mang, không quyết một luật
nghiệp vụ mà thẩm quyền đã duyệt không nói, không đưa vào một quy ước mà không pattern anh em nào công
bố, không làm yếu, bỏ qua, chặn hay thay thế một proof đã khai để một lượt chạy thành xanh, không sửa
contract, thẩm quyền nghiệp vụ hay một file ngoài trần được sửa, không commit quá một lần, không ghi
lên nhánh mà người đang checkout, không push, merge hay tag gì, không tuyên bố conformance mà không
nêu bằng chứng đã đo nó, và không ghi phán quyết chất lượng, thị giác hay UAT; đó là những việc khác
với cổng riêng của chúng.

## Context

| Alias | Bind | Bắt buộc |
| --- | --- | --- |
| `@worktrees/businesses/<featureId>` | head nghiệp vụ đã publish, nguồn duy nhất của hành vi nghiệp vụ | có |
| `@knowledge/patterns/be` | các họ anh em mà thay đổi này bắt chước, mỗi khía cạnh một họ; nguồn quy ước hợp lệ duy nhất | có |
| `@workspaces/be` | checkout backend được route ở head đóng băng, chỉ ghi trên worktree nhánh phiên của nó | có |

## Đầu vào

| Kind | Từ đâu | Bắt buộc |
| --- | --- | --- |
| `architecture-decision` | `architecture.decide`; contract mutation đã đóng băng mà phần cài đặt điền vào và không được nới | có |
| `backend-source-application` | một lượt chạy trước của `backend.source.apply` cho cùng kết quả; lịch sử hồi quy, vắng mặt ở lần đầu | không |

## Yêu cầu

| Field | Kiểu | Mặc định | Hỏi |
| --- | --- | --- | --- |
| `featureId` | id | — | Feature mà head nghiệp vụ đã publish của nó quyết hành vi này |
| `outcome` | prompt | — | Một thứ duy nhất đang được cài đặt, bằng lời của người dùng |
| `mutableFileRefs` | list | — | Những file duy nhất mà source sản phẩm được ghi vào |
| `resume` | token | null | Token của nhánh bị chặn khi vào lại sau một mã dừng |

## Các bước

| # | Bước | Tham số | Đọc | Ghi | Dừng với |
| --- | --- | --- | --- | --- | --- |
| 1 | Kiểm gate và chạy lại | `resume` | `request/request.json`, đầu vào `backend-source-application` nếu có, @workspaces/be ở head đóng băng | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Ràng thẩm quyền, contract và pattern | `featureId` | @worktrees/businesses/<featureId> ở head đã publish, đầu vào `architecture-decision` làm contract đóng băng, @knowledge/patterns/be mỗi khía cạnh một pattern | — | `CONTRACT_UNFROZEN`, `BUSINESS_AUTHORITY_MISSING`, `PATTERN_UNBOUND` |
| 3 | Điền từng operation của contract, trên nhánh phiên | `mutableFileRefs` | @knowledge/patterns/be cho từng khía cạnh, @workspaces/be trong trần được sửa | @workspaces/be/branch/session trong trần được sửa, dưới một lease độc quyền | `CONTRACT_WIDENED`, `OWNER_CONFLICT` |
| 4 | Ghi mọi mutation kèm hash trước và sau | — | @workspaces/be, các file bị chạm và contract đóng băng | `response/data/mutations.json` | — |
| 5 | Kiểm lại snapshot đã lưu khi đọc | — | @workspaces/be, snapshot đã lưu, @knowledge/patterns/be cho các luật trôi sau nó | — | — |
| 6 | Chứng minh từng facet đã khai | — | @workspaces/be, phép đo đứng sau mỗi facet | `response/data/conformance/<operationId>.<facet>.json` | — |
| 7 | Chạy từng proof đã khai | — | @workspaces/be, câu lệnh đã pin của mỗi kiểu proof đã khai | `response/data/proofs/<operationId>.<proofKind>.json` | `PROOF_UNAVAILABLE` |
| 8 | Commit tập ghi đúng một lần, viết biên nhận và phát | `outcome` | mọi thứ ở trên | @workspaces/be/branch/session thành một commit, `response/changes.md`, `response/response.md`, `response/response.json` | — |

Head được route được kiểm lại ngay trước lần ghi sản phẩm đầu tiên, nên trôi head phát hiện ở đó dừng
nhánh trước khi có gì được ghi. Điền một operation là viết transport, phần kiểm tra hợp lệ, phần kiểm
quyền, phần truy cập dữ liệu và các đường lỗi vào writer đã khai cùng những file mà thay đổi thực sự
đòi; nó từ chối to và sớm chứ không im lặng bỏ rơi một trường hợp, ném ra exception mà pattern định
danh exception công bố trước khi có dòng nào hay checkout ngoài nào được tạo. Khi kết quả lưu một
workflow, phiên, giỏ, bản nháp hay snapshot khác, tính dùng được lại được cưỡng chế ở nơi nó được
đọc, đối chiếu phía server, theo thứ tự ổn định, với chỉ mục ánh xạ lại nguyên tử và một trạng thái
kết thúc tường minh khi không còn gì để làm, và được ghi là `SNAPSHOT_REVALIDATED`. Chạy lại thì bắt
đầu lại từ bước 1, chỉ dùng lại quan sát có fingerprint không đổi, và tiêu thụ đúng phần delta; một
quyết định nghiệp vụ đã duyệt tới dưới dạng một fingerprint thẩm quyền mới, vì cùng một fingerprint
không thể cho một câu trả lời khác.

## Đầu ra

| Kind | File | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| `backend-source-application` | `response/response.md` | md | có |
| `changes` | `response/changes.md` | md | có |
| `mutations` | `response/data/mutations.json` | data | có |
| `conformance` | `response/data/conformance/<operationId>.<facet>.json` | data | có |
| `proof` | `response/data/proofs/<operationId>.<proofKind>.json` | data | có |

## Dừng

| Code | Xử lý |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `SOURCE_DRIFT` | terminate |
| `NO_PROGRESS` | terminate |
| `CONTRACT_UNFROZEN` | terminate |
| `CONTRACT_WIDENED` | terminate |
| `BUSINESS_AUTHORITY_MISSING` | terminate |
| `OWNER_CONFLICT` | terminate |
| `PATTERN_UNBOUND` | terminate |
| `PROOF_UNAVAILABLE` | terminate |

## Kế tiếp

| Khi | Operator |
| --- | --- |
| contract đã điền xong và các cổng mà bản ghi thay đổi nêu tên phải chạy | `quality.verify` |
| lời hứa phải được đối chiếu với source đã giao | `business.decide` |
| contract đã điền xong và một bề mặt frontend phải tiêu thụ nó | `frontend.direction.decide` |
| một file cần sửa nằm ngoài trần ghi được route | `workspace.bind` |
| một proof đã khai không chạy được trong môi trường này | `platform.operate` |
