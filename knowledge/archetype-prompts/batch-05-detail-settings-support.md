# Batch 05 — Detail, configuration and support archetypes (19 prompts)

Tệp này là **một prompt batch tự chứa** cho các màn detail, configuration, support và specialized recovery. Khi chạy ở nơi khác, đưa toàn bộ tệp cho agent để tạo đủ 19 leaf. Nếu chỉ chạy một mục, phải đưa kèm toàn bộ phần từ `Cách chạy` đến `Nguồn research dùng chung`; không tách riêng block prompt khỏi hợp đồng chung.

## Mục lục

| # | Archetype ID | Câu hỏi bố cục chính |
|---:|---|---|
| 01 | `enterprise-record-home` | Làm sao hiểu một enterprise record, lifecycle và related context mà không biến detail thành form hoặc dashboard? |
| 02 | `editable-record-with-summary-rail` | Làm sao chỉnh một record dài trong khi giữ summary hỗ trợ và save boundary rõ? |
| 03 | `job-run-detail-timeline` | Làm sao hiểu một execution đang chạy hoặc đã fail từ steps, logs và artifacts? |
| 04 | `order-fulfillment-tracker` | Làm sao theo dõi một order qua nhiều shipment, exception và next action? |
| 05 | `evidence-led-case-resolution-dossier` | Làm sao đối chiếu criteria, evidence, contradictions và rationale để resolve một case? |
| 06 | `bitemporal-record-validity-detail` | Làm sao hiểu record theo cả valid time và transaction time? |
| 07 | `effective-setting-provenance-inspector` | Làm sao truy ra effective value từ scope, inheritance và override chain? |
| 08 | `independent-preference-autosave-center` | Làm sao chỉnh nhiều preferences độc lập với per-control save/undo rõ ràng? |
| 09 | `configuration-dependency-resolver` | Làm sao lần theo dependency violations và preview một resolution an toàn? |
| 10 | `constrained-quota-allocation-editor` | Làm sao phân bổ một conserved total qua recipients mà luôn giữ remaining balance? |
| 11 | `support-handoff-redaction-review` | Làm sao redact evidence bundle và preview chính xác thứ recipient sẽ nhận? |
| 12 | `cross-scope-access-conflict-resolver` | Làm sao so permission deltas giữa scopes và chọn switch/request action? |
| 13 | `offline-draft-preservation-recovery` | Làm sao đối chiếu local draft với server state và chọn cách preserve/sync? |
| 14 | `credential-rotation-cutover-console` | Làm sao chuyển mọi consumer từ credential cũ sang mới, verify toàn cục rồi revoke an toàn? |
| 15 | `live-support-session-room` | Làm sao giữ shared session, conversation, diagnostics và control handoff cùng lúc? |
| 16 | `interactive-code-example-lab` | Làm sao đọc concept, sửa code và quan sát preview/console đồng bộ? |
| 17 | `diagnostic-evidence-bundle-review` | Làm sao gom artifacts đa nguồn, kiểm privacy/completeness và xuất một manifest? |
| 18 | `multi-track-timeline-editor` | Làm sao sắp clips trên nhiều tracks, giữ playhead context và verify rendered composition? |
| 19 | `causal-root-analysis-dossier` | Làm sao kiểm hypothesis tree, evidence và eliminated causes trước root-cause conclusion? |

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

## Prompt 01 — `enterprise-record-home`

