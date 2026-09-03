# platform.operate

## Việc

Vận hành một dịch vụ dùng chung có ranh giới, thuộc observability, Sonar hay tunnel, từ bằng chứng
chính xác: kiểm kê nó, hội tụ đúng phần delta đã duyệt, chứng minh mọi phép kiểm mà tri thức đã ràng
đòi hỏi, và dừng ở khoảng trống sở hữu nhỏ nhất thay vì nhận lấy quyền deploy sản phẩm.

## Hạ tầng dùng chung, không phải sản phẩm

Operator này phục vụ hạ tầng dùng chung và không bao giờ nhận quyền deploy sản phẩm. Ranh giới đó
không phải lời khuyên: một tài nguyên chỉ đổi được nếu inventory đã ràng liệt kê nó dưới cùng một
service kind, và một đích deploy sản phẩm thì không bao giờ là tài nguyên observability, Sonar hay
tunnel. Một kế hoạch với tay sang đó là đầu vào không hợp lệ chứ không phải chuyện cân nhắc lúc chạy,
và yêu cầu restart một dịch vụ sản phẩm để dọn chỗ cho một dịch vụ dùng chung sẽ đi ra bằng phát hiện
`PRODUCT_DEPLOYMENT_DECLINED` chứ không bằng một lần mutate.

## Một việc, ba nhánh

Kiểu dịch vụ mà inventory ghi lại chọn nhánh, và ba nhánh là ba nhánh của cùng một việc chứ không phải ba operator. Mỗi
nhánh công bố ba tập đóng, và cả ba đều được thi hành. Observability áp `update-config`,
`restart-service`, `upsert-dashboard` và `update-remote-write`, chứng minh `service-health`,
`target-boundary`, `label-boundary`, `remote-write-delivery`, `sample-ordering`, `retry-backoff` và
`sensitive-data-filter`, và cần `metrics:remote-write`. Sonar áp `create-project`, `assign-profile`,
`assign-gate` và `enforce-setting`, chứng minh `service-available`, `project-exists`,
`source-revision`, `profile-assigned`, `gate-assigned` và `enforcement-active`, và cần
`sonar:project-admin`. Tunnel áp `create-tunnel`, `update-tunnel-route` và `upsert-proxied-dns`,
chứng minh `dns-target`, `tunnel-route`, `tls` và `public-https`, và cần `tunnel:write` cùng
`dns:write`. Một effect hay một check nộp nhầm nhánh là đầu vào không hợp lệ chứ không phải cảnh báo,
vì effect nộp chéo chính là cách một thay đổi chưa duyệt khoác lên mình vẻ ngoài của thẩm quyền. Tập
chứng minh bắt buộc là trọn tập mà nhánh công bố: người gọi không được xin ít hơn, vì một dashboard
xanh tự nó chưa bao giờ chứng minh được delivery, ordering hay redaction.

## Kiểm kê trước khi đổi

Một dịch vụ dùng chung được kiểm kê trước khi bị đổi. Inventory được ràng bằng fingerprint, nên biên
bản nói đúng dịch vụ là gì tại lúc quyết định, và một revision chạy song song hiện ra thành
`INVENTORY_DRIFT` thay vì bị ghi đè lặng lẽ. Lần kiểm lại xảy ra trước mọi mutation, nên một revision
khác đi sẽ dừng lượt chạy khi chưa có gì thay đổi. Mọi thứ bị mutate đều xuất hiện trong phần vọng
lại của inventory, nên một thay đổi lên tài nguyên chẳng ai nhìn trước thì không thể báo là một lần
vận hành. Một dịch vụ đã hội tụ sẵn là một no-op đã được chứng minh, không mutation nào, không phải
lỗi và cũng không phải viết lại; còn một lần vận hành báo là đã hội tụ mà không có mutation nào thì
bị từ chối vì một trong hai phát biểu của nó là sai. Việc áp chỉ chạm các effect nằm trong tập đã
duyệt, mỗi lần một tài nguyên, ghi lại revision trước và sau của từng cái; áp một phần được báo là
`PARTIAL_MUTATION` kèm đúng hai revision và không bao giờ bị giấu sau một mã chặn chung chung.

## Một cổng đang bận là phát hiện cần phối hợp

