# Chi tiết hiệu lực hồ sơ song thời gian

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | bitemporal-record-validity-detail |
| Family | detail |
| Dominant task | Xác định hồ sơ có hiệu lực ngoài đời khi nào so với lúc hệ thống biết hoặc sửa trạng thái đó. |
| Search aliases | bitemporal-record-validity-detail; bitemporal record validity detail |
| Authority | Topology tác vụ, region graph, responsive transformation, interaction parity và state families. |

### Bất biến

- Xác định hồ sơ có hiệu lực ngoài đời khi nào so với lúc hệ thống biết hoặc sửa trạng thái đó.
- Mỗi vùng có một owner ngữ nghĩa; supporting context không chiếm dominant task.
- DOM order, reading order và focus order giữ nguyên ý nghĩa qua wide, intermediate và compact.
- Grammar cung cấp dữ kiện sản phẩm; Principles giải exact geometry; archetype không sở hữu visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-BTV-01 | Xác định hồ sơ có hiệu lực ngoài đời khi nào so với lúc hệ thống biết hoặc sửa trạng thái đó. | tín hiệu dương bắt buộc |
| AR-BTV-02 | Mọi vùng bắt buộc và quan hệ quan trọng đều có owner độc lập. | tín hiệu dương bắt buộc |
| AR-BTV-03 | Quan hệ wide không còn hoạt động nhưng compact vẫn phải giữ task, state và recovery. | kích hoạt transformation |
| AR-BTV-90 | nhu cầu là version history thường, audit timeline, tiến trình job hoặc bảng tính. | reject |
| AR-BTV-91 | Khác biệt chỉ là product noun, density, màu, component hoặc số lượng card. | duplicate-or-variation |

### Quy tắc chọn

Chỉ trả accept khi AR-BTV-01 và AR-BTV-02 đều có bằng chứng, không có AR-BTV-90 hoặc AR-BTV-91, và region graph vẫn cần thiết ở cả ba topology. Nếu owner hoặc transformation chưa rõ, trả needs-evidence.

## Region graph

~~~text
bitemporal-detail
├─ record-identity
├─ valid-time-axis
├─ transaction-time-axis
├─ interval-state-grid
├─ selected-state-facts
├─ correction-provenance
└─ compare-at-two-times
~~~

Quan hệ quan trọng: Valid time and transaction time remain independent semantic axes; selected facts and correction provenance bind both coordinates.

### Nghĩa vụ vùng

| Region ID | Owner | Quan hệ bắt buộc |
|---|---|---|
| bitemporal-detail | Sở hữu ranh giới dominant task của trang và chứa mọi region bắt buộc; không tự tạo semantic sản phẩm. | Chứa record-identity, valid-time-axis, transaction-time-axis, interval-state-grid, selected-state-facts, correction-provenance, compare-at-two-times nhưng giữ owner độc lập của từng region. |
| record-identity | Sở hữu dữ kiện ổn định về subject, scope và orientation cho mọi quyết định phía sau. | Định hướng valid-time-axis mà không thay owner của nó. |
| valid-time-axis | Sở hữu quan hệ thứ tự, tọa độ hoặc dependency nhưng không sở hữu product fact bên dưới. | Nhận context từ record-identity và ràng buộc transaction-time-axis mà không gộp authority. |
| transaction-time-axis | Sở hữu quan hệ thứ tự, tọa độ hoặc dependency nhưng không sở hữu product fact bên dưới. | Nhận context từ valid-time-axis và ràng buộc interval-state-grid mà không gộp authority. |
| interval-state-grid | Sở hữu quan hệ thứ tự, tọa độ hoặc dependency nhưng không sở hữu product fact bên dưới. | Nhận context từ transaction-time-axis và ràng buộc selected-state-facts mà không gộp authority. |
| selected-state-facts | Sở hữu evidence truy nguyên được cùng trạng thái freshness, availability và permission. | Nhận context từ interval-state-grid và ràng buộc correction-provenance mà không gộp authority. |
| correction-provenance | Sở hữu evidence truy nguyên được cùng trạng thái freshness, availability và permission. | Nhận context từ selected-state-facts và ràng buộc compare-at-two-times mà không gộp authority. |
| compare-at-two-times | Sở hữu đúng task fact hoặc stage được đặt tên và không lấy authority của region lân cận. | Nhận trạng thái đã verify từ correction-provenance và phát outcome hoặc recovery path hữu hạn. |

## Responsive contract

### Wide

