# Lượt chạy — full-feature trên lời hứa pro-subscription, vòng 2 (2026-09-03)

Đây là một phiên chạy khô của StarCi Skills 1.0.3 mà lý do tồn tại là bước song song: cái bước mà một
nhánh backend và một nhánh frontend chạy cạnh nhau, được bày ra thành `step-N/parallel-1` và
`parallel-2` dưới một `state.json` duy nhất, mỗi nhánh tự đi qua validator của riêng mình, `validate-step`
chạy trên từng nhánh, và luật "hai nhánh trong một bước không được chung một write alias" được kiểm
trên phiên sống chứ không phải trên file ví dụ. Gốc phiên là
`.worktrees/sessions/20260903-r2-full-feature/`, được giữ lại trên đĩa và bị git bỏ qua theo dòng 107
của `.gitignore`. Một orchestrator cùng một agent cho mỗi operator, tất cả trong một tiến trình.

Mỗi nhánh dưới đây đều nêu profile mà `operator.json` của nó ràng, và trên thực tế Claude Opus đã chạy
thay cho tất cả. Với bốn trong bảy nhánh, việc chạy thay không phải một bước mà là hai: bản 1.0.3 ràng
profile OpenAI ở khắp nơi, nên `workspace.bind` và `backend.source.apply` ràng `luna`, mà tương đương
đã công bố của `luna` trong `profileEquivalents.pairs` là `sonnet` — còn lượt chạy này dùng
`claude-opus-5` cho cả chúng, vì bộ xử lý chỉ có một model. Ba nhánh `business.decide`,
`architecture.decide` và `frontend.direction.decide` ràng `sol-fresh`, tương đương là `opus`, và đó là
những nhánh duy nhất có model chạy khớp với cặp đã công bố. Cây không có chỗ nào để ghi lại chuyện
này, xem R2-3.

Không có commit nào, không có gì được ghi vào hai checkout hay vào worktree businesses, không file
runtime nào trong `.claude` bị sửa, không một lệnh ghi git nào được chạy ở bất cứ đâu, không e2e nào
được chạy, và không bí mật nào bị đọc hay in ra.

## Tóm tắt yêu cầu

| Trường | Giá trị |
| --- | --- |
| Workflow | `full-feature`, chạy đúng như đã viết, kể cả các preset |
| Feature | `pro-subscription` — head nghiệp vụ `.worktrees/businesses/features/pro-subscription/model.json`, địa chỉ nội dung `eccaeaadb6a4…`, trạng thái `pending` |
| Target backend | `src/modules/bussiness/pro-subscription`, checkout `D:/Repositories/starci-academy-backend` |
| Target frontend | `/[lang]/subscriptions`, checkout `D:/Repositories/starci-academy-fe` |
| Head backend đóng băng | `90ef7fcb8dfbe83129af877e15a2c5fc029358de` (nhánh `mtp`, chỉ bẩn dưới `.workspaces/projects/tayson`) |
| Head frontend đóng băng | `8d8ed9a1456e1e8ef9d1d6fd80a41c20a520d3a2` (nhánh `main`, sạch) |
| Chuỗi đã công bố | bind ×2 → business (model) → architecture → [backend apply ∥ direction] → [quality ∥ resolve] → apply → audit → quality → business (reconcile) → publish |
| Chuỗi chạy thật | bước 1 `[1/1 bind be, 1/2 bind fe]` → bước 2 `[2/1 bind fe, chạy lại]` → bước 3 `[3/1 business.decide]` → bước 4 `[4/1 architecture.decide kèm critique]` → bước 5 `[5/1 backend.source.apply dry ∥ 5/2 frontend.direction.decide]` |
| Dừng ở | bước 5, cả hai nhánh đều blocked và đều trả về cho một con người: `CONTRACT_UNFROZEN` (miền contract → user) và `CHANGE_LEVEL_AMBIGUOUS` (miền caller → user) |
| Ghi đè | đúng một, theo chỉ dẫn của người gọi: `backend.source.apply` chạy `mode: dry`, thứ mà workflow không đặt sẵn. Mọi thứ còn lại chạy trên chính preset của workflow, kể cả hai preset đã sinh ra hai điểm dừng giá trị nhất của lượt chạy |

Mã phiên là `20260903-r2-full-feature` chứ không theo dạng
`<yyyymmdd-HHMMss>-<project>-<operator đầu tiên>` mà `resources/orchestrator.json` công bố; chủ bài
kiểm cố định gốc phiên, và trong cây không có gì đọc hay kiểm mã phiên cả, xem R2-8.

