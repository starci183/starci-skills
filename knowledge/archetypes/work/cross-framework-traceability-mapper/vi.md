# Bộ ánh xạ truy nguyên liên khung

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | cross-framework-traceability-mapper |
| Family | work |
| Dominant task | Tạo và approve các quan hệ many-to-many có thể audit giữa hai framework control, requirement hoặc standard. |
| Search aliases | cross-framework-traceability-mapper; framework crosswalk; control mapping; many-to-many traceability |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity và state families. |

### Bất biến

- Tạo và approve các quan hệ many-to-many có thể audit giữa hai framework control, requirement hoặc standard.
- Mỗi required region có một semantic owner; supporting context không lấy dominant task.
- DOM order, reading order và focus order giữ nguyên meaning qua wide, intermediate và compact.
- Grammar cung cấp product facts; Principles resolve exact geometry; archetype không sở hữu visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-CFT-01 | Tạo và approve các quan hệ many-to-many có thể audit giữa hai framework control, requirement hoặc standard. | required positive evidence |
| AR-CFT-02 | Critical region relationship và owner separation đều có bằng chứng. | required relationship evidence |
| AR-CFT-03 | Wide relationship không còn hoạt động nhưng compact vẫn giữ task, state và recovery. | responsive transformation trigger |
| AR-CFT-04 | Error, permission, pending, success và stale/conflict đều có bounded recovery. | required state evidence |
| AR-CFT-90 | Reject import mapping, row transformation, comparison matrix, knowledge graph, taxonomy editor và reconciliation diff. | reject |
| AR-CFT-91 | Khác biệt chỉ là product noun, density, color, component, state skin hoặc card count. | duplicate-or-variation |

### Quy tắc chọn

Chỉ trả accept khi AR-CFT-01, AR-CFT-02 và AR-CFT-03 có bằng chứng, không có AR-CFT-90 hoặc AR-CFT-91, và mọi required region vẫn cần thiết ở cả ba topology. Trả needs-evidence khi owner, relation hoặc transformation chưa resolve.

## Region graph

~~~text
traceability-mapper
├─ framework-a-tree
├─ mapping-workspace
├─ framework-b-tree
├─ relation-evidence-inspector
├─ coverage-gap-summary
└─ mapping-approval
~~~

Critical relationship: Hai hierarchy framework có version và typed relation evidence là các owner độc lập; coverage chỉ được suy ra từ mapping đã approve.

### Nghĩa vụ vùng

| Region ID | Owner | Required relationship |
|---|---|---|
| traceability-mapper | Sở hữu boundary của dominant task và chứa mọi required region mà không tạo product semantics. | Chứa framework-a-tree, mapping-workspace, framework-b-tree, relation-evidence-inspector, coverage-gap-summary, mapping-approval và giữ owner độc lập của từng region. |
| framework-a-tree | Sở hữu membership, identity, status và current selection của collection hữu hạn này. | Nhận context từ traceability-mapper và gates mapping-workspace mà không gộp authority. |
| mapping-workspace | Sở hữu state và obligation của stage được đặt tên; không lấy authority của region lân cận. | Nhận context từ framework-a-tree và gates framework-b-tree mà không gộp authority. |
| framework-b-tree | Sở hữu membership, identity, status và current selection của collection hữu hạn này. | Nhận context từ mapping-workspace và gates relation-evidence-inspector mà không gộp authority. |
| relation-evidence-inspector | Sở hữu source evidence, provenance, freshness và availability; không tự quyết định outcome. | Nhận context từ framework-b-tree và gates coverage-gap-summary mà không gộp authority. |
| coverage-gap-summary | Sở hữu derived interpretation hoặc consequence preview; không trở thành input authority thứ hai. | Nhận context từ relation-evidence-inspector và gates mapping-approval mà không gộp authority. |
| mapping-approval | Sở hữu bounded outcome, receipt hoặc recovery route sau khi mọi upstream gate đã pass. | Nhận verified state từ coverage-gap-summary và phát outcome hoặc recovery hữu hạn. |

## Responsive contract

### Wide

- Topology response: Keep both framework trees, the mapping workspace, selected relation evidence, and coverage simultaneously visible.
- Failure trigger: simultaneous regions làm hẹp readable measure, che state hoặc phá named relationship.
- Navigation replacement: chưa cần khi các vùng còn đồng hiện; sticky chỉ dành cho orientation context vừa viewport.
- Sticky boundary: tự yield ở short-height và không che focused control.
- Overflow owner: page own vertical overflow; chỉ intrinsic matrix mới own bounded horizontal overflow.

### Intermediate

