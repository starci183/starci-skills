# data.seed

Bản đối chiếu cho người đọc; bản tiếng Anh là thẩm quyền runtime.

Đọc đầy đủ [giao thức chung](common.md) và tài liệu này trước khi làm.

## Mục tiêu cụ thể

Apply hoặc dọn đúng fixture sở hữu đã chọn và kiểm state quan sát chính xác.

Kind/profile: `operations`. Chọn node cụ thể từ request hiện tại; không tự chạy toàn cây.

## Graph trong .work, không nằm trong op

Chỉ đọc graph node đã chọn. Không thêm/bỏ dependency, refs, required hoặc mở rộng scope để chạy/pass. Prerequisite thiếu/chưa done thì báo ID và dừng piece; nếu cần đổi graph, đề xuất scope update được chọn riêng. Không tự gọi op prerequisite.

## Đầu vào phải đọc và nguồn thẩm quyền

| ID | Đọc ở đâu | Đọc gì / vì sao |
| --- | --- | --- |
| target | N/node.md | Đọc N/node.md đã chọn đang tồn tại, scope cha, ref/dependency/assertion đã khai và freshness. Consumer op cần node đích có sẵn. Thiếu target là gap scope/graph: báo và đề xuất scope op được chọn riêng; không tạo target hay bịa acceptance/graph tại đây. |
| fixture | .work/_resources/fixtures/<fixture>/resource.yaml | Khi cần fixture, đọc revision/namespace-ID sở hữu/precondition/cách tạo/cleanup owner/tập xóa cho phép; không seed outcome test. Scope no-fixture rõ ghi lý do không có prerequisite mutable/cleanup, không bịa fixture. |
| environment | .work/_resources/environments/<environment>/resource.yaml | Đọc target/origin chính xác, owner, revision cấu hình, probe và tác động được phép; đối chiếu runtime thật, không suy danh tính từ hostname. |
| identity | .work/_resources/identities/<identity>/resource.yaml | Với scope đăng nhập/đổi identity, đọc alias, provider subject, role/membership refs, environment, sealed custody ref; không in/chép credential. Scope anonymous rõ ghi anonymous, không bịa resource account. |
| repo | repository:<repo-id>/<bound-paths> | Khi có/chọn source, resolve resource repo, checkout/root/HEAD/dirty thật; đọc hướng dẫn, manifest, code owner, caller, test. Greenfield/spec-only ghi source chưa tạo, lấy ý định từ yêu cầu; không bịa repo/trích dẫn fact. Implement source vẫn cần repo thật được chọn và được ghi. |
| authority | current fixture operation scope + actual source-owned fixture script | Đọc action inspect/apply/cleanup được chọn, revision script/input thật; provision account/migration schema/restore DB rộng ngoài scope. |

## Ghi gì vào đâu

| ID | Nơi ghi | Trường / section | Nội dung bắt buộc |
| --- | --- | --- | --- |
| node | N/node.md | state; blocker; completion.inputDigest; completion.evidence | Đọc nguyên scope/assertion mong đợi/graph .work đã chọn. Ở đây chỉ ghi state/blocker/completion; observation/finding/mapping commit/cleanup còn lại ở evidence, không body ngữ nghĩa. Thiếu ref/dependency/acceptance thì báo gap hoặc cập nhật scope được chọn riêng; không thêm/bỏ để đạt pass. |
| resource | .work/_resources/fixtures/<resource>/resource.yaml | id; kind; owner; revision; details.placementEvidence; details.cleanupEvidence | Gắn evidence placement/cleanup thật vào resource fixture hiện có, không đổi outcome dự kiến. |
| evidence | E/manifest.yaml + E/records.json + E/before-after.json + E/fixture-output.txt + E/result.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Mỗi row ghi store/key/namespace-owner/operation-outcome/read-back; cleanup chỉ ghi ID đã chứng minh sở hữu bị xóa. Che content fixture nhạy cảm. Kết quả quan sát chuyên môn ở E/result.md: Ghi row thật đã đặt/dùng lại/xóa, cleanup owner còn lại. Danh sách row dự kiến không phải dữ liệu đã tạo. |

