# Batch 10 — Specialized coordination and production archetypes (20 prompts)

Tệp này là **một prompt batch tự chứa** cho scarce allocation, scientific construction, formal analysis, live production và multi-party service coordination surfaces. Khi chạy ở nơi khác, đưa toàn bộ tệp cho agent để tạo đủ 20 leaf. Nếu chỉ chạy một mục, phải đưa kèm toàn bộ phần từ `Cách chạy` đến `Nguồn research dùng chung`; không tách riêng block prompt khỏi hợp đồng chung.

## Mục lục

| # | Archetype ID | Câu hỏi bố cục chính |
|---:|---|---|
| 01 | `waitlist-offer-allocation-board` | Làm sao phân bổ openings khan hiếm theo rule rồi recycle offer hết hạn mà vẫn audit được fairness? |
| 02 | `circular-sequence-construct-designer` | Làm sao author construct khi circular và linear coordinates phải round-trip tuyệt đối? |
| 03 | `formal-proof-obligation-workbench` | Làm sao biến tactic thành state transitions trên obligation stack và chỉ kết thúc bằng kernel verdict? |
| 04 | `orbital-conjunction-assessment-workbench` | Làm sao đánh giá một encounter qua orbit, covariance, risk trend và maneuver rescreen bắt buộc? |
| 05 | `well-to-well-liquid-transfer-programmer` | Làm sao lập ordered transfer program giữa hai plate mà giữ volume, tip-use và contamination invariants? |
| 06 | `memory-consistency-litmus-explorer` | Làm sao quyết định một concurrent outcome được phép hay cấm và chỉ ra ordering witness? |
| 07 | `stream-window-join-debugger` | Làm sao giải thích vì sao hai events match, miss hoặc drop dưới windows, watermarks và lateness? |
| 08 | `flow-cytometry-gating-workbench` | Làm sao author recursive population tree khi mỗi gate thay đổi event set của mọi descendant? |
| 09 | `audio-mix-routing-console` | Làm sao route sources qua buses/processors rồi automation và validate master output? |
| 10 | `print-signature-imposition-planner` | Làm sao biến logical page order thành signatures/sheets rồi fold-bind reconstruct đúng publication? |
| 11 | `simultaneous-interpretation-channel-console` | Làm sao giữ coverage live cho language channels bằng primary, backup, relay và handoff? |
| 12 | `constraint-solver-unsat-core-explorer` | Làm sao tìm minimal conflicting constraints, thử relaxations và trả về satisfiable witness hoặc impossibility receipt? |
| 13 | `conflict-of-interest-recusal-workbench` | Làm sao map interests vào matter parties rồi tái lập một impartial decision owner sau recusal? |
| 14 | `typeface-glyph-metrics-workbench` | Làm sao author glyph outline, metrics, anchors, kerning và shaping như một font system? |
| 15 | `multi-service-life-event-orchestrator` | Làm sao một canonical fact set fan-out đến nhiều dịch vụ tự trị nhưng vẫn giữ receipt riêng? |
| 16 | `service-accommodation-commitment-plan` | Làm sao map access needs vào journey barriers rồi cam kết ai cung cấp accommodation nào? |
| 17 | `flight-dispatch-release-workbench` | Làm sao reconcile route, weather, fuel, alternates và legality rồi lấy dispatcher/PIC co-release có amendment lineage? |
| 18 | `multi-payer-responsibility-coordinator` | Làm sao phân giải một charge qua coverage order và response chain để ra final responsibility? |
| 19 | `multi-creditor-hardship-plan-negotiator` | Làm sao negotiate nhiều creditor plans mà tổng commitments không vượt affordability envelope? |
| 20 | `interrupted-service-continuity-router` | Làm sao tiếp tục một task đang dở qua channel khác mà nói rõ state nào transfer được? |

## Cách chạy

1. Trước mọi planning, source read hoặc write, đọc hết `.claude/INDEX.md` và tuân load order của Source đang chạy.
2. Thực thi **đúng 20 prompt** trong tệp này. Mỗi prompt tạo đúng bốn source artifact tại boundary đã ghi: `en.md`, `vi.md`, `context.md`, `template.html`.
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

## Prompt 01 — `waitlist-offer-allocation-board`

