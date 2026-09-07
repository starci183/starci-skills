# uat.verify

Bản đối chiếu cho người đọc; bản tiếng Anh là thẩm quyền runtime.

Đọc đầy đủ [giao thức chung](common.md) và tài liệu này trước khi làm.

## Mục tiêu cụ thể

Chạy một journey product thật và chứng minh tương tác/persistence đã hứa.

Kind/profile: `uat.ux`. Chọn node cụ thể từ request hiện tại; không tự chạy toàn cây.

## Graph trong .work, không nằm trong op

Chỉ đọc graph node đã chọn. Không thêm/bỏ dependency, refs, required hoặc mở rộng scope để chạy/pass. Prerequisite thiếu/chưa done thì báo ID và dừng piece; nếu cần đổi graph, đề xuất scope update được chọn riêng. Không tự gọi op prerequisite.

## Đầu vào phải đọc và nguồn thẩm quyền

| ID | Đọc ở đâu | Đọc gì / vì sao |
| --- | --- | --- |
| target | N/node.md | Đọc N/node.md đã chọn đang tồn tại, scope cha, ref/dependency/assertion đã khai và freshness. Consumer op cần node đích có sẵn. Thiếu target là gap scope/graph: báo và đề xuất scope op được chọn riêng; không tạo target hay bịa acceptance/graph tại đây. |
| business | .work/<business>/business/**/node.md | Đọc requirement/quyết định/ràng buộc/AC được khai là input liên quan trong graph .work đã chọn. Ý định quyết định expected, source không thay nghiệp vụ. Không bịa predecessor BA bắt buộc cho scope không cần; input cần mà thiếu là gap graph/scope phải báo, không tự thêm dependency. |
| repo | repository:<repo-id>/<bound-paths> | Khi có/chọn source, resolve resource repo, checkout/root/HEAD/dirty thật; đọc hướng dẫn, manifest, code owner, caller, test. Greenfield/spec-only ghi source chưa tạo, lấy ý định từ yêu cầu; không bịa repo/trích dẫn fact. Implement source vẫn cần repo thật được chọn và được ghi. |
| environment | .work/_resources/environments/<environment>/resource.yaml | Đọc target/origin chính xác, owner, revision cấu hình, probe và tác động được phép; đối chiếu runtime thật, không suy danh tính từ hostname. |
| identity | .work/_resources/identities/<identity>/resource.yaml | Với scope đăng nhập/đổi identity, đọc alias, provider subject, role/membership refs, environment, sealed custody ref; không in/chép credential. Scope anonymous rõ ghi anonymous, không bịa resource account. |
| fixture | .work/_resources/fixtures/<fixture>/resource.yaml | Khi cần fixture, đọc revision/namespace-ID sở hữu/precondition/cách tạo/cleanup owner/tập xóa cho phép; không seed outcome test. Scope no-fixture rõ ghi lý do không có prerequisite mutable/cleanup, không bịa fixture. |
| cases | .work/<business>/uat/<flow>/**/node.md | Đọc case steps/AC viết trước, scope UI/UX và quality admission nếu khai. Không bịa expected trong lúc chạy. |

## Tham chiếu chuyên môn có điều kiện

| Nguồn | Khi nào đọc |
| --- | --- |
| [knowledge/ui/proof/INDEX.md](../../knowledge/ui/proof/INDEX.md) | Đọc topic observation phù hợp assertion chọn; chỉ dùng tiêu chí đã chấp nhận áp dụng/measurement thật/công cụ có sẵn, không machinery thực thi chưa chọn. |

## Ghi gì vào đâu