- **Output boundary:** `knowledge/archetypes/detail/enterprise-record-home/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Hiểu identity, lifecycle, key facts và next action của đúng một enterprise record trong khi related context vẫn tham chiếu được.
- **Required region graph:** `record-home → location-and-identity-header → lifecycle-summary → primary-record-sections → related-context → record-actions`; identity và lifecycle là orientation owners, primary sections own record meaning, related context chỉ hỗ trợ quyết định tại record hiện tại.
- **Wide:** Header span toàn content; primary record và related-context rail đồng hiện khi rail không làm hẹp measure của record; record actions nằm gần outcome chúng tác động.
- **Intermediate:** Related context mất persistence và thành disclosure/drawer; identity, lifecycle state và primary record sections vẫn đồng hiện trong một reading path.
- **Compact:** Tuần tự hóa `identity → current lifecycle state → key facts → primary sections → actions → related context`; section navigation thay tabs không còn fit và Back giữ active section.
- **State obligations:** identity/loading, partial field failure, no related records, permission-redacted section, lifecycle transition pending/success/failure, stale concurrent update, archived/deleted record và focus action→status→record.
- **Hard rejection:** Reject cho persuasive narrative với decision rail, page có editing là dominant task, collection triage/bulk operations, hoặc dashboard của nhiều records.
- **Research anchors:** `SALESFORCE-COMPONENTS`, `ATLASSIAN-DESIGN`, `APPLE-SPLIT`, `WAI-FOCUS`, `WAI-STATUS`; kiểm thêm [Salesforce Record Form](https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/lightning-record-form.html) và [Atlassian Page Header](https://atlassian.design/components/page-header/).
- **Acceptance focus:** Template phải cho đổi record section, mở related context ở topology temporary và mô phỏng lifecycle action mà identity, active section, focus và stale recovery không mất.

## Prompt 02 — `editable-record-with-summary-rail`

- **Output boundary:** `knowledge/archetypes/detail/editable-record-with-summary-rail/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Tạo hoặc chỉnh một structured record dài, đối chiếu summary hỗ trợ và hoàn tất một save/discard transaction rõ ràng.
- **Required region graph:** `record-editor → breadcrumb-and-editor-header → defining-fields → supporting-field-sections → summary-rail → validation-and-save-boundary`; defining fields own record identity, summary phản chiếu draft nhưng không trở thành nguồn input thứ hai.
- **Wide:** Editor là cột chính; summary rail đồng hiện với status, derived totals hoặc preview; save boundary reserve space và không che field cuối.
- **Intermediate:** Summary rail hạ xuống inline summary hoặc temporary panel; editor giữ field grouping và dirty-state visibility.
- **Compact:** Một form sequence theo dependency; summary là named disclosure trước final actions; sticky save boundary tự yield ở short-height và không lặp action ở header.
- **State obligations:** field schema loading, ready pristine/dirty, inline validation, multi-error summary, derived summary updating, save pending/success/error, discard confirmation, permission/read-only, stale conflict và focus error-summary→field.
- **Hard rejection:** Reject cho independent settings groups, linear multi-step wizard, narrative detail với CTA rail, hoặc một centered single-field task.
- **Research anchors:** `SHOPIFY-HOME`, `SALESFORCE-COMPONENTS`, `GITLAB-PATTERNS`, `WAI-FOCUS`, `WAI-OBSCURED`; kiểm thêm [Shopify Details template](https://shopify.dev/docs/api/app-home/patterns/templates/details), [Salesforce Record Form](https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/lightning-record-form.html) và [GitLab Forms](https://design.gitlab.com/patterns/forms/).
- **Acceptance focus:** Template phải cho sửa fields, cập nhật summary local-only, phát validation summary, save pending/success và stale conflict; compact không được chỉ stack nguyên desktop rail.

## Prompt 03 — `job-run-detail-timeline`

- **Output boundary:** `knowledge/archetypes/detail/job-run-detail-timeline/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Xác định một execution đang ở bước nào, vì sao dừng hoặc fail, và action recovery nào áp dụng cho chính run đó.
- **Required region graph:** `run-detail → run-identity-status-actions → ordered-step-timeline → active-or-failed-step → bounded-log-output → artifacts → run-metadata`; ordered steps own progress meaning, log owns only technical overflow, artifacts và metadata support diagnosis.
- **Wide:** Timeline và log là primary work area; metadata/artifacts rail đồng hiện; cancel/retry actions gắn với run status chứ không trôi trong log.
- **Intermediate:** Metadata mất persistence và thành disclosure; timeline, current/failed step và bounded log vẫn giữ usable width.
- **Compact:** Ưu tiên `status → current/failed step → recovery action → log excerpt → artifacts → metadata`; full log mở trong một bounded region/screen với explicit close/back.
- **State obligations:** queued, running with incremental updates, succeeded, failed, cancelling/cancelled, retry pending, stream disconnected/stale, log empty/truncated, artifact pending/unavailable, permission và announced step/status changes.
- **Hard rejection:** Reject cho dashboard nhiều runs, append-only log explorer không có step model, forensic audit timeline, hoặc operational collection workbench.
- **Research anchors:** `GITLAB-PATTERNS`, `SALESFORCE-COMPONENTS`, `SPECTRUM-COMPONENTS`, `WAI-STATUS`, `WAI-OBSCURED`; kiểm thêm [GitLab Loading](https://design.gitlab.com/patterns/loading), [Salesforce Progress Indicator](https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/lightning-progress-indicator.html) và [Spectrum Progress Circle](https://spectrum.adobe.com/page/progress-circle/).
- **Acceptance focus:** Template dùng state machine local cho queued→running→failed/success, chọn step và retry; log là overflow owner duy nhất và mọi update được announce không giật focus.

## Prompt 04 — `order-fulfillment-tracker`

- **Output boundary:** `knowledge/archetypes/detail/order-fulfillment-tracker/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Reconcile one order whose externally advanced fulfillment is split across two or more independent shipment progressions, then act on cross-shipment exceptions.
- **Required region graph:** `fulfillment-detail → order-identity → derived-overall-fulfillment → parallel-shipment-groups ×n → cross-shipment-exception-priority → carrier-event-histories → customer-resolution-actions`; each shipment is an independent external progression owner and overall state is derived, never user-advanced.
- **Wide:** Stage summary và shipment groups là main column; order summary/action rail đồng hiện; exception region chiếm ưu tiên khi có unresolved issue.
- **Intermediate:** Summary rail hạ xuống; multiple shipments giữ group identity và không bị trộn thành một timeline giả.
- **Compact:** Đặt `order identity → current overall state → unresolved exception/action → shipment groups → history → supporting summary`; full stage history là disclosure, không ép toàn path nằm ngang.
- **State obligations:** split/unfulfilled/partial, per-shipment in-transit/delivered/delayed/failed/returned, contradictory carrier states, stale tracking source, derived overall status, cross-shipment resolution pending/success/error, permission and timezone.
- **Hard rejection:** Reject cho single linear shipment, user-controlled stage gate, checkout/cart, generic enterprise record, audit investigation or table managing many orders.
- **Research anchors:** `SHOPIFY-HOME`, `SALESFORCE-COMPONENTS`, `USWDS-PATTERNS`, `WAI-STATUS`, `WAI-REFLOW`; kiểm thêm [Shopify Details template](https://shopify.dev/docs/api/app-home/patterns/templates/details), [Salesforce Progress Indicator](https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/lightning-progress-indicator.html) và [USWDS Step Indicator](https://designsystem.digital.gov/components/step-indicator/).
- **Acceptance focus:** Template phải mô phỏng nhiều shipments, một delayed exception và resolution transition; compact giữ exception trước history và không suy overall success từ màu.

## Prompt 05 — `evidence-led-case-resolution-dossier`

- **Output boundary:** `knowledge/archetypes/detail/evidence-led-case-resolution-dossier/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Resolve one bounded case by testing explicit criteria against an evidence register, contradictions and gaps, then recording a reviewable rationale.
- **Required region graph:** `case-dossier → case-question-and-criteria → criteria-status-index ↔ evidence-register → contradiction-and-gap-summary → selected-evidence-detail → resolution-rationale → decision-record`; criteria and evidence are independent many-to-many owners.
- **Wide:** Criteria index, evidence register/detail and rationale can be inspected together; every conclusion links to supporting and contradicting evidence.
- **Intermediate:** Criteria stays visible while evidence detail becomes temporary; gap/contradiction summary remains before rationale.
- **Compact:** Criteria index → selected criterion/evidence → gaps → rationale review; Back preserves criterion, evidence and draft rationale.
- **State obligations:** evidence loading/missing/stale/redacted, criterion met/not-met/uncertain, contradiction open/resolved, gap owner, rationale draft/conflict, decision pending/recorded/reopened and focus criterion↔evidence.
- **Hard rejection:** Reject cho generic enterprise record, support conversation, approval composer, audit event, simple list-detail inspection, hoặc causal root analysis nơi hypothesis elimination và corrective-action linkage—not explicit decision criteria—own the conclusion.
- **Research anchors:** `GOVUK-PATTERNS`, `USWDS-PATTERNS`, `CARBON-TABLE`, `WAI-FOCUS`, `WAI-STATUS`; add [GOV.UK Check answers](https://design-system.service.gov.uk/patterns/check-answers/).
- **Acceptance focus:** Template must link criteria↔evidence, surface contradiction/gap and block final rationale until required evidence obligations are resolved.

## Prompt 06 — `bitemporal-record-validity-detail`

- **Output boundary:** `knowledge/archetypes/detail/bitemporal-record-validity-detail/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Determine what a record was valid for in the real world versus when the system knew or corrected that state.
- **Required region graph:** `bitemporal-detail → record-identity → valid-time-axis × transaction-time-axis → interval-state-grid → selected-state-facts → correction-provenance → compare-at-two-times`; both time axes are semantic owners.
- **Wide:** Two-axis interval view + selected state/provenance; one bounded matrix owns time overflow and exact values remain available as a table.
- **Intermediate:** Choose one time axis as primary while the other becomes a selector; selected state and correction chain remain visible.
- **Compact:** Select valid-time or known-at view → interval list → state detail → correction provenance; explicit switch preserves selected instant.
- **State obligations:** no history, open/closed interval, retroactive correction, superseded state, conflicting intervals, timezone/granularity, provenance missing, selected instant and comparison unavailable.
- **Hard rejection:** Reject cho ordinary version history, audit timeline, job run progression, spreadsheet grid or generic record detail.
- **Research anchors:** `CARBON-TABLE`, `FLUENT-LAYOUT`, `WAI-APG`, `WAI-REFLOW`, `WAI-FOCUS`; add [W3C Tabular Data Model](https://www.w3.org/TR/tabular-data-model/).
- **Acceptance focus:** Template must distinguish valid-at from recorded-at, select intervals on both axes and provide compact time-view parity without color-only cells.

## Prompt 07 — `effective-setting-provenance-inspector`

- **Output boundary:** `knowledge/archetypes/settings/effective-setting-provenance-inspector/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Explain why one configuration has its effective value by tracing scope inheritance, defaults and conflicting overrides.
- **Required region graph:** `provenance-inspector → setting-and-subject-context → scope-tree → effective-value-summary → inheritance-chain → override-conflict-evidence → change-at-owning-scope-action`; chain ownership differs from edit ownership.
- **Wide:** Scope tree + effective value/inheritance chain; conflict evidence and owning-scope action support diagnosis.
- **Intermediate:** Scope tree becomes drawer; selected scope path and effective source remain persistent.
- **Compact:** Scope list → setting detail → provenance chain → owning-scope action; Back restores selected scope and expanded ancestry.
- **State obligations:** inherited/default/overridden/conflicted, unknown owner, scope inaccessible, chain loading/stale/cycle, selected source, change action unavailable and recalculation pending.
- **Hard rejection:** Reject cho general settings form, hierarchy browser, dependency graph resolver, permission matrix or flat record detail.
- **Research anchors:** `GITLAB-PATTERNS`, `SALESFORCE-COMPONENTS`, `APPLE-SPLIT`, `WAI-FOCUS`, `WAI-STATUS`; add [GitLab Settings management](https://design.gitlab.com/patterns/settings-management/).
- **Acceptance focus:** Template must trace default→parent→local override, expose conflict and route change to the actual owner without editing a derived value.

## Prompt 08 — `independent-preference-autosave-center`

- **Output boundary:** `knowledge/archetypes/settings/independent-preference-autosave-center/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Adjust independent preferences whose changes commit separately, with per-control pending/error/undo and no page-level Save transaction.
- **Required region graph:** `preference-center → category-index → preference-groups → independent-preference-control ×n → per-control-status-and-undo → reset-category-boundary`; each control owns its own transaction.
- **Wide:** Category navigation + preference groups; local status/undo remains next to its control and no global save bar appears.
- **Intermediate:** Category navigation collapses; preference grouping and local transaction feedback stay intact.
- **Compact:** Category list → one preference group; controls stack with per-control status/undo, reset follows the group and never acts invisibly.
- **State obligations:** initial/loading, saved, local pending, local failure/retry, undone, inherited/locked, dependency hidden/revealed, reset pending/partial failure and status announcement.
- **Hard rejection:** Reject cho section editor with one save model, policy accordion, wizard, matrix preference editor or settings navigation hub.
- **Research anchors:** `GITLAB-PATTERNS`, `WAI-APG`, `WAI-STATUS`, `WAI-FOCUS`, `WAI-OBSCURED`; add [GitLab Saving and feedback](https://design.gitlab.com/patterns/saving-and-feedback/) and [Carbon Toggle usage](https://carbondesignsystem.com/components/toggle/usage/) for immediate, reversible per-control preference transactions without importing either system's component styling.
- **Acceptance focus:** Template must run independent local saves/failures/undo, never mix auto-save with global Save and preserve per-control feedback at compact.

## Prompt 09 — `configuration-dependency-resolver`

- **Output boundary:** `knowledge/archetypes/settings/configuration-dependency-resolver/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Understand a configuration violation through its dependency path, compare valid resolutions and apply one safely.
- **Required region graph:** `dependency-resolver → violation-summary → dependency-constraint-graph → selected-constraint-evidence → candidate-resolution-set → before-after-resolution-preview → apply-and-verification`; graph explains causality, preview owns consequence.
- **Wide:** Violation list/graph + selected constraint + resolution preview can be compared together.
- **Intermediate:** Graph becomes supporting pane; violations and preview remain primary with active path summary.
- **Compact:** Violation list → dependency path → candidate resolutions → before/after preview → apply/verify; graph optional.
- **State obligations:** detecting, no violations, selected constraint, incomplete graph, cyclic dependency, candidate calculating/incompatible, preview stale, apply pending/failure/rollback and verification pass/fail.
- **Hard rejection:** Reject cho passive dependency monitor, rule builder, ordinary validation summary, effective-setting provenance or free-form workflow editor.
- **Research anchors:** `FLUENT-LAYOUT`, `CARBON-GRID`, `GITLAB-PATTERNS`, `WAI-STATUS`, `WAI-FOCUS`; add [GitLab Progressive disclosure](https://design.gitlab.com/patterns/progressive-disclosure/).
- **Acceptance focus:** Template must trace one violation, preview two resolution consequences and support apply→verify→rollback without losing selected path.

## Prompt 10 — `constrained-quota-allocation-editor`

- **Output boundary:** `knowledge/archetypes/settings/constrained-quota-allocation-editor/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Allocate a conserved total across recipients while continuously reconciling remaining balance and cross-row constraints.
- **Required region graph:** `quota-editor → scope-and-conserved-total → recipient-allocation-collection → remaining-balance-ledger → cross-row-constraint-summary → selected-recipient-editor → whole-plan-review-and-commit`; total and balance are global invariant owners.
- **Wide:** Allocation table/list + persistent balance/constraint summary; recipient editor may support but never hide whole-plan reconciliation.
- **Intermediate:** Reduce comparison columns; balance and violations remain visible while recipient edit becomes drawer.
- **Compact:** Allocation list with amount/status → recipient editor → whole-plan balance/violations → review/commit; no row can commit independently.
- **State obligations:** unallocated/overallocated/balanced, recipient min/max/locked, invalid unit, derived total calculating, bulk distribution, dirty plan, commit pending/conflict and stale capacity.
- **Hard rejection:** Reject cho permissions matrix, independent preference controls, spreadsheet free editing, dual-list transfer or resource scheduler.
- **Research anchors:** `CARBON-TABLE`, `FLUENT-LAYOUT`, `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`; add [Carbon Data table](https://carbondesignsystem.com/components/data-table/usage/).
- **Acceptance focus:** Template must preserve a conserved total, surface cross-row errors and keep balance/review parity when rows become compact stages.

## Prompt 11 — `support-handoff-redaction-review`

- **Output boundary:** `knowledge/archetypes/support/support-handoff-redaction-review/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Review a captured support transcript/evidence bundle, decide retain/redact per item and preview exactly what a recipient will receive.
- **Required region graph:** `redaction-review → handoff-purpose-and-recipient → captured-item-queue → selected-item-redaction-editor → privacy-risk-summary → recipient-preview → consent-and-handoff`; source item, redaction decision and recipient output are separate owners.
- **Wide:** Item queue + redaction editor + recipient preview can be inspected together; privacy summary remains tied to unresolved items.
- **Intermediate:** Preview becomes named supporting pane; queue and editor remain primary, selected item state persistent.
- **Compact:** Item queue → redaction editor → recipient preview → consent/handoff; Back restores exact item and redaction draft.
- **State obligations:** item loading/unsupported, retain/redact/omit, detected sensitive data, unresolved risk, preview stale, recipient changed, consent missing, handoff pending/failure/success and audit record.
- **Hard rejection:** Reject cho support request composer, document diff, generic file manager, simple share dialog or conversation room.
- **Research anchors:** `USWDS-PATTERNS`, `GOVUK-PATTERNS`, `WAI-FOCUS`, `WAI-STATUS`, `WAI-OBSCURED`; add [USWDS File input](https://designsystem.digital.gov/components/file-input/).
- **Acceptance focus:** Template must redact/omit locally, update recipient preview, block handoff on unresolved risk and preserve focus across 3→2→staged compact topology.

## Prompt 12 — `cross-scope-access-conflict-resolver`

- **Output boundary:** `knowledge/archetypes/settings/cross-scope-access-conflict-resolver/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Resolve a blocked intent by comparing effective permission deltas across candidate scopes and choosing switch, request or abandon.
- **Required region graph:** `access-resolver → retained-intent-and-current-scope → candidate-scope-list → permission-delta-comparison → selected-scope-consequence → switch-or-request-action → return-to-intent`; retained intent and scope deltas are required.
- **Wide:** Candidate scopes + delta comparison/consequence; action remains bound to selected scope.
- **Intermediate:** Candidate list becomes selector; comparison keeps gained/lost/unchanged groups visible.
- **Compact:** Scope list → selected delta detail → consequence → switch/request → return; Back preserves original intent and scope selection.
- **State obligations:** candidates loading/none, current/candidate, permission gained/lost/unknown, scope inaccessible, request pending/approved/denied, switch failed, intent stale and focus return.
- **Hard rejection:** Reject cho generic permission outcome, permissions matrix editing, account switcher, service unavailable or plan comparison.
- **Research anchors:** `SALESFORCE-COMPONENTS`, `CARBON-TABLE`, `WAI-FOCUS`, `WAI-STATUS`, `WAI-REFLOW`; add [Salesforce Tree Grid](https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/lightning-tree-grid.html).
- **Acceptance focus:** Template must compare at least three scopes, expose lost as well as gained access and return to the retained intent after a successful switch/request.

## Prompt 13 — `offline-draft-preservation-recovery`

- **Output boundary:** `knowledge/archetypes/system/offline-draft-preservation-recovery/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Preserve a whole draft after reconnect by comparing local and server snapshots, understanding loss at the draft boundary and choosing one safe preservation outcome without editing individual differences on this surface.
- **Required region graph:** `draft-recovery → retained-task-identity → local-snapshot-summary ↔ server-state-summary → conflict-and-loss-analysis → whole-draft-preservation-options → preserved-outcome-review → recoverable-backup-and-sync-result`; local and server snapshots are peer evidence owners, preservation chooses one whole-draft outcome and no region owns per-difference custom resolution.
- **Wide:** Local/server summaries + conflict analysis; preservation options follow exact loss evidence.
- **Intermediate:** Snapshot summaries stack but aligned differences remain grouped; outcome review stays visible before sync.
- **Compact:** Local summary → server summary → conflict/loss summary → one whole-draft preservation choice → outcome review → recoverable backup/sync result; no automatic overwrite and no hidden per-difference editor.
- **State obligations:** offline/local-only, reconnecting, server unchanged/changed/deleted, conflict, local stale, merge possible/impossible, sync pending/failure/retry/success and recoverable backup.
- **Hard rejection:** Reject cho generic service error, editable diff workbench, save conflict toast, version history, centered confirmation, hoặc bất kỳ flow nào cần navigate và resolve từng difference thành một custom merged value before commit.
- **Research anchors:** `GITLAB-PATTERNS`, `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`, `USWDS-PATTERNS`; add [GitLab Saving and feedback](https://design.gitlab.com/patterns/saving-and-feedback/).
- **Acceptance focus:** Template must simulate offline edits/server divergence, explain loss for every whole-draft option, preserve a recoverable backup, prevent silent overwrite and never expose per-difference reconciliation controls across all widths.

## Prompt 14 — `credential-rotation-cutover-console`

- **Output boundary:** `knowledge/archetypes/settings/credential-rotation-cutover-console/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Rotate one credential across dependent consumers through a bounded old/new overlap, prove every consumer has migrated, then disable and irreversibly retire the old credential with phase-aware recovery.
- **Required region graph:** `rotation-console → credential-identity-and-risk → old-and-new-credential-state → dependent-consumer-migration-ledger ↔ selected-consumer-proof → overlap-window-and-cutover-controls → global-verification-evidence → disable-grace-and-destroy-transaction → completion-receipt`; dual-live state, per-consumer proof and aggregate verification are separate owners.
- **Wide:** Old/new credential states, consumer migration ledger and global verification remain simultaneously comparable; cutover controls bind to the overlap window and revoke stays locked until the global gate passes.
- **Intermediate:** Dual-state becomes a persistent summary, consumer ledger remains primary and selected verification evidence moves to a drawer; risk, window and global gate never disappear.
- **Compact:** Rotation summary → consumer-by-consumer migration/proof → cutover review → global verification → disable/grace → final destroy or recovery → receipt; each return restores the selected consumer and no compact action can bypass the global gate.
- **State obligations:** preparing, old-only, new staged, dual-active, consumer pending/migrated/failed/unknown, overlap expiring, verification running/partial/pass/fail, cutover conflict, old disabled/grace, cutback available before destruction, destroy locked/pending/failed/irreversible, post-destruction forward rotation and auditable completion.
- **Hard rejection:** Reject cho generic stage-gated record, setup checklist, dependency resolver, credential inventory/detail, deployment monitor or independent per-row migration actions; accept only khi old/new overlap, per-consumer proof và aggregate verification jointly control retirement.
- **Research anchors:** `FLUENT-LAYOUT`, `CARBON-TABLE`, `WAI-STATUS`, `WAI-REFLOW`, `WAI-OBSCURED`; add [Google Secret Manager rotation recommendations](https://docs.cloud.google.com/secret-manager/docs/rotation-recommendations), [NIST SP 800-57 Part 1 Rev. 5](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-57pt1r5.pdf) and [WAI Tables Tutorial](https://www.w3.org/WAI/tutorials/tables/).
- **Acceptance focus:** Template must simulate old/new overlap, migrate several consumers with textual proof, block disable/destroy until aggregate verification passes, permit cutback only before destruction and preserve focus/state across wide→intermediate→compact transformations.

## Prompt 15 — `live-support-session-room`

- **Output boundary:** `knowledge/archetypes/support/live-support-session-room/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Collaborate in a live support session around a shared screen/device while conversation, diagnostics and control ownership remain explicit.
- **Required region graph:** `support-session → session-identity-and-safety → shared-session-stage → transport-and-control-handoff → live-conversation → diagnostic-context → participant-and-consent-state → session-event-log`; shared stage and control ownership distinguish it from chat.
- **Wide:** Shared stage primary + conversation/diagnostics; control owner and consent are always visible.
- **Intermediate:** Diagnostics become drawer; stage + conversation/control remain usable.
- **Compact:** Stage first with safe controls, conversation and diagnostics as named sheets; control handoff requires full-screen confirmation and deterministic focus return.
- **State obligations:** connecting/live/reconnecting/ended, view-only/control-requested/granted/revoked, participant joined/left, consent pending, diagnostic stale, message pending/error and session recording state.
- **Hard rejection:** Reject cho conversation room, media theater, remote dashboard, support case timeline or generic screen share.
- **Research anchors:** `FLUENT-LAYOUT`, `APPLE-LAYOUT`, `WAI-APG`, `WAI-OBSCURED`, `WAI-STATUS`; add [WAI-ARIA Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
- **Acceptance focus:** Template must simulate control request/grant/revoke, participant change and compact sheets while never hiding current controller or consent state.

## Prompt 16 — `interactive-code-example-lab`

- **Output boundary:** `knowledge/archetypes/support/interactive-code-example-lab/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Learn a concept by editing a bounded code example and observing synchronized preview plus console/test evidence.
- **Required region graph:** `code-lab → lesson-goal-and-instructions → editable-code-region → live-preview-or-simulator → console-and-test-evidence → reset-solution-controls → explanation-and-next-step`; code, output and evidence share run version.
- **Wide:** Instructions + editor + preview/evidence in coordinated panes; editor/console own bounded code overflow.
- **Intermediate:** Instructions collapse; editor and preview remain split or tabs with run version visible.
- **Compact:** Instructions → editor → run → preview → console/tests → explanation; explicit switches preserve code and output, no auto-run focus theft.
- **State obligations:** starter/dirty code, syntax error, running, preview success/runtime failure, tests pass/fail, stale output, reset confirmation, solution reveal and reduced-motion simulator.
- **Hard rejection:** Reject cho API reference console, production IDE, static code sample, query builder or generic form preview.
- **Research anchors:** `APPLE-SPLIT`, `FLUENT-LAYOUT`, `WAI-FOCUS`, `WAI-STATUS`, `WAI-REFLOW`; add [WAI Keyboard interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/).
- **Acceptance focus:** Template must edit/run/reset locally, bind preview/tests to exact code version and make compact stages keyboard-complete without network execution.

## Prompt 17 — `diagnostic-evidence-bundle-review`

- **Output boundary:** `knowledge/archetypes/support/diagnostic-evidence-bundle-review/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Assemble artifacts from multiple diagnostic sources, verify completeness/privacy and export one traceable evidence manifest.
- **Required region graph:** `evidence-bundle → diagnostic-question-and-scope → source-capture-status → artifact-register → relationship-and-time-summary → privacy-and-completeness-checks → bundle-manifest-preview → export-or-attach`; manifest derives from artifacts and checks.
- **Wide:** Source status + artifact register + manifest/check summary; selected artifact detail is temporary.
- **Intermediate:** Source status collapses; artifact register and manifest remain primary.
- **Compact:** Source capture → artifacts → selected detail → privacy/completeness → manifest → export; Back preserves selection and check results.
- **State obligations:** source unavailable/capturing/complete, artifact unsupported/duplicate/stale, timestamp mismatch, sensitive item, required evidence missing, manifest stale, export pending/failure/ready and permission.
- **Hard rejection:** Reject cho support handoff redaction, generic upload manager, audit event detail, streaming log console or support request composer.
- **Research anchors:** `USWDS-PATTERNS`, `CARBON-TABLE`, `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`; add [USWDS File input](https://designsystem.digital.gov/components/file-input/).
- **Acceptance focus:** Template must capture mock sources, dedupe artifacts, update completeness/privacy and produce a local manifest without external upload.

## Prompt 18 — `multi-track-timeline-editor`

- **Output boundary:** `knowledge/archetypes/work/multi-track-timeline-editor/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Compose a time-based artifact by placing, trimming and synchronizing clips across multiple tracks, then previewing/rendering the resulting sequence.
- **Required region graph:** `timeline-editor → project-version-and-duration → asset-bin → multi-track-time-ruler → playhead-and-selection → clip-property-inspector → transport-preview → render-and-validation`; tracks, playhead and output version share coordinates.
- **Wide:** Asset bin + multi-track timeline + preview/clip inspector can be inspected together; timeline owns bounded two-axis navigation with frozen track identities.
- **Intermediate:** Asset bin becomes drawer; preview and inspector alternate while timeline/playhead remain primary.
- **Compact:** Track list → selected track/clip timeline → trim/property stage → preview → render review; explicit nudge/trim controls replace precision-only dragging.
- **State obligations:** assets loading/missing, clip selected/moved/trimmed/split, overlap/gap, track muted/locked, play/pause/scrub, dirty/undo-redo, render queued/progress/failure/ready and version conflict.
- **Hard rejection:** Reject cho media annotation, audit/status timeline, calendar scheduler, paged presentation or palette-canvas page builder.
- **Research anchors:** `APPLE-LAYOUT`, `FLUENT-LAYOUT`, `WAI-APG`, `WAI-STATUS`, `WAI-REFLOW`; add [Apple Drag and drop](https://developer.apple.com/design/human-interface-guidelines/drag-and-drop).
- **Acceptance focus:** Template must add/move/trim clips by keyboard, sync playhead/preview, surface overlap and preserve timeline→clip→render parity at compact.

## Prompt 19 — `causal-root-analysis-dossier`

- **Output boundary:** `knowledge/archetypes/detail/causal-root-analysis-dossier/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Test a causal hypothesis tree against evidence, eliminate unsupported causes and record a root-cause conclusion with corrective-action linkage.
- **Required region graph:** `root-analysis → problem-statement-and-boundary → causal-hypothesis-tree → evidence-linked-cause-register → eliminated-and-unresolved-causes → selected-cause-evidence → root-cause-rationale → corrective-action-linkage`; causal tree and evidence statuses are independent owners.
- **Wide:** Hypothesis tree + evidence/cause detail; eliminated/unresolved summary and rationale stay visible.
- **Intermediate:** Tree becomes collapsible/alternate; selected causal path + evidence remain primary.
- **Compact:** Problem → hypothesis path list → selected cause/evidence → eliminated/unresolved → rationale/action; graph optional.
- **State obligations:** hypothesis proposed/supported/refuted/unknown, evidence loading/stale/contradictory, branch eliminated/reopened, selected cause, rationale draft/conflict, corrective action missing and review recorded.
- **Hard rejection:** Reject cho generic case resolution criteria, dependency health graph, incident timeline, rule builder or narrative report.
- **Research anchors:** `USWDS-PATTERNS`, `CARBON-GRID`, `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`; add [USWDS Process list](https://designsystem.digital.gov/components/process-list/).
- **Acceptance focus:** Template must link cause↔evidence, eliminate/reopen branches and preserve a reviewable rationale without pretending correlation proves causation.
