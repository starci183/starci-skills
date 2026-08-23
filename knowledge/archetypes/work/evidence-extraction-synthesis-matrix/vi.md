# Ma trận trích xuất và tổng hợp bằng chứng

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | evidence-extraction-synthesis-matrix |
| Family | work |
| Dominant task | Trích xuất normalized value hoặc claim từ source vào outcome schema, đồng thời giữ exact provenance và reviewer agreement. |
| Search aliases | evidence-extraction-synthesis-matrix; evidence extraction; source outcome matrix; provenance synthesis |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity và state families. |

### Bất biến

- Trích xuất normalized value hoặc claim từ source vào outcome schema, đồng thời giữ exact provenance và reviewer agreement.
- Mỗi required region có một semantic owner; supporting context không lấy dominant task.
- DOM order, reading order và focus order giữ nguyên meaning qua wide, intermediate và compact.
- Grammar cung cấp product facts; Principles resolve exact geometry; archetype không sở hữu visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-ESM-01 | Trích xuất normalized value hoặc claim từ source vào outcome schema, đồng thời giữ exact provenance và reviewer agreement. | required positive evidence |
| AR-ESM-02 | Critical region relationship và owner separation đều có bằng chứng. | required relationship evidence |
| AR-ESM-03 | Wide relationship không còn hoạt động nhưng compact vẫn giữ task, state và recovery. | responsive transformation trigger |
| AR-ESM-04 | Error, permission, pending, success và stale/conflict đều có bounded recovery. | required state evidence |
| AR-ESM-90 | Reject generic spreadsheet, comparison matrix, reconciliation diff và systematic weighted synthesis. | reject |
| AR-ESM-91 | Khác biệt chỉ là product noun, density, color, component, state skin hoặc card count. | duplicate-or-variation |

### Quy tắc chọn

Chỉ trả accept khi AR-ESM-01, AR-ESM-02 và AR-ESM-03 có bằng chứng, không có AR-ESM-90 hoặc AR-ESM-91, và mọi required region vẫn cần thiết ở cả ba topology. Trả needs-evidence khi owner, relation hoặc transformation chưa resolve.

## Region graph

~~~text
extraction-workbench
├─ synthesis-question-outcomes
├─ source-by-field-matrix
├─ selected-source-excerpt
├─ structured-extraction
├─ normalization-confidence
├─ reviewer-conflict
└─ aggregate-synthesis
~~~

Critical relationship: Mọi matrix value đều neo vào source excerpt; normalization và reviewer agreement là gate rõ ràng trước aggregate synthesis.

### Nghĩa vụ vùng

| Region ID | Owner | Required relationship |
|---|---|---|
| extraction-workbench | Sở hữu boundary của dominant task và chứa mọi required region mà không tạo product semantics. | Chứa synthesis-question-outcomes, source-by-field-matrix, selected-source-excerpt, structured-extraction, normalization-confidence, reviewer-conflict, aggregate-synthesis và giữ owner độc lập của từng region. |
| synthesis-question-outcomes | Sở hữu derived interpretation hoặc consequence preview; không trở thành input authority thứ hai. | Nhận context từ extraction-workbench và gates source-by-field-matrix mà không gộp authority. |
| source-by-field-matrix | Sở hữu source evidence, provenance, freshness và availability; không tự quyết định outcome. | Nhận context từ synthesis-question-outcomes và gates selected-source-excerpt mà không gộp authority. |
| selected-source-excerpt | Sở hữu source evidence, provenance, freshness và availability; không tự quyết định outcome. | Nhận context từ source-by-field-matrix và gates structured-extraction mà không gộp authority. |
| structured-extraction | Sở hữu state và obligation của stage được đặt tên; không lấy authority của region lân cận. | Nhận context từ selected-source-excerpt và gates normalization-confidence mà không gộp authority. |
| normalization-confidence | Sở hữu derived interpretation hoặc consequence preview; không trở thành input authority thứ hai. | Nhận context từ structured-extraction và gates reviewer-conflict mà không gộp authority. |
| reviewer-conflict | Sở hữu state và obligation của stage được đặt tên; không lấy authority của region lân cận. | Nhận context từ normalization-confidence và gates aggregate-synthesis mà không gộp authority. |
| aggregate-synthesis | Sở hữu derived interpretation hoặc consequence preview; không trở thành input authority thứ hai. | Nhận verified state từ reviewer-conflict và phát outcome hoặc recovery hữu hạn. |

