# Batch 11 — Biomedical, clinical diagnostics and medical-device archetypes (20 prompts)

Tệp này là **một prompt batch tự chứa** cho diagnostic reasoning, laboratory interpretation, precision medicine, clinical operations, public-health investigation và programmable medical-device surfaces. Khi chạy ở nơi khác, đưa toàn bộ tệp cho agent để tạo đủ 20 leaf. Nếu chỉ chạy một mục, phải đưa kèm toàn bộ phần từ `Cách chạy` đến `Nguồn research dùng chung`; không tách riêng block prompt khỏi hợp đồng chung.

## Mục lục

| # | Archetype ID | Câu hỏi bố cục chính |
|---:|---|---|
| 01 | `clinical-differential-test-strategy-workbench` | Làm sao giữ competing diagnoses, test discrimination và posterior update trong cùng một chiến lược chẩn đoán có stopping rule? |
| 02 | `histopathology-slide-signout-workbench` | Làm sao đi từ specimen–block–slide hierarchy qua vùng chẩn đoán đến synoptic signout mà không mất provenance? |
| 03 | `longitudinal-radiology-comparison-workbench` | Làm sao so current với nhiều priors, theo dõi từng finding và kết thúc bằng comparison impression có communication trail? |
| 04 | `dialysis-prescription-delivery-reconciliation` | Làm sao đối chiếu prescription với machine delivery, fluid balance, adequacy và biến cố của đúng một dialysis session? |
| 05 | `antimicrobial-susceptibility-interpretation-workbench` | Làm sao biến MIC/zone matrix thành S/I/R theo đúng breakpoint edition, QC và expert rules? |
| 06 | `transfusion-compatibility-release-workbench` | Làm sao chứng minh recipient–unit compatibility, xử lý emergency exception rồi issue component có trace receipt? |
| 07 | `hereditary-variant-classification-workbench` | Làm sao gán criterion strengths, chặn double-counting và combine thành một hereditary variant classification có version? |
| 08 | `pedigree-inheritance-risk-workbench` | Làm sao dùng kinship, phenotype/genotype và segregation để kiểm inheritance models rồi lập recurrence-risk scenario? |
| 09 | `spirometry-maneuver-quality-repeatability-workbench` | Làm sao thu nhiều maneuver spirometry, bác lỗi acceptability, chứng minh repeatability, chọn best values và so pre/post bronchodilator mà không biến thành curve viewer? |
| 10 | `radiotherapy-contour-dose-plan-review` | Làm sao review contour, dose field, DVH constraints và plan versions như một vòng approval không thể tách rời? |
| 11 | `therapeutic-drug-monitoring-regimen-modeler` | Làm sao gắn timed concentrations với dose events, fit exposure và so candidate regimens trước khi chọn lần lấy mẫu kế tiếp? |
| 12 | `clinical-trial-safety-signal-triage` | Làm sao đi từ candidate signal qua population context và case series đến validation, priority và risk action? |
| 13 | `public-health-outbreak-hypothesis-workbench` | Làm sao đồng bộ line list, time/place/network projections và hypothesis status khi case definition lẫn control lag còn đổi? |
| 14 | `exposure-contact-followup-workbench` | Làm sao nối infectious window với exposure episodes, risk, outreach, monitoring và release cho từng contact? |
| 15 | `infusion-titration-safety-console` | Làm sao ràng buộc ordered envelope, pump delivery, patient response và dual verification trong một titration decision? |
| 16 | `implantable-cardiac-device-interrogation-programmer` | Làm sao đọc battery/lead/episodes, sửa program an toàn, test rồi commit mà luôn so được current với proposed? |
| 17 | `immunization-catch-up-series-planner` | Làm sao credit lịch sử vaccine combination vào nhiều antigen series rồi lập visit bundle sớm nhất mà không restart series hợp lệ? |
| 18 | `cytogenetic-karyotype-assembly-workbench` | Làm sao assemble homolog pairs từ metaphase cells, ghi band breakpoint, clone counts và sinh ISCN expression hợp lệ? |
| 19 | `cardiac-electrophysiology-ablation-map-workbench` | Làm sao nối từng 3D map point với local electrogram, lesion delivery và remap endpoint trong một ablation procedure? |
| 20 | `haplotype-phase-block-curation-workbench` | Làm sao dùng read, molecule và family linkage để sửa phase blocks rồi chứng minh Mendelian/ploidy consistency trước khi export? |

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

## Prompt 01 — `clinical-differential-test-strategy-workbench`

