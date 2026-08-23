# Batch 04 — Monitoring and decision archetypes (19 prompts)

Tệp này là **một prompt batch tự chứa**. Khi chạy ở nơi khác, đưa toàn bộ tệp cho agent để tạo đủ 19 leaf. Nếu chỉ chạy một mục, phải đưa kèm toàn bộ phần từ `Cách chạy` đến `Nguồn research dùng chung`; không tách riêng block prompt khỏi hợp đồng chung.

## Mục lục

| # | Archetype ID | Câu hỏi bố cục chính |
|---:|---|---|
| 01 | `live-operations-command-center` | Làm sao phát hiện và ứng phó incident trực tiếp? |
| 02 | `map-led-situation-monitor` | Làm sao giám sát tình trạng khi location là trục quyết định? |
| 03 | `dependency-topology-monitor` | Làm sao thấy health và blast radius trên graph phụ thuộc? |
| 04 | `timeline-status-monitor` | Làm sao theo dõi nhiều stream trạng thái trên một time axis chung? |
| 05 | `portfolio-health-matrix` | Làm sao scan hierarchy portfolio theo nhiều health dimensions? |
| 06 | `goal-cascade-progress` | Làm sao hiểu progress roll-up từ objective cha xuống outcome con? |
| 07 | `capacity-allocation-overview` | Làm sao thấy load, availability và imbalance giữa resources? |
| 08 | `funnel-path-analysis` | Làm sao tìm drop-off trên chuỗi stage có thứ tự? |
| 09 | `cohort-retention-grid` | Làm sao so hành vi các cohorts theo tuổi tương đối? |
| 10 | `benchmark-comparison-overview` | Làm sao hiểu vị trí tương đối so với peers hoặc baseline? |
| 11 | `scenario-sensitivity-modeler` | Làm sao chỉnh assumptions/constraints và thấy sensitivity trước khi chọn scenario? |
| 12 | `statistical-process-control-overview` | Làm sao phân biệt common variation với control-limit anomaly? |
| 13 | `risk-bow-tie-control-overview` | Làm sao nối threats, preventive controls, central event và mitigations? |
| 14 | `distributed-trace-waterfall-monitor` | Làm sao tìm critical path và failed span trong một distributed trace? |
| 15 | `authored-analytical-briefing` | Làm sao đọc một ordered analytical argument với evidence và appendix? |
| 16 | `process-variant-mining-overview` | Làm sao thấy actual paths, loops và bottlenecks thay vì giả định một funnel tuyến tính? |
| 17 | `risk-impact-likelihood-overview` | Làm sao ưu tiên risks theo likelihood, impact và mitigation state? |
| 18 | `market-depth-order-entry-monitor` | Làm sao hiểu live price ladder, depth và recent trades trước một order? |
| 19 | `bridge-contribution-waterfall-overview` | Làm sao giải thích baseline biến thành outcome qua ordered positive/negative contributions? |

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

## Prompt 01 — `live-operations-command-center`

