# Odontogram treatment charting workbench

## LOADS

None.

## Record

### Identity

| Trường | Giá trị |
|---|---|
| Archetype ID | `odontogram-treatment-charting-workbench` |
| Family | Work |
| Dominant task | Ghi finding hiện tại và treatment planned, performed hoặc superseded tại đúng tooth và surface trong khi giữ longitudinal dental state có constraint. |
| Search aliases | dental chart, tooth surface state, treatment transition |
| Authority | Authority topology page trung lập sản phẩm; archetype không chọn product semantic, visual direction, token, component, exact geometry hoặc breakpoint. |

### Invariants

- `dental-chart` sở hữu dominant task hoàn chỉnh và recovery boundary.
- Ghi finding hiện tại và treatment planned, performed hoặc superseded tại đúng tooth và surface trong khi giữ longitudinal dental state có constraint.
- Mỗi required region giữ named owner và relationship; Grammar chỉ bind product-semantic owner.
- Wide, intermediate và compact đổi topology khi named relationship fail, không theo device label.
- Transformation giữ selection, draft, pending, error, recovery, reading order và focus meaning.

## Recognition

### Situation codes

| Code | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `AR-OTC-01` | Ghi finding hiện tại và treatment planned, performed hoặc superseded tại đúng tooth và surface trong khi giữ longitudinal dental state có constraint. | Positive evidence bắt buộc. |
| `AR-OTC-02` | Tất cả required region và relationship trong graph đều cần để hoàn tất task. | Yêu cầu complete graph. |
| `AR-OTC-03` | Work state phải sống qua ba named topology response. | Yêu cầu responsive parity. |
| `AR-OTC-04` | Pending, error, permission, stale hoặc conflict có thể xuất hiện sau khi tạo work state. | Yêu cầu recovery không mất input hoặc focus meaning. |
| `AR-OTC-90` | Dominant task thuộc adjacent archetype nêu trong hard rejection. | Reject. |
| `AR-OTC-91` | Reject cho `media-annotation-workbench`, `canvas-inspector-studio`, image markup, spreadsheet or generic record form; non-visual tooth/surface addressing, mutually exclusive finite states and validated planned→performed→superseded transitions are mandatory | Reject. |
| `AR-OTC-92` | Candidate chỉ khác product noun, density, color, component, card count hoặc state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Chọn `odontogram-treatment-charting-workbench` khi và chỉ khi `AR-OTC-01`–`04` được evidence, mọi required region/relationship hiện diện và không có `AR-OTC-90`–`92` hiện diện. Trả `needs-evidence` khi dominant task, owner, overflow owner hoặc completion consequence chưa được chứng minh; trả `reject` khi có rejection code.

## Region graph

```text
dental-chart
├─ dentition-and-notation-context
├─ fixed-tooth-by-surface-semantic-matrix
├─ selected-tooth-finite-state-ledger (peer synchronization)
├─ planned-procedure-layer
├─ performed-or-superseded-transition-layer
├─ notation-and-state-consistency-gate
└─ signed-chart-snapshot
```

### Region obligations

| Region | Owner và relationship bắt buộc |
|---|---|
| `dental-chart` | Sở hữu dominant task, complete state và recovery boundary của odontogram-treatment-charting-workbench. |
| `dentition-and-notation-context` | Sở hữu dentition and notation context; giữ relationship bắt buộc với upstream `dental-chart` and downstream `fixed-tooth-by-surface-semantic-matrix` và không nhận owner từ vùng khác. |
| `fixed-tooth-by-surface-semantic-matrix` | Sở hữu fixed tooth by surface semantic matrix; giữ relationship bắt buộc với upstream `dentition-and-notation-context` and downstream `selected-tooth-finite-state-ledger` và không nhận owner từ vùng khác. |
| `selected-tooth-finite-state-ledger` | Sở hữu selected tooth finite state ledger; giữ relationship bắt buộc với upstream `fixed-tooth-by-surface-semantic-matrix` and downstream `planned-procedure-layer` và không nhận owner từ vùng khác. |
| `planned-procedure-layer` | Sở hữu planned procedure layer; giữ relationship bắt buộc với upstream `selected-tooth-finite-state-ledger` and downstream `performed-or-superseded-transition-layer` và không nhận owner từ vùng khác. |
| `performed-or-superseded-transition-layer` | Sở hữu performed or superseded transition layer; giữ relationship bắt buộc với upstream `planned-procedure-layer` and downstream `notation-and-state-consistency-gate` và không nhận owner từ vùng khác. |
| `notation-and-state-consistency-gate` | Sở hữu notation and state consistency gate; giữ relationship bắt buộc với upstream `performed-or-superseded-transition-layer` and downstream `signed-chart-snapshot` và không nhận owner từ vùng khác. |
| `signed-chart-snapshot` | Sở hữu signed chart snapshot; giữ relationship bắt buộc với upstream `notation-and-state-consistency-gate` và không nhận owner từ vùng khác. |

