# service.operate

Bản đối chiếu cho người đọc; bản tiếng Anh là thẩm quyền runtime.

Đọc đầy đủ [giao thức chung](common.md) và tài liệu này trước khi làm.

## Mục tiêu cụ thể

Inspect hoặc đổi một dịch vụ phụ trợ đã khai và kiểm state yêu cầu.

Kind/profile: `operations`. Chọn node cụ thể từ request hiện tại; không tự chạy toàn cây.

## Graph trong .work, không nằm trong op

Chỉ đọc graph node đã chọn. Không thêm/bỏ dependency, refs, required hoặc mở rộng scope để chạy/pass. Prerequisite thiếu/chưa done thì báo ID và dừng piece; nếu cần đổi graph, đề xuất scope update được chọn riêng. Không tự gọi op prerequisite.

## Đầu vào phải đọc và nguồn thẩm quyền

| ID | Đọc ở đâu | Đọc gì / vì sao |
| --- | --- | --- |
| target | N/node.md | Đọc N/node.md đã chọn đang tồn tại, scope cha, ref/dependency/assertion đã khai và freshness. Consumer op cần node đích có sẵn. Thiếu target là gap scope/graph: báo và đề xuất scope op được chọn riêng; không tạo target hay bịa acceptance/graph tại đây. |
| environment | .work/_resources/environments/<environment>/resource.yaml | Đọc target/origin chính xác, owner, revision cấu hình, probe và tác động được phép; đối chiếu runtime thật, không suy danh tính từ hostname. |
| service | .work/_resources/services/<resource>/resource.yaml | Đọc service/owner/desired state/command-config refs/target/probe/recovery được phép; không suy owner từ port đang nghe. |

## Ghi gì vào đâu

| ID | Nơi ghi | Trường / section | Nội dung bắt buộc |
| --- | --- | --- | --- |
| node | N/node.md | state; blocker; completion.inputDigest; completion.evidence | Đọc nguyên scope/assertion mong đợi/graph .work đã chọn. Ở đây chỉ ghi state/blocker/completion; observation/finding/mapping commit/cleanup còn lại ở evidence, không body ngữ nghĩa. Thiếu ref/dependency/acceptance thì báo gap hoặc cập nhật scope được chọn riêng; không thêm/bỏ để đạt pass. |
| resource | .work/_resources/services/<resource>/resource.yaml | id; kind; owner; revision; details.environment; details.commandRef; details.probeRefs; details.observationRef | Chỉ sửa observation/declaration field dịch vụ thuộc scope; không cấp quyền mới bằng sửa allowed effects. |
| evidence | E/manifest.yaml + E/service-probes.json + E/effects.json + E/result.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Giữ holder thật và health/stop trước/sau, outcome command chọn và recovery hữu hạn. Kết quả quan sát chuyên môn ở E/result.md: Ghi outcome một dịch vụ và effect một phần; không suy runtime product/quality acceptance. |

## Thứ tự thực hiện hữu hạn

| # | Đọc ID | Ghi ID | Thực hiện và kiểm tra |
| --- | --- | --- | --- |
| 1 | service, environment, target | evidence | Inspect owner target/process-container/probe trước action; state đã khớp thì dùng lại không restart. |
| 2 | service, environment | — | Xác nhận action inspect/up/down/restart và quyền; không chạm server product/holder foreign/dependency chưa liệt kê. |
| 3 | service, environment | resource, evidence | Chỉ chạy command khai được phép khi cần, giữ effect chưa rõ, không retry mù; không chiếm port/install ngoài khai. |
| 4 | service, target | node, resource, evidence | Kiểm state yêu cầu qua probe/holder thật, báo giới hạn rồi dừng không chạy gate/op product. |

## Proof và điều kiện hoàn thành

| ID | Điều phải chứng minh |
| --- | --- |
| binding | Chạy validate workspace; ID/path trích dẫn tồn tại hoặc ghi rõ dự kiến, đủ assertions bắt buộc, binding còn mới; not-run/fail không được done. |
| service | Up có probe health hữu ích đã khai; down có observation process/container sở hữu và endpoint, không dựa vắng mặt suy đoán. |

Chỉ ghi completion theo core schema sau khi proof thật đạt. Ghi spec trước khi lấy inputDigest; fail/not-run/inconclusive không thành done. Artifact bổ sung phải được liệt kê trong manifest assets và hash bytes thật.

## Tác động và giới hạn

- explicit owned auxiliary-service lifecycle action only

Danh sách trên mô tả capability, không cấp quyền mới. Chỉ thực hiện effect trong ma trận op này và quyền hiện tại; không ghi ngoài ma trận, tự chạy op tiếp hay tự thêm agent/account/deploy/publish/cleanup chưa chọn. Effect đã được người dùng cho phép đúng phạm vi không cần xin lại chỉ vì đổi op.

## Blocker và điểm dừng

| Code | Điều kiện / thông tin cần |
| --- | --- |
| SERVICE_OWNERSHIP_UNKNOWN | Target/effect dịch vụ ngoài ownership/scope đã xác minh. |
| DECLARED_DEPENDENCY_UNMET | Prerequisite đã khai chưa effective done hoặc thiếu input/scope bắt buộc đã khai. Báo ID node/resource và đề xuất cập nhật graph được chọn riêng khi cần; không chạy predecessor hoặc nới dependsOn/refs/required để tiếp tục. |

Thêm các blocker chung trong common.md khi áp dụng. Ghi đúng quan sát và gap owner; không bịa input để tiếp tục. Kết thúc với kết quả/phạm vi/commit/evidence/gap rồi dừng. Op gợi ý tiếp theo không tự thực thi.

## Resolve placeholder

N/E/R theo common.md. Không ghi literal placeholder; path mới phải ghi rõ dự kiến.

| Placeholder | Nguồn giá trị |
| --- | --- |
| <environment> | Resolved environment resource slug / slug environment đã resolve |
| <resource> | Selected owned resource slug / slug resource thuộc quyền sửa |
