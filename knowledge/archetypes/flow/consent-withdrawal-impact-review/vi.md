# Rà soát tác động khi rút consent

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | consent-withdrawal-impact-review |
| Family | flow |
| Dominant task | Withdraw một hoặc nhiều grant sau khi hiểu affected purpose, recipient, service, unavoidable retention và propagation timing. |
| Search aliases | consent-withdrawal-impact-review; consent withdrawal; grant impact review; revocation propagation |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity và state families. |

### Bất biến

- Withdraw một hoặc nhiều grant sau khi hiểu affected purpose, recipient, service, unavoidable retention và propagation timing.
- Mỗi required region có một semantic owner; supporting context không lấy dominant task.
- DOM order, reading order và focus order giữ nguyên meaning qua wide, intermediate và compact.
- Grammar cung cấp product facts; Principles resolve exact geometry; archetype không sở hữu visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-CWI-01 | Withdraw một hoặc nhiều grant sau khi hiểu affected purpose, recipient, service, unavoidable retention và propagation timing. | required positive evidence |
| AR-CWI-02 | Critical region relationship và owner separation đều có bằng chứng. | required relationship evidence |
| AR-CWI-03 | Wide relationship không còn hoạt động nhưng compact vẫn giữ task, state và recovery. | responsive transformation trigger |
| AR-CWI-04 | Error, permission, pending, success và stale/conflict đều có bounded recovery. | required state evidence |
| AR-CWI-90 | Reject configuration dependency resolution, consent signature, preference center và account exit. | reject |
| AR-CWI-91 | Khác biệt chỉ là product noun, density, color, component, state skin hoặc card count. | duplicate-or-variation |

### Quy tắc chọn

Chỉ trả accept khi AR-CWI-01, AR-CWI-02 và AR-CWI-03 có bằng chứng, không có AR-CWI-90 hoặc AR-CWI-91, và mọi required region vẫn cần thiết ở cả ba topology. Trả needs-evidence khi owner, relation hoặc transformation chưa resolve.

## Region graph

~~~text
withdrawal-review
├─ existing-grant-version
├─ purpose-data-recipient-dependency-map
├─ service-consequences
├─ selectable-withdrawal-boundary
├─ retained-basis-timing
└─ confirm-propagation-receipts
~~~

Critical relationship: Withdrawal scope và lawful retained basis luôn tách biệt; propagation receipt không bao giờ ngụ ý immediate deletion khi basis khác giữ dữ liệu.

### Nghĩa vụ vùng

| Region ID | Owner | Required relationship |
|---|---|---|
| withdrawal-review | Sở hữu boundary của dominant task và chứa mọi required region mà không tạo product semantics. | Chứa existing-grant-version, purpose-data-recipient-dependency-map, service-consequences, selectable-withdrawal-boundary, retained-basis-timing, confirm-propagation-receipts và giữ owner độc lập của từng region. |
| existing-grant-version | Sở hữu state và obligation của stage được đặt tên; không lấy authority của region lân cận. | Nhận context từ withdrawal-review và gates purpose-data-recipient-dependency-map mà không gộp authority. |
| purpose-data-recipient-dependency-map | Sở hữu state và obligation của stage được đặt tên; không lấy authority của region lân cận. | Nhận context từ existing-grant-version và gates service-consequences mà không gộp authority. |
| service-consequences | Sở hữu derived interpretation hoặc consequence preview; không trở thành input authority thứ hai. | Nhận context từ purpose-data-recipient-dependency-map và gates selectable-withdrawal-boundary mà không gộp authority. |
| selectable-withdrawal-boundary | Sở hữu editable decision state, validation và pending guard cho stage được đặt tên. | Nhận context từ service-consequences và gates retained-basis-timing mà không gộp authority. |
| retained-basis-timing | Sở hữu state và obligation của stage được đặt tên; không lấy authority của region lân cận. | Nhận context từ selectable-withdrawal-boundary và gates confirm-propagation-receipts mà không gộp authority. |
| confirm-propagation-receipts | Sở hữu bounded outcome, receipt hoặc recovery route sau khi mọi upstream gate đã pass. | Nhận verified state từ retained-basis-timing và phát outcome hoặc recovery hữu hạn. |

## Responsive contract

### Wide

- Topology response: Keep dependency map, service and recipient consequences, selectable scope, retained basis, and propagation timing simultaneously visible.
- Failure trigger: simultaneous regions làm hẹp readable measure, che state hoặc phá named relationship.
- Navigation replacement: chưa cần khi các vùng còn đồng hiện; sticky chỉ dành cho orientation context vừa viewport.
- Sticky boundary: tự yield ở short-height và không che focused control.
- Overflow owner: page own vertical overflow; chỉ intrinsic matrix mới own bounded horizontal overflow.

### Intermediate

