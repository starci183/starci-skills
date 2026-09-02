# Mã dừng

Mọi mã một operator có thể dừng với: mã chung trong `errors/errors.json` và mã riêng trong `operators/<id>/errors.json`, gộp bởi `scripts/errors-registry.mjs` và kẻ bởi `scripts/generate-errors-doc.mjs`; `--check` chạy trong `npm test`. Một mã có đúng một cách xử lý: **terminate** kết thúc bước ở trạng thái blocked; **fallback** làm đúng hành động đã ghi, ghi lại dưới `## Fallbacks taken` trong `response.md`, rồi chạy tiếp. `unless` gọi tên đúng một tham số Yêu cầu mà giá trị của nó đảo cách xử lý. `domain` là vùng trong `routing.json` mà mã dừng bàn giao tới; `self` là vùng của chính operator phát mã, tức chạy lại. Mã một operator gọi tên mà không có ở đây làm `validate-operator` đỏ; runtime gặp mã không có trong sổ thì dừng với `UNKNOWN_STOP`.

| Mã | Phạm vi | Vùng | Xử lý | Nghĩa | Fallback | Trừ khi | Chạy lại |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `EVIDENCE_MISSING` | `*` | `self` | terminate | Một khẳng định về hệ thống không có file, dòng hay head nào đứng sau. | — | — | Bổ sung bằng chứng. |
| `INVALID_INPUT` | `*` | `caller` | terminate | input.json hoặc request.md không qua gate hoặc bảng Yêu cầu của operator. | — | — | Sửa request.md. |
| `NO_PROGRESS` | `*` | `caller` | terminate | Lần chạy lại không thêm bằng chứng, ràng buộc, inventory hay phê duyệt nào. | — | — | Mang một delta thật. |
| `SOURCE_DRIFT` | `*` | `workspace` | terminate | Head quan sát được của checkout khác head mà input.json đã đóng băng. | — | — | Orchestrator đóng băng head lại. |
| `UNKNOWN_STOP` | `*` | `caller` | terminate | Runtime gặp một mã mà sổ gộp không có. | — | — | Đăng ký mã hoặc sửa operator. |
| `BUSINESS_AUTHORITY_REQUIRED` | `architecture.decide` | `business` | terminate | Head nghiệp vụ đã publish mà kiến trúc phải giữ đang thiếu hoặc cũ. | — | — | Chạy business.decide trước. |
| `CHOICE_REQUIRED` | `architecture.decide` | `caller` | fallback | Nhiều phương án còn material sau khi chấm. | Chọn phương án điểm cao nhất theo tradeoffAxes; hòa thì chọn phương án đổi ít component stack nhất; ghi bảng điểm dưới ## Decision. | `selectionPolicy` = `approval-required` → terminate | Người nhập approval. |
| `COMPATIBILITY_UNVERIFIED` | `architecture.decide` | `self` | fallback | Một component stack giữ lại không có bằng chứng tương thích ở ít nhất một trục. | Đánh dấu component là replaced-candidate trong stack delta và liệt kê các trục chưa kiểm vào Handoff dạng unknown. | — | Bổ sung bằng chứng tương thích. |
| `CONSTRAINT_CONTRADICTION` | `architecture.decide` | `caller` | terminate | Hai ràng buộc fixed-intent không thể cùng đúng. | — | — | Người sửa ràng buộc. |
| `CRITIQUE_UNRESOLVED` | `architecture.decide` | `self` | terminate | Một đòn tấn công vào phương án đã chọn không có lời giải. | — | — | Giải quyết đòn tấn công hoặc chọn khác. |
| `CURRENT_STATE_UNOBSERVED` | `architecture.decide` | `workspace` | terminate | Không đọc được hiện trạng hệ thống ở head đã đóng băng. | — | — | Sửa route hoặc checkout. |
| `DATA_OWNERSHIP_UNASSIGNED` | `architecture.decide` | `self` | terminate | Một store vật lý không có boundary sở hữu. | — | — | Gán chủ sở hữu. |
| `NO_VIABLE_ALTERNATIVE` | `architecture.decide` | `caller` | terminate | Không phương án nào qua được ràng buộc, hoặc phương án duy nhất chết dưới một đòn tấn công. | — | — | Nới ràng buộc hoặc dừng. |

