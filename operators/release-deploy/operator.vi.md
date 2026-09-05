# release.deploy

## Việc

Deploy một release bất biến lên một target đã khai, dưới đúng thẩm quyền đã khai, rồi chứng minh
trạng thái ổn định mà nó đạt tới, đi nhánh recovery hay rollback ngay trong cùng lượt chạy thay vì
giả định rollout đã thành công.

## Xong khi

Xong khi `release-deployment` ghi nhận release đã được deploy hay release trước đã được khôi phục,
với `probes` quan sát trên trọn cửa sổ ổn định cho thấy hoặc digest bất biến đang hoạt động trên mọi
target đã khai với mọi probe đã khai đạt, hoặc đúng release rollback đã được khôi phục và không bao
giờ được báo là giao thành công release bị từ chối.

## Một image, một target

Operator này release một image: artifact được nhận diện bằng digest, roll out lên một target đã khai
và chứng minh ổn định. Một schema phải dịch chuyển trước khi image ấy phục vụ được thì do
`migration.release` release từ plan đóng băng của riêng nó, trước khi operator này chạy; bước
`migrate` ở đây chỉ áp migration mà chính manifest của image khai là một phần của rollout, và một
migration không áp được theo cách đó là `MIGRATION_BLOCKED` và trả về chủ backend.

## Recovery và rollback là nhánh của chính việc này

Một rollout không ổn định lại vẫn là vấn đề của operator này. Lượt chạy kết thúc ở đúng một trong ba
điểm cuối và không bao giờ dừng giữa chừng: release được deploy, release trước được khôi phục, hoặc
công việc bị chặn với một lý do chính xác. Một release được khôi phục là điểm cuối của riêng nó; nó
không bao giờ được đọc thành việc giao thành công cái release mà nó vừa từ chối.

## Release là bất biến và chính xác

Một release được nhận diện bằng digest `sha256:` của nó, không phải bằng tag, nhánh hay số build.
Artifact không bao giờ được build lại, gắn tag lại hay thay thế bên trong lượt này; nếu digest không
phân giải được thì lượt chạy dừng, chứ không build một cái thay thế rồi gọi nó là cùng một release.
Manifest phải đã được kiểm đúng với chính release này, vì manifest ghim vào một release khác chính là
cách một image chưa duyệt tới được một target đã duyệt.

## Thẩm quyền là được khai, không bao giờ được ngầm hiểu

Deploy đòi hỏi một grant khai riêng, phủ đúng project này, môi trường này, target này và hành động
`deploy`, và còn hiệu lực tại đúng lúc target được quan sát. Không nhiệm vụ thường nào, không tiền lệ
từ một project anh em nào và không sự gấp gáp nào ngầm cấp nó, và một lần deploy không có thẩm quyền
không trở thành có thẩm quyền chỉ vì nó hữu ích. Mất mát phá huỷ, xoay vòng credential, hay một host,
domain, tenant hoặc project mới đều nằm hẳn ngoài thẩm quyền của operator này và trả `APPROVAL_REQUIRED`.

## Credential là tên, không bao giờ là giá trị

Handle được phân giải qua custody đang có, đúng lúc cần. Một giá trị đã phân giải không bao giờ đi
vào plan, manifest, biên bản, một dòng log, một tham số lệnh hay một tin nhắn. Biên bản ghi lại
những handle nào đã được phân giải và không gì hơn, và không trường nào trong hợp đồng chứa nổi một
giá trị dù có ai cố: một token viết vào chỗ đáng lẽ là handle `secret-ref://` bị từ chối như đầu vào
sai dạng, thay vì lặng lẽ trôi vào một danh sách tham số. Việc kiểm tra phân giải ở bước 3 là một lệnh
chẩn đoán theo đúng luật mà `identity.provision` đã nêu cho credential nó giải: việc chứng minh
`CREDENTIAL_UNAVAILABLE` không xảy ra chỉ báo cáo rằng một handle không giải được, không bao giờ báo
cáo nó đã giải ra gì.

## Mọi tác động đều là compare-and-set

Một bước hoặc có làm đổi một boundary, hoặc không. Các bước có làm đổi là `host-prepare`,
`artifact-publish`, `migrate`, `domain-reconcile`, `rollout`, `recover` và `rollback`, và mỗi bước
ghi lại revision quan sát được của chính boundary mình trước và sau. Trạng thái mong muốn mà đã trùng
sẵn là một no-op idempotent đã được chứng minh và được ghi đúng như vậy; tuyên bố đã áp dụng mà
revision không dịch chuyển thì bị từ chối, còn một bước chỉ đọc mà báo revision là bịa ra một sự thật
về boundary nó chưa hề chạm. Execution root là thứ bỏ đi được và dựng lại được.