- **Output boundary:** `archetypes/flow/waitlist-offer-allocation-board/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Allocate scarce openings from a waitlist by applying eligibility and priority rules, issuing time-bounded offers, recording responses, and recycling declined or expired capacity with a complete fairness trail.
- **Required region graph:** `allocation-board → capacity-pool-and-policy-version → eligible-ranked-waitlist → selected-candidate-rule-evidence → offer-slot-allocation → response-window-and-contact-delivery → accept-decline-expire → recycled-capacity-and-next-candidate → fairness-audit`; policy-backed allocation, not queue order alone, owns the outcome.
- **Wide:** Capacity pool, ranked waitlist, selected rule evidence and live offer/recycling rail remain visible.
- **Intermediate:** Ranked candidates and active offers remain primary; policy evidence and audit move to synchronized drawers.
- **Compact:** Capacity summary → next eligible candidate → rule explanation → issue offer → response/expiry → recycle or confirm; full waitlist is a filtered route.
- **State obligations:** capacity unknown/available/held/full, candidate eligible/ineligible/pending evidence, rank recalculating/stale, offer draft/sent/delivered/failed, accepted/declined/expired, duplicate hold, appeal and allocation audited.
- **Hard rejection:** Reject cho generic queue, appointment booking, inventory allocation or notification center; ranked eligibility policy, expiring offer lifecycle, capacity recycling and fairness proof are mandatory.
- **Research anchors:** `GOVUK-PATTERNS`, `USWDS-PATTERNS`, `WAI-STATUS`, `WAI-FOCUS`; add [NHS waiting times guidance](https://www.england.nhs.uk/rtt/) and [U.S. HUD tenant selection plans](https://www.hud.gov/hud-partners/multifamily-tenant-policy).
- **Acceptance focus:** Template must explain why one candidate is next, issue an expiring offer, recover failed delivery, recycle a declined slot and keep policy version plus allocation audit visible.

## Prompt 02 — `circular-sequence-construct-designer`

- **Output boundary:** `archetypes/work/circular-sequence-construct-designer/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Author and validate a circular biomolecular construct while keeping circular and linear sequence coordinates, features and constraints synchronized.
- **Required region graph:** `construct-designer → construct-identity-and-length → circular-projection ↔ linear-base-sequence → feature-register → selected-feature-coordinate-editor → sequence-constraint-and-conflict-ledger → validation-and-export`; the two isomorphic coordinate projections share one sequence authority.
- **Wide:** Circular map, linear sequence, selected feature editor and validation ledger remain linked and visible.
- **Intermediate:** One projection is primary through an explicit circular/linear switcher; feature register and validation remain adjacent.
- **Compact:** Linear coordinate owner → feature list → start/end/strand editor → circular overview → validation/export; all spatial movement has numeric and list alternatives.
- **State obligations:** sequence loading/empty, feature selected/overlapping/out-of-range, coordinate wraparound, strand changed, constraint pass/fail, unsaved conflict, validation stale and export success/failure.
- **Hard rejection:** Reject cho generic canvas inspector, genomic read inspector, diagram editor or text sequence viewer; reversible circular-linear coordinates, authored features and construct validation are mandatory.
- **Research anchors:** `WAI-DRAG`, `WAI-FOCUS`, `WAI-REFLOW`; add [SBOL 3 data model](https://sbolstandard.org/datamodel-specification/), [NCBI feature table](https://www.ncbi.nlm.nih.gov/genbank/feature_table/) and [W3C complex images](https://www.w3.org/WAI/tutorials/images/complex/).
- **Acceptance focus:** Template must edit a wraparound feature through numeric controls, highlight it in both projections, catch an overlap/constraint error and preserve coordinates through projection changes.

## Prompt 03 — `formal-proof-obligation-workbench`

- **Output boundary:** `archetypes/work/formal-proof-obligation-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Discharge formal proof obligations with tactics while tracking hypotheses, targets, generated subgoals and kernel-checkable verdicts.
- **Required region graph:** `proof-workbench → theorem-outline → obligation-stack → selected-local-context-and-target ↔ tactic-editor → proof-state-transition-ledger → successor-subgoals → kernel-verdict`; the transforming obligation graph owns progress.
- **Wide:** Theorem outline, current context/goal, tactic editor and transition/subgoal evidence remain visible.
- **Intermediate:** Outline becomes a proof-path breadcrumb; goal and editor keep a split while transition history becomes a drawer.
- **Compact:** Pending obligation → hypotheses → target → tactic input → resulting subgoals/verdict; the proof tree becomes current path plus pending branch count.
- **State obligations:** theorem loading, obligation pending/active/closed, tactic parsing/running/error, no progress, subgoals generated, context changed, kernel accepted/rejected and proof stale after edit.
- **Hard rejection:** Reject cho code playground, document editor, tree navigator or generic workflow; tactic-driven obligation transformation and kernel verdict are mandatory.
- **Research anchors:** `VSCODE-UX`, `WAI-TREEGRID`, `WAI-STATUS`, `WAI-FOCUS`; add [Lean tactic proofs](https://lean-lang.org/doc/reference/latest/Tactic-Proofs/) and [current Isabelle documentation](https://isabelle.in.tum.de/documentation.html).
- **Acceptance focus:** Template must apply a tactic, expose the exact before/after proof states, navigate generated subgoals, announce failure without stealing focus and end only on a kernel verdict.

## Prompt 04 — `orbital-conjunction-assessment-workbench`

- **Output boundary:** `archetypes/work/orbital-conjunction-assessment-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Assess a predicted orbital encounter and choose a mitigation using relative geometry, uncertainty, risk trend and rescreened maneuver evidence.
- **Required region graph:** `conjunction-assessment → event-queue → selected-event → relative-orbit-projection ↔ encounter-plane-covariance ↔ probability-and-risk-trend → maneuver-candidates → mandatory-rescreen-comparison → disposition-ledger`; one encounter binds three evidence projections and the rescreen loop.
- **Wide:** Event queue, orbit projection, encounter plane, risk trend and maneuver comparison remain linked.
- **Intermediate:** Encounter plane and risk trend remain primary; orbit becomes on-demand and candidates move to a drawer.
- **Compact:** Event dossier → risk facts/trend → tabular geometry/covariance → maneuver cards → rescreen comparison → disposition; no miniature 3D view is required.
- **State obligations:** event loading/stale, covariance missing/low-confidence, risk below/above threshold, trajectory update, candidate infeasible, rescreen pending/failure, collision risk reduced/increased and decision approved/escalated.
- **Hard rejection:** Reject cho map-led monitor, scenario sensitivity modeler, generic risk dashboard or 3D viewer; conjunction-specific projections and maneuver-to-rescreen loop are mandatory.
- **Research anchors:** `ESRI-LAYOUT`, `WAI-STATUS`, `WAI-REFLOW`; add [NASA CARA](https://www.nasa.gov/cara/training-materials-and-documentation/), [ESA collision avoidance](https://www.esa.int/Space_Safety/Space_Debris/Reentry_and_collision_avoidance) and [CCSDS CDM](https://ccsds.org/Pubs/508x0b1e2c2.pdf).
- **Acceptance focus:** Template must select an event, connect tabular and visual uncertainty evidence, compare pre/post-maneuver risk, block disposition before rescreen and offer a text equivalent for every projection.

## Prompt 05 — `well-to-well-liquid-transfer-programmer`

- **Output boundary:** `archetypes/work/well-to-well-liquid-transfer-programmer/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Program and verify coordinate-addressed liquid transfers while preserving source and destination volume, operation order, tip use and contamination constraints.
- **Required region graph:** `transfer-programmer → labware-and-reagent-setup → source-well-grid ↔ destination-well-grid → ordered-transfer-program → selected-transfer-volume-and-tip-policy → volume-and-contamination-validator → run-review-and-export`; transfers are executable conserved-quantity operations.
- **Wide:** Source and destination grids, selected transfer, ordered program and invariant ledger remain visible.
- **Intermediate:** Plate grids stack around the transfer program; connector arcs yield while coordinate labels remain explicit.
- **Compact:** Select source coordinates → select destinations → set volume/tip policy → review ordered operations → validate/run; persistent totals replace simultaneous miniature plates.
- **State obligations:** labware loading/mismatch, well empty/over-capacity, source insufficient, destination overflow, tip policy safe/unsafe, contamination conflict, operation reordered, validation stale, run blocked and export success.
- **Hard rejection:** Reject cho dual-list transfer, spreadsheet, generic workflow or sample lineage viewer; coordinate wells, conserved volumes, ordered executable operations and contamination validation are mandatory.
- **Research anchors:** `WAI-GRID`, `WAI-DRAG`, `WAI-STATUS`, `WAI-REFLOW`; add [ANSI/SLAS microplate standards](https://www.slas.org/resources/standards/ansi-slas-microplate-standards/) and [SiLA 2 specification](https://sila-standard.com/wp-content/uploads/2022/03/SiLA-2-Part-A-Overview-Concepts-and-Core-Specification-v1.1.pdf).
- **Acceptance focus:** Template must create transfers without drag, update both well volumes, catch overflow and tip-contamination conflicts, reorder with buttons and validate the final executable sequence.

## Prompt 06 — `memory-consistency-litmus-explorer`

- **Output boundary:** `archetypes/work/memory-consistency-litmus-explorer/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Determine whether a concurrent program outcome is permitted under a selected memory model and explain the ordering relation, read source or fence responsible.
- **Required region graph:** `litmus-explorer → litmus-program → per-thread-program-order-lanes → memory-model-selector → candidate-outcome-set → selected-outcome → happens-before-and-read-from-witness → rule-or-fence-explanation`; the set of legal executions owns navigation.
- **Wide:** Thread lanes, outcome matrix, selected relation witness and rule explanation remain linked.
- **Intermediate:** Thread lanes stack above outcomes; the selected witness opens beside them while model rules use a drawer.
- **Compact:** Outcome list → selected per-thread witness sequence → relations → satisfied/violated rule explanation; graph transforms to an accessible relation ledger.
- **State obligations:** program parsing/error, model loading, outcome allowed/forbidden/unknown, exploration running/partial, witness found/missing, relation cycle, fence added, result stale and share/export.
- **Hard rejection:** Reject cho distributed trace monitor, code runner, dependency graph or log viewer; multiple model-permitted executions, outcome set and formal ordering witness are mandatory.
- **Research anchors:** `VSCODE-UX`, `WAI-GRID`, `WAI-FOCUS`; add [RISC-V RVWMO](https://docs.riscv.org/reference/isa/unpriv/rvwmo.html), [Linux Kernel Memory Model litmus tests](https://docs.kernel.org/dev-tools/lkmm/docs/litmus-tests.html) and [W3C accessible tables](https://www.w3.org/WAI/tutorials/tables/).
- **Acceptance focus:** Template must switch models, classify an outcome, expose a textual read-from/happens-before witness, show how adding a fence changes legality and preserve the selected outcome.

## Prompt 07 — `stream-window-join-debugger`

- **Output boundary:** `archetypes/detail/stream-window-join-debugger/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Explain why events from two streams matched, failed to match or were dropped under join keys, event-time windows, watermarks and lateness rules.
- **Required region graph:** `join-debugger → join-definition-and-key → stream-a-event-time-lane ↔ stream-b-event-time-lane → window-and-watermark-overlay → output-and-unmatched-lane → selected-result-or-miss → causal-explanation-ledger`; two source clocks derive one verdict.
- **Wide:** Both input lanes, shared windows/watermarks, output lane and selected explanation remain visible.
- **Intermediate:** Input/output lanes stack on one event-time axis; explanation becomes a synchronized side drawer.
- **Compact:** Result or miss → A event → B event → key/window bounds → watermark/lateness → verdict; raw lanes transform to filtered event tables.
- **State obligations:** streams loading/partial, key match/mismatch, inside/outside window, watermark pending/passed, event on-time/late/dropped, output emitted/retracted, rule changed and explanation stale.
- **Hard rejection:** Reject cho event replay, distributed trace, generic timeline or log search; two independent event-time inputs, derived join membership and causal miss explanation are mandatory.
- **Research anchors:** `VSCODE-UX`, `WAI-STATUS`, `WAI-REFLOW`; add [Apache Flink stable JoinedStreams API](https://nightlies.apache.org/flink/flink-docs-stable/api/java/org/apache/flink/streaming/api/datastream/JoinedStreams.html), [Apache Beam windowing](https://beam.apache.org/documentation/basics/) and [W3C table tips](https://www.w3.org/WAI/tutorials/tables/tips/).
- **Acceptance focus:** Template must explain one match, one window miss and one watermark drop, keep clocks explicit in compact mode and update the witness when join rules change.

## Prompt 08 — `flow-cytometry-gating-workbench`

- **Output boundary:** `archetypes/work/flow-cytometry-gating-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Define and validate recursively nested cell populations from multivariate flow-cytometry measurements, with each gate inheriting its parent event set.
- **Required region graph:** `gating-workbench → sample-and-channel-selector → population-gating-hierarchy → selected-parent-population → scatter-or-density-projection ↔ gate-boundary-editor → derived-child-statistics → compensation-and-qc-rail`; recursive population inheritance owns the analysis.
- **Wide:** Gating hierarchy, selected projection/gate, child statistics and compensation/QC remain visible.
- **Intermediate:** Hierarchy becomes a drawer; projection remains primary and statistics/QC move below.
- **Compact:** Population breadcrumb → one projection → numeric threshold or point-list gate editor → child statistics → QC → next child; drawing is never the only input.
- **State obligations:** sample loading/empty, channel unavailable, parent population stale, gate draft/valid/invalid, compensation warning, too few events, child created/empty, QC pass/fail and export.
- **Hard rejection:** Reject cho media annotation, scatterplot viewer, generic tree editor or image segmentation; inherited population hierarchy, computed child events and gating QC are mandatory.
- **Research anchors:** `WAI-TREEGRID`, `WAI-DRAG`, `WAI-STATUS`; add [ISAC data standards](https://isac-net.org/data-standards/), [NIST flow-cytometry gating](https://www.nist.gov/mml/bbd/quantification-cells-specific-phenotypic-characteristics) and [MIFlowCyt recommendation](https://pmc.ncbi.nlm.nih.gov/articles/PMC2773297/).
- **Acceptance focus:** Template must create a child gate with numeric and keyboard alternatives, show inherited event counts, invalidate descendants after parent change and expose compensation/QC evidence.

## Prompt 09 — `audio-mix-routing-console`

- **Output boundary:** `archetypes/work/audio-mix-routing-console/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Route audio sources through buses and processors, balance channel parameters and automation, and validate the master output before mixdown.
- **Required region graph:** `mix-console → source-track-bank → signal-flow-routing-map ↔ channel-strip-bank → selected-channel-processing → automation-time-lanes → master-output-metering → delivery-validation-and-bounce`; the many-to-many signal path owns the mix.
- **Wide:** Routing map, channel bank, selected processing, bounded automation timeline and master output remain visible.
- **Intermediate:** Selected channel or bus group becomes primary; routing/processing use synchronized drawers and automation becomes an alternate mode.
- **Compact:** Channel or bus → explicit signal path → numeric/fader controls → processing/automation → master validation; every fader has keyboard and numeric parity.
- **State obligations:** session loading, route connected/broken/feedback-risk, channel muted/soloed/clipping, processor bypass/error, automation read/write/conflict, master safe/clipping, validation warning and bounce pending/failure.
- **Hard rejection:** Reject cho multi-track timeline editor, media player, generic node graph or monitoring mixer; many-to-many audio routing, channel/bus state and master delivery validation are mandatory.
- **Research anchors:** `WAI-DRAG`, `WAI-STATUS`, `WAI-FOCUS`; add [Apple Logic Pro mixing](https://support.apple.com/guide/logicpro/mixing-overview-lgcpbc219818/mac), [Avid Pro Tools signal routing](https://kb.avid.com/pkb/articles/en_US/How_To/en367979) and [ARIA slider](https://www.w3.org/WAI/ARIA/apg/patterns/slider/).
- **Acceptance focus:** Template must reroute a source, adjust a channel through keyboard/numeric controls, expose a feedback or clipping risk, edit one automation point and block bounce until master validation passes.

## Prompt 10 — `print-signature-imposition-planner`

- **Output boundary:** `archetypes/work/print-signature-imposition-planner/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Transform logical reading-order pages into press sheets and signatures whose front/back placement, folding, binding, creep and blanks produce the intended publication.
- **Required region graph:** `imposition-planner → publication-page-order → binding-stock-press-constraints → signature-plan → sheet-front-back-stage ↔ fold-bind-simulation → creep-bleed-marks-inspector → pagination-exception-ledger → imposed-output`; reversible reading-to-physical-order transformation owns the page.
- **Wide:** Logical page strip, signature navigator, selected sheet front/back, fold simulation and constraints remain visible.
- **Intermediate:** Signature navigation becomes a drawer; selected sheet and reconstructed result stay synchronized while constraints use a side sheet.
- **Compact:** Signature → sheet front/back → fold sequence → reconstructed reading order → exception resolution → output; no wall of printer spreads is required.
- **State obligations:** document loading, page count incompatible, blank inserted, signature valid/invalid, side front/back, fold mismatch, creep/bleed warning, reconstruction pass/fail and output pending.
- **Hard rejection:** Reject cho print preflight, packing optimizer, generic page sorter or document preview; signature grouping plus front/back fold/bind reconstruction are mandatory.
- **Research anchors:** `WAI-REFLOW`, `WAI-FOCUS`, `APPLE-LAYOUT`; add [Adobe booklet imposition](https://helpx.adobe.com/indesign/desktop/print/print-booklets/impose-documents-for-booklet-printing.html) and [Adobe booklet settings](https://helpx.adobe.com/indesign/desktop/print/print-booklets/booklet-printing-settings.html).
- **Acceptance focus:** Template must create signatures, toggle sheet sides, simulate fold/bind, expose a pagination exception and prove reconstructed reading order before output.

## Prompt 11 — `simultaneous-interpretation-channel-console`

- **Output boundary:** `archetypes/work/simultaneous-interpretation-channel-console/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Maintain live language-channel coverage by assigning primary and backup interpreters, managing direction and relay paths, and handing channels over without losing the floor feed.
- **Required region graph:** `interpretation-console → floor-speaker-feed → language-channel-matrix ↔ interpreter-booth-roster → primary-backup-relay-routes → active-channel-health → handoff-and-incident-controls → listener-coverage-and-session-log`; human language coverage owns routing.
- **Wide:** Floor feed, channel matrix, interpreter roster, relay paths and health/incident rail coexist.
- **Intermediate:** Active channel becomes primary; full matrix and roster move to synchronized drawers while floor language persists.
- **Compact:** Channel list → channel direction/feed → interpreter and relay assignment → health → handoff/incident; operator and interpreter views preserve role-specific controls.
- **State obligations:** session offline/live/ended, floor language known/unknown, channel covered/degraded/uncovered, interpreter active/break/unavailable, relay valid/broken, handoff pending/accepted, listener issue and session log failure.
- **Hard rejection:** Reject cho facilitated meeting, localization workbench, audio mix console or generic roster; language-pair ownership, human relay, coverage health and live handoff are mandatory.
- **Research anchors:** `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`; add [Microsoft Teams interpretation](https://support.microsoft.com/en-us/teams/meetings/use-language-interpretation-in-microsoft-teams-meetings) and [Zoom language interpretation](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0064768).
- **Acceptance focus:** Template must assign primary/backup interpreters, configure a relay, surface uncovered language, complete a handoff and announce health changes without moving focus.

## Prompt 12 — `constraint-solver-unsat-core-explorer`

- **Output boundary:** `archetypes/work/constraint-solver-unsat-core-explorer/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Explain why one constraint model has no solution, isolate minimal conflicting constraint sets, test explicit relaxations and produce either a satisfiable witness or an impossibility receipt.
- **Required region graph:** `unsat-explorer → model-version-and-solve-context → variable-domain-register ↔ constraint-dependency-graph → solve-result-and-core-set → selected-core-constraint-provenance → relaxation-candidates-and-counterfactuals → rerun-witness-or-impossibility-receipt`; minimal conflict proof and counterfactual relaxation are peer owners.
- **Wide:** Constraint graph, core set, selected provenance and relaxation/witness comparison remain simultaneous.
- **Intermediate:** Core list and selected provenance remain primary; graph and candidate relaxations become synchronized panes while solve context persists.
- **Compact:** Failed solve → one core → implicated constraints/provenance → choose relaxation → rerun → witness or receipt; graph becomes an accessible relation/path ledger.
- **State obligations:** parse/compile failure, solve sat/unsat/unknown, core unavailable/nonminimal/multiple, source mapping missing, relaxation valid/unsafe, rerun pending/timeout, witness found and impossibility receipt issued.
- **Hard rejection:** Reject cho `configuration-dependency-resolver`, `formal-proof-obligation-workbench`, rule/query builder or generic error list; solver-derived minimal conflicting cores, source provenance, counterfactual relaxation and rerun witness are mandatory—not a hand-authored resolution set or kernel proof goal.
- **Research anchors:** `VSCODE-UX`, `WAI-FOCUS`, `WAI-REFLOW`, `WAI-STATUS`; add the [Microsoft Z3 Guide](https://microsoft.github.io/z3guide/docs/logic/basiccommands/), [MiniZinc FindMUS](https://docs.minizinc.dev/en/latest/find_mus.html) and [SMT-LIB current standard](https://smt-lib.org/language.shtml).
- **Acceptance focus:** Template must expose at least two cores, trace a constraint to source, preview a relaxation, rerun to a witness or receipt and preserve core/constraint/focus identity across topology changes.

## Prompt 13 — `conflict-of-interest-recusal-workbench`

- **Output boundary:** `archetypes/work/conflict-of-interest-recusal-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Determine whether a participant may act on a specific matter, connect disclosed interests to affected parties, and install recusal, screening or replacement ownership.
- **Required region graph:** `recusal-workbench → matter-and-party-scope → participant-roster → disclosure-interest-relationship-map ↔ selected-person-matter-analysis → actual-apparent-potential-classification → recusal-restriction-or-screening → replacement-independent-owner → acknowledgement-and-audit`; impartial ownership must be reconstructed.
- **Wide:** Matter/participants, relationship evidence, conflict analysis and recusal/replacement arrangement remain visible.
- **Intermediate:** Participant roster becomes a drawer; selected analysis remains primary and mitigation/replacement uses a side sheet.
- **Compact:** Participant → disclosures/relationships → classification → recusal/screening plan → replacement owner → acknowledgement; sticky status yields to focused controls.
- **State obligations:** matter loading, disclosure missing/verified, relationship direct/indirect/uncertain, conflict none/potential/apparent/actual, recusal proposed/accepted, screen incomplete, replacement unavailable, acknowledgement pending and audit locked.
- **Hard rejection:** Reject cho access-conflict resolver, case dossier, declaration form or approval routing; private-interest-to-matter mapping and restoration of an independent decision owner are mandatory.
- **Research anchors:** `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`; add [OECD conflict-of-interest guidelines](https://legalinstruments.oecd.org/public/doc/130/body-text.en.html) and [U.S. OGE screening arrangements](https://www.oge.gov/Web/OGE.nsf/0/A633CAF20D2571F5852585BA005BED3D/%24FILE/DO-04-012.pdf).
- **Acceptance focus:** Template must trace a disclosure to matter parties, classify the conflict with evidence, install recusal/screening, require a replacement owner and record acknowledgement without exposing restricted interests.

## Prompt 14 — `typeface-glyph-metrics-workbench`

- **Output boundary:** `archetypes/work/typeface-glyph-metrics-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Author a coherent font repertoire by reconciling glyph outlines, anchors and metrics with pair or class spacing, shaping tests and whole-font specimen proof.
- **Required region graph:** `typeface-workbench → glyph-repertoire-grid → selected-glyph-outline-editor ↔ metrics-and-anchor-inspector → kerning-pair-or-class-editor → script-shaping-test-runs → specimen-proof → font-validation-and-export`; repertoire and contextual relationships own validation.
- **Wide:** Glyph repertoire, outline editor, metrics inspector and bounded kerning/shaping/specimen regions remain visible.
- **Intermediate:** Repertoire becomes a drawer; outline stays primary while metrics, pair tests and proof become synchronized tabs.
- **Compact:** Glyph selector → outline editor → numeric metrics/anchors → pair or shaping test → specimen/validation; point movement has coordinate and keyboard alternatives.
- **State obligations:** font loading, glyph missing/draft/complete, contour open/invalid, metric conflict, anchor missing, pair override/class conflict, shaping pass/fail, specimen stale and export warning/failure.
- **Hard rejection:** Reject cho generic canvas inspector, vector editor, asset grid or typography settings; glyph repertoire, contextual pair/shaping relations and compiled font validation are mandatory.
- **Research anchors:** `WAI-GRID`, `WAI-DRAG`, `WAI-FOCUS`; add [Microsoft OpenType kerning](https://learn.microsoft.com/en-us/typography/opentype/spec/kern), [Apple TrueType reference](https://developer.apple.com/fonts/TrueType-Reference-Manual/index.html) and [W3C non-text content](https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html).
- **Acceptance focus:** Template must edit a glyph through coordinate controls, update metrics, inspect a kerning pair and shaping run, expose a validation failure and update the specimen from the same source.

## Prompt 15 — `multi-service-life-event-orchestrator`

- **Output boundary:** `archetypes/flow/multi-service-life-event-orchestrator/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Orchestrate a life event across multiple autonomous services by collecting one canonical fact set, deriving service-specific submissions, tracking independent decisions and reconciling the overall outcome.
- **Required region graph:** `life-event-orchestrator → event-person-and-authority → canonical-fact-register → affected-service-map → service-specific-requirement-deltas → submissions-and-consents ×n → independent-status-and-receipts → unresolved-obligation-summary → event-closure`; shared facts fan out without collapsing service authority.
- **Wide:** Canonical facts, affected services, selected requirement delta and multi-service status/receipt rail remain visible.
- **Intermediate:** Service map and unresolved deltas remain primary; canonical facts and receipts become synchronized drawers.
- **Compact:** Event summary → affected service list → selected service delta/submission → receipt/status → next unresolved service → overall closure; facts are entered once and reviewed where transformed.
- **State obligations:** event draft/verified, fact missing/conflicting/stale, service applicable/not-applicable, requirement satisfied/gap, consent needed/withdrawn, submission pending/rejected/accepted, receipt missing and overall closure partial/complete.
- **Hard rejection:** Reject cho `multi-program-eligibility-screening`, service hub, multi-step form, case management or generic workflow; one canonical fact authority must fan into multiple autonomous service-specific submissions, handoffs and receipts—side-by-side eligibility verdicts without execution are insufficient.
- **Research anchors:** `GOVUK-PATTERNS`, `USWDS-PATTERNS`, `WAI-STATUS`, `WAI-FOCUS`; add [GOV.UK joined-up services](https://www.gov.uk/service-manual/service-standard/point-3-join-up-across-channels) and [EU Single Digital Gateway once-only principle](https://digital-strategy.ec.europa.eu/en/policies/once-only-principle).
- **Acceptance focus:** Template must reuse canonical facts across at least three services, expose a service-specific delta, track independent receipts, handle one rejection and close only after remaining obligations are explicit.

## Prompt 16 — `service-accommodation-commitment-plan`

- **Output boundary:** `archetypes/flow/service-accommodation-commitment-plan/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Create an actionable service accommodation plan by mapping a person's access needs to journey-specific barriers, selecting accommodations, and recording reciprocal provider and user commitments.
- **Required region graph:** `accommodation-plan → person-preferences-and-consent → service-journey-step-map → access-need-by-barrier-matrix → accommodation-options-and-feasibility → provider-commitments ↔ user-commitments → exception-escalation → confirmed-plan-and-review`; commitments are bound to concrete journey barriers.
- **Wide:** Journey steps, need/barrier matrix, selected accommodation and commitment rail remain visible.
- **Intermediate:** Journey/barrier map remains primary; preferences and commitment details move to drawers.
- **Compact:** Journey step → barrier → preferred accommodation → provider/user commitment → exception → plan review; matrix becomes grouped accessible lists.
- **State obligations:** preference unknown/restricted, barrier identified/unverified, accommodation available/unavailable, feasibility pending, provider owner missing, user commitment declined, exception escalated, plan confirmed/stale and review due.
- **Hard rejection:** Reject cho profile settings, accessibility checklist, care plan or generic task list; need-to-journey-barrier mapping and reciprocal operational commitments are mandatory.
- **Research anchors:** `VA-PATTERNS`, `NHS-PATTERNS`, `WAI-FOCUS`, `WAI-REFLOW`; add [NHS Accessible Information Standard](https://www.england.nhs.uk/accessible-information-standard/) and [U.S. ADA effective communication](https://www.ada.gov/resources/effective-communication/).
- **Acceptance focus:** Template must map multiple needs to journey barriers, compare feasible accommodations, assign provider ownership, record user preference/consent and escalate one unavailable commitment.

## Prompt 17 — `flight-dispatch-release-workbench`

- **Output boundary:** `archetypes/flow/flight-dispatch-release-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Prepare or amend one regulated flight release by reconciling route, weather/NOTAM, aircraft performance, crew, fuel and alternates, then obtaining dispatcher and pilot-in-command concurrence.
- **Required region graph:** `release-workbench → flight-identity-and-operating-window → route-and-leg-plan ↔ weather-NOTAM-hazard-overlay → aircraft-performance-and-fuel-alternate-ledger → MEL-deferment-and-legality-impact → release-validity-gate → dispatcher-concurrence ↔ pilot-in-command-concurrence → issued-release-and-amendment-lineage`; live operational legality, paired authority and re-release lineage jointly own the result.
- **Wide:** Route/hazard strip, performance/fuel/alternate ledger, deferment impacts, validity gate and both concurrence owners remain visible.
- **Intermediate:** Selected release scenario and validity gate stay primary; route/hazard and performance/legality sources alternate without hiding concurrence state.
- **Compact:** Flight → route hazard → performance/fuel/alternate → MEL or legality exception → validity → dispatcher concurrence → PIC concurrence → issue/amend; blocker-first evidence replaces any miniature route map.
- **State obligations:** plan loading/stale, route accepted/restricted, weather or NOTAM clear/blocking, aircraft performance sufficient/insufficient, fuel valid/short, alternate required/invalid, MEL compatible/blocking, validity pass/fail, concurrence pending/declined/signed, release issued/expired and amendment superseding.
- **Hard rejection:** Reject cho route itinerary, estimate calculator, evidence dossier, permit-to-work or generic approval flow; coupled route hazard, performance/fuel legality, dispatcher↔PIC co-release and amendment/re-release lineage are mandatory.
- **Research anchors:** `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`; add [FAA AC 120-126A](https://www.faa.gov/media/92696), [FAA Flight Planning Information](https://www.faa.gov/about/office_org/headquarters_offices/ato/service_units/air_traffic_services/flight_plan_filing) and [EASA Easy Access Rules for Air Operations](https://www.easa.europa.eu/en/document-library/easy-access-rules/online-publications/easy-access-rules-air-operations).
- **Acceptance focus:** Template must make one weather, MEL or fuel change invalidate the release, select a viable alternate, require both independent concurrences, issue a superseding amendment and retain exact release context across every responsive topology.

## Prompt 18 — `multi-payer-responsibility-coordinator`

- **Output boundary:** `archetypes/flow/multi-payer-responsibility-coordinator/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Coordinate responsibility for a charge across multiple payers by establishing coverage order, submitting evidence, applying each adjudication and reconciling the remaining balance.
- **Required region graph:** `payer-coordinator → charge-and-service-ledger → coverage-and-coordination-order → payer-submission-chain → selected-payer-evidence-and-response → allowed-paid-denied-adjustment-ledger → remainder-and-next-payer → final-responsibility-and-appeal`; sequential adjudications conserve the charge.
- **Wide:** Charge ledger, payer order, selected response and conserved responsibility summary remain visible.
- **Intermediate:** Payer chain and remainder summary remain primary; detailed evidence/response becomes a drawer.
- **Compact:** Charge → coverage order → payer submission/response → adjusted remainder → next payer → final responsibility/appeal; amounts remain explicit at every step.
- **State obligations:** charge pending/final, coverage active/unknown/conflicting, order unresolved, submission draft/sent/rejected, response partial/denied/paid, duplicate payment, adjustment invalid, remainder mismatch and appeal pending.
- **Hard rejection:** Reject cho invoice detail, claim form, payment split or line-item dispute; ordered multi-payer adjudication and conserved allowed/paid/remaining responsibility are mandatory.
- **Research anchors:** `HL7-FHIR`, `CARBON-TABLE`, `WAI-STATUS`, `WAI-FOCUS`; add [CMS coordination of benefits](https://www.cms.gov/medicare/coordination-benefits-recovery/overview) and [HL7 FHIR ExplanationOfBenefit](https://hl7.org/fhir/explanationofbenefit.html).
- **Acceptance focus:** Template must apply at least two payer responses in order, explain a denial/adjustment, prevent amount imbalance, route remainder correctly and preserve appeal evidence.

## Prompt 19 — `multi-creditor-hardship-plan-negotiator`

- **Output boundary:** `archetypes/flow/multi-creditor-hardship-plan-negotiator/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Negotiate a sustainable hardship plan across multiple creditors by proving an affordability envelope, comparing offers and counters, and guarding the combined commitment schedule.
- **Required region graph:** `hardship-negotiator → verified-income-essential-cost-and-affordability → creditor-obligation-register → creditor-offers-and-counters ×n → global-commitment-envelope → scenario-and-priority-tradeoffs → selected-multi-creditor-plan → agreements-schedule-and-review`; global affordability constrains every local deal.
- **Wide:** Affordability evidence, creditor register, offer/counter workspace and global commitment ledger remain visible.
- **Intermediate:** Creditor offers and global envelope remain primary; detailed evidence and scenarios become drawers.
- **Compact:** Affordability summary → creditor → offer/counter → global impact → next creditor → combined schedule/review; each acceptance revalidates the envelope.
- **State obligations:** evidence missing/verified, obligation disputed, creditor contacted/no-response, offer proposed/countered/accepted/expired, envelope safe/exceeded, priority conflict, agreement pending, payment schedule active and review due.
- **Hard rejection:** Reject cho budgeting, debt list, single settlement or generic negotiation chat; multiple independent creditor offers constrained by one verified affordability envelope are mandatory.
- **Research anchors:** `GOVUK-PATTERNS`, `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`; add [CFPB debt collection resources](https://www.consumerfinance.gov/consumer-tools/debt-collection/) and [MoneyHelper debt advice](https://www.moneyhelper.org.uk/en/money-troubles/dealing-with-debt).
- **Acceptance focus:** Template must model at least three creditors, counter one offer, reject a combined overcommitment, produce a sustainable schedule and retain evidence plus agreement provenance.

## Prompt 20 — `interrupted-service-continuity-router`

- **Output boundary:** `archetypes/support/interrupted-service-continuity-router/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Preserve an unfinished user task when its primary service channel becomes unavailable, select an alternate channel that supports the remaining operations and access needs, and transfer reusable state with a continuity handoff.
- **Required region graph:** `continuity-router → disruption-scope-and-authority → interrupted-task-state → remaining-operation-and-access-constraints → alternative-channel-capability-register → state-transfer-compatibility → selected-continuity-route → handoff-token-and-commitments → restoration-reconciliation`; unfinished task state and transfer boundary own routing.
- **Wide:** Interrupted-task state, alternate-channel capability comparison and transfer/handoff detail remain visible.
- **Intermediate:** Current task and viable channels own the workspace; disruption scope becomes a drawer while transfer limitations stay adjacent.
- **Compact:** Saved task position → viable alternate routes → what transfers versus repeats → handoff token/instructions → completion or restoration reconciliation.
- **State obligations:** channel healthy/degraded/unavailable, task state saved/partial/lost, alternate available/inaccessible/full, transfer compatible/partial/impossible, handoff pending/accepted/expired, restoration detected and reconciliation conflict/complete.
- **Hard rejection:** Reject cho `communication-delivery-recovery-center`, stable service hub, outage dashboard, completed handoff or support contact page; preserved in-progress task state, destination capability/compatibility and explicit warm-transfer payload acceptance are mandatory—message-channel delivery evidence and fallback attempts are outside the owner graph.
- **Research anchors:** `GOVUK-PATTERNS`, `NHS-PATTERNS`, `WAI-STATUS`, `WAI-REFLOW`; add [GOV.UK joined-up channels](https://www.gov.uk/service-manual/service-standard/point-3-join-up-across-channels), [FEMA Continuity Guidance](https://www.fema.gov/sites/default/files/documents/fema_continuity-guidance-circular_082024.pdf) and [NHS Accessible Information Standard](https://www.england.nhs.uk/accessible-information-standard/).
- **Acceptance focus:** Template must preserve a saved task position, filter alternate channels by operation and access needs, disclose non-transferable evidence, issue an accessible handoff and reconcile later completion/restoration.