## Responsive contract

### Wide

- **Failure trigger:** Named relationship không còn đủ measure để đọc, vận hành và hiểu mà không che focus.
- **Topology response:** Full semantic dentition matrix, selected tooth/surface ledger, procedure layers, history and consistency gate remain visible
- **Navigation replacement:** Không có; direct region access vẫn fit.
- **Sticky boundary:** Chỉ current scope hoặc primary action được persist khi đã reserve space; short-height đưa nó về normal flow.
- **Overflow owner:** `fixed-tooth-by-surface-semantic-matrix` owns bounded two-axis navigation; compact replaces it with addressed paths.

### Intermediate

- **Failure trigger:** Named relationship không còn đủ measure để đọc, vận hành và hiểu mà không che focus.
- **Topology response:** Odontogram matrix stays primary; state-transition editor and longitudinal history become synchronized alternate panes without losing tooth/surface address
- **Navigation replacement:** Labeled stage hoặc drawer mở đúng supporting region và giữ query, selection, draft, scroll cùng return-focus target.
- **Sticky boundary:** Chỉ current scope hoặc primary action được persist khi đã reserve space; short-height đưa nó về normal flow.
- **Overflow owner:** `fixed-tooth-by-surface-semantic-matrix` owns bounded two-axis navigation; compact replaces it with addressed paths.

### Compact

- **Failure trigger:** Named relationship không còn đủ measure để đọc, vận hành và hiểu mà không che focus.
- **Topology response:** Dentition/quadrant → keyboard-addressable tooth×surface grid → current finite state → planned/performed/superseded transition → history → sign; it never shrinks a mouth canvas
- **Navigation replacement:** Labeled stage hoặc drawer mở đúng supporting region và giữ query, selection, draft, scroll cùng return-focus target.
- **Sticky boundary:** Chỉ current scope hoặc primary action được persist khi đã reserve space; short-height đưa nó về normal flow.
- **Overflow owner:** `fixed-tooth-by-surface-semantic-matrix` owns bounded two-axis navigation; compact replaces it with addressed paths.

### Reflow

- DOM order, reading order và meaningful focus order là `dental-chart → dentition-and-notation-context → fixed-tooth-by-surface-semantic-matrix → selected-tooth-finite-state-ledger → planned-procedure-layer → performed-or-superseded-transition-layer → notation-and-state-consistency-gate → signed-chart-snapshot`; CSS không reorder semantics.
- Long label, translation, 400% zoom và enlarged text wrap mà không mất action hoặc state meaning.
- Dialog, drawer hoặc sheet focus heading, giữ focus khi modal, hỗ trợ Escape/Cancel và trả đúng trigger với work context.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action; drag hoặc gesture luôn có button hay keyboard equivalent.
- Topology change không reset work state, duplicate pending action hoặc đổi owner.
- Dynamic status dùng text và semantics ngoài color, rồi announce mà không giật focus.
- Validation giữ input, có inline error, focus summary cho nhiều error và cung cấp recovery cụ thể.
- Task parity bao gồm dentition primary/mixed/permanent, tooth present/missing/unerupted, surface sound/pathology/restored, procedure planned/performed/superseded, transition permitted/contradictory, notation compatible/invalid, history loading/conflicted and snapshot unsigned/signing/signed/amended.

## State obligations

Task-specific states: dentition primary/mixed/permanent, tooth present/missing/unerupted, surface sound/pathology/restored, procedure planned/performed/superseded, transition permitted/contradictory, notation compatible/invalid, history loading/conflicted and snapshot unsigned/signing/signed/amended.

