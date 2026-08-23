# Batch 01 — Discovery and navigation archetypes (19 prompts)

Tệp này là **một prompt batch tự chứa**. Khi chạy ở nơi khác, đưa toàn bộ tệp cho agent để tạo đủ 19 leaf. Nếu chỉ chạy một mục, phải đưa kèm toàn bộ phần từ `Cách chạy` đến `Nguồn research dùng chung`; không tách riêng block prompt khỏi hợp đồng chung.

## Mục lục

| # | Archetype ID | Câu hỏi bố cục chính |
|---:|---|---|
| 01 | `scrollytelling-chapter-explorer` | Làm sao phối hợp narrative chapters với visual evidence mà không khóa người đọc vào desktop scroll effect? |
| 02 | `hierarchical-three-pane-explorer` | Làm sao đi qua ba cấp hierarchy mà vẫn thấy quan hệ cha–con–detail? |
| 03 | `faceted-ranked-results` | Làm sao tìm known need bằng relevance, facets và ranked snippets? |
| 04 | `scoped-federated-search` | Làm sao tìm xuyên nhiều loại object mà vẫn hiểu scope? |
| 05 | `map-results-explorer` | Làm sao khám phá bằng vị trí với map và results đồng bộ? |
| 06 | `timeline-audit-explorer` | Làm sao tái dựng trình tự và nguyên nhân của events? |
| 07 | `immersive-gallery-lightbox` | Làm sao duyệt visual assets rồi inspect ở kích thước lớn? |
| 08 | `media-rails-browser` | Làm sao khám phá media theo hero và các rail có thứ bậc? |
| 09 | `editorial-feed-reader` | Làm sao scan nội dung mới mà giữ orientation và reading position? |
| 10 | `hierarchical-content-browser` | Làm sao đi theo taxonomy rồi đọc index của node hiện tại? |
| 11 | `knowledge-graph-explorer` | Làm sao khám phá quan hệ many-to-many bằng graph và inspector? |
| 12 | `parallel-document-reader` | Làm sao đọc hai tài liệu đã căn chỉnh mà giữ cùng semantic anchor? |
| 13 | `calendar-agenda-browser` | Làm sao duyệt lịch theo time context và chuyển giữa calendar–agenda? |
| 14 | `comparison-matrix` | Làm sao so từ ba alternatives theo cùng attribute set? |
| 15 | `manuscript-reader-notes` | Làm sao đọc long-form đồng thời dùng outline, notes và bookmarks? |
| 16 | `paged-presentation-stage` | Làm sao đi qua discrete frames với thumbnails và notes? |
| 17 | `media-theater-queue` | Làm sao giữ playback liên tục khi dùng queue, chapters hoặc transcript? |
| 18 | `service-navigation-hub` | Làm sao định tuyến theo user task mà không biến mọi link thành catalog card? |
| 19 | `spatial-route-itinerary-explorer` | Làm sao hiểu route alternatives, ordered legs và map context trong cùng hành trình? |

## Cách chạy

1. Trước mọi planning, source read hoặc write, đọc hết `.claude/INDEX.md` và tuân load order của Source đang chạy.
2. Thực thi **đúng 19 prompt** trong tệp này. Mỗi prompt tạo đúng bốn source artifact tại boundary đã ghi: `en.md`, `vi.md`, `context.md`, `template.html`.
3. Research bằng nguồn chính thức, hiện hành và tối thiểu ba tổ chức độc lập; luôn có ít nhất một nguồn accessibility. Các URL gợi ý chỉ là điểm bắt đầu: mở và kiểm chứng, thay nguồn đã deprecated, và thêm nguồn chính thức đặc thù cho task.
4. Synthesize dominant task, region graph và responsive transformation. Không copy visual UI, component tree, product nouns hoặc breakpoint của nguồn. Không viết như thể tên archetype tổng hợp này là thuật ngữ chính thức của một hãng.
5. Kiểm hard rejection trước khi viết. Nếu khác biệt chỉ là product noun, card count, density, color, component hoặc state của archetype khác, bỏ candidate và báo `duplicate-or-variation`; không cố hợp thức hóa một page type mới.
6. Không sửa `knowledge/archetypes/context.md`, `.claude/INDEX.md`, `docs/content`, `docs/public/template-assets` hoặc source product trong batch này. Shared router được reconcile một lần sau khi các batch hoàn tất; Nextra assets là generated output.
7. Nếu leaf đã tồn tại, audit evidence và chỉ update đúng leaf đó; không xóa provenance hoặc overwrite thay đổi ngoài scope.
8. Cuối batch chạy source checks phù hợp, `npm run sync:content` và `npm run build` trong `.claude/docs`; chứng minh route `Template` được sinh tự động và bản public là byte-identical với source `template.html`.