- **Output boundary:** `knowledge/archetypes/overview/live-operations-command-center/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Phát hiện incident đang xảy ra, đánh giá impact và thực hiện response command an toàn dưới time pressure.
- **Required region graph:** `command-center → environment-time-context → critical-health-strip → telemetry-or-topology → active-incident-queue → selected-incident-command-surface → live-feedback`; urgency và command outcome là invariant.
- **Wide:** Health, primary telemetry/topology và incident queue đồng hiện; selected incident có command owner rõ, không dựng một mosaic KPI ngang hàng.
- **Intermediate:** Giữ critical health + incidents; telemetry secondary hoặc context chuyển thành drawer, không thu nhỏ mọi panel.
- **Compact:** Tuần tự `critical status → recommended next action → active incidents → incident detail/command`; command dock reserve space và yield ở short-height.
- **State obligations:** live/paused/stale data, no incidents, degraded source, incident acknowledged/escalated/resolved, command eligibility/confirming/pending/success/failure/conflict, reconnect and focus return.
- **Hard rejection:** Reject cho periodic executive reporting, heterogeneous home dashboard, raw log investigation hoặc repeated CRUD queue không có live urgency.
- **Research anchors:** `CARBON-GRID`, `FLUENT-LAYOUT`, `WAI-STATUS`, `WAI-OBSCURED`, `GITLAB-PATTERNS`.
- **Acceptance focus:** Template phải mô phỏng deterministic live updates, command confirmation và 3→2→1 region transformation mà không auto-steal focus.

## Prompt 02 — `map-led-situation-monitor`

- **Output boundary:** `knowledge/archetypes/overview/map-led-situation-monitor/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Giám sát trạng thái phân bố theo địa lý, dùng impact geometry để group hoặc reprioritize alerts và bind response command tới đúng affected area; nếu bỏ spatial relationship thì task hoặc command eligibility phải thay đổi.
- **Required region graph:** `situation-monitor → scope-time-severity → geographic-health-map ↔ impact-area-model ↔ alert-priority-queue → selected-area-evidence → response-command-surface → command-feedback`; alert priority, impact geometry and response command are independently required owners, and command target/eligibility derives from the selected impact area rather than a generic incident id.
- **Wide:** Map, prioritized alerts and response command/evidence đồng hiện; selected alert binds impact area and exact command target, legend never covers evidence.
- **Intermediate:** Alert priority + command remain primary while map/evidence alternate as supporting pane; selected impact summary always visible.
- **Compact:** Alert-first queue → textual impact-area model/evidence → response command; map may become an alternate full-screen verification view, but affected-area geometry, containment and exact command target remain explicit before commitment. Back restores queue severity/selection, impact area and command result.
- **State obligations:** map/telemetry loading, stale impact model, no active alerts, clustered status, alert reprioritized, selected area unavailable, command eligibility/confirm/pending/success/failure/conflict and geospatial alternate list.
- **Hard rejection:** Reject cho tìm place/choice, route planning, asset dispatch editing, decorative map có thể bỏ mà task không đổi, hoặc generic live operations command center nơi geography chỉ là một telemetry presentation and does not own alert grouping, impact boundary or command eligibility.
- **Research anchors:** `APPLE-LAYOUT`, `FLUENT-LAYOUT`, `CARBON-GRID`, `WAI-STATUS`, `WAI-REFLOW`.
- **Acceptance focus:** Template dùng inline SVG map + semantic impact-area list, proves area geometry changes alert priority or command eligibility, binds response to exact area and preserves that spatial contract through alert→impact evidence→command compact flow.

## Prompt 03 — `dependency-topology-monitor`

