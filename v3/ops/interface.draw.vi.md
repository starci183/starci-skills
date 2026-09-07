# interface.draw

Bản đối chiếu cho người đọc; bản tiếng Anh là thẩm quyền runtime.

Đọc đầy đủ [giao thức chung](common.md) và tài liệu này trước khi làm.

## Mục tiêu cụ thể

Tạo và xem visual direction được yêu cầu cho một surface có nguồn nghiệp vụ.

Kind/profile: `architecture`. Chọn node cụ thể từ request hiện tại; không tự chạy toàn cây.

## Graph trong .work, không nằm trong op

Chỉ đọc graph node đã chọn. Không thêm/bỏ dependency, refs, required hoặc mở rộng scope để chạy/pass. Prerequisite thiếu/chưa done thì báo ID và dừng piece; nếu cần đổi graph, đề xuất scope update được chọn riêng. Không tự gọi op prerequisite.

## Đầu vào phải đọc và nguồn thẩm quyền

| ID | Đọc ở đâu | Đọc gì / vì sao |
| --- | --- | --- |
| target | N/node.md | Đọc N/node.md đã chọn đang tồn tại, scope cha, ref/dependency/assertion đã khai và freshness. Consumer op cần node đích có sẵn. Thiếu target là gap scope/graph: báo và đề xuất scope op được chọn riêng; không tạo target hay bịa acceptance/graph tại đây. |
| business | .work/<business>/business/**/node.md | Đọc requirement/quyết định/ràng buộc/AC được khai là input liên quan trong graph .work đã chọn. Ý định quyết định expected, source không thay nghiệp vụ. Không bịa predecessor BA bắt buộc cho scope không cần; input cần mà thiếu là gap graph/scope phải báo, không tự thêm dependency. |
| design | .work/_resources/design/<resource>/resource.yaml + selected architecture/interface node | Đọc brand/source asset thật, anatomy surface, design system, quyền/provenance hình ảnh và reference; khi dùng thì đọc image/design skill có sẵn. |

## Tham chiếu chuyên môn có điều kiện

| Nguồn | Khi nào đọc |
| --- | --- |
| [knowledge/ui/composition/INDEX.md](../../knowledge/ui/composition/INDEX.md) | Chỉ đọc topic composition khớp family/scope; không import component Grammar không có hoặc yêu cầu receipt không liên quan. |
| [knowledge/ui/proof/INDEX.md](../../knowledge/ui/proof/INDEX.md) | Đọc topic observation phù hợp assertion chọn; chỉ dùng tiêu chí đã chấp nhận áp dụng/measurement thật/công cụ có sẵn, không machinery thực thi chưa chọn. |

## Ghi gì vào đâu

| ID | Nơi ghi | Trường / section | Nội dung bắt buộc |
| --- | --- | --- | --- |
| node | N/node.md | body: Brief / Regions / States / Assets / Direction decision / Implementation limits; assertions | Ghi actor/task, nguồn content, hierarchy, anatomy từng vùng, native control, purpose/medium asset, responsive, acceptance mapping. Ghi direction thật được chọn hoặc lựa chọn quan trọng chưa quyết. |
| evidence | E/manifest.yaml + E/direction.png or actual requested format + E/prompt.txt + E/visual-review.md | id; nodeId; inputDigest; outcome; assertions; assets; provenance; codeRefs; extensions | Giữ ảnh generate/vẽ thật, tool provenance, prompt khi áp dụng, nhận xét fidelity đã xem, ID asset riêng. Bản vẽ không chứng minh hành vi product. |
| designSource | .work/_resources/design/<resource>/resource.yaml + .work/_resources/design/<resource>/assets/<asset> | files:[{path}]; details: accepted direction identity / source provenance | Ghi art-direction asset đã chọn/duyệt thành input nguồn canonical; path trong files tương đối với thư mục resource.yaml. Core hash bytes thật, không viết sha256 trong files. Giữ graph node chọn: thiếu resource/ref design thì báo gap scope, không tự thêm dependency. Ảnh generated/capture evidence không tự là design authority. |

## Thứ tự thực hiện hữu hạn

| # | Đọc ID | Ghi ID | Thực hiện và kiểm tra |
| --- | --- | --- | --- |
| 1 | target, business, design | node | Chốt brief và mapping content/region, đánh dấu copy placeholder/ví dụ. Chọn code-native/vector/raster đúng yêu cầu; không ép ImageGen sai ngữ cảnh. |
| 2 | business, design | evidence, designSource | Dùng tool/skill thích hợp có thật để tạo direction; giữ output và provenance thật. Thiếu tool thì blocker, không claim đã sinh ảnh. |
| 3 | target, design, business | node, evidence, designSource | Mở xem output thật về mâu thuẫn nghiệp vụ, hierarchy, owner component, dễ đọc, khả thi responsive và từng asset. Tách nhận định chủ quan với geometry đo. |
| 4 | target, design | node, evidence | Trình bày direction thật. Dùng lựa chọn đã duyệt; chỉ hỏi khi có phương án khác đáng kể được yêu cầu mà chưa chọn. Dừng, không code FE. |

## Proof và điều kiện hoàn thành

| ID | Điều phải chứng minh |
| --- | --- |
| binding | Chạy validate workspace; ID/path trích dẫn tồn tại hoặc ghi rõ dự kiến, đủ assertions bắt buộc, binding còn mới; not-run/fail không được done. |
| visual | Bytes ảnh thật được mở/review so brief; ghi kích thước/tool provenance; không gán UI/UAT pass từ bản vẽ. |

Chỉ ghi completion theo core schema sau khi proof thật đạt. Ghi spec trước khi lấy inputDigest; fail/not-run/inconclusive không thành done. Artifact bổ sung phải được liệt kê trong manifest assets và hash bytes thật.

## Tác động và giới hạn

- requested local/generated design assets

Danh sách trên mô tả capability, không cấp quyền mới. Chỉ thực hiện effect trong ma trận op này và quyền hiện tại; không ghi ngoài ma trận, tự chạy op tiếp hay tự thêm agent/account/deploy/publish/cleanup chưa chọn. Effect đã được người dùng cho phép đúng phạm vi không cần xin lại chỉ vì đổi op.

## Blocker và điểm dừng

| Code | Điều kiện / thông tin cần |
| --- | --- |
| DESIGN_INPUT_UNKNOWN | Thiếu content nghiệp vụ, quyền asset nhận diện hoặc lựa chọn direction quan trọng. |
| VISUAL_TOOL_UNAVAILABLE | Không tạo được visual yêu cầu bằng tool sẵn có được phép. |
| DECLARED_DEPENDENCY_UNMET | Prerequisite đã khai chưa effective done hoặc thiếu input/scope bắt buộc đã khai. Báo ID node/resource và đề xuất cập nhật graph được chọn riêng khi cần; không chạy predecessor hoặc nới dependsOn/refs/required để tiếp tục. |

Thêm các blocker chung trong common.md khi áp dụng. Ghi đúng quan sát và gap owner; không bịa input để tiếp tục. Kết thúc với kết quả/phạm vi/commit/evidence/gap rồi dừng. Op gợi ý tiếp theo không tự thực thi.

## Resolve placeholder

N/E/R theo common.md. Không ghi literal placeholder; path mới phải ghi rõ dự kiến.

| Placeholder | Nguồn giá trị |
| --- | --- |
| <business> | Selected business slug / slug nghiệp vụ đã chọn |
| <resource> | Selected owned resource slug / slug resource thuộc quyền sửa |
| <asset> | Actual selected source asset filename/format / tên file-định dạng asset nguồn thật đã chọn |
