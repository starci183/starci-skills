# Parallel document reader

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `parallel-document-reader` |
| Family | Discovery |
| Dominant task | Đọc và đối chiếu hai tài liệu được căn chỉnh ổn định mà không edit hay resolve tài liệu nào. |
| Search aliases | `parallel reader, bilingual reader, aligned editions, side by side documents` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- Archetype này chỉ quyết định dominant task, required region, quan hệ vùng, responsive transformation và interaction parity.
- Grammar sở hữu semantic và product owner; Principles sở hữu exact geometry cùng breakpoint; Direction sở hữu visual character.
- Current source và research là evidence, không phải quyền copy layout hoặc tạo product fact.
- Region ID, situation code và shared state giữ nguyên qua wide, intermediate và compact.

## Recognition

### Situation codes

| Code | Situation | Verdict or obligation |
|---|---|---|
| `AR-PDR-01` | Đọc và đối chiếu hai tài liệu được căn chỉnh ổn định mà không edit hay resolve tài liệu nào. | Candidate khi được chứng minh. |
| `AR-PDR-02` | Mọi region trong `parallel-reader → document-pair-context → alignment-navigator → source-manuscript ↔ counterpart-manuscript → alignment-notes-and-markers → shared-reading-position` đều bắt buộc và có owner riêng. | Bắt buộc để chọn. |
| `AR-PDR-03` | Selection, query, anchor, progress hoặc path là shared state giữa các region liên quan. | Giữ một state identity. |
| `AR-PDR-04` | Một quan hệ đồng hiện được đặt tên thất bại trước khi content hoặc control mất khả dụng. | Áp dụng responsive contract. |
| `AR-PDR-05` | Compact replacement giữ action, state, recovery và focus context. | Bắt buộc cho parity. |
| `AR-PDR-90` | Reconciliation có edit cần diff workbench. | Reject. |
| `AR-PDR-91` | Tài liệu đơn thuộc manuscript reader. | Reject. |
| `AR-PDR-92` | Localization authoring không phải đối chiếu read-only. | Reject. |

### Selection rule

Chọn `parallel-document-reader` chỉ khi AR-PDR-01, AR-PDR-02, AR-PDR-03 được chứng minh và không có AR-PDR-90, AR-PDR-91, AR-PDR-92. Áp dụng responsive contract khi AR-PDR-04 xảy ra. Trả `needs-evidence` khi không thể chứng minh AR-PDR-05.

## Region graph

```text
parallel-reader
├─ document-pair-context
├─ alignment-navigator
├─ source-manuscript
├─ counterpart-manuscript
├─ alignment-notes-and-markers
└─ shared-reading-position
```

Quan hệ chuẩn: `parallel-reader → document-pair-context → alignment-navigator → source-manuscript ↔ counterpart-manuscript → alignment-notes-and-markers → shared-reading-position`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `parallel-reader` | Sở hữu đối chiếu read-only hai tài liệu có alignment ổn định; thiết lập pair version, aligned segment ID, active pane, zoom, note và reading position cho mọi child mà không hấp thụ trách nhiệm của child. |
| `document-pair-context` | sở hữu pair identity, version và read-only purpose; nhận pair version, aligned segment ID, active pane, zoom, note và reading position từ `parallel-reader` và publish cùng identity tới `alignment-navigator`. |
| `alignment-navigator` | sở hữu chuyển giữa stable alignment anchor; nhận pair version, aligned segment ID, active pane, zoom, note và reading position từ `document-pair-context` và publish cùng identity tới `source-manuscript`. |
| `source-manuscript` | sở hữu source text và publish active aligned segment; nhận pair version, aligned segment ID, active pane, zoom, note và reading position từ `alignment-navigator` và publish cùng identity tới `counterpart-manuscript`. |
| `counterpart-manuscript` | sở hữu counterpart text và consume cùng aligned segment; nhận pair version, aligned segment ID, active pane, zoom, note và reading position từ `source-manuscript` và publish cùng identity tới `alignment-notes-and-markers`. |
| `alignment-notes-and-markers` | sở hữu unmatched, one-to-many, note và bookmark marker; nhận pair version, aligned segment ID, active pane, zoom, note và reading position từ `counterpart-manuscript` và publish cùng identity tới `shared-reading-position`. |
| `shared-reading-position` | sở hữu synchronization mode và exact return position xuyên view; nhận pair version, aligned segment ID, active pane, zoom, note và reading position từ `alignment-notes-and-markers` và đóng dominant-task loop. |

## Responsive contract

### Wide

