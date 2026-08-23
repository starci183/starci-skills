# Batch 06 — Scientific and technical analysis archetypes (20 prompts)

Tệp này là **một prompt batch tự chứa** cho scientific, laboratory, geospatial và technical analysis surfaces. Khi chạy ở nơi khác, đưa toàn bộ tệp cho agent để tạo đủ 20 leaf. Nếu chỉ chạy một mục, phải đưa kèm toàn bộ phần từ `Cách chạy` đến `Nguồn research dùng chung`; không tách riêng block prompt khỏi hợp đồng chung.

## Mục lục

| # | Archetype ID | Câu hỏi bố cục chính |
|---:|---|---|
| 01 | `finite-element-mesh-convergence-workbench` | Làm sao chứng minh một field solution đủ mesh-independent bằng refinement levels, local error và quantity-of-interest convergence? |
| 02 | `sample-lineage-custody-explorer` | Làm sao truy ngược ancestry, custody, location và consumption của một sample? |
| 03 | `multichannel-microscopy-analysis-workbench` | Làm sao đối chiếu raw channels, composite, segmentation và object measurements để quyết định QC? |
| 04 | `genomic-locus-read-evidence-inspector` | Làm sao biết aligned reads và samples có thực sự hỗ trợ một call tại đúng coordinate? |
| 05 | `phylogeny-alignment-comparison-explorer` | Làm sao liên kết một phylogenetic clade với đúng taxa và sites trong alignment? |
| 06 | `structure-spectrum-assignment-workbench` | Làm sao gán spectral peaks vào atoms/groups và thấy conflicts cùng completeness gaps? |
| 07 | `orthogonal-volume-slice-inspector` | Làm sao định vị và đo một structure qua ba mặt phẳng cùng chia sẻ một 3D coordinate? |
| 08 | `multichannel-waveform-analysis-workbench` | Làm sao đo morphology và intervals trên nhiều synchronized signal channels? |
| 09 | `experiment-randomization-design-planner` | Làm sao tạo design matrix cân bằng, đủ power và có randomization provenance? |
| 10 | `systematic-evidence-synthesis-workbench` | Làm sao tổng hợp estimates từ nhiều studies cùng risk of bias và heterogeneity? |
| 11 | `astronomical-observation-sequence-planner` | Làm sao lập sequence quan sát khả thi dưới visibility, instrument và exposure constraints? |
| 12 | `geospatial-raster-layer-analysis-workbench` | Làm sao phân tích raster bands bằng cell values, algebra, distributions và transects? |
| 13 | `spatial-change-detection-workbench` | Làm sao phát hiện và validate geographic change giữa hai registered observations? |
| 14 | `scientific-notebook-reproducibility-audit` | Làm sao chứng minh notebook tái tạo được outputs từ đúng data, environment và execution order? |
| 15 | `microplate-dose-response-analysis-workbench` | Làm sao reconcile physical well layout, spatial QC và fitted dose-response curves? |
| 16 | `process-mass-balance-analyzer` | Làm sao reconcile conserved material qua network có unit operations, streams và recycle loops? |
| 17 | `binary-structure-hex-inspector` | Làm sao giữ parsed fields, byte offsets, raw hex/ASCII và validation đồng bộ? |
| 18 | `query-plan-hotspot-analyzer` | Làm sao tìm operator gây cardinality, I/O hoặc cost amplification trong query plan? |
| 19 | `heap-dominator-path-explorer` | Làm sao tìm vì sao objects còn retained bằng dominators và paths tới GC roots? |
| 20 | `sampled-call-stack-profile-explorer` | Làm sao nối aggregate CPU cost với sampled stacks, callers và source frames? |

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

## Prompt 01 — `finite-element-mesh-convergence-workbench`

