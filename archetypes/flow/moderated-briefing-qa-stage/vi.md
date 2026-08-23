# Moderated briefing qa stage

## LOADS

None.

## Record

### Identity

| Trường | Giá trị |
|---|---|
| Archetype ID | `moderated-briefing-qa-stage` |
| Family | Flow |
| Dominant task | Moderate câu hỏi audience quanh briefing live bằng triage submission, merge duplicate, route câu hỏi đã duyệt đến speaker và publish outcome đã trả lời. |
| Search aliases | moderated Q&A, speaker routing, question archive |
| Authority | Authority topology page trung lập sản phẩm; archetype không chọn product semantic, visual direction, token, component, exact geometry hoặc breakpoint. |

### Invariants

- `briefing-qa` sở hữu dominant task hoàn chỉnh và recovery boundary.
- Moderate câu hỏi audience quanh briefing live bằng triage submission, merge duplicate, route câu hỏi đã duyệt đến speaker và publish outcome đã trả lời.
- Mỗi required region giữ named owner và relationship; Grammar chỉ bind product-semantic owner.
- Wide, intermediate và compact đổi topology khi named relationship fail, không theo device label.
- Transformation giữ selection, draft, pending, error, recovery, reading order và focus meaning.

## Recognition

### Situation codes

| Code | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `AR-MBQ-01` | Moderate câu hỏi audience quanh briefing live bằng triage submission, merge duplicate, route câu hỏi đã duyệt đến speaker và publish outcome đã trả lời. | Positive evidence bắt buộc. |
| `AR-MBQ-02` | Tất cả required region và relationship trong graph đều cần để hoàn tất task. | Yêu cầu complete graph. |
| `AR-MBQ-03` | Work state phải sống qua ba named topology response. | Yêu cầu responsive parity. |
| `AR-MBQ-04` | Pending, error, permission, stale hoặc conflict có thể xuất hiện sau khi tạo work state. | Yêu cầu recovery không mất input hoặc focus meaning. |
| `AR-MBQ-90` | Dominant task thuộc adjacent archetype nêu trong hard rejection. | Reject. |
| `AR-MBQ-91` | Reject cho chat, facilitated meeting, media annotation or support inbox; question moderation, duplicate clustering, speaker routing and published answer lifecycle are mandatory | Reject. |
| `AR-MBQ-92` | Candidate chỉ khác product noun, density, color, component, card count hoặc state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Chọn `moderated-briefing-qa-stage` khi và chỉ khi `AR-MBQ-01`–`04` được evidence, mọi required region/relationship hiện diện và không có `AR-MBQ-90`–`92` hiện diện. Trả `needs-evidence` khi dominant task, owner, overflow owner hoặc completion consequence chưa được chứng minh; trả `reject` khi có rejection code.

## Region graph

```text
briefing-qa
├─ briefing-stage-and-topic
├─ incoming-question-queue
├─ moderation-and-duplicate-clusters
├─ approved-run-of-show
├─ speaker-routing-and-live-answer
└─ answered-published-archive
```

### Region obligations

| Region | Owner và relationship bắt buộc |
|---|---|
| `briefing-qa` | Sở hữu dominant task, complete state và recovery boundary của moderated-briefing-qa-stage. |
| `briefing-stage-and-topic` | Sở hữu briefing stage and topic; giữ relationship bắt buộc với upstream `briefing-qa` and downstream `incoming-question-queue` và không nhận owner từ vùng khác. |
| `incoming-question-queue` | Sở hữu incoming question queue; giữ relationship bắt buộc với upstream `briefing-stage-and-topic` and downstream `moderation-and-duplicate-clusters` và không nhận owner từ vùng khác. |
| `moderation-and-duplicate-clusters` | Sở hữu moderation and duplicate clusters; giữ relationship bắt buộc với upstream `incoming-question-queue` and downstream `approved-run-of-show` và không nhận owner từ vùng khác. |
| `approved-run-of-show` | Sở hữu approved run of show; giữ relationship bắt buộc với upstream `moderation-and-duplicate-clusters` and downstream `speaker-routing-and-live-answer` và không nhận owner từ vùng khác. |
| `speaker-routing-and-live-answer` | Sở hữu speaker routing and live answer; giữ relationship bắt buộc với upstream `approved-run-of-show` and downstream `answered-published-archive` và không nhận owner từ vùng khác. |
| `answered-published-archive` | Sở hữu answered published archive; giữ relationship bắt buộc với upstream `speaker-routing-and-live-answer` và không nhận owner từ vùng khác. |

