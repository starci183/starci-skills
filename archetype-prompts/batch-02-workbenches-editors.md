# Batch 02 — Workbenches and editors archetypes (19 prompts)

Tệp này là **một prompt batch tự chứa** cho các topology nơi user thao tác, biên tập, điều phối hoặc biến đổi work object. Khi chạy ở nơi khác, đưa toàn bộ tệp cho agent để tạo đủ 19 leaf. Nếu chỉ chạy một mục, phải đưa kèm toàn bộ phần từ `Cách chạy` đến `Nguồn research dùng chung`; không tách riêng block prompt khỏi hợp đồng chung.

## Mục lục

| # | Archetype ID | Câu hỏi bố cục chính |
|---:|---|---|
| 01 | `batch-table-operations` | Làm sao scan structured rows, chọn nhiều item và chạy bulk action mà vẫn giữ quan hệ cột? |
| 02 | `spreadsheet-grid-editor` | Làm sao edit cells, ranges và formulas trong một grid hai chiều mà compact vẫn làm được việc? |
| 03 | `permissions-matrix` | Làm sao chỉnh policy tại giao điểm actor–resource–capability mà vẫn hiểu inheritance và exceptions? |
| 04 | `pivot-drilldown-analytics` | Làm sao đặt câu hỏi trên aggregates rồi drill xuống evidence chi tiết? |
| 05 | `streaming-log-console` | Làm sao theo dõi event stream lớn và cô lập failure mà không mất live position? |
| 06 | `calendar-resource-scheduler` | Làm sao phân bổ resource vào time slots và giải quyết collision? |
| 07 | `kanban-swimlane-board` | Làm sao chuyển work items qua states và giữ WIP/swimlane context? |
| 08 | `multi-party-consensus-workbench` | Làm sao tổng hợp evidence, positions và objections thành một decision có quorum? |
| 09 | `reconciliation-diff-workbench` | Làm sao so hai nguồn, điều hướng differences và resolve từng conflict? |
| 10 | `canvas-inspector-studio` | Làm sao thao tác một spatial artifact và chỉnh properties của selection hiện tại? |
| 11 | `palette-canvas-properties-builder` | Làm sao lắp cấu trúc từ reusable blocks qua palette, canvas và properties? |
| 12 | `document-outline-editor` | Làm sao author long-form document với outline, formatting và anchored comments? |
| 13 | `media-annotation-workbench` | Làm sao gắn annotations vào time/range của media mà vẫn giữ playback context? |
| 14 | `query-builder-workbench` | Làm sao cấu tạo, chạy thử và sửa một query có clauses mà không biến nó thành search form? |
| 15 | `rule-builder-workbench` | Làm sao định nghĩa conditions–outcomes, kiểm tra coverage và hiểu rule precedence? |
| 16 | `workflow-automation-builder` | Làm sao tạo, nối và kiểm chứng một workflow nhiều bước/nhánh trước khi kích hoạt? |
| 17 | `localization-workbench` | Làm sao dịch nhiều segments trong context, xử lý status và bảo toàn placeholders? |
| 18 | `conversation-room` | Làm sao đọc và tiếp tục live thread trong khi giữ participants, pins và composer context? |
| 19 | `dual-list-transfer` | Làm sao chuyển items giữa available và selected sets với trạng thái hai phía rõ ràng? |

## Cách chạy

1. Trước mọi planning, source read hoặc write, đọc hết `.claude/INDEX.md` và tuân load order của Source đang chạy.
2. Thực thi **đúng 19 prompt** trong tệp này. Mỗi prompt tạo đúng bốn source artifact tại boundary đã ghi: `en.md`, `vi.md`, `context.md`, `template.html`.
3. Research bằng nguồn chính thức, hiện hành và tối thiểu ba tổ chức độc lập; luôn có ít nhất một nguồn accessibility. Các URL gợi ý chỉ là điểm bắt đầu: mở và kiểm chứng, thay nguồn đã deprecated, và thêm nguồn chính thức đặc thù cho task.
4. Synthesize dominant task, region graph và responsive transformation. Không copy visual UI, component tree, product nouns hoặc breakpoint của nguồn. Không viết như thể tên archetype tổng hợp này là thuật ngữ chính thức của một hãng.
5. Kiểm hard rejection trước khi viết. Nếu khác biệt chỉ là product noun, card count, density, color, component hoặc state của archetype khác, bỏ candidate và báo `duplicate-or-variation`; không cố hợp thức hóa một page type mới.
6. Không sửa `archetypes/context.md`, `.claude/INDEX.md`, `docs/content`, `docs/public/template-assets` hoặc source product trong batch này. Shared router được reconcile một lần sau khi các batch hoàn tất; Nextra assets là generated output.
7. Nếu leaf đã tồn tại, audit evidence và chỉ update đúng leaf đó; không xóa provenance hoặc overwrite thay đổi ngoài scope.
8. Cuối batch chạy source checks phù hợp, `npm run sync:content` và `npm run build` trong `.claude/docs`; chứng minh route `Template` được sinh tự động và bản public là byte-identical với source `template.html`.

## Hợp đồng artifact dùng chung — bắt buộc giữ nguyên

### Boundary và authority

- Leaf path: `archetypes/<family>/<archetype-id>/`.
- `archetype-id`, folder leaf, title metadata và `data-archetype-template` phải khớp tuyệt đối.
- Archetype chỉ sở hữu dominant task, required regions, quan hệ vùng, transformations `wide` / `intermediate` / `compact`, semantic order, interaction parity và state families.
- Grammar sở hữu semantic/product owners; Principles sở hữu exact grid, measure, gap, size, alignment, overflow và breakpoint còn chưa resolve; Direction sở hữu visual character. Không kéo trách nhiệm của ba tầng này vào archetype.
- Dùng thuật ngữ `wide`, `intermediate`, `compact`; breakpoint xảy ra khi một quan hệ được đặt tên không còn hoạt động, không theo device label.

