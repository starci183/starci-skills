# knowledge.repair

## Việc

Sửa một luật knowledge UI bị phản biện tại đúng owner chuẩn bằng bằng chứng cụ thể, publish manifest chính xác mới và trả operation gốc về cùng bề mặt và tham chiếu.

## Xong khi

Hoàn thành khi đã kiểm luật thực sự áp dụng, file knowledge English chuẩn nhỏ nhất đổi trên nhánh phiên cùng mirror tiếng Việt, `knowledge-repair-receipt` bind manifest trước/sau và bằng chứng cụ thể, và retry nêu operation gốc, bề mặt cùng manifest mới.

## Một sửa chữa owner có giới hạn

Operator này sở hữu teacher knowledge, không sở hữu application hay source Grammar. Sửa luật hiện có khi luật sai hoặc quá hẹp. Chỉ nối luật mới cho khái niệm chưa có home và có ít nhất hai bề mặt consumer độc lập. Không bịa ngưỡng số từ một màn hình. Semantics và anatomy phổ quát ở Common; style family ở owner family; facts sản phẩm không vào knowledge.

## Ranh giới

Operator chỉ ghi file English chuẩn bị phản biện và mirror tiếng Việt dưới `@knowledge/ui` hay `@knowledge/grammars/<family>`, cùng response của nó. Giữ id luật, không vá consumer, không sửa DNA sinh tự động, source Grammar, routing, alias hay profile, và không tự tuyên bố kết quả đẹp. Operation gốc phải chạy lại trên cùng bề mặt và tham chiếu.

## Context

| Alias | Bind | Bắt buộc |
| --- | --- | --- |
| `@knowledge/ui` | toàn bộ thẩm quyền UI và owner chuẩn của luật phổ quát | có |
| `@knowledge/grammars/<family>` | thẩm quyền family cụ thể và home chuẩn của style family cùng gap | có |

## Đầu vào

| Kind | Từ đâu | Bắt buộc |
| --- | --- | --- |
| `knowledge-question` | operation UI hay library đã thấy mismatch và kiểm applicability | có |

## Yêu cầu

| Field | Kiểu | Mặc định | Hỏi |
| --- | --- | --- | --- |
| `manifest` | object | — | Manifest chính xác trước sửa đã đóng băng trước lần ghi |
| `resume` | token | null | Token nhánh bị chặn khi vào lại |

## Các bước

| # | Bước | Tham số | Đọc | Ghi | Dừng với |
| --- | --- | --- | --- | --- | --- |
| 1 | Kiểm question, applicability, evidence và manifest đóng băng | `manifest`, `resume` | `request/request.json`, input `knowledge-question`, @knowledge/ui, @knowledge/grammars/<family> | — | `INVALID_INPUT`, `KNOWLEDGE_EVIDENCE_MISSING`, `NO_PROGRESS` |
| 2 | Tìm đúng một owner và chọn sửa-existing trước nối-new | — | luật và Case bị phản biện, UPDATE.md, bản hiểu family | — | `KNOWLEDGE_SCOPE_REJECTED` |
| 3 | Sửa file English chuẩn và mirror với id ổn định trong write set đã khai | — | file owner và bằng chứng | @knowledge/ui hay @knowledge/grammars/<family> trên nhánh phiên, @tools/sourcewrite | `KNOWLEDGE_SCOPE_REJECTED` |
| 4 | Commit lần sửa owner có giới hạn đúng một lần, dựng lại manifest chính xác và phát retry có kiểu | — | file đã đổi, manifest trước, @tools/git | commit nhánh phiên, `knowledge-repair-receipt`, `response/response.json` | — |

## Đầu ra

| Kind | File | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| `knowledge-repair-receipt` | `response/data/knowledge-repair.json` | data | có |

## Dừng

| Code | Xử lý |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `KNOWLEDGE_EVIDENCE_MISSING` | terminate |
| `KNOWLEDGE_SCOPE_REJECTED` | terminate |
| `NO_PROGRESS` | terminate |

## Kế tiếp

| Khi | Operator |
| --- | --- |
| manifest đã rebind và phải thử lại cùng bề mặt/tham chiếu | `interface.plan` |
| manifest đã rebind và phải thử lại cùng bề mặt/tham chiếu | `interface.generate` |
| manifest đã rebind và phải thử lại cùng finding | `interface.fix` |
| manifest đã rebind và phải audit lại cùng bề mặt render | `interface.audit` |
| manifest đã rebind và phải thử lại cùng library plan | `library.update` |
