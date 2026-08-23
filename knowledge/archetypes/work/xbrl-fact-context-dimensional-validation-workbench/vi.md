# XBRL fact context dimensional validation workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `xbrl-fact-context-dimensional-validation-workbench` |
| Family | Work |
| Dominant task | Kiểm tra từng fact XBRL được báo cáo qua concept taxonomy, context kỳ và thực thể, unit, dimensions và relationship networks; sau đó sửa node nhỏ nhất đang sở hữu lỗi và chứng minh lần revalidation xác định mà không đổi intended meaning. |
| Search aliases | `XBRL semantic graph validator`, `fact context dimension repair`, `taxonomy relationship validation` |
| Authority | Shared product-neutral macro topology; Grammar sở hữu product semantics, Principles sở hữu unresolved geometry và Direction sở hữu visual character. |

### Invariants

- Kiểm tra từng fact XBRL được báo cáo qua concept taxonomy, context kỳ và thực thể, unit, dimensions và relationship networks; sau đó sửa node nhỏ nhất đang sở hữu lỗi và chứng minh lần revalidation xác định mà không đổi intended meaning.
- Một reported fact chỉ hợp lệ khi neighborhood fact↔concept↔context/unit/dimension↔taxonomy relationship nhất quán; correction chỉ đổi node nhỏ nhất đang sở hữu lỗi và expose mọi affected fact trước khi chạy lại.
- Mỗi required region giữ một owner riêng và cùng selected context; product noun không thay đổi topology.
- Wide, intermediate và compact giữ meaningful DOM, reading và focus order, action parity và deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-XFD-01` | Dominant task là observable outcome bắt buộc. | Bằng chứng bắt buộc. |
| `AR-XFD-02` | Toàn bộ required region graph và named relationship đều cần. | Bằng chứng bắt buộc. |
| `AR-XFD-03` | Compact giữ action, state, recovery và focus meaning của wide. | Bằng chứng bắt buộc. |
| `AR-XFD-04` | Task-specific state có thể đổi sau khi user tạo work state. | Bằng chứng bắt buộc. |
| `AR-XFD-90` | Dominant task thực tế thuộc regulatory filing package validation. | Reject. |
| `AR-XFD-91` | Dominant task thực tế thuộc data import mapping. | Reject. |
| `AR-XFD-92` | Dominant task thực tế thuộc document outline editing. | Reject. |
| `AR-XFD-93` | Dominant task thực tế thuộc generic schema validation. | Reject. |

### Selection rule

Chọn `xbrl-fact-context-dimensional-validation-workbench` khi và chỉ khi `AR-XFD-01` đến `AR-XFD-04` đều được evidence và không có `AR-XFD-90` đến `AR-XFD-93`. Trả `needs-evidence` khi owner hoặc relationship còn thiếu; trả `reject` khi có rejection code.

## Region graph

```text
xbrl-validation
|-- report-taxonomy-entry-points-and-filing-rule-version
|-- reported-fact-register
|   `-- selected-fact <-> concept-type-period-balance-and-label
|       |-- context-entity-period-scenario
|       |-- unit-and-decimals-precision
|       `-- explicit-and-typed-dimension-members
|-- presentation-calculation-definition-and-formula-relationships
|-- semantic-issue-and-affected-fact-set
|-- graph-node-correction-and-revalidation
`-- accepted-report-and-validation-receipt
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `xbrl-validation` | Sở hữu dominant task, toàn bộ descendant state và recovery boundary. |
| `report-taxonomy-entry-points-and-filing-rule-version` | Sở hữu evidence, action và state của Report Taxonomy Entry Points And Filing Rule Version; giữ quan hệ đã khai báo với selection hiện tại và không vay product semantics. |
| `reported-fact-register` | Sở hữu evidence, action và state của Reported Fact Register; giữ quan hệ đã khai báo với selection hiện tại và không vay product semantics. |
| `selected-fact` | Sở hữu evidence, action và state của Selected Fact; giữ quan hệ đã khai báo với selection hiện tại và không vay product semantics. |
| `concept-type-period-balance-and-label` | Sở hữu evidence, action và state của Concept Type Period Balance And Label; giữ quan hệ đã khai báo với selection hiện tại và không vay product semantics. |
| `context-entity-period-scenario` | Sở hữu evidence, action và state của Context Entity Period Scenario; giữ quan hệ đã khai báo với selection hiện tại và không vay product semantics. |
| `unit-and-decimals-precision` | Sở hữu evidence, action và state của Unit And Decimals Precision; giữ quan hệ đã khai báo với selection hiện tại và không vay product semantics. |
| `explicit-and-typed-dimension-members` | Sở hữu evidence, action và state của Explicit And Typed Dimension Members; giữ quan hệ đã khai báo với selection hiện tại và không vay product semantics. |
| `presentation-calculation-definition-and-formula-relationships` | Sở hữu evidence, action và state của Presentation Calculation Definition And Formula Relationships; giữ quan hệ đã khai báo với selection hiện tại và không vay product semantics. |
| `semantic-issue-and-affected-fact-set` | Sở hữu evidence, action và state của Semantic Issue And Affected Fact Set; giữ quan hệ đã khai báo với selection hiện tại và không vay product semantics. |
| `graph-node-correction-and-revalidation` | Sở hữu evidence, action và state của Graph Node Correction And Revalidation; giữ quan hệ đã khai báo với selection hiện tại và không vay product semantics. |
| `accepted-report-and-validation-receipt` | Sở hữu evidence, action và state của Accepted Report And Validation Receipt; giữ quan hệ đã khai báo với selection hiện tại và không vay product semantics. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi các vùng đồng thời không còn giữ được readable labels, exact associations và complete actions.
- **Topology response:** Fact register, selected fact, graph concept/context/unit/dimension, relationship networks, issue queue và validation result cùng duy trì khả năng inspect.
- **Navigation replacement:** None while all simultaneous regions remain usable.
- **Sticky boundary:** Chỉ current task receipt hoặc blocking action được sticky; nó reserve space, không che focus và trở về normal flow ở short height.
- **Overflow owner:** `reported-fact-register` is the only bounded owner on the necessary axis; the page owns no overflow.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi supporting region ưu tiên thấp làm primary relationship không dùng được.
- **Topology response:** Semantic issue đang chọn và affected graph neighborhood giữ vai trò primary; taxonomy tree, full fact register và validation history chuyển vào synchronized evidence drawer.
- **Navigation replacement:** Một synchronized drawer thay vùng bị dời và giữ nguyên selected object, query, state, scroll context và exact trigger.
- **Sticky boundary:** Chỉ current task receipt hoặc blocking action được sticky; nó reserve space, không che focus và trở về normal flow ở short height.
- **Overflow owner:** `reported-fact-register` retains bounded overflow; the drawer creates no nested page scroll.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai task regions không thể cùng giữ readable evidence, target 44 CSS px và unobscured focus.
- **Topology response:** Issue → affected fact → concept → context và unit → dimensions → relationship edge → sửa một owning node → chạy lại affected rules → whole-report receipt; các grid trở thành một semantic chain có thể điều hướng.
- **Navigation replacement:** Primary-pane sequence với Back khôi phục selection, state, query, scroll context và exact trigger.
- **Sticky boundary:** Chỉ current task receipt hoặc blocking action được sticky; nó reserve space, không che focus và trở về normal flow ở short height.
- **Overflow owner:** `reported-fact-register` becomes a semantic list or step route when its bounded view no longer fits.

### Reflow

- Semantic, DOM và meaningful focus order giữ graph: `xbrl-validation -> report-taxonomy-entry-points-and-filing-rule-version -> reported-fact-register -> selected-fact -> concept-type-period-balance-and-label -> context-entity-period-scenario -> unit-and-decimals-precision -> explicit-and-typed-dimension-members -> presentation-calculation-definition-and-formula-relationships -> semantic-issue-and-affected-fact-set -> graph-node-correction-and-revalidation -> accepted-report-and-validation-receipt`.
- Long labels, localization, zoom và enlarged controls kích hoạt cùng named topology changes.
- CSS không reorder semantics; ordinary content không tạo page-level horizontal scroll.
- Hidden detail luôn có explicit accessible reveal path.

### Interaction parity

- Mọi selection, edit, action, explanation, retry và recovery ở wide vẫn reachable ở intermediate và compact.
- Topology change giữ exact selected object, order, input, pending result và error context.
- Pointer action có keyboard equivalent; color không bao giờ là tín hiệu duy nhất.
- Dynamic update announce một contextual status mà không giật focus.

## State obligations

Task-specific states: taxonomy loading/resolved/missing; fact reported/duplicate/inconsistent; concept standard/extension/deprecated; context valid/malformed/duplicate; unit compatible/incompatible; dimension allowed/disallowed/missing; relationship satisfied/broken/circular; calculation consistent/inconsistent; correction draft/applied/reverted; validation running/pass/fail; report draft/accepted/superseded.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `report-taxonomy-entry-points-and-filing-rule-version` | Nêu loading scope, reserve primary region và chỉ block owner bị lỗi. |
| Ready | `reported-fact-register` | Expose current object, owner relationship, selection và valid action bằng text lẫn semantics. |
| Empty / not applicable | `reported-fact-register` | Phân biệt true empty, no-match và non-applicable; cung cấp valid next action. |
| Error / retry | `graph-node-correction-and-revalidation` | Giữ valid context/input, nêu failed owner và cung cấp local retry. |
| Permission / unavailable | `accepted-report-and-validation-receipt` | Không ngụ ý hidden evidence là absent; giải thích restriction và safe exit. |
| Pending | `graph-node-correction-and-revalidation` | Ngăn duplicate action, giữ exact target và announce progress mà không chuyển focus. |
| Success | `accepted-report-and-validation-receipt` | Xác nhận exact outcome, giữ selection và cung cấp next action hoặc recovery. |
| Stale / conflict | `report-taxonomy-entry-points-and-filing-rule-version` | Giữ last safe value, nêu version/time conflict và yêu cầu explicit recovery. |
| Focus transition | `graph-node-correction-and-revalidation` | Chỉ chuyển focus vào required error summary/modal, sau đó trả exact trigger. |
| Responsive presentation | `xbrl-validation` | Giữ state, selection, query, pending result và recovery khi topology đổi. |

## Boundaries

### Accept

- Accept khi dominant task là: Kiểm tra từng fact XBRL được báo cáo qua concept taxonomy, context kỳ và thực thể, unit, dimensions và relationship networks; sau đó sửa node nhỏ nhất đang sở hữu lỗi và chứng minh lần revalidation xác định mà không đổi intended meaning.
- Accept khi mọi required region và relationship trong graph đều cần để hoàn thành task.
- Accept khi compact giữ task, state và recovery bằng replacement topology thay vì stack desktop boxes.

### Reject

- Reject regulatory filing package validation; this is `AR-XFD-90` evidence and must route to an adjacent archetype.
- Reject data import mapping; this is `AR-XFD-91` evidence and must route to an adjacent archetype.
- Reject document outline editing; this is `AR-XFD-92` evidence and must route to an adjacent archetype.
- Reject generic schema validation; this is `AR-XFD-93` evidence and must route to an adjacent archetype.

### Boundary verdict

Chỉ trả `accept` khi dominant task, complete graph và compact parity cùng đúng. Khác biệt chỉ ở noun, density, color, component, card count hoặc state là `duplicate-or-variation`.

## Handoff

- **Grammar handoff:** Bind product-specific owners, labels, permitted actions và truthful state meaning vào declared regions.
- **Principles handoff:** Resolve exact grid, measure, gap, alignment, sticky offset, bounded overflow và relationship-driven transition points.
- Không handoff nào được bỏ required region, đổi dominant task hoặc làm yếu interaction parity.

## Non-binding research evidence

### Evidence boundary

External research là advisory evidence, không phải product truth. Nó hỗ trợ synthesis task relationships, adaptive behavior và accessibility obligations; nó không chọn StarCi owners, exact geometry hay cấp quyền copy source interface.

### Sources

| Source | Hỗ trợ | Không chứng minh |
|---|---|---|
| [XBRL International — Specifications](https://specifications.xbrl.org/specifications.html) | Concept, context, unit, dimensions, calculation, definition, presentation, and formula recommendation families. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [U.S. SEC — EDGAR technical specifications](https://www.sec.gov/submit-filings/technical-specifications) | Filing-rule versions and EDGAR XBRL validation context. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Dense fact-register selection, row actions, and bounded disclosure. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [W3C WAI — Treegrid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/) | Keyboard navigation and distinct focus/selection for hierarchical tabular relationships. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |

The source set includes at least three independent official organizations and W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "xbrl-fact-context-dimensional-validation-workbench",
  "situationCodes": [
    "<matched AR-XFD-* codes>"
  ],
  "searchAliases": [
    "XBRL semantic graph validator",
    "fact context dimension repair",
    "taxonomy relationship validation"
  ],
  "dominantTask": "Kiểm tra từng fact XBRL được báo cáo qua concept taxonomy, context kỳ và thực thể, unit, dimensions và relationship networks; sau đó sửa node nhỏ nhất đang sở hữu lỗi và chứng minh lần revalidation xác định mà không đổi intended meaning.",
  "regions": [
    "xbrl-validation",
    "report-taxonomy-entry-points-and-filing-rule-version",
    "reported-fact-register",
    "selected-fact",
    "concept-type-period-balance-and-label",
    "context-entity-period-scenario",
    "unit-and-decimals-precision",
    "explicit-and-typed-dimension-members",
    "presentation-calculation-definition-and-formula-relationships",
    "semantic-issue-and-affected-fact-set",
    "graph-node-correction-and-revalidation",
    "accepted-report-and-validation-receipt"
  ],
  "regionRelationships": [
    "Một reported fact chỉ hợp lệ khi neighborhood fact↔concept↔context/unit/dimension↔taxonomy relationship nhất quán; correction chỉ đổi node nhỏ nhất đang sở hữu lỗi và expose mọi affected fact trước khi chạy lại."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and drawer response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "xbrl-validation -> report-taxonomy-entry-points-and-filing-rule-version -> reported-fact-register -> selected-fact -> concept-type-period-balance-and-label -> context-entity-period-scenario -> unit-and-decimals-precision -> explicit-and-typed-dimension-members -> presentation-calculation-definition-and-formula-relationships -> semantic-issue-and-affected-fact-set -> graph-node-correction-and-revalidation -> accepted-report-and-validation-receipt",
    "navigationReplacement": "<none, synchronized drawer, or primary-pane sequence>",
    "stickyBehavior": "<reserved space and short-height yield>",
    "overflowOwner": "reported-fact-register",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": [
    "taxonomy loading/resolved/missing",
    "fact reported/duplicate/inconsistent",
    "concept standard/extension/deprecated",
    "context valid/malformed/duplicate",
    "unit compatible/incompatible",
    "dimension allowed/disallowed/missing",
    "relationship satisfied/broken/circular",
    "calculation consistent/inconsistent",
    "correction draft/applied/reverted",
    "validation running/pass/fail",
    "report draft/accepted/superseded"
  ],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": [
    "<product meaning and semantic owners>"
  ],
  "principlesHandoff": [
    "<unresolved geometry only>"
  ],
  "confidence": "<high | medium | low>",
  "evidence": [
    "<business or current-source facts>",
    "<official task research>",
    "<accessibility research>"
  ]
}
```