- Topology response: Make the impact path primary while the existing grant version persists.
- Failure trigger: supporting persistence cạnh tranh primary-task measure hoặc focus.
- Navigation replacement: named trigger mở supporting dialog; Escape hoặc Cancel đóng và focus trở đúng trigger.
- Sticky boundary: persistent context tự yield ở short-height; dialog body own bounded vertical overflow.
- Overflow owner: page giữ vertical overflow; supporting dialog chỉ own overflow bên trong boundary của nó.

### Compact

- Topology response: Stage grant version, affected recipients and services, withdrawal scope, retained basis and timing, confirmation, then propagation receipts.
- Failure trigger: multi-pane relation không còn operable với body text 16px và target 44px.
- Navigation replacement: Previous, Next và stage selector thay pane adjacency; Back giữ selection, draft và recovery state.
- Sticky boundary: không fixed action bar; focused content luôn visible.
- Overflow owner: không page-level horizontal scroll; intrinsic matrix trở thành grouped records.

### Reflow

Thứ tự region graph là DOM order và reading order ở mọi width. CSS không reorder semantics. Text, localization, zoom và spacing growth làm region cao hơn hoặc trigger topology change; content không bị clip. State sống qua việc region đi vào hoặc ra supporting pane.

### Tương đương tương tác

Wide, intermediate và compact cung cấp cùng action, selection, pending guard, success, error, retry, stale/conflict recovery và outcome. Dynamic status được announce bằng polite live region mà không cướp focus. Modal giữ focus, hỗ trợ Escape hoặc Cancel và trả focus đúng trigger.

## Nghĩa vụ trạng thái

Domain state catalog giữ stable identifiers để EN/VI/context đồng bộ: grant active/partial/expired; dependency loading; recipient unknown; service consequence unavailable; scope selected; retained basis required; withdrawal pending/failure/success; propagation incomplete.

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
| domain states | Giữ đầy đủ state identifiers: grant active/partial/expired; dependency loading; recipient unknown; service consequence unavailable; scope selected; retained basis required; withdrawal pending/failure/success; propagation incomplete. | Mọi modal trả focus đúng trigger. | Giữ action và recovery parity. |

## Ranh giới

### Chấp nhận

Accept khi dominant task cần chính region graph này, critical relationship tạo topology riêng, và mọi responsive state giữ task cùng recovery parity.

### Từ chối

Reject configuration dependency resolution, consent signature, preference center và account exit. Cũng reject duplicate-or-variation khi candidate chỉ đổi noun, density, component hoặc visual state.

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
| [ICO — Obtain, record, and manage consent](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/consent/how-should-we-obtain-record-and-manage-consent/) | Hỗ trợ easy withdrawal, stopping consent-based processing, and separate retention bases. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |
| [IETF — RFC 9396 Rich Authorization Requests](https://datatracker.ietf.org/doc/html/rfc9396) | Hỗ trợ explicit resource, action, and authorization-detail boundaries. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |
| [W3C WAI — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Hỗ trợ non-disruptive propagation and recovery announcements. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |

## Output

~~~json
{
  "archetypeId": "consent-withdrawal-impact-review",
  "matchedSituationCodes": [
    "AR-CWI-01",
    "AR-CWI-02",
    "AR-CWI-03"
  ],
  "aliases": [
    "consent-withdrawal-impact-review",
    "consent withdrawal",
    "grant impact review",
    "revocation propagation"
  ],
  "dominantTask": "Withdraw one or more grants after understanding affected purposes, recipients, services, unavoidable retention, and propagation timing.",
  "regions": [
    "withdrawal-review",
    "existing-grant-version",
    "purpose-data-recipient-dependency-map",
    "service-consequences",
    "selectable-withdrawal-boundary",
    "retained-basis-timing",
    "confirm-propagation-receipts"
  ],
  "relationships": [
    "Withdrawal scope and lawful retained basis remain distinct; propagation receipts never imply immediate deletion where another basis retains data."
  ],
  "responsive": {
    "wide": "Keep dependency map, service and recipient consequences, selectable scope, retained basis, and propagation timing simultaneously visible.",
    "intermediate": "Make the impact path primary while the existing grant version persists.",
    "compact": "Stage grant version, affected recipients and services, withdrawal scope, retained basis and timing, confirmation, then propagation receipts.",
    "reflow": "DOM and reading order remain stable; content grows without page-level horizontal scrolling.",
    "readingOrder": "withdrawal-review → existing-grant-version → purpose-data-recipient-dependency-map → service-consequences → selectable-withdrawal-boundary → retained-basis-timing → confirm-propagation-receipts",
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
    "grant active/partial/expired; dependency loading; recipient unknown; service consequence unavailable; scope selected; retained basis required; withdrawal pending/failure/success; propagation incomplete"
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

