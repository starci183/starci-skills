# Giải thích và challenge quyết định tự động

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | automated-decision-explanation-challenge |
| Family | flow |
| Dominant task | Hiểu consequential automated outcome, inspect factor, source data và uncertainty, sau đó correct input hoặc challenge để human review. |
| Search aliases | automated-decision-explanation-challenge; automated decision challenge; factor explanation; human review request |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity và state families. |

### Bất biến

- Hiểu consequential automated outcome, inspect factor, source data và uncertainty, sau đó correct input hoặc challenge để human review.
- Mỗi required region có một semantic owner; supporting context không lấy dominant task.
- DOM order, reading order và focus order giữ nguyên meaning qua wide, intermediate và compact.
- Grammar cung cấp product facts; Principles resolve exact geometry; archetype không sở hữu visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-ADC-01 | Hiểu consequential automated outcome, inspect factor, source data và uncertainty, sau đó correct input hoặc challenge để human review. | required positive evidence |
| AR-ADC-02 | Critical region relationship và owner separation đều có bằng chứng. | required relationship evidence |
| AR-ADC-03 | Wide relationship không còn hoạt động nhưng compact vẫn giữ task, state và recovery. | responsive transformation trigger |
| AR-ADC-04 | Error, permission, pending, success và stale/conflict đều có bounded recovery. | required state evidence |
| AR-ADC-90 | Reject analytical briefing, generic appeal form, model dashboard và one-case dossier thiếu subject-specific provenance cùng review. | reject |
| AR-ADC-91 | Khác biệt chỉ là product noun, density, color, component, state skin hoặc card count. | duplicate-or-variation |

### Quy tắc chọn

Chỉ trả accept khi AR-ADC-01, AR-ADC-02 và AR-ADC-03 có bằng chứng, không có AR-ADC-90 hoặc AR-ADC-91, và mọi required region vẫn cần thiết ở cả ba topology. Trả needs-evidence khi owner, relation hoặc transformation chưa resolve.

## Region graph

~~~text
decision-challenge
├─ outcome-impact
├─ factor-explanation
├─ source-data-provenance
├─ limits-uncertainty
├─ correction-or-challenge-grounds
├─ evidence-submit
└─ human-review-tracker
~~~

Critical relationship: Factor explanation và transactional challenge là hai owner ngang hàng; exact disputed factor và source provenance tồn tại suốt human review.

### Nghĩa vụ vùng

| Region ID | Owner | Required relationship |
|---|---|---|
| decision-challenge | Sở hữu boundary của dominant task và chứa mọi required region mà không tạo product semantics. | Chứa outcome-impact, factor-explanation, source-data-provenance, limits-uncertainty, correction-or-challenge-grounds, evidence-submit, human-review-tracker và giữ owner độc lập của từng region. |
| outcome-impact | Sở hữu derived interpretation hoặc consequence preview; không trở thành input authority thứ hai. | Nhận context từ decision-challenge và gates factor-explanation mà không gộp authority. |
| factor-explanation | Sở hữu state và obligation của stage được đặt tên; không lấy authority của region lân cận. | Nhận context từ outcome-impact và gates source-data-provenance mà không gộp authority. |
| source-data-provenance | Sở hữu source evidence, provenance, freshness và availability; không tự quyết định outcome. | Nhận context từ factor-explanation và gates limits-uncertainty mà không gộp authority. |
| limits-uncertainty | Sở hữu derived interpretation hoặc consequence preview; không trở thành input authority thứ hai. | Nhận context từ source-data-provenance và gates correction-or-challenge-grounds mà không gộp authority. |
| correction-or-challenge-grounds | Sở hữu editable decision state, validation và pending guard cho stage được đặt tên. | Nhận context từ limits-uncertainty và gates evidence-submit mà không gộp authority. |
| evidence-submit | Sở hữu source evidence, provenance, freshness và availability; không tự quyết định outcome. | Nhận context từ correction-or-challenge-grounds và gates human-review-tracker mà không gộp authority. |
| human-review-tracker | Sở hữu bounded outcome, receipt hoặc recovery route sau khi mọi upstream gate đã pass. | Nhận verified state từ evidence-submit và phát outcome hoặc recovery hữu hạn. |

## Responsive contract

### Wide

- Topology response: Keep outcome and factors, source facts, uncertainty, challenge grounds, and review status simultaneously visible.
- Failure trigger: simultaneous regions làm hẹp readable measure, che state hoặc phá named relationship.
- Navigation replacement: chưa cần khi các vùng còn đồng hiện; sticky chỉ dành cho orientation context vừa viewport.
- Sticky boundary: tự yield ở short-height và không che focused control.
- Overflow owner: page own vertical overflow; chỉ intrinsic matrix mới own bounded horizontal overflow.

