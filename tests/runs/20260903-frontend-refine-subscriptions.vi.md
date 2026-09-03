# Lượt chạy — frontend-refine trên bề mặt Pro subscription (2026-09-03)

Đây là phiên thật đầu tiên của StarCi Skills v8, chạy ở chế độ diễn tập: một orchestrator cùng một
agent cho mỗi operator, tất cả nằm trong một tiến trình. Thư mục phiên là
`.worktrees/sessions/20260903-dryrun-frontend-refine/` và được giữ nguyên trên đĩa để soi lại. Mỗi
nhánh dưới đây đều nêu profile mà `operator.json` của nó ràng, nhưng người thật sự chạy mọi nhánh
trong lượt test này là Claude Opus đứng thay cho profile đó — đây là điều đầu tiên cần giữ trong đầu
khi đọc bất kỳ phán quyết nào ở đây, vì không ranh giới profile nào được thực sự thử. Không
có commit nào, không có gì được ghi vào checkout frontend, và không lệnh ghi git nào được chạy ở bất
kỳ đâu.

## Tóm tắt yêu cầu

Workflow là `frontend-refine`. Target là route `/[lang]/subscriptions`, tức
`src/app/[lang]/subscriptions/page.tsx` — route duy nhất dựng `ProSubscriptionBlock` thông qua
`ProSubscriptionPage`. Head frontend được đóng băng là `14e0c20f4746ae08f00a84a4eac18aa78ded987b`,
đọc bằng `git rev-parse HEAD` ở chế độ chỉ đọc; head của cây knowledge là `efe38af2c0467b88444f9a7426e6bece1fac3eb2`
trên nhánh `v8` của `.claude`. Chuỗi được yêu cầu gồm năm bước: `workspace.bind` với role `fe`,
`frontend.direction.decide` với intent `audit-repair` và changeLevel `refine`,
`frontend.presentation.resolve`, `frontend.source.apply` ở chế độ `dry`, rồi `frontend.surface.audit`.
Trên thực tế chỉ ba bước đầu chạy: bước 3 chặn lại, và `routing.json` trả domain `knowledge` về
`user`, nên bước 4 và bước 5 không bao giờ được điều phối.

Mọi requirement đều lấy từ preset của workflow cộng với default mà từng operator tự khai; không hỏi
người dùng điều gì. Hai trường bắt buộc không có default phải tự suy ra và đều được nói rõ ngay tại
chỗ: `project` là `starci-academy`, vì đó là project duy nhất có khai báo portable trỏ tới checkout
này, còn `target` là route ở trên, tìm ra bằng cách grep tên block.

## Bước 1 — `workspace.bind`

`operator.json` của `workspace.bind` ràng profile `sonnet`, và trong lượt test này Claude Opus chạy
nhánh ấy. Nhánh kết thúc `done`, không stop. Hai validator đều xanh: `node scripts/validate-request.mjs` trả
`request valid`, và `node operators/workspace-bind/validate.mjs` trả `valid workspace.bind branch`.
Nửa response không kiểm được bằng CLI của `scripts/validate-response.mjs` vì một lỗi của chính script
đó, được ghi ở phần khiếm khuyết bên dưới; nó được kiểm gián tiếp qua validator của operator, vốn gọi
cùng một hàm `validateResponse` với đối số exchange đúng. Nhánh ghi ra `response/response.md` kiểu
`workspace-route-binding`, `response/data/route.json` kiểu `route`, và `response/response.json`.

Khai báo portable `.workspaces/projects/starci-academy/fe.json` và route đã hydrate
`.workspaces/local/routes/starci-academy/fe/config.json` thống nhất với nhau về project, role, kho Git
và nhánh. Checkout thuộc loại `sibling` trong thư mục `starci-academy-fe`, giải ra
`D:\Repositories\starci-academy-fe`, đang ở `main` tại `14e0c20f…`, cây làm việc sạch và đúng head mà
bản hydrate ghi. Gốc thẩm quyền nghiệp vụ là `null`, đúng như luật, vì một checkout sibling không mang
thẩm quyền nghiệp vụ nào. `runtimeNeed` lấy default `none` nên bước 5 của operator không chạy và ràng
buộc này không mang endpoint nào. Mutation readiness được báo là `read-only`, bởi chính sách của route
đặt `worktreeBranches: forbidden`, nghĩa là không thể cắt nhánh `session/<sessionId>` nào từ route
này. Ba finding được ghi: `ROUTE_HYDRATED_FROM_PORTABLE`, `WORKTREE_BRANCH_FORBIDDEN` và
`IDENTITY_ROSTER_SEALED`.

