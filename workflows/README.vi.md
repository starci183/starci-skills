# Workflow

Không còn file chuỗi workflow cố định. Một chuỗi không bao giờ được chọn từ ví dụ: nó được suy ra từ nhiệm
vụ, bởi `scripts/plan-chain.mjs`, từ impact bàn giao đã khám phá cùng các bảng của operator, và được `scripts/validate-chain.mjs`
kiểm mỗi lần vẽ. Các chuỗi mẫu thư mục này từng giữ giờ là fixture của planner, nằm ở
`scripts/fixtures/chains/`, và `scripts/plan-chain.spec.mjs` chứng minh planner vẫn suy ra được từng chuỗi ấy
từ kết quả mà nhiệm vụ của nó gọi tên.

Topology người dùng được chọn phía trên chain này bởi
`resources/orchestrator.json#workflowTopologies`; thư mục này không định nghĩa topology hay ngữ nghĩa
peer thứ hai.

## Vòng đời workflow thực thi được

Prompt đầu mở hoặc dùng lại draft đã bind với host bằng `scripts/session-open.mjs` trước khi xác nhận
scope. Xác nhận kích hoạt đúng một phiên bản. Planner vẫn là owner duy nhất của chain: nó suy ra các
bước từ goal đã xác nhận, và replan trong scope chỉ đổi chain, không viết lại goal hay hỏi theo từng
operator.

Mỗi invocation đã plan trở thành một attempt có version. Request đóng băng `expected.criteria`,
`environment`, quyền sở hữu tài nguyên và `frozenInputs` phía request trước
`scripts/attempt-gate.mjs open`. `scripts/worker-slots.mjs` cấp tối đa ba slot active dùng chung cho
nhánh chính, exchange lồng nhau, helper, repair và retry. Attempt có ghi dữ liệu phải lease owner cụ
thể; source-writing tự lease worktree thật sau khi chuẩn hóa junction, symlink và chữ hoa/thường trên
Windows. Thiếu input, tài nguyên exclusive chồng nhau
và worker sẵn sàng thứ tư phải chờ; trạng thái waiting trả slot. `attempt-gate accept` chạy đủ gate
chung và gate operator, phân giải bằng chứng actual rồi đối chiếu từng tiêu chí. Chỉ receipt match mới
được advance; sau đó attempt đóng băng inventory chính xác của mọi file request/response trong
`evidenceManifest`. Mismatch được giữ lại và dẫn tới repair, retry hoặc blocked; retry trỏ về attempt trước
và không được hạ expected bắt buộc trong cùng goal version.

Khi cấp slot, operator ghi profile thực tế bằng `acquire <branch> <workerId> <ranProfile>`; request
input nội bộ phải trỏ đúng kind do attempt đã match xuất ra và vẫn khớp evidence manifest đã niêm
phong. Import từ session khác tiếp tục được kiểm bằng import manifest. Helper thuộc mission ghi
request theo `templates/step/helper-request.schema.json` trong thư mục run, rồi dùng
`acquire-helper <session> <helper-request.json> <workerId>` để kiểm host binding và lease các đường
ghi cụ thể trong `.worktrees`. Helper dùng cùng hạn mức ba worker và cùng lệnh release.

## Chuỗi được suy ra thế nào

Planner xuất phát từ nhiệm vụ đã xác nhận (`state.json.mission`): mỗi dòng "xong khi" gọi tên
operator mà biên nhận của nó là bằng chứng ấy, và các operator đó là đích. Nó đi ngược qua các bảng
mà mỗi operator công bố trong `operator.md` của mình:

