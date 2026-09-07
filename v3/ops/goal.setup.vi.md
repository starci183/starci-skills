# goal.setup

Bản đối chiếu cho người đọc; bản tiếng Anh là thẩm quyền runtime.

Đọc đầy đủ [giao thức chung](common.md) và tài liệu này trước khi làm.

## Mục tiêu cụ thể

Thiết lập một mục đích nghiệp vụ và cây completion ban đầu, chưa chạy việc product.

Kind/profile: `business`. Chọn node cụ thể từ request hiện tại; không tự chạy toàn cây.

## Graph trong .work, không nằm trong op

Op này chỉ được khai/sửa graph thuộc scope đang được chọn rõ: dependsOn là node prerequisite cần done; refs là input ngữ nghĩa không tự chặn thực thi. Ghi quan hệ thật vào .work trước review; không tạo chain bắt buộc cho mọi business.

## Đầu vào phải đọc và nguồn thẩm quyền

| ID | Đọc ở đâu | Đọc gì / vì sao |
| --- | --- | --- |
| intent | current user request + existing .work/workspace.yaml | Đọc mục tiêu người dùng thật sự yêu cầu, scope đã thống nhất và identity workspace; không biến ví dụ/ý tưởng tương lai thành nghĩa vụ. |
| target | N/node.md | Đọc node đích, scope cha, refs, dependencies, assertions và freshness. Với target mới được yêu cầu, chưa tồn tại là đúng: đọc ancestor/workspace gần nhất rồi chỉ tạo scope đã chọn. Giữ phần chấp nhận không bị ảnh hưởng. |

## Ghi gì vào đâu

| ID | Nơi ghi | Trường / section | Nội dung bắt buộc |
| --- | --- | --- | --- |
| workspace | .work/workspace.yaml | schema; id; extensions | Chỉ khởi tạo workspace canonical mới được yêu cầu; dùng workspace cũ nguyên trạng. Không bịa resource repo/environment để đủ setup. |
| node | .work/<business>/node.md + .work/<business>/setup/node.md + selected child directories/node.md | id; kind; required; dependsOn; refs; assertions; body: Purpose / Scope / Done when / Decisions / Unknowns; extensions.work3.nativeGoal: actual returned current-task goal reference only | Ghi mục đích cha không có state. Lá setup duy nhất .work/<business>/setup/node.md là N của op, kind business, chỉ có assertion review scope. Mọi lá nghiệp vụ/kiến trúc/code/UAT dự kiến vẫn todo, hoặc blocked/na có lý do thật. Tách implement/defer/không áp dụng; ID requirement chỉ có một nơi. Chỉ sửa graph thuộc scope được chọn rõ đã duyệt: prerequisite node IDs thật ở dependsOn, input ngữ nghĩa node/resource IDs ở refs. Không chain toàn catalogue hoặc scope khác; chốt graph/spec trước proof review. |
| evidence | E/manifest.yaml + E/scope-review.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Giữ trích dẫn ý định và review scope/coverage thật chỉ dưới lá setup. Chỉ setup done sau evidence review thật/validate; scaffold ban đầu chưa completion. Không code/UAT pass. |

## Thứ tự thực hiện hữu hạn

| # | Đọc ID | Ghi ID | Thực hiện và kiểm tra |
| --- | --- | --- | --- |
| 1 | intent, target | workspace, node | Resolve workspace canonical hiện có, hoặc chỉ khởi tạo identity workspace mới được yêu cầu; chốt một mục đích, actor/kết quả đã nói, phần làm/không làm. Hành vi chưa nói là unknown. |
| 2 | intent, target | node | Chia mục đích thành cây completion nhỏ đủ dùng. Một task có thể ba flow UAT nhưng mỗi flow có lá UI/UX riêng; không bung stage không liên quan. |
| 3 | intent, target | node | Ghi applicability và dependency bằng ID ổn định. Defer có lý do/owner/mốc xem lại và vẫn hiện; không đổi thành done/na. Dùng lại duyệt đã có, chỉ hỏi scope quan trọng chưa rõ. |
| 4 | intent, target | node | Khi người dùng yêu cầu rõ native goal cho chat/task hiện tại và có goal tool thật hỗ trợ, inspect/tạo/dùng lại theo tool contract; chỉ lưu ref thật trả về trong extensions.work3.nativeGoal. Còn lại giữ purpose ở .work và chat. Không bịa goal ID hoặc tự tạo task/goal agent riêng. |
| 5 | target | evidence | Review cây so với mục đích gốc, validate refs, chỉ gợi ý op đủ điều kiện. Dừng, không dispatch/cook con. |

## Proof và điều kiện hoàn thành

| ID | Điều phải chứng minh |
| --- | --- |
| binding | Chạy validate workspace; ID/path trích dẫn tồn tại hoặc ghi rõ dự kiến, đủ assertions bắt buộc, binding còn mới; not-run/fail không được done. |
| scope | Mọi kết quả được yêu cầu có lá bắt buộc, quyết định defer rõ hoặc không áp dụng có lý do; setup xong không kéo implementation sang done. |

Chỉ ghi completion theo core schema sau khi proof thật đạt. Ghi spec trước khi lấy inputDigest; fail/not-run/inconclusive không thành done. Artifact bổ sung phải được liệt kê trong manifest assets và hash bytes thật.

## Tác động và giới hạn

- native current-task goal creation/reuse only when explicitly requested and supported

Danh sách trên mô tả capability, không cấp quyền mới. Chỉ thực hiện effect trong ma trận op này và quyền hiện tại; không ghi ngoài ma trận, tự chạy op tiếp hay tự thêm agent/account/deploy/publish/cleanup chưa chọn. Effect đã được người dùng cho phép đúng phạm vi không cần xin lại chỉ vì đổi op.

## Blocker và điểm dừng

| Code | Điều kiện / thông tin cần |
| --- | --- |
| PURPOSE_AMBIGUOUS | Còn nhiều mục đích hoặc identity repo khác nhau về bản chất chưa xác định. |
| DECLARED_DEPENDENCY_UNMET | Prerequisite đã khai chưa effective done hoặc thiếu input/scope bắt buộc đã khai. Báo ID node/resource và đề xuất cập nhật graph được chọn riêng khi cần; không chạy predecessor hoặc nới dependsOn/refs/required để tiếp tục. |

Thêm các blocker chung trong common.md khi áp dụng. Ghi đúng quan sát và gap owner; không bịa input để tiếp tục. Kết thúc với kết quả/phạm vi/commit/evidence/gap rồi dừng. Op gợi ý tiếp theo không tự thực thi.

## Resolve placeholder

N/E/R theo common.md. Không ghi literal placeholder; path mới phải ghi rõ dự kiến.

| Placeholder | Nguồn giá trị |
| --- | --- |
| <business> | Selected business slug / slug nghiệp vụ đã chọn |
