# backend.generate

Bản đối chiếu cho người đọc; bản tiếng Anh là thẩm quyền runtime.

Đọc đầy đủ [giao thức chung](common.md) và tài liệu này trước khi làm.

## Mục tiêu cụ thể

Implement một outcome backend đã chọn và chứng minh contract trên code thật.

Kind/profile: `implementation`. Chọn node cụ thể từ request hiện tại; không tự chạy toàn cây.

## Graph trong .work, không nằm trong op

Chỉ đọc graph node đã chọn. Không thêm/bỏ dependency, refs, required hoặc mở rộng scope để chạy/pass. Prerequisite thiếu/chưa done thì báo ID và dừng piece; nếu cần đổi graph, đề xuất scope update được chọn riêng. Không tự gọi op prerequisite.

## Đầu vào phải đọc và nguồn thẩm quyền

| ID | Đọc ở đâu | Đọc gì / vì sao |
| --- | --- | --- |
| target | N/node.md | Đọc N/node.md đã chọn đang tồn tại, scope cha, ref/dependency/assertion đã khai và freshness. Consumer op cần node đích có sẵn. Thiếu target là gap scope/graph: báo và đề xuất scope op được chọn riêng; không tạo target hay bịa acceptance/graph tại đây. |
| business | .work/<business>/business/**/node.md | Đọc requirement/quyết định/ràng buộc/AC được khai là input liên quan trong graph .work đã chọn. Ý định quyết định expected, source không thay nghiệp vụ. Không bịa predecessor BA bắt buộc cho scope không cần; input cần mà thiếu là gap graph/scope phải báo, không tự thêm dependency. |
| architecture | .work/<business>/architecture/**/node.md | Đọc ownership dữ liệu, operation/API/event, boundary/code-scope/lý do được graph .work đã chọn khai; tách file dự kiến với file thật. Không mặc định chain mọi op phải architecture trước; thiếu scope thật sự bắt buộc thì báo trước khi tiếp tục. |
| repo | repository:<repo-id>/<bound-paths> | Khi có/chọn source, resolve resource repo, checkout/root/HEAD/dirty thật; đọc hướng dẫn, manifest, code owner, caller, test. Greenfield/spec-only ghi source chưa tạo, lấy ý định từ yêu cầu; không bịa repo/trích dẫn fact. Implement source vẫn cần repo thật được chọn và được ghi. |

## Tham chiếu chuyên môn có điều kiện

| Nguồn | Khi nào đọc |
| --- | --- |
| [knowledge/patterns/be/INDEX.md](../../knowledge/patterns/be/INDEX.md) | Chỉ khi backend đã chọn thật sự dùng họ NestJS được mô tả; inspect code hiện tại trước áp dụng topic. Đây là index chuyên môn, không routing v2. |

## Ghi gì vào đâu

| ID | Nơi ghi | Trường / section | Nội dung bắt buộc |
| --- | --- | --- | --- |
| node | N/node.md | state; blocker; completion.inputDigest; completion.evidence; completion.codeRefs | Đọc nguyên scope/assertion mong đợi/graph .work đã chọn. Ở đây chỉ ghi state/blocker/completion; observation/finding/mapping commit/cleanup còn lại ở evidence, không body ngữ nghĩa. Thiếu ref/dependency/acceptance thì báo gap hoặc cập nhật scope được chọn riêng; không thêm/bỏ để đạt pass. |
| source | repository:<repo-id>/<write-ceiling> | source files; tests; migration/assets/config only when selected | Chỉ file thuộc code-scope được giao cùng caller/integration cần thiết nhỏ nhất; ghi diff và commit thật, không coi dự kiến là đã giao. |
| evidence | E/manifest.yaml + E/tests.json + E/test-output.txt + E/lineage.json + E/result.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Lưu command thật, cwd/repo, commit/tree nguồn, environment, exit code, số test, expected/actual cho proof bắt buộc cùng output đã che bí mật. Kết quả quan sát chuyên môn ở E/result.md: Map AC/operation sang repo/path/symbol giao thật và commit thật. Giữ thẩm quyền BA/kiến trúc; rule chưa rõ là blocker, không tự đặt default. |