## Bước 1 — `workspace.bind` hai nhánh, bước song song đầu tiên

Hai nhánh của một bước, cùng là `workspace.bind`, được điều phối cùng lúc: `1/1` ràng `be` với
`runtimeNeed: none`, `1/2` ràng `fe` với `runtimeNeed: consume`, đúng như bước đầu của `full-feature`
đặt sẵn. Không nhánh nào ghi ra ngoài `response/` của chính nó, nên tập write alias của cả hai đều
rỗng, giao của chúng rỗng, và hai agent chạy song song là hợp lệ dưới trần `maxConcurrentAgents: 3`.
`operator.json` ràng profile `luna`, tương đương `sonnet`; Claude Opus chạy cả hai.

Nhánh `1/1` kết thúc `done` với cả bốn lệnh kiểm đều xanh: `request valid`, `response valid`,
`step valid` và `valid workspace.bind branch`. Hai nửa route đồng ý với nhau về project, role, kho và
nhánh, nên chính checkout Source ràng tại `90ef7fcb…` trên `mtp`. Khai báo portable
`.workspaces/projects/starci-academy/be.json` không mang `gitPolicy` nào cả, nên cách đọc thận trọng
ràng `worktreeBranches: forbidden` và `mutationReadiness: read-only`. Route đã hydrate vẫn ghi
`d5926ae8…`, chậm một commit; head quan sát được mới là ràng buộc, còn bản ghi cũ chỉ là chủ thể của
một finding chứ không phải thứ để tính lại cho khớp. Hai write root được khai: `src`, đường sản phẩm
duy nhất mà một lượt backend apply về sau sẽ ghi, và `.workspaces/projects/tayson`, thứ hoàn toàn
không phải ý định ghi mà chỉ là trường duy nhất operator cho phép dùng để dung thứ mấy file khai báo
route chưa commit của người dùng — đúng cái miễn trừ mà vòng 1 đã phải nghĩ ra, và vẫn là cùng một
khoảng trống.

Nhánh `1/2` thì `blocked` với `RUNTIME_NOT_READY`, và cả bốn lệnh kiểm vẫn xanh, vì một `blocked` hợp
lệ là xanh: hai gate chỉ đòi output bắt buộc ở nhánh `done`, còn validator riêng của `workspace.bind`
thêm luật rằng nhánh blocked không được mang route, điều nhánh này tuân đúng. Registry
`.worktrees/sessions/central-runtime/owner.json` quảng cáo generation 6, trạng thái `ready`, frontend
`http://localhost:3000`, api `http://localhost:3001`, identity `http://localhost:8080`, chứng thực lần
cuối lúc 2026-09-01T19:54Z tại head frontend `5fe51662…`. Phép dò bác bỏ điều đó: cả ba endpoint đều
trả `000`, không có tiến trình nào lắng nghe, và head được chứng thực cũng không phải head đang được
route (`5fe51662…` so với `8d8ed9a1…`). Registry là cũ chứ không phải sẵn sàng, operator này không bao
giờ khởi động một tiến trình dùng chung, nên miền `runtime` định tuyến `external`. Đây là R2-4, và nó
là bản sửa của vòng 1 chỉnh quá tay: `runtimeNeed: consume` được thêm vào lần bind fe ở bước 1 để bước
audit thứ 7 có cái mà chụp, và hệ quả là cả năm workflow chạm tới frontend giờ đều chết ngay ở bước
đầu tiên của chính mình mỗi khi không có preview nào tình cờ đang chạy.

## Bước 2 — `workspace.bind`, lượt chạy lại của `1/2`

Con người trả lời điểm dừng external đúng như `session.lifecycle.block` trong
`resources/orchestrator.json` quy định: cấp cho đúng cái trường mà điểm dừng gọi tên. Delta là một yêu
cầu duy nhất, `runtimeNeed` từ `consume` thành `none`, nên lượt chạy lại mang theo thay đổi thật chứ
không phải cùng một đầu vào hai lần. Nhánh vào lại thành `2/1` với
`resume { step: 1, parallel: 2, token: step-1-parallel-2-runtime-not-ready }`, còn nhánh blocked ở lại
trên đĩa làm bằng chứng. Cả bốn lệnh kiểm xanh.

