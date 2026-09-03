# Lượt chạy — frontend-reconstruct trên dashboard học viên (2026-09-03)

Đây là một phiên chạy khô của StarCi Skills v8: một orchestrator cùng một agent cho mỗi operator, tất
cả nằm trong một tiến trình. Gốc phiên là `.worktrees/sessions/20260903-dryrun-frontend-reconstruct/`
và được giữ lại trên đĩa. Mỗi nhánh dưới đây đều nêu profile mà `operator.json` của nó ràng, nhưng
trên thực tế Claude Opus đã chạy thay cho tất cả, nên không một ranh giới profile nào được thử thật —
đó là điều đầu tiên cần nhớ khi đọc bất kỳ phán quyết nào ở đây. Chuỗi này cũng không ràng vào một
profile duy nhất: nó ràng bốn profile khác nhau thuộc hai nhà cung cấp, lần lượt là `sonnet`,
`sol-fresh`, `sonnet`, `opus` và `sol-reviewer`, nên giả định rằng mọi operator trong chuỗi đều chạy
`sol-fresh` là sai ở bốn trên năm bước. Không có commit nào, không có gì được ghi vào checkout
frontend, không file runtime nào trong `.claude` bị sửa, và không một lệnh ghi git nào được chạy ở
bất cứ đâu.

## Tóm tắt yêu cầu

| Trường | Giá trị |
| --- | --- |
| Workflow | `frontend-reconstruct` |
| Target | `/[lang]/dashboard` — `src/app/[lang]/dashboard/page.tsx` mount `DashboardPage`, nơi kết hợp toàn bộ block `src/components/blocks/dashboard/*` |
| Head frontend đóng băng | `14e0c20f4746ae08f00a84a4eac18aa78ded987b` (đọc bằng `git rev-parse HEAD`, cây sạch, nhánh `main`) |
| Chuỗi yêu cầu | 1 `workspace.bind` (fe) → 2 `frontend.direction.decide` (modify, reconstruct, 1 phương án, không preview) → 3 `frontend.presentation.resolve` → 4 `frontend.source.apply` (dry) → 5 `frontend.surface.audit` |
| Chuỗi chạy thật | cả năm bước. Bước 1 đến 4 `done`; bước 5 `blocked` với `RUNTIME_UNAVAILABLE`, và `routing.json` đưa nó sang `platform.operate` |
| Dừng ở | bước audit, đúng như yêu cầu; `quality.verify` và `git.publish` không bao giờ được điều phối |

Yêu cầu lấy từ preset của workflow cộng với mặc định mà mỗi operator tự nêu, không hỏi ai. Có ba giá
trị orchestrator buộc phải tự cấp vì không preset lẫn mặc định nào phủ: `project`, `target` và
`declaredWriteRoots`. Một preset bị ghi đè theo chỉ dẫn của người gọi: `frontend.source.apply` chạy
`dry` trong khi workflow đặt sẵn `apply`.

## Bước 1 — `workspace.bind`

Nhánh này kết thúc `done`, không stop. `operator.json` ràng profile `sonnet`, còn Claude Opus là thứ
thực sự chạy. Cả ba validator đều xanh: `request valid`, `response valid`, và
`valid workspace.bind branch`. Nhánh ghi ra `response/response.md` theo kind `workspace-route-binding`,
`response/data/route.json` theo kind `route`, cùng `response.json`.

Khai báo portable và route đã hydrate đồng ý với nhau về project, role, kho Git và nhánh. Checkout
thuộc loại `sibling` trong `starci-academy-fe`, phân giải về `D:\Repositories\starci-academy-fe`, đang
ở `main`, sạch, tại `14e0c20f…` — đúng head mà bản hydrate ghi. Gốc thẩm quyền nghiệp vụ là `null`,
chính xác, vì một checkout sibling không mang thẩm quyền ấy. `runtimeNeed` rơi về mặc định `none` nên
bước 5 của chính operator không chạy và ràng buộc này không mang endpoint nào — chính cái mặc định đó
làm bước 5 của *chuỗi* trở nên bất khả thi, xem G2. Mutation readiness ghi `ready` vì nhánh quan sát
được trùng nhánh mutation đã khai. Ba finding được ghi: `ROUTE_HYDRATED_FROM_PORTABLE`,
`WORKTREE_BRANCH_FORBIDDEN` và `IDENTITY_ROSTER_SEALED`.

