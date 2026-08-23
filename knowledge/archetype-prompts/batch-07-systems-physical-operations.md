# Batch 07 — Systems and physical operations archetypes (20 prompts)

Tệp này là **một prompt batch tự chứa** cho infrastructure diagnosis, software operations, planning và physical execution surfaces. Khi chạy ở nơi khác, đưa toàn bộ tệp cho agent để tạo đủ 20 leaf. Nếu chỉ chạy một mục, phải đưa kèm toàn bộ phần từ `Cách chạy` đến `Nguồn research dùng chung`; không tách riêng block prompt khỏi hợp đồng chung.

## Mục lục

| # | Archetype ID | Câu hỏi bố cục chính |
|---:|---|---|
| 01 | `certificate-trust-path-validator` | Làm sao giải thích chính xác vì sao một certificate pass hoặc fail cho endpoint hiện tại? |
| 02 | `dns-resolution-path-inspector` | Làm sao trace một DNS question qua hops, delegations, caches và DNSSEC proof? |
| 03 | `consensus-replication-state-monitor` | Làm sao biết replicated cluster còn quorum, member nào lag và action nào an toàn? |
| 04 | `event-stream-partition-lag-inspector` | Làm sao giải thích consumer delay từ partition ownership, offsets và rebalance history? |
| 05 | `slo-error-budget-burn-console` | Làm sao quyết định release hay reliability work dựa trên error budget và burn windows? |
| 06 | `progressive-rollout-gate-console` | Làm sao tăng exposure qua cohorts chỉ khi live guardrails pass và rollback còn deterministic? |
| 07 | `version-control-history-rewrite-workbench` | Làm sao rewrite commit DAG, resolve conflicts và preview graph mới trước khi update refs? |
| 08 | `entity-resolution-cluster-adjudicator` | Làm sao quyết định noisy records thuộc cùng entity, rồi merge/split và synthesize canonical outcome? |
| 09 | `event-stream-replay-projection-workbench` | Làm sao replay immutable events và tìm projection đầu tiên vi phạm invariant? |
| 10 | `software-regression-bisect-workbench` | Làm sao thu hẹp good/bad revision interval bằng executable evidence tới culprit commit? |
| 11 | `critical-path-project-planner` | Làm sao author dependencies/durations và điều chỉnh float tới khi milestones khả thi? |
| 12 | `inventory-replenishment-planner` | Làm sao chuyển demand, stock và lead-time evidence thành replenishment actions? |
| 13 | `traffic-signal-phase-timing-workbench` | Làm sao author một signal plan theo ring/barrier, detector demand và pedestrian clearance mà không tạo movement conflict? |
| 14 | `fleet-route-dispatch-planner` | Làm sao assign vehicles/jobs, optimize multiple routes và dispatch live changes? |
| 15 | `warehouse-pick-wave-planner` | Làm sao group warehouse tasks thành capacity/time/zone-bounded waves rồi release? |
| 16 | `dock-yard-door-dispatch-board` | Làm sao coordinate arrivals, yard positions, dock doors và trailer moves? |
| 17 | `permit-to-work-isolation-control-room` | Làm sao authorize hazardous work chỉ khi isolations, tests, competence và rescue controls còn valid? |
| 18 | `load-and-balance-packing-workbench` | Làm sao place cargo mà vẫn giữ weight, center-of-gravity, compatibility và unload order? |
| 19 | `chain-of-custody-transfer-ledger` | Làm sao execute repeated custody transfers và giữ current custodian cùng seal/condition provenance? |
| 20 | `cycle-count-variance-reconciliation-workbench` | Làm sao chạy blind counts, controlled recounts và approved inventory adjustments? |

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

## Prompt 01 — `certificate-trust-path-validator`

