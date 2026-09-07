# git.publish

Bản đối chiếu cho người đọc; bản tiếng Anh là thẩm quyền runtime.

Đọc đầy đủ [giao thức chung](common.md) và tài liệu này trước khi làm.

## Mục tiêu cụ thể

Publish đúng boundary commit/ref Git đã chọn rõ và xác minh, rồi đọc lại.

Kind/profile: `release`. Chọn node cụ thể từ request hiện tại; không tự chạy toàn cây.

## Graph trong .work, không nằm trong op

Chỉ đọc graph node đã chọn. Không thêm/bỏ dependency, refs, required hoặc mở rộng scope để chạy/pass. Prerequisite thiếu/chưa done thì báo ID và dừng piece; nếu cần đổi graph, đề xuất scope update được chọn riêng. Không tự gọi op prerequisite.

## Đầu vào phải đọc và nguồn thẩm quyền

| ID | Đọc ở đâu | Đọc gì / vì sao |
| --- | --- | --- |
| target | N/node.md | Đọc N/node.md đã chọn đang tồn tại, scope cha, ref/dependency/assertion đã khai và freshness. Consumer op cần node đích có sẵn. Thiếu target là gap scope/graph: báo và đề xuất scope op được chọn riêng; không tạo target hay bịa acceptance/graph tại đây. |
| repo | repository:<repo-id>/<bound-paths> | Khi có/chọn source, resolve resource repo, checkout/root/HEAD/dirty thật; đọc hướng dẫn, manifest, code owner, caller, test. Greenfield/spec-only ghi source chưa tạo, lấy ý định từ yêu cầu; không bịa repo/trích dẫn fact. Implement source vẫn cần repo thật được chọn và được ghi. |
| publication | actual Git remote/ref policy + selected commits/evidence + explicit publish request | Đọc remote/ref đích, SHA giao đủ, scope file đổi, hook/check bắt buộc. Yêu cầu commit local không tự cho push/tag/PR/merge/cleanup. |

## Ghi gì vào đâu

| ID | Nơi ghi | Trường / section | Nội dung bắt buộc |
| --- | --- | --- | --- |
| node | N/node.md | state; blocker; completion.inputDigest; completion.evidence; completion.codeRefs | Đọc nguyên scope/assertion mong đợi/graph .work đã chọn. Ở đây chỉ ghi state/blocker/completion; observation/finding/mapping commit/cleanup còn lại ở evidence, không body ngữ nghĩa. Thiếu ref/dependency/acceptance thì báo gap hoặc cập nhật scope được chọn riêng; không thêm/bỏ để đạt pass. |
| evidence | E/manifest.yaml + E/git-publication.json + E/hook-output.txt + E/lineage.json + E/result.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Ghi ref local/remote trước/sau, command/exit thật, diff/ancestry xác minh, check tại head integration thật. Kết quả quan sát chuyên môn ở E/result.md: Ghi SHA gốc/integrated/published riêng, ref đích, kết quả publication thật; không mặc định cleanup worktree. |

## Thứ tự thực hiện hữu hạn

| # | Đọc ID | Ghi ID | Thực hiện và kiểm tra |
| --- | --- | --- | --- |
| 1 | repo, publication, target | node | Kiểm remote/ref/action được chọn rõ và commit nguồn đủ; inspect dirty/staged scope không gộp việc ngoài. |
| 2 | repo, publication | evidence | Inspect ref remote/local, policy branch, check/hook bắt buộc. Nếu có integration thì review diff/conflict và retest kết quả thật; không amend/rebase/squash/force workaround. |
| 3 | publication, repo | evidence | Chỉ thực hiện integration/publication được yêu cầu rõ, không force, giữ hook. Tag/PR chỉ khi được chỉ định; effect bị từ chối/chưa rõ cần đọc lại trước retry. |
| 4 | publication, repo, target | node, evidence | Đọc ref đích lại, so SHA mong đợi chính xác, ghi lineage/giới hạn thật, rồi dừng không xóa branch/worktree/evidence hoặc dừng runtime. |

## Proof và điều kiện hoàn thành

| ID | Điều phải chứng minh |
| --- | --- |
| binding | Chạy validate workspace; ID/path trích dẫn tồn tại hoặc ghi rõ dự kiến, đủ assertions bắt buộc, binding còn mới; not-run/fail không được done. |
| published-ref | Remote/ref thật bằng publication đã chọn xác minh; hook/push fail hoặc read-back chưa rõ không phải thành công. |

Chỉ ghi completion theo core schema sau khi proof thật đạt. Ghi spec trước khi lấy inputDigest; fail/not-run/inconclusive không thành done. Artifact bổ sung phải được liệt kê trong manifest assets và hash bytes thật.

## Tác động và giới hạn

- explicitly authorized local integration and/or non-force remote publication

Danh sách trên mô tả capability, không cấp quyền mới. Chỉ thực hiện effect trong ma trận op này và quyền hiện tại; không ghi ngoài ma trận, tự chạy op tiếp hay tự thêm agent/account/deploy/publish/cleanup chưa chọn. Effect đã được người dùng cho phép đúng phạm vi không cần xin lại chỉ vì đổi op.

## Blocker và điểm dừng

| Code | Điều kiện / thông tin cần |
| --- | --- |
| PUBLISH_NOT_AUTHORIZED | Scope không cho remote/ref/tag/integration effect này. |
| GIT_DIVERGED | Divergence bất ngờ/hook fail/dirty overlap cản publication an toàn. |
| DECLARED_DEPENDENCY_UNMET | Prerequisite đã khai chưa effective done hoặc thiếu input/scope bắt buộc đã khai. Báo ID node/resource và đề xuất cập nhật graph được chọn riêng khi cần; không chạy predecessor hoặc nới dependsOn/refs/required để tiếp tục. |

Thêm các blocker chung trong common.md khi áp dụng. Ghi đúng quan sát và gap owner; không bịa input để tiếp tục. Kết thúc với kết quả/phạm vi/commit/evidence/gap rồi dừng. Op gợi ý tiếp theo không tự thực thi.

## Resolve placeholder

N/E/R theo common.md. Không ghi literal placeholder; path mới phải ghi rõ dự kiến.

| Placeholder | Nguồn giá trị |
| --- | --- |
| <repo-id> | Resolved repository resource ID / resource ID repo đã resolve |
| <bound-paths> | Inspected source read set / tập file nguồn cần đọc |
