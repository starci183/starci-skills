# Lượt chạy — frontend-new-surface cho một trang game bida (2026-09-03)

Đây là lượt chạy thử thứ hai của StarCi Skills 1.0.2, lần này trên workflow dựng một bề mặt còn chưa
tồn tại. Một orchestrator cộng một agent cho mỗi operator, tất cả nằm trong cùng một tiến trình. Gốc
phiên là `.worktrees/sessions/20260903-dryrun-frontend-new-surface/`, được giữ lại trên đĩa để soi.
Không có commit nào, không có gì được ghi vào hai checkout hay vào gốc businesses, và không một lệnh
git ghi nào được chạy ở bất cứ đâu.

Có hai điều cần nắm trước khi đọc bất kỳ phán quyết nào bên dưới. Thứ nhất, ranh giới profile không hề
được thử: mỗi branch đều nêu profile mà `operator.json` của chính nó ràng, còn người chạy thật sự mọi
branch là Claude Opus đứng thay. Thứ hai, đề bài của lượt chạy này giả định rằng mọi operator trong
chuỗi đều ràng `sol-fresh`, và cây không nói vậy: `workspace.bind` ràng `sonnet`, `business.decide` và
`frontend.direction.decide` ràng `sol-fresh`, còn xuôi xuống dưới thì `frontend.presentation.resolve`
ràng `sonnet`, `frontend.source.apply` ràng `opus` và `frontend.surface.audit` ràng `sol-reviewer`.
Mỗi bước dưới đây ghi đúng profile mà `operator.json` của nó gọi tên.

## Tóm tắt yêu cầu

| Trường | Giá trị |
| --- | --- |
| Yêu cầu, nguyên văn | "tạo trang game chơi bida" — một trang game bida trong `starci-academy-fe` tại `/games/billiards` |
| Workflow | `frontend-new-surface` |
| Target | `/games/billiards`; checkout định tuyến trang qua `src/app/[lang]/`, và tại head đã đóng băng không có segment `games` nào |
| Feature id | `billiards-game`, do người gọi cấp; không có head nghiệp vụ nào mang tên đó |
| Head frontend đã đóng băng | `14e0c20f4746ae08f00a84a4eac18aa78ded987b` trên `main`, cây sạch (`git -C D:\Repositories\starci-academy-fe rev-parse HEAD`, chỉ đọc) |
| Head backend đã đóng băng | `d5926ae857aa4f8c11c53a80d6a764ee92a60149` trên `mtp` (quan sát được; route `be` đã hydrate vẫn ghi `4456c4bc8…`, tức là bản hydrate đã cũ) |
| Head knowledge | `ffaa99115149d921e5191b93b2b5018f3f8cb8f9` trên `main` của `.claude`, cây làm việc đang bẩn |
| Chuỗi được yêu cầu | 1 `workspace.bind` (fe) → 2 `business.decide` (model) → 3 `frontend.direction.decide` (create/new) → 4 `frontend.presentation.resolve` → 5 `frontend.source.apply` (dry) → 6 `frontend.surface.audit` |
| Chuỗi chạy thật | bước 1 và 2, cộng một branch chứng minh độc lập đặt ở bước 3. Bước 2 blocked nên các bước 3 đến 6 của workflow không bao giờ được điều phối |

Các Requirements lấy từ preset của workflow cộng với default mà từng operator tự nêu. Có ba trường bắt
buộc không có default nên phải cấp tay: `project` (`starci-academy`), `featureId` (`billiards-game`,
theo đề bài) và `target` (`/games/billiards`, theo yêu cầu).

---

## Bước 1 — `workspace.bind`, parallel-1

Trạng thái `done`, không có stop, không có fallback nào được lấy. `operator.json` ràng profile
`sonnet` và không cấp runtime grant nào; trong lượt thử này branch do Claude Opus chạy, như mọi branch
khác.

```text
$ node scripts/validate-request.mjs <session>/step-1/parallel-1
request valid

$ node scripts/validate-response.mjs <session>/step-1/parallel-1
response valid

$ node operators/workspace-bind/validate.mjs <session>/step-1/parallel-1
valid workspace.bind branch
```