Giữa nhánh này và bước 2, một phiên khác đã viết lại cả hai nửa của route: `worktreeBranches` chuyển
từ `forbidden` sang `session-only`, trước ở khai báo portable rồi tới route hydrate. Head đóng băng
không hề nhúc nhích nên `SOURCE_DRIFT` không bao giờ nổ, và không có mã nào dành cho việc thẩm quyền
route đổi ngay dưới chân một phiên đang sống. `routeFingerprint` trong biên nhận này hôm nay tính lại
đã ra một giá trị khác. Nhánh được giữ nguyên như lúc nó chạy, coi như bằng chứng; xem G1 và O1.

## Bước 2 — `frontend.direction.decide`

Nhánh `done`, không stop, không fallback. Profile ràng là `sol-fresh`, tức `gpt-5.6-sol` trên runtime
OpenAI, cho phép web search, browser, sinh ảnh và ghi source; Claude Opus chạy thay. Ba validator đều
xanh, và nhánh ghi ra biên nhận quyết định cùng `response/data/coverage.json`. Không trang phương án
nào và không ảnh nào được render, vì một phương án dưới `preview: no` thì không sinh trang, và chính
validator của operator từ chối một trang trong cấu hình đó.

UI contract có mười chín phần tử: tám vùng, sáu trạng thái, ba nhánh responsive, một dòng nội dung và
một dòng accessibility. Luận điểm của hướng đi rất hẹp và có bằng chứng: dashboard tự tay dựng một
rail cạnh main track — offset sticky, chiều cao `calc(100dvh-4rem-2rem-1px)`, `lg:w-64`, `lg:border-r`,
một làn cuộn riêng, `max-w-5xl mx-auto`, cùng một listener `matchMedia("(max-width: 69.999rem)")` điều
khiển drawer thu gọn — trong khi `PrimaryRailLayout` đã sở hữu đúng quan hệ ấy và đang sống ba lần
ngay trong cùng checkout. Phương án `rail-owned-column` trả cả hai track cho `PrimaryRailLayout`, trả
ràng buộc sticky và phần cuộn của rail cho `Rail mode="sticky"`, trả khổ trang và inset cho
`PageContainer`, trả một lần reflow duy nhất cho container query đã publish tại inline-size `56rem`, và
cho drawer của ứng dụng nghỉ hưu vì việc duy nhất nó làm là tái tạo lại chính lần reflow đó. Fact
nghiệp vụ, block, panel và thứ tự đọc đều nguyên vẹn.

Về coverage, `actions` rỗng và đó là một quyết định chứ không phải thiếu sót: khi drawer thu gọn và
nút quay lại của nó nghỉ hưu, bề mặt không còn tự khởi phát gì nữa — mọi hành động trên màn hình đều
thuộc về một block hoặc thuộc về navigation phía trên route. Tám vùng mỗi vùng mang một composition đã
publish và một tham chiếu playbook hoặc idiom; sáu nghĩa trạng thái mỗi nghĩa có carrier riêng, không
carrier nào dùng chung; ba nhánh responsive mỗi nhánh gọi tên đúng một chủ. `COVERAGE-1` đứng vững
dưới chính phép kiểm của operator.

Bảng `## Images` để trống, và đó là phán đoán chứ không phải né tránh. Chính sách ảnh của operator là
`judged`, nên quyết định phải được đưa ra: không vùng nào của bề mặt này đọc ra trống. Overview là tám
block đầy dữ liệu với nhãn, số đo và trạng thái rỗng của riêng chúng; rail mang danh tính và lối tắt.
Theo đúng luật của operator — một vùng mà copy và các đối tượng Grammar đã gánh nổi thì không nhận ảnh
— ở đây không chỗ nào xứng đáng, và không lần sinh ảnh nào được gọi.