## Hợp đồng artifact dùng chung — bắt buộc giữ nguyên

### Boundary và authority

- Leaf path: `knowledge/archetypes/<family>/<archetype-id>/`.
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
- `Output` trả đúng runtime fields của `knowledge/archetypes/context.md`, gồm `archetypeId`, matched situation codes, aliases, dominant task, regions, relationships, responsive fields, state obligations, boundary verdict, Grammar handoff, Principles handoff, confidence và evidence classes.
- Văn phong: present tense, product-neutral, một normative claim mỗi bullet; không “modern/clean/intuitive”, không marketing copy, không component/class/token/breakpoint cụ thể trong authority text.

### `template.html` thống nhất và đồng bộ Nextra

- Source duy nhất: `knowledge/archetypes/<family>/<archetype-id>/template.html`. Nextra sync phải copy byte-for-byte tới `docs/public/template-assets/archetypes/<family>/<archetype-id>/template.html` và tự tạo tab/route `Template`; không hand-edit generated copy.
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

## Prompt 01 — `scrollytelling-chapter-explorer`

- **Output boundary:** `knowledge/archetypes/discovery/scrollytelling-chapter-explorer/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Đi qua một authored narrative theo chapters trong khi visual evidence thay đổi có phối hợp để giải thích đúng claim đang đọc.
- **Required region graph:** `scrollytelling → chapter-navigation → ordered-narrative-chapters ↔ coordinated-visual-stage → active-claim-annotation → evidence-sources-and-progress`; chapter text owns reading, visual stage owns coordinated evidence chứ không own page scroll.
- **Wide:** Chapter rail, readable narrative và sticky visual có thể đồng hiện; sticky stage chỉ đổi khi active claim thực sự vào ngữ cảnh và không che heading/focus.
- **Intermediate:** Chapter rail thành disclosure; visual giảm persistence hoặc xuất hiện giữa chapter transitions, không ép narrative dưới readable measure.
- **Compact:** Visual evidence được đặt inline tại chapter/claim nó hỗ trợ; chapter navigation thành TOC sheet và không phụ thuộc scroll-trigger animation.
- **State obligations:** chapter deep-link/loading, visual loading/unsupported, active claim, source unavailable, reading progress, reduced-motion/static alternative, return-to-chapter focus và resize without semantic drift.
- **Hard rejection:** Reject cho analytical dashboard có cross-filter, manuscript reader với static notes, paged presentation, authored analytical briefing nơi figures giữ nguyên theo authored order và không có shared active-claim state, hoặc marketing parallax không có evidence relationship.
- **Research anchors:** `FLUENT-LAYOUT`, `APPLE-LAYOUT`, `WAI-REFLOW`, `WAI-FOCUS`, `WAI-OBSCURED`.
- **Acceptance focus:** Template phải chứng minh sticky→inline transformation, deep-link chapters, reduced-motion parity và visual changes không auto-move focus.

## Prompt 02 — `hierarchical-three-pane-explorer`

- **Output boundary:** `knowledge/archetypes/discovery/hierarchical-three-pane-explorer/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Đi qua hierarchy ba cấp độc lập và inspect leaf detail mà không mất vị trí ở cấp cha hoặc con.
- **Required region graph:** `explorer → primary-hierarchy → child-collection → leaf-detail`; mỗi cấp own selection và path; breadcrumb/back là compact replacement, không phải region thứ tư cạnh tranh.
- **Wide:** Ba pane đồng hiện chỉ khi từng pane còn usable; hierarchy và child pane là navigation, detail là primary reading/action region.
- **Intermediate:** Primary hierarchy thành drawer/overlay, giữ child + detail; selected path luôn nhìn thấy.
- **Compact:** Tuần tự hóa `primary → child → detail`; mỗi bước có title/path/back và restore state riêng.
- **State obligations:** node expansion/loading, child empty/error, orphan/deleted leaf, stale path, permission at any level, focus restoration across three stages.
- **Hard rejection:** Reject nếu chỉ có list + detail với sidebar trang trí, hierarchy không phải parent–child thật, hoặc graph có nhiều parent.
- **Research anchors:** `APPLE-SPLIT`, `FLUENT-LAYOUT`, `WAI-FOCUS`, `WAI-REFLOW`, `ATLASSIAN-DESIGN`.
- **Acceptance focus:** Template phải chứng minh giảm 3→2→1 pane mà không mất path, selection hoặc action parity.