Branch ghi ra `response/response.md` (kind `workspace-route-binding`), `response/data/route.json`
(kind `route`) và `response/response.json`.

Khai báo portable `.workspaces/projects/starci-academy/fe.json` và route đã hydrate
`.workspaces/local/routes/starci-academy/fe/config.json` khớp nhau về project, role, kho Git và nhánh,
và bản hydrate gọi đúng tên Source này. Checkout thuộc kiểu `sibling` trong `starci-academy-fe`, giải
ra `D:\Repositories\starci-academy-fe`, đang ở `main` tại `14e0c20f…` với cây làm việc sạch và đúng
head mà bản hydrate ghi, nên không có drift nào. `runtimeNeed` là `none` nên bước 5 của operator không
chạy và binding không mang endpoint nào. `authorityRoots.businesses` là `null`, đúng luật cho một
checkout sibling — và đúng chỗ này sẽ thành vấn đề ngay ở bước sau. Mutation readiness được báo là
`ready` vì checkout đang nằm trên chính nhánh mutation đã route; giá trị ấy được bàn lại ở phần khiếm
khuyết, bởi lượt chạy `frontend-refine` trước đó báo `read-only` từ đúng route này và không có luật nào
phân xử. Ba finding được ghi: `ROUTE_HYDRATED_FROM_PORTABLE`, `WORKTREE_BRANCH_FORBIDDEN`,
`IDENTITY_ROSTER_SEALED`.

---

## Bước 2 — `business.decide`, parallel-1

Trạng thái `blocked`, stop là `EVIDENCE_MISSING`. `operator.json` ràng `sol-fresh` với
`webSearch: bounded`; branch do Claude Opus chạy, và không có lần tìm web nào, vì thứ đang thiếu là
bằng chứng trong source đã route, mà không trang web nào cấp được thứ đó.

`EVIDENCE_MISSING` nằm trong `operators/errors.json` với `scope: ["*"]`, `disposition: terminate` và
`domain: "self"`. `self` nghĩa là domain của chính operator phát mã, mà `operator.json` của
`business.decide` khai `domain: "business"`. `routing.json` trả lời
`routes["business.decide"]["business"]` bằng `{ "kind": "resume" }`, tức là chính operator ấy được vào
lại ở một bước mới với `request.json.resume` gọi tên branch đã blocked. Ở đây lần chạy lại chỉ có một
kết cục: cùng đầu vào thì đụng cùng bức tường, và đó là `NO_PROGRESS`, mã có domain `caller` và tuyến
`{ "kind": "user" }`. Nghĩa là người chỉ được hỏi tới ở nhịp dội thứ hai, không phải nhịp đầu.

```text
$ node scripts/validate-request.mjs <session>/step-2/parallel-1
request valid

$ node scripts/validate-response.mjs <session>/step-2/parallel-1
response valid

$ node operators/business-decide/validate.mjs <session>/step-2/parallel-1
valid business.decide branch
```

Một branch blocked hợp lệ vẫn là xanh, và branch này xanh. Nó chỉ ghi ra `response/response.json`:
không `response.md`, không `claims.json`, không ma trận phủ, và — đúng điều cần chứng minh — **không có
`response/data/model.json`**. Không một head giả định nào được ghi lại, vì branch chưa bao giờ tới bước
8 và cũng không có gì có bằng chứng để mà ghi. Không có gì được viết vào `.worktrees/businesses`.

Đề bài chờ một trong ba mã `EVIDENCE_MISSING`, `LIFECYCLE_TRANSITION_INVALID` hay `APPROVAL_REQUIRED`,
tuỳ mã nào luật của operator gọi tên trước. Câu trả lời là `EVIDENCE_MISSING`, và khoảng cách không hề
sát. Bảng Steps xếp thứ tự rõ ràng: bước 2 chuẩn hoá bằng chứng thành claim và dừng bằng
`EVIDENCE_MISSING` hoặc `CONTRADICTION_UNRESOLVED`; bước 3 mới là bước xét head đã publish và thẩm
quyền chuyển trạng thái, và nó sở hữu `LIFECYCLE_TRANSITION_INVALID`, `AUTHORITY_CONFLICT` cùng
`APPROVAL_REQUIRED`. Bước 2 chạy trước, và bước 2 không thể hoàn tất.

