# Lượt chạy — frontend-refine trên bề mặt Pro subscription, vòng 2 (2026-09-03)

Đây là lượt diễn tập thứ hai của cùng một workflow trên cùng một target, lần này chạy trên cây 1.0.3
và trên một head frontend đi trước vòng 1 hai commit. Câu hỏi của vòng này rất hẹp: sau khi vòng 1
được vá, `frontend.presentation.resolve` có còn chặn `RULE_MISSING` ở inset trục dọc của route nữa
không, nó có gỡ đúng class accent trên marker không, và sau đó `frontend.source.apply` có chạy được ở
`mode: dry` không. Nửa đầu câu hỏi được trả lời là có. Nửa sau thì chưa bao giờ tới lượt, và lý do
được ghi thẳng ở dưới chứ không được làm cho êm đi.

Thư mục phiên là `.worktrees/sessions/20260903-r2-frontend-refine/`, nằm trong gitignore và được giữ
nguyên trên đĩa. Một orchestrator cùng một agent cho mỗi nhánh, tất cả trong một tiến trình. Không có
commit nào, không có gì được ghi vào checkout frontend, không lệnh ghi git nào được chạy ở bất kỳ đâu,
không e2e, không đọc bí mật. Mỗi nhánh đều nêu profile mà `operator.json` của nó ràng, và mọi nhánh
đều do Claude Opus đứng thay, theo `resources/orchestrator.json#profileEquivalents`. Điều này đáng nhớ
gấp đôi ở đây: `workspace.bind` và `frontend.presentation.resolve` ràng `luna`, mà tương đương Claude
đã khai của `luna` là `sonnet`, nên với ba trong bốn nhánh, Opus thậm chí không phải là người đứng
thay đã khai; không ranh giới profile nào được thử trong vòng này.

## Tóm tắt yêu cầu

Workflow là `frontend-refine`, target là route `/[lang]/subscriptions`, tức
`src/app/[lang]/subscriptions/page.tsx`, route duy nhất dựng `ProSubscriptionBlock` qua
`ProSubscriptionPage`. Head frontend đóng băng là `8d8ed9a1456e1e8ef9d1d6fd80a41c20a520d3a2`, đọc
bằng `git rev-parse HEAD` ở chế độ chỉ đọc; vòng 1 đóng băng `14e0c20f`, và từ đó có thêm `f7167fa`
với `8d8ed9a`. Head knowledge là `3d30a88e4b5a4e56fab5502b54621b738be5654b` trên `main` của `.claude` (INDEX ghi
1.0.3), với `package.json` đang bẩn trong working tree lúc lượt này đóng băng head; tới khi bản ghi
này được viết thì một phiên khác đã commit `f6ca8fb3` và `74108a4b`, và cây tự gọi mình là 1.1.0. Gói Grammar là `@starci/grammar@0.4.2`.

Chuỗi mà workflow khai là bind với `runtimeNeed: consume`, rồi direction, resolve, apply với
`mode: apply`, rồi audit theo ma trận, rồi quality, rồi publish. Chuỗi thật sự chạy là bốn nhánh:
`workspace.bind` chặn, `workspace.bind` chạy lại và xong, `frontend.direction.decide` xong,
`frontend.presentation.resolve` giải hết cây rồi trượt chính validator của mình. Người gọi ràng thêm
một luật đè lên preset: mọi operator ghi source chỉ được chạy `mode: dry`, nên bước 5 nếu tới sẽ mang
`dry` chứ không phải `apply` như preset của workflow.

Requirement lấy từ preset workflow cộng default mà từng operator tự khai. `project` và `target` lại
không có default và được suy ra đúng như vòng 1. `declaredWriteRoots` được orchestrator khai là `src`,
vì vẫn không file nào nói ai sở hữu trường đó — khoảng trống ấy chưa thay đổi.

## Bước 1 — `workspace.bind`

`operator.json` ràng profile `luna`; Claude Opus đứng thay. Nhánh kết thúc `blocked` với stop
`RUNTIME_NOT_READY`, domain `runtime`, và `routing.json` trả domain ấy về `{"kind": "external"}`.
Bốn validator đều nói đúng như vậy:

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

