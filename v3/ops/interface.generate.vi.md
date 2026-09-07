# interface.generate

Bản đối chiếu cho người đọc; bản tiếng Anh là thẩm quyền runtime.

Đọc đầy đủ [giao thức chung](common.md) và tài liệu này trước khi làm.

## Mục tiêu cụ thể

Implement một outcome FE đã chọn và chụp kết quả render thật.

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
| design | .work/_resources/design/<resource>/resource.yaml + accepted direction evidence | Đọc API/token component cài thật và surface/direction/state map đã chấp nhận; chỉ bắt direction riêng nếu task có chọn. |
| environment | .work/_resources/environments/<environment>/resource.yaml | Đọc target/origin chính xác, owner, revision cấu hình, probe và tác động được phép; đối chiếu runtime thật, không suy danh tính từ hostname. |

## Tham chiếu chuyên môn có điều kiện

| Nguồn | Khi nào đọc |
| --- | --- |
| [knowledge/patterns/fe/INDEX.md](../../knowledge/patterns/fe/INDEX.md) | Chỉ khi FE/thư viện chọn thật sự dùng họ này; giữ convention repo hiện tại nếu khác. |
| [knowledge/ui/composition/INDEX.md](../../knowledge/ui/composition/INDEX.md) | Chỉ đọc topic composition khớp family/scope; không import component Grammar không có hoặc yêu cầu receipt legacy. |
| [knowledge/ui/presentation/INDEX.md](../../knowledge/ui/presentation/INDEX.md) | Đọc topic presentation khớp khi đã gắn họ component/token cài thật; không bịa rule ID/API từ index. |

## Ghi gì vào đâu

| ID | Nơi ghi | Trường / section | Nội dung bắt buộc |
| --- | --- | --- | --- |
| node | N/node.md | state; blocker; completion.inputDigest; completion.evidence; completion.codeRefs | Đọc nguyên scope/assertion mong đợi/graph .work đã chọn. Ở đây chỉ ghi state/blocker/completion; observation/finding/mapping commit/cleanup còn lại ở evidence, không body ngữ nghĩa. Thiếu ref/dependency/acceptance thì báo gap hoặc cập nhật scope được chọn riêng; không thêm/bỏ để đạt pass. |
| source | repository:<repo-id>/<write-ceiling> | source files; tests; migration/assets/config only when selected | Chỉ file thuộc code-scope được giao cùng caller/integration cần thiết nhỏ nhất; ghi diff và commit thật, không coi dự kiến là đã giao. |
| evidence | E/manifest.yaml + E/tests.json + E/render.png + E/render-review.md + E/runtime.json + E/lineage.json + E/result.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Giữ test output và ảnh từ surface đã implement thật, có mở xem. Ghi viewport/theme, route/state, driver, build đang serve, giới hạn; không gọi ảnh fixture là proof product. Kết quả quan sát chuyên môn ở E/result.md: Map component/route/client call đã giao sang AC/state coverage; tách source revision với revision render đang serve. |

## Thứ tự thực hiện hữu hạn

| # | Đọc ID | Ghi ID | Thực hiện và kiểm tra |
| --- | --- | --- | --- |
| 1 | repo, target, business, architecture, design | — | Inspect target/caller, API component cài thật, API schema và state áp dụng. Dùng shell đã duyệt; tách refine nhỏ với đổi business/state design. |
| 2 | repo, business, architecture, design | source | Implement native control, read/action dữ liệu, loading/empty/error/denied/success/recovery, keyboard/focus/responsive trong source sở hữu. Không fake success hay đoán endpoint. |
| 3 | repo, target, design | source, evidence | Chạy component/unit/type/build và interaction test liên quan. Chỉ sửa trong goal này; giữ fail thật, visual bắt buộc chưa có thì chưa xong. |
| 4 | environment, repo, target, design | evidence | Gắn runtime/preview được phép và build serve thật theo browser protocol. Mở surface implement, chụp viewport/state đã chọn; xem ảnh, kiểm layout/overflow/content, ghi findings. |
| 5 | repo, target | node, evidence | Review diff thuộc scope, commit khi được phép, gắn test/render với revision thật. Chụp lại nếu output commit thay đổi liên quan. UAT độc lập vẫn là proof riêng, ảnh không thay thế. Dừng. |

## Proof và điều kiện hoàn thành

| ID | Điều phải chứng minh |
| --- | --- |
| binding | Chạy validate workspace; ID/path trích dẫn tồn tại hoặc ghi rõ dự kiến, đủ assertions bắt buộc, binding còn mới; not-run/fail không được done. |
| commit | Đọc staged diff chính xác và test thật; gắn SHA nguồn đầy đủ theo repo, lưu mapping integration/tested riêng. Báo thật khi chưa commit hoặc không đổi. |
| render | Giữ ảnh surface implement thật và đã xem; nếu ảnh bắt buộc chưa chụp được thì ghi rõ giao code một phần. |

Chỉ ghi completion theo core schema sau khi proof thật đạt. Ghi spec trước khi lấy inputDigest; fail/not-run/inconclusive không thành done. Artifact bổ sung phải được liệt kê trong manifest assets và hash bytes thật.

## Tác động và giới hạn

- owned source edits
- scoped local commits when authorized
- authorized local preview/test actions

Danh sách trên mô tả capability, không cấp quyền mới. Chỉ thực hiện effect trong ma trận op này và quyền hiện tại; không ghi ngoài ma trận, tự chạy op tiếp hay tự thêm agent/account/deploy/publish/cleanup chưa chọn. Effect đã được người dùng cho phép đúng phạm vi không cần xin lại chỉ vì đổi op.

## Blocker và điểm dừng

| Code | Điều kiện / thông tin cần |
| --- | --- |
| UI_CONTRACT_UNKNOWN | State nghiệp vụ/API action/owner component bắt buộc chưa rõ. |
| RUNTIME_UNVERIFIED | Runtime được phép chưa chứng minh surface/build đang implement; không bịa ảnh. |
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
| <environment> | Resolved environment resource slug / slug environment đã resolve |
| <write-ceiling> | Explicit owned source paths / tập file nguồn được ghi |
