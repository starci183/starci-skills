# migration.release

Bản đối chiếu cho người đọc; bản tiếng Anh là thẩm quyền runtime.

Đọc đầy đủ [giao thức chung](common.md) và tài liệu này trước khi làm.

## Mục tiêu cụ thể

Apply tập migration source-owned được chọn rõ lên một target xác minh và chứng minh journal/dữ liệu.

Kind/profile: `release`. Chọn node cụ thể từ request hiện tại; không tự chạy toàn cây.

## Graph trong .work, không nằm trong op

Chỉ đọc graph node đã chọn. Không thêm/bỏ dependency, refs, required hoặc mở rộng scope để chạy/pass. Prerequisite thiếu/chưa done thì báo ID và dừng piece; nếu cần đổi graph, đề xuất scope update được chọn riêng. Không tự gọi op prerequisite.

## Đầu vào phải đọc và nguồn thẩm quyền

| ID | Đọc ở đâu | Đọc gì / vì sao |
| --- | --- | --- |
| target | N/node.md | Đọc N/node.md đã chọn đang tồn tại, scope cha, ref/dependency/assertion đã khai và freshness. Consumer op cần node đích có sẵn. Thiếu target là gap scope/graph: báo và đề xuất scope op được chọn riêng; không tạo target hay bịa acceptance/graph tại đây. |
| architecture | .work/<business>/architecture/**/node.md | Đọc ownership dữ liệu, operation/API/event, boundary/code-scope/lý do được graph .work đã chọn khai; tách file dự kiến với file thật. Không mặc định chain mọi op phải architecture trước; thiếu scope thật sự bắt buộc thì báo trước khi tiếp tục. |
| repo | repository:<repo-id>/<bound-paths> | Khi có/chọn source, resolve resource repo, checkout/root/HEAD/dirty thật; đọc hướng dẫn, manifest, code owner, caller, test. Greenfield/spec-only ghi source chưa tạo, lấy ý định từ yêu cầu; không bịa repo/trích dẫn fact. Implement source vẫn cần repo thật được chọn và được ghi. |
| environment | .work/_resources/environments/<environment>/resource.yaml | Đọc target/origin chính xác, owner, revision cấu hình, probe và tác động được phép; đối chiếu runtime thật, không suy danh tính từ hostname. |
| migration | selected source-owned migration files/runner/config + explicit target authority | Đọc ID/checksum migration, delta schema/data, source test, ràng buộc backup/rollback, cách inspect journal. Tạo/sửa code migration là scope implementation riêng. |

## Ghi gì vào đâu

| ID | Nơi ghi | Trường / section | Nội dung bắt buộc |
| --- | --- | --- | --- |
| node | N/node.md | state; blocker; completion.inputDigest; completion.evidence; completion.codeRefs | Đọc nguyên scope/assertion mong đợi/graph .work đã chọn. Ở đây chỉ ghi state/blocker/completion; observation/finding/mapping commit/cleanup còn lại ở evidence, không body ngữ nghĩa. Thiếu ref/dependency/acceptance thì báo gap hoặc cập nhật scope được chọn riêng; không thêm/bỏ để đạt pass. |
| evidence | E/manifest.yaml + E/journal-before.json + E/journal-after.json + E/migration-output.txt + E/replay.json + E/result.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Giữ checksum, runner/command thật, output đã che, journal/data trước/sau, kết quả replay/inspect no-op an toàn; không credential trong log. Kết quả quan sát chuyên môn ở E/result.md: Gắn target/schema/source migration chính xác, expected postcondition. Mutation production chỉ khi có quyền rõ đúng scope, không suy từ test code pass. |

## Thứ tự thực hiện hữu hạn

| # | Đọc ID | Ghi ID | Thực hiện và kiểm tra |
| --- | --- | --- | --- |
| 1 | migration, architecture, repo, environment, target | node | Kiểm target/quyền/revision nguồn/tập migration chính xác; inspect runner và giới hạn recovery trước effect DB. |
| 2 | migration, environment | evidence | Inspect journal/schema hiện tại, proof backup/precondition. Phân applied/pending an toàn/conflict/partial chưa rõ; không rerun mù effect partial. |
| 3 | migration, repo, environment | evidence | Chỉ chạy pending được phép bằng source runner thật đã xem, hoặc ghi no-op đã inspect. Giữ journal cũ/error output; không SQL sửa tùy ý/down tự động. |
| 4 | migration, environment, target | node, evidence | Kiểm invariant schema/data và journal sau chạy; replay no-op an toàn được hỗ trợ hoặc inspect để chứng minh không pending. Báo effect không đảo/partial rồi dừng không deploy. |

## Proof và điều kiện hoàn thành

| ID | Điều phải chứng minh |
| --- | --- |
| binding | Chạy validate workspace; ID/path trích dẫn tồn tại hoặc ghi rõ dự kiến, đủ assertions bắt buộc, binding còn mới; not-run/fail không được done. |
| migration | Tập chọn chính xác applied/no-op, chứng minh integrity journal và invariant dữ liệu; chỉ exit thành công không đủ. |

Chỉ ghi completion theo core schema sau khi proof thật đạt. Ghi spec trước khi lấy inputDigest; fail/not-run/inconclusive không thành done. Artifact bổ sung phải được liệt kê trong manifest assets và hash bytes thật.

## Tác động và giới hạn

- exact authorized schema/data migration only; no automatic down/restore/deploy

Danh sách trên mô tả capability, không cấp quyền mới. Chỉ thực hiện effect trong ma trận op này và quyền hiện tại; không ghi ngoài ma trận, tự chạy op tiếp hay tự thêm agent/account/deploy/publish/cleanup chưa chọn. Effect đã được người dùng cho phép đúng phạm vi không cần xin lại chỉ vì đổi op.

## Blocker và điểm dừng

| Code | Điều kiện / thông tin cần |
| --- | --- |
| MIGRATION_TARGET_UNKNOWN | Thiếu environment/schema/revision runner hoặc quyền mutation chính xác. |
| MIGRATION_PARTIAL | Journal/data/effect trước partial, conflict, chưa rõ; cần owner quyết recovery. |
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
