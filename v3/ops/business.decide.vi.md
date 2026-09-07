# business.decide

Bản đối chiếu cho người đọc; bản tiếng Anh là thẩm quyền runtime.

Đọc đầy đủ [giao thức chung](common.md) và tài liệu này trước khi làm.

## Mục tiêu cụ thể

Viết chuẩn nghiệp vụ được chọn đủ rõ để implement và nghiệm thu độc lập.

Kind/profile: `business`. Chọn node cụ thể từ request hiện tại; không tự chạy toàn cây.

## Graph trong .work, không nằm trong op

Op này chỉ được khai/sửa graph thuộc scope đang được chọn rõ: dependsOn là node prerequisite cần done; refs là input ngữ nghĩa không tự chặn thực thi. Ghi quan hệ thật vào .work trước review; không tạo chain bắt buộc cho mọi business.

## Đầu vào phải đọc và nguồn thẩm quyền

| ID | Đọc ở đâu | Đọc gì / vì sao |
| --- | --- | --- |
| target | N/node.md | Đọc node đích, scope cha, refs, dependencies, assertions và freshness. Với target mới được yêu cầu, chưa tồn tại là đúng: đọc ancestor/workspace gần nhất rồi chỉ tạo scope đã chọn. Giữ phần chấp nhận không bị ảnh hưởng. |
| repo | repository:<repo-id>/<bound-paths> | Khi có/chọn source, resolve resource repo, checkout/root/HEAD/dirty thật; đọc hướng dẫn, manifest, code owner, caller, test. Greenfield/spec-only ghi source chưa tạo, lấy ý định từ yêu cầu; không bịa repo/trích dẫn fact. Implement source vẫn cần repo thật được chọn và được ghi. |
| intent | current accepted user intent + supplied domain documents | Phân loại từng phát biểu: ý định, fact quan sát, ví dụ, đề xuất, unknown, mâu thuẫn; gắn nguồn/revision. Hành vi cũ không cấp quyền tạo rule mới. |

## Ghi gì vào đâu

| ID | Nơi ghi | Trường / section | Nội dung bắt buộc |
| --- | --- | --- | --- |
| node | .work/<business>/business/<piece>/node.md | body: Objective / Glossary / Actors & permissions / FR / NFR / Business rules / Non-business constraints / State transitions / Acceptance / Decisions / Open questions; refs; assertions; extensions.work3.decisions; dependsOn; required | FR gồm ID, actor, trigger, precondition, input/schema, xử lý/kết quả, lỗi/từ chối, postcondition, ưu tiên, nguồn, AC refs. NFR có metric, target số khi đã quyết, đơn vị, tải, percentile/window, môi trường, cách đo, nguồn; chưa quyết thì unknown. BR có điều kiện, quyết định, thẩm quyền, transition và ngoại lệ. Tách ràng buộc kỹ thuật/hợp đồng khỏi chính sách domain. Chỉ sửa graph thuộc scope được chọn rõ đã duyệt: prerequisite node IDs thật ở dependsOn, input ngữ nghĩa node/resource IDs ở refs. Không chain toàn catalogue hoặc scope khác; chốt graph/spec trước proof review. |
| evidence | E/manifest.yaml + E/coverage-review.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Ghi coverage requirement–acceptance, quan sát nguồn cụ thể và mâu thuẫn chưa giải quyết; review spec không phải bằng chứng implementation. |

## Thứ tự thực hiện hữu hạn