## Prompt 03 — `faceted-ranked-results`

- **Output boundary:** `knowledge/archetypes/discovery/faceted-ranked-results/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Diễn đạt known need, thu hẹp result set và đánh giá relevance qua ranked snippets.
- **Required region graph:** `search-results → query-and-scope → facet-controls → applied-filter-summary → count-sort → ranked-result-list → pagination`; snippet/relevance là primary evidence, không phải card merchandising.
- **Wide:** Facet rail và ranked results song song; query/result context bám với result owner.
- **Intermediate:** Facets thành collapsible/temporary surface; applied filters và result count vẫn hiện ngoài surface.
- **Compact:** Query, applied summary, filter trigger, sort và results thành một reading sequence; filter sheet trả focus về trigger và giữ URL/query state.
- **State obligations:** query editing/submitting, loading with retained context, zero results, spell/recovery suggestions, filter apply/reset, pagination, stale result, announced count.
- **Hard rejection:** Reject cho browse-first card catalog, simple known list không cần relevance, hoặc global search qua nhiều object types.
- **Research anchors:** `CARBON-FILTER`, `WAI-APG`, `WAI-STATUS`, `GITLAB-PATTERNS`, `SPECTRUM-COMPONENTS`.
- **Acceptance focus:** Template phải có query, reversible facets, ranked snippets, no-results recovery và modal focus behavior hoàn chỉnh.

## Prompt 04 — `scoped-federated-search`

- **Output boundary:** `knowledge/archetypes/discovery/scoped-federated-search/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Tìm một object cụ thể xuyên nhiều content types hoặc workspaces mà vẫn hiểu scope và result ownership.
- **Required region graph:** `federated-search → prominent-query → scope-picker → type-summary-navigation → grouped-or-scoped-results → result-pagination`; mỗi result group nêu type và count.
- **Wide:** Query + scope ổn định; type tabs/summary và active result region cùng thấy; cross-type summary không lẫn với filters.
- **Intermediate:** Scope xuống hàng; type navigation co thành overflow có kiểm soát hoặc select khi labels không fit.
- **Compact:** Một active type tại một thời điểm; back/selector mở được all-types summary và giữ query, scope, page.
- **State obligations:** all-scope loading/partial failure, per-type empty/error, permission-redacted group, query correction, current type, pagination, announced result totals.
- **Hard rejection:** Reject nếu chỉ search một homogeneous dataset, browse theo taxonomy, hoặc dùng search thay toàn bộ information architecture.
- **Research anchors:** `GITLAB-PATTERNS`, `SPECTRUM-COMPONENTS`, `WAI-STATUS`, `WAI-REFLOW`, `FLUENT-LAYOUT`.
- **Acceptance focus:** Template phải mô phỏng partial success của một scope và chuyển type trên compact mà không reset query.

## Prompt 05 — `map-results-explorer`