`starci-academy/fe` ràng vào checkout sibling tại `8d8ed9a1…` trên `main`, sạch, không endpoint nào, và
`authorityRoots.businesses` là null, điều đúng với một checkout sibling. Biên nhận nói thẳng cái giá
của delta thay vì giấu: không có runtime nào được ràng thì bước audit phía sau chuỗi này không có gì
để chụp. `mutationReadiness` ở đây là `ready` còn ở nhánh be là `read-only`, quyết trên cùng một trục —
khai báo fe mang `worktreeBranches: session-only`, khai báo be không mang chính sách nào — và validator
chấp nhận cả hai giá trị trong cả hai trường hợp, nên O11 của vòng 1 vẫn mở và giờ hiện ra thành hai
câu trả lời khác nhau trong cùng một phiên, xem R2-9.

## Bước 3 — `business.decide`, chế độ `model`

Profile ràng là `sol-fresh`, tương đương `opus`; Claude Opus chạy. Nhánh `done`, không stop, không
fallback, và cả bốn lệnh kiểm xanh, trong đó `valid business.decide branch` là luật riêng của operator.

Lời hứa được mô hình hoá tại `90ef7fcb…`. Vòng 1, lượt `backend-feature` đã mô hình hoá đúng feature
này tại `d5926ae8…`, và việc ràng lại 22 claim của nó vào head mới là chứng minh chứ không phải giả
định: `git diff --stat d5926ae8..90ef7fcb -- src` rỗng, commit duy nhất giữa hai head chỉ sửa
`.workspaces/projects/starci-academy/fe.json` và không gì khác, và hai claim đã được đọc lại tận nơi ở
head mới (`pro-subscription.service.ts:60-67` và `graphql-must-enrolled.guard.ts:42-64`). Mười lăm
chiều đều mang đúng một disposition — bảy `replace` hoặc `preserve` dựa trên chứng cứ thuận và nghịch
thật, sáu `defer` về đúng những pha mà chính head đã công bố gọi tên, không chiều nào bị đánh dấu
`not-applicable`. Các fingerprint được tính lại cho phiên này và nhất quán bên trong: `claims.fingerprint`
là sha256 của mảng claim, `coverage-matrix.fingerprint` là sha256 của mảng row, còn `model.json` mang cả
hai cộng thêm `headFingerprint` phủ lời hứa, trạng thái, lineage và hai fingerprint kia.

Riêng việc công bố head thì bị giữ lại: bước 8 lẽ ra ghi head xuống `@worktrees/businesses`, mà bài
kiểm cấm ghi vào đó. `response/data/model.json` chính là head lẽ ra được công bố, và `state.json` nói
rõ như vậy. Hệ quả không phải chuyện hình thức, và được ghi thành R2-11: mọi operator phía sau đều ràng
thẩm quyền nghiệp vụ như một **alias Context** chứ không bao giờ như một Input, nên bước 4 và bước 5
đọc cái head `pending` nằm trên đĩa, và không tồn tại đường nào để model của chính nhánh này tới được
tay chúng.

## Bước 4 — `architecture.decide` cùng exchange `critique` lồng bên trong

Profile ràng `sol-fresh`, tương đương `opus`; Claude Opus chạy. Nhánh đi qua `waiting` rồi tới `done`,
và có nhận một fallback là `COMPATIBILITY_UNVERIFIED`. Nó quan sát hiện trạng tại head đóng băng, đào
sâu phương án duy nhất `single-effective-access-collaborator`, rồi dừng đúng như bước 8 của operator
quy định: phát ra một response với `status: waiting` và
`awaiting { exchange: critique, kind: independent-critique }`. Ảnh chụp lúc dừng ấy được giữ cạnh nhánh
dưới tên `step-4-parallel-1-waiting-snapshot.json`, bởi agent khi tỉnh lại sẽ ghi đè
`response/response.json` tại chỗ và cú dừng nếu không sẽ chẳng để lại dấu vết nào — đúng cái mẹo ở tầng
orchestrator mà vòng 1 cũng phải dùng. Sau đó orchestrator viết `critique/request/request.json` với
`stack-model` là input duy nhất và không yêu cầu nào, chạy một agent mới tinh cho nó, rồi đánh thức
agent đang treo khi exchange trả về `done`. Tám đường bất lợi bị tấn công chỉ từ mỗi stack model, và cả
tám đều đứng vững. Sáu lệnh kiểm — hai request, hai response, `validate-step` và validator của operator
— đều xanh; chính `validate-step` mới là cửa làm việc thật ở đây, vì nó đọc bảng Outputs, thấy exchange
`critique` được khai, và kiểm cặp request-response của thư mục đó, từ chối một nhánh `done` mà exchange
đã khai lại không chạy hoặc chưa xong.

