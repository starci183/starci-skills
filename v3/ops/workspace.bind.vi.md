# workspace.bind

Bản đối chiếu cho người đọc; bản tiếng Anh là thẩm quyền runtime.

Đọc đầy đủ [giao thức chung](common.md) và tài liệu này trước khi làm.

## Mục tiêu cụ thể

Gắn repo và nơi .work canonical đã chọn với identity local xác minh được.

Kind/profile: `operations`. Chọn node cụ thể từ request hiện tại; không tự chạy toàn cây.

## Graph trong .work, không nằm trong op

Chỉ đọc graph node đã chọn. Không thêm/bỏ dependency, refs, required hoặc mở rộng scope để chạy/pass. Prerequisite thiếu/chưa done thì báo ID và dừng piece; nếu cần đổi graph, đề xuất scope update được chọn riêng. Không tự gọi op prerequisite.

## Đầu vào phải đọc và nguồn thẩm quyền

| ID | Đọc ở đâu | Đọc gì / vì sao |
| --- | --- | --- |
| target | N/node.md | Đọc N/node.md đã chọn đang tồn tại, scope cha, ref/dependency/assertion đã khai và freshness. Consumer op cần node đích có sẵn. Thiếu target là gap scope/graph: báo và đề xuất scope op được chọn riêng; không tạo target hay bịa acceptance/graph tại đây. |
| declaration | current explicit repository scope + .work/_resources/repositories/<resource>/resource.yaml | Đọc lựa chọn repo/vị trí rõ trong task và identity portable hiện có. Tên thư mục/cwd/remote gần giống chỉ là gợi ý khi chưa resolve identity. |

## Ghi gì vào đâu

| ID | Nơi ghi | Trường / section | Nội dung bắt buộc |
| --- | --- | --- | --- |
| node | N/node.md | state; blocker; completion.inputDigest; completion.evidence | Đọc nguyên scope/assertion mong đợi/graph .work đã chọn. Ở đây chỉ ghi state/blocker/completion; observation/finding/mapping commit/cleanup còn lại ở evidence, không body ngữ nghĩa. Thiếu ref/dependency/acceptance thì báo gap hoặc cập nhật scope được chọn riêng; không thêm/bỏ để đạt pass. |
| resource | .work/_resources/repositories/<resource>/resource.yaml | id; kind; owner; revision; details.identity; details.remote; details.defaultRef; details.sourceRoots; details.workRootRef | Chỉ tạo/sửa declaration repo đã chọn từ Git metadata xác minh; path checkout riêng máy là local/observation, không phải identity portable. |
| evidence | E/manifest.yaml + E/repository-observation.json + E/result.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Ghi Git root/common-dir, branch/HEAD đủ, worktree registration, dirty paths, link targets thật; che bí mật trong remote URL. Kết quả quan sát chuyên môn ở E/result.md: Ghi identity repo ổn định, checkout/head quan sát riêng, ceiling ghi source được phép và work-root canonical; không nhầm Git worktree với nơi evidence bền. |

## Thứ tự thực hiện hữu hạn

| # | Đọc ID | Ghi ID | Thực hiện và kiểm tra |
| --- | --- | --- | --- |
| 1 | declaration, target | evidence | Resolve Git root/common-dir/remote identity bằng Git chỉ đọc; inspect owner .work hiện có, tránh tạo cây canonical thứ hai. |
| 2 | declaration | evidence | Inspect branch/HEAD/worktree đã register/dirty ngoài scope; resolve link/junction trước ceiling ghi. Không stash/reset/clean/switch/remove. |
| 3 | target, declaration | node, resource | Chỉ gắn identity đã xác minh, ref portable đã chọn; giữ scope người dùng và ID. Ghi cùng lúc identity thiếu/root xung đột. |
| 4 | target, declaration | evidence | Validate refs, báo readiness checkout tách runtime; không tạo server/account/Git worktree/task nền tảng. Dừng. |

## Proof và điều kiện hoàn thành

| ID | Điều phải chứng minh |
| --- | --- |
| binding | Chạy validate workspace; ID/path trích dẫn tồn tại hoặc ghi rõ dự kiến, đủ assertions bắt buộc, binding còn mới; not-run/fail không được done. |
| identity | Identity Git quan sát khớp scope repo và binding .work canonical; identity chưa rõ không thành resource bịa. |

Chỉ ghi completion theo core schema sau khi proof thật đạt. Ghi spec trước khi lấy inputDigest; fail/not-run/inconclusive không thành done. Artifact bổ sung phải được liệt kê trong manifest assets và hash bytes thật.

## Tác động và giới hạn

Chỉ metadata/evidence thuộc scope được giao; không mutation product hoặc dịch vụ ngoài.

Danh sách trên mô tả capability, không cấp quyền mới. Chỉ thực hiện effect trong ma trận op này và quyền hiện tại; không ghi ngoài ma trận, tự chạy op tiếp hay tự thêm agent/account/deploy/publish/cleanup chưa chọn. Effect đã được người dùng cho phép đúng phạm vi không cần xin lại chỉ vì đổi op.

## Blocker và điểm dừng

| Code | Điều kiện / thông tin cần |
| --- | --- |
| REPOSITORY_AMBIGUOUS | Lựa chọn rõ và root/remote quan sát khác nhau hoặc còn nhiều work-root canonical. |
| DECLARED_DEPENDENCY_UNMET | Prerequisite đã khai chưa effective done hoặc thiếu input/scope bắt buộc đã khai. Báo ID node/resource và đề xuất cập nhật graph được chọn riêng khi cần; không chạy predecessor hoặc nới dependsOn/refs/required để tiếp tục. |

Thêm các blocker chung trong common.md khi áp dụng. Ghi đúng quan sát và gap owner; không bịa input để tiếp tục. Kết thúc với kết quả/phạm vi/commit/evidence/gap rồi dừng. Op gợi ý tiếp theo không tự thực thi.

## Resolve placeholder

N/E/R theo common.md. Không ghi literal placeholder; path mới phải ghi rõ dự kiến.

| Placeholder | Nguồn giá trị |
| --- | --- |
| <resource> | Selected owned resource slug / slug resource thuộc quyền sửa |
