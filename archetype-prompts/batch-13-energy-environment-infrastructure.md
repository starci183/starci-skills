# Batch 13 — Energy, environment and infrastructure archetypes (20 prompts)

Tệp này là **một prompt batch tự chứa** cho power-system operations, water and transport infrastructure, climate adaptation, environmental accounting và circular resource intervention surfaces. Khi chạy ở nơi khác, đưa toàn bộ tệp cho agent để tạo đủ 20 leaf. Nếu chỉ chạy một mục, phải đưa kèm toàn bộ phần từ `Cách chạy` đến `Nguồn research dùng chung`; không tách riêng block prompt khỏi hợp đồng chung.

## Mục lục

| # | Archetype ID | Câu hỏi bố cục chính |
|---:|---|---|
| 01 | `power-system-protection-coordination-workbench` | Làm sao điều chỉnh protection devices để mọi fault được cô lập theo đúng thứ tự và coordination margin? |
| 02 | `grid-outage-restoration-switching-board` | Làm sao tái lập energized islands qua switching steps đã kiểm chứng mà không phá clearance hoặc stability? |
| 03 | `security-constrained-grid-dispatch-workbench` | Làm sao cân demand bằng feasible dispatch rẻ nhất khi bids, ramps, reserves và network contingencies cùng ràng buộc? |
| 04 | `distributed-energy-interconnection-study-workbench` | Làm sao quyết định một DER project tại đúng point of interconnection qua screens, study cases và upgrade conditions? |
| 05 | `prescribed-fire-ignition-window-control-planner` | Làm sao mở, dùng và đóng một ignition window qua các burn block khi prescription, smoke, holding resources và test-fire gate cùng ràng buộc? |
| 06 | `power-grid-state-estimation-residual-workbench` | Làm sao suy ra một grid state đáng tin từ topology và telemetry rồi truy residual về bad measurement hoặc model error? |
| 07 | `water-network-leak-isolation-recovery-workbench` | Làm sao chọn valve cut set cô lập leak, giới hạn service impact rồi flush, test và repressurize an toàn? |
| 08 | `reservoir-release-rule-curve-coordinator` | Làm sao biến forecast, guide curve và prioritized rules thành release schedule không vi phạm downstream constraints? |
| 09 | `stormwater-catchment-control-planner` | Làm sao đặt distributed controls trong catchment để giảm surcharge, outfall peak và pollutant load dưới design storms? |
| 10 | `rail-possession-access-planner` | Làm sao khóa một track possession có limits, protection, worksites và engineering trains rồi hand back đúng authority? |
| 11 | `bridge-defect-load-rating-workbench` | Làm sao nối một defect đo được vào section capacity, controlling load case và posting hoặc repair decision? |
| 12 | `earthwork-cut-fill-mass-haul-planner` | Làm sao nối cut sources với fill demands dọc alignment qua material suitability, balance points, haul limits, borrow và waste? |
| 13 | `building-retrofit-measure-bundle-modeler` | Làm sao bundle retrofit measures có interactions rồi so energy, cost, carbon, comfort và verification plan? |
| 14 | `greenhouse-gas-inventory-consolidation-workbench` | Làm sao hợp nhất activity data qua entity boundary, scopes, factors và eliminations thành một inventory có thể verify? |
| 15 | `product-life-cycle-impact-assessment-workbench` | Làm sao biến functional unit và process inventory thành impact categories, hotspots và interpretation có method lineage? |
| 16 | `industrial-symbiosis-exchange-planner` | Làm sao ghép output stream của một cơ sở vào input need của cơ sở khác qua compatibility, logistics và residual balance? |
| 17 | `contaminated-site-linkage-remediation-workbench` | Làm sao chứng minh source–pathway–receptor linkages rồi chọn remedy thực sự bẻ gãy đúng exposure paths? |
| 18 | `urban-heat-equity-intervention-planner` | Làm sao đặt cooling interventions nơi exposure, vulnerability và access gap giao nhau rồi chứng minh equity gain? |
| 19 | `materials-disassembly-recovery-sequence-planner` | Làm sao tạo disassembly order từ joints, hazards và dependencies để tối đa reuse, remanufacture và recovery yield? |
| 20 | `groundwater-wellfield-pumping-allocation-workbench` | Làm sao phân bổ pumping theo well và time khi drawdown cones, streams, subsidence và water-quality thresholds tương tác? |

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

## Prompt 01 — `power-system-protection-coordination-workbench`