- **Output boundary:** `knowledge/archetypes/overview/dependency-topology-monitor/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Hiểu health, upstream/downstream dependencies và blast radius để ưu tiên response.
- **Required region graph:** `topology-monitor → environment-filter → dependency-graph → causal-impact-path → impact-ranked-entity-list → selected-node-evidence → response-owner-and-action`; causal path and response ownership are independent from graph inspection.
- **Wide:** Graph + causal impact path primary, ranked impacts and response owner/action supporting; zoom/pan bounded in graph.
- **Intermediate:** Inspector thành drawer; graph và prioritized impacted list giữ usable measures.
- **Compact:** Default dependency path/list, graph optional full-screen; selected node và impact chain parity hai view.
- **State obligations:** graph loading/too-large/partial source, healthy/degraded/unknown, selected node/edge, inferred causal path, hidden dependency, cycle, stale topology, impact ranking pending/error and response ownership conflict.
- **Hard rejection:** Reject cho knowledge discovery không có health, single-parent infrastructure tree, flat service KPI grid hoặc free-form diagram editing.
- **Research anchors:** `CARBON-GRID`, `FLUENT-LAYOUT`, `WAI-APG`, `WAI-STATUS`, `WAI-REFLOW`.
- **Acceptance focus:** Template phải trace ranked causal path to an independent response owner/action, provide accessible path alternative and do more than graph+health inspector.

## Prompt 04 — `timeline-status-monitor`

- **Output boundary:** `knowledge/archetypes/overview/timeline-status-monitor/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Theo dõi nhiều status streams trên một time axis chung để nhận ra overlap, delay và transition bất thường.
- **Required region graph:** `status-monitor → time-range-and-live-controls → shared-time-axis → status-swimlanes → current-marker → anomaly-summary → selected-interval-detail`.
- **Wide:** Time axis và nhiều swimlanes đồng hiện; detail supporting, timeline owns bounded horizontal navigation.
- **Intermediate:** Rút visible range hoặc group lanes; detail thành overlay, labels/axis không bị squeeze.
- **Compact:** Chọn một lane/time window, trình bày event/status sequence dọc; lane selector và “view timeline” giữ context.
- **State obligations:** live/follow/paused, range loading, no events, delayed/out-of-order updates, unknown interval, selected anomaly, timezone, reconnect and stale marker.
- **Hard rejection:** Reject cho retrospective audit causality, project plan editing, calendar event browsing hoặc raw append-only logs.
- **Research anchors:** `CARBON-GRID`, `FLUENT-LAYOUT`, `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`.
- **Acceptance focus:** Template phải chứng minh bounded time overflow, pause/follow behavior và compact lane-by-lane parity.

## Prompt 05 — `portfolio-health-matrix`

- **Output boundary:** `knowledge/archetypes/overview/portfolio-health-matrix/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Scan một portfolio hierarchy theo cùng health dimensions, tìm outlier và drill vào unit chịu trách nhiệm.
- **Required region graph:** `portfolio-monitor → scope-period-filters → hierarchy-summary → unit-by-dimension-matrix → exception-list → selected-unit-drilldown`; rows preserve parent-child roll-up.
- **Wide:** Hierarchy + matrix full; identity axis frozen trong bounded table region, exception list/detail supporting.
- **Intermediate:** Group/collapse dimensions theo priority; drilldown overlay, không silently hide dimensions.
- **Compact:** Chọn dimension hoặc unit trước, xem grouped summaries + exceptions; explicit switch giữ path và filters.
- **State obligations:** roll-up loading/partial, no units, unknown/not-applicable metric, collapsed branch, stale unit, selected outlier, threshold context, permission-redacted child.
- **Hard rejection:** Reject cho flat comparison decision, heterogeneous card dashboard, permissions matrix editing hoặc goal tree chỉ có một progress measure.
- **Research anchors:** `CARBON-TABLE`, `CARBON-GRID`, `WAI-APG`, `WAI-REFLOW`, `SALESFORCE-COMPONENTS`.
- **Acceptance focus:** Template phải giữ row/dimension association, no color-only health và compact unit/dimension switching không mất filters.

## Prompt 06 — `goal-cascade-progress`

- **Output boundary:** `knowledge/archetypes/overview/goal-cascade-progress/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Hiểu outcome progress roll-up từ objective cha xuống goals/results con và thấy contribution hoặc blocker.
- **Required region graph:** `goal-overview → period-owner-context → objective-tree → rollup-progress → at-risk-goals → selected-goal-contribution-detail`; hierarchy và contribution semantics bắt buộc.
- **Wide:** Goal tree + progress/owner columns, at-risk detail supporting; expansion không làm mất current objective.
- **Intermediate:** Giảm secondary columns, detail drawer; progress/owner/status vẫn gắn mỗi node.
- **Compact:** Drill-down theo objective path; mỗi row priority summary, selected goal detail screen và back restore expanded path.
- **State obligations:** no goals, roll-up calculating/stale, blocked/at-risk/on-track with text, missing owner, dependency, archived period, selected goal update conflict.
- **Hard rejection:** Reject cho portfolio multi-dimension matrix, generic task checklist, linear stage flow hoặc dashboard cards không có cascade.
- **Research anchors:** `SALESFORCE-COMPONENTS`, `ATLASSIAN-DESIGN`, `CARBON-TABLE`, `WAI-STATUS`, `WAI-REFLOW`.
- **Acceptance focus:** Template phải minh họa parent roll-up, contribution drill và compact path continuity.