## Responsive contract

### Wide

- **Failure trigger:** Named relationship không còn đủ measure để đọc, vận hành và hiểu mà không che focus.
- **Topology response:** Briefing stage, incoming queue, moderation detail and approved/run-of-show regions coexist
- **Navigation replacement:** Không có; direct region access vẫn fit.
- **Sticky boundary:** Chỉ current scope hoặc primary action được persist khi đã reserve space; short-height đưa nó về normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** Named relationship không còn đủ measure để đọc, vận hành và hiểu mà không che focus.
- **Topology response:** Stage and approved questions remain primary; incoming queue and moderation detail become drawers
- **Navigation replacement:** Labeled stage hoặc drawer mở đúng supporting region và giữ query, selection, draft, scroll cùng return-focus target.
- **Sticky boundary:** Chỉ current scope hoặc primary action được persist khi đã reserve space; short-height đưa nó về normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Compact

- **Failure trigger:** Named relationship không còn đủ measure để đọc, vận hành và hiểu mà không che focus.
- **Topology response:** Question queue → selected moderation decision → approved speaker route → live answer status → published outcome; stage context remains a compact persistent header
- **Navigation replacement:** Labeled stage hoặc drawer mở đúng supporting region và giữ query, selection, draft, scroll cùng return-focus target.
- **Sticky boundary:** Chỉ current scope hoặc primary action được persist khi đã reserve space; short-height đưa nó về normal flow.
- **Overflow owner:** Only an intrinsically tabular, board, graph, proof, or matrix region owns bounded overflow; the page owns no horizontal overflow.

### Reflow

- DOM order, reading order và meaningful focus order là `briefing-qa → briefing-stage-and-topic → incoming-question-queue → moderation-and-duplicate-clusters → approved-run-of-show → speaker-routing-and-live-answer → answered-published-archive`; CSS không reorder semantics.
- Long label, translation, 400% zoom và enlarged text wrap mà không mất action hoặc state meaning.
- Dialog, drawer hoặc sheet focus heading, giữ focus khi modal, hỗ trợ Escape/Cancel và trả đúng trigger với work context.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action; drag hoặc gesture luôn có button hay keyboard equivalent.
- Topology change không reset work state, duplicate pending action hoặc đổi owner.
- Dynamic status dùng text và semantics ngoài color, rồi announce mà không giật focus.
- Validation giữ input, có inline error, focus summary cho nhiều error và cung cấp recovery cụ thể.
- Task parity bao gồm briefing scheduled/live/ended, question pending/approved/rejected/merged, sensitive content flagged, speaker unavailable, queued/asked/answered, answer unpublished, moderation conflict and archive success.

## State obligations

Task-specific states: briefing scheduled/live/ended, question pending/approved/rejected/merged, sensitive content flagged, speaker unavailable, queued/asked/answered, answer unpublished, moderation conflict and archive success.

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

- Template must approve, merge and reject questions, route one to a speaker, announce live-answer transitions and publish the final answer without exposing rejected content
- Chỉ accept variation khi dominant task, required region, relationship, transformation và completion event không đổi.

### Reject

- Reject cho chat, facilitated meeting, media annotation or support inbox; question moderation, duplicate clustering, speaker routing and published answer lifecycle are mandatory
- Reject khi adjacent archetype sở hữu work object hoặc completion event chính xác hơn.

### Boundary verdict

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-MBQ-90`, `91` hoặc `92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, owner relationship, overflow owner hoặc completion consequence.

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
| [Microsoft Teams Q&A](https://support.microsoft.com/en-us/teams/meetings/q-a-in-microsoft-teams) | Cung cấp evidence official về briefing stage and topic. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |
| [Zoom Q&A controls](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0064385) | Cung cấp evidence official về incoming question queue. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |
| [W3C dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) | Cung cấp evidence official về keyboard, focus, reflow, or status behavior. | Không chứng minh product truth, exact geometry, breakpoint hoặc component. |

## Output

| Trường | Hợp đồng |
|---|---|
| `archetypeId` | Fixed value `moderated-briefing-qa-stage`. |
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
{"archetypeId":"moderated-briefing-qa-stage","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