- một **Đầu vào** bắt buộc kéo vào operator sinh ra kind đó — ưu tiên producer đã có trong chuỗi,
  rồi đến operator duy nhất có `primaryOutput` là kind ấy (hai primary thì phân xử bằng operator mà
  dòng Đầu vào gọi tên), rồi đến producer duy nhất; kind nào các bảng để mập mờ thì bị từ chối kèm
  tên các ứng viên, không bao giờ đoán; và khi chuỗi đã có nhiều nhánh của cùng một operator, chính
  thứ tự các dòng "xong khi" của nhiệm vụ phân xử consumer đọc nhánh nào — những nhánh có dòng đứng
  trước dòng của nó, không bao giờ một nhánh đứng sau, vì nhánh sau của cùng một operator là một
  route khác, một finding khác hay một head sau này;
- một Đầu vào bắt buộc mà kind của nó đã nằm sẵn trong một **slot nhập** của phiên
  (`scripts/producer-import.mjs`: một tọa độ chỉ-là-bằng-chứng giữ `import.json` bên cạnh bundle
  producer đã chép) thì coi như đã được sinh khi không nhánh nào của chuỗi sinh ra nó: không thêm
  producer nào, nhánh tiêu thụ bind output của slot làm `inputs.<kind>`, và bản xem trước in
  `<kind> imported from <sourceSession> step N`; slot không có `import.json` là input cục bộ, slot
  mà operator gốc cây này không gọi tên được thì không khai gì, và ở gate kind chỉ được ghi nhận khi
  `validate-request#validateImportedInput` chấp nhận tham chiếu — plan chỉ biết kind ấy tồn tại,
  còn gate nhập vẫn là thẩm quyền về byte;
- một dòng **Context** `@workspaces/<role>` bắt buộc kéo vào một `workspace.bind` của role đó, và
  role mà nhiệm vụ khai được bind trước mọi nhánh làm việc dù không bảng nào đòi;
- operator mà hơn một dòng "xong khi" gọi tên, khi domain của nó có operator `<domain>.plan`, thì
  chạy sau plan ấy và **toả theo đơn vị**: mỗi nhánh một đơn vị, nhánh gọi tên `unit` của mình
  (ngưỡng và tính hợp lệ của unit thuộc `validate-request`, `#unitGateErrors`); một dòng thì không
  cần bản đồ;
- operator nào giữ tool có hiệu ứng (đúng vị từ mà gate nhiệm vụ đọc từ `operator.json`) thì chuỗi
  mở bằng `environment.preflight`;
- nhiệm vụ gọi tên `git.publish` trong khi có nhánh ghi source frontend dưới `mode: apply` thì nợ
  audit và lượt đi thử ở giữa — luật dòng dài, phát biểu theo kind: operator có primary output là
  `frontend-surface-audit`, rồi `uat.verify`, trước khi publish;
- route `chain` thêm owner đích và prerequisite vào plan của chính host session. Attempt blocked chờ
  mà không giữ slot, rồi vào lại từ output đã accept. Nó không mở user session anh em hay tạo thêm
  hạn mức concurrency.

Hai chỗ mà đầu vào bắt buộc để ngỏ cũng do các bảng phân xử: một Đầu vào tuỳ chọn xếp consumer sau
producer đã có trong chuỗi, và một dòng Kế tiếp một chiều xếp operator bàn giao trước operator được
bàn giao — mỗi thứ trừ khi nó khép thành vòng, khi ấy cạnh cứng thắng và cạnh bị bỏ được ghi lại
trong plan. Rồi các nút được xếp thành bậc: một nhánh chỉ chạy khi mọi thứ nó phụ thuộc đã chạy ở
bậc trước và bảng Kế tiếp của bậc trước gọi tên nó; tối đa ba nhánh một bậc
(`resources/orchestrator.json#maxConcurrentAgents`, hoặc `#concurrency.maxParallel` khi được khai);
không bao giờ hai nhánh cùng ghi một alias trong một bậc; nhánh toả đứng riêng một bậc để các đơn
vị của nó mở rộng tại chỗ; và một lần publish hay deploy chỉ được xếp khi mọi nhánh còn lại đều là
ranh giới, nên một nhiệm vụ publish hai route kết thúc bằng cả hai, cái này sau cái kia. Mỗi nhánh
có một goal — dòng "xong khi" nó chứng minh, hoặc nhánh sau
sớm nhất mà nó mở đường — chính là thứ `request.json.goal` mang và `validate-request` kiểm.