Nghiên cứu có giới hạn vẫn chạy, vì người dùng không cấp tham chiếu nào và change level là
`reconstruct`. Một lần tìm kiếm trả về lời khuyên bố cục dashboard chung chung. Không thứ gì sống sót:
dòng `Learner dashboard` trong playbook đã cố định sẵn phần mà một tham chiếu được phép đóng góp — có
những mục nào, đọc theo thứ tự nào, và mục nào là hành động kế tiếp — đồng thời từ chối thẳng hình học
lưới, vỏ card và mật độ, vốn là toàn bộ những gì các nguồn kia thực sự đưa ra. Không trang nào được
tải về nên không giới hạn nào kiểm chứng được, và `## References` để trống thay vì mang một dòng không
ai kiểm.

Phản chứng gồm mười ba đòn, tất cả đều `holds` cho phương án duy nhất. Dòng rò rỉ chủ sở hữu là dòng
phải lập luận chứ không thể khẳng định suông, và suýt nữa trở thành thất bại trung thực của lượt chạy.
Vùng support thò vào giải phẫu của một block bằng
`max-lg:[&_[data-part=calendar-viewport]]:!overflow-x-auto` cùng hai lớp anh em. Nếu đánh `fails` thì
phương án duy nhất chết và operator dừng với `NO_VIABLE_DIRECTION`. Nó được ghi `holds` trên một ranh
giới bảo vệ được: ở tầng composition mọi vùng đều phân giải về một composition đã publish và không vùng
nào do một cách sắp xếp của ứng dụng làm chủ, còn thứ rò rỉ còn lại là một *class*, mà
`frontend.presentation.resolve` bước 7 công bố đúng cơ chế cho một class đè lên giải phẫu Grammar: gỡ
nó kèm một dòng riêng và ghi lại đường công khai còn thiếu vào `## Gaps` — đúng những gì bước 3 đã làm.
Danh sách phản chứng của operator không phân biệt rò rỉ tầng composition với rò rỉ tầng class, và mơ hồ
đó được ghi lại thành khiếm khuyết O12.

## Bước 3 — `frontend.presentation.resolve`

Nhánh `done`, không stop, không fallback, profile ràng `sonnet`. Ba validator đều xanh. Nhánh ghi biên
nhận resolution, `response/data/inventory.json` và cây đã resolve tại
`response/artifacts/dashboard.resolved.tsx`.

Bản đồ chủ sở hữu có mười một dòng. Năm dòng thuộc Grammar và không sinh class ứng dụng nào:
`PageContainer` giữ khổ trang qua `MEASURE-1`, `PrimaryRailLayout` giữ gap vùng qua `GAP-5`, còn `Rail`
giữ gap khung qua `GAP-4`, inset thân qua `PADDING-3` và cuộn trục block qua `OVERFLOW-3`. Sáu dòng
còn lại thuộc ứng dụng, trải trên bốn container: panel trong khe primary, cột overview, và ba dải
lead, metrics, support.

Luật được chọn gồm `GAP-5` ra `gap-6` trên panel và trên cột overview theo GAP-5 Case 2; `MEASURE-2`
ra `w-full` trên panel theo Case 1; và `GAP-4` ra `gap-4` trên lead, metrics, support theo Case 1.
Phép kiểm ordinal-sang-step đi qua sạch: `GAP-5` render thành `gap-6`, không bao giờ thành `gap-5`.
Inventory mang ba rule id, bảy token class, tất cả đều có mặt trong cây đã resolve, và mọi luật được
áp đều được một node claim dưới `data-contract` vì emission đang bật.

Bảng gỡ bỏ có hai mươi bảy dòng trên sáu node, mỗi dòng mang một trong ba lý do đã publish. Đáng chú ý
nhất là `max-w-5xl`, `mx-auto`, `px-3` và `py-6` trên main track ra đi vì *tái hiện một quan hệ đã có
chủ*: `MEASURE-1` nói thẳng rằng dựng lại khổ trang bằng một cái chặn trần cộng một margin căn giữa
chính là tái tạo một component mà trang đã sẵn có. Ba lớp đè theo bộ chọn hậu duệ trên vùng support đi
theo lý do *đè lên giải phẫu Grammar* — đúng chỗ rò rỉ mà bước 2 chuyển xuống.