Nửa còn lại của tình huống thì không thể diễn được. Yêu cầu là chạy exchange `waiting` *trong khi nhánh
anh em vẫn tiếp tục*, mà `full-feature` không cho nó nhánh anh em nào: bước 3 của chuỗi đã công bố là
`[architecture.decide]` đứng một mình. Đó không phải tai nạn cục bộ. Không một workflow ví dụ nào trong
`workflows/` từng đặt một operator có exchange vào một bước nhiều nhánh — `architecture.decide` đứng
một mình trong `full-feature` lẫn `backend-feature`, `content.generate` đứng một mình trong
`content-unit` — nên câu trong chính operator.md của `architecture.decide`, "Other branches of the same
step keep running throughout", và lời hứa y hệt trong `handoff.waiting` của
`resources/orchestrator.json`, là những khẳng định mà không chuỗi đã công bố nào đem ra kiểm được. Cú
dừng và cú tỉnh lại thì đã được thử ở đây; tính đồng thời quanh chúng thì không, và đó là R2-5.

## Bước 5 — bước song song: `backend.source.apply` ∥ `frontend.direction.decide`

Đây là bước mà tình huống này sinh ra để thử. Cả hai nhánh được điều phối cùng lúc từ `next` của bước
4, vốn gọi tên đúng hai operator ấy và khớp với bảng Next của `architecture.decide`.

Về write alias: `5/1` giữ `@workspaces/be`, độc quyền theo checkout đúng như `concurrency.sharedCheckout`
trong `resources/orchestrator.json`, và vẫn giữ ngay cả dưới `mode: dry`, bởi lease được lấy lúc điều
phối còn chế độ là việc của agent phải tôn trọng. `5/2` không ghi gì ngoài `response/` của chính nó, vì
Boundary của nó nói context là chỉ đọc. Giao của hai tập ghi là rỗng, mà `@workspaces/be` với
`@workspaces/fe` vốn là hai checkout khác nhau, nên hai agent chạy cùng nhau là hợp lệ dưới trần ba
agent. `state.json` ghi lại chính hai tập mà nó đã dựa vào để điều phối, thay vì tuyên bố suông rằng
luật đã được tuân.

Nhánh `5/1`, `backend.source.apply` ở `mode: dry`, dừng với `CONTRACT_UNFROZEN`; cả bốn lệnh kiểm xanh.
Bản 1.0.3 đã thêm chế độ `dry` mà vòng 1 đòi, và nhánh này chạm được tới nó: gate hợp lệ, head quan sát
được bằng đúng `90ef7fcb…` đã đóng băng, bước 1 qua. Bước 2 mới là chỗ nó dừng, và lý do là chuyện cấu
trúc. Operator đóng băng contract của mình từ Input `architecture-decision`, mà không nửa nào của kind
ấy mang một mutation. `stack-model.schema.json` công bố `decisionId`, `selectedAlternativeId`,
`alternatives`, `boundaries`, `stores` và `components`; `architecture-decision.contract.json` công bố
Decision, Current state, Alternatives, Boundaries, Data ownership, Stack delta, Handoff và Fallbacks
taken. Không nửa nào mang một operation có `writerRef`, `transactionBoundary`, `idempotencyKind`,
`migrationRefs` hay `authorityDecisionId` — đúng cái tập mà `mutations.schema.json` đòi ít nhất một, và
đúng cái mà chính lời văn của operator nói rằng nó đọc từ đầu vào đã đóng băng chứ không từ một con
người, bởi "một người gõ lại contract vào request chính là cách contract và bản hiện thực lặng lẽ trôi
xa nhau". Cứ lập kế hoạch bất chấp thì có nghĩa là bịa ra operation và writer của chúng ngay tại đây,
mà đó chính là định nghĩa của `CONTRACT_WIDENED`. Mâu thuẫn còn sắc hơn một trường thiếu:
`architecture.decide` bị dặn rằng handoff của nó gọi tên contract chứ không bao giờ gọi tên file hiện
thực, trong khi `backend-source-apply/validate.mjs:74` kiểm `operation.writerRef` với trần
`mutableFileRefs` — operator sản xuất bị cấm viết ra đúng cái giá trị mà schema tiêu thụ đòi. Ngay sau
bức tường ấy còn một bức nữa: mỗi operation phải trích ít nhất một `authorityDecisionIds` khớp
`^BA-[0-9]+$`, mà không nhà sản xuất nào trong cả cây phát ra một định danh như thế. Xem R2-1 và R2-2.

