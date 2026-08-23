# Print proof preflight review

## LOADS

None.

## Record

### Identity

| Trường | Giá trị |
|---|---|
| Archetype ID | `print-proof-preflight-review` |
| Family | Detail |
| Dominant task | Kiểm artifact sẵn sàng in theo constraint sản xuất xác định, định vị từng lỗi trên proof, repair hoặc waive bằng evidence, rồi gate release. |
| Search aliases | print proof, preflight gate, production issue location |
| Authority | Authority topology page trung lập sản phẩm; archetype không chọn product semantic, visual direction, token, component, exact geometry hoặc breakpoint. |

### Invariants

- `preflight-review` sở hữu dominant task hoàn chỉnh và recovery boundary.
- Kiểm artifact sẵn sàng in theo constraint sản xuất xác định, định vị từng lỗi trên proof, repair hoặc waive bằng evidence, rồi gate release.
- Mỗi required region giữ named owner và relationship; Grammar chỉ bind product-semantic owner.
- Wide, intermediate và compact đổi topology khi named relationship fail, không theo device label.
- Transformation giữ selection, draft, pending, error, recovery, reading order và focus meaning.

## Recognition

### Situation codes

| Code | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `AR-PPR-01` | Kiểm artifact sẵn sàng in theo constraint sản xuất xác định, định vị từng lỗi trên proof, repair hoặc waive bằng evidence, rồi gate release. | Positive evidence bắt buộc. |
| `AR-PPR-02` | Tất cả required region và relationship trong graph đều cần để hoàn tất task. | Yêu cầu complete graph. |
| `AR-PPR-03` | Work state phải sống qua ba named topology response. | Yêu cầu responsive parity. |
| `AR-PPR-04` | Pending, error, permission, stale hoặc conflict có thể xuất hiện sau khi tạo work state. | Yêu cầu recovery không mất input hoặc focus meaning. |
| `AR-PPR-90` | Dominant task thuộc adjacent archetype nêu trong hard rejection. | Reject. |
| `AR-PPR-91` | Reject cho evidence dossier, media annotation, generic document preview, print imposition or human QA checklist; machine-evaluable production constraints, failures located on the exact output page/region, correction rerun and binary release block are mandatory—no claim/evidence adjudication owns acceptance | Reject. |
| `AR-PPR-92` | Candidate chỉ khác product noun, density, color, component, card count hoặc state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Chọn `print-proof-preflight-review` khi và chỉ khi `AR-PPR-01`–`04` được evidence, mọi required region/relationship hiện diện và không có `AR-PPR-90`–`92` hiện diện. Trả `needs-evidence` khi dominant task, owner, overflow owner hoặc completion consequence chưa được chứng minh; trả `reject` khi có rejection code.

## Region graph

```text
preflight-review
├─ job-and-output-profile
├─ proof-page-navigator
├─ rendered-proof-stage (peer synchronization)
├─ issue-ledger
├─ selected-issue-location-and-rule
├─ repair-or-waiver
└─ release-gate-and-report
```

### Region obligations

| Region | Owner và relationship bắt buộc |
|---|---|
| `preflight-review` | Sở hữu dominant task, complete state và recovery boundary của print-proof-preflight-review. |
| `job-and-output-profile` | Sở hữu job and output profile; giữ relationship bắt buộc với upstream `preflight-review` and downstream `proof-page-navigator` và không nhận owner từ vùng khác. |
| `proof-page-navigator` | Sở hữu proof page navigator; giữ relationship bắt buộc với upstream `job-and-output-profile` and downstream `rendered-proof-stage` và không nhận owner từ vùng khác. |
| `rendered-proof-stage` | Sở hữu rendered proof stage; giữ relationship bắt buộc với upstream `proof-page-navigator` and downstream `issue-ledger` và không nhận owner từ vùng khác. |
| `issue-ledger` | Sở hữu issue ledger; giữ relationship bắt buộc với upstream `rendered-proof-stage` and downstream `selected-issue-location-and-rule` và không nhận owner từ vùng khác. |
| `selected-issue-location-and-rule` | Sở hữu selected issue location and rule; giữ relationship bắt buộc với upstream `issue-ledger` and downstream `repair-or-waiver` và không nhận owner từ vùng khác. |
| `repair-or-waiver` | Sở hữu repair or waiver; giữ relationship bắt buộc với upstream `selected-issue-location-and-rule` and downstream `release-gate-and-report` và không nhận owner từ vùng khác. |
| `release-gate-and-report` | Sở hữu release gate and report; giữ relationship bắt buộc với upstream `repair-or-waiver` và không nhận owner từ vùng khác. |

