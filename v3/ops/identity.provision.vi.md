# identity.provision

Bản đối chiếu cho người đọc; bản tiếng Anh là thẩm quyền runtime.

Đọc đầy đủ [giao thức chung](common.md) và tài liệu này trước khi làm.

## Mục tiêu cụ thể

Inspect hoặc áp dụng thay đổi identity/account được chọn rõ, chứng minh actor kết quả.

Kind/profile: `operations`. Chọn node cụ thể từ request hiện tại; không tự chạy toàn cây.

## Graph trong .work, không nằm trong op

Chỉ đọc graph node đã chọn. Không thêm/bỏ dependency, refs, required hoặc mở rộng scope để chạy/pass. Prerequisite thiếu/chưa done thì báo ID và dừng piece; nếu cần đổi graph, đề xuất scope update được chọn riêng. Không tự gọi op prerequisite.

## Đầu vào phải đọc và nguồn thẩm quyền

| ID | Đọc ở đâu | Đọc gì / vì sao |
| --- | --- | --- |
| target | N/node.md | Đọc N/node.md đã chọn đang tồn tại, scope cha, ref/dependency/assertion đã khai và freshness. Consumer op cần node đích có sẵn. Thiếu target là gap scope/graph: báo và đề xuất scope op được chọn riêng; không tạo target hay bịa acceptance/graph tại đây. |
| business | .work/<business>/business/**/node.md | Đọc requirement/quyết định/ràng buộc/AC được khai là input liên quan trong graph .work đã chọn. Ý định quyết định expected, source không thay nghiệp vụ. Không bịa predecessor BA bắt buộc cho scope không cần; input cần mà thiếu là gap graph/scope phải báo, không tự thêm dependency. |
| environment | .work/_resources/environments/<environment>/resource.yaml | Đọc target/origin chính xác, owner, revision cấu hình, probe và tác động được phép; đối chiếu runtime thật, không suy danh tính từ hostname. |
| identity | .work/_resources/identities/<identity>/resource.yaml | Với scope đăng nhập/đổi identity, đọc alias, provider subject, role/membership refs, environment, sealed custody ref; không in/chép credential. Scope anonymous rõ ghi anonymous, không bịa resource account. |
| authority | current explicit account action + provider/admin custody declaration | Đọc scope create/repair/rotate/inspect chính xác, provider realm/tenant, role/membership mong đợi, lookup account thẩm quyền. Quyền UAT không tự cho tạo/reset user. |

## Ghi gì vào đâu

| ID | Nơi ghi | Trường / section | Nội dung bắt buộc |
| --- | --- | --- | --- |
| node | N/node.md | state; blocker; completion.inputDigest; completion.evidence | Đọc nguyên scope/assertion mong đợi/graph .work đã chọn. Ở đây chỉ ghi state/blocker/completion; observation/finding/mapping commit/cleanup còn lại ở evidence, không body ngữ nghĩa. Thiếu ref/dependency/acceptance thì báo gap hoặc cập nhật scope được chọn riêng; không thêm/bỏ để đạt pass. |
| resource | .work/_resources/identities/<resource>/resource.yaml | id; kind; owner; revision; details.environment; details.alias; details.provider; details.subject; details.roles; details.memberships; details.credentialRef; details.custodian; details.lifecycle | Chỉ lưu metadata identity/custody không bí mật đã xác minh. Tách subject theo environment; không tạo alias trùng để che account hiện có chưa rõ. |
| evidence | E/manifest.yaml + E/identity-checks.json + E/login.png when safe + E/effect.json + E/result.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Ghi account ID trước/sau thật, check role/membership, login product thật, resolve custody qua tên. Không credential/token/cookie/ảnh chứa bí mật. Kết quả quan sát chuyên môn ở E/result.md: Tách tạo account provider, gán role, membership backend, login product thật; ghi unknown/fail từng phần trung thực. |

