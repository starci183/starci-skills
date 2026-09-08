# Lượt chạy — backend-feature trên lời hứa Pro subscription (2026-09-03)

Đây là một lượt chạy khô của StarCi Skills v8: một orchestrator cộng một agent cho mỗi operator, tất
cả nằm trong cùng một tiến trình. Session root là `.worktrees/sessions/20260903-dryrun-backend-feature/`,
được gitignore và giữ nguyên trên đĩa để soi lại. Mỗi nhánh đều ghi rõ profile mà `operator.json` của
nó ràng, nhưng trên thực tế mọi nhánh đều do **Claude Opus** chạy thay cho profile đó, nên trong bài
kiểm tra này không có ranh giới profile nào được thử thật; hãy đọc mọi kết luận bên dưới với điều đó
trong đầu. Không có gì được commit, không có gì được ghi vào checkout backend, không có gì được ghi
vào `@worktrees/businesses`, và không một lệnh git ghi nào được chạy ở bất cứ đâu.

## Tóm tắt yêu cầu

| Trường | Giá trị |
| --- | --- |
| Workflow | `backend-feature` |
| Feature | `pro-subscription` — head `features/pro-subscription/model.json` trong worktree businesses, source nằm ở `src/modules/bussiness/pro-subscription/` và các resolver GraphQL quanh nó |
| Head backend đóng băng | `d5926ae857aa4f8c11c53a80d6a764ee92a60149` (`git rev-parse HEAD`, chỉ đọc) |
| Head businesses lúc bắt đầu | địa chỉ nội dung `eccaeaad…40b1`, `authorityStatus: pending` |
| Chuỗi được yêu cầu | 1 `workspace.bind` (be) → 2 `business.decide` (model) → 3 `architecture.decide` (1 phương án, tự động, kèm exchange `critique`) → DỪNG trước `backend.source.apply` |
| Chuỗi thực chạy | 4 nhánh: 1 `workspace.bind` (blocked), 2 `workspace.bind` (resume, done), 3 `business.decide` (done), 4 `architecture.decide` + `critique` (done) |
| Kết thúc | do chủ bài kiểm tra dừng, trước `backend.source.apply`; `quality.verify`, lượt `reconcile` và `git.publish` chưa bao giờ được điều phối |

Các requirement đến từ preset của workflow cộng với default mà mỗi operator tự công bố, và không ai
bị hỏi gì cả. Có bốn trường bắt buộc không có default dùng được nên phải tự suy ra, và mỗi trường đều
được nêu tên đúng chỗ nó xuất hiện: `project` (`starci-academy`), `gitPolicy` (khai báo route BE không
mang chính sách nào), `dimensions` của `business.decide` (head trước đó ra đời trước hình dạng
coverage matrix), và `constraints` của `architecture.decide`.

---

## Bước 1 — `workspace.bind`, parallel-1

Nhánh này **blocked** với stop `CHECKOUT_DIRTY`. `operator.json` ràng profile `sonnet`, còn người chạy
thật là Claude Opus.

```text
$ node scripts/validate-request.mjs <session>/step-1/parallel-1
request valid

$ node scripts/validate-response.mjs <session>/step-1/parallel-1
response valid

$ node operators/workspace-bind/validate.mjs <session>/step-1/parallel-1
valid workspace.bind branch
```

Nhánh chỉ ghi đúng `response/response.json`. Khai báo portable `.workspaces/projects/starci-academy/be.json`
và route đã hydrate `.workspaces/local/routes/starci-academy/be/config.json` đồng ý với nhau về
project, role, repository và branch, còn checkout chính là Source đang ở `mtp`. Nhưng cây làm việc thì
không sạch: `.workspaces/projects/tayson/fe.json` đang bị sửa và `.workspaces/projects/tayson/be.json`
chưa được track. `declaredWriteRoots` là `["src"]`, tức là đường duy nhất mà một `backend.source.apply`
sau này trong chuỗi sẽ ghi, nên cả hai file bẩn đều nằm ngoài các write root đã khai và operator dừng
đúng như luật của chính nó bắt: nó không bao giờ stash, không dọn, không tự nới ranh giới.

