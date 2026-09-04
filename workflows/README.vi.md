# Workflow

Không còn file workflow nào. Một chuỗi không bao giờ được chọn từ ví dụ: nó được suy ra từ nhiệm
vụ, bởi `scripts/plan-chain.mjs`, chỉ từ các bảng của operator, và được `scripts/validate-chain.mjs`
kiểm mỗi lần vẽ. Các chuỗi mẫu thư mục này từng giữ giờ là fixture của planner, nằm ở
`tests/chains/`, và `scripts/plan-chain.spec.mjs` chứng minh planner vẫn suy ra được từng chuỗi ấy
từ kết quả mà nhiệm vụ của nó gọi tên.

## Chuỗi được suy ra thế nào

Planner xuất phát từ nhiệm vụ đã xác nhận (`state.json.mission`): mỗi dòng "xong khi" gọi tên
operator mà biên nhận của nó là bằng chứng ấy, và các operator đó là đích. Nó đi ngược qua các bảng
mà mỗi operator công bố trong `operator.md` của mình:

- một **Đầu vào** bắt buộc kéo vào operator sinh ra kind đó — ưu tiên producer đã có trong chuỗi,
  rồi đến operator duy nhất có `primaryOutput` là kind ấy (hai primary thì phân xử bằng operator mà
  dòng Đầu vào gọi tên), rồi đến producer duy nhất; kind nào các bảng để mập mờ thì bị từ chối kèm
  tên các ứng viên, không bao giờ đoán;
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
  `frontend-surface-audit`, rồi `uat.verify`, trước khi publish.

Hai chỗ mà đầu vào bắt buộc để ngỏ cũng do các bảng phân xử: một Đầu vào tuỳ chọn xếp consumer sau
producer đã có trong chuỗi, và một dòng Kế tiếp một chiều xếp operator bàn giao trước operator được
bàn giao — mỗi thứ trừ khi nó khép thành vòng, khi ấy cạnh cứng thắng và cạnh bị bỏ được ghi lại
trong plan. Rồi các nút được xếp thành bậc: một nhánh chỉ chạy khi mọi thứ nó phụ thuộc đã chạy ở
bậc trước và bảng Kế tiếp của bậc trước gọi tên nó; tối đa ba nhánh một bậc
(`resources/orchestrator.json#maxConcurrentAgents`, hoặc `#concurrency.maxParallel` khi được khai);
không bao giờ hai nhánh cùng ghi một alias trong một bậc; nhánh toả đứng riêng một bậc để các đơn
vị của nó mở rộng tại chỗ. Mỗi nhánh có một goal — dòng "xong khi" nó chứng minh, hoặc nhánh sau
sớm nhất mà nó mở đường — chính là thứ `request.json.goal` mang và `validate-request` kiểm.

Plan được in cho người dưới dạng hai dòng mỗi nhánh (goal, rồi lý do nhánh có mặt) trước khi bất kỳ
thứ gì được dispatch, và `node scripts/plan-chain.mjs <session>` in cùng bản xem trước ấy kèm khối
JSON cho một phiên trên đĩa.

## Gate ép những gì

`validate-chain` đọc `state.json.chain`, `state.json.steps` và `request.json` của từng nhánh, và từ
chối chuỗi trong đó:

- một nhánh gọi tên operator cây không có, hay một ô nằm ở bậc không đúng số của nó;
- một bậc có operator mà không bảng Kế tiếp nào của bậc trước cho phép và cũng không phải vào lại
  chính operator đó;
- một nhánh cần Đầu vào không bậc trước nào sinh, hay context `@workspaces/<role>` không
  `workspace.bind` nào của role đó bind trước;
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
goal nó chuyển tới, được xác nhận qua `goal-confirm` như plan đầu, không bao giờ viết lại trong im
lặng (`scripts/validate-session.mjs#missionHistoryErrors`).

## Các fixture

`tests/chains/<id>.json` giữ mười một chuỗi mẫu của 2.0.0 viết lại theo id operator hiện tại, mỗi
chuỗi kèm nhiệm vụ mà các dòng "xong khi" gọi tên kết quả của nó, thứ tự operator nó chờ đợi, và
ghi chú về cách viết lại. Chúng là đầu vào cho spec của planner, không phải cho runtime: cửa vào
không bao giờ đọc chúng.