## Thứ tự thực hiện hữu hạn

| # | Đọc ID | Ghi ID | Thực hiện và kiểm tra |
| --- | --- | --- | --- |
| 1 | fixture, authority, environment, identity, repo | — | Validate revision input/script, target/actor/scope mutation chính xác. Inspect chỉ đọc không tự coi có quyền apply/cleanup. |
| 2 | fixture, environment, authority | evidence | Inspect key đích, phân loại đúng/thiếu/sai/foreign/chưa chắc trước sửa. Không overwrite/xóa row foreign hoặc owner chưa chắc. |
| 3 | fixture, authority, repo, environment | evidence | Chỉ apply input sở hữu thiếu/sai được cho phép qua API bình thường/runner fixture đã xem; cleanup đúng tập sở hữu sau validate mới. Không seed outcome đang test/reapply mutation chưa rõ. |
| 4 | fixture, environment, target | node, resource, evidence | Read-back record thật hoặc chứng minh xóa đã chọn, giữ row shared, ghi effect một phần và cleanup còn lại. Validate rồi dừng, không chạy UAT. |

## Proof và điều kiện hoàn thành

| ID | Điều phải chứng minh |
| --- | --- |
| binding | Chạy validate workspace; ID/path trích dẫn tồn tại hoặc ghi rõ dự kiến, đủ assertions bắt buộc, binding còn mới; not-run/fail không được done. |
| fixture-state | Read-back thật khớp precondition, hoặc xóa đúng tập sở hữu được kiểm; effect một phần/chưa chắc không được gọi sạch. |

Chỉ ghi completion theo core schema sau khi proof thật đạt. Ghi spec trước khi lấy inputDigest; fail/not-run/inconclusive không thành done. Artifact bổ sung phải được liệt kê trong manifest assets và hash bytes thật.

## Tác động và giới hạn

- explicit fixture placement/update or exact authorized cleanup subset

Danh sách trên mô tả capability, không cấp quyền mới. Chỉ thực hiện effect trong ma trận op này và quyền hiện tại; không ghi ngoài ma trận, tự chạy op tiếp hay tự thêm agent/account/deploy/publish/cleanup chưa chọn. Effect đã được người dùng cho phép đúng phạm vi không cần xin lại chỉ vì đổi op.

## Blocker và điểm dừng

| Code | Điều kiện / thông tin cần |
| --- | --- |
| FIXTURE_AUTHORITY_MISSING | Operation chọn thiếu quyền cho data target/effect chính xác. |
| FIXTURE_SHARED_ROW | Mutation chạm row foreign/shared hoặc không quy thuộc được. |
| DECLARED_DEPENDENCY_UNMET | Prerequisite đã khai chưa effective done hoặc thiếu input/scope bắt buộc đã khai. Báo ID node/resource và đề xuất cập nhật graph được chọn riêng khi cần; không chạy predecessor hoặc nới dependsOn/refs/required để tiếp tục. |

Thêm các blocker chung trong common.md khi áp dụng. Ghi đúng quan sát và gap owner; không bịa input để tiếp tục. Kết thúc với kết quả/phạm vi/commit/evidence/gap rồi dừng. Op gợi ý tiếp theo không tự thực thi.

## Resolve placeholder

N/E/R theo common.md. Không ghi literal placeholder; path mới phải ghi rõ dự kiến.

| Placeholder | Nguồn giá trị |
| --- | --- |
| <fixture> | Selected fixture resource slug / slug fixture đã chọn |
| <environment> | Resolved environment resource slug / slug environment đã resolve |
| <identity> | Selected actor resource slug / slug actor đã chọn |
| <repo-id> | Resolved repository resource ID / resource ID repo đã resolve |
| <bound-paths> | Inspected source read set / tập file nguồn cần đọc |
| <resource> | Selected owned resource slug / slug resource thuộc quyền sửa |
