# Phiên chạy — backend-feature đi qua một `backend.source.apply` chế độ dry (vòng 2, 2026-09-03)

Đây là lần chạy khô thứ hai của workflow `backend-feature` trên `pro-subscription`, và nó được gọi ra
vì một lý do duy nhất: `backend.source.apply` giờ đã có `mode: dry`, còn vòng 1 thì không thể thử
chuỗi này quá `architecture.decide` khi chưa có nó. Gốc phiên nằm ở
`.worktrees/sessions/20260903-r2-backend-feature/`, đã được gitignore và giữ lại trên đĩa để soi. Không
có gì được commit, không có gì được ghi vào checkout backend, không có gì được ghi vào
`@worktrees/businesses`, và không một lệnh ghi Git nào được chạy ở bất kỳ đâu.

**Cây nào đã chạy.** Mọi tệp runtime mà lần chạy này đọc — `operators/`, `scripts/`, `templates/`,
`knowledge/`, `resources/`, `workflows/`, `routing.json`, `alias/` — đúng bằng `.claude` HEAD
`3d30a88e4b5a4e56fab5502b54621b738be5654b`, đã kiểm bằng `git status --porcelain` trên chính các đường
dẫn ấy và thấy sạch. Cây làm việc bao quanh chúng thì không sạch: `INDEX.md`, `INDEX.vi.md`,
`onichan.md`, `docs/_meta.js`, `docs/vi/_meta.js` và `package.json` đang được sửa để đổi tên thành
1.1.0, còn `README*.md`, `bin/`, `docs/install.mdx` và `scripts/install-cli.spec.mjs` chưa vào Git.
Không tệp nào trong số đó là thứ một operator ràng buộc, nên runtime được thử ở đây là 1.0.3 như đã
commit. `npm test` xanh ở trạng thái ấy.

**Mô hình nào đã chạy.** Mọi operator trong chuỗi này đều ràng một profile OpenAI, và mọi nhánh đều do
Claude Opus chạy. `resources/orchestrator.json` phần `profileEquivalents` ghép `sol-fresh` với `opus`
và `luna` với `sonnet`, nên `business.decide` cùng `architecture.decide` đã chạy đúng profile tương
đương của binding, còn `workspace.bind` và `backend.source.apply` thì không: chúng ràng `luna`, mà
tương đương Claude của `luna` là `sonnet`, và chúng lại chạy bằng Opus. Đó là người thế chỗ của người
thế chỗ; điều này được nói ra ở đây vì bản thân phiên chạy không có chỗ nào để nói, và lý do nó không
có chỗ được ghi thành một khiếm khuyết bên dưới.

## Tóm tắt yêu cầu

| Trường | Giá trị |
| --- | --- |
| Workflow | `backend-feature` |
| Feature | `pro-subscription` — head `features/pro-subscription/model.json` trong worktree businesses, mã nguồn dưới `src/modules/bussiness/pro-subscription/` và các consumer entitlement quanh nó |
| Head backend đóng băng | `90ef7fcb8dfbe83129af877e15a2c5fc029358de` (`git rev-parse HEAD`, chỉ đọc), nhánh `mtp` |
| Head backend ở vòng 1 | `d5926ae857aa4f8c11c53a80d6a764ee92a60149`; tệp duy nhất đổi giữa hai head là `.workspaces/projects/starci-academy/fe.json` (`git diff --stat`), nên mọi trích dẫn mã nguồn của vòng 1 giống nhau từng byte ở head này |
| Worktree businesses | `.worktrees/businesses` tại `1bdb707371cd418fb44a37623cad5f542ebb42e4`, head của feature ở địa chỉ nội dung `eccaeaadb6a4cf2c0a915a0589f46e9c3ae1ed661cfd86c6e75e688fe3fa40b1`, `authorityStatus: pending` — không nhúc nhích từ vòng 1 |
| Chuỗi được yêu cầu | 1 `workspace.bind` (be) → 2 `business.decide` (model) → 3 `architecture.decide` (1 phương án, tự động, kèm trao đổi `critique`) → 4 `backend.source.apply` (`mode: dry`) → 5 `quality.verify` nếu chuỗi thành thật đi tới được |
| Chuỗi thực chạy | 5 nhánh: 1 `workspace.bind` (blocked), 2 `workspace.bind` (resume, done), 3 `business.decide` (done), 4 `architecture.decide` + `critique` (done), 5 `backend.source.apply` `mode: dry` (blocked) |
| Kết thúc | ở bước 5. `BUSINESS_AUTHORITY_MISSING` mang domain `business`, mà `routing.json` trả lời bằng operator `business.decide`; orchestrator dừng lại thay vì điều nó đi, vì một lượt `business.decide` thứ hai không thể sinh ra cái định danh mà chính stop ấy nói tới. `quality.verify` và `git.publish` chưa bao giờ được điều |

Requirements đến từ preset của workflow cộng với mặc định mỗi operator tự nêu. Bốn trường không có mặc
định dùng được phải do chủ bài kiểm cấp, và mỗi trường đều được gọi tên ở chỗ nó xuất hiện: `gitPolicy`
(khai báo route BE vẫn không mang chính sách nào), `declaredWriteRoots`, `dimensions` cho
`business.decide`, và `constraints` cho `architecture.decide`.

