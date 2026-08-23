# Bàn sàng lọc tài liệu

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | literature-screening-workbench |
| Family | work |
| Dominant task | Phân loại citation theo review protocol, ghi exclusion reason và adjudicate conflict giữa reviewer độc lập. |
| Search aliases | literature-screening-workbench; citation screening; study selection; reviewer adjudication |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity và state families. |

### Bất biến

- Phân loại citation theo review protocol, ghi exclusion reason và adjudicate conflict giữa reviewer độc lập.
- Mỗi required region có một semantic owner; supporting context không lấy dominant task.
- DOM order, reading order và focus order giữ nguyên meaning qua wide, intermediate và compact.
- Grammar cung cấp product facts; Principles resolve exact geometry; archetype không sở hữu visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-LSW-01 | Phân loại citation theo review protocol, ghi exclusion reason và adjudicate conflict giữa reviewer độc lập. | required positive evidence |
| AR-LSW-02 | Critical region relationship và owner separation đều có bằng chứng. | required relationship evidence |
| AR-LSW-03 | Wide relationship không còn hoạt động nhưng compact vẫn giữ task, state và recovery. | responsive transformation trigger |
| AR-LSW-04 | Error, permission, pending, success và stale/conflict đều có bounded recovery. | required state evidence |
| AR-LSW-90 | Reject generic operational queue, one-case resolution, systematic synthesis và content moderation. | reject |
| AR-LSW-91 | Khác biệt chỉ là product noun, density, color, component, state skin hoặc card count. | duplicate-or-variation |

### Quy tắc chọn

Chỉ trả accept khi AR-LSW-01, AR-LSW-02 và AR-LSW-03 có bằng chứng, không có AR-LSW-90 hoặc AR-LSW-91, và mọi required region vẫn cần thiết ở cả ba topology. Trả needs-evidence khi owner, relation hoặc transformation chưa resolve.

## Region graph

~~~text
screening-workbench
├─ review-protocol
├─ citation-queue
├─ title-abstract-evidence
├─ inclusion-criteria
├─ include-exclude-uncertain-decision
├─ reviewer-conflict-adjudication
└─ flow-counts
~~~

Critical relationship: Review protocol và quyết định blinded reviewer độc lập sở hữu classification; flow count được suy ra từ quyết định đã adjudicate.

### Nghĩa vụ vùng

| Region ID | Owner | Required relationship |
|---|---|---|
| screening-workbench | Sở hữu boundary của dominant task và chứa mọi required region mà không tạo product semantics. | Chứa review-protocol, citation-queue, title-abstract-evidence, inclusion-criteria, include-exclude-uncertain-decision, reviewer-conflict-adjudication, flow-counts và giữ owner độc lập của từng region. |
| review-protocol | Sở hữu state và obligation của stage được đặt tên; không lấy authority của region lân cận. | Nhận context từ screening-workbench và gates citation-queue mà không gộp authority. |
| citation-queue | Sở hữu membership, identity, status và current selection của collection hữu hạn này. | Nhận context từ review-protocol và gates title-abstract-evidence mà không gộp authority. |
| title-abstract-evidence | Sở hữu source evidence, provenance, freshness và availability; không tự quyết định outcome. | Nhận context từ citation-queue và gates inclusion-criteria mà không gộp authority. |
| inclusion-criteria | Sở hữu state và obligation của stage được đặt tên; không lấy authority của region lân cận. | Nhận context từ title-abstract-evidence và gates include-exclude-uncertain-decision mà không gộp authority. |
| include-exclude-uncertain-decision | Sở hữu editable decision state, validation và pending guard cho stage được đặt tên. | Nhận context từ inclusion-criteria và gates reviewer-conflict-adjudication mà không gộp authority. |
| reviewer-conflict-adjudication | Sở hữu state và obligation của stage được đặt tên; không lấy authority của region lân cận. | Nhận context từ include-exclude-uncertain-decision và gates flow-counts mà không gộp authority. |
| flow-counts | Sở hữu derived interpretation hoặc consequence preview; không trở thành input authority thứ hai. | Nhận verified state từ reviewer-conflict-adjudication và phát outcome hoặc recovery hữu hạn. |

## Responsive contract

### Wide

- Topology response: Keep citation queue, title and abstract evidence, inclusion criteria, decision, and flow counts simultaneously visible.
- Failure trigger: simultaneous regions làm hẹp readable measure, che state hoặc phá named relationship.
- Navigation replacement: chưa cần khi các vùng còn đồng hiện; sticky chỉ dành cho orientation context vừa viewport.
- Sticky boundary: tự yield ở short-height và không che focused control.
- Overflow owner: page own vertical overflow; chỉ intrinsic matrix mới own bounded horizontal overflow.

### Intermediate

