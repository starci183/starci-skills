# library.update

Bản đối chiếu cho người đọc; bản tiếng Anh là thẩm quyền runtime.

Đọc đầy đủ [giao thức chung](common.md) và tài liệu này trước khi làm.

## Mục tiêu cụ thể

Sửa hoặc consume thay đổi một owner package đã chọn, tách proof package và consumer.

Kind/profile: `implementation`. Chọn node cụ thể từ request hiện tại; không tự chạy toàn cây.

## Graph trong .work, không nằm trong op

Chỉ đọc graph node đã chọn. Không thêm/bỏ dependency, refs, required hoặc mở rộng scope để chạy/pass. Prerequisite thiếu/chưa done thì báo ID và dừng piece; nếu cần đổi graph, đề xuất scope update được chọn riêng. Không tự gọi op prerequisite.

## Đầu vào phải đọc và nguồn thẩm quyền

| ID | Đọc ở đâu | Đọc gì / vì sao |
| --- | --- | --- |
| target | N/node.md | Đọc N/node.md đã chọn đang tồn tại, scope cha, ref/dependency/assertion đã khai và freshness. Consumer op cần node đích có sẵn. Thiếu target là gap scope/graph: báo và đề xuất scope op được chọn riêng; không tạo target hay bịa acceptance/graph tại đây. |
| repo | repository:<repo-id>/<bound-paths> | Khi có/chọn source, resolve resource repo, checkout/root/HEAD/dirty thật; đọc hướng dẫn, manifest, code owner, caller, test. Greenfield/spec-only ghi source chưa tạo, lấy ý định từ yêu cầu; không bịa repo/trích dẫn fact. Implement source vẫn cần repo thật được chọn và được ghi. |
| library | .work/_resources/libraries/<resource>/resource.yaml + actual package/consumer manifests | Đọc owner package/consumer list/version-integrity/export-API/regression/mode repair-pack-consume-publish thật. Không mặc định bump patch/publish nếu chưa có policy/scope. |

## Tham chiếu chuyên môn có điều kiện

| Nguồn | Khi nào đọc |
| --- | --- |
| [knowledge/patterns/fe/INDEX.md](../../knowledge/patterns/fe/INDEX.md) | Chỉ khi FE/thư viện chọn thật sự dùng họ này; giữ convention repo hiện tại nếu khác. |

## Ghi gì vào đâu

| ID | Nơi ghi | Trường / section | Nội dung bắt buộc |
| --- | --- | --- | --- |
| node | N/node.md | state; blocker; completion.inputDigest; completion.evidence; completion.codeRefs | Đọc nguyên scope/assertion mong đợi/graph .work đã chọn. Ở đây chỉ ghi state/blocker/completion; observation/finding/mapping commit/cleanup còn lại ở evidence, không body ngữ nghĩa. Thiếu ref/dependency/acceptance thì báo gap hoặc cập nhật scope được chọn riêng; không thêm/bỏ để đạt pass. |
| source | repository:<repo-id>/<write-ceiling> | source files; tests; migration/assets/config only when selected | Chỉ file thuộc code-scope được giao cùng caller/integration cần thiết nhỏ nhất; ghi diff và commit thật, không coi dự kiến là đã giao. |
| resource | .work/_resources/libraries/<resource>/resource.yaml | id; kind; owner; revision; details.package; details.version; details.integrity; details.ownerRepository; details.consumerRefs; details.evidenceRef | Chỉ ghi identity pack/publish/consume thật và package API xác minh, không release giả định. |
| evidence | E/manifest.yaml + E/package-tests.json + E/consumer-tests.json + E/package-integrity.json + E/lineage.json + E/result.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Giữ regression/build/pack owner và test trước/sau consumer tại revision riêng; integrity package từ archive/registry read-back thật. Kết quả quan sát chuyên môn ở E/result.md: Gắn repo/commit package và consumer riêng, integrity release chọn, regression trước/sau thật. Sửa thư viện không có nghĩa consumer đã dùng. |