Nhánh `5/2`, `frontend.direction.decide`, dừng với `CHANGE_LEVEL_AMBIGUOUS`; cả bốn lệnh kiểm cũng
xanh. Workflow đặt sẵn cho nhánh này `intent: create, changeLevel: new`, và `when` của nó nói chuỗi này
dành cho một feature cần *một bề mặt frontend mới*. Bề mặt của nhiệm vụ này không mới. Tại head đóng
băng, checkout đang mang `src/app/[lang]/subscriptions/page.tsx`, mount
`src/components/pages/ProSubscriptionPage`, nơi kết hợp
`src/components/blocks/commerce/ProSubscriptionBlock`; file route được viết lần cuối ngày 2026-09-02
trong commit `82b9e9af`, và vòng 1 đã chạy `frontend-refine` trên đúng bề mặt ấy. Vì thế bước 2 không
thể phân giải thẩm quyền change level: `create` chỉ xảy ra cùng `new` và không cùng gì khác, `new` đóng
tập trạng thái trước khi vẽ bất cứ thứ gì, và bước 4 lẽ ra phải quan sát được rằng target vắng mặt.
Operator không tự dàn xếp bằng cách lặng lẽ hạ mình xuống `reconstruct` — change level là thẩm quyền của
chính request, và không operator nào viết lại yêu cầu của mình — cũng không vẽ lại một trang đã tồn tại
chỉ vì một preset bảo thế. Đây là lúc cây hành xử đúng, và cũng là lúc G4 của vòng 1 quay lại có răng:
không chỗ nào nói một người gọi có được ghi đè preset hay không, nên một `when` khớp nửa vời biến thành
một điểm dừng của operator ba bước sau, thay vì một lời từ chối ngay ở Setup, xem R2-6.

Bước ấy được phân giải như sau: cả hai nhánh đều blocked, độc lập với nhau, về hai miền khác nhau —
`contract` → `user` và `caller` → `user` — và không nhánh nào blocked vì nhánh kia. Bước không tiến đi
đâu cả: bước 6 của `full-feature` là `frontend.presentation.resolve` được nuôi bằng một direction không
tồn tại, còn nhánh thứ hai của chính bước 5 là `quality.verify` thì chẳng có gì được ghi để mà kiểm.
Trạng thái phiên là `blocked`, thư mục được giữ lại, và hai câu hỏi chứ không phải một được trả về cho
con người. Các bước 6 đến 10 của chuỗi không bao giờ được điều phối.

## Bước song song hiện ra trong `state.json` như thế nào

`state.json` là nơi duy nhất ghi lại nước đi của chính orchestrator, nên các `transitions` nó mang là
dạng đọc được của mọi thứ ở trên. Với bước 5, nó lần lượt ghi một mục `dispatch` liệt kê hai nhánh
`5/1` và `5/2` cùng `writeAliases` của chúng — `["@workspaces/be"]` và `[]` — kèm ghi chú rằng giao của
hai tập là rỗng nên cả hai chạy song song; rồi hai mục `blocked`, một mang `CONTRACT_UNFROZEN` với miền
`contract` định tuyến `user`, một mang `CHANGE_LEVEL_AMBIGUOUS` với miền `caller` cũng định tuyến
`user`; rồi một mục `resolved` nói rằng bước này blocked, hai nhánh chặn độc lập, mỗi nhánh về một con
người, bước không tiến đi đâu và phiên dừng lại với hai câu hỏi mở thay vì một. Bảng `leases` của bước
ghi `5/1` là `backend.source.apply@luna/run-by-claude-opus` giữ `@workspaces/be`, còn `5/2` là
`frontend.direction.decide@sol-fresh/run-by-claude-opus` không giữ gì.

Bước song song đầu tiên được phân giải theo hướng ngược lại và được ghi cùng một khuôn: `1/1` `done`,
`1/2` `blocked` với `RUNTIME_NOT_READY` định tuyến `external`, rồi một mục `person-decision` và lượt
chạy lại thành `2/1`. Cả `chain` lẫn `steps` đều mang `1/1` và `1/2` như một bước, và chính điều đó
khiến hai nhánh là một bước chứ không phải hai.

