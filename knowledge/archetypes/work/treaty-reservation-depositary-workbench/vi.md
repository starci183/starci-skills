# Bàn nghiệp vụ depositary cho treaty và reservation

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | treaty-reservation-depositary-workbench |
| Family | work |
| Dominant task | Quản trị một multilateral treaty với vai trò depositary bằng cách validate instrument, register party action và reservation, route objection và withdrawal, suy ra entry-into-force effect và phát notification mà không adjudicate merits. |
| Search aliases | treaty-reservation-depositary-workbench; treaty depositary; reservation objection register; entry into force |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity và state families. |

### Bất biến

- Quản trị một multilateral treaty với vai trò depositary bằng cách validate instrument, register party action và reservation, route objection và withdrawal, suy ra entry-into-force effect và phát notification mà không adjudicate merits.
- Mỗi required region có một semantic owner; supporting context không lấy dominant task.
- DOM order, reading order và focus order giữ nguyên meaning qua wide, intermediate và compact.
- Grammar cung cấp product facts; Principles resolve exact geometry; archetype không sở hữu visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-TRD-01 | Quản trị một multilateral treaty với vai trò depositary bằng cách validate instrument, register party action và reservation, route objection và withdrawal, suy ra entry-into-force effect và phát notification mà không adjudicate merits. | required positive evidence |
| AR-TRD-02 | Critical region relationship và owner separation đều có bằng chứng. | required relationship evidence |
| AR-TRD-03 | Wide relationship không còn hoạt động nhưng compact vẫn giữ task, state và recovery. | responsive transformation trigger |
| AR-TRD-04 | Error, permission, pending, success và stale/conflict đều có bounded recovery. | required state evidence |
| AR-TRD-90 | Reject timeline audit, bitemporal detail, filing validation, consensus hoặc voting, chain-of-custody ledger và generic legal case dossier. | reject |
| AR-TRD-91 | Khác biệt chỉ là product noun, density, color, component, state skin hoặc card count. | duplicate-or-variation |

### Quy tắc chọn

Chỉ trả accept khi AR-TRD-01, AR-TRD-02 và AR-TRD-03 có bằng chứng, không có AR-TRD-90 hoặc AR-TRD-91, và mọi required region vẫn cần thiết ở cả ba topology. Trả needs-evidence khi owner, relation hoặc transformation chưa resolve.

## Region graph

~~~text
treaty-depositary
├─ authentic-text-final-clauses-and-thresholds
├─ eligible-state-organization-roster
├─ instrument-intake-and-form-check
├─ party-action-ledger
├─ reservation-declaration-register
├─ objection-acceptance-withdrawal-relations
├─ per-party-consent-and-effective-status
├─ global-entry-into-force-calculation
└─ depositary-notification-and-registration-record
~~~

Critical relationship: Party instrument, reservation relation và threshold-derived status là các owner độc lập; mọi kết quả truy nguyên tới instrument và final clause.

### Nghĩa vụ vùng