### Cấu trúc Markdown thống nhất

`context.md` là runtime authority bằng English và phải giữ **đúng thứ tự heading** sau:

```text
# <Archetype title>
## LOADS
## Record
### Identity
### Invariants
## Recognition
### Situation codes
### Selection rule
## Region graph
### Region obligations
## Responsive contract
### Wide
### Intermediate
### Compact
### Reflow
### Interaction parity
## State obligations
## Boundaries
### Accept
### Reject
### Boundary verdict
## Handoff
## Non-binding research evidence
### Evidence boundary
### Sources
## Output
```

- `en.md` mirror `context.md` section-for-section bằng English; `vi.md` mirror cùng structure bằng Vietnamese. Không làm một ngôn ngữ thành bản tóm tắt của ngôn ngữ kia.
- `LOADS` là `None.` trừ khi có dependency thật được router cho phép.
- `Identity` luôn có table: Archetype ID, Family, Dominant task, Search aliases, Authority.
- Situation codes dùng một prefix duy nhất trong leaf; `01–89` là positive/conditional evidence, `90–99` là rejection evidence. Selection rule phải executable, không viết cảm tính.
- Region graph dùng ASCII tree với stable English region IDs. Bảng obligations phải giải thích owner và quan hệ của từng required region.
- Mỗi responsive band ghi failure trigger, topology response, navigation replacement, sticky boundary và overflow owner; `Reflow` ghi semantic/DOM order; `Interaction parity` chứng minh không mất action, state hoặc recovery.
- `State obligations` là matrix có ít nhất: initial/loading, ready, empty/not-applicable, error/retry, permission/unavailable, pending, success, stale/conflict khi phù hợp, focus transition và responsive presentation.
- `Sources` dùng link trực tiếp tới official page cùng ba cột `Source`, `What it supports`, `What it does not prove`. `Evidence boundary` nói rõ research không phải product truth và không tự cấp quyền copy geometry.
- `Output` trả đúng runtime fields của `archetypes/context.md`, gồm `archetypeId`, matched situation codes, aliases, dominant task, regions, relationships, responsive fields, state obligations, boundary verdict, Grammar handoff, Principles handoff, confidence và evidence classes.
- Văn phong: present tense, product-neutral, một normative claim mỗi bullet; không “modern/clean/intuitive”, không marketing copy, không component/class/token/breakpoint cụ thể trong authority text.

### `template.html` thống nhất và đồng bộ Nextra

- Source duy nhất: `archetypes/<family>/<archetype-id>/template.html`. Nextra sync phải copy byte-for-byte tới `docs/public/template-assets/archetypes/<family>/<archetype-id>/template.html` và tự tạo tab/route `Template`; không hand-edit generated copy.
- Bắt đầu chính xác bằng `<!doctype html>` và `<html lang="en" data-archetype-template="<exact-archetype-id>">`; có `meta charset="utf-8"` và viewport.
- Dùng closed CSP chính xác:

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; connect-src 'none'; font-src 'none'; media-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'">
```

- Tất cả CSS và JavaScript inline; không CDN, remote font/image/asset, URL/import, network API, storage dependency, external form action, inline `on*=` handler, `innerHTML`, `outerHTML` hoặc `insertAdjacentHTML`.
- Mọi template dùng cùng neutral preview shell: skip link → `header.template-header` (eyebrow `Archetype template`, title, one-sentence task) → `main#main.template-main` → `p#live-status.sr-only[role=status][aria-live=polite]`. Icon là inline SVG; emoji không làm structural icon.
- Mọi template khai báo cùng token names và default values dưới đây; local token bổ sung phải có prefix `--local-`:

```css
:root {
  color-scheme: light;
  --canvas: #f5f7fa; --surface: #ffffff; --surface-subtle: #edf2f7;
  --text: #17202a; --muted: #52606d; --border: #c7d0d9;
  --accent: #0b57d0; --accent-strong: #073b8c; --focus: #6d28d9;
  --success: #18794e; --warning: #8a4b08; --danger: #b42318;
  --radius: 0.75rem; --shadow: 0 0.5rem 1.5rem rgba(23, 32, 42, 0.12);
  --space-1: 0.25rem; --space-2: 0.5rem; --space-3: 0.75rem;
  --space-4: 1rem; --space-5: 1.5rem; --space-6: 2rem; --space-7: 3rem;
}
```

- Template là một conforming realization, không phải visual authority. Nó phải minh họa region graph, transformations và state families của leaf; demo data rõ ràng là fictional và product-neutral.
- Wide giữ các vùng cần nhìn đồng thời. Intermediate bỏ persistence của vùng ưu tiên thấp nhất. Compact tái kiến trúc dominant task thành một primary pane/sequence; không chỉ stack mọi desktop box.
- DOM order = reading order = meaningful focus order; CSS không reorder semantics. Không page-level horizontal scroll. Chỉ một bounded region được own overflow theo trục khi bản chất task là table, grid, board, timeline, canvas, code/log hoặc media rail.
- Body text tối thiểu 16px ở compact, readable measure, controls/touch targets ít nhất 44×44 CSS px, visible focus, body contrast tối thiểu 4.5:1, color không là tín hiệu duy nhất.
- Sticky/fixed surfaces reserve space, không che focus/content, và tự yield ở short-height. Dialog/drawer/sheet đưa focus vào, giữ focus khi modal, hỗ trợ Escape/cancel, rồi trả đúng trigger cùng query/selection/scroll context.
- Tương tác keyboard-complete và deterministic local-only. Forms có visible labels, autocomplete phù hợp, inline errors; multi-error submit có focusable error summary; pending ngăn duplicate; có success và recovery. Dynamic status được announce mà không giật focus.
- Có `@media (prefers-reduced-motion: reduce)`. Không animation thiết yếu, autoplay hoặc gesture/hover-only action.
- Verify ít nhất tại khoảng `375×812`, `768×900`, `1440×900` và landscape/short-height: không console error, clipped action, obscured focus, accidental nested scroll hoặc state loss khi topology đổi.