- **Failure trigger:** Mọi required region còn measure khả dụng và sự đồng hiện vẫn giúp dominant task.
- **Topology response:** Giữ hai manuscript cạnh nhau với anchor đồng bộ deterministic và segment identity dùng chung rõ ràng.
- **Navigation replacement:** Không thay thế; manuscript side-by-side chỉ khi aligned linkage còn deterministic.
- **Sticky boundary:** Pair context chỉ persist khi reserve space; không manuscript nào overlay manuscript kia.
- **Overflow owner:** Mỗi manuscript chỉ được own bounded vertical scroll khi anchor synchronization deterministic.

### Intermediate

- **Failure trigger:** Supporting region ưu tiên thấp nhất không còn đồng hiện được mà không làm hỏng measure, path hoặc control.
- **Topology response:** Giữ một manuscript là primary và counterpart có thể thu gọn trong khi summary segment căn chỉnh vẫn nhìn thấy.
- **Navigation replacement:** Giữ một manuscript primary và counterpart trong collapsible pane; hiển thị current aligned segment summary.
- **Sticky boundary:** Counterpart pane trả focus về view trigger.
- **Overflow owner:** Primary reading own page flow; temporary counterpart chỉ own internal reading axis.

### Compact

- **Failure trigger:** Hai hay nhiều primary/supporting region không thể đồng hiện với reading, focus và touch target khả dụng.
- **Topology response:** Toggle tài liệu hoặc xen kẽ segment căn chỉnh trong khi giữ đúng anchor, zoom, note và reading position.
- **Navigation replacement:** Toggle source/counterpart hoặc interleave aligned segment và giữ exact anchor/zoom/note/position.
- **Sticky boundary:** Không manuscript surface nào sticky ở short-height.
- **Overflow owner:** Active/interleaved reading sequence own page flow.

### Reflow

- DOM order và reading order theo region graph; CSS không reorder semantic.
- Resize không reset query, selection, anchor, progress, path hoặc recovery state.
- Text zoom, bản dịch dài, missing media và user content không làm mất label, relationship hoặc recovery route.
- Page không tạo horizontal scroll; bounded exception thuộc đúng overflow owner đã khai báo.

### Interaction parity

- Mọi wide action, state, recovery route và keyboard path tồn tại ở intermediate và compact.
- Temporary surface hỗ trợ Escape hoặc cancel, giữ modal focus và trả focus đúng trigger.
- Dynamic status được announce không cướp focus; visual state không chỉ dựa vào color.
- Pointer, hover, gesture và motion luôn có keyboard hoặc static alternative.

## State obligations

| State family | Region | Obligation | Responsive presentation |
|---|---|---|---|
| Initial/loading | `document-pair-context` | Tải cả hai manuscript loading và partial failure được cô lập mà không thay pair version, aligned segment ID, active pane, zoom, note và reading position đã commit gần nhất. | Giữ context an toàn gần nhất ở mọi band. |
| Ready | `alignment-notes-and-markers` | Expose active aligned segment, pane, zoom và shared reading position dưới dạng một shared state đã commit. | Biểu diễn cùng identity ở mọi topology. |
| Empty/not-applicable | `alignment-navigator` | Biểu diễn unmatched hoặc one-to-many segment có marker rõ; phân biệt empty với not-applicable và giữ recovery route. | Đặt explanation và recovery trong primary sequence. |
| Error/retry | `alignment-notes-and-markers` | Khi một manuscript lỗi nhưng manuscript còn lại vẫn đọc được, nêu failing scope và giữ context không bị ảnh hưởng. | Giữ retry reachable bên ngoài surface đã collapse. |
| Permission/unavailable | `alignment-notes-and-markers` | Biểu diễn một manuscript unavailable mà không suy diễn empty alignment; không suy diễn dữ liệu unavailable là absent. | Giữ path và alternate route visible. |
| Pending | `shared-reading-position` | Trong khi alignment jump, note load hoặc sync recovery đang chờ, disable duplicate action và announce progress mà không di chuyển focus. | Giữ action label, target và recovery. |
| Success | `shared-reading-position` | Sau khi cả hai view xác nhận cùng aligned segment, xác nhận outcome mà không reset selection hoặc auto-scroll. | Announce outcome tại chỗ. |
| Stale/conflict | `alignment-notes-and-markers` | Khi version mismatch hoặc synchronization bị pause, giữ last safe view và cung cấp refresh hoặc reconciliation. | Topology change không tự resolve staleness. |
| Focus transition | `document-pair-context` | focus source↔counterpart và view toggle giữ exact anchor/return target. | Inline và modal presentation giữ cùng action path. |
| Responsive presentation | `parallel-reader` | Resize giữ pair version, aligned segment ID, active pane, zoom, note và reading position, recovery và action availability. | Không state hoặc action nào biến mất. |