- Topology response: Move the queue to a drawer; keep citation evidence and criteria primary.
- Failure trigger: supporting persistence cạnh tranh primary-task measure hoặc focus.
- Navigation replacement: named trigger mở supporting dialog; Escape hoặc Cancel đóng và focus trở đúng trigger.
- Sticky boundary: persistent context tự yield ở short-height; dialog body own bounded vertical overflow.
- Overflow owner: page giữ vertical overflow; supporting dialog chỉ own overflow bên trong boundary của nó.

### Compact

- Topology response: Stage one citation, criteria, decision and reason, then next; use a separate adjudication route that preserves queue position.
- Failure trigger: multi-pane relation không còn operable với body text 16px và target 44px.
- Navigation replacement: Previous, Next và stage selector thay pane adjacency; Back giữ selection, draft và recovery state.
- Sticky boundary: không fixed action bar; focused content luôn visible.
- Overflow owner: không page-level horizontal scroll; intrinsic matrix trở thành grouped records.

### Reflow

Thứ tự region graph là DOM order và reading order ở mọi width. CSS không reorder semantics. Text, localization, zoom và spacing growth làm region cao hơn hoặc trigger topology change; content không bị clip. State sống qua việc region đi vào hoặc ra supporting pane.

### Tương đương tương tác

Wide, intermediate và compact cung cấp cùng action, selection, pending guard, success, error, retry, stale/conflict recovery và outcome. Dynamic status được announce bằng polite live region mà không cướp focus. Modal giữ focus, hỗ trợ Escape hoặc Cancel và trả focus đúng trigger.

## Nghĩa vụ trạng thái

Domain state catalog giữ stable identifiers để EN/VI/context đồng bộ: citation loading/duplicate; reviewer assignment blind/revealed; include/exclude/uncertain; reason missing; disagreement open/adjudicated; full text unavailable; flow counts stale; screening complete.

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
| domain states | Giữ đầy đủ state identifiers: citation loading/duplicate; reviewer assignment blind/revealed; include/exclude/uncertain; reason missing; disagreement open/adjudicated; full text unavailable; flow counts stale; screening complete. | Mọi modal trả focus đúng trigger. | Giữ action và recovery parity. |

## Ranh giới

### Chấp nhận

Accept khi dominant task cần chính region graph này, critical relationship tạo topology riêng, và mọi responsive state giữ task cùng recovery parity.

### Từ chối

Reject generic operational queue, one-case resolution, systematic synthesis và content moderation. Cũng reject duplicate-or-variation khi candidate chỉ đổi noun, density, component hoặc visual state.

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
| [Cochrane — Selecting studies and collecting data](https://training.cochrane.org/interactivelearning/module-4-selecting-studies-and-collecting-data) | Hỗ trợ protocol-based study selection and duplicate reviewer work. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |
| [IBM Carbon — Data table usage](https://carbondesignsystem.com/components/data-table/usage/) | Hỗ trợ bounded queue navigation and explicit row state. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |
| [W3C WAI — Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Hỗ trợ preserving citation and adjudication focus order. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |

## Output

~~~json
{
  "archetypeId": "literature-screening-workbench",
  "matchedSituationCodes": [
    "AR-LSW-01",
    "AR-LSW-02",
    "AR-LSW-03"
  ],
  "aliases": [
    "literature-screening-workbench",
    "citation screening",
    "study selection",
    "reviewer adjudication"
  ],
  "dominantTask": "Classify citations against a review protocol, record exclusion reasons, and adjudicate independent reviewer conflicts.",
  "regions": [
    "screening-workbench",
    "review-protocol",
    "citation-queue",
    "title-abstract-evidence",
    "inclusion-criteria",
    "include-exclude-uncertain-decision",
    "reviewer-conflict-adjudication",
    "flow-counts"
  ],
  "relationships": [
    "The review protocol and blinded reviewer decisions independently own classification; flow counts derive from adjudicated decisions."
  ],
  "responsive": {
    "wide": "Keep citation queue, title and abstract evidence, inclusion criteria, decision, and flow counts simultaneously visible.",
    "intermediate": "Move the queue to a drawer; keep citation evidence and criteria primary.",
    "compact": "Stage one citation, criteria, decision and reason, then next; use a separate adjudication route that preserves queue position.",
    "reflow": "DOM and reading order remain stable; content grows without page-level horizontal scrolling.",
    "readingOrder": "screening-workbench → review-protocol → citation-queue → title-abstract-evidence → inclusion-criteria → include-exclude-uncertain-decision → reviewer-conflict-adjudication → flow-counts",
    "navigationReplacement": "An anchored supporting pane at intermediate and a staged Previous/Next selector at compact.",
    "stickyBehavior": "Only orientation context may persist, and it yields at short height without obscuring focus.",
    "overflowOwner": "The page owns vertical overflow; no page-level horizontal overflow is allowed.",
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
    "citation loading/duplicate; reviewer assignment blind/revealed; include/exclude/uncertain; reason missing; disagreement open/adjudicated; full text unavailable; flow counts stale; screening complete"
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