Bảng khoảng trống có đúng một dòng, và đó là phần cặn trung thực của lần gỡ ấy: Common không phơi ra
đường công khai nào để chặn trục inline của lịch đóng góp từ bên ngoài chính block vẽ nó.
`OverviewContributions` phải tự kết hợp `HorizontalScrollRegion`, và chính DNA của họ đã ghi rằng
`HorizontalScrollRegion` hiện không sở hữu thứ gì một audit đo được. Theo luật rằng một đường công
khai thiếu là khoảng trống chứ không phải điểm dừng, nhánh ghi lại rồi đi tiếp. Không có
`RULE_MISSING` nào: mọi thuộc tính lần đi qua cây chạm tới đều phân giải về một case đã publish. Ba
tình huống sát ranh được ghi thành khoảng trống kiến thức thay vì thành stop, là K2, K3 và K6.

## Bước 4 — `frontend.source.apply`

Nhánh `done` ở chế độ `dry`, không stop, không fallback. Profile ràng là `opus`, profile duy nhất trong
chuỗi được cấp quyền `sourceWrite`. Ba validator đều xanh. `commits` rỗng và `writes.commit` là `null`.

Kế hoạch ghi khai báo năm đường dẫn, mỗi đường được băm tại head đóng băng. Bốn đường được chiếu là
`modified` với hash sau bằng null, đúng nghĩa của `dry`: `component.tsx` trở thành cây đã resolve;
`classNames.ts` chỉ giữ lại bảy token class đã publish; `index.tsx` thôi không còn sở hữu media query
rail thu gọn và giá trị mở drawer; còn `component.spec.tsx` được viết lại trong cùng commit vì nó
khẳng định về subnav, drawer và prop rail-presentation đã nghỉ hưu tới sáu mươi mốt lần, mà một lần
ghi để lại chính spec của mình đỏ thì không phải một lần ghi. Đường thứ năm,
`src/app/[lang]/dashboard/layout.tsx`, được khai là `unchanged` với hash trước và sau bằng nhau: nó là
layout tổ tiên của họ route, nằm ngoài `surface-and-nested-layouts`, được khai để bị băm và chứng minh
là không đụng tới, chứ không phải để được phép ghi.

Không có `WRITE_REJECTED` nào và bảng `## Rejections` trống. Mọi class trong kế hoạch đều có trong
inventory mà request đã ràng, và validator đọc lại inventory ấy ngay cạnh biên nhận. Checkout nguyên
vẹn tại `14e0c20f…`, không worktree phiên nào tồn tại, không nhánh nào được cắt — mà vào lúc nhánh này
chạy thì đó cũng là kết cục hợp lệ duy nhất, vì route ràng ở bước 1 cấm hẳn nhánh worktree. Khai báo
từ đó đã chuyển sang `session-only`, nên một lần `apply` hôm nay sẽ được phép trong khi chính nó một
giờ trước thì không.

## Bước 5 — `frontend.surface.audit`

Nhánh `blocked` với stop `RUNTIME_UNAVAILABLE`, mã đã đăng ký trong `operators/errors.json` với
disposition `terminate` và domain `platform`. Profile ràng là `sol-reviewer`. Cả ba validator đều
xanh, vì một `blocked` hợp lệ vẫn là xanh và các output bắt buộc chỉ được cưỡng chế cho nhánh `done`.
Nhánh chỉ ghi `response.json` và không gì khác — không phải đi đường tắt, mà là hình dạng duy nhất có
sẵn, và đó chính là khiếm khuyết O3.