**Cái gì được dùng lại và cái gì được chạy lại.** Lập luận nghiệp vụ và kiến trúc là của vòng 1, điều
mà đề bài cho phép. Dù vậy mọi nhánh đều được quan sát lại ở head mới trước khi được chấp nhận: head
backend và cây làm việc được đọc tươi, head worktree businesses cùng mục registry được đọc tươi, mọi
tệp đứng sau hai mươi hai claim và mọi tham chiếu proof trong ma trận phủ đều được xác nhận tồn tại ở
`90ef7fcb8`, dải dòng lấy mẫu (`pro-subscription.service.ts:60-67`) được mở ra và vẫn giữ đúng hàm
`isActive` có ý thức về ngày mà claim mô tả, còn mọi dòng `package.json` và compose mà quan sát hiện
trạng trích dẫn đều được mở và khớp từng dòng (`package.json:89, 92, 95, 173`; `postgres.yaml:19`;
`redis.yaml:9`). Mọi fingerprint trong phiên đều được tính lại chứ không chép.

---

## Bước 1 — `workspace.bind`, parallel-1

**Trạng thái** `blocked`. **Stop** `CHECKOUT_DIRTY`.
**Profile** `operator.json` ràng `luna`; chạy bằng Claude Opus, vốn không phải tương đương Claude đã
khai của `luna` (`sonnet`).

**Bộ kiểm**

```text
$ node scripts/validate-request.mjs <session>/step-1/parallel-1
request valid

$ node scripts/validate-response.mjs <session>/step-1/parallel-1
response valid

$ node scripts/validate-step.mjs <session>/step-1/parallel-1
step valid

$ node operators/workspace-bind/validate.mjs <session>/step-1/parallel-1
valid workspace.bind branch
```

**Hiện vật đã ghi** chỉ `response/response.json`.

**Nhánh này thấy gì.** Vẫn bức tường của vòng 1, nhưng được quan sát lại chứ không nhớ lại. Khai báo
khả chuyển `.workspaces/projects/starci-academy/be.json` và route đã hydrate
`.workspaces/local/routes/starci-academy/be/config.json` thống nhất về project, role, repository và
nhánh, và checkout chính là Source trên `mtp` tại `90ef7fcb8`. Cây làm việc thì không sạch:
`.workspaces/projects/tayson/fe.json` đang sửa dở và `.workspaces/projects/tayson/be.json` chưa vào
Git, y hệt vòng 1. `declaredWriteRoots` là `["src"]`, nên cả hai tệp nằm ngoài ranh giới đã khai và
operator dừng. Nó không bao giờ stash, không dọn, không tự nới ranh giới.

`CHECKOUT_DIRTY` mang domain `source`; `routing.json` trả lời `workspace.bind`/`source` bằng
`{"kind":"resume"}`, nên orchestrator vào lại chính operator ấy như một bước mới. Bước nhảy đó chạy
đúng như thiết kế, không cần diễn giải, hai vòng liền.

Cái stop vẫn vô hình ngoài mã lỗi: `workspace.bind` không khai output kind nào cho một lần chạy bị
chặn, và bộ sáu mã `Findings` của `workspace-route-binding` không chứa mã nào nói được "cây đang bẩn ở
đây".

## Bước 2 — `workspace.bind`, parallel-1 (resume)

**Trạng thái** `done`. Không stop, không fallback.
**Profile** `luna`; chạy bằng Claude Opus.

**Bộ kiểm**

```text
$ node scripts/validate-request.mjs <session>/step-2/parallel-1
request valid

$ node scripts/validate-response.mjs <session>/step-2/parallel-1
response valid

$ node scripts/validate-step.mjs <session>/step-2/parallel-1
step valid

$ node operators/workspace-bind/validate.mjs <session>/step-2/parallel-1
valid workspace.bind branch
```

**Hiện vật đã ghi** `response/response.md` (kind `workspace-route-binding`),
`response/data/route.json` (kind `route`), `response/response.json`.

**Phần delta.** Trường duy nhất dịch được một stop `CHECKOUT_DIRTY` vẫn là `declaredWriteRoots`, và
chính văn bản resume của mã lỗi mở đúng hai lối — "dọn sạch ranh giới, hoặc khai write root bao được
nó". Dọn là một lệnh ghi Git mà phiên này không được phép làm và bản thân operator cũng từ chối, nên
lần resume đã khai `["src", ".workspaces/projects/tayson"]`, và bảng `Write roots` của biên bản tự nói
bằng lời của nó rằng mục thứ hai là một khoản miễn trừ của phiên khô chứ không phải ý định ghi. Đây
không phải bẻ cong cổng — đây là lối resume đã công bố — nhưng là lối resume đã công bố hiểu sai chính
điều nó đang xin, và điều đó lại được ghi lại bên dưới.

**Nhánh này ràng được gì.** `starci-academy/be` → checkout Source tại
`D:/Repositories/starci-academy-backend`, nhánh `mtp`, head `90ef7fcb8`, repository kind `source` (nên
directory là null), mutation readiness `read-only`, businesses root suy ra là
`<gitRoot>/.worktrees/businesses`, runtime `null` vì `runtimeNeed` là `none`. Findings:
`ROUTE_HYDRATED_FROM_PORTABLE`, `WORKTREE_BRANCH_FORBIDDEN`, `IDENTITY_ROSTER_SEALED`. Route đã hydrate
ghi head `d5926ae857aa4f8c11c53a80d6a764ee92a60149`, chậm một commit so với head quan sát được; head
quan sát được mới là binding, còn bản ghi cũ chỉ nằm ở phần văn xuôi của biên bản, vì không mã finding
nào phủ được nó.

`gitPolicy` lại phải được cấp. Khai báo khả chuyển BE vẫn không mang khối `gitPolicy` nào trong khi bản
FE thì có, nên mặc định của requirement — "chính sách mà khai báo route mang theo" — quy về hư không,
và chủ bài kiểm đã cấp cách đọc dè dặt mà vòng 1 dùng: `worktreeBranches: forbidden`,
`mutationBranch: mtp`. Chính giá trị ấy làm cho khiếm khuyết A2 bên dưới trở thành chuyện thật chứ
không phải chuyện lý thuyết.

