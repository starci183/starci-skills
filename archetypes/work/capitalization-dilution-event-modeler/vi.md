# Capitalization dilution event modeler

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `capitalization-dilution-event-modeler` |
| Family | Work |
| Dominant task | Thực thi một financing hoặc capitalization event trên mọi equity và equity-linked instrument đang outstanding theo dependency order đã quy định, rồi phát hành post-event ownership record đã reconcile. |
| Search aliases | `cap table event cascade`, `fully diluted ownership bridge`, `conversion issuance pool modeler` |
| Authority | Shared product-neutral macro topology; Grammar sở hữu product semantics, Principles sở hữu unresolved geometry và Direction sở hữu visual character. |

### Invariants

- Thực thi một financing hoặc capitalization event trên mọi equity và equity-linked instrument đang outstanding theo dependency order đã quy định, rồi phát hành post-event ownership record đã reconcile.
- Frozen pre-event snapshot và instrument-rights dependency DAG điều khiển ordered cascade; tác động shares, proceeds, rounding và protective adjustment phải propagate tới mọi affected holder trước khi close.
- Mỗi required region giữ một owner riêng và cùng selected context; product noun không thay đổi topology.
- Wide, intermediate và compact giữ meaningful DOM, reading và focus order, action parity và deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-CDE-01` | Dominant task là observable outcome bắt buộc. | Bằng chứng bắt buộc. |
| `AR-CDE-02` | Toàn bộ required region graph và named relationship đều cần. | Bằng chứng bắt buộc. |
| `AR-CDE-03` | Compact giữ action, state, recovery và focus meaning của wide. | Bằng chứng bắt buộc. |
| `AR-CDE-04` | Task-specific state có thể đổi sau khi user tạo work state. | Bằng chứng bắt buộc. |
| `AR-CDE-90` | Dominant task thực tế thuộc scenario sensitivity modeling. | Reject. |
| `AR-CDE-91` | Dominant task thực tế thuộc capacity allocation. | Reject. |
| `AR-CDE-92` | Dominant task thực tế thuộc spreadsheet grid editing. | Reject. |
| `AR-CDE-93` | Dominant task thực tế thuộc signed contribution waterfall. | Reject. |

### Selection rule

Chọn `capitalization-dilution-event-modeler` khi và chỉ khi `AR-CDE-01` đến `AR-CDE-04` đều được evidence và không có `AR-CDE-90` đến `AR-CDE-93`. Trả `needs-evidence` khi owner hoặc relationship còn thiếu; trả `reject` khi có rejection code.

## Region graph

```text
dilution-event
|-- frozen-pre-event-capitalization-snapshot
|-- instrument-rights-dependency-dag
|-- financing-or-corporate-event-terms
|-- dependency-ordered-conversion-exercise-issuance-pool-resize-and-protective-adjustment-cascade
|   |-- affected-instrument-set
|   `-- per-holder-share-and-proceeds-propagation
|-- fully-diluted-ownership-bridge-for-all-affected-holders
|-- rounding-and-residuals
|-- approval-close-and-security-issuance
`-- post-event-cap-table-and-certificate-lineage
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `dilution-event` | Sở hữu dominant task, toàn bộ descendant state và recovery boundary. |
| `frozen-pre-event-capitalization-snapshot` | Sở hữu evidence, action và state của Frozen Pre Event Capitalization Snapshot; giữ quan hệ đã khai báo với selection hiện tại và không vay product semantics. |
| `instrument-rights-dependency-dag` | Sở hữu evidence, action và state của Instrument Rights Dependency Dag; giữ quan hệ đã khai báo với selection hiện tại và không vay product semantics. |
| `financing-or-corporate-event-terms` | Sở hữu evidence, action và state của Financing Or Corporate Event Terms; giữ quan hệ đã khai báo với selection hiện tại và không vay product semantics. |
| `dependency-ordered-conversion-exercise-issuance-pool-resize-and-protective-adjustment-cascade` | Sở hữu evidence, action và state của Dependency Ordered Conversion Exercise Issuance Pool Resize And Protective Adjustment Cascade; giữ quan hệ đã khai báo với selection hiện tại và không vay product semantics. |
| `affected-instrument-set` | Sở hữu evidence, action và state của Affected Instrument Set; giữ quan hệ đã khai báo với selection hiện tại và không vay product semantics. |
| `per-holder-share-and-proceeds-propagation` | Sở hữu evidence, action và state của Per Holder Share And Proceeds Propagation; giữ quan hệ đã khai báo với selection hiện tại và không vay product semantics. |
| `fully-diluted-ownership-bridge-for-all-affected-holders` | Sở hữu evidence, action và state của Fully Diluted Ownership Bridge For All Affected Holders; giữ quan hệ đã khai báo với selection hiện tại và không vay product semantics. |
| `rounding-and-residuals` | Sở hữu evidence, action và state của Rounding And Residuals; giữ quan hệ đã khai báo với selection hiện tại và không vay product semantics. |
| `approval-close-and-security-issuance` | Sở hữu evidence, action và state của Approval Close And Security Issuance; giữ quan hệ đã khai báo với selection hiện tại và không vay product semantics. |
| `post-event-cap-table-and-certificate-lineage` | Sở hữu evidence, action và state của Post Event Cap Table And Certificate Lineage; giữ quan hệ đã khai báo với selection hiện tại và không vay product semantics. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi các vùng đồng thời không còn giữ được readable labels, exact associations và complete actions.
- **Topology response:** Pre-event instruments, dependency sequence, active conversion terms, all-holder impact bridge, rounding receipt, and post-event ownership được giữ hiển thị together.
- **Navigation replacement:** None while all simultaneous regions remain usable.
- **Sticky boundary:** Chỉ current task receipt hoặc blocking action được sticky; nó reserve space, không che focus và trở về normal flow ở short height.
- **Overflow owner:** `fully-diluted-ownership-bridge-for-all-affected-holders` is the only bounded owner on the necessary axis; the page owns no overflow.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi supporting region ưu tiên thấp làm primary relationship không dùng được.
- **Topology response:** Active sequence step và affected holders giữ vai trò primary; full rights register, alternate assumptions, frozen snapshot detail và certificate history chuyển vào synchronized drawers.
- **Navigation replacement:** Một synchronized drawer thay vùng bị dời và giữ nguyên selected object, query, state, scroll context và exact trigger.
- **Sticky boundary:** Chỉ current task receipt hoặc blocking action được sticky; nó reserve space, không che focus và trở về normal flow ở short height.
- **Overflow owner:** `fully-diluted-ownership-bridge-for-all-affected-holders` retains bounded overflow; the drawer creates no nested page scroll.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai task regions không thể cùng giữ readable evidence, target 44 CSS px và unobscured focus.
- **Topology response:** Event terms → ordered conversion, exercise, pool resize hoặc issuance kế tiếp → affected instrument và holder → shares và proceeds → rounding hoặc protective adjustment → post-event ownership → approve close; ownership matrix trở thành event-step route.
- **Navigation replacement:** Primary-pane sequence với Back khôi phục selection, state, query, scroll context và exact trigger.
- **Sticky boundary:** Chỉ current task receipt hoặc blocking action được sticky; nó reserve space, không che focus và trở về normal flow ở short height.
- **Overflow owner:** `fully-diluted-ownership-bridge-for-all-affected-holders` becomes a semantic list or step route when its bounded view no longer fits.