- **Output boundary:** `knowledge/archetypes/work/finite-element-mesh-convergence-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Establish whether a numerical field solution is mesh-independent enough for its intended quantity of interest by comparing refinement levels, locating discretization error, refining and rerunning.
- **Required region graph:** `mesh-convergence → analysis-case-boundary-and-material-authority → mesh-level-hierarchy ↔ geometry-and-mesh-stage ↔ field-result-stage → element-quality-and-local-error-map → quantity-of-interest-convergence-series → refinement-plan-and-cost → rerun-and-acceptance-receipt`; spatial error localization and cross-level convergence jointly own acceptance.
- **Wide:** Selected mesh, field result, local error/quality and convergence series remain simultaneous with one shared level and physical-region identity.
- **Intermediate:** Selected refinement pair and convergence result remain primary; geometry and field alternate in one preserved viewport while quality details become a synchronized pane.
- **Compact:** Quantity of interest → refinement-level pair → worst error zone/element → field/error evidence → refine/rerun → convergence receipt; no miniature multi-viewport wall remains.
- **State obligations:** case incomplete, mesh generating/failure, element invalid, solve pending/diverged, quantity unavailable, error estimator stale, convergence monotonic/oscillatory/not-reached, cost exceeded and acceptance pending/accepted/rejected.
- **Hard rejection:** Reject cho `scenario-sensitivity-modeler`, orthogonal volume inspection, generic simulation viewer or job timeline; linked mesh hierarchy, the same physical region across mesh/field/error views, local discretization error, cross-level convergence and refinement rerun are mandatory.
- **Research anchors:** `WAI-FOCUS`, `WAI-REFLOW`, `WAI-STATUS`; add [NASA-STD-7009B](https://standards.nasa.gov/standard/nasa/nasa-std-7009), [ASME V&V 10](https://www.asme.org/codes-runtime/standards/find-codes-runtime/standards/standard-for-verification-and-validation-in-computational-solid-mechanics) and [NAFEMS code-verification exemplars](https://www.nafems.org/publications/resource_center/r0135/).
- **Acceptance focus:** Template must compare at least three mesh levels, select the same physical region across mesh/field/error views, expose non-convergence, create local refinement, rerun and issue a traceable acceptance receipt.

## Prompt 02 — `sample-lineage-custody-explorer`

- **Output boundary:** `knowledge/archetypes/discovery/sample-lineage-custody-explorer/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Trace one sample or aliquot through derivation ancestry, custody, location and use history to establish provenance and integrity.
- **Required region graph:** `sample-explorer → sample-identity → derivation-lineage-tree ↔ current-location-and-inventory → custody-chain → assay-and-consumption-links → integrity-exceptions → selected-ancestor-or-descendant-detail`; genealogy, chronological custody and current location remain separate evidence owners.
- **Wide:** Lineage tree and selected node detail stay visible with an independent custody/location rail.
- **Intermediate:** Lineage or custody becomes primary while selected path, current location and integrity verdict remain persistent.
- **Compact:** Sample summary → ancestor/descendant path → location → custody events → assays/consumption; switching nodes restores path and scroll context.
- **State obligations:** lineage loading/partial/cyclic-invalid, aliquot consumed/available/missing, custody verified/gap/disputed, location stale, integrity exception open/resolved, permission-redacted event and selected-node recovery.
- **Hard rejection:** Reject cho generic knowledge graph, audit timeline, inventory detail hoặc chain-of-custody transfer execution; this archetype requires branching derivation plus a separate custody owner.
- **Research anchors:** `APPLE-SPLIT`, `CARBON-TABLE`, `WAI-APG`, `WAI-FOCUS`, `WAI-REFLOW`; add [NIST Research Data Framework](https://www.nist.gov/programs-projects/research-data-framework-rdaf) and [WAI Tree View](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/).
- **Acceptance focus:** Template must traverse ancestors and descendants, select a custody event, expose an integrity gap textually and preserve the same node/path when panes collapse.

## Prompt 03 — `multichannel-microscopy-analysis-workbench`

- **Output boundary:** `knowledge/archetypes/work/multichannel-microscopy-analysis-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Validate segmentation and quantitative measurements by comparing co-registered raw channels, a composite, derived objects and quality evidence.
- **Required region graph:** `microscopy-workbench → image-dataset-context → channel-and-plane-controls → synchronized-raw-channel-views ↔ composite-stage → segmentation-and-object-overlay → object-measurement-table → selected-object-profile → qc-and-acceptance`; raw data, derived overlay and measurement table have shared selection but distinct authority.
- **Wide:** Raw channels/composite, object measurements and inspector remain simultaneously available.
- **Intermediate:** Composite becomes primary; channel strip and measurement table alternate while retaining shared object and coordinate selection.
- **Compact:** Field summary → channel switch → overlay → selected-object measurements → QC; an object list is the default non-visual parity route.
- **State obligations:** dataset/channel loading, plane unavailable, segmentation running/stale/failure, object selected/rejected/merged/split, measurement incomplete/outlier, QC pass/fail/needs-review and acceptance conflict.
- **Hard rejection:** Reject cho one-canvas property editing, image gallery, media annotation or generic data table; multiple co-registered raw views and raw-to-derived measurement lineage are mandatory.
- **Research anchors:** `ESRI-LAYOUT`, `APPLE-LAYOUT`, `WAI-REFLOW`, `WAI-FOCUS`, `WAI-APG`; add [OME 6.2.2 data model overview](https://docs.openmicroscopy.org/ome-model/6.2.2/developers/model-overview.html) and [WAI complex images](https://www.w3.org/WAI/tutorials/images/complex/).
- **Acceptance focus:** Template must synchronize channel/composite selection, expose object measurements without relying on pixels alone, simulate segmentation/QC states and provide keyboard alternatives for pan/selection.

## Prompt 04 — `genomic-locus-read-evidence-inspector`

- **Output boundary:** `knowledge/archetypes/detail/genomic-locus-read-evidence-inspector/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Determine how aligned reads across samples support or contradict one call at an exact genomic coordinate.
- **Required region graph:** `locus-inspector → assembly-and-locus-context → coordinate-ruler → reference-and-annotation-tracks → per-sample-coverage-and-pileups → allele-evidence-matrix → selected-read-or-call-detail → quality-summary`; coordinate, sample pileups and allele evidence are independent owners.
- **Wide:** Track stack/pileups and allele evidence matrix remain visible; selected-read detail is supporting.
- **Intermediate:** One pileup is primary while sample navigator, exact locus and quality summary persist.
- **Compact:** Locus summary → selected sample pileup → allele counts → read detail → quality; changing views retains exact coordinate.
- **State obligations:** assembly mismatch, locus loading/not-covered, sample missing/low-depth, reference/alternate evidence, strand or mapping-quality warning, call supported/ambiguous/refuted and redacted sample.
- **Hard rejection:** Reject cho distributed trace waterfall, generic evidence dossier, sequence browser or timeline; the shared axis must be a reference coordinate with per-sample pileups and allele matrix.
- **Research anchors:** `CARBON-GRID`, `WAI-APG`, `WAI-FOCUS`, `WAI-REFLOW`, `WAI-STATUS`; add [NCBI Genome Data Viewer](https://www.ncbi.nlm.nih.gov/gdv/browser/help/) and [GA4GH Variation Representation](https://vrs.ga4gh.org/en/stable/).
- **Acceptance focus:** Template must keep coordinate/sample selection synchronized, expose numeric allele evidence and text alternatives, and retain locus state through track→sample→read compact navigation.

## Prompt 05 — `phylogeny-alignment-comparison-explorer`

- **Output boundary:** `knowledge/archetypes/discovery/phylogeny-alignment-comparison-explorer/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Understand evolutionary relationships by coupling a rooted phylogenetic tree with the corresponding rows and sites of a multiple-sequence alignment.
- **Required region graph:** `phylogeny-explorer → dataset-and-model-context → phylogenetic-tree ↔ sequence-alignment-matrix → site-and-conservation-summary → selected-clade-metadata → selected-site-detail`; clade selection and alignment coordinates remain synchronized.
- **Wide:** Tree and alignment are visible together with synchronized taxa and site selection.
- **Intermediate:** Tree narrows or collapses while selected clade path and alignment coordinates remain visible.
- **Compact:** Tree-first clade drill-down → alignment slice for selected taxa → site/conservation detail; Back preserves clade, site and scroll.
- **State obligations:** tree/alignment loading, taxon missing, collapsed clade, site selected/conserved/variable/gapped, model metadata unavailable, selection sync failure and downloadable result.
- **Hard rejection:** Reject cho generic knowledge graph, two-document parallel reader, hierarchy browser or spreadsheet; a rooted taxa hierarchy coupled to a two-dimensional aligned residue matrix is required.
- **Research anchors:** `APPLE-SPLIT`, `CARBON-GRID`, `WAI-APG`, `WAI-FOCUS`, `WAI-REFLOW`; add [EMBL-EBI multiple sequence alignment](https://www.ebi.ac.uk/training/online/courses/guide-to-sequence-analysis-tools/sequence-alignment/multiple-sequence-alignment/) and [WAI Treegrid](https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/).
- **Acceptance focus:** Template must synchronize clade↔rows and site↔detail, give a keyboard-complete matrix route and preserve both coordinates when responsive panes alternate.

## Prompt 06 — `structure-spectrum-assignment-workbench`

- **Output boundary:** `knowledge/archetypes/work/structure-spectrum-assignment-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Assign peaks from one or more spectra to atoms or groups in a molecular structure while resolving conflicts and completeness gaps.
- **Required region graph:** `assignment-workbench → sample-and-structure-context → atom-indexed-molecular-structure ↔ spectral-axes → peak-list → atom-to-peak-assignment-matrix → selected-assignment-evidence → conflict-and-completeness-summary → finalize`; atom graph and spectral coordinates are peer owners joined by assignments.
- **Wide:** Structure, spectrum and assignment matrix remain visible together.
- **Intermediate:** Structure or spectrum becomes primary while the active atom/peak pair and completeness summary persist.
- **Compact:** Peak-by-peak sequence: peak → candidate atoms → evidence → assign → next; structure and spectrum are named alternate views.
- **State obligations:** spectrum loading/noise, peak unpicked/selected/overlapping, atom assigned/unassigned/multiply-assigned, conflict, low-confidence, completeness gap, finalize blocked/success and stale recalculation.
- **Hard rejection:** Reject cho media annotation, generic graph exploration, data mapping or one-canvas inspection; many-to-many assignment between atom graph and spectral coordinates is mandatory.
- **Research anchors:** `APPLE-LAYOUT`, `CARBON-GRID`, `WAI-APG`, `WAI-FOCUS`, `WAI-REFLOW`; add [NIST Chemistry WebBook](https://webbook.nist.gov/) and [NCBI PubChem structures](https://pubchem.ncbi.nlm.nih.gov/docs/structures).
- **Acceptance focus:** Template must select peaks/atoms from either representation, create/remove assignments, surface conflicts and keep global completeness available at compact.

## Prompt 07 — `orthogonal-volume-slice-inspector`

- **Output boundary:** `knowledge/archetypes/detail/orthogonal-volume-slice-inspector/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Locate and measure a structure inside a volume by navigating three orthogonal planes that share one crosshair coordinate.
- **Required region graph:** `volume-inspector → volume-and-series-context → axial-view ↔ coronal-view ↔ sagittal-view → shared-crosshair-and-coordinate → optional-3d-overview → window-level-and-segmentation → measurement-and-finding-list`; all planes independently render but share one coordinate owner.
- **Wide:** Axial, coronal and sagittal views plus optional 3D overview form a coordinated stage; findings stay available.
- **Intermediate:** One primary plane and two orientation previews remain; findings and controls move to a supporting pane.
- **Compact:** One plane at a time with explicit orientation switch, coordinate readout and previous/next slice; every gesture has a button or direct-input equivalent.
- **State obligations:** volume loading/partial, plane unavailable, crosshair linked/unlinked, slice boundary, segmentation hidden/stale, measurement draft/saved, finding selected and orientation restoration.
- **Hard rejection:** Reject cho generic canvas inspector, gallery lightbox, media annotation or map; three orthogonal planes sharing one 3D coordinate are invariant.
- **Research anchors:** `APPLE-LAYOUT`, `WAI-REFLOW`, `WAI-FOCUS`, `WAI-APG`, `WAI-OBSCURED`; add [DICOM volumetric presentation](https://www.dicomstandard.org/news/supplements/view/volume-rendering-volumetric-presentation-states) and [WCAG Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html).
- **Acceptance focus:** Template must synchronize crosshairs across three planes, offer numeric coordinate/slice controls, create a finding and retain coordinate/orientation across compact switching.

## Prompt 08 — `multichannel-waveform-analysis-workbench`

- **Output boundary:** `knowledge/archetypes/work/multichannel-waveform-analysis-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Locate and measure morphology, intervals and event candidates across multiple synchronized continuous signal channels.
- **Required region graph:** `waveform-workbench → recording-and-calibration-context → channel-set-and-scale → synchronized-waveform-traces → shared-cursor-and-interval → derived-measurements → event-candidate-list → selected-interval-detail → finding-export`; shared time selection and numeric measurements govern every view.
- **Wide:** Stacked traces, measurement panel and event candidates remain visible.
- **Intermediate:** Fewer channels remain visible; selector, shared cursor and measurement summary persist.
- **Compact:** Event-first list or one channel group → selected trace window → numeric measurements → adjacent channels → finding; no horizontal page overflow.
- **State obligations:** recording loading/gap/clipped, channel hidden/noisy, cursor/interval selected, event candidate accepted/rejected, measurement recalculating/out-of-range, calibration warning and export.
- **Hard rejection:** Reject cho timeline status monitor, media annotation, streaming logs or generic chart overview; continuous sampled channels and shared interval measurement are mandatory.
- **Research anchors:** `FLUENT-LAYOUT`, `CARBON-GRID`, `WAI-REFLOW`, `WAI-FOCUS`, `WAI-STATUS`; add [PhysioNet waveform resources](https://physionet.org/about/database/) and [WAI complex images](https://www.w3.org/WAI/tutorials/images/complex/).
- **Acceptance focus:** Template must synchronize cursor/interval across channels, expose numeric alternatives, accept/reject an event and provide keyboard controls for zoom, pan and measurement.

## Prompt 09 — `experiment-randomization-design-planner`

- **Output boundary:** `knowledge/archetypes/work/experiment-randomization-design-planner/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Create a balanced, sufficiently powered and reproducibly randomized experimental assignment design before subjects or samples are allocated.
- **Required region graph:** `design-planner → study-question-and-population → factors-treatments-and-strata → candidate-design-matrix → balance-and-power-evidence → block-and-randomization-plan → seed-and-concealment-record → assignment-export`; matrix, balance evidence and randomization provenance jointly own validity.
- **Wide:** Design inputs, assignment matrix and balance/power evidence remain visible.
- **Intermediate:** Inputs collapse while matrix stays primary and imbalance summary remains persistent.
- **Compact:** Define factors → generate design → inspect balance/power → lock seed → review/export; matrix has a labeled row-group alternative.
- **State obligations:** population incomplete, factor/level invalid, design generating, balance pass/fail, power insufficient, seed unlocked/locked, concealment restricted, export pending and version conflict.
- **Hard rejection:** Reject cho scenario sensitivity, calendar scheduling, spreadsheet editing, quota allocation or direct waitlist matching; output must be a randomized assignment matrix with concealment provenance.
- **Research anchors:** `CARBON-GRID`, `WAI-APG`, `WAI-FOCUS`, `WAI-REFLOW`, `WAI-STATUS`; add [FDA randomized trial design](https://www.fda.gov/media/191123/download) and [CONSORT published statements](https://www.consort-spirit.org/published-statements).
- **Acceptance focus:** Template must generate a deterministic mock matrix from a seed, surface imbalance/power evidence, lock the seed and preserve design state through compact review.

## Prompt 10 — `systematic-evidence-synthesis-workbench`

- **Output boundary:** `knowledge/archetypes/work/systematic-evidence-synthesis-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Synthesize estimates from multiple studies, weigh risk of bias and heterogeneity and produce a reviewable certainty conclusion.
- **Required region graph:** `synthesis-workbench → review-question-and-inclusion → study-register → structured-extraction-table ↔ risk-of-bias-assessment → effect-model-and-forest-plot → heterogeneity-and-sensitivity → certainty-summary → synthesis-record`; study weights, bias and aggregate model are distinct owners.
- **Wide:** Study table, forest plot and bias/sensitivity evidence remain visible.
- **Intermediate:** Study register is primary; plot and bias assessment become named panes while selected study persists.
- **Compact:** Study list → selected extraction/bias → numeric effect table → forest-plot alternative → synthesis/certainty summary.
- **State obligations:** study loading/excluded, extraction incomplete, effect unavailable, bias low/some/high, model calculating/failure, heterogeneity high, sensitivity exclusion, certainty draft/reviewed and stale source.
- **Hard rejection:** Reject cho one-case evidence dossier, literature screening queue, generic pivot analytics or authored briefing; weighted cross-study synthesis and heterogeneity are mandatory.
- **Research anchors:** `CARBON-TABLE`, `WAI-APG`, `WAI-FOCUS`, `WAI-REFLOW`, `WAI-STATUS`; add [Cochrane Handbook](https://training.cochrane.org/handbook/current) and [PRISMA 2020](https://www.prisma-statement.org/prisma-2020).
- **Acceptance focus:** Template must include/exclude studies, update a numeric synthesis and certainty state, provide a tabular chart equivalent and preserve selected study across panes.

## Prompt 11 — `astronomical-observation-sequence-planner`

- **Output boundary:** `knowledge/archetypes/work/astronomical-observation-sequence-planner/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Compose an executable observation sequence under target visibility, atmospheric, instrument and exposure constraints.
- **Required region graph:** `observation-planner → proposal-and-target-context → target-catalog → sky-and-visibility-windows ↔ ephemeris-and-constraints → instrument-configuration → ordered-exposure-sequence → feasibility-and-time-budget → validate-and-export`; visibility and exposure ordering jointly own feasibility.
- **Wide:** Visibility plots, target/configuration inspector and exposure sequence remain visible.
- **Intermediate:** Target catalog collapses; visibility summary and ordered sequence remain primary.
- **Compact:** Target → visibility window → instrument setup → exposures → feasibility review; reorder has move controls and retains selected target.
- **State obligations:** target unavailable, window open/closed/partial, weather constraint unknown, instrument invalid, exposure over budget, sequence conflict, validation pending/pass/fail and export version.
- **Hard rejection:** Reject cho calendar resource scheduler, route itinerary, generic workflow or media timeline; celestial feasibility and ordered exposures must jointly determine validity.
- **Research anchors:** `APPLE-LAYOUT`, `FLUENT-LAYOUT`, `WAI-REFLOW`, `WAI-FOCUS`, `WAI-STATUS`; add [ESO observing tools](https://www.eso.org/sci/observing/tools.html) and [NRAO Observation Preparation Tool](https://science.nrao.edu/facilities/vla/docs/manuals/opt2010/basics/webapp).
- **Acceptance focus:** Template must select targets/windows, configure exposures, recalculate time budget, expose infeasibility and support non-drag sequence editing.

## Prompt 12 — `geospatial-raster-layer-analysis-workbench`

- **Output boundary:** `knowledge/archetypes/work/geospatial-raster-layer-analysis-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Analyze co-registered raster bands or layers through cell values, algebra, distributions and transect profiles.
- **Required region graph:** `raster-workbench → coverage-and-time-context → layer-and-band-algebra-stack → raster-map-stage ↔ legend-and-histogram → point-or-area-query → transect-profile → derived-result-and-export`; raster cells, formula stack and numeric profiles are peer owners.
- **Wide:** Layer stack, raster stage and histogram/profile remain visible.
- **Intermediate:** Layer stack becomes a drawer while selected formula and queried value persist.
- **Compact:** Layer list → full-screen map → selected-cell numeric table → transect/profile/result; map is never the only route to data.
- **State obligations:** coverage loading/no-data, layer hidden/error, formula valid/invalid/calculating, cell selected/masked, transect draft/ready, histogram stale, result pending/failure and export.
- **Hard rejection:** Reject cho place discovery map, live situation map, generic canvas or dashboard; cell/band algebra and numeric spatial profiles must dominate.
- **Research anchors:** `ESRI-LAYOUT`, `CARBON-GRID`, `WAI-REFLOW`, `WAI-FOCUS`, `WAI-APG`; add [OGC Web Coverage Service](https://www.ogc.org/standards/wcs/) and [USGS LCMAP](https://www.usgs.gov/data/land-change-monitoring-assessment-and-projection-science-products).
- **Acceptance focus:** Template must query a cell/area, edit a local band expression, generate a transect profile and provide complete textual/table equivalents for map-derived values.

## Prompt 13 — `spatial-change-detection-workbench`

- **Output boundary:** `knowledge/archetypes/work/spatial-change-detection-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Detect and validate geographic change between two registered observations and review quantities for each derived change region.
- **Required region graph:** `change-workbench → area-and-time-pair → before-and-after-imagery ↔ registration-quality → derived-change-mask → change-region-queue → selected-region-statistics → threshold-and-validation → export`; spatial mask and region statistics own the task, not a merge result.
- **Wide:** Before/after imagery, change mask/queue and statistics remain visible.
- **Intermediate:** Imagery is primary; region queue and statistics alternate with selected area summary.
- **Compact:** Before/after toggle → change-region list → selected mask/statistics → validate; exact viewport and area of interest restore.
- **State obligations:** imagery loading/clouded/misaligned, registration pass/fail, mask calculating/stale, region selected/accepted/rejected/uncertain, threshold changed, validation pending and export.
- **Hard rejection:** Reject cho reconciliation diff, map explorer, media annotation or generic image compare; a derived spatial mask plus quantified regions is mandatory.
- **Research anchors:** `ESRI-LAYOUT`, `APPLE-LAYOUT`, `WAI-REFLOW`, `WAI-FOCUS`, `WAI-APG`; add [USGS continuous change detection](https://www.usgs.gov/centers/eros/science/usgs-eros-archive-lcmap-continuous-change-detection-classification-v13-ccdc) and [ESA SNAP](https://step.esa.int/main/toolboxes/snap/).
- **Acceptance focus:** Template must switch/compare observations, calculate mock change regions, validate one region using numeric evidence and preserve viewport/selection across widths.

## Prompt 14 — `scientific-notebook-reproducibility-audit`

- **Output boundary:** `knowledge/archetypes/detail/scientific-notebook-reproducibility-audit/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Prove whether an existing computational notebook reproduces captured outputs from declared data, environment and execution order.
- **Required region graph:** `reproducibility-audit → analysis-identity → notebook-cell-sequence ↔ cell-data-dependency-dag → environment-and-lock-manifest → captured-outputs → deterministic-rerun-status → divergence-evidence → reproducibility-receipt`; cell order, dependencies and environment are independent proof owners.
- **Wide:** Notebook, lineage DAG and rerun evidence remain visible.
- **Intermediate:** Notebook is primary; environment, lineage and divergence become named panes.
- **Compact:** Audit summary → first divergent cell → dependencies/input → output comparison → manifest → receipt.
- **State obligations:** manifest missing, data unavailable/hash mismatch, cell cached/running/failure, output equal/divergent, nondeterminism suspected, environment mismatch, rerun cancelled and receipt pass/fail.
- **Hard rejection:** Reject cho interactive teaching lab, job-run timeline, code diff, notebook editor or `event-stream-replay-projection-workbench`; finite notebook-cell source hashes, data/environment lineage, topological execution-order audit and output reproducibility of one existing notebook artifact are mandatory—there is no event-prefix cursor or reducer-owned projection state.
- **Research anchors:** `VSCODE-UX`, `WAI-APG`, `WAI-FOCUS`, `WAI-REFLOW`, `WAI-STATUS`; add [Jupyter execution](https://docs.jupyter.org/en/latest/projects/execution.html) and [Workflow Run RO-Crate](https://www.researchobject.org/workflow-run-crate/profiles/).
- **Acceptance focus:** Template must identify the first divergent cell, tie it to data/environment evidence, simulate rerun states and issue an auditable pass/fail receipt.

## Prompt 15 — `microplate-dose-response-analysis-workbench`

- **Output boundary:** `knowledge/archetypes/work/microplate-dose-response-analysis-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Reconcile a physical well layout, spatial quality evidence and fitted dose-response curves before accepting an assay plate or batch.
- **Required region graph:** `dose-response-workbench → plate-and-batch-context → well-grid-and-controls → spatial-qc-heatmap → dose-series-groups → fitted-response-curves → outlier-and-edge-effect-queue → selected-well-raw-read → acceptance-and-report`; physical coordinates and fitted series are peer owners.
- **Wide:** Plate grid, curves and QC/outlier evidence remain visible.
- **Intermediate:** Plate or curve becomes primary while selected series/well summary persists.
- **Compact:** QC verdict → dose-series list → fitted curve/numeric table → selected well → accept/reject; grid is an optional bounded view.
- **State obligations:** plate loading, control pass/fail, well missing/outlier, edge effect suspected, curve fitting/passed/failed, parameter confidence low, series accepted/rejected and batch decision.
- **Hard rejection:** Reject cho spreadsheet grid, cohort heatmap, generic chart analytics or laboratory protocol runner; physical wells plus fitted dose-series QC are mandatory.
- **Research anchors:** `CARBON-GRID`, `WAI-APG`, `WAI-FOCUS`, `WAI-REFLOW`, `WAI-STATUS`; add [NIH Assay Guidance Manual](https://www.ncbi.nlm.nih.gov/books/NBK83783/?report=reader) and [FDA Q2(R2) validation of analytical procedures](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/q2r2-validation-analytical-procedures).
- **Acceptance focus:** Template must select wells/series, fit a deterministic mock curve, expose numeric results and spatial QC, and block batch acceptance on unresolved controls.

## Prompt 16 — `process-mass-balance-analyzer`

- **Output boundary:** `knowledge/archetypes/work/process-mass-balance-analyzer/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Reconcile conserved material through a network of unit operations, streams and recycle loops and locate imbalance and uncertainty.
- **Required region graph:** `mass-balance-analyzer → process-and-case-context → unit-operation-flow-graph ↔ stream-composition-ledger → local-and-global-conservation-equations → imbalance-priority → selected-unit-or-stream-detail → uncertainty-and-reconciliation → export`; every unit and the whole network own balance equations.
- **Wide:** Flow graph, stream ledger and balance equations remain visible.
- **Intermediate:** Graph becomes supporting; imbalance list and ledger are primary with active path summary.
- **Compact:** Imbalance-first list → selected unit path → inputs/outputs → equation → uncertainty/reconcile; graph optional.
- **State obligations:** stream loading/missing, unit balanced/imbalanced, recycle convergence pending/failure, composition invalid, uncertainty high, reconciliation proposed/accepted and export.
- **Hard rejection:** Reject cho dependency health graph, one bridge waterfall, quota editor or scenario modeler; edges must carry conserved quantities through a recirculating network.
- **Research anchors:** `CARBON-TABLE`, `WAI-APG`, `WAI-FOCUS`, `WAI-REFLOW`, `WAI-STATUS`; add [EPA mass balance guidance](https://nepis.epa.gov/Exe/ZyPURL.cgi?Dockey=300043RS.TXT) and [WAI complex images](https://www.w3.org/WAI/tutorials/images/complex/).
- **Acceptance focus:** Template must alter a stream, recompute local/global balances, rank an imbalance, reconcile uncertainty and provide a linear equation/path alternative.

## Prompt 17 — `binary-structure-hex-inspector`

- **Output boundary:** `knowledge/archetypes/detail/binary-structure-hex-inspector/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Decode a binary artifact by synchronizing parsed structure fields, byte offsets, raw hexadecimal/ASCII bytes and validation results.
- **Required region graph:** `binary-inspector → artifact-and-offset-context → parsed-structure-tree ↔ hex-and-ascii-byte-view → decoded-field-values → checksum-and-format-validation → cross-references → export`; selected structure field owns one exact byte range across representations.
- **Wide:** Structure tree, bytes and decoded values remain visible; selection highlights the exact range.
- **Intermediate:** Tree collapses while selected structure path and offsets remain.
- **Compact:** Structure path → decoded field → exact bytes → validation; explicit previous/next field preserves offset context.
- **State obligations:** artifact loading/truncated, parser unsupported/failure, field selected/unknown, byte range invalid, checksum pass/fail, cross-reference unresolved, endian/display change and export.
- **Hard rejection:** Reject cho generic hierarchical three-pane explorer, packet timeline, code editor or document diff; synchronized semantic fields and raw byte ranges are mandatory.
- **Research anchors:** `VSCODE-UX`, `CARBON-GRID`, `WAI-APG`, `WAI-FOCUS`, `WAI-REFLOW`; add [Wireshark user guide](https://www.wireshark.org/docs/wsug_html/) and [IETF RFC Editor](https://www.rfc-editor.org/).
- **Acceptance focus:** Template must synchronize tree↔hex selection, decode fields, surface checksum failure and keep offsets/text alternatives usable without two-dimensional vision.

## Prompt 18 — `query-plan-hotspot-analyzer`

- **Output boundary:** `knowledge/archetypes/detail/query-plan-hotspot-analyzer/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Explain actual versus estimated query execution and locate the operator causing cardinality, I/O or cost amplification.
- **Required region graph:** `plan-analyzer → query-and-run-context → operator-plan-tree ↔ estimated-vs-actual-metrics → contribution-profile → hotspot-ranking → selected-operator-input-output → index-and-statistics-evidence → rerun-comparison`; operator data flow and estimate error jointly own diagnosis.
- **Wide:** Plan tree, metrics/contribution and query/operator detail remain visible.
- **Intermediate:** Tree and hotspot evidence are primary; source/query detail becomes temporary.
- **Compact:** Hotspot list → operator ancestry path → estimate/actual evidence → relevant query fragment → rerun comparison.
- **State obligations:** plan loading/unsupported, estimate only/actual available, operator normal/hot, cardinality error, spill/I/O warning, evidence missing, rerun pending/failure and baseline changed.
- **Hard rejection:** Reject cho distributed trace waterfall, query builder, dependency monitor or generic profiling; an operator execution tree with estimate-versus-actual amplification is required.
- **Research anchors:** `VSCODE-UX`, `CARBON-TABLE`, `WAI-APG`, `WAI-FOCUS`, `WAI-REFLOW`; add [PostgreSQL EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html) and [MySQL execution plans](https://dev.mysql.com/doc/refman/8.4/en/execution-plan-information.html).
- **Acceptance focus:** Template must rank a hotspot, navigate its ancestry, compare estimate/actual metrics and preserve selected operator through compact source/evidence stages.

## Prompt 19 — `heap-dominator-path-explorer`

- **Output boundary:** `knowledge/archetypes/detail/heap-dominator-path-explorer/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Find why objects remain retained by following dominators and reference paths back to garbage-collection roots.
- **Required region graph:** `heap-explorer → snapshot-and-runtime-context → class-and-size-summary → dominator-tree → retained-size-view → reference-paths-to-roots → selected-object-fields → snapshot-comparison-and-leak-suspects`; dominance and root reachability are mathematical owners.
- **Wide:** Dominator tree, root path and object detail remain visible.
- **Intermediate:** Suspect ranking and root path are primary; object detail becomes a drawer.
- **Compact:** Leak suspects → selected dominator path → root references → object fields → snapshot delta.
- **State obligations:** snapshot loading/corrupt, class grouped, object selected/collected, root path found/multiple/missing, retained size calculating, suspect confirmed/dismissed and comparison unavailable.
- **Hard rejection:** Reject cho dependency topology monitor, generic hierarchy explorer, memory chart or record detail; dominator relation and path-to-root evidence are mandatory.
- **Research anchors:** `VSCODE-UX`, `CARBON-GRID`, `WAI-APG`, `WAI-FOCUS`, `WAI-REFLOW`; add [Chrome memory terminology](https://developer.chrome.com/docs/devtools/memory-problems/get-started) and [Eclipse MAT dominator tree](https://help.eclipse.org/latest/topic/org.eclipse.mat.ui.help/concepts/dominatortree.html).
- **Acceptance focus:** Template must rank leak suspects, traverse one dominator/root path, show retained-size evidence and offer a list/treegrid route with deterministic focus.

## Prompt 20 — `sampled-call-stack-profile-explorer`

- **Output boundary:** `knowledge/archetypes/detail/sampled-call-stack-profile-explorer/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Locate aggregate CPU cost by connecting sampled stacks, flame geometry, bottom-up callers and source frames.
- **Required region graph:** `profile-explorer → profile-and-workload-context → flame-graph ↔ call-tree-and-bottom-up-table → thread-and-category-navigation → selected-frame-source → sample-distribution → baseline-comparison`; aggregated samples and shared stack prefixes own the evidence.
- **Wide:** Flame graph, call table and source/detail remain visible.
- **Intermediate:** Flame graph is primary; call/source alternate while selected stack persists.
- **Compact:** Hot functions list → caller/callee path → source frame → distribution/baseline; flame view is optional full-screen.
- **State obligations:** profile loading/partial, thread hidden, frame selected/inlined/unknown, samples aggregating, hotspot filtered, baseline missing/regressed/improved and source unavailable.
- **Hard rejection:** Reject cho distributed trace, streaming log console, query plan or generic chart dashboard; aggregate sampled stacks and caller/callee paths are required.
- **Research anchors:** `VSCODE-UX`, `WAI-APG`, `WAI-FOCUS`, `WAI-REFLOW`, `WAI-STATUS`; add [Chrome Performance reference](https://developer.chrome.com/docs/devtools/performance/reference) and [Firefox Profiler](https://profiler.firefox.com/docs/).
- **Acceptance focus:** Template must switch flame/call/bottom-up views without losing the selected frame, expose numeric sample distributions and keep source navigation keyboard-complete.