**Một fingerprint không tái lập được.** Vòng 1 ghi `routeFingerprint` là `sha256:4144c224…` trên cùng
hai tệp route. Vòng 2 không tái lập được và cũng không biết có nên tái lập hay không: không chỗ nào
trong cây công bố cách chuẩn hoá, route đã hydrate thì đã bị viết lại từ đó, và `identityFingerprint`
rõ ràng là sha256 của byte tệp `.workspaces/device-state.json` trong khi `routeFingerprint` rõ ràng
không phải sha256 của byte tệp route nào. Lần chạy này tự khai luật riêng — sha256 trên byte khai báo
khả chuyển nối với byte route đã hydrate,
`sha256:5b2e815a78be45c54b9ce8250ed48ac25d121104e086a265ae27ae04a9562769` — và không bộ kiểm nào để ý,
kể cả tới giá trị cũ lẫn giá trị mới.

## Bước 3 — `business.decide` (mode `model`), parallel-1

**Trạng thái** `done`. Không stop, không fallback.
**Profile** `sol-fresh`, có tương đương Claude là `opus`; chạy bằng Claude Opus, với quyền `webSearch`
có giới hạn không hề dùng tới.

**Bộ kiểm**

```text
$ node scripts/validate-request.mjs <session>/step-3/parallel-1
request valid

$ node scripts/validate-response.mjs <session>/step-3/parallel-1
response valid

$ node scripts/validate-step.mjs <session>/step-3/parallel-1
step valid

$ node operators/business-decide/validate.mjs <session>/step-3/parallel-1
valid business.decide branch
```

**Hiện vật đã ghi** `response/response.md` (kind `business-promise-authority`),
`response/data/claims.json`, `response/data/coverage-matrix.json`, `response/data/model.json`,
`response/response.json`. **Không head nào được publish**: bước 8 của operator lẽ ra ghi
`@worktrees/businesses/features/pro-subscription/model.json`, mà phiên khô này không ghi gì ở đó. Head
lẽ ra được publish nằm ở `response/data/model.json`.

**Nhánh này thấy gì.** Registry vẫn ghi `authorityStatus: pending`, nên chuyển tiếp tiến lên duy nhất
vẫn là `pending->in-progress`, và đó là điều được mô hình hoá. Hai mươi hai claim, tất cả ràng lại vào
`90ef7fcb8`: mười tám fact trong mã nguồn đã route, ba intent trích từ head đã publish, một unknown.
Cái unknown vẫn nguyên và vẫn là cái đáng kể — không gì trong checkout chuyển một membership cũ hay một
kỳ AI chưa hết hạn thành một kỳ Pro, nên nhánh di trú của lời hứa hoàn toàn chưa có cài đặt nào quan
sát được. Mười lăm chiều đã khai, hai mươi mốt consumer phát hiện được, ba nhánh vòng đời phát hiện
được, mỗi chiều một dòng, không dòng nào đánh dấu không áp dụng: sáu `replace`, hai `preserve`, bảy
`defer`, trong đó tám dòng mang cả proof dương lẫn proof âm. Findings đã ghi: `CONSUMER_SHARED_PROOF`,
`PROOF_DEFERRED`, `MIGRATION_UNIMPLEMENTED`, `LEGACY_COEXISTENCE`,
`NO_DISPOSITION_FOR_UNPROVEN_ENFORCEMENT`.

Văn xuôi của biên bản vòng 1 viết "bảy dòng thực thi, sáu dòng hoãn" trong khi ma trận đóng băng nói
tám và bảy. Việc đếm lại bắt được lỗi ấy và câu văn đã được sửa. Không thứ gì trong cây sẽ bắt được nó.

Mọi fingerprint đều được tính lại, và một lỗ hổng kiểm tra lại lộ ra:
`operators/business-decide/validate.mjs` so `model.coverageFingerprint` với ma trận mà không bao giờ so
`model.claimsFingerprint` với `claims.json.fingerprint`. Ở đây hai giá trị khớp nhau vì lần chạy này
làm cho chúng khớp, chứ không phải vì có thứ gì đòi hỏi.

## Bước 4 — `architecture.decide`, parallel-1 (kèm trao đổi `critique`)

**Trạng thái** `done`. **Fallback đã dùng** `COMPATIBILITY_UNVERIFIED`.
**Profile** `sol-fresh` → `opus`; chạy bằng Claude Opus. Agent critique ràng cùng profile và chạy bằng
cùng mô hình.

**Bộ kiểm**

```text
$ node scripts/validate-request.mjs <session>/step-4/parallel-1
request valid

$ node scripts/validate-response.mjs <session>/step-4/parallel-1
response valid

$ node scripts/validate-step.mjs <session>/step-4/parallel-1
step valid

$ node scripts/validate-request.mjs <session>/step-4/parallel-1/critique
request valid

$ node scripts/validate-response.mjs <session>/step-4/parallel-1/critique
response valid

$ node operators/architecture-decide/validate.mjs <session>/step-4/parallel-1
valid architecture.decide branch
```

**Hiện vật đã ghi** `response/response.md` (kind `architecture-decision`),
`response/data/current-state.json`, `response/data/stack-model.json`,
`critique/request/request.json`, `critique/response/critique.md`, `critique/response/response.json`,
`response/response.json`. Không có trang phương án, và điều đó đúng: `alternatives` bằng 1.