`CHECKOUT_DIRTY` mang domain `source`, và `routing.json` trả lời `workspace.bind`/`source` bằng
`{"kind":"resume"}`, nên orchestrator vào lại chính operator đó ở một bước mới. Bước nhảy định tuyến
này là phần duy nhất của vòng lặp chạy đúng như thiết kế mà không cần diễn giải gì thêm. Tuy vậy bản
thân cái stop gần như vô hình: `workspace.bind` không khai output kind nào cho một lượt bị chặn, và
bảng `Findings` của `workspace-route-binding` chỉ nhận sáu mã, không mã nào nói được "cây đang bẩn ở
đây". Một nhánh blocked vì thế chỉ còn là một mã stop và không gì khác.

## Bước 2 — `workspace.bind`, parallel-1 (resume)

Nhánh **done**, không stop, profile `sonnet` và cũng do Claude Opus chạy.

```text
$ node scripts/validate-request.mjs <session>/step-2/parallel-1
request valid

$ node scripts/validate-response.mjs <session>/step-2/parallel-1
response valid

$ node operators/workspace-bind/validate.mjs <session>/step-2/parallel-1
valid workspace.bind branch
```

Nhánh ghi `response/response.md` (kind `workspace-route-binding`), `response/data/route.json` (kind
`route`) và `response/response.json`. Trường duy nhất có thể gỡ một stop `CHECKOUT_DIRTY` là
`declaredWriteRoots`, mà trường này lại làm hai việc cùng lúc: nó vừa là "những đường duy nhất công
việc sau được ghi", vừa là "ranh giới mà bẩn nằm ngoài thì chặn". Không có trường nào để nói "chỗ bẩn
này không phải của tôi và tôi cũng sẽ không ghi vào đó". Để bài kiểm tra đi tiếp, lượt resume khai
`["src", ".workspaces/projects/tayson"]`, và bảng `Write roots` của biên nhận nói thẳng điều đó bằng
lời của chính nó: một sự miễn trừ của phiên chạy khô, không phải một ý định ghi. Đó là một lần bẻ luật,
nó được ghi lại như một lần bẻ luật ở đây và trong biên nhận, và nó là khiếm khuyết hợp đồng sắc nét
nhất mà lượt chạy này tìm được.

Ràng buộc cuối cùng là `starci-academy/be` trỏ vào checkout Source tại
`D:/Repositories/starci-academy-backend`, branch `mtp`, head `d5926ae8…`, repository kind `source`
(nên directory là null), mutation readiness `read-only`, gốc businesses được suy ra là
`<gitRoot>/.worktrees/businesses`, runtime `null` vì `runtimeNeed` là `none`. Ba finding được ghi:
`ROUTE_HYDRATED_FROM_PORTABLE`, `WORKTREE_BRANCH_FORBIDDEN`, `IDENTITY_ROSTER_SEALED`. Route đã hydrate
còn ghi head `4456c4bc8…`, chậm hơn checkout thật hai commit; head quan sát được mới là ràng buộc, còn
bản ghi cũ chỉ nằm trong phần văn xuôi của biên nhận vì không mã finding nào phủ được nó.

`gitPolicy` phải tự bịa ra. Default của requirement là "chính sách mà khai báo route mang theo", nhưng
khai báo portable của BE không mang khối `gitPolicy` nào cả, trong khi bản FE thì có. Cách đọc dè dặt
đã được chọn: `worktreeBranches: forbidden`, `mutationBranch: mtp`. Giữa lượt chạy, chủ repo commit
`90ef7fcb8` đặt route FE thành `worktreeBranches: session-only`, và điều đó phơi ra một vấn đề thứ hai
nằm ở phần khiếm khuyết: `session-only` không thể ghi vào một biên nhận `route` được.

## Bước 3 — `business.decide` (mode `model`), parallel-1

Nhánh **done**, không stop, không fallback. `operator.json` ràng profile `sol-fresh` với quyền
`webSearch` có giới hạn; người chạy là Claude Opus và không có lần tìm kiếm web nào được dùng.

```text
$ node scripts/validate-request.mjs <session>/step-3/parallel-1
request valid

$ node scripts/validate-response.mjs <session>/step-3/parallel-1
response valid

$ node operators/business-decide/validate.mjs <session>/step-3/parallel-1
valid business.decide branch
```

