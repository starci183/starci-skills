# Phân giải thẩm quyền theo khu vực pháp lý

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | jurisdiction-authority-resolution |
| Family | discovery |
| Dominant task | Xác định authority sở hữu một subject khi geographic jurisdiction và organizational jurisdiction chồng lấn, đồng thời giữ rule evidence giải thích kết quả. |
| Search aliases | jurisdiction-authority-resolution; authority resolution; jurisdiction overlap; service-owner precedence |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity và state families. |

### Bất biến

- Xác định authority sở hữu một subject khi geographic jurisdiction và organizational jurisdiction chồng lấn, đồng thời giữ rule evidence giải thích kết quả.
- Mỗi required region có một semantic owner; supporting context không lấy dominant task.
- DOM order, reading order và focus order giữ nguyên meaning qua wide, intermediate và compact.
- Grammar cung cấp product facts; Principles resolve exact geometry; archetype không sở hữu visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-JAR-01 | Xác định authority sở hữu một subject khi geographic jurisdiction và organizational jurisdiction chồng lấn, đồng thời giữ rule evidence giải thích kết quả. | required positive evidence |
| AR-JAR-02 | Critical region relationship và owner separation đều có bằng chứng. | required relationship evidence |
| AR-JAR-03 | Wide relationship không còn hoạt động nhưng compact vẫn giữ task, state và recovery. | responsive transformation trigger |
| AR-JAR-04 | Error, permission, pending, success và stale/conflict đều có bounded recovery. | required state evidence |
| AR-JAR-90 | Reject place discovery, map monitoring, scope picker, evidence dossier, service hub, generic rule builder và mọi case-merit adjudication. | reject |
| AR-JAR-91 | Khác biệt chỉ là product noun, density, color, component, state skin hoặc card count. | duplicate-or-variation |

### Quy tắc chọn

Chỉ trả accept khi AR-JAR-01, AR-JAR-02 và AR-JAR-03 có bằng chứng, không có AR-JAR-90 hoặc AR-JAR-91, và mọi required region vẫn cần thiết ở cả ba topology. Trả needs-evidence khi owner, relation hoặc transformation chưa resolve.

## Region graph

~~~text
authority-resolver
├─ subject-location-and-scope
├─ jurisdiction-layer-stack
├─ authority-rule-register
├─ overlap-or-conflict-evidence
├─ selected-authority-and-service
└─ proof-and-escalation
~~~

Critical relationship: jurisdiction-layer-stack và authority-rule-register là hai owner bằng chứng ngang hàng; phân giải precedence chứ không phải bản đồ quyết định selected-authority-and-service.

### Nghĩa vụ vùng

| Region ID | Owner | Required relationship |
|---|---|---|
| authority-resolver | Sở hữu boundary của dominant task và chứa mọi required region mà không tạo product semantics. | Chứa subject-location-and-scope, jurisdiction-layer-stack, authority-rule-register, overlap-or-conflict-evidence, selected-authority-and-service, proof-and-escalation và giữ owner độc lập của từng region. |
| subject-location-and-scope | Sở hữu state và obligation của stage được đặt tên; không lấy authority của region lân cận. | Nhận context từ authority-resolver và gates jurisdiction-layer-stack mà không gộp authority. |
| jurisdiction-layer-stack | Sở hữu state và obligation của stage được đặt tên; không lấy authority của region lân cận. | Nhận context từ subject-location-and-scope và gates authority-rule-register mà không gộp authority. |
| authority-rule-register | Sở hữu source evidence, provenance, freshness và availability; không tự quyết định outcome. | Nhận context từ jurisdiction-layer-stack và gates overlap-or-conflict-evidence mà không gộp authority. |
| overlap-or-conflict-evidence | Sở hữu source evidence, provenance, freshness và availability; không tự quyết định outcome. | Nhận context từ authority-rule-register và gates selected-authority-and-service mà không gộp authority. |
| selected-authority-and-service | Sở hữu state và obligation của stage được đặt tên; không lấy authority của region lân cận. | Nhận context từ overlap-or-conflict-evidence và gates proof-and-escalation mà không gộp authority. |
| proof-and-escalation | Sở hữu bounded outcome, receipt hoặc recovery route sau khi mọi upstream gate đã pass. | Nhận verified state từ selected-authority-and-service và phát outcome hoặc recovery hữu hạn. |

## Responsive contract

### Wide

- Topology response: Keep spatial and layer context, the rule register, conflict evidence, and the authority result simultaneously inspectable.
- Failure trigger: simultaneous regions làm hẹp readable measure, che state hoặc phá named relationship.
- Navigation replacement: chưa cần khi các vùng còn đồng hiện; sticky chỉ dành cho orientation context vừa viewport.
- Sticky boundary: tự yield ở short-height và không che focused control.
- Overflow owner: page own vertical overflow; chỉ intrinsic matrix mới own bounded horizontal overflow.