## Thứ tự thực hiện hữu hạn

| # | Đọc ID | Ghi ID | Thực hiện và kiểm tra |
| --- | --- | --- | --- |
| 1 | target, authority, environment, identity, business | — | Xác nhận action được phép và quyền actor mong đợi. Inspect account theo subject/alias; chưa rõ thì đối soát chỉ đọc, không create thêm. |
| 2 | authority, identity, environment | evidence | Resolve sealed custody qua cơ chế được phép có thật, không in giá trị; inspect realm/tenant, nguồn membership, owner vòng đời credential. |
| 3 | authority, identity, business, environment | resource, evidence | Chỉ sửa identity thuộc quyền đúng phần thiếu/sai được yêu cầu. Dùng account hợp lệ; không thêm admin/reset password/sửa tenant khác để workaround. Inspect-only không ghi provider. |
| 4 | identity, environment, business | evidence | Kiểm subject/role provider và membership backend bình thường độc lập; login product thật nếu yêu cầu. Chỉ token/URL redirect không chứng minh actor vào đúng nội dung. |
| 5 | target, authority, identity | node, resource, evidence | Ghi tên/ref và outcome action quan sát thật; rotation kiểm custody mới hoạt động/credential cũ bị từ chối khi được chọn. Dừng, không tạo fixture. |

## Proof và điều kiện hoàn thành

| ID | Điều phải chứng minh |
| --- | --- |
| binding | Chạy validate workspace; ID/path trích dẫn tồn tại hoặc ghi rõ dự kiến, đủ assertions bắt buộc, binding còn mới; not-run/fail không được done. |
| actor | State identity mong đợi và login/membership bắt buộc pass; chỉ account provider tồn tại không đủ chứng nhận actor UAT. |

Chỉ ghi completion theo core schema sau khi proof thật đạt. Ghi spec trước khi lấy inputDigest; fail/not-run/inconclusive không thành done. Artifact bổ sung phải được liệt kê trong manifest assets và hash bytes thật.

## Tác động và giới hạn

- only explicitly authorized account create/repair/rotation; existing account use is not creation authority

Danh sách trên mô tả capability, không cấp quyền mới. Chỉ thực hiện effect trong ma trận op này và quyền hiện tại; không ghi ngoài ma trận, tự chạy op tiếp hay tự thêm agent/account/deploy/publish/cleanup chưa chọn. Effect đã được người dùng cho phép đúng phạm vi không cần xin lại chỉ vì đổi op.

## Blocker và điểm dừng

| Code | Điều kiện / thông tin cần |
| --- | --- |
| ACCOUNT_AUTHORITY_MISSING | Mutation identity tiếp theo vượt action account đã chọn rõ. |
| CUSTODY_UNAVAILABLE | Không xác minh được cơ chế sealed credential được phép hoặc owner account. |
| DECLARED_DEPENDENCY_UNMET | Prerequisite đã khai chưa effective done hoặc thiếu input/scope bắt buộc đã khai. Báo ID node/resource và đề xuất cập nhật graph được chọn riêng khi cần; không chạy predecessor hoặc nới dependsOn/refs/required để tiếp tục. |

Thêm các blocker chung trong common.md khi áp dụng. Ghi đúng quan sát và gap owner; không bịa input để tiếp tục. Kết thúc với kết quả/phạm vi/commit/evidence/gap rồi dừng. Op gợi ý tiếp theo không tự thực thi.

## Resolve placeholder

N/E/R theo common.md. Không ghi literal placeholder; path mới phải ghi rõ dự kiến.

| Placeholder | Nguồn giá trị |
| --- | --- |
| <business> | Selected business slug / slug nghiệp vụ đã chọn |
| <environment> | Resolved environment resource slug / slug environment đã resolve |
| <identity> | Selected actor resource slug / slug actor đã chọn |
| <resource> | Selected owned resource slug / slug resource thuộc quyền sửa |
