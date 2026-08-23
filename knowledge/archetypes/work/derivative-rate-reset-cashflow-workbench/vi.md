# Derivative rate reset cashflow workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `derivative-rate-reset-cashflow-workbench` |
| Family | Work |
| Dominant task | Xác định một derivative reset theo hợp đồng từ schedule, observations, index và fallback provisions; tính leg cash flows; lấy counterparty agreement; rồi settle hoặc dispute payment. |
| Search aliases | `interest rate reset workbench`, `swap fixing cashflow confirmation`, `fallback rate determination` |
| Authority | Shared product-neutral macro topology; Grammar sở hữu product semantics, Principles sở hữu unresolved geometry và Direction sở hữu visual character. |

### Invariants

- Xác định một derivative reset theo hợp đồng từ schedule, observations, index và fallback provisions; tính leg cash flows; lấy counterparty agreement; rồi settle hoặc dispute payment.
- Accrual period chính xác và contractual observation method ràng buộc rate determination với day count, notional, compounding, gross leg amounts và agreed net payment.
- Mỗi required region giữ một owner riêng và cùng selected context; product noun không thay đổi topology.
- Wide, intermediate và compact giữ meaningful DOM, reading và focus order, action parity và deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-DRR-01` | Dominant task là observable outcome bắt buộc. | Bằng chứng bắt buộc. |
| `AR-DRR-02` | Toàn bộ required region graph và named relationship đều cần. | Bằng chứng bắt buộc. |
| `AR-DRR-03` | Compact giữ action, state, recovery và focus meaning của wide. | Bằng chứng bắt buộc. |
| `AR-DRR-04` | Task-specific state có thể đổi sau khi user tạo work state. | Bằng chứng bắt buộc. |
| `AR-DRR-90` | Dominant task thực tế thuộc calendar resource scheduling. | Reject. |
| `AR-DRR-91` | Dominant task thực tế thuộc timeline status monitoring. | Reject. |
| `AR-DRR-92` | Dominant task thực tế thuộc generic calculation estimate. | Reject. |
| `AR-DRR-93` | Dominant task thực tế thuộc generic cash-flow table. | Reject. |

### Selection rule

Chọn `derivative-rate-reset-cashflow-workbench` khi và chỉ khi `AR-DRR-01` đến `AR-DRR-04` đều được evidence và không có `AR-DRR-90` đến `AR-DRR-93`. Trả `needs-evidence` khi owner hoặc relationship còn thiếu; trả `reject` khi có rejection code.

## Region graph

```text
derivative-reset
|-- contract-confirmation-and-definition-version
|-- leg-schedule-and-business-day-conventions
|   `-- accrual-period-and-reset-event
|       `-- observation-set-index-source-and-fallback-waterfall
|           |-- fixed-or-floating-rate-determination
|           `-- day-count-notional-and-compounding-calculation
|-- gross-leg-cashflows-and-net-payment
|-- counterparty-confirmation-dispute-and-adjustment
`-- settled-cancelled-or-superseded-cashflow-lineage
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `derivative-reset` | Sở hữu dominant task, toàn bộ descendant state và recovery boundary. |
| `contract-confirmation-and-definition-version` | Sở hữu evidence, action và state của Contract Confirmation And Definition Version; giữ quan hệ đã khai báo với selection hiện tại và không vay product semantics. |
| `leg-schedule-and-business-day-conventions` | Sở hữu evidence, action và state của Leg Schedule And Business Day Conventions; giữ quan hệ đã khai báo với selection hiện tại và không vay product semantics. |
| `accrual-period-and-reset-event` | Sở hữu evidence, action và state của Accrual Period And Reset Event; giữ quan hệ đã khai báo với selection hiện tại và không vay product semantics. |
| `observation-set-index-source-and-fallback-waterfall` | Sở hữu evidence, action và state của Observation Set Index Source And Fallback Waterfall; giữ quan hệ đã khai báo với selection hiện tại và không vay product semantics. |
| `fixed-or-floating-rate-determination` | Sở hữu evidence, action và state của Fixed Or Floating Rate Determination; giữ quan hệ đã khai báo với selection hiện tại và không vay product semantics. |
| `day-count-notional-and-compounding-calculation` | Sở hữu evidence, action và state của Day Count Notional And Compounding Calculation; giữ quan hệ đã khai báo với selection hiện tại và không vay product semantics. |
| `gross-leg-cashflows-and-net-payment` | Sở hữu evidence, action và state của Gross Leg Cashflows And Net Payment; giữ quan hệ đã khai báo với selection hiện tại và không vay product semantics. |
| `counterparty-confirmation-dispute-and-adjustment` | Sở hữu evidence, action và state của Counterparty Confirmation Dispute And Adjustment; giữ quan hệ đã khai báo với selection hiện tại và không vay product semantics. |
| `settled-cancelled-or-superseded-cashflow-lineage` | Sở hữu evidence, action và state của Settled Cancelled Or Superseded Cashflow Lineage; giữ quan hệ đã khai báo với selection hiện tại và không vay product semantics. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi các vùng đồng thời không còn giữ được readable labels, exact associations và complete actions.
- **Topology response:** Contract terms, schedule, observations, fallback path, rate calculation, gross and net cash flows, and confirmation state được giữ đồng thời hiển thị.
- **Navigation replacement:** None while all simultaneous regions remain usable.
- **Sticky boundary:** Chỉ current task receipt hoặc blocking action được sticky; nó reserve space, không che focus và trở về normal flow ở short height.
- **Overflow owner:** `leg-schedule-and-business-day-conventions` is the only bounded owner on the necessary axis; the page owns no overflow.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi supporting region ưu tiên thấp làm primary relationship không dùng được.
- **Topology response:** Active reset event, selected observations, fallback decision và payment calculation giữ vai trò primary; full schedule, definition history và prior settlements chuyển vào synchronized drawers.
- **Navigation replacement:** Một synchronized drawer thay vùng bị dời và giữ nguyên selected object, query, state, scroll context và exact trigger.
- **Sticky boundary:** Chỉ current task receipt hoặc blocking action được sticky; nó reserve space, không che focus và trở về normal flow ở short height.
- **Overflow owner:** `leg-schedule-and-business-day-conventions` retains bounded overflow; the drawer creates no nested page scroll.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai task regions không thể cùng giữ readable evidence, target 44 CSS px và unobscured focus.
- **Topology response:** Contract leg → active accrual period → observation hoặc fallback → determined rate → day count/notional calculation → gross và net cash flow → confirm, dispute, adjust hoặc settle; schedule trở thành một reset-event route.
- **Navigation replacement:** Primary-pane sequence với Back khôi phục selection, state, query, scroll context và exact trigger.
- **Sticky boundary:** Chỉ current task receipt hoặc blocking action được sticky; nó reserve space, không che focus và trở về normal flow ở short height.
- **Overflow owner:** `leg-schedule-and-business-day-conventions` becomes a semantic list or step route when its bounded view no longer fits.

