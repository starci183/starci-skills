# Lõi metadata Work chỉ đọc

`validateWorkspace(root)` trả về đồng bộ `{ok,errors,warnings,nodes,resources}`; mỗi lỗi có `code,path,message`. Node gồm `id,path,kind,required,state,effectiveState,specDigest,inputDigest,eligible,children`; resource chỉ gồm `id,path,kind,revision`. Không xuất body, chi tiết tài khoản hoặc mật khẩu. Extension lạ được giữ nguyên trên đĩa và tham gia digest. Các hàm phụ: `canonicalJSON`, `sha256`, `profiles`.

File `.yaml` chỉ chấp nhận **cú pháp JSON**, là tập con tương thích YAML. `node.md` có front matter JSON nằm giữa hai dòng `---`, sau đó là Markdown mô tả phạm vi và điều kiện hoàn thành quan sát được. YAML khác bị từ chối. Shape tại [work.schema.json](../schemas/work.schema.json); profile thực thi tại [profiles.json](../schemas/profiles.json). Lõi đọc allowed keys từ schema và từ chối key lạ trong metadata lõi, kể cả completion, assertions, bindings, assets, provenance lồng nhau. Viết nhầm `dependOn` không thể âm thầm bỏ qua dependency. Dữ liệu mở rộng tùy ý theo namespace nằm trong `extensions` hoặc resource `details`; không tự trở thành lệnh dependency. Timestamp vận hành của node được schema cho phép rõ ràng. Shape hợp lệ không đồng nghĩa nghiệm thu thật.

## Cấu trúc và định danh

Root là thư mục `.work`, có `workspace.yaml`. Resource nằm dưới `_resources/**/resource.yaml`. Node đặt ở thư mục nghiệp vụ bất kỳ; node tổ tiên gần nhất là cha, không được lưu state/completion. Evidence ở `evidence/<id>/manifest.yaml`, tham chiếu bằng ID metadata ổn định. ID duy nhất toàn workspace, không phụ thuộc tên thư mục. Cho phép thư mục trung gian không có node. `evidence`, `assets`, `_resources` dành riêng cho artifact/resource: node.md bên dưới bị từ chối, không nhập cây completion. Bỏ qua `_local`, `.git`; từ chối symlink và đường dẫn thoát. Secret nằm ngoài root, chỉ lưu sealed alias trong resource. Trường plaintext credential đã biết bị từ chối đệ quy trong mọi metadata, kể cả workspace extensions; đây là kiểm tra key bảo thủ, không phải phát hiện toàn bộ secret trong văn xuôi hay giá trị ngụy trang. Không tải artifact từ xa hoặc giải mã secret.

## Digest và trạng thái hiệu lực

`specDigest` bao gồm metadata trừ các trường schema đánh dấu `x-operational` (`state`, `completion`, `blocker`, `timestamps`, `createdAt`, `updatedAt`), cộng body chuẩn hóa. `naReason` là ngữ nghĩa: đổi lý do áp dụng/N/A làm proof của consumer liên quan stale. Extension lạ được tính bảo thủ. `inputDigest` bổ sung metadata workspace, spec và input của tổ tiên, node/dependency/resource được tham chiếu bắc cầu, và node con đối với nhánh. Riêng refs kế thừa từ tổ tiên trỏ chính node hoặc cây chứa node thì không bung đệ quy thêm vì scope đã được tính; goal có thể refs nhóm requirements bên trong mà không tạo self-cycle giả. Ref khai báo trực tiếp và mọi dependency vẫn kiểm cycle bình thường. Không tính đường dẫn: đổi tên nhưng giữ ID/cấu trúc không làm proof stale. Toàn bộ metadata resource, gồm revision/details, được tính. Liên kết tùy ý bên trong resource details không được tự diễn giải; node phải refs từng resource liên quan. Nội dung extension không tự trở thành dependency.

Đổi state/completion không tự đổi digest; eligibility vẫn yêu cầu `dependsOn` của chính node và kế thừa từ tổ tiên đạt `done` hoặc `na` có lý do. `refs` ràng buộc ngữ nghĩa nhưng không đặt thứ tự chạy. Input đổi khiến completion `stale` và validation thất bại đến khi kiểm tra lại thật; không sửa digest để lách gate.