### Definition of done cho từng prompt

1. Bốn artifact tồn tại đúng boundary; EN/VI/context có cùng section order, IDs, codes, region names và normative meaning.
2. Recognition phân biệt được ít nhất hai adjacent archetypes và hard rejection không bị vi phạm.
3. Wide/intermediate/compact là ba topology states có failure trigger rõ; compact giữ task, state và recovery parity.
4. `template.html` parse được, inline script syntax hợp lệ, không duplicate ID, đúng signature/CSP, không network/sink/inline handler và keyboard/focus behavior hoạt động.
5. Research có tối thiểu ba official organizations, nêu được giới hạn suy luận, và không biến source/example thành product fact.
6. Nextra sync/build green; source và published template byte-identical; không có hand-written generated artifact.

## Nguồn research dùng chung

- `M3-CANONICAL` — [Material Design 3 canonical layouts](https://m3.material.io/foundations/layout/canonical-examples/overview)
- `FLUENT-LAYOUT` — [Fluent 2 layout](https://fluent2.microsoft.design/layout)
- `APPLE-LAYOUT` — [Apple layout](https://developer.apple.com/design/human-interface-guidelines/layout)
- `APPLE-SPLIT` — [Apple split views](https://developer.apple.com/design/human-interface-guidelines/split-views)
- `CARBON-GRID` — [Carbon 2x Grid](https://carbondesignsystem.com/elements/2x-grid/overview/)
- `CARBON-TABLE` — [Carbon data table](https://carbondesignsystem.com/components/data-table/usage/)
- `CARBON-FILTER` — [Carbon filtering](https://carbondesignsystem.com/patterns/filtering/)
- `WAI-REFLOW` — [WCAG Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow)
- `WAI-FOCUS` — [WCAG Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html)
- `WAI-OBSCURED` — [WCAG Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum)
- `WAI-STATUS` — [WCAG Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
- `WAI-APG` — [WAI-ARIA Authoring Practices patterns](https://www.w3.org/WAI/ARIA/apg/patterns/)
- `GOVUK-PATTERNS` — [GOV.UK Design System patterns](https://design-system.service.gov.uk/patterns/)
- `USWDS-PATTERNS` — [U.S. Web Design System patterns](https://designsystem.digital.gov/patterns/)
- `NHS-PATTERNS` — [NHS service manual patterns](https://service-manual.nhs.uk/design-system/patterns)
- `SHOPIFY-HOME` — [Shopify App Home patterns](https://shopify.dev/docs/api/app-home/patterns)
- `ATLASSIAN-DESIGN` — [Atlassian Design System](https://atlassian.design/components/)
- `GITLAB-PATTERNS` — [GitLab Pajamas patterns](https://design.gitlab.com/patterns/)
- `SALESFORCE-COMPONENTS` — [Salesforce Lightning component reference](https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/)
- `SPECTRUM-COMPONENTS` — [Adobe Spectrum components](https://spectrum.adobe.com/page/components/)

Mỗi prompt dưới đây phải dùng các anchors phù hợp và tự bổ sung ít nhất một official source đặc thù cho dominant task. Không dùng gallery, roundup, Dribbble, Behance, Pinterest hoặc screenshot làm authority.

## Prompt 01 — `batch-table-operations`

- **Output boundary:** `archetypes/work/batch-table-operations/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Scan structured records, tạo một selection set và thực hiện một set-scoped batch transaction whose eligibility, consequence and partial outcome depend on that set while preserving column relationships.
- **Required region graph:** `batch-workbench → dataset-context → table-toolbar → relational-table → selection-set → batch-eligibility-and-consequence → batch-action-mode → batch-outcome-ledger → pagination-or-expansion`; table owns relational scan, selection set owns batch eligibility and the outcome ledger owns per-row success or failure without becoming a selected-record detail workspace.
- **Wide:** Table nhận phần lớn chiều rộng; toolbar, headers và batch action mode gắn cùng table owner; dense rows không bị nhốt trong card hoặc panel hẹp.
- **Intermediate:** Giữ identity và decision columns; supporting columns được priority-hide hoặc chuyển vào row disclosure; batch summary/actions vẫn cùng context với selection.
- **Compact:** Nếu row có thể linearize mà không mất quan hệ thì dùng row disclosures; nếu cross-column comparison là invariant thì giữ một bounded table scroller với frozen identity và explicit overflow cue, không page-level scroll.
- **State obligations:** dataset loading/empty/error, filter/search applied, row expanded, none/single/multi/all selection, batch pending/partial success/error, stale row, permission-disabled action, pagination focus.
- **Hard rejection:** Reject cho cell/range editing, two-axis formula work, browse-first card collection, list mà columns không tạo relational evidence, hoặc operational collection nơi repeated selected-record inspection/action—not a set-scoped transaction—owns the work loop.
- **Research anchors:** `CARBON-TABLE`, `CARBON-FILTER`, `FLUENT-LAYOUT`, `WAI-REFLOW`, `WAI-STATUS`.
- **Acceptance focus:** Template phải cho sort, build/clear một selection set, prove batch eligibility before commitment, chạy partial-success action với per-row outcome ledger và chứng minh compact overflow owner không lan ra page.

## Prompt 02 — `spreadsheet-grid-editor`

- **Output boundary:** `archetypes/work/spreadsheet-grid-editor/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Edit values và formulas theo cell coordinates, ranges, rows, columns và sheets trong một two-dimensional model.
- **Required region graph:** `spreadsheet → workbook-and-sheet-navigation → formula-input → editable-cell-grid → row-column-headers → active-cell-or-range → grid-actions`; grid owns two-axis navigation và selection semantics.
- **Wide:** Formula/input bar, sheet context và frozen headers bao quanh một bounded two-axis grid; active cell/range và edit mode luôn phân biệt được ngoài màu.
- **Intermediate:** Giảm visible cells nhưng không linearize relational coordinates; supporting commands vào overflow có nhãn, headers và active-cell address vẫn visible.
- **Compact:** Dùng cell-focused editing stage kết hợp bounded grid navigator; explicit previous/next cell, row/column context và commit/cancel thay cho cố ép toàn workbook vào viewport.
- **State obligations:** workbook/sheet loading, active cell/range, edit/commit/cancel, formula parse error, paste/import pending, protected cell, concurrent edit/conflict, undo/redo, recalculation status.
- **Hard rejection:** Reject khi task chỉ scan/sort/select records, khi mỗi row là một independent form, hoặc khi editable cells không có coordinate/range/formula semantics.
- **Research anchors:** `CARBON-TABLE`, `CARBON-GRID`, `FLUENT-LAYOUT`, `WAI-APG`, `WAI-FOCUS`.
- **Acceptance focus:** Template phải có keyboard grid navigation, formula edit, range selection, compact cell stage và chỉ grid region own horizontal/vertical overflow.

## Prompt 03 — `permissions-matrix`

- **Output boundary:** `archetypes/work/permissions-matrix/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Review và chỉnh quyền tại giao điểm actor/group, resource và capability trong khi hiểu inheritance, exceptions và effective outcome.
- **Required region graph:** `permission-workbench → scope-and-actor-selector → policy-matrix → inheritance-legend → exception-summary → effective-access-preview → review-and-commit`; each editable intersection owns stated/effective distinction.
- **Wide:** Matrix đồng hiện cùng frozen axis identities; legend và exception summary hỗ trợ nhưng không che cells; review/commit nêu exact affected scope.
- **Intermediate:** Focus một resource/capability group tại một thời điểm; actor context và unsaved/effective summary luôn visible; supporting evidence thành collapsible pane.
- **Compact:** Chọn actor hoặc resource trước, rồi chỉnh capability list có inherited source và override state; summary screen kiểm toàn bộ exceptions trước commit.
- **State obligations:** policy loading, inherited/direct/denied/mixed outcomes, no permission to edit, unsaved changes, validation, bulk change, commit pending/success/partial failure, external policy conflict.
- **Hard rejection:** Reject cho generic editable spreadsheet, flat role form, rule conditions/outcomes, hoặc record table không có inheritance/effective-access semantics.
- **Research anchors:** `CARBON-TABLE`, `CARBON-GRID`, `SPECTRUM-COMPONENTS`, `WAI-APG`, `WAI-STATUS`.
- **Acceptance focus:** Template phải cho đổi actor, tạo/remove override, thấy effective access bằng text+icon, review compact summary và recover commit conflict.

## Prompt 04 — `pivot-drilldown-analytics`

- **Output boundary:** `archetypes/work/pivot-drilldown-analytics/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Đặt câu hỏi trên aggregate measures, thay dimensions/filters và drill từ signal xuống supporting records.
- **Required region graph:** `analytics-workbench → metric-and-scope-context → shared-filter-and-pivot-controls → primary-visual-analysis → coordinated-secondary-views → selected-segment-detail → drilldown-records`; selections cross-filter cùng analytical state.
- **Wide:** Primary visualization chiếm ưu thế; secondary views và drill table đồng hiện khi chúng giải thích cùng selection, không thành grid metric cards đồng cấp.
- **Intermediate:** Giữ primary view và một supporting view; các view còn lại vào named tabs/disclosures, filter/pivot context không biến mất khi chuyển.
- **Compact:** Một analytical view mỗi stage; filter/pivot summary, selected segment và drill path luôn visible; records mở thành subsequent stage/sheet thay vì thu chart đến không đọc được.
- **State obligations:** initial/loading, no data, partial series failure, filter/pivot editing, selected mark, drill loading, stale snapshot, permission-redacted records, export pending, announced result changes.
- **Hard rejection:** Reject cho passive KPI dashboard, fixed narrative report, raw table operations, hoặc chart collection không có coordinated selection và drill path.
- **Research anchors:** `CARBON-GRID`, `CARBON-TABLE`, `FLUENT-LAYOUT`, `WAI-REFLOW`, `WAI-STATUS`.
- **Acceptance focus:** Template phải cho đổi dimension, select mark, cross-filter secondary view và mở compact drill records mà giữ query state.

## Prompt 05 — `streaming-log-console`

- **Output boundary:** `archetypes/work/streaming-log-console/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Theo dõi append-only event stream lớn, pause/follow, tìm pattern và inspect một event để cô lập failure.
- **Required region graph:** `log-console → stream-scope-and-query → live-status-and-follow-controls → bounded-log-viewport → selected-event-context → detail-or-export-actions`; viewport owns high-volume scroll, follow state owns live position.
- **Wide:** Query/filter rail hoặc command band cùng log viewport và selected-event detail; stream nhận phần lớn room và line identity/timestamp không bị card hóa.
- **Intermediate:** Query controls thành collapsible/temporary pane; detail thành drawer; viewport giữ readable lines và explicit wrap/no-wrap policy.
- **Compact:** Log stream full-width với wrap mặc định; raw unbreakable tokens chỉ scroll trong bounded line/detail region; filter và event detail mở thành sheets, pause/follow luôn reachable.
- **State obligations:** connecting/live/paused/disconnected, empty range, burst/backpressure, query applied/error, selected event, truncated line, permission-redacted payload, export pending/error, resume-at-bottom.
- **Hard rejection:** Reject cho curated audit timeline, conversational activity feed, terminal command session, hoặc static code/file editor.
- **Research anchors:** `CARBON-GRID`, `FLUENT-LAYOUT`, `WAI-STATUS`, `WAI-FOCUS`, `WAI-OBSCURED`.
- **Acceptance focus:** Template phải mô phỏng deterministic stream locally, pause/resume without scroll jump, filter, select detail và announce connection state without focus theft.

## Prompt 06 — `calendar-resource-scheduler`

- **Output boundary:** `archetypes/work/calendar-resource-scheduler/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Allocate resources vào time slots, phát hiện collisions và điều chỉnh assignments để đạt một feasible schedule.
- **Required region graph:** `scheduler → date-range-and-view-controls → resource-axis → time-axis-grid → unscheduled-work-queue → selected-assignment-editor → conflict-feedback`; time/resource intersection owns placement semantics.
- **Wide:** Resource × time grid đồng hiện với unscheduled queue và contextual editor khi fit; bounded scheduler region own two-axis overflow và giữ headers.
- **Intermediate:** Thu time horizon hoặc resource set; queue/editor thành collapsible panes; conflict summary và selected time/resource luôn visible.
- **Compact:** Agenda-first hoặc one-resource/one-day stage; unscheduled items và assignment editor thành sheets, explicit add/move controls thay cho drag-only interaction.
- **State obligations:** range/resource loading, no availability, tentative/confirmed assignment, collision, recurrence, timezone, drag/move pending, external schedule conflict, permission, undo/recovery.
- **Hard rejection:** Reject cho read-only calendar browsing, kanban state movement, audit timeline, hoặc simple event form không có resource allocation/collision task.
- **Research anchors:** `APPLE-LAYOUT`, `APPLE-SPLIT`, `FLUENT-LAYOUT`, `WAI-APG`, `WAI-STATUS`.
- **Acceptance focus:** Template phải cho schedule một unscheduled item bằng pointer và keyboard-equivalent controls, surface conflict, resolve và giữ selected date/resource qua compact change.

## Prompt 07 — `kanban-swimlane-board`

- **Output boundary:** `archetypes/work/kanban-swimlane-board/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Di chuyển work items qua ordered states, theo dõi WIP và giữ grouping/swimlane context.
- **Required region graph:** `work-board → board-scope-and-filters → ordered-state-lanes → optional-swimlanes → work-item-cards → wip-and-policy-feedback → selected-item-inspector`; lane position owns workflow state.
- **Wide:** Nhiều lanes đồng hiện trong một bounded board region; lane headings/WIP remain associated; inspector overlays hoặc chiếm supporting pane mà không đổi board order.
- **Intermediate:** Chỉ 2–3 lanes visible trong bounded scroller hoặc explicit lane paging; swimlane identity persistent; item inspector temporary.
- **Compact:** Một selected lane tại một thời điểm với lane selector và stacked items; move action là explicit destination chooser, không phụ thuộc horizontal drag.
- **State obligations:** board/lane loading, lane empty, filters, item selected, move pending/success/rejected, WIP exceeded, stale item, permission, lane unavailable, undo.
- **Hard rejection:** Reject cho time-based scheduling, generic card catalog, table batch operations, hoặc workflow graph nơi nodes/edges chứ không lanes biểu diễn logic.
- **Research anchors:** `CARBON-GRID`, `FLUENT-LAYOUT`, `ATLASSIAN-DESIGN`, `WAI-APG`, `WAI-STATUS`.
- **Acceptance focus:** Template phải có bounded overflow, keyboard move menu, WIP rejection/undo và compact lane-by-lane parity without page scroll.

## Prompt 08 — `multi-party-consensus-workbench`

- **Output boundary:** `archetypes/work/multi-party-consensus-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Tổng hợp shared evidence, participant positions và unresolved objections thành một proposal có quorum và decision record rõ.
- **Required region graph:** `consensus-workbench → decision-question-and-rules → shared-evidence-set → participant-position-map → unresolved-issue-register → proposal-composer → quorum-and-decision-record`; positions and objections are independent owners, không bị nén thành comments.
- **Wide:** Evidence, positions/issues và proposal/quorum đồng hiện theo 2–3 regions; active objection link tới exact evidence and proposed resolution.
- **Intermediate:** Evidence hoặc participant map thành temporary pane; unresolved issues + proposal remain primary, participant state stays visible in summary.
- **Compact:** Tuần tự `decision context → evidence summary → positions → unresolved issues → proposal → quorum`; each stage preserves selected issue/evidence and Back path.
- **State obligations:** evidence loading/stale, participant invited/responded/abstained, position changed, objection open/resolved/reopened, proposal draft/conflict, quorum unmet/met/expired, decision pending/recorded and focus evidence↔issue.
- **Hard rejection:** Reject cho simple approval request, comment thread, real-time incident command, voting-only ballot, document diff resolution hoặc criteria-led case nơi explicit criteria và evidence—not participant positions plus quorum—determine the verdict.
- **Research anchors:** `ATLASSIAN-DESIGN`, `CARBON-TABLE`, `FLUENT-LAYOUT`, `WAI-STATUS`, `WAI-FOCUS`.
- **Acceptance focus:** Template phải link evidence→objection→proposal, simulate position/quorum changes and preserve decision trace across 3→2→1 region transformation.

## Prompt 09 — `reconciliation-diff-workbench`

- **Output boundary:** `archetypes/work/reconciliation-diff-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Align hai versions/sources, điều hướng differences và resolve từng conflict thành một accepted result.
- **Required region graph:** `reconciliation → source-a-context → source-b-context → aligned-difference-view → change-navigator → resolution-controls → unresolved-summary-and-commit`; difference identity links both sources and decision.
- **Wide:** Hai source panes đồng hiện với synchronized alignment; change navigator và resolution controls remain adjacent to active difference, không tách thành unrelated rail.
- **Intermediate:** Giữ side-by-side khi mỗi pane còn readable; nếu không, dùng synchronized stacked view hoặc explicit A/B/Diff switch với active change summary.
- **Compact:** Một active difference mỗi stage; A, B và resolved value hiển thị theo semantic sequence; previous/next conflict và accept/edit controls sticky nhưng yield trên short-height.
- **State obligations:** sources loading/partial failure, unchanged/added/removed/modified/conflict, resolution draft, unresolved count, auto-match uncertainty, commit pending/partial failure, external source change.
- **Hard rejection:** Reject cho passive comparison matrix, document authoring without paired sources, generic approval detail, hoặc simple before/after preview không có per-difference resolution.
- **Research anchors:** `APPLE-SPLIT`, `CARBON-TABLE`, `FLUENT-LAYOUT`, `WAI-FOCUS`, `WAI-STATUS`.
- **Acceptance focus:** Template phải cho navigate conflicts, accept A/B/custom, update unresolved count và chuyển 2-pane→single-difference compact without losing resolution state.

## Prompt 10 — `canvas-inspector-studio`

- **Output boundary:** `archetypes/work/canvas-inspector-studio/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Manipulate một spatial artifact trực tiếp và chỉnh contextual properties của current selection.
- **Required region graph:** `studio → document-and-history-controls → spatial-canvas → canvas-tools → current-selection → contextual-inspector → accessible-object-list`; canvas and alternate list share selection/action parity.
- **Wide:** Canvas là primary region; inspector persistent khi selection tồn tại; tools không chiếm một palette cấu trúc riêng; zoom/pan bounded trong canvas.
- **Intermediate:** Inspector collapses hoặc becomes temporary pane; essential tools condense có label/overflow; canvas giữ usable working area.
- **Compact:** Object list hoặc focused-object stage là default khi canvas quá nhỏ; canvas có optional full-screen mode, inspector thành sheet, tất cả actions có non-gesture equivalent.
- **State obligations:** document loading, no selection, single/multi selection, tool active, zoom/pan, unsaved/pending save, invalid property, locked object, external conflict, undo/redo.
- **Hard rejection:** Reject khi dominant task là assemble blocks từ palette, edit text flow, inspect read-only graph/map, hoặc workflow nodes/edges có execution semantics.
- **Research anchors:** `APPLE-SPLIT`, `APPLE-LAYOUT`, `SPECTRUM-COMPONENTS`, `WAI-APG`, `WAI-FOCUS`.
- **Acceptance focus:** Template dùng inline SVG/CSS canvas, đồng bộ canvas↔object list selection, keyboard transform/property edit và deterministic inspector focus return.

## Prompt 11 — `palette-canvas-properties-builder`

- **Output boundary:** `archetypes/work/palette-canvas-properties-builder/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Assemble một ordered/nested structure bằng cách chọn reusable blocks, đặt chúng vào composition và cấu hình selected block.
- **Required region graph:** `builder → component-palette → structure-canvas → insertion-and-order-controls → selected-block → property-inspector → structure-outline-and-validation`; palette inserts, canvas structures, inspector configures.
- **Wide:** Palette, canvas và properties đồng hiện khi cả ba còn usable; structure outline hỗ trợ navigation, không thành hierarchy browser riêng.
- **Intermediate:** Palette thành drawer, giữ canvas + collapsible properties; insertion target và selected block summary remain visible.
- **Compact:** Tuần tự hóa choose block → place/reorder → configure; structure outline là primary navigator, drag luôn có add/move button equivalent.
- **State obligations:** palette loading/empty, valid/invalid insertion, selected block, property validation, nested/reordered item, duplicate/remove, unsaved, save pending/conflict, undo/redo.
- **Hard rejection:** Reject cho single-artifact canvas inspection, workflow automation với executable branches, form page chỉ có fields, hoặc file hierarchy editor.
- **Research anchors:** `APPLE-SPLIT`, `FLUENT-LAYOUT`, `SPECTRUM-COMPONENTS`, `WAI-APG`, `WAI-STATUS`.
- **Acceptance focus:** Template phải cho add, reorder bằng keyboard, configure, surface invalid structure và chứng minh 3-pane→3-stage compact parity.

## Prompt 12 — `document-outline-editor`

- **Output boundary:** `archetypes/work/document-outline-editor/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Author một long-form structured document trong khi điều hướng outline, formatting content và resolving anchored comments.
- **Required region graph:** `document-editor → document-status-and-actions → hierarchical-outline → flow-editor → formatting-controls → anchored-comments → revision-or-save-feedback`; editor owns primary text flow and selection.
- **Wide:** Outline + optimal editing measure + comments đồng hiện khi fit; formatting controls act on editor selection; comments remain anchored to text locations.
- **Intermediate:** Chỉ một supporting rail persistent; outline hoặc comments becomes drawer theo current subtask, editor measure không bị squeeze.
- **Compact:** Editor một cột; outline và comments là named sheets/screens returning to exact text anchor; formatting groups into reachable controls without horizontal toolbar spill.
- **State obligations:** document loading, empty first draft, text selection/formatting, comment open/resolved/orphaned, autosave pending/error, offline/stale revision, external conflict, permission/read-only, undo/redo.
- **Hard rejection:** Reject cho manuscript reading/annotation only, spatial canvas, code editor, hoặc block builder nơi reusable components—not text flow—own structure.
- **Research anchors:** `APPLE-SPLIT`, `FLUENT-LAYOUT`, `SPECTRUM-COMPONENTS`, `WAI-FOCUS`, `WAI-OBSCURED`.
- **Acceptance focus:** Template phải cho outline navigation, edit, add/resolve comment, autosave/error recovery và restore exact text/comment anchor across topology change.

## Prompt 13 — `media-annotation-workbench`

- **Output boundary:** `archetypes/work/media-annotation-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Review media và create/edit annotations bound to timestamps, ranges hoặc spatial regions while preserving playback position.
- **Required region graph:** `annotation-workbench → media-stage → transport-and-timecode → annotation-track-or-list → active-annotation-editor → labels-or-schema → review-and-export`; media time/region and annotation selection share one cursor.
- **Wide:** Media stage, annotation track/list và editor đồng hiện; timeline owns bounded horizontal overflow; selected annotation highlights its exact media range/region.
- **Intermediate:** Annotation editor thành collapsible pane; stage + track remain primary; labels/schema vào temporary surface.
- **Compact:** Media stage + current annotation sequence; annotation list/editor thành sheets or stages, explicit previous/next marker controls replace precision-only dragging.
- **State obligations:** media loading/error, play/pause/seek, annotation none/selected/draft/invalid, overlapping ranges, label unavailable, autosave pending/conflict, export pending/error, permission/read-only.
- **Hard rejection:** Reject cho passive media theater/queue, gallery asset metadata, document text comments, generic timeline audit without authoring bound annotations, hoặc multi-track composition nơi clips/tracks thay đổi playback order, duration hay rendered output.
- **Research anchors:** `APPLE-LAYOUT`, `SPECTRUM-COMPONENTS`, `FLUENT-LAYOUT`, `WAI-APG`, `WAI-STATUS`.
- **Acceptance focus:** Không dùng remote media; template mô phỏng local playback/timecode, add/edit range annotation bằng keyboard và giữ cursor/selection khi editor becomes sheet.

## Prompt 14 — `query-builder-workbench`

- **Output boundary:** `archetypes/work/query-builder-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Construct một structured query từ fields, operators và grouped clauses, run/preview nó rồi sửa dựa trên result/error evidence.
- **Required region graph:** `query-workbench → data-scope-and-schema → clause-builder → group-and-boolean-structure → query-summary-or-text → validation-and-execution-controls → result-preview`; clauses own editable intent, preview owns execution evidence.
- **Wide:** Clause structure và result preview đồng hiện; schema/reference supporting; query summary/text stays synchronized but không trở thành second unsynced editor.
- **Intermediate:** Schema thành drawer; builder + preview stack hoặc resize theo current subtask; execution status và current scope always visible.
- **Compact:** Build clauses one group at a time; query summary precedes Run; preview becomes next stage and Back restores exact clause/focus state.
- **State obligations:** schema loading, empty query, clause add/remove/reorder, invalid operator/value, nested group, validation, run pending/success/error/timeout, zero results, stale schema, saved query conflict.
- **Hard rejection:** Reject cho simple search/filter UI, general rule builder with effects, raw SQL/code editor, hoặc analytics dashboard where query construction is hidden.
- **Research anchors:** `CARBON-FILTER`, `CARBON-TABLE`, `FLUENT-LAYOUT`, `WAI-APG`, `WAI-STATUS`.
- **Acceptance focus:** Template phải cho add/nest clauses, validate, run deterministic preview, focus error summary và preserve builder state across compact result stage.

## Prompt 15 — `rule-builder-workbench`

- **Output boundary:** `archetypes/work/rule-builder-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Define conditional logic và outcomes, understand precedence/coverage, test representative inputs và publish an unambiguous rule set.
- **Required region graph:** `rule-workbench → rule-set-scope → ordered-rules → condition-groups → outcomes → precedence-and-coverage-summary → test-cases-and-result → review-and-publish`; order and match semantics own effective behavior.
- **Wide:** Rule list/order, active rule editor và test/coverage pane đồng hiện; effective precedence remains visible while editing conditions/outcomes.
- **Intermediate:** Rule list collapses; active editor + test evidence remain; coverage/precedence becomes named supporting pane.
- **Compact:** Select rule → edit conditions/outcome → run test → review set as stages; current priority and unsaved/test status persist across stages.
- **State obligations:** rules loading/empty, add/duplicate/reorder, invalid/incomplete condition, unreachable/overlapping rule, test pending/pass/fail, draft/published, stale dependency, publish conflict, permission.
- **Hard rejection:** Reject cho data query without effects, permissions inheritance matrix, visual workflow with executable steps/branches, hoặc simple form validation local to one field.
- **Research anchors:** `CARBON-FILTER`, `FLUENT-LAYOUT`, `SALESFORCE-COMPONENTS`, `WAI-FOCUS`, `WAI-STATUS`.
- **Acceptance focus:** Template phải cho reorder rules bằng keyboard, expose overlap/unreachable state, run deterministic test và block publish until reviewable errors resolve.

## Prompt 16 — `workflow-automation-builder`

- **Output boundary:** `archetypes/work/workflow-automation-builder/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Build và connect an executable multi-step/branch workflow, configure nodes, validate paths và activate a version safely.
- **Required region graph:** `automation-builder → workflow-version-and-status → trigger-and-step-palette → executable-edge-graph ↔ accessible-branch-outline → selected-node-config → path-validation → simulation-inputs → time-ordered-simulation-trace → review-and-activate`; parallel branches, edge semantics and simulation trace are independently required.
- **Wide:** Executable graph/outline + node config + simulation trace can be inspected together; palette supports insertion, graph owns bounded pan/zoom, trace owns run evidence rather than acting as a toast.
- **Intermediate:** Palette becomes drawer; config and trace alternate as named supporting panes while graph/outline keeps active node, branch and simulated path.
- **Compact:** Accessible branched outline is primary; explicit stages are choose node → configure → connect branch → simulate → inspect trace → activate; graph optional and trace remains a full evidence screen.
- **State obligations:** draft loading/empty, node/edge add/remove/connect, parallel branch, invalid/unreachable/cyclic path, config error, simulation queued/running/pass/fail with per-step trace, version stale, activate pending/conflict, permission and rollback.
- **Hard rejection:** Reject cho block composition without execution semantics, linear wizard consumed by an end user, kanban state board, hoặc rule set lacking step/path orchestration.
- **Research anchors:** `APPLE-LAYOUT`, `FLUENT-LAYOUT`, `ATLASSIAN-DESIGN`, `WAI-APG`, `WAI-STATUS`.
- **Acceptance focus:** Template phải đồng bộ graph↔outline↔simulation trace, hỗ trợ executable branch bằng keyboard, expose per-step simulated I/O and block activation until path evidence passes.

## Prompt 17 — `localization-workbench`

- **Output boundary:** `archetypes/work/localization-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Translate and review many source segments into a target locale while preserving context, placeholders, status and quality evidence.
- **Required region graph:** `localization-workbench → project-locale-and-progress → segment-queue → source-context → target-editor → terminology-and-placeholder-support → quality-issues → save-and-submit`; active segment links source, target and QA state.
- **Wide:** Segment queue, source/target editor và terminology/QA support đồng hiện; source and target remain paired, not separated into unrelated pages.
- **Intermediate:** Queue becomes collapsible; source + target remain visible; terminology/QA becomes drawer with issue summary outside.
- **Compact:** Segment-by-segment stage with source immediately before target; queue/progress and terminology/issues open as sheets, previous/next preserves draft and review state.
- **State obligations:** project/segment loading, untranslated/draft/reviewed/approved, autosave pending/error, placeholder or length issue, terminology suggestion, source changed/stale target, conflict, locked segment, submit success.
- **Hard rejection:** Reject cho general spreadsheet rows, two-version merge diff, document authoring, hoặc single-language form where locale/segment/placeholder semantics are absent.
- **Research anchors:** `CARBON-TABLE`, `FLUENT-LAYOUT`, `SPECTRUM-COMPONENTS`, `WAI-REFLOW`, `WAI-STATUS`.
- **Acceptance focus:** Template phải cho đổi segment, edit target, detect missing placeholder, resolve QA issue và retain draft/focus when compact queue becomes sheet.

## Prompt 18 — `conversation-room`

- **Output boundary:** `archetypes/work/conversation-room/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Read and continue a live thread while keeping message order, unread position, composer draft and room context stable.
- **Required region graph:** `conversation-room → room-and-live-status → chronological-thread → unread-position → persistent-composer → participants-pins-and-files-context → message-actions`; thread owns reading order, composer owns draft/submit state.
- **Wide:** Thread + contextual rail đồng hiện; composer remains associated with room and reserves space; optional room navigation is outside this leaf unless required by routed scope.
- **Intermediate:** Context rail becomes drawer; thread measure and composer remain primary; pinned/participant summary stays reachable.
- **Compact:** Thread full-width; composer safe-area sticky but yields on short-height; room context opens as sheet, jump-to-latest appears only when reading position is away from live edge.
- **State obligations:** initial/history loading, empty new room, live/disconnected/reconnecting, unread/new messages, send pending/error/retry, draft, edit/delete conflict, attachment unavailable, permission/muted, focus after send/new arrival.
- **Hard rejection:** Reject cho list-detail inbox triage, passive activity feed, support ticket decision queue, media comments where annotations bind to time/range, hoặc live support session nơi shared stage, remote-control ownership và consent là required owners.
- **Research anchors:** `M3-CANONICAL`, `APPLE-LAYOUT`, `FLUENT-LAYOUT`, `WAI-STATUS`, `WAI-OBSCURED`.
- **Acceptance focus:** Template phải mô phỏng local incoming/send/retry, preserve draft and scroll intent, avoid focus theft on new message, and return focus after compact context sheet.

## Prompt 19 — `dual-list-transfer`

- **Output boundary:** `archetypes/work/dual-list-transfer/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Move items between an available source set and a selected destination set while understanding membership on both sides.
- **Required region graph:** `transfer-workbench → transfer-scope-and-summary → available-collection → selected-collection → source-and-destination-filters → transfer-controls → validation-and-commit`; membership transition links the two peer collections.
- **Wide:** Hai collections đồng hiện với independent counts/search và explicit add/remove controls; transfer direction/order is perceivable without relying on spatial arrows alone.
- **Intermediate:** Hai panes remain only while labels/actions fit; otherwise prioritize active side and keep destination count/summary persistent.
- **Compact:** Available và Selected thành named stages/tabs; each item exposes Add/Remove locally, review selected set before commit, Back preserves filters/scroll on both sides.
- **State obligations:** collections loading/empty/error separately, item selected, add/remove pending, duplicate/ineligible item, destination limit, order change, filter no-match, stale membership, commit pending/partial failure.
- **Hard rejection:** Reject cho one-list multiselect, batch table actions, permissions matrix, shopping cart summary, hoặc drag-only sorting within a single collection.
- **Research anchors:** `CARBON-TABLE`, `FLUENT-LAYOUT`, `WAI-APG`, `WAI-FOCUS`, `WAI-STATUS`.
- **Acceptance focus:** Template phải cho search hai phía, add/remove bằng pointer và keyboard, reject ineligible/limit state, preserve independent context và commit/recover partial failure.