Lượt rà bằng chứng được chạy thật trên head backend đã đóng băng và trên gốc businesses:

| Quan sát | Kết quả |
| --- | --- |
| `business-registry-v1.json` → `featureHeads` | 13 khoá; không có `billiards-game` |
| `.worktrees/businesses/features/` | 14 thư mục; không thư mục nào là `billiards-game` |
| backend tại `d5926ae8…`, tìm không phân biệt hoa thường `billiard`, `snooker`, `bida` | không khớp ở bất cứ đâu trong kho, ngoài `node_modules` và `.git` |
| frontend tại `14e0c20f…`, segment route `games` | không tồn tại |

Vậy là không có lấy một fact claim. Rồi chính luật của operator đóng nốt cánh cửa còn lại:
`claims.schema.json` bắt buộc `path`, `lineStart` và `lineEnd` cho **mọi** claim, bất kể `kind`, và bắt
mảng claim phải có ít nhất một phần tử. Câu của người chủ là một intent, mà `intent` đúng là một kind
được khai — nhưng một intent nói ra trong yêu cầu thì không có file và không có khoảng dòng, nên không
thể viết thành claim. Bước 2 do đó không có gì được phép ghi, và `response/data/claims.json` không thể
tồn tại. `EVIDENCE_MISSING` là stop trung thực.

Giả sử có tới bước 3 thì chuyển trạng thái vẫn hợp lệ: head đang absent, request xin `pending`, và
`absent->pending` nằm trong `LEGAL_TRANSITIONS`. `APPROVAL_REQUIRED` cũng sẽ không nổ, vì không có phê
duyệt nào được ràng vào chuyển trạng thái ấy. Cả hai mã thay thế đều sẵn có và đều không áp dụng.

Nói gọn một câu: chuỗi đã từ chối vẽ một trang mà lời hứa của nó chưa ai quyết, và từ chối vì đúng lý
do — không phải "chưa có head", mà "không một sự thật quan sát được nào trong source đã route nói sản
phẩm này hứa gì, hứa với ai, và từ chối lúc nào".

---

## Bước 3 — `frontend.direction.decide`, parallel-1 (branch chứng minh độc lập)

Branch này không phải phần tiếp của `frontend-new-surface`; workflow đã chết ở bước 2. Nó được chạy
đúng một lần, có chủ ý, với `changeLevel: new`, `intent: create` và **không** có input
`business-promise-authority`, để chứng minh operator hướng đi tự nó dừng ở đâu.

Trạng thái `blocked`, stop là `BUSINESS_REQUIRED`. `operator.json` ràng `sol-fresh` với `webSearch`,
`browser` và `imageGeneration`; branch do Claude Opus chạy. Không có nghiên cứu có giới hạn nào và
không có ảnh nào được tạo, vì lượt chạy dừng ở bước 3 trên 12, trước bước nghiên cứu và trước khi vẽ
bất cứ thứ gì.

`BUSINESS_REQUIRED` nằm trong `operators/frontend-direction-decide/errors.json` với
`disposition: terminate` và `domain: "business"`. `routing.json` trả lời
`routes["frontend.direction.decide"]["business"]` bằng
`{ "kind": "operator", "target": "business.decide" }`, tức là gọi `business.decide` rồi quay lại. Trong
phiên này operator ấy đã blocked bằng `EVIDENCE_MISSING`, nên hai branch khép thành một vòng mà lối ra
duy nhất là con người.

```text
$ node scripts/validate-request.mjs <session>/step-3/parallel-1
request valid

$ node scripts/validate-response.mjs <session>/step-3/parallel-1
response valid

$ node operators/frontend-direction-decide/validate.mjs <session>/step-3/parallel-1
valid frontend.direction.decide branch
```

Branch chỉ ghi `response/response.json`: không `coverage.json`, không trang candidate, không ảnh.

