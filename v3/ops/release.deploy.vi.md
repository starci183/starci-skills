# release.deploy

Bản đối chiếu cho người đọc; bản tiếng Anh là thẩm quyền runtime.

Đọc đầy đủ [giao thức chung](common.md) và tài liệu này trước khi làm.

## Mục tiêu cụ thể

Deploy một artifact bất biến được phép tới một target, kiểm steady state thật hoặc outcome rollback rõ.

Kind/profile: `release`. Chọn node cụ thể từ request hiện tại; không tự chạy toàn cây.

## Graph trong .work, không nằm trong op

Chỉ đọc graph node đã chọn. Không thêm/bỏ dependency, refs, required hoặc mở rộng scope để chạy/pass. Prerequisite thiếu/chưa done thì báo ID và dừng piece; nếu cần đổi graph, đề xuất scope update được chọn riêng. Không tự gọi op prerequisite.

## Đầu vào phải đọc và nguồn thẩm quyền

| ID | Đọc ở đâu | Đọc gì / vì sao |
| --- | --- | --- |
| target | N/node.md | Đọc N/node.md đã chọn đang tồn tại, scope cha, ref/dependency/assertion đã khai và freshness. Consumer op cần node đích có sẵn. Thiếu target là gap scope/graph: báo và đề xuất scope op được chọn riêng; không tạo target hay bịa acceptance/graph tại đây. |
| repo | repository:<repo-id>/<bound-paths> | Khi có/chọn source, resolve resource repo, checkout/root/HEAD/dirty thật; đọc hướng dẫn, manifest, code owner, caller, test. Greenfield/spec-only ghi source chưa tạo, lấy ý định từ yêu cầu; không bịa repo/trích dẫn fact. Implement source vẫn cần repo thật được chọn và được ghi. |
| environment | .work/_resources/environments/<environment>/resource.yaml | Đọc target/origin chính xác, owner, revision cấu hình, probe và tác động được phép; đối chiếu runtime thật, không suy danh tính từ hostname. |
| release | .work/_resources/releases/<resource>/resource.yaml + selected quality/UAT/migration evidence | Đọc digest artifact bất biến, mapping nguồn, compatibility config/schema, target/revision, gate bắt buộc, quyền deploy, digest an toàn trước, giới hạn recovery. Quality pass không phải quyền deploy. |

## Ghi gì vào đâu

| ID | Nơi ghi | Trường / section | Nội dung bắt buộc |
| --- | --- | --- | --- |
| node | N/node.md | state; blocker; completion.inputDigest; completion.evidence; completion.codeRefs | Đọc nguyên scope/assertion mong đợi/graph .work đã chọn. Ở đây chỉ ghi state/blocker/completion; observation/finding/mapping commit/cleanup còn lại ở evidence, không body ngữ nghĩa. Thiếu ref/dependency/acceptance thì báo gap hoặc cập nhật scope được chọn riêng; không thêm/bỏ để đạt pass. |
| resource | .work/_resources/releases/<resource>/resource.yaml | id; kind; owner; revision; details.artifact; details.sourceRefs; details.configurationRef; details.target; details.deploymentEvidence | Giữ identity artifact bất biến và deployment evidence thật; không retag/rebuild rồi gọi cùng release. |
| evidence | E/manifest.yaml + E/deployment.json + E/probes.json + E/recovery.json + E/result.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Giữ generation/digest target trước/sau thật, command/tool outcome, probe qua khoảng stability khai và effect recovery/rollback hữu hạn. Kết quả quan sát chuyên môn ở E/result.md: Ghi identity thật deploy/restore và acceptance còn thiếu; rollback thành công không phải giao release bị loại. |

## Thứ tự thực hiện hữu hạn

| # | Đọc ID | Ghi ID | Thực hiện và kiểm tra |
| --- | --- | --- | --- |
| 1 | target, release, environment, repo | node | Kiểm quyền deploy rõ, artifact/source mapping chính xác và quality/UAT/schema admission hiện tại bắt buộc. Ghi defer được duyệt, không đổi thành pass. |
| 2 | release, environment | evidence | Inspect release/target/config active thật, artifact sẵn và rollback khả thi; so lại ngay trước mutation. |
| 3 | release, environment | resource, evidence | Deploy artifact chính xác qua provider mechanism được phép có thật. Không sửa DNS/host/credential/schema nếu effect đó chưa nằm trong phạm vi. |
| 4 | release, environment | evidence | Quan sát probe health/readiness hữu ích và digest active trong khoảng ổn định hữu hạn. Phát hiện target đổi đồng thời trước recovery; chỉ recovery/rollback cùng release hữu hạn được phép. |
| 5 | release, target | node, resource, evidence | Báo chính xác identity deployed/failed/uncertain/restored, giữ partial effect/probe chưa đạt, validate rồi dừng. Không sửa source/provision rộng/chain release. |

## Proof và điều kiện hoàn thành

| ID | Điều phải chứng minh |
| --- | --- |
| binding | Chạy validate workspace; ID/path trích dẫn tồn tại hoặc ghi rõ dự kiến, đủ assertions bắt buộc, binding còn mới; not-run/fail không được done. |
| deployment | Target thật chạy artifact dự định bất biến, probe giữ trong window khai; một probe xanh không chứng minh steady state. |

Chỉ ghi completion theo core schema sau khi proof thật đạt. Ghi spec trước khi lấy inputDigest; fail/not-run/inconclusive không thành done. Artifact bổ sung phải được liệt kê trong manifest assets và hash bytes thật.

## Tác động và giới hạn

- exact selected deployment and explicitly bounded recovery/rollback

Danh sách trên mô tả capability, không cấp quyền mới. Chỉ thực hiện effect trong ma trận op này và quyền hiện tại; không ghi ngoài ma trận, tự chạy op tiếp hay tự thêm agent/account/deploy/publish/cleanup chưa chọn. Effect đã được người dùng cho phép đúng phạm vi không cần xin lại chỉ vì đổi op.

## Blocker và điểm dừng

| Code | Điều kiện / thông tin cần |
| --- | --- |
| RELEASE_AUTHORITY_MISSING | Artifact/target/effect chưa có quyền rõ. |
| CONCURRENT_RELEASE | Generation khác xuất hiện trong lúc chạy; không rollback nó. |
| STEADY_STATE_UNPROVEN | Không chứng minh probe/digest serve chính xác trong window hữu hạn. |
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