| State family | Behavior bắt buộc |
|---|---|
| Initial / loading | Name loading scope, reserve primary region và chỉ block failed region. |
| Ready | Expose current object, owner relationship và valid action bằng text/semantics. |
| Empty / not-applicable | Phân biệt true empty, no-match và non-applicable cùng next action thích hợp. |
| Error / retry | Name failed scope, giữ input/work state và đưa focus đến retry/correction target. |
| Permission / unavailable | Giải thích restriction bằng text; read-only khác disabled và giữ context. |
| Pending | Ngăn duplicate, giữ context, cho Cancel khi an toàn và announce progress. |
| Success | Xác nhận exact changed scope, cập nhật summary liên quan và giữ Undo/next step khi cần. |
| Stale / conflict | So sánh local/external state, không overwrite im lặng và giữ deterministic recovery. |
| Focus transition | User-triggered stage change focus new heading; status-only update không move focus; modal trả trigger. |
| Responsive presentation | Wide giữ simultaneity; intermediate làm support thấp nhất temporary; compact dùng một primary stage với parity. |

## Boundaries

### Accept

- Template must select any tooth/surface without pointer input, distinguish clinical states without color alone, reject an impossible transition or incompatible notation, preserve history through compact reflow and sign an immutable chart snapshot
- Chỉ accept variation khi dominant task, required region, relationship, transformation và completion event không đổi.

### Reject

- Reject cho `media-annotation-workbench`, `canvas-inspector-studio`, image markup, spreadsheet or generic record form; non-visual tooth/surface addressing, mutually exclusive finite states and validated planned→performed→superseded transitions are mandatory
- Reject khi adjacent archetype sở hữu work object hoặc completion event chính xác hơn.

### Boundary verdict

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-OTC-90`, `91` hoặc `92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, owner relationship, overflow owner hoặc completion consequence.

## Handoff

1. Business truth cung cấp actor, object, rule, permission, state transition và completion consequence.
2. Archetype này resolve dominant task, region graph, responsive replacement, semantic order và parity.
3. Grammar bind product-semantic owner vào region/state mà không đổi topology.
4. Principles resolve exact grid, measure, gap, size, alignment, overflow và content-fit breakpoint.
5. Direction biểu đạt visual character bên trong owner đã accept.

## Non-binding research evidence

### Evidence boundary

Research dưới đây là advisory evidence, không phải product truth. Nó không cho phép copy geometry, component tree, product noun, breakpoint hoặc visual treatment; mọi binding claim vẫn route qua business truth, Grammar và Principles.

### Sources

| Source | Hỗ trợ | Không chứng minh |
|---|---|---|
| [ADA Universal Tooth Designation System](https://www.ada.org/-/media/project/ada-organization/ada/ada-org/files/publications/cdt/universal_tooth_designation_system_valueset_2.pdf) | Cung cấp evidence official về dentition and notation context. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |
| [HL7 Dental Data Exchange](https://hl7.org/fhir/us/dental-data-exchange/) | Cung cấp evidence official về fixed tooth by surface semantic matrix. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |
| [ISO 3950](https://www.iso.org/standard/68292.html) | Cung cấp evidence official về selected tooth finite state ledger. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |
| [W3C Grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Cung cấp evidence official về keyboard, focus, reflow, or status behavior. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |

## Output

| Trường | Hợp đồng |
|---|---|
| `archetypeId` | Fixed value `odontogram-treatment-charting-workbench`. |
| `situationCodes` | Matched code từ record này. |
| `searchAliases` | Routed alias dẫn đến match. |
| `dominantTask` | Một câu task trung lập sản phẩm. |
| `regions` | Ordered required region ID. |
| `regionRelationships` | Owner, peer, supporting, temporary và downstream relationship. |
| `responsive` | `wide`, `intermediate`, `compact`, `reflow`, `readingOrder`, `navigationReplacement`, `stickyBehavior`, `overflowOwner`, `interactionParity`. |
| `stateObligations` | Applicable task-specific và common state family. |
| `boundaryVerdict` | `accept`, `reject`, or `needs-evidence`, with reason. |
| `grammarHandoff` | Product-semantic region/state owner để lại cho Grammar. |
| `principlesHandoff` | Exact geometry, fit threshold và emitted layout để lại cho Principles. |
| `confidence` | `high`, `medium`, or `low`, with evidence completeness. |
| `evidence` | Business/current-source/research evidence class không invented fact. |

```json
{"archetypeId":"odontogram-treatment-charting-workbench","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