Lỗi CLI của `validate-response.mjs` mà vòng 1 báo đã được vá thật: mọi nhánh của vòng này kiểm được
bằng chính CLI đó với exchange đúng, bốn lỗi giả đã biến mất. Nhánh chỉ ghi `response/response.json`,
kèm đoạn `reason` tuỳ chọn mới thêm; một bind bị chặn không ghi receipt và không ghi `route.json`, vì
`operators/workspace-bind/validate.mjs` nói thẳng rằng "a blocked branch cannot carry a route", nên
`reason` là chỗ duy nhất nhánh có để tự giải thích. Đó là bản vá thứ hai của vòng 1 được lượt này dùng
tới, và nó chạy đúng.

Bốn bước đầu của operator qua sạch y như vòng 1: khai báo portable và route đã hydrate thống nhất,
checkout sibling giải về `D:\Repositories\starci-academy-fe`, trên `main`, sạch, ở `8d8ed9a1`. Chính
sách Git của route giờ là `session-only` với mutation branch `main`, nên mâu thuẫn mà vòng 1 tìm ra
giữa `sourceWrites` và một route `forbidden` đã hết, và một operator ghi source đã có chỗ hợp lệ để
commit. Bước 5 chạy, vì preset của workflow nay nâng `runtimeNeed` lên `consume`, và đó là chỗ nhánh
dừng. `.worktrees/sessions/central-runtime/owner.json` khai generation 6 với `status: ready`, nhưng
chứng cứ mới nhất của nó là `2026-09-01T19:54:08Z` trên head `5fe51662…`, không phải head của phiên
này mà cũng không phải head của vòng 1, và bây giờ không ai lắng nghe cả:

```text
$ curl -s -o /dev/null -w "%{http_code}" -m 5 http://localhost:3000/en/subscriptions
000
$ curl -s -o /dev/null -w "%{http_code}" -m 5 http://localhost:3001/
000
```

Một registry tự nhận `ready` trong khi không endpoint nào phục vụ là một registry cũ, và đó đúng là
`RUNTIME_NOT_READY`. Một khiếm khuyết thứ hai, độc lập, trong cùng registry ấy được ghi lại nhưng
không phải thứ làm nhánh dừng: endpoint `identity` là `http://localhost:8080`, trong khi
`.workspaces/ports/starci-academy` (offset 0, slot step 1000) cộng quy ước của dự án cho ra 8089; tự
nó thì đó là `ENDPOINT_AUTHORITY_STALE`. Route viết sai chính tả `/vi/subcribtions` trong chứng cứ
frontend mới nhất cũng vẫn còn nguyên.

## Bước 2 — `workspace.bind` chạy lại

`operator.json` ràng `luna`; Claude Opus đứng thay. Nhánh `done`, không stop, không fallback. Bốn
validator xanh:

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

Nhánh này tồn tại vì `RUNTIME_NOT_READY` trả về `external`, tức chuỗi đã hết đường nếu để runtime
quyết. Người đã khoanh vùng vòng chạy này mới là người sở hữu quyết định đó, và quyết định họ đã nêu
sẵn chính là chuỗi rút gọn: bind, direction, resolve, apply ở `mode: dry`, còn `frontend.surface.audit`
nằm ngoài vòng. Không nhánh nào trong chuỗi ấy tiêu thụ endpoint. Vì thế lần chạy lại mang đúng một
delta, là một requirement chứ không phải một quan sát mới, và token nói thẳng điều đó: `runtimeNeed`
từ `consume` xuống `none`. Đó là delta thật nên `NO_PROGRESS` không áp dụng, còn nhánh bị chặn vẫn
nằm trên đĩa làm chứng.

Nhánh ghi `response/response.md` kiểu `workspace-route-binding`, `response/data/route.json` kiểu
`route`, và `response/response.json`. Ràng buộc thu được giống vòng 1 với ba khác biệt: head là
`8d8ed9a1`, chính sách worktree là `session-only`, và do đó `mutationReadiness` là `ready` chứ không
còn `read-only`. `writeRoots` là `["src"]`, và lỗi `minItems: 1` của `route.schema.json` mà vòng 1 báo
đã vá, nên một bind chỉ đọc bây giờ cũng diễn đạt được. `authorityRoots.businesses` là `null`, đúng,
vì đây là checkout sibling. Finding ghi được: `ROUTE_HYDRATED_FROM_PORTABLE` và
`IDENTITY_ROSTER_SEALED`; `WORKTREE_BRANCH_FORBIDDEN` biến mất cùng chính sách sinh ra nó. Có một điều
receipt chỉ nói được bằng văn xuôi: file route đã hydrate vẫn ghi `head: 14e0c20f…`, đi sau checkout mà
nó trỏ tới hai commit. Không luật nào biến chuyện đó thành stop, và cũng không có mã finding cho nó.