### Reflow

- Semantic, DOM và meaningful focus order giữ graph: `derivative-reset -> contract-confirmation-and-definition-version -> leg-schedule-and-business-day-conventions -> accrual-period-and-reset-event -> observation-set-index-source-and-fallback-waterfall -> fixed-or-floating-rate-determination -> day-count-notional-and-compounding-calculation -> gross-leg-cashflows-and-net-payment -> counterparty-confirmation-dispute-and-adjustment -> settled-cancelled-or-superseded-cashflow-lineage`.
- Long labels, localization, zoom và enlarged controls kích hoạt cùng named topology changes.
- CSS không reorder semantics; ordinary content không tạo page-level horizontal scroll.
- Hidden detail luôn có explicit accessible reveal path.

### Interaction parity

- Mọi selection, edit, action, explanation, retry và recovery ở wide vẫn reachable ở intermediate và compact.
- Topology change giữ exact selected object, order, input, pending result và error context.
- Pointer action có keyboard equivalent; color không bao giờ là tín hiệu duy nhất.
- Dynamic update announce một contextual status mà không giật focus.

## State obligations

Task-specific states: contract active/terminated/amended; schedule valid/broken; reset upcoming/due/determined; observation available/missing/corrected; fallback inactive/triggered/disputed; rate provisional/final; cash flow calculated/adjusted; counterparty unconfirmed/agreed/disputed; payment pending/settled/failed; prior determination superseded.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `contract-confirmation-and-definition-version` | Nêu loading scope, reserve primary region và chỉ block owner bị lỗi. |
| Ready | `leg-schedule-and-business-day-conventions` | Expose current object, owner relationship, selection và valid action bằng text lẫn semantics. |
| Empty / not applicable | `leg-schedule-and-business-day-conventions` | Phân biệt true empty, no-match và non-applicable; cung cấp valid next action. |
| Error / retry | `counterparty-confirmation-dispute-and-adjustment` | Giữ valid context/input, nêu failed owner và cung cấp local retry. |
| Permission / unavailable | `settled-cancelled-or-superseded-cashflow-lineage` | Không ngụ ý hidden evidence là absent; giải thích restriction và safe exit. |
| Pending | `counterparty-confirmation-dispute-and-adjustment` | Ngăn duplicate action, giữ exact target và announce progress mà không chuyển focus. |
| Success | `settled-cancelled-or-superseded-cashflow-lineage` | Xác nhận exact outcome, giữ selection và cung cấp next action hoặc recovery. |
| Stale / conflict | `contract-confirmation-and-definition-version` | Giữ last safe value, nêu version/time conflict và yêu cầu explicit recovery. |
| Focus transition | `counterparty-confirmation-dispute-and-adjustment` | Chỉ chuyển focus vào required error summary/modal, sau đó trả exact trigger. |
| Responsive presentation | `derivative-reset` | Giữ state, selection, query, pending result và recovery khi topology đổi. |

