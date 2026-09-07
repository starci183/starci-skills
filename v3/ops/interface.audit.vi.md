# interface.audit

Bản đối chiếu cho người đọc; bản tiếng Anh là thẩm quyền runtime.

Đọc đầy đủ [giao thức chung](common.md) và tài liệu này trước khi làm.

## Mục tiêu cụ thể

Xem screen render thật đã chọn và ghi nghiệm thu visual trung thực độc lập implementation.

Kind/profile: `uat.ui`. Chọn node cụ thể từ request hiện tại; không tự chạy toàn cây.

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
| design | .work/_resources/design/<resource>/resource.yaml + accepted visual evidence | Đọc expected design/state/viewport thật đã chấp nhận và UI proof rule áp dụng; không ép grammar toàn cục không tồn tại. |

## Tham chiếu chuyên môn có điều kiện

| Nguồn | Khi nào đọc |
| --- | --- |
| [knowledge/ui/proof/INDEX.md](../../knowledge/ui/proof/INDEX.md) | Đọc topic observation phù hợp assertion chọn; chỉ dùng tiêu chí đã chấp nhận áp dụng/measurement thật/công cụ có sẵn, không machinery chain cũ. |

## Ghi gì vào đâu

| ID | Nơi ghi | Trường / section | Nội dung bắt buộc |
| --- | --- | --- | --- |
| node | N/node.md | state; blocker; completion.inputDigest; completion.evidence | Đọc nguyên scope/assertion mong đợi/graph .work đã chọn. Ở đây chỉ ghi state/blocker/completion; observation/finding/mapping commit/cleanup còn lại ở evidence, không body ngữ nghĩa. Thiếu ref/dependency/acceptance thì báo gap hoặc cập nhật scope được chọn riêng; không thêm/bỏ để đạt pass. |
| evidence | E/manifest.yaml + E/<screen>.png + E/measurements.json + E/runtime.json + E/review.md + E/result.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Chụp bytes ảnh thật, viewport/theme/route/state, DOM/computed measurement thật. Provenance gồm environment, actor hoặc anonymous, servedVersions, tool, capturedAt, servedVersionEvidence assertion. Phải mở xem ảnh. Kết quả quan sát chuyên môn ở E/result.md: Refs gắn environment, actor hoặc anonymous, mọi repo đang serve. Ghi finding hiện tại, không restyle source/đổi acceptance. |

## Thứ tự thực hiện hữu hạn

| # | Đọc ID | Ghi ID | Thực hiện và kiểm tra |
| --- | --- | --- | --- |
| 1 | target, business, repo, design | node | Chọn matrix screen/state và assertion đúng yêu cầu. Đọc owner implementation/design được chấp nhận; không thay target bằng concept AI. |
| 2 | environment, identity, repo, target | evidence | Theo protocol browser provenance/isolation; kiểm login/state product thật và build serve, không chỉ URL/HTTP 200. Anonymous ghi rõ không có actor đăng nhập. |
| 3 | design, target, environment | evidence | Vào từng state bằng control quan sát được, chụp viewport/theme thật, giữ ảnh local có hash. Xem hierarchy/density/text/content/overflow/responsive/fidelity. |
| 4 | design, target, business | evidence | Đo contrast/layout/focus-keyboard/motion-reduced-motion khi áp dụng bằng tool thật. Tách đánh giá design chủ quan với số đo. |
| 5 | target, design | node, evidence | Ghi pass/fail/not-run/inconclusive từng assertion và defect theo owner. Thiếu runtime/ảnh là blocker; lỗi visual thật vẫn fail. Validate rồi dừng, không sửa source hoặc chứng nhận behavior UAT. |

## Proof và điều kiện hoàn thành

| ID | Điều phải chứng minh |
| --- | --- |
| binding | Chạy validate workspace; ID/path trích dẫn tồn tại hoặc ghi rõ dự kiến, đủ assertions bắt buộc, binding còn mới; not-run/fail không được done. |
| visual | Assertion UI bắt buộc pass bằng ảnh PNG/JPEG/WebP local thật đã xem và observation served-version pass. Chỉ hash không đủ. |

Chỉ ghi completion theo core schema sau khi proof thật đạt. Ghi spec trước khi lấy inputDigest; fail/not-run/inconclusive không thành done. Artifact bổ sung phải được liệt kê trong manifest assets và hash bytes thật.

## Tác động và giới hạn

- authorized navigation/sign-in and non-destructive UI state setup

Danh sách trên mô tả capability, không cấp quyền mới. Chỉ thực hiện effect trong ma trận op này và quyền hiện tại; không ghi ngoài ma trận, tự chạy op tiếp hay tự thêm agent/account/deploy/publish/cleanup chưa chọn. Effect đã được người dùng cho phép đúng phạm vi không cần xin lại chỉ vì đổi op.

## Blocker và điểm dừng

| Code | Điều kiện / thông tin cần |
| --- | --- |
| CAPTURE_UNAVAILABLE | Không vào/chụp được state đã chọn trên runtime product đã xác minh. |
| IDENTITY_UNPROVEN | State bảo vệ thiếu actor/custody được phép hoặc nội dung product đăng nhập thật. |
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
| <resource> | Selected owned resource slug / slug resource thuộc quyền sửa |
| <screen> | Selected surface/state slug / slug screen-state đã chọn |