### Reflow

- Semantic, DOM và meaningful focus order giữ graph: `dilution-event -> frozen-pre-event-capitalization-snapshot -> instrument-rights-dependency-dag -> financing-or-corporate-event-terms -> dependency-ordered-conversion-exercise-issuance-pool-resize-and-protective-adjustment-cascade -> affected-instrument-set -> per-holder-share-and-proceeds-propagation -> fully-diluted-ownership-bridge-for-all-affected-holders -> rounding-and-residuals -> approval-close-and-security-issuance -> post-event-cap-table-and-certificate-lineage`.
- Long labels, localization, zoom và enlarged controls kích hoạt cùng named topology changes.
- CSS không reorder semantics; ordinary content không tạo page-level horizontal scroll.
- Hidden detail luôn có explicit accessible reveal path.

### Interaction parity

- Mọi selection, edit, action, explanation, retry và recovery ở wide vẫn reachable ở intermediate và compact.
- Topology change giữ exact selected object, order, input, pending result và error context.
- Pointer action có keyboard equivalent; color không bao giờ là tín hiệu duy nhất.
- Dynamic update announce một contextual status mà không giật focus.

## State obligations

Task-specific states: snapshot draft/frozen; instrument outstanding/convertible/exercisable/cancelled; term valid/disputed; sequence blocked/runnable; conversion pending/applied; option pool unchanged/resized; share count exact/rounded/residual; holder ownership provisional/final; approval pending/complete; issuance pending/recorded; cap table corrected/superseded.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `frozen-pre-event-capitalization-snapshot` | Nêu loading scope, reserve primary region và chỉ block owner bị lỗi. |
| Ready | `instrument-rights-dependency-dag` | Expose current object, owner relationship, selection và valid action bằng text lẫn semantics. |
| Empty / not applicable | `instrument-rights-dependency-dag` | Phân biệt true empty, no-match và non-applicable; cung cấp valid next action. |
| Error / retry | `approval-close-and-security-issuance` | Giữ valid context/input, nêu failed owner và cung cấp local retry. |
| Permission / unavailable | `post-event-cap-table-and-certificate-lineage` | Không ngụ ý hidden evidence là absent; giải thích restriction và safe exit. |
| Pending | `approval-close-and-security-issuance` | Ngăn duplicate action, giữ exact target và announce progress mà không chuyển focus. |
| Success | `post-event-cap-table-and-certificate-lineage` | Xác nhận exact outcome, giữ selection và cung cấp next action hoặc recovery. |
| Stale / conflict | `frozen-pre-event-capitalization-snapshot` | Giữ last safe value, nêu version/time conflict và yêu cầu explicit recovery. |
| Focus transition | `approval-close-and-security-issuance` | Chỉ chuyển focus vào required error summary/modal, sau đó trả exact trigger. |
| Responsive presentation | `dilution-event` | Giữ state, selection, query, pending result và recovery khi topology đổi. |

