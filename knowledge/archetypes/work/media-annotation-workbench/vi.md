# Media annotation workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `media-annotation-workbench` |
| Family | Work |
| Dominant task | Review media và tạo/chỉnh annotation gắn timestamp, range hoặc spatial region trong khi giữ playback position. |
| Search aliases | annotation theo time, label media, editor playback marker, review range |
| Authority | Authority topology page trung lập sản phẩm; archetype không chọn product semantic, visual direction, token, component, exact geometry hoặc breakpoint. |

### Invariants

- `annotation-workbench` owns the complete dominant task and its recovery boundary.
- Review media và tạo/chỉnh annotation gắn timestamp, range hoặc spatial region trong khi giữ playback position.
- Mọi required region giữ đúng owner và relationship; Grammar chỉ bind product-semantic owner.
- Topology wide/intermediate/compact đổi khi named relationship fail, không theo device label.
- Responsive transformation giữ selection, draft, cursor, pending, error, recovery, reading order và focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-MAW-01` | Review media và tạo/chỉnh annotation gắn timestamp, range hoặc spatial region trong khi giữ playback position. | Bằng chứng positive bắt buộc. |
| `AR-MAW-02` | Tất cả required region và relationship được batch nêu đều cần để hoàn tất task. | Yêu cầu đầy đủ region graph. |
| `AR-MAW-03` | Named simultaneous relationship fail ở intermediate hoặc compact nhưng work state phải sống qua transformation. | Yêu cầu đúng ba topology response. |
| `AR-MAW-04` | Pending, error, conflict hoặc stale state có thể xảy ra sau khi user tạo work state. | Yêu cầu recovery không mất input hoặc focus meaning. |
| `AR-MAW-90` | Task thực tế do media playback hoặc multi-track composition sở hữu. | Reject. |
| `AR-MAW-91` | Reject media queue thụ động, gallery metadata asset, document comment, audit timeline và multi-track composition đổi rendered output. | Reject. |
| `AR-MAW-92` | Candidate chỉ khác product noun, density, color, component, card count hoặc state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Chọn `media-annotation-workbench` khi và chỉ khi `AR-MAW-01` đến `AR-MAW-04` được evidence, toàn bộ required region/relationship hiện diện và không có `AR-MAW-90` đến `AR-MAW-92`. Trả `needs-evidence` khi dominant task, một owner, overflow owner hoặc completion consequence chưa được chứng minh; trả `reject` khi có rejection code.

## Region graph

```text
annotation-workbench
├─ media-stage
├─ transport-and-timecode
├─ annotation-track-or-list
├─ active-annotation-editor
├─ labels-or-schema
└─ review-and-export
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `annotation-workbench` | Sở hữu một media cursor, annotation set, schema và review/export boundary. |
| `media-stage` | Trình bày frame/region hiện tại và phản ánh selected annotation mà không sở hữu metadata form. |
| `transport-and-timecode` | Sở hữu play, pause, seek, exact time và marker navigation không cần drag. |
| `annotation-track-or-list` | Sở hữu marker identity theo time/space, selection, timeline overflow giới hạn và overlap cue. |
| `active-annotation-editor` | Chỉnh bound, label, note và validation của selected annotation trong khi giữ cursor. |
| `labels-or-schema` | Giới hạn label cho phép và giải thích schema unavailable/changed. |
| `review-and-export` | Sở hữu completeness review, autosave conflict, export pending/error và recovery. |

## Responsive contract

### Wide

- **Failure trigger:** Các region cần đồng hiện vẫn có đủ measure để đọc, thao tác và hiểu relationship.
- **Topology response:** Giữ media stage, annotation track/list và editor đồng hiện; highlight đúng media range/region đã chọn.
- **Navigation replacement:** Không có; direct region access vẫn fit.
- **Sticky boundary:** Chỉ action/status gắn current work object được sticky, phải reserve space và không che focus.
- **Overflow owner:** Chỉ `annotation-track-or-list` sở hữu timeline overflow ngang giới hạn; media và page không sở hữu.

### Intermediate

- **Failure trigger:** Support region ưu tiên thấp nhất bắt đầu squeeze primary work, label hoặc action.
- **Topology response:** Làm annotation editor collapsible; giữ stage và track primary; đưa label/schema vào temporary surface với issue summary bên ngoài.
- **Navigation replacement:** Trigger có label mở đúng temporary pane/disclosure và giữ query, selection, draft, cursor cùng return-focus target.
- **Sticky boundary:** Current scope và pending/error summary có thể persistent nhưng yield khi chiều cao không đủ.
- **Overflow owner:** Chỉ `annotation-track-or-list` sở hữu timeline overflow ngang giới hạn; media và page không sở hữu.

### Compact

- **Failure trigger:** Hai work region không thể đồng hiện với đủ measure, target 44px và focus không bị che.
- **Topology response:** Giữ media stage cùng current annotation sequence; mở list/editor thành sheet/stage và có previous/next marker thay precision-only dragging.
- **Navigation replacement:** Stage/tab/sheet có tên thay direct simultaneity; Back restore exact filter, scroll, selection, draft, cursor và trigger focus.
- **Sticky boundary:** Primary action chỉ sticky khi reserve space, không che focus và trở về normal flow ở short height.
- **Overflow owner:** Chỉ `annotation-track-or-list` sở hữu timeline overflow ngang giới hạn; media và page không sở hữu.

### Reflow