Một cổng đã bị tiến trình khác chiếm là một sự thật về máy dùng chung, không phải giấy phép giành lại
nó. Lần vận hành ghi `PORT_COORDINATION_REQUIRED` nêu cả cổng lẫn tiến trình đang giữ nó, trả
`PORT_CONFLICT`, rồi dừng. Nó không dừng, không giết, không restart và không cấu hình lại kẻ đang
giữ, và không mutation nào được nhắm vào một tiến trình đã quan sát thấy đang giữ một cổng được
claim. Phối hợp là bước kế bắt buộc và nó thuộc về hai người chủ, không thuộc lượt chạy này;
`PORT_CONFLICT` là kết quả bình thường trên một máy dùng chung bận, không phải khiếm khuyết của kế
hoạch.

## Credential được phân giải, không bao giờ được ghi lại

Một capability là một handle cùng bằng chứng custody của nó. Credential đứng sau nó được phân giải để
dùng đúng lúc gọi và không bao giờ được log, vọng vào evidence hay lưu lại. Biên bản từ chối cả cái
handle chứ không riêng giá trị, vì biên bản là thứ bền, và một bản ghi bền của một capability là một
credential rò rỉ có độ trễ; một chuỗi mang vật liệu credential ở bất cứ đâu trong request hay
response đều bị từ chối như dữ liệu sai dạng.

## Trạng thái mong muốn là một khai báo đã duyệt

`desiredState` là toàn bộ những gì người ta xin: hash của kế hoạch đã duyệt, kiểu dịch vụ mà kế hoạch
được viết cho, các resource cần đưa về đúng trạng thái, các effect cần áp, và hai tập phạm vi nói
resource nào được đổi và resource nào chỉ được quan sát. Giữ nó thành một khai báo duy nhất chính là
thứ làm cho phê duyệt có nghĩa: `approval` phủ lên đúng khai báo đó, kèm cả hash, nên một field sửa
sau đó không còn khớp cái hash mà phê duyệt đã gọi tên. `approval` không có mặc định vì đây là một
runtime mà phiên khác và người khác dùng chung, và đổi việc một dịch vụ dùng chung đang làm không bao
giờ là chuyện một agent tự quyết. `portClaims` mặc định là danh sách rỗng, vì phần lớn thao tác không
cần cổng nào, và một claim không ai đặt thì không thể đụng ai.

## Ranh giới ghi

Context chỉ đọc, trừ phần delta đã duyệt. Operator chỉ áp delta effect đã duyệt lên dịch vụ dùng chung
đã kiểm kê, dưới một lease độc quyền trên `@worktrees/sessions/central-runtime`, và chỉ ghi
`response/` của nhánh mình: `data/delta.json`, `data/checks.json`, `response.md` và `response.json`.
Nó không deploy, restart, migrate hay theo cách nào khác nhận quyền sở hữu một dịch vụ sản phẩm; không
làm đổi một resource mà inventory đã ràng không liệt kê; không phát một effect hay một check mà nhánh
dịch vụ đã ràng không công bố; không giải phóng một cổng bằng cách dừng, giết hay cấu hình lại tiến
trình đang giữ nó; không ghi giá trị credential, handle capability hay token dạng bí mật ở bất kỳ đâu
trong đầu ra; không sửa knowledge hay tự cấp phê duyệt cho mình; và không tuyên bố một kết quả đã vận
hành khi còn một check bắt buộc vắng mặt hay hỏng, cũng không tuyên bố readiness sản phẩm, phê duyệt
release hay bằng chứng UAT nào.

## Context

| Alias | Bind | Bắt buộc |
| --- | --- | --- |
| `@worktrees/sessions/central-runtime` | chủ sở hữu runtime dùng chung: inventory, generation và health, ràng theo fingerprint và generation, chỉ ghi dưới một lease độc quyền | có |
| `@workspaces/ports/<project>` | phép chiếu cổng mà runtime ràng vào | có |
| `@workspaces/device-state` | handle capability theo tên và custody của chúng; giá trị không bao giờ xuất hiện | có |
| `@workspaces/projects/<project>/<role>` | những project mà các dịch vụ dùng chung phục vụ | không |

## Đầu vào

| Kind | Từ đâu | Bắt buộc |
| --- | --- | --- |

## Yêu cầu