- **Output boundary:** `knowledge/archetypes/discovery/map-results-explorer/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Tìm và đánh giá choices bằng quan hệ không gian; map là một index chính, không là ảnh trang trí.
- **Required region graph:** `spatial-explorer → place-query-filters → map-index ↔ synchronized-result-list → selected-place-detail → map-controls`; selection sync hai chiều.
- **Wide:** Map và list/detail đồng hiện, có một scroll owner rõ cho results; pan/zoom không nuốt keyboard navigation của trang.
- **Intermediate:** Map giữ primary hoặc list giữ primary theo task evidence; vùng còn lại thành collapsible pane với selected-place summary luôn reachable.
- **Compact:** Explicit Map/List switch; selected detail thành sheet/screen, close/back khôi phục map viewport hoặc list position.
- **State obligations:** geolocation denied/unavailable, map loading/error, list partial results, no places in viewport, selected marker offscreen, route/query update, focus marker↔result.
- **Hard rejection:** Reject nếu bỏ map mà task không đổi, quan hệ chính là hierarchy chứ không phải space, hoặc map chỉ báo cáo status.
- **Research anchors:** `APPLE-LAYOUT`, `FLUENT-LAYOUT`, `WAI-APG`, `WAI-STATUS`, `M3-CANONICAL`.
- **Acceptance focus:** Template dùng inline SVG/CSS map giả lập, không tile/network; chứng minh selection sync và Map/List compact parity.

## Prompt 06 — `timeline-audit-explorer`

- **Output boundary:** `knowledge/archetypes/discovery/timeline-audit-explorer/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Tái dựng trình tự, correlation và nguyên nhân của các event đã xảy ra.
- **Required region graph:** `audit-explorer → time-and-actor-filters → chronological-spine → correlation-groups → selected-event-detail → related-evidence`; timestamps là semantic axis.
- **Wide:** Timeline và detail rail đồng hiện; group markers và time scale vẫn đọc được khi detail mở.
- **Intermediate:** Detail thành drawer; timeline giữ width và reading continuity.
- **Compact:** Event stream một cột theo thời gian với group headings; detail là sheet/screen và Back trả đúng event anchor.
- **State obligations:** loading ranges, no events, partial source failure, late-arriving event, timezone display, expanded group, selected/deleted event, export pending/error.
- **Hard rejection:** Reject cho conversational activity feed, append-only raw logs, project scheduling hoặc status timeline không nhằm điều tra.
- **Research anchors:** `CARBON-TABLE`, `FLUENT-LAYOUT`, `WAI-FOCUS`, `WAI-STATUS`, `USWDS-PATTERNS`.
- **Acceptance focus:** Template phải cho filter time/actor, select event và mở compact detail mà chronological meaning không đổi.

## Prompt 07 — `immersive-gallery-lightbox`

- **Output boundary:** `knowledge/archetypes/discovery/immersive-gallery-lightbox/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Duyệt collection thị giác rồi inspect một asset ở kích thước lớn cùng metadata/actions thiết yếu.
- **Required region graph:** `gallery → collection-controls → adaptive-visual-grid → selected-stage → next-previous-filmstrip → metadata-actions`; image/media là content, không chỉ đại diện entity.
- **Wide:** Grid nhiều cột; stage/lightbox đủ lớn, metadata supporting, next/previous keyboard reachable.
- **Intermediate:** Giảm cột theo intrinsic asset size; metadata chuyển dưới stage hoặc collapsible.
- **Compact:** Grid 1–2 cột; viewer full-screen, controls không che media/focus, có close + next/previous ngoài gesture.
- **State obligations:** thumbnail/full asset loading, broken/unsupported media, selected index, zoom, metadata missing, action pending/success, focus open/close return.
- **Hard rejection:** Reject khi card chủ yếu dẫn tới entity detail, khi cần compare structured attributes, hoặc khi viewer chỉ là decorative hero.
- **Research anchors:** `SPECTRUM-COMPONENTS`, `FLUENT-LAYOUT`, `APPLE-LAYOUT`, `WAI-APG`, `WAI-OBSCURED`.
- **Acceptance focus:** Template dùng data URI/inline SVG assets, keyboard next/previous/Escape, reduced motion và deterministic focus return.

## Prompt 08 — `media-rails-browser`

- **Output boundary:** `knowledge/archetypes/discovery/media-rails-browser/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Khám phá một media library qua featured choice và các nhóm editorial có thứ bậc.
- **Required region graph:** `media-browser → featured-stage → category-rail ×n → bounded-rail-navigation → item-preview`; mỗi rail là một semantic group, không phải hàng card vô hạn đồng cấp.
- **Wide:** Hero + rail groups; mỗi rail own horizontal overflow và có visible previous/next khi cần.
- **Intermediate:** Hero giảm dominance; rail item count giảm nhưng group headings và continue path giữ nguyên.
- **Compact:** Featured content thành vertical lead; rails có bounded snap/controls hoặc chuyển thành short vertical groups với “view all”, không page-level horizontal scroll.
- **State obligations:** rail loading/empty/error riêng, current rail position, unavailable media, resume progress, preview open/close, new recommendations without focus theft.
- **Hard rejection:** Reject cho homogeneous searchable catalog, ranked query results, hoặc editorial article feed đọc theo thời gian.
- **Research anchors:** `SPECTRUM-COMPONENTS`, `SHOPIFY-HOME`, `FLUENT-LAYOUT`, `WAI-REFLOW`, `WAI-FOCUS`.
- **Acceptance focus:** Template phải chứng minh nhiều bounded overflow owners không tạo page overflow và mọi rail action dùng được bằng keyboard.