- **Output boundary:** `knowledge/archetypes/support/certificate-trust-path-validator/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Explain exactly why a certificate succeeds or fails for one endpoint, policy and trust store.
- **Required region graph:** `trust-validator → endpoint-and-verification-context → candidate-certificate-chains → selected-trust-path → per-certificate-fields-and-validity → hostname-keyusage-policy-checks → revocation-and-transparency-evidence → failure-locus → remediation`; selected chain and parallel validation checks jointly own the verdict.
- **Wide:** Candidate chain, selected-certificate detail and validation checks remain visible.
- **Intermediate:** Chain summary persists while fields and checks alternate.
- **Compact:** Verdict → first failed check → trust path → certificate detail → remediation; Back restores the failed check.
- **State obligations:** endpoint loading, chain absent/multiple, certificate valid/expired/not-yet-valid, hostname mismatch, usage invalid, revocation unknown/revoked, trust anchor missing, policy pass/fail and retry.
- **Hard rejection:** Reject cho effective-setting provenance, generic dependency graph, credential rotation or record detail; certification path plus cryptographic/time/revocation checks are mandatory.
- **Research anchors:** `VSCODE-UX`, `WAI-TREEGRID`, `WAI-FOCUS`, `WAI-REFLOW`, `WAI-STATUS`; add [IETF RFC 5280](https://www.rfc-editor.org/rfc/rfc5280) and [NIST TLS guidance](https://csrc.nist.gov/pubs/sp/800/52/r2/final).
- **Acceptance focus:** Template must select alternate chains, locate the first failing check, expose every verdict textually and preserve exact certificate/check context across responsive panes.

## Prompt 02 — `dns-resolution-path-inspector`

- **Output boundary:** `knowledge/archetypes/support/dns-resolution-path-inspector/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Trace one DNS question through recursive hops, delegations, caches and DNSSEC proof to locate a failure or unexpected answer.
- **Required region graph:** `dns-inspector → query-and-network-context → recursive-hop-sequence → delegation-and-authority-tree ↔ rrset-evidence → dnssec-proof-chain → timing-and-cache-status → failure-locus → retry-or-export`; delegation hierarchy, RRsets and proof chain are separate owners.
- **Wide:** Resolution path/tree, RRsets and timing/proof evidence remain visible.
- **Intermediate:** Resolution path is primary; RRset and proof detail become a drawer.
- **Compact:** Verdict → ordered hops → selected delegation/RRset → DNSSEC proof → timing/cache → retry.
- **State obligations:** query pending/timeout, cache hit/miss/stale, delegation valid/lame, RRset empty/conflicting, DNSSEC secure/insecure/bogus/indeterminate, network failure and retry.
- **Hard rejection:** Reject cho distributed trace, streaming logs, certificate path or generic network topology; DNS delegation authority and RRset/DNSSEC semantics must dominate.
- **Research anchors:** `VSCODE-UX`, `WAI-TREEGRID`, `WAI-FOCUS`, `WAI-REFLOW`, `WAI-STATUS`; add [IETF RFC 1034](https://www.rfc-editor.org/rfc/rfc1034) and [ICANN Root Server System](https://www.icann.org/root-server-system-en).
- **Acceptance focus:** Template must step through hops, inspect RRsets/proofs, simulate cache and DNSSEC failures and provide a linear text route equivalent to the tree.

## Prompt 03 — `consensus-replication-state-monitor`

- **Output boundary:** `knowledge/archetypes/overview/consensus-replication-state-monitor/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Determine whether a replicated cluster can safely commit, which member lags and what membership or leadership action preserves quorum.
- **Required region graph:** `replication-monitor → cluster-and-term-context → quorum-health → member-role-and-commit-index-matrix → leader-log-progression → replication-lag → election-timeline → selected-member-evidence → safe-membership-or-leadership-action`; quorum, term and commit index govern all actions.
- **Wide:** Quorum summary, member matrix and log/election progression remain visible.
- **Intermediate:** Member matrix is primary; member evidence becomes temporary while quorum invariant persists.
- **Compact:** Quorum verdict → lagging members → commit indices/log gap → election evidence → safe action.
- **State obligations:** leader known/unknown, quorum healthy/lost/at-risk, member voter/learner/offline, term changed, lag normal/high, election in progress, membership action unsafe/pending/success and stale data.
- **Hard rejection:** Reject cho generic operations command center, dependency monitor, portfolio matrix or log console; consensus term/quorum/commit invariants are required.
- **Research anchors:** `CARBON-GRID`, `WAI-GRID`, `WAI-FOCUS`, `WAI-REFLOW`, `WAI-STATUS`; add [etcd Raft glossary](https://etcd.io/docs/v3.7/learning/glossary/) and [Apache Kafka replication](https://kafka.apache.org/documentation/#design_replicatedlog).
- **Acceptance focus:** Template must simulate leader/member changes, calculate quorum safety, explain lag with indices and block a membership action that would violate quorum.

## Prompt 04 — `event-stream-partition-lag-inspector`

- **Output boundary:** `knowledge/archetypes/overview/event-stream-partition-lag-inspector/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Explain consumer delay through partition ownership, log-end versus committed offsets and rebalance history.
- **Required region graph:** `lag-inspector → topic-and-consumer-group-context → partition-ownership-matrix → log-end-vs-committed-offsets → lag-heatmap-and-trends → rebalance-timeline → selected-partition-record-sample → reset-or-reassign-consequence`; partition coordinates and two offset positions own lag.
- **Wide:** Partition grid, lag curves and rebalance evidence remain visible.
- **Intermediate:** Lag-ranked partition table is primary; sample/detail becomes temporary.
- **Compact:** Lag summary → ranked partitions → selected offset trajectory → owner/rebalance evidence → safe action.
- **State obligations:** group loading/empty, partition assigned/unassigned, consumer healthy/dead, lag rising/stable/recovering, rebalance active, sample unavailable, reset consequence safe/unsafe and action pending.
- **Hard rejection:** Reject cho streaming raw logs, timeline status, SLO console or distributed trace; partition ownership and committed/log-end offset relationships are mandatory.
- **Research anchors:** `CARBON-GRID`, `WAI-GRID`, `WAI-FOCUS`, `WAI-REFLOW`, `WAI-STATUS`; add [Apache Kafka 4.3 monitoring](https://kafka.apache.org/43/operations/monitoring/) and [AWS MSK best practices](https://docs.aws.amazon.com/msk/latest/developerguide/bestpractices.html).
- **Acceptance focus:** Template must rank lagging partitions, synchronize owner/offset/rebalance evidence and preview a reset/reassignment consequence without hiding other affected partitions.

## Prompt 05 — `slo-error-budget-burn-console`

- **Output boundary:** `knowledge/archetypes/overview/slo-error-budget-burn-console/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Decide whether release activity or reliability work must change from windowed SLI, remaining error budget and multi-window burn rates.
- **Required region graph:** `slo-console → service-objective-and-window → sli-definition → good-vs-total-event-series → remaining-error-budget → multiwindow-burn-rates → breach-contributors-and-incidents → error-budget-policy-action → decision-record`; budget and short/long burn windows jointly own the policy action.
- **Wide:** Remaining budget, short/long burn views and contributor evidence remain visible.
- **Intermediate:** Budget and burn are primary; contributor detail becomes a drawer.
- **Compact:** Budget verdict → fast burn → slow burn → contributors → policy action and decision receipt.
- **State obligations:** SLI loading/gap, budget healthy/warning/exhausted, fast/slow burn active/clear, contributor selected, policy action recommended/overridden, decision pending/recorded and window changed.
- **Hard rejection:** Reject cho statistical process control, live incident command, generic KPI dashboard or capacity overview; a contractual rolling budget with multi-window burn is invariant.
- **Research anchors:** `CARBON-GRID`, `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`, `WAI-APG`; add [Google SRE alerting on SLOs](https://sre.google/workbook/alerting-on-slos/) and [Prometheus alerting rules](https://prometheus.io/docs/practices/rules/).
- **Acceptance focus:** Template must recalculate budget/burn, correlate one contributor, produce a textual chart equivalent and record a policy decision without color-only meaning.

## Prompt 06 — `progressive-rollout-gate-console`

- **Output boundary:** `knowledge/archetypes/flow/progressive-rollout-gate-console/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Shift exposure from an old version to a new version across cohorts only when live guardrails pass, with deterministic promotion and rollback.
- **Required region graph:** `rollout-console → release-and-version-context → desired-and-current-traffic-split → rollout-cohorts-or-rings → live-guardrail-comparison → per-cohort-health → promotion-or-rollback-gate → verification-and-receipt`; exposure, cohorts and guardrails jointly own the transaction.
- **Wide:** Traffic/cohort progression, guardrails and gate actions remain visible.
- **Intermediate:** Current cohort and guardrails remain primary; prior cohorts collapse into history.
- **Compact:** Current cohort/exposure → gate metrics → exceptions → promote or rollback → verification; history remains reachable.
- **State obligations:** old-only, canary active, cohort healthy/degraded/unknown, guardrail pending/pass/fail, promotion locked/pending/success, rollback available/running/failure, verification and receipt.
- **Hard rejection:** Reject cho credential rotation/cutover, generic deployment monitor, stage-gated record or workflow builder; reversible exposure gradients, simultaneously comparable treatment/control cohorts and statistical live guardrails own progression—not dependency migration toward one fixed cutover instant.
- **Research anchors:** `FLUENT-LAYOUT`, `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`, `WAI-DRAG`; add [Kubernetes rolling update](https://kubernetes.io/docs/tasks/run-application/update-deployment-rolling/) and [Argo Rollouts canary](https://argo-rollouts.readthedocs.io/en/stable/features/canary/).
- **Acceptance focus:** Template must change exposure, block promotion on failed guardrails, execute rollback and preserve cohort/metric/focus state across compact transformations.

## Prompt 07 — `version-control-history-rewrite-workbench`

- **Output boundary:** `knowledge/archetypes/work/version-control-history-rewrite-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Transform an ordered commit DAG safely, resolve rewrite conflicts and preview the resulting graph before updating references.
- **Required region graph:** `history-rewrite → branch-base-and-upstream-context → before-commit-dag → ordered-rewrite-todo → selected-commit-operation → conflict-resolution → after-dag-preview → downstream-public-impact → apply-and-reflog-recovery`; commit order and before/after graph own the transaction.
- **Wide:** Before DAG, rewrite todo/conflict and after preview remain visible.
- **Intermediate:** Todo/conflict is primary; before/after graphs alternate with selected commit preserved.
- **Compact:** Commit → operation → conflict if any → resulting order → public-impact review → apply; reorder has button/menu parity.
- **State obligations:** history loading, commit pick/reword/squash/drop/reorder, conflict open/resolved, after preview stale, published-impact warning, apply pending/failure/success, abort and reflog recovery.
- **Hard rejection:** Reject cho generic diff reconciliation, document outline, workflow automation or audit timeline; an ordered commit-DAG transformation and ref recovery are mandatory.
- **Research anchors:** `VSCODE-UX`, `WAI-DRAG`, `WAI-FOCUS`, `WAI-REFLOW`, `WAI-STATUS`; add [Git interactive rebase](https://git-scm.com/docs/git-rebase) and [GitHub about rebase](https://docs.github.com/en/get-started/using-git/about-git-rebase).
- **Acceptance focus:** Template must reorder/squash by keyboard controls, simulate conflict/abort, preview the after graph and retain recovery context before applying.

## Prompt 08 — `entity-resolution-cluster-adjudicator`

- **Output boundary:** `knowledge/archetypes/work/entity-resolution-cluster-adjudicator/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Decide whether multiple noisy records represent one entity, then merge or split clusters and define a reviewable canonical outcome.
- **Required region graph:** `cluster-adjudicator → source-dataset-context → candidate-cluster-graph → pairwise-comparison-evidence → cluster-consistency-and-anomaly-summary → merge-split-and-canonical-actions → outcome-preview → audit-sample-and-commit`; N-record transitivity and canonicalization are independent owners.
- **Wide:** Cluster graph, pairwise evidence and canonical preview remain visible.
- **Intermediate:** Cluster queue and pair evidence are primary; graph becomes optional.
- **Compact:** Cluster queue → suspicious pair → evidence → merge/split → canonical preview → commit.
- **State obligations:** cluster loading, pair match/nonmatch/uncertain, transitivity anomaly, split/merge draft, canonical field conflict, preview stale, audit sample pass/fail and commit/rollback.
- **Hard rejection:** Reject cho two-source diff, operational queue, one-case dossier or duplicate warning; N-record clustering, transitivity and canonical outcome are mandatory.
- **Research anchors:** `CARBON-GRID`, `WAI-APG`, `WAI-FOCUS`, `WAI-REFLOW`, `WAI-STATUS`; add [Splink clustering](https://moj-analytical-services.github.io/splink/api_docs/linker_clustering.html) and [US Census quality standards](https://www.census.gov/about/policies/quality/standards/standardc4.html).
- **Acceptance focus:** Template must adjudicate pair evidence, split and merge clusters, resolve one canonical conflict and preserve cluster/pair context on compact.

## Prompt 09 — `event-stream-replay-projection-workbench`

- **Output boundary:** `knowledge/archetypes/work/event-stream-replay-projection-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Replay an immutable event stream from a selected snapshot or cursor, compare derived projection state and locate the first invariant divergence.
- **Required region graph:** `replay-workbench → stream-snapshot-and-code-version → ordered-event-stream → replay-cursor-and-controls → materialized-projection-set → invariant-check-results → first-divergence-point → selected-event-payload → sandbox-outcome`; cursor, derived projections and invariants are peer owners.
- **Wide:** Event stream, projections and invariant evidence remain visible.
- **Intermediate:** Stream/replay is primary; projections alternate while cursor persists.
- **Compact:** Replay summary → first divergence → selected event → projection before/after → invariant result.
- **State obligations:** snapshot absent/stale, replay idle/running/paused/failed/complete, event unsupported, projection loading/diverged, invariant pass/fail, cursor moved and sandbox reset.
- **Hard rejection:** Reject cho audit timeline, streaming log viewer, job-run detail, notebook reproducibility audit or generic event list; ordered event-prefix cursors, reducer/projection version, checkpoint-state comparison and invariant divergence are mandatory—there is no cell DAG, source artifact or environment rerun.
- **Research anchors:** `VSCODE-UX`, `CARBON-TABLE`, `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`; add [Microsoft Event Sourcing](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing) and [AWS Event Sourcing](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/event-sourcing-pattern.html).
- **Acceptance focus:** Template must replay/pause events, update at least two projections, stop at first invariant failure and preserve exact cursor/projection selection across panes.

## Prompt 10 — `software-regression-bisect-workbench`

- **Output boundary:** `knowledge/archetypes/work/software-regression-bisect-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Repeatedly test selected revisions to shrink a known-good/known-bad interval until the introducing commit is proven.
- **Required region graph:** `bisect-workbench → symptom-and-reproduction-command → known-good-and-bad-endpoints → candidate-interval-and-commit-graph → current-candidate-build-and-test → result-evidence → shrinking-interval → skipped-or-ambiguous-candidates → culprit-confirmation-and-reset`; ordered interval and executable result determine every branch.
- **Wide:** Commit interval, active test evidence and remaining candidates remain visible.
- **Intermediate:** Active candidate/run is primary; interval summary persists.
- **Compact:** Next candidate → build/test → mark good/bad/skip → remaining interval → culprit confirmation/reset.
- **State obligations:** endpoints invalid, candidate checkout/building/testing, good/bad/skip/ambiguous, command failed, interval shrinking, culprit provisional/confirmed, abort/reset and evidence export.
- **Hard rejection:** Reject cho guided troubleshooting tree, job-run timeline, audit timeline or generic commit explorer; algorithmic revision interval reduction is required.
- **Research anchors:** `VSCODE-UX`, `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`, `WAI-APG`; add [Git bisect](https://git-scm.com/docs/git-bisect) and [Chromium bisect-builds](https://www.chromium.org/developers/bisect-builds-py/).
- **Acceptance focus:** Template must choose candidates deterministically, accept good/bad/skip, shrink the interval, simulate a failed test and retain reproduction evidence.

## Prompt 11 — `critical-path-project-planner`

- **Output boundary:** `knowledge/archetypes/work/critical-path-project-planner/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Author task dependencies and durations, calculate float and adjust a schedule until milestone feasibility is acceptable.
- **Required region graph:** `critical-path-planner → project-milestones → task-hierarchy-grid ↔ dependency-time-graph → critical-path-float-analysis → scenario-changes → baseline-commit`; hierarchy and dependency-time graph share task identity while float owns feasibility.
- **Wide:** Synchronized task grid and dependency timeline remain visible with critical-path evidence.
- **Intermediate:** One representation becomes primary and the other a synchronized detail pane.
- **Compact:** Milestone/task list → dependency chain → task editor → float/milestone impact → baseline review; no miniature Gantt.
- **State obligations:** task loading, duration unknown, dependency valid/cyclic, critical/noncritical, float positive/zero/negative, milestone feasible/missed, scenario dirty and baseline commit/conflict.
- **Hard rejection:** Reject cho status timeline, calendar resource scheduler, kanban, prerequisite pathway or generic workflow builder; editable activity durations/dependencies plus recalculated earliest/latest dates, total/free float and critical-path membership are mandatory—there are no learner waivers, term offerings or credential rules.
- **Research anchors:** `CARBON-GRID`, `WAI-TREEGRID`, `WAI-DRAG`, `WAI-FOCUS`, `WAI-REFLOW`; add [PMI critical path](https://www.pmi.org/learning/library/2019/04/07/15/30/moving-work-breakdown-structure-critical-path-6978) and [Atlassian dependencies](https://support.atlassian.com/jira-software-cloud/docs/view-and-manage-dependencies-in-advanced-roadmaps/).
- **Acceptance focus:** Template must edit duration/dependency, detect a cycle, recalculate critical path/float and offer move/dependency controls without drag-only operation.

## Prompt 12 — `inventory-replenishment-planner`

- **Output boundary:** `knowledge/archetypes/work/inventory-replenishment-planner/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Turn demand, stock, lead-time and policy evidence into executable order or transfer recommendations for each item-location.
- **Required region graph:** `replenishment-planner → network-policy → item-location-exception-queue → demand-supply-timeline ↔ recommendation-calculation → order-transfer-decision → projected-stock-service → release`; recommendation and projected stock jointly own the decision.
- **Wide:** Exception queue, timeline and decision/projected outcome remain visible.
- **Intermediate:** Selected item-location is primary while queue becomes a drawer.
- **Compact:** Exception list → evidence timeline → recommendation explanation → editable decision → projected outcome → release.
- **State obligations:** stock data loading/stale, shortage/excess, demand spike, lead time unknown, recommendation calculating/blocked, MOQ conflict, decision accepted/overridden, projection below target and release.
- **Hard rejection:** Reject cho capacity overview, scenario sensitivity, quota allocation, spreadsheet or operational queue; item-location lead-time recommendation must produce an executable replenishment action.
- **Research anchors:** `SAP-FLOORPLANS`, `CARBON-TABLE`, `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`; add [SAP replenishment](https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/9905622a5c1f49ba84e9076fc83a9c2c/2c9fc7536e8e2a4be10000000a174cb4.html) and [Oracle Retail Inventory Planning](https://docs.oracle.com/en/industries/retail/retail-inventory-planning-optimization-cloud/26.1.201.0/ipoio/G53785_02.pdf).
- **Acceptance focus:** Template must recalculate a recommendation, allow an explained override, show projected service/stock and preserve the item-location decision at compact.

## Prompt 13 — `traffic-signal-phase-timing-workbench`

- **Output boundary:** `knowledge/archetypes/work/traffic-signal-phase-timing-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Author and validate one actuated or coordinated traffic-signal plan by sequencing compatible movements, tuning phase timing and preventing vehicle–pedestrian conflicts.
- **Required region graph:** `signal-timing-workbench → intersection-movement-model ↔ movement-conflict-matrix → ring-barrier-phase-plan ↔ detector-and-demand-inputs → split-offset-and-clearance-editor → progression-and-queue-simulation → safety-validation → staged-controller-plan-and-rollback`; cyclic phase ownership and conflict clearance, not generic scheduling, determine validity.
- **Wide:** Movement model, both rings and barriers, timing editor, simulation and validation remain simultaneously visible.
- **Intermediate:** Ring/barrier plan and selected-phase editor own the page; movement, detector and validation evidence alternate in synchronized panes without losing the selected phase.
- **Compact:** Intersection/movement → conflict evidence → ordered phase groups with explicit barriers → timing/clearance → simulate → validate → stage; it becomes a semantic phase sequence, never a miniature controller diagram.
- **State obligations:** plan loading/version conflict, movement permitted/protected/conflicting, detector active/failed, phase enabled/omitted, split valid/overallocated, pedestrian clearance sufficient/insufficient, barrier synchronized/broken, simulation pending/unstable/pass, deployment staged/failed and rollback available.
- **Hard rejection:** Reject cho calendar scheduler, workflow node graph, traffic dashboard or generic timeline; dual-ring/barrier cycle semantics, mutually exclusive movements, pedestrian clearance and controller-stage rollback are mandatory.
- **Research anchors:** `WAI-DRAG`, `WAI-FOCUS`, `WAI-REFLOW`, `WAI-STATUS`; add [FHWA Traffic Signal Timing and Operations Strategies](https://ops.fhwa.dot.gov/arterial_mgmt/tst_ops.htm) and [current NTCIP published standards including 1202](https://www.ntcip.org/document-numbers-and-status/).
- **Acceptance focus:** Template must change a phase split, expose a movement conflict or insufficient pedestrian clearance, correct it, preview the cycle, stage deployment and roll back with keyboard and compact parity.

## Prompt 14 — `fleet-route-dispatch-planner`

- **Output boundary:** `knowledge/archetypes/work/fleet-route-dispatch-planner/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Assign vehicles and jobs, evaluate multi-route feasibility and dispatch changes under capacity, time-window and current-position constraints.
- **Required region graph:** `dispatch-planner → fleet-job-queues → geographic-route-stage ↔ route-stop-ledgers → selected-vehicle-job-constraints → optimization-alternatives → manual-overrides → dispatch-status`; many vehicle routes and mutable assignments are independent owners.
- **Wide:** Map, multi-route ledger and selected constraints remain visible.
- **Intermediate:** Route ledger or map becomes primary by task; the other is a synchronized drawer.
- **Compact:** Vehicle/route list → ordered stops → constraint/override → dispatch; map is alternate full-screen.
- **State obligations:** vehicle available/offline/full, job unassigned/assigned/late, route feasible/infeasible, optimization running, override conflict, dispatch pending/sent/failed, driver acknowledgment and location stale.
- **Hard rejection:** Reject cho itinerary exploration, map situation monitor, one-resource scheduler or route comparison; many live vehicles/jobs and mutable dispatch assignments are mandatory.
- **Research anchors:** `ESRI-LAYOUT`, `WAI-DRAG`, `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`; add [Google Route Optimization](https://developers.google.com/maps/documentation/route-optimization) and [SAP Yard Logistics](https://help.sap.com/doc/b934b4e8269d4834a391640bcea9ea9e/2024/en-US/sap_yl-s4h_product_assistance_en.pdf).
- **Acceptance focus:** Template must assign jobs, reorder stops with non-drag controls, expose an infeasible route, apply an override and retain dispatch state across map/list changes.

## Prompt 15 — `warehouse-pick-wave-planner`

- **Output boundary:** `knowledge/archetypes/work/warehouse-pick-wave-planner/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Group eligible warehouse tasks into capacity, time and zone-bounded waves, sequence them and release executable work.
- **Required region graph:** `wave-planner → eligible-order-task-pool → wave-capacity-window → zone-route-grouping ↔ selected-wave-task-ledger → labor-equipment-check → exceptions → release-monitor`; membership, sequence and capacity collectively define a wave.
- **Wide:** Eligible pool, wave board and capacity/exception evidence remain visible.
- **Intermediate:** Pool becomes a filterable drawer while selected wave remains primary.
- **Compact:** Wave selector → capacity summary → task membership/order → exceptions → release; add/remove/move controls replace drag.
- **State obligations:** task eligible/held, wave draft/full/over-capacity, route grouping valid/conflict, labor/equipment ready/missing, exception open, release locked/pending/success/failure and task changed.
- **Hard rejection:** Reject cho batch table actions, dual-list transfer, kanban or calendar scheduler; constrained wave creation, sequence and release lifecycle are mandatory.
- **Research anchors:** `SAP-FLOORPLANS`, `WAI-DRAG`, `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`; add [SAP wave management](https://help.sap.com/docs/SAP_EXTENDED_WAREHOUSE_MANAGEMENT/3d97bec9bf1649099384bb8167df3cf2/6dc8cb53ad377114e10000000a174cb4.html) and [Google Route Optimization](https://developers.google.com/maps/documentation/route-optimization).
- **Acceptance focus:** Template must form waves, move tasks by buttons, recalculate capacity/readiness, block release on exceptions and preserve selected wave at compact.

## Prompt 16 — `dock-yard-door-dispatch-board`

- **Output boundary:** `knowledge/archetypes/work/dock-yard-door-dispatch-board/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Coordinate arrivals, yard positions, dock-door time and trailer moves across spatial and temporal constraints.
- **Required region graph:** `yard-dispatch → appointment-arrival-queue → yard-spatial-stage ↔ door-time-grid → trailer-move-queue → selected-load-constraints → assign-move-complete → delay-exception-log`; each trailer changes physical state while consuming a door interval.
- **Wide:** Yard stage, door timeline and arrival/move queues remain visible.
- **Intermediate:** Timeline or yard view becomes primary with a synchronized state drawer.
- **Compact:** Arrival → trailer state/location → eligible doors → move/complete → exception; map and schedule are alternate parity views.
- **State obligations:** arrival expected/early/late, trailer gate/yard/door/departed, door free/occupied/blocked, move queued/active/failed, constraint conflict, delay exception and completion receipt.
- **Hard rejection:** Reject cho calendar scheduler, fleet routing, map monitor or status timeline; coupled physical trailer moves plus door-time consumption are mandatory.
- **Research anchors:** `ESRI-LAYOUT`, `SAP-FLOORPLANS`, `WAI-DRAG`, `WAI-STATUS`, `WAI-FOCUS`; add [SAP Yard Logistics](https://help.sap.com/doc/b934b4e8269d4834a391640bcea9ea9e/2024/en-US/sap_yl-s4h_product_assistance_en.pdf).
- **Acceptance focus:** Template must assign a trailer to a door, execute a yard move, expose spatial/time conflicts and preserve trailer state between map, timeline and compact sequence.

## Prompt 17 — `permit-to-work-isolation-control-room`

- **Output boundary:** `knowledge/archetypes/work/permit-to-work-isolation-control-room/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Authorize hazardous work only while isolations, tests, competence and rescue controls remain valid, and suspend or close it when evidence changes.
- **Required region graph:** `permit-control → work-site-scope → hazards → isolation-register ↔ test-monitor-readings → role-competency-rescue-roster → permit-conditions → authorize-suspend-close → immutable-event-record`; independent controls can invalidate authorization at any time.
- **Wide:** Hazard/isolation/test evidence and authorization rail remain visible.
- **Intermediate:** Isolation register is primary; evidence detail becomes a drawer while permit state persists.
- **Compact:** Scope → hazards → isolations → current tests → roster → authorization; permit status/action stays visible without obscuring focus.
- **State obligations:** permit draft/authorized/suspended/closed, isolation applied/verified/expired, reading safe/unsafe/stale, role missing, rescue unready, condition breached, authorization pending/failure and immutable event.
- **Hard rejection:** Reject cho generic stage-gated process, checklist, command center or job run; live independent controls that can revoke authorization are mandatory.
- **Research anchors:** `FLUENT-LAYOUT`, `WAI-STATUS`, `WAI-FOCUS`, `WAI-OBSCURED`, `WAI-REFLOW`; add [OSHA permit-required confined spaces](https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.1204).
- **Acceptance focus:** Template must verify controls, authorize, expire one reading, auto-block/suspend safely and preserve evidence/focus during responsive transitions.

## Prompt 18 — `load-and-balance-packing-workbench`

- **Output boundary:** `knowledge/archetypes/work/load-and-balance-packing-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Place cargo into compartments or containers while satisfying weight, center-of-gravity, compatibility, securing and unloading-order constraints.
- **Required region graph:** `load-workbench → cargo-pool → compartment-spatial-plan ↔ placement-manifest → weight-balance-envelope → compatibility-securing-checks → unload-sequence → approval`; placement geometry and global balance envelope jointly own validity.
- **Wide:** Cargo pool, spatial plan and live balance/constraint rail remain visible.
- **Intermediate:** Cargo becomes a drawer while plan and balance evidence remain primary.
- **Compact:** Compartment → candidate cargo → placement controls → balance/constraint result → manifest/unload review; drag has explicit alternatives.
- **State obligations:** cargo unplaced/placed, compartment open/full, weight or CG within/outside envelope, incompatibility, securing missing, unload sequence blocked, plan dirty, approval pending/failure/success.
- **Hard rejection:** Reject cho seat reservation, quota allocation, dual-list transfer or generic canvas; geometry, center-of-gravity, compatibility and unload sequence must interact.
- **Research anchors:** `WAI-DRAG`, `WAI-GRID`, `WAI-FOCUS`, `WAI-REFLOW`, `WAI-STATUS`; add [FAA Weight and Balance Handbook](https://www.faa.gov/sites/faa.gov/files/2023-09/Weight_Balance_Handbook.pdf) and [IATA Unit Load Devices](https://www.iata.org/en/programs/cargo/cargo-platform/operations/unit-load-devices/).
- **Acceptance focus:** Template must place/move cargo with keyboard controls, update balance envelope, block incompatible/unsecured placement and produce an ordered unload manifest.

## Prompt 19 — `chain-of-custody-transfer-ledger`

- **Output boundary:** `knowledge/archetypes/flow/chain-of-custody-transfer-ledger/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Execute repeated custody transfers while preserving current custodian, seal and condition evidence in an append-only provenance chain.
- **Required region graph:** `custody-ledger → item-batch-identity → current-custodian-condition → transfer-event-chain → pending-handoff ↔ recipient-verification → seal-condition-evidence → accept-reject-exception → signed-receipt-and-current-state`; each accepted transfer updates one canonical current custodian.
- **Wide:** Event chain, current state and pending transfer remain visible.
- **Intermediate:** Event chain collapses to a rail while pending verification stays primary.
- **Compact:** Current custody → pending handoff → verification/evidence → accept/reject → signed receipt; full history remains reachable.
- **State obligations:** custody current/unknown, transfer draft/pending/accepted/rejected, recipient verified/failed, seal intact/broken/unknown, condition unchanged/damaged, receipt signing/failure and exception.
- **Hard rejection:** Reject cho one-time cross-party handoff, audit timeline, sample lineage explorer or package tracking; repeated transfers and canonical current custody are mandatory.
- **Research anchors:** `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`, `WAI-APG`, `CARBON-TABLE`; add [GS1 Traceability Standard](https://www.gs1.org/sites/default/files/gts2_standard_ratified.pdf).
- **Acceptance focus:** Template must create and accept/reject multiple transfers, update current custodian only on valid receipt, record seal exceptions and retain append-only history.

## Prompt 20 — `cycle-count-variance-reconciliation-workbench`

- **Output boundary:** `knowledge/archetypes/work/cycle-count-variance-reconciliation-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Run blind physical counts, controlled recounts and approved inventory adjustments without exposing expected quantities before submission.
- **Required region graph:** `cycle-count-workbench → count-scope-location-queue → blind-count-entry → count-submission → expected-vs-counted-reveal → variance-recount-decision ↔ evidence → adjustment-approval → inventory-posting-receipt`; blind acquisition precedes every reconciliation owner.
- **Wide:** Location queue, count/reconcile workspace and evidence/approval remain visible without leaking expected quantity.
- **Intermediate:** Queue becomes a drawer while active count or variance remains primary.
- **Compact:** Location → blind entry → submit → variance/recount → evidence → approval/posting; expected value cannot appear early.
- **State obligations:** location pending/counting/submitted, blind value draft, reveal locked/open, variance none/high, recount requested/completed, evidence missing, adjustment pending/denied/approved and posting failure/success.
- **Hard rejection:** Reject cho generic reconciliation diff, spreadsheet, inventory table or review-submit ledger; blind count and controlled reveal/recount protocol are mandatory.
- **Research anchors:** `CARBON-TABLE`, `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`, `WAI-APG`; add [Oracle Warehouse Management](https://docs.oracle.com/en/cloud/saas/warehouse-management/26b/owmol/online-help.pdf).
- **Acceptance focus:** Template must enforce blind entry, reveal only after submit, request/reconcile a recount, approve/post an adjustment and preserve anti-bias ordering at compact.