## Giám sát phân biệt đang tiến và đang hỏng

Ở dự án này, push lên `main` kích hoạt workflow và boot mất khoảng tám tới chín phút, nên
`progressing` là điều kiện bình thường trong phần lớn cửa sổ và không bao giờ bị coi là lỗi, và một
deadline giám sát ngắn hơn cửa sổ mà nó phải chứa sẽ sinh ra một lỗi giả chắc chắn. Một lần probe
chớp nhoáng không bao giờ thành recovery: điều kiện hỏng phải kéo dài qua ít nhất hai lần quan sát.
Một release không phải release này và cũng không phải release nó thay thế sẽ dừng lượt chạy bằng
`CONCURRENT_DRIFT` và buộc lập kế hoạch lại; nó không bao giờ được recover hay rollback như thể nó
thuộc về đây. Recovery chỉ lặp lại những hành động đảo ngược được đã duyệt, đánh số các lần thử liền
mạch từ một, giữ nguyên danh tính release, và một khi đã cạn thì không thể kết thúc bằng một lần
deploy. Rollback chỉ hợp lệ khi release an toàn chính xác vẫn còn, trạng thái dữ liệu và schema hiện
tại vẫn tương thích với nó, và revision thực sự đã dịch chuyển.

## Trạng thái ổn định là được chứng minh, không phải được giả định

Một rollout trả về không lỗi chưa phải một lần deploy. Ổn định nghĩa là digest bất biến đang active,
mọi target đã khai đều sẵn sàng, không target bị thay thế nào còn active trừ khi chiến lược cho phép,
cửa sổ đã trôi qua trọn vẹn, và mọi probe đã khai đều pass suốt cửa sổ đó. Đó là thứ biến ba lỗi
im lặng thành ba lỗi phát hiện được: workflow chạy xong trong khi digest cũ vẫn đang phục vụ traffic;
một trong hai target không bao giờ quay lại còn cái kia gánh hết tải; probe readiness pass đúng một
lần, đúng khoảnh khắc nó tình cờ được hỏi. Ít nhất một probe đã khai phải là probe công khai, vì một
lượt chạy chỉ quan sát sức khoẻ container thì chẳng chứng minh được gì mà người dùng thấy được; ở đây
probe GraphQL typename trả `200` là tín hiệu readiness.

## Hai fallback có thứ tự, phần còn lại thì terminate

Một rollout hỏng không phải là hết lượt, nó là cửa vào fallback thứ nhất: `ROLLOUT_FAILED` đi nhánh
phục hồi, nhánh chỉ lặp lại những hành động đảo ngược được đã duyệt trên cùng danh tính release. Khi
chúng cạn, `RECOVERY_EXHAUSTED` đi fallback thứ hai: rollback về `rollbackIdentity` theo đúng digest
của nó. Cả hai đều được ghi dưới `## Fallbacks taken`, vì một nhánh đi âm thầm là một nhánh không ai
soát lại được. Sau đó không còn gì để thử nữa, nên `ROLLBACK_IDENTITY_MISSING`, `STEADY_STATE_UNPROVEN`
và `CONCURRENT_DRIFT` terminate: một lần rollback không còn release an toàn, một cửa sổ không bao giờ
khép, và một release lạ xuất hiện giữa lượt, mỗi thứ đều là trạng thái operator này không được hành
động tiếp lên.

## Deadline và probe có mặc định, phê duyệt thì không

`steadyDeadline` mặc định 600 giây vì đó là thời gian boot mà dự án này thực sự cho thấy, còn `probes`
mặc định lấy bộ mà manifest đã kiểm khai ra, nên người không nêu cái nào vẫn được đo theo một thứ có
thật. `approval` thì hoàn toàn không có mặc định: đổi thứ mà production đang phục vụ luôn là việc có
người nói đồng ý.

## Luồng attempt cụ thể

Các row của operator này được gate bởi hợp đồng attempt expected/actual dùng chung trong `scripts/attempt-gate.mjs`.

