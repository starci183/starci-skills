# Đánh giá gói bằng chứng chẩn đoán

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | diagnostic-evidence-bundle-review |
| Family | support |
| Dominant task | Tập hợp artifact chẩn đoán từ nhiều nguồn, kiểm tính đầy đủ và riêng tư rồi xuất một manifest truy vết được. |
| Search aliases | diagnostic-evidence-bundle-review; diagnostic evidence bundle review |
| Authority | Topology tác vụ, region graph, responsive transformation, interaction parity và state families. |

### Bất biến

- Tập hợp artifact chẩn đoán từ nhiều nguồn, kiểm tính đầy đủ và riêng tư rồi xuất một manifest truy vết được.
- Mỗi vùng có một owner ngữ nghĩa; supporting context không chiếm dominant task.
- DOM order, reading order và focus order giữ nguyên ý nghĩa qua wide, intermediate và compact.
- Grammar cung cấp dữ kiện sản phẩm; Principles giải exact geometry; archetype không sở hữu visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-DEB-01 | Tập hợp artifact chẩn đoán từ nhiều nguồn, kiểm tính đầy đủ và riêng tư rồi xuất một manifest truy vết được. | tín hiệu dương bắt buộc |
| AR-DEB-02 | Mọi vùng bắt buộc và quan hệ quan trọng đều có owner độc lập. | tín hiệu dương bắt buộc |
| AR-DEB-03 | Quan hệ wide không còn hoạt động nhưng compact vẫn phải giữ task, state và recovery. | kích hoạt transformation |
| AR-DEB-90 | tác vụ là bàn giao redaction, quản lý upload, audit detail, streaming log hoặc soạn yêu cầu. | reject |
| AR-DEB-91 | Khác biệt chỉ là product noun, density, màu, component hoặc số lượng card. | duplicate-or-variation |

### Quy tắc chọn

Chỉ trả accept khi AR-DEB-01 và AR-DEB-02 đều có bằng chứng, không có AR-DEB-90 hoặc AR-DEB-91, và region graph vẫn cần thiết ở cả ba topology. Nếu owner hoặc transformation chưa rõ, trả needs-evidence.

## Region graph

~~~text
evidence-bundle
├─ diagnostic-question-and-scope
├─ source-capture-status
├─ artifact-register
├─ relationship-and-time-summary
├─ privacy-and-completeness-checks
├─ bundle-manifest-preview
└─ export-or-attach
~~~

Quan hệ quan trọng: The manifest derives from the artifact register and completed privacy and completeness checks.

### Nghĩa vụ vùng

| Region ID | Owner | Quan hệ bắt buộc |
|---|---|---|
| evidence-bundle | Sở hữu ranh giới dominant task của trang và chứa mọi region bắt buộc; không tự tạo semantic sản phẩm. | Chứa diagnostic-question-and-scope, source-capture-status, artifact-register, relationship-and-time-summary, privacy-and-completeness-checks, bundle-manifest-preview, export-or-attach nhưng giữ owner độc lập của từng region. |
| diagnostic-question-and-scope | Sở hữu dữ kiện ổn định về subject, scope và orientation cho mọi quyết định phía sau. | Định hướng source-capture-status mà không thay owner của nó. |
| source-capture-status | Sở hữu membership, identity, status và current selection của collection hữu hạn này. | Nhận context từ diagnostic-question-and-scope và ràng buộc artifact-register mà không gộp authority. |
| artifact-register | Sở hữu membership, identity, status và current selection của collection hữu hạn này. | Nhận context từ source-capture-status và ràng buộc relationship-and-time-summary mà không gộp authority. |
| relationship-and-time-summary | Sở hữu evidence truy nguyên được cùng trạng thái freshness, availability và permission. | Nhận context từ artifact-register và ràng buộc privacy-and-completeness-checks mà không gộp authority. |
| privacy-and-completeness-checks | Sở hữu interpretation hoặc consequence preview suy ra; không trở thành nguồn input thứ hai. | Nhận context từ relationship-and-time-summary và ràng buộc bundle-manifest-preview mà không gộp authority. |
| bundle-manifest-preview | Sở hữu interpretation hoặc consequence preview suy ra; không trở thành nguồn input thứ hai. | Nhận context từ privacy-and-completeness-checks và ràng buộc export-or-attach mà không gộp authority. |
| export-or-attach | Sở hữu transaction completion, verification hoặc recovery hữu hạn và chặn thực thi trùng. | Nhận trạng thái đã verify từ bundle-manifest-preview và phát outcome hoặc recovery path hữu hạn. |