## Prompt 09 — `editorial-feed-reader`

- **Output boundary:** `knowledge/archetypes/discovery/editorial-feed-reader/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Scan nội dung mới/curated theo thứ tự biên tập hoặc thời gian rồi mở story đáng quan tâm.
- **Required region graph:** `editorial-feed → category-context → featured-story → story-stream → load-more-or-pagination → reading-position-feedback`; hierarchy editorial rõ hơn card equality.
- **Wide:** Featured story có thể ngang; supporting stories thành grid/list theo priority, không masonry làm hỏng reading order.
- **Intermediate:** Featured story reflow; supporting grid giảm cột theo title measure.
- **Compact:** Một story mỗi row theo semantic priority; load-more giữ footer/orientation và đưa focus có chủ đích tới item mới đầu tiên khi user yêu cầu.
- **State obligations:** initial loading, partial image failure, empty edition, load-more pending/error, updated/new-items notice, saved/read state, return-to-feed position.
- **Hard rejection:** Reject cho operational activity stream, catalog có facets/sort, hoặc media rails nơi playback choice là primary.
- **Research anchors:** `SHOPIFY-HOME`, `SPECTRUM-COMPONENTS`, `WAI-STATUS`, `WAI-FOCUS`, `FLUENT-LAYOUT`.
- **Acceptance focus:** Template phải minh họa featured→stream transformation và load-more không auto-scroll/steal focus.

## Prompt 10 — `hierarchical-content-browser`

- **Output boundary:** `knowledge/archetypes/discovery/hierarchical-content-browser/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Đi qua taxonomy/folder để xem index nội dung thuộc node hiện tại và giữ orientation trong cây.
- **Required region graph:** `content-browser → hierarchy-navigation → current-path → node-content-index → optional-context-preview`; hierarchy owns location, index owns peer selection.
- **Wide:** Tree/side navigation + content index; preview chỉ tồn tại khi đủ evidence và không biến thành third semantic level bắt buộc.
- **Intermediate:** Tree thành collapsible rail/drawer; current path luôn visible.
- **Compact:** Drill-down từng cấp với breadcrumb/back; node index theo sau heading, không ép tree desktop vào overlay mặc định cho mọi navigation.
- **State obligations:** expand/load node, empty node, permission/missing branch, deep-link path, rename/move external staleness, selected content, focus return.
- **Hard rejection:** Reject cho app/global navigation, flat catalog, many-to-many graph hoặc ba cấp độc lập cần đồng hiện.
- **Research anchors:** `SPECTRUM-COMPONENTS`, `ATLASSIAN-DESIGN`, `GITLAB-PATTERNS`, `WAI-FOCUS`, `WAI-REFLOW`.
- **Acceptance focus:** Template phải chứng minh deep path, compact drill-down và restore expansion/selection.

## Prompt 11 — `knowledge-graph-explorer`