## Boundaries

### Accept

- Dominant task khớp: Đọc và đối chiếu hai tài liệu được căn chỉnh ổn định mà không edit hay resolve tài liệu nào.
- Mọi required region và quan hệ `parallel-reader → document-pair-context → alignment-navigator → source-manuscript ↔ counterpart-manuscript → alignment-notes-and-markers → shared-reading-position` đều có evidence.
- Compact replacement giữ selection, state, action, recovery và focus context.

### Reject

- Reconciliation có edit cần diff workbench.
- Tài liệu đơn thuộc manuscript reader.
- Localization authoring không phải đối chiếu read-only.
- Reject khi khác archetype hiện có chỉ ở product noun, card count, density, color, component hoặc state.

### Boundary verdict

Trả `accept` khi selection rule và parity pass. Trả `reject` cho rejection evidence, `duplicate-or-variation` cho biến thể noun hoặc presentation, và `needs-evidence` khi thiếu một fact phân biệt.

## Handoff

Grammar gán semantic và product owner cho từng region. Principles resolve exact grid, measure, gap, size, alignment, overflow exception và breakpoint sau topology selection. Direction resolve visual character.

## Non-binding research evidence

### Evidence boundary

Các nguồn official này là evidence advisory cho topology, interaction và accessibility. Chúng không phải product truth, không biến tên archetype tổng hợp thành thuật ngữ official và không cấp quyền copy geometry, component tree, breakpoint hoặc visual treatment.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [Apple Human Interface Guidelines — Split views](https://developer.apple.com/design/human-interface-guidelines/split-views) | Evidence cho pane relationships and collapse. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [Microsoft Fluent 2 layout](https://fluent2.microsoft.design/layout) | Evidence cho adaptive region hierarchy and reflow. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [W3C WCAG 2.2 — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Evidence cho reflow without two-dimensional page scrolling. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [W3C WCAG 2.2 — Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Evidence cho meaningful focus order. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [TEI Guidelines — Linking, Segmentation, and Alignment](https://tei-c.org/release/doc/tei-p5-doc/en/html/SA.html) | Evidence cho stable segment alignment between parallel documents. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |

## Output

```text
archetypeId: parallel-document-reader
situationCodes: AR-PDR-01, AR-PDR-02, AR-PDR-03, AR-PDR-04, AR-PDR-05
searchAliases: parallel reader, bilingual reader, aligned editions, side by side documents
dominantTask: Đọc và đối chiếu hai tài liệu được căn chỉnh ổn định mà không edit hay resolve tài liệu nào.
regions: parallel-reader, document-pair-context, alignment-navigator, source-manuscript, counterpart-manuscript, alignment-notes-and-markers, shared-reading-position
regionRelationships: parallel-reader → document-pair-context → alignment-navigator → source-manuscript ↔ counterpart-manuscript → alignment-notes-and-markers → shared-reading-position
responsive:
  wide: Giữ hai manuscript cạnh nhau với anchor đồng bộ deterministic và segment identity dùng chung rõ ràng.
  intermediate: Giữ một manuscript là primary và counterpart có thể thu gọn trong khi summary segment căn chỉnh vẫn nhìn thấy.
  compact: Toggle tài liệu hoặc xen kẽ segment căn chỉnh trong khi giữ đúng anchor, zoom, note và reading position.
  reflow: semantic and DOM order follow the declared region graph
  readingOrder: parallel-reader → document-pair-context → alignment-navigator → source-manuscript → counterpart-manuscript → alignment-notes-and-markers → shared-reading-position
  navigationReplacement: Toggle source/counterpart hoặc interleave aligned segment và giữ exact anchor/zoom/note/position.
  stickyBehavior: Không manuscript surface nào sticky ở short-height.
  overflowOwner: Active/interleaved reading sequence own page flow.
  interactionParity: every action, state, recovery route, and keyboard path survives
stateObligations: the families in the state matrix
boundaryVerdict: accept | reject | needs-evidence | duplicate-or-variation
grammarHandoff: assign product-semantic owners to required regions
principlesHandoff: resolve exact grid, measure, gap, size, alignment, overflow, and breakpoint
confidence: high — prompt contract and official multi-source evidence converge
evidenceClasses: prompt contract, official interaction guidance, official accessibility guidance
```
