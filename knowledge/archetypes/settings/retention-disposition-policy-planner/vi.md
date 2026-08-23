# Bộ lập kế hoạch chính sách lưu giữ và disposition

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | retention-disposition-policy-planner |
| Family | settings |
| Dominant task | Định nghĩa lifecycle trigger, retention period, hold, precedence và irreversible disposition, sau đó simulate impact trước khi publish và lock policy. |
| Search aliases | retention-disposition-policy-planner; retention policy planner; disposition rule simulation; records lifecycle policy |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity và state families. |

### Bất biến

- Định nghĩa lifecycle trigger, retention period, hold, precedence và irreversible disposition, sau đó simulate impact trước khi publish và lock policy.
- Mỗi required region có một semantic owner; supporting context không lấy dominant task.
- DOM order, reading order và focus order giữ nguyên meaning qua wide, intermediate và compact.
- Grammar cung cấp product facts; Principles resolve exact geometry; archetype không sở hữu visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-RDP-01 | Định nghĩa lifecycle trigger, retention period, hold, precedence và irreversible disposition, sau đó simulate impact trước khi publish và lock policy. | required positive evidence |
| AR-RDP-02 | Critical region relationship và owner separation đều có bằng chứng. | required relationship evidence |
| AR-RDP-03 | Wide relationship không còn hoạt động nhưng compact vẫn giữ task, state và recovery. | responsive transformation trigger |
| AR-RDP-04 | Error, permission, pending, success và stale/conflict đều có bounded recovery. | required state evidence |
| AR-RDP-90 | Reject generic rule builder, effective-setting provenance, operational disposition queue và preference center. | reject |
| AR-RDP-91 | Khác biệt chỉ là product noun, density, color, component, state skin hoặc card count. | duplicate-or-variation |

### Quy tắc chọn

Chỉ trả accept khi AR-RDP-01, AR-RDP-02 và AR-RDP-03 có bằng chứng, không có AR-RDP-90 hoặc AR-RDP-91, và mọi required region vẫn cần thiết ở cả ba topology. Trả needs-evidence khi owner, relation hoặc transformation chưa resolve.

## Region graph

~~~text
retention-policy-planner
├─ scope-record-class-tree
├─ lifecycle-timeline
├─ trigger-retention-disposition-editor
├─ holds-exceptions-precedence
├─ impact-simulation
└─ publish-lock-receipt
~~~

Critical relationship: Temporal rule và hold precedence chi phối simulated outcome; planner này không thực thi disposition trên record cohort.

### Nghĩa vụ vùng

| Region ID | Owner | Required relationship |
|---|---|---|
| retention-policy-planner | Sở hữu boundary của dominant task và chứa mọi required region mà không tạo product semantics. | Chứa scope-record-class-tree, lifecycle-timeline, trigger-retention-disposition-editor, holds-exceptions-precedence, impact-simulation, publish-lock-receipt và giữ owner độc lập của từng region. |
| scope-record-class-tree | Sở hữu membership, identity, status và current selection của collection hữu hạn này. | Nhận context từ retention-policy-planner và gates lifecycle-timeline mà không gộp authority. |
| lifecycle-timeline | Sở hữu state và obligation của stage được đặt tên; không lấy authority của region lân cận. | Nhận context từ scope-record-class-tree và gates trigger-retention-disposition-editor mà không gộp authority. |
| trigger-retention-disposition-editor | Sở hữu editable decision state, validation và pending guard cho stage được đặt tên. | Nhận context từ lifecycle-timeline và gates holds-exceptions-precedence mà không gộp authority. |
| holds-exceptions-precedence | Sở hữu state và obligation của stage được đặt tên; không lấy authority của region lân cận. | Nhận context từ trigger-retention-disposition-editor và gates impact-simulation mà không gộp authority. |
| impact-simulation | Sở hữu derived interpretation hoặc consequence preview; không trở thành input authority thứ hai. | Nhận context từ holds-exceptions-precedence và gates publish-lock-receipt mà không gộp authority. |
| publish-lock-receipt | Sở hữu bounded outcome, receipt hoặc recovery route sau khi mọi upstream gate đã pass. | Nhận verified state từ impact-simulation và phát outcome hoặc recovery hữu hạn. |

## Responsive contract

### Wide

- Topology response: Keep record-class scope, lifecycle timeline, rule editor, precedence evidence, and impact simulation simultaneously visible.
- Failure trigger: simultaneous regions làm hẹp readable measure, che state hoặc phá named relationship.
- Navigation replacement: chưa cần khi các vùng còn đồng hiện; sticky chỉ dành cho orientation context vừa viewport.
- Sticky boundary: tự yield ở short-height và không che focused control.
- Overflow owner: page own vertical overflow; chỉ intrinsic matrix mới own bounded horizontal overflow.

### Intermediate