## Bước 2 — `frontend.direction.decide`

`operator.json` của `frontend.direction.decide` ràng profile `sol-fresh` cùng `webSearch: bounded`,
`browser` và, sau thay đổi giữa chừng, `imageGeneration`; Claude Opus chạy nhánh này và không thực
hiện tìm kiếm web nào, vì một `refine` chỉ làm việc từ idiom của họ. Nhánh kết thúc `done`, không stop
và không fallback nào được lấy. `validate-request.mjs` trả
`request valid`; `operators/frontend-direction-decide/validate.mjs` trả
`valid frontend.direction.decide branch`. Nhánh ghi `response/response.md` kiểu
`frontend-direction-decision`, `response/data/coverage.json` kiểu `ui-coverage`, và
`response/response.json`. Không có trang candidate và không có ảnh nào: một candidate dưới
`preview: no` thì không dựng trang, còn không vùng nào của bề mặt này đọc lên như đang trống.

Hợp đồng UI khép lại ở năm vùng — `orientation`, `explanation`, `disclosures`, `decision-rail`,
`recovery` — bốn hành động, bảy nghĩa trạng thái với bảy carrier khác nhau, và hai nhánh responsive.
Direction mang id `pro-subscription-refine`, phân loại `locked-refine`, candidate được chọn là
`resting-status-truth`, và mười hai đòn phản chứng đều `holds`.

Những gì nhánh thật sự tìm thấy trong source đều có file đứng sau và được ghi trong `## Observed` tại
head đã đóng băng. Một dải accent duy nhất đang gánh ba sự thật vòng đời khác nhau: `proStatusClassName`
là `rounded-medium bg-accent-soft p-3`, và cả `verification-pending`, `active` lẫn `cancelled` đều
dựng vào đó, tức một carrier chọi ba sự thật có tên, đi ngược `STATE-1` Case 3, còn accent thì đang
thay mặt cho một kết cục, đi ngược `ACCENT-5` Case 1 và cả idiom của chính họ, vốn nói rằng một lời
hứa chưa được xác nhận thì giữ trung tính. Phần thông báo cũng tự dựng bằng tay: một `div` của app
mang `role="status" aria-live="polite"` bọc hai node `Text`, trong khi `Text` đã publish sẵn prop
`live`. Chuỗi `renewalNote` hiện hai lần ở trạng thái `cancelled`. Cây pending mới nghỉ có một nửa —
`isSkeleton` chỉ tới được `Heading` của gói, còn giá, kỳ hạn, phần copy lợi ích và breadcrumb vẫn giữ
hình học đã resolve, và một dấu gạch ngang được viết thẳng vào ô giá trong lúc phép đo còn chưa biết.
Trạng thái lỗi là một notice dựng tay thay vì `EmptyNotice`, chủ sở hữu đã publish cho nó. Cuối cùng,
phần reflow của rail có tới hai chủ: `proWorkspaceClassName` biến grid của Grammar thành flex column ở
breakpoint viewport `max-[895px]` rồi hoán vị rail bằng `order-first` và `min-[896px]:order-last`,
trong khi `@container starci-core-primary-rail (max-width: 56rem)` đã sở hữu đúng cú stack ấy.

Candidate thực hiện sáu nước đi ở cấp phần tử bên trong cấu trúc đã duyệt: dải trạng thái trở lại
trung tính với một `Badge` cho mỗi kết cục; một chủ thông báo duy nhất qua `Text live="polite"`;
`renewalNote` chỉ nói một lần; cây pending nghỉ trọn vẹn và không còn giá trị gạch ngang; `EmptyNotice`
cho vùng phục hồi; và phần reflow trả về đúng một chủ đã publish. Nước cuối cùng là nước duy nhất đánh
đổi một tiện lợi thật ở màn hẹp — thẻ quyết định nằm trên phần giải thích — lấy sự tuân thủ một-chủ,
bởi `PrimaryRailLayout` không publish prop vị trí hay thứ tự rail nào để diễn đạt sở thích đó.

## Bước 3 — `frontend.presentation.resolve`