## Responsive contract

### Wide

- **Failure trigger:** Named relationship không còn đủ measure để đọc, vận hành và hiểu mà không che focus.
- **Topology response:** Page navigator, proof, issue ledger and selected rule evidence coexist
- **Navigation replacement:** Không có; direct region access vẫn fit.
- **Sticky boundary:** Chỉ current scope hoặc primary action được persist khi đã reserve space; short-height đưa nó về normal flow.
- **Overflow owner:** `rendered-proof-stage` owns optional bounded proof zoom; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** Named relationship không còn đủ measure để đọc, vận hành và hiểu mà không che focus.
- **Topology response:** Page navigator becomes a drawer while proof and active issue remain side by side; the release gate stays adjacent
- **Navigation replacement:** Labeled stage hoặc drawer mở đúng supporting region và giữ query, selection, draft, scroll cùng return-focus target.
- **Sticky boundary:** Chỉ current scope hoặc primary action được persist khi đã reserve space; short-height đưa nó về normal flow.
- **Overflow owner:** `rendered-proof-stage` owns optional bounded proof zoom; the page owns no horizontal overflow.

### Compact

- **Failure trigger:** Named relationship không còn đủ measure để đọc, vận hành và hiểu mà không che focus.
- **Topology response:** Issue-first queue → affected proof excerpt → rule and repair → next issue → release summary; full-page proof is an optional zoomed region with bounded overflow
- **Navigation replacement:** Labeled stage hoặc drawer mở đúng supporting region và giữ query, selection, draft, scroll cùng return-focus target.
- **Sticky boundary:** Chỉ current scope hoặc primary action được persist khi đã reserve space; short-height đưa nó về normal flow.
- **Overflow owner:** `rendered-proof-stage` owns optional bounded proof zoom; the page owns no horizontal overflow.

### Reflow

- DOM order, reading order và meaningful focus order là `preflight-review → job-and-output-profile → proof-page-navigator → rendered-proof-stage → issue-ledger → selected-issue-location-and-rule → repair-or-waiver → release-gate-and-report`; CSS không reorder semantics.
- Long label, translation, 400% zoom và enlarged text wrap mà không mất action hoặc state meaning.
- Dialog, drawer hoặc sheet focus heading, giữ focus khi modal, hỗ trợ Escape/Cancel và trả đúng trigger với work context.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action; drag hoặc gesture luôn có button hay keyboard equivalent.
- Topology change không reset work state, duplicate pending action hoặc đổi owner.
- Dynamic status dùng text và semantics ngoài color, rồi announce mà không giật focus.
- Validation giữ input, có inline error, focus summary cho nhiều error và cung cấp recovery cụ thể.
- Task parity bao gồm proof rendering, no pages, issue open/fixed/waived, font/image/color/profile failure, stale proof after repair, waiver unauthorized, release blocked/ready and report export.

## State obligations

Task-specific states: proof rendering, no pages, issue open/fixed/waived, font/image/color/profile failure, stale proof after repair, waiver unauthorized, release blocked/ready and report export.

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

- Template must select an issue from the ledger, reveal its exact proof location and rule, demonstrate repair versus authorized waiver and keep release blocked until all blockers resolve
- Chỉ accept variation khi dominant task, required region, relationship, transformation và completion event không đổi.

### Reject

- Reject cho evidence dossier, media annotation, generic document preview, print imposition or human QA checklist; machine-evaluable production constraints, failures located on the exact output page/region, correction rerun and binary release block are mandatory—no claim/evidence adjudication owns acceptance
- Reject khi adjacent archetype sở hữu work object hoặc completion event chính xác hơn.

### Boundary verdict

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-PPR-90`, `91` hoặc `92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, owner relationship, overflow owner hoặc completion consequence.

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
| [Adobe Acrobat preflight reports](https://helpx.adobe.com/acrobat/using/preflight-reports-acrobat-pro.html) | Cung cấp evidence official về job and output profile. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |
| [PDF Association PDF/X](https://pdfa.org/resource/iso-15930-pdfx/) | Cung cấp evidence official về proof page navigator. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |
| [W3C complex images](https://www.w3.org/WAI/tutorials/images/complex/) | Cung cấp evidence official về keyboard, focus, reflow, or status behavior. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |

## Output

| Trường | Hợp đồng |
|---|---|
| `archetypeId` | Fixed value `print-proof-preflight-review`. |
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
{"archetypeId":"print-proof-preflight-review","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
