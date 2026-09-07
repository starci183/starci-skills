# content.generate

Bản đối chiếu cho người đọc; bản tiếng Anh là thẩm quyền runtime.

Đọc đầy đủ [giao thức chung](common.md) và tài liệu này trước khi làm.

## Mục tiêu cụ thể

Tạo/sửa một đơn vị content đã chọn có claim có nguồn, media/code check yêu cầu thật.

Kind/profile: `implementation`. Chọn node cụ thể từ request hiện tại; không tự chạy toàn cây.

## Graph trong .work, không nằm trong op

Chỉ đọc graph node đã chọn. Không thêm/bỏ dependency, refs, required hoặc mở rộng scope để chạy/pass. Prerequisite thiếu/chưa done thì báo ID và dừng piece; nếu cần đổi graph, đề xuất scope update được chọn riêng. Không tự gọi op prerequisite.

## Đầu vào phải đọc và nguồn thẩm quyền

| ID | Đọc ở đâu | Đọc gì / vì sao |
| --- | --- | --- |
| target | N/node.md | Đọc N/node.md đã chọn đang tồn tại, scope cha, ref/dependency/assertion đã khai và freshness. Consumer op cần node đích có sẵn. Thiếu target là gap scope/graph: báo và đề xuất scope op được chọn riêng; không tạo target hay bịa acceptance/graph tại đây. |
| business | .work/<business>/business/**/node.md | Đọc requirement/quyết định/ràng buộc/AC được khai là input liên quan trong graph .work đã chọn. Ý định quyết định expected, source không thay nghiệp vụ. Không bịa predecessor BA bắt buộc cho scope không cần; input cần mà thiếu là gap graph/scope phải báo, không tự thêm dependency. |
| repo | repository:<repo-id>/<bound-paths> | Khi có/chọn source, resolve resource repo, checkout/root/HEAD/dirty thật; đọc hướng dẫn, manifest, code owner, caller, test. Greenfield/spec-only ghi source chưa tạo, lấy ý định từ yêu cầu; không bịa repo/trích dẫn fact. Implement source vẫn cần repo thật được chọn và được ghi. |
| brief | selected curriculum/content brief + actual source material/style/rights | Đọc audience/outcome học hoặc dùng, nguồn fact, ngôn ngữ/format/claim duyệt, asset/ví dụ yêu cầu. Fact/testimonial/result thiếu không được bịa. |

## Ghi gì vào đâu

| ID | Nơi ghi | Trường / section | Nội dung bắt buộc |
| --- | --- | --- | --- |
| node | N/node.md | state; blocker; completion.inputDigest; completion.evidence; completion.codeRefs | Đọc nguyên scope/assertion mong đợi/graph .work đã chọn. Ở đây chỉ ghi state/blocker/completion; observation/finding/mapping commit/cleanup còn lại ở evidence, không body ngữ nghĩa. Thiếu ref/dependency/acceptance thì báo gap hoặc cập nhật scope được chọn riêng; không thêm/bỏ để đạt pass. |
| source | repository:<repo-id>/<write-ceiling> | source files; tests; migration/assets/config only when selected | Chỉ file thuộc code-scope được giao cùng caller/integration cần thiết nhỏ nhất; ghi diff và commit thật, không coi dự kiến là đã giao. |
| evidence | E/manifest.yaml + E/content-review.md + E/source-map.json + E/example-tests.json when executable + E/media-review.md when generated + E/result.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Ghi kiểm nguồn fact, độ đủ edition, build/chạy ví dụ thật khi yêu cầu. Media sinh có tool provenance thật và review ảnh đã xem. Kết quả quan sát chuyên môn ở E/result.md: Gắn path content thật, provenance nguồn/quyền; content xong không phải outcome học quan sát ở production hoặc đã publish. |

## Thứ tự thực hiện hữu hạn

| # | Đọc ID | Ghi ID | Thực hiện và kiểm tra |
| --- | --- | --- | --- |
| 1 | target, business, brief, repo | node | Resolve audience/outcome/edition-locale/ràng buộc fact/path owner. Workspace chỉ content mới có thể dùng nơi deliverable được chọn rõ, không bịa repo product. |
| 2 | brief, business, repo | source | Viết/sửa content/ví dụ chọn, giữ phần đúng hiện có, claim fact quan trọng gắn nguồn thật; đánh dấu ví dụ minh họa. |
| 3 | brief, repo | source, evidence | Sinh asset yêu cầu qua skill/tool phù hợp có thật và xem; chạy ví dụ/build đã chọn, giữ output thật. Không ép media/biến thể ngôn ngữ chưa yêu cầu. |
| 4 | target, brief, business | evidence | Review coverage outcome/độ rõ/fact/quyền nguồn/nhất quán ngôn ngữ. Review độc lập cần reviewer thật được phép; self-review ghi trung thực. |
| 5 | target, repo, brief | node, evidence | Commit content track đã chọn khi được phép hoặc báo deliverable local/chưa commit đúng. Dừng không publish/sửa curriculum ngoài scope. |

## Proof và điều kiện hoàn thành

| ID | Điều phải chứng minh |
| --- | --- |
| binding | Chạy validate workspace; ID/path trích dẫn tồn tại hoặc ghi rõ dự kiến, đủ assertions bắt buộc, binding còn mới; not-run/fail không được done. |
| commit | Đọc staged diff chính xác và test thật; gắn SHA nguồn đầy đủ theo repo, lưu mapping integration/tested riêng. Báo thật khi chưa commit hoặc không đổi. |
| content | Outcome/claim khai có coverage/nguồn; claim executable có proof chạy thật, ảnh sinh đã xem, ví dụ chưa chạy vẫn chưa xác minh. |

Chỉ ghi completion theo core schema sau khi proof thật đạt. Ghi spec trước khi lấy inputDigest; fail/not-run/inconclusive không thành done. Artifact bổ sung phải được liệt kê trong manifest assets và hash bytes thật.

## Tác động và giới hạn

- selected local content/assets/code edits
- scoped commits when authorized; no publication implied

Danh sách trên mô tả capability, không cấp quyền mới. Chỉ thực hiện effect trong ma trận op này và quyền hiện tại; không ghi ngoài ma trận, tự chạy op tiếp hay tự thêm agent/account/deploy/publish/cleanup chưa chọn. Effect đã được người dùng cho phép đúng phạm vi không cần xin lại chỉ vì đổi op.

## Blocker và điểm dừng

| Code | Điều kiện / thông tin cần |
| --- | --- |
| CONTENT_AUTHORITY_MISSING | Nguồn/claim fact/quyền/audience-outcome bắt buộc chưa rõ. |
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