| Trạng thái quan sát | Hành động | Kiểm actual | Nhánh kế tiếp |
| --- | --- | --- | --- |
| exact digest active và probe pass full window | tái dùng; không rollout | so digest, manifest, domain, schema, probe | phát idempotent receipt |
| target trống | tạo host/artifact/domain đã khai bằng compare-and-set | đọc mọi revision và steady probe | phát sau required match |
| valid release khác | update frozen digest giữ rollback identity | xác minh compatibility, domain, digest, probe | bounded recovery cùng release rồi exact rollback |
| state/effect không chắc hoặc concurrent drift | không lặp/đoán phá hủy | ghi before/after revision và foreign drift | typed replan/block; identity mới cần reconfirm expected |

## Ranh giới ghi

Context chỉ đọc, trừ các mutation đã khai. Operator chỉ áp các mutation host, migration, domain và
rollout đã khai lên đúng danh tính release đã đóng băng, khôi phục đúng release rollback đã khai khi
đi nhánh đó, và chỉ ghi `response/` của nhánh mình: `response.json`, `data/probes.json` và
`response.md`. Nó không release một plan migration source; không log, lưu, in ra hay trả về một giá
trị credential đã phân giải; không deploy
một release mà thẩm quyền đã khai không phủ; không build lại, gắn tag lại hay thay đổi artifact bất
biến mà digest đóng băng chỉ tới; không sửa intent hay kiểm lại manifest thành một thứ khác; không
recover hay rollback một release xuất hiện giữa lượt và không thuộc về lượt này; không báo một lượt đã
rollback là đã giao thành công cái release bị từ chối; và không tuyên bố trạng thái ổn định từ một lần
quan sát probe duy nhất hay từ một rollout được giả định.

## Context

| Alias | Bind | Bắt buộc |
| --- | --- | --- |
| `@remote/ghcr/<image>` | image bất biến theo digest | có |
| `@workspaces/device-state` | handle credential theo tên và custody của chúng; giá trị không bao giờ xuất hiện | có |
| `@remote/github-actions/<runId>` | bằng chứng CI của build và rollout, chỉ đọc | không |
| `@worktrees/unchecked/<product>` | phần chưa kiểm của tính năng đang được release: cái nào còn mở, và có cái nào nằm bên trong hành trình hay không | không |

## Đầu vào

| Kind | Từ đâu | Bắt buộc |
| --- | --- | --- |
| `quality-verification` | `quality.verify`; verification đạt ở source commit của release | có |
| `migration-release` | `migration.release`; schema mà image phụ thuộc, đã áp lên target, khi release cần một cái | không |

## Yêu cầu

| Field | Kiểu | Mặc định | Hỏi |
| --- | --- | --- | --- |
| `release` | id | — | Danh tính release bất biến đang được deploy, kèm digest `sha256:` nhận diện nó |
| `target` | id | — | Đúng một target mà lần deploy này được đổi, cùng môi trường nó nằm trong |
| `approval` | id | — | Grant deploy đã khai phủ project, môi trường và target này; đổi thứ production đang phục vụ luôn cần một con người |
| `probes` | list of `{probeId, kind, endpointRef, expectStatus}` | the probes the validated manifest declares | Trạng thái ổn định được đo bằng gì; ít nhất một probe là công khai |
| `steadyDeadline` | number | 600 | Deadline giám sát có chặn trên, tính bằng giây, đo theo thời gian boot mà dự án này cho thấy |
| `rollbackIdentity` | `{releaseId, artifactRef, digest, dataCompatible}` | — | Đúng release an toàn mà fallback rollback khôi phục, theo digest |
| `feature` | id | null | Tính năng mà release này giao, để sổ cái phủ của nó được đọc trước khi production bị đổi; một release không giao tính năng nào thì không gọi tên tính năng nào |
| `resume` | token | null | Token của nhánh bị chặn khi vào lại sau một mã dừng |

## Các bước