- Show the two-axis interval view with selected facts and provenance; only the bounded matrix owns time overflow.
- Failure trigger: các vùng đồng thời làm hẹp nội dung, che trạng thái hoặc phá quan hệ owner.
- Navigation replacement: không cần nếu các vùng còn đồng hiện; sticky chỉ dành cho context vừa viewport.
- Overflow owner: page theo trục dọc; chỉ region có bản chất hai chiều mới own overflow có giới hạn.

### Intermediate

- Keep one axis primary and expose the other as a selector without losing the selected instant.
- Failure trigger: supporting persistence cạnh tranh measure hoặc focus với primary task.
- Navigation replacement: trigger có tên mở temporary pane, Escape đóng và focus trở đúng trigger.
- Sticky boundary tự yield ở short-height; page vẫn là overflow owner.

### Compact

- Choose valid-at or known-at, then inspect interval, facts, and correction provenance with explicit view switching.
- Failure trigger: nhiều pane không còn đồng thời operable với text 16px và target 44px.
- Navigation replacement: Previous, Next và stage selector thay quan hệ pane; Back giữ selection và draft.
- Không có page-level horizontal scroll; sticky/fixed surface không che content hoặc focus.

### Reflow

Thứ tự ngữ nghĩa theo region graph là DOM order và reading order ở mọi width. CSS không reorder. Text, localization, zoom và spacing growth làm vùng cao hơn hoặc chuyển topology; không clip nội dung. Trạng thái trong vùng giữ nguyên khi vùng được chuyển vào hoặc ra temporary pane.

### Tương đương tương tác

Wide, intermediate và compact cung cấp cùng action, selection, pending guard, success, error, retry, stale/conflict recovery và kết quả. Status động được announce qua polite live region mà không tự cướp focus. Dialog giữ focus, hỗ trợ Escape/cancel và trả focus đúng trigger.

## Nghĩa vụ trạng thái

Danh mục trạng thái domain (giữ stable state identifiers để EN/VI/context đồng nhất): no history; open/closed interval; retroactive correction; superseded state; conflicting intervals; timezone/granularity; missing provenance; selected instant; unavailable comparison.

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
| domain states | Valid-time interval selected; transaction-time coordinate is unchanged. Known-at instant changed; the real-world interval remains selected. Comparison exposes a retroactive correction in text and table form. Correction chain opened with source and superseded-state evidence. | Mọi modal trả focus đúng trigger. | Giữ action và recovery parity. |

## Ranh giới

### Chấp nhận

Chấp nhận khi dominant task cần đúng region graph, quan hệ quan trọng tạo topology riêng và cả ba responsive state giữ được task/recovery parity.

### Từ chối

Từ chối khi nhu cầu là version history thường, audit timeline, tiến trình job hoặc bảng tính, hoặc khi chỉ đổi noun/card/density của archetype khác.

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
| [W3C — Model for Tabular Data and Metadata on the Web](https://www.w3.org/TR/tabular-data-model/) | Hỗ trợ explicit row, column, and annotation relationships. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |
| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Hỗ trợ scan and action relationships in dense records. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |
| [Microsoft Fluent 2 — Layout](https://fluent2.microsoft.design/layout) | Hỗ trợ quan hệ vùng responsive và giữ measure nội dung usable. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |
| [W3C WAI — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Hỗ trợ content availability without page-level two-dimensional scrolling. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |

## Đầu ra

~~~json
{
  "archetypeId": "bitemporal-record-validity-detail",
  "matchedSituationCodes": [
    "AR-BTV-01",
    "AR-BTV-02"
  ],
  "aliases": [
    "bitemporal-record-validity-detail",
    "bitemporal record validity detail"
  ],
  "dominantTask": "Determine what a record was valid for in the real world versus when the system knew or corrected that state.",
  "regions": [
    "bitemporal-detail",
    "record-identity",
    "valid-time-axis",
    "transaction-time-axis",
    "interval-state-grid",
    "selected-state-facts",
    "correction-provenance",
    "compare-at-two-times"
  ],
  "relationships": [
    "Valid time and transaction time remain independent semantic axes; selected facts and correction provenance bind both coordinates."
  ],
  "responsive": {
    "wide": "Show the two-axis interval view with selected facts and provenance; only the bounded matrix owns time overflow.",
    "intermediate": "Keep one axis primary and expose the other as a selector without losing the selected instant.",
    "compact": "Choose valid-at or known-at, then inspect interval, facts, and correction provenance with explicit view switching.",
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
