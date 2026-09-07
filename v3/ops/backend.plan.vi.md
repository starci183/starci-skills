# backend.plan

Bản đối chiếu cho người đọc; bản tiếng Anh là thẩm quyền runtime.

Đọc đầy đủ [giao thức chung](common.md) và tài liệu này trước khi làm.

## Mục tiêu cụ thể

Chia operation backend thành piece implement độc lập và dependency rõ.

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

## Tham chiếu chuyên môn có điều kiện

| Nguồn | Khi nào đọc |
| --- | --- |
| [knowledge/patterns/be/INDEX.md](../../knowledge/patterns/be/INDEX.md) | Chỉ khi backend đã chọn thật sự dùng họ NestJS được mô tả; inspect code hiện tại trước áp dụng topic. Chỉ dùng index cho pattern code áp dụng. |

## Ghi gì vào đâu

| ID | Nơi ghi | Trường / section | Nội dung bắt buộc |
| --- | --- | --- | --- |
| node | .work/<business>/implementation/backend/<piece>/node.md | body: Goal / Operations / Write ceiling / Protected paths / Contracts / Tests / Done when; dependsOn; refs; assertions; state; required | Tạo/sửa lá implementation todo; mỗi operation có một piece owner chính. Mỗi piece ghi repo/path/symbol, store, lệnh test nguồn, AC IDs, dependency. Plan không làm các lá implementation done. Chỉ sửa graph thuộc scope được chọn rõ đã duyệt: prerequisite node IDs thật ở dependsOn, input ngữ nghĩa node/resource IDs ở refs. Không chain toàn catalogue hoặc scope khác; chốt graph/spec trước proof review. |
| evidence | E/manifest.yaml + E/partition-review.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Ghi review coverage, ownership không chồng và dependencies cho node planning đã chọn. |

## Thứ tự thực hiện hữu hạn

| # | Đọc ID | Ghi ID | Thực hiện và kiểm tra |
| --- | --- | --- | --- |
| 1 | target, architecture, business, repo | node | Liệt kê operation và boundary writer/store thật. Gom thay đổi gắn kết theo outcome và commit an toàn, không ép số file. |
| 2 | architecture, repo | node | Giao ceiling source đầy đủ, protected paths, migration, wiring caller; kèm test transport/validation/quyền/transaction/read-back khi áp dụng. |
| 3 | architecture, business, target | node | Khai dependency rõ, xác định shared-owner work và piece đủ song song. Plan không tự spawn hay implement. |
| 4 | architecture, business, repo, target | evidence | Kiểm operation được giao một lần, không overlap chưa xử lý, mỗi piece review/test được. Chỉ kết thúc node planning. |

## Proof và điều kiện hoàn thành

| ID | Điều phải chứng minh |
| --- | --- |
| binding | Chạy validate workspace; ID/path trích dẫn tồn tại hoặc ghi rõ dự kiến, đủ assertions bắt buộc, binding còn mới; not-run/fail không được done. |
| partition | Đủ operation được chọn và graph dependencies resolve được; lá implementation vẫn chưa xong. |

Chỉ ghi completion theo core schema sau khi proof thật đạt. Ghi spec trước khi lấy inputDigest; fail/not-run/inconclusive không thành done. Artifact bổ sung phải được liệt kê trong manifest assets và hash bytes thật.

## Tác động và giới hạn

Chỉ metadata/evidence thuộc scope được giao; không mutation product hoặc dịch vụ ngoài.

Danh sách trên mô tả capability, không cấp quyền mới. Chỉ thực hiện effect trong ma trận op này và quyền hiện tại; không ghi ngoài ma trận, tự chạy op tiếp hay tự thêm agent/account/deploy/publish/cleanup chưa chọn. Effect đã được người dùng cho phép đúng phạm vi không cần xin lại chỉ vì đổi op.

## Blocker và điểm dừng

| Code | Điều kiện / thông tin cần |
| --- | --- |
| PARTITION_CONFLICT | Không chia writer/store được nếu chưa mở lại quyết định kiến trúc. |
| DECLARED_DEPENDENCY_UNMET | Prerequisite đã khai chưa effective done hoặc thiếu input/scope bắt buộc đã khai. Báo ID node/resource và đề xuất cập nhật graph được chọn riêng khi cần; không chạy predecessor hoặc nới dependsOn/refs/required để tiếp tục. |

Thêm các blocker chung trong common.md khi áp dụng. Ghi đúng quan sát và gap owner; không bịa input để tiếp tục. Kết thúc với kết quả/phạm vi/commit/evidence/gap rồi dừng. Op gợi ý tiếp theo không tự thực thi.

## Resolve placeholder

N/E/R theo common.md. Không ghi literal placeholder; path mới phải ghi rõ dự kiến.

| Placeholder | Nguồn giá trị |
| --- | --- |
| <business> | Selected business slug / slug nghiệp vụ đã chọn |
| <repo-id> | Resolved repository resource ID / resource ID repo đã resolve |
| <bound-paths> | Inspected source read set / tập file nguồn cần đọc |
| <piece> | Stable selected piece slug / slug piece đã chọn |