- DOM order, reading order, and meaningful focus order are `annotation-workbench → media-stage → transport-and-timecode → annotation-track-or-list → active-annotation-editor → labels-or-schema → review-and-export`; CSS never reorders semantics.
- Long label, bản dịch, zoom 400% và enlarged text wrap mà không mất action hoặc state meaning.
- Dialog/drawer/sheet focus heading, contain focus khi modal, hỗ trợ Escape/Cancel và return đúng trigger cùng work context.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action; drag/gesture luôn có button hoặc keyboard equivalent.
- Topology change không reset work state, không duplicate pending action và không đổi owner.
- Dynamic status dùng text+semantics ngoài color và announce mà không steal focus.
- Validation giữ input, hiện inline error, focus summary khi nhiều lỗi và cung cấp recovery cụ thể.
- Parity cụ thể gồm media loading/error, play/pause/seek, annotation none/selected/draft/invalid, range overlap, label unavailable, autosave pending/conflict, export pending/error và permission/read-only.

## State obligations

Task-specific states: media loading/error, play/pause/seek, annotation none/selected/draft/invalid, range overlap, label unavailable, autosave pending/conflict, export pending/error và permission/read-only.

| State family | Required behavior |
|---|---|
| Initial / loading | Nêu loading scope, reserve primary region và chỉ block region lỗi. |
| Ready | Hiện current object, selection/cursor, owner relationship và valid action bằng text+semantics. |
| Empty / not-applicable | Phân biệt true empty, filter no-match và non-applicable, kèm next action phù hợp. |
| Error / retry | Nêu failed scope, giữ input/work state và cung cấp retry/correction target có focus. |
| Permission / unavailable | Giải thích restriction bằng text; read-only khác disabled và giữ context để hiểu. |
| Pending | Ngăn duplicate, giữ context, expose Cancel khi an toàn và announce progress không steal focus. |
| Success | Xác nhận exact changed scope, cập nhật summary liên quan và giữ Undo/next step khi cần. |
| Stale / conflict | So sánh local/external state, không overwrite âm thầm và giữ deterministic recovery. |
| Focus transition | User-triggered stage change focus heading mới; status-only update không move focus; modal return trigger. |
| Responsive presentation | Wide giữ simultaneity cần thiết; intermediate tạm hóa support thấp nhất; compact dùng primary stage nhưng giữ action/state/recovery. |

## Boundaries

### Accept

- Annotation identity gắn với media time/range/region và một cursor phối hợp playback, list selection và editing.
- Chỉ accept variation khi dominant task, required regions, relationships, transformations và completion event không đổi.

### Reject

- Reject media queue thụ động, gallery metadata asset, document comment, audit timeline và multi-track composition đổi rendered output.
- Reject khi media playback hoặc multi-track composition sở hữu work object hoặc completion event chính xác hơn.

### Boundary verdict

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-MAW-90`, `AR-MAW-91` hoặc `AR-MAW-92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, owner relationship, overflow owner hoặc completion consequence.

## Handoff

1. Business truth cung cấp actor, object, rule, permission, state transition và completion consequence.
2. Archetype này resolve dominant task, region graph, responsive replacement, semantic order và parity.
3. Grammar bind product-semantic owner cho region/state mà không đổi topology.
4. Principles resolve exact grid, measure, gap, size, alignment, overflow và content-fit breakpoint.
5. Direction thể hiện visual character trong các owner đã accept.

## Non-binding research evidence

### Evidence boundary

Research dưới đây là advisory evidence, không phải product truth. Nó không cấp quyền copy geometry, component tree, product noun, breakpoint hoặc visual treatment; mọi binding claim vẫn route qua business truth, Grammar và Principles.

### Sources

| Source | Nguồn hỗ trợ | Nguồn không chứng minh |
|---|---|---|
| [Audacity label tracks](https://manual.audacityteam.org/man/label_tracks.html) | Labels can bind text to points or ranges on a media timeline and support keyboard creation/editing. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [Adobe Spectrum components](https://spectrum.adobe.com/page/components/) | Editor control hiện state có label, validation và contextual action. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [Microsoft Fluent 2 layout](https://fluent2.microsoft.design/layout) | Primary và supporting region thích nghi khi content đồng hiện không còn fit. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [W3C APG grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Widget composite hai trục cần keyboard navigation có quản lý và edit mode rõ. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [W3C Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Pending, success, error và live change được announce mà không move focus. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `media-annotation-workbench`. |
| `situationCodes` | Matched codes from this record. |
| `searchAliases` | Routed aliases that led to the match. |
| `dominantTask` | One product-neutral task sentence. |
| `regions` | Ordered required region IDs. |
| `regionRelationships` | Owner, peer, supporting, temporary, and downstream relationships. |
| `responsive` | `wide`, `intermediate`, `compact`, `reflow`, `readingOrder`, `navigationReplacement`, `stickyBehavior`, `overflowOwner`, and `interactionParity`. |
| `stateObligations` | Applicable task-specific and common state families. |
| `boundaryVerdict` | `accept`, `reject`, or `needs-evidence`, with reason. |
| `grammarHandoff` | Product-semantic region and state owners left to Grammar. |
| `principlesHandoff` | Exact geometry, fit thresholds, and emitted layout left to Principles. |
| `confidence` | `high`, `medium`, or `low`, with evidence completeness. |
| `evidence` | Business/current-source/research evidence classes without invented facts. |

```json
{
  "archetypeId": "media-annotation-workbench",
  "situationCodes": [],
  "searchAliases": [],
  "dominantTask": "",
  "regions": [],
  "regionRelationships": [],
  "responsive": {
    "wide": "", "intermediate": "", "compact": "", "reflow": "",
    "readingOrder": "", "navigationReplacement": "", "stickyBehavior": "",
    "overflowOwner": "", "interactionParity": ""
  },
  "stateObligations": [],
  "boundaryVerdict": "needs-evidence",
  "grammarHandoff": [],
  "principlesHandoff": [],
  "confidence": "low",
  "evidence": []
}
```