`operator.json` của `frontend.presentation.resolve` ràng profile `sonnet`, và Claude Opus chạy nhánh
này. Nhánh kết thúc `blocked` với stop `RULE_MISSING`. Mã này thuộc domain `knowledge`, và `routing.json`
trả lời domain `knowledge` bằng `{"kind": "user"}`, nên chuỗi dừng lại và một con người sở hữu nước
tiếp theo. `validate-request.mjs` trả `request valid`, còn
`operators/frontend-presentation-resolve/validate.mjs` trả `valid frontend.presentation.resolve branch`
— một response `blocked` vẫn xanh khi stop của nó hợp lệ, và ở đây thì hợp lệ, vì `RULE_MISSING` nằm
trong bảng Stops của operator và disposition hiệu dụng dưới các requirement này là `terminate`. Nhánh
chỉ ghi `response/response.md` và `response/response.json`; không có `inventory.json` và không có cây
đã resolve, vì đó là bước 8 và 9 của operator và chúng không bao giờ chạy.

Bản đồ chủ sở hữu có 45 dòng. Grammar sở hữu khoảng cách vùng của `PrimaryRailLayout`, khoảng cách và
inset nội dung của thẻ joined, inset của trigger accordion, khoảng cách của `SurfaceCopyGroup`, hạng
chữ của con số giá một khi nó chuyển sang `Text size="metric-lead"`, cùng inset và khoảng cách của
`EmptyNotice`. Phần còn lại thuộc ứng dụng. Bảng luật đã chọn có 36 dòng, và ngữ pháp dải băng của bề
mặt này khớp gần như từng chữ với các case đã publish, đơn giản vì chính các case ấy được viết ra từ
nó: `PADDING-4` Case 7 cho cạnh inline của mọi dải, Case 6 cho dải chạm mép ngoài, `PADDING-3` Case 3
cho dải nằm giữa hai đường phân, `PADDING-7` cho bước nhảy ở `sm`, `BOUNDARY-1` Case 2 và Case 3,
`BOUNDARY-2` Case 3 cho lưới lợi ích hai cột, `SURFACE-3` Case 1 và Case 2, `GAP-1` Case 1 và Case 2,
`GAP-5` Case 1.

Mười ba class bị gỡ. Sáu trong số đó là các override của `proWorkspaceClassName` thò tay vào
`.starci-core-primary-rail-layout` và hai thuộc tính `data-grammar-*`, với lý do `overrides Grammar
anatomy`. `gap-5` trên khối chi tiết gói là `off the closed scale` — 1.25 rem không hề nằm trên
`COMMON_SPACING_SCALE` — và giải về `GAP-4` Case 1. Cụm `text-4xl font-semibold tracking-tight
text-foreground` trên một `span` của app là `reimplements an owned relationship`, vì `font.md` nói
thẳng rằng file đó không có chủ `App` nào và một class typography của ứng dụng là `APP_OVERRIDE`.
`text-left` chỉ lặp lại mặc định mà `FLOW-1` Case 1 bảo là không cần class. `rounded-medium` là
`off the closed scale` vì không topic trình bày nào publish bán kính bo.

Bốn khoảng trống được ghi lại như những cách lách được thừa nhận chứ không thành stop, đúng theo luật
của chính operator rằng một public path còn thiếu là gap chứ không phải chỗ dừng: `PageContainer`
không publish prop nhịp vùng nào nên nhịp trang chỉ có thể viết bằng margin của con; `PrimaryRailLayout`
chỉ publish `railWidth` và `align` nên override vừa gỡ không có thứ thay thế đã publish; `Button` không
publish prop full-width hay wrapping; và `IncludedMark` không publish tone, size hay canh lề, trong khi
cú nhích `mt-0.5` của nó tự nó cũng nằm ngoài thang đóng.

Hai chỗ `RULE_MISSING` chính là thứ chặn nhánh lại. Thứ nhất là inset khối của `main`: `py-6 sm:py-8`
là một inset dọc cấp route bước từ 1.5 rem lên 2 rem, trong khi `PADDING-5` và `PADDING-6` chỉ publish
inset bốn cạnh bằng nhau, còn `PADDING-7` được ghép tường minh từ inset inline 1 rem → 1.5 rem cộng
các cạnh khối chạm mép ngoài ở cùng giá trị, và `PageContainer` chỉ sở hữu inset inline của trang.
Thứ hai là màu tiền cảnh của `IncludedMark` trong mỗi dòng lợi ích: `SURFACE-4` Case 2 publish đúng
hình dạng ấy nhưng chỉ cho một dấu dẫn nằm *bên trong một vùng được nâng*, còn dấu này nằm trên mặt
thẻ không nâng, nên điều kiện của case không thỏa. Chọn `SURFACE-4` bất chấp điều đó chính là kiểu bịa
mà operator sinh ra để từ chối.

## Bước 4 và bước 5 — không chạy