## Responsive contract

### Wide

- Keep source status, artifact register, and manifest/check summary together; selected detail is temporary.
- Failure trigger: các vùng đồng thời làm hẹp nội dung, che trạng thái hoặc phá quan hệ owner.
- Navigation replacement: không cần nếu các vùng còn đồng hiện; sticky chỉ dành cho context vừa viewport.
- Overflow owner: page theo trục dọc; chỉ region có bản chất hai chiều mới own overflow có giới hạn.

### Intermediate

- Collapse source status while artifact register and manifest remain primary.
- Failure trigger: supporting persistence cạnh tranh measure hoặc focus với primary task.
- Navigation replacement: trigger có tên mở temporary pane, Escape đóng và focus trở đúng trigger.
- Sticky boundary tự yield ở short-height; page vẫn là overflow owner.

### Compact

- Stage capture, artifacts, selected detail, checks, manifest, then export; Back preserves selection and results.
- Failure trigger: nhiều pane không còn đồng thời operable với text 16px và target 44px.
- Navigation replacement: Previous, Next và stage selector thay quan hệ pane; Back giữ selection và draft.
- Không có page-level horizontal scroll; sticky/fixed surface không che content hoặc focus.

### Reflow

Thứ tự ngữ nghĩa theo region graph là DOM order và reading order ở mọi width. CSS không reorder. Text, localization, zoom và spacing growth làm vùng cao hơn hoặc chuyển topology; không clip nội dung. Trạng thái trong vùng giữ nguyên khi vùng được chuyển vào hoặc ra temporary pane.

### Tương đương tương tác

Wide, intermediate và compact cung cấp cùng action, selection, pending guard, success, error, retry, stale/conflict recovery và kết quả. Status động được announce qua polite live region mà không tự cướp focus. Dialog giữ focus, hỗ trợ Escape/cancel và trả focus đúng trigger.

## Nghĩa vụ trạng thái

Danh mục trạng thái domain (giữ stable state identifiers để EN/VI/context đồng nhất): source unavailable/capturing/complete; artifact unsupported/duplicate/stale; timestamp mismatch; sensitive item; missing required evidence; stale manifest; export pending/failure/ready; permission.

| State family | Obligation | Focus transition | Responsive presentation |
|---|---|---|---|
| initial/loading | Giữ anatomy đã biết và nêu vùng đang chờ. | Không tự chuyển focus. | Giữ cùng stage identity. |
| ready | Hiển thị dữ liệu demo nhất quán và product-neutral. | Focus ở control đã kích hoạt. | Giữ selection. |
| empty/not-applicable | Nêu vì sao trống và bước tiếp theo nếu có. | Focus đến recovery chỉ khi cần tiếp tục. | Không xóa vùng bắt buộc khác. |
| error/retry | Gắn lỗi với owner và cung cấp retry có giới hạn. | Multi-error chuyển đến summary; retry trả đúng owner. | Lỗi không chỉ thể hiện bằng màu. |
| permission/unavailable | Giữ orientation và giải thích giới hạn. | Không focus control bị khóa. | Cùng lý do ở mọi topology. |
| pending | Chặn duplicate và giữ label hành động có nghĩa. | Không cướp focus để báo tiến độ. | Trạng thái đi cùng action owner. |
| success | Xác nhận kết quả và continuation hợp lệ. | Chỉ chuyển focus khi giúp tiếp tục. | Không tạo source of truth thứ hai. |
| stale/conflict | Nêu phiên bản thay đổi và giữ input an toàn. | Focus đến lựa chọn recovery có ngữ cảnh. | Selection sống qua transformation. |
| domain states | Three mock sources captured; one source remains unavailable with a reason. Duplicate artifact removed while the original timestamp stays traceable. Sensitive value redacted and required evidence is complete. Local manifest exported without upload; artifact hashes and check results are included. | Mọi modal trả focus đúng trigger. | Giữ action và recovery parity. |

