# uat.plan

Bản đối chiếu cho người đọc; bản tiếng Anh là thẩm quyền runtime.

Đọc đầy đủ [giao thức chung](common.md) và tài liệu này trước khi làm.

## Mục tiêu cụ thể

Viết case nghiệm thu chạy được cho journey đã chọn, chưa thực thi.

Kind/profile: `architecture`. Chọn node cụ thể từ request hiện tại; không tự chạy toàn cây.

## Graph trong .work, không nằm trong op

Op này chỉ được khai/sửa graph thuộc scope đang được chọn rõ: dependsOn là node prerequisite cần done; refs là input ngữ nghĩa không tự chặn thực thi. Ghi quan hệ thật vào .work trước review; không tạo chain bắt buộc cho mọi business.

## Đầu vào phải đọc và nguồn thẩm quyền

| ID | Đọc ở đâu | Đọc gì / vì sao |
| --- | --- | --- |
| target | N/node.md | Đọc node đích, scope cha, refs, dependencies, assertions và freshness. Với target mới được yêu cầu, chưa tồn tại là đúng: đọc ancestor/workspace gần nhất rồi chỉ tạo scope đã chọn. Giữ phần chấp nhận không bị ảnh hưởng. |
| business | .work/<business>/business/**/node.md | Đọc requirement/quyết định/ràng buộc/AC được khai là input liên quan trong graph .work đã chọn. Ý định quyết định expected, source không thay nghiệp vụ. Không bịa predecessor BA bắt buộc cho scope không cần; input cần mà thiếu là gap graph/scope phải báo, không tự thêm dependency. |
| repo | repository:<repo-id>/<bound-paths> | Khi có/chọn source, resolve resource repo, checkout/root/HEAD/dirty thật; đọc hướng dẫn, manifest, code owner, caller, test. Greenfield/spec-only ghi source chưa tạo, lấy ý định từ yêu cầu; không bịa repo/trích dẫn fact. Implement source vẫn cần repo thật được chọn và được ghi. |
| environment | .work/_resources/environments/<environment>/resource.yaml | Đọc target/origin chính xác, owner, revision cấu hình, probe và tác động được phép; đối chiếu runtime thật, không suy danh tính từ hostname. |
| resources | selected identity and fixture resources, when required | Đọc alias, chính sách cách ly và fixture hiện có, không provision. Anonymous/no-fixture hợp lệ khi đúng ngữ cảnh. |

## Ghi gì vào đâu

| ID | Nơi ghi | Trường / section | Nội dung bắt buộc |
| --- | --- | --- | --- |
| node | .work/<business>/uat/<flow>/node.md + ui/<screen>/node.md + ux/<piece>/node.md | body: Flow / Actor / Preconditions / Case steps / Expected / Proof / Cleanup / Isolation; refs; dependsOn; assertions; required; state | Cha flow ghi mục đích/precondition chung. Lá UI ghi screen/state, viewport/theme, tiêu chí appearance. Lá UX ghi case/AC, actor/fixture, action có thứ tự, expected output/state, persistence/denial proof, cleanup owner. Lá dự kiến vẫn todo. Chỉ sửa graph thuộc scope được chọn rõ đã duyệt: prerequisite node IDs thật ở dependsOn, input ngữ nghĩa node/resource IDs ở refs. Không chain toàn catalogue hoặc scope khác; chốt graph/spec trước proof review. |
| evidence | E/manifest.yaml + E/case-coverage.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Ghi review AC coverage, an toàn/cách ly; không tạo run result cho case chưa chạy. |

## Thứ tự thực hiện hữu hạn

| # | Đọc ID | Ghi ID | Thực hiện và kiểm tra |
| --- | --- | --- | --- |
| 1 | business, target, repo | node | Liệt kê journey actor từ AC, gồm happy/invalid/denied/gián đoạn/reload khi áp dụng. Tách expected assertion với cách tìm locator dự kiến. |
| 2 | repo, environment, resources | node | Resolve route entry thật, API/read-back có tài liệu; ghi environment/actor/fixture IDs, precondition, effect được phép. Không bịa account/control. |
| 3 | business, resources, target | node | Viết case trước khi chạy: input/action/feedback mong đợi/postcondition lưu/negative/evidence instrument. Expected độc lập hành vi code hiện tại. |
| 4 | resources, environment, target | node | Ghi namespace/session isolation, cleanup owner và tập rollback được phép. Chỉ đánh dấu flow song song sau kiểm shared write; plan không spawn. |
| 5 | business, target, repo, resources, environment | evidence | Review AC trong scope có case hoặc defer thật đã chấp nhận, mỗi case reproduce được từ prerequisite. Dừng sau plan. |

## Proof và điều kiện hoàn thành

| ID | Điều phải chứng minh |
| --- | --- |
| binding | Chạy validate workspace; ID/path trích dẫn tồn tại hoặc ghi rõ dự kiến, đủ assertions bắt buộc, binding còn mới; not-run/fail không được done. |
| cases | Mỗi case có ID assertion ổn định, expected quan sát cụ thể và nguồn proof; không pass case chưa chạy. |

Chỉ ghi completion theo core schema sau khi proof thật đạt. Ghi spec trước khi lấy inputDigest; fail/not-run/inconclusive không thành done. Artifact bổ sung phải được liệt kê trong manifest assets và hash bytes thật.

## Tác động và giới hạn

Chỉ metadata/evidence thuộc scope được giao; không mutation product hoặc dịch vụ ngoài.

Danh sách trên mô tả capability, không cấp quyền mới. Chỉ thực hiện effect trong ma trận op này và quyền hiện tại; không ghi ngoài ma trận, tự chạy op tiếp hay tự thêm agent/account/deploy/publish/cleanup chưa chọn. Effect đã được người dùng cho phép đúng phạm vi không cần xin lại chỉ vì đổi op.

## Blocker và điểm dừng

| Code | Điều kiện / thông tin cần |
| --- | --- |
| FLOW_UNDEFINED | Journey trong scope thiếu entry/actor/expected hoặc owner prerequisite có nguồn. |
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
| <screen> | Selected surface/state slug / slug screen-state đã chọn |
| <piece> | Stable selected piece slug / slug piece đã chọn |