`frontend.source.apply` ràng profile `opus` còn `frontend.surface.audit` ràng `sol-reviewer`; không
nhánh nào chạy nên không profile nào được thử, và nếu có chạy thì Claude Opus cũng đứng thay cả hai
như đã đứng thay ở mọi nhánh trên.
`frontend.source.apply` khai `frontend-presentation-resolution` là input bắt buộc, và
`frontend.surface.audit` khai cả ba input của nó là bắt buộc. Bước 3 không sinh ra bản resolution nào
ở trạng thái `done`, nên không request nào soạn được một cách trung thực và không nhánh nào được điều
phối. Vì vậy không có kế hoạch ghi, không có `WRITE_REJECTED`, và không có ma trận audit để báo cáo.

Dù vậy orchestrator vẫn chạy phép thăm dò khả năng truy cập mà người gọi yêu cầu, vì nó quyết định
liệu bước 5 có bao giờ thành công được không. `curl` tới `http://localhost:3000/en/subscriptions` và
`http://localhost:3001/` đều trả mã `000`, tức không kết nối được. Trong khi đó
`.worktrees/sessions/central-runtime/owner.json` khai generation 6, `status: ready`, frontend ở
`http://localhost:3000`, chứng thực lần cuối lúc `2026-09-01T19:54:08Z` với head
`5fe51662dbf214c7c24ca014e8e5d0197d0441eb`. Nghĩa là registry đã cũ: nếu bước 5 được tới, nó sẽ chặn
với `RUNTIME_UNAVAILABLE`, và bước 1 sẽ chặn với `RUNTIME_NOT_READY` nếu được yêu cầu tiêu thụ runtime.
Ba chi tiết nữa của registry đó đáng ghi lại: head nó chứng thực không phải head phiên này đóng băng,
endpoint `identity` của nó là `http://localhost:8080` trong khi quy ước Keycloak của dự án là `8089`,
và bản chứng thực frontend gần nhất gọi tên route `/vi/subcribtions`, một lỗi chính tả, mà vẫn ghi
`GET => 200`.

## Những khiếm khuyết lượt chạy này phơi ra

### Khoảng trống kiến thức

Không có case nào cho inset khối cấp route, và đó là chỗ dừng thứ nhất; mọi trang được route trong app
viết `py-*` lên `main` của nó đều sẽ vấp phải. Không có case nào cho màu tiền cảnh của một dấu dẫn nằm
trên dải không được nâng, và đó là chỗ dừng thứ hai. `BOUNDARY-3` và `BOUNDARY-4` được viện dẫn nhưng
không được publish: `INDEX.md` quảng cáo "BOUNDARY-1 to BOUNDARY-6" trong khi `boundary.md` chỉ publish
1, 2, 5, 6, cả `BOUNDARY-1` lẫn `BOUNDARY-2` đều kết bằng "Use BOUNDARY-3" trỏ vào hư không, và gói
sống thì phát `data-contract="BOUNDARY-3"` trên các dòng accordion — nghĩa là một node viện dẫn nó một
cách chính đáng sẽ bị `UNKNOWN_RULE`. Không topic nào sở hữu bán kính bo, nên `rounded-medium` trên một
node của app đúng là định nghĩa của `KNOWLEDGE_UNBOUND` mà danh mục mười topic lại không có chỗ chứa.
`COVERAGE-1` Case 3 gọi tên một trường `regionModel` mà `ui-coverage.schema.json` hoàn toàn không có,
và cũng chính case ấy đòi mỗi vùng phải gọi tên một idiom trong `playbook.md`, trong khi dòng
purchase-decision của playbook không nêu idiom nào cho vùng orientation của route, còn `idioms.md` chỉ
ghi hình dạng đó ở bảng "Seen once" mà một direction "không được compose từ" — một refine giữ nguyên
cấu trúc đã duyệt do đó không thể thỏa luật mà không viện dẫn chính thứ cùng cây kiến thức ấy cấm.
`ACCENT-1` Case 5 đòi số accent trội phải như nhau ở mọi trạng thái, trong khi ở `active` và
`verification-pending` bề mặt này chính đáng không còn hành động nào, nên luật như đang viết bị hành vi
đúng làm sai. Cuối cùng, bảng gap của họ trong `family.md` publish mười bảy gap mà không có gap
`PrimaryRailLayout` thiếu prop vị trí rail, dù chính block được idioms viện dẫn nhiều nhất đã phải lách
nó từ lúc được viết ra.

### Khiếm khuyết operator và hợp đồng

