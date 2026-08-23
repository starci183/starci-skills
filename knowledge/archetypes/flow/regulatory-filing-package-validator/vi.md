# Bộ validate package filing theo quy định

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | regulatory-filing-package-validator |
| Family | flow |
| Dominant task | Assemble schedule và attachment, validate cross-document conformance, chứng minh signatory authority và transmit test hoặc live filing với acceptance receipt. |
| Search aliases | regulatory-filing-package-validator; filing package; cross-document validation; test live transmission |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity và state families. |

### Bất biến

- Assemble schedule và attachment, validate cross-document conformance, chứng minh signatory authority và transmit test hoặc live filing với acceptance receipt.
- Mỗi required region có một semantic owner; supporting context không lấy dominant task.
- DOM order, reading order và focus order giữ nguyên meaning qua wide, intermediate và compact.
- Grammar cung cấp product facts; Principles resolve exact geometry; archetype không sở hữu visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-RFP-01 | Assemble schedule và attachment, validate cross-document conformance, chứng minh signatory authority và transmit test hoặc live filing với acceptance receipt. | required positive evidence |
| AR-RFP-02 | Critical region relationship và owner separation đều có bằng chứng. | required relationship evidence |
| AR-RFP-03 | Wide relationship không còn hoạt động nhưng compact vẫn giữ task, state và recovery. | responsive transformation trigger |
| AR-RFP-04 | Error, permission, pending, success và stale/conflict đều có bounded recovery. | required state evidence |
| AR-RFP-90 | Reject import mapping, evidence bundle, generic filing checklist và review-submit ledger. | reject |
| AR-RFP-91 | Khác biệt chỉ là product noun, density, color, component, state skin hoặc card count. | duplicate-or-variation |

### Quy tắc chọn

Chỉ trả accept khi AR-RFP-01, AR-RFP-02 và AR-RFP-03 có bằng chứng, không có AR-RFP-90 hoặc AR-RFP-91, và mọi required region vẫn cần thiết ở cả ba topology. Trả needs-evidence khi owner, relation hoặc transformation chưa resolve.

## Region graph

~~~text
filing-validator
├─ filer-submission-type
├─ required-schedule-register
├─ attachment-manifest
├─ cross-document-validation-errors
├─ signatory-authority
├─ test-live-review
├─ transmit
└─ acceptance-or-suspension
~~~

Critical relationship: Package version và cross-document rule sở hữu transmission; signatory authority và external acceptance là các gate độc lập.

### Nghĩa vụ vùng

| Region ID | Owner | Required relationship |
|---|---|---|
| filing-validator | Sở hữu boundary của dominant task và chứa mọi required region mà không tạo product semantics. | Chứa filer-submission-type, required-schedule-register, attachment-manifest, cross-document-validation-errors, signatory-authority, test-live-review, transmit, acceptance-or-suspension và giữ owner độc lập của từng region. |
| filer-submission-type | Sở hữu state và obligation của stage được đặt tên; không lấy authority của region lân cận. | Nhận context từ filing-validator và gates required-schedule-register mà không gộp authority. |
| required-schedule-register | Sở hữu membership, identity, status và current selection của collection hữu hạn này. | Nhận context từ filer-submission-type và gates attachment-manifest mà không gộp authority. |
| attachment-manifest | Sở hữu membership, identity, status và current selection của collection hữu hạn này. | Nhận context từ required-schedule-register và gates cross-document-validation-errors mà không gộp authority. |
| cross-document-validation-errors | Sở hữu derived interpretation hoặc consequence preview; không trở thành input authority thứ hai. | Nhận context từ attachment-manifest và gates signatory-authority mà không gộp authority. |
| signatory-authority | Sở hữu state và obligation của stage được đặt tên; không lấy authority của region lân cận. | Nhận context từ cross-document-validation-errors và gates test-live-review mà không gộp authority. |
| test-live-review | Sở hữu state và obligation của stage được đặt tên; không lấy authority của region lân cận. | Nhận context từ signatory-authority và gates transmit mà không gộp authority. |
| transmit | Sở hữu bounded outcome, receipt hoặc recovery route sau khi mọi upstream gate đã pass. | Nhận context từ test-live-review và gates acceptance-or-suspension mà không gộp authority. |
| acceptance-or-suspension | Sở hữu state và obligation của stage được đặt tên; không lấy authority của region lân cận. | Nhận verified state từ transmit và phát outcome hoặc recovery hữu hạn. |

## Responsive contract

### Wide

- Topology response: Keep manifest, cross-document validation errors, package version, submission type, and signatory summary simultaneously visible.
- Failure trigger: simultaneous regions làm hẹp readable measure, che state hoặc phá named relationship.
- Navigation replacement: chưa cần khi các vùng còn đồng hiện; sticky chỉ dành cho orientation context vừa viewport.
- Sticky boundary: tự yield ở short-height và không che focused control.
- Overflow owner: page own vertical overflow; chỉ intrinsic matrix mới own bounded horizontal overflow.