## Thứ tự thực hiện hữu hạn

| # | Đọc ID | Ghi ID | Thực hiện và kiểm tra |
| --- | --- | --- | --- |
| 1 | target, repo, library | — | Inspect owner canonical/dependency consumer chính xác; reproduce regression, kiểm mode/ceiling ghi. Workaround consumer không phải sửa owner. |
| 2 | repo, library | source, evidence | Nếu chọn sửa owner thì thêm regression/sửa source đúng scope/chạy check package/áp dụng version policy thật khi cần. Consume-only không sửa source package. |
| 3 | repo, library | resource, evidence | Nếu chọn pack/publish thì pack commit test thật, ghi integrity; publish chỉ khi quyền registry rõ và read-back version/integrity serve đúng. |
| 4 | repo, library | source, evidence | Nếu chọn consume thì sửa manifest/lockfile chính xác, kiểm bytes/version/integrity cài thật, chạy regression không đổi và gate consumer. Không tự sửa consumer ngoài scope. |
| 5 | target, repo, library | node, resource, evidence | Review/commit từng piece source chọn, giữ lineage theo repo, verdict package/consumer riêng; dừng và nêu phần adoption/publication chưa chọn. |

## Proof và điều kiện hoàn thành

| ID | Điều phải chứng minh |
| --- | --- |
| binding | Chạy validate workspace; ID/path trích dẫn tồn tại hoặc ghi rõ dự kiến, đủ assertions bắt buộc, binding còn mới; not-run/fail không được done. |
| commit | Đọc staged diff chính xác và test thật; gắn SHA nguồn đầy đủ theo repo, lưu mapping integration/tested riêng. Báo thật khi chưa commit hoặc không đổi. |
| library | Hành vi package/consumer đã chọn pass tại identity chính xác; packed không là published, published không là consumed, consumed không là đã test regression. |

Chỉ ghi completion theo core schema sau khi proof thật đạt. Ghi spec trước khi lấy inputDigest; fail/not-run/inconclusive không thành done. Artifact bổ sung phải được liệt kê trong manifest assets và hash bytes thật.

## Tác động và giới hạn

- selected package/consumer source or metadata edits
- scoped commits when authorized
- registry publication only when explicitly included

Danh sách trên mô tả capability, không cấp quyền mới. Chỉ thực hiện effect trong ma trận op này và quyền hiện tại; không ghi ngoài ma trận, tự chạy op tiếp hay tự thêm agent/account/deploy/publish/cleanup chưa chọn. Effect đã được người dùng cho phép đúng phạm vi không cần xin lại chỉ vì đổi op.

## Blocker và điểm dừng

| Code | Điều kiện / thông tin cần |
| --- | --- |
| LIBRARY_OWNER_UNKNOWN | Owner/boundary consumer/version policy/integrity bắt buộc thiếu nguồn. |
| DECLARED_DEPENDENCY_UNMET | Prerequisite đã khai chưa effective done hoặc thiếu input/scope bắt buộc đã khai. Báo ID node/resource và đề xuất cập nhật graph được chọn riêng khi cần; không chạy predecessor hoặc nới dependsOn/refs/required để tiếp tục. |

Thêm các blocker chung trong common.md khi áp dụng. Ghi đúng quan sát và gap owner; không bịa input để tiếp tục. Kết thúc với kết quả/phạm vi/commit/evidence/gap rồi dừng. Op gợi ý tiếp theo không tự thực thi.

## Resolve placeholder

N/E/R theo common.md. Không ghi literal placeholder; path mới phải ghi rõ dự kiến.

| Placeholder | Nguồn giá trị |
| --- | --- |
| <repo-id> | Resolved repository resource ID / resource ID repo đã resolve |
| <bound-paths> | Inspected source read set / tập file nguồn cần đọc |
| <resource> | Selected owned resource slug / slug resource thuộc quyền sửa |
| <write-ceiling> | Explicit owned source paths / tập file nguồn được ghi |
