# api.verify

Bản đối chiếu cho người đọc; bản tiếng Anh là thẩm quyền runtime.

Đọc đầy đủ [giao thức chung](common.md) và tài liệu này trước khi làm.

## Mục tiêu cụ thể

Kiểm API contract đã chọn trên target thật với effect được phép và cách ly.

Kind/profile: `uat.ux`. Chọn node cụ thể từ request hiện tại; không tự chạy toàn cây.

## Graph trong .work, không nằm trong op

Chỉ đọc graph node đã chọn. Không thêm/bỏ dependency, refs, required hoặc mở rộng scope để chạy/pass. Prerequisite thiếu/chưa done thì báo ID và dừng piece; nếu cần đổi graph, đề xuất scope update được chọn riêng. Không tự gọi op prerequisite.

## Đầu vào phải đọc và nguồn thẩm quyền

| ID | Đọc ở đâu | Đọc gì / vì sao |
| --- | --- | --- |
| target | N/node.md | Đọc N/node.md đã chọn đang tồn tại, scope cha, ref/dependency/assertion đã khai và freshness. Consumer op cần node đích có sẵn. Thiếu target là gap scope/graph: báo và đề xuất scope op được chọn riêng; không tạo target hay bịa acceptance/graph tại đây. |
| business | .work/<business>/business/**/node.md | Đọc requirement/quyết định/ràng buộc/AC được khai là input liên quan trong graph .work đã chọn. Ý định quyết định expected, source không thay nghiệp vụ. Không bịa predecessor BA bắt buộc cho scope không cần; input cần mà thiếu là gap graph/scope phải báo, không tự thêm dependency. |
| repo | repository:<repo-id>/<bound-paths> | Khi có/chọn source, resolve resource repo, checkout/root/HEAD/dirty thật; đọc hướng dẫn, manifest, code owner, caller, test. Greenfield/spec-only ghi source chưa tạo, lấy ý định từ yêu cầu; không bịa repo/trích dẫn fact. Implement source vẫn cần repo thật được chọn và được ghi. |
| environment | .work/_resources/environments/<environment>/resource.yaml | Đọc target/origin chính xác, owner, revision cấu hình, probe và tác động được phép; đối chiếu runtime thật, không suy danh tính từ hostname. |
| identity | .work/_resources/identities/<identity>/resource.yaml | Với scope đăng nhập/đổi identity, đọc alias, provider subject, role/membership refs, environment, sealed custody ref; không in/chép credential. Scope anonymous rõ ghi anonymous, không bịa resource account. |
| fixture | .work/_resources/fixtures/<fixture>/resource.yaml | Khi cần fixture, đọc revision/namespace-ID sở hữu/precondition/cách tạo/cleanup owner/tập xóa cho phép; không seed outcome test. Scope no-fixture rõ ghi lý do không có prerequisite mutable/cleanup, không bịa fixture. |
| suite | actual repository API test suite + selected architecture contract | Đọc suite command/case thật, schema/auth/error/transaction và assertion bắt buộc. Thiếu suite là gap owner source, không bịa case pass. |

## Ghi gì vào đâu

| ID | Nơi ghi | Trường / section | Nội dung bắt buộc |
| --- | --- | --- | --- |
| node | N/node.md | state; blocker; completion.inputDigest; completion.evidence | Đọc nguyên scope/assertion mong đợi/graph .work đã chọn. Ở đây chỉ ghi state/blocker/completion; observation/finding/mapping commit/cleanup còn lại ở evidence, không body ngữ nghĩa. Thiếu ref/dependency/acceptance thì báo gap hoặc cập nhật scope được chọn riêng; không thêm/bỏ để đạt pass. |
| evidence | E/manifest.yaml + E/api-result.json + E/api-output.txt + E/readback.json + E/runtime.json + E/result.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Lưu case/result suite thật, status/error/schema check, read-back/lifecycle, effect namespace, runtime provenance. Proof API không phải proof UI. Kết quả quan sát chuyên môn ở E/result.md: Gắn actor/environment/repo, giữ expected API đã chọn, ghi case fail/chưa test. |

## Thứ tự thực hiện hữu hạn

| # | Đọc ID | Ghi ID | Thực hiện và kiểm tra |
| --- | --- | --- | --- |
| 1 | target, business, suite, repo | — | Gắn assertion bắt buộc với case suite thật, kiểm revision test/runner. Nhận diện effect chưa khai trước chạy; không sửa case product tại đây. |
| 2 | environment, identity, fixture, repo | evidence | Kiểm target vật lý/runtime version/quyền/precondition fixture sở hữu; phân biệt case anonymous và actor đăng nhập. Không seed outcome đang test. |
| 3 | suite, environment, identity, fixture | evidence | Chạy API client suite khai thật với input cách ly, giữ diagnostic request/result đã che. Chỉ ghi case runner báo; output thiếu là not-run/inconclusive. |
| 4 | business, suite, fixture | evidence | Kiểm response contract/read-back lưu/lifecycle-quyền riêng, gồm replay/idempotency/denial khi hứa. Quan sát effect sở hữu và cleanup; không xóa ngoài tập an toàn được chọn rõ. |
| 5 | target, suite | node, evidence | Ghi verdict từng assertion và served-version evidence thật, validate binding, kết thúc không claim UI/sửa source. |

## Proof và điều kiện hoàn thành

| ID | Điều phải chứng minh |
| --- | --- |
| binding | Chạy validate workspace; ID/path trích dẫn tồn tại hoặc ghi rõ dự kiến, đủ assertions bắt buộc, binding còn mới; not-run/fail không được done. |
| api | Observation contract/data/lifecycle bắt buộc pass, có behavior assertion thật và build serve xác minh; không đoán case hoặc coi HTTP 200 luôn thành công. |

Chỉ ghi completion theo core schema sau khi proof thật đạt. Ghi spec trước khi lấy inputDigest; fail/not-run/inconclusive không thành done. Artifact bổ sung phải được liệt kê trong manifest assets và hash bytes thật.

## Tác động và giới hạn

- declared API test writes within owned namespace; no provisioning, deploy or broad cleanup

Danh sách trên mô tả capability, không cấp quyền mới. Chỉ thực hiện effect trong ma trận op này và quyền hiện tại; không ghi ngoài ma trận, tự chạy op tiếp hay tự thêm agent/account/deploy/publish/cleanup chưa chọn. Effect đã được người dùng cho phép đúng phạm vi không cần xin lại chỉ vì đổi op.

## Blocker và điểm dừng

| Code | Điều kiện / thông tin cần |
| --- | --- |
| SUITE_MISSING | Behavior API bắt buộc thiếu case thực thi đã khai hoặc không vào an toàn. |
| NAMESPACE_CONFLICT | Dữ liệu test chồng shared/foreign state hoặc thiếu quyền effect. |
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
| <identity> | Selected actor resource slug / slug actor đã chọn |
| <fixture> | Selected fixture resource slug / slug fixture đã chọn |