Fingerprint vẫn suy ra như vòng 1 và cách suy ra vẫn không được file nào quy định:
`routeFingerprint` là SHA-256 của file route đã hydrate, `identityFingerprint` là SHA-256 của
`.workspaces/device-state.json`.

## Bước 3 — `frontend.direction.decide`

`operator.json` ràng `sol-fresh`, mà tương đương Claude đã khai là `opus`; Claude Opus chạy, và đây là
nhánh duy nhất của vòng này mà người đứng thay đúng là người đã khai. `@tools/websearch` không được
dùng: một refine làm việc từ idiom của gia đình là đủ, và chính validator của operator từ chối một
dòng reference trên refine. Nhánh `done`, không stop, không fallback:

```text
$ node scripts/validate-request.mjs <session>/step-3/parallel-1
request valid

$ node scripts/validate-response.mjs <session>/step-3/parallel-1
response valid

$ node scripts/validate-step.mjs <session>/step-3/parallel-1
step valid

$ node operators/frontend-direction-decide/validate.mjs <session>/step-3/parallel-1
valid frontend.direction.decide branch
```

Nhánh ghi `response/response.md` kiểu `frontend-direction-decision`, `response/data/coverage.json` kiểu
`ui-coverage`, và `response/response.json`. Không có trang candidate và không có ảnh, cùng lý do như
vòng 1: một candidate dưới `preview: no` thì không dựng gì, và không vùng nào của bề mặt này đọc ra
trống.

Hướng thu được y hệt vòng 1: `pro-subscription-refine`, phân loại `locked-refine`, candidate
`resting-status-truth`, mười hai đòn tấn công đều `holds`, năm vùng, bốn hành động, bảy nghĩa trạng
thái với bảy vật mang riêng, hai nhánh responsive. Và đây là mô tả trung thực về cách nó được tạo ra:
từng quan sát được đọc lại tại head mới, mọi dòng chứng cứ trong `## Observed` được neo lại vào
`8d8ed9a1` trước khi receipt được nhận, còn chỗ nào quan sát không đổi thì giữ nguyên câu chữ của vòng
1 thay vì viết lại cho khác. Hai commit xen giữa không đụng vào block này: `f7167fa` và `8d8ed9a` đều
là thay đổi của Grammar, container query sở hữu nhánh xếp chồng của rail vẫn nằm ở
`packages/grammar/src/common/styles.css:986-990`, `PrimaryRailLayout` vẫn chỉ publish `railWidth` và
`align` (`packages/grammar/src/core/composition/PrimaryRailLayout/index.tsx:4-35`), và hai file của
block giống hệt vòng 1 ngoài chuyện trôi số dòng.

## Bước 4 — `frontend.presentation.resolve`

`operator.json` ràng `luna`, tương đương Claude đã khai là `sonnet`; Claude Opus đứng thay. Agent phát
ra `status: done`, nhưng nhánh **không xanh**: response trượt `validate-response` và trượt cả validator
của chính operator, nên không có gì route đi tiếp. Không mã stop nào được phát, vì trong tám mã ở bảng
Stops của operator không mã nào mô tả chuyện đã xảy ra, và bịa ra một mã thì không có cửa.

```text
$ node scripts/validate-request.mjs <session>/step-4/parallel-1
request valid

$ node scripts/validate-response.mjs <session>/step-4/parallel-1
step-4/parallel-1/response/response.md:138: row 14 cell Because "`SURFACE-4` Case 2 publishes this pairing only for a leading marker inside a raised region, and this marker sits on the unraised card face" does not match ^(reimplements an owned relationship|overrides Grammar anatomy|off the closed scale)$

$ node scripts/validate-step.mjs <session>/step-4/parallel-1
step-4/parallel-1/response/response.md:138: row 14 cell Because "`SURFACE-4` Case 2 publishes this pairing only for a leading marker inside a raised region, and this marker sits on the unraised card face" does not match ^(reimplements an owned relationship|overrides Grammar anatomy|off the closed scale)$

$ node operators/frontend-presentation-resolve/validate.mjs <session>/step-4/parallel-1
step-4/parallel-1/response/response.md:138: row 14 cell Because "`SURFACE-4` Case 2 publishes this pairing only for a leading marker inside a raised region, and this marker sits on the unraised card face" does not match ^(reimplements an owned relationship|overrides Grammar anatomy|off the closed scale)$
response/data/inventory.json: rule MARGIN-6 is applied and no node claims it under data-contract
```

