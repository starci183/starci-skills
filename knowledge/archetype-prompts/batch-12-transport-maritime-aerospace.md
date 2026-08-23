# Batch 12 — Transport, maritime and aerospace archetypes (20 prompts)

Tệp này là **một prompt batch tự chứa** cho regulated movement authority, transport-network authoring, live mobility control, safety-critical recovery và physical-vehicle analysis surfaces. Khi chạy ở nơi khác, đưa toàn bộ tệp cho agent để tạo đủ 20 leaf. Nếu chỉ chạy một mục, phải đưa kèm toàn bộ phần từ `Cách chạy` đến `Nguồn research dùng chung`; không tách riêng block prompt khỏi hợp đồng chung.

## Mục lục

| # | Archetype ID | Câu hỏi bố cục chính |
|---:|---|---|
| 01 | `air-traffic-separation-resolution-console` | Làm sao biến một predicted loss of separation thành clearance đã coordinate, read back và chứng minh conformance? |
| 02 | `railway-movement-authority-control-console` | Làm sao issue rồi release movement authority khi occupancy, route lock và braking envelope cùng quyết định giới hạn? |
| 03 | `rail-disruption-timetable-recovery-workbench` | Làm sao sửa một working timetable bị disruption mà không làm đứt rolling-stock, crew và platform continuity? |
| 04 | `flight-procedure-obstacle-clearance-designer` | Làm sao dựng procedure segments và protection surfaces rồi chứng minh mọi obstacle clearance và published minima? |
| 05 | `vessel-damage-stability-response-workbench` | Làm sao suy diễn progressive flooding và chọn hành động cứu ổn định mà không tạo thêm failure path? |
| 06 | `transit-network-service-pattern-authoring-workbench` | Làm sao author một public transport service từ network, stop patterns và calendars đến rider preview và valid feed? |
| 07 | `search-and-rescue-coverage-planner` | Làm sao biến uncertainty thành search effort, rồi cập nhật posterior sau mỗi lần tìm không thấy? |
| 08 | `ship-mooring-line-load-sharing-console` | Làm sao giữ tàu an toàn tại berth khi tải môi trường đổi, một dây quá tải và mọi tending action làm phân phối tải đổi theo? |
| 09 | `driver-duty-rest-compliance-planner` | Làm sao đặt trip activities vào nhiều clock driving/duty/rest để thấy chính xác lúc nào legality hỏng? |
| 10 | `aircraft-defect-deferral-disposition-workbench` | Làm sao disposition một defect theo MEL applicability, procedure bundle và rectification interval có lineage? |
| 11 | `passenger-disruption-reaccommodation-workbench` | Làm sao khôi phục contracted journey cho cả party khi replacements, access needs và entitlements xung đột? |
| 12 | `autonomous-vehicle-remote-assistance-console` | Làm sao giúp ADS thoát một exception mà human chỉ cung cấp strategic guidance, không âm thầm thành remote driver? |
| 13 | `aircraft-deicing-holdover-control-board` | Làm sao sequence treatment và takeoff khi HOT thay đổi theo weather, fluid và thời điểm bắt đầu application? |
| 14 | `airspace-volume-deconfliction-planner` | Làm sao allocate nhiều 4D volumes không giao nhau và giữ activation/amendment authority rõ ràng? |
| 15 | `rail-consist-inspection-release-workbench` | Làm sao release một ordered consist khi car position, brake proof, hazmat placement và defects đều ràng buộc toàn train? |
| 16 | `passenger-connection-protection-decision-board` | Làm sao quyết định hold hay depart bằng feeder uncertainty, transfer demand và downstream propagation? |
| 17 | `transport-demand-assignment-modeling-workbench` | Làm sao iterate OD demand qua route choice đến network loading hội tụ và calibration counts giải thích được? |
| 18 | `rolling-stock-circulation-maintenance-planner` | Làm sao giữ unit continuity qua service legs, depot và maintenance windows rồi sửa mọi broken circulation? |
| 19 | `aviation-crew-pairing-legality-workbench` | Làm sao cover flight legs bằng legal duty pairings có role, qualification, acclimatisation và rest đúng? |
| 20 | `navigation-lock-chamber-interlock-control-console` | Làm sao đưa một nhóm tàu qua buồng khóa khi water-level equalization, gate/valve interlocks và chamber occupancy quyết định từng movement? |

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

## Prompt 01 — `air-traffic-separation-resolution-console`