## Responsive contract

### Wide

- Topology response: Keep matrix, selected source excerpt, structured extraction, confidence, conflict, and synthesis simultaneously visible.
- Failure trigger: simultaneous regions làm hẹp readable measure, che state hoặc phá named relationship.
- Navigation replacement: chưa cần khi các vùng còn đồng hiện; sticky chỉ dành cho orientation context vừa viewport.
- Sticky boundary: tự yield ở short-height và không che focused control.
- Overflow owner: page own vertical overflow; chỉ intrinsic matrix mới own bounded horizontal overflow.

### Intermediate

- Topology response: Let the matrix own bounded horizontal overflow; alternate source viewer and inspector without losing the selected cell.
- Failure trigger: supporting persistence cạnh tranh primary-task measure hoặc focus.
- Navigation replacement: named trigger mở supporting dialog; Escape hoặc Cancel đóng và focus trở đúng trigger.
- Sticky boundary: persistent context tự yield ở short-height; dialog body own bounded vertical overflow.
- Overflow owner: page giữ vertical overflow; supporting dialog chỉ own overflow bên trong boundary của nó.

### Compact

- Topology response: Stage source and outcome selection, exact excerpt, structured fields, confidence or conflict, then grouped synthesis records.
- Failure trigger: multi-pane relation không còn operable với body text 16px và target 44px.
- Navigation replacement: Previous, Next và stage selector thay pane adjacency; Back giữ selection, draft và recovery state.
- Sticky boundary: không fixed action bar; focused content luôn visible.
- Overflow owner: không page-level horizontal scroll; intrinsic matrix trở thành grouped records.

### Reflow

Thứ tự region graph là DOM order và reading order ở mọi width. CSS không reorder semantics. Text, localization, zoom và spacing growth làm region cao hơn hoặc trigger topology change; content không bị clip. State sống qua việc region đi vào hoặc ra supporting pane.

### Tương đương tương tác

Wide, intermediate và compact cung cấp cùng action, selection, pending guard, success, error, retry, stale/conflict recovery và outcome. Dynamic status được announce bằng polite live region mà không cướp focus. Modal giữ focus, hỗ trợ Escape hoặc Cancel và trả focus đúng trigger.

## Nghĩa vụ trạng thái

Domain state catalog giữ stable identifiers để EN/VI/context đồng bộ: source loading/unavailable; field missing/extracted; excerpt anchor valid/broken; normalization pending/conflict; confidence low/high; reviewer agreement/disagreement; aggregate stale; export.

| State family | Obligation | Focus transition | Responsive presentation |
|---|---|---|---|
| initial/loading | Giữ known anatomy và nêu region đang chờ. | Không tự move focus. | Giữ cùng stage identity. |
| ready | Hiển thị consistent fictional data và current selection. | Focus ở activating control. | Giữ selection qua transformation. |
| empty/not-applicable | Giải thích vì sao trống và valid next step. | Chỉ move đến recovery khi cần continuation. | Không xóa required region khác. |
| error/retry | Gắn error với owner và cung cấp bounded retry. | Multi-error focus vào summary; retry trả đúng action. | Error không chỉ dùng màu. |
| permission/unavailable | Giữ orientation và giải thích limitation. | Không focus locked control. | Cùng reason ở mọi topology. |
| pending | Chặn duplicate và giữ action meaning. | Không cướp focus để báo progress. | State ở cùng action owner. |
| success | Confirm outcome và valid continuation. | Chỉ move focus nếu giúp continuation. | Không tạo source of truth thứ hai. |
| stale/conflict | Nêu changed version và giữ safe input. | Focus contextual recovery choice. | Selection sống qua transformation. |
| domain states | Giữ đầy đủ state identifiers: source loading/unavailable; field missing/extracted; excerpt anchor valid/broken; normalization pending/conflict; confidence low/high; reviewer agreement/disagreement; aggregate stale; export. | Mọi modal trả focus đúng trigger. | Giữ action và recovery parity. |

## Ranh giới

### Chấp nhận

Accept khi dominant task cần chính region graph này, critical relationship tạo topology riêng, và mọi responsive state giữ task cùng recovery parity.

### Từ chối

Reject generic spreadsheet, comparison matrix, reconciliation diff và systematic weighted synthesis. Cũng reject duplicate-or-variation khi candidate chỉ đổi noun, density, component hoặc visual state.