## Prompt 07 — `capacity-allocation-overview`

- **Output boundary:** `knowledge/archetypes/overview/capacity-allocation-overview/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Nhận ra overload, underuse và availability gaps giữa resources trong một planning horizon trước khi mở allocation workbench.
- **Required region graph:** `capacity-overview → horizon-scope-controls → aggregate-demand-supply → resource-capacity-lanes → imbalance-exceptions → selected-resource-breakdown`.
- **Wide:** Summary + resource/time lanes; selected breakdown supporting, lanes own bounded horizontal overflow.
- **Intermediate:** Thu horizon hoặc group resources; exception list nâng priority, detail overlay.
- **Compact:** Exception-first resource list; chọn resource mở capacity-by-period detail, timeline view optional.
- **State obligations:** capacity loading/unknown, zero demand, over/under threshold, leave/unavailable period, forecast vs actual, stale allocation, selected resource permission.
- **Hard rejection:** Reject khi user trực tiếp drag bookings/resolve collisions, khi chỉ xem schedule events, hoặc khi metrics không có common capacity unit.
- **Research anchors:** `CARBON-GRID`, `FLUENT-LAYOUT`, `WAI-REFLOW`, `WAI-STATUS`, `ATLASSIAN-DESIGN`.
- **Acceptance focus:** Template phải phân biệt overview diagnosis với scheduler editing và compact prioritize imbalances.

## Prompt 08 — `funnel-path-analysis`

- **Output boundary:** `knowledge/archetypes/overview/funnel-path-analysis/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Tìm conversion/drop-off trong một ordered stage path và drill vào segment hoặc transition gây mất mát.
- **Required region graph:** `funnel-analysis → cohort-period-filters → ordered-stage-funnel → transition-metrics → dropoff-priority → selected-transition-breakdown`.
- **Wide:** Funnel/stage visualization + transition table/detail; order và denominators luôn visible.
- **Intermediate:** Visualization giữ labels, detail xuống dưới hoặc drawer; không giảm font/ticks tới khó đọc.
- **Compact:** Ordered stage list với count/rate/drop-off từng transition; chart optional, breakdown sheet giữ selected segment.
- **State obligations:** loading, no traffic, partial stages, denominator changed, segment apply/reset, selected transition, statistically sparse result, comparison period unavailable.
- **Hard rejection:** Reject cho lifecycle operational board, cohort-by-age grid, generic KPI dashboard hoặc nonlinear path graph.
- **Research anchors:** `CARBON-GRID`, `GITLAB-PATTERNS`, `WAI-STATUS`, `WAI-REFLOW`, `SPECTRUM-COMPONENTS`.
- **Acceptance focus:** Template phải giữ stage order/denominators và compact list conveys same drop-off evidence without chart dependence.

## Prompt 09 — `cohort-retention-grid`

