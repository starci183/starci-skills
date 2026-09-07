# landing.compose

Bản đối chiếu cho người đọc; bản tiếng Anh là thẩm quyền runtime.

Đọc đầy đủ [giao thức chung](common.md) và tài liệu này trước khi làm.

## Mục tiêu cụ thể

Viết contract thứ tự landing trung thực, visual ownership, asset/motion.

Kind/profile: `architecture`. Chọn node cụ thể từ request hiện tại; không tự chạy toàn cây.

## Graph trong .work, không nằm trong op

Chỉ đọc graph node đã chọn. Không thêm/bỏ dependency, refs, required hoặc mở rộng scope để chạy/pass. Prerequisite thiếu/chưa done thì báo ID và dừng piece; nếu cần đổi graph, đề xuất scope update được chọn riêng. Không tự gọi op prerequisite.

## Đầu vào phải đọc và nguồn thẩm quyền

| ID | Đọc ở đâu | Đọc gì / vì sao |
| --- | --- | --- |
| target | N/node.md | Đọc N/node.md đã chọn đang tồn tại, scope cha, ref/dependency/assertion đã khai và freshness. Consumer op cần node đích có sẵn. Thiếu target là gap scope/graph: báo và đề xuất scope op được chọn riêng; không tạo target hay bịa acceptance/graph tại đây. |
| business | .work/<business>/business/**/node.md | Đọc requirement/quyết định/ràng buộc/AC được khai là input liên quan trong graph .work đã chọn. Ý định quyết định expected, source không thay nghiệp vụ. Không bịa predecessor BA bắt buộc cho scope không cần; input cần mà thiếu là gap graph/scope phải báo, không tự thêm dependency. |
| repo | repository:<repo-id>/<bound-paths> | Khi có/chọn source, resolve resource repo, checkout/root/HEAD/dirty thật; đọc hướng dẫn, manifest, code owner, caller, test. Greenfield/spec-only ghi source chưa tạo, lấy ý định từ yêu cầu; không bịa repo/trích dẫn fact. Implement source vẫn cần repo thật được chọn và được ghi. |
| identity | .work/_resources/design/<resource>/resource.yaml + approved content/reference assets | Đọc brand identity/claim-CTA authority/API component/reference thật; ảnh đối thủ/số mong muốn không cho bịa logo khách/metric/testimonial. |

## Tham chiếu chuyên môn có điều kiện

| Nguồn | Khi nào đọc |
| --- | --- |
| [knowledge/ui/composition/INDEX.md](../../knowledge/ui/composition/INDEX.md) | Chỉ đọc topic composition khớp family/scope; không import component Grammar không có hoặc yêu cầu receipt legacy. |

## Ghi gì vào đâu

| ID | Nơi ghi | Trường / section | Nội dung bắt buộc |
| --- | --- | --- | --- |
| node | N/node.md | body: Promise / CTA / Section storyboard / Component ownership / Asset slots / Motion / Responsive / Audit contract; assertions | Mỗi section có mục đích/content nguồn/hierarchy/action/component-source owner/asset ID-medium-quyền/reduced-motion/target performance khi quyết/acceptance proof. |
| evidence | E/manifest.yaml + E/composition-review.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Giữ coverage section–promise, review identity/asset/owner; plan không tạo kết quả UI render. |

## Thứ tự thực hiện hữu hạn

| # | Đọc ID | Ghi ID | Thực hiện và kiểm tra |
| --- | --- | --- | --- |
| 1 | business, identity, repo, target | node | Gắn một promise trung thực, action chính, brand/system hiện tại, page cũ nếu có; tách fact duyệt với copy marketing placeholder. |
| 2 | business, identity | node | Sắp section theo hiểu biết/task user, map content/interaction với mục đích, giao shared/application owner, không bịa API component chưa có. |
| 3 | identity, repo | node | Khai ID asset riêng, medium/quyền/provenance/place-crop-responsive/alternative accessibility. Motion có trigger/end state/reduced-motion/cách đo performance, không tính từ chung. |
| 4 | target, business, identity | evidence | Review claim từng section/asset và công cụ audit visual/behavior. Chỉ xong contract design, không asset/source/preview server/publish. |

## Proof và điều kiện hoàn thành

| ID | Điều phải chứng minh |
| --- | --- |
| binding | Chạy validate workspace; ID/path trích dẫn tồn tại hoặc ghi rõ dự kiến, đủ assertions bắt buộc, binding còn mới; not-run/fail không được done. |
| landing | Story/CTA/content/asset owner và expected audit quan sát đủ scope; không claim thương mại thiếu nguồn. |

Chỉ ghi completion theo core schema sau khi proof thật đạt. Ghi spec trước khi lấy inputDigest; fail/not-run/inconclusive không thành done. Artifact bổ sung phải được liệt kê trong manifest assets và hash bytes thật.

## Tác động và giới hạn

Chỉ metadata/evidence thuộc scope được giao; không mutation product hoặc dịch vụ ngoài.

Danh sách trên mô tả capability, không cấp quyền mới. Chỉ thực hiện effect trong ma trận op này và quyền hiện tại; không ghi ngoài ma trận, tự chạy op tiếp hay tự thêm agent/account/deploy/publish/cleanup chưa chọn. Effect đã được người dùng cho phép đúng phạm vi không cần xin lại chỉ vì đổi op.

## Blocker và điểm dừng

| Code | Điều kiện / thông tin cần |
| --- | --- |
| LANDING_CLAIM_UNKNOWN | Promise/CTA/identity/claim marketing chưa có nguồn được phép. |
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