Nhánh ghi `response/response.md` (kind `business-promise-authority`), `response/data/claims.json`,
`response/data/coverage-matrix.json`, `response/data/model.json` và `response/response.json`. **Không
head nào được publish**: bước 8 của operator lẽ ra ghi
`@worktrees/businesses/features/pro-subscription/model.json`, còn phiên khô này không ghi gì vào đó, nên
head *lẽ ra* được publish nằm trong `response/data/model.json`.

Registry ghi `authorityStatus: pending` cho `pro-subscription`, và bảng `LEGAL_TRANSITIONS` chỉ cho
phép hai nước đi ra khỏi `pending` là `pending->in-progress` và `pending->rejected`. Feature này không
bị từ chối — nó đã được xây một nửa trong source — nên trạng thái kế tiếp mà head cho phép là
`in-progress`, và đó là thứ nhánh này mô hình hoá. `implemented` chưa bao giờ là ứng viên, vì validator
từ chối một head implemented mà không có phần đối chiếu với source đã giao, thứ chỉ mode `reconcile`
sinh ra được.

Có 22 claim, tất cả ràng vào `d5926ae8…`: 18 fact trong source được route, 3 intent trích từ head đã
publish, và 1 unknown. Cái unknown mới là điều đáng kể: không có gì trong checkout chuyển một membership
hay một kỳ AI còn hạn thành một kỳ Pro, nên nhánh migration của lời hứa hoàn toàn chưa có hiện thực nào
quan sát được. Không mâu thuẫn nào bị phát hiện nên `CONTRADICTION_UNRESOLVED` không bao giờ nổ.

Ma trận có 15 chiều đã khai, 21 consumer phát hiện được, 3 nhánh vòng đời phát hiện được (`renewal`,
`cancellation`, `expiry`), mỗi chiều đúng một dòng, và không dòng nào bị đánh not-applicable:

| Disposition | Chiều |
| --- | --- |
| `replace` | `actor-eligibility`, `purchase-side-effect`, `idempotency`, `entitlement-consumer`, `denial`, `renewal` |
| `preserve` | `legacy-read`, `legacy-settle` |
| `defer` | `offer-entry`, `read-entry`, `settlement`, `cancellation`, `expiry`, `migration`, `legacy-create` |

Tám dòng có hiệu lực thực thi đều dẫn một positive proof và một negative proof có thật, nằm trong
`effective-learner-access.service.spec.ts`, `pro-subscription.service.spec.ts`, `bussiness.guards.spec.ts`
và `transaction-grant.service.spec.ts`. Bảy dòng deferred bị hoãn vì đúng một lý do: sự thực thi đã có
trong source nhưng không test nào chứng minh nó. Đó chính là khiếm khuyết từ vựng nêu bên dưới — `defer`
là disposition hợp lệ duy nhất cho trạng thái "đã làm nhưng chưa chứng minh", và nó nói nhẹ đi so với
thứ thật sự đã được xây. `legacy-create` là ví dụ rõ nhất: năm đường checkout cũ từ chối tạo đơn mới
ngay khi `legacySalesMode` rời khỏi `legacy`, về bản chất đó là `retire`, nhưng `retire` đòi bằng chứng
đường đã đóng và không test nào cung cấp.

Các finding được ghi lên biên nhận gồm `CONSUMER_SHARED_PROOF` (warning), `PROOF_DEFERRED` (warning),
`MIGRATION_UNIMPLEMENTED` (warning), `LEGACY_COEXISTENCE` (info) và
`NO_DISPOSITION_FOR_UNPROVEN_ENFORCEMENT` (info). Head bị giữ lại mang `state: in-progress`, transition
`pending->in-progress`, head trước được gọi tên bằng địa chỉ nội dung để giữ phả hệ, `coverageFingerprint`
bằng đúng fingerprint của ma trận đã đóng băng, và `reconciliation: null`.

## Bước 4 — `architecture.decide`, parallel-1 (kèm exchange `critique`)

Nhánh **done** với fallback `COMPATIBILITY_UNVERIFIED`. Profile là `sol-fresh`; agent critique ràng
cùng profile đó và cũng do cùng một model chạy — xem khiếm khuyết về tính độc lập của người phản biện.