### Intermediate

- Topology response: Make validation errors primary while manifest and package version persist.
- Failure trigger: supporting persistence cạnh tranh primary-task measure hoặc focus.
- Navigation replacement: named trigger mở supporting dialog; Escape hoặc Cancel đóng và focus trở đúng trigger.
- Sticky boundary: persistent context tự yield ở short-height; dialog body own bounded vertical overflow.
- Overflow owner: page giữ vertical overflow; supporting dialog chỉ own overflow bên trong boundary của nó.

### Compact

- Topology response: Stage requirements, documents, errors, signatory, test or live review, transmission, then receipt.
- Failure trigger: multi-pane relation không còn operable với body text 16px và target 44px.
- Navigation replacement: Previous, Next và stage selector thay pane adjacency; Back giữ selection, draft và recovery state.
- Sticky boundary: không fixed action bar; focused content luôn visible.
- Overflow owner: không page-level horizontal scroll; intrinsic matrix trở thành grouped records.

### Reflow

Thứ tự region graph là DOM order và reading order ở mọi width. CSS không reorder semantics. Text, localization, zoom và spacing growth làm region cao hơn hoặc trigger topology change; content không bị clip. State sống qua việc region đi vào hoặc ra supporting pane.

### Tương đương tương tác

Wide, intermediate và compact cung cấp cùng action, selection, pending guard, success, error, retry, stale/conflict recovery và outcome. Dynamic status được announce bằng polite live region mà không cướp focus. Modal giữ focus, hỗ trợ Escape hoặc Cancel và trả focus đúng trigger.

## Nghĩa vụ trạng thái

Domain state catalog giữ stable identifiers để EN/VI/context đồng bộ: requirement missing; document uploaded/invalid; cross-reference mismatch; validation running/pass/fail; signatory verified/unauthorized; test accepted/rejected; live transmit pending; suspended receipt.

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
| domain states | Giữ đầy đủ state identifiers: requirement missing; document uploaded/invalid; cross-reference mismatch; validation running/pass/fail; signatory verified/unauthorized; test accepted/rejected; live transmit pending; suspended receipt. | Mọi modal trả focus đúng trigger. | Giữ action và recovery parity. |

## Ranh giới

### Chấp nhận

Accept khi dominant task cần chính region graph này, critical relationship tạo topology riêng, và mọi responsive state giữ task cùng recovery parity.

### Từ chối

Reject import mapping, evidence bundle, generic filing checklist và review-submit ledger. Cũng reject duplicate-or-variation khi candidate chỉ đổi noun, density, component hoặc visual state.

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
| [SEC — EDGAR Filer Manual](https://www.sec.gov/submit-filings/edgar-filer-manual) | Hỗ trợ current package construction, conformance rules, and transmission outcomes. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |
| [U.S. Web Design System — Patterns](https://designsystem.digital.gov/patterns/) | Hỗ trợ public-service forms, validation, and review flows. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |
| [W3C WAI — Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Hỗ trợ logical error-summary and review focus transitions. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |

## Output

~~~json
{
  "archetypeId": "regulatory-filing-package-validator",
  "matchedSituationCodes": [
    "AR-RFP-01",
    "AR-RFP-02",
    "AR-RFP-03"
  ],
  "aliases": [
    "regulatory-filing-package-validator",
    "filing package",
    "cross-document validation",
    "test live transmission"
  ],
  "dominantTask": "Assemble schedules and attachments, validate cross-document conformance, prove signatory authority, and transmit a test or live filing with an acceptance receipt.",
  "regions": [
    "filing-validator",
    "filer-submission-type",
    "required-schedule-register",
    "attachment-manifest",
    "cross-document-validation-errors",
    "signatory-authority",
    "test-live-review",
    "transmit",
    "acceptance-or-suspension"
  ],
  "relationships": [
    "Package version and cross-document rules own transmission; signatory authority and external acceptance remain independent gates."
  ],
  "responsive": {
    "wide": "Keep manifest, cross-document validation errors, package version, submission type, and signatory summary simultaneously visible.",
    "intermediate": "Make validation errors primary while manifest and package version persist.",
    "compact": "Stage requirements, documents, errors, signatory, test or live review, transmission, then receipt.",
    "reflow": "DOM and reading order remain stable; content grows without page-level horizontal scrolling.",
    "readingOrder": "filing-validator → filer-submission-type → required-schedule-register → attachment-manifest → cross-document-validation-errors → signatory-authority → test-live-review → transmit → acceptance-or-suspension",
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
    "requirement missing; document uploaded/invalid; cross-reference mismatch; validation running/pass/fail; signatory verified/unauthorized; test accepted/rejected; live transmit pending; suspended receipt"
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