## Boundaries

### Accept

- Accept khi dominant task là: Xác định một derivative reset theo hợp đồng từ schedule, observations, index và fallback provisions; tính leg cash flows; lấy counterparty agreement; rồi settle hoặc dispute payment.
- Accept khi mọi required region và relationship trong graph đều cần để hoàn thành task.
- Accept khi compact giữ task, state và recovery bằng replacement topology thay vì stack desktop boxes.

### Reject

- Reject calendar resource scheduling; this is `AR-DRR-90` evidence and must route to an adjacent archetype.
- Reject timeline status monitoring; this is `AR-DRR-91` evidence and must route to an adjacent archetype.
- Reject generic calculation estimate; this is `AR-DRR-92` evidence and must route to an adjacent archetype.
- Reject generic cash-flow table; this is `AR-DRR-93` evidence and must route to an adjacent archetype.

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
| [ISDA — 2021 Interest Rate Derivatives Definitions InfoHub](https://www.isda.org/?p=975268) | Versioned definitions, floating-rate options, confirmations, and fallback context. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [FpML — Interest-rate product architecture](https://www.fpml.org/spec/fpml-5-1-6-rec-1/html/reporting/fpml-5-1-intro-5.html) | Reset dates, calculation periods, day-count, compounding, and regenerable cash-flow representations. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Schedule-row selection, dense numeric comparison, and bounded data disclosure. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [W3C WAI — Focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum) | Sticky confirmation state that does not cover focused schedule or actions. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |

The source set includes at least three independent official organizations and W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "derivative-rate-reset-cashflow-workbench",
  "situationCodes": [
    "<matched AR-DRR-* codes>"
  ],
  "searchAliases": [
    "interest rate reset workbench",
    "swap fixing cashflow confirmation",
    "fallback rate determination"
  ],
  "dominantTask": "Xác định một derivative reset theo hợp đồng từ schedule, observations, index và fallback provisions; tính leg cash flows; lấy counterparty agreement; rồi settle hoặc dispute payment.",
  "regions": [
    "derivative-reset",
    "contract-confirmation-and-definition-version",
    "leg-schedule-and-business-day-conventions",
    "accrual-period-and-reset-event",
    "observation-set-index-source-and-fallback-waterfall",
    "fixed-or-floating-rate-determination",
    "day-count-notional-and-compounding-calculation",
    "gross-leg-cashflows-and-net-payment",
    "counterparty-confirmation-dispute-and-adjustment",
    "settled-cancelled-or-superseded-cashflow-lineage"
  ],
  "regionRelationships": [
    "Accrual period chính xác và contractual observation method ràng buộc rate determination với day count, notional, compounding, gross leg amounts và agreed net payment."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and drawer response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "derivative-reset -> contract-confirmation-and-definition-version -> leg-schedule-and-business-day-conventions -> accrual-period-and-reset-event -> observation-set-index-source-and-fallback-waterfall -> fixed-or-floating-rate-determination -> day-count-notional-and-compounding-calculation -> gross-leg-cashflows-and-net-payment -> counterparty-confirmation-dispute-and-adjustment -> settled-cancelled-or-superseded-cashflow-lineage",
    "navigationReplacement": "<none, synchronized drawer, or primary-pane sequence>",
    "stickyBehavior": "<reserved space and short-height yield>",
    "overflowOwner": "leg-schedule-and-business-day-conventions",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": [
    "contract active/terminated/amended",
    "schedule valid/broken",
    "reset upcoming/due/determined",
    "observation available/missing/corrected",
    "fallback inactive/triggered/disputed",
    "rate provisional/final",
    "cash flow calculated/adjusted",
    "counterparty unconfirmed/agreed/disputed",
    "payment pending/settled/failed",
    "prior determination superseded"
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
