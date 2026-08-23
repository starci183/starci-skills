# Trung tâm phục hồi giao nhận thông báo

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | communication-delivery-recovery-center |
| Family | support |
| Dominant task | Phục hồi delivery lỗi của notice có deadline trong khi giữ immutable notice version, verify alternate channel và chứng minh receipt hoặc escalation. |
| Search aliases | communication-delivery-recovery-center; notice delivery recovery; alternate channel retry; delivery escalation |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity và state families. |

### Bất biến

- Phục hồi delivery lỗi của notice có deadline trong khi giữ immutable notice version, verify alternate channel và chứng minh receipt hoặc escalation.
- Mỗi required region có một semantic owner; supporting context không lấy dominant task.
- DOM order, reading order và focus order giữ nguyên meaning qua wide, intermediate và compact.
- Grammar cung cấp product facts; Principles resolve exact geometry; archetype không sở hữu visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-CDR-01 | Phục hồi delivery lỗi của notice có deadline trong khi giữ immutable notice version, verify alternate channel và chứng minh receipt hoặc escalation. | required positive evidence |
| AR-CDR-02 | Critical region relationship và owner separation đều có bằng chứng. | required relationship evidence |
| AR-CDR-03 | Wide relationship không còn hoạt động nhưng compact vẫn giữ task, state và recovery. | responsive transformation trigger |
| AR-CDR-04 | Error, permission, pending, success và stale/conflict đều có bounded recovery. | required state evidence |
| AR-CDR-90 | Reject service-continuity routing, asynchronous tracker, messaging inbox, generic retry error và notification setting. | reject |
| AR-CDR-91 | Khác biệt chỉ là product noun, density, color, component, state skin hoặc card count. | duplicate-or-variation |

### Quy tắc chọn

Chỉ trả accept khi AR-CDR-01, AR-CDR-02 và AR-CDR-03 có bằng chứng, không có AR-CDR-90 hoặc AR-CDR-91, và mọi required region vẫn cần thiết ở cả ba topology. Trả needs-evidence khi owner, relation hoặc transformation chưa resolve.

## Region graph

~~~text
delivery-recovery
├─ notice-obligation-deadline
├─ channel-endpoint-set
├─ attempt-failure-evidence
├─ alternate-channel-verification
├─ retry-replay-plan
├─ delivery-receipt
└─ manual-escalation
~~~

Critical relationship: Notice obligation, deadline và immutable payload chi phối mọi retry; channel attempt tạo lineage kết thúc bằng receipt hoặc escalation.

### Nghĩa vụ vùng

| Region ID | Owner | Required relationship |
|---|---|---|
| delivery-recovery | Sở hữu boundary của dominant task và chứa mọi required region mà không tạo product semantics. | Chứa notice-obligation-deadline, channel-endpoint-set, attempt-failure-evidence, alternate-channel-verification, retry-replay-plan, delivery-receipt, manual-escalation và giữ owner độc lập của từng region. |
| notice-obligation-deadline | Sở hữu state và obligation của stage được đặt tên; không lấy authority của region lân cận. | Nhận context từ delivery-recovery và gates channel-endpoint-set mà không gộp authority. |
| channel-endpoint-set | Sở hữu membership, identity, status và current selection của collection hữu hạn này. | Nhận context từ notice-obligation-deadline và gates attempt-failure-evidence mà không gộp authority. |
| attempt-failure-evidence | Sở hữu source evidence, provenance, freshness và availability; không tự quyết định outcome. | Nhận context từ channel-endpoint-set và gates alternate-channel-verification mà không gộp authority. |
| alternate-channel-verification | Sở hữu state và obligation của stage được đặt tên; không lấy authority của region lân cận. | Nhận context từ attempt-failure-evidence và gates retry-replay-plan mà không gộp authority. |
| retry-replay-plan | Sở hữu state và obligation của stage được đặt tên; không lấy authority của region lân cận. | Nhận context từ alternate-channel-verification và gates delivery-receipt mà không gộp authority. |
| delivery-receipt | Sở hữu bounded outcome, receipt hoặc recovery route sau khi mọi upstream gate đã pass. | Nhận context từ retry-replay-plan và gates manual-escalation mà không gộp authority. |
| manual-escalation | Sở hữu bounded outcome, receipt hoặc recovery route sau khi mọi upstream gate đã pass. | Nhận verified state từ delivery-receipt và phát outcome hoặc recovery hữu hạn. |

## Responsive contract

### Wide

- Topology response: Keep notice obligation and deadline, endpoints, failure evidence, recovery plan, and receipt simultaneously visible.
- Failure trigger: simultaneous regions làm hẹp readable measure, che state hoặc phá named relationship.
- Navigation replacement: chưa cần khi các vùng còn đồng hiện; sticky chỉ dành cho orientation context vừa viewport.
- Sticky boundary: tự yield ở short-height và không che focused control.
- Overflow owner: page own vertical overflow; chỉ intrinsic matrix mới own bounded horizontal overflow.

