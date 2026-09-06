# Projection business head

`projection.json` định nghĩa bộ file được sinh. `templates/kinds/model.schema.json#/$defs/documentation` định nghĩa nội dung biên soạn. Model là machine authority; nội dung được bao phủ bởi self-fingerprint và content address bất biến. Markdown là projection, không phải authority độc lập.

Nội dung một phần có thể là chuỗi Markdown hoặc mảng block Markdown có thứ tự; các block ghép bằng dòng trống để phần dài vẫn đầy đủ trong giới hạn schema.

Mỗi phần giữ toàn bộ scope đã xác nhận bằng Markdown: heading lồng nhau, bảng, journey, ranh giới nghiệp vụ, quyết định, coexistence và các ca thành công, từ chối, lỗi. Đây không phải bản tóm tắt receipt. Mỗi phần dẫn claim và coverage dimension hiện có; ý định và câu hỏi chưa giải quyết giữ nguyên kind. Specification ghép mọi phần không rút gọn. Evidence chứa nguyên claims và coverage mà model bind bằng fingerprint.

`scripts/business-head.mjs` đọc template để sinh bundle và kiểm từng byte. `scripts/business-registry.mjs` archive model và evidence rồi index head bằng JCS address. Quyết định pending đầu tiên không có previous head; lần publish sau dẫn object trước đã archive. Reconciliation không được làm mất documentation; sinh lại projection từ model và evidence hiện tại qua `applyHeadPublication`.

Chuẩn bị candidate response theo contract rồi chạy:

```text
node scripts/publish-business-head.mjs <session>/step-N/parallel-M
```

Publisher validate output trước khi ghi, yêu cầu attempt đã mở và đóng băng cùng lease cụ thể của feature, resolve alias businesses tách theo project của session qua Workflow sở hữu, kiểm Git worktree đã đăng ký và giữ nguyên trạng thái lock, rồi tuần tự hóa cập nhật registry. Bundle cùng archive được ghi trước khi cập nhật index; readback phải hợp lệ trước khi accept attempt. Registry plan hoặc lineage stale bị từ chối. Lệnh không tạo registry cạnh tranh, di chuyển authority hay sửa source sản phẩm.

Model lịch sử chưa có documentation vẫn đọc được. Output mới của `business.decide` phải có documentation; chỉ quyết định được ủy quyền mới chuyển đổi head hiện có và vẫn giữ nguyên byte object lịch sử.

Sources: [quan sát business head](../../tests/evidence/20260906-business-head-bundle.md).
