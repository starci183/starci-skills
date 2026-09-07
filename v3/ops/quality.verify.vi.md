# quality.verify

Bản đối chiếu cho người đọc; bản tiếng Anh là thẩm quyền runtime.

Đọc đầy đủ [giao thức chung](common.md) và tài liệu này trước khi làm.

## Mục tiêu cụ thể

Chạy quality gate repo đã chọn và báo verdict thực tế đúng phạm vi.

Kind/profile: `operations`. Chọn node cụ thể từ request hiện tại; không tự chạy toàn cây.

## Graph trong .work, không nằm trong op

Chỉ đọc graph node đã chọn. Không thêm/bỏ dependency, refs, required hoặc mở rộng scope để chạy/pass. Prerequisite thiếu/chưa done thì báo ID và dừng piece; nếu cần đổi graph, đề xuất scope update được chọn riêng. Không tự gọi op prerequisite.

## Đầu vào phải đọc và nguồn thẩm quyền

| ID | Đọc ở đâu | Đọc gì / vì sao |
| --- | --- | --- |
| target | N/node.md | Đọc N/node.md đã chọn đang tồn tại, scope cha, ref/dependency/assertion đã khai và freshness. Consumer op cần node đích có sẵn. Thiếu target là gap scope/graph: báo và đề xuất scope op được chọn riêng; không tạo target hay bịa acceptance/graph tại đây. |
| repo | repository:<repo-id>/<bound-paths> | Khi có/chọn source, resolve resource repo, checkout/root/HEAD/dirty thật; đọc hướng dẫn, manifest, code owner, caller, test. Greenfield/spec-only ghi source chưa tạo, lấy ý định từ yêu cầu; không bịa repo/trích dẫn fact. Implement source vẫn cần repo thật được chọn và được ghi. |
| gates | actual repository scripts/config + selected gate criteria | Đọc command/ngưỡng/phạm vi test thật và proof thay đổi product. Scope task có thể cho phép test bình thường, không ép duyệt E2E mới mọi lần; test shared phá dữ liệu vẫn cần quyền đúng scope. |

## Ghi gì vào đâu

| ID | Nơi ghi | Trường / section | Nội dung bắt buộc |
| --- | --- | --- | --- |
| node | N/node.md | state; blocker; completion.inputDigest; completion.evidence | Đọc nguyên scope/assertion mong đợi/graph .work đã chọn. Ở đây chỉ ghi state/blocker/completion; observation/finding/mapping commit/cleanup còn lại ở evidence, không body ngữ nghĩa. Thiếu ref/dependency/acceptance thì báo gap hoặc cập nhật scope được chọn riêng; không thêm/bỏ để đạt pass. |
| evidence | E/manifest.yaml + E/gates/<gate>.json + E/logs/<gate>.txt + E/coverage.json + E/result.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Mỗi gate giữ command/cwd/repo/commit-tree/config-hash/exit/số test/ngưỡng/số đo/output che bí mật/phân loại fail. Kết quả quan sát chuyên môn ở E/result.md: Ghi gate bắt buộc, coverage source/config chính xác; gate chỉ diff không claim cả project. Debt được chấp nhận là riêng, không biến raw fail thành pass. |

## Thứ tự thực hiện hữu hạn

| # | Đọc ID | Ghi ID | Thực hiện và kiểm tra |
| --- | --- | --- | --- |
| 1 | target, repo, gates | node | Inspect baseline/revision/config trước chạy. Xác minh command tồn tại; tách không có test, runner không có và test fail thật. |
| 2 | repo, gates | evidence | Chạy check bắt buộc trên bytes đích; giữ command/exit/output thật. Ghi mọi fail bắt buộc có thể thu an toàn. Không sửa source/giảm ngưỡng/đổi lệnh dễ hơn. |
| 3 | gates, repo | evidence | So metric với ngưỡng cấu hình/yêu cầu và scope áp dụng. Ngưỡng thiếu là unconfigured, không phải 0; lệnh không có test thành công không chứng minh coverage. |
| 4 | target, repo, gates | node, evidence | Phân loại regression/debt baseline/block môi trường/nghi flaky từ diagnostic. Báo raw outcome và ngoại lệ được phép riêng; validate và dừng, không chain sửa. |

## Proof và điều kiện hoàn thành

| ID | Điều phải chứng minh |
| --- | --- |
| binding | Chạy validate workspace; ID/path trích dẫn tồn tại hoặc ghi rõ dự kiến, đủ assertions bắt buộc, binding còn mới; not-run/fail không được done. |
| gates | Mỗi check bắt buộc có output quan sát thật và đạt tiêu chí; check fail/unavailable không hoàn tất lá acceptance bắt buộc. |

Chỉ ghi completion theo core schema sau khi proof thật đạt. Ghi spec trước khi lấy inputDigest; fail/not-run/inconclusive không thành done. Artifact bổ sung phải được liệt kê trong manifest assets và hash bytes thật.

## Tác động và giới hạn

- selected local verification commands; no source repairs

Danh sách trên mô tả capability, không cấp quyền mới. Chỉ thực hiện effect trong ma trận op này và quyền hiện tại; không ghi ngoài ma trận, tự chạy op tiếp hay tự thêm agent/account/deploy/publish/cleanup chưa chọn. Effect đã được người dùng cho phép đúng phạm vi không cần xin lại chỉ vì đổi op.

## Blocker và điểm dừng

| Code | Điều kiện / thông tin cần |
| --- | --- |
| GATE_UNAVAILABLE | Command/config/runtime bắt buộc không chạy như khai. |
| SOURCE_CHANGED | Source/config đổi trong lúc đo làm result không đồng nhất. |
| DECLARED_DEPENDENCY_UNMET | Prerequisite đã khai chưa effective done hoặc thiếu input/scope bắt buộc đã khai. Báo ID node/resource và đề xuất cập nhật graph được chọn riêng khi cần; không chạy predecessor hoặc nới dependsOn/refs/required để tiếp tục. |

Thêm các blocker chung trong common.md khi áp dụng. Ghi đúng quan sát và gap owner; không bịa input để tiếp tục. Kết thúc với kết quả/phạm vi/commit/evidence/gap rồi dừng. Op gợi ý tiếp theo không tự thực thi.

## Resolve placeholder

N/E/R theo common.md. Không ghi literal placeholder; path mới phải ghi rõ dự kiến.

| Placeholder | Nguồn giá trị |
| --- | --- |
| <repo-id> | Resolved repository resource ID / resource ID repo đã resolve |
| <bound-paths> | Inspected source read set / tập file nguồn cần đọc |
| <gate> | Declared repository gate ID / ID gate repo đã khai |
