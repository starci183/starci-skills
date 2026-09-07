# data.plan

Bản đối chiếu cho người đọc; bản tiếng Anh là thẩm quyền runtime.

Đọc đầy đủ [giao thức chung](common.md) và tài liệu này trước khi làm.

## Mục tiêu cụ thể

Định nghĩa fixture quy thuộc được, precondition và cleanup an toàn chính xác cho test đã chọn.

Kind/profile: `architecture`. Chọn node cụ thể từ request hiện tại; không tự chạy toàn cây.

## Graph trong .work, không nằm trong op

Op này chỉ được khai/sửa graph thuộc scope đang được chọn rõ: dependsOn là node prerequisite cần done; refs là input ngữ nghĩa không tự chặn thực thi. Ghi quan hệ thật vào .work trước review; không tạo chain bắt buộc cho mọi business.

## Đầu vào phải đọc và nguồn thẩm quyền

| ID | Đọc ở đâu | Đọc gì / vì sao |
| --- | --- | --- |
| target | N/node.md | Đọc node đích, scope cha, refs, dependencies, assertions và freshness. Với target mới được yêu cầu, chưa tồn tại là đúng: đọc ancestor/workspace gần nhất rồi chỉ tạo scope đã chọn. Giữ phần chấp nhận không bị ảnh hưởng. |
| business | .work/<business>/business/**/node.md | Đọc requirement/quyết định/ràng buộc/AC được khai là input liên quan trong graph .work đã chọn. Ý định quyết định expected, source không thay nghiệp vụ. Không bịa predecessor BA bắt buộc cho scope không cần; input cần mà thiếu là gap graph/scope phải báo, không tự thêm dependency. |
| architecture | .work/<business>/architecture/**/node.md | Đọc ownership dữ liệu, operation/API/event, boundary/code-scope/lý do được graph .work đã chọn khai; tách file dự kiến với file thật. Không mặc định chain mọi op phải architecture trước; thiếu scope thật sự bắt buộc thì báo trước khi tiếp tục. |
| repo | repository:<repo-id>/<bound-paths> | Khi có/chọn source, resolve resource repo, checkout/root/HEAD/dirty thật; đọc hướng dẫn, manifest, code owner, caller, test. Greenfield/spec-only ghi source chưa tạo, lấy ý định từ yêu cầu; không bịa repo/trích dẫn fact. Implement source vẫn cần repo thật được chọn và được ghi. |
| environment | .work/_resources/environments/<environment>/resource.yaml | Đọc target/origin chính xác, owner, revision cấu hình, probe và tác động được phép; đối chiếu runtime thật, không suy danh tính từ hostname. |
| cases | .work/<business>/uat/<flow>/**/node.md | Đọc expected outcome và state đầu của test đã chọn để tách prerequisite với outcome test phải tự tạo. |

## Ghi gì vào đâu

| ID | Nơi ghi | Trường / section | Nội dung bắt buộc |
| --- | --- | --- | --- |
| node | N/node.md | body: Fixture purpose / Preconditions / Isolation / Placement / Verification / Cleanup; refs; dependsOn; assertions; required | Ghi volume/lớp content đại diện được yêu cầu, owner, luật namespace chính xác, initial state, giới hạn an toàn; plan không đặt record. Chỉ sửa graph thuộc scope được chọn rõ đã duyệt: prerequisite node IDs thật ở dependsOn, input ngữ nghĩa node/resource IDs ở refs. Không chain toàn catalogue hoặc scope khác; chốt graph/spec trước proof review. |
| resource | .work/_resources/fixtures/<resource>/resource.yaml | id; kind; owner; revision; details.environment; details.namespace; details.actor; details.inputs; details.targets; details.expected; details.placement; details.cleanup; details.owner | Khai ref tới bytes/script fixture có revision, entity/API đích, natural key/ID, ownership predicate, tập update/delete cho phép, cleanup owner. Chỉ field có nguồn schema. |
| evidence | E/manifest.yaml + E/fixture-plan-review.json | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Giữ đối chiếu schema/namespace/AC chứng minh không seed outcome đang test và tập xóa quy thuộc được. |

## Thứ tự thực hiện hữu hạn

| # | Đọc ID | Ghi ID | Thực hiện và kiểm tra |
| --- | --- | --- | --- |
| 1 | cases, business, repo, architecture | node | Xác định record ban đầu/lớp volume assertion cần, inspect schema thật và API tạo product bình thường. |
| 2 | repo, environment, cases | resource | Giao namespace tách biệt, ownership predicate ổn định, cách create/update. Không đổi schema chỉ để dễ cleanup; thiếu attribution là blocker thiết kế. |
| 3 | cases, business, architecture | node, resource | Viết bytes fixture, thứ tự/dependency, read-back mong đợi, tập rollback/xóa. Row shared hiện có chỉ đọc nếu chưa được cho phép riêng. |
| 4 | target, repo, cases, environment | evidence | Review schema, tách expected/fixture, collision song song và an toàn cleanup subset. Kết thúc plan, không seed/provision. |

## Proof và điều kiện hoàn thành

| ID | Điều phải chứng minh |
| --- | --- |
| binding | Chạy validate workspace; ID/path trích dẫn tồn tại hoặc ghi rõ dự kiến, đủ assertions bắt buộc, binding còn mới; not-run/fail không được done. |
| fixture-plan | Input thỏa precondition nhưng không dựng kết quả đang test; owner dữ liệu và tập cleanup chứng minh được. |

Chỉ ghi completion theo core schema sau khi proof thật đạt. Ghi spec trước khi lấy inputDigest; fail/not-run/inconclusive không thành done. Artifact bổ sung phải được liệt kê trong manifest assets và hash bytes thật.

## Tác động và giới hạn

Chỉ metadata/evidence thuộc scope được giao; không mutation product hoặc dịch vụ ngoài.

Danh sách trên mô tả capability, không cấp quyền mới. Chỉ thực hiện effect trong ma trận op này và quyền hiện tại; không ghi ngoài ma trận, tự chạy op tiếp hay tự thêm agent/account/deploy/publish/cleanup chưa chọn. Effect đã được người dùng cho phép đúng phạm vi không cần xin lại chỉ vì đổi op.

## Blocker và điểm dừng

| Code | Điều kiện / thông tin cần |
| --- | --- |
| FIXTURE_UNATTRIBUTABLE | Không cách ly được row fixture hoặc không giới hạn cleanup an toàn. |
| DECLARED_DEPENDENCY_UNMET | Prerequisite đã khai chưa effective done hoặc thiếu input/scope bắt buộc đã khai. Báo ID node/resource và đề xuất cập nhật graph được chọn riêng khi cần; không chạy predecessor hoặc nới dependsOn/refs/required để tiếp tục. |

Thêm các blocker chung trong common.md khi áp dụng. Ghi đúng quan sát và gap owner; không bịa input để tiếp tục. Kết thúc với kết quả/phạm vi/commit/evidence/gap rồi dừng. Op gợi ý tiếp theo không tự thực thi.

## Resolve placeholder

N/E/R theo common.md. Không ghi literal placeholder; path mới phải ghi rõ dự kiến.

| Placeholder | Nguồn giá trị |
| --- | --- |
| <business> | Selected business slug / slug nghiệp vụ đã chọn |
| <repo-id> | Resolved repository resource ID / resource ID repo đã resolve |
| <bound-paths> | Inspected source read set / tập file nguồn cần đọc |
| <environment> | Resolved environment resource slug / slug environment đã resolve |
| <flow> | Selected UAT journey slug / slug journey UAT đã chọn |
| <resource> | Selected owned resource slug / slug resource thuộc quyền sửa |