Plan cố định requirements của một nhánh trước khi request của nó tồn tại — `role` của bind, `roles`
của preflight, một `mode` đặt sẵn — và orchestrator ghi chúng thành
`state.json.planned["N/M"].requirements` lúc chuỗi được vẽ hay vẽ lại, trước lần dispatch đầu tiên.
Gate đọc role của bind từ request khi request đã được ghi, còn không thì từ plan, nên một chuỗi vẽ
trước bước 1 vẫn hợp lệ; request sau này dispatch một nhánh đã lên plan phải mang nguyên các giá trị
đã lên plan, nếu không `validate-request#plannedRequirementErrors` từ chối, vì chuỗi đã được kiểm
trên chính các giá trị ấy và một request đổi đi một giá trị là chạy một nhánh mà chuỗi chưa từng được
kiểm cho.

Plan được in cho người dưới dạng hai dòng mỗi nhánh (goal, rồi lý do nhánh có mặt) trước khi bất kỳ
thứ gì được dispatch, và `node scripts/plan-chain.mjs <session>` in cùng bản xem trước ấy kèm khối
JSON cho một phiên trên đĩa.

## Gate ép những gì

`validate-chain` đọc `state.json.chain`, `state.json.steps`, `state.json.planned` và `request.json`
của từng nhánh, và từ chối chuỗi trong đó:

- một nhánh gọi tên operator cây không có, hay một ô nằm ở bậc không đúng số của nó, hay plan cố
  định requirements cho một ô mà chuỗi không gọi tên;
- một bậc có operator mà không bảng Kế tiếp nào của bậc trước cho phép và cũng không phải vào lại
  chính operator đó;
- một nhánh cần Đầu vào không bậc trước nào sinh và cũng không slot nhập đã được chấp nhận nào mà
  request của nó gọi tên cung cấp, hay context `@workspaces/<role>` không `workspace.bind` nào của
  role đó bind trước hoặc được lên plan để bind (cả hai như đã suy ở trên);
- request đã ghi của một nhánh khác với requirements mà plan đã cố định cho nó;
- một bậc vượt trần song song, hay hai nhánh cùng bậc ghi cùng alias;
- một nhánh ghi source frontend dưới `mode: apply` rồi `git.publish` theo sau mà audit hay
  `uat.verify` thiếu hoặc nằm ngoài khoảng giữa lần ghi và lần publish;
- `git.publish` hay `release.deploy` chạy rồi còn thứ gì khác ngoài publish hay deploy chạy sau —
  chuỗi kết thúc ở `git.publish`, `release.deploy` hoặc một con người;
- trên nhiệm vụ, một nhánh không có goal, trích dòng "xong khi" mà operator của nó không sinh, hay
  prerequisite không phải một nhánh sau của chuỗi;
- chuỗi có `<domain>.plan` mà một nhánh thực thi đơn vị của nó lại chạy cùng bậc hay bậc trước;
  nhánh gọi tên unit nào, và plan có liệt kê nó không, là việc của `validate-request#unitGateErrors`.

`validate-session` chạy nó trên cả sổ sau mỗi chuyển bước.

## Vẽ lại

Chuỗi được vẽ một lần trước dispatch đầu tiên, và vẽ lại ở mỗi lần dừng làm đổi thứ nhiệm vụ cần:
nhánh `blocked` mà route vào lại hay thêm operator, một plan đã biết đơn vị, một goal được sửa. Mỗi
lần vẽ lại là một chuyển bước `replanned` trong `state.json.transitions` mang ghi chú và phiên bản
goal nó chạy dưới: phiên bản hiện tại khi chỉ chuỗi đổi (một cổng đỏ đưa về chủ sở hữu, một plan đã ra
đơn vị, một lần dừng thêm operator), và phiên bản kế — được xác nhận qua `goal-confirm` như plan đầu —
khi chính goal được sửa; không bao giờ viết lại trong im lặng
(`scripts/validate-session.mjs#missionHistoryErrors`).