Hai bước đầu của operator đã qua một cách trung thực. Gate giữ được; head đóng băng khớp head quan sát;
route đã được bước 1 của phiên này xác minh; change level do request tự nêu chứ không suy từ source, mà
`create` đi với `new` là cặp hợp lệ duy nhất nên `CHANGE_LEVEL_AMBIGUOUS` không áp dụng; trần owner mặc
định `surface-and-nested-layouts` uỷ quyền cho layout chủ `src/app/[lang]/layout.tsx` và bề mặt mới nằm
dưới nó, nên `OWNER_CEILING_INVALID` cũng không áp dụng. Bước 3 là chỗ operator ràng những input mà
change level đòi, và `new` đòi lời hứa nghiệp vụ. Không có. `BUSINESS_REQUIRED` là terminate, và lượt
chạy kết thúc ngay đó — trước khi quan sát bối cảnh hiện có, trước khi biên ra bất kỳ UI contract nào,
và trước khi hình thành một phương án nào. Đó đúng là kết quả cần lấy: operator hướng đi không bịa ra
lời hứa, và nó không vẽ một bàn bida chỉ vì có người xin.

---

## Những khiếm khuyết lượt chạy này phơi ra

### Lỗ hổng tri thức

**Một branch blocked không để lại dấu vết đọc được, nên chẳng có gì mang lý do đi tiếp.** Đây là lỗ
hổng tri thức trước khi là khiếm khuyết contract: trong `templates/kinds/` không có kind nào cho "vì
sao dừng". Cả hai branch blocked của phiên này chỉ là một `response.json` giữ một trạng thái và một mã.
Tất cả những gì một người muốn biết — đã tìm những file nào, thấy gì, vì sao là `EVIDENCE_MISSING` chứ
không phải `LIFECYCLE_TRANSITION_INVALID` — chỉ tồn tại trong bản ghi viết tay này. Theo
`orchestrator.json`, một lần resume vào lại operator với `resume` gọi tên branch đã blocked; mà branch
được gọi tên ấy không chứa gì để đọc.

