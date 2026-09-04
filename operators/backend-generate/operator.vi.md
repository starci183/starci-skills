# backend.generate

## Việc

Sinh một kết quả backend bên trong một contract mutation đã đóng băng, theo đúng họ anh em quan sát
được, đầy đủ hoặc như một fix trong cỡ fix của orchestrator, và trả về biên nhận conformance cùng
proof đo được cho thấy ranh giới không bị nới ra.

## Xong khi

Xong khi, dưới mode apply, `backend-source-application` cùng `changes` của nó ghi nhận đúng một
commit trên nhánh phiên mà `mutations` nhắc lại nguyên vẹn mọi operation của contract và ghi từng
file bị chạm với hash trước và sau, mọi facet đã khai có bản ghi `conformance` và mọi proof đã khai
có bản ghi `proof` đã đạt, và mọi đường dẫn ghi ngoài ranh giới owner mang dòng nới rộng của nó;
hoặc, dưới mode dry, `mutations` mang các operation nó sẽ điền và các đường dẫn nó sẽ chạm với
commit null, không hash sau, không `conformance` và không `proof`, và checkout không bị đụng tới;
hoặc, khi request thu hẹp scope thành fix, mọi điều trên vẫn đúng theo mode nó nêu với `mutations`
chạm không nhiều path hơn cỡ fix của orchestrator cho phép và không có dòng nới nào cả.

## Contract đóng băng trước lần ghi đầu tiên

Contract tới dưới dạng Đầu vào `architecture-decision`, có fingerprint và đã đóng. Các operation,
writer, store, ranh giới giao dịch, kiểu idempotency và migration mà nó liệt kê là tập đầy đủ mà phần
cài đặt được chạm, và operator này chỉ trả lời một câu hỏi cho mỗi operation: đoạn code đang tồn tại
có làm đúng điều contract nói không, và phép đo nào cho thấy điều đó. Các operation không phải một
Yêu cầu, vì việc một người gõ lại contract vào request chính là cách contract và phần cài đặt lặng lẽ
tách nhau; bước 3 đọc chúng từ đầu vào đã đóng băng và ghi lại vào `response/data/mutations.json`. Ba
điều cấm gánh phần đó, và mỗi điều được cưỡng chế chứ không phải khuyên. Một operation, writer, store,
giao dịch, migration hay event nằm ngoài contract là `CONTRACT_WIDENED`, trả về cho chủ contract trước
mọi lần ghi vào sản phẩm. `mutableFileRefs` là ranh giới chủ sở hữu, gồm path chính xác hoặc glob nêu
những gì kết quả được chạm; một path mà kết quả thực sự đòi nằm ngoài mọi ranh giới thì được ghi và
được ghi nhận là một lần nới — `OWNER_WIDENED` dưới `## Fallbacks taken`, path cùng ranh giới gần nhất
và lý do dưới `## Widened`, và `widened: true` trên bản ghi thay đổi của nó — nên biên nhận khiến mọi
lần nới đều kiểm được từ diff. Một lần nới không bao giờ im lặng và không bao giờ vượt qua một ref
được bảo vệ: một thay đổi bắt buộc nằm trong `protectedRefs`, một path đã ghi mà không hàng `## Widened`
nào thừa nhận, hay hai tập chủ sở hữu chồng nhau là `OWNER_CONFLICT`. Một quy ước mà không pattern anh
em nào đã ràng công bố thì bị từ chối và ghi lại là `NEW_CONVENTION_REFUSED`, còn một khía cạnh không có
pattern nào cả là `PATTERN_UNBOUND`. Phát hiện giữa chừng rằng kết quả cần một contract rộng hơn là
cách kết thúc dự kiến của operator này, không phải sự nhụt chí: chủ contract mở lại và đóng băng lại,
rồi cùng kết quả ấy được cài đặt lại theo fingerprint mới. Với tay ra ngoài contract không phải là thay
đổi nhỏ hơn việc mở lại nó; nó là cùng một thay đổi nhưng không có dấu vết, và đó cũng là lý do một path
đã nới chẳng đáng gì cho tới khi hàng ghi của nó tồn tại.