### Phán quyết ranh giới

Kết quả hợp lệ là accept, reject, duplicate-or-variation hoặc needs-evidence theo Situation-code rule; visual preference không phải evidence.

## Handoff

- Grammar nhận real facts, semantic owners, permissions, states và action consequences.
- Principles nhận exact grid, measure, gaps, sizing, alignment, overflow, thresholds, sticky offsets và focus accommodation.
- Direction nhận visual character; template chỉ là một conforming realization.

## Bằng chứng research không ràng buộc

### Ranh giới bằng chứng

Các official source dưới đây chỉ là advisory evidence. Chúng không phải product truth, không khẳng định source organization đặt tên archetype tổng hợp này và không cấp quyền copy geometry, component tree, noun hoặc breakpoint.

### Nguồn

| Source | What it supports | What it does not prove |
|---|---|---|
| [Cochrane — Handbook chapter 5](https://training.cochrane.org/handbook/current/chapter-05) | Hỗ trợ structured extraction, provenance, and discrepancy resolution. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |
| [JBI — Manual for Evidence Synthesis 2024](https://jbi-global-wiki.refined.site/download/attachments/355599504/JBI%20Manual%20for%20Evidence%20Synthesis%202024.pdf) | Hỗ trợ evidence-synthesis methodology and reviewer governance. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |
| [W3C WAI — Grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Hỗ trợ keyboard access to a bounded two-dimensional data region. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |

## Output

~~~json
{
  "archetypeId": "evidence-extraction-synthesis-matrix",
  "matchedSituationCodes": [
    "AR-ESM-01",
    "AR-ESM-02",
    "AR-ESM-03"
  ],
  "aliases": [
    "evidence-extraction-synthesis-matrix",
    "evidence extraction",
    "source outcome matrix",
    "provenance synthesis"
  ],
  "dominantTask": "Extract normalized values or claims from sources into an outcome schema while preserving exact provenance and reviewer agreement.",
  "regions": [
    "extraction-workbench",
    "synthesis-question-outcomes",
    "source-by-field-matrix",
    "selected-source-excerpt",
    "structured-extraction",
    "normalization-confidence",
    "reviewer-conflict",
    "aggregate-synthesis"
  ],
  "relationships": [
    "Every matrix value is anchored to a source excerpt; normalization and reviewer agreement are explicit gates before aggregate synthesis."
  ],
  "responsive": {
    "wide": "Keep matrix, selected source excerpt, structured extraction, confidence, conflict, and synthesis simultaneously visible.",
    "intermediate": "Let the matrix own bounded horizontal overflow; alternate source viewer and inspector without losing the selected cell.",
    "compact": "Stage source and outcome selection, exact excerpt, structured fields, confidence or conflict, then grouped synthesis records.",
    "reflow": "DOM and reading order remain stable; content grows without page-level horizontal scrolling.",
    "readingOrder": "extraction-workbench → synthesis-question-outcomes → source-by-field-matrix → selected-source-excerpt → structured-extraction → normalization-confidence → reviewer-conflict → aggregate-synthesis",
    "navigationReplacement": "An anchored supporting pane at intermediate and a staged Previous/Next selector at compact.",
    "stickyBehavior": "Only orientation context may persist, and it yields at short height without obscuring focus.",
    "overflowOwner": "The source-by-field-matrix owns bounded horizontal overflow at intermediate; compact replaces it with grouped records.",
    "interactionParity": "Every action, state, pending guard, recovery path, and focus return remains available across bands."
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
    "focus transition",
    "source loading/unavailable; field missing/extracted; excerpt anchor valid/broken; normalization pending/conflict; confidence low/high; reviewer agreement/disagreement; aggregate stale; export"
  ],
  "boundaryVerdict": "needs-evidence",
  "grammarHandoff": [
    "product facts",
    "semantic owners",
    "permissions and consequences",
    "real state transitions"
  ],
  "principlesHandoff": [
    "exact geometry",
    "measure and overflow",
    "content-driven thresholds",
    "sticky offsets",
    "focus accommodation"
  ],
  "confidence": "high when the positive situations and critical relationship are evidenced; otherwise needs-evidence",
  "evidenceClasses": [
    "official task-domain guidance",
    "official independent design or service guidance",
    "official accessibility guidance"
  ]
}
~~~

Không trả class, token, component, source path, fixed breakpoint hoặc invented product fact.