## Boundaries

### Accept

- Accept khi dominant task là: Thực thi một financing hoặc capitalization event trên mọi equity và equity-linked instrument đang outstanding theo dependency order đã quy định, rồi phát hành post-event ownership record đã reconcile.
- Accept khi mọi required region và relationship trong graph đều cần để hoàn thành task.
- Accept khi compact giữ task, state và recovery bằng replacement topology thay vì stack desktop boxes.

### Reject

- Reject scenario sensitivity modeling; this is `AR-CDE-90` evidence and must route to an adjacent archetype.
- Reject capacity allocation; this is `AR-CDE-91` evidence and must route to an adjacent archetype.
- Reject spreadsheet grid editing; this is `AR-CDE-92` evidence and must route to an adjacent archetype.
- Reject signed contribution waterfall; this is `AR-CDE-93` evidence and must route to an adjacent archetype.

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
| [U.S. SEC — Small-business capital formation glossary](https://www.sec.gov/resources-small-businesses/glossary) | Cap-table, convertible-note, dilution, authorized-share, and security vocabulary. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [Delaware Code — Title 8, stock and dividends](https://delcode.delaware.gov/title8/c001/sc05/index.html) | Corporate authority context for stock issuance, classes, and consideration. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Dense holder/instrument comparison, row selection, and bounded ownership tables. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [W3C WAI — Treegrid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/) | Keyboard traversal and focus/selection distinction for an instrument dependency hierarchy. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |

The source set includes at least three independent official organizations and W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "capitalization-dilution-event-modeler",
  "situationCodes": [
    "<matched AR-CDE-* codes>"
  ],
  "searchAliases": [
    "cap table event cascade",
    "fully diluted ownership bridge",
    "conversion issuance pool modeler"
  ],
  "dominantTask": "Thực thi một financing hoặc capitalization event trên mọi equity và equity-linked instrument đang outstanding theo dependency order đã quy định, rồi phát hành post-event ownership record đã reconcile.",
  "regions": [
    "dilution-event",
    "frozen-pre-event-capitalization-snapshot",
    "instrument-rights-dependency-dag",
    "financing-or-corporate-event-terms",
    "dependency-ordered-conversion-exercise-issuance-pool-resize-and-protective-adjustment-cascade",
    "affected-instrument-set",
    "per-holder-share-and-proceeds-propagation",
    "fully-diluted-ownership-bridge-for-all-affected-holders",
    "rounding-and-residuals",
    "approval-close-and-security-issuance",
    "post-event-cap-table-and-certificate-lineage"
  ],
  "regionRelationships": [
    "Frozen pre-event snapshot và instrument-rights dependency DAG điều khiển ordered cascade; tác động shares, proceeds, rounding và protective adjustment phải propagate tới mọi affected holder trước khi close."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and drawer response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "dilution-event -> frozen-pre-event-capitalization-snapshot -> instrument-rights-dependency-dag -> financing-or-corporate-event-terms -> dependency-ordered-conversion-exercise-issuance-pool-resize-and-protective-adjustment-cascade -> affected-instrument-set -> per-holder-share-and-proceeds-propagation -> fully-diluted-ownership-bridge-for-all-affected-holders -> rounding-and-residuals -> approval-close-and-security-issuance -> post-event-cap-table-and-certificate-lineage",
    "navigationReplacement": "<none, synchronized drawer, or primary-pane sequence>",
    "stickyBehavior": "<reserved space and short-height yield>",
    "overflowOwner": "fully-diluted-ownership-bridge-for-all-affected-holders",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": [
    "snapshot draft/frozen",
    "instrument outstanding/convertible/exercisable/cancelled",
    "term valid/disputed",
    "sequence blocked/runnable",
    "conversion pending/applied",
    "option pool unchanged/resized",
    "share count exact/rounded/residual",
    "holder ownership provisional/final",
    "approval pending/complete",
    "issuance pending/recorded",
    "cap table corrected/superseded"
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