- **Output boundary:** `knowledge/archetypes/overview/cohort-retention-grid/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** So cohorts theo tuổi tương đối để nhận ra retention/change pattern không bị calendar date làm lệch.
- **Required region graph:** `cohort-analysis → definition-period-filters → cohort-by-age-grid → legend-and-baseline → cohort-trend-detail → selected-cell-explanation`.
- **Wide:** Full bounded grid với cohort rows, age columns, frozen labels và accessible values.
- **Intermediate:** Thu visible age range hoặc selected cohort detail; không silently remove older periods.
- **Compact:** Chọn cohort hoặc age slice, xem trend/list values; matrix optional scroller có frozen identity và instructions.
- **State obligations:** incomplete young cohort, missing/not-applicable cell, low sample, definition changed, baseline loading, selected cell, filter reset, export pending.
- **Hard rejection:** Reject cho calendar heatmap, flat benchmark, funnel stages hoặc decorative color grid không có exact values.
- **Research anchors:** `CARBON-TABLE`, `CARBON-GRID`, `WAI-APG`, `WAI-REFLOW`, `WAI-STATUS`; add [Google Analytics Cohort exploration](https://support.google.com/analytics/answer/9670133?hl=en) for official cohort-by-relative-period semantics without treating its product configuration as archetype truth.
- **Acceptance focus:** Template phải expose numeric text/headers, never color-only, và compact cohort slice retains comparison meaning.

## Prompt 10 — `benchmark-comparison-overview`

- **Output boundary:** `knowledge/archetypes/overview/benchmark-comparison-overview/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Hiểu vị trí tương đối của một subject so với peers, target hoặc historical baseline trên common metrics.
- **Required region graph:** `benchmark-overview → subject-peer-period-context → primary-relative-position → metric-comparison-set → distribution-or-range → selected-metric-explanation`.
- **Wide:** Relative position + coordinated metric comparisons; distribution/context supports interpretation, không chỉ rank cards.
- **Intermediate:** Primary metric remains; secondary metrics stack hoặc tabs có preserved state.
- **Compact:** One metric at a time with subject, benchmark, range and explanation together; metric selector giữ peer set.
- **State obligations:** benchmark loading/unavailable, incomparable definitions, low sample, peer privacy threshold, selected metric, target changed, current/previous period.
- **Hard rejection:** Reject cho choosing products via attribute matrix, portfolio hierarchy, experiment variants hoặc dashboard heterogeneous status.
- **Research anchors:** `CARBON-GRID`, `SPECTRUM-COMPONENTS`, `WAI-STATUS`, `WAI-REFLOW`, `FLUENT-LAYOUT`.
- **Acceptance focus:** Template phải luôn nêu subject/baseline/unit và compact không tách number khỏi comparison context.

## Prompt 11 — `scenario-sensitivity-modeler`

- **Output boundary:** `knowledge/archetypes/work/scenario-sensitivity-modeler/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Edit model assumptions/constraints, recalculate scenarios and see which inputs drive outcome sensitivity before committing a decision.
- **Required region graph:** `sensitivity-modeler → model-horizon-context → assumption-editor → constraint-and-validity-model → recalculation-status → sensitivity-surface → scenario-outcome-comparison → decision-snapshot`; sensitivity is an independent analytical owner.
- **Wide:** Assumption/constraint editor + sensitivity surface + outcome comparison can be inspected together; changed input links to affected output.
- **Intermediate:** Editor remains primary; sensitivity and comparison alternate as named supporting panes with pending state visible.
- **Compact:** Choose assumption → edit/validate → recalculate → inspect sensitivity → compare scenarios → save snapshot; each stage preserves model version.
- **State obligations:** pristine/dirty assumptions, invalid constraint, calculating/error/stale, sensitivity unavailable, scenario add/remove, baseline locked, model version conflict and snapshot save.
- **Hard rejection:** Reject cho passive forecast overview, simple benchmark, one-form estimate or palette/canvas automation builder.
- **Research anchors:** `CARBON-GRID`, `FLUENT-LAYOUT`, `WAI-STATUS`, `WAI-FOCUS`, `SPECTRUM-COMPONENTS`.
- **Acceptance focus:** Template must edit assumptions, show constraint error, recalculate sensitivity locally and bind input changes to scenario outcomes across 3→2→staged compact topology.

## Prompt 12 — `statistical-process-control-overview`

- **Output boundary:** `knowledge/archetypes/overview/statistical-process-control-overview/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Distinguish common-cause variation from rule-based process anomalies and inspect evidence around one violation.
- **Required region graph:** `process-control → process-metric-period-context → control-chart-with-limits → rule-violation-markers → process-capability-distribution → anomaly-register → selected-anomaly-evidence`.
- **Wide:** Control chart primary + capability distribution/anomaly evidence; limits and rules are explicit, not decorative bands.
- **Intermediate:** Chart retains readable run length; anomaly register rises in priority, selected evidence drawer.
- **Compact:** Anomaly-first list → selected point context → compact chart segment → capability summary; full chart optional bounded view.
- **State obligations:** baseline calculating/locked, in-control, rule violation, limit shift, missing point, late data, selected anomaly, rule disabled, insufficient sample and investigation status.
- **Hard rejection:** Reject cho generic KPI trend, live status timeline, benchmark distribution or editable process workflow.
- **Research anchors:** `CARBON-GRID`, `CARBON-TABLE`, `WAI-STATUS`, `WAI-REFLOW`, `SPECTRUM-COMPONENTS`.
- **Acceptance focus:** Template must expose exact limits/rule text, simulate anomaly selection and make compact anomaly evidence equivalent without color-only chart reading.