- **Output boundary:** `knowledge/archetypes/discovery/knowledge-graph-explorer/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Khám phá quan hệ many-to-many, lần theo connections và inspect node/edge context.
- **Required region graph:** `graph-explorer → query-and-legend → graph-canvas → selected-node-or-edge → relationship-inspector → accessible-alternate-list`; graph và alternate view share selection.
- **Wide:** Graph primary + inspector; legend/filter supporting; zoom/pan bounded trong canvas.
- **Intermediate:** Inspector temporary/collapsible; graph giữ usable scale.
- **Compact:** Không thu graph tới vô nghĩa: default thành relationship list/path drill-down, graph là optional full-screen view; selection parity hai chiều.
- **State obligations:** graph loading/empty/too-large, hidden filters, selected node/edge, isolated node, layout recalculation, permission-redacted relation, alternate-list sync.
- **Hard rejection:** Reject cho single-parent hierarchy, dependency health monitoring, hoặc decorative network visualization không có exploration task.
- **Research anchors:** `APPLE-LAYOUT`, `CARBON-GRID`, `WAI-APG`, `WAI-REFLOW`, `WAI-FOCUS`.
- **Acceptance focus:** Template dùng inline SVG graph và semantic list equivalent; keyboard users phải khám phá cùng nodes/edges và mở cùng inspector.

## Prompt 12 — `parallel-document-reader`

- **Output boundary:** `knowledge/archetypes/discovery/parallel-document-reader/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Đọc và đối chiếu hai tài liệu đã có alignment ổn định — như source/translation hoặc edition A/B — mà không sửa hay resolve chúng.
- **Required region graph:** `parallel-reader → document-pair-context → alignment-navigator → source-manuscript ↔ counterpart-manuscript → alignment-notes-and-markers → shared-reading-position`; aligned segment ID là shared state.
- **Wide:** Hai manuscripts side-by-side với synchronized anchors; mỗi pane chỉ own vertical scroll khi synchronization và visible linkage vẫn deterministic.
- **Intermediate:** Một manuscript primary, counterpart thành collapsible pane; current aligned segment summary luôn visible.
- **Compact:** Toggle source/counterpart hoặc interleave aligned segments; chuyển view giữ exact anchor, zoom, note và reading position.
- **State obligations:** pair loading/partial error, unmatched segment, one-to-many alignment, active anchor, note/bookmark, version mismatch, text reflow/zoom, sync paused/recovered và focus source↔counterpart.
- **Hard rejection:** Reject cho editable reconciliation diff, single-document reader, localization authoring workbench hoặc unrelated two-column content.
- **Research anchors:** `APPLE-SPLIT`, `FLUENT-LAYOUT`, `WAI-REFLOW`, `WAI-FOCUS`, `WAI-OBSCURED`.
- **Acceptance focus:** Template phải sync anchors hai chiều, handle unmatched segment và transform side-by-side→toggle/interleaved without losing reading context.

## Prompt 13 — `calendar-agenda-browser`

- **Output boundary:** `knowledge/archetypes/discovery/calendar-agenda-browser/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Duyệt events theo ngày/tuần/tháng, tìm thời điểm liên quan và inspect event without scheduling resources.
- **Required region graph:** `calendar-browser → date-range-navigation → calendar-index ↔ agenda-list → selected-event-detail`; calendar và agenda share date/selection.
- **Wide:** Calendar và agenda/detail có thể đồng hiện; calendar owns bounded two-dimensional overflow nếu thật cần.
- **Intermediate:** Thu time horizon và chuyển detail thành overlay; không squeeze seven columns dưới minimum readable width.
- **Compact:** Agenda là primary; date picker/calendar là alternate view, event detail thành sheet/screen và giữ selected date.
- **State obligations:** range loading, no events, all-day/multi-day, timezone, recurring instance, selected/deleted event, partial calendar source error, today return.
- **Hard rejection:** Reject khi dominant task là allocate resources/collision resolution, audit past causality, hoặc edit one event form.
- **Research anchors:** `APPLE-LAYOUT`, `FLUENT-LAYOUT`, `WAI-APG`, `WAI-STATUS`, `WAI-REFLOW`.
- **Acceptance focus:** Template phải đồng bộ date/selection giữa calendar và agenda và chứng minh compact agenda-first transformation.

## Prompt 14 — `comparison-matrix`

- **Output boundary:** `knowledge/archetypes/discovery/comparison-matrix/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Chọn giữa ít nhất ba alternatives bằng cùng một attribute set, thấy differences quan trọng và kết thúc ở shortlist hoặc selection handoff thay vì own transaction mua.
- **Required region graph:** `comparison → contender-headers → attribute-groups → value-matrix → difference-controls → shortlist-or-selection-handoff`; attributes là stable axis và handoff không own billing, payment hoặc fulfillment.
- **Wide:** Full matrix với contender identity/header persistent trong bounded region; difference emphasis không chỉ bằng màu.
- **Intermediate:** Giới hạn contenders đồng hiện, có explicit chooser; attribute identity vẫn gắn với values.
- **Compact:** So hai selected contenders tại một thời điểm bằng grouped attribute rows/cards; đổi contender không mất shortlist.
- **State obligations:** contender add/remove, unavailable attribute, same/different filter, loading one contender, shortlist, incompatible option, decision pending.
- **Hard rejection:** Reject cho two-source diff/merge, narrative detail CTA, catalog nơi user chưa chọn contenders, hoặc plan-selection flow nơi billing term, payment và purchase consequence vẫn thuộc cùng primary transaction.
- **Research anchors:** `CARBON-TABLE`, `FLUENT-LAYOUT`, `WAI-APG`, `WAI-REFLOW`, `SPECTRUM-COMPONENTS`.
- **Acceptance focus:** Template phải chứng minh 4→2 contender transformation, header/value association, no page-level horizontal scroll và selection kết thúc bằng handoff chứ không mở payment transaction trong matrix.

