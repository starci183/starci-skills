# knowledge.repair

Bản đối chiếu cho người đọc; bản tiếng Anh là thẩm quyền runtime.

Đọc đầy đủ [giao thức chung](common.md) và tài liệu này trước khi làm.

## Mục tiêu cụ thể

Sửa một instruction/rule canonical bị phản biện và bản dịch từ evidence áp dụng cụ thể.

Kind/profile: `implementation`. Chọn node cụ thể từ request hiện tại; không tự chạy toàn cây.

## Graph trong .work, không nằm trong op

Chỉ đọc graph node đã chọn. Không thêm/bỏ dependency, refs, required hoặc mở rộng scope để chạy/pass. Prerequisite thiếu/chưa done thì báo ID và dừng piece; nếu cần đổi graph, đề xuất scope update được chọn riêng. Không tự gọi op prerequisite.

## Đầu vào phải đọc và nguồn thẩm quyền

| ID | Đọc ở đâu | Đọc gì / vì sao |
| --- | --- | --- |
| target | N/node.md | Đọc N/node.md đã chọn đang tồn tại, scope cha, ref/dependency/assertion đã khai và freshness. Consumer op cần node đích có sẵn. Thiếu target là gap scope/graph: báo và đề xuất scope op được chọn riêng; không tạo target hay bịa acceptance/graph tại đây. |
| repo | repository:<repo-id>/<bound-paths> | Khi có/chọn source, resolve resource repo, checkout/root/HEAD/dirty thật; đọc hướng dẫn, manifest, code owner, caller, test. Greenfield/spec-only ghi source chưa tạo, lấy ý định từ yêu cầu; không bịa repo/trích dẫn fact. Implement source vẫn cần repo thật được chọn và được ghi. |
| rule | selected canonical knowledge file + mirror + applicable owner maintenance policy + original challenge evidence | Đọc rule ID/case thật, owner/caller, phản ví dụ quan sát, enforcement hiện có; nếu sửa skill phải đọc đầy đủ hướng dẫn skill liên quan. |

## Ghi gì vào đâu

| ID | Nơi ghi | Trường / section | Nội dung bắt buộc |
| --- | --- | --- | --- |
| node | N/node.md | state; blocker; completion.inputDigest; completion.evidence; completion.codeRefs | Đọc nguyên scope/assertion mong đợi/graph .work đã chọn. Ở đây chỉ ghi state/blocker/completion; observation/finding/mapping commit/cleanup còn lại ở evidence, không body ngữ nghĩa. Thiếu ref/dependency/acceptance thì báo gap hoặc cập nhật scope được chọn riêng; không thêm/bỏ để đạt pass. |
| source | repository:<repo-id>/<write-ceiling> | source files; tests; migration/assets/config only when selected | Chỉ file thuộc code-scope được giao cùng caller/integration cần thiết nhỏ nhất; ghi diff và commit thật, không coi dự kiến là đã giao. |
| evidence | E/manifest.yaml + E/rule-review.md + E/validation.json + E/lineage.json + E/result.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Giữ findings applicability, path authority trước/sau chính xác, validator/citation/mirror check thật, retest context gốc khi chọn. Kết quả quan sát chuyên môn ở E/result.md: Ghi lý do có proof và owner canonical; giữ ID rule/scope đúng cũ. Sở thích một lần không thành luật chung. |

## Thứ tự thực hiện hữu hạn

| # | Đọc ID | Ghi ID | Thực hiện và kiểm tra |
| --- | --- | --- | --- |
| 1 | target, rule, repo | — | Theo chính sách bảo trì thật của owner được chọn, kiểm lỗi là hổng enforcement/thiếu concept/rule sai/concept trùng. Chọn một owner canonical trước sửa. |
| 2 | rule, repo | source | Sửa rule/gate/step nhỏ đúng scope, ID ổn định, mirror Việt cùng commit, không luật riêng product. Cập nhật caller/contract thật cùng; không lén workaround consumer. |
| 3 | rule, repo | evidence | Chạy validation/citation/parity/regression behavior thật liên quan. Tài liệu generate dùng generator owner; inspect thay đổi, không coi shape text chứng minh chỉ dẫn tốt. |
| 4 | target, rule, repo | node, evidence | Commit phần sở hữu khi được phép, báo context gốc cần đánh giá lại. Không tự rerun op gốc/claim visual đúng. |

## Proof và điều kiện hoàn thành

| ID | Điều phải chứng minh |
| --- | --- |
| binding | Chạy validate workspace; ID/path trích dẫn tồn tại hoặc ghi rõ dự kiến, đủ assertions bắt buộc, binding còn mới; not-run/fail không được done. |
| commit | Đọc staged diff chính xác và test thật; gắn SHA nguồn đầy đủ theo repo, lưu mapping integration/tested riêng. Báo thật khi chưa commit hoặc không đổi. |
| knowledge | Sửa theo owner canonical/evidence applicability thật; mirror/ref/regression áp dụng validate. |

Chỉ ghi completion theo core schema sau khi proof thật đạt. Ghi spec trước khi lấy inputDigest; fail/not-run/inconclusive không thành done. Artifact bổ sung phải được liệt kê trong manifest assets và hash bytes thật.

## Tác động và giới hạn

- exact authorized knowledge source/mirror edits
- scoped local commits when authorized

Danh sách trên mô tả capability, không cấp quyền mới. Chỉ thực hiện effect trong ma trận op này và quyền hiện tại; không ghi ngoài ma trận, tự chạy op tiếp hay tự thêm agent/account/deploy/publish/cleanup chưa chọn. Effect đã được người dùng cho phép đúng phạm vi không cần xin lại chỉ vì đổi op.

## Blocker và điểm dừng

| Code | Điều kiện / thông tin cần |
| --- | --- |
| RULE_OWNER_UNKNOWN | Không gắn challenge vào owner/case áp dụng canonical được hoặc cần quyền rộng hơn. |
| DECLARED_DEPENDENCY_UNMET | Prerequisite đã khai chưa effective done hoặc thiếu input/scope bắt buộc đã khai. Báo ID node/resource và đề xuất cập nhật graph được chọn riêng khi cần; không chạy predecessor hoặc nới dependsOn/refs/required để tiếp tục. |

Thêm các blocker chung trong common.md khi áp dụng. Ghi đúng quan sát và gap owner; không bịa input để tiếp tục. Kết thúc với kết quả/phạm vi/commit/evidence/gap rồi dừng. Op gợi ý tiếp theo không tự thực thi.

## Resolve placeholder

N/E/R theo common.md. Không ghi literal placeholder; path mới phải ghi rõ dự kiến.

| Placeholder | Nguồn giá trị |
| --- | --- |
| <repo-id> | Resolved repository resource ID / resource ID repo đã resolve |
| <bound-paths> | Inspected source read set / tập file nguồn cần đọc |
| <write-ceiling> | Explicit owned source paths / tập file nguồn được ghi |