- Topology response: Keep one tree visible; open the target picker and evidence in a sheet while coverage persists.
- Failure trigger: supporting persistence cạnh tranh primary-task measure hoặc focus.
- Navigation replacement: named trigger mở supporting dialog; Escape hoặc Cancel đóng và focus trở đúng trigger.
- Sticky boundary: persistent context tự yield ở short-height; dialog body own bounded vertical overflow.
- Overflow owner: page giữ vertical overflow; supporting dialog chỉ own overflow bên trong boundary của nó.

### Compact

- Topology response: Stage one source control, candidate targets, relation type and evidence, coverage result, then approval; never squeeze dual hierarchies.
- Failure trigger: multi-pane relation không còn operable với body text 16px và target 44px.
- Navigation replacement: Previous, Next và stage selector thay pane adjacency; Back giữ selection, draft và recovery state.
- Sticky boundary: không fixed action bar; focused content luôn visible.
- Overflow owner: không page-level horizontal scroll; intrinsic matrix trở thành grouped records.

### Reflow

Thứ tự region graph là DOM order và reading order ở mọi width. CSS không reorder semantics. Text, localization, zoom và spacing growth làm region cao hơn hoặc trigger topology change; content không bị clip. State sống qua việc region đi vào hoặc ra supporting pane.

### Tương đương tương tác

Wide, intermediate và compact cung cấp cùng action, selection, pending guard, success, error, retry, stale/conflict recovery và outcome. Dynamic status được announce bằng polite live region mà không cướp focus. Modal giữ focus, hỗ trợ Escape hoặc Cancel và trả focus đúng trigger.

## Nghĩa vụ trạng thái

Domain state catalog giữ stable identifiers để EN/VI/context đồng bộ: framework loading/version mismatch; source/target selected; mapping exact/partial/related/none; evidence missing; duplicate/conflict; coverage calculating/gap; approval pending; superseded map.

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
| domain states | Giữ đầy đủ state identifiers: framework loading/version mismatch; source/target selected; mapping exact/partial/related/none; evidence missing; duplicate/conflict; coverage calculating/gap; approval pending; superseded map. | Mọi modal trả focus đúng trigger. | Giữ action và recovery parity. |

## Ranh giới

### Chấp nhận

Accept khi dominant task cần chính region graph này, critical relationship tạo topology riêng, và mọi responsive state giữ task cùng recovery parity.

### Từ chối

Reject import mapping, row transformation, comparison matrix, knowledge graph, taxonomy editor và reconciliation diff. Cũng reject duplicate-or-variation khi candidate chỉ đổi noun, density, component hoặc visual state.

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
| [NIST — IR 8477 concept mappings](https://csrc.nist.gov/pubs/ir/8477/final) | Hỗ trợ typed mappings, degrees of relationship, and mapping evidence. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |
| [SAP Fiori — Floorplan overview](https://www.sap.com/design-system/fiori-design-web/v1-145/page-types/floorplan-overview) | Hỗ trợ choosing task-specific floorplans without copying their geometry. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |
| [W3C WAI — Treegrid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/) | Hỗ trợ keyboard semantics for versioned hierarchical choices. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |

## Output

~~~json
{
  "archetypeId": "cross-framework-traceability-mapper",
  "matchedSituationCodes": [
    "AR-CFT-01",
    "AR-CFT-02",
    "AR-CFT-03"
  ],
  "aliases": [
    "cross-framework-traceability-mapper",
    "framework crosswalk",
    "control mapping",
    "many-to-many traceability"
  ],
  "dominantTask": "Create and approve auditable many-to-many relations between two control, requirement, or standards frameworks.",
  "regions": [
    "traceability-mapper",
    "framework-a-tree",
    "mapping-workspace",
    "framework-b-tree",
    "relation-evidence-inspector",
    "coverage-gap-summary",
    "mapping-approval"
  ],
  "relationships": [
    "Both versioned framework hierarchies and typed relation evidence are independent owners; coverage is derived only from approved mappings."
  ],
  "responsive": {
    "wide": "Keep both framework trees, the mapping workspace, selected relation evidence, and coverage simultaneously visible.",
    "intermediate": "Keep one tree visible; open the target picker and evidence in a sheet while coverage persists.",
    "compact": "Stage one source control, candidate targets, relation type and evidence, coverage result, then approval; never squeeze dual hierarchies.",
    "reflow": "DOM and reading order remain stable; content grows without page-level horizontal scrolling.",
    "readingOrder": "traceability-mapper → framework-a-tree → mapping-workspace → framework-b-tree → relation-evidence-inspector → coverage-gap-summary → mapping-approval",
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
    "framework loading/version mismatch; source/target selected; mapping exact/partial/related/none; evidence missing; duplicate/conflict; coverage calculating/gap; approval pending; superseded map"
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