## Prompt 13 — `risk-bow-tie-control-overview`

- **Output boundary:** `knowledge/archetypes/overview/risk-bow-tie-control-overview/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Understand how threats can cause one central event and how preventive/recovery controls break paths to consequences.
- **Required region graph:** `bow-tie-overview → risk-scope-and-central-event → threat-paths → preventive-controls → central-event → consequence-paths → recovery-mitigations → control-gap-register`; two directional halves and central event are invariant.
- **Wide:** Full left-to-right bow-tie + selected path/control detail; graph has semantic list alternative.
- **Intermediate:** Keep central event and one side at a time with explicit Threats/Consequences switch; control-gap summary persistent.
- **Compact:** Central event first, then separate threat→prevention and consequence→mitigation path lists; selected control detail is a stage, not a squeezed graph.
- **State obligations:** path loading, threat assessed/unassessed, control effective/degraded/missing, consequence severity, selected path, evidence stale, gap owner, mitigation pending and alternate-list sync.
- **Hard rejection:** Reject cho impact×likelihood matrix, dependency graph health, generic compliance matrix or editable workflow.
- **Research anchors:** `CARBON-GRID`, `FLUENT-LAYOUT`, `WAI-APG`, `WAI-STATUS`, `WAI-REFLOW`.
- **Acceptance focus:** Template uses inline SVG + semantic path lists, switches two halves at intermediate/compact and never loses central-event/control associations.

## Prompt 14 — `distributed-trace-waterfall-monitor`

- **Output boundary:** `knowledge/archetypes/overview/distributed-trace-waterfall-monitor/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Find the critical path, latency contribution and failure boundary inside one distributed trace.
- **Required region graph:** `trace-monitor → trace-identity-and-timing → span-tree ↔ bounded-time-waterfall → critical-path-summary → selected-span-input-output → related-error-evidence`; tree hierarchy and time geometry share span selection.
- **Wide:** Span tree + synchronized waterfall primary, selected span I/O supporting; waterfall owns horizontal overflow only.
- **Intermediate:** Span tree collapses or narrows; waterfall + selected evidence stay usable and critical path summary remains visible.
- **Compact:** Critical-path span list is primary; selected span detail includes relative timing, waterfall optional full-screen and returns exact span.
- **State obligations:** trace loading/partial/truncated, clock skew, span success/error/unknown, selected span, collapsed subtree, critical path calculating, payload redacted, retry/sample unavailable.
- **Hard rejection:** Reject cho dependency topology across services, streaming raw logs, job step timeline or generic performance dashboard.
- **Research anchors:** `CARBON-GRID`, `FLUENT-LAYOUT`, `WAI-APG`, `WAI-STATUS`, `WAI-REFLOW`.
- **Acceptance focus:** Template must sync tree↔waterfall↔span I/O, expose timing text and make compact critical path usable without a two-axis chart.