## Các fixture

`scripts/fixtures/chains/<id>.json` giữ các chuỗi mẫu của 2.0.0 viết lại theo id operator hiện tại, mỗi
chuỗi kèm nhiệm vụ mà các dòng "xong khi" gọi tên kết quả của nó, thứ tự operator nó chờ đợi, và
ghi chú về cách viết lại. Chúng là đầu vào cho spec của planner, không phải cho runtime: cửa vào
không bao giờ đọc chúng.

Hợp đồng khám phá mục tiêu, phạm vi bàn giao và owner của workflow: [discovery.md](discovery.md).

## Các bản dự báo bất biến

Planner sở hữu một lịch sử dự báo. Xác nhận lưu nguyên mục tiêu và đáp án tại
`runtime/history/missions/`; mở attempt lưu mục tiêu, lựa chọn và context dự báo tại
`runtime/history/invocations/`. State giữ địa chỉ nội dung. Chấp nhận dùng context đã đóng băng
của invocation; mục tiêu hay đáp án về sau không diễn giải lại proof. Hoàn thành hiện tại chỉ tính
evidence của phiên bản hiện tại, không lấy dòng done-when cũ chỉ vì cùng số.

Chạy `node scripts/plan-history.mjs preview <session> [flags.json]` để suy và hiển thị toàn bộ
dự báo mục tiêu, các phụ thuộc và lane bàn giao. Nó ghi rõ planned, chưa thực thi hay kiểm chứng.
Sau đó chuyển `previewHash`, `flags` giữ nguyên và `reason` cụ thể vào
`node scripts/plan-history.mjs commit <session> <reviewed-plan.json>`. Scope, attempt hay plan đổi
làm preview hết hiệu lực. Lock owner từ chối invocation đang chạy, lease đang giữ và nghĩa vụ waiting chưa được giải quyết qua review re-entry chính xác bên dưới.

Dự báo mô tả công việc logic; chỉ dispatch mới đóng băng invocation cụ thể. Revision có thể đổi
tọa độ tương lai chưa có thư mục request hay attempt. Tọa độ đã dispatch và mọi file nhánh hiện
có được giữ nguyên, niêm phong bằng inventory. Ánh xạ node ghi sự thay thế, không ghi thực thi.
Prerequisite gốc vẫn nằm trong context invocation; ánh xạ hiện tại chỉ ra consumer tương lai mà
không coi tọa độ gốc đã được đáp ứng. Context lịch sử thiếu không dùng làm proof, không dựng từ
văn xuôi hay execution đã nghỉ. Attempt phiên bản hiện tại còn chạy mà thiếu context chỉ được
lưu context lúc acceptance thành công, ghi rõ thời điểm `acceptance`.

Trong cùng goal đã xác nhận, giữ dự báo hiện tại và dùng `flags.edit` khi preview:

