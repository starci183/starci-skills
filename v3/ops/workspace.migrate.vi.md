# workspace.migrate

Bản đối chiếu cho người đọc; bản tiếng Anh là thẩm quyền runtime.

Đọc đầy đủ [giao thức chung](common.md) và tài liệu này trước khi làm.

## Mục tiêu cụ thể

Bảo toàn và nhập một business/pilot đã chọn từ source và artifact đã kiểm tra vào .work canonical, không coi implementation hoặc UAT nhập vào là đã hoàn thành.

Kind/profile: `operations`. Chọn node cụ thể từ request hiện tại; không tự chạy toàn cây.

## Graph trong .work, không nằm trong op

Op này chỉ được khai/sửa graph thuộc scope đang được chọn rõ: dependsOn là node prerequisite cần done; refs là input ngữ nghĩa không tự chặn thực thi. Ghi quan hệ thật vào .work trước review; không tạo chain bắt buộc cho mọi business.

## Đầu vào phải đọc và nguồn thẩm quyền

| ID | Đọc ở đâu | Đọc gì / vì sao |
| --- | --- | --- |
| target | N/node.md | Đọc node đích, scope cha, refs, dependencies, assertions và freshness. Với target mới được yêu cầu, chưa tồn tại là đúng: đọc ancestor/workspace gần nhất rồi chỉ tạo scope đã chọn. Giữ phần chấp nhận không bị ảnh hưởng. |
| repo | repository:<repo-id>/<bound-paths> | Khi có/chọn source, resolve resource repo, checkout/root/HEAD/dirty thật; đọc hướng dẫn, manifest, code owner, caller, test. Greenfield/spec-only ghi source chưa tạo, lấy ý định từ yêu cầu; không bịa repo/trích dẫn fact. Implement source vẫn cần repo thật được chọn và được ghi. |
| intent | current explicit migration request + accepted business decisions | Xác định đúng một pilot, nơi canonical, scope review và có yêu cầu cleanup không. Tách ý định người dùng duyệt với hành vi suy từ source; quyền migrate không phải duyệt nghiệp vụ. |
| inventory | selected source checkout + actual Git status/log/worktree inventory + selected old artifact directories | Inspect identity repo, HEAD đầy đủ, thay đổi tracked, untracked/ignored, git worktree list --porcelain thật và worker/process đang dùng. Đọc entrypoint/route/handler/rule/schema/test cùng tài liệu/ảnh cũ được chọn. Text cũ là quan sát lịch sử chưa tin cậy; xem nội dung trước quyết định retention, không lộ secret. |
| custody | actual canonical repository/storage ownership + selected artifact retrieval and retention policy | Resolve nơi bền vững không tạm ngoài target xóa, quyền asset, sealed custody nếu có. Git log chỉ giữ dữ liệu commit; dirty/untracked/ignored và commit không reachable cần bản bảo toàn recoverable riêng đã kiểm. Có thể ghi ref account sẵn có nhưng không lấy secret/tạo account. |

## Ghi gì vào đâu