**Nhánh này thấy gì.** Mục tiêu — một đường đọc entitlement duy nhất cho nội dung Pro — được chính head
đã publish phát biểu gần như nguyên văn, nên không cần thay thế gì. Sáu thành phần và sáu ranh giới
được quan sát lại ở `90ef7fcb8` và mọi trích dẫn đều được mở lại: `@nestjs/core ^11.0.1`,
`@nestjs/graphql ^13.2.4`, `typeorm ^0.3.28`, `@nestjs/bullmq ^11.0.4` đúng những dòng `package.json`
mà bản ghi nêu, `postgres:16-alpine` và `redis:7-alpine` đúng những dòng compose. Phương án duy nhất,
`single-effective-access-collaborator`, được chọn tự động với chi phí 4, độ phức tạp 3, khả hồi 4. Một
store có hai người ghi — `transactions` — và nó mang phần biện minh cho việc ghi chung: cú xác nhận
pending-sang-succeeded phải commit bên trong giao dịch cấp quyền, vì đó chính là thứ khiến một lần
settle trùng trở thành vô hiệu. Ba thành phần không giữ trạng thái không có bằng chứng sao lưu và phục
hồi nào để đưa ra, nên fallback `COMPATIBILITY_UNVERIFIED` gắn cho chúng nhãn `replaced-candidate` và
liệt trục ấy vào Handoff như một ẩn số — vẫn đúng kiểu báo cáo sai mà vòng 1 đã ghi, không đổi.

Phần critique là một lượt thứ hai chỉ được đưa `response/data/stack-model.json` và không gì khác. Tám
đường tấn công, tất cả đều `holds`, phán quyết `keep`; hai trong số đó — người ghi thứ hai lên
`transactions` và cuốn sổ chỉ-ghi-thêm có người đọc được khai nhưng không có giao diện để đọc — đi
thẳng vào Handoff thành rủi ro được gọi tên. Tính độc lập của người phản biện vẫn không kiểm chứng
được: contract chỉ soi đúng chữ `Inherited turns | none`, và không gì phát hiện được rằng tác giả và
người phản biện là cùng một tiến trình trên cùng một mô hình, mà đó lại đúng là điều đã xảy ra.

## Bước 5 — `backend.source.apply`, `mode: dry`, parallel-1

**Trạng thái** `blocked`. **Stop** `BUSINESS_AUTHORITY_MISSING`.
**Profile** `operator.json` ràng `luna`, có tương đương Claude là `sonnet`; chạy bằng Claude Opus.

**Bộ kiểm**

```text
$ node scripts/validate-request.mjs <session>/step-5/parallel-1
request valid

$ node scripts/validate-response.mjs <session>/step-5/parallel-1
response valid

$ node scripts/validate-step.mjs <session>/step-5/parallel-1
step valid

$ node operators/backend-source-apply/validate.mjs <session>/step-5/parallel-1
valid backend.source.apply branch
```

**Hiện vật đã ghi** chỉ `response/response.json`. Một nhánh bị chặn không được mang cài đặt nào, và bộ
kiểm của chính operator ép điều đó: không `mutations.json`, không biên bản, không bản ghi thay đổi.

**Yêu cầu.** `featureId` là `pro-subscription`; `mode` là `dry`; `outcome` là "Route every
learner-facing paid read through the effective-learner-access collaborator, so entitlement is decided
once per read and no product decides it for itself", đúng pha C trong kế hoạch hiện thực hoá của chính
head đã publish; `mutableFileRefs` gồm sáu đường dẫn thật tồn tại ở head đóng băng, phủ collaborator,
spec của nó, module, guard khoá học trả phí, spec của guard và service entitlement AI; đầu vào
`architecture-decision` trỏ vào biên bản của bước 4.

**Nó dừng ở đâu, và vì sao đó là câu trả lời thành thật.** Bước 2 của operator ràng thẩm quyền nghiệp
vụ, và nó không lấy được thứ duy nhất mà mọi operation buộc phải trích dẫn.
`templates/kinds/mutations.schema.json` đòi mỗi operation mang ít nhất một `authorityDecisionIds` khớp
`^BA-[0-9]+$`, còn `templates/kinds/backend-source-application.contract.json` đòi cột `Decisions` của
biên bản đọc ra `BA-<n>`. Không gì trong cây công bố một định danh dạng ấy. Grep `BA-` khắp
`templates/`, `knowledge/` và mọi `operator.md` chỉ trả về đúng hai contract đó cùng
`operators/backend-source-apply/self-test.mjs`, nơi `BA-1` là dữ liệu mẫu. Không kind sản xuất nào mang
định danh như thế: `model.schema.json` không hề có trường decisions trong các khoá bắt buộc;
`coverage-matrix.schema.json` đánh địa chỉ dòng bằng `dimension`; `claims.schema.json` đánh địa chỉ
claim bằng `claimId` kiểu kebab; `stack-model.schema.json` mang đúng một `decisionId` kebab cho cả
quyết định kiến trúc. Head thực sự được ràng —
`.worktrees/businesses/features/pro-subscription/model.json`, địa chỉ nội dung `eccaeaad…40b1`,
`schemaVersion: 1`, trạng thái `pending` — phát biểu hành vi đã duyệt của nó thành một mảng mười lăm
chuỗi `rules` không đánh số.

Đánh số mười lăm chuỗi ấy thành `BA-1 … BA-15` thì nhánh đã chạy được, và đó đúng là điều operator cấm:
"backend không bao giờ bịa hành vi nghiệp vụ", và một địa chỉ quyết định do ta đúc ra thì không phân
biệt nổi với một địa chỉ đã được duyệt ngay khi nó được viết xuống. Vậy nên nhánh dừng trước khi đọc
một dòng nào bên trong trần tệp khả biến. Phép chiếu khô, bản kế hoạch, bản ghi thay đổi và mọi nhánh
luật của bộ kiểm chế độ dry vì thế chưa hề được thử — và đó là phát hiện thứ hai của bước này, không hề
nhỏ hơn phát hiện thứ nhất.