- `{"kind":"retry","cell":"N/M"}` giữ attempt mismatch hoặc inconclusive đã chấp nhận và
  lên lịch successor duy nhất cùng goal. Request mới giữ operator, requirements, inputs, unit và
  giới hạn effects, ghi `attempt.previous`, đồng thời thay input đã kiểm chứng, phương pháp hoặc
  revision checkout. Đổi số expected hay attempt không phải tiến bộ. Tùy chọn
  `rebind: {source: "P/Q", writeRoots: [...]}` chèn lại chính session checkout đã bind trước retry.
  Root thêm phải nằm trong mutable ownership của request thất bại và không đụng protected owner;
  route hiện tại, dirty paths và source authority đều được kiểm lại. Retry chờ binding mới matched
  đúng nội dung. Bind lịch sử kiểm request, invocation và toàn bộ evidence seal gốc, không xem dirt
  phát sinh sau là input của lần cũ. `INVALID_INPUT` blocked không có đường retry tổng quát.
  `correction: "source-history"` với `revision` bằng HEAD hiện tại đã đo mới mở lại cửa sổ source
  có changes binding được giữ và reflog còn đọc được chứng minh thao tác bị từ chối. HEAD đó làm
  base mới; cửa sổ cũ không cấp proof implementation. Interaction chưa được trả lời và stop của
  caller hay bên ngoài khác vẫn qua gate của owner. Receipt source mới phải qua toàn bộ luật ghi
  source và expected/actual, gồm commit policy của chính invocation đó.
  `correction: "source-proof-review"` thay vào đó ghi `criterionId` bắt buộc vẫn chưa đạt trong
  observation và comparison đã niêm phong, cùng trỏ tới changes evidence được khai báo. Cửa sổ
  source còn đọc được phải có đúng một commit bình thường, với commit cuối đã giữ là ancestor của
  HEAD thật mới được ghi bằng `revision`. Công việc xen giữa không cấp proof cho outcome thất bại này.
  `methodRef` chỉ artifact chuẩn dưới `request/` của request mới; request đóng băng byte thật bằng
  `frozenInputs`, với nội dung khác mọi frozen input cũ. Chỉ đổi base hoặc đổi tên byte phương pháp
  không đổi là chưa đủ. Invocation mới giữ goal, unit, inputs, requirements, effects và criterion
  bắt buộc, rồi tạo commit sửa của chính nó và toàn bộ source proof. Commit blocked được giữ cùng
  lựa chọn review không cấp proof implementation hay bỏ qua interaction chưa được trả lời.
- `{"kind":"resume","cell":"N/M"}` vào lại node blocked đã được chấp nhận. Restatement cần đáp
  án thật khớp nội dung; stop khác phải route tới resume của operator đó. `source` tùy chọn chỉ một
  reading blocked đã chấp nhận của phiên bản hiện tại cho node chưa mở cùng operator và goal logic.
  Request mới ghi đúng đích resume và lựa chọn thật mà kết quả trả về.
- `{"kind":"expand","cell":"N/M","producer":"P/Q"}` mở fanout chưa dispatch từ output `units`
  được niêm phong của plan matched thật, giữ node đã chạy. Phụ thuộc unit chạy trước. Khi operator
  sở hữu nhiều dòng done-when, `goals` ánh xạ mỗi id unit tới chỉ số dòng đã xác nhận. Request mới
  bind đúng id unit và `inputs.units` trả về.
  `scripts/plan-history.mjs#acceptedUnitDependency` giải phụ thuộc được giữ qua chuỗi retry duy nhất
  đã niêm phong. Mỗi liên kết giữ operator, unit logic và input plan được chấp nhận, cùng quyền từ
  forecast gốc của invocation. Chỉ proof matched mới nhất thỏa việc tiêu thụ hiện tại; successor
  đang chờ, thất bại, không duy nhất hoặc bị sửa không thể quay về lấy công của bản cũ. Gate giao
  source hiện tại vẫn từ chối source đang bị xem xét hoặc đã bị thay thế. Plan và receipt lịch sử
  không đổi; forecast retry mới cập nhật cạnh unit chưa mở.
- `{"kind":"repair","cell":"N/M","wall":"runtime.<role>.head","requirements":{...}}` theo
  Next runtime đã khai của preflight được chấp nhận ở phiên bản hiện tại khi chỉ còn một wall về
  head runtime. Requirements bind đúng project, role, môi trường, commit đã đóng băng và phê duyệt
  hiện tại từ khai báo môi trường; effects chỉ có `attest-runtime-entry`. Edit chèn một attestation
  riêng rồi vào lại preflight với toàn bộ requirements không đổi. Nhánh vào lại chỉ mở khi repair
  có receipt matched còn niêm phong, dùng lại head và không tạo thay đổi integration. Repair lỗi
  hoặc chưa được chứng minh vẫn blocked. Attestation prerequisite không cấp quyền sửa source hay
  công nhận delivery tương lai; node runtime delivery gốc, tọa độ đã dispatch và các peer độc lập
  chưa mở vẫn được giữ trong dự báo.