Nhánh ghi `response/response.md` kiểu `frontend-presentation-resolution`,
`response/data/inventory.json` kiểu `inventory`,
`response/artifacts/pro-subscription-refine.resolved.tsx` kiểu `resolved-tree`, và
`response/response.json`. Bước 8 và bước 9 của operator chạy lần đầu tiên trong mọi vòng, nên đây là
inventory đầu tiên và cây đã giải đầu tiên mà runtime từng sinh ra — và cả hai lỗi ở trên đều đến từ
đúng vùng đất mới ấy.

Hai bản vá knowledge của vòng 1 đều chạy đúng, và đó chính là câu trả lời vòng này cần. `block>main`
cùng `block>main[failed]` mang `py-6 sm:py-8`; `PADDING-9` Case 1 publish đúng điều kiện đó — `main`
của một block được route nằm ngay dưới shell trang, chỉ trục dọc, còn trục ngang để cho
`PageContainer` — nên nó được chọn không do dự, và vì thứ tự của nó là 9, nằm ngoài bảng
`ORDINAL_TO_STEP`, phép kiểm bước lớp bỏ qua đúng như một rule ghép nên bỏ qua. `RULE_MISSING` thứ nhất
của vòng 1 đã hết. Còn `IncludedMark` của mỗi hàng benefit mang `text-accent-soft-foreground`, và luật
mới của operator, "class bị cấm thì gỡ chứ không phải thiếu rule", giải quyết nó: `SURFACE-4` Case 2
chỉ publish cặp màu ấy bên trong một dải được nâng, marker này nằm trên mặt thẻ không nâng, Case đã trả
lời là không, nên class bị gỡ ở bước 7 và marker rơi về foreground kế thừa đúng như thiết kế của gói
(`packages/grammar/src/core/primitive/IncludedMark/index.tsx`, một vòng tròn tick viền "in inherited
foreground", vẽ bằng `currentColor`). `RULE_MISSING` thứ hai cũng hết. Toàn bộ lượt đi kết thúc với
**không `RULE_MISSING`, không `KNOWLEDGE_UNBOUND`, không `UNKNOWN_RULE`**: 47 dòng owner, 41 dòng rule
được chọn trên 17 rule, 14 class bị gỡ, 4 gap, và mọi rule trong inventory đều do
`@knowledge/ui/presentation` publish.

Chỗ nó trượt nằm ở cây chứ không ở bề mặt, và có hai chỗ. Thứ nhất, cái gỡ vừa nói không có lý do nào
hợp lệ để ghi: `## Removed` publish một enum ba giá trị đóng, và không giá trị nào đúng với class này —
`IncludedMark` publish `className` như một prop công khai nên truyền class vào không phải là đè giải
phẫu Grammar; class ấy không cài lại quan hệ nào của gói; và `text-accent-soft-foreground` nằm trên
thang màu đã publish chứ không ngoài thang. Chính luật mới của operator nói rằng cái gỡ "được ghi kèm
Case đã từ chối nó", mà bảng thì không có cột cho Case và cũng không có giá trị lý do nào nghĩa là từ
chối. Nhánh viết câu đúng rồi để validator bác, vì viết một trong ba lý do được phép sẽ là một câu sai
về lý do một class rời khỏi cây, đúng thứ mà operator này sinh ra để từ chối. Thứ hai, `MARGIN-6` không
có chỗ để claim: nhịp giữa khối định hướng và workspace là của ứng dụng, mà node duy nhất mang được nó
là `PrimaryRailLayout`, nơi `className` đi tới div container còn mọi prop khác bị destructure bỏ; với
`contractEmission: on`, bước 8 không có chỗ đặt `data-contract="MARGIN-6"`, trong khi validator đòi mọi
rule đã áp phải được claim trên cây. Bỏ `MARGIN-6` khỏi inventory thì nhánh xanh, nhưng xanh bằng cách
giấu một giá trị đang thật sự được áp, nên nó được giữ lại.

Có một khiếm khuyết nữa nhánh này đụng phải rồi mới đi vòng qua, sau khi đã xác lập nó. Các dòng
`## Gaps` của receipt và `inventory.gaps` phải bằng nhau từng ký tự, mà `unquote` trong `tableUnder` gỡ
dấu backtick mở của mọi ô một cách độc lập với backtick đóng. Một câu "Missing path" mở đầu bằng một
code span, tức cách tự nhiên nhất để viết "`PageContainer` publishes no gap prop", vì thế tới chỗ so
sánh dưới dạng ``PageContainer` publishes no gap prop`` và không bao giờ bằng được JSON. Nó hiện ra như
sau:

```text
response/response.md: the Gaps table and inventory.gaps differ (4 rows against 4)
```

Bốn câu gap được viết lại cho không câu nào mở đầu bằng code span, tức một cách đi vòng nằm trong
receipt để né một lỗi nằm trong validator; và chính con số trong thông báo mới là thứ làm nó khó tìm:
nó nói hai danh sách khác nhau trong khi in ra hai con số bằng nhau và không nêu dòng nào.

Về phần bản đồ sở hữu, Grammar giữ khoảng cách vùng của `PrimaryRailLayout` (`GAP-5`), gap và inset nội
dung của thẻ joined (`GAP-0`, `PADDING-0`), inset của trigger accordion (`PADDING-4`), gap của
`SurfaceCopyGroup` (`GAP-2`), hạng của giá một khi nó chuyển sang `Text size="metric-lead"` (`FONT-5`),
cùng inset và gap của `EmptyNotice`; phần còn lại thuộc ứng dụng. Mười bốn class bị gỡ là mười ba của
vòng 1 — sáu override của `proWorkspaceClassName` thò vào giải phẫu Grammar, `gap-5` ngoài thang đóng,
bốn class typography trên span giá, `text-left` của summary disclosure, và `rounded-medium` ngoài thang
— cộng thêm foreground accent của marker. Bốn gap là `PageContainer` không có prop nhịp vùng,
`PrimaryRailLayout` không có prop thứ tự rail, `Button` không có prop full-width hay wrapping, và
`IncludedMark` không có prop kích thước hay canh lề; gap cuối cùng năm nay mất nửa phần tone, vì tone
giờ đã được trả lời bằng một lời từ chối chứ không còn là chỗ thiếu.

## Bước 5 — `frontend.source.apply`, không được điều phối

Profile nó sẽ ràng là `luna`; nó không chạy. `frontend.source.apply` khai
`frontend-presentation-resolution` là input **bắt buộc**, mà response của bước 4 không route: nó trượt
cả hai validator, và chỉ một trường đã hợp lệ của `response.json` mới route. Nếu vẫn trỏ bước 5 vào
receipt ấy thì request vẫn sẽ hợp lệ — `validate-request.mjs` chỉ kiểm đường dẫn input có tồn tại
trong phiên chứ không bao giờ đọc `response.json` của nhánh sinh ra nó, đúng khoảng trống orchestrator
số 1 của vòng 1, vẫn còn nguyên — và như thế là một màu xanh bịa. Vậy nên `mode: dry` chưa được thử ở
vòng thứ hai liên tiếp. Đây là những gì có thể nói về nó mà không chạy nó, đọc từ `operator.md` và
`operators/frontend-source-apply/validate.mjs` tại head này: chế độ ấy nay đã có,
`writes.json` mang `mode`, một `commit` null và danh sách `files`, còn validator buộc một nhánh dry
phải có commit null, không dòng nào trong `commits`, và không file nào có `before` khác một `after`
khác null. Vế cuối nghĩa là một kế hoạch dry chỉ diễn đạt được với `after: null`, tức kế hoạch nói
được sẽ động vào đường dẫn nào nhưng không nói được nội dung sẽ thành gì; và `writes.branch` vẫn buộc
phải là `session/<sessionId>` dưới một chế độ không tạo nhánh nào.

`frontend.surface.audit` nằm ngoài vòng này theo đúng cách người khoanh vùng, và dù sao cũng không thể
chạy: không endpoint nào phục vụ, đó chính là thứ bước 1 dừng lại vì nó.

## Khiếm khuyết và đề xuất sửa

**1. `## Removed` không nói được lý do mà chính luật của operator sinh ra.** File là
`templates/kinds/frontend-presentation-resolution.contract.json`. Bằng chứng: luật mới trong
`operators/frontend-presentation-resolve/operator.md` nói cái gỡ "is recorded with the case that
refused it", trong khi ô `Because` của hợp đồng là
`^(reimplements an owned relationship|overrides Grammar anatomy|off the closed scale)$`, cộng với đầu
ra `validate-response` ở trên. Vòng 1 đã báo enum này quá hẹp (khiếm khuyết operator/hợp đồng số 6) và
nó không được đổi; luật mới nay đưa nó ra đường chính, nên đúng ca mà vòng knowledge được vá vì nó lại
không ghi xuống được. Đề xuất: nới ô ấy để mang được Case đã từ chối, giữ nguyên ba lý do phân loại cũ,
thành `^(reimplements an owned relationship|overrides Grammar anatomy|off the closed scale|refused by [A-Z][A-Z0-9-]*-[0-9]+ Case [0-9]+)$`,
và thêm một dòng ví dụ vào `frontend-presentation-resolution.skeleton.md`. Cố tình không đề xuất một
giá trị tự do kiểu "quyết định composition đã đổi": lời từ chối có địa chỉ, và địa chỉ mới là thứ một
lượt audit sau này cần.

**2. Một claim không có chỗ đáp khi ứng dụng tạo dáng cho một component Grammar qua `className`.** File
là `operators/frontend-presentation-resolve/validate.mjs` (vòng lặp khi `contractEmission === 'on'`) và
bước 8 của `operator.md`. Bằng chứng: `MARGIN-6` / `mt-8` được viết trên `PrimaryRailLayout`
(`src/components/blocks/commerce/ProSubscriptionBlock/component.tsx:202-204` tại `8d8ed9a1`), còn
`packages/grammar/src/core/composition/PrimaryRailLayout/index.tsx:16-22` destructure `primary`,
`rail`, `railWidth`, `align`, `className` và không chuyển tiếp gì khác, nên không thuộc tính
`data-contract` nào truyền vào được; thông báo của validator nằm trong đầu ra ở trên. Hình dạng này sẽ
lặp lại ở mọi chỗ Common publish `className` mà không publish prop cho quan hệ ứng dụng đang sở hữu,
tức đúng tình huống mà bảng `## Gaps` sinh ra để ghi, và ba trong bốn gap của bề mặt này là hình dạng
ấy. Đề xuất: cho phép phép kiểm emission bỏ qua một rule mà node của nó trong owner map là một
component Grammar đã được receipt ghi dưới `## Gaps`, và thêm vào bước 8 của `operator.md` một câu nói
rõ điều đó. Phương án còn lại, để mọi component Common nhận `className` chuyển tiếp luôn
`data-contract`, là một thay đổi của Grammar và thuộc về chủ gia đình chứ không thuộc chỗ này.

**3. `unquote` gỡ backtick mở, nên một câu trong Gaps không bao giờ được mở đầu bằng code span.** File
là `scripts/validate-response.mjs`, dòng
`const unquote = (s) => String(s ?? '').trim().replace(/^`|`$/g, '')`. Bằng chứng: thông báo
`the Gaps table and inventory.gaps differ (4 rows against 4)` của lượt này, với cả bốn dòng chỉ khác
nhau đúng một backtick mở. Mọi chỗ dùng `tableUnder` đều dính, không riêng validator của resolve. Đề
xuất: chỉ gỡ khi ô được quote trọn vẹn, tức
`const unquote = (s) => { const t = String(s ?? '').trim(); return /^`[^`]*`$/.test(t) ? t.slice(1, -1) : t; };`
và trong `operators/frontend-presentation-resolve/validate.mjs` thì nêu tên dòng lệch đầu tiên thay vì
in ra hai con số.

**4. Preset `runtimeNeed: consume` làm cả chuỗi refine không tới được.** File là
`workflows/frontend-refine.json`, và cả bốn workflow frontend khác đã nhận cùng preset ấy. Bằng chứng
là bước 1 của lượt này: chỉ bước 5, `frontend.surface.audit`, mới tiêu thụ endpoint, mà `workspace.bind`
lại dừng chuỗi ngay từ bước 1 khi runtime chung không sống, nên direction, resolve và apply — không
cái nào chạm tới cổng nào — không chạy nổi. Vòng 1 nâng preset để chữa `RUNTIME_UNAVAILABLE` ở audit;
bản vá ấy đẩy chỗ hỏng lên sớm hơn và làm nó thành toàn phần. Đề xuất: ràng runtime ở đúng chỗ tiêu thụ
nó, tức để bước 1 là `{"role": "fe"}` và thêm một bước `workspace.bind` thứ hai ngay trước audit,
`{"operator": "workspace.bind", "requirements": {"role": "fe", "runtimeNeed": "consume"}}`, kèm một
dòng mới trong bảng Next của `workspace.bind` cho cạnh `workspace.bind → frontend.surface.audit`. Câu
hỏi bỏ ngỏ của vòng 1, "ai sở hữu `runtimeNeed`", khi đó có câu trả lời: bước nào đọc endpoint thì
bước đó.

**5. Không có chỗ nào ghi được profile đứng thay.** File là `templates/step/response.schema.json`. Bằng
chứng: `resources/orchestrator.json#profileEquivalents.rule` nói "response.json records both
(boundProfile, ranProfile) so an audit can tell a stand-in from the binding", trong khi schema response
có `additionalProperties: false` và không có hai trường ấy, còn
`grep -rn "boundProfile\|ranProfile" templates scripts` không trả về gì. Mọi nhánh của vòng này đều
chạy bằng người đứng thay và không nhánh nào ghi được điều đó vào file mà chính luật gọi tên; bản ghi
này là chỗ duy nhất nó được viết xuống. Đề xuất: thêm vào `response.schema.json#properties` hai trường
`"boundProfile": { "type": "string", "pattern": "^[a-z][a-z-]*$" }` và
`"ranProfile": { "type": "string", "pattern": "^[a-z][a-z-]*$" }`, kèm một câu trong
`resources/orchestrator.json#agent` nói orchestrator điền chúng lúc điều phối.

**6. Một phiên không có hình dạng cho nhánh vừa `done` vừa không hợp lệ.** File là
`resources/orchestrator.json#session.manifest`. Bằng chứng là bước 4 ở đây: response `status: done`,
cả hai validator bác, và không gì route đi. Các trường mà `state.json` khai là
`id, project, startedAt, status, chain, steps, current, leases, requestHashes`, còn `blocked` chỉ được
mô tả cho trường hợp có mã stop. Lượt này lại tự bịa ra `stoppedAt`, lần này với `stop: null` và một
`why`, y như vòng 1 đã bịa ra nó với một mã. Đề xuất: thêm `stoppedAt` vào danh sách trường của manifest
với hình dạng `{ step, parallel, operator, stop: code | null, domain: string | null, route, why }`, kèm
một câu trong `session.lifecycle` nói rằng một response trượt validator kết thúc phiên y như một stop.

**7. Không gì đối chiếu head ghi trong route đã hydrate với head quan sát được.** File là
`readiness/initialization/workspaces/local-route.schema.json` (trường `repository.head`) và
`operators/workspace-bind/operator.md`. Bằng chứng:
`.workspaces/local/routes/starci-academy/fe/config.json` ghi
`head: 14e0c20f4746ae08f00a84a4eac18aa78ded987b` trong khi checkout nó trỏ tới đang ở `8d8ed9a1`, đi
trước hai commit; ràng buộc báo head quan sát được và không luật nào biến khác biệt ấy thành cái gì
cả. Đề xuất: ghi vào `description` của `repository.head` rằng đó là head lúc hydrate và không bao giờ
là thẩm quyền route, cùng một câu trong mục "Nothing is repaired here" của `workspace.bind` nói head
quan sát được là head thắng. Nếu chủ cây muốn nó hiện ra, phương án còn lại là thêm giá trị
`HYDRATION_HEAD_STALE` vào enum Findings của `workspace-route-binding.contract.json`, một thay đổi lớn
hơn cho lợi ích nhỏ hơn.

**8. Ứng viên knowledge: không topic nào sở hữu bo góc.** File là `knowledge/ui/presentation/`, tức một
`radius.md` mới cùng dòng catalog trong `INDEX.md`. Bằng chứng, nhiều hơn hai chỗ:
`src/components/blocks/commerce/ProSubscriptionBlock/classNames.ts:96` (`rounded-medium` trên dải trạng
thái, bị lượt này gỡ với lý do "off the closed scale") và
`src/components/blocks/learn/CourseFlashcardSessionBlock/classNames.ts:22` (`rounded-medium` trên thông
báo chỉ đọc); `grep -rno "rounded-[a-z]*" src --include=*.ts --include=*.tsx` bỏ spec ra thì trả về 134
kết quả trong toàn ứng dụng. Vòng 1 đã báo đây là khoảng trống knowledge số 4 và nó chưa đổi. Đề xuất:
đây là quyết định của chủ knowledge và lượt này không quyết thay. Hoặc publish
`knowledge/ui/presentation/radius.md` với thang bo góc đóng mà theme đang phơi ra (`rounded-small`,
`rounded-medium`, `rounded-large`, `rounded-full`) đánh số từ `RADIUS-1`, mỗi Case một loại ranh giới,
rồi thêm dòng của nó vào bảng `## Catalog` của `INDEX.md`; hoặc nói một lần trong mục thẩm quyền của
`INDEX.md` rằng bo góc không bao giờ là thuộc tính của ứng dụng và mọi class bo góc do app viết đều bị
gỡ — nếu chọn vế sau thì enum lý do ở khiếm khuyết số 1 cũng cần một giá trị cho nó, vì "off the closed
scale" đang bị dùng 134 lần cho một thuộc tính chưa có thang nào được publish.

**Mang từ vòng 1 sang, chưa đổi và vẫn mở.** `## Owner map` vẫn không có hình dạng dòng cho một node đã
xác định được chủ mà chưa chọn được rule, và vòng này nó cắn đúng marker accent — có chủ là `app`,
không có rule được chọn, và chỉ sống trong văn xuôi với bảng `## Removed`. `## Rules chosen` vẫn không
mang được một class nhiều token, nên `py-6 sm:py-8` mà `PADDING-9` publish phải nằm hai dòng cho mỗi
node, còn một rule có render "No class" thì vẫn không chọn được. `validate-request.mjs` vẫn không đọc
`response.json` của nhánh sinh ra input, nên một nhánh tiền nhiệm hỏng hoặc bị chặn vẫn có thể được đưa
tiếp; chỉ kỷ luật routing chặn nó lại, hai lần trong lượt này. Quy ước id phiên trong
`orchestrator.json` vẫn lệch với tên thư mục người gọi đặt, và không gì kiểm id ấy. `.claude` lại xê dịch ngay dưới chân lượt chạy này: nó bẩn lúc head được đóng băng
(`package.json` đã sửa), và tới lúc viết bản ghi thì một phiên khác đã publish `f6ca8fb3` ("release
1.1.0") cùng `74108a4b` chồng lên `3d30a88e`. `git diff --stat 3d30a88e..74108a4b` chỉ đụng vào đóng
gói, docs, INDEX và bản ghi của các lượt khác, nên không operator, topic knowledge, template hay
script nào lượt này ràng bị đổi, và các nhánh ở trên vẫn đứng. Runtime không nhận ra cả chỗ bẩn lẫn
hai commit ấy: `SOURCE_DRIFT` so head frontend, còn không nhánh nào ghim một head `.claude` để mà so. Registry `central-runtime` vẫn `ready` sau hai ngày kể từ chứng cứ cuối, vẫn khai
identity ở 8080 trong khi quy ước dự án là 8089, và chứng cứ frontend mới nhất của nó vẫn gọi tên
`/vi/subcribtions`; đó là địa hạt của `platform.operate` và không operator nào sở hữu việc nhận ra
chuyện đó.

## Phán quyết

Xanh với đúng câu hỏi vòng này được giao. `PADDING-9` trả lời inset trục dọc của route, class bị cấm
được gỡ thay vì làm dừng chuỗi, và lượt giải cây kết thúc không `RULE_MISSING`, không
`KNOWLEDGE_UNBOUND`, không `UNKNOWN_RULE` — hai bản vá knowledge của vòng 1 đứng vững trên đúng bề mặt
chúng được viết ra vì nó. Ba bản vá khác của vòng 1 cũng được dùng tới và đều đứng: CLI của
`validate-response`, write root trong `route.schema.json`, và `response.json.reason`, thứ duy nhất mà
một bind bị chặn viết được.

Không xanh với cả chuỗi. Nó đi được bốn nhánh rồi dừng ở nhánh thứ tư, và dừng vì cây chứ không vì sản
phẩm: receipt đầu tiên trong lịch sử chạm tới bước 8 và 9 lại không diễn đạt nổi bằng chính hợp đồng
của nó. `frontend.source.apply` với `mode: dry` chưa được thử ở vòng thứ hai, lần này không phải vì
thiếu chế độ mà vì không có gì hợp lệ để trao cho nó. Hai bản vá đủ để mở đường cho vòng ba đều nhỏ và
đã nêu tên ở trên: một giá trị lý do thứ tư trong
`frontend-presentation-resolution.contract.json`, và một chỗ bỏ qua trong phép kiểm emission cho một
thuộc tính mà ứng dụng sở hữu trên `className` của một component Grammar.

Chỗ dừng ở bước 1 là một chỗ dừng đúng, và cũng là một kết quả thiết kế đáng giữ lại: `runtimeNeed:
consume` đặt ở bind đầu tiên của năm workflow nghĩa là một máy không chạy dev server thì từ nay không
quyết được hướng và không giải được cây nữa, nhiều hơn hẳn những gì audit từng cần.