```text
$ node scripts/validate-request.mjs <session>/step-4/parallel-1
request valid

$ node scripts/validate-response.mjs <session>/step-4/parallel-1      # ở điểm dừng waiting
response valid

$ node scripts/validate-request.mjs <session>/step-4/parallel-1/critique
request valid

$ node scripts/validate-response.mjs <session>/step-4/parallel-1/critique
response valid

$ node scripts/validate-response.mjs <session>/step-4/parallel-1      # sau khi resume
response valid

$ node operators/architecture-decide/validate.mjs <session>/step-4/parallel-1
valid architecture.decide branch
```

Có đúng một lần bị từ chối, và nó xứng đáng:

```text
step-4/parallel-1/response/response.json: fields.independent-critique is not an Output of architecture.decide
```

Bản critique là output của *exchange* chứ không phải của nhánh, nên `fields` của nhánh chỉ được gọi tên
những file không mang tiền tố exchange. Cách sửa là bỏ khoá đó đi, không phải đụng vào `.claude`.

Mục tiêu được yêu cầu — một đường đọc quyền lợi duy nhất cho nội dung Pro — gần như trùng từng chữ với
điều head đã publish tự nói, nên không cần thay thế mục tiêu nào. Hiện trạng quan sát ở head đóng băng
gồm sáu component và sáu boundary, mỗi dòng đều dẫn `path:lines@head`. Phương án duy nhất,
`single-effective-access-collaborator`, được chọn tự động với cost 4, complexity 3 và reversibility 4.

Stack model mô tả sáu boundary cùng interface của chúng và sáu store với writer, reader, migrator,
phạm vi giao dịch, backup và restore. Đúng một store có hai writer là `transactions`, và nó mang phần
biện minh shared-write bắt buộc: cú claim pending-sang-succeeded phải commit bên trong giao dịch của
lượt grant, vì chính điều đó khiến một lần settle trùng trở thành vô hiệu. `postgres-primary`,
`redis-cache` và `bullmq-jobs` được xác minh đủ cả năm trục tương thích bằng bằng chứng thật, còn
`nestjs-framework`, `graphql-api` và `typeorm` chỉ đạt bốn trục và không có bằng chứng backup-restore
nào để đưa ra, vì một component không giữ trạng thái thì không có gì để sao lưu; fallback
`COMPATIBILITY_UNVERIFIED` vì thế đánh cả ba là `replaced-candidate` và đưa trục còn thiếu vào Handoff
dưới dạng unknown.

Bản phản biện là một lượt đọc thứ hai, chỉ được đưa `response/data/stack-model.json` và không gì khác.
Tám đòn tấn công đều `holds` và phán quyết là `keep`. Đòn partial-failure phát hiện model mô tả cú
claim giao dịch hai lần mà không giống nhau; phần biện minh shared-write giải quyết theo hướng một
giao dịch duy nhất, còn cách diễn đạt lỏng lẻo mới là rủi ro. Đòn deletion phát hiện sổ cái append-only
được khai là có người đọc trong khi không interface nào đọc được nó, nên việc dựng lại một kỳ hôm nay
là hành động của người vận hành. Hai phát hiện đó đi thẳng vào Handoff dưới dạng rủi ro có tên, thay vì
bị làm nhẵn đi.

## Bước 5 — `backend.source.apply`: không được điều phối

Lượt chạy dừng ở đây theo yêu cầu của chủ bài kiểm tra. Operator này không có chế độ khô: toàn bộ hợp
đồng của nó là ghi source trên một session branch và ghi lại commit, và không có requirement, fallback
hay stop code nào mang nghĩa "sinh ra tập ghi và không commit gì cả". Vì vậy một lượt chạy khô của
chuỗi `backend-feature` không thể chạm tới `quality.verify`, lượt `reconcile` hay `git.publish` — chuỗi
này không thể kiểm được từ đầu đến cuối nếu không có chế độ khô hoặc một checkout dùng một lần. Dù sao
lượt chạy cũng đã dừng: head backend quan sát được đã dịch chuyển hai lần khi phiên đang mở, nên một
request đóng băng ở `d5926ae8…` sẽ gặp `SOURCE_DRIFT` ngay bước 1 của operator kế tiếp.

---

# Những khiếm khuyết lượt chạy này phơi ra

## Lỗ hổng tri thức

