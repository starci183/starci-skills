# interface.plan

Bản đối chiếu cho người đọc; bản tiếng Anh là thẩm quyền runtime.

Đọc đầy đủ [giao thức chung](common.md) và tài liệu này trước khi làm.

## Mục tiêu cụ thể

Định nghĩa surface FE, shell chung và interaction/state contract trước khi code.

Kind/profile: `architecture`. Chọn node cụ thể từ request hiện tại; không tự chạy toàn cây.

## Graph trong .work, không nằm trong op

Op này chỉ được khai/sửa graph thuộc scope đang được chọn rõ: dependsOn là node prerequisite cần done; refs là input ngữ nghĩa không tự chặn thực thi. Ghi quan hệ thật vào .work trước review; không tạo chain bắt buộc cho mọi business.

## Đầu vào phải đọc và nguồn thẩm quyền

| ID | Đọc ở đâu | Đọc gì / vì sao |
| --- | --- | --- |
| target | N/node.md | Đọc node đích, scope cha, refs, dependencies, assertions và freshness. Với target mới được yêu cầu, chưa tồn tại là đúng: đọc ancestor/workspace gần nhất rồi chỉ tạo scope đã chọn. Giữ phần chấp nhận không bị ảnh hưởng. |
| business | .work/<business>/business/**/node.md | Đọc requirement/quyết định/ràng buộc/AC được khai là input liên quan trong graph .work đã chọn. Ý định quyết định expected, source không thay nghiệp vụ. Không bịa predecessor BA bắt buộc cho scope không cần; input cần mà thiếu là gap graph/scope phải báo, không tự thêm dependency. |
| repo | repository:<repo-id>/<bound-paths> | Khi có/chọn source, resolve resource repo, checkout/root/HEAD/dirty thật; đọc hướng dẫn, manifest, code owner, caller, test. Greenfield/spec-only ghi source chưa tạo, lấy ý định từ yêu cầu; không bịa repo/trích dẫn fact. Implement source vẫn cần repo thật được chọn và được ghi. |
| design | .work/_resources/design/<resource>/resource.yaml + selected supplied references | Đọc design-system package/token/component thật, brand constraint và reference được cung cấp. Hình thức reference không cho phép bịa copy/dữ liệu nghiệp vụ. |

## Tham chiếu chuyên môn có điều kiện

| Nguồn | Khi nào đọc |
| --- | --- |
| [knowledge/patterns/fe/INDEX.md](../../knowledge/patterns/fe/INDEX.md) | Chỉ khi FE/thư viện chọn thật sự dùng họ này; giữ convention repo hiện tại nếu khác. |
| [knowledge/ui/composition/INDEX.md](../../knowledge/ui/composition/INDEX.md) | Chỉ đọc topic composition khớp family/scope; không import component Grammar không có hoặc yêu cầu receipt không liên quan. |

## Ghi gì vào đâu

| ID | Nơi ghi | Trường / section | Nội dung bắt buộc |
| --- | --- | --- | --- |
| node | .work/<business>/architecture/interface/<piece>/node.md + selected implementation/frontend/<piece>/node.md + explicitly selected audit/quality child directories/node.md | body: Surface map / Shared shell / Interaction states / Data contracts / Accessibility / Source scope / Acceptance; refs; dependsOn; assertions; required | Mỗi surface: ID ổn định, route/host, actor/task, owner shell, entry/exit, read/write, loading/empty/error/denied/success, viewport/keyboard, source path, AC refs. Con implementation vẫn todo. Nếu request hiện tại chọn preset có audit/quality/review portfolio sau đó, khai chính xác target consumer và assertion mong đợi ngay, todo, trong graph đã duyệt. Không tạo scope review chỉ vì op plan chạy; consumer sau không bịa target thiếu. Chỉ sửa graph thuộc scope được chọn rõ đã duyệt: prerequisite node IDs thật ở dependsOn, input ngữ nghĩa node/resource IDs ở refs. Không chain toàn catalogue hoặc scope khác; chốt graph/spec trước proof review. |
| evidence | E/manifest.yaml + E/surface-review.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Ghi route/screen tìm thấy, tách accepted/proposed, scope bỏ kèm lý do và review mapping. |

## Thứ tự thực hiện hữu hạn

| # | Đọc ID | Ghi ID | Thực hiện và kiểm tra |
| --- | --- | --- | --- |
| 1 | business, repo, target | node | Inspect route/layout/component/modal host/client API thật; phân biệt surface hiện có và dự kiến. |
| 2 | business, design | node | Giao navigation/shell chung một nơi; không có shell là hợp lệ nếu đúng ngữ cảnh. Map goal/action/feedback actor; giữ lựa chọn design đã chấp nhận. |
| 3 | business, repo, design | node | Viết state/transition từng surface, contract BE/dependency, focus/error/recovery, responsive/accessibility. Không bịa endpoint/selector. |
| 4 | target, business, repo, design | evidence | Kiểm outcome/route trong scope được map, ownership không chồng, test/visual coverage có nơi ghi. Kết thúc plan, không generate. |

## Proof và điều kiện hoàn thành

| ID | Điều phải chứng minh |
| --- | --- |
| binding | Chạy validate workspace; ID/path trích dẫn tồn tại hoặc ghi rõ dự kiến, đủ assertions bắt buộc, binding còn mới; not-run/fail không được done. |
| surfaces | Mỗi surface có actor/task, route thật/dự kiến, state coverage và nơi implementation/UAT. |

Chỉ ghi completion theo core schema sau khi proof thật đạt. Ghi spec trước khi lấy inputDigest; fail/not-run/inconclusive không thành done. Artifact bổ sung phải được liệt kê trong manifest assets và hash bytes thật.

## Tác động và giới hạn

Chỉ metadata/evidence thuộc scope được giao; không mutation product hoặc dịch vụ ngoài.

Danh sách trên mô tả capability, không cấp quyền mới. Chỉ thực hiện effect trong ma trận op này và quyền hiện tại; không ghi ngoài ma trận, tự chạy op tiếp hay tự thêm agent/account/deploy/publish/cleanup chưa chọn. Effect đã được người dùng cho phép đúng phạm vi không cần xin lại chỉ vì đổi op.

## Blocker và điểm dừng

| Code | Điều kiện / thông tin cần |
| --- | --- |
| SURFACE_UNKNOWN | Entry/action contract/owner shell bắt buộc không có nguồn. |
| DECLARED_DEPENDENCY_UNMET | Prerequisite đã khai chưa effective done hoặc thiếu input/scope bắt buộc đã khai. Báo ID node/resource và đề xuất cập nhật graph được chọn riêng khi cần; không chạy predecessor hoặc nới dependsOn/refs/required để tiếp tục. |

Thêm các blocker chung trong common.md khi áp dụng. Ghi đúng quan sát và gap owner; không bịa input để tiếp tục. Kết thúc với kết quả/phạm vi/commit/evidence/gap rồi dừng. Op gợi ý tiếp theo không tự thực thi.

## Resolve placeholder

N/E/R theo common.md. Không ghi literal placeholder; path mới phải ghi rõ dự kiến.

| Placeholder | Nguồn giá trị |
| --- | --- |
| <business> | Selected business slug / slug nghiệp vụ đã chọn |
| <repo-id> | Resolved repository resource ID / resource ID repo đã resolve |
| <bound-paths> | Inspected source read set / tập file nguồn cần đọc |
| <resource> | Selected owned resource slug / slug resource thuộc quyền sửa |
| <piece> | Stable selected piece slug / slug piece đã chọn |
