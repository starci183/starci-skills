# runtime.serve

Bản đối chiếu cho người đọc; bản tiếng Anh là thẩm quyền runtime.

Đọc đầy đủ [giao thức chung](common.md) và tài liệu này trước khi làm.

## Mục tiêu cụ thể

Đưa một runtime phát triển đã chọn tới state được phép và chứng minh build serve thật.

Kind/profile: `operations`. Chọn node cụ thể từ request hiện tại; không tự chạy toàn cây.

## Graph trong .work, không nằm trong op

Chỉ đọc graph node đã chọn. Không thêm/bỏ dependency, refs, required hoặc mở rộng scope để chạy/pass. Prerequisite thiếu/chưa done thì báo ID và dừng piece; nếu cần đổi graph, đề xuất scope update được chọn riêng. Không tự gọi op prerequisite.

## Đầu vào phải đọc và nguồn thẩm quyền

| ID | Đọc ở đâu | Đọc gì / vì sao |
| --- | --- | --- |
| target | N/node.md | Đọc N/node.md đã chọn đang tồn tại, scope cha, ref/dependency/assertion đã khai và freshness. Consumer op cần node đích có sẵn. Thiếu target là gap scope/graph: báo và đề xuất scope op được chọn riêng; không tạo target hay bịa acceptance/graph tại đây. |
| repo | repository:<repo-id>/<bound-paths> | Khi có/chọn source, resolve resource repo, checkout/root/HEAD/dirty thật; đọc hướng dẫn, manifest, code owner, caller, test. Greenfield/spec-only ghi source chưa tạo, lấy ý định từ yêu cầu; không bịa repo/trích dẫn fact. Implement source vẫn cần repo thật được chọn và được ghi. |
| environment | .work/_resources/environments/<environment>/resource.yaml | Đọc target/origin chính xác, owner, revision cấu hình, probe và tác động được phép; đối chiếu runtime thật, không suy danh tính từ hostname. |
| runtime | .work/_resources/runtimes/<resource>/resource.yaml + selected source command/config | Đọc owner runtime, command, checkout/build, endpoint, process/container identity, action mong đợi, health/version probe. Serve không mặc định merge integration. |

## Ghi gì vào đâu

| ID | Nơi ghi | Trường / section | Nội dung bắt buộc |
| --- | --- | --- | --- |
| node | N/node.md | state; blocker; completion.inputDigest; completion.evidence | Đọc nguyên scope/assertion mong đợi/graph .work đã chọn. Ở đây chỉ ghi state/blocker/completion; observation/finding/mapping commit/cleanup còn lại ở evidence, không body ngữ nghĩa. Thiếu ref/dependency/acceptance thì báo gap hoặc cập nhật scope được chọn riêng; không thêm/bỏ để đạt pass. |
| resource | .work/_resources/runtimes/<resource>/resource.yaml | id; kind; owner; revision; details.environment; details.commandRef; details.sourceRef; details.endpoints; details.probeRefs; details.custodyRefs; details.observationRef | Chỉ cập nhật ref runtime sở hữu và con trỏ observation. PID/session local ở local ignore hoặc evidence hữu hạn, không là identity bền. |
| evidence | E/manifest.yaml + E/runtime.json + E/probes.json + E/effects.json + E/build-output.txt when built + E/result.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Ghi generation trước/sau, owner target/process, build command/output thật, source refs đủ, artifact serve bất biến, probe endpoint, effect status. Kết quả quan sát chuyên môn ở E/result.md: Tách identity code/build/serve, process khỏe không chứng nhận UAT/release. |

## Thứ tự thực hiện hữu hạn

| # | Đọc ID | Ghi ID | Thực hiện và kiểm tra |
| --- | --- | --- | --- |
| 1 | target, runtime, environment, repo | evidence | Inspect process/container holder, revision source/build, port/health. Runtime đã khớp khỏe thì dùng lại không restart. |
| 2 | runtime, environment, target | — | Kiểm action mong đợi/effect được phép. Process/port foreign không cho phép kill hoặc tự chọn port/origin khác. |
| 3 | runtime, repo, environment | resource, evidence | Chỉ thay đổi runtime được cho phép và recovery hữu hạn. Nếu có integration rõ thì inspect owner/conflict scope, giữ commit kết quả thật và rerun gate; nếu không, không merge. |
| 4 | runtime, environment, repo | evidence | Probe identity source/build đang serve, endpoint/stability theo check khai. Chỉ PID start hoặc build thành công không chứng minh target serve code đã chọn. |
| 5 | target, runtime | node, resource, evidence | Ghi state/effect một phần/mapping source–serve thật rồi dừng. Không tự account/fixture/deploy. |

## Proof và điều kiện hoàn thành

| ID | Điều phải chứng minh |
| --- | --- |
| binding | Chạy validate workspace; ID/path trích dẫn tồn tại hoặc ghi rõ dự kiến, đủ assertions bắt buộc, binding còn mới; not-run/fail không được done. |
| runtime | Health/served-version khai được quan sát trên target thật, generation sở hữu đúng. |

Chỉ ghi completion theo core schema sau khi proof thật đạt. Ghi spec trước khi lấy inputDigest; fail/not-run/inconclusive không thành done. Artifact bổ sung phải được liệt kê trong manifest assets và hash bytes thật.

## Tác động và giới hạn

- only authorized start/stop/restart/build or integration action on owned runtime

Danh sách trên mô tả capability, không cấp quyền mới. Chỉ thực hiện effect trong ma trận op này và quyền hiện tại; không ghi ngoài ma trận, tự chạy op tiếp hay tự thêm agent/account/deploy/publish/cleanup chưa chọn. Effect đã được người dùng cho phép đúng phạm vi không cần xin lại chỉ vì đổi op.

## Blocker và điểm dừng

| Code | Điều kiện / thông tin cần |
| --- | --- |
| RUNTIME_OWNER_CONFLICT | Target/process/port foreign, mơ hồ hoặc đổi đồng thời. |
| RUNTIME_EFFECT_UNAUTHORIZED | Start/reset/merge/config cần vượt action chọn. |
| DECLARED_DEPENDENCY_UNMET | Prerequisite đã khai chưa effective done hoặc thiếu input/scope bắt buộc đã khai. Báo ID node/resource và đề xuất cập nhật graph được chọn riêng khi cần; không chạy predecessor hoặc nới dependsOn/refs/required để tiếp tục. |

Thêm các blocker chung trong common.md khi áp dụng. Ghi đúng quan sát và gap owner; không bịa input để tiếp tục. Kết thúc với kết quả/phạm vi/commit/evidence/gap rồi dừng. Op gợi ý tiếp theo không tự thực thi.

## Resolve placeholder

N/E/R theo common.md. Không ghi literal placeholder; path mới phải ghi rõ dự kiến.

| Placeholder | Nguồn giá trị |
| --- | --- |
| <repo-id> | Resolved repository resource ID / resource ID repo đã resolve |
| <bound-paths> | Inspected source read set / tập file nguồn cần đọc |
| <environment> | Resolved environment resource slug / slug environment đã resolve |
| <resource> | Selected owned resource slug / slug resource thuộc quyền sửa |
