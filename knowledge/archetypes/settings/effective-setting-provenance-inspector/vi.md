# Trình kiểm tra nguồn gốc cấu hình hiệu lực

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | effective-setting-provenance-inspector |
| Family | settings |
| Dominant task | Giải thích một giá trị cấu hình hiệu lực bằng cách lần theo mặc định, kế thừa, phạm vi và override xung đột. |
| Search aliases | effective-setting-provenance-inspector; effective setting provenance inspector |
| Authority | Topology tác vụ, region graph, responsive transformation, interaction parity và state families. |

### Bất biến

- Giải thích một giá trị cấu hình hiệu lực bằng cách lần theo mặc định, kế thừa, phạm vi và override xung đột.
- Mỗi vùng có một owner ngữ nghĩa; supporting context không chiếm dominant task.
- DOM order, reading order và focus order giữ nguyên ý nghĩa qua wide, intermediate và compact.
- Grammar cung cấp dữ kiện sản phẩm; Principles giải exact geometry; archetype không sở hữu visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-ESP-01 | Giải thích một giá trị cấu hình hiệu lực bằng cách lần theo mặc định, kế thừa, phạm vi và override xung đột. | tín hiệu dương bắt buộc |
| AR-ESP-02 | Mọi vùng bắt buộc và quan hệ quan trọng đều có owner độc lập. | tín hiệu dương bắt buộc |
| AR-ESP-03 | Quan hệ wide không còn hoạt động nhưng compact vẫn phải giữ task, state và recovery. | kích hoạt transformation |
| AR-ESP-90 | trang chỉnh settings chung, duyệt phân cấp, giải dependency violation hoặc chỉnh quyền. | reject |
| AR-ESP-91 | Khác biệt chỉ là product noun, density, màu, component hoặc số lượng card. | duplicate-or-variation |

### Quy tắc chọn

Chỉ trả accept khi AR-ESP-01 và AR-ESP-02 đều có bằng chứng, không có AR-ESP-90 hoặc AR-ESP-91, và region graph vẫn cần thiết ở cả ba topology. Nếu owner hoặc transformation chưa rõ, trả needs-evidence.

## Region graph

~~~text
provenance-inspector
├─ setting-and-subject-context
├─ scope-tree
├─ effective-value-summary
├─ inheritance-chain
├─ override-conflict-evidence
└─ change-at-owning-scope-action
~~~

Quan hệ quan trọng: The inheritance chain owns explanation; edit ownership remains at the actual source scope, never at the derived value.

### Nghĩa vụ vùng

| Region ID | Owner | Quan hệ bắt buộc |
|---|---|---|
| provenance-inspector | Sở hữu ranh giới dominant task của trang và chứa mọi region bắt buộc; không tự tạo semantic sản phẩm. | Chứa setting-and-subject-context, scope-tree, effective-value-summary, inheritance-chain, override-conflict-evidence, change-at-owning-scope-action nhưng giữ owner độc lập của từng region. |
| setting-and-subject-context | Sở hữu dữ kiện ổn định về subject, scope và orientation cho mọi quyết định phía sau. | Định hướng scope-tree mà không thay owner của nó. |
| scope-tree | Sở hữu quan hệ thứ tự, tọa độ hoặc dependency nhưng không sở hữu product fact bên dưới. | Nhận context từ setting-and-subject-context và ràng buộc effective-value-summary mà không gộp authority. |
| effective-value-summary | Sở hữu invariant hoặc trạng thái suy ra được đặt tên và biểu đạt bằng chữ, không chỉ bằng màu. | Nhận context từ scope-tree và ràng buộc inheritance-chain mà không gộp authority. |
| inheritance-chain | Sở hữu quan hệ thứ tự, tọa độ hoặc dependency nhưng không sở hữu product fact bên dưới. | Nhận context từ effective-value-summary và ràng buộc override-conflict-evidence mà không gộp authority. |
| override-conflict-evidence | Sở hữu evidence truy nguyên được cùng trạng thái freshness, availability và permission. | Nhận context từ inheritance-chain và ràng buộc change-at-owning-scope-action mà không gộp authority. |
| change-at-owning-scope-action | Sở hữu transaction completion, verification hoặc recovery hữu hạn và chặn thực thi trùng. | Nhận trạng thái đã verify từ override-conflict-evidence và phát outcome hoặc recovery path hữu hạn. |