## Prompt 15 — `manuscript-reader-notes`

- **Output boundary:** `knowledge/archetypes/discovery/manuscript-reader-notes/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Đọc long-form liên tục, định vị bằng outline và tham chiếu annotations/bookmarks mà không trở thành editor.
- **Required region graph:** `reader → document-outline → readable-manuscript → anchored-annotations → reading-position-and-bookmarks`; manuscript owns primary scroll.
- **Wide:** Outline + optimal-measure manuscript + notes; notes gắn anchors, không tạo competing free scroll.
- **Intermediate:** Chỉ một supporting rail persistent; rail còn lại thành drawer.
- **Compact:** Manuscript một cột; outline và notes là named sheets/disclosures, mở/đóng trả đúng text anchor.
- **State obligations:** document loading/partial error, saved reading position, active heading, note add/edit/error, unresolved anchor after revision, text zoom/reflow, focus annotation↔text.
- **Hard rejection:** Reject cho authoring document, short article with simple TOC, paged slide deck hoặc media playback.
- **Research anchors:** `APPLE-SPLIT`, `FLUENT-LAYOUT`, `WAI-REFLOW`, `WAI-FOCUS`, `WAI-OBSCURED`.
- **Acceptance focus:** Template phải chứng minh readable measure, scroll-spy không giật focus và note sheet restore đúng anchor.

## Prompt 16 — `paged-presentation-stage`

- **Output boundary:** `knowledge/archetypes/discovery/paged-presentation-stage/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Đi qua discrete pages/slides theo thứ tự, dùng thumbnails và optional presenter notes để định hướng.
- **Required region graph:** `presentation → thumbnail-navigator → primary-stage → previous-next-progress → presenter-notes`; current frame là shared state.
- **Wide:** Thumbnails + stage + notes khi fit; stage giữ aspect ratio và keyboard focus không bị canvas nuốt.
- **Intermediate:** Notes hoặc thumbnails thành collapsible region theo task priority.
- **Compact:** Stage + explicit previous/next/current count; thumbnails và notes mở thành sheets, không phụ thuộc swipe.
- **State obligations:** deck loading, missing frame, current/visited frame, notes unavailable, fullscreen enter/exit, end state, focus stage↔thumbnail.
- **Hard rejection:** Reject cho continuous media playback, editable canvas, long-form document hoặc assessment question navigator.
- **Research anchors:** `APPLE-SPLIT`, `APPLE-LAYOUT`, `FLUENT-LAYOUT`, `WAI-APG`, `WAI-FOCUS`.
- **Acceptance focus:** Template phải có deterministic frame navigation, direct thumbnail selection, Escape/return focus và compact parity.

## Prompt 17 — `media-theater-queue`