Việc thăm dò được làm trước khi khẳng định bất cứ điều gì. Registry
`.worktrees/sessions/central-runtime/owner.json` quảng cáo generation 6, trạng thái `ready`, frontend
tại `http://localhost:3000`, chứng thực lần cuối ngày 2026-09-01. Thực tế nói ngược lại:
`curl` tới `http://localhost:3000/en/dashboard` trả về mã `000`, `curl` tới `127.0.0.1:3001` cũng trả
`000`, và bảng listener chỉ còn cổng 8080 của dịch vụ định danh. Không gì phục vụ route frontend, nên
readiness ở bước 4 của operator không thể đạt cho bất kỳ mục matrix nào. Operator không bao giờ tự khởi
động một runtime, nên nhánh dừng lại và `routing.json` đẩy domain `platform` sang `platform.operate`.

Matrix rỗng, và nó không thể khác được, vì hai lý do độc lập chồng lên nhau. Lý do thứ nhất là lần
thăm dò trên. Lý do thứ hai mang tính cấu trúc: `mode = dry` không sinh commit nào, trong khi bước 1
của chính audit đòi commit trong biên nhận apply phải bằng head đã ghim và bản preview phải phục vụ
worktree phiên *tại đúng commit đó*. Với `commits: []` thì không có commit ấy và cũng không có worktree
ấy — mà lại không có mã stop nào cho tình huống "biên nhận apply không mang commit", nên runtime dù sao
cũng sẽ đi tới bước readiness rồi dừng ở đó. Không gì được chụp, không gì được đo, và không phán quyết
nào được ghi cho một node chưa từng được đo.

## Khiếm khuyết lượt chạy này phơi ra

### Khoảng trống kiến thức

`COVERAGE-1` Case 3 buộc mọi vùng phải gọi tên một idiom trong `playbook.md`, nhưng mọi idiom trong
`idioms.md` đều ở tầng card, nên `dashboard-shell`, `identity-rail` và `panel-track` đành trích dòng
shape của playbook thay cho một idiom không tồn tại (K1). `overflow.md` cho `Rail` làm chủ phần cuộn
của thân rail, trong khi bảng sở hữu sinh tự động lại ràng `Rail` vào `height!="fill"` cho OVERFLOW-3
và vào `height="fill"` cho MEASURE-6, nên một rail không thể vừa lấp đầy chiều cao vừa giữ chủ sở hữu
cuộn, và hướng đi phải chọn `height="content"` (K2). Cũng bảng ấy liệt kê `Rail | body, inset="content"`
hai lần, một lần PADDING-3 và một lần PADDING-5, nên biên nhận không thể nói nó claim cái nào (K3).
`measure.md` bắt buộc `min-w-0` trên mọi vùng có thể nhận nội dung dài nhưng không luật đánh số nào sở
hữu nó, nên nó là một class không rule id, không claim được dưới `data-contract` và audit không đo
được (K4). `layout.md` LAYOUT-2 Case 4 cho một vùng phân giải về "một khoảng trống đã ghi" rồi đi tiếp,
còn LAYOUT-1 Case 6 biến đúng tình huống đó thành `GRAMMAR_REQUIRED`, vốn terminate trong bảng Stops —
lượt chạy này gặp đúng tình huống ấy và phải lập luận thoát ra bằng cách bỏ dải song song thay vì đòi
một component (K5). Cuối cùng, page inset nằm ngoài thang padding nên phần sở hữu inset của
`PageContainer` không viết được vào bản đồ chủ sở hữu, nơi cột `Rule` đòi một `PREFIX-n` (K6).

### Khiếm khuyết operator và hợp đồng