## Responsive contract

### Wide

- Compare the scope tree with effective value and inheritance chain while conflict evidence remains available.
- Failure trigger: các vùng đồng thời làm hẹp nội dung, che trạng thái hoặc phá quan hệ owner.
- Navigation replacement: không cần nếu các vùng còn đồng hiện; sticky chỉ dành cho context vừa viewport.
- Overflow owner: page theo trục dọc; chỉ region có bản chất hai chiều mới own overflow có giới hạn.

### Intermediate

- Move the scope tree to the temporary pane but keep the selected path and effective source persistent.
- Failure trigger: supporting persistence cạnh tranh measure hoặc focus với primary task.
- Navigation replacement: trigger có tên mở temporary pane, Escape đóng và focus trở đúng trigger.
- Sticky boundary tự yield ở short-height; page vẫn là overflow owner.

### Compact

- Stage scope list, setting detail, provenance chain, then owning-scope action; Back restores ancestry expansion.
- Failure trigger: nhiều pane không còn đồng thời operable với text 16px và target 44px.
- Navigation replacement: Previous, Next và stage selector thay quan hệ pane; Back giữ selection và draft.
- Không có page-level horizontal scroll; sticky/fixed surface không che content hoặc focus.

### Reflow

Thứ tự ngữ nghĩa theo region graph là DOM order và reading order ở mọi width. CSS không reorder. Text, localization, zoom và spacing growth làm vùng cao hơn hoặc chuyển topology; không clip nội dung. Trạng thái trong vùng giữ nguyên khi vùng được chuyển vào hoặc ra temporary pane.

### Tương đương tương tác

Wide, intermediate và compact cung cấp cùng action, selection, pending guard, success, error, retry, stale/conflict recovery và kết quả. Status động được announce qua polite live region mà không tự cướp focus. Dialog giữ focus, hỗ trợ Escape/cancel và trả focus đúng trigger.

## Nghĩa vụ trạng thái

Danh mục trạng thái domain (giữ stable state identifiers để EN/VI/context đồng nhất): inherited/default/overridden/conflicted; unknown owner; inaccessible scope; loading/stale/cyclic chain; selected source; unavailable change action; recalculation pending.

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
| domain states | Local scope selected; effective value remains derived. Chain traced from default through parent to local override. Two overrides conflict; neither is presented as silently winning. Change action routes to the owning parent scope, not the derived value. | Mọi modal trả focus đúng trigger. | Giữ action và recovery parity. |

## Ranh giới

### Chấp nhận

Chấp nhận khi dominant task cần đúng region graph, quan hệ quan trọng tạo topology riêng và cả ba responsive state giữ được task/recovery parity.

### Từ chối

Từ chối khi trang chỉnh settings chung, duyệt phân cấp, giải dependency violation hoặc chỉnh quyền, hoặc khi chỉ đổi noun/card/density của archetype khác.

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
| [GitLab Pajamas — Settings management](https://design.gitlab.com/patterns/settings-management/) | Hỗ trợ settings hierarchy and ownership cues. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |
| [Salesforce — Record Form](https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/lightning-record-form.html) | Hỗ trợ record identity, fields, and edit state. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |
| [W3C WAI — Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Hỗ trợ logical keyboard order and deterministic focus return. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |

## Đầu ra

~~~json
{
  "archetypeId": "effective-setting-provenance-inspector",
  "matchedSituationCodes": [
    "AR-ESP-01",
    "AR-ESP-02"
  ],
  "aliases": [
    "effective-setting-provenance-inspector",
    "effective setting provenance inspector"
  ],
  "dominantTask": "Explain one effective configuration value by tracing defaults, inheritance, scopes, and conflicting overrides.",
  "regions": [
    "provenance-inspector",
    "setting-and-subject-context",
    "scope-tree",
    "effective-value-summary",
    "inheritance-chain",
    "override-conflict-evidence",
    "change-at-owning-scope-action"
  ],
  "relationships": [
    "The inheritance chain owns explanation; edit ownership remains at the actual source scope, never at the derived value."
  ],
  "responsive": {
    "wide": "Compare the scope tree with effective value and inheritance chain while conflict evidence remains available.",
    "intermediate": "Move the scope tree to the temporary pane but keep the selected path and effective source persistent.",
    "compact": "Stage scope list, setting detail, provenance chain, then owning-scope action; Back restores ancestry expansion.",
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
