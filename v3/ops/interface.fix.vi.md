# interface.fix

Bản đối chiếu cho người đọc; bản tiếng Anh là thẩm quyền runtime.

Đọc đầy đủ [giao thức chung](common.md) và tài liệu này trước khi làm.

## Mục tiêu cụ thể

Sửa một lỗi FE quan sát được đúng scope và kiểm lại hành vi/render bị ảnh hưởng.

Kind/profile: `implementation`. Chọn node cụ thể từ request hiện tại; không tự chạy toàn cây.

## Graph trong .work, không nằm trong op

Chỉ đọc graph node đã chọn. Không thêm/bỏ dependency, refs, required hoặc mở rộng scope để chạy/pass. Prerequisite thiếu/chưa done thì báo ID và dừng piece; nếu cần đổi graph, đề xuất scope update được chọn riêng. Không tự gọi op prerequisite.

## Đầu vào phải đọc và nguồn thẩm quyền

| ID | Đọc ở đâu | Đọc gì / vì sao |
| --- | --- | --- |
| target | N/node.md | Đọc N/node.md đã chọn đang tồn tại, scope cha, ref/dependency/assertion đã khai và freshness. Consumer op cần node đích có sẵn. Thiếu target là gap scope/graph: báo và đề xuất scope op được chọn riêng; không tạo target hay bịa acceptance/graph tại đây. |
| business | .work/<business>/business/**/node.md | Đọc requirement/quyết định/ràng buộc/AC được khai là input liên quan trong graph .work đã chọn. Ý định quyết định expected, source không thay nghiệp vụ. Không bịa predecessor BA bắt buộc cho scope không cần; input cần mà thiếu là gap graph/scope phải báo, không tự thêm dependency. |
| repo | repository:<repo-id>/<bound-paths> | Khi có/chọn source, resolve resource repo, checkout/root/HEAD/dirty thật; đọc hướng dẫn, manifest, code owner, caller, test. Greenfield/spec-only ghi source chưa tạo, lấy ý định từ yêu cầu; không bịa repo/trích dẫn fact. Implement source vẫn cần repo thật được chọn và được ghi. |
| finding | selected current evidence manifest + its actual assets | Đọc assertion fail, revision source/render, quan sát đo được, design contract đã chấp nhận; gợi ý chưa reproduce vẫn là giả thuyết. |
| environment | .work/_resources/environments/<environment>/resource.yaml | Đọc target/origin chính xác, owner, revision cấu hình, probe và tác động được phép; đối chiếu runtime thật, không suy danh tính từ hostname. |

## Tham chiếu chuyên môn có điều kiện

| Nguồn | Khi nào đọc |
| --- | --- |
| [knowledge/patterns/fe/INDEX.md](../../knowledge/patterns/fe/INDEX.md) | Chỉ khi FE/thư viện chọn thật sự dùng họ này; giữ convention repo hiện tại nếu khác. |
| [knowledge/ui/presentation/INDEX.md](../../knowledge/ui/presentation/INDEX.md) | Đọc topic presentation khớp khi đã gắn họ component/token cài thật; không bịa rule ID/API từ index. |

## Ghi gì vào đâu

| ID | Nơi ghi | Trường / section | Nội dung bắt buộc |
| --- | --- | --- | --- |
| node | N/node.md | state; blocker; completion.inputDigest; completion.evidence; completion.codeRefs | Đọc nguyên scope/assertion mong đợi/graph .work đã chọn. Ở đây chỉ ghi state/blocker/completion; observation/finding/mapping commit/cleanup còn lại ở evidence, không body ngữ nghĩa. Thiếu ref/dependency/acceptance thì báo gap hoặc cập nhật scope được chọn riêng; không thêm/bỏ để đạt pass. |
| source | repository:<repo-id>/<write-ceiling> | source files; tests; migration/assets/config only when selected | Chỉ file thuộc code-scope được giao cùng caller/integration cần thiết nhỏ nhất; ghi diff và commit thật, không coi dự kiến là đã giao. |
| evidence | E/manifest.yaml + E/regression.json + E/before-after-review.md + E/after.png when visual + E/lineage.json + E/result.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Ghi reproduce/cause/file đổi/regression thật; fix visual cần ảnh hiện tại đã xem, fix behavior cần action/output quan sát được. Kết quả quan sát chuyên môn ở E/result.md: Link evidence lỗi gốc và proof sửa hiện tại; không xóa fail cũ hoặc đổi expected âm thầm. |

## Thứ tự thực hiện hữu hạn

| # | Đọc ID | Ghi ID | Thực hiện và kiểm tra |
| --- | --- | --- | --- |
| 1 | finding, repo, business, target | evidence | Reproduce hoặc đối chứng lỗi tại source hiện tại; tách evidence cũ, owner thư viện, nguyên nhân source product. |
| 2 | finding, repo, business | source | Sửa nhỏ nhất đúng ownership và contract business/design hiện có. Cần requirement/API shared owner/redesign ngoài scope thì dừng trước khi mở rộng. |
| 3 | repo, finding, environment | evidence | Chạy lại check target/liên quan; nếu đổi appearance thì chụp/mở UI thật, kiểm interaction/persistence riêng. |
| 4 | repo, target | node, evidence | Review/commit piece đúng scope khi được phép, ghi revision code/proof thật và hạn chế. Dừng, không mở chain generate lớn hơn. |

## Proof và điều kiện hoàn thành

| ID | Điều phải chứng minh |
| --- | --- |
| binding | Chạy validate workspace; ID/path trích dẫn tồn tại hoặc ghi rõ dự kiến, đủ assertions bắt buộc, binding còn mới; not-run/fail không được done. |
| commit | Đọc staged diff chính xác và test thật; gắn SHA nguồn đầy đủ theo repo, lưu mapping integration/tested riêng. Báo thật khi chưa commit hoặc không đổi. |
| regression | Expected assertion gốc có evidence quan sát mới; collateral check vẫn pass hoặc ghi rõ chưa giải quyết. |

Chỉ ghi completion theo core schema sau khi proof thật đạt. Ghi spec trước khi lấy inputDigest; fail/not-run/inconclusive không thành done. Artifact bổ sung phải được liệt kê trong manifest assets và hash bytes thật.

## Tác động và giới hạn

- owned source edits
- scoped local commits when authorized
- targeted tests and authorized browser actions

Danh sách trên mô tả capability, không cấp quyền mới. Chỉ thực hiện effect trong ma trận op này và quyền hiện tại; không ghi ngoài ma trận, tự chạy op tiếp hay tự thêm agent/account/deploy/publish/cleanup chưa chọn. Effect đã được người dùng cho phép đúng phạm vi không cần xin lại chỉ vì đổi op.

## Blocker và điểm dừng

| Code | Điều kiện / thông tin cần |
| --- | --- |
| REPAIR_SCOPE_UNKNOWN | Chưa rõ nguyên nhân hoặc thay đổi ownership cần thiết. |
| EXPECTED_CHANGE_REQUIRED | Cách sửa đổi expected business/design task chưa cho phép. |
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
| <write-ceiling> | Explicit owned source paths / tập file nguồn được ghi |