| Region ID | Owner | Required relationship |
|---|---|---|
| treaty-depositary | Sở hữu boundary của dominant task và chứa mọi required region mà không tạo product semantics. | Chứa authentic-text-final-clauses-and-thresholds, eligible-state-organization-roster, instrument-intake-and-form-check, party-action-ledger, reservation-declaration-register, objection-acceptance-withdrawal-relations, per-party-consent-and-effective-status, global-entry-into-force-calculation, depositary-notification-and-registration-record và giữ owner độc lập của từng region. |
| authentic-text-final-clauses-and-thresholds | Sở hữu source evidence, provenance, freshness và availability; không tự quyết định outcome. | Nhận context từ treaty-depositary và gates eligible-state-organization-roster mà không gộp authority. |
| eligible-state-organization-roster | Sở hữu membership, identity, status và current selection của collection hữu hạn này. | Nhận context từ authentic-text-final-clauses-and-thresholds và gates instrument-intake-and-form-check mà không gộp authority. |
| instrument-intake-and-form-check | Sở hữu state và obligation của stage được đặt tên; không lấy authority của region lân cận. | Nhận context từ eligible-state-organization-roster và gates party-action-ledger mà không gộp authority. |
| party-action-ledger | Sở hữu membership, identity, status và current selection của collection hữu hạn này. | Nhận context từ instrument-intake-and-form-check và gates reservation-declaration-register mà không gộp authority. |
| reservation-declaration-register | Sở hữu membership, identity, status và current selection của collection hữu hạn này. | Nhận context từ party-action-ledger và gates objection-acceptance-withdrawal-relations mà không gộp authority. |
| objection-acceptance-withdrawal-relations | Sở hữu state và obligation của stage được đặt tên; không lấy authority của region lân cận. | Nhận context từ reservation-declaration-register và gates per-party-consent-and-effective-status mà không gộp authority. |
| per-party-consent-and-effective-status | Sở hữu derived interpretation hoặc consequence preview; không trở thành input authority thứ hai. | Nhận context từ objection-acceptance-withdrawal-relations và gates global-entry-into-force-calculation mà không gộp authority. |
| global-entry-into-force-calculation | Sở hữu derived interpretation hoặc consequence preview; không trở thành input authority thứ hai. | Nhận context từ per-party-consent-and-effective-status và gates depositary-notification-and-registration-record mà không gộp authority. |
| depositary-notification-and-registration-record | Sở hữu bounded outcome, receipt hoặc recovery route sau khi mọi upstream gate đã pass. | Nhận verified state từ global-entry-into-force-calculation và phát outcome hoặc recovery hữu hạn. |

## Responsive contract

### Wide

- Topology response: Keep party actions, selected instrument, reservation-objection relations, and entry-into-force calculations simultaneously visible.
- Failure trigger: simultaneous regions làm hẹp readable measure, che state hoặc phá named relationship.
- Navigation replacement: chưa cần khi các vùng còn đồng hiện; sticky chỉ dành cho orientation context vừa viewport.
- Sticky boundary: tự yield ở short-height và không che focused control.
- Overflow owner: page own vertical overflow; chỉ intrinsic matrix mới own bounded horizontal overflow.

### Intermediate

- Topology response: Keep party actions and selected relation primary; alternate instrument text and threshold evidence while treaty version and status persist.
- Failure trigger: supporting persistence cạnh tranh primary-task measure hoặc focus.
- Navigation replacement: named trigger mở supporting dialog; Escape hoặc Cancel đóng và focus trở đúng trigger.
- Sticky boundary: persistent context tự yield ở short-height; dialog body own bounded vertical overflow.
- Overflow owner: page giữ vertical overflow; supporting dialog chỉ own overflow bên trong boundary của nó.

### Compact

- Topology response: Stage treaty status, party, instrument form check, reservation or declaration, objections or withdrawals, effects, then depositary notification.
- Failure trigger: multi-pane relation không còn operable với body text 16px và target 44px.
- Navigation replacement: Previous, Next và stage selector thay pane adjacency; Back giữ selection, draft và recovery state.
- Sticky boundary: không fixed action bar; focused content luôn visible.
- Overflow owner: không page-level horizontal scroll; intrinsic matrix trở thành grouped records.

### Reflow

Thứ tự region graph là DOM order và reading order ở mọi width. CSS không reorder semantics. Text, localization, zoom và spacing growth làm region cao hơn hoặc trigger topology change; content không bị clip. State sống qua việc region đi vào hoặc ra supporting pane.

### Tương đương tương tác

Wide, intermediate và compact cung cấp cùng action, selection, pending guard, success, error, retry, stale/conflict recovery và outcome. Dynamic status được announce bằng polite live region mà không cướp focus. Modal giữ focus, hỗ trợ Escape hoặc Cancel và trả focus đúng trigger.

## Nghĩa vụ trạng thái