- **Output boundary:** `archetypes/work/power-system-protection-coordination-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Configure and validate protective-device settings so every modeled electrical fault follows one nested primary-to-backup trip path, every adjacent device pair preserves its required selectivity margin and the complete fault set remains coordinated after any change.
- **Required region graph:** `protection-coordination → one-line-and-study-case → fault-location-and-nested-primary-backup-trip-paths → protection-zone-and-device-chain ↔ time-current-selectivity-view → selected-device-settings → adjacent-pair-selectivity-margin-ledger → all-fault-sweep-and-miscoordination-queue → approved-setting-package`; each fault owns an ordered nested trip chain, each chain owns pairwise margin checks and only the all-fault sweep may approve the shared package.
- **Wide:** One-line topology, selected nested trip path, time-current evidence, settings editor, pairwise margin ledger and all-fault sweep status remain simultaneously visible.
- **Intermediate:** The selected fault path and active primary-backup pair remain primary; other pair curves, setting provenance and the sweep queue move to synchronized drawers without changing the fault context.
- **Compact:** Study case → fault location → nested device chain → one adjacent primary-backup pair → curve and numeric margin evidence → setting change → every remaining pair on the path → all-fault sweep → approve or rollback; the whole one-line becomes a semantic trip-path route rather than stacked desktop regions.
- **State obligations:** model loading/invalid, study case current/stale, fault calculated/failed, trip path complete/ambiguous, device in-service/bypassed/unknown, primary-backup pair coordinated/marginal/miscoordinated, setting draft/invalid/pending approval, sweep queued/running/partial/complete/regressed and package approved/rejected/rolled back.
- **Hard rejection:** Reject cho `dependency-topology-monitor`, `rule-builder-workbench`, constrained allocation, traffic-signal timing or a generic one-line viewer; nested electrical fault paths, protection zones, time-current or equivalent selectivity evidence, pairwise margins across every adjacent device and one all-fault validation sweep are mandatory.
- **Research anchors:** `FLUENT-LAYOUT`, `CARBON-TABLE`, `WAI-DRAG`, `WAI-FOCUS`, `WAI-STATUS`; add [NERC PRC-027-1](https://www.nerc.com/standards/reliability-standards/prc/prc-027-1) and [DOE integrated distribution system planning](https://www.energy.gov/oe/integrated-distribution-system-planning).
- **Acceptance focus:** Template must select a fault, traverse at least three nested primary/backup devices, expose numeric margin for every adjacent pair, edit one setting through labeled controls, reveal a regression on another fault during the complete sweep and restore the prior approved package.

## Prompt 02 — `grid-outage-restoration-switching-board`

- **Output boundary:** `archetypes/flow/grid-outage-restoration-switching-board/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Restore a de-energized power system by selecting black-start sources, extending verified cranking paths into explicit energized islands and executing only switching steps that survive worker-clearance and grounding vetoes.
- **Required region graph:** `restoration-board → outage-boundary-and-control-authority → deenergized-network-topology → black-start-source-and-cranking-load-register → source-to-cranking-load-path-graph → candidate-energized-island-boundaries → ordered-switching-plan ↔ clearance-tag-ground-and-work-party-veto-register → current-step-command → telemetry-and-field-verification → derived-energized-island-topology → critical-load-restoration-and-as-operated-log`; a verified step extends exactly one cranking path or joins two eligible islands, while any active clearance on its impact cone vetoes issuance.
- **Wide:** De-energized/current island topology, selected cranking path, switching plan, clearance-veto register, active command and electrical verification remain simultaneously visible.
- **Intermediate:** The active island boundary, current cranking path and next step remain primary; alternate sources, other islands, full clearance evidence and as-operated history become synchronized routes.
- **Compact:** Black-start source → next cranking-path segment → target island boundary or cranking load → clearance/ground impact cone → issue or hold → voltage/frequency/field proof → derived island topology → next path segment; the network transforms into one executable path spine plus an island switcher, not a stack of topology cards.
- **State obligations:** topology unknown/deenergized/partially energized/restored, black-start source unavailable/starting/stable, cranking path blocked/open/energized, island proposed/forming/stable/unstable/joinable, clearance active/released/conflicting, switching step planned/vetoed/authorized/issued/failed/verified, telemetry stale/disagreeing, unexpected energization, rollback/hold and restoration transfer complete.
- **Hard rejection:** Reject cho `live-operations-command-center`, `dependency-topology-monitor`, `guided-setup-checklist` or `permit-to-work-isolation-control-room`; black-start sources, source-to-cranking-load paths, explicit island boundaries, clearance-veto topology, stepwise electrical verification and derived energized islands are mandatory.
- **Research anchors:** `ESRI-LAYOUT`, `CARBON-TABLE`, `WAI-FOCUS`, `WAI-OBSCURED`, `WAI-STATUS`; add [NERC EOP-005-3](https://www.nerc.com/globalassets/standards/reliability-standards/eop/eop-005-3.pdf), [OSHA 1910.269](https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.269) and [PJM Manual 36 — System Restoration](https://learn.pjm.com/-/media/DotCom/documents/manuals/m36.ashx).
- **Acceptance focus:** Template must start one black-start source, extend a cranking path into an island, block a tempting switch through an active clearance impact cone, clear and authorize the corrected step, prove voltage/frequency plus field state and update the island boundary only after verification.

## Prompt 03 — `security-constrained-grid-dispatch-workbench`

- **Output boundary:** `archetypes/work/security-constrained-grid-dispatch-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Produce and explain one feasible operating-interval dispatch whose injection-withdrawal equation balances at every modeled node, whose resource and reserve limits hold in the base case and required contingencies, and whose congestion consequences trace to exact binding elements.
- **Required region graph:** `grid-dispatch → operating-interval-state-estimate-and-network-version → node-injection-withdrawal-balance-ledger ↔ resource-offer-ramp-capacity-and-reserve-register → base-and-contingency-branch-flow-constraint-cube → feasible-resource-and-load-dispatch → nodal-balance-and-reserve-receipt → binding-element-contingency-and-congestion-attribution → nodal-price-and-resource-impact-explanation → approve-publish-and-rerun`; nodal conservation owns feasibility, while each congestion component names the contingency, monitored element and affected nodes/resources that caused it.
- **Wide:** Nodal balance ledger, resource limits, base/contingency constraint cube, dispatch solution, reserve receipt and congestion attribution remain simultaneously inspectable.
- **Intermediate:** Dispatch quantities, selected node and binding element-contingency pair remain primary; complete topology, offers and other contingency cases move to contextual routes while causal attribution stays synchronized.
- **Compact:** Operating interval → unbalanced node or binding element-contingency pair → contributing injections/withdrawals and resource limits → corrective redispatch → nodal and reserve receipt → congestion attribution → publish or rerun; node/resource matrices transform into one causal constraint path with scoped lists.
- **State obligations:** state estimate loading/stale/invalid, node balanced/unbalanced, demand forecast current/revised, offer accepted/mitigated/unavailable, resource ramp- or capacity-limited, contingency pending/active/invalid, monitored element within/binding/exceeded, solve queued/running/infeasible/feasible, reserve shortfall, congestion attribution complete/disputed, dispatch published/superseded and manual intervention audited.
- **Hard rejection:** Reject cho `capacity-allocation-overview`, `scenario-sensitivity-modeler`, `market-depth-order-entry-monitor` or generic live operations; simultaneous nodal balance, base-and-contingency network constraints, dispatchable resource limits, reserve receipt and element-plus-contingency congestion attribution are mandatory.
- **Research anchors:** `CARBON-TABLE`, `FLUENT-LAYOUT`, `WAI-GRID`, `WAI-STATUS`, `WAI-FOCUS`; add [FERC 2024 Energy Primer](https://www.ferc.gov/media/energy-primer-handbook-energy-market-basics), [PJM Manual 11](https://learn.pjm.com/pjmfiles/directory/manuals/m11/index.html) and [NERC BAL-002-3](https://www.nerc.com/standards/reliability-standards/bal/bal-002-3).
- **Acceptance focus:** Template must alter one resource limit, expose a binding monitored-element/contingency pair, rebalance affected nodes through a feasible redispatch, prove system and reserve conservation, attribute one congestion component to that exact pair and retain the superseded interval solution.

## Prompt 04 — `distributed-energy-interconnection-study-workbench`

- **Output boundary:** `archetypes/work/distributed-energy-interconnection-study-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Determine whether one distributed-energy project can interconnect at one feeder point by traversing the mandated screen order, running only the study cases unlocked by prior outcomes and resolving every violating feeder-element-by-case cell through a tested condition or upgrade.
- **Required region graph:** `interconnection-study → project-export-envelope-and-rule-version → point-of-interconnection → ordered-source-to-feeder-point-element-path ↔ model-input-completeness → ordered-technical-screen-gates → unlocked-study-case-set → feeder-element-by-case-violation-matrix → selected-cell-electrical-evidence → mitigation-or-upgrade-and-rerun → cost-schedule-owner-and-conditional-verdict → agreement-conditions-and-model-receipt`; screen order controls case eligibility, while the matrix preserves the exact feeder element and operating case behind every condition.
- **Wide:** Feeder-point path, ordered screen gates, element×case violation matrix, selected evidence, mitigation rerun and conditional verdict remain simultaneously visible.
- **Intermediate:** The current screen or selected element×case violation remains primary; feeder context, complete case matrix, input manifest and agreement conditions move to synchronized routes.
- **Compact:** Project envelope → feeder point and ordered element path → next required screen → unlocked study case → violating element×case cell → mitigation/rerun → owner and condition → verdict; the map becomes a feeder-path sequence and the matrix becomes a scoped case route rather than stacked tables.
- **State obligations:** application incomplete/ready/withdrawn, feeder model current/stale/restricted, screen locked/not-required/queued/running/pass/fail/indeterminate, study case locked/nonconvergent/complete, element×case cell within/violating/waived, mitigation untested/validated, upgrade estimate draft/accepted/disputed, restudy triggered and agreement issued/expired.
- **Hard rejection:** Reject cho `waitlist-offer-allocation-board`, `regulatory-filing-package-validator`, `jurisdiction-authority-resolution` or generic hosting-capacity map; a point-specific ordered feeder path, prerequisite screen cascade, element×case violation matrix, tested mitigation rerun and owned engineering condition are mandatory.
- **Research anchors:** `ESRI-LAYOUT`, `CARBON-TABLE`, `WAI-REFLOW`, `WAI-FOCUS`, `WAI-STATUS`; add the [DOE DER Interconnection Roadmap](https://www.energy.gov/cmei/i2x/doe-distributed-energy-resource-interconnection-roadmap), [IEEE 1547-2018](https://standards.ieee.org/ieee/1547/5915/) and [DOE hosting-capacity atlas](https://www.energy.gov/cmei/vehicles/us-atlas-electric-distribution-system-hosting-capacity-maps).
- **Acceptance focus:** Template must select a feeder point, traverse its ordered element path, block a downstream study until prerequisite screens finish, populate at least two cases across multiple elements, trace one violating cell, validate its mitigation by rerun and issue a conditional verdict with explicit export envelope and upgrade owner.

## Prompt 05 — `prescribed-fire-ignition-window-control-planner`

- **Output boundary:** `archetypes/flow/prescribed-fire-ignition-window-control-planner/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Authorize and control staged ignition across one prescribed-fire unit by opening a time-bounded weather, fuel-moisture and smoke prescription window, advancing only eligible ignition blocks with adequate holding coverage and stopping before conditions or resources leave that window.
- **Required region graph:** `prescribed-fire-control → approved-burn-unit-plan-objectives-and-authority → control-line-and-ignition-block-adjacency-topology ↔ time-indexed-weather-fuel-moisture-and-smoke-prescription-window → sensitive-receptor-and-dispersion-constraint-set → holding-contingency-and-escape-resource-coverage → eligible-block-order-and-ignition-method → go-no-go-and-test-fire-gate → active-block-observation-and-window-consumption → continue-pause-mop-up-or-wildfire-conversion → post-burn-objective-smoke-and-action-record`; spatial block eligibility and the remaining safe time window jointly own every ignition decision.
- **Wide:** Burn-unit topology, forecast/observed prescription window, smoke receptors, block order, resource coverage and current go/no-go gate remain simultaneously visible.
- **Intermediate:** The active block, its adjacent control lines, remaining window and holding coverage remain primary; other blocks, forecast members, receptor detail and the complete action record move to synchronized routes.
- **Compact:** Burn day and authority → current prescription window → next eligible ignition block and adjacent control lines → smoke receptors and holding resources → go/no-go/test fire → ignite or pause → observed window consumption → next block, mop-up or conversion; the map transforms into an ordered block-adjacency spine with explicit escape and holding facts.
- **State obligations:** plan draft/approved/expired, unit ready/not-ready, forecast missing/current/divergent, prescription window closed/open/narrowing/exceeded, fuel moisture within/outside range, smoke receptor clear/at-risk/impacted, resource unassigned/ready/diverted, block locked/eligible/igniting/complete, test fire pending/pass/fail, ignition continue/paused/terminated, contingency activated, wildfire conversion ordered and post-burn review open/complete.
- **Hard rejection:** Reject cho `stage-gated-process-record`, `permit-to-work-isolation-control-room`, `live-operations-command-center`, generic weather planning or incident dispatch; an approved burn-unit block topology, time-consuming prescription window, smoke receptors, block-specific holding/contingency coverage, test-fire gate and explicit pause-or-conversion path are mandatory.
- **Research anchors:** `ESRI-LAYOUT`, `CARBON-TABLE`, `WAI-FOCUS`, `WAI-OBSCURED`, `WAI-STATUS`; add [NWCG Standards for Prescribed Fire Planning and Implementation](https://www.nwcg.gov/publications/pms484), [National Weather Service Fire Weather](https://www.weather.gov/fire/) and [EPA prescribed-burning and air-quality guidance](https://www.epa.gov/agriculture/agriculture-and-air-quality).
- **Acceptance focus:** Template must open a fictional ignition window, block one ignition block for missing holding coverage, pass a documented test fire, consume the window as two adjacent blocks ignite, pause when a smoke or weather threshold is crossed and expose mop-up, contingency and wildfire-conversion recovery without losing the approved plan snapshot.

## Prompt 06 — `power-grid-state-estimation-residual-workbench`

- **Output boundary:** `archetypes/work/power-grid-state-estimation-residual-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Produce and qualify one electrical network state by reconciling switch topology and weighted telemetry through observability analysis, then tracing normalized measurement residuals to bad data or model errors and proving the effect of each correction by rerun.
- **Required region graph:** `grid-state-estimation → estimator-run-network-model-and-time-version → breaker-switch-topology-processor → electrical-island-and-measurement-adjacency-graph ↔ telemetry-value-quality-weight-and-age-register → observability-and-critical-measurement-analysis → estimated-bus-voltage-angle-and-branch-flow-state → measured-versus-predicted-normalized-residual-ledger → bad-data-or-topology-error-hypothesis → suppress-correct-or-model-change-trial → rerun-and-residual-propagation-comparison → accepted-state-and-telemetry-model-work-queue`; the shared estimate predicts every measurement, while a correction is credible only when its residual effect propagates coherently through the connected electrical neighborhood.
- **Wide:** Processed topology, measurement adjacency, observability result, estimated state, residual ranking, active hypothesis and before/after rerun remain simultaneously inspectable.
- **Intermediate:** The selected island or residual and its connected measurement/model neighborhood remain primary; full topology, complete telemetry roster and prior trials move to synchronized routes.
- **Compact:** Estimator run and island → observability gap or worst normalized residual → connected measurements and switch statuses → measured-versus-predicted evidence → bad-datum or topology hypothesis → reversible trial → rerun and neighborhood residual propagation → accept state or open work item; the network transforms into an adjacency path plus ranked residual route.
- **State obligations:** model loading/current/stale, topology processed/inconsistent, telemetry current/stale/missing/suspect/excluded, island observable/unobservable/weakly observable, estimator queued/converged/nonconvergent, residual within/warning/outlier, critical measurement present/lost, hypothesis untested/supported/rejected, correction draft/applied/rolled-back, rerun improved/regressed and state provisional/accepted/rejected.
- **Hard rejection:** Reject cho `reconciliation-diff-workbench`, `dependency-topology-monitor`, anomaly dashboard or generic data-quality table; electrical observability, weighted measurements, a solved voltage/angle state, measured-versus-predicted normalized residuals, bad-data-versus-topology hypotheses and causal rerun propagation are mandatory.
- **Research anchors:** `CARBON-TABLE`, `ESRI-LAYOUT`, `WAI-GRID`, `WAI-FOCUS`, `WAI-STATUS`; add [NERC — External Model Data Causing State Estimator to Not Converge](https://www.nerc.com/globalassets/programs/event-analysis/lessons-learned/ll20180602_external_model_data_causing_state_estimator_to_not_converge.pdf), [PJM transmission manuals](https://www.pjm.com/library/manuals) and [ERCOT NPRR979 state-estimator and telemetry standards](https://www.ercot.com/mktrules/issues/NPRR979).
- **Acceptance focus:** Template must process a fictional switch topology, expose one unobservable island or critical-measurement loss, rank normalized residuals, compare a bad-telemetry hypothesis with a switch-status hypothesis, run a reversible correction and accept the state only after convergence, observability and connected-neighborhood residuals improve.

## Prompt 07 — `water-network-leak-isolation-recovery-workbench`

- **Output boundary:** `archetypes/flow/water-network-leak-isolation-recovery-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Confirm a leak in a pressurized water network, derive a hydraulic valve cut set that actually disconnects the failed segment, accept its named customer and critical-service impacts, then repair, flush, prove quality and repressurize in controlled stages.
- **Required region graph:** `leak-recovery → distribution-network-district-and-supply-source-topology → pressure-flow-anomaly-evidence → failed-pipe-hypothesis → candidate-valve-cut-set-generator ↔ hydraulic-connectivity-pressure-and-customer-impact-simulation → named-customer-critical-service-and-advisory-ledger → safe-valve-isolation-order → repair-and-contamination-control → flush-path-volume-and-quality-sample-gate → staged-repressurization-and-pressure-verification → restored-service-receipt`; a cut set is valid only when it hydraulically severs the failed segment and exposes every downstream service consequence before field execution.
- **Wide:** Hydraulic topology, candidate cut sets, named customer-impact ledger, valve sequence and repair-to-quality-to-repressurization path remain simultaneously visible.
- **Intermediate:** The failed segment, selected cut set and affected critical services remain primary; alternate cuts, complete network and later recovery evidence move to synchronized routes.
- **Compact:** Failed segment → candidate hydraulic cut set → disconnected customer/critical-service set → valve order → isolation proof → repair → flush route and volume → quality sample → staged repressurization → service receipt; the map becomes a cut-set path plus customer-impact route rather than a generic stack.
- **State obligations:** sensors loading/stale/disagreeing, leak suspected/confirmed/false, valve operable/inaccessible/unknown, cut set disconnected/incomplete/isolating/overbroad, hydraulic solve converged/failed, customer unaffected/interrupted/advised, critical service protected/escalated, isolation issued/verified, repair pending/complete, contamination risk, flush incomplete/complete, quality sample pending/pass/fail, repressurization held/staged/verified and supply restored.
- **Hard rejection:** Reject cho `map-led-situation-monitor`, `grid-outage-restoration-switching-board`, guided troubleshooting or generic work order; a pressurized hydraulic cut set, named customer and critical-service impact, ordered isolation, repair, flush-volume path, quality gate and staged repressurization are mandatory.
- **Research anchors:** `ESRI-LAYOUT`, `CARBON-TABLE`, `WAI-DRAG`, `WAI-FOCUS`, `WAI-STATUS`; add [EPA EPANET](https://www.epa.gov/water-research/epanet), [WHO leakage management and control](https://www.who.int/publications/i/item/WHO-SDE-WSH-01.1) and [WHO sanitary inspection for piped distribution](https://cdn.who.int/media/docs/default-source/wash-documents/water-safety-and-quality/water-safety-planning/sanitary-inspection-packages/9.-piped-distribution---network_web.pdf?download=true).
- **Acceptance focus:** Template must compare two hydraulic cut sets, reject one that leaves the failed pipe connected or harms a named critical service, acknowledge the feasible set's customer impact, execute its valve order, hold repressurization on a failed quality sample, pass the retest and restore supply in verified pressure stages.

## Prompt 08 — `reservoir-release-rule-curve-coordinator`

- **Output boundary:** `archetypes/work/reservoir-release-rule-curve-coordinator/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Create and authorize a reservoir release schedule by reconciling forecast inflow, storage and guide-curve zones with prioritized operating rules, outlet capacity and downstream control-point limits.
- **Required region graph:** `reservoir-coordinator → reservoir-plan-and-time-horizon → inflow-forecast-ensemble → storage-elevation-guide-curve-and-zone ↔ prioritized-release-rule-stack → allowable-release-envelope → downstream-control-point-routing → candidate-release-schedule → rule-conflict-and-impact-comparison → authorized-operation-and-deviation-record`; each timestep's release is constrained by a narrowing allowable envelope and downstream routed effects.
- **Wide:** Forecast/storage curve, rule stack, release envelope, downstream hydrographs and schedule remain visible together.
- **Intermediate:** Candidate schedule, binding rules and downstream effects remain primary; ensemble members, complete rule stack and deviation history move to drawers.
- **Compact:** Timestep → operating zone → allowable range → binding rule → proposed release → downstream result → authorize or record exception; the whole horizon becomes a navigable period sequence.
- **State obligations:** forecast loading/current/stale/divergent, storage observation provisional/confirmed, zone normal/flood/conservation/emergency, rule active/inactive/conflicting/superseded, outlet available/limited, routing pending/failed, schedule draft/infeasible/feasible, deviation requested/approved/rejected and release issued/amended.
- **Hard rejection:** Reject cho `scenario-sensitivity-modeler`, `process-mass-balance-analyzer`, timeline monitor or permit approval; a guide curve, ordered operating zones, prioritized narrowing release limits, downstream routing and an issued time-indexed operation are mandatory.
- **Research anchors:** `CARBON-TABLE`, `FLUENT-LAYOUT`, `WAI-FOCUS`, `WAI-STATUS`, `WAI-REFLOW`; add [USACE reservoir-operation basics](https://www.hec.usace.army.mil/confluence/ResSimDocs/rsum/reservoir-operations/reservoir-operations-the-basics), [USACE release decision rules](https://www.hec.usace.army.mil/confluence/cwmsdocs/rsum/reservoir-operations-the-rules-58631745.html) and [USACE rule-based operations guide](https://www.hec.usace.army.mil/confluence/hmsdocs/hmsguides/modeling-reservoirs-in-hec-hms/rule-based-reservoir-operations-quick-start-guide).
- **Acceptance focus:** Template must move a forecast into a flood zone, show two conflicting limits narrowing the release envelope, route the candidate downstream, reject an exceedance, authorize the corrected schedule and preserve the deviation lineage.

## Prompt 09 — `stormwater-catchment-control-planner`

- **Output boundary:** `archetypes/work/stormwater-catchment-control-planner/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Place and size distributed stormwater controls, reroute each intervention through its exact downstream drainage path and prove before/after hydrographs at every named affected node and outfall under selected design storms.
- **Required region graph:** `catchment-control-planner → study-area-and-design-storm → subcatchment-runoff-source-set ↔ directed-drainage-conveyance-topology → failing-node-and-outfall-hydrograph-register → candidate-control-site-type-and-parameters → intervention-to-named-downstream-node-path → rerouted-node-by-node-flow-and-pollutant-hydrographs → portfolio-capacity-quality-and-site-constraint-verdict → selected-plan-and-model-export`; each intervention owns a named downstream route, and its result is the propagated hydrograph change along that route rather than an aggregate catchment score.
- **Wide:** Catchment topology, selected intervention route, named downstream hydrographs, portfolio controls and before/after verdict remain simultaneously visible.
- **Intermediate:** The selected control and its named downstream node path remain primary; other catchments, alternate interventions and unrelated hydrographs move to synchronized routes.
- **Compact:** Design storm → failing named node/outfall → contributing subcatchments → feasible intervention → exact downstream node sequence → before/after hydrograph at each affected receptor → portfolio verdict; the map transforms into a topological route whose nodes open their paired hydrographs.
- **State obligations:** rainfall input missing/current/future-adjusted, model loading/nonconvergent, node normal/surcharged/flooding, downstream route complete/broken, hydrograph baseline/current/stale, outfall within/exceeding target, site feasible/constrained, control draft/undersized/valid, portfolio simulation queued/running, pollutant criterion unknown/pass/fail and plan selected/superseded.
- **Hard rejection:** Reject cho `geospatial-raster-layer-analysis-workbench`, `map-led-situation-monitor`, `scenario-sensitivity-modeler` or `process-mass-balance-analyzer`; rainfall-runoff routing, intervention-to-named-downstream-node topology and receptor-specific rerun hydrographs under named storms are mandatory.
- **Research anchors:** `ESRI-LAYOUT`, `CARBON-TABLE`, `WAI-DRAG`, `WAI-FOCUS`, `WAI-STATUS`; add [EPA Storm Water Management Model](https://www.epa.gov/water-research/storm-water-management-model-swmm), [FEMA nature-based solutions guidance](https://www.fema.gov/emergency-managers/risk-management/climate-resilience/nature-based-solutions) and [NOAA precipitation-frequency data server](https://hdsc.nws.noaa.gov/pfds/).
- **Acceptance focus:** Template must select a surcharged named node, trace contributing subcatchments, place one control, show its rerouted path through at least two downstream nodes to a named outfall, compare each hydrograph's peak/volume/pollutant delta and reject a portfolio that merely moves the violation downstream.

## Prompt 10 — `rail-possession-access-planner`

- **Output boundary:** `archetypes/work/rail-possession-access-planner/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Plan, formally take, control and give back one railway possession whose exact infrastructure limits contain nested worksites, each worksite retains its own authority and every lower-level authority clears before the possession authority may release the line.
- **Required region graph:** `rail-possession → corridor-service-and-access-window → exact-track-possession-limits ↔ protecting-signal-point-and-block-boundaries → possession-authority-and-take-sequence → nested-worksite-boundary-and-authority-tree → engineering-train-access-and-movement-plan → live-worksite-people-plant-train-and-exception-register → child-worksite-clearance-receipts → protection-removal-and-possession-give-up-authority → service-handback-record`; outer possession authority contains but does not replace each nested worksite authority, and give-up is vetoed until every child receipt closes.
- **Wide:** Exact track limits, protection, authority hierarchy, nested worksites/trains and current take-or-give step remain simultaneously visible.
- **Intermediate:** The possession boundary and active worksite authority remain primary; sibling worksites, full topology, notices and handback history move to synchronized routes while the containment hierarchy stays visible.
- **Compact:** Possession identity/window → exact outer limits and protection → take authority → choose nested worksite → worksite owner/people/plant/train status → child-clearance receipt → remaining child blockers → remove protection → give-up authority → handback; the topology transforms into an authority-containment path rather than stacked worksite cards.
- **State obligations:** access window draft/confirmed/curtailed, outer limits valid/conflicting, protection planned/placed/verified/removed, possession authority unreachable/confirmed/transferred, possession requested/granted/refused, worksite authority unassigned/accepted/transferred, worksite not-open/open/suspended/clear, engineering train outside/inside/stabled/clear, overrun predicted/active, child receipt missing/accepted, give-up blocked/accepted and service restored.
- **Hard rejection:** Reject cho `railway-movement-authority-control-console`, `rail-disruption-timetable-recovery-workbench`, `calendar-resource-scheduler` or `permit-to-work-isolation-control-room`; exact possession limits, outer take/give authority, nested worksite authorities, engineering-train access and child-clearance-vetoed handback are mandatory.
- **Research anchors:** `CARBON-TABLE`, `FLUENT-LAYOUT`, `WAI-DRAG`, `WAI-FOCUS`, `WAI-STATUS`; add [RSSB GERT8000-T3 Issue 13](https://www.rssb.co.uk/standards-catalogue/CatalogueItem/gert8000-t3-iss-13) and [Network Rail Operational Rules](https://www.networkrail.co.uk/industry-and-commercial/information-for-operators/operational-rules/).
- **Acceptance focus:** Template must define outer possession limits, place protection, take the possession under one authority, open at least two nested worksites under distinct owners, admit an engineering train, block give-up on one missing child receipt, clear each owner in order and record accepted handback without relying on drag.

## Prompt 11 — `bridge-defect-load-rating-workbench`

- **Output boundary:** `archetypes/work/bridge-defect-load-rating-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Convert measured bridge defects into updated member capacity and load effects, identify the controlling component and vehicle case, and issue a load rating, posting, repair or inspection decision.
- **Required region graph:** `bridge-rating → bridge-version-and-inspection-scope → component-hierarchy ↔ defect-location-measurement-and-evidence → section-and-member-property-reduction → rating-vehicle-and-load-effect-cases → capacity-demand-factor-ledger → controlling-member-and-load-path → posting-repair-or-reinspection-scenarios → engineer-review-and-versioned-rating`; each rating result must trace through one load case and defect-adjusted component capacity.
- **Wide:** Component hierarchy, defect evidence, rating cases, capacity-demand factors and decision scenarios remain visible.
- **Intermediate:** Controlling component, evidence and rating result remain primary; bridge overview, all load cases and decision history move to drawers.
- **Compact:** Bridge → controlling component → defect measurement → adjusted property → governing vehicle/load case → rating factor → post, repair or reinspect; drawing selection has a component-list alternative.
- **State obligations:** inspection current/overdue/incomplete, defect unconfirmed/measured/progressing, evidence loading/unavailable, component property provisional/approved, load case queued/running/invalid, rating pass/restricted/critical, controlling case changed, posting proposed/issued, repair scenario unverified and engineer review signed/rejected/superseded.
- **Hard rejection:** Reject cho `finite-element-mesh-convergence-workbench`, `evidence-led-case-resolution-dossier`, portfolio health or generic structural viewer; inspection-located deterioration, defect-adjusted member capacity, code-defined rating vehicles, a controlling load path and an issued operational rating are mandatory.
- **Research anchors:** `CARBON-TABLE`, `ESRI-LAYOUT`, `WAI-FOCUS`, `WAI-STATUS`, `WAI-REFLOW`; add [FHWA Bridge Load Rating](https://www.fhwa.dot.gov/bridge/loadrating/) and [FHWA Bridge Inspection resources](https://www.fhwa.dot.gov/bridge/inspection/index.cfm).
- **Acceptance focus:** Template must select a measured defect, reduce the affected section property, rerun two load cases, expose the governing factor and component, compare posting with repair and preserve the engineer-approved rating version.

## Prompt 12 — `earthwork-cut-fill-mass-haul-planner`

- **Output boundary:** `archetypes/work/earthwork-cut-fill-mass-haul-planner/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Build and approve a construction-stage earthwork movement plan that connects compatible cut sources to fill demands along an alignment, preserves adjusted material volume and exposes balance points, haul limits, borrow, waste and stockpile consequences.
- **Required region graph:** `mass-haul-planner → alignment-design-version-and-construction-stage → station-range-cut-and-fill-quantity-ledger → material-class-suitability-and-shrink-swell-adjustment → cumulative-mass-curve-and-balance-points ↔ haul-path-cost-barrier-and-stage-access-network → cut-source-to-fill-demand-movement-plan → borrow-waste-and-stockpile-options → plant-environmental-and-sequencing-constraints → revised-movement-plan-and-adjusted-volume-receipt → approved-earthwork-sequence-and-export`; cumulative balance constrains how much material can move between station ranges, while suitability and access determine which source-to-demand edges are legal.
- **Wide:** Alignment quantities, cumulative mass curve, selected source-to-fill movement, haul network, material suitability and conserved-volume receipt remain simultaneously visible.
- **Intermediate:** The active balance segment and selected source-fill pair remain primary; full alignment, other stages, plant options and movement history move to synchronized routes.
- **Compact:** Construction stage → deficit fill range → compatible cut source and adjusted volume → haul route/barriers → balance point and haul quantity → borrow/waste/stockpile consequence → conserved receipt → commit movement; the longitudinal diagram transforms into a station-range ledger and one source-to-demand path rather than a miniature chart stack.
- **State obligations:** design current/superseded, stage locked/open/complete, quantity missing/current/recalculated, material suitable/conditional/unsuitable, shrink-swell factor provisional/approved, balance segment surplus/deficit/balanced, haul path open/constrained/blocked, movement draft/feasible/overallocated, stockpile unavailable/ready/full, borrow or waste unapproved/approved, volume receipt balanced/unbalanced and sequence draft/approved/revised.
- **Hard rejection:** Reject cho `process-mass-balance-analyzer`, `constrained-quota-allocation-editor`, transport network assignment, timeline scheduler or generic cost optimization; station-indexed cut/fill quantities, material transformations, a cumulative mass curve with balance points, explicit cut-to-fill haul edges, stage-access limits and borrow/waste/stockpile consequences are mandatory.
- **Research anchors:** `CARBON-TABLE`, `FLUENT-LAYOUT`, `WAI-FOCUS`, `WAI-STATUS`, `WAI-REFLOW`; add the [FHWA Earthwork Representation Guide](https://highways.fhwa.dot.gov/federal-lands/design/tools/cfl/earthwork-representation-guide.pdf), [Caltrans Construction Manual — Earthwork](https://dot.ca.gov/programs/construction/construction-manual/section-4-19-earthwork) and the [UK Planning Inspectorate A12 mass-haul technical note](https://nsip-documents.planninginspectorate.gov.uk/published-documents/TR010060-001649-9-12-Borrow-Pits-Supplementary-Technical-Note-13842-1.pdf).
- **Acceptance focus:** Template must edit cut and fill quantities across multiple station ranges, reject an unsuitable source, apply a visible shrink/swell factor, route compatible material around one haul barrier, update the cumulative balance point, expose borrow or waste for the remaining deficit/surplus and refuse approval until adjusted source, destination, stockpile and residual volumes reconcile.

## Prompt 13 — `building-retrofit-measure-bundle-modeler`

- **Output boundary:** `archetypes/work/building-retrofit-measure-bundle-modeler/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Compose an interacting retrofit package against a calibrated building baseline, quantify where package results differ from the sum of isolated measures and bind the selected non-additive outcome to an implementation and measurement-and-verification plan.
- **Required region graph:** `retrofit-modeler → calibrated-building-baseline-and-end-use-ledger → measure-library → compatibility-precedence-and-non-additive-interaction-matrix ↔ candidate-package-composer → isolated-measure-runs-and-combined-package-run → summed-isolated-expectation-versus-package-interaction-residual → energy-cost-carbon-comfort-health-and-safety-results → selected-package-and-phasing → outcome-owner-meter-and-measurement-verification-plan`; the interaction matrix owns legal combinations, while the package-minus-isolated residual proves that bundle performance is not an additive checklist.
- **Wide:** Calibrated baseline, package composer, interaction matrix, isolated-versus-package residual, multidimensional results and M&V ownership remain simultaneously visible.
- **Intermediate:** The active package, selected interaction cell and package residual remain primary; measure library, calibration evidence, other outcome dimensions and verification history move to synchronized routes.
- **Compact:** Retrofit objective → calibrated baseline gap → add measure → inspect pairwise dependency/conflict/interaction → run isolated and package cases → explain non-additive residual → compare constraints → select package → assign M&V owner/meter; the library transforms into scoped search rather than stacked cards.
- **State obligations:** baseline incomplete/calibrating/calibrated/stale, measure available/inapplicable/dependent/conflicting, interaction unknown/additive/synergistic/antagonistic, package draft/invalid/ready, isolated or package run queued/running/failed, residual unexplained/explained, comfort or safety constraint breached, cost estimate provisional, package selected/superseded and M&V owner/metric missing/approved.
- **Hard rejection:** Reject cho `scenario-sensitivity-modeler`, calculation estimate flow, comparison matrix or generic sustainability dashboard; a calibrated baseline, explicit non-additive interaction matrix, isolated-versus-package residual, package-level simulation and owned measurement-and-verification plan are mandatory.
- **Research anchors:** `CARBON-TABLE`, `FLUENT-LAYOUT`, `WAI-FOCUS`, `WAI-STATUS`, `WAI-REFLOW`; add [DOE Advanced Energy Retrofit Guides](https://www.energy.gov/cmei/buildings/advanced-energy-retrofit-guides), [DOE building energy modeling](https://www.energy.gov/cmei/buildings/about-building-energy-modeling) and [DOE zero-energy design tools](https://www.energy.gov/cmei/buildings/zero-energy-building-design-tools).
- **Acceptance focus:** Template must calibrate a baseline, compose a three-measure package, block one incompatible pair, show at least one synergistic or antagonistic interaction whose package result differs from the isolated sum, rerun after correction and attach named outcome owners, meters and verification periods to the selected package.

## Prompt 14 — `greenhouse-gas-inventory-consolidation-workbench`

- **Output boundary:** `archetypes/work/greenhouse-gas-inventory-consolidation-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Build and verify an organizational greenhouse-gas inventory by fixing one consolidation approach across an entity hierarchy, classifying and calculating sources, eliminating paired intercompany activity and replaying an approved base year whenever a structural or methodology trigger requires recalculation.
- **Required region graph:** `ghg-inventory → reporting-period-standard-consolidation-approach-and-base-year → organizational-boundary-and-entity-control-tree → entity-owned-emission-source-register → scope-category-method-and-activity-factor-lineage → entity-subtotal-and-group-consolidation-rollup ↔ paired-intercompany-activity-and-elimination-ledger → structural-methodology-and-significance-trigger-register → base-year-recalculation-replay-and-comparability-bridge → completeness-uncertainty-and-verification-issues → approved-inventory-and-disclosure-export`; the entity boundary owns consolidation, each elimination binds two counterpart records and every qualifying trigger replays the base-year inventory under preserved lineage.
- **Wide:** Entity-control boundary, source calculations, consolidation rollup, paired intercompany eliminations, base-year replay and verification issues remain simultaneously visible.
- **Intermediate:** The selected entity/source and consolidated result remain primary; its counterparty elimination and any base-year trigger stay synchronized while the full tree and other methodology evidence move to routes.
- **Compact:** Reporting period and consolidation approach → entity path → source activity/factor lineage → scope/category → linked counterparty elimination → structural or method trigger → base-year replay/comparability result → verification; the hierarchy transforms into an entity path with exact linked records rather than stacked ledgers.
- **State obligations:** boundary draft/approved/changed, entity included/excluded/partial, source missing/actual/estimated/not-applicable, scope disputed/resolved, factor current/superseded, unit conversion pass/fail, intercompany pair unmatched/matched/eliminated/reopened, recalculation trigger absent/proposed/approved, base-year replay queued/complete/failed, verification issue open/cleared and inventory draft/assured/published/revised.
- **Hard rejection:** Reject cho `process-mass-balance-analyzer`, `financial-consolidation-elimination-workbench`, bridge waterfall or spreadsheet accounting; GHG-specific consolidation approach, scope/category classification, activity-to-factor lineage, paired intercompany activity elimination and trigger-driven base-year replay are mandatory—financial journal consolidation or physical conservation alone is insufficient.
- **Research anchors:** `CARBON-TABLE`, `FLUENT-LAYOUT`, `WAI-GRID`, `WAI-STATUS`, `WAI-FOCUS`; add [GHG Protocol Corporate Standard FAQ](https://ghgprotocol.org/corporate-standard-frequently-asked-questions), [GHG Protocol standards update](https://ghgprotocol.org/ghg-protocol-corporate-suite-standards-and-guidance-update-process), [EPA GHG Emission Factors Hub](https://www.epa.gov/climateleadership/ghg-emission-factors-hub) and [ISO 14064-1:2018](https://www.iso.org/standard/66453.html).
- **Acceptance focus:** Template must change one entity-control boundary, reclassify and calculate a source from visible activity/factor lineage, match both sides of an intercompany activity before elimination, record the structural trigger, replay the base year with a comparability bridge and clear verification before release.

## Prompt 15 — `product-life-cycle-impact-assessment-workbench`

- **Output boundary:** `archetypes/work/product-life-cycle-impact-assessment-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Perform and critically review one product life-cycle assessment by fixing a functional unit and reference flow, drawing an explicit product-system boundary, resolving allocation and cutoff choices, and transforming normalized inventory flows through versioned characterization factors into interpreted impact results.
- **Required region graph:** `life-cycle-assessment → goal-scope-functional-unit-reference-flow-and-method-version → product-system-boundary-and-process-network → functional-unit-normalized-inventory-flow-ledger → multifunction-process-allocation-and-cutoff-decision-register → elementary-flow-to-characterization-factor-matrix → impact-category-results → process-flow-and-decision-contribution-hotspots → sensitivity-uncertainty-and-interpretation → independent-critical-review-issues-and-study-release`; functional-unit scaling precedes inventory comparison, boundary/allocation/cutoff decisions own included flows and characterization maps each elementary flow into category-specific potential impacts.
- **Wide:** Functional unit/reference flow, system boundary, normalized inventory, allocation/cutoff decisions, characterization lineage, impact results and critical-review issues remain simultaneously visible.
- **Intermediate:** The selected impact category and its flow-to-factor lineage remain primary; boundary, allocation/cutoff decision and review issue stay synchronized while the complete process network and other categories move to routes.
- **Compact:** Goal and functional unit → reference flow and system boundary → inventory flow → allocation/cutoff decision → characterization factor and category result → sensitivity/interpretation → critical-review issue → release; the process network transforms into a semantic boundary path rather than starting from a hotspot card.
- **State obligations:** goal/scope incomplete/approved, functional unit invalid/changed, reference flow unresolved/resolved, process in/out/boundary-disputed, flow missing/estimated/measured, allocation unresolved/selected, cutoff proposed/accepted/rejected, factor unavailable/current/superseded, characterization queued/failed/complete, hotspot stable/sensitivity-dependent, uncertainty high, critical review open/cleared and study released/revised.
- **Hard rejection:** Reject cho `process-mass-balance-analyzer`, `bridge-contribution-waterfall-overview`, systematic evidence synthesis or chart authoring; functional-unit normalization, explicit product-system boundary, allocation and cutoff authority, elementary-flow characterization and independent critical review are mandatory.
- **Research anchors:** `CARBON-TABLE`, `FLUENT-LAYOUT`, `WAI-FOCUS`, `WAI-STATUS`, `WAI-REFLOW`; add [ISO 14040:2006](https://www.iso.org/standard/37456.html), [EPA TRACI](https://www.epa.gov/chemical-research/tool-reduction-and-assessment-chemicals-and-other-environmental-impacts-traci) and [European Commission Environmental Footprint methods](https://green-forum.ec.europa.eu/environmental-footprint-methods_en).
- **Acceptance focus:** Template must set a functional unit/reference flow, include or exclude one process with visible inventory consequence, resolve one multifunction allocation and one cutoff decision, trace an elementary flow through versioned factors into two impact categories, reveal a sensitivity-dependent interpretation and block release until critical review closes.

## Prompt 16 — `industrial-symbiosis-exchange-planner`

- **Output boundary:** `archetypes/work/industrial-symbiosis-exchange-planner/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Design a feasible cross-facility resource exchange by matching one facility's output stream to another's input specification across quantity, quality, timing, location, preprocessing, storage, logistics and reciprocal commitments.
- **Required region graph:** `symbiosis-planner → park-region-and-participant-roster → offered-output-stream-catalog ↔ required-input-specification-catalog → quantity-quality-time-location-compatibility → preprocessing-storage-and-logistics-chain → candidate-bilateral-or-multilateral-exchanges → substituted-input-and-residual-output-balance → participant-commitments-and-contingencies → baseline-monitoring-and-exchange-activation`; resource compatibility and conserved substitution/residual quantities jointly own feasibility.
- **Wide:** Offer/need catalogs, compatibility evidence, selected exchange chain, residual balance and participant commitments remain visible.
- **Intermediate:** Ranked feasible exchanges and selected chain remain primary; complete catalogs, map and contingency history move to drawers.
- **Compact:** Input need or output offer → compatibility evidence → quality/quantity gap → preprocessing/logistics → bilateral commitments → substituted input/residual receipt → activate; catalogs become scoped search routes.
- **State obligations:** stream unknown/available/intermittent/withdrawn, specification incomplete/validated, match incompatible/conditional/feasible, sample pending/pass/fail, quantity shortfall/surplus, preprocessing unavailable/confirmed, logistics constrained, participant invited/committed/declined, contingency triggered and exchange pilot/active/suspended/closed.
- **Hard rejection:** Reject cho `dual-list-transfer`, `inventory-replenishment-planner`, scoped federated search or `process-mass-balance-analyzer`; independently owned output and input specifications, cross-facility compatibility, transformation/logistics chain, reciprocal commitments and residual substitution balance are mandatory.
- **Research anchors:** `ESRI-LAYOUT`, `CARBON-TABLE`, `WAI-FOCUS`, `WAI-STATUS`, `WAI-REFLOW`; add the [UNIDO Implementation Handbook for Eco-Industrial Parks](https://www.unido.org/learning-resources/implementation-handbook-eco-industrial-parks), [UNIDO Eco-Industrial Park publications](https://hub.unido.org/eco-industrial-parks-publications) and the [UNIDO/World Bank/GIZ practitioner handbook](https://ipp.unido.org/sites/default/files/knowledge/2022-06/English.pdf).
- **Acceptance focus:** Template must match one offered stream to a need, expose a quality mismatch, add preprocessing and storage, reconcile substituted and residual quantities, obtain both facility commitments and suspend the exchange when supply timing violates its contingency.

## Prompt 17 — `contaminated-site-linkage-remediation-workbench`

- **Output boundary:** `archetypes/work/contaminated-site-linkage-remediation-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Build and test a contaminated-site conceptual model, determine which source–pathway–receptor linkages are complete, and choose a remedy that breaks each material linkage with residual-risk and verification evidence.
- **Required region graph:** `site-remediation → site-use-geology-and-objectives → contaminant-source-register → pathway-and-environmental-media-network ↔ receptor-register → sample-location-result-and-criteria-evidence → complete-incomplete-and-uncertain-linkage-matrix → remedy-options-bound-to-link-breaks → residual-risk-and-monitoring-model → selected-remedy-and-verification-plan`; risk exists only through an evidenced complete linkage, and each selected remedy names the linkage element it changes.
- **Wide:** Site/context map, linkage network, sample evidence, linkage matrix and remedy/residual-risk comparison remain visible.
- **Intermediate:** Selected linkage and remedy evidence remain primary; complete site map, source/receptor registers and monitoring history move to drawers.
- **Compact:** Receptor or source → candidate pathway → sample/criteria evidence → linkage verdict → remedy break point → residual risk/monitoring → select and verify; every map path has a semantic chain alternative.
- **State obligations:** site model draft/current/stale, source suspected/confirmed/removed, pathway plausible/complete/interrupted/uncertain, receptor present/absent/future, sample planned/pending/qualified/rejected, criterion applicable/disputed, linkage material/not-material/unknown, remedy untested/effective/insufficient, residual risk acceptable/unacceptable and verification pending/complete/failed.
- **Hard rejection:** Reject cho `risk-bow-tie-control-overview`, `evidence-led-case-resolution-dossier`, map-led monitor or impact-likelihood matrix; site-specific environmental media, source–pathway–receptor completeness, sampling criteria, remedy-to-linkage break semantics and residual verification are mandatory—there is no single central event.
- **Research anchors:** `ESRI-LAYOUT`, `CARBON-TABLE`, `WAI-FOCUS`, `WAI-STATUS`, `WAI-REFLOW`; add [Environment Agency LCRM Stage 1](https://www.gov.uk/government/publications/land-contamination-risk-management-lcrm/lcrm-stage-1-risk-assessment), [Land contamination risk management](https://www.gov.uk/government/publications/land-contamination-risk-management-lcrm) and [EPA Superfund risk assessment](https://www.epa.gov/risk/superfund-risk-assessment).
- **Acceptance focus:** Template must assemble one complete and one uncertain linkage, bind samples and criteria to each, reject a remedy that leaves a pathway intact, select a remedy that breaks the material link and define monitoring plus verification for residual risk.

## Prompt 18 — `urban-heat-equity-intervention-planner`

- **Output boundary:** `archetypes/work/urban-heat-equity-intervention-planner/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Commit urban cooling interventions only where heat exposure, population vulnerability and cooling-access deficit jointly identify need, then prove distributional before/after outcomes for affected groups and bind each selected intervention to an accountable delivery and maintenance owner.
- **Required region graph:** `heat-equity-planner → planning-area-season-policy-goals-and-population-groups → heat-exposure-measure-by-area ↔ vulnerability-measure-by-group ↔ cooling-and-essential-destination-access-catchments → exposure-times-vulnerability-times-access-deficit-joint-need-set → candidate-site-and-intervention-options → group-and-area-distributional-before-after-outcome-matrix → co-benefit-displacement-and-harm-checks → budget-delivery-owner-and-maintenance-commitments → selected-equitable-program-and-monitoring`; no single layer may create priority, and aggregate gain cannot hide a worse outcome for a named group.
- **Wide:** Exposure, vulnerability and access owners, joint-need set, site options, distributional before/after matrix and owner commitments remain simultaneously visible.
- **Intermediate:** The selected community/group and candidate site remain primary; all three joint-need inputs and its distributional delta stay synchronized while other layers and program history move to routes.
- **Compact:** Community/group → exposure evidence → vulnerability evidence → access deficit → joint-need verdict → site/intervention → distributional before/after across named groups → harm check → delivery/maintenance owner → select; maps transform into area/group and destination routes rather than stacked layers.
- **State obligations:** exposure current/stale/missing, vulnerability measure approved/disputed, access catchment calculated/invalid, joint need incomplete/provisional/confirmed, site available/constrained, intervention estimated/designed/unfunded, group outcome improved/unchanged/worsened, aggregate gain sufficient/insufficient, displacement risk unknown/mitigated, delivery owner unassigned/committed, maintenance unfunded/secured and program draft/adopted/monitored.
- **Hard rejection:** Reject cho `map-led-situation-monitor`, `capacity-allocation-overview`, constrained quota, risk-impact-likelihood overview or portfolio health; exposure×vulnerability×access joint need, site-level interventions, distributional before/after proof and named delivery/maintenance ownership are mandatory.
- **Research anchors:** `ESRI-LAYOUT`, `CARBON-TABLE`, `WAI-FOCUS`, `WAI-STATUS`, `WAI-REFLOW`; add [EPA Heat Island Effect](https://www.epa.gov/heatislands), [EPA green infrastructure for heat reduction](https://www.epa.gov/green-infrastructure/reduce-heat-islands), [CDC Heat & Health Tracker](https://ephtracking.cdc.gov/Applications/heatTracker/) and [NOAA/NESDIS — Mapping Heat Islands in Cities](https://www.nesdis.noaa.gov/events/nedtalk-extreme-heat-mapping-heat-islands-cities).
- **Acceptance focus:** Template must derive one priority from all three exposure, vulnerability and access owners, compare two sites, show accessible distributional before/after results for at least two groups, reject an option whose aggregate gain worsens one priority group and bind funding, delivery owner and maintenance owner to the selected program.

## Prompt 19 — `materials-disassembly-recovery-sequence-planner`

- **Output boundary:** `archetypes/work/materials-disassembly-recovery-sequence-planner/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Derive and validate a safe disassembly sequence from a product or construction assembly's connection dependencies, access constraints, hazards, tools and component conditions, then route recovered items to reuse, remanufacture, recycle or disposal.
- **Required region graph:** `disassembly-planner → product-assembly-version-and-recovery-goal → bill-of-materials-hierarchy ↔ connection-access-and-dependency-graph → hazard-tool-and-destructive-step-constraints → reversible-disassembly-sequence → component-condition-and-recovery-yield → reuse-remanufacture-recycle-disposal-routes → residual-waste-value-and-compliance-summary → validated-instructions-and-passport-export`; removing one component changes what becomes accessible and which recovery routes remain possible.
- **Wide:** Assembly/dependency graph, ordered steps, selected joint/constraint, component recovery routes and yield summary remain visible.
- **Intermediate:** Current sequence and selected component remain primary; full assembly graph, tool bank and residual summary move to drawers.
- **Compact:** Assembly → next removable component → joint/tool/hazard proof → remove or choose alternative → record condition → recovery route → unlocked successor; graph editing has move buttons and a topological list alternative.
- **State obligations:** assembly version unknown/current/superseded, connection known/unknown/inaccessible, step blocked/available/destructive, tool unavailable/ready, hazard unidentified/controlled, component intact/damaged/contaminated, route eligible/ineligible/pending test, yield estimated/confirmed, sequence invalid/valid and instructions draft/reviewed/exported.
- **Hard rejection:** Reject cho `workflow-automation-builder`, `print-signature-imposition-planner`, sample lineage or inventory replenishment; physical connection/access dependencies, hazard- and tool-constrained removal, component condition and recovery-route yield are mandatory.
- **Research anchors:** `CARBON-TABLE`, `FLUENT-LAYOUT`, `WAI-DRAG`, `WAI-FOCUS`, `WAI-STATUS`; add [ISO 20887:2020](https://www.iso.org/cms/live/live/en/sites/isoorg/contents/data/standard/06/93/69370.html), the [European Commission Digital Product Passport](https://single-market-economy.ec.europa.eu/single-market/digital-product-passport_en) and [EU Ecodesign Regulation guidance](https://environment.ec.europa.eu/news/new-eu-sustainability-rules-explained-ecodesign-regulation-faqs-2024-09-27_en).
- **Acceptance focus:** Template must expose a blocked component, choose a prerequisite removal through buttons rather than drag, require a hazard control and tool, record damage that changes the recovery route, recalculate yield and export the validated sequence.

## Prompt 20 — `groundwater-wellfield-pumping-allocation-workbench`

- **Output boundary:** `archetypes/work/groundwater-wellfield-pumping-allocation-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Allocate pumping by well and period through a coupled-aquifer model whose delayed superposed responses attribute every named receptor impact to contributing well-time pairs and whose operating schedule changes when monitoring triggers fire.
- **Required region graph:** `wellfield-allocation → model-version-horizon-recharge-and-boundary-condition-set → coupled-aquifer-layer-and-connection-topology → production-well-by-period-rate-schedule ↔ well-period-to-layer-response-kernels-and-time-lag → superposed-head-drawdown-and-interference-state → named-stream-spring-observation-subsidence-and-quality-receptor-series → receptor-threshold-violation-contribution-matrix-by-well-and-period → revised-schedule-and-coupled-model-rerun → receptor-specific-monitoring-trigger-and-amendment-rules → approved-operation-plan`; feasibility derives from time-varying superposition through connected aquifers, and each receptor breach owns a contribution trace rather than a divisible pumping quota.
- **Wide:** Coupled-aquifer topology, well-period schedule, superposed response, named receptor series, contribution matrix and trigger-bound revision remain simultaneously visible.
- **Intermediate:** The selected receptor breach and its contributing well-period paths remain primary; full aquifer context, other receptors and monitoring history move to synchronized routes.
- **Compact:** Named receptor and threshold period → delayed contribution ranking by well×pumping period → coupled-aquifer path → rate/time adjustment → rerun receptor series → trigger/amendment rule → approve; maps transform into receptor-to-well causal paths with exact lagged values.
- **State obligations:** model calibrated/provisional/stale, aquifer connection active/uncertain, recharge normal/drought/revised, observation missing/current/outlier, well available/limited/offline, schedule draft/running, response separate/interfering/delayed, receptor threshold safe/approaching/exceeded, attribution complete/ambiguous, solve nonconvergent/feasible, operation approved/amended and monitoring trigger normal/fired/acknowledged/closed.
- **Hard rejection:** Reject cho `constrained-quota-allocation-editor`, `scenario-sensitivity-modeler`, calendar scheduler or raster analysis; coupled aquifers, time-varying well-period superposition, delayed named-receptor attribution and trigger-bound operating amendments are mandatory.
- **Research anchors:** `ESRI-LAYOUT`, `CARBON-TABLE`, `WAI-FOCUS`, `WAI-STATUS`, `WAI-REFLOW`; add [USGS MODFLOW 6](https://www.usgs.gov/software/modflow-6-usgs-modular-hydrologic-model), [California DWR Groundwater Sustainability Plans](https://water.ca.gov/Programs/Groundwater-Management/SGMA-Groundwater-Management/Groundwater-Sustainability-Plans), [California DWR best-management guidance](https://water.ca.gov/Programs/Groundwater-Management/SGMA-Groundwater-Management/Best-Management-Practices-and-Guidance-Documents) and [EPA source-water protection](https://www.epa.gov/sourcewaterprotection/basic-information-about-source-water-protection).
- **Acceptance focus:** Template must schedule at least three wells across multiple periods and two connected aquifers, expose a delayed superposed breach at one named receptor, attribute it by well×pumping period, adjust one earlier rate, rerun later receptor effects and activate a receptor-specific monitoring-triggered amendment without overwriting the approved baseline.