### Intermediate

- Topology response: Make rule and result regions primary; move spatial context to an anchored supporting pane without changing the selected subject.
- Failure trigger: supporting persistence cạnh tranh primary-task measure hoặc focus.
- Navigation replacement: named trigger mở supporting dialog; Escape hoặc Cancel đóng và focus trở đúng trigger.
- Sticky boundary: persistent context tự yield ở short-height; dialog body own bounded vertical overflow.
- Overflow owner: page giữ vertical overflow; supporting dialog chỉ own overflow bên trong boundary của nó.

### Compact

- Topology response: Stage the evidence-first jurisdiction path, selected authority and service, proof, then escalation; open the map only to inspect location evidence.
- Failure trigger: multi-pane relation không còn operable với body text 16px và target 44px.
- Navigation replacement: Previous, Next và stage selector thay pane adjacency; Back giữ selection, draft và recovery state.
- Sticky boundary: không fixed action bar; focused content luôn visible.
- Overflow owner: không page-level horizontal scroll; intrinsic matrix trở thành grouped records.

### Reflow

Thứ tự region graph là DOM order và reading order ở mọi width. CSS không reorder semantics. Text, localization, zoom và spacing growth làm region cao hơn hoặc trigger topology change; content không bị clip. State sống qua việc region đi vào hoặc ra supporting pane.

### Tương đương tương tác

Wide, intermediate và compact cung cấp cùng action, selection, pending guard, success, error, retry, stale/conflict recovery và outcome. Dynamic status được announce bằng polite live region mà không cướp focus. Modal giữ focus, hỗ trợ Escape hoặc Cancel và trả focus đúng trigger.

## Nghĩa vụ trạng thái

Domain state catalog giữ stable identifiers để EN/VI/context đồng bộ: location unknown/ambiguous; layer loading; rule active/expired; authority unique/multiple/none; conflict unresolved; service unavailable; escalation pending; proof exported.

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
| domain states | Giữ đầy đủ state identifiers: location unknown/ambiguous; layer loading; rule active/expired; authority unique/multiple/none; conflict unresolved; service unavailable; escalation pending; proof exported. | Mọi modal trả focus đúng trigger. | Giữ action và recovery parity. |

## Ranh giới

### Chấp nhận

Accept khi dominant task cần chính region graph này, critical relationship tạo topology riêng, và mọi responsive state giữ task cùng recovery parity.

### Từ chối

Reject place discovery, map monitoring, scope picker, evidence dossier, service hub, generic rule builder và mọi case-merit adjudication. Cũng reject duplicate-or-variation khi candidate chỉ đổi noun, density, component hoặc visual state.

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
| [Esri — Creating app layouts](https://developers.arcgis.com/javascript/latest/creating-app-layouts/) | Hỗ trợ keeping spatial context subordinate to a task owner. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |
| [GOV.UK — Local government structure and elections](https://www.gov.uk/guidance/local-government-structure-and-elections) | Hỗ trợ overlapping tiers and split service responsibilities. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |
| [W3C WAI — Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Hỗ trợ logical focus order when supporting panes change. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |

## Output

~~~json
{
  "archetypeId": "jurisdiction-authority-resolution",
  "matchedSituationCodes": [
    "AR-JAR-01",
    "AR-JAR-02",
    "AR-JAR-03"
  ],
  "aliases": [
    "jurisdiction-authority-resolution",
    "authority resolution",
    "jurisdiction overlap",
    "service-owner precedence"
  ],
  "dominantTask": "Resolve which authority owns a subject when geographic and organizational jurisdictions overlap, while preserving the rule evidence that explains the result.",
  "regions": [
    "authority-resolver",
    "subject-location-and-scope",
    "jurisdiction-layer-stack",
    "authority-rule-register",
    "overlap-or-conflict-evidence",
    "selected-authority-and-service",
    "proof-and-escalation"
  ],
  "relationships": [
    "The jurisdiction-layer-stack and authority-rule-register are peer evidence owners; precedence resolution, not the map, determines selected-authority-and-service."
  ],
  "responsive": {
    "wide": "Keep spatial and layer context, the rule register, conflict evidence, and the authority result simultaneously inspectable.",
    "intermediate": "Make rule and result regions primary; move spatial context to an anchored supporting pane without changing the selected subject.",
    "compact": "Stage the evidence-first jurisdiction path, selected authority and service, proof, then escalation; open the map only to inspect location evidence.",
    "reflow": "DOM and reading order remain stable; content grows without page-level horizontal scrolling.",
    "readingOrder": "authority-resolver → subject-location-and-scope → jurisdiction-layer-stack → authority-rule-register → overlap-or-conflict-evidence → selected-authority-and-service → proof-and-escalation",
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
    "location unknown/ambiguous; layer loading; rule active/expired; authority unique/multiple/none; conflict unresolved; service unavailable; escalation pending; proof exported"
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