Lá có `todo`, `doing`, `blocked`, `done`, `na`; hiệu lực thêm `stale`, `invalid`. N/A cần lý do, không phải proof pass. Cha tổng hợp con bắt buộc: toàn N/A là N/A; done/N/A là done; còn lại ưu tiên invalid/blocked/stale/doing/todo. Nhánh chỉ có con tùy chọn là N/A, không phải done; con tùy chọn chưa xong có warning. Lỗi integrity metadata/evidence dùng chung vô hiệu hóa toàn cây. Kind lạ đọc được nhưng không được done khi chưa có profile đã kiểm thử.

## Profile hoàn thành

Mỗi lá done phải khai báo `assertions:[id]` không rỗng. Completion là `{inputDigest,evidence:[evidenceId],codeRefs?:[{repository,commit}]}`. Evidence đúng node/input hiện tại, outcome pass, observation pass không rỗng, phủ toàn bộ assertion. Fail/not-run/inconclusive không được done. Hash chứng minh ràng buộc và toàn vẹn bytes, **không chứng minh observation đúng**.

Một bundle chạy được dùng cho nhiều lá mà không chép ảnh: giữ `nodeId,inputDigest` chính, thêm `bindings:[{nodeId,inputDigest}]` cho các lá khác. Tất cả node ID phải tồn tại, không trùng kể cả node chính; mỗi lá kiểm digest hiện tại và assertions riêng. Lưu manifest/assets một lần ở `evidence/<id>/` của flow, các lá tham chiếu cùng evidence ID. Lá không được liệt kê không thể dùng proof. Đổi một lá chỉ làm binding liên quan stale; outcome fail hoặc asset hỏng vô hiệu toàn bundle.

Implementation/release cần repository resource ID và SHA commit hex thường đầy đủ 40/64 ký tự; repository phải có trong refs của node và codeRefs của mỗi evidence được chọn. Không xác minh object Git tồn tại, ancestry, publish hoặc commit origin. Original/integrated commit ghi rõ trong extension khi cần, không đồng nhất commit với bản deploy.

Operator phải cập nhật revision của repository/environment từ code/build thực đã kiểm tra trước validation. Lõi không theo dõi source hoặc deployment; Git HEAD/runtime đổi nhưng metadata không cập nhật thì không tự phát hiện. Hash không sửa được input cũ hoặc bịa. `eligible` chỉ là cấu trúc hợp lệ và prerequisite của node/tổ tiên đã đạt, không phải người dùng duyệt hoặc quyền thực thi.

UAT cần `provenance:{environment,actor,servedVersions,tool,capturedAt,servedVersionEvidence}` hoặc thay actor bằng `anonymous:true`. Environment/actor phải là resource đúng kind. Mỗi served version là `{repository,commit,artifact}` với identity image/build bất biến quan sát thật, không chép HEAD. `servedVersionEvidence` trỏ assertion pass mô tả cách quan sát runtime. Environment/actor/repository phải nằm trong refs để invalidate đúng. Lõi kiểm tra binding khai báo, không kiểm tra endpoint bên ngoài; operator phải xem đúng runtime và lưu observation từ công cụ. Build label bịa vẫn có thể qua kiểm tra cấu trúc; cần evidence và review để phát hiện.

`uat.ui` cần ảnh PNG/JPEG/WebP local có hash; nhận diện chỉ kiểm signature, không decode toàn ảnh hoặc xác minh UI đúng, nguồn ảnh, viewport, freshness. Operator phải mở ảnh xem. `uat.ux` cần assertion pass `kind:"behavior"`; ảnh đơn thuần không đủ. Ngữ nghĩa observation và mức đủ của assertion cần review.

Asset dùng path tương đối chuẩn hóa trong evidence directory và SHA-256. Từ chối thiếu file, hash sai, absolute path, traversal, symlink. Chưa chứng nhận artifact chỉ có remote. Validator không chạy command, tạo tài khoản, tự sửa state hoặc gọi op tiếp.

## Trình tự tác giả tối thiểu

Viết requirements/resources và lá todo có assertions; validation lấy inputDigest. Chỉ thực hiện op được duyệt; lưu evidence thật với digest/code/runtime thật; review rồi mới đặt completion và validate lại. Đây là trách nhiệm operator, không phải chain tự chạy. Observation tổng hợp trong test không phải nghiệm thu sản phẩm.