## Prompt 15 — `authored-analytical-briefing`

- **Output boundary:** `knowledge/archetypes/detail/authored-analytical-briefing/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Read a curated analytical argument from executive conclusion through ordered findings, annotated evidence and methodological appendix.
- **Required region graph:** `analytical-briefing → thesis-and-scope → ordered-finding-navigation → finding-narrative → annotated-evidence-figure → implication-and-caveat → methods-and-source-appendix`; authored order is authority, not interactive cross-filter.
- **Wide:** Finding navigation + readable narrative/evidence; current figure may support its finding but never become a sticky dashboard grid.
- **Intermediate:** Navigation becomes outline disclosure; evidence follows the exact claim it supports.
- **Compact:** One ordered narrative with evidence inline per finding and appendix disclosures; deep links restore heading/figure anchor.
- **State obligations:** briefing loading/partial figure error, active finding, source unavailable, revised edition, caveat expanded, print/export, deep-link and reduced-motion/static visualization.
- **Hard rejection:** Reject cho cross-filter analytics dashboard, scrollytelling coordinated visual, general manuscript reader or persuasive product detail.
- **Research anchors:** `CARBON-GRID`, `APPLE-LAYOUT`, `WAI-REFLOW`, `WAI-FOCUS`, `WAI-STATUS`.
- **Acceptance focus:** Template must preserve authored conclusion→finding→evidence→caveat order and transform navigation/figures without inventing exploratory controls.

## Prompt 16 — `process-variant-mining-overview`

- **Output boundary:** `knowledge/archetypes/overview/process-variant-mining-overview/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Khám phá actual process paths từ event evidence, tìm loops, deviations và bottlenecks thay vì giả định mọi subject đi theo một funnel tuyến tính.
- **Required region graph:** `process-mining → case-period-segment-filters → directed-process-map → variant-frequency-list → duration-and-bottleneck-evidence → selected-variant-trace`; map và trace share event semantics.
- **Wide:** Process map primary + ranked variants/bottlenecks; selected trace supporting, graph owns bounded pan/zoom.
- **Intermediate:** Giữ process map và one supporting region; variant/trace còn lại thành drawer, active path luôn named.
- **Compact:** Variant list và bottleneck summary là primary; chọn variant mở ordered trace, process map optional full-screen với equivalent selection.
- **State obligations:** mining/loading, no cases, partial event log, inferred/missing transition, rare variant, loop, selected path, filter recalculation, stale model, privacy threshold.
- **Hard rejection:** Reject cho fixed linear funnel, editable workflow builder, dependency health graph, retrospective single-case audit timeline hoặc decorative Sankey.
- **Research anchors:** `CARBON-GRID`, `FLUENT-LAYOUT`, `WAI-APG`, `WAI-STATUS`, `WAI-REFLOW`.
- **Acceptance focus:** Template phải đồng bộ map↔variant list↔trace, có accessible alternate path representation và compact không phụ thuộc graph.

## Prompt 17 — `risk-impact-likelihood-overview`