Migration độc lập tuân theo
[`stack-model.schema.json#/$defs/migrationOperation`](../../templates/kinds/stack-model.schema.json#/$defs/migrationOperation).
Với contract chứa loại này, orchestrator đặt `contractFingerprint` bằng SHA-256 của đúng byte
`stack-model.json` từ producer trước khi đóng băng request. Gate request kiểm producer kiến trúc đã
hoàn tất, phản biện, fingerprint và trần file writer/migration. Gate kết quả đối chiếu mọi trường
operation với cùng producer; output không tự thay thẩm quyền của nó. Contract import được kiểm với
producer gốc đã xác minh, gồm phản biện gốc. Conformance migration và proof replay vẫn áp dụng; viết
source không cấp quyền áp migration vào môi trường dùng chung.

## Fix là một scope, không phải một operator khác

`scope` nói lần chạy này điền bao nhiêu phần của contract. `full` điền mọi operation mà contract mang.
`fix` sửa một kết quả bên trong một contract đã điền: nó chạm không nhiều path hơn cỡ fix của
orchestrator cho phép — con số nằm trong tài nguyên của chính orchestrator dưới tên `fixSize`,
validator đọc ở đó khi nó có mặt, và operator này không ghi cứng ngưỡng nào — và nó không nới gì cả,
không nới contract lẫn ranh giới owner, vì một lần sửa cần contract rộng hơn thì không phải một lần
sửa; dưới `fix` một path ngoài mọi ranh giới là `OWNER_CONFLICT` và `OWNER_WIDENED` không bao giờ
được lấy. Mọi thứ khác giữ nguyên dưới cả hai scope.

## Không ghi gì bên ngoài một phiên

Trước khi một byte nguồn được route bị đọc để sửa hay bị ghi, nhánh mà operator này chạy trong đó đã
tồn tại: một thư mục phiên có `state.json` và `step-N/parallel-M/request/request.json` của chính nhánh
ấy, xanh dưới `validate-request`. Thứ tự đó chính là lý do phiên tồn tại — request nói được phép chạm
vào cái gì trước khi có gì bị chạm, và mọi biên nhận sau đều treo vào nó. Một lần gọi phát hiện mình
sắp sửa nguồn được route mà không có `step-N/parallel-M` nào dưới một phiên thì dừng với
`SESSION_MISSING` và báo lại; nó không dựng thư mục phiên ngược về sau, vì một phiên viết sau khi việc
đã xong là bản ghi của việc chứ không phải cổng chặn việc, và không thứ gì trong đó từng được kiểm
lại với những gì thực sự đã làm.

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

## Chế độ dry ghi bản kế hoạch, không ghi cây

`mode` quyết lượt chạy này có chạm vào checkout hay không. Dưới `apply`, operator điền contract,
commit một lần, và mọi điều bên dưới đúng y như đã viết. Dưới `dry`, nó vẫn đọc, vẫn ràng, vẫn chiếu
đúng như vậy, rồi dừng ngay sau bản kế hoạch: `response/data/mutations.json` mang những operation nó
sẽ điền và những file nó sẽ chạm, với `commit` rỗng và không hash sau, `response.json` không ghi
commit nào, và không một byte nào tới `@workspaces/be`. Nhánh vẫn kết thúc `done`, vì một bản kế
hoạch làm thật thà là một câu trả lời trọn vẹn cho một câu hỏi về kế hoạch; `changes.md` của nó liệt
mọi path đã định là `unchanged`, đúng như cây làm việc đang cho thấy, và nêu thay đổi nó sẽ làm ở cột
`Why`. Một lượt dry không đo gì cả, nên nó không mang bản ghi conformance và không mang bản ghi
proof: không thể đo một facet trên đoạn code chưa từng được viết, và một bản kế hoạch mà ship kèm
phán quyết thì không phân biệt nổi với một lần cài đặt thật. Một lượt dry cũng không được cấp `@tools/sourcewrite` lẫn
`@tools/git`, vì một chế độ không ghi gì thì không cần công cụ nào ghi được; phần cấp quyền và đoạn
này nói cùng một điều nên chúng không thể trôi khỏi nhau. Đó cũng là lý do một lượt dry không bao
giờ là lượt thoả contract — nó là cách đọc trước tập ghi trước khi trả giá cho nó, không phải một
cách áp dụng rẻ hơn.

## Backend không bao giờ bịa hành vi nghiệp vụ

Mỗi operation dẫn các quyết định đã duyệt mà nó cài đặt. Một quyết định đã duyệt không phải con số
operator này được tự đặt: nó là một `dimension` của ma trận phủ thuộc head nghiệp vụ đã ràng, địa chỉ
bằng chính định danh kebab của dimension ấy, và fingerprint của ma trận đi cùng lời dẫn để người đọc
sau biết ma trận nào đã duyệt nó. Một lời dẫn nêu thứ mà ma trận đã ràng không mang thì không phải một
lần duyệt, nó là một phỏng đoán có nhãn. Khi đoạn code tới chỗ câu trả lời phụ thuộc
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

Operator chỉ ghi source sản phẩm bên trong ranh giới chủ sở hữu hoặc bên ngoài nó dưới dạng một lần
nới có ghi nhận mà không ref được bảo vệ nào phủ, chỉ bên trong worktree nhánh phiên của
`@workspaces/be`, và ghi mọi thứ khác vào `response/` của nhánh mình: `response.md`,
`response/changes.md`, `response/data/mutations.json`, một bản ghi conformance cho mỗi facet đã khai,
một bản ghi proof cho mỗi proof đã khai, và `response.json`. Nó không bao giờ thêm một operation,
writer, store, giao dịch, migration hay event mà contract đóng băng không mang, không quyết một luật
nghiệp vụ mà thẩm quyền đã duyệt không nói, không đưa vào một quy ước mà không pattern anh em nào công
bố, không làm yếu, bỏ qua, chặn hay thay thế một proof đã khai để một lượt chạy thành xanh, không sửa
contract, thẩm quyền nghiệp vụ hay một ref được bảo vệ, không ghi một path ngoài ranh giới mà thiếu
hàng `## Widened` của nó, không commit quá một lần, không ghi
lên nhánh mà người đang checkout, không push, merge hay tag gì, không tuyên bố conformance mà không
nêu bằng chứng đã đo nó, và không ghi phán quyết chất lượng, thị giác hay UAT; đó là những việc khác
với cổng riêng của chúng.

Khi đầu vào `model` có mặt, nó là thẩm quyền của lượt chạy này và head đã publish chỉ còn là dòng dõi:
một chuỗi vừa mô hình hoá xong một head không được quyết ngược lại một lời hứa cũ hơn chỉ vì lần
publish bị giữ lại. Khi nó vắng, head đã publish là thẩm quyền.

## Context

| Alias | Bind | Bắt buộc |
| --- | --- | --- |
| `@worktrees/businesses/<featureId>` | head nghiệp vụ đã publish, nguồn duy nhất của hành vi nghiệp vụ; chỉ là bằng chứng khi phiên mang đầu vào `model` | có |
| `@knowledge/patterns/be` | các họ anh em mà thay đổi này bắt chước, mỗi khía cạnh một họ; nguồn quy ước hợp lệ duy nhất | có |
| `@workspaces/be` | checkout backend được route ở head đóng băng, chỉ ghi trên worktree nhánh phiên của nó | có |

## Đầu vào

| Kind | Từ đâu | Bắt buộc |
| --- | --- | --- |
| `business-reconciliation` | `business.reconcile`; những sai lệch mà một lần đối chiếu ghi nhận trên source đã giao, sửa dưới scope `fix` mà không nới contract | không |
| `architecture-decision` | `architecture.decide`; contract mutation đã đóng băng mà phần cài đặt điền vào và không được nới, và là nguồn của mọi operation lượt chạy này thuật lại | có |
| `model` | `business.decide`; head mà nhánh đó đã mô hình hoá, khi nó chưa được publish | không |
| `backend-source-application` | một lượt chạy trước của `backend.generate` cho cùng kết quả; lịch sử hồi quy, vắng mặt ở lần đầu | không |
| `units` | `backend.plan`; danh sách module mà nhánh này điền đúng một module dưới scope full, gọi tên bằng `request.unit` | không |

## Yêu cầu

| Field | Kiểu | Mặc định | Hỏi |
| --- | --- | --- | --- |
| `featureId` | id | — | Feature mà head nghiệp vụ đã publish của nó quyết hành vi này |
| `outcome` | prompt | — | Một thứ duy nhất đang được cài đặt, bằng lời của người dùng |
| `mutableFileRefs` | list | — | Ranh giới chủ sở hữu: path chính xác tương đối theo repository hoặc glob (`*` trong một đoạn, `**` xuyên nhiều đoạn) mà source sản phẩm được ghi vào; một path kết quả thực sự đòi nằm ngoài mọi ranh giới thì được ghi và ghi nhận dưới Widened |
| `protectedRefs` | list | empty | Path hoặc glob không bao giờ được ghi, kể cả khi nới: module của chủ sở hữu khác, file sinh tự động, lockfile, migration của feature khác |
| `contractFingerprint` | id | null | SHA-256 của byte stack-model từ producer; orchestrator ràng giá trị này cho contract migration độc lập |
| `mode` | choice | apply | `apply` điền contract rồi commit, `dry` chỉ phát bản kế hoạch và không ghi gì |
| `scope` | choice | full | `full` điền mọi operation của contract; `fix` sửa một kết quả trong cỡ fix của orchestrator, không nới contract và không nới owner |
| `resume` | token | null | Token của nhánh bị chặn khi vào lại sau một mã dừng |

## Các bước

| # | Bước | Tham số | Đọc | Ghi | Dừng với |
| --- | --- | --- | --- | --- | --- |
| 1 | Kiểm gate, chạy lại và xác nhận phiên | `resume`, `mode` | `request/request.json`, `state.json` của phiên và `step-N/parallel-M` của nhánh này, đầu vào `backend-source-application` nếu có, @workspaces/be ở head đóng băng | — | `INVALID_INPUT`, `SESSION_MISSING`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Ràng thẩm quyền, contract và pattern | `featureId`, `contractFingerprint` | đầu vào `model` khi có, nếu không thì @worktrees/businesses/<featureId> ở head đã publish, đầu vào `architecture-decision` làm contract đóng băng và làm nguồn `operations` của nó, @knowledge/patterns/be mỗi khía cạnh một pattern | — | `CONTRACT_UNFROZEN`, `BUSINESS_AUTHORITY_MISSING`, `PATTERN_UNBOUND` |
| 3 | Điền từng operation của contract, trên nhánh phiên, đầy đủ hoặc như một fix | `mutableFileRefs`, `protectedRefs`, `scope` | @knowledge/patterns/be cho từng khía cạnh, @workspaces/be trong ranh giới chủ sở hữu | @workspaces/be/branch/session trong ranh giới chủ sở hữu, hoặc ngoài nó dưới dạng một lần nới có ghi nhận và không bao giờ trong một ref được bảo vệ, dưới một lease độc quyền, @tools/sourcewrite | `CONTRACT_WIDENED`, `OWNER_WIDENED`, `OWNER_CONFLICT` |
| 4 | Đối chiếu mọi mutation với contract đóng băng và ghi nó kèm hash trước và sau | `mode` | @workspaces/be, các file bị chạm và contract đóng băng | `response/data/mutations.json` | — |
| 5 | Kiểm lại snapshot đã lưu khi đọc | — | @workspaces/be, snapshot đã lưu, @knowledge/patterns/be cho các luật trôi sau nó | — | — |
| 6 | Chứng minh từng facet đã khai | — | @workspaces/be, phép đo đứng sau mỗi facet | `response/data/conformance/<operationId>.<facet>.json` | — |
| 7 | Chạy từng proof đã khai | — | @workspaces/be, câu lệnh đã pin của mỗi kiểu proof đã khai | `response/data/proofs/<operationId>.<proofKind>.json`, @tools/shell | `PROOF_UNAVAILABLE` |
| 8 | Commit tập ghi đúng một lần, viết biên nhận và phát | `outcome` | mọi thứ ở trên | @workspaces/be/branch/session thành một commit, `response/changes.md`, `response/response.md`, `response/response.json`, @tools/git | — |

Dưới `mode = dry`, bước 3 chiếu phần điền lên các path đã khai mà không ghi lấy một path nào, bước 4
ghi bản chiếu ấy thành kế hoạch với commit rỗng và không hash sau, bước 5 tới 7 không có gì để đo nên
không phát ra gì, và bước 8 phát biên nhận cùng bản ghi thay đổi mà không có commit. Dưới `apply`,
mọi bước chạy đúng như đã viết. Head được route được kiểm lại ngay trước lần ghi sản phẩm đầu tiên, nên trôi head phát hiện ở đó dừng
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
| `conformance` | `response/data/conformance/<operationId>.<facet>.json` | data | không |
| `proof` | `response/data/proofs/<operationId>.<proofKind>.json` | data | không |

## Dừng

| Code | Xử lý |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `SESSION_MISSING` | terminate |
| `SOURCE_DRIFT` | terminate |
| `NO_PROGRESS` | terminate |
| `CONTRACT_UNFROZEN` | terminate |
| `CONTRACT_WIDENED` | terminate |
| `BUSINESS_AUTHORITY_MISSING` | terminate |
| `OWNER_CONFLICT` | terminate |
| `OWNER_WIDENED` | fallback |
| `PATTERN_UNBOUND` | terminate |
| `PROOF_UNAVAILABLE` | terminate |

## Kế tiếp

| Khi | Operator |
| --- | --- |
| contract đã điền xong và các cổng mà bản ghi thay đổi nêu tên phải chạy | `quality.verify` |
| lời hứa phải được đối chiếu với source đã giao | `business.decide` |
| contract đã điền xong và một bề mặt frontend phải tiêu thụ nó | `interface.generate` |
| một thay đổi bắt buộc nằm trong một ref được bảo vệ, hoặc hai tập chủ sở hữu chồng nhau, và thẩm quyền chủ sở hữu phải được sửa | `workspace.bind` |
| một proof đã khai không chạy được trong môi trường này | `runtime.serve` |
| bản kế hoạch được làm ra dưới mode dry và một người quyết có trả giá cho nó hay không | `user` |