Mọi thứ trong khối ấy đều không được kiểm. Không schema nào phủ `state.json`, không script nào đọc nó
ngoài phép so hash request bên trong `validate-request.mjs`, và `transitions` là một trường lượt chạy
này tự nghĩ ra vì không còn chỗ nào khác để ghi một bước đã phân giải ra sao, xem R2-8. Phép so hash
thì có làm việc thật: `validate-request.mjs` tính lại từng `request/request.json` và đối chiếu với
`state.json.requestHashes` ở mọi lần chạy phía trên, nên một request bị sửa sau khi điều phối đã chết
ngay tại gate.

## Khiếm khuyết và đề xuất sửa

**R2-1 — `architecture-decision` không diễn đạt nổi một mutation contract, nên `backend.source.apply`
không bao giờ ràng được contract nào.** Bằng chứng là nhánh `5/1`. `mutations.schema.json` đòi
`operations` với `minItems: 1`, mỗi cái mang `operationId`, `name`, `transport`, `writerRef`,
`storeRefs`, `transactionBoundary`, `idempotencyKind`, `migrationRefs`, `authorityDecisionIds`,
`facets` và `proofKinds`, trong khi `stack-model.schema.json` đặt `additionalProperties: false` và
không có khoá `operations`, còn `architecture-decision.contract.json` không có mục `## Operations`. Đề
xuất: thêm mảng `operations` vào `required` và `properties` của `stack-model.schema.json` với đúng hình
dạng operation của `mutations.schema.json` trừ `facets` và `proofKinds`; thêm vào
`architecture-decision.contract.json` mục `## Operations` với bảng
`| Operation | Transport | Writer | Stores | Transaction | Idempotency | Decisions |` và các ràng buộc ô
y như bảng Operations của biên nhận backend; thêm nó vào cột Writes của bước 7 trong
`architecture-decide/operator.md`; và thay câu "The handoff names contracts, never implementation
files" bằng câu nói rõ writer của mỗi operation là đường file duy nhất operator này có gọi tên, bởi
bản hiện thực không được tự chọn writer cho mình. Bản sửa hẹp hơn — cho `backend.source.apply` một
Requirement `operations` — là điều chính operator ấy phản đối, nên chỉ dùng nếu cách trên bị bác.

**R2-2 — định danh quyết định nghiệp vụ `BA-<n>` không có nhà sản xuất nào trong cây.**
`grep -rn "BA-" .claude/templates/kinds/` chỉ khớp hai file tiêu thụ phía backend là
`mutations.schema.json:47` và `backend-source-application.contract.json:6`, trong khi `business.decide`
phát ra claim id dạng slug, coverage row khoá theo `dimension`, và một `model.json` không có danh sách
quyết định nào. Đề xuất: biến ma trận coverage thành không gian địa chỉ ấy — thêm `decisionId` với
`pattern: "^BA-[0-9]+$"` vào `required` và `properties` của `coverageRow` trong
`coverage-matrix.schema.json`, và thêm vào bước 5 của `business-decide/operator.md` câu: mỗi hàng được
đóng băng mang địa chỉ `BA-<n>`, đánh theo thứ tự ở lần công bố đầu tiên, không bao giờ đánh lại số hay
dùng lại số, ma trận sau chỉ nối thêm số mới và giữ nguyên nghĩa số cũ.

**R2-3 — không ghi lại được việc chạy thay profile, dù `orchestrator.json` bắt phải ghi.** Luật
`profileEquivalents` nói response.json ghi cả `boundProfile` lẫn `ranProfile`, còn
`templates/step/response.schema.json` đặt `additionalProperties: false` và không khai khoá nào trong
hai khoá đó, nên cả bảy nhánh của lượt chạy này không ghi được ràng buộc ở đâu trong luồng, và bản báo
cáo văn xuôi này là chỗ duy nhất cặp profile tồn tại. Đề xuất: thêm hai thuộc tính chuỗi
`boundProfile` và `ranProfile` vào `properties` và vào `required` của `response.schema.json`, rồi cho
`validate-response.mjs` đối chiếu `boundProfile` với `operator.json.resources.profile` và, khi
`ranProfile` khác, đối chiếu tiếp với `profileEquivalents.pairs`.

