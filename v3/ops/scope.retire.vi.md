# scope.retire

Bản đối chiếu cho người đọc; bản tiếng Anh là thẩm quyền runtime.

Đọc đầy đủ [giao thức chung](common.md) và tài liệu này trước khi làm.

## Mục tiêu cụ thể

Retire đúng scope business/resource được chọn, giữ evidence cần và consumer còn dùng.

Kind/profile: `operations`. Chọn node cụ thể từ request hiện tại; không tự chạy toàn cây.

## Graph trong .work, không nằm trong op

Op này chỉ được khai/sửa graph thuộc scope đang được chọn rõ: dependsOn là node prerequisite cần done; refs là input ngữ nghĩa không tự chặn thực thi. Ghi quan hệ thật vào .work trước review; không tạo chain bắt buộc cho mọi business.

## Đầu vào phải đọc và nguồn thẩm quyền

| ID | Đọc ở đâu | Đọc gì / vì sao |
| --- | --- | --- |
| target | N/node.md | Đọc node đích, scope cha, refs, dependencies, assertions và freshness. Với target mới được yêu cầu, chưa tồn tại là đúng: đọc ancestor/workspace gần nhất rồi chỉ tạo scope đã chọn. Giữ phần chấp nhận không bị ảnh hưởng. |
| repo | repository:<repo-id>/<bound-paths> | Khi có/chọn source, resolve resource repo, checkout/root/HEAD/dirty thật; đọc hướng dẫn, manifest, code owner, caller, test. Greenfield/spec-only ghi source chưa tạo, lấy ý định từ yêu cầu; không bịa repo/trích dẫn fact. Implement source vẫn cần repo thật được chọn và được ghi. |
| inventory | selected nodes/resources + incoming refs + actual Git worktree inventory | Đọc yêu cầu retire, ID ổn định, ref đang trỏ tới, retention/custody, artifact tracked/dirty/untracked, registration worktree thật. Tên .worktrees không chứng minh dữ liệu bỏ được. |
| authority | explicit retirement/deletion scope + durable storage policy | Đọc tập xóa được chọn rõ, giới hạn phục hồi; mặc định retire là quyết định metadata đúng scope, không xóa đệ quy. |

## Ghi gì vào đâu

| ID | Nơi ghi | Trường / section | Nội dung bắt buộc |
| --- | --- | --- | --- |
| node | N/node.md | state; blocker; completion.inputDigest; completion.evidence; dependsOn; refs; assertions; required | Chỉ ghi quyết định/scope retirement được phép rõ trước review; giữ ID/nghĩa vụ. Quan sát xóa/retention thật nằm ở evidence. Chỉ sửa graph thuộc scope được chọn rõ đã duyệt: prerequisite node IDs thật ở dependsOn, input ngữ nghĩa node/resource IDs ở refs. Không chain toàn catalogue hoặc scope khác; chốt graph/spec trước proof review. |
| evidence | E/manifest.yaml + E/retirement-inventory.json + E/retention-check.json + E/removal.json only when selected + E/result.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Ghi artifact/owner/destination an toàn/hash-readability xác minh, outcome xóa đã chọn/giới hạn phục hồi; không chép secret plaintext. Kết quả quan sát chuyên môn ở E/result.md: Ghi scope retire/thẩm quyền quyết định/ID thay thế khi có/disposition consumer/retention-access. Giữ identity, không đổi việc bắt buộc chưa xong sang na nếu chưa có quyết định scope thật. |

## Thứ tự thực hiện hữu hạn

| # | Đọc ID | Ghi ID | Thực hiện và kiểm tra |
| --- | --- | --- | --- |
| 1 | inventory, authority, repo, target | evidence | Inventory node/resource chọn, Git state, ảnh/evidence/account custody ref, consumer đang dùng. Tách artifact .worktrees bền tùy biến với checkout Git quản. |
| 2 | inventory, authority | node | Resolve disposition preserve/replace/defer/retire của consumer và retention/recovery. Thiếu quyết định/custody chặn xóa, không chặn inventory chỉ đọc. |
| 3 | inventory, authority, repo | evidence | Kiểm artifact bền bắt buộc được giữ/đọc lại tại đích duyệt trước xóa được chọn rõ. Resolve absolute target/link-junction/registration worktree; không xóa đệ quy root/workspace rộng. |
| 4 | inventory, authority, repo | evidence | Chỉ thực thi effect retire chính xác được phép riêng, ưu tiên phục hồi được và lifecycle Git worktree phù hợp. Giữ việc user chưa commit/untracked; owner chưa chắc thì dừng xóa. |
| 5 | target, inventory, authority | node, evidence | Validate ref/readability còn lại, báo phần retire/xóa thật/giữ/khôi phục được. Dừng, không tiện dọn việc bên cạnh. |

## Proof và điều kiện hoàn thành

| ID | Điều phải chứng minh |
| --- | --- |
| binding | Chạy validate workspace; ID/path trích dẫn tồn tại hoặc ghi rõ dự kiến, đủ assertions bắt buộc, binding còn mới; not-run/fail không được done. |
| retention | Không mất consumer còn cần hoặc bản duy nhất evidence/custody; effect chọn và trạng thái phục hồi được quan sát thật. |

Chỉ ghi completion theo core schema sau khi proof thật đạt. Ghi spec trước khi lấy inputDigest; fail/not-run/inconclusive không thành done. Artifact bổ sung phải được liệt kê trong manifest assets và hash bytes thật.

## Tác động và giới hạn

- explicit retirement metadata and separately authorized exact destructive actions only

Danh sách trên mô tả capability, không cấp quyền mới. Chỉ thực hiện effect trong ma trận op này và quyền hiện tại; không ghi ngoài ma trận, tự chạy op tiếp hay tự thêm agent/account/deploy/publish/cleanup chưa chọn. Effect đã được người dùng cho phép đúng phạm vi không cần xin lại chỉ vì đổi op.

## Blocker và điểm dừng

| Code | Điều kiện / thông tin cần |
| --- | --- |
| RETIREMENT_UNSAFE | Target/owner user/disposition consumer/retention bền chưa rõ. |
| DECLARED_DEPENDENCY_UNMET | Prerequisite đã khai chưa effective done hoặc thiếu input/scope bắt buộc đã khai. Báo ID node/resource và đề xuất cập nhật graph được chọn riêng khi cần; không chạy predecessor hoặc nới dependsOn/refs/required để tiếp tục. |

Thêm các blocker chung trong common.md khi áp dụng. Ghi đúng quan sát và gap owner; không bịa input để tiếp tục. Kết thúc với kết quả/phạm vi/commit/evidence/gap rồi dừng. Op gợi ý tiếp theo không tự thực thi.

## Resolve placeholder

N/E/R theo common.md. Không ghi literal placeholder; path mới phải ghi rõ dự kiến.

| Placeholder | Nguồn giá trị |
| --- | --- |
| <repo-id> | Resolved repository resource ID / resource ID repo đã resolve |
| <bound-paths> | Inspected source read set / tập file nguồn cần đọc |