Route BE không khai `gitPolicy`, trong khi default của `workspace.bind` lại là "chính sách mà khai báo
route mang theo" và bản FE thì có khối đó; không chỗ nào trong cây nói một chính sách vắng mặt nghĩa là
gì, nên orchestrator phải tự bịa `forbidden`/`mtp` và hai lượt chạy khác nhau có thể bịa khác nhau cho
cùng một route. Tương tự, không có nguồn nào cho bề mặt phủ đầu tiên: `dimensions` mặc định lấy theo
"các chiều của head trước", nhưng head trước ở đây là một tài liệu `schemaVersion: 1` không hề có trường
`dimensions` và có hình dạng hoàn toàn khác, nên mặc định đó vô dụng với mọi head có trước v8 — mười
lăm chiều dùng trong lượt này là do agent tự nghĩ ra, và một lượt khác có thể nghĩ ra tập khác mà vẫn
qua hết validator. Sâu hơn nữa, không gì định nghĩa thế nào là "proof": `positiveProofRef` và
`negativeProofRef` là chuỗi tự do và không topic tri thức nào nói một nhánh source có tính là bằng
chứng hay chỉ một test đã chạy mới tính; riêng sự mơ hồ này đã quyết định bảy trong mười lăm disposition
của lượt chạy. Cuối cùng, `@knowledge/patterns/be` tuy bind được nhưng không có luật nào về quyền lợi,
quyền sở hữu hay đường đọc, nên bước kiến trúc không dựa được vào gì ngoài source và lời hứa.

## Khiếm khuyết operator và hợp đồng

`backend.source.apply` không có chế độ khô, đúng như khoảng trống mà lượt chạy này được giao xác nhận.
`declaredWriteRoots` của `workspace.bind` bị gánh hai vai một lúc, vừa là quyền ghi vừa là ranh giới
dung thứ cho phần bẩn, nên muốn bỏ qua phần bẩn không liên quan của người dùng thì buộc phải khai một
write root mà chuỗi sẽ không bao giờ ghi. Một nhánh `workspace.bind` bị chặn cũng không có biên nhận
nào: không output kind nào phủ một cái stop, và sáu mã trong bảng `Findings` của
`workspace-route-binding` không mã nào nói được điều kiện đã chặn.

Hai schema mâu thuẫn nhau: `route.schema.json` cho `gitPolicy.worktreeBranches` enum
`["forbidden", "allowed"]`, còn `portable-route.schema.json` cho `["forbidden", "session-only"]` và còn
mang thêm `incomingBranchRefs` mà kind `route` không có trường nào chứa; kể từ `90ef7fcb8` route FE đã
là `session-only`, nghĩa là một lượt `workspace.bind` đúng đắn trên route đó không diễn đạt nổi chính
sách của chính nó trong biên nhận của chính nó, và giá trị `allowed` còn ngược với luật ghi source
trong `resources/orchestrator.json` vốn chỉ biết đến session branch. Bảng `## Next` của `workspace.bind`
cũng không có dòng nào cho `business.decide` trong khi bước 2 của `backend-feature` chính là operator
đó; không gì kiểm `response.json.next` so với bảng Next hay so với workflow, nên mâu thuẫn này im lặng
và workflow thắng lúc chạy.

`business.decide` thiếu hẳn một disposition cho trạng thái "đã thực thi nhưng chưa chứng minh", nên chỉ
còn hai lối: dùng `defer` và nói nhẹ đi, hoặc dán một đường source vào `positiveProofRef` và tạo ra
đúng cái false pass mà văn xuôi của chính operator cấm. `CONSUMER_UNPROVEN` cũng không thể nổ cho một
consumer thiếu bằng chứng: validator chỉ ép mỗi consumer phát hiện được phải có một *dòng*, chưa bao
giờ kiểm nó có proof riêng, nên mười ba consumer nằm chung một dòng dẫn spec của một guard duy nhất mà
nhánh vẫn xanh. Các fingerprint thì không có quy tắc chuẩn hoá nào được công bố và
`model.claimsFingerprint` không hề bị đối chiếu với `claims.json.fingerprint`, nên hai cài đặt khác
nhau sẽ cho fingerprint khác nhau trên cùng nội dung, đúng thứ phá hỏng mục đích "cùng đọc một ma trận".