**R2-4 — năm workflow tự bảo đảm rằng chúng không khởi động được nếu không có preview đang chạy.**
Bằng chứng là `1/2` chết trước khi có bất kỳ việc sản phẩm nào; runtime chỉ *cần* tới ở bước
`frontend.surface.audit`, sáu bước sau đó. Preset `"runtimeNeed": "consume"` nằm ở
`full-feature.json:20`, `frontend-new-surface.json:20`, `frontend-reconstruct.json:14`,
`frontend-refine.json:14` và `frontend-with-uat.json:20`. Đề xuất: đặt lần bind frontend ở bước 1 của cả
năm file về `"runtimeNeed": "none"`, và chèn ngay trước bước `frontend.surface.audit` một bước
`[{ "operator": "workspace.bind", "requirements": { "role": "fe", "runtimeNeed": "consume" } }]`. Khi
đó bước audit mới là chỗ chết vì thiếu runtime, và đó là miền của `platform.operate`, một chỗ dừng
đúng đắn.

**R2-5 — không chuỗi đã công bố nào thử được một exchange lồng cạnh một nhánh anh em đang chạy.** Hai
operator duy nhất có exchange là `architecture.decide` với `critique` và `content.generate` với
`review`, và cả hai đều luôn đứng một mình trong mọi workflow ví dụ. Đề xuất hai dòng, không đẻ luật
mới: trong `architecture-decide/operator.md`, đổi câu về nhánh anh em thành câu có mệnh đề điều kiện
"khi workflow cho bước ấy nhiều hơn một nhánh — mà chưa workflow công bố nào làm thế"; và trong
`tests/README.md`, ghi ở dòng vòng 2 rằng tính chất "chờ cạnh một nhánh anh em" chưa được thử và cần
một chuỗi tự soạn chứ không phải một ví dụ mới thử được.

**R2-6 — một workflow có `when` khớp nửa vời vẫn chạy, và không gì nói preset có được ghi đè hay
không.** `when` của `full-feature` nói "a new frontend surface" còn bề mặt của nhiệm vụ đã tồn tại;
chuỗi vẫn chạy theo chỉ dẫn của người gọi và sự lệch pha nổi lên bốn bước sau dưới dạng
`CHANGE_LEVEL_AMBIGUOUS`. Riêng lượt này còn ghi đè `mode` của `backend.source.apply` thành `dry` mà
không luật nào cho phép lẫn cấm, đúng G4 của vòng 1. Đề xuất: thêm vào `workflows/README.md`, ngay sau
mục 2, đoạn nói rằng một workflow chỉ chạy khi mọi mệnh đề trong `when` của nó còn đúng; khi người gọi
ghim một workflow có `when` khớp nửa vời hoặc ghi đè một preset thì trường bị ghi đè và giá trị của nó
phải được gọi tên trong request và ghi vào `state.json.overrides`, `when` không còn chứng nhận cho
chuỗi nữa, và mọi điểm dừng sinh ra từ cú ghi đè thuộc về người gọi.

**R2-7 — chạy một operator ghi source lên một ràng buộc chỉ đọc là chuyện không có luật, và `dry`
không được miễn trừ.** `sourceWrites.policy` viết rằng một route khai `forbidden` thì ràng chỉ đọc và
không operator ghi source nào được chạy lên nó; khai báo be không mang `gitPolicy` nào nên bind ra
`forbidden`, vậy mà `5/1` vẫn được điều phối, hợp lệ về thực chất vì `dry` không ghi gì, và phạm luật
theo đúng câu chữ. Cũng không có mã dừng nào cho "ràng buộc được route là chỉ đọc". Đề xuất: nối vào
`sourceWrites.policy` mệnh đề nói rằng dưới `mode: dry` operator không ghi gì nên được chạy trên một
ràng buộc chỉ đọc và biên nhận phải ghi lại ràng buộc nó đã đọc; và về phía workspace,
`.workspaces/projects/starci-academy/be.json` nên mang `gitPolicy` tường minh như file fe anh em của
nó.