Một lý do thứ hai, độc lập, chỉ về cùng bức tường và đáng nói riêng vì sửa cái này không sửa cái kia:
head mà phiên này mô hình hoá ở bước 3 chưa bao giờ được publish, do phiên khô không ghi gì vào gốc
businesses, và cả `architecture.decide` lẫn `backend.source.apply` đều ràng head *đã publish* chứ không
phải đầu ra của nhánh. Bước 5 vì thế đang đọc một head `pending` trong khi head `in-progress` đã mô
hình hoá nằm chưa publish ở cách đó hai bước — vòng 1 đã ghi điều này thành khiếm khuyết và nó không đổi.

`BUSINESS_AUTHORITY_MISSING` mang domain `business`; `routing.json` trả lời
`backend.source.apply`/`business` bằng operator `business.decide`. Orchestrator đã không điều nó. Một
lượt `business.decide` thứ hai đọc cùng mã nguồn ở cùng head và ghi ra cùng ba kind, mà không kind nào
có trường chứa nổi một `BA-<n>`, nên tuyến ấy dẫn thẳng tới `NO_PROGRESS`: cùng một đầu vào chạm cùng
một bức tường. Báo cáo bức tường là đúng điều mục Progress của chính entry dặn phải làm.

## Bước 6 — `quality.verify`: không được điều

Chuỗi chưa bao giờ tới nó, nên không có gì về nó được đo. Điều cây nói lẽ ra sẽ xảy ra được ghi ở đây
như một cách đọc, không phải một lần chạy, vì đề bài có hỏi liệu `quality.verify` có kiểm được một bản
kế hoạch hay không.

Nó không kiểm được, và lời từ chối đã nằm sẵn trong operator ở hai chỗ. Văn xuôi của nó nói "commit của
chính biên bản tiền nhiệm phải bằng đúng head ấy, vì một biên bản mô tả một commit mà các cổng không
đứng trên thì là `PREDECESSOR_STALE`", còn `operators/quality-verify/validate.mjs` ép đúng câu ấy trên
mọi tệp cổng: `if (r.predecessorCommit !== r.sourceHead)`. Một `backend.source.apply` chạy khô sinh ra
`mutations.commit: null`, một biên bản có `Commit` đọc là `—`, và một `changes.md` có dòng Checkout đọc
là "…nothing written". Không có commit nào để cổng đứng lên, nên không thể viết ra một kết quả cổng vừa
nói thật vừa qua được bộ kiểm. Kết cục thành thật là một stop `PREDECESSOR_STALE` ở bước 2 của operator,
trước khi bất kỳ lệnh nào chạy; domain của nó là `caller`, mà `routing.json` trả lời bằng `user`. Bản
thân kế hoạch cổng thì có sẵn — alias `gates` quy về `package.json#scripts` cùng các config nó nêu, và
checkout này có đủ — nên cái chặn nằm ở tiền nhiệm hình dạng kế hoạch chứ không ở đâu khác.

Điều cây hiện *chưa* làm là từ chối nó ngay ở bước 2. Như đang viết, một tiền nhiệm khô sẽ được tiêu
thụ như hợp lệ, các cổng sẽ chạy trên head gốc, và mâu thuẫn chỉ nổi lên thành lỗi từng tệp cổng ở cuối.
Đó là bản sửa được đề nghị ở B1.

---

# Khiếm khuyết và bản sửa đề nghị

## A — cái đã chặn lần chạy

### A1. `BA-<n>` là bắt buộc mà không gì công bố nó

**Tệp** `templates/kinds/mutations.schema.json`
(`$defs.operation.properties.authorityDecisionIds`),
`templates/kinds/backend-source-application.contract.json` (`## Operations`, ô `Decisions`).

**Bằng chứng** Cả hai đòi `^BA-[0-9]+$`. Grep `BA-` khắp `templates/`, `knowledge/` và mọi
`operator.md` trả về đúng hai tệp ấy cùng `operators/backend-source-apply/self-test.mjs`, nơi `BA-1`
là dữ liệu mẫu. Không kind sản xuất nào mang định danh như vậy: `model.schema.json` không có trường
decisions trong các khoá bắt buộc, `coverage-matrix.schema.json` đánh khoá dòng bằng `dimension`,
`claims.schema.json` bằng `claimId` kebab, `stack-model.schema.json` bằng một `decisionId` kebab. Head
được ràng phát biểu các luật của nó thành một mảng chuỗi không đánh số.

**Bản sửa đề nghị** — chọn một trong hai, và bản thứ hai được khuyến nghị.

(i) Thêm một sổ đăng ký quyết định vào head nghiệp vụ. Trong `templates/kinds/model.schema.json`, thêm
mảng bắt buộc `decisions` gồm các object
`{ "decisionId": {"pattern": "^BA-[0-9]+$"}, "statement": {"type": "string"}, "claimIds": {"$ref": "#/$defs/identifierArray"} }`,
và thêm vào bước 4 của `operators/business-decide/operator.md` mệnh đề "và đánh số các luật đã duyệt
vào `decisions`, chỉ nối thêm, để một địa chỉ đã publish không bao giờ bị dùng lại".