**`knowledge/ui/composition` không publish luật nào cho một bề mặt chơi.** 36 rule của thư mục trải qua
`ACCENT-1..5`, `ACTION-1..3`, `COVERAGE-1`, `CTA-1..5`, `FEEDBACK-1..3`, `HIERARCHY-1..5`, cộng
`LAYOUT`, `RESPONSIVE` và `STATE`. Tất cả đều mô tả một bề mặt hình dạng tài liệu: vùng, cấp độ, hành
động có kết toán, nhánh responsive. Một trang bida lại là một canvas tương tác thời gian thực — vùng
chơi có vòng tick, ngắm bằng con trỏ, lực đánh, trạng thái lượt, tạm dừng và tiếp tục, rồi kết quả.
Ngay cả khi đã có head nghiệp vụ trong tay, bước 5 của `frontend.direction.decide` vẫn sẽ biên ra một
UI contract không có lấy một luật nào về đúng cái vùng gánh toàn bộ sản phẩm. `ACTION-2` ("pending
thuộc về kẻ khởi động") và `FEEDBACK-3` ("phải biết việc đã kết thúc rồi mới được nói") nói về hành
động request/response, không nói về một khung vật lý.

**Việc một canvas có phải lỗ hổng Grammar hay không được quyết bởi đúng một câu văn xuôi trong file
operator.** Phần tự sự của `frontend.direction.decide` viết: một node mà application sở hữu chính đáng,
chẳng hạn một canvas, không phải lỗ hổng Grammar và không bao giờ nêu ra. Đó là toàn bộ luật ngăn giữa
`GRAMMAR_REQUIRED` (một người publish component của họ) và "application sở hữu cái này". Nó nằm trong
`operator.md` chứ không nằm trong `knowledge/`, nên nó không mang rule identifier, không có fingerprint,
và không thứ gì trong `knowledge/ui/composition` hay `knowledge/grammars/starci` trích dẫn được nó.

**Không gì trong cây biến một yêu cầu sản phẩm thành một feature id.** `billiards-game` là do người gọi
cấp và không operator nào kiểm rằng nó có nghĩa gì. `business.decide` sẵn sàng mở một gốc thẩm quyền
cho bất kỳ slug nào khớp `^[a-z0-9][a-z0-9-]*$`.

### Khiếm khuyết operator và contract

**Một branch blocked không mang nổi receipt của chính nó.** `business-promise-authority` đòi mục
`## Cited claims` có ít nhất một dòng; `frontend-direction-decision` đòi `## Observed`, `## UI contract`
và `## Falsification` mỗi mục ít nhất một dòng. Mọi dòng ấy đều do một bước sinh ra, mà theo định nghĩa
bước đó không chạy khi branch dừng sớm hơn. `validate-response.mjs` chỉ ép output bắt buộc khi `status`
là `done`, nên branch trung thực không ghi markdown nào — và ghi một bản dở dang cũng không được, vì
`checkDocument` sẽ đánh trượt ở `minRows`. Các contract đang giả định thành công. Cách sửa hoặc là một
dạng rút gọn chỉ có `## Findings` cho từng kind, hoặc là một kind `stop-record` dùng chung mà mọi
operator được phép phát khi blocked.

**`claims.schema.json` không có chỗ cho một claim mà nguồn là con người.** Mọi claim đều đòi `path`,
`lineStart`, `lineEnd`, bất kể `kind`, trong khi `intent` lại là một kind được khai. Ý định người chủ
nói ra — vốn là toàn bộ nội dung của "tạo trang game chơi bida" — vì thế không thể ghi thành claim thuộc
bất cứ loại nào. Hệ quả mang tính cấu trúc chứ không phải tình cờ: **không một lời hứa mới tinh nào có
thể rời khỏi bước 2 của `business.decide`.** Một lời hứa mà phần thực thi chưa có sẵn trong backend thì
theo cấu tạo là không có fact claim, và cũng không ghi nổi cái intent đã sinh ra nó. Việc mà operator tự
nhận là "quyết và publish một lời hứa nghiệp vụ có bằng chứng"; như đang viết, nó chỉ *mô tả được một
lời hứa mà backend đã giữ sẵn*. Hoặc schema claim cần một loại nguồn cho phát biểu của người chủ (một
tham chiếu tới yêu cầu, không phải file và dòng), hoặc operator cần một đường publish lần đầu có tài
liệu, nơi `pending` được phép publish chỉ trên intent.

**`dimensions` bắt buộc ở lần chạy đầu mà gate không ép.** Bảng Requirements viết "required on a first
run, because no previous head declares it", nhưng ô Default lại ghi "the dimensions of the previous
head", nên `isRequiredField` trong `validate-request.mjs` — vốn kiểm xem default có bắt đầu bằng `—`
hay không — trả về false. Một request lần đầu bỏ trống `dimensions` vẫn qua gate. Lượt chạy này khai
tám dimension bắt buộc một cách tường minh; không có gì ép nó phải làm vậy.

**Kiểu khai của `gitPolicy` chỏi với validator của nó.** Bảng Requirements của `workspace.bind` khai nó
là "list of `{worktreeBranches, mutationBranch}`", trong khi `validate.mjs` đọc
`requirements.gitPolicy?.worktreeBranches`, tức một object đơn. Một orchestrator tin bảng và gửi mảng
sẽ lặng lẽ bỏ qua cả hai phép so chính sách thay vì trượt.

**`mutationReadiness` không được định đoạt khi chính sách worktree là `forbidden`.** Validator chấp nhận
`ready` bất cứ khi nào `checkout.branch === gitPolicy.mutationBranch`, và chấp nhận `read-only` vô điều
kiện. Từ đúng route này, lượt `20260903-frontend-refine-subscriptions` trước đó báo `read-only` còn lượt
này báo `ready`, cả hai đều xanh. Hai lượt chạy thử, một route, hai câu trả lời, không luật nào để kêu.

**`route.schema.json` đòi ít nhất một write root, còn `declaredWriteRoots` mặc định rỗng.** Với giá trị
mặc định, `workspace.bind` buộc phải bịa ra một write root chưa ai giao cho nó thì mới phát được
`route.json` hợp schema. Lượt này khai tường minh `src` và `public` nên mâu thuẫn chưa cắn; nó sẽ cắn
người gọi đầu tiên dùng mặc định.

**Sổ head của businesses và thư mục không khớp nhau.** Lúc rà bằng chứng,
`.worktrees/businesses/features/` có `course-community`, thứ mà `featureHeads` trong
`business-registry-v1.json` không liệt kê. `business.decide` phân loại một head là absent, fresh hay
stale dựa trên registry, nên một head có trên đĩa mà vắng trong sổ sẽ đọc ra thành absent, và một lần
publish đầu tiên sẽ đè lên một head đang sống. Worktree businesses bẩn suốt phiên (một
`features/course-community/` chưa track bên cạnh một registry đã sửa), nên nguyên nhân trực tiếp ở đây
là một phiên khác đang ghi dở — cũng chính là mối nguy ấy nhìn từ phía kia: operator này đọc một gốc
đọc-sửa-ghi dùng chung mà không có lease nào nó quan sát được.

**Luật của validator dịch chuyển ngay dưới chân lượt chạy, tận hai lần.** `.claude` bẩn suốt phiên, và
tập file bẩn còn đổi ngay trong lúc phiên đang chạy. Lúc đầu là `M scripts/validate-response.mjs` và
`M templates/kinds/route.schema.json`, đúng hai file dùng để phán xét lượt chạy. Tới cuối phiên thì hai
file đó biến mất và một tập khác bẩn lên: `knowledge/ui/presentation/padding.md`, hai file INDEX của
`knowledge/ui`, cùng `operators/frontend-presentation-resolve/operator.md` và bản gương của nó — đúng
phần tri thức và đúng operator mà bước 4 của workflow này sẽ ràng nếu nó đi tới đó. Mọi validator đã
được chạy lại ở cuối phiên và vẫn xanh, nên không kết luận nào trong bản ghi này phụ thuộc vào trạng
thái trước đó. Khiếm khuyết ở đây là sự phơi mình chứ không phải một kết quả hỏng: một lượt chạy bị phán
xét theo cây làm việc chứ không theo head, và hai phiên dùng chung cây này có thể đổi phán quyết của
nhau ngay giữa chừng. Có một hệ quả phụ đáng ghi: lượt chạy trước báo rằng
`scripts/validate-response.mjs` không gọi được từ CLI của chính nó; ở đây nó gọi sạch, nghĩa là khiếm
khuyết ấy đã được sửa đâu đó trong dòng chảy, và lượt này không còn nói được là do ai.

### Lỗ hổng orchestrator

**`frontend-new-surface` không bao giờ bind backend, mà `business.decide` không làm việc được nếu thiếu
nó.** Bước 1 của workflow bind role `fe` và chỉ `fe`. Bảng Context của bước 2 khai `@workspaces/be` là
**bắt buộc**, "đọc tại head đã đóng băng; mọi fact claim trích dẫn nó theo path, khoảng dòng và head".
Không bước nào của workflow này bind `be`, nên orchestrator buộc phải đóng băng một head backend mà
không `workspace.bind` nào giải ra — đúng cái nước đi "một thư mục trùng tên không phải thẩm quyền
route" mà `workspace.bind` sinh ra để cấm. Lượt này đọc thẳng head (`d5926ae857…`) và nói rõ như vậy
thay vì giả vờ khác đi. Workflow cần thêm một branch `workspace.bind` với `role: be` trong bước 1, và
`validate-workflows.mjs` không bắt được thiếu sót ấy vì nó chỉ kiểm Inputs, không bao giờ kiểm Context.

**Cái binding duy nhất mà chuỗi sinh ra lại không mang nổi gốc thẩm quyền mà bước sau cần.** Route `fe`
là một checkout `sibling`, và validator của `workspace.bind` nói rằng một checkout sibling không mang
gốc thẩm quyền nghiệp vụ, nên `authorityRoots.businesses` là `null` theo luật. Ấy vậy mà bước ngay sau
đó publish một head dưới `@worktrees/businesses`. Nó tới được đó qua `alias/alias.json`, thứ giải gốc ấy
từ `<Source>` độc lập với mọi binding — nghĩa là gốc businesses tới tay `business.decide` bên ngoài mọi
trường đã validate, còn cái receipt lẽ ra uỷ quyền cho nó thì ghi `null`.

**Bước 1 → bước 2 là một kề cận mà không bảng `## Next` nào cho phép.** Bảng Next của `workspace.bind`
gọi tên `git.publish`, `backend.source.apply`, `frontend.source.apply` và `platform.operate`. Nó không
gọi `business.decide`, cũng không gọi `frontend.direction.decide` — vậy mà ba trong tám workflow ví dụ
mở đầu bằng đúng những nhịp ấy. `SKILL.md` nói một chuỗi tự soạn được dựng từ bảng `## Next` của các
operator, nhưng `validate-workflows.mjs` không bao giờ đọc chúng, nên các ví dụ vẫn xanh trong khi chỏi
lại chính luật mà entry áp cho mọi thứ khác.

**Không có vật mang có kiểu nào nối bước 1 với bước 2.** `business.decide` không khai Input kind `route`
hay `workspace-route-binding` nào, nên `request.json.inputs` bắt buộc phải rỗng và các head đã đóng băng
chỉ đi được dưới dạng mục `contexts` do orchestrator viết. `orchestrator.json` phát biểu luật bàn giao
là "inputs của `request.json` bước sau trỏ vào `step-N/parallel-M/<path>`"; ở đây không có gì để trỏ, và
receipt của bước 1 không được thứ gì đọc tới.

**`EVIDENCE_MISSING` định tuyến về một lần resume không thể thành.** `domain: "self"` đẩy nó về lại
`business.decide`, nơi sẽ gặp đúng bức tường cũ và trả `NO_PROGRESS` → `caller` → `user`. Bản đồ không
có cách diễn đạt "bằng chứng này chỉ con người mới cấp được", nên người bị hỏi tới muộn mất một lần gọi.
`SKILL.md` có lường trước điều này ("một tuyến `resume` trả `NO_PROGRESS` nghĩa là cùng đầu vào đụng
cùng bức tường: hãy báo bức tường thay vì thử lại"), nhưng đó là lời khuyên cho người đọc chứ không phải
một tuyến.

**Chính sách worktree `forbidden` và luật nhánh phiên không thể cùng đúng.** Mục `sourceWrites` của
`orchestrator.json` đòi mọi operator ghi source phải commit trên `session/<sessionId>` trong một worktree
dựng từ head đã đóng băng, rồi `git.publish` merge nó vào. Chính sách `fe` đã route lại đặt
`worktreeBranches: forbidden`, và validator của `workspace.bind` từ chối bind một route như thế trên bất
kỳ nhánh nào khác nhánh mutation. Với route này, bước 5 và bước 8 của `frontend-new-surface` không bao
giờ chạy hợp lệ được như đặc tả. Workflow chưa từng tới đó nên chưa có gì hỏng.

**Bản ghi bền duy nhất của một phiên blocked là viết tay.** `orchestrator.json` giữ lại thư mục phiên
khi có block, và điều đó đã xảy ra. Nhưng thư mục phiên chỉ chứa hai file `response.json` trần trụi;
bản tường trình về những gì đã tìm và vì sao lượt chạy dừng chỉ tồn tại nhờ tài liệu này được viết tay
vào `.claude/tests/runs/`. Không có gì trong runtime sinh ra nó.

## Phần thuộc về con người

Yêu cầu này không thể đi tiếp như một mission frontend. Trước khi vẽ bất kỳ trang nào, phải có người
quyết lời hứa: ai được chơi bida trên học viện này, nó miễn phí, chặn theo entitlement hay phải mua, các
điểm vào là gì, từ chối thì xảy ra chuyện gì, và một ván xong hay một ván bỏ dở kết toán thành cái gì.
Quyết định ấy hôm nay không có bằng chứng nào trong source đã route, và runtime từ chối bịa ra nó là
đúng. Khi nó đã tồn tại — hoặc dưới dạng một đường backend thật có fact claim, hoặc qua một lối publish
lần đầu mà cây hiện chưa có — thì chính chuỗi này có thể chạy lại từ bước 2, với một binding `role: be`
thêm vào bước 1.