Với goal runtime delivery chưa mở, `{"kind":"partition","cell":"N/M","env":"<environment>","routes":["<project>/<role>"]}`
ghi ánh xạ đầy đủ các route của riêng goal đó, rồi xếp một invocation một route cho mỗi thành viên.
Ánh xạ chỉ được dùng đúng route repository trong discovery đã xác nhận. Mission có nhiều repository
phải ánh xạ từng goal runtime trước dispatch; goal chỉ cần một route không nhận thêm mọi repository.
Goal và scope gốc không đổi. Mỗi invocation đóng băng route, môi trường và commit đích, bind commit
đó làm head của context role source, và bind changes nguồn đã được chấp nhận khi sử dụng input đó.
Runtime repair chỉ làm prerequisite cho nhánh khác không được tính thành delivery partition.

Dự báo active qua đủ gate Input, Context, Next, goal, luồng dài và budget hữu hạn. Handoff phụ
thuộc đã khai có thể tiếp tục từ owner input hoặc context trước đó khi Next của owner gọi tên
consumer; không tìm lịch sử không liên quan. Preview ghi cạnh này. Dispatch yêu cầu owner có
evidence matched đúng phiên bản, qua validator và còn niêm phong; invocation phải dùng output
thật đó. Chuỗi chưa niêm phong vẫn kiểm Next của step liền trước.

Goal đổi đáng kể dùng `session-open.mjs confirm` với `corrected`, rồi đáp án thật xác nhận phiên
bản mới. Dự báo mới đầy đủ giữ execution trước như evidence lịch sử, không dispatch, cấp input
hiện tại hoặc đóng goal mới. Inventory và đáp án cũ vẫn được kiểm. Không có ranh giới step tùy ý
bỏ kiểm các cam kết bất biến của lịch sử.

Node waiting có nested review đã niêm phong chọn verdict `reentry` do kind contract khai báo dùng cùng edit `resume`. Dự báo giữ identity attempt cha/con, hash request, fingerprint evidence và scope hiện tại. Nó mở invocation mới cùng owner; không resume hay sửa checkpoint đã chấp nhận tại chỗ. Invocation thay thế phải tạo model của chính nó và có nested review mới matched trước khi kết luận. Nhánh thay thế mới được lên kế hoạch vẫn là nghĩa vụ chưa hoàn thành, không cấp proof hoàn tất.

Khi execution sở hữu công việc khai báo vấn đề toàn vẹn review, thêm `integrity: {ref, hash}` vào edit đó. JSON disclosure tương đối với session có đúng `version: 1`, `identity`, `disposition: "fresh-review-required"`, `reason` cụ thể và `sourceRef` của lời thừa nhận thật. Identity bind `sessionId`, `missionVersion`, `scopeHash`, cùng bản ghi `parent`/`child` chứa `cell`, `attemptId`, `requestHash` và `evidenceFingerprint`. Hash bao phủ nguyên byte disclosure, được lưu trong dự báo niêm phong. Bản ghi chỉ cho phép review mới trong scope đã xác nhận: không phải verdict review, approval hay input delivery. Giữ evidence bị đặt nghi vấn và giới hạn đã thừa nhận; timestamp filesystem không thay thế provenance execution.


## Review source đã được chấp nhận

Receipt source đã chấp nhận vẫn bất biến khi kiểm tra sau đó đặt nghi vấn về implementation. Dùng
edit dự báo hiện hữu với `kind: "review"`, `cell` source, một `criterionId` bắt buộc của bản gốc,
`method: {ref, sha256}` mới phía request, plan `gates` thực tế và các `counterparts` source đã chấp
nhận chính xác nếu cần. Edit lên lịch invocation `quality.verify` chỉ đọc trên source đã bind.
Diagnostic đo criterion của source; output API hoặc browser không tự chứng minh một owner source
khác phải sửa. Review chỉ source không tuyên bố runtime hay verdict giao diện chưa đo.