`scripts/validate-response.mjs` không tự kiểm được một nhánh từ CLI của chính nó: phép phát hiện
exchange đi thừa một `dirname`, nên với thư mục `…/step-N/parallel-M` nó kết luận nhánh là một exchange
lồng tên `parallel-M` và sinh ra bốn lỗi giả ở cả ba nhánh của lượt chạy này. `validate-step.mjs` và mọi
validator của operator đều truyền `exchange: null` tường minh nên không bị ảnh hưởng, và không có gì
trong `.claude` bị sửa để lách. `route.schema.json` buộc `writeRoots` có ít nhất một phần tử trong khi
`declaredWriteRoots` mặc định rỗng và không khai báo route nào mang write root, nên ràng buộc phải tự
suy ra `src` và nói rõ điều đó. Workflow `frontend-refine` không bao giờ bind runtime mà chính bước
cuối của nó cần, vì preset bước 1 chỉ có `role`. Chính sách Git của route và mục `sourceWrites` của
`orchestrator.json` chọi nhau: route đặt `worktreeBranches: forbidden` còn orchestrator đòi ghi trên
`session/<sessionId>` trong một worktree, nên dưới route này một `frontend.source.apply` tuân thủ không
có chỗ nào hợp lệ để ghi. Bảng `## Owner map` không diễn đạt được một chủ đã xác định mà luật chưa
chọn, nên hai node bị chặn phải mô tả bằng văn xuôi. Bảng `## Removed` có enum lý do ba giá trị không
phủ được một lần gỡ vì quyết định composition thay đổi. Bảng `## Rules chosen` không chứa nổi một class
nhiều token, và một luật mà `Render` đã publish là "No class" thì không thể được chọn. Câu "no published
case matches" mơ hồ giữa hai cách đọc lệch nhau nguyên một chuỗi, và lượt này chọn cách đọc rộng hơn
rồi nói rõ ra. `DIRECTION_CHOICE_REQUIRED` không diễn đạt được một câu hỏi con còn mở khi chỉ có một
candidate. Và giữa lúc nhánh 2 đang chạy, một phiên khác sửa `.claude` ngay dưới chân: thêm mục
`## Images` vào hợp đồng, thêm chính sách `imageGeneration: judged`, thêm output `direction-image` và
một phán quyết chủ sở hữu vào `playbook.md`, tất cả đều chưa commit, nên head `.claude` mà lượt này
đóng băng không mô tả đúng những file nhánh thật sự đọc; response được viết lại theo hợp đồng mới, và
không có gì trong runtime phát hiện thay đổi ấy.

### Khoảng trống của orchestrator

Không có gì ngăn output của một nhánh đã chặn được đẩy tiếp: `validate-request.mjs` chỉ kiểm tra đường
dẫn input có tồn tại trong phiên chứ không đọc `response.json` của nhánh sinh ra nó, nên trỏ bước 4 vào
`step-3/parallel-1/response/response.md` sẽ qua gate sạch sẽ dù nhánh ấy blocked; chỉ có kỷ luật định
tuyến chặn lại. Không file nào nói phiên được đánh dấu là đã dừng ra sao, nên lượt này tự thêm một
object `stoppedAt`. Cách suy ra fingerprint hoàn toàn không được quy định, nên lượt này dùng SHA-256
của file route đã hydrate và của `device-state.json`, rồi ghi lại lựa chọn đó. Quy ước id phiên trong
`orchestrator.json` và tên thư mục người gọi đặt không khớp nhau mà chẳng có gì kiểm. Trường `head`
trong `contexts` không mang nghĩa gì với một alias không phải kho Git, và không file nào nói alias nào
thì thuộc về `contexts`. Sau cùng, không ai sở hữu việc thăm dò runtime trước một chuỗi cần nó:
`workspace.bind` không thăm dò trừ khi `runtimeNeed` là `consume`, `frontend.surface.audit` thì "không
bao giờ tự khởi động", và không operator nào chịu trách nhiệm nhận ra rằng một registry đang tự nhận
`ready` đã chết hai ngày.

## Ai sở hữu nước tiếp theo

`RULE_MISSING` định tuyến về `user`. Chủ knowledge publish một case padding cho inset khối cấp route và
một case surface cho màu tiền cảnh của dấu dẫn trên dải không được nâng, rồi chính cây ấy được resolve
lại như một bước mới với `request.json.resume` gọi tên `3/1`. Cho tới lúc đó, direction ở bước 2 đứng
làm bản ghi về những gì bề mặt này cần, và chưa dòng source nào bị viết.