| # | Đọc ID | Ghi ID | Thực hiện và kiểm tra |
| --- | --- | --- | --- |
| 1 | target, intent, repo | node | Lập domain thật: goal/non-goal, role, ownership, thuật ngữ, consumer và rule thấy trong source. Fact gắn repo/path/revision; yêu cầu mới là ý định. |
| 2 | intent, target | node | Liệt kê FR gồm input sai, bị từ chối, retry, concurrency, hủy và phục hồi khi áp dụng. Tách output và side effect lưu trữ. |
| 3 | intent, repo | node | Viết NFR đo được và non-business constraints riêng: hiệu năng, availability, accessibility, security/privacy, observability, retention, compatibility, giới hạn vận hành. Không bịa luật hay ngưỡng số để lấp ô. |
| 4 | intent, repo | node | Lập ma trận actor–action–resource và transition: from, trigger, guard, writer, to, effect, failure/no-op, lặp lại, bất biến. Nêu ưu tiên khi rule xung đột. |
| 5 | intent, target | node | Viết AC có ID dạng Given/When/Then hoặc assertion quan sát được; gồm positive/negative/boundary. Liên kết FR/NFR/BR, flow UAT dự kiến và công cụ chứng minh; expected chốt trước implementation. |
| 6 | intent, target | node | Mỗi requirement/consumer chọn implement/preserve/defer/không áp dụng; ghi lý do, thẩm quyền, owner, điều kiện xem lại. Defer không tự loại scope bắt buộc nếu người dùng chưa quyết. |
| 7 | target, repo, intent | evidence | Review mỗi requirement có nơi nghiệm thu rõ, mỗi claim đang enforce có source thật. Gom gap quan trọng, giữ dòng không đổi đã chấp nhận, rồi chỉ kết thúc piece BA. |

## Proof và điều kiện hoàn thành

| ID | Điều phải chứng minh |
| --- | --- |
| binding | Chạy validate workspace; ID/path trích dẫn tồn tại hoặc ghi rõ dự kiến, đủ assertions bắt buộc, binding còn mới; not-run/fail không được done. |
| coverage | FR/NFR/BR áp dụng có AC IDs và nguồn ý định; NFR nhanh/an toàn/dễ dùng mơ hồ không được coi đo được. Không đổi trạng thái implementation/UAT. |

Chỉ ghi completion theo core schema sau khi proof thật đạt. Ghi spec trước khi lấy inputDigest; fail/not-run/inconclusive không thành done. Artifact bổ sung phải được liệt kê trong manifest assets và hash bytes thật.

## Tác động và giới hạn

Chỉ metadata/evidence thuộc scope được giao; không mutation product hoặc dịch vụ ngoài.

Danh sách trên mô tả capability, không cấp quyền mới. Chỉ thực hiện effect trong ma trận op này và quyền hiện tại; không ghi ngoài ma trận, tự chạy op tiếp hay tự thêm agent/account/deploy/publish/cleanup chưa chọn. Effect đã được người dùng cho phép đúng phạm vi không cần xin lại chỉ vì đổi op.

## Blocker và điểm dừng

| Code | Điều kiện / thông tin cần |
| --- | --- |
| BUSINESS_UNKNOWN | Rule bắt buộc, quyền actor, ngưỡng hoặc expected thiếu quyết định thẩm quyền. |
| BUSINESS_CONTRADICTION | Nguồn đã chấp nhận mâu thuẫn; giữ hai trích dẫn và hỏi owner thật, không dung hòa tùy ý. |
| DECLARED_DEPENDENCY_UNMET | Prerequisite đã khai chưa effective done hoặc thiếu input/scope bắt buộc đã khai. Báo ID node/resource và đề xuất cập nhật graph được chọn riêng khi cần; không chạy predecessor hoặc nới dependsOn/refs/required để tiếp tục. |

Thêm các blocker chung trong common.md khi áp dụng. Ghi đúng quan sát và gap owner; không bịa input để tiếp tục. Kết thúc với kết quả/phạm vi/commit/evidence/gap rồi dừng. Op gợi ý tiếp theo không tự thực thi.

## Resolve placeholder

N/E/R theo common.md. Không ghi literal placeholder; path mới phải ghi rõ dự kiến.

| Placeholder | Nguồn giá trị |
| --- | --- |
| <repo-id> | Resolved repository resource ID / resource ID repo đã resolve |
| <bound-paths> | Inspected source read set / tập file nguồn cần đọc |
| <business> | Selected business slug / slug nghiệp vụ đã chọn |
| <piece> | Stable selected piece slug / slug piece đã chọn |
