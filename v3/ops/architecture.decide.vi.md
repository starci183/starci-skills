# architecture.decide

Bản đối chiếu cho người đọc; bản tiếng Anh là thẩm quyền runtime.

Đọc đầy đủ [giao thức chung](common.md) và tài liệu này trước khi làm.

## Mục tiêu cụ thể

Quyết định thiết kế hữu hạn có ownership repo thật, contract và code-scope implement được.

Kind/profile: `architecture`. Chọn node cụ thể từ request hiện tại; không tự chạy toàn cây.

## Graph trong .work, không nằm trong op

Op này chỉ được khai/sửa graph thuộc scope đang được chọn rõ: dependsOn là node prerequisite cần done; refs là input ngữ nghĩa không tự chặn thực thi. Ghi quan hệ thật vào .work trước review; không tạo chain bắt buộc cho mọi business.

## Đầu vào phải đọc và nguồn thẩm quyền

| ID | Đọc ở đâu | Đọc gì / vì sao |
| --- | --- | --- |
| target | N/node.md | Đọc node đích, scope cha, refs, dependencies, assertions và freshness. Với target mới được yêu cầu, chưa tồn tại là đúng: đọc ancestor/workspace gần nhất rồi chỉ tạo scope đã chọn. Giữ phần chấp nhận không bị ảnh hưởng. |
| business | .work/<business>/business/**/node.md | Đọc requirement/quyết định/ràng buộc/AC được khai là input liên quan trong graph .work đã chọn. Ý định quyết định expected, source không thay nghiệp vụ. Không bịa predecessor BA bắt buộc cho scope không cần; input cần mà thiếu là gap graph/scope phải báo, không tự thêm dependency. |
| repo | repository:<repo-id>/<bound-paths> | Khi có/chọn source, resolve resource repo, checkout/root/HEAD/dirty thật; đọc hướng dẫn, manifest, code owner, caller, test. Greenfield/spec-only ghi source chưa tạo, lấy ý định từ yêu cầu; không bịa repo/trích dẫn fact. Implement source vẫn cần repo thật được chọn và được ghi. |
| constraints | selected resource contracts + actual package/deployment manifests | Đọc version, topology deploy và ràng buộc dữ liệu thật; claim compatibility cần nguồn/tài liệu/thử nghiệm, không dựa trí nhớ. |

## Tham chiếu chuyên môn có điều kiện

| Nguồn | Khi nào đọc |
| --- | --- |
| [knowledge/patterns/be/INDEX.md](../../knowledge/patterns/be/INDEX.md) | Chỉ khi backend đã chọn thật sự dùng họ NestJS được mô tả; inspect code hiện tại trước áp dụng topic. Chỉ dùng index cho pattern code áp dụng. |

## Ghi gì vào đâu

| ID | Nơi ghi | Trường / section | Nội dung bắt buộc |
| --- | --- | --- | --- |
| node | .work/<business>/architecture/<piece>/node.md | body: Observed system / Decision / Alternatives / Data ownership / Operations / API & events / Failure modes / Code scope / Verification / Open risks; refs; dependsOn; assertions; required | Mỗi operation ghi caller, owner/writer, transport, request/response/error, authorization, store, transaction, idempotency/concurrency, thứ tự event, migration, AC IDs. Code-scope có repo ID, path thật/dự kiến, symbol/module, create/modify/delete, trách nhiệm, caller, protected paths, test, prerequisite. Chỉ sửa graph thuộc scope được chọn rõ đã duyệt: prerequisite node IDs thật ở dependsOn, input ngữ nghĩa node/resource IDs ở refs. Không chain toàn catalogue hoặc scope khác; chốt graph/spec trước proof review. |
| evidence | E/manifest.yaml + E/source-map.json + E/design-review.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Ghi source map thật và check compatibility; review thiết kế/rủi ro không phải runtime pass. |

## Thứ tự thực hiện hữu hạn

| # | Đọc ID | Ghi ID | Thực hiện và kiểm tra |
| --- | --- | --- | --- |
| 1 | repo, constraints, target | evidence | Inspect entrypoint, dependency graph, composition/DI, persistence và deployment trước khi đề xuất boundary. Ghi unknown và file thật sự có/không. |
| 2 | business, constraints, repo | node | Map mỗi outcome sang owner enforce, mỗi store sang writer thẩm quyền; nêu consumer chỉ đọc, tenant isolation và shared write được phép. |
| 3 | business, constraints | node | Chọn thiết kế nhỏ nhất đạt ràng buộc cứng; so phương án khác cơ chế khi cần. Ghi trade-off, compatibility, rollout/migration, giới hạn rollback và failure vận hành. |
| 4 | business, repo, constraints | node | Viết contract API/event cùng transaction/retry/concurrency của từng mutation. Danh sách framework không phải kiến trúc; writer/ownership dữ liệu mơ hồ là blocker. |
| 5 | repo, business | node | Resolve path/symbol cụ thể, wiring caller, test, protected boundary. File mới vẫn là dự kiến tới khi tạo; không claim module đoán đã tồn tại. |
| 6 | target, business, repo, constraints | evidence | Review AC coverage, mâu thuẫn ownership, adverse path, compatibility proof. Chỉ review độc lập qua delegation được phép khi yêu cầu; còn lại ghi self-review thật. Dừng sau kết quả thiết kế. |

## Proof và điều kiện hoàn thành

| ID | Điều phải chứng minh |
| --- | --- |
| binding | Chạy validate workspace; ID/path trích dẫn tồn tại hoặc ghi rõ dự kiến, đủ assertions bắt buộc, binding còn mới; not-run/fail không được done. |
| implementability | Mỗi operation có owner, repo/path thật hoặc dự kiến và cách test; outcome bắt buộc map sang contract. Không claim đã implement. |

Chỉ ghi completion theo core schema sau khi proof thật đạt. Ghi spec trước khi lấy inputDigest; fail/not-run/inconclusive không thành done. Artifact bổ sung phải được liệt kê trong manifest assets và hash bytes thật.

## Tác động và giới hạn

Chỉ metadata/evidence thuộc scope được giao; không mutation product hoặc dịch vụ ngoài.

Danh sách trên mô tả capability, không cấp quyền mới. Chỉ thực hiện effect trong ma trận op này và quyền hiện tại; không ghi ngoài ma trận, tự chạy op tiếp hay tự thêm agent/account/deploy/publish/cleanup chưa chọn. Effect đã được người dùng cho phép đúng phạm vi không cần xin lại chỉ vì đổi op.

## Blocker và điểm dừng

| Code | Điều kiện / thông tin cần |
| --- | --- |
| OWNERSHIP_UNKNOWN | Operation/store chưa rõ owner hoặc cần ghi ngoài owner được giao. |
| COMPATIBILITY_UNKNOWN | Compatibility version/contract/migration bắt buộc thiếu proof. |
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