| # | Bước | Tham số | Đọc | Ghi | Dừng với |
| --- | --- | --- | --- | --- | --- |
| 1 | Kiểm cổng vào, thẩm quyền mà Đầu vào mang, và resume | `resume` | `request/request.json`, Đầu vào `quality-verification` là thẩm quyền lượt chạy này đứng lên | — | `INVALID_INPUT`, `AUTHORIZATION_MISSING`, `NO_PROGRESS` |
| 2 | Bind immutable release và inspect artifact, host, active digest, schema, domain, target revision, phân loại reusable, missing, invalid hoặc foreign trước effect | `release`, `target`, `approval`, `feature` | @remote/ghcr/<image> tại digest đã đóng băng, @remote/github-actions/<runId> cho trạng thái quan sát được, đầu vào `migration-release` cho schema mà image phụ thuộc khi đã release một cái, @worktrees/unchecked/<product> cho phần chưa kiểm còn mở của tính năng, @tools/git, @tools/ci | — | `MANIFEST_INVALID`, `APPROVAL_REQUIRED`, `UNCHECKED_OPEN` |
| 3 | Khởi tạo execution root và phân giải credential theo tên | — | @workspaces/device-state cho các handle đã khai và custody của chúng, @tools/secrets | — | `CREDENTIAL_UNAVAILABLE` |
| 4 | Tái dùng host, artifact, domain state khớp; tạo declared state thiếu hoặc chỉ update declared state sai bằng compare-and-set revision | — | @remote/ghcr/<image> cho artifact theo digest, @remote/github-actions/<runId> cho revision trước và sau của từng boundary | @tools/shell | `HOST_UNAVAILABLE`, `ARTIFACT_MISSING`, `MIGRATION_BLOCKED`, `DOMAIN_UNRECONCILED` |
| 5 | Roll out | — | @remote/ghcr/<image> cho revision của target trước và sau | @tools/container | `ROLLOUT_FAILED` |
| 6 | Theo dõi trong deadline, có backoff | `steadyDeadline`, `probes` | @remote/github-actions/<runId> cho các quan sát probe suốt cửa sổ, @tools/http | `response/data/probes.json` | — |
| 7 | Phát hiện drift đồng thời trước khi hành động | — | `response/data/probes.json`, @remote/ghcr/<image> cho release đang active theo digest | — | `CONCURRENT_DRIFT` |
| 8 | Chỉ làm recovery thuận nghịch có giới hạn cho cùng release identity, ghi từng observation và effect; không lặp mutation chưa chắc | — | `response/data/probes.json`, @remote/ghcr/<image> tại cùng danh tính release | @tools/container | `RECOVERY_EXHAUSTED` |
| 9 | Đi nhánh rollback khi phục hồi không giữ được | `rollbackIdentity` | @remote/ghcr/<image> tại đúng digest an toàn | @tools/container | `ROLLBACK_IDENTITY_MISSING` |
| 10 | Chứng minh trạng thái ổn định, viết biên bản và phát | — | mọi thứ ở trên | `response/response.md`, `response/response.json` | `STEADY_STATE_UNPROVEN` |

Bước 8 và 9 là hai fallback theo thứ tự, không phải một chuỗi mà lượt chạy nào cũng đi qua: một lượt
chỉ vào bước 8 dưới `ROLLOUT_FAILED` và chỉ vào bước 9 dưới `RECOVERY_EXHAUSTED`, còn lượt không đi
cái nào thì ghi nhánh là `none`. Một lần resume bắt đầu lại từ cổng vào, chỉ dùng lại quan sát có
fingerprint không đổi, và giữ nguyên danh tính release, vì một release khác là một lần deploy khác;
một lần resume không thêm thẩm quyền, manifest, credential hay quan sát nào là `NO_PROGRESS`.

## Đầu ra

| Kind | File | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| `release-deployment` | `response/response.md` | md | có |
| `probes` | `response/data/probes.json` | data | có |

## Kết quả tốt nhất

Khi `done`, in **Kết quả tốt nhất** là địa chỉ hoặc định danh release đã deploy trong `response/response.md`, sau đó là các dòng health và readiness từ `response/data/probes.json`. Probe fail phải hiện trung thực deployed state và observation đang fail, không quảng bá release là khỏe.

## Dừng

| Code | Xử lý |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `NO_PROGRESS` | terminate |
| `AUTHORIZATION_MISSING` | terminate |
| `MANIFEST_INVALID` | terminate |
| `UNCHECKED_OPEN` | terminate |
| `APPROVAL_REQUIRED` | terminate |
| `CREDENTIAL_UNAVAILABLE` | terminate |
| `HOST_UNAVAILABLE` | terminate |
| `ARTIFACT_MISSING` | terminate |
| `MIGRATION_BLOCKED` | terminate |
| `DOMAIN_UNRECONCILED` | terminate |
| `ROLLOUT_FAILED` | fallback |
| `RECOVERY_EXHAUSTED` | fallback |
| `CONCURRENT_DRIFT` | terminate |
| `ROLLBACK_IDENTITY_MISSING` | terminate |
| `STEADY_STATE_UNPROVEN` | terminate |

## Kế tiếp

| Khi | Operator |
| --- | --- |
| host, registry artifact hay release an toàn cần runtime dùng chung được phục vụ hay dừng trước | `runtime.serve` |
| schema của target phải dịch chuyển trước khi image này roll out được | `migration.release` |