| ID | Nơi ghi | Trường / section | Nội dung bắt buộc |
| --- | --- | --- | --- |
| workspace | .work/workspace.yaml | schema; id; extensions | Chỉ khởi tạo workspace canonical mới được chọn rõ; giữ identity cũ. Không đặt canonical root trong target bỏ. |
| node | .work/<business>/node.md + .work/<business>/migration/node.md + optional .work/<business>/cleanup/node.md + selected imported child directories/node.md | schema; id; kind; required; dependsOn; refs; assertions; state; suspensionReason; completion; body: Pilot boundary / Observed source mapping / Approved intent / Candidate scope / Unknowns | N là lá operations migration-review, assertion inventory/bảo toàn/import; parent business không state/completion. Mọi lá business/architecture/implementation/UAT nhập mới bắt đầu state:suspended, suspensionReason cụ thể, không completion dù note cũ ghi done. Gán ID ổn định, tách citation source quan sát với requirement ứng viên, chỉ graph scope được phép. Không ghi đè node đã duyệt. Nếu preset được chọn rõ thì khai target business-review/workflow-review trước consumer; assertion chỉ review ý định và integrity graph nhập, không hoàn thành product. Cleanup nếu thuộc scope có lá operations ngang hàng tại .work/<business>/cleanup/node.md, không nằm dưới N, assertion xóa chính xác; N luôn là lá; cleanup chưa đủ điều kiện vẫn blocked, không biến parent thiếu thành done. Chỉ sửa graph thuộc scope được chọn rõ đã duyệt: prerequisite node IDs thật ở dependsOn, input ngữ nghĩa node/resource IDs ở refs. Không chain toàn catalogue hoặc scope khác; chốt graph/spec trước proof review. |
| resources | .work/_resources/repositories/<resource>/resource.yaml + .work/_resources/imports/<resource>/resource.yaml + .work/_resources/imports/<resource>/assets/<asset> | schema; id; kind; owner; revision; details; files:[{path}] | Ghi root/identity/commit đầy đủ và mapping source đã inspect ở details, phân fact quan sát/suy luận. Giữ tài liệu/hình nguồn-design không secret đã chọn trong imports assets, files path tương đối. Ảnh source không là evidence screenshot product. Giữ tên gốc/hash thật/origin trong inventory; chỉ ref custody account có sẵn truy xuất được, không secret. Gắn resource ID ở refs node nhập trước digest review. Không chép cả source repo/credential vào .work. |
| evidence | E/manifest.yaml + E/inventory.json + E/source-map.md + E/preservation.json + E/import-review.md + E/cleanup.json | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Inventory từng path: repo/commit gốc, tracked/dirty/untracked/ignored, hash bytes thật, phân loại, quyết định giữ, nơi bền vững và hash đọc lại hoặc chưa rõ. Row source có path/symbol/commit thật, hành vi quan sát, diễn giải business ứng viên, confidence/unknown và nguồn ý định riêng. Giữ UAT lịch sử dạng file lịch sử, không manifest pass mới. Chỉ assertion migration, output validate .work cuối, target/quyền/worker cleanup và action thật hoặc blocked/not-requested. Không bịa evidence assertion product của con. |
| source | repository:<repo-id>/<retirement-target> | optional exact old artifact-directory removal only; no product implementation edits | Chỉ khi cleanup được chọn và cho phép rõ: bỏ đúng thư mục cũ đã resolve sau khi hash bảo toàn/đọc lại, reachable commit history, dirty/untracked/ignored recoverable, ownership và không worker đều pass. Target không là root repo/.work canonical/parent rộng/symlink; dùng inventory worktree thật, không đoán theo tên. Git worktree đăng ký phải git worktree remove đúng target không force; thư mục artifact tùy chỉnh dùng move/removal recoverable cùng shell đúng target đã kiểm. Target ngoài ceiling repo hoặc bất kỳ check chưa chắc thì không xóa, cleanup blocked. Không account/deploy/cleanup rộng/force/raw recursive delete Git worktree. |

## Thứ tự thực hiện hữu hạn

| # | Đọc ID | Ghi ID | Thực hiện và kiểm tra |
| --- | --- | --- | --- |
| 1 | intent, target, repo, inventory, custody | workspace, evidence | Chốt một pilot và nơi canonical chính xác. Inspect target/ancestor; chỉ scope mới được chọn được phép chưa có. Inventory Git root/HEAD/status/worktree và artifact thật trước ghi/cleanup. Dừng nếu ownership hoặc boundary pilot mơ hồ. |
| 2 | repo, inventory, intent | evidence | Đọc source/test đúng phạm vi; map route/action/data/rule tới fact source ở commit thật. Báo mâu thuẫn/hành vi thiếu. Nghiệp vụ suy ra là candidate, không là ý định duyệt; dấu tick cũ/tồn tại test không chứng minh đã chạy hiện tại. |
| 3 | inventory, custody, repo | resources, evidence | Phân loại/giữ artifact bền vững không secret đã chọn; hash bytes gốc rồi đọc lại/hash nơi đích ngoài target cleanup. Kiểm lịch sử commit còn reachable và bảo toàn riêng dirty/untracked/ignored bằng custody an toàn sở hữu. Artifact thiếu/chứa secret chặn cleanup, không cho phép chép secret/bỏ dữ liệu. |
| 4 | intent, target, inventory, repo, custody | node, resources | Viết cây candidate đã chọn/resource source canonical. Lá nhập suspended với suspensionReason riêng tới khi review/implementation/UAT được chọn có proof riêng, không completion. Giữ node cũ duyệt. Chỉ khai edge thật/target review preset nếu được chọn; edge chưa rõ ghi unknown không bịa ID. |
| 5 | target, intent, inventory, custody, repo | source, evidence | Chỉ nếu chọn cleanup chính xác, inspect lại đăng ký worktree/inventory source-dirty/worker ngay trước xóa. Cần quyền xóa rõ, bytes bền vững đã kiểm, commit/uncommitted recoverable. Worktree đăng ký xóa bằng Git không force; thư mục artifact tùy chỉnh retire recoverable. Check fail thì giữ nguyên gốc, ghi cleanup riêng blocked. Không chạy op kế. |
| 6 | target, intent, inventory, repo, custody | node, evidence | Chốt scope/resource ngữ nghĩa trước, lấy inputDigest thật rồi kiểm ID/ref/assertion nhập/hash bảo toàn/state suspended. Chỉ ghi evidence migration quan sát và completion migration-review sau kiểm. Giữ con product suspended, cleanup trung thực; commit tài liệu đã chọn khi được phép, ghi commit thật riêng trong evidence, rồi dừng. |