- **Output boundary:** `knowledge/archetypes/work/air-traffic-separation-resolution-console/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Resolve one predicted loss of separation by understanding the encounter geometry and surrounding traffic, selecting a legal tactical clearance, coordinating ownership, issuing it, verifying pilot readback and observing conformance.
- **Required region graph:** `separation-console → sector-time-control-authority-and-rule-version → conflict-pair-queue → selected-two-flight-trajectory-projection ↔ both-flight-progress-strips → legally-applicable-separation-minimum-for-that-pair-and-flight-phases → surrounding-traffic-clearance-veto → legal-tactical-clearance → coordination-and-clearance-issuance → verbatim-pilot-readback-match → observed-track-conformance-to-clearance-and-minimum → resolved-or-reopened-log`; neither predicted geometry nor an issued clearance closes the encounter without a correct readback and observed two-flight conformance.
- **Wide:** Conflict queue, trajectory projection, both flight strips, minima/context traffic, candidate comparison and clearance/readback rail remain simultaneously visible; only the trajectory stage owns bounded pan/zoom.
- **Intermediate:** The selected conflict and clearance state remain fixed while trajectory, strips and context traffic become mutually exclusive evidence views; the issue/readback rail yields after acknowledgement.
- **Compact:** Two named flights → closest-approach facts → legally applicable pair minimum → context-traffic veto → legal clearance → coordination and issue → readback match → observed conformance against both clearance and minimum → resolve or reopen; an ordered encounter proof replaces the tactical plot without dropping either flight.
- **State obligations:** Track loading/live/stale/lost, predicted/near-term/actual separation breach, minima available/uncertain, context traffic clear/blocking, candidate safe/unsafe, coordination requested/accepted/rejected, clearance draft/issued, readback correct/incorrect/missing, conformance improving/diverging, resolved/reopened and control transferred.
- **Hard rejection:** Reject cho `live-operations-command-center`, `map-led-situation-monitor`, `orbital-conjunction-assessment-workbench` hoặc `flight-dispatch-release-workbench`; exactly two controlled flights, a legally applicable operational minimum for that pair and phase, a coordinated issued clearance, matching pilot readback and measured post-clearance conformance are all mandatory, so prediction-only collision avoidance is invalid.
- **Research anchors:** `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`; add [FAA Order JO 7110.65BB — Air Traffic Control](https://www.faa.gov/regulations_policies/orders_notices/index.cfm/go/document.information/documentID/1043461) and [EUROCONTROL Medium-Term Conflict Detection specification](https://www.eurocontrol.int/publication/eurocontrol-specification-medium-term-conflict-detection-mtcd).
- **Acceptance focus:** Template must surface a predicted crossing conflict, reject one candidate because of context traffic, coordinate and issue another clearance, catch an incorrect readback, accept the correction, show increasing separation and preserve the exact pair/clearance state through all three topologies.

## Prompt 02 — `railway-movement-authority-control-console`

- **Output boundary:** `knowledge/archetypes/work/railway-movement-authority-control-console/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Establish, transmit, supervise and release one train movement authority whose safe limit derives from track occupancy, route and point locking, train integrity, speed restrictions and braking distance.
- **Required region graph:** `movement-control → control-area-operating-mode-and-rule-version → discrete-track-block-topology ↔ train-identity-position-direction-integrity-and-braking-model → route-lock-and-point-state → train-specific-moving-authority-envelope-with-speed-distance-braking-curve → occupancy-and-stop-before-limit-proof → issue-transmit-driver-acknowledgement → supervised-train-front-progression-and-rear-integrity → progressive-block-by-block-release → authority-close-or-degraded-mode-log`; a block is released only behind the proven rear of this train, never merely because a possession window ended.
- **Wide:** Block topology, selected train, route locks, authority envelope, braking/conflict evidence and transmit/acknowledgement ledger remain visible as one control surface.
- **Intermediate:** The selected train and proposed authority remain primary; topology and braking/lock evidence alternate while transmission state stays persistent until acknowledged.
- **Compact:** Named train and integrity → locked route/block chain → moving authority limit and speed-distance braking curve → stop-before-limit proof → transmit and driver acknowledgement → train-front advance → rear-clear proof → release each block progressively; a textual block chain replaces the signalling diagram.
- **State obligations:** Occupancy unknown/clear/occupied, train position fresh/stale, integrity confirmed/unknown, points normal/reverse/failed, route unlocked/setting/locked, authority proposed/conflicting/valid/transmitted/acknowledged, train stationary/moving/overrun risk, block released, authority shortened/cancelled and degraded verbal procedure active.
- **Hard rejection:** Reject cho `rail-possession-access-planner`, `dependency-topology-monitor`, `permit-to-work-isolation-control-room` hoặc `air-traffic-separation-resolution-console`; unlike time-bounded infrastructure access, this requires one identified train's moving authority envelope, train-specific braking curve, interlocked block/point state, driver acknowledgement, supervised front/rear progression and progressive rear-clear block release.
- **Research anchors:** `WAI-STATUS`, `WAI-FOCUS`, `WAI-OBSCURED`; add [ERA European Rail Traffic Management System](https://www.era.europa.eu/domains/infrastructure/european-rail-traffic-management-system-ertms_en) and [FRA Positive Train Control](https://railroads.fra.dot.gov/research-development/program-areas/train-control/ptc/positive-train-control-ptc).
- **Acceptance focus:** Template must block an authority because one point is not locked, establish the route, transmit a shortened authority, record driver acknowledgement, advance occupancy through two blocks, release the rear block and enter a recoverable degraded-mode state without losing authority lineage.

## Prompt 03 — `rail-disruption-timetable-recovery-workbench`

- **Output boundary:** `knowledge/archetypes/work/rail-disruption-timetable-recovery-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Reconstruct a feasible plan of day after a rail disruption by changing train paths while preserving rolling-stock, crew, platform and passenger-connection continuity and controlling propagated delay.
- **Required region graph:** `timetable-recovery → whole-working-timetable-version-and-disruption-boundary → all-service-time-distance-train-graph ↔ affected-and-unaffected-service-ledger → rolling-stock-circulation ↔ crew-duty-continuity ↔ platform-occupation-continuity → broken-turn-conflict-and-passenger-connection-register → network-wide-cancel-short-turn-replatform-and-retime-package → delay-propagation-simulation-across-following-services → whole-timetable-resource-feasibility-receipt → publish-handover-and-reconciliation`; no locally repaired train path is accepted until every stock, crew and platform continuation and propagated network delay is recomputed.
- **Wide:** Time-distance graph, affected services, broken resource turns, recovery package and before/after propagation stay visible; the graph alone owns two-axis overflow.
- **Intermediate:** The selected corridor/time pulse stays primary; train graph and resource circulations alternate, while the candidate package and feasibility result remain adjacent.
- **Compact:** Disruption → affected and following timetable services → broken stock chain → broken crew duty → platform occupation conflict → complete cancel/short-turn/replatform/retime package → network delay propagation → whole-timetable continuity receipt → publish; an ordered service pulse replaces the running graph without reducing recovery to one vehicle route.
- **State obligations:** Plan loading/versioned/stale, disruption open/contained/cleared, service unaffected/delayed/cancelled/short-turned, stock/crew/platform turn intact/broken, passenger connection protected/missed, candidate partial/infeasible/feasible, simulation pending/complete/diverged, plan draft/published/superseded and handover acknowledged.
- **Hard rejection:** Reject cho `fleet-route-dispatch-planner`, `calendar-resource-scheduler`, `critical-path-project-planner` hoặc `timeline-status-monitor`; this cannot normalize to assigning vehicles to stops, because one versioned whole railway timetable, time-distance paths, rolling-stock cycles, crew duties, platform occupations and network-wide delay propagation must all pass as one executable recovered plan.
- **Research anchors:** `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`; add [Network Rail timetable planning](https://www.networkrail.co.uk/industry-and-commercial/the-timetable/) and [ERA Operation and Traffic Management TSI](https://www.era.europa.eu/domains/technical-specifications-interoperability/operation-and-traffic-management-tsi_en).
- **Acceptance focus:** Template must inject a blocked segment, reveal one rolling-stock turn and one platform conflict, compare two recovery packages, reject the locally faster but globally infeasible option, publish the feasible plan and retain the same disruption/package/version across responsive morphs.

## Prompt 04 — `flight-procedure-obstacle-clearance-designer`

- **Output boundary:** `knowledge/archetypes/work/flight-procedure-obstacle-clearance-designer/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Construct and independently validate an instrument flight procedure by defining ordered segments and protection areas, evaluating terrain and obstacles, deriving minima and encoding the publishable procedure.
- **Required region graph:** `procedure-designer → aerodrome-runway-navigation-and-criteria-version → ordered-procedure-segment-model ↔ geographic-centerline-and-protection-surfaces → obstacle-and-terrain-inventory → penetration-and-required-clearance-calculation → minima-and-gradient-ledger → coded-path-and-chart-data → independent-validation-findings → approved-publication-package`; segment geometry, protection surfaces, obstacle evaluation and encoded output retain one traceable coordinate authority.
- **Wide:** Segment model, geographic construction, selected obstacle calculation, minima ledger, encoded path and validation findings remain simultaneously inspectable; the geographic construction alone owns bounded pan/zoom.
- **Intermediate:** The selected segment and its controlling obstacle remain pinned while construction, calculation and coded-output views alternate; validation status stays visible.
- **Compact:** Procedure segment → protection-area parameters → controlling obstacles → clearance/minima result → coded path → independent finding → approve/revise; a segment-by-segment numeric cross-section replaces the full geographic construction.
- **State obligations:** Criteria loading/current/superseded, segment incomplete/valid, navigation data current/stale, obstacle unassessed/clear/penetrating/controlling, clearance pass/fail, minima provisional/final, coded path invalid/valid, validation open/resolved/waived with authority, package draft/approved/published and amendment superseding.
- **Hard rejection:** Reject cho `spatial-route-itinerary-explorer`, `flight-dispatch-release-workbench`, `canvas-inspector-studio` hoặc `geospatial-raster-layer-analysis-workbench`; normative segment construction, protection surfaces, obstacle-by-surface calculation, derived minima, coded procedure data and independent validation are mandatory.
- **Research anchors:** `WAI-FOCUS`, `WAI-REFLOW`, `WAI-DRAG`; add [FAA Order 8260.3G — TERPS](https://www.faa.gov/regulations_policies/orders_notices/index.cfm/go/document.current/documentNumber/8260.3) and [ICAO Instrument Flight Procedures resources](https://www.icao.int/operational-safety/flightprocedure).
- **Acceptance focus:** Template must add one obstacle that penetrates a selected segment surface, recalculate the controlling minimum, revise geometry without drag-only input, expose the coded-data delta, close an independent validation finding and preserve coordinate/obstacle identity in compact.

## Prompt 05 — `vessel-damage-stability-response-workbench`

- **Output boundary:** `knowledge/archetypes/work/vessel-damage-stability-response-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Assess a flooding casualty, predict progressive loss of buoyancy and stability, compare closure, pumping, ballast or counter-flooding actions and issue a survivability response without creating a worse propagation path.
- **Required region graph:** `damage-stability-response → vessel-loading-and-sea-condition → watertight-compartment-topology ↔ flooding-source-opening-pump-and-closure-state → hydrostatic-heel-trim-free-surface-envelope → progressive-flooding-scenario-tree → candidate-response-sequence → action-side-effect-and-stability-forecast → commander-go-no-go-decision → executed-action-and-residual-survivability-log`; physical subdivision, dynamic flooding paths and recalculated stability jointly own the response.
- **Wide:** Compartment topology, openings/pumps, stability envelope, scenario tree and candidate response forecast remain visible; the compartment plan alone owns bounded pan/zoom.
- **Intermediate:** The selected flooding path and residual-stability summary stay primary; compartment and forecast evidence alternate while the action sequence remains editable.
- **Compact:** Casualty → affected compartment chain → active openings/pumps → current heel/trim/stability margin → candidate action and side effects → predicted residual state → command → verify; a causal compartment list and numeric envelope replace the deck plan.
- **State obligations:** Vessel data loading/stale, compartment intact/flooding/flooded, boundary open/closed/failed, pump available/running/failed, sensor confirmed/uncertain, stability safe/marginal/unsafe, progressive path dormant/active, action proposed/blocked/ordered/complete, survivability improving/worsening and abandon/continue decision recorded.
- **Hard rejection:** Reject cho `load-and-balance-packing-workbench`, `process-mass-balance-analyzer`, `live-operations-command-center` hoặc `risk-bow-tie-control-overview`; real compartment connectivity, time-varying flooding, free-surface/stability recalculation and action-induced side effects are mandatory.
- **Research anchors:** `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`; add [IMO Damage Stability](https://www.imo.org/en/ourwork/safety/pages/damagestability.aspx) and [U.S. Coast Guard Marine Safety Center technical notes](https://www.dco.uscg.mil/msc/mtn/).
- **Acceptance focus:** Template must open a failed boundary, propagate flooding to a second compartment, show one tempting counter-flood action worsen residual stability, select a closure-plus-pump sequence, record command acknowledgement and update the survivability forecast without losing the casualty snapshot.

## Prompt 06 — `transit-network-service-pattern-authoring-workbench`

- **Output boundary:** `knowledge/archetypes/work/transit-network-service-pattern-authoring-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Author a reusable fixed-route transit service by defining route geometry, ordered stops and variants, trips and service calendars, then validate operational standards and publish consistent rider-facing and machine-readable representations.
- **Required region graph:** `service-pattern-authoring → service-objective-area-and-policy-version → network-and-stop-geometry ↔ ordered-stop-pattern-and-direction-variants → trip-frequency-and-calendar-generator → block-and-interlining-dependencies → coverage-headway-load-and-equity-validation → rider-facing-map-timetable-and-exception-preview → feed-schema-and-cross-file-validation → versioned-publication`; one service specification generates both operational trips and public representations.
- **Wide:** Network geometry, stop-pattern hierarchy, trip/calendar generation, validation ledger and rider/feed previews remain visible; the network stage alone owns bounded pan/zoom.
- **Intermediate:** Selected route variant remains primary; geometry and timetable/calendar editors alternate while validation and publication state persist.
- **Compact:** Service objective → direction/variant → ordered stops → frequency/calendar → operational dependencies → policy/schema issues → rider preview → publish; an ordered stop sequence replaces the editable map and offers non-drag move controls.
- **State obligations:** Network loading/stale, stop active/temporarily closed, pattern incomplete/valid, trip/calendar generated/conflicting, frequency under/meeting standard, load/coverage/equity pass/fail, interline broken/valid, preview current/stale, feed invalid/valid, publication draft/scheduled/live/superseded and rollback available.
- **Hard rejection:** Reject cho `spatial-route-itinerary-explorer`, `calendar-resource-scheduler`, `document-outline-editor` hoặc `workflow-automation-builder`; reusable bidirectional service variants, ordered public stops, generated trips/calendars, service-standard validation and dual rider/feed publication are mandatory.
- **Research anchors:** `WAI-FOCUS`, `WAI-REFLOW`, `WAI-DRAG`; add [current GTFS Schedule Reference](https://gtfs.org/documentation/schedule/reference/) and [FTA fixed-route transit service requirements](https://www.transit.dot.gov/regulations-and-guidance/civil-rights-ada/title-vi-fixed-route-transit-requirements-video-transcript).
- **Acceptance focus:** Template must create a direction variant, insert and reorder a stop without requiring drag, generate weekday trips, expose a headway/equity issue, correct it, compare rider and feed previews, publish a version and preserve route/variant/calendar selection on compact.

## Prompt 07 — `search-and-rescue-coverage-planner`

- **Output boundary:** `knowledge/archetypes/work/search-and-rescue-coverage-planner/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Convert uncertain last-known evidence and drift into probability areas, allocate sensor-specific search effort and patterns, then update the probability distribution and next search after sightings or negative coverage.
- **Required region graph:** `sar-coverage-planner → incident-object-survival-and-environment-context → scenario-weight-and-drift-particle-surface → probability-area-segmentation ↔ search-unit-sensor-endurance-register → pattern-track-spacing-and-effort-generator → coverage-pod-pos-calculation → asset-area-assignment-and-brief → executed-track-sighting-or-negative-result → posterior-redistribution-and-next-search-plan`; probability of containment, detection and cumulative search effort change after every result.
- **Wide:** Probability surface, scenario weights, asset/sensor register, generated patterns, coverage math and assignment plan remain visible; the probability map alone owns bounded pan/zoom.
- **Intermediate:** Selected probability area stays primary; map/pattern and asset/coverage calculations alternate while briefing and cumulative POS persist.
- **Compact:** Incident evidence → scenario/drift summary → ranked probability areas → available sensor/endurance → proposed effort/pattern → POD/POS → assign/brief → result → redistributed posterior; ranked areas and track facts replace the miniature map.
- **State obligations:** Environmental data loading/stale, scenario active/discounted, drift computed/uncertain, asset available/en route/on scene/exhausted, pattern draft/assigned/executing/complete, coverage insufficient/adequate, sighting unverified/confirmed/false, negative search posted, posterior recalculating, next plan feasible/resource-short and case suspended/resolved.
- **Hard rejection:** Reject cho `fleet-route-dispatch-planner`, `map-led-situation-monitor`, `capacity-allocation-overview` hoặc `orbital-conjunction-assessment-workbench`; probabilistic drift scenarios, sensor-dependent sweep width, coverage/POD/POS math and posterior redistribution after a negative search are mandatory.
- **Research anchors:** `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`; add [U.S. Coast Guard SAROPS](https://www.dcms.uscg.mil/Our-Organization/Assistant-Commandant-for-Acquisitions-CG-9/International-Acquisition/SAROPS/) and [IMO documents relevant to SAR](https://www.imo.org/en/ourwork/safety/pages/imo-documents-relevant-to-sar.aspx).
- **Acceptance focus:** Template must combine two weighted drift scenarios, assign two different sensors, calculate unequal coverage, post a negative result that lowers one area and raises another, regenerate the next search and retain cumulative effort plus briefing lineage at every width.

## Prompt 08 — `ship-mooring-line-load-sharing-console`

- **Output boundary:** `knowledge/archetypes/work/ship-mooring-line-load-sharing-console/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Maintain one ship's safe berth restraint as wind, current and water level change by interpreting every mooring line's geometry and live load, predicting redistribution after a line or winch limit is lost and issuing safe tending or unmooring actions.
- **Required region graph:** `mooring-load-control → vessel-berth-environment-and-mooring-plan → ship-and-shore-fairlead-bollard-winch-geometry → line-identity-material-condition-and-working-load-limit → measured-line-tension-lead-angle-and-winch-brake-margin → vessel-force-and-moment-restraint-equilibrium ↔ per-line-utilization-slack-and-chafe-ledger → selected-line-failure-and-load-redistribution-cascade → snap-back-zone-and-personnel-clearance → tend-heave-pay-out-suspend-or-unmoor-command → acknowledgement-and-post-action-equilibrium → secured-hold-or-emergency-release-log`; total restraint and failure redistribution are derived from the whole physical line system, never from one alarm in isolation.
- **Wide:** Berth/vessel geometry, every identified line and winch, environmental force, load-sharing equilibrium, selected failure cascade, snap-back clearance and command acknowledgement remain visible together; only the bounded mooring plan owns pan/zoom.
- **Intermediate:** The critical line and total restraint equilibrium stay pinned; physical lead/equipment evidence and redistribution/action evidence alternate while the active command persists until acknowledged and measured.
- **Compact:** Critical named line → fairlead/bollard/winch lead → live tension versus working-load and brake margins → whole-system restraint → redistribute that line's loss → clear snap-back personnel zone → tend/pay out/heave or unmoor → acknowledgement → measured post-action equilibrium; a numbered line list replaces the berth diagram without page-level horizontal scroll.
- **State obligations:** Environment live/stale/escalating, line slack/loaded/near-limit/over-limit/damaged, lead clear/chafing/invalid, winch brake margin adequate/marginal/exceeded, restraint balanced/drifting/insufficient, failure scenario contained/cascading, snap-back zone clear/occupied/unknown, command proposed/authorized/issued/acknowledged/failed, post-action improved/worsened and berth secured/suspended/emergency-unmooring.
- **Hard rejection:** Reject cho `live-operations-command-center`, `vessel-damage-stability-response-workbench`, `finite-element-mesh-convergence-workbench` hoặc `risk-bow-tie-control-overview`; identified mooring lines and leads, line/winch limits, vessel force-and-moment load sharing, explicit single-line failure redistribution, snap-back clearance and a measured tending-command outcome are mandatory.
- **Research anchors:** `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`, `WAI-OBSCURED`; add the [IMO Safe Mooring authority and current SOLAS guidance](https://www.imo.org/en/ourwork/safety/pages/safemooring.aspx) and [OCIMF Mooring Equipment Guidelines, Fourth Edition](https://www.ocimf.org/publications/books/).
- **Acceptance focus:** Template must raise wind or current until one identified line exceeds a limit, show which other lines overload if it fails, block tending while its snap-back zone is occupied, clear the zone, issue and acknowledge a safe heave/pay-out combination, then show measured restoration of equilibrium or escalate to emergency unmooring with the same line identities at every width.

## Prompt 09 — `driver-duty-rest-compliance-planner`

- **Output boundary:** `knowledge/archetypes/work/driver-duty-rest-compliance-planner/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Build or repair a professional driver's trip-duty plan by placing driving, other work, availability, break and rest events against simultaneous daily, weekly, rolling-cycle and reset rules with exact violation provenance.
- **Required region graph:** `duty-rest-planner → driver-jurisdiction-timezone-and-rule-version → immutable-actual-duty-log → planned-trip-activity-sequence → elapsed-driving-duty-break-rest-and-cycle-clocks ↔ rule-reset-and-exception-ledger → first-violation-point-and-causal-events → compliant-rest-or-activity-alternatives → selected-plan-and-remaining-allowance → attestation-and-audit-export`; several clocks consume and reset differently over the same event sequence.
- **Wide:** Actual log, planned sequence, all clocks, violation provenance and alternative rest placements remain aligned on one time axis; only that bounded axis may scroll horizontally.
- **Intermediate:** Selected violation and clock stack stay primary; actual/planned timeline and rule evidence alternate while remaining allowance remains visible.
- **Compact:** Actual duty state → next planned activity → each active clock → first violation → rule/reset explanation → rest alternatives → selected plan → attestation; chronological events replace the multi-lane timeline.
- **State obligations:** Log loading/certified/corrected, activity actual/planned, clock available/warning/exhausted/reset-pending, break qualifying/non-qualifying, rest regular/reduced/split, exception available/used/unsupported, plan compliant/violating, correction requested/approved, attestation pending/signed and audit export ready/failed.
- **Hard rejection:** Reject cho `multi-track-timeline-editor`, `calendar-resource-scheduler`, `calculation-estimate-flow` hoặc generic timesheet; concurrent rule clocks with distinct accumulation/reset semantics, immutable actual events, first-violation provenance and compliant counterfactual rest placement are mandatory.
- **Research anchors:** `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`; add [FMCSA Interstate Truck Driver's Guide to Hours of Service](https://www.fmcsa.dot.gov/regulations/hours-service/interstate-truck-drivers-guide-hours-service) and [European Commission driving and rest times guidance](https://transport.ec.europa.eu/transport-modes/road/mobility-package-i/driving-rest-times_en).
- **Acceptance focus:** Template must show a trip legal under one clock but illegal under the rolling cycle, focus the first violating event, compare a short break with a qualifying rest, select the compliant repair, recompute every remaining allowance and preserve the certified actual log.

## Prompt 10 — `aircraft-defect-deferral-disposition-workbench`

- **Output boundary:** `knowledge/archetypes/work/aircraft-defect-deferral-disposition-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Disposition one aircraft discrepancy by establishing MEL applicability, evaluating interactions with other unserviceabilities, binding maintenance and operational procedures, starting the correct rectification interval and returning a controlled defer, repair or no-dispatch verdict.
- **Required region graph:** `defect-disposition → exact-aircraft-configuration-operation-and-mel-revision → discrepancy-facts-and-system-location → exact-mel-item-branch-condition-and-exception-proof ↔ all-concurrent-defects-and-combination-prohibition-register → branch-owned-rectification-category-start-event-and-expiry-clock → named-maintenance-procedure ↔ named-operational-procedure → placard-route-operation-and-special-approval-restrictions → independent-maintenance-signoff ↔ operational-control-signoff → controlled-deferral-rectification-or-no-dispatch-lineage`; no generic defect category may replace the exact MEL branch, and neither procedure nor either signoff can stand in for its paired owner.
- **Wide:** Discrepancy, MEL applicability, concurrent defects, expiry clock, procedure bundle, restrictions and both signoffs remain visible as one disposition surface.
- **Intermediate:** Selected MEL branch and verdict stay primary; applicability/interactions and procedure/restriction evidence alternate while the expiry/signoff rail persists.
- **Compact:** Discrepancy → exact MEL item branch and every condition/exception → all concurrent defects → category, start event and expiry → named maintenance procedure → named operational procedure plus restrictions/placard → maintenance signoff → operational-control signoff → defer, repair or no-dispatch; the branch proof replaces a generic checklist.
- **State obligations:** MEL loading/current/superseded, discrepancy open/clarified, item applicable/not listed/not applicable, concurrent interaction clear/blocking, category assigned/unknown, interval active/near-expiry/expired, procedures incomplete/complete, placard pending/applied, restriction compatible/blocking, signoff pending/signed/rejected, defer active/rectified/extended with authority and aircraft dispatchable/not dispatchable.
- **Hard rejection:** Reject cho `stage-gated-process-record`, `evidence-led-case-resolution-dossier`, `permit-to-work-isolation-control-room` hoặc `flight-dispatch-release-workbench`; the exact aircraft-specific MEL branch, full concurrent-defect combination check, branch-derived expiry clock, separately completed maintenance and operational procedures, independent maintenance and operational-control signoffs and supersedable deferral receipt are mandatory.
- **Research anchors:** `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`; add [EASA Easy Access Rules for Air Operations — MEL](https://www.easa.europa.eu/en/document-library/easy-access-rules/online-publications/easy-access-rules-air-operations?erules-id=ERULES-1963177438-11920) and [FAA AC 120-125 — MEL Management Program](https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC_120-125.pdf).
- **Acceptance focus:** Template must classify a defect, reveal a blocking interaction with an existing deferral, remove that interaction, bind distinct maintenance and operational procedures, start the correct expiry clock, collect both signoffs and retain a supersedable deferral receipt across responsive states.

## Prompt 11 — `passenger-disruption-reaccommodation-workbench`

- **Output boundary:** `knowledge/archetypes/work/passenger-disruption-reaccommodation-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Recover a disrupted passenger party by constructing replacement journey packages that satisfy individual documents, accessibility, seat, baggage and connection constraints while keeping the party together unless an explicit split is accepted.
- **Required region graph:** `reaccommodation-workbench → disruption-and-original-journey-contract → passenger-party-membership-access-document-and-assistance-constraints → original-segments-ticket-coupons-and-baggage-state → complete-origin-to-contracted-destination-replacement-package-graph → every-segment-seat-connection-and-baggage-feasibility-per-passenger → keep-party-together-or-record-explicit-member-level-split-consent → care-refund-compensation-and-assistance-ledger → selected-complete-party-recovery-package → atomic-all-passenger-rebook-reissue-or-full-rollback → notifications-and-per-passenger-party-receipts`; a candidate is not a package until every passenger and every replacement segment is feasible, and partial ticket reissue is never a successful commit.
- **Wide:** Original journey, passenger constraints, replacement graph, party/seat feasibility, assistance ledger and issue receipts remain comparable; only the bounded journey graph may pan horizontally.
- **Intermediate:** The selected party and candidate package stay pinned; journey alternatives and passenger/assistance feasibility alternate while the commit summary remains adjacent.
- **Compact:** Disruption → exact party members and original contract → non-negotiable per-passenger constraints → ranked complete all-segment journey packages → every passenger's seat/access/document/baggage proof → keep together or explicit split consent → assistance consequence → atomic rebook/reissue or rollback → individual and party receipts; a complete package sequence replaces the route graph.
- **State obligations:** Disruption loading/confirmed/changed, segment operating/cancelled/misconnected, passenger verified/document-blocked, accessibility request unmet/matched, baggage retained/transferred/unknown, seat tentative/held/expired/confirmed, connection feasible/risky/impossible, party together/split-proposed/split-consented, care due/offered/accepted, package draft/committing/partially-failed/issued and notification acknowledged.
- **Hard rejection:** Reject cho `spatial-route-itinerary-explorer`, `booking-slot-selection`, `waitlist-offer-allocation-board`, `multi-item-return-resolution` hoặc `nonlinear-task-list-application`; one disrupted transport contract, complete replacement journeys rather than loose legs, per-passenger feasibility, party-integrity or explicit split consent, assistance entitlements and all-passenger atomic rebook/reissue with rollback and receipts are mandatory.
- **Research anchors:** `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`; add [European Commission air passenger rights](https://europa.eu/youreurope/citizens/travel/passenger-rights/air/index_en.htm) and [U.S. Department of Transportation airline refunds](https://www.transportation.gov/individuals/aviation-consumer-protection/refunds).
- **Acceptance focus:** Template must cancel one segment for a three-person party, make the first replacement inaccessible for one passenger, expose a seat-hold expiry on the second, obtain explicit consent for or avoid a party split, commit one complete package, issue transport plus assistance receipts and preserve passenger/package identity at every width.

## Prompt 12 — `autonomous-vehicle-remote-assistance-console`

- **Output boundary:** `knowledge/archetypes/overview/autonomous-vehicle-remote-assistance-console/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Resolve an automated-driving-system help request by establishing the frozen vehicle state and operational-design-domain context, reviewing synchronized evidence, sending bounded strategic guidance and verifying whether the ADS safely resumes or enters a minimal-risk condition.
- **Required region graph:** `remote-assistance → exception-queue → vehicle-identity-odd-and-ads-state → frozen-help-request-and-minimal-risk-state → synchronized-scene-evidence ↔ ads-proposed-strategic-options → operator-permitted-guidance-boundary → safety-policy-and-vulnerable-road-user-check → guidance-send → ads-accept-reject-execute → resume-minimal-risk-escalate-and-event-record`; the ADS retains the dynamic driving task while the remote operator owns only a discrete, evidenced guidance transaction.
- **Wide:** Exception queue, selected vehicle/ODD state, synchronized scene evidence, ADS proposals, guidance boundary and execution acknowledgement stay visible; only the evidence viewport owns bounded pan/zoom.
- **Intermediate:** Vehicle state and help request remain pinned; scene evidence and strategic-option evidence alternate while guidance scope and minimal-risk status persist.
- **Compact:** Help request → frozen ADS/ODD state → scene facts → ADS options → permitted strategic guidance → vulnerable-road-user check → send → ADS accept/reject → resume or minimal-risk outcome; ordered evidence facts replace the miniature video wall.
- **State obligations:** Request new/triaged/claimed, telemetry live/stale/lost, scene evidence synchronized/lagging/incomplete, ADS engaged/degraded/stopped/minimal-risk, ODD inside/edge/outside, proposal available/unsafe/ambiguous, guidance draft/blocked/sent, ADS accepted/rejected/executing, vulnerable-road-user clear/uncertain/present, resume verified/failed and escalation transferred/acknowledged.
- **Hard rejection:** Reject cho `live-support-console`, `live-operations-command-center`, `fleet-route-dispatch-planner` hoặc `canvas-inspector-studio`; direct steering/braking, continuous remote driving and unbounded command are forbidden, while a frozen ADS help request, ODD proof, synchronized evidence, bounded strategic guidance and ADS execution acknowledgement are mandatory.
- **Research anchors:** `WAI-STATUS`, `WAI-FOCUS`, `WAI-OBSCURED`; add [UNECE remote-management terminology for automated driving](https://unece.org/sites/default/files/2025-09/Informal%20document-WP1-90-11rev1-e.pdf) and [UK Department for Transport automated-vehicle safety principles](https://www.gov.uk/government/consultations/automated-vehicles-statement-of-safety-principles/automated-vehicles-statement-of-safety-principles-consultation).
- **Acceptance focus:** Template must surface a stopped vehicle with stale camera evidence, block guidance until synchronization recovers, reject an option outside the ODD, send one bounded path-level instruction without steering controls, record ADS acceptance and prove either safe resume or minimal-risk escalation across all morphs.

## Prompt 13 — `aircraft-deicing-holdover-control-board`

- **Output boundary:** `knowledge/archetypes/overview/aircraft-deicing-holdover-control-board/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Control aircraft ground deicing by recording zone-complete treatment, establishing the final anti-icing start and treatment code, tracking weather-sensitive holdover allowance through taxi and releasing, reinspecting or retreating before takeoff.
- **Required region graph:** `deicing-control → winter-program-fluid-and-weather-authority → aircraft-treatment-queue → selected-aircraft-critical-surface-and-treatment-plan → zone-by-zone-application-record → anti-icing-code-and-hot-start → dynamic-hot-allowance-clock ↔ taxi-takeoff-sequence → pre-takeoff-contamination-check → release-reinspect-or-retreat → treatment-and-expiry-audit`; physical treatment completion, current precipitation/fluid limits and the takeoff sequence jointly determine protection validity.
- **Wide:** Treatment queue, aircraft zone record, live weather/fluid authority, holdover range, taxi/takeoff sequence and release decision remain visible; the queue alone owns bounded vertical density.
- **Intermediate:** Selected aircraft, treatment code and remaining allowance stay pinned; zone evidence and taxi/weather evidence alternate while the release gate remains adjacent.
- **Compact:** Aircraft → critical-surface zones → treatment completion → anti-icing start/code → current weather and holdover range → taxi delay → contamination check → release/reinspect/retreat; a time-stamped zone ledger replaces the wide control board.
- **State obligations:** Weather feed live/stale/changed-category, fluid table current/superseded, zone untreated/in-progress/complete/recontaminated, treatment code incomplete/valid, holdover not-started/active/near-limit/expired/indeterminate, taxi sequence on-time/delayed, check not-required/due/passed/failed, release blocked/granted/revoked, retreat queued/in-progress/complete and audit record reconciled.
- **Hard rejection:** Reject cho `stage-gated-process-record`, `permit-to-work-isolation-control-room`, `timeline-status-monitor` hoặc `appointment-booking-flow`; timestamped zone treatment, final anti-icing start semantics, weather-and-fluid-dependent holdover range, taxi-sequence consumption and contamination-driven reinspect/retreat are mandatory.
- **Research anchors:** `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`; add [Transport Canada current holdover-time guidelines](https://tc.canada.ca/en/aviation/general-operating-flight-rules/holdover-time-hot-guidelines-icing-anti-icing-aircraft) and [EASA ground-handling deicing rules](https://www.easa.europa.eu/en/document-library/easy-access-rules/online-publications/easy-access-rules-ground-handling?erules-id=ERULES-1963177438-23680).
- **Acceptance focus:** Template must complete two treatment zones at different times, start holdover at the final anti-icing application, change precipitation so the valid range contracts, push takeoff beyond the new limit, block release, record reinspection or retreat and retain the superseded calculation in audit history.

## Prompt 14 — `airspace-volume-deconfliction-planner`

- **Output boundary:** `knowledge/archetypes/work/airspace-volume-deconfliction-planner/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Allocate temporary four-dimensional airspace volumes by detecting space-time intersections under uncertainty, negotiating shift, resize or reroute counterfactuals and activating a non-overlapping coordinated volume set.
- **Required region graph:** `volume-deconfliction → airspace-authority-time-horizon-and-rule-version → request-register → selected-operation-lateral-polygon-altitude-floor-ceiling-and-time-interval → true-4d-volume-solid ↔ altitude-time-slice-projections ↔ pairwise-space-time-intersection-matrix → uncertainty-and-buffer-envelope → shift-resize-reroute-counterfactuals → stakeholder-coordination-and-approval → activation-amendment-or-cancellation → actual-use-containment-and-vacated-time → explicit-volume-release-and-lineage`; a 2D map overlap or calendar overlap is insufficient, and reserved capacity stays occupied until actual use ends and authority records release.
- **Wide:** Request register, 4D slice projections, pairwise intersection matrix, buffer evidence, counterfactuals and coordination state remain visible; only the bounded spatial slice owns pan/zoom.
- **Intermediate:** Selected conflict pair and active time/altitude slice stay pinned; spatial slices and matrix/counterfactual evidence alternate while approval state persists.
- **Compact:** Request → lateral polygon → altitude floor/ceiling → activation interval → exact conflicting 4D solid and overlap interval → uncertainty buffer → shift/resize/reroute → stakeholder decision → activate → actual containment/vacated evidence → authoritative release; an ordered geometry ledger replaces the map.
- **State obligations:** Request draft/submitted/changed, geometry invalid/valid, interval proposed/coordinated/active/released, buffer complete/insufficient, intersection none/potential/confirmed, counterfactual infeasible/clear/new-conflict, stakeholder pending/accepted/rejected, activation scheduled/live/aborted, actual containment nominal/deviating and amendment superseded.
- **Hard rejection:** Reject cho `orbital-conjunction-assessment-workbench`, `air-traffic-separation-resolution-console`, `capacity-allocation-overview`, `calendar-resource-scheduler` hoặc `map-led-situation-monitor`; true lateral-plus-vertical-plus-time solids, pairwise 4D intersection, uncertainty buffers, negotiated geometry/time counterfactuals, activation and actual-use/vacated evidence followed by authoritative release are mandatory.
- **Research anchors:** `WAI-FOCUS`, `WAI-REFLOW`, `WAI-DRAG`; add [EASA U-space rules for four-dimensional volumes](https://www.easa.europa.eu/en/document-library/easy-access-rules/online-publications/easy-access-rules-u-space?erules-id=ERULES-1963177438-21046) and [EUROCONTROL airspace-management service](https://www.eurocontrol.int/service/airspace-management).
- **Acceptance focus:** Template must overlap two requested volumes only during one altitude-time slice, show the uncertainty buffer as the true conflict cause, offer keyboard-operable shift and resize alternatives, reject the option creating a third-party conflict, coordinate and activate the clear option, then record actual release.

## Prompt 15 — `rail-consist-inspection-release-workbench`

- **Output boundary:** `knowledge/archetypes/work/rail-consist-inspection-release-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Reconcile an ordered train consist, prove brake-test continuity, resolve car-specific defects and dangerous-goods placement constraints and issue a whole-train release or restriction with role signoffs.
- **Required region graph:** `consist-release → train-identity-route-and-operating-rule-set → exact-ordered-physical-locomotive-and-car-chain → position-bound-car-identity-load-and-dangerous-goods-register → end-to-end-brake-pipe-and-tested-car-coverage-map ↔ car-defect-and-restriction-ledger → order-dependent-dangerous-goods-separation-and-placement-proof → reorder-couple-or-uncouple-change-impact → retest-and-continuous-brake-coverage-restoration → whole-train-readiness → independent-role-signoffs → one-global-release-restriction-or-rebuild-lineage`; moving, adding or removing any physical car invalidates affected coverage and placement proof until recomputed for the complete ordered train.
- **Wide:** Ordered consist, selected-car facts, brake coverage, defects/restrictions, dangerous-goods placement and global platform/readiness/signoffs remain visible; only the consist strip owns bounded longitudinal overflow.
- **Intermediate:** Selected car position and whole-train readiness stay pinned; consist/brake evidence and defect/placement evidence alternate while signoff state persists.
- **Compact:** Train identity → numbered locomotive/car chain → selected physical car and position → continuous brake-test coverage boundary → defect/restriction → order-dependent dangerous-goods placement → reorder impact and required retest → whole-train readiness → role signoffs → one global release/restrict/rebuild verdict; numbered positions replace the consist diagram.
- **State obligations:** Consist loading/reconciled/mismatched, car identity verified/unknown/duplicate, position planned/actual/moved, brake test not-run/partial/passed/failed/expired, defect open/deferred/repaired, restriction compatible/blocking, dangerous-goods document missing/valid, placement pass/fail, readiness incomplete/conditional/ready, signoff pending/signed/rejected and release active/revoked/superseded.
- **Hard rejection:** Reject cho `stage-gated-process-record`, `regulatory-filing-package-validator`, `chain-of-custody-transfer-ledger` hoặc `permit-to-work-isolation-control-room`; exact ordered physical locomotives/cars, end-to-end brake-test coverage that changes with formation, car-position dangerous-goods separation, car-specific restrictions and a single whole-train global release with independent signoffs are mandatory.
- **Research anchors:** `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`; add [Federal Railroad Administration hazardous-materials and consist information](https://railroads.fra.dot.gov/railroad-safety/divisions/hazardous-materials/hazardous-materials) and [ERA Operation and Traffic Management TSI](https://www.era.europa.eu/domains/technical-specifications-interoperability/operation-and-traffic-management-tsi_en).
- **Acceptance focus:** Template must reconcile an out-of-order car, reveal a brake-test coverage break after the move, detect a dangerous-goods placement violation, repair both without losing car identity, collect two distinct role signoffs and issue a conditional or full train release whose lineage survives compact morphing.

## Prompt 16 — `passenger-connection-protection-decision-board`

- **Output boundary:** `knowledge/archetypes/overview/passenger-connection-protection-decision-board/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Decide whether one connecting service should hold or depart by comparing uncertain feeder arrival and accessible transfer feasibility against stranded-passenger benefit, downstream delay propagation and operating authority.
- **Required region graph:** `connection-protection → one-imminent-feeder-to-connecting-service-pair → interchange-policy-live-clock-and-named-decision-authority → feeder-arrival-uncertainty → transfer-cohorts-by-accessible-route-and-measured-transfer-time → connecting-service-ready-state-scheduled-departure-and-next-option → explicit-hold-or-depart-decision-deadline → protected-vs-stranded-cohort-effect ↔ downstream-delay-resource-and-passenger-propagation → authority-bounded-hold-or-depart-command → acknowledgement-before-expiry → measured-transfer-count-and-actual-departure-delay-outcome`; the board owns exactly one expiring operational choice and must compare the accessible cohort separately from faster transfer passengers.
- **Wide:** Feeder uncertainty, transfer cohorts, departure/next-option facts, hold candidates, protected-versus-propagated effects and instruction authority remain visible on one decision board.
- **Intermediate:** The selected connection and decision deadline stay pinned; transfer feasibility and downstream consequence evidence alternate while the authorized instruction remains adjacent.
- **Compact:** One feeder/connection pair → live arrival range → accessible and standard cohorts with measured transfer times → scheduled departure/next option → decision deadline countdown → hold versus depart effects → named authority limit → issue and acknowledge before expiry → measured transferred/stranded count and actual departure delay; a numeric decision ladder replaces the station map.
- **State obligations:** Feeder estimate live/stale/widening, cohort count known/estimated, accessible path open/blocked/unknown, transfer feasible/marginal/impossible, departure on-time/ready/held/gone, candidate within/outside authority, downstream effect low/high/uncertain, decision pending/authorized/expired/superseded, instruction issued/acknowledged/declined and actual transfer complete/partial/missed.
- **Hard rejection:** Reject cho `rail-disruption-timetable-recovery-workbench`, `calendar-resource-scheduler`, `asynchronous-outcome-tracker` hoặc `spatial-route-itinerary-explorer`; this is one imminent hold/depart command with an expiring deadline, a separately measured accessible-transfer cohort, explicit downstream propagation, named operating authority, acknowledgement and observed passenger plus departure-delay outcome—not timetable or network replanning.
- **Research anchors:** `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`; add [Network Rail Delay Attribution Principles and Rules](https://www.networkrail.co.uk/wp-content/uploads/2025/06/April-2025-DAPR.pdf) and [FTA STOPS timed-transfer guidance](https://www.transit.dot.gov/sites/fta.dot.gov/files/2024-09/STOPS-User-Guide-v2-53-v.pdf).
- **Acceptance focus:** Template must widen a feeder-arrival estimate across the decision deadline, separate an accessible-transfer cohort from faster walkers, compare depart-now with two hold durations, reject a hold whose downstream harm dominates, issue the authorized choice before expiry and display the measured transfer/service outcome.

## Prompt 17 — `transport-demand-assignment-modeling-workbench`

- **Output boundary:** `knowledge/archetypes/work/transport-demand-assignment-modeling-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Calibrate and compare transport demand assignment by loading network supply and origin-destination demand, generating route-choice sets, iterating flows toward convergence and reconciling modeled link volumes against observed counts.
- **Required region graph:** `demand-assignment-model → model-purpose-period-and-version → network-supply-cost-and-capacity-graph ↔ origin-destination-demand-cube → route-choice-and-path-set-builder → iterative-assignment-and-cost-feedback-loop → convergence-and-gap-diagnostics → modeled-link-flow-vs-observed-count-residuals → demand-cost-or-capacity-calibration → base-and-scenario-comparison → validated-model-release`; OD demand, congested network costs, chosen paths and observed-count residuals participate in one reproducible equilibrium loop.
- **Wide:** Supply network, OD slice, path set, iteration diagnostics, modeled-versus-observed residuals and scenario comparison remain inspectable; only the network viewport and bounded diagnostic table may own local overflow.
- **Intermediate:** Selected OD pair/link and current iteration stay pinned; network/path evidence and convergence/calibration evidence alternate while release fitness remains visible.
- **Compact:** Model purpose → demand slice and supply assumptions → candidate paths → iteration cost/flow feedback → convergence gap → worst observed-count residuals → calibration change → base/scenario delta → validate/reject; ranked link/OD facts replace the miniature map.
- **State obligations:** Supply loading/current/stale, OD matrix missing/calibrated/changed, path set empty/generated/pruned, iteration queued/running/converged/diverged/cancelled, cost feedback stable/oscillating, count observation valid/suspect/excluded, residual within/outside threshold, calibration proposed/applied/rolled-back, scenario comparable/incompatible and model draft/validated/released/superseded.
- **Hard rejection:** Reject cho `pivot-table-analytics-workbench`, `scenario-sensitivity-explorer`, `process-mass-balance-analyzer` hoặc `map-led-situation-monitor`; a transport supply graph, OD demand cube, endogenous route-choice/cost feedback, iterative convergence proof and modeled-versus-observed link residual calibration are mandatory.
- **Research anchors:** `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`; add [FHWA dynamic traffic assignment modeling guidance](https://ops.fhwa.dot.gov/publications/fhwahop13015/sec4.htm) and [UK Department for Transport TAG assignment-modeling guidance](https://www.gov.uk/government/publications/tag-unit-m3-1-highway-assignment-modelling).
- **Acceptance focus:** Template must assign one OD slice across competing paths, show congestion changing generalized costs on the next iteration, fail an initial convergence threshold, expose the largest observed-count residual, apply a reversible calibration, converge and compare a scenario without overwriting the validated base run.

## Prompt 18 — `rolling-stock-circulation-maintenance-planner`

- **Output boundary:** `knowledge/archetypes/work/rolling-stock-circulation-maintenance-planner/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Build a feasible multi-day circulation of physical rolling-stock units across service legs, coupling and splitting events, depot transitions, cleaning and maintenance windows, then resolve continuity and coverage gaps before release.
- **Required region graph:** `circulation-planner → operating-plan-horizon-and-fleet-policy → service-leg-and-required-formation-graph → named-physical-unit-roster-capability-and-due-state → identity-preserving-unit-to-service-leg-chains ↔ couple-split-and-formation-membership-events → arrival-to-depot-path-and-stabling-position → unit-specific-cleaning-inspection-and-maintenance-window → depot-exit-to-next-service-continuity → broken-unit-chain-and-formation-coverage-gaps → identity-specific-swap-or-resequence-scenarios → whole-circulation-release-and-depot-handoff`; a fleet type or anonymous spare can never substitute for the named unit whose service, formation, depot and maintenance history must remain continuous.
- **Wide:** Service-leg requirements, parallel unit chains, formation events, depot/maintenance windows, broken continuity and swap scenarios remain aligned; only the bounded circulation canvas owns horizontal overflow.
- **Intermediate:** Selected unit and broken transition stay pinned; circulation-chain and depot/maintenance evidence alternate while formation and coverage status persist.
- **Compact:** Uncovered service formation → named candidate unit → prior service arrival → couple/split membership → depot path and stabling position → that unit's maintenance due-state/window → depot exit and next service → downstream coverage after swap/resequence → complete identity chain → release/handoff; a unit-centered event sequence replaces the Gantt.
- **State obligations:** Operating plan loading/versioned, unit available/in-service/stabled/failed, capability compatible/incompatible, leg covered/uncovered, connection feasible/tight/broken, coupling/splitting planned/confirmed/failed, maintenance not-due/due/overdue/completed, depot capacity available/full, swap proposed/feasible/new-gap, circulation draft/feasible/released/superseded and depot handoff pending/acknowledged.
- **Hard rejection:** Reject cho `calendar-resource-scheduler`, `fleet-route-dispatch-planner`, `critical-path-project-planner` hoặc `inventory-replenishment-planner`; this cannot become type-level capacity assignment, because every named physical unit must retain identity through service legs, coupling/splitting formation membership, depot/stabling transitions, unit-specific maintenance due-state, next-service coverage and whole-circulation release.
- **Research anchors:** `WAI-FOCUS`, `WAI-REFLOW`, `WAI-DRAG`; add [ERA Telematics Applications TSI](https://www.era.europa.eu/content/new-telematics-applications-tsi-enters-force) and [Network Rail timetable planning](https://www.networkrail.co.uk/industry-and-commercial/the-timetable/).
- **Acceptance focus:** Template must break one unit chain with an overdue maintenance window, show why a visually nearby spare lacks the required capability, perform a keyboard-operable swap that creates and then resolves a downstream formation gap, release a feasible circulation and preserve unit identity in depot handoff.

## Prompt 19 — `aviation-crew-pairing-legality-workbench`

- **Output boundary:** `knowledge/archetypes/work/aviation-crew-pairing-legality-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Construct a legal set of multi-role aviation crew pairings that covers every flight leg while respecting base, qualification, positioning, connection, acclimatisation, flight-duty, rest and cumulative-duty constraints.
- **Required region graph:** `crew-pairing → schedule-rule-version-bases-and-planning-horizon → every-flight-leg-by-required-captain-first-officer-and-cabin-role-slot → individual-crew-base-qualification-recency-and-availability → candidate-multi-leg-duty-and-pairing-builder → per-person-flight-duty-rest-acclimatisation-and-timezone-clocks → deadhead-positioning-and-connection-feasibility-per-person → pairing-cost-robustness-and-set-level-role-coverage-matrix → selected-pairing-set-with-no-uncovered-or-double-owned-role → every-member-legality-proof → roster-handoff`; set coverage is invalid if any required leg-role is open, even when each individual duty is legal, and individual legality is invalid without feasible positioning.
- **Wide:** Flight-leg coverage network, eligible crew, candidate duty blocks, legality clocks, positioning, coverage matrix and selected pairings remain comparable; only the bounded leg-time axis owns horizontal overflow.
- **Intermediate:** Selected uncovered leg and candidate duty stay pinned; coverage/qualification and clock/positioning evidence alternate while set-level completeness persists.
- **Compact:** Uncovered flight-leg role → eligible named crew by role/qualification/base → proposed multi-leg duty → that person's acclimatisation and duty/rest clocks → deadhead/positioning connection → individual legality → add pairing to set → recompute every remaining or double-covered role → complete set proof → handoff; an ordered duty proof replaces the network.
- **State obligations:** Schedule loading/versioned, leg-role uncovered/covered/overcovered, crew available/unavailable, qualification current/expired/missing, duty draft/legal/illegal, acclimatisation known/unknown/changed, flight-duty clock available/warning/exceeded, rest qualifying/insufficient, positioning confirmed/missed, pairing selected/rejected, coverage set incomplete/complete and roster handoff pending/accepted/returned.
- **Hard rejection:** Reject cho `driver-duty-rest-compliance-planner`, `calendar-resource-scheduler`, `dual-list-transfer` hoặc `critical-path-project-planner`; unlike one driver's clock repair, this requires set-level coverage of every captain/first-officer/cabin role on every flight leg plus each named person's base, qualification, recency, acclimatisation, duty/rest legality, deadhead positioning and a complete no-gap pairing-set proof.
- **Research anchors:** `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`; add [EASA flight-time limitations rules](https://www.easa.europa.eu/en/document-library/easy-access-rules/online-publications/easy-access-rules-air-operations?erules-id=ERULES-1963177438-11941) and [U.S. eCFR Part 117 flight and duty limitations](https://www.ecfr.gov/current/title-14/chapter-I/subchapter-G/part-117).
- **Acceptance focus:** Template must expose one uncovered captain role, filter out a crew member with expired recency, build a duty that first fails after a time-zone/acclimatisation change, repair it with a feasible deadhead and rest placement, complete all leg-role coverage and hand off the selected set with legality proof.

## Prompt 20 — `navigation-lock-chamber-interlock-control-console`

- **Output boundary:** `knowledge/archetypes/work/navigation-lock-chamber-interlock-control-console/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Transit one selected vessel group between unequal water levels by controlling a navigation lock's chamber, gates and filling or emptying valves, permitting each movement only after occupancy, mooring, hydraulic-head and equipment interlocks prove it safe.
- **Required region graph:** `navigation-lock-control → lockage-direction-operating-authority-and-equipment-version → selected-vessel-group-dimensions-and-approach-clearance → chamber-occupancy-and-secure-mooring-proof → upstream-downstream-and-chamber-water-levels → upper-lower-gate-and-filling-emptying-valve-interlock-matrix → eligible-fill-or-empty-command → hydraulic-head-equalization-and-gate-load-verification → eligible-gate-open-command → vessel-enter-or-exit-movement-authority → chamber-clear-equipment-reset-and-water-use-receipt → completed-held-or-aborted-cycle-lineage`; no vessel movement or gate opening exists outside the physical water-level state and mutually exclusive gate/valve interlocks.
- **Wide:** Lock section, selected vessel group, chamber occupancy/mooring, all water levels, gate/valve interlock matrix, active hydraulic step and movement command remain visible as one control surface.
- **Intermediate:** Chamber occupancy, head differential and the single eligible command stay pinned; physical section and detailed equipment/interlock evidence alternate while the issued movement authority persists to acknowledgement.
- **Compact:** Vessel group and direction → chamber occupancy/mooring → upstream/downstream/chamber levels → upper/lower gate and fill/empty valve states → only eligible hydraulic command → head equalization proof → only eligible gate/movement command → chamber-clear reset and cycle receipt; a semantic equipment-state sequence replaces the lock diagram without horizontal page scroll.
- **State obligations:** Vessel group waiting/entering/moored/exiting/clear, chamber empty/occupied/unknown, mooring unconfirmed/secure/released, water-level sensor live/stale/disagreeing, head differential unsafe/equalizing/equalized, upper/lower gate open/closed/moving/faulted, fill/empty valve open/closed/moving/faulted, interlock satisfied/blocked/bypassed-with-authority, command proposed/issued/acknowledged/failed, cycle active/held/aborted/complete and equipment reset pending/verified.
- **Hard rejection:** Reject cho `guided-setup-checklist`, `workflow-automation-builder`, `railway-movement-authority-control-console` hoặc `reservoir-release-rule-curve-coordinator`; one physical navigation-lock chamber, unequal pool/chamber levels, mutually exclusive upper/lower gate and fill/empty valve states, hydraulic equalization, vessel occupancy/mooring, gate-load verification and movement-gated cycle completion are mandatory.
- **Research anchors:** `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`, `WAI-OBSCURED`; add [U.S. Army Corps of Engineers — How Navigation Locks Operate](https://www.publications.usace.army.mil/Portals/76/Publications/EngineerPamphlets/EP_870-1-20.pdf) and [PIANC InCom WG 206 — Design of Navigation Locks](https://www.pianc.org/publication/design-of-navigation-locks/).
- **Acceptance focus:** Template must select an upbound or downbound vessel group, prove chamber entry and secure mooring, block the opposite gate while hydraulic head remains unsafe, issue the eligible fill or empty command, verify equalization before opening the exit gate, acknowledge vessel exit, then produce a chamber-clear cycle receipt or preserve a recoverable abort when a level sensor disagrees.