Về phía `architecture.decide`, năm trục tương thích không có phán quyết not-applicable, nên
`backup-restore` vốn vô nghĩa với một framework hay một ORM chỉ còn một lối hợp lệ là fallback
`COMPATIBILITY_UNVERIFIED`, và fallback đó đóng dấu `replaced-candidate` lên ba component không hề đổi
— một nhãn mà người đọc hiểu là "đang tính thay". Tính độc lập của người phản biện thì không kiểm được:
hợp đồng `independent-critique` đòi đúng chữ `Inherited turns | none` và không gì phát hiện được rằng
tác giả và người phản biện là cùng một tiến trình, cùng một model, đúng như đã xảy ra ở đây. Nghiêm
trọng hơn về mặt chuỗi, `architecture.decide` không nhận được output của nhánh business: bảng Inputs
chỉ khai `architecture-decision`, còn lời hứa được bind qua head *đã publish*, nên một nhánh
`business.decide` mô hình hoá xong mà không publish — vì khô, vì bị chặn, hay vì đang chờ phê duyệt —
sẽ lặng lẽ để bước kiến trúc đọc head cũ, và đó chính xác là điều đã xảy ra trong lượt này. Cuối cùng,
`business-promise-authority` không có mục `## Fallbacks taken` trong khi `validate-response` lại đối
chiếu `response.fallbacks` với mục đó; hôm nay chưa mã nào của `business.decide` mang disposition
`fallback` nên cái bẫy còn ngủ, nhưng mã đầu tiên như vậy sẽ khiến một fallback hợp lệ không thể ghi
lại mà không phá hợp đồng tài liệu.

## Khoảng trống của orchestrator

Một nhánh bị chặn vẫn ăn mất một số thứ tự bước, nên sau khi bước 1 dừng thì vị trí trong chuỗi và vị
trí trong workflow lệch nhau: `business.decide` chạy ở bước 3 và `architecture.decide` ở bước 4 của một
workflow gọi chúng là bước 2 và bước 3, mà `state.json` không ghi lại ánh xạ ấy. Output của
`workspace.bind` cũng không được ai tiêu thụ trong chuỗi này, vì cả hai operator sau đều tự giải alias
của mình và head đóng băng chỉ đi trong `request.contexts[].head` do orchestrator gõ tay, thứ mà
`validate-request` không bao giờ đối chiếu với route đã bind. Trạng thái `waiting` cũng không được giữ
lại, vì agent hồi lại ghi đè lên chính `response/response.json`, nên một nhánh hoàn tất không còn dấu
vết nào cho thấy nó từng dừng chờ; lượt chạy này phải tự tay chụp lại bản waiting.

Không có luật nào về việc đóng băng lại head giữa chuỗi, dù HEAD đã dịch chuyển hai lần trong phiên và
`SOURCE_DRIFT` chỉ nói "orchestrator đóng băng head lại" mà không nói khi nào quan sát lại hay bằng
chứng đã trích ở head cũ thì tính sao. `state.json` thì không có schema lẫn validator, chỉ mỗi
`requestHashes` được đọc. Và một phiên thành công lại tự xoá hồ sơ của chính nó: vòng đời xoá thư mục
session sau `git.publish`, nên biên nhận, claim, ma trận và bản phản biện của một lượt xanh chỉ sống
sót nếu người chủ kịp chép ra — mọi hiện vật mà báo cáo này trích dẫn tồn tại được là vì lượt chạy đã
dừng.

---

## Những gì đã chạy đúng

Bước nhảy định tuyến sau `CHECKOUT_DIRTY` đi qua `errors.json` tới domain `source` rồi tới
`routing.json` và ra `resume` mà không cần một chút diễn giải nào. Mọi lần schema hay hợp đồng từ chối
trong lượt chạy đều đúng và cụ thể; riêng lần từ chối `fields` theo phạm vi exchange đã bắt đúng một
lỗi thật trong một dòng. Phép kiểm hash của `validate-request` đối chiếu với `state.json` giữ vững qua
bốn request và một exchange lồng. Cơ chế `waiting` → exchange → resume của `architecture.decide` chạy
đúng như đã viết, và ràng buộc rằng bản phản biện không được nhận `response.md` của tác giả thật sự
được validator của operator ép. Hai validator mang luật nghiệp vụ thật (`business-decide`,
`architecture-decide`) không từ chối điều gì đúng và không chấp nhận điều gì mà lượt chạy này biết là
sai.