- **Output boundary:** `knowledge/archetypes/work/clinical-differential-test-strategy-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Construct and revise a diagnostic test strategy by comparing competing diagnoses, choosing discriminating tests with explicit harms and stopping rules, updating likelihoods from results, and closing with a no-miss disposition rationale.
- **Required region graph:** `diagnostic-strategy → problem-representation-and-urgency → competing-diagnosis-prior-set ↔ discriminating-finding-ledger → next-test-expected-discrimination-and-harm → ordered-test-sequence-and-stopping-rules → result-driven-prior-to-posterior-update-ledger → posterior-rank-and-no-miss-gate → disposition-rationale`; an observed result must change explicit competing priors before the next test or stopping decision, and unresolved dangerous alternatives own the closure gate.
- **Wide:** Competing diagnoses, discriminating findings, candidate-test trade-offs and the ordered test sequence remain simultaneously visible; selecting a test or result highlights every hypothesis it changes.
- **Intermediate:** Hypothesis ranks and the active test decision retain a split; finding provenance and completed updates move to synchronized drawers, while the no-miss status remains persistent.
- **Compact:** Urgency gate → explicit competing priors → one diagnosis with for/against discriminators → next-test discrimination and harm → observed result → named prior-to-posterior delta for every affected diagnosis → stopping/no-miss gate → disposition; the full hypothesis matrix becomes a bounded accessible review route, while the active update and dangerous-alternative status remain in the primary sequence.
- **State obligations:** problem representation incomplete/ready, diagnosis prior unknown/estimated, discriminator supporting/opposing/absent, test available/unavailable/contraindicated, result pending/positive/negative/indeterminate/error, posterior recalculating/stale, stop rule met/not met, dangerous alternative unresolved, disposition drafted/signed/amended and permission-limited evidence.
- **Hard rejection:** Reject when the topology could be `evidence-led-case-resolution-dossier`, `diagnostic-evidence-bundle-review`, `causal-root-analysis-dossier` or `guided-troubleshooting-tree`; accumulating evidence, naming one cause or following fixed branches is insufficient. Multiple explicit priors, a next-test discrimination-versus-harm decision, result-driven posterior deltas, executable stopping rules and a no-miss gate are all mandatory.
- **Research anchors:** `WAI-FOCUS`, `WAI-STATUS`, `WAI-REFLOW`; add [AHRQ Probabilistic Thinking in the Diagnosis Process](https://www.ahrq.gov/diagnostic-safety/resources/issue-briefs/probabilistic-thinking3.html) and [NICE current guidance for reviewing evidence](https://www.nice.org.uk/process/pmg20/chapter/reviewing-evidence).
- **Acceptance focus:** Template must let a user assign priors to at least three fictional diagnoses, compare one test's expected discrimination and harm, enter an indeterminate then definitive result, observe announced per-diagnosis posterior deltas, block closure while a dangerous alternative lacks a rule-out or stopping rule, and retain the same update ledger after every topology change.

## Prompt 02 — `histopathology-slide-signout-workbench`

- **Output boundary:** `knowledge/archetypes/work/histopathology-slide-signout-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Review a pathology case across specimen parts, blocks and whole-slide images, register diagnostic regions and features, complete synoptic elements, obtain consultation when required, and issue a versioned diagnostic signout.
- **Required region graph:** `histopathology-signout → case-and-specimen-identity → specimen-part-to-block-to-slide-provenance → tiled-whole-slide-stage ↔ diagnostic-region-and-feature-register → feature-to-synoptic-element-and-report-claim-links → diagnosis-and-comment-composer → peer-review-or-consult → signed-report-version`; post-slide diagnostic features may change a report claim only through their exact specimen–block–slide path and required synoptic owner.
- **Wide:** Part/block/slide hierarchy, selected slide stage, diagnostic feature register and report/synoptic progress remain visible; selection is synchronized without making visual marks the only way to navigate.
- **Intermediate:** The slide stage and selected diagnostic feature stay primary; hierarchy becomes a specimen breadcrumb plus slide rail, while synoptic/report work moves to a resumable side sheet.
- **Compact:** Case identity → specimen part → block → slide → selected tile/region or textual coordinate → diagnostic feature → linked synoptic element and report claim → consultation if required → signout; the provenance path and unlinked required claim remain persistent, while the slide mosaic yields to one image stage plus a coordinate/feature ledger.
- **State obligations:** case loading, specimen mismatch, block/slide missing or unavailable, image tile loading/error, region selected/unselected/unreviewed, feature draft/confirmed/conflicting, synoptic complete/incomplete/not-applicable, consult requested/returned/overdue, report unsigned/signed/amended, stale slide revision, permission-limited image and focus restored after region detail closes.
- **Hard rejection:** Reject when the result is `multichannel-microscopy-analysis-workbench`, `media-annotation-workbench`, `orthogonal-volume-slice-inspector`, `sample-lineage-custody-explorer` or a generic case dossier; channel analysis, annotation or traceability alone is insufficient. Post-slide diagnostic interpretation must preserve specimen→block→slide provenance, link each relied-on feature to a synoptic/report claim, and end in a versioned pathology signout.
- **Research anchors:** `WAI-FOCUS`, `WAI-DRAG`, `WAI-REFLOW`; add [DICOM current Whole Slide Microscopy Image IOD](https://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_A.32.8.html), [CAP current cancer protocols](https://www.cap.org/protocols-and-guidelines/cancer-protocols/current-cancer-protocols/) and [CAP whole-slide imaging validation guideline](https://www.cap.org/protocols-and-guidelines/cap-guidelines/current-cap-guidelines/validating-whole-slide-imaging-for-diagnostic-purposes-in-pathology).
- **Acceptance focus:** Template must traverse a fictional specimen part→block→slide path, locate a diagnostic region by image and numeric/list controls, link the recorded feature to one synoptic element and report claim, expose an unlinked required claim, route a consult, block signout until the gap resolves, and show an accessible amended-version trail.

## Prompt 03 — `longitudinal-radiology-comparison-workbench`

- **Output boundary:** `knowledge/archetypes/work/longitudinal-radiology-comparison-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Compare a current imaging study with selected prior studies, track named findings and measurements through time, compose a comparison impression, communicate critical results, and preserve report/addendum lineage.
- **Required region graph:** `radiology-comparison → patient-and-study-timeline → current-plus-multiple-prior-series-pairing → synchronized-display-set ↔ named-finding-identity-ledger-across-dates → per-finding-measurement-and-change-trajectory → comparison-impression → critical-result-communication → report-or-addendum-version`; one named finding must retain identity across the current study and at least two selected prior contexts before the longitudinal trajectory owns the impression.
- **Wide:** Study timeline, synchronized current/prior display, finding ledger, measurement trend and impression remain linked; changing a finding or prior updates every projection without discarding viewport context.
- **Intermediate:** Current/prior comparison remains primary with the active finding; timeline compresses to an explicit prior selector and measurement history/impression alternate in a synchronized secondary pane.
- **Compact:** Choose one named finding → review current state → step through at least two selected priors with matched location and a date-keyed measurement table → confirm the multi-date trajectory → write the comparison statement → communicate if critical → sign/addendum; simultaneous images yield to controlled alternation, while finding identity and the full prior sequence remain persistent.
- **State obligations:** current or prior loading/unavailable, series unmatched/matched, registration uncertain, finding new/stable/improved/worsened/resolved, measurement missing/changed/conflicting, comparison stale after prior change, critical communication pending/acknowledged/failed, report draft/signed/addendum, permission-limited study and focus restored after prior selection.
- **Hard rejection:** Reject when the topology is `orthogonal-volume-slice-inspector`, `spatial-change-detection-workbench`, `multichannel-microscopy-analysis-workbench` or `timeline-audit-explorer`; a two-image change view or generic timeline is insufficient. Named finding identity across current plus multiple priors, date-keyed measurement trajectory, comparison impression and critical-result receipt are mandatory.
- **Research anchors:** `WAI-FOCUS`, `WAI-STATUS`, `WAI-REFLOW`; add [DICOM Hanging Protocol Information Model](https://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_A.44.3.html) and [ACR Practice Parameter for Communication of Diagnostic Imaging Findings](https://gravitas.acr.org/PPTS/GetDocumentView?docId=74).
- **Acceptance focus:** Template must pair a fictional current study with at least two priors, preserve one named finding across every date, expose a missing comparable series without collapsing to a two-study result, switch to a date-keyed textual trajectory on compact, announce a critical communication receipt, and create an addendum without overwriting the signed impression.

## Prompt 04 — `dialysis-prescription-delivery-reconciliation`

- **Output boundary:** `knowledge/archetypes/work/dialysis-prescription-delivery-reconciliation/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Reconcile one dialysis prescription with machine-delivered parameters, access and anticoagulation interventions, fluid balance, adequacy targets and complications before session signoff and the next plan.
- **Required region graph:** `dialysis-reconciliation → session-and-prescription-version → prescribed-parameter-and-target-ledger → device-event-and-delivery-time-series ↔ access-anticoagulation-and-intervention-log → fluid-and-ultrafiltration-balance → delivered-adequacy-and-target-comparison → deviation-and-complication-review → session-signoff-and-next-plan`; prescribed-versus-delivered session invariants and conserved fluid quantities own closure.
- **Wide:** Prescription targets, delivery time series, intervention log, fluid balance and adequacy/deviation review remain simultaneous around one session identity.
- **Intermediate:** Live delivery and prescribed-versus-delivered comparison remain primary; access/intervention history and adequacy evidence move to synchronized drawers, while fluid balance stays persistent.
- **Compact:** Verify prescription version → monitor current delivery and safety event → review intervention log → reconcile fluid inputs/outputs and ultrafiltration → compare adequacy → resolve deviations → sign off/next plan; charts have a time-keyed table alternative and only the current phase is primary.
- **State obligations:** prescription missing/stale/amended, device feed connecting/live/interrupted/recovered, access adequate/problematic, anticoagulation planned/held/changed, target and delivered value matching/deviating, fluid balance incomplete/imbalanced/reconciled, adequacy unavailable/pending/met/missed, complication active/resolved, signoff blocked/completed/amended and handoff pending/received.
- **Hard rejection:** Reject when the surface could be `process-mass-balance-analyzer`, `cycle-count-variance-reconciliation-workbench`, `multichannel-waveform-analysis-workbench` or `live-operations-command-center`; a versioned dialysis prescription, session-bound device delivery, access/intervention events, fluid conservation, adequacy comparison and clinical signoff are all mandatory.
- **Research anchors:** `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`; add [CMS End-Stage Renal Disease facilities requirements](https://www.cms.gov/medicare/health-safety-runtime/standards/conditions-coverage-participation/end-stage-renal-disease-facilities) and [National Kidney Foundation KDOQI guidelines and commentaries](https://www.kidney.org/professionals/kdoqi/guidelines-and-commentaries).
- **Acceptance focus:** Template must select one fictional prescription version, simulate a brief feed interruption, reconcile prescribed and delivered ultrafiltration against fluid entries, surface an access intervention beside the affected interval, block signoff on an unresolved variance, then produce a next-plan handoff receipt.

## Prompt 05 — `antimicrobial-susceptibility-interpretation-workbench`

- **Output boundary:** `knowledge/archetypes/work/antimicrobial-susceptibility-interpretation-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Interpret antimicrobial susceptibility measurements for one isolate by validating method QC, applying the correct organism-specific breakpoint edition and expert rules, resolving exceptions, and releasing a selective report with amendment lineage.
- **Required region graph:** `ast-interpretation → isolate-organism-and-method-context → test-qc-and-validity → organism-by-antimicrobial-measurement-matrix → breakpoint-standard-and-edition-applicability → measurement-to-category-derivation-cells ↔ expert-rule-and-phenotype-overrides → uncertainty-and-exception-queue → selective-report-preview → release-and-amendment`; every released organism×drug category must retain its measurement, method QC, exact standards edition, derivation path and authorized override.
- **Wide:** Isolate/method context, bounded antimicrobial matrix, breakpoint/rule evidence, exception queue and report preview remain visible; each derived category can be traced to measurement plus applicable rule.
- **Intermediate:** The matrix and selected drug interpretation remain primary; breakpoint edition and rule provenance become synchronized detail, while exceptions and preview alternate in a secondary pane.
- **Compact:** Validate isolate/organism/method/QC → select one organism×drug matrix cell → review MIC/zone measurement → confirm exact breakpoint standard and edition → inspect derived category plus expert-rule override → resolve exception → decide include/suppress → release/amend; the complete matrix remains one bounded table route and the selected cell keeps measurement→edition→category lineage.
- **State obligations:** organism identified/uncertain/changed, method supported/unsupported, QC pending/pass/fail, MIC or zone missing/off-scale/valid, breakpoint applicable/not applicable/version stale, category susceptible/increased-exposure/resistant/indeterminate, expert rule applied/conflicting, report included/suppressed, release pending/signed/amended and permission-limited rule detail.
- **Hard rejection:** Reject when the result is `diagnostic-evidence-bundle-review`, `microplate-dose-response-analysis-workbench`, `evidence-led-case-resolution-dossier`, a generic measurement-to-category report or a data table; a standards-versioned organism×drug matrix, method QC, cell-level MIC/zone→S/I/R derivation, expert-rule overrides and selective release are mandatory.
- **Research anchors:** `WAI-GRID`, `WAI-STATUS`, `WAI-REFLOW`; add [EUCAST current clinical breakpoint tables](https://www.eucast.org/bacteria/clinical-breakpoints-and-interpretation/clinical-breakpoint-tables/), [FDA antibacterial susceptibility test interpretive criteria](https://www.fda.gov/drugs/development-resources/antibacterial-susceptibility-test-interpretive-criteria) and [CLSI M100](https://clsi.org/shop/standards/m100/).
- **Acceptance focus:** Template must enter fictional MIC/zone values into an organism×drug matrix, derive each selected category from a named breakpoint edition, make a method-QC failure invalidate the matrix, demonstrate an explained expert-rule override, let keyboard users trace measurement→edition→category for one cell, and preserve the prior selective report when an amendment is issued.

## Prompt 06 — `transfusion-compatibility-release-workbench`

- **Output boundary:** `knowledge/archetypes/flow/transfusion-compatibility-release-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Prove recipient-to-component compatibility from current and historical evidence, select and reserve a suitable unit, execute a governed emergency exception when needed, and issue the component with an end-to-end trace receipt.
- **Required region graph:** `compatibility-release → recipient-current-sample-and-history → abo-rh-antibody-evidence → component-unit-pool → recipient-by-unit-compatibility-matrix → crossmatch-and-reservation-state → exception-and-emergency-release-path → issue-and-handoff → transfusion-trace-receipt`; recipient-specific compatibility proof, not inventory availability, owns release.
- **Wide:** Recipient/sample history, candidate units, compatibility matrix, selected-unit proof and issue/exception rail remain simultaneous; incompatible evidence cannot be hidden by selection.
- **Intermediate:** Recipient evidence and selected-unit compatibility remain primary; the candidate pool becomes a filtered drawer and trace history moves behind an explicit receipt route.
- **Compact:** Verify recipient/sample → review antibodies/history → select one candidate unit → inspect compatibility and crossmatch proof → reserve → normal or emergency authorization → issue/handoff → confirm trace receipt; pool-wide comparison becomes a bounded table, with one unit decision primary.
- **State obligations:** recipient identity verified/mismatch, sample current/expired/unavailable, history clear/conflicting, antibody screen negative/positive/pending, unit available/held/reserved/unavailable, compatible/incompatible/indeterminate, crossmatch pending/pass/fail, emergency justification draft/authorized/rejected, issue pending/completed/recalled, handoff acknowledged/missing and trace conflict/amendment.
- **Hard rejection:** Reject when the topology is `chain-of-custody-transfer-ledger`, `waitlist-offer-allocation-board`, `entity-resolution-cluster-adjudicator` or inventory picking; recipient-specific serologic compatibility, current-sample validity, crossmatch/reservation, governed emergency release and transfusion trace receipt are mandatory.
- **Research anchors:** `WAI-GRID`, `WAI-FOCUS`, `WAI-STATUS`; add [FDA current good manufacturing practice for blood and blood components](https://www.ecfr.gov/current/title-21/chapter-I/subchapter-F/part-606), [FDA biological product deviation reporting guidance](https://www.fda.gov/media/70694/download) and [ISBT 128 traceability guidance](https://www.isbtweb.org/resource/tb-004-isbt-128-and-traceability-v1-1-0-pdf.html).
- **Acceptance focus:** Template must expose why two fictional units are compatible or rejected, invalidate a unit when the sample expires, complete both a normal reservation and a separately authorized emergency path, prevent duplicate issue while pending, and close only after an acknowledged unit-specific trace receipt.

## Prompt 07 — `hereditary-variant-classification-workbench`

- **Output boundary:** `knowledge/archetypes/work/hereditary-variant-classification-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Classify a hereditary sequence variant by assigning evidence criteria and strengths, detecting dependent or double-counted evidence, applying a combination framework, reconciling external assertions, and signing a version with reanalysis triggers.
- **Required region graph:** `variant-classification → variant-transcript-condition-identity → evidence-category-lanes → criterion-code-strength-and-provenance-assignments ↔ criterion-dependency-and-anti-double-count-graph → dependency-resolved-strength-set → classification-combination-engine → external-assertion-and-review-status-conflicts → classification-rationale → signed-version-and-reanalysis-trigger`; only dependency-resolved criterion strengths may enter the combination engine, and every classification preserves the contributing set.
- **Wide:** Variant identity, evidence lanes, criterion assignments, dependency conflicts, combination result and external assertions remain simultaneously inspectable.
- **Intermediate:** Criterion assignments and computed classification stay primary; dependency graph becomes a synchronized conflict list and external assertions/rationale alternate in a secondary pane.
- **Compact:** Verify variant/transcript/condition → assign one named criterion and strength → inspect its dependency relation list → resolve or exclude double-counted evidence → review the exact strength set entering the combination engine → inspect the computed class → reconcile external assertions → sign/reanalysis; the relation list replaces the graph without hiding why a criterion was excluded.
- **State obligations:** identity unresolved/resolved, transcript or condition changed, evidence loading/available/unavailable, criterion met/not met/uncertain, strength default/modified, dependency clear/conflicting, combination recalculating/classified/indeterminate, external assertion concordant/conflicting/outdated, rationale incomplete/ready, version draft/signed/superseded and reanalysis due/acknowledged.
- **Hard rejection:** Reject when the result can be `evidence-led-case-resolution-dossier`, `diagnostic-evidence-bundle-review`, `genomic-locus-read-evidence-inspector` or `rule-builder-workbench`; a dossier, evidence viewer or criteria checklist is insufficient. Named criterion codes and strengths, an explicit anti-double-count dependency graph, a dependency-resolved combination engine and signed reanalysis lineage are mandatory.
- **Research anchors:** `WAI-TREEGRID`, `WAI-STATUS`, `WAI-REFLOW`; add [ClinGen Variant Classification Working Group](https://clinicalgenome.org/working-groups/variant-classification/) and [NCBI ClinVar introduction](https://www.ncbi.nlm.nih.gov/clinvar/intro/).
- **Acceptance focus:** Template must assign at least four fictional criterion strengths, block the combination engine when two share dependent evidence, let the user exclude or justify one through the relation list, announce the recalculated class and contributing strength set, compare a conflicting external assertion, preserve prior signed rationale, and schedule reanalysis.

## Prompt 08 — `pedigree-inheritance-risk-workbench`

- **Output boundary:** `knowledge/archetypes/work/pedigree-inheritance-risk-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Build and evaluate a family pedigree by recording uncertain relationships, phenotype onset and genotype evidence, testing candidate inheritance models through segregation, and producing recurrence-risk scenarios plus a family testing/counseling plan.
- **Required region graph:** `inheritance-risk → proband-indication-and-consent → pedigree-kinship-graph ↔ phenotype-onset-and-genotype-overlay → relationship-certainty-and-consanguinity → candidate-inheritance-models → segregation-consistency → recurrence-risk-scenarios → family-testing-and-counseling-plan`; generational kinship semantics and model-specific segregation own risk.
- **Wide:** Pedigree graph, selected-relative evidence, inheritance-model comparison, segregation exceptions and recurrence scenarios remain linked; privacy and consent scope stay visible.
- **Intermediate:** Pedigree and active inheritance model remain primary; relative detail becomes a synchronized drawer and risk scenarios move to a resumable review pane.
- **Compact:** Proband/consent → generation and relationship list → selected-relative phenotype/genotype editor → choose inheritance model → inspect segregation-consistent and inconsistent relatives → review recurrence scenario → plan testing/counseling; a relationship path/list replaces a miniature graph.
- **State obligations:** consent in/out/limited, relationship confirmed/uncertain/conflicting, relative alive/deceased/unknown, phenotype absent/present/onset unknown, genotype positive/negative/not tested/unavailable, model candidate/rejected/indeterminate, segregation consistent/exception, risk computable/range/unknown, privacy-redacted branch, plan draft/shared and stale after family evidence changes.
- **Hard rejection:** Reject when the topology is `knowledge-graph-explorer`, `phylogeny-alignment-comparison-explorer`, `entity-resolution-cluster-adjudicator` or a generic family record; generational kinship, inheritance-model hypotheses, segregation checks, consent/privacy boundaries and recurrence-risk scenarios are mandatory.
- **Research anchors:** `WAI-DRAG`, `WAI-FOCUS`, `WAI-REFLOW`; add [CDC genetic counseling and testing](https://www.cdc.gov/genomics-and-health/counseling-testing/genetic-counseling.html) and [HL7 FHIR FamilyMemberHistory](https://hl7.org/fhir/familymemberhistory.html).
- **Acceptance focus:** Template must add a fictional relative through keyboard-capable relational controls, mark one relationship uncertain, overlay phenotype and genotype, reject one inheritance model from a visible segregation conflict, produce a bounded recurrence-risk scenario, and redact a non-consented branch without breaking relationship comprehension.

## Prompt 09 — `spirometry-maneuver-quality-repeatability-workbench`

- **Output boundary:** `knowledge/archetypes/work/spirometry-maneuver-quality-repeatability-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Acquire and adjudicate a spirometry session maneuver by maneuver, reject technically unacceptable efforts with explicit reasons, prove repeatability across the acceptable set, derive best values from their source maneuvers, pair pre/post-bronchodilator results when present, and issue a quality-bounded interpretation.
- **Required region graph:** `spirometry-quality → session-patient-calibration-and-reference-context → maneuver-queue → selected-volume-time-and-flow-volume-pair ↔ maneuver-acceptability-error-ledger → acceptable-maneuver-set → FEV1-FVC-repeatability-proof → best-value-selection → pre-post-bronchodilator-pairing → interpretation-and-signed-report`; only acceptable maneuvers may enter repeatability, every best value retains its source maneuver, and a post-bronchodilator comparison may close only against the matched pre-bronchodilator session context.
- **Wide:** Maneuver queue, selected volume–time and flow–volume views, acceptability findings, acceptable-set repeatability, best values and pre/post comparison remain simultaneously visible; changing a maneuver verdict invalidates every dependent proof and interpretation visibly.
- **Intermediate:** The selected maneuver, its paired curve views and acceptability verdict remain primary; the complete maneuver set and repeatability proof move to a synchronized rail, while best-value provenance and pre/post pairing status remain persistent.
- **Compact:** Verify session, patient, calibration and reference context → perform or select one maneuver → inspect volume–time and flow–volume evidence with a time/volume/flow table alternative → resolve each acceptability error → admit or reject the maneuver → review acceptable-set repeatability → trace FEV1 and FVC best values to their source maneuvers → pair pre/post bronchodilator if present → interpret and sign; curves yield to one selected evidence stage plus a semantic numeric route rather than stacked miniature plots.
- **State obligations:** session new/resumed/signed, patient identity matched/mismatch, calibration current/expired/failed, reference context complete/stale, maneuver queued/recording/completed/aborted, curve loading/ready/error, acceptability pending/pass/fail with cough/early-termination/start/effort reason, maneuver admitted/rejected/reinstated, acceptable set insufficient/sufficient, repeatability pending/pass/fail/stale, best value unselected/derived/invalidated, pre/post unmatched/paired/conflicting, interpretation draft/blocked/signed/amended and permission-limited prior session.
- **Hard rejection:** Reject when the topology could be `regulated-sample-selection-workbench`, `multichannel-waveform-analysis-workbench`, `longitudinal-radiology-comparison-workbench` or a generic pulmonary test report; population sampling, free waveform inspection, date comparison or final values alone are insufficient. Maneuver-level paired curve evidence, named acceptability failures, repeatability across only the acceptable set, source-bound best-value derivation and governed pre/post-bronchodilator pairing are mandatory.
- **Research anchors:** `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`; add [CDC/NIOSH current coal-worker spirometry requirements and resources](https://www.cdc.gov/niosh/cwhsp/spirometry/index.html) and the [ATS/ERS Standardization of Spirometry 2019 technical statement](https://academic.oup.com/ajrccm/article/200/8/e70/8497012).
- **Acceptance focus:** Template must capture at least four fictional maneuvers, expose one cough and one early-termination acceptability failure beside their curve and numeric evidence, keep rejected efforts out of repeatability, announce when the remaining acceptable set passes or fails, trace best FEV1 and FVC to their possibly different source maneuvers, pair a post-bronchodilator set to the correct baseline, block signout after any stale verdict, and retain the same maneuver identities, quality reasons and recovery actions at every topology.

## Prompt 10 — `radiotherapy-contour-dose-plan-review`

- **Output boundary:** `knowledge/archetypes/work/radiotherapy-contour-dose-plan-review/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Review and approve a radiotherapy plan by connecting target and organ-at-risk contours to spatial dose, beam/fraction prescription, dose-volume evidence, coverage constraints, hotspot/coldspot findings and plan-version comparison.
- **Required region graph:** `radiotherapy-review → planning-study-frame-and-prescription → target-and-organ-at-risk-contour-hierarchy ↔ synchronized-anatomy-and-dose-stage → beam-fraction-and-plan-version → dose-volume-histogram-set ↔ constraint-table → hotspot-coldspot-and-coverage-queue → plan-comparison-and-approval`; contour identity, dose field and DVH/constraint closure jointly own approval.
- **Wide:** Contour hierarchy, synchronized anatomy/dose stage, DVH set, constraint table, issue queue and plan-version comparison remain linked around a fixed prescription.
- **Intermediate:** Anatomy/dose plus the selected structure's DVH/constraints remain primary; hierarchy becomes a searchable structure rail and plan comparison/issues alternate in a secondary pane.
- **Compact:** Verify frame/prescription → choose one target or organ → inspect contour with textual slice/coordinate alternative → review that structure's DVH and constraint → resolve hotspot/coldspot → compare plan version → approval gate; no miniaturized multi-panel planning desktop.
- **State obligations:** study loading/mismatch, prescription incomplete/amended, contour present/missing/changed/unapproved, dose loading/stale, beam/fraction mismatch, constraint pass/fail/not-applicable, hotspot or coldspot open/accepted/resolved, DVH unavailable/recomputed, plan current/superseded/comparison pending, approval blocked/approved/rejected and focus restored after spatial issue detail.
- **Hard rejection:** Reject when the topology can be `orthogonal-volume-slice-inspector`, `scenario-sensitivity-modeler`, `spatial-change-detection-workbench` or `diagnostic-evidence-bundle-review`; linked target/OAR contours, spatial dose, DVH constraints, coverage issues and versioned clinical plan approval are mandatory.
- **Research anchors:** `WAI-DRAG`, `WAI-FOCUS`, `WAI-REFLOW`; add [DICOM current RT Dose IOD](https://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_A.18.html) and [IAEA transition to 3-D conformal and intensity-modulated radiotherapy](https://www.iaea.org/publications/8523/transition-from-2-d-radiotherapy-to-3-d-conformal-and-intensity-modulated-radiotherapy).
- **Acceptance focus:** Template must bind a fictional contour to its dose overlay, DVH and named constraint, provide keyboard/list alternatives to spatial selection, show a failing organ-at-risk constraint and a target coldspot, compare a revised plan, announce recomputation, and block approval until every mandatory issue has a disposition.

## Prompt 11 — `therapeutic-drug-monitoring-regimen-modeler`

- **Output boundary:** `knowledge/archetypes/work/therapeutic-drug-monitoring-regimen-modeler/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Reconstruct dose and timed-concentration history, estimate an exposure state with uncertainty, compare candidate regimens against a therapeutic window and toxicity/efficacy trade-off, then recommend a regimen plus the next informative sample.
- **Required region graph:** `tdm-modeler → patient-drug-and-target-context → administered-dose-event-timeline ↔ timed-concentration-samples → fitted-pk-state-and-uncertainty → therapeutic-exposure-window → candidate-regimen-projections → efficacy-toxicity-tradeoff → recommended-regimen-and-next-sample-plan → follow-up-receipt`; sample timing relative to actual doses and closed-loop exposure targeting own the recommendation.
- **Wide:** Dose/sample timeline, fitted state, exposure window, candidate projections and trade-off/recommendation remain simultaneously linked; changing a timing fact invalidates dependent estimates visibly.
- **Intermediate:** Dose/sample timing and one candidate projection remain primary; model uncertainty and alternative regimens become synchronized drawers, while target-window status persists.
- **Compact:** Verify actual doses → place/confirm timed samples → inspect fitted exposure with tabular interval alternative → compare one candidate regimen at a time → review efficacy/toxicity → choose regimen → schedule next sample → follow-up receipt; no stack of miniature curves.
- **State obligations:** dose event confirmed/missed/uncertain, sample time valid/ambiguous/missing, assay result pending/available/flagged, fit calculating/converged/poor/unavailable, uncertainty acceptable/wide, exposure below/within/above target, candidate feasible/contraindicated, recommendation draft/signed/superseded, next sample scheduled/missed and follow-up received/overdue.
- **Hard rejection:** Reject when the topology is `microplate-dose-response-analysis-workbench`, `scenario-sensitivity-modeler`, `multichannel-waveform-analysis-workbench` or a medication calculator; actual dose-event/sample timing, fitted exposure uncertainty, therapeutic target window, projected alternative regimens and a closed-loop next-sample plan are mandatory.
- **Research anchors:** `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`; add [FDA analysis of therapeutic drug monitoring in drug labels](https://www.fda.gov/science-research/fda-stem-outreach-education-and-engagement/analysis-therapeutic-drug-monitoring-drug-labels), [FDA Population Pharmacokinetics guidance](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/population-pharmacokinetics) and [EMA reporting population pharmacokinetic analyses guideline](https://www.ema.europa.eu/en/reporting-results-population-pharmacokinetic-analyses-scientific-guideline).
- **Acceptance focus:** Template must place two fictional concentrations relative to confirmed and uncertain dose events, make the ambiguity widen or invalidate the fitted estimate, compare two regimens against a visible exposure window, choose one only after toxicity review, schedule a next sample, and announce follow-up without moving focus.

## Prompt 12 — `clinical-trial-safety-signal-triage`

- **Output boundary:** `knowledge/archetypes/work/clinical-trial-safety-signal-triage/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Triage a potential safety signal across a clinical-trial program by comparing exposed populations and background/arm rates, reviewing the linked adverse-event case series and causality gaps, validating the signal, and assigning a documented risk action.
- **Required region graph:** `signal-triage → product-program-exposure-and-period-context → candidate-signal-queue → adverse-event-case-series ↔ treatment-arm-denominator-and-background-rate → imbalance-time-to-onset-and-subgroup-analyses → selected-case-causality-and-data-gaps → validation-and-prioritization → assessment-or-risk-action-plan → signal-history`; multi-case population imbalance plus trial exposure denominators own signal status.
- **Wide:** Signal queue, arm/exposure context, population analyses, linked case series, causality gaps and action plan remain visible; a selected case never replaces the denominator view.
- **Intermediate:** Population imbalance and selected signal status remain primary; case series and subgroup/time-to-onset analyses alternate in synchronized panes, while action priority persists.
- **Compact:** Select signal → verify trial arms/exposure period → inspect observed-versus-expected and subgroup/time-to-onset → review linked serious cases → resolve causality/data gaps → validate and prioritize → assign action → history; population evidence precedes case detail and the surface is not a dossier stack.
- **State obligations:** signal new/under review/validated/refuted/closed, exposure denominator pending/stale/ready, case serious/non-serious/duplicate/unavailable, arm imbalance absent/present/uncertain, time-to-onset or subgroup analysis insufficient/ready, causality related/unrelated/indeterminate, data request pending/received/failed, priority recalculating, action drafted/approved/overdue and history amended.
- **Hard rejection:** Reject when the result is `risk-impact-likelihood-overview`, `evidence-led-case-resolution-dossier`, `diagnostic-evidence-bundle-review` or `asynchronous-outcome-tracker`; a trial-program signal queue, treatment-arm denominators, population imbalance analyses, linked multi-case review, validation state and risk-action lifecycle are mandatory.
- **Research anchors:** `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`; add [FDA safety reporting requirements for INDs and BA/BE studies](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/safety-reporting-requirements-inds-and-babe-studies), [ICH E2A clinical safety data management](https://database.ich.org/sites/default/files/E2A_Guideline.pdf) and [EMA signal management](https://www.ema.europa.eu/en/human-regulatory-overview/post-authorisation/pharmacovigilance-post-authorisation/signal-management).
- **Acceptance focus:** Template must triage a fictional event across two trial arms, distinguish a missing denominator from a zero event rate, reveal a subgroup/time-to-onset imbalance, link but not over-weight two serious cases, request missing causality data, change validation/priority with an announced reason, and preserve the signal history after closure.

## Prompt 13 — `public-health-outbreak-hypothesis-workbench`

- **Output boundary:** `knowledge/archetypes/work/public-health-outbreak-hypothesis-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Investigate an outbreak by maintaining a versioned case definition and line list, comparing time/place/exposure-network projections, testing source or transmission hypotheses, and tracking control measures plus reporting lag as evidence changes.
- **Required region graph:** `outbreak-investigation → case-definition-version → case-membership-recomputation-ledger → recomputed-line-list → synchronized-epidemic-curve ↔ place-map ↔ exposure-and-contact-network → hypothesis-register → analytic-comparison-results → control-measures-and-reporting-lag → hypothesis-status-and-investigation-log`; every case-definition revision must recompute membership and all person–place–time/network projections before any hypothesis status can change.
- **Wide:** Case-definition version, line-list summary, epidemic curve, place map, exposure network, hypothesis register and control/lag context remain linked; selecting a case or interval propagates across every projection.
- **Intermediate:** One selected time/place/network projection remains primary with the hypothesis register; the other projections become explicit switches, while case-definition and reporting-lag banners remain persistent.
- **Compact:** Confirm or revise the case-definition version → review membership changes and exclusions → wait for recomputed line-list counts → step through accessible time, place and network projections from the same recomputation receipt → open one hypothesis → compare supporting/opposing results → account for control timing/reporting lag → update status/log; maps and networks yield to table/path alternatives, and hypothesis actions stay blocked while any projection is stale.
- **State obligations:** case definition draft/active/superseded, case suspected/probable/confirmed/excluded/reclassified, line list loading/incomplete/stale, location redacted/unavailable, exposure link known/uncertain, hypothesis proposed/under test/supported/weakened/refuted, analysis pending/failed/ready, control planned/active/lifted, reporting lag estimated/changed and investigation log appended/conflicted.
- **Hard rejection:** Reject when the topology could be `causal-root-analysis-dossier`, `map-led-situation-monitor`, `process-variant-mining-overview` or `knowledge-graph-explorer`; a static case dossier, map or causal hypothesis list is insufficient. A versioned case definition must own line-list membership and recompute synchronized person–place–time/network projections before competing outbreak hypotheses, controls or reporting-lag conclusions may update.
- **Research anchors:** `ESRI-LAYOUT`, `WAI-REFLOW`, `WAI-STATUS`, `WAI-DRAG`; add [CDC Field Epidemiology Manual: Conducting a Field Investigation](https://www.cdc.gov/field-epi-manual/php/chapters/field-investigation.html), [CDC foodborne outbreak investigation steps](https://www.cdc.gov/foodborne-outbreaks/outbreak-basics/investigation-steps.html) and [WHO Outbreak Toolkit](https://www.who.int/emergencies/outbreak-toolkit).
- **Acceptance focus:** Template must change a fictional case-definition version, show added/excluded membership, block hypothesis updates while the line list or any time/place/network projection is stale, complete one recomputation receipt, synchronize a selected cluster across every projection and accessible alternative, compare two hypotheses, weaken a premature trend claim from reporting lag, record a control and append the investigation log.

## Prompt 14 — `exposure-contact-followup-workbench`

- **Output boundary:** `knowledge/archetypes/flow/exposure-contact-followup-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Identify and follow people through discrete exposure episodes by relating each episode to an index case's infectious window, classifying episode-specific risk, conducting privacy-bounded outreach, monitoring symptoms/tests, and escalating or releasing the contact with chain-coverage proof.
- **Required region graph:** `contact-followup → index-case-and-infectious-window → exposure-episode-ledger ↔ contact-person-network → episode-specific-risk-classification → identity-privacy-and-reachability → outreach-and-instruction-state → monitoring-test-and-symptom-timeline → escalation-or-release → chain-coverage-audit`; the exposure episode, not the person record alone, owns risk and follow-up obligations.
- **Wide:** Infectious window, episode ledger, contact network, selected risk evidence, outreach state and monitoring timeline remain linked; repeated contacts may have distinct episode states.
- **Intermediate:** Exposure episodes and active follow-up remain primary; network becomes a synchronized chain drawer and monitoring history moves behind the selected episode.
- **Compact:** Verify infectious window → select an exposure episode → confirm contact and episode-specific risk → apply privacy/reachability rules → outreach/instructions → monitor tests/symptoms → escalate or release → coverage audit; the network becomes an accessible chain/path list.
- **State obligations:** infectious window estimated/confirmed/changed, episode candidate/confirmed/duplicate/outside window, identity resolved/uncertain/redacted, risk unclassified/low/high/changed, contact reachable/unreachable/declined, outreach queued/sent/delivered/failed, monitoring active/missed/complete, symptom absent/present, test pending/negative/positive/inconclusive, escalation accepted/failed, release eligible/completed/revoked and chain gap open/closed.
- **Hard rejection:** Reject when the result is `referral-negotiation-exchange`, `asynchronous-outcome-tracker`, `chain-of-custody-transfer-ledger` or a generic CRM queue; infectious-window overlap, many-to-many exposure episodes, episode-specific risk, privacy-bounded outreach, monitoring/escalation/release and chain-coverage audit are mandatory.
- **Research anchors:** `WAI-STATUS`, `WAI-FOCUS`, `NIST-PRIVACY`; add [WHO guideline on contact tracing](https://www.who.int/publications/i/item/9789240102965) and [CDC contact investigations for contagious diseases on flights](https://www.cdc.gov/port-health/contact-investigation/index.html).
- **Acceptance focus:** Template must show one fictional person in two exposure episodes with different risks, revise the infectious window and update only affected obligations, recover failed outreach, record a symptom and test escalation, release the other episode independently, redact protected identity fields, and expose an unresolved chain gap.

## Prompt 15 — `infusion-titration-safety-console`

- **Output boundary:** `knowledge/archetypes/work/infusion-titration-safety-console/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Titrate a continuous infusion by reconciling the medication order and protocol stage with pump programming and delivered events, observing patient response and cumulative dose/fluid, and requiring safety checks plus independent verification before each consequential change.
- **Required region graph:** `infusion-safety → patient-order-drug-concentration-and-line → protocol-stage-and-titration-rule → ordered-rate-and-dose-envelope → ordered-versus-programmed-versus-delivered-triad ↔ patient-response-and-alarm-window → cumulative-dose-fluid-and-exposure-ledger → titrate-hold-or-rescue-decision → independent-verification → executed-change-and-observed-outcome → handoff`; the triad, cumulative exposure and independent verifier must reconcile before any consequential infusion action executes.
- **Wide:** Order/envelope, pump program and delivery, response/alarm trends, cumulative ledger, active decision and verifier state remain simultaneously visible around one line and drug identity.
- **Intermediate:** Active rate/dose, response and next permitted action remain primary; order/rule provenance and cumulative history become synchronized drawers, while line/drug identity stays fixed.
- **Compact:** Verify patient/drug/concentration/line → confirm protocol stage and ordered envelope → reconcile ordered, programmed and delivered values in one triad → review the bounded response window plus cumulative dose/fluid exposure → choose titrate, hold or rescue → obtain independent verification → execute once → observe outcome → hand off; the active action and rescue remain reachable, while history yields to an exposure ledger route rather than stacked trend panels.
- **State obligations:** identity mismatch/matched, order pending/active/amended/stale, concentration or line confirmed/conflicting, protocol stage active/criteria unmet, rate within/outside envelope, pump connecting/running/paused/occluded/disconnected, delivery event delayed/conflicting, response stable/worsening/threshold crossed, cumulative ledger incomplete/reconciled, decision draft/verified/executing/reverted, rescue active, handoff sent/acknowledged and permission denied.
- **Hard rejection:** Reject when the topology is `live-operations-command-center`, `multichannel-waveform-analysis-workbench`, `rule-builder-workbench`, a generic guardrail command loop or medication form; live signals or a permitted setting alone are insufficient. One infusion must expose the ordered/programmed/delivered triad, cumulative exposure, bounded patient response, titrate/hold/rescue alternatives and independent verification before execution.
- **Research anchors:** `WAI-STATUS`, `WAI-FOCUS`, `WAI-OBSCURED`; add [FDA infusion pumps](https://www.fda.gov/medical-devices/general-hospital-devices-and-supplies/infusion-pumps), [FDA infusion-pump risk-reduction strategies for clinicians](https://www.fda.gov/medical-devices/infusion-pumps/infusion-pump-risk-reduction-strategies-clinicians) and [IHE Patient Care Device profiles](https://profiles.ihe.net/DEV/index.html).
- **Acceptance focus:** Template must detect a fictional mismatch among ordered, programmed and delivered rates, keep the response threshold plus cumulative dose/fluid exposure visible during correction, disable execution and duplicates while independent verification is pending, preserve hold and rescue as first-class alternatives, announce the delivered change without stealing focus, and generate an acknowledged handoff only after observing the outcome.

## Prompt 16 — `implantable-cardiac-device-interrogation-programmer`

- **Output boundary:** `knowledge/archetypes/work/implantable-cardiac-device-interrogation-programmer/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Interrogate an implanted cardiac device, correlate battery/lead measurements and detected episodes with electrograms, edit interdependent pacing or therapy-zone settings, run safety and observation checks, and commit a traceable current-versus-proposed program.
- **Required region graph:** `cied-programmer → patient-device-lead-and-session-identity → immutable-interrogation-snapshot → battery-lead-sensing-pacing-and-episode-register → selected-episode-event-markers-and-electrogram ↔ interdependent-mode-zone-and-therapy-program → zone-mode-dependency-and-safety-checks → proposed-versus-current-program → mandatory-program-test-and-observation → commit-and-exported-interrogation`; one session snapshot, episode electrogram evidence and the interdependent cardiac-zone graph jointly own the tested commit.
- **Wide:** Device/lead snapshot, selected episode electrogram, programmable settings, dependency warnings, current/proposed diff and test evidence remain simultaneously visible.
- **Intermediate:** Selected episode or setting group and current/proposed diff remain primary; battery/lead overview becomes a persistent summary rail and detailed test history moves to a drawer.
- **Compact:** Verify patient/device/leads → freeze and review the interrogation snapshot → inspect one episode through event markers plus an electrogram table alternative → edit one mode/zone/therapy dependency group → resolve safety conflicts → compare current/proposed → run the mandatory test and record observation → commit/export; the dashboard yields to a session sequence, and commit remains unreachable from editing or comparison until test evidence passes.
- **State obligations:** device identity matched/mismatch, interrogation connecting/complete/interrupted/stale, battery normal/advisory/critical, lead measure stable/out-of-range/unavailable, episode unreviewed/classified, electrogram loading/error, setting valid/conflicting/out-of-range, safety check pending/pass/fail, proposal dirty/reverted, test running/aborted/observed, commit pending/success/failure/rollback and export available/failed.
- **Hard rejection:** Reject when the result is `multichannel-waveform-analysis-workbench`, `configuration-dependency-resolver`, `live-operations-command-center`, a per-channel programmer or a generic device settings page; waveform viewing and independent channel edits are insufficient. Session-bound interrogation, implanted battery/lead state, stored-episode electrograms, interdependent cardiac modes/zones/therapies, mandatory test/observation and current-versus-proposed commit are all required.
- **Research anchors:** `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`; add [IHE Patient Care Device technical framework](https://profiles.ihe.net/DEV/index.html), the [2019 HRS/EHRA/APHRS/LAHRS focused update on ICD programming and testing](https://www.hrsonline.org/resource/2019-hrsehraaphrslahrs-focused-update-2015-expert-consensus-statement-optimal-implantable/) and the [2023 HRS/EHRA/APHRS/LAHRS consensus on practical management of the remote device clinic](https://www.hrsonline.org/resource/2023-hrsehraaphrslahrs-expert-consensus-statement-practical-management-remote-device-clinic/).
- **Acceptance focus:** Template must load and freeze a fictional interrogation snapshot, connect one lead warning and stored episode to accessible event-marker/electrogram evidence, change a therapy-zone setting that creates a mode dependency conflict, block commit from both edit and diff views until a simulated program test passes, preserve the snapshot plus current/proposed comparison through every topology change, and export a post-commit interrogation receipt.

## Prompt 17 — `immunization-catch-up-series-planner`

- **Output boundary:** `knowledge/archetypes/work/immunization-catch-up-series-planner/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Validate administered doses across single-antigen and combination products, credit their antigen components to concurrent series, and build the earliest valid catch-up visit bundles without restarting any valid series.
- **Required region graph:** `catch-up-plan → person-age-risk-and-policy-version → administered-dose-event-ledger → product-to-antigen-component-map → per-antigen-series-state ↔ historical-dose-validity-and-minimum-interval-rules → contraindication-and-special-situation-checks → candidate-visit-dose-bundles → earliest-valid-date-and-series-completion-proof → scheduled-plan-and-registry-receipt`; one historical product may advance several antigen series, while each series independently owns dose validity, interval and completion.
- **Wide:** Dose history, product-to-antigen component map, per-antigen series matrix, validity/rule evidence and candidate visit bundles remain simultaneously visible; selecting one administered product highlights every series it credits.
- **Intermediate:** The active antigen series and candidate visit bundle remain primary; complete history, rule provenance and other series move to synchronized drawers, while contraindications and the earliest-valid date remain persistent.
- **Compact:** Verify person, age/risk and policy version → choose one antigen series → validate each prior dose and product component → identify the missing step and earliest valid date → add coadministerable doses to one visit bundle → resolve contraindications → schedule and record registry receipt; the full multi-series matrix yields to a bounded accessible table route instead of stacked desktop panes.
- **State obligations:** history loading/duplicate/uncertain, product component known/unknown, dose valid/too-early/not-counted, series complete/incomplete/conditional, minimum interval satisfied/pending, contraindication active/cleared/unknown, visit bundle feasible/conflicted, earliest date recalculating/stale, plan draft/scheduled/declined/deferred and registry receipt pending/failed/recorded.
- **Hard rejection:** Reject when the topology could be `calendar-resource-scheduler`, `prerequisite-pathway-planner`, `rule-builder-workbench` or `stage-gated-process-record`; resource booking, course prerequisites or authored rules are insufficient. Multi-antigen component credit, per-dose validity, minimum intervals, no-restart catch-up logic and one visit satisfying several independent series are mandatory.
- **Research anchors:** `WAI-GRID`, `WAI-STATUS`, `WAI-REFLOW`; add the current [CDC catch-up immunization schedule](https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-catch-up.html) and [WHO recommendations for interrupted or delayed routine immunization](https://www.who.int/publications/m/item/table-3-recommendations-for-interrupted-or-delayed-routine-immunization-summary-of-who-position-papers).
- **Acceptance focus:** Template must import a fictional combination-vaccine history, credit at least two antigen series from one product, invalidate one too-early dose without restarting another valid series, calculate and announce an earliest date, construct a coadministration bundle, surface and resolve a contraindication, reschedule, and preserve the registry receipt after every topology change.

## Prompt 18 — `cytogenetic-karyotype-assembly-workbench`

- **Output boundary:** `knowledge/archetypes/work/cytogenetic-karyotype-assembly-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Assemble and interpret a cytogenetic karyotype by selecting metaphase cells, pairing chromosome objects into homolog positions, inspecting bands and breakpoints, counting clone/mosaic patterns across cells, validating an ISCN expression, and signing the abnormality conclusion.
- **Required region graph:** `karyotype-assembly → specimen-culture-and-metaphase-set → metaphase-cell-gallery → chromosome-object-bin → homolog-pair-karyogram-grid ↔ band-ideogram-and-breakpoint-inspector → clone-and-mosaic-cell-count-ledger → iscn-expression-composer-and-validator → abnormality-conclusion-and-signout`; physical homolog assembly, band coordinates and multi-cell clone counts jointly own the interpretation.
- **Wide:** Metaphase gallery, unassigned chromosome bin, homolog-pair grid, band/breakpoint inspector, clone ledger and ISCN validator remain simultaneous; every assembled object retains cell provenance.
- **Intermediate:** Homolog grid and selected chromosome/breakpoint remain primary; metaphase gallery collapses to a selector and clone/ISCN evidence alternates in a secondary pane.
- **Compact:** Select metaphase → review unassigned objects → assign one homolog pair with button/list alternatives to drag → inspect band/breakpoint → update clone counts across cells → compose/validate ISCN → conclusion/signout; no tiny full karyogram is required for editing.
- **State obligations:** specimen/culture pending/failed/ready, metaphase accepted/rejected/unavailable, chromosome unassigned/paired/ambiguous, homolog slot empty/complete/conflicting, band coordinate unknown/selected, breakpoint draft/confirmed, clone count incomplete/threshold met/mosaic, ISCN parsing/valid/invalid/stale, conclusion draft/signed/amended and image permission unavailable.
- **Hard rejection:** Reject when the result is `entity-resolution-cluster-adjudicator`, `genomic-locus-read-evidence-inspector`, `canvas-inspector-studio` or `multichannel-microscopy-analysis-workbench`; metaphase-specific chromosome objects, homolog-pair assembly, band/breakpoint semantics, cross-cell clone counts and ISCN validation are mandatory.
- **Research anchors:** `WAI-DRAG`, `WAI-GRID`, `WAI-FOCUS`; add [HUGO nomenclature standards including ISCN](https://www.hugo-international.org/standards/), [NCBI Bookshelf karyotyping and cytogenetics](https://www.ncbi.nlm.nih.gov/books/NBK563293/), the [PubMed record for ISCN 2024](https://pubmed.ncbi.nlm.nih.gov/39571546/) and its [published 2026 erratum](https://pubmed.ncbi.nlm.nih.gov/41379737/).
- **Acceptance focus:** Template must accept/reject fictional metaphases, place chromosomes through both drag and button/select controls, catch a duplicate homolog assignment, inspect a named band breakpoint, reconcile clone counts across at least three cells, focus an ISCN validation error, and preserve the signed prior expression when amended.

## Prompt 19 — `cardiac-electrophysiology-ablation-map-workbench`

- **Output boundary:** `knowledge/archetypes/work/cardiac-electrophysiology-ablation-map-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Map and ablate a cardiac arrhythmia by registering catheter locations, linking spatial map points to intracardiac electrograms and activation/voltage evidence, selecting targets, recording lesion delivery and safety events, then remapping to prove the procedural endpoint.
- **Required region graph:** `ep-ablation → procedure-rhythm-and-chamber-context → catheter-and-reference-registration → three-dimensional-chamber-map ↔ intracardiac-electrogram-lanes → activation-voltage-and-pace-mapping-layers → candidate-target-and-lesion-set → energy-delivery-and-safety-events → remap-and-endpoint-proof → procedure-record`; each spatial point's local electrogram and the lesion-to-remap loop own endpoint proof.
- **Wide:** Chamber map, local electrogram lanes, mapping layers, target/lesion register, energy/safety events and remap endpoint remain synchronized; selected point identity persists across projections.
- **Intermediate:** Map plus selected-point electrogram remain primary; layers become explicit switches and lesion/safety/endpoint evidence moves to a synchronized procedure rail.
- **Compact:** Verify rhythm/chamber/registration → find one map point by coordinate/list or spatial view → inspect local electrogram → classify target → record lesion and safety response → remap selected region → prove/fail endpoint → procedure record; the 3D map always has a searchable point table and no gesture-only control.
- **State obligations:** registration pending/stable/drifted, catheter connected/unavailable, map point collecting/accepted/rejected, electrogram live/frozen/noisy/missing, layer calculating/ready/stale, target candidate/confirmed/rejected, lesion planned/delivering/aborted/completed, safety threshold normal/crossed/recovered, remap pending/changed/no change, endpoint met/not met/indeterminate and procedure record draft/signed.
- **Hard rejection:** Reject when the topology can be `multichannel-waveform-analysis-workbench`, `orthogonal-volume-slice-inspector`, `geospatial-raster-layer-analysis-workbench` or `spatial-change-detection-workbench`; registered intracardiac map points, point-linked electrograms, activation/voltage/pace layers, lesion delivery and mandatory remap endpoint proof are all required.
- **Research anchors:** `WAI-DRAG`, `WAI-STATUS`, `WAI-REFLOW`; add [Heart Rhythm Society statement on three-dimensional mapping systems](https://www.hrsonline.org/resource/2019-aphrs-expert-consensus-statement-three-dimensional-mapping-systems-tachycardia-developed/), [DICOM cardiac electrophysiology waveform module](https://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_a.34.7.4.7.html) and [ESC electrophysiology scientific statements](https://www.escardio.org/guidelines/scientific-documents/scientific-statements/arrhythmias-and-electrophysiology/).
- **Acceptance focus:** Template must select a fictional point through map and point table, synchronize its local electrogram, reveal registration drift, prevent lesion delivery until re-registration, record a safety-threshold abort, remap the treated region, distinguish no-change from unavailable evidence, and sign only after an explicit endpoint verdict.

## Prompt 20 — `haplotype-phase-block-curation-workbench`

- **Output boundary:** `knowledge/archetypes/work/haplotype-phase-block-curation-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Assemble, split, merge, flip and bridge phased haplotype blocks from read, molecule and family linkage evidence while maintaining two explicitly oriented haplotype tracks and exact allele membership, then prove Mendelian and ploidy consistency before exporting a versioned phased callset with unresolved gaps explicit.
- **Required region graph:** `phase-curation → sample-ploidy-reference-and-callset-version → heterozygous-variant-lane → read-molecule-and-family-linkage-evidence ↔ phase-blocks-with-two-explicitly-oriented-haplotype-tracks-and-allele-membership → selected-link-confidence-and-conflict → split-merge-flip-or-bridge-operation → mendelian-and-ploidy-consistency-check → unresolved-gap-and-phase-quality-ledger → phased-callset-export-and-version`; every heterozygous allele in a block belongs to exactly one labeled track, flip swaps the selected block's A/B allele orientation rather than reversing a generic relation, and linkage evidence changes membership only through an explicit reversible operation followed by a new consistency check.
- **Wide:** Variant lane, both oriented A/B tracks for every selected phase block, linkage evidence, allele-membership conflict/operation controls, family/ploidy checks and unresolved-gap ledger remain simultaneously visible with synchronized variant, track and block selection.
- **Intermediate:** The selected block's two oriented tracks, active allele membership, supporting/conflicting evidence and proposed operation remain primary; the global variant lane, complete family/read evidence and phase-quality ledger move to synchronized drawers.
- **Compact:** Open the highest-priority phase conflict → inspect the variant pair or block in a labeled A/B allele-membership table → review a linkage evidence table → split, merge, flip or bridge through buttons/forms → verify the resulting track orientation → rerun Mendelian and ploidy checks → record the next unresolved gap → export; the global graph yields to a block-and-track ledger, and every spatial or drag edit retains a single-pointer and keyboard alternative.
- **State obligations:** callset loading/version-mismatch, variant unphased/phased/conflicted, read/molecule/family evidence available/partial/unavailable, block current/stale/split, link confidence unknown/low/high, operation draft/applied/undone, Mendelian or ploidy check pending/pass/fail/indeterminate, gap unresolved/accepted, export queued/failed/issued/superseded and evidence permission limited.
- **Hard rejection:** Reject when the topology could be `genomic-locus-read-evidence-inspector`, `pedigree-inheritance-risk-workbench`, `entity-resolution-cluster-adjudicator`, `phylogeny-alignment-comparison-explorer` or `archaeological-stratigraphic-phasing-workbench`; read inspection, recurrence risk, record clustering, taxon trees, precedence DAGs, acyclicity, dating evidence or interpretive phase grouping are insufficient. Two explicitly oriented haplotype tracks, one-track allele membership, read/molecule/family linkage, reversible membership operations with track-specific flip semantics and post-operation Mendelian/ploidy validation are mandatory.
- **Research anchors:** `WAI-TREEGRID`, `WAI-DRAG`, `WAI-FOCUS`; add the current [GA4GH VCF 4.5 specification](https://samtools.github.io/hts-specs/VCFv4.5.pdf), [GA4GH VRS Cis-Phased Block](https://vrs.ga4gh.org/en/stable/concepts/MolecularVariation/CisPhasedBlock.html) and [ClinGen PM3 in-trans guidance](https://www.clinicalgenome.org/docs/pm3-recommendation-for-in-trans-criterion-pm3-version-1.0/).
- **Acceptance focus:** Template must join two fictional variants into a block from read linkage, assign each allele to one labeled A/B track, surface contradictory family evidence, split then flip or bridge a block through non-drag controls, prove that flip swaps track orientation rather than relation direction, rerun and announce Mendelian/ploidy checks, keep one unresolved gap explicit, undo one operation without losing provenance, and export a new phased-callset version at every width.
