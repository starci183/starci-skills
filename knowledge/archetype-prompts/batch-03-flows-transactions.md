# Batch 03 — Flows and transactions archetypes (19 prompts)

Tệp này là **một prompt batch tự chứa** cho family `flow`. Khi chạy ở nơi khác, đưa toàn bộ tệp cho agent để tạo đủ 19 leaf giao dịch và quy trình. Nếu chỉ chạy một mục, phải đưa kèm toàn bộ phần từ `Cách chạy` đến `Nguồn research dùng chung`; không tách riêng block prompt khỏi hợp đồng chung.

## Mục lục

| # | Archetype ID | Câu hỏi bố cục chính |
|---:|---|---|
| 01 | `calculation-estimate-flow` | Làm sao nhập assumptions, hiểu live breakdown và chấp nhận một estimate có giới hạn rõ? |
| 02 | `single-question-step` | Làm sao giữ một câu hỏi rõ ràng trong ngữ cảnh của một transaction nhiều bước? |
| 03 | `linear-multi-step-application` | Làm sao dẫn qua một chuỗi bước cố định mà vẫn giữ tiến độ, dữ liệu và đường quay lại? |
| 04 | `nonlinear-task-list-application` | Làm sao lập kế hoạch và tiếp tục nhiều task có thể hoàn thành qua nhiều phiên? |
| 05 | `repeated-item-manager` | Làm sao thêm, kiểm tra, sửa và xóa nhiều record cùng loại trước khi tiếp tục? |
| 06 | `data-export-delivery-flow` | Làm sao chọn scope, format, privacy boundary rồi tạo và nhận một export an toàn? |
| 07 | `data-import-mapping-pipeline` | Làm sao parse, map, kiểm tra và commit một dataset có cấu trúc an toàn? |
| 08 | `review-submit-ledger` | Làm sao rà soát toàn bộ transaction, sửa đúng chỗ và hiểu hậu quả trước submit? |
| 09 | `guided-troubleshooting-tree` | Làm sao chẩn đoán qua nhánh câu hỏi và đi tới resolution hoặc escalation? |
| 10 | `guided-setup-checklist` | Làm sao hoàn thành và verify một chuỗi setup mà không mất dependency context? |
| 11 | `stage-gated-process-record` | Làm sao tiến một record qua các stage, gate, evidence và approval chính thức? |
| 12 | `booking-slot-selection` | Làm sao chọn một time slot còn hợp lệ theo ngày, múi giờ và availability thay đổi? |
| 13 | `spatial-seat-reservation` | Làm sao chọn và giữ chỗ theo quan hệ không gian, giá và accessibility? |
| 14 | `cart-checkout-flow` | Làm sao đi từ line items tới fulfillment, payment, review và order submission? |
| 15 | `plan-selection-purchase` | Làm sao so đủ yếu tố quyết định, chọn một plan và mua mà không mất price context? |
| 16 | `split-reference-form` | Làm sao nhập dữ liệu trong khi phải liên tục đối chiếu một reference source? |
| 17 | `consent-signature-ceremony` | Làm sao đọc đúng instrument, acknowledge clauses và ký một commitment có audit evidence? |
| 18 | `cross-party-handoff-flow` | Làm sao đóng gói context, chọn recipient, đặt access/expiry và theo dõi acceptance? |
| 19 | `asynchronous-outcome-tracker` | Làm sao theo dõi một submission dài hạn qua milestones, requests và expected updates? |

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

## Prompt 01 — `calculation-estimate-flow`