## Proof và điều kiện hoàn thành

| ID | Điều phải chứng minh |
| --- | --- |
| binding | Chạy validate workspace; ID/path trích dẫn tồn tại hoặc ghi rõ dự kiến, đủ assertions bắt buộc, binding còn mới; not-run/fail không được done. |
| source | Mọi claim hành vi source có path/symbol/commit đầy đủ đã inspect và tách với ý định business duyệt; unknown hiển thị. |
| preservation | Mỗi artifact giữ có hash đọc lại trùng ở đích bền vững; dirty/untracked/ignored/history recoverable trước xóa. |
| suspension | Lá product nhập lưu suspended/suspensionReason, không completion; không thỏa dependency cần done hoặc nhận evidence migration thành acceptance product. |
| cleanup | Cleanup là không yêu cầu, retire chính xác an toàn đã chứng minh, hoặc blocked riêng và giữ gốc. Migrate thành công không giấu cleanup bắt buộc chưa xong. |

Chỉ ghi completion theo core schema sau khi proof thật đạt. Ghi spec trước khi lấy inputDigest; fail/not-run/inconclusive không thành done. Artifact bổ sung phải được liệt kê trong manifest assets và hash bytes thật.

## Tác động và giới hạn

- selected canonical workspace/resource/scope writes
- scoped documentation commits only when authorized
- optional explicitly authorized exact preserved artifact-directory retirement; registered Git worktree removal only through Git

Danh sách trên mô tả capability, không cấp quyền mới. Chỉ thực hiện effect trong ma trận op này và quyền hiện tại; không ghi ngoài ma trận, tự chạy op tiếp hay tự thêm agent/account/deploy/publish/cleanup chưa chọn. Effect đã được người dùng cho phép đúng phạm vi không cần xin lại chỉ vì đổi op.

## Blocker và điểm dừng

| Code | Điều kiện / thông tin cần |
| --- | --- |
| PILOT_SCOPE_UNKNOWN | Chưa resolve một boundary business, ownership source thật hoặc nơi canonical. |
| PRESERVATION_UNPROVEN | Bytes/history/uncommitted đã chọn chưa truy xuất trùng/recoverable ngoài target bỏ; giữ gốc. |
| RETIREMENT_UNSAFE | Thiếu/chưa chắc quyền xóa/ownership target/worker ngừng/đăng ký worktree; không xóa/force. |
| DECLARED_DEPENDENCY_UNMET | Prerequisite đã khai chưa effective done hoặc thiếu input/scope bắt buộc đã khai. Báo ID node/resource và đề xuất cập nhật graph được chọn riêng khi cần; không chạy predecessor hoặc nới dependsOn/refs/required để tiếp tục. |

Thêm các blocker chung trong common.md khi áp dụng. Ghi đúng quan sát và gap owner; không bịa input để tiếp tục. Kết thúc với kết quả/phạm vi/commit/evidence/gap rồi dừng. Op gợi ý tiếp theo không tự thực thi.

## Resolve placeholder

N/E/R theo common.md. Không ghi literal placeholder; path mới phải ghi rõ dự kiến.

| Placeholder | Nguồn giá trị |
| --- | --- |
| <repo-id> | Resolved repository resource ID / resource ID repo đã resolve |
| <bound-paths> | Inspected source read set / tập file nguồn cần đọc |
| <business> | Selected business slug / slug nghiệp vụ đã chọn |
| <resource> | Selected owned resource slug / slug resource thuộc quyền sửa |
| <asset> | Actual selected source asset filename/format / tên file-định dạng asset nguồn thật đã chọn |
| <retirement-target> | Exact inventoried old directory relative to the bound repository, verified within the selected ceiling / thư mục cũ inventory chính xác tương đối repo trong ceiling |