## Thứ tự thực hiện hữu hạn

| # | Đọc ID | Ghi ID | Thực hiện và kiểm tra |
| --- | --- | --- | --- |
| 1 | target, business, architecture, repo | — | Gắn operation/AC chính xác; inspect code, convention cùng họ, DI/module registration và caller. Giữ hành vi đang đúng. |
| 2 | business, architecture, repo | source | Implement transport, validation, quyền, use-case, persistence đúng ownership. Chặn trước side effect trái quyền; không bịa fallback. |
| 3 | business, architecture, repo | source | Implement transaction/retry/idempotency/concurrency/error/read-time revalidation đã khai. Migration chỉ là source; không tự apply remote. |
| 4 | repo, target | source, evidence | Thêm/sửa test đúng scope; chạy positive, denial, invalid-input và race/reload áp dụng cùng check bắt buộc repo. Giữ fail/no-test/not-run; chỉ sửa trong goal implementation này. |
| 5 | repo, target | node, evidence | Review diff, kiểm không lẫn thay đổi, commit khi được phép và đọc lại SHA/diff thật. Gắn proof với bytes đã test; code mới cần proof mới. Dừng sau giao. |

## Proof và điều kiện hoàn thành

| ID | Điều phải chứng minh |
| --- | --- |
| binding | Chạy validate workspace; ID/path trích dẫn tồn tại hoặc ghi rõ dự kiến, đủ assertions bắt buộc, binding còn mới; not-run/fail không được done. |
| commit | Đọc staged diff chính xác và test thật; gắn SHA nguồn đầy đủ theo repo, lưu mapping integration/tested riêng. Báo thật khi chưa commit hoặc không đổi. |
| behavior | Test chứng minh facet của operation, gồm từ chối quyền và trạng thái lưu khi đã hứa; chỉ compile không chứng minh hành vi. |

Chỉ ghi completion theo core schema sau khi proof thật đạt. Ghi spec trước khi lấy inputDigest; fail/not-run/inconclusive không thành done. Artifact bổ sung phải được liệt kê trong manifest assets và hash bytes thật.

## Tác động và giới hạn

- owned source edits
- scoped local commits when authorized
- tests in declared sandbox

Danh sách trên mô tả capability, không cấp quyền mới. Chỉ thực hiện effect trong ma trận op này và quyền hiện tại; không ghi ngoài ma trận, tự chạy op tiếp hay tự thêm agent/account/deploy/publish/cleanup chưa chọn. Effect đã được người dùng cho phép đúng phạm vi không cần xin lại chỉ vì đổi op.

## Blocker và điểm dừng

| Code | Điều kiện / thông tin cần |
| --- | --- |
| BUSINESS_UNKNOWN | Code chạm rule BA chưa quyết. |
| SCOPE_WIDENING | Operation/owner/protected path cần thiết nằm ngoài code-scope. |
| PROOF_UNAVAILABLE | Check bắt buộc không chạy được hoặc không chứng minh đúng hành vi. |
| DECLARED_DEPENDENCY_UNMET | Prerequisite đã khai chưa effective done hoặc thiếu input/scope bắt buộc đã khai. Báo ID node/resource và đề xuất cập nhật graph được chọn riêng khi cần; không chạy predecessor hoặc nới dependsOn/refs/required để tiếp tục. |

Thêm các blocker chung trong common.md khi áp dụng. Ghi đúng quan sát và gap owner; không bịa input để tiếp tục. Kết thúc với kết quả/phạm vi/commit/evidence/gap rồi dừng. Op gợi ý tiếp theo không tự thực thi.

## Resolve placeholder

N/E/R theo common.md. Không ghi literal placeholder; path mới phải ghi rõ dự kiến.

| Placeholder | Nguồn giá trị |
| --- | --- |
| <business> | Selected business slug / slug nghiệp vụ đã chọn |
| <repo-id> | Resolved repository resource ID / resource ID repo đã resolve |
| <bound-paths> | Inspected source read set / tập file nguồn cần đọc |
| <write-ceiling> | Explicit owned source paths / tập file nguồn được ghi |