Review matched có gate bắt buộc đã niêm phong thực sự fail trong boundary, không có debt, cho phép
`kind: "source-repair"` với `cell` source gốc, cell `review` và `gateRef` chính xác. Invocation mới
giữ owner source, unit, requirements, các expected criterion bắt buộc và ranh giới effects. Nó dùng
method kiểm chứng mới đã đóng băng, giữ ancestry source và tạo normal source commit cùng proof của
chính nó. Request, response và commit gốc được giữ nguyên. Khi sửa consumer source đã chấp nhận,
`replacements` chỉ ánh xạ input kind gốc sang đúng producer repair đã chấp nhận mà review của
consumer đo như counterpart; không cấp input hoặc quyền ghi không liên quan.

`scripts/source-review.mjs` sở hữu quan hệ review và barrier consumer hiện hành trong cùng session.
Bộ đọc complete-goal bên dưới dùng kết quả pending và retired-source của nó. Review pending là nghĩa
vụ còn mở hợp lệ, không làm session sai; chỉ goal bị ảnh hưởng và consumer phụ thuộc chờ. Review red
đã kiểm chứng ngăn source cũ nhận lại credit delivery, kể cả khi bản thay thế thành công. Review green
chính xác giữ credit source gốc. Producer-import và coordination còn kiểm barrier delivery hiện
hành trước khi tạo import, mở consumer mới dùng input import, resolve producer hoặc incorporate
source. Source pending hoặc retired không trở thành bằng chứng delivery mới. Import và invocation
đã chấp nhận trong lịch sử giữ nguyên proof niêm phong; barrier không viết lại các receipt đó.

## Bằng chứng đầy đủ của goal

Dự báo niêm phong ghi một tập nghĩa vụ đóng cho từng phân hoạch route hoặc plan unit đã được chấp
nhận. Thành viên bất biến giữ chỉ số goal gốc và đúng khai báo route hoặc output plan, hash request
và fingerprint bằng chứng. Replan cùng goal giữ mọi thành viên bắt buộc. Invocation retry hoặc resume
giữ định danh thành viên; receipt và context invocation gốc không đổi. Preset một route đã niêm phong
đã là ánh xạ riêng của goal đó. Dự báo unit hiện có suy ra cùng tập đầy đủ từ producer đã chấp nhận,
kể cả unit bắt buộc chưa viết request thực thi.

Ở nhánh phân hoạch, response.goalCheck chỉ mô tả thành viên của nhánh. Bằng chứng từng phần đã chấp
nhận là tiến triển, không kích hoạt stop do liên tiếp không tiến triển. Dòng done-when gốc chỉ được
chứng minh khi mọi thành viên hiện tại bắt buộc đều matched độc lập, toàn bộ bằng chứng đã khai và
request vẫn niêm phong, và validator riêng còn chấp nhận bằng chứng đó. Plan, cell chưa mở, thành viên
lặp, producer unit khác, runtime repair prerequisite, mission cũ hoặc kết quả mismatch không thay thế
được. Verification dùng tier journey từ scripts/unchecked.mjs; unit secondary vẫn unchecked và không
thay bằng chứng journey bắt buộc. Generation giữ mọi unit của plan.

Scripts/goal-partitions.mjs sở hữu phép tổng hợp này. Goal ledger, gate brief.proven, gate kết thúc
session, admission invocation phụ thuộc và bộ đọc bằng chứng gốc của coordinator dùng cùng kết quả.
Consumer cần toàn bộ nghĩa vụ chỉ mở khi mọi thành viên bắt buộc đã được chấp nhận. Coordinator giữ
mọi nhánh chứng minh bắt buộc và kiểm binding repository của từng phân hoạch; không ghép những lượt
đo từng phần không liên quan thành một quan sát nhiều role.

## Tách phần việc chung khi đang thực thi