- **Output boundary:** `knowledge/archetypes/overview/risk-impact-likelihood-overview/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Ưu tiên risks bằng likelihood, impact, exposure và mitigation state rồi inspect evidence của một risk.
- **Required region graph:** `risk-overview → scope-horizon-category-filters → impact-by-likelihood-matrix ↔ prioritized-risk-register → mitigation-summary → selected-risk-evidence`; matrix và register share selection.
- **Wide:** Risk matrix + prioritized register/detail; each plotted risk has text/list equivalent and axes remain explicit.
- **Intermediate:** Matrix và register chuyển primary/supporting theo task; detail drawer, active risk summary remains visible.
- **Compact:** Prioritized register là default; matrix là alternate full-screen view, selected risk opens evidence/mitigation screen and Back restores rank/filter.
- **State obligations:** unassessed/accepted/mitigating/escalated/closed, unknown likelihood/impact, overdue mitigation, selected risk, stale assessment, owner missing, permission-redacted evidence.
- **Hard rejection:** Reject cho portfolio health matrix, generic issue queue, scenario forecast, permissions matrix editing hoặc heatmap chỉ dùng màu mà không có risk identities.
- **Research anchors:** `CARBON-GRID`, `CARBON-TABLE`, `WAI-APG`, `WAI-STATUS`, `WAI-REFLOW`; add [NIST SP 800-30 Rev. 1](https://csrc.nist.gov/pubs/sp/800/30/r1/final) for official likelihood/impact risk-assessment semantics without importing federal scoring policy as product truth.
- **Acceptance focus:** Template phải sync plot/register selection, expose exact likelihood/impact bằng text và compact mặc định register-first.

## Prompt 18 — `market-depth-order-entry-monitor`

- **Output boundary:** `knowledge/archetypes/overview/market-depth-order-entry-monitor/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Understand a live two-sided price ladder, depth and recent execution flow before composing and monitoring one bounded order.
- **Required region graph:** `market-monitor → instrument-session-context → bid-ask-price-ladder → depth-visualization → recent-trade-tape → selected-price-context → order-entry-and-risk-summary → order-feedback`; ladder is a coordinate owner, not a record list.
- **Wide:** Ladder/depth + trade tape + order entry/risk can be inspected together; current price and selected level synchronize all regions.
- **Intermediate:** Ladder stays primary; trade tape becomes collapsible and order entry retains selected price/risk summary.
- **Compact:** Price ladder first, selected level → order entry → risk review; depth/tape become named secondary views and sticky order action yields on short-height.
- **State obligations:** live/paused/stale market, crossed/empty book, selected price moved, quantity invalid, risk limit, order confirming/pending/partial/filled/rejected/cancelled and reconnect.
- **Hard rejection:** Reject cho product comparison, operational order collection, generic live dashboard or static financial report.
- **Research anchors:** `CARBON-TABLE`, `FLUENT-LAYOUT`, `WAI-STATUS`, `WAI-OBSCURED`, `WAI-REFLOW`.
- **Acceptance focus:** Template must simulate deterministic ladder/tape updates without focus theft, bind order to exact price/quantity and preserve compact risk review.

## Prompt 19 — `bridge-contribution-waterfall-overview`

- **Output boundary:** `knowledge/archetypes/overview/bridge-contribution-waterfall-overview/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Explain how a baseline becomes an ending outcome through an ordered sequence of positive, negative and subtotal contributions.
- **Required region graph:** `bridge-overview → baseline-period-scope → contribution-waterfall → ordered-contribution-ledger → subtotal-and-ending-outcome → selected-contribution-explanation → reconciliation-evidence`; chart and ledger share exact order/value.
- **Wide:** Waterfall + ordered ledger/explanation; baseline, subtotals and outcome remain labeled with units.
- **Intermediate:** Chart retains core sequence while explanation moves below/drawer; ledger never disappears.
- **Compact:** Ordered contribution ledger is primary with signed values/subtotals; chart optional bounded view, selected contribution detail follows its row.
- **State obligations:** loading, no change, positive/negative/zero, residual/unreconciled amount, hidden group expanded, selected contribution, comparison period unavailable, definition changed and export.
- **Hard rejection:** Reject cho general analytics dashboard, funnel, benchmark, static KPI cards or cashflow table without baseline→contribution→outcome semantics.
- **Research anchors:** `CARBON-GRID`, `CARBON-TABLE`, `WAI-STATUS`, `WAI-REFLOW`, `SPECTRUM-COMPONENTS`.
- **Acceptance focus:** Template must reconcile baseline + contributions = outcome, expose exact ledger values and make compact understandable without chart geometry.