## Ranh giới

### Chấp nhận

Chấp nhận khi dominant task cần đúng region graph, quan hệ quan trọng tạo topology riêng và cả ba responsive state giữ được task/recovery parity.

### Từ chối

Từ chối khi tác vụ là bàn giao redaction, quản lý upload, audit detail, streaming log hoặc soạn yêu cầu, hoặc khi chỉ đổi noun/card/density của archetype khác.

### Phán quyết ranh giới

Kết quả hợp lệ là accept, reject, duplicate-or-variation hoặc needs-evidence theo quy tắc Situation codes; không suy diễn bằng cảm tính.

## Bàn giao

- Grammar nhận dữ kiện thật, semantic owner, permission, trạng thái và hậu quả action.
- Principles nhận exact grid, measure, gap, sizing, alignment, overflow, threshold, sticky offset và focus accommodation.
- Direction nhận visual character; template chỉ là một realization conforming.

## Bằng chứng research không ràng buộc

### Ranh giới bằng chứng

Các nguồn sau là bằng chứng tư vấn chính thức đã kiểm tra. Chúng không phải product truth, không đặt tên archetype này cho tổ chức nguồn và không tự cấp quyền copy geometry, component tree, noun hoặc breakpoint.

### Nguồn

| Source | What it supports | What it does not prove |
|---|---|---|
| [USWDS — File input](https://designsystem.digital.gov/components/file-input/) | Hỗ trợ file capture state and accessible labeling. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |
| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Hỗ trợ scan and action relationships in dense records. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |
| [W3C WAI — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Hỗ trợ announced dynamic status without unnecessary focus movement. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |

## Đầu ra

~~~json
{
  "archetypeId": "diagnostic-evidence-bundle-review",
  "matchedSituationCodes": [
    "AR-DEB-01",
    "AR-DEB-02"
  ],
  "aliases": [
    "diagnostic-evidence-bundle-review",
    "diagnostic evidence bundle review"
  ],
  "dominantTask": "Assemble diagnostic artifacts from multiple sources, verify completeness and privacy, and export one traceable manifest.",
  "regions": [
    "evidence-bundle",
    "diagnostic-question-and-scope",
    "source-capture-status",
    "artifact-register",
    "relationship-and-time-summary",
    "privacy-and-completeness-checks",
    "bundle-manifest-preview",
    "export-or-attach"
  ],
  "relationships": [
    "The manifest derives from the artifact register and completed privacy and completeness checks."
  ],
  "responsive": {
    "wide": "Keep source status, artifact register, and manifest/check summary together; selected detail is temporary.",
    "intermediate": "Collapse source status while artifact register and manifest remain primary.",
    "compact": "Stage capture, artifacts, selected detail, checks, manifest, then export; Back preserves selection and results.",
    "reflow": "DOM and reading order remain stable; content grows without page-level horizontal scrolling.",
    "interactionParity": "Every action, state, recovery path, and focus return remains available across bands."
  },
  "stateObligations": [
    "initial/loading",
    "ready",
    "empty/not-applicable",
    "error/retry",
    "permission/unavailable",
    "pending",
    "success",
    "stale/conflict",
    "focus transition"
  ],
  "boundaryVerdict": "needs-evidence",
  "grammarHandoff": [
    "product facts",
    "semantic owners",
    "real state transitions"
  ],
  "principlesHandoff": [
    "exact geometry",
    "measure and overflow",
    "content-driven thresholds",
    "focus accommodation"
  ],
  "confidence": "low",
  "evidenceClasses": [
    "official task-domain guidance",
    "official design-system guidance",
    "accessibility guidance"
  ]
}
~~~

Không trả class, token, component, đường dẫn source, breakpoint cố định hoặc dữ kiện sản phẩm tự bịa.