**R2-8 — `state.json` vẫn không được kiểm, và giờ mang cả những trường không ai định nghĩa.** Đây là
G6 của vòng 1, còn nguyên. Lượt này tự thêm `transitions` và `writeAliases` vì không còn chỗ nào ghi
một bước song song đã phân giải ra sao, còn `status`, `workflow` và `note` cũng chẳng ai kiểm; mã phiên
không theo dạng đã công bố và không gì nhận ra. Đề xuất: thêm `templates/step/state.schema.json` với
`required` gồm `id`, `project`, `startedAt`, `status`, `workflow`, `chain`, `steps`, `current`,
`leases`, `requestHashes`, `status` là enum `running|waiting|blocked|done`, `chain` là mảng của mảng
`^\d+/\d+$`, `steps` ánh xạ cùng mẫu ấy sang một operator id, `leases` ánh xạ sang `{agent, holds}`,
cộng `transitions` và `overrides` tuỳ chọn; rồi thêm `scripts/validate-session.mjs` kiểm manifest theo
schema đó, kiểm mọi mục của `chain` đều có thư mục nhánh và có mục trong `steps`, và kiểm không hai
nhánh nào của một bước khai `holds` giao nhau. Chính phép kiểm cuối là thứ tình huống này phải làm bằng
mắt.

**R2-9 — `mutationReadiness` vẫn không có cách suy ra nào được nêu.** `1/1` ghi `read-only` còn `2/1`
ghi `ready`, trong cùng một phiên, trên cùng một điều kiện nhánh; phân biệt thật sự được dùng là khai
báo có mang `session-only` hay không, và validator chấp nhận cả hai. Đề xuất: thêm vào hàng bước 4 của
`workspace-bind/operator.md` câu nói rằng mutation readiness là `ready` chỉ khi nhánh quan sát được
trùng nhánh mutation đã khai *và* chính sách được route công bố một đường ghi (`session-only`), mọi
ràng buộc khác là `read-only`; rồi để `workspace-bind/validate.mjs` tự suy ra thay vì chấp nhận.

**R2-10 — `reason` là toàn bộ văn xuôi mà một nhánh blocked có, và nó không nằm trong biên nhận nào.**
Cả hai nhánh của bước 5 đều blocked nên không nhánh nào phát ra được biên nhận markdown, vì các contract
đòi những mục mà một nhánh blocked không điền nổi — đúng O3 của vòng 1, gặp thêm hai lần nữa. Trường
`reason` đã làm tròn việc, nên đề xuất không đụng vào nó mà chỉ thêm một dòng vào mô tả bản ghi lượt
chạy trong `tests/README.md`: `reason` của một nhánh blocked phải được thuật lại trong bản ghi, vì đó
là văn xuôi duy nhất nhánh ấy sinh ra.

**R2-11 — một head nghiệp vụ bị giữ lại hoặc chưa công bố không có đường nào tới các operator cần
nó.** `business.decide` công bố head vào `@worktrees/businesses/<featureId>`, còn hai operator phía sau
đều ràng alias ấy như Context chứ không bao giờ như Input; trong phiên khô này việc công bố bị giữ lại
nên bước 4 và 5 ràng head `pending` trên đĩa trong khi `model.json` của bước 3 nằm cách đó hai thư mục,
không đường nào với tới. Hình dạng ấy cũng xuất hiện trong một lượt chạy thật mỗi khi việc công bố bị
từ chối hoặc hoãn. Đề xuất: thêm vào bảng Inputs của cả hai operator hàng `model` từ `business.decide`,
không bắt buộc, kèm một câu ở hàng Context của mỗi bên rằng khi phiên có Input `model` thì nó là thẩm
quyền còn alias chỉ là bằng chứng.

## Trên đĩa còn lại gì

`.worktrees/sessions/20260903-r2-full-feature/` được giữ lại, gồm `state.json`, ảnh chụp lúc treo
`step-4-parallel-1-waiting-snapshot.json`, và bảy nhánh trải trên năm bước — `step-1/parallel-1`,
`step-1/parallel-2`, `step-2/parallel-1`, `step-3/parallel-1`, `step-4/parallel-1` cùng thư mục
`critique/` của nó, `step-5/parallel-1` và `step-5/parallel-2` — mỗi nhánh có `request/request.json` và
`response/` của mình. Checkout backend nguyên vẹn tại `90ef7fcb8dfbe83129af877e15a2c5fc029358de` trên
`mtp`, chỉ bẩn ở đúng hai file `.workspaces/projects/tayson` vốn đã bẩn từ trước; checkout frontend
nguyên vẹn và sạch tại `8d8ed9a1456e1e8ef9d1d6fd80a41c20a520d3a2` trên `main`; worktree businesses y
như cũ, `features/pro-subscription/model.json` vẫn ở head `pending`. Không file nào dưới `.claude/` bị
ghi ngoài bản báo cáo này và bản tiếng Anh của nó.