(ii) **Khuyến nghị.** Để ma trận phủ làm đúng cái sổ đăng ký quyết định mà nó vốn đã là. Trong
`templates/kinds/mutations.schema.json` đổi `authorityDecisionIds.items` từ
`{"type": "string", "pattern": "^BA-[0-9]+$"}` thành
`{"type": "string", "pattern": "^[a-z0-9][a-z0-9-]*$"}` và đổi tên trường thành
`authorityDimensionIds`; trong `templates/kinds/backend-source-application.contract.json` đổi regex ô
`Decisions` từ `^BA-[0-9]+(?:, BA-[0-9]+)*$` thành
`^[a-z0-9][a-z0-9-]*(?:, [a-z0-9][a-z0-9-]*)*$`; trong `operators/backend-source-apply/operator.md`,
dưới mục "The backend never invents business behaviour", thêm "quyết định đã duyệt mà một operation
trích dẫn là một dimension của ma trận phủ thuộc head đã publish, đánh địa chỉ bằng `dimension`, và
fingerprint của ma trận đi kèm trích dẫn ấy". Cách này tốn một sửa schema và một sửa contract, tái dùng
đúng fingerprint mà ma trận vốn đã mang, và làm cho trích dẫn kiểm được chứ không chỉ đúng hình dạng.

### A2. `sourceWrites.policy` không được cập nhật khi `mode: dry` ra đời

**Tệp** `resources/orchestrator.json`, `sourceWrites.policy`.

**Bằng chứng** Câu ấy viết "checkout đã route phải khai `gitPolicy.worktreeBranches = session-only`…;
một route khai `forbidden` thì ràng ở chế độ chỉ đọc và không operator ghi mã nguồn nào được chạy trên
nó", không kèm ngoại lệ. `backend.source.apply` dưới `dry` không ghi gì — chính operator.md của nó nói
"không một byte nào chạm `@workspaces/be`". Khai báo `starci-academy/be` hoàn toàn không mang
`gitPolicy`, nên binding dè dặt là `forbidden`, và một lần apply khô vì thế không thể khởi chạy trên
đúng cái route mà workflow `backend-feature` nhắm tới. Lần chạy này đã điều bước 5 dựa trên thẩm quyền
của chính operator, điều mà `SKILL.md` nói là cao hơn tệp này, và ghi lại mâu thuẫn thay vì giấu nó.

**Bản sửa đề nghị** Nối vào chuỗi policy ấy: `"; mode dry là ngoại lệ, vì nó không ghi gì: một
backend.source.apply hay frontend.source.apply chạy khô được phép chạy trên một binding chỉ đọc, và
mutations.json của nó ghi bản kế hoạch với commit null."`

### A3. Route BE vẫn không khai `gitPolicy` (lỗ hổng 1 của vòng 1, chưa sửa)

**Tệp** `.workspaces/projects/starci-academy/be.json` (nằm ngoài `.claude`, thuộc chủ workspace),
`operators/workspace-bind/operator.md` (Requirements, ô Default của `gitPolicy`).

**Bằng chứng** `be.json` không có `repository.gitPolicy`; `fe.json` có, và từ `90ef7fcb8` nó đọc là
`session-only`. Mặc định của requirement là "chính sách mà khai báo route mang theo", quy về hư không,
nên hai lần chạy có thể bịa khác nhau cho cùng một route — vòng 1 và vòng 2 đều được chủ bài kiểm trao
giá trị ấy và không lần nào tự suy ra được.

**Bản sửa đề nghị** Hai sửa. Trong `.workspaces/projects/starci-academy/be.json`, thêm dưới
`repository`: `"gitPolicy": { "mutationBranch": "mtp", "worktreeBranches": "session-only",
"incomingBranchRefs": "merge-into-mutation-branch" }`. Trong
`operators/workspace-bind/operator.md`, đổi ô Default của `gitPolicy` thành "chính sách mà khai báo
route mang theo; một khai báo không mang chính sách nào là `INVALID_INPUT` ở bước 1, không bao giờ là
một chính sách đoán ra", để lỗ hổng hỏng thành tiếng thay vì được lấp bởi ai đó viết request.

## B — cái lẽ ra đã chặn `quality.verify`

### B1. Một tiền nhiệm khô bị từ chối quá muộn và bằng luật sai