Domain state catalog giữ stable identifiers để EN/VI/context đồng bộ: treaty adopted/open-for-signature/in-force/closed; instrument draft/received/improper-form/accepted; signature/ratification/acceptance/approval/accession; reservation proposed/registered/withdrawn; objection pending/registered/withdrawn; consent bound/not-yet-bound/ceased; threshold unmet/met/recalculated; notification draft/issued/corrected; registration pending/complete.

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
| domain states | Giữ đầy đủ state identifiers: treaty adopted/open-for-signature/in-force/closed; instrument draft/received/improper-form/accepted; signature/ratification/acceptance/approval/accession; reservation proposed/registered/withdrawn; objection pending/registered/withdrawn; consent bound/not-yet-bound/ceased; threshold unmet/met/recalculated; notification draft/issued/corrected; registration pending/complete. | Mọi modal trả focus đúng trigger. | Giữ action và recovery parity. |

## Ranh giới

### Chấp nhận

Accept khi dominant task cần chính region graph này, critical relationship tạo topology riêng, và mọi responsive state giữ task cùng recovery parity.

### Từ chối

Reject timeline audit, bitemporal detail, filing validation, consensus hoặc voting, chain-of-custody ledger và generic legal case dossier. Cũng reject duplicate-or-variation khi candidate chỉ đổi noun, density, component hoặc visual state.

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
| [United Nations — Treaty Collection overview](https://treaties.un.org/pages/overview.aspx?path=overview%2Foverview%2Fpage1_en.xml) | Hỗ trợ depositary functions, status, reservations, objections, and notifications. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |
| [Council of Europe — Treaty Office](https://www.coe.int/en/web/dlapil/treaty-office) | Hỗ trợ instrument form checks, registration, withdrawals, and notifications. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |
| [OAS — Multilateral treaty depositary register](https://www.oas.org/juridico/english/Sigs/a-42.html) | Hỗ trợ party actions, reservations, objections, and entry-into-force records. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |
| [W3C WAI — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Hỗ trợ ordered compact records instead of squeezed relation graphs. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |

## Output

~~~json
{
  "archetypeId": "treaty-reservation-depositary-workbench",
  "matchedSituationCodes": [
    "AR-TRD-01",
    "AR-TRD-02",
    "AR-TRD-03"
  ],
  "aliases": [
    "treaty-reservation-depositary-workbench",
    "treaty depositary",
    "reservation objection register",
    "entry into force"
  ],
  "dominantTask": "Administer one multilateral treaty as depositary by validating instruments, registering party actions and reservations, routing objections and withdrawals, deriving entry-into-force effects, and issuing notifications without adjudicating merits.",
  "regions": [
    "treaty-depositary",
    "authentic-text-final-clauses-and-thresholds",
    "eligible-state-organization-roster",
    "instrument-intake-and-form-check",
    "party-action-ledger",
    "reservation-declaration-register",
    "objection-acceptance-withdrawal-relations",
    "per-party-consent-and-effective-status",
    "global-entry-into-force-calculation",
    "depositary-notification-and-registration-record"
  ],
  "relationships": [
    "Party instruments, reservation relations, and threshold-derived status are independent owners; every result traces to an instrument and final clause."
  ],
  "responsive": {
    "wide": "Keep party actions, selected instrument, reservation-objection relations, and entry-into-force calculations simultaneously visible.",
    "intermediate": "Keep party actions and selected relation primary; alternate instrument text and threshold evidence while treaty version and status persist.",
    "compact": "Stage treaty status, party, instrument form check, reservation or declaration, objections or withdrawals, effects, then depositary notification.",
    "reflow": "DOM and reading order remain stable; content grows without page-level horizontal scrolling.",
    "readingOrder": "treaty-depositary → authentic-text-final-clauses-and-thresholds → eligible-state-organization-roster → instrument-intake-and-form-check → party-action-ledger → reservation-declaration-register → objection-acceptance-withdrawal-relations → per-party-consent-and-effective-status → global-entry-into-force-calculation → depositary-notification-and-registration-record",
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
    "treaty adopted/open-for-signature/in-force/closed; instrument draft/received/improper-form/accepted; signature/ratification/acceptance/approval/accession; reservation proposed/registered/withdrawn; objection pending/registered/withdrawn; consent bound/not-yet-bound/ceased; threshold unmet/met/recalculated; notification draft/issued/corrected; registration pending/complete"
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

