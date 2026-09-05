# Workflow

Không còn file workflow nào. Một chuỗi không bao giờ được chọn từ ví dụ: nó được suy ra từ nhiệm
vụ, bởi `scripts/plan-chain.mjs`, chỉ từ các bảng của operator, và được `scripts/validate-chain.mjs`
kiểm mỗi lần vẽ. Các chuỗi mẫu thư mục này từng giữ giờ là fixture của planner, nằm ở
`scripts/fixtures/chains/`, và `scripts/plan-chain.spec.mjs` chứng minh planner vẫn suy ra được từng chuỗi ấy
từ kết quả mà nhiệm vụ của nó gọi tên.

## Vòng đời v2.2 thực thi được

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
