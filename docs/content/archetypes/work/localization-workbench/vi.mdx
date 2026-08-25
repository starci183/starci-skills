# Localization workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `localization-workbench` |
| Family | Work |
| Dominant task | Dịch và review nhiều source segment sang target locale trong khi giữ context, placeholder, workflow status và quality evidence. |
| Search aliases | segment dịch, locale QA, validate placeholder, review thuật ngữ |
| Authority | Authority topology page trung lập sản phẩm; archetype không chọn product semantic, visual direction, token, component, exact geometry hoặc breakpoint. |

### Invariants

- `localization-workbench` owns the complete dominant task and its recovery boundary.
- Dịch và review nhiều source segment sang target locale trong khi giữ context, placeholder, workflow status và quality evidence.
- Mọi required region giữ đúng owner và relationship; Grammar chỉ bind product-semantic owner.
- Topology wide/intermediate/compact đổi khi named relationship fail, không theo device label.
- Responsive transformation giữ selection, draft, cursor, pending, error, recovery, reading order và focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-LWB-01` | Dịch và review nhiều source segment sang target locale trong khi giữ context, placeholder, workflow status và quality evidence. | Bằng chứng positive bắt buộc. |
| `AR-LWB-02` | Tất cả required region và relationship được batch nêu đều cần để hoàn tất task. | Yêu cầu đầy đủ region graph. |
| `AR-LWB-03` | Named simultaneous relationship fail ở intermediate hoặc compact nhưng work state phải sống qua transformation. | Yêu cầu đúng ba topology response. |
| `AR-LWB-04` | Pending, error, conflict hoặc stale state có thể xảy ra sau khi user tạo work state. | Yêu cầu recovery không mất input hoặc focus meaning. |
| `AR-LWB-90` | Task thực tế do spreadsheet editing hoặc reconciliation diff sở hữu. | Reject. |
| `AR-LWB-91` | Reject spreadsheet row chung, two-version merge diff, document authoring và form một ngôn ngữ không có segment/placeholder semantics. | Reject. |
| `AR-LWB-92` | Candidate chỉ khác product noun, density, color, component, card count hoặc state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Chọn `localization-workbench` khi và chỉ khi `AR-LWB-01` đến `AR-LWB-04` được evidence, toàn bộ required region/relationship hiện diện và không có `AR-LWB-90` đến `AR-LWB-92`. Trả `needs-evidence` khi dominant task, một owner, overflow owner hoặc completion consequence chưa được chứng minh; trả `reject` khi có rejection code.

## Region graph

```text
localization-workbench
├─ project-locale-and-progress
├─ segment-queue
├─ source-context
├─ target-editor
├─ terminology-and-placeholder-support
├─ quality-issues
└─ save-and-submit
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `localization-workbench` | Sở hữu một cặp source-target locale, segment draft set, QA state và submission boundary. |
| `project-locale-and-progress` | Nêu source/target locale, progress denominator, role và freshness. |
| `segment-queue` | Sở hữu segment order, status, filtering, selection và next/previous navigation. |
| `source-context` | Cung cấp source segment bất biến và surrounding usage context. |
| `target-editor` | Sở hữu target draft, autosave, review state, conflict và current focus. |
| `terminology-and-placeholder-support` | So sánh placeholder bắt buộc và cung cấp terminology evidence không binding. |
| `quality-issues` | Sở hữu missing placeholder, length, stale-source và review issue link đúng target span. |
| `save-and-submit` | Sở hữu pending protection, locked state, submission completeness, success và retry. |

## Responsive contract

### Wide

- **Failure trigger:** Các region cần đồng hiện vẫn có đủ measure để đọc, thao tác và hiểu relationship.
- **Topology response:** Giữ segment queue, source/target editing theo cặp và terminology/QA support đồng hiện; source và target ở cùng segment context.
- **Navigation replacement:** Không có; direct region access vẫn fit.
- **Sticky boundary:** Chỉ action/status gắn current work object được sticky, phải reserve space và không che focus.
- **Overflow owner:** Segment/issue list cuộn dọc trong active stage; placeholder wrap và page không cuộn ngang.

