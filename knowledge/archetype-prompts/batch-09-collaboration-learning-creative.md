# Batch 09 — Collaboration, learning and creative archetypes (20 prompts)

Tệp này là **một prompt batch tự chứa** cho creative production, live collaboration, learning evidence và service negotiation surfaces. Khi chạy ở nơi khác, đưa toàn bộ tệp cho agent để tạo đủ 20 leaf. Nếu chỉ chạy một mục, phải đưa kèm toàn bộ phần từ `Cách chạy` đến `Nguồn research dùng chung`; không tách riêng block prompt khỏi hợp đồng chung.

## Mục lục

| # | Archetype ID | Câu hỏi bố cục chính |
|---:|---|---|
| 01 | `storyboard-sequence-planner` | Làm sao tổ chức shots theo narrative continuity mà timing chỉ là bằng chứng phụ? |
| 02 | `print-proof-preflight-review` | Làm sao kiểm một output in theo lỗi sản xuất xác định và chặn phát hành khi chưa đạt? |
| 03 | `chart-specification-authoring-studio` | Làm sao author encoding spec, preview và accessible equivalent như ba mặt của cùng một chart? |
| 04 | `multi-rendition-creative-adaptation-workbench` | Làm sao biến một master thành nhiều rendition mà thấy rõ crop, safe area và override của từng target? |
| 05 | `editorial-rundown-control-board` | Làm sao điều khiển một chương trình live bằng cues, readiness và actual timing thay vì chỉ xem timeline? |
| 06 | `collective-bargaining-package-negotiation-workbench` | Làm sao hai bargaining sides giữ mandate riêng, exchange versioned counters, tentative issue deals và chỉ ratify cả package? |
| 07 | `moderated-briefing-qa-stage` | Làm sao triage, approve, merge và route câu hỏi quanh một briefing live? |
| 08 | `collaborative-ideation-convergence-board` | Làm sao hỗ trợ divergence rồi reveal, cluster, vote và converge mà không tạo bias sớm? |
| 09 | `multi-program-eligibility-screening` | Làm sao dùng một fact model để đánh giá nhiều chương trình độc lập mà vẫn giải thích từng kết quả? |
| 10 | `shift-handoff-acknowledgement-board` | Làm sao chuyển một cohort công việc giữa ca với acknowledgment theo từng item và global closure? |
| 11 | `care-transition-readiness-orchestrator` | Làm sao buộc nhiều owner operational cùng hội tụ trước khi recipient chấp nhận transition? |
| 12 | `referral-negotiation-exchange` | Làm sao thương lượng acceptance criteria và alternatives trước khi một recipient cam kết nhận referral? |
| 13 | `peer-instruction-revote-session` | Làm sao chạy đúng nhịp private vote → peer discussion → private revote rồi đọc response shift mà không biến thành consensus poll? |
| 14 | `assessment-item-calibration-workbench` | Làm sao calibrate item versions từ cohort responses, DIF và model fit rồi quyết định retain, revise hay retire? |
| 15 | `peer-review-exchange-cycle` | Làm sao điều phối reciprocal artifact review qua allocation, anonymity và phase gates? |
| 16 | `learning-evidence-portfolio-composer` | Làm sao map nhiều artifact vào nhiều outcomes kèm reflection và audience preview? |
| 17 | `prerequisite-pathway-planner` | Làm sao lập lộ trình nhiều kỳ khả thi theo prerequisites, evidence đã có và capacity? |
| 18 | `multi-item-return-resolution` | Làm sao xử lý reverse transaction khi mỗi line item có outcome và refund path khác nhau? |
| 19 | `odontogram-treatment-charting-workbench` | Làm sao chart trạng thái từng tooth×surface và chuyển planned → performed → superseded mà giữ longitudinal clinical truth? |
| 20 | `sealed-bid-multi-lot-award-workbench` | Làm sao mở sealed bids đúng hạn, test responsiveness và allocate nhiều lots dưới cross-lot constraints mà không negotiation hậu mở thầu? |

## Cách chạy