- **Output boundary:** `knowledge/archetypes/discovery/media-theater-queue/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Xem/nghe continuous media trong khi điều hướng queue, chapters hoặc transcript mà playback không bị ngắt do layout đổi.
- **Required region graph:** `media-theater → playback-stage → transport-controls → queue-or-chapters → synchronized-transcript → current-metadata`; playback is continuity owner.
- **Wide:** Large stage + secondary pane; queue/transcript dùng tabs chỉ khi cùng level và states được preserve.
- **Intermediate:** Stage trên, secondary content dưới hoặc drawer; transport luôn reachable.
- **Compact:** Player full-width hoặc mini-player; queue, chapters, transcript tuần tự; sticky player reserve space và yield trên short-height.
- **State obligations:** loading/buffering/error, play/pause/ended, current queue item, transcript unavailable/current cue, captions, playback speed, resume position, media removed.
- **Hard rejection:** Reject cho gallery asset inspection, narrative detail có video minh họa, hoặc paged presentation.
- **Research anchors:** `APPLE-LAYOUT`, `SPECTRUM-COMPONENTS`, `WAI-APG`, `WAI-OBSCURED`, `WAI-STATUS`.
- **Acceptance focus:** Không dùng remote media; template mô phỏng playback local bằng state machine, supports keyboard transport và no obscured transcript/focus.

## Prompt 18 — `service-navigation-hub`

- **Output boundary:** `knowledge/archetypes/discovery/service-navigation-hub/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Chọn đúng service/task branch từ một information architecture có nhóm rõ, kể cả khi search không dùng được.
- **Required region graph:** `service-hub → context-and-search → top-tasks → grouped-navigation-sections → status-or-contact-escalation`; links là routes theo intent, không peer products để compare.
- **Wide:** Một short top-task row rồi 2–3 grouped columns theo hierarchy; descriptions chỉ nơi giúp phân biệt.
- **Intermediate:** Hai cột; group order giữ semantic priority.
- **Compact:** Một cột theo priority; heading group + links, không biến tất cả thành giant cards hoặc nested accordions.
- **State obligations:** search unavailable, group empty, service degraded, personalized recent task absent, contact escalation, focus after search result update.
- **Hard rejection:** Reject cho catalog với filters/sort, global app navigation shell, marketing landing page hoặc one-service start page.
- **Research anchors:** `NHS-PATTERNS`, `USWDS-PATTERNS`, `GOVUK-PATTERNS`, `WAI-FOCUS`, `WAI-STATUS`.
- **Acceptance focus:** Template phải usable without search, có one primary link per group item và compact IA không mất route nào.

## Prompt 19 — `spatial-route-itinerary-explorer`

- **Output boundary:** `knowledge/archetypes/discovery/spatial-route-itinerary-explorer/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Hiểu và chọn giữa route alternatives bằng ordered stops/legs, duration, constraints và spatial context trước khi bắt đầu hành trình.
- **Required region graph:** `route-explorer → origin-destination-and-constraints → route-alternative-summary → geographic-route-stage ↔ ordered-itinerary → selected-leg-detail → start-or-share-route`; itinerary order và map geometry share leg identity.
- **Wide:** Map + itinerary đồng hiện; alternatives and selected leg stay synchronized, map owns bounded pan/zoom.
- **Intermediate:** Itinerary remains primary or supporting by evidence; selected leg summary and route chooser remain visible when map/detail collapses.
- **Compact:** Itinerary-first ordered sequence; map is alternate full-screen view, selected leg sheet returns exact stop/scroll/viewport state.
- **State obligations:** calculating/no route/partial route, alternative selected, closure or constraint warning, current leg, reroute stale result, map unavailable with itinerary parity, share/start pending and focus map↔leg.
- **Hard rejection:** Reject cho unordered place discovery, live asset dispatch editing, calendar scheduling, dependency graph hoặc decorative route map.
- **Research anchors:** `APPLE-LAYOUT`, `FLUENT-LAYOUT`, `WAI-APG`, `WAI-STATUS`, `WAI-REFLOW`.
- **Acceptance focus:** Template dùng inline SVG route, đổi alternative/leg, chứng minh map↔itinerary sync và compact itinerary works without map.