Enum `worktreeBranches` trong `route.schema.json` là `["forbidden","allowed"]` trong khi schema route
portable publish `["forbidden","session-only"]`, nên giá trị mà khai báo đang mang không có cách nào
biểu diễn trong một biên nhận route, còn `allowed` là giá trị không khai báo nào sinh ra được (O1).
Kind `workspace-route-binding` không có mục `## Fallbacks taken` dù `validate-response` vẫn đối chiếu
`response.fallbacks` với đúng tiêu đề ấy (O2). Hợp đồng của audit đòi ít nhất một dòng trong `## Matrix`
và trong `## Verdicts by owner`, nên một nhánh dừng trước khi chụp — kết cục đương nhiên khi không có
preview — không thể phát biên nhận mà không bịa ra một mục matrix và một phán quyết (O3). Cột Owner của
biên nhận resolution chỉ có `app|grammar` trong khi kiến thức publish ba chủ sở hữu, nên một node chủ
`—` phải ghi là `app` kèm một dòng `## Gaps`, và biên nhận không thể nói "không ai sở hữu" (O4). Ô
`Class` trong `## Rules chosen` được so bằng `inventory.classNames.includes`, mà mục classNames không
được chứa dấu cách, nên các render nhiều token đã publish như `px-4 py-3` là không viết nổi trong một
dòng (O5). Dưới `mode = dry` mọi đường dẫn bị chạm đều báo `after: null`, đúng hình dạng của một file
`deleted`, chỉ có cột `change` phân biệt (O6). Bảng `## Next` của `workspace.bind` không diễn đạt nổi
chính bước chuyển đầu tiên của workflow này, và `scripts/validate-workflows.mjs` chưa từng đọc một bảng
Next nào nên sai lệch ấy không ai kiểm (O7); bảng `## Next` của audit cũng vậy với `platform.operate`
(O8). Alias `@worktrees/uat` khai một bố cục mà đĩa không có (O9). `declaredWriteRoots` mặc định rỗng
trong khi `route.schema.json` đòi `writeRoots` có ít nhất một phần tử, nên một ràng buộc chỉ để đọc là
không biểu diễn được (O10). `mutationReadiness` không có cách suy ra được nêu ra, nên lượt chạy này
chọn `ready` còn lượt `frontend-refine` cùng thư mục chọn `read-only` trên cùng một route (O11). Và
danh sách phản chứng không tách rò rỉ tầng composition khỏi rò rỉ tầng class, nên đọc thật chặt thì bất
kỳ rò rỉ class thừa kế nào cũng giết mọi hướng đi trên bề mặt đó bằng `NO_VIABLE_DIRECTION` (O12).

### Khoảng trống orchestrator

Thẩm quyền route có thể đổi ngay dưới chân một phiên đang sống mà không ai nhận ra: giữa lượt chạy, một
phiên khác viết lại cả hai nửa route từ `forbidden` sang `session-only`, trong khi `SOURCE_DRIFT` chỉ
phủ head của checkout, nên biên nhận bước 1 giờ mô tả một chính sách không còn tồn tại và không mã
dừng nào, không validator nào nói ra điều đó (G1). Workflow tự bảo đảm audit của chính nó sẽ chết:
preset chỉ đặt `role: fe` nên `runtimeNeed` rơi về `none` và không endpoint nào được ràng, trong khi
bước 5 là một audit mà toàn bộ công việc cần một route đang được phục vụ (G2). Không ai sở hữu các
write root: bước 4 ghi source nhưng workflow không preset `declaredWriteRoots` và không luật nào nói
chúng đến từ đâu, nên orchestrator phải tự bịa ra ba cái — đúng loại thẩm quyền mà `workspace.bind` từ
chối nhận từ một gợi ý (G3). Không đâu nói người gọi có được ghi đè một preset hay không, dù lượt chạy
này được lệnh dùng `dry` thay cho `apply` (G4). `fanout: "matrix"` không có tập nào để tãi ra, vì
`ui-coverage.schema.json` không mang một matrix viewport × scheme × state nào (G5). Và `state.json`
được bắt buộc bằng văn xuôi nhưng không schema nào phủ, không script nào đọc ngoài phép so hash request
bên trong `validate-request.mjs` (G6).

## Còn lại gì trên đĩa

Thư mục `.worktrees/sessions/20260903-dryrun-frontend-reconstruct/` được giữ nguyên: `state.json` cùng
năm nhánh `step-N/parallel-1/`, mỗi nhánh có `request/request.json` và `response/` của nó. Checkout
frontend không bị đụng tới và vẫn sạch tại `14e0c20f4746ae08f00a84a4eac18aa78ded987b`, và không file
nào dưới `.claude/` bị sửa ngoài chính báo cáo này và bản tiếng Anh của nó.