1. Trước mọi planning, source read hoặc write, đọc hết `.claude/INDEX.md` và tuân load order của Source đang chạy.
2. Thực thi **đúng 20 prompt** trong tệp này. Mỗi prompt tạo đúng bốn source artifact tại boundary đã ghi: `en.md`, `vi.md`, `context.md`, `template.html`.
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
- `SAP-FLOORPLANS` — [SAP Fiori page layouts and floorplans](https://experience.sap.com/fiori-design-web/explore_category/page-layouts/)
- `ESRI-LAYOUT` — [ArcGIS mapping application layouts](https://developers.arcgis.com/javascript/latest/creating-app-layouts/)
- `VSCODE-UX` — [Visual Studio Code UX guidelines](https://code.visualstudio.com/api/ux-guidelines/overview)
- `VA-PATTERNS` — [VA.gov Design System patterns](https://design.va.gov/patterns/)
- `WAI-DRAG` — [WCAG Understanding Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)
- `WAI-GRID` — [WAI-ARIA Grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)
- `WAI-TREEGRID` — [WAI-ARIA Treegrid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/)
- `WAI-AUTH` — [WCAG Understanding Accessible Authentication](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum)
- `NIST-PRIVACY` — [NIST Privacy Framework](https://www.nist.gov/privacy-framework)
- `NIST-AI` — [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
- `HL7-FHIR` — [HL7 FHIR specification](https://hl7.org/fhir/)
- `COCHRANE-HANDBOOK` — [Cochrane Handbook](https://training.cochrane.org/handbook/current)

Mỗi prompt dưới đây phải dùng các anchors phù hợp và tự bổ sung ít nhất một official source đặc thù cho dominant task. Không dùng gallery, roundup, Dribbble, Behance, Pinterest hoặc screenshot làm authority.

## Prompt 01 — `storyboard-sequence-planner`

- **Output boundary:** `knowledge/archetypes/work/storyboard-sequence-planner/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Plan a visual narrative sequence by arranging shots, preserving scene continuity and coverage, and resolving missing or contradictory story beats before production.
- **Required region graph:** `storyboard-planner → sequence-outline → scene-and-beat-navigator → shot-card-board ↔ selected-shot-detail → continuity-and-coverage-ledger → alternate-take-or-gap-resolution → sequence-review-export`; narrative order and continuity evidence, not a precision timeline, own the page.
- **Wide:** Sequence outline, shot board, selected-shot detail and continuity ledger remain visible together.
- **Intermediate:** Scene/beat navigation becomes a drawer; the active shot board and continuity ledger remain synchronized.
- **Compact:** Scene → beat → shot sequence → shot detail → continuity/gap review; reorder has move-before/move-after controls and the board never shrinks into illegible thumbnails.
- **State obligations:** sequence loading, scene empty, shot draft/approved, asset missing, continuity pass/conflict, coverage gap, reorder pending, review stale and export success/failure.
- **Hard rejection:** Reject cho multi-track timeline editor, media annotation, generic kanban or asset gallery; ordered narrative beats plus cross-shot continuity/coverage are mandatory.
- **Research anchors:** `APPLE-LAYOUT`, `SPECTRUM-COMPONENTS`, `WAI-DRAG`, `WAI-FOCUS`, `WAI-REFLOW`; add [ScreenSkills storyboard artist guidance](https://www.screenskills.com/job-profiles/roles/storyboard-artist/), [BBC Academy five essential shots](https://downloads.bbc.co.uk/academy/collegeofproduction/docs/five_essential_shots_ts.pdf) and [BBC Academy preparing for the edit](https://downloads.bbc.co.uk/academy/collegeofproduction/docs/preparing_for_the_edit_ts.pdf).
- **Acceptance focus:** Template must reorder shots without drag, expose a continuity conflict across two shots, resolve a missing coverage beat and preserve the selected scene across topology changes.

## Prompt 02 — `print-proof-preflight-review`

- **Output boundary:** `knowledge/archetypes/detail/print-proof-preflight-review/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Inspect a print-ready artifact against deterministic production constraints, locate each failure on the proof, repair or waive it with evidence, and gate release.
- **Required region graph:** `preflight-review → job-and-output-profile → proof-page-navigator ↔ rendered-proof-stage → issue-ledger → selected-issue-location-and-rule → repair-or-waiver → release-gate-and-report`; issue-to-proof traceability owns navigation.
- **Wide:** Page navigator, proof, issue ledger and selected rule evidence coexist.
- **Intermediate:** Page navigator becomes a drawer while proof and active issue remain side by side; the release gate stays adjacent.
- **Compact:** Issue-first queue → affected proof excerpt → rule and repair → next issue → release summary; full-page proof is an optional zoomed region with bounded overflow.
- **State obligations:** proof rendering, no pages, issue open/fixed/waived, font/image/color/profile failure, stale proof after repair, waiver unauthorized, release blocked/ready and report export.
- **Hard rejection:** Reject cho evidence dossier, media annotation, generic document preview, print imposition or human QA checklist; machine-evaluable production constraints, failures located on the exact output page/region, correction rerun and binary release block are mandatory—no claim/evidence adjudication owns acceptance.
- **Research anchors:** `SPECTRUM-COMPONENTS`, `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`; add [Adobe Acrobat preflight reports](https://helpx.adobe.com/acrobat/using/preflight-reports-acrobat-pro.html), [PDF/X ISO 15930](https://pdfa.org/resource/iso-15930-pdfx/) and [W3C complex images](https://www.w3.org/WAI/tutorials/images/complex/).
- **Acceptance focus:** Template must select an issue from the ledger, reveal its exact proof location and rule, demonstrate repair versus authorized waiver and keep release blocked until all blockers resolve.

## Prompt 03 — `chart-specification-authoring-studio`

- **Output boundary:** `knowledge/archetypes/work/chart-specification-authoring-studio/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Author a chart specification by mapping fields to visual encodings, configuring scales and annotations, validating the result, and maintaining an equivalent accessible data explanation.
- **Required region graph:** `chart-studio → data-field-schema → mark-and-encoding-specification ↔ live-chart-preview → scale-legend-annotation-inspector → validation-ledger → accessible-table-and-narrative → publish-export`; specification and semantic equivalent are peer owners.
- **Wide:** Field schema, encoding editor, preview and accessibility/validation rail remain visible.
- **Intermediate:** Field schema becomes a drawer; specification and preview retain a split while validation/accessibility moves below.
- **Compact:** Choose mark → map fields → configure scale/annotation → inspect preview → review accessible table/narrative → validate; no precision drag is required.
- **State obligations:** data loading/empty, field compatible/incompatible, spec valid/error, preview pending/failure, annotation missing, contrast/label warning, accessible equivalent stale and publish success.
- **Hard rejection:** Reject cho query builder, palette/token editor, pivot table, dashboard composition, generic code playground or chart viewer; semantic data fields must be bound to visual channels/transforms/scales and compile into both a chart and equivalent table/narrative—database retrieval and color selection are not the dominant task.
- **Research anchors:** `CARBON-GRID`, `WAI-GRID`, `WAI-FOCUS`, `WAI-REFLOW`; add [Vega-Lite specification](https://vega.github.io/vega-lite/docs/), [W3C charts accessibility](https://www.w3.org/WAI/tutorials/images/complex/) and [Microsoft chart accessibility](https://support.microsoft.com/en-us/office/make-your-excel-charts-accessible-19e81ce7-88af-4a3f-a4ef-a26c344527b3).
- **Acceptance focus:** Template must map fields to encodings, surface an invalid mapping, update preview and accessible table from the same spec and return focus to the exact edited encoding.

## Prompt 04 — `multi-rendition-creative-adaptation-workbench`

- **Output boundary:** `knowledge/archetypes/work/multi-rendition-creative-adaptation-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Adapt one approved creative master into multiple target renditions while preserving message hierarchy, asset lineage, safe areas and explicit per-target overrides.
- **Required region graph:** `adaptation-workbench → master-creative-and-message-rules → target-rendition-matrix → selected-rendition-stage ↔ crop-layout-content-overrides → cross-rendition-consistency-ledger → approval-and-export-manifest`; master-to-target propagation owns the topology.
- **Wide:** Master, rendition matrix, selected stage and consistency ledger remain concurrently visible.
- **Intermediate:** Master becomes a comparison drawer; selected rendition and override/consistency regions remain primary.
- **Compact:** Target selector → inherited master rules → rendition stage → explicit overrides → cross-target warnings → approval/export; target previews become a list, not a miniature wall.
- **State obligations:** master loading/locked, target missing, inherited/overridden, crop unsafe, copy overflow, asset unavailable, consistency warning, approval pending/rejected and export partial/complete.
- **Hard rejection:** Reject cho localization workbench, canvas inspector, responsive page preview or asset gallery; one-to-many master propagation with target-specific safe-area and override provenance is mandatory.
- **Research anchors:** `SPECTRUM-COMPONENTS`, `APPLE-LAYOUT`, `WAI-DRAG`, `WAI-REFLOW`; add [Google Ads asset requirements](https://support.google.com/google-ads/answer/13676244), [Meta ad aspect ratios](https://www.facebook.com/business/help/103816146375741) and [W3C text alternatives](https://www.w3.org/WAI/tutorials/images/).
- **Acceptance focus:** Template must switch among target renditions, show inherited versus overridden properties, detect an unsafe crop and prove that a master change propagates without erasing an approved override.

## Prompt 05 — `editorial-rundown-control-board`

- **Output boundary:** `knowledge/archetypes/overview/editorial-rundown-control-board/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Operate a live editorial rundown by sequencing segments, confirming readiness, issuing cues, recording actual timing and adapting the remaining program without losing editorial intent.
- **Required region graph:** `rundown-control → program-clock-and-live-state → segment-rundown → current-next-on-deck → selected-segment-cues-and-assets → role-readiness-matrix → actual-versus-planned-time → hold-skip-reorder-controls → as-run-log`; current/next cue ownership governs the page.
- **Wide:** Rundown, current/next stage, readiness rail and program clock/as-run status remain visible.
- **Intermediate:** Current and next segments own the main view; full rundown becomes a drawer and readiness moves below.
- **Compact:** Now → next → cue/confirm → record outcome → advance; complete rundown and as-run history are secondary routes, with no compressed timeline dependency.
- **State obligations:** off-air/rehearsal/live/paused, segment ready/blocked/skipped, asset missing, role unconfirmed, cue pending/acknowledged, over/under time, rundown changed and as-run logging failure.
- **Hard rejection:** Reject cho timeline monitor, generic queue, meeting agenda or video player; live cue issuance, role readiness, current-next ownership and as-run reconciliation are mandatory.
- **Research anchors:** `VSCODE-UX`, `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`; add [BBC editorial guidelines](https://www.bbc.com/editorialguidelines/) and [EBU production technology](https://tech.ebu.ch/).
- **Acceptance focus:** Template must cue the current segment, acknowledge a role, handle a blocked next segment, update planned versus actual time and preserve the live state when the rundown drawer opens.

## Prompt 06 — `collective-bargaining-package-negotiation-workbench`

- **Output boundary:** `knowledge/archetypes/work/collective-bargaining-package-negotiation-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Reconcile exactly two recognized bargaining sides’ versioned mandates into one whole collective-agreement package through issue-specific offers/counters, combined costing, tentative agreements and each side’s independent ratification.
- **Required region graph:** `bargaining-workbench → recognized-two-party-bargaining-unit-and-private-mandates → governed-issue-register → immutable-versioned-offer-counteroffer-ledger ↔ costing-and-operational-impact → tentative-issue-agreement-set → unresolved-package-dependencies-and-reservations → whole-package-consolidation → independent-party-ratification-authorities → signed-collective-agreement-and-implementation-record`; offer lineage, non-final tentative status and whole-package ratification are separate owners.
- **Wide:** Issue register, active bilateral offer lineage, combined costing and tentative/package status remain visible; no issue appears final while whole-package reservations remain open.
- **Intermediate:** Active issue/counter and global package impact stay primary; mandates and prior versions become role-scoped drawers while tentative-versus-ratified state persists.
- **Compact:** Mandate boundary → package version/counter → issue deltas/tentatives → combined impact → unresolved dependency → whole-package validation → each side’s ratification → signed record; chronology never replaces issue ownership.
- **State obligations:** side recognized/authority-unverified, mandate private/released/expired, issue open/offered/countered/withdrawn/tentatively-agreed/reserved, proposal version stale, package impact calculating/over-mandate, tentative set consistent/conflicted, impasse/mediation, ratification pending/approved/rejected and agreement signed/superseded.
- **Hard rejection:** Reject cho `multi-party-consensus-workbench`, referral negotiation, multi-creditor hardship, meeting facilitation, chat or generic contract editor; exactly two sides, private mandate boundaries, immutable bilateral package counters, non-final tentative issue agreements, cross-issue package consistency and two independent terminal ratifications are mandatory—no quorum/shared proposal, recipient acceptance or independently settled creditor decides the result.
- **Research anchors:** `WAI-FOCUS`, `WAI-REFLOW`, `WAI-STATUS`; add [ILO collective bargaining and labour relations](https://www.ilo.org/topics-and-sectors/collective-bargaining-and-labour-relations), [NLRB employer/union rights and obligations](https://www.nlrb.gov/about-nlrb/rights-we-protect/your-rights/employer-union-rights-and-obligations) and [GOV.UK collective bargaining](https://www.gov.uk/working-with-trade-unions/collective-bargaining).
- **Acceptance focus:** Template must exchange two versioned counters, tentatively agree one issue without finalizing it, show another issue pushing the package beyond mandate, reopen/reserve it, require both ratifications and preserve issue/version/package state through compact stages.

## Prompt 07 — `moderated-briefing-qa-stage`

- **Output boundary:** `knowledge/archetypes/flow/moderated-briefing-qa-stage/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Moderate audience questions around a live briefing by triaging submissions, merging duplicates, routing approved questions to speakers, and publishing answered outcomes.
- **Required region graph:** `briefing-qa → briefing-stage-and-topic → incoming-question-queue → moderation-and-duplicate-clusters → approved-run-of-show → speaker-routing-and-live-answer → answered-published-archive`; moderation lifecycle, not conversation chronology, owns the surface.
- **Wide:** Briefing stage, incoming queue, moderation detail and approved/run-of-show regions coexist.
- **Intermediate:** Stage and approved questions remain primary; incoming queue and moderation detail become drawers.
- **Compact:** Question queue → selected moderation decision → approved speaker route → live answer status → published outcome; stage context remains a compact persistent header.
- **State obligations:** briefing scheduled/live/ended, question pending/approved/rejected/merged, sensitive content flagged, speaker unavailable, queued/asked/answered, answer unpublished, moderation conflict and archive success.
- **Hard rejection:** Reject cho chat, facilitated meeting, media annotation or support inbox; question moderation, duplicate clustering, speaker routing and published answer lifecycle are mandatory.
- **Research anchors:** `WAI-STATUS`, `WAI-FOCUS`, `WAI-APG`, `WAI-REFLOW`; add [Microsoft Teams Q&A moderation](https://support.microsoft.com/en-us/office/q-a-in-microsoft-teams-f3c84c72-57c3-4b6d-aea5-67b11face787) and [Zoom Q&A controls](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0064385).
- **Acceptance focus:** Template must approve, merge and reject questions, route one to a speaker, announce live-answer transitions and publish the final answer without exposing rejected content.

## Prompt 08 — `collaborative-ideation-convergence-board`

- **Output boundary:** `knowledge/archetypes/work/collaborative-ideation-convergence-board/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Run a collaborative ideation cycle that separates private divergence from reveal, clustering, criteria-based voting and convergence on a small set of next experiments.
- **Required region graph:** `ideation-board → challenge-and-phase → private-idea-capture → controlled-reveal → clustering-and-labeling → criteria-and-hidden-vote → ranked-themes-and-discussion → selected-experiments-and-owners`; phase gates protect unbiased contribution.
- **Wide:** Challenge/phase, idea space, clustering/voting workspace and convergence rail remain visible as allowed by the phase.
- **Intermediate:** Current phase owns the main surface; challenge context stays pinned and prior/next phase evidence becomes a drawer.
- **Compact:** Prompt → private capture → reveal list → cluster assignment → hidden vote → ranked discussion → experiment commitment; every spatial move has explicit list controls.
- **State obligations:** lobby/diverge/reveal/cluster/vote/converge/closed, idea private/revealed, cluster unlabeled, duplicate suspected, vote hidden/submitted/locked, tie, experiment unowned and session recovery.
- **Hard rejection:** Reject cho generic whiteboard, kanban, meeting workspace or consensus decision; protected phase transitions, controlled reveal, hidden vote and experiment commitment are mandatory.
- **Research anchors:** `WAI-DRAG`, `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`; add [UK Government Service Manual workshop guidance](https://www.gov.uk/service-manual/agile-delivery/how-the-discovery-phase-works) and [IDEO brainstorming](https://www.designkit.org/methods/brainstorm.html).
- **Acceptance focus:** Template must keep private ideas hidden before reveal, cluster with keyboard alternatives, prevent premature vote visibility, handle a tie and commit a selected theme to an owned experiment.

## Prompt 09 — `multi-program-eligibility-screening`

- **Output boundary:** `knowledge/archetypes/discovery/multi-program-eligibility-screening/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Screen one person or household against multiple independent programs using a shared fact model while preserving program-specific criteria, unknowns and next steps.
- **Required region graph:** `eligibility-screening → person-household-facts → program-catalog-and-scope → program-criteria-evaluators ×n → eligible-possibly-not-eligible-results → missing-fact-and-evidence-plan → comparison-and-next-actions`; each program owns an independent verdict.
- **Wide:** Shared facts, program result matrix and selected criteria explanation remain visible.
- **Intermediate:** Result matrix becomes primary; facts and selected program evidence use synchronized drawers.
- **Compact:** Facts summary → program result list → selected program criteria/unknowns → evidence or next action; no wide matrix is required.
- **State obligations:** facts incomplete/stale, program loading/closed, criterion met/not-met/unknown, conflicting evidence, eligible/possibly/not-eligible, manual review, application unavailable and screening saved.
- **Hard rejection:** Reject cho `multi-service-life-event-orchestrator`, troubleshooting wizard, service hub, plan comparison or application flow; one read-only fact set must produce side-by-side eligible/ineligible/unknown verdicts from autonomous program rule sets, with no downstream service submissions, handoffs or receipts.
- **Research anchors:** `GOVUK-PATTERNS`, `USWDS-PATTERNS`, `VA-PATTERNS`, `WAI-REFLOW`, `WAI-STATUS`; add [US Benefits eligibility](https://www.usa.gov/benefit-finder) and [GOV.UK benefits calculators](https://www.gov.uk/benefits-calculators).
- **Acceptance focus:** Template must evaluate at least three programs, explain each verdict separately, request one missing fact without erasing completed evidence and route an uncertain result to manual review.

## Prompt 10 — `shift-handoff-acknowledgement-board`

- **Output boundary:** `knowledge/archetypes/flow/shift-handoff-acknowledgement-board/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Transfer responsibility for a shift cohort by presenting unresolved items, risks and context, collecting per-item receiving acknowledgements, and closing the outgoing shift only when coverage is explicit.
- **Required region graph:** `shift-handoff → outgoing-incoming-shift-identity → cohort-summary → handoff-item-board → selected-item-context-and-risk → receiver-acknowledgement-per-item → exception-and-question-loop → coverage-summary-and-global-close`; cohort coverage, not one case, owns completion.
- **Wide:** Cohort board, selected item detail, acknowledgements and closure summary remain visible.
- **Intermediate:** Cohort and acknowledgement status remain primary; item detail becomes a drawer.
- **Compact:** Risk-prioritized item list → item context → acknowledge/question/reject → coverage summary → global close; unresolved items remain reachable.
- **State obligations:** handoff not-started/in-progress/closed, item ready/incomplete/high-risk, receiver absent, acknowledged/questioned/rejected, context stale, partial coverage, close blocked and late correction.
- **Hard rejection:** Reject cho cross-party handoff, task board, inbox or checklist; one shift cohort, per-item receiving proof and a global closure gate are mandatory.
- **Research anchors:** `CARBON-TABLE`, `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`; add [WHO patient handover communication](https://cdn.who.int/media/docs/default-source/patient-safety/patient-safety-solutions/ps-solution3-communication-during-patient-handovers.pdf?sfvrsn=7a54c664_8) and [AHRQ TeamSTEPPS handoff](https://www.ahrq.gov/teamstepps-program/curriculum/communication/tools/handoff.html).
- **Acceptance focus:** Template must acknowledge items independently, open a clarification loop, block global close on uncovered risk and preserve incoming/outgoing responsibility evidence.

## Prompt 11 — `care-transition-readiness-orchestrator`

- **Output boundary:** `knowledge/archetypes/flow/care-transition-readiness-orchestrator/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Orchestrate readiness for a care transition by aligning clinical, medication, equipment, transport, education and recipient-acceptance owners before the transfer occurs.
- **Required region graph:** `transition-orchestrator → transition-subject-and-target → readiness-domain-board → domain-owner-evidence ×n → dependency-and-blocker-graph → recipient-understanding-and-acceptance → go-no-go-review → transfer-receipt-and-follow-up`; cross-domain convergence owns the go/no-go decision.
- **Wide:** Readiness domains, selected evidence, dependency/blocker graph and recipient acceptance remain visible.
- **Intermediate:** Domain board and blockers remain primary; detailed evidence and acceptance become synchronized sheets.
- **Compact:** Readiness summary → blocking domain → owner/evidence/action → recipient understanding → go/no-go → receipt/follow-up; only one domain is expanded at a time.
- **State obligations:** transition proposed/scheduled/delayed/completed, domain ready/blocked/unknown, owner missing, evidence stale, dependency unresolved, recipient not-ready/accepted, go/no-go pending and post-transfer exception.
- **Hard rejection:** Reject cho evidence-led case dossier, task checklist, referral negotiation, single case handoff or appointment booking; coupled clinical/logistical/social readiness domains must converge into an executable transition and explicit receiving-party acceptance—evidence sufficiency or a case verdict alone cannot complete it.
- **Research anchors:** `NHS-PATTERNS`, `HL7-FHIR`, `WAI-STATUS`, `WAI-FOCUS`; add [AHRQ care transitions](https://www.ahrq.gov/patient-safety/settings/hospital/resource/guide/index.html) and [42 CFR 482.43 discharge planning](https://www.ecfr.gov/current/title-42/chapter-IV/subchapter-G/part-482/subpart-C/section-482.43).
- **Acceptance focus:** Template must expose independent readiness owners, trace a blocker dependency, record recipient understanding, prohibit go on missing evidence and issue a transition receipt.

## Prompt 12 — `referral-negotiation-exchange`

- **Output boundary:** `knowledge/archetypes/flow/referral-negotiation-exchange/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Negotiate a referral between sender and potential recipient by clarifying need, capacity, acceptance requirements and alternatives before responsibility transfers.
- **Required region graph:** `referral-exchange → referral-need-and-urgency → sender-evidence-package → recipient-capability-and-capacity → requirement-question-counter-loop → alternative-recipient-or-service-options → acceptance-decline-expiry → responsibility-transfer-and-receipt`; negotiation precedes handoff.
- **Wide:** Referral evidence, recipient response/capability and negotiation thread remain visible with the disposition rail.
- **Intermediate:** Active negotiation and requirements own the workspace; evidence and alternatives become drawers.
- **Compact:** Need summary → recipient requirements/questions → sender response/evidence → accept/decline/alternative → transfer receipt; chronology does not replace structured requirements.
- **State obligations:** draft/sent/viewed, evidence incomplete, recipient capacity unknown/full, question open/answered, counter proposed, accepted/declined/expired, alternate pending and transfer failed/completed.
- **Hard rejection:** Reject cho multi-party consensus, support chat, completed cross-party handoff, provider directory or appointment booking; one sender and one candidate recipient must exchange structured capability/requirement offers and counters until that recipient accepts or declines a binding service commitment—there is no shared proposal or group consensus rule.
- **Research anchors:** `NHS-PATTERNS`, `HL7-FHIR`, `WAI-STATUS`, `WAI-FOCUS`; add [HL7 FHIR ServiceRequest](https://hl7.org/fhir/servicerequest.html) and [NHS e-Referral Service](https://digital.nhs.uk/services/e-referral-service).
- **Acceptance focus:** Template must surface a recipient requirement, attach responsive evidence, propose an alternative on capacity failure and transfer responsibility only after explicit acceptance.

## Prompt 13 — `peer-instruction-revote-session`

- **Output boundary:** `knowledge/archetypes/work/peer-instruction-revote-session/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Run one live peer-instruction round in which learners answer privately, the first response set is frozen and concealed, peers discuss reasoning, learners independently revote, and the facilitator interprets response shift before explaining or advancing.
- **Required region graph:** `peer-instruction-session → concept-question-and-round-policy → private-first-response-capture → immutable-concealed-first-response-set → facilitator-threshold-gate → peer-discussion-assignment → private-revote-capture → learner-paired-and-cohort-response-shift → explanation-and-next-round`; the phase gate and first↔revote provenance own the page, and a revote never overwrites its first response.
- **Wide:** Question/response stage, role-scoped facilitator controls, participation coverage and the authorized first-versus-revote distribution coexist; early distributions remain concealed from learners.
- **Intermediate:** Active phase and response controls remain primary; coverage and facilitator controls become role-scoped drawers, while paired numeric summaries replace the comparison chart after revoting.
- **Compact:** Concept → private first response → locked receipt/gate → discussion → private revote → personal and cohort shift → explanation; only the current phase is operable and no mini dashboard remains.
- **State obligations:** session scheduled/live/paused/ended, learner joined/reconnecting/absent, first answer draft/submitted/locked, coverage insufficient/sufficient, distribution concealed/released, discussion assigned/active/overtime, revote unopened/open/submitted/missing, response unchanged/changed, explanation pending/released and next round ready/blocked; expiry preserves entries and accommodation.
- **Hard rejection:** Reject cho assessment attempt, single-question step, survey/poll, collaborative ideation convergence, generic meeting or consensus workspace; two immutable identity-paired response passes, first-result concealment, intervening peer reasoning and delta interpretation are mandatory, and no consensus answer is produced.
- **Research anchors:** `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`; add [Harvard ABLConnect peer instruction](https://ablconnect.harvard.edu/peer-instruction-research), [Cornell peer-discussion polling](https://teaching.cornell.edu/teaching-resources/active-collaborative-learning/collaborative-learning/incorporating-short-peer), [1EdTech QTI](https://www.1edtech.org/standards/qti/index) and [W3C Timing Adjustable](https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html).
- **Acceptance focus:** Template must prove a private first vote, immutable receipt, threshold-controlled discussion, independent revote, accessible learner-paired and cohort delta, reconnect recovery, explanation release and phase-by-phase compact parity without leaking early results.

## Prompt 14 — `assessment-item-calibration-workbench`

- **Output boundary:** `knowledge/archetypes/work/assessment-item-calibration-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Calibrate versioned assessment items from cohort response behavior, then retain, revise or retire each item and release a calibrated bank.
- **Required region graph:** `assessment-form-cohort-and-model → item-bank-version → selected-item-content-and-key ↔ option-response-distribution → model-fit-and-item-characteristic-information → differential-functioning-and-exposure → retain-revise-or-retire → downstream-form-information-impact → calibrated-bank-release`; item version, fitted cohort/model and lifecycle decision jointly own the outcome.
- **Wide:** Flagged-item queue, selected content/key, response/model evidence, DIF/exposure and decision/form-impact rail coexist.
- **Intermediate:** Flagged items and calibration evidence remain primary; content/key becomes an anchored drawer while decision state and downstream form impact persist.
- **Compact:** Flagged item → stem/key/options → numeric option table → model fit and item information → DIF/exposure → retain/revise/retire → form impact → release; charts are optional companions to complete tables.
- **State obligations:** item draft/active/retired, sample sufficient/insufficient, distractor functioning/nonfunctioning, model fitting/failed, parameter stable/unstable, DIF clear/flagged/reviewing, exposure safe/high, decision draft/approved/rejected, bank dirty and release pending/conflict/success.
- **Hard rejection:** Reject cho rubric grading, learner assessment attempt, scenario dashboard or generic analytics drilldown; item-version lineage, response-model fit, item characteristic/information evidence, DIF and downstream form impact are mandatory.
- **Research anchors:** `WAI-GRID`, `WAI-FOCUS`, `WAI-REFLOW`, `WAI-STATUS`; add [1EdTech QTI](https://www.1edtech.org/standards/qti/index), the [OECD PISA 2022 Technical Report](https://www.oecd.org/content/dam/oecd/en/publications/reports/2024/03/pisa-2022-technical-report_599753f0/01820d6d-en.pdf) and the [Standards for Educational and Psychological Testing](https://www.testingstandards.net/).
- **Acceptance focus:** Template must flag one item, expose numeric response and uncertainty evidence, detect insufficient sample or DIF, revise the lifecycle decision, show downstream form-information impact and release only a coherent calibrated version.

## Prompt 15 — `peer-review-exchange-cycle`

- **Output boundary:** `knowledge/archetypes/flow/peer-review-exchange-cycle/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Run a reciprocal peer-review cycle by allocating artifacts, protecting identity rules, gating review phases, resolving missing reviews and releasing feedback fairly.
- **Required region graph:** `peer-review-cycle → assignment-and-phase-policy → participant-artifact-pool → allocation-and-anonymity-map → assigned-review-work → submission-and-quality-check → coverage-and-exception-board → feedback-release-and-author-response`; allocation fairness and phase gates own the cycle.
- **Wide:** Cycle status, allocation map, selected review work and coverage/exception rail remain visible to authorized roles.
- **Intermediate:** Assigned review work remains primary; allocation and coverage become role-scoped drawers.
- **Compact:** Assigned artifact → rubric/evidence review → submit → next assignment → release status → author response; identities remain masked wherever policy requires.
- **State obligations:** enrollment open/locked, artifact missing, allocation pending/conflict, identity masked/revealed, review draft/submitted/late, quality check failed, coverage incomplete, feedback held/released and author response.
- **Hard rejection:** Reject cho task list, rubric grading studio, comment thread or approval workflow; reciprocal allocation, anonymity policy, phase gates and coverage recovery are mandatory.
- **Research anchors:** `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`, `WAI-AUTH`; add [Moodle Workshop activity](https://docs.moodle.org/405/en/Workshop_activity) and [1EdTech LTI Assignment and Grade Services](https://www.imsglobal.org/spec/lti-ags/v2p0).
- **Acceptance focus:** Template must allocate reviews without leaking identity, block feedback before phase release, recover a missing reviewer and let authors respond to released feedback.

## Prompt 16 — `learning-evidence-portfolio-composer`

- **Output boundary:** `knowledge/archetypes/work/learning-evidence-portfolio-composer/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Compose a learning portfolio by mapping artifacts to multiple outcomes, adding reflection and provenance, identifying evidence gaps, and previewing the audience-specific presentation.
- **Required region graph:** `portfolio-composer → learner-goals-and-audience → artifact-library ↔ outcome-framework → artifact-outcome-evidence-map → selected-artifact-reflection-and-provenance → coverage-gap-summary → audience-preview-and-publish`; many-to-many evidence mapping owns composition.
- **Wide:** Artifact library, outcome framework/map, selected reflection and audience preview remain visible.
- **Intermediate:** Artifact/outcome map remains primary; libraries become drawers and preview becomes an alternate pane.
- **Compact:** Outcome or artifact entry → linked evidence → reflection/provenance → coverage gaps → audience preview → publish; matrix becomes bidirectional grouped lists.
- **State obligations:** artifact loading/missing, outcome active/retired, link proposed/confirmed, evidence weak/strong, reflection draft, permission restricted, coverage gap, preview stale and publish pending/failure.
- **Hard rejection:** Reject cho dual-list transfer, generic portfolio gallery, cross-framework mapper or document builder; evidence-bearing many-to-many artifact/outcome links plus reflection and audience preview are mandatory.
- **Research anchors:** `CARBON-GRID`, `WAI-GRID`, `WAI-FOCUS`, `WAI-REFLOW`; add [1EdTech Open Badges](https://www.imsglobal.org/spec/ob/v3p0) and [Europass digital credentials](https://europa.eu/europass/en/european-digital-credentials-learning).
- **Acceptance focus:** Template must map one artifact to multiple outcomes and vice versa, expose a coverage gap, preserve provenance/permissions and update an audience-specific preview.

## Prompt 17 — `prerequisite-pathway-planner`

- **Output boundary:** `knowledge/archetypes/discovery/prerequisite-pathway-planner/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Plan a feasible multi-term learning pathway by reconciling prerequisite dependencies, prior evidence, offering schedules, capacity and learner load.
- **Required region graph:** `pathway-planner → target-credential-and-constraints → prerequisite-dependency-graph → learner-evidence-and-waivers → offering-term-capacity-catalog → candidate-term-plan → conflict-and-critical-path-ledger → selected-pathway-and-checkpoints`; feasibility across terms owns the plan.
- **Wide:** Dependency graph, learner evidence, term plan and conflict ledger remain visible.
- **Intermediate:** Term plan and critical prerequisites remain primary; full graph and offering catalog become drawers.
- **Compact:** Target → unmet prerequisites → eligible next choices → term-by-term plan → conflicts/alternatives → checkpoints; graph transforms to dependency paths.
- **State obligations:** target unknown, evidence pending/accepted/rejected, prerequisite met/unmet/waived, offering unavailable/full, load exceeded, dependency cycle, plan feasible/conditional/impossible and checkpoint saved.
- **Hard rejection:** Reject cho critical-path project planner, course catalog, generic roadmap, configuration resolver or calendar; credential prerequisites, learner evidence/waivers, discrete term offerings and cohort capacity jointly determine feasibility—activity durations, earliest/latest dates and float are outside the topology.
- **Research anchors:** `WAI-TREEGRID`, `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`; add [1EdTech Comprehensive Learner Record](https://www.imsglobal.org/activity/comprehensive-learner-record), [1EdTech Edu-API course offerings](https://standards.1edtech.org/edu-api/specifications/standards/v1p0) and [Temple University prerequisites and corequisites policy](https://bulletin.temple.edu/undergraduate/academic-policies/prerequisites-corequisites/).
- **Acceptance focus:** Template must apply prior evidence, reveal an unmet prerequisite path, resolve an over-capacity term with an alternative and preserve feasibility explanation in compact mode.

## Prompt 18 — `multi-item-return-resolution`

- **Output boundary:** `knowledge/archetypes/flow/multi-item-return-resolution/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Resolve a return containing multiple line items by evaluating item-specific eligibility, selecting heterogeneous outcomes, coordinating logistics and reconciling refund value.
- **Required region graph:** `return-resolution → order-and-return-window → line-item-return-board → selected-item-condition-reason-evidence → item-eligibility-and-outcome → shipment-dropoff-or-no-return-logistics → refund-credit-exchange-ledger → review-submit-receipt`; each line owns an independent reverse outcome.
- **Wide:** Line items, selected item resolution, logistics and refund ledger remain visible.
- **Intermediate:** Line board and selected outcome remain primary; logistics/refund summary stays adjacent or below.
- **Compact:** Item list → item reason/evidence → eligible outcomes → logistics → next item → total refund/review → submit; heterogeneous statuses remain visible.
- **State obligations:** order loading, item eligible/ineligible/conditional, reason/evidence incomplete, quantity conflict, refund/exchange/credit selected, label pending/failure, mixed logistics, amount mismatch, submit pending and partial acceptance.
- **Hard rejection:** Reject cho checkout, generic refund form, order detail or batch action table; per-line eligibility/outcome plus conserved refund reconciliation and reverse logistics are mandatory.
- **Research anchors:** `SHOPIFY-HOME`, `CARBON-TABLE`, `WAI-STATUS`, `WAI-FOCUS`; add [Shopify returns management](https://help.shopify.com/en/manual/fulfillment/managing-orders/returns) and [FTC consumer refunds guidance](https://consumer.ftc.gov/articles/solving-problems-business-returns-refunds-and-other-resolutions).
- **Acceptance focus:** Template must resolve at least three lines differently, explain one ineligible outcome, reconcile refund totals, generate mixed logistics and recover a failed label without duplicate submission.

## Prompt 19 — `odontogram-treatment-charting-workbench`

- **Output boundary:** `knowledge/archetypes/work/odontogram-treatment-charting-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Record current findings and planned, performed or superseded treatment at exact teeth and surfaces while preserving a constrained longitudinal dental state.
- **Required region graph:** `dental-chart → dentition-and-notation-context → fixed-tooth-by-surface-semantic-matrix ↔ selected-tooth-finite-state-ledger → planned-procedure-layer → performed-or-superseded-transition-layer → notation-and-state-consistency-gate → signed-chart-snapshot`; discrete dentition topology and valid temporal state transitions, not drawable annotations, own truth.
- **Wide:** Full semantic dentition matrix, selected tooth/surface ledger, procedure layers, history and consistency gate remain visible.
- **Intermediate:** Odontogram matrix stays primary; state-transition editor and longitudinal history become synchronized alternate panes without losing tooth/surface address.
- **Compact:** Dentition/quadrant → keyboard-addressable tooth×surface grid → current finite state → planned/performed/superseded transition → history → sign; it never shrinks a mouth canvas.
- **State obligations:** dentition primary/mixed/permanent, tooth present/missing/unerupted, surface sound/pathology/restored, procedure planned/performed/superseded, transition permitted/contradictory, notation compatible/invalid, history loading/conflicted and snapshot unsigned/signing/signed/amended.
- **Hard rejection:** Reject cho `media-annotation-workbench`, `canvas-inspector-studio`, image markup, spreadsheet or generic record form; non-visual tooth/surface addressing, mutually exclusive finite states and validated planned→performed→superseded transitions are mandatory.
- **Research anchors:** `WAI-GRID`, `WAI-FOCUS`, `WAI-REFLOW`, `WAI-STATUS`; add the [ADA Universal Tooth Designation System](https://www.ada.org/-/media/project/ada-organization/ada/ada-org/files/publications/cdt/universal_tooth_designation_system_valueset_2.pdf), [HL7 Dental Data Exchange](https://hl7.org/fhir/us/dental-data-exchange/) and [ISO 3950 tooth designation](https://www.iso.org/standard/68292.html).
- **Acceptance focus:** Template must select any tooth/surface without pointer input, distinguish clinical states without color alone, reject an impossible transition or incompatible notation, preserve history through compact reflow and sign an immutable chart snapshot.

## Prompt 20 — `sealed-bid-multi-lot-award-workbench`

- **Output boundary:** `knowledge/archetypes/work/sealed-bid-multi-lot-award-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Open a version-bound set of sealed bids only after the deadline, test bidder and bid responsiveness, allocate multiple lots under disclosed cross-lot constraints and produce an auditable award without post-opening negotiation.
- **Required region graph:** `sealed-award-workbench → solicitation-version-lot-and-award-rules → sealed-submission-register → deadline-and-authorized-opening-ceremony → bidder-responsibility-and-bid-responsiveness → bid-by-lot-price-factor-matrix ↔ cross-lot-award-constraints → lowest-valid-aggregate-award-scenario → conflict-recusal-and-approval → award-unsuccessful-notices-and-opening-record`; concealment/opening, responsiveness and cross-lot allocation are independent owners.
- **Wide:** Sealed/opening status, bid-by-lot matrix, responsiveness exceptions and candidate award scenario remain visible; only the matrix owns bounded two-axis overflow and each exclusion links to its exact rule.
- **Intermediate:** Lot-ranked evaluation and proposed awards stay primary; opening history and bidder evidence become synchronized drawers while solicitation version, lot caps and recusals persist.
- **Compact:** Solicitation/opening receipt → lot → responsive bid evidence → global cross-lot allocation impact → exception/recusal → proposed award → approval/notices; grouped lot records replace the matrix and preserve the candidate allocation.
- **State obligations:** before-deadline concealed/late/withdrawn, opening locked/authorized/opened/interrupted, bidder responsible/ineligible/unknown, bid responsive/nonresponsive/irregular, lot valid/no-valid-bid/ceased, constraint satisfied/violated, scenario calculating/stale, recusal required, award draft/approved/blocked and notices/opening record issued.
- **Hard rejection:** Reject cho market-depth order entry, waitlist/quota allocation, comparison matrix, filing validator, generic procurement scoring, auction or negotiated proposal workspace; deadline-bound concealment, authorized opening, no post-opening bargaining, responsiveness to one immutable invitation and disclosed multi-lot allocation rules are mandatory.
- **Research anchors:** `WAI-GRID`, `WAI-FOCUS`, `WAI-REFLOW`, `WAI-STATUS`; add [Acquisition.gov FAR Part 14](https://www.acquisition.gov/far/part-14), [FAR multiple awards](https://www.acquisition.gov/far/52.214-22), [European Commission eForms](https://single-market-economy.ec.europa.eu/single-market/public-procurement/digital-procurement/eforms_en) and [GOV.UK guidance on lots](https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-define-phase/guidance-lots-html).
- **Acceptance focus:** Template must conceal bids before deadline, perform an authorized opening, mark one nonresponsive bid, recompute a multi-lot award under a supplier cap, block conflicted approval and issue accessible opening, award and unsuccessful-notice records with compact parity.