### Intermediate

- Topology response: Make the failure queue and active recovery primary while notice version and deadline persist.
- Failure trigger: supporting persistence cạnh tranh primary-task measure hoặc focus.
- Navigation replacement: named trigger mở supporting dialog; Escape hoặc Cancel đóng và focus trở đúng trigger.
- Sticky boundary: persistent context tự yield ở short-height; dialog body own bounded vertical overflow.
- Overflow owner: page giữ vertical overflow; supporting dialog chỉ own overflow bên trong boundary của nó.

### Compact

- Topology response: Stage urgent notice, failure cause, alternate-channel verification, exact-version retry, then receipt or escalation.
- Failure trigger: multi-pane relation không còn operable với body text 16px và target 44px.
- Navigation replacement: Previous, Next và stage selector thay pane adjacency; Back giữ selection, draft và recovery state.
- Sticky boundary: không fixed action bar; focused content luôn visible.
- Overflow owner: không page-level horizontal scroll; intrinsic matrix trở thành grouped records.

### Reflow

Thứ tự region graph là DOM order và reading order ở mọi width. CSS không reorder semantics. Text, localization, zoom và spacing growth làm region cao hơn hoặc trigger topology change; content không bị clip. State sống qua việc region đi vào hoặc ra supporting pane.

### Tương đương tương tác

Wide, intermediate và compact cung cấp cùng action, selection, pending guard, success, error, retry, stale/conflict recovery và outcome. Dynamic status được announce bằng polite live region mà không cướp focus. Modal giữ focus, hỗ trợ Escape hoặc Cancel và trả focus đúng trigger.

## Nghĩa vụ trạng thái

Domain state catalog giữ stable identifiers để EN/VI/context đồng bộ: notice pending/due/overdue; endpoint verified/unverified; attempt queued/delivered/bounced/expired; retry locked/running; alternate unavailable; receipt confirmed; manual escalation.

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
| domain states | Giữ đầy đủ state identifiers: notice pending/due/overdue; endpoint verified/unverified; attempt queued/delivered/bounced/expired; retry locked/running; alternate unavailable; receipt confirmed; manual escalation. | Mọi modal trả focus đúng trigger. | Giữ action và recovery parity. |

## Ranh giới

### Chấp nhận

Accept khi dominant task cần chính region graph này, critical relationship tạo topology riêng, và mọi responsive state giữ task cùng recovery parity.

### Từ chối

Reject service-continuity routing, asynchronous tracker, messaging inbox, generic retry error và notification setting. Cũng reject duplicate-or-variation khi candidate chỉ đổi noun, density, component hoặc visual state.

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
| [GOV.UK Notify — Email status](https://www.notifications.service.gov.uk/using-notify/message-status/email) | Hỗ trợ delivery states and failure diagnosis. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |
| [NHS England — NHS Notify](https://digital.nhs.uk/services/nhs-notify) | Hỗ trợ ordered multi-channel delivery and fallback. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |
| [W3C WAI — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Hỗ trợ announcing retries and receipts without moving focus. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |

## Output

~~~json
{
  "archetypeId": "communication-delivery-recovery-center",
  "matchedSituationCodes": [
    "AR-CDR-01",
    "AR-CDR-02",
    "AR-CDR-03"
  ],
  "aliases": [
    "communication-delivery-recovery-center",
    "notice delivery recovery",
    "alternate channel retry",
    "delivery escalation"
  ],
  "dominantTask": "Repair failed delivery of a deadline-bound notice while preserving the immutable notice version, verifying an alternate channel, and proving receipt or escalation.",
  "regions": [
    "delivery-recovery",
    "notice-obligation-deadline",
    "channel-endpoint-set",
    "attempt-failure-evidence",
    "alternate-channel-verification",
    "retry-replay-plan",
    "delivery-receipt",
    "manual-escalation"
  ],
  "relationships": [
    "The notice obligation, deadline, and immutable payload govern every retry; channel attempts form a lineage that ends in receipt or escalation."
  ],
  "responsive": {
    "wide": "Keep notice obligation and deadline, endpoints, failure evidence, recovery plan, and receipt simultaneously visible.",
    "intermediate": "Make the failure queue and active recovery primary while notice version and deadline persist.",
    "compact": "Stage urgent notice, failure cause, alternate-channel verification, exact-version retry, then receipt or escalation.",
    "reflow": "DOM and reading order remain stable; content grows without page-level horizontal scrolling.",
    "readingOrder": "delivery-recovery → notice-obligation-deadline → channel-endpoint-set → attempt-failure-evidence → alternate-channel-verification → retry-replay-plan → delivery-receipt → manual-escalation",
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
    "notice pending/due/overdue; endpoint verified/unverified; attempt queued/delivered/bounced/expired; retry locked/running; alternate unavailable; receipt confirmed; manual escalation"
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