| ID | Nơi ghi | Trường / section | Nội dung bắt buộc |
| --- | --- | --- | --- |
| node | N/node.md | state; blocker; completion.inputDigest; completion.evidence | Đọc nguyên scope/assertion mong đợi/graph .work đã chọn. Ở đây chỉ ghi state/blocker/completion; observation/finding/mapping commit/cleanup còn lại ở evidence, không body ngữ nghĩa. Thiếu ref/dependency/acceptance thì báo gap hoặc cập nhật scope được chọn riêng; không thêm/bỏ để đạt pass. |
| evidence | E/manifest.yaml + E/walk.json + E/result.json + E/screens/*.png + E/readback.json + E/runtime.json + E/result.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Ghi assertion IDs kế hoạch, action/locator quan sát thật, input che bí mật, ảnh, feedback, read-back/reload lưu trữ, result status, provenance. UX chỉ có assertion kind:behavior pass khi thật sự quan sát. Kết quả quan sát chuyên môn ở E/result.md: Giữ nguyên requirement/expected case. Gắn resource environment/actor/repo serve; giữ fail thật và cleanup còn nợ. |

## Thứ tự thực hiện hữu hạn

| # | Đọc ID | Ghi ID | Thực hiện và kiểm tra |
| --- | --- | --- | --- |
| 1 | target, business, cases, repo | — | Chốt expected case/input digest trước action product. Kiểm scope/effect được phép/admission bắt buộc tại source version áp dụng; thiếu thì báo, không bypass. |
| 2 | environment, identity, fixture, repo | evidence | Kiểm target runtime/origin/version/config và actor login vào nội dung product thật. Check precondition fixture chỉ đọc; không tạo account/seed outcome/chuyển môi trường. |
| 3 | cases, environment, identity, fixture | evidence | Dùng browser skill/tool thật hoặc Playwright cài thật được phép, tách session/namespace. Tìm control từ DOM/accessibility hiện tại, thực hiện UI action có thứ tự; giữ lỗi tại nơi xảy ra. |
| 4 | cases, business, fixture | evidence | Mỗi assertion quan sát response/feedback/postcondition lưu thật; reload/resume hoặc API/DB chỉ đọc được phép theo case. API write không thay UI action. |
| 5 | cases, target | evidence | Chấm appearance/interaction-experience/persistence riêng. Chỉ ảnh không pass behavior; bước chưa tới not-run, read-back chưa rõ inconclusive, sai expected fail. Giữ output tool và xem ảnh. |
| 6 | target, fixture | node, evidence | Ghi defect/evidence/trách nhiệm cleanup còn lại chính xác. Không tự cleanup/sửa ngoài chọn. Validate assertions; chỉ lá chứng minh đủ mới done. Dừng sau kết quả. |

## Proof và điều kiện hoàn thành

| ID | Điều phải chứng minh |
| --- | --- |
| binding | Chạy validate workspace; ID/path trích dẫn tồn tại hoặc ghi rõ dự kiến, đủ assertions bắt buộc, binding còn mới; not-run/fail không được done. |
| journey | Control thật thực hiện action đã hứa; AC bắt buộc có behavior assertion pass, served-version proof và persistence/negative khi yêu cầu. |

Chỉ ghi completion theo core schema sau khi proof thật đạt. Ghi spec trước khi lấy inputDigest; fail/not-run/inconclusive không thành done. Artifact bổ sung phải được liệt kê trong manifest assets và hash bytes thật.

## Tác động và giới hạn

- declared product UI actions within isolated fixture namespace
- authorized sign-in; no provisioning or automatic cleanup

Danh sách trên mô tả capability, không cấp quyền mới. Chỉ thực hiện effect trong ma trận op này và quyền hiện tại; không ghi ngoài ma trận, tự chạy op tiếp hay tự thêm agent/account/deploy/publish/cleanup chưa chọn. Effect đã được người dùng cho phép đúng phạm vi không cần xin lại chỉ vì đổi op.

## Blocker và điểm dừng

| Code | Điều kiện / thông tin cần |
| --- | --- |
| PREREQUISITE_UNVERIFIED | Runtime version/quyền actor/fixture/expected case thiếu nguồn. |
| ACTION_OUTSIDE_SCOPE | Cần mutation account/data/service rộng hơn journey cho phép. |
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
| <identity> | Selected actor resource slug / slug actor đã chọn |
| <fixture> | Selected fixture resource slug / slug fixture đã chọn |
| <flow> | Selected UAT journey slug / slug journey UAT đã chọn |