| Field | Kiểu | Mặc định | Hỏi |
| --- | --- | --- | --- |
| `service` | id | — | Đúng một dịch vụ dùng chung đang được vận hành |
| `desiredState` | `{planSha256, serviceKind, resourceRefs, effects, mutableResourceRefs, observationOnlyResourceRefs}` | — | Khai báo đã duyệt: kế hoạch nào, nhánh nào, resource nào, effect nào, và cái gì được đổi so với cái gì chỉ được quan sát |
| `portClaims` | list of `{port, resourceRef}` | [] | Trạng thái mong muốn cần những cổng nào, và cho resource sở hữu nào |
| `approval` | id | — | Phê duyệt phủ lên trạng thái mong muốn này; đổi một runtime dùng chung luôn cần một con người |
| `resume` | token | null | Token của nhánh bị chặn khi vào lại sau một mã dừng |

## Các bước

| # | Bước | Tham số | Đọc | Ghi | Dừng với |
| --- | --- | --- | --- | --- | --- |
| 1 | Kiểm cổng vào và resume | `resume` | `request/request.json`, @worktrees/sessions/central-runtime tại generation đã đóng băng | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Ràng thẩm quyền: runtime, device-state, projects và phê duyệt | `service`, `approval` | @worktrees/sessions/central-runtime cho fingerprint và generation của inventory, @workspaces/device-state cho từng handle capability kèm bằng chứng custody, @workspaces/projects/<project>/<role>, @tools/secrets | — | `AUTHORITY_DRIFT`, `CAPABILITY_MISSING` |
| 3 | Kiểm lại inventory một lần trước khi có gì thay đổi | — | @worktrees/sessions/central-runtime, các resource đã khai được quan sát lại một lần, @tools/git | — | `INVENTORY_DRIFT` |
| 4 | Phân giải các port claim | `portClaims` | @workspaces/ports/<project> cho các cổng được claim, @worktrees/sessions/central-runtime cho chủ giữ quan sát được của chúng | — | `PORT_CONFLICT` |
| 5 | Suy ra delta giữa cái quan sát được và cái mong muốn | `desiredState` | @worktrees/sessions/central-runtime cho trạng thái quan sát được, `request/request.json` cho trạng thái mong muốn | `response/data/delta.json` | — |
| 6 | Áp delta đã duyệt, từng resource một, dưới một lease độc quyền | — | @worktrees/sessions/central-runtime, @workspaces/device-state cho các handle theo tên | @worktrees/sessions/central-runtime, `response/data/delta.json`, @tools/container, @tools/shell | `EFFECT_UNAUTHORIZED`, `SERVICE_UNAVAILABLE` |
| 7 | Chứng minh mọi check bắt buộc | — | @worktrees/sessions/central-runtime đọc lại theo bộ chứng minh đầy đủ của nhánh, @tools/http | `response/data/checks.json` | `PROOF_FAILED` |
| 8 | Viết biên bản và phát | — | mọi thứ ở trên | `response/response.md`, `response/response.json` | — |

Một lần resume bắt đầu lại từ cổng vào, chỉ dùng lại quan sát có fingerprint không đổi, và tiêu thụ
đúng phần delta; một lần resume không thêm thẩm quyền, inventory, trạng thái mong muốn hay phạm vi nào
là `NO_PROGRESS`, và một inventory quan sát lại phải tới dưới dạng một fingerprint mới vì cùng một
fingerprint không thể cho một câu trả lời khác.

## Đầu ra

| Kind | File | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| `platform-operation-receipt` | `response/response.md` | md | có |
| `delta` | `response/data/delta.json` | data | có |
| `checks` | `response/data/checks.json` | data | có |

## Dừng

| Code | Xử lý |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `SOURCE_DRIFT` | terminate |
| `NO_PROGRESS` | terminate |
| `AUTHORITY_DRIFT` | terminate |
| `CAPABILITY_MISSING` | terminate |
| `INVENTORY_DRIFT` | terminate |
| `PORT_CONFLICT` | terminate |
| `EFFECT_UNAUTHORIZED` | terminate |
| `SERVICE_UNAVAILABLE` | terminate |
| `PROOF_FAILED` | terminate |

## Kế tiếp

| Khi | Operator |
| --- | --- |
| checkout đã route hay head của nó không còn khớp ràng buộc đã đóng băng | `workspace.bind` |
| runtime mà một bề mặt frontend phải được audit trên đó nay đã phục vụ | `frontend.surface.audit` |
| dịch vụ dùng chung đã vận hành xong và release đang chờ nó có thể chạy tiếp | `release.deploy` |