### Intermediate

- **Failure trigger:** Support region ưu tiên thấp nhất bắt đầu squeeze primary work, label hoặc action.
- **Topology response:** Collapse queue; giữ source và target visible; biến terminology/QA thành drawer trong khi issue summary ở ngoài.
- **Navigation replacement:** Trigger có label mở đúng temporary pane/disclosure và giữ query, selection, draft, cursor cùng return-focus target.
- **Sticky boundary:** Current scope và pending/error summary có thể persistent nhưng yield khi chiều cao không đủ.
- **Overflow owner:** Segment/issue list cuộn dọc trong active stage; placeholder wrap và page không cuộn ngang.

### Compact

- **Failure trigger:** Hai work region không thể đồng hiện với đủ measure, target 44px và focus không bị che.
- **Topology response:** Dùng stage từng segment với source ngay trước target; mở queue/progress và terminology/issue thành sheet; previous/next giữ draft và review state.
- **Navigation replacement:** Stage/tab/sheet có tên thay direct simultaneity; Back restore exact filter, scroll, selection, draft, cursor và trigger focus.
- **Sticky boundary:** Primary action chỉ sticky khi reserve space, không che focus và trở về normal flow ở short height.
- **Overflow owner:** Segment/issue list cuộn dọc trong active stage; placeholder wrap và page không cuộn ngang.

### Reflow

- DOM order, reading order, and meaningful focus order are `localization-workbench → project-locale-and-progress → segment-queue → source-context → target-editor → terminology-and-placeholder-support → quality-issues → save-and-submit`; CSS never reorders semantics.
- Long label, bản dịch, zoom 400% và enlarged text wrap mà không mất action hoặc state meaning.
- Dialog/drawer/sheet focus heading, contain focus khi modal, hỗ trợ Escape/Cancel và return đúng trigger cùng work context.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action; drag/gesture luôn có button hoặc keyboard equivalent.
- Topology change không reset work state, không duplicate pending action và không đổi owner.
- Dynamic status dùng text+semantics ngoài color và announce mà không steal focus.
- Validation giữ input, hiện inline error, focus summary khi nhiều lỗi và cung cấp recovery cụ thể.
- Parity cụ thể gồm project/segment loading, untranslated/draft/reviewed/approved, autosave pending/error, issue placeholder/length, terminology suggestion, source changed/target stale, conflict, segment locked và submit success.

## State obligations

Task-specific states: project/segment loading, untranslated/draft/reviewed/approved, autosave pending/error, issue placeholder/length, terminology suggestion, source changed/target stale, conflict, segment locked và submit success.

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

- Nhiều source-target segment chia sẻ locale, status, placeholder, terminology và QA semantics.
- Chỉ accept variation khi dominant task, required regions, relationships, transformations và completion event không đổi.

### Reject

- Reject spreadsheet row chung, two-version merge diff, document authoring và form một ngôn ngữ không có segment/placeholder semantics.
- Reject khi spreadsheet editing hoặc reconciliation diff sở hữu work object hoặc completion event chính xác hơn.

### Boundary verdict

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-LWB-90`, `AR-LWB-91` hoặc `AR-LWB-92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, owner relationship, overflow owner hoặc completion consequence.

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
| [Unicode ICU message formatting](https://unicode-org.github.io/icu/userguide/format_parse/messages/) | Translatable messages preserve variable placeholders and grammatical context as one unit. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [IBM Carbon data table](https://carbondesignsystem.com/components/data-table/usage/) | Quét quan hệ, selection, sorting, expansion và action vẫn do table sở hữu. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [Adobe Spectrum components](https://spectrum.adobe.com/page/components/) | Editor control hiện state có label, validation và contextual action. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [W3C Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Information và function sống qua chiều rộng hẹp mà không page-level scroll hai trục. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |
| [W3C Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Pending, success, error và live change được announce mà không move focus. | Nguồn không quyết định product fact, exact geometry, breakpoint hoặc component tree cho archetype này. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `localization-workbench`. |
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
  "archetypeId": "localization-workbench",
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