**Tệp** `operators/quality-verify/operator.md` (mục "One delivery, one head, at least one producer
receipt"), `operators/quality-verify/validate.mjs`.

**Bằng chứng** Phòng tuyến duy nhất của bộ kiểm nằm ở từng tệp cổng:
`if (r.predecessorCommit !== r.sourceHead) errors.push(...)`. Một tiền nhiệm khô hoàn toàn không có
commit, nên operator sẽ tiêu thụ nó ở bước 2, chạy mọi cổng trên head gốc, rồi mới phát hiện mâu thuẫn
khi các tệp cổng được kiểm. Bảng Inputs của operator không phân biệt nổi một
`backend-source-application` khô với một bản đã apply, vì kind của biên bản giống nhau ở cả hai chế độ.

**Bản sửa đề nghị** Trong `operator.md`, thêm vào mục ấy: "Một tiền nhiệm sinh ra dưới `mode: dry`
không mang commit và mô tả một bản kế hoạch chứ không phải một delivery; nó là `PREDECESSOR_STALE` ở
bước 2, trước khi bất kỳ lệnh nào chạy, vì một bản kế hoạch không có head nào để đứng lên." Trong
`validate.mjs`, đặt cạnh các kiểm tra tiền nhiệm hiện có, từ chối một nhánh `done` mà dòng Binding của
đầu vào `changes` đọc là "nothing written" hoặc dòng Binding của `backend-source-application` có
`Commit` bằng `—`.

## C — khiếm khuyết contract và điều phối

### C1. `boundProfile` và `ranProfile` không ghi được

**Tệp** `templates/step/response.schema.json`, `resources/orchestrator.json`
(`profileEquivalents.rule`), `scripts/validate-response.mjs`.

**Bằng chứng** Luật viết "response.json ghi cả hai (`boundProfile`, `ranProfile`) để một cuộc audit
phân biệt được người thế chỗ với binding". `response.schema.json` để `additionalProperties: false` và
không khai trường nào trong hai, nên viết chúng ra là hỏng cổng. Lần chạy này ràng `luna` ở ba nhánh và
chạy Claude Opus, vốn thậm chí không phải tương đương đã khai của `luna`, còn phiên chạy thì không có
chỗ nào để nói điều đó — câu ở đầu bản ghi này là bản ghi duy nhất tồn tại.

**Bản sửa đề nghị** Trong `properties` của `templates/step/response.schema.json`, thêm
`"boundProfile": { "type": "string", "minLength": 1 }` và
`"ranProfile": { "type": "string", "minLength": 1 }`, cả hai tuỳ chọn. Trong
`scripts/validate-response.mjs`, thêm: khi một trong hai có mặt thì đòi cả hai, và đòi `boundProfile`
bằng đúng profile mà `operator.json` nêu cho operator ấy.

### C2. Cách chuẩn hoá fingerprint vẫn chưa được công bố (khiếm khuyết 8 của vòng 1, chưa sửa)

**Tệp** mọi `templates/kinds/*.schema.json` mang `$def` `fingerprint`;
`operators/business-decide/validate.mjs` dòng 199.

**Bằng chứng** Vòng 1 ghi `routeFingerprint` là `sha256:4144c224…`; vòng 2, đọc đúng hai tệp đã khai
ấy, không tái lập được và cũng không biết có nên tái lập không. `identityFingerprint` chứng minh được
là sha256 của byte `.workspaces/device-state.json`; `routeFingerprint` chứng minh được là không phải
sha256 của byte tệp route nào, cũng không phải của phép nối chúng như vòng 1 để lại. Lần chạy này tự
khai luật riêng và không bộ kiểm nào để ý. Ngoài ra, `model.claimsFingerprint` vẫn không bao giờ được
so với `claims.json.fingerprint`; chỉ cặp coverage được kiểm.

**Bản sửa đề nghị** Thêm `templates/kinds/FINGERPRINTS.md` phát biểu một luật duy nhất — "fingerprint
của một tài liệu là sha256 trên JSON chuẩn RFC 8785 (JCS) của tài liệu ấy sau khi bỏ chính trường
fingerprint của nó; fingerprint trên tệp là sha256 trên byte các tệp nối lại theo thứ tự schema liệt
kê" — và dẫn nó từ `description` của mọi `$def` `fingerprint`. Trong
`operators/business-decide/validate.mjs`, cạnh dòng 199, thêm
`if (claims && model.claimsFingerprint !== claims.fingerprint) errors.push('response/data/model.json: claimsFingerprint must equal the frozen claims fingerprint');`

### C3. `declaredWriteRoots` vẫn gánh hai việc (khiếm khuyết 2 của vòng 1, chưa sửa)

**Tệp** `operators/workspace-bind/operator.md` (Requirements, bước 4),
`operators/workspace-bind/validate.mjs`, `templates/kinds/route.schema.json`,
`templates/kinds/workspace-route-binding.contract.json`.

**Bằng chứng** Trường này vừa là "những đường dẫn duy nhất mà việc sau được ghi" vừa là "ranh giới mà
ngoài nó thì bẩn sẽ chặn", nên muốn dung thứ mấy sửa đổi không liên quan ở
`.workspaces/projects/tayson` thì phải khai chúng thành write root mà chuỗi sẽ không bao giờ ghi. Văn
bản resume của chính mã lỗi xin đúng như thế. Hai vòng đã làm đúng như thế và cả hai đều phải giải
thích bằng văn xuôi rằng mình không có ý ấy.

**Bản sửa đề nghị** Thêm một dòng Requirements vào `operator.md`:
`| toleratedDirtRoots | list | empty | Những đường dẫn mà thay đổi chưa commit sẵn có không chặn binding, và không bước nào sau đó được ghi vào |`,
và nêu nó cạnh `declaredWriteRoots` trong cột Params của bước 4. Thêm mảng bắt buộc
`toleratedDirtRoots` vào `route.schema.json` cạnh `writeRoots`. Thêm mục `^## Tolerated dirt$` với bảng
`| Path | Why |` và không `minRows` vào `workspace-route-binding.contract.json`. Trong `validate.mjs`,
từ chối mọi đường dẫn xuất hiện ở cả hai danh sách và đòi bảng mới của biên bản khớp
`route.toleratedDirtRoots` theo đúng cách bảng Write roots đang khớp `route.writeRoots`.

### C4. Một binding chỉ đọc không dựng nổi biên bản của chính nó

**Tệp** `templates/kinds/workspace-route-binding.contract.json` (`## Write roots`),
`templates/kinds/route.schema.json` (`writeRoots`).

**Bằng chứng** Contract đặt `"minRows": 1`; schema đặt `"minItems": 0` và chính description của nó đọc
là "rỗng đối với một binding chỉ đọc (`declaredWriteRoots` mặc định rỗng)". Vì `validate.mjs` còn đòi
các dòng của biên bản bằng đúng `route.writeRoots`, một binding chỉ đọc thành thật không có tài liệu
hợp lệ nào.

**Bản sửa đề nghị** Bỏ `"minRows": 1` khỏi mục `## Write roots` của
`workspace-route-binding.contract.json`.

### C5. `backend.source.apply` không có dòng `## Next` nào cho một bản kế hoạch khô

**Tệp** `operators/backend-source-apply/operator.md` (`## Next`).

**Bằng chứng** Cả ba dòng đi tiếp đều mở đầu bằng "the contract is filled". Dưới `dry` thì contract
không được lấp đầy — chính operator nói vậy — nhưng nhánh vẫn kết thúc `done` và vẫn phải nêu một
`next`. Không gì kiểm `next` với bảng Next, nên lỗ hổng im lặng và workflow thắng lúc chạy (khiếm
khuyết 5 của vòng 1, chưa sửa).

**Bản sửa đề nghị** Thêm dòng
`| the plan was produced under mode dry and a person decides whether to pay for it | user |`, và thêm
vào `scripts/validate-response.mjs` một kiểm tra rằng mọi mục của `response.next` có mặt trong bảng
`## Next` của operator hoặc là `user`/`external`.

### C6. Một agent chạy khô được cấp đúng những công cụ mà chế độ của nó cấm

**Tệp** `operators/backend-source-apply/operator.json` (`resources.tools`),
`resources/orchestrator.json` (`agent.grants`).

**Bằng chứng** Operator khai `@tools/sourcewrite: declared-write-set` và
`@tools/git: commit-session-branch` vô điều kiện. Dưới `mode: dry` nó không được dùng cái nào, mà
`agent.grants` lại không có cách gắn một grant vào một requirement, nên đúng lần chạy không được ghi
lại là lần được trao công cụ ghi.

**Bản sửa đề nghị** Nối vào `agent.grants`: "một công cụ mà chế độ của operator cấm dùng thì không
được cấp cho lần chạy ấy; `backend.source.apply` và `frontend.source.apply` dưới `mode: dry` không nhận
`@tools/sourcewrite` lẫn `@tools/git`." Nói đúng điều đó trong đoạn "Dry mode writes the plan, not the
tree" của operator để grant và văn xuôi không trôi ra khỏi nhau.

### C7. Các operator hạ nguồn vẫn chỉ ràng head đã publish (khiếm khuyết 11 của vòng 1, chưa sửa)

**Tệp** `operators/architecture-decide/operator.md` và
`operators/backend-source-apply/operator.md` (bảng Inputs và Context).

**Bằng chứng** Cả hai ràng `@worktrees/businesses/<featureId>`, tức head *đã publish*, và không bên nào
khai một input có thể chở một head đã mô hình hoá nhưng chưa publish. Trong lần chạy này bước 4 và bước
5 đều đọc `pending` ở `eccaeaad…40b1` trong khi head `in-progress` đã mô hình hoá nằm ở
`step-3/parallel-1/response/data/model.json`. Bất kỳ nhánh `business.decide` nào chạy khô, bị chặn, hay
đang chờ duyệt đều để phần còn lại của chuỗi đọc lời hứa của hôm qua.

**Bản sửa đề nghị** Thêm vào cả hai bảng Inputs
`| model | business.decide; head mà nhánh ấy đã mô hình hoá, khi nó chưa được publish | no |`, và thêm
một câu vào đoạn ràng buộc của mỗi operator: "khi input `model` có mặt thì nó là thẩm quyền cho lần
chạy này và head đã publish chỉ còn là phả hệ; khi nó vắng thì head đã publish là thẩm quyền."

## Vòng 1 đã sửa gì và lần chạy này xác nhận

Bảng `## Next` của `workspace.bind` giờ có `business.decide`, nên tuyến của bước 2 không còn là trang
trí. `templates/kinds/route.schema.json` giờ mang enum `["forbidden", "session-only"]` khớp với schema
khai báo khả chuyển, và `writeRoots` giờ cho phép `minItems: 0`. `backend.source.apply` đã có
`mode: dry`, và bộ kiểm của nó mang luật khô thật sự: commit null, không after hash trên bất kỳ đường
dẫn dự kiến nào, không bản ghi conformance, không bản ghi proof, và mọi đường dẫn báo `unchanged` trong
bản ghi thay đổi. Vòng này không thử được luật ấy, vì nhánh dừng trước khi bản kế hoạch tồn tại — nhưng
nó đã được viết, và viết đúng, trong chừng mực việc đọc nó nói lên được.

---

# Phán quyết

Chuỗi đi tới bước 5 trong bảy bước mà workflow nêu và dừng ở đó. `workspace.bind` chặn rồi resume đúng
như thiết kế, hai vòng liền; `business.decide` và `architecture.decide` tái tạo câu trả lời của vòng 1
ở một head mới với mọi trích dẫn được mở lại và một lỗi đếm thừa kế bị bắt; `backend.source.apply` ở
`mode: dry` chặn ngay tại chỗ ràng thẩm quyền với `BUSINESS_AUTHORITY_MISSING`, và đó là cái stop đúng
cùng một kết quả xanh cho bài kiểm: operator từ chối đúc ra một địa chỉ quyết định thay vì giao một bản
kế hoạch trích dẫn một địa chỉ bịa. `quality.verify` chưa bao giờ được điều, và cách đọc vì sao nó
không thể kiểm một bản kế hoạch được ghi ở trên thay vì được diễn.

Vòng này không đạt được điều nó được gọi ra để làm. `mode: dry` có tồn tại, được viết cẩn thận, và vẫn
chưa được thử từ đầu đến cuối, vì một schema cách nó hai tệp đòi một định danh mà cây chưa bao giờ công
bố. A2 và A1 là hai sửa đổi cho phép vòng 3 thực sự chạy được nó, và A1 mới là cái đáng kể: chừng nào
một quyết định đã duyệt còn chưa có địa chỉ, không biên bản backend nào trong cây này trích dẫn nổi một
quyết định một cách thành thật, dù ở chế độ dry hay chế độ apply.