### Intermediate

- Topology response: Move source provenance to a drawer; keep factors, limits, and grounds primary.
- Failure trigger: supporting persistence cạnh tranh primary-task measure hoặc focus.
- Navigation replacement: named trigger mở supporting dialog; Escape hoặc Cancel đóng và focus trở đúng trigger.
- Sticky boundary: persistent context tự yield ở short-height; dialog body own bounded vertical overflow.
- Overflow owner: page giữ vertical overflow; supporting dialog chỉ own overflow bên trong boundary của nó.

### Compact

- Topology response: Stage outcome, factors, source facts, limits, correction or challenge grounds, evidence submission, then human-review status.
- Failure trigger: multi-pane relation không còn operable với body text 16px và target 44px.
- Navigation replacement: Previous, Next và stage selector thay pane adjacency; Back giữ selection, draft và recovery state.
- Sticky boundary: không fixed action bar; focused content luôn visible.
- Overflow owner: không page-level horizontal scroll; intrinsic matrix trở thành grouped records.

### Reflow

Thứ tự region graph là DOM order và reading order ở mọi width. CSS không reorder semantics. Text, localization, zoom và spacing growth làm region cao hơn hoặc trigger topology change; content không bị clip. State sống qua việc region đi vào hoặc ra supporting pane.

### Tương đương tương tác

Wide, intermediate và compact cung cấp cùng action, selection, pending guard, success, error, retry, stale/conflict recovery và outcome. Dynamic status được announce bằng polite live region mà không cướp focus. Modal giữ focus, hỗ trợ Escape hoặc Cancel và trả focus đúng trigger.

## Nghĩa vụ trạng thái

Domain state catalog giữ stable identifiers để EN/VI/context đồng bộ: outcome loading/final; factor available/withheld; source fact correct/incorrect/unknown; uncertainty high; correction allowed/blocked; challenge draft/submitted; evidence missing; review pending/decided.

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
| domain states | Giữ đầy đủ state identifiers: outcome loading/final; factor available/withheld; source fact correct/incorrect/unknown; uncertainty high; correction allowed/blocked; challenge draft/submitted; evidence missing; review pending/decided. | Mọi modal trả focus đúng trigger. | Giữ action và recovery parity. |

## Ranh giới

### Chấp nhận

Accept khi dominant task cần chính region graph này, critical relationship tạo topology riêng, và mọi responsive state giữ task cùng recovery parity.

### Từ chối

Reject analytical briefing, generic appeal form, model dashboard và one-case dossier thiếu subject-specific provenance cùng review. Cũng reject duplicate-or-variation khi candidate chỉ đổi noun, density, component hoặc visual state.

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
| [NIST — AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework) | Hỗ trợ transparency, traceability, and risk management for AI outcomes. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |
| [OECD — AI Principles](https://www.oecd.org/en/topics/ai-principles.html) | Hỗ trợ meaningful explanation and the ability to challenge consequential output. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |
| [W3C WAI — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Hỗ trợ accessible challenge and review-status updates. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |

## Output

~~~json
{
  "archetypeId": "automated-decision-explanation-challenge",
  "matchedSituationCodes": [
    "AR-ADC-01",
    "AR-ADC-02",
    "AR-ADC-03"
  ],
  "aliases": [
    "automated-decision-explanation-challenge",
    "automated decision challenge",
    "factor explanation",
    "human review request"
  ],
  "dominantTask": "Understand a consequential automated outcome, inspect factors, source data, and uncertainty, then correct inputs or challenge it for human review.",
  "regions": [
    "decision-challenge",
    "outcome-impact",
    "factor-explanation",
    "source-data-provenance",
    "limits-uncertainty",
    "correction-or-challenge-grounds",
    "evidence-submit",
    "human-review-tracker"
  ],
  "relationships": [
    "Factor explanation and the transactional challenge are peer owners; the exact disputed factor and source provenance persist through human review."
  ],
  "responsive": {
    "wide": "Keep outcome and factors, source facts, uncertainty, challenge grounds, and review status simultaneously visible.",
    "intermediate": "Move source provenance to a drawer; keep factors, limits, and grounds primary.",
    "compact": "Stage outcome, factors, source facts, limits, correction or challenge grounds, evidence submission, then human-review status.",
    "reflow": "DOM and reading order remain stable; content grows without page-level horizontal scrolling.",
    "readingOrder": "decision-challenge → outcome-impact → factor-explanation → source-data-provenance → limits-uncertainty → correction-or-challenge-grounds → evidence-submit → human-review-tracker",
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
    "outcome loading/final; factor available/withheld; source fact correct/incorrect/unknown; uncertainty high; correction allowed/blocked; challenge draft/submitted; evidence missing; review pending/decided"
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