- **Output boundary:** `knowledge/archetypes/flow/calculation-estimate-flow/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Cung cấp inputs/assumptions, hiểu live calculation breakdown và review hoặc accept một estimate cùng uncertainty/limitations.
- **Required region graph:** `estimate-flow → estimate-purpose-and-basis → input-and-assumption-groups → live-calculation-summary → itemized-breakdown → uncertainty-and-limitations → review-adjust-or-accept`; calculation output is a derived owner, không phải summary trang trí.
- **Wide:** Input groups và live result/breakdown đồng hiện; assumptions/limitations remain adjacent to values they qualify.
- **Intermediate:** Result summary persists near inputs while detailed breakdown reflows below or into disclosure; no result floats without basis.
- **Compact:** Tuần tự input → calculate → result → breakdown → assumptions → accept; edit returns exact field and recalculates with announced status.
- **State obligations:** initial/no estimate, calculating, ready, invalid/incomplete input, source rate stale, uncertainty unavailable, assumption edited, estimate expired, accept pending/conflict and focus error→input/result.
- **Hard rejection:** Reject cho full scenario modeler, generic sectioned form, plan purchase, static price card hoặc one-number calculator inside a centered task.
- **Research anchors:** `USWDS-PATTERNS`, `GOVUK-PATTERNS`, `CARBON-GRID`, `WAI-STATUS`, `WAI-FOCUS`.
- **Acceptance focus:** Template phải recalculate locally, expose every input→breakdown relationship, show stale/uncertain estimate and preserve compact edit→review context.

## Prompt 02 — `single-question-step`

- **Output boundary:** `knowledge/archetypes/flow/single-question-step/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Trả lời đúng một câu hỏi trong ngữ cảnh transaction và tiến tới bước kế tiếp mà vẫn có đường quay lại đáng tin cậy.
- **Required region graph:** `question-step → return-navigation → section-and-progress-context → question-label-and-instructions → answer-control → progression-actions → contextual-help`; question label/legend là semantic owner của answer.
- **Wide:** Form nằm trong một readable column; progress hỗ trợ orientation nhưng không cạnh tranh với question, và help chỉ đồng hiện khi không tách khỏi input liên quan.
- **Intermediate:** Giữ cùng semantic order; supporting help chuyển xuống sau control hoặc thành disclosure kế cận thay vì tạo second form pane.
- **Compact:** Question, hint, control và Continue thành một uninterrupted sequence; Back giữ answer và browser history, controls không bị ép thành inline khi labels không fit.
- **State obligations:** unanswered/prefilled, conditional reveal, validation pending/error, saved draft, stale carried-forward answer, permission/unavailable, continue pending và focus error-summary→field→continue.
- **Hard rejection:** Reject cho standalone `centered-single-task`, nhiều câu hỏi không phụ thuộc trên cùng page, full application overview, assessment question navigator hoặc settings editor.
- **Research anchors:** `GOVUK-PATTERNS`, `NHS-PATTERNS`, `USWDS-PATTERNS`, `WAI-FOCUS`, `WAI-STATUS`; bổ sung [GOV.UK Question pages](https://design-system.service.gov.uk/patterns/question-pages/), [WCAG Labels or Instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions) và [WCAG Redundant Entry](https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html).
- **Acceptance focus:** Template phải chứng minh one-question ownership, preserved Back state, inline + summary validation và không biến step thành một generic centered card.

## Prompt 03 — `linear-multi-step-application`

- **Output boundary:** `knowledge/archetypes/flow/linear-multi-step-application/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Hoàn thành một application dài có thứ tự section ổn định trong khi hiểu current progress, lưu draft và quay lại dữ liệu trước đó.
- **Required region graph:** `linear-application → application-context → step-progress → current-section → question-sequence → back-save-continue-actions → persistent-help`; progress phản ánh chapters, không là navigation tùy ý.
- **Wide:** Labeled step indicator đứng trước một narrow form column; current section và save/continue là primary, không dùng side-by-side form sections.
- **Intermediate:** Step labels rút còn những nhãn vẫn phân biệt được hoặc thành compact chapter summary; form giữ width đọc và action order.
- **Compact:** Progress chuyển thành `Step n of m` cùng current chapter; mỗi page giữ một coherent question group, không tạo horizontal step scroller.
- **State obligations:** initial/resumed, chapter complete/current/upcoming, conditional branch, draft saving/saved/error, timeout warning/extension, validation, stale answer dependency, submit handoff và focus across Back/Continue.
- **Hard rejection:** Reject cho task có thể hoàn thành theo thứ tự bất kỳ, flow dưới ba sections, quiz/assessment, `centered-single-task`, hoặc task list dùng qua nhiều phiên.
- **Research anchors:** `USWDS-PATTERNS`, `GOVUK-PATTERNS`, `NHS-PATTERNS`, `WAI-REFLOW`, `WAI-FOCUS`; bổ sung [USWDS Complete a complex form](https://designsystem.digital.gov/patterns/complete-a-complex-form/), [USWDS Step indicator](https://designsystem.digital.gov/components/step-indicator/) và [GOV.UK Question pages](https://design-system.service.gov.uk/patterns/question-pages/).
- **Acceptance focus:** Template phải minh họa labeled→summary→counter progress, save/resume/error states và giữ DOM/focus order qua cả ba topology.

## Prompt 04 — `nonlinear-task-list-application`

- **Output boundary:** `knowledge/archetypes/flow/nonlinear-task-list-application/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Lập kế hoạch, hoàn thành và tiếp tục nhiều task hoặc section qua nhiều phiên, thường theo thứ tự linh hoạt nhưng có dependencies rõ.
- **Required region graph:** `task-application → transaction-context → overall-progress → grouped-task-lists → task-status-and-dependencies → final-submit-readiness → help`; mỗi task link và status phải là một semantic unit.
- **Wide:** Grouped task lists trong primary content column; task name, hint và status đồng hiện, final submit chỉ xuất hiện khi readiness contract cho phép.
- **Intermediate:** Status có thể wrap dưới task name nhưng không tách khỏi accessible description; progress summary vẫn đứng trước groups.
- **Compact:** Một cột group→task→status; locked reason và next available task luôn thấy, không thay toàn bộ list bằng một generic progress ring.
- **State obligations:** not-started/in-progress/completed/cannot-start/not-applicable, dependency locked, section stale, returning session, final readiness blocked, submit pending/conflict và focus after task completion.
- **Hard rejection:** Reject cho linear fixed sequence, project/operations dashboard, guided technical setup có verification từng bước, settings hub hoặc `centered-single-task`.
- **Research anchors:** `GOVUK-PATTERNS`, `NHS-PATTERNS`, `USWDS-PATTERNS`, `WAI-FOCUS`, `WAI-STATUS`; bổ sung [GOV.UK Complete multiple tasks](https://design-system.service.gov.uk/patterns/complete-multiple-tasks/) và [GOV.UK Task list](https://design-system.service.gov.uk/components/task-list/).
- **Acceptance focus:** Template phải có returning-session state, dependency lock, status không dựa màu và final action chỉ mở sau khi required tasks hoàn tất.

## Prompt 05 — `repeated-item-manager`

- **Output boundary:** `knowledge/archetypes/flow/repeated-item-manager/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Tạo và duy trì một collection nhỏ các record cùng schema trong transaction trước khi xác nhận đã thêm đủ.
- **Required region graph:** `item-manager → collection-context → item-summary-list → contextual-item-actions → add-another-action → collection-completeness → continue`; item identity phải bao quanh Edit/Remove context.
- **Wide:** Summary rows biểu diễn key values và contextual actions; Add another và completeness question theo sau collection, không biến records thành dense data grid.
- **Intermediate:** Actions wrap trong cùng item boundary; long values mở rộng theo chiều dọc thay vì thu key/value tới mất nghĩa.
- **Compact:** Mỗi item thành grouped block `identity → values → actions`; add/remove giữ scroll anchor và focus tới status hoặc item hợp lý.
- **State obligations:** empty/one/many items, add/edit pending, duplicate warning, incomplete item, remove confirm/undo, reordered external state, permission, collection complete và focus after create/delete.
- **Hard rejection:** Reject cho selectable bulk table, open-ended file/asset browser, một answer group đơn, cart có pricing/fulfillment semantics hoặc `centered-single-task`.
- **Research anchors:** `GOVUK-PATTERNS`, `NHS-PATTERNS`, `CARBON-TABLE`, `WAI-FOCUS`, `WAI-STATUS`; bổ sung [GOV.UK Summary list](https://design-system.service.gov.uk/components/summary-list/) và [WCAG Error Prevention](https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data.html).
- **Acceptance focus:** Template phải cho add/edit/remove local records, accessible repeated action names, undo hoặc confirmation và stable focus/scroll ở compact.

## Prompt 06 — `data-export-delivery-flow`

- **Output boundary:** `knowledge/archetypes/flow/data-export-delivery-flow/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Chọn data scope/fields/format, hiểu privacy và size consequences, rồi generate và nhận một export có thể mất thời gian.
- **Required region graph:** `export-flow → source-and-scope-context → field-and-format-options → record-count-and-size-preview → privacy-redaction-warning → delivery-destination → generate-action → export-progress-and-delivery`; preview derives from scope, progress outlives the form transaction.
- **Wide:** Configuration primary + live count/size/privacy summary supporting; delivery choice and generate action follow material consequences.
- **Intermediate:** Summary reflows between configuration and generate; fields group by meaning rather than dense chip wall.
- **Compact:** Configure scope → review count/privacy/format → choose delivery → track generation; progress becomes dedicated stage and Back retains configuration.
- **State obligations:** preview calculating/error/stale, zero records, restricted field, large export warning, destination invalid, queued/generating/ready/expired/failed, cancel/retry, permission and download focus/status.
- **Hard rejection:** Reject cho data import mapping, simple file download action, operational report table, repeated upload manager hoặc background job detail after generation is handed off.
- **Research anchors:** `USWDS-PATTERNS`, `GOVUK-PATTERNS`, `CARBON-TABLE`, `WAI-STATUS`, `WAI-FOCUS`.
- **Acceptance focus:** Template phải update count/size locally, enforce privacy review, simulate queued→ready/failed/expired and preserve compact configuration through tracking.

## Prompt 07 — `data-import-mapping-pipeline`

- **Output boundary:** `knowledge/archetypes/flow/data-import-mapping-pipeline/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Đưa một dataset có cấu trúc qua parse, field mapping, row validation, sample review và commit có kiểm soát.
- **Required region graph:** `import-pipeline → source-file-and-parse-status → source-to-target-mapping → validation-summary → sample-preview → commit-scope-and-actions → import-result`; mapping và preview share field identity.
- **Wide:** Mapping workspace và sample preview đồng hiện khi association còn đọc; validation summary đứng trước commit, một bounded table region own overflow.
- **Intermediate:** Preview thành collapsible detail hoặc drawer giữ selected mapping; mapping table vẫn là primary owner thay vì squeeze hai grids.
- **Compact:** Tuần tự hóa `source → map fields → resolve issues → review sample → commit`; mỗi stage có summary/back và giữ mapping state, không thu desktop table thành unreadable cards.
- **State obligations:** parsing pending/error, encoding/delimiter ambiguity, missing/duplicate/unmapped fields, invalid/ignored rows, mapping changed, preview stale, commit pending/partial/success/rollback, permission và conflict with target schema.
- **Hard rejection:** Reject cho simple document upload, editable data table, file browser, one-click import micro-action hoặc `centered-single-task` không có mapping/review stages.
- **Research anchors:** `CARBON-TABLE`, `FLUENT-LAYOUT`, `SALESFORCE-COMPONENTS`, `WAI-REFLOW`, `WAI-STATUS`; bổ sung [W3C Tabular Data Model](https://www.w3.org/TR/tabular-data-model/) và [USWDS Table](https://designsystem.digital.gov/components/table/).
- **Acceptance focus:** Template phải mô phỏng parse→mapping→validation→commit, announce partial failures và chứng minh compact staged alternative có cùng field associations.

## Prompt 08 — `review-submit-ledger`

- **Output boundary:** `knowledge/archetypes/flow/review-submit-ledger/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Rà soát toàn bộ dữ liệu và consequences của transaction, sửa đúng source step, rồi thực hiện một final submission có ý nghĩa.
- **Required region graph:** `review-submit → transaction-context → sectioned-answer-ledger → contextual-change-paths → consequence-and-declaration → final-submit-actions`; ledger là pre-submit authority view, không là receipt.
- **Wide:** Short answers dùng readable two-thirds ledger; long evidence hoặc dense totals có thể dùng full content width nhưng Change luôn gần value owner.
- **Intermediate:** Section rows reflow mà vẫn giữ key/value/action association; declaration theo sau toàn bộ review, không nằm rail tách biệt.
- **Compact:** Mỗi ledger row xếp `key → value → contextual Change`; final consequence, declaration và submit nằm cuối semantic sequence, không sticky che focused Change link.
- **State obligations:** incomplete/not-provided, changed answer, derived total recalculating, validation invalidated by change, declaration unchecked, stale/conflict, submit pending/duplicate prevented/success handoff và focus return after edit.
- **Hard rejection:** Reject cho post-submit `completion-receipt`, repeated-item editing page, simple irreversible confirmation, read-only detail hoặc `centered-single-task`.
- **Research anchors:** `GOVUK-PATTERNS`, `NHS-PATTERNS`, `USWDS-PATTERNS`, `WAI-FOCUS`, `WAI-STATUS`; bổ sung [GOV.UK Check answers](https://design-system.service.gov.uk/patterns/check-answers/), [NHS Check answers](https://service-manual.nhs.uk/design-system/patterns/check-answers/) và [WCAG Error Prevention](https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data.html).
- **Acceptance focus:** Template phải cho Change→edit→return đúng ledger anchor, mô phỏng stale recalculation và khóa duplicate final submit mà không chuyển thành confirmation receipt.

## Prompt 09 — `guided-troubleshooting-tree`

- **Output boundary:** `knowledge/archetypes/flow/guided-troubleshooting-tree/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Chẩn đoán một vấn đề bằng chuỗi câu hỏi phân nhánh, tích lũy evidence và đi tới resolution hoặc escalation phù hợp.
- **Required region graph:** `troubleshooter → issue-context → current-diagnostic-question → answer-branches → accumulated-evidence-path → recommended-resolution → escalation-and-reset`; answer path là shared state, không phải decorative progress.
- **Wide:** Current question là primary column; evidence path hoặc known facts có thể là supporting rail nhưng không tiết lộ nhánh tương lai gây nhiễu.
- **Intermediate:** Evidence path thành disclosure/summary; current question và branch choices giữ toàn width đọc.
- **Compact:** Một diagnostic step mỗi screen; Back phục hồi exact branch answer và scroll, resolution thay question sequence nhưng vẫn cho review/reset path.
- **State obligations:** no issue selected, branch loading, invalid/contradictory answer, dead end, insufficient evidence, resolution available/failed, escalation unavailable/pending, knowledge stale và reset confirmation.
- **Hard rejection:** Reject cho FAQ/help hub, survey, scored quiz, linear application, arbitrary decision tree visualization hoặc standalone `centered-single-task`.
- **Research anchors:** `GOVUK-PATTERNS`, `USWDS-PATTERNS`, `NHS-PATTERNS`, `WAI-FOCUS`, `WAI-STATUS`; bổ sung [GOV.UK Question pages](https://design-system.service.gov.uk/patterns/question-pages/) và [WAI-ARIA Disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/).
- **Acceptance focus:** Template phải có ít nhất hai branch paths, Back sửa được upstream answer, resolution/escalation states và không biểu diễn tree như canvas trên compact.

## Prompt 10 — `guided-setup-checklist`

- **Output boundary:** `knowledge/archetypes/flow/guided-setup-checklist/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Hoàn thành và verify một cấu hình qua các bước có prerequisite, hướng dẫn, trạng thái kiểm tra và unblock path.
- **Required region graph:** `setup-guide → setup-goal-and-prerequisites → setup-step-list → current-step-instructions → verification-result → unblock-help → completion`; verification owns completion, không chỉ checkbox tự khai.
- **Wide:** Step list và current instructions đồng hiện; current step là primary, list giữ statuses và navigation tới allowed steps.
- **Intermediate:** Step list thu thành summary rail hoặc drawer; current step, verify action và failure help vẫn đồng hiện.
- **Compact:** Step list là overview screen, current step là task screen; Back trả đúng step/status, verify feedback gần action và không phụ thuộc toast.
- **State obligations:** prerequisite missing, not-started/current/completed/skipped/not-applicable, verification pending/pass/fail, external dependency unavailable, stale verification, retry, permission và completion.
- **Hard rejection:** Reject cho application task list thu thập dữ liệu, linear form wizard, formal `stage-gated-process-record`, static instructions/process list hoặc `centered-single-task`.
- **Research anchors:** `USWDS-PATTERNS`, `ATLASSIAN-DESIGN`, `FLUENT-LAYOUT`, `WAI-FOCUS`, `WAI-STATUS`; bổ sung [USWDS Process list](https://designsystem.digital.gov/components/process-list/) và [USWDS Step indicator](https://designsystem.digital.gov/components/step-indicator/).
- **Acceptance focus:** Template phải cho chọn step hợp lệ, verify pass/fail/retry, lock prerequisite và biến split list/detail thành compact overview→step without state loss.

## Prompt 11 — `stage-gated-process-record`

- **Output boundary:** `knowledge/archetypes/flow/stage-gated-process-record/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Hiểu và tiến một record cụ thể qua các stage có gate, evidence, approver và transition rules chính thức.
- **Required region graph:** `gated-record → process-identity-and-status → stage-sequence → current-gate-requirements → evidence-and-approvals → transition-actions → history-and-exceptions`; current gate owns transition authority.
- **Wide:** Stage sequence và gate detail đồng hiện; evidence/approval summary hỗ trợ decision, history không cạnh tranh với current action.
- **Intermediate:** Stage sequence thành compact horizontal-free summary hoặc temporary rail; current gate requirements giữ primary width.
- **Compact:** Current stage/gate là primary page; all-stages summary và history là named secondary screens, transition action theo sau evidence chứ không fixed che content.
- **State obligations:** future locked/current/complete/failed/waived stage, evidence missing/stale, approval pending/approved/rejected, transition pending/conflict, permission, exception request và immutable history update.
- **Hard rejection:** Reject cho simple form progress, guided setup checklist, retrospective audit timeline, request composition trước submit, `centered-single-task`, hoặc cutover process nơi two simultaneous resource states, per-consumer migration proof và aggregate verification jointly control one irreversible transition.
- **Research anchors:** `USWDS-PATTERNS`, `SALESFORCE-COMPONENTS`, `ATLASSIAN-DESIGN`, `WAI-FOCUS`, `WAI-STATUS`; bổ sung [USWDS Step indicator](https://designsystem.digital.gov/components/step-indicator/) và [WCAG Error Prevention](https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data.html).
- **Acceptance focus:** Template phải minh họa locked/current/approved/rejected gates, evidence staleness và transition conflict với stage→detail compact parity.

## Prompt 12 — `booking-slot-selection`

- **Output boundary:** `knowledge/archetypes/flow/booking-slot-selection/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Chọn một available time slot theo service, date, timezone và constraints rồi giữ selection đủ lâu để tiếp tục booking.
- **Required region graph:** `slot-booking → service-and-attendee-context → date-navigation → availability-by-date → slot-selection → selected-slot-summary → continue-or-waitlist`; date và slot share one selection model.
- **Wide:** Date navigator và slots đồng hiện; selected summary có thể là supporting rail nhưng availability list giữ primary scan order.
- **Intermediate:** Selected date đứng trước slot list; calendar/detail bớt persistence và summary chuyển gần Continue.
- **Compact:** Agenda-first theo một ngày; calendar là alternate dialog/screen, slot summary theo ngay sau selected option và không phụ thuộc seven-column grid.
- **State obligations:** range loading, no slots/day, timezone/locale, selected/held/expired slot, concurrent slot taken, accessibility requirement, waitlist available, continue pending/error và focus after refresh.
- **Hard rejection:** Reject cho browsing existing events, spatial seats, free-form date entry, staff resource scheduler hoặc one-action `centered-single-task`.
- **Research anchors:** `APPLE-LAYOUT`, `USWDS-PATTERNS`, `NHS-PATTERNS`, `WAI-APG`, `WAI-STATUS`; bổ sung [WAI-ARIA Date Picker Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/) và [NHS Date input](https://service-manual.nhs.uk/design-system/components/date-input).
- **Acceptance focus:** Template phải đổi date, select/expire/recover một slot, announce concurrent conflict và chứng minh compact agenda-first cùng focus return từ calendar dialog.

## Prompt 13 — `spatial-seat-reservation`

- **Output boundary:** `knowledge/archetypes/flow/spatial-seat-reservation/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Chọn một hoặc nhiều chỗ dựa trên adjacency, spatial location, accessibility, category và price rồi giữ chúng trước checkout.
- **Required region graph:** `seat-reservation → event-and-party-context → seat-map-and-legend ↔ accessible-seat-list → selected-seat-summary → hold-timer-and-price → continue`; map và list share seat identity/selection.
- **Wide:** Bounded seat map và selection/price summary đồng hiện; pan/zoom không nuốt page keyboard, legend không chỉ dựa màu.
- **Intermediate:** Summary thành collapsible/temporary pane; map giữ minimum operable scale và accessible list vẫn reachable.
- **Compact:** Accessible seat list hoặc section drill-down là default; map là optional full-screen view, selection summary theo content và timer không che focus trên short-height.
- **State obligations:** layout loading, available/selected/held/unavailable/accessible seat, party adjacency warning, price change, hold countdown/expiry, concurrent conflict, map unavailable/list parity và checkout pending.
- **Hard rejection:** Reject cho time-slot booking, general map results explorer, plan/product selection, static venue map hoặc decorative seat chart không có reservation state.
- **Research anchors:** `APPLE-LAYOUT`, `M3-CANONICAL`, `FLUENT-LAYOUT`, `WAI-APG`, `WAI-REFLOW`; bổ sung [WAI-ARIA Grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) và [WCAG Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages).
- **Acceptance focus:** Template phải đồng bộ map/list selection, mô phỏng hold expiry và conflict, hỗ trợ keyboard seat choice và giữ full action parity khi compact mặc định sang list.

## Prompt 14 — `cart-checkout-flow`

- **Output boundary:** `knowledge/archetypes/flow/cart-checkout-flow/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Xác nhận line items, cung cấp fulfillment/contact/payment, rà soát tổng tiền và submit một order không trùng lặp.
- **Required region graph:** `checkout → cart-line-items → fulfillment-and-contact → payment-input → order-price-summary → review-and-terms → place-order-action`; price summary derives from cart và selected fulfillment.
- **Wide:** Checkout form là primary column, order summary persistent supporting rail chỉ khi reserve space và không che validation/focus.
- **Intermediate:** Order summary thành collapsible region nhưng total và material price changes vẫn hiện ngoài disclosure trước payment/submit.
- **Compact:** Tuần tự cart→fulfillment→payment→review; final total và line-item summary xuất hiện trước Place order, sticky CTA yield trên short-height.
- **State obligations:** empty/changed cart, stock unavailable, quantity conflict, shipping/tax recalculating, promo invalid, payment pending/declined/retry, price stale, submit duplicate prevention, success handoff và recoverable draft.
- **Hard rejection:** Reject cho one-plan purchase, generic review ledger không có cart/fulfillment/price ownership, post-order receipt, donation form hoặc `centered-single-task`.
- **Research anchors:** `SHOPIFY-HOME`, `USWDS-PATTERNS`, `GOVUK-PATTERNS`, `WAI-STATUS`, `WAI-OBSCURED`; bổ sung [GOV.UK Payment card details](https://design-system.service.gov.uk/patterns/payment-card-details/), [USWDS Complete a complex form](https://designsystem.digital.gov/patterns/complete-a-complex-form/) và [WCAG Error Prevention](https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data.html).
- **Acceptance focus:** Template phải cho sửa quantity/fulfillment, recalculate total, decline/retry payment và lock duplicate order while maintaining compact review parity.

## Prompt 15 — `plan-selection-purchase`

- **Output boundary:** `knowledge/archetypes/flow/plan-selection-purchase/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Hiểu trade-offs, chọn một plan cùng billing terms và hoàn tất purchase với price/consequence luôn gắn selection.
- **Required region graph:** `plan-purchase → purchase-context → plan-options-and-differences → billing-term-control → selected-plan-summary → payment-or-confirmation → purchase-action`; selected plan là shared state xuyên flow.
- **Wide:** Một số ít plan options đồng hiện với shared attributes; selected summary/CTA supporting, không biến thành full comparison matrix nếu decision set còn mở rộng.
- **Intermediate:** Giảm options đồng hiện hoặc dùng explicit plan selector; key differences và current price luôn cạnh selected state.
- **Compact:** Một plan tại một thời điểm hoặc vertically grouped options; compare essentials lặp có chủ đích, selected summary đứng trước purchase và không dùng horizontal card carousel làm đường duy nhất.
- **State obligations:** no selection, billing interval change, unavailable/recommended plan, eligibility constraint, price/tax recalculating, discount invalid, payment pending/declined, terms changed, purchase conflict và success handoff.
- **Hard rejection:** Reject cho broad comparison matrix trước shortlist, multi-line-item cart, narrative detail decision rail, account settings upgrade micro-action hoặc `centered-single-task`.
- **Research anchors:** `SHOPIFY-HOME`, `CARBON-GRID`, `FLUENT-LAYOUT`, `WAI-REFLOW`, `WAI-STATUS`; bổ sung [Stripe Checkout documentation](https://docs.stripe.com/payments/checkout) và [WCAG Error Prevention](https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data.html).
- **Acceptance focus:** Template phải đổi plan/billing term, giữ selected price context, mô phỏng price change/payment failure và compact selection không cần sideways scrolling.

## Prompt 16 — `split-reference-form`

- **Output boundary:** `knowledge/archetypes/flow/split-reference-form/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Nhập hoặc chuyển đổi dữ liệu trong khi phải liên tục đối chiếu một reference source có cấu trúc và anchors ổn định.
- **Required region graph:** `reference-form → task-and-reference-context → reference-source → form-sections → cross-reference-validation → save-and-continue-actions`; reference và form share anchors nhưng form owns submission.
- **Wide:** Reference pane và form đồng hiện; chỉ reference có bounded independent scroll khi anchor sync cần thiết, form giữ meaningful page/focus order.
- **Intermediate:** Reference thành collapsible rail hoặc drawer với current anchor summary; form không bị squeeze dưới readable width.
- **Compact:** Reference và form thành two-stage view hoặc anchored disclosure; mở/đóng reference trả đúng field, source anchor và draft value, không chỉ stack two long documents.
- **State obligations:** reference loading/missing/stale/version-changed, anchor selected/unresolved, form draft/validation, cross-field mismatch, autosave pending/error, conflict, permission và focus reference↔field.
- **Hard rejection:** Reject khi reference chỉ là hint ngắn, cho single-question step, list-detail explorer, document reader with notes, generic two-column form hoặc `centered-single-task`.
- **Research anchors:** `APPLE-SPLIT`, `FLUENT-LAYOUT`, `GOVUK-PATTERNS`, `WAI-REFLOW`, `WAI-FOCUS`; bổ sung [GOV.UK Question pages](https://design-system.service.gov.uk/patterns/question-pages/) và [WCAG Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html).
- **Acceptance focus:** Template phải sync reference anchor với focused field, handle stale reference, collapse 2→1 pane và restore exact draft/focus/source position.

## Prompt 17 — `consent-signature-ceremony`

- **Output boundary:** `knowledge/archetypes/flow/consent-signature-ceremony/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Review đúng version của một binding instrument, acknowledge required clauses, verify signer capacity và commit a signature with audit evidence.
- **Required region graph:** `signature-ceremony → instrument-identity-and-version → readable-instrument → required-clause-acknowledgements → signer-identity-and-capacity → signature-input → final-commit-and-audit-evidence`; instrument and acknowledgements are independent evidence owners.
- **Wide:** Readable instrument primary + acknowledgement/signature rail only when full clause context remains reachable; current version always visible.
- **Intermediate:** Signature region follows instrument/required clauses; outline/disclosures support navigation without hiding unread requirements.
- **Compact:** Instrument sections → acknowledgements → signer verification → signature → final review; return links preserve clause and draft signature state.
- **State obligations:** instrument loading/version changed, clause unread/acknowledged, signer mismatch, signature invalid, commit pending/duplicate prevention/success/failure, revoked/expired invitation and audit record.
- **Hard rejection:** Reject cho generic irreversible confirmation, split-reference data form, simple terms checkbox, document reader, approval request, hoặc narrative detail decision rail khi không đồng thời có versioned binding instrument, required clause acknowledgements, signer capacity và auditable signature evidence.
- **Research anchors:** `GOVUK-PATTERNS`, `USWDS-PATTERNS`, `WAI-FOCUS`, `WAI-STATUS`, `WAI-OBSCURED`.
- **Acceptance focus:** Template phải enforce version/required clauses, simulate signer mismatch and commit audit receipt while keeping document→acknowledgement associations at compact.

## Prompt 18 — `cross-party-handoff-flow`

- **Output boundary:** `knowledge/archetypes/flow/cross-party-handoff-flow/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Package work context, select an eligible recipient, set access/expiry and transfer responsibility with an explicit acceptance contract.
- **Required region graph:** `handoff-flow → work-package-summary → recipient-search-and-eligibility → access-and-redaction-scope → expiry-and-return-policy → recipient-preview → send-handoff → acceptance-tracker`; sender package and recipient acceptance are separate transaction owners.
- **Wide:** Package configuration primary + recipient preview/impact supporting; tracker replaces composer only after send.
- **Intermediate:** Preview reflows before send; eligibility and access consequences stay adjacent to recipient selection.
- **Compact:** Package → recipient → access/expiry → recipient preview → send → acceptance tracking; Back preserves exact draft and selected recipient.
- **State obligations:** recipient searching/eligible/ineligible, package incomplete/stale, redaction warning, invitation pending/accepted/declined/expired/revoked, resend/return, concurrent ownership conflict and focus handoff→tracker.
- **Hard rejection:** Reject cho approval routing, dual-list transfer, simple share dialog, support request composer, operational assignment row action, hoặc support handoff review nơi per-item retain/redact/omit và privacy risk—not transfer of responsibility plus recipient acceptance—own the transaction.
- **Research anchors:** `USWDS-PATTERNS`, `GOVUK-PATTERNS`, `SALESFORCE-COMPONENTS`, `WAI-STATUS`, `WAI-FOCUS`.
- **Acceptance focus:** Template phải show sender→recipient perspective, validate scope/eligibility, simulate accept/decline/expiry and preserve access evidence across responsive stages.

## Prompt 19 — `asynchronous-outcome-tracker`

- **Output boundary:** `knowledge/archetypes/flow/asynchronous-outcome-tracker/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Theo dõi một submitted case/request qua milestones kéo dài, biết expected update, respond to information requests và recover when progress stalls.
- **Required region graph:** `outcome-tracker → submission-identity-and-owner → current-milestone-and-expectation → ordered-milestone-history → outstanding-information-requests → submitted-record-and-messages → escalation-or-recovery`; current milestone derives from external progression, user cannot advance it directly.
- **Wide:** Milestone timeline + current expectation primary; knowledge/requests/record/support rail supporting, unresolved request precedes routine history.
- **Intermediate:** Supporting rail reflows; current milestone, due date and outstanding request remain visible together.
- **Compact:** Current state/expectation → outstanding action → milestone history → submitted record → escalation; full history disclosure does not crowd current action.
- **State obligations:** submitted/received/reviewing/waiting/external-decision/completed, delayed/no update, information requested/responding/accepted/rejected, owner changed, timeline partial, escalation pending and stale status.
- **Hard rejection:** Reject cho terminal receipt, user-controlled stage-gated record, order fulfillment with parallel shipments, support conversation or dashboard of many cases.
- **Research anchors:** `GOVUK-PATTERNS`, `USWDS-PATTERNS`, `SALESFORCE-COMPONENTS`, `WAI-STATUS`, `WAI-FOCUS`.
- **Acceptance focus:** Template phải simulate external milestones and info request, distinguish expectation from guarantee and preserve current/outstanding context before chronology at compact.