Thẩm quyền sở hữu nằm tại `resources/orchestrator.json#workflowTopologies.coordination`; `scripts/workflow-coordination.mjs` thực thi luật đó. Lệnh nhận `<command> <own-session> <input.json>`. Mỗi peer tự gọi `enrol` với session coordinator. Coordinator gọi `assign` cho các claim không giao nhau theo đường dẫn tương đối của repository, rồi `prepare` với đúng phần impact của donor, draft producer chưa chạy, operator tạo kết quả và tọa độ consumer phụ thuộc chưa mở. Producer mới tự enrol bằng địa chỉ preparation; `activate` chuyển các root đã chọn một cách nguyên tử. Claim cha có thể giữ các exclusion chuẩn cho subtree đã chuyển. Chỉ reservation đang ghi giao với phần chuyển mới phải chờ; phần độc lập giữ thẩm quyền cũ. Thay đổi scope hiện hành làm preparation chưa kích hoạt mất hiệu lực.

Claim là đường dẫn repository cụ thể. Mô tả discovery khái quát và chú thích bằng chứng không cấp quyền ghi filesystem. Cùng helper sở hữu có thể suy ra claim cụ thể từ source file được chấp nhận nguyên vẹn trong cùng mission, hoặc request source đã admitted được nối với workspace binding được chấp nhận và ranh giới ghi hiện hành chính xác. Request backend giữ matcher mutable/protected; request frontend giữ tập đường dẫn ghi và exclusive boundary đã khai báo. Vì vậy donor không phải triển khai file chung mới trước. Assignment đầu tiên còn niêm phong danh tính invocation source đang chạy. Đúng invocation đó được hoàn tất với request/context nguyên vẹn nếu quyền sở hữu và dependency gate hiện hành vẫn giữ; danh tính đã lưu không admit invocation mới.

Khi attempt hiện hành của producer được chấp nhận, coordinator gọi `resolve` với dependency id và đúng step/parallel. Consumer dùng producer-import hiện hữu để giữ input có kiểu. Với source output, consumer gọi `incorporate` bằng dependency id, input đã import, alias source và worktree đã đăng ký. Lệnh yêu cầu checkout sạch, đóng băng HEAD cũ/producer và tree merge dự kiến, kiểm tra mọi đường dẫn thay đổi nằm trong root đã chuyển, rồi dùng Git merge/commit bình thường với hooks và signing. Intent bền vững và receipt niêm phong ràng buộc parents/tree thực tế trước attempt source tiếp theo. Retry đo lại merge đã hoàn tất hoặc tiếp tục đúng merge pending chưa đổi; không reset công việc cục bộ. Symlink/submodule thay đổi, xung đột, checkout bẩn hoặc HEAD khác phải được owner xử lý.

`readiness` suy ra waiting-producer, waiting-import, waiting-incorporation hoặc ready từ bằng chứng đã giữ. Dispatch kiểm tra cùng sự thật; chỉ node phụ thuộc chờ và tin nhắn không được tính là hoàn tất. Lock coordination của Source bao phủ so sánh và admission bền vững rồi nhả trước khi worker chạy. Thiếu locator sở hữu thì từ chối. Khôi phục lock owner đã chết được tuần tự hóa; nếu chính lần khôi phục đó chết và để lại recovery marker, execution tự động từ chối đến khi owner kiểm tra và sửa. Không tuyên bố tự khôi phục hoàn toàn từ lần crash thứ hai.

Hoàn tất vẫn giữ mọi mục tiêu peer và dùng schema phiên bản 2 của `workflow-peers` và `workflow-verification-report`. Request của verifier tích hợp đóng băng contribution repository và runtime selector từng role. Mỗi role có hai observation no-op hiện hành được chấp nhận độc lập, bao quanh API/browser verifier thực tế, gồm endpoint bất biến, checkout đang phục vụ, HEAD, generation và process. Runtime owner hiện hữu có thể tạo merge tích hợp bằng receipt mutation rồi thu các observation đó. Context HEAD của source hoặc digest của các regression riêng lẻ không chứng minh runtime kết hợp đã được thử.