- Topology response: Move the class tree to a drawer; keep lifecycle and selected precedence primary.
- Failure trigger: supporting persistence cạnh tranh primary-task measure hoặc focus.
- Navigation replacement: named trigger mở supporting dialog; Escape hoặc Cancel đóng và focus trở đúng trigger.
- Sticky boundary: persistent context tự yield ở short-height; dialog body own bounded vertical overflow.
- Overflow owner: page giữ vertical overflow; supporting dialog chỉ own overflow bên trong boundary của nó.

### Compact

- Topology response: Stage record class, trigger, duration and hold, disposition, simulated outcome, then the explicit publish-and-lock ceremony.
- Failure trigger: multi-pane relation không còn operable với body text 16px và target 44px.
- Navigation replacement: Previous, Next và stage selector thay pane adjacency; Back giữ selection, draft và recovery state.
- Sticky boundary: không fixed action bar; focused content luôn visible.
- Overflow owner: không page-level horizontal scroll; intrinsic matrix trở thành grouped records.

### Reflow

Thứ tự region graph là DOM order và reading order ở mọi width. CSS không reorder semantics. Text, localization, zoom và spacing growth làm region cao hơn hoặc trigger topology change; content không bị clip. State sống qua việc region đi vào hoặc ra supporting pane.

### Tương đương tương tác

Wide, intermediate và compact cung cấp cùng action, selection, pending guard, success, error, retry, stale/conflict recovery và outcome. Dynamic status được announce bằng polite live region mà không cướp focus. Modal giữ focus, hỗ trợ Escape hoặc Cancel và trả focus đúng trigger.

## Nghĩa vụ trạng thái

Domain state catalog giữ stable identifiers để EN/VI/context đồng bộ: class loading; trigger absent/valid; duration invalid; hold active/conflicting; precedence unresolved; simulation running/impact; policy draft/reviewed/locked; publish failure; superseded version.

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
| domain states | Giữ đầy đủ state identifiers: class loading; trigger absent/valid; duration invalid; hold active/conflicting; precedence unresolved; simulation running/impact; policy draft/reviewed/locked; publish failure; superseded version. | Mọi modal trả focus đúng trigger. | Giữ action và recovery parity. |

## Ranh giới

### Chấp nhận

Accept khi dominant task cần chính region graph này, critical relationship tạo topology riêng, và mọi responsive state giữ task cùng recovery parity.

### Từ chối

Reject generic rule builder, effective-setting provenance, operational disposition queue và preference center. Cũng reject duplicate-or-variation khi candidate chỉ đổi noun, density, component hoặc visual state.

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
| [Microsoft Purview — Create retention policies](https://learn.microsoft.com/en-us/purview/create-retention-policies) | Hỗ trợ retention outcomes, scopes, and precedence concerns. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |
| [NIST — Privacy Framework](https://www.nist.gov/privacy-framework) | Hỗ trợ privacy risk governance and lifecycle accountability. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |
| [W3C WAI — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Hỗ trợ topology transformation without two-dimensional page scrolling. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |

## Output

~~~json
{
  "archetypeId": "retention-disposition-policy-planner",
  "matchedSituationCodes": [
    "AR-RDP-01",
    "AR-RDP-02",
    "AR-RDP-03"
  ],
  "aliases": [
    "retention-disposition-policy-planner",
    "retention policy planner",
    "disposition rule simulation",
    "records lifecycle policy"
  ],
  "dominantTask": "Define lifecycle triggers, retention periods, holds, precedence, and irreversible disposition, then simulate impact before publishing and locking policy.",
  "regions": [
    "retention-policy-planner",
    "scope-record-class-tree",
    "lifecycle-timeline",
    "trigger-retention-disposition-editor",
    "holds-exceptions-precedence",
    "impact-simulation",
    "publish-lock-receipt"
  ],
  "relationships": [
    "Temporal rules and hold precedence govern simulated outcomes; this planner never executes disposition on record cohorts."
  ],
  "responsive": {
    "wide": "Keep record-class scope, lifecycle timeline, rule editor, precedence evidence, and impact simulation simultaneously visible.",
    "intermediate": "Move the class tree to a drawer; keep lifecycle and selected precedence primary.",
    "compact": "Stage record class, trigger, duration and hold, disposition, simulated outcome, then the explicit publish-and-lock ceremony.",
    "reflow": "DOM and reading order remain stable; content grows without page-level horizontal scrolling.",
    "readingOrder": "retention-policy-planner → scope-record-class-tree → lifecycle-timeline → trigger-retention-disposition-editor → holds-exceptions-precedence → impact-simulation → publish-lock-receipt",
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
    "class loading; trigger absent/valid; duration invalid; hold active/conflicting; precedence unresolved; simulation running/impact; policy draft/reviewed/locked; publish failure; superseded version"
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

