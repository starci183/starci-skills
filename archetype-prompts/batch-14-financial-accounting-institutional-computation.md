# Batch 14 — Financial, accounting, and institutional computation archetypes (20 prompts)

Tệp này là **một prompt batch tự chứa** cho accounting, treasury, actuarial, securities operations, tax và institutional computation surfaces. Khi chạy ở nơi khác, đưa toàn bộ tệp cho agent để tạo đủ 20 leaf. Nếu chỉ chạy một mục, phải đưa kèm toàn bộ phần từ `Cách chạy` đến `Nguồn research dùng chung`; không tách riêng block prompt khỏi hợp đồng chung.

## Mục lục

| # | Archetype ID | Câu hỏi bố cục chính |
|---:|---|---|
| 01 | `double-entry-journal-posting-workbench` | Làm sao biến một accounting event thành balanced journal được kiểm soát rồi post bất biến vào ledger? |
| 02 | `zero-coupon-yield-curve-bootstrap-workbench` | Làm sao giải từng maturity node theo thứ tự để dựng curve và chứng minh mọi instrument được reprice? |
| 03 | `corporate-action-election-entitlement-workbench` | Làm sao tính entitlement từ position snapshot, thu election đúng hạn rồi xác nhận allocation cuối? |
| 04 | `claims-development-triangle-reserving-workbench` | Làm sao đi từ triangle theo origin/development đến factor, ultimate và reserve vintage có diagnostics? |
| 05 | `performance-obligation-revenue-schedule-workbench` | Làm sao tách promises, phân bổ transaction price rồi ghi nhận revenue theo satisfaction lineage? |
| 06 | `hedge-accounting-designation-rebalancing-workbench` | Làm sao nối hedged item với hedging instrument, chứng minh effectiveness rồi rebalance hoặc discontinue đúng lineage? |
| 07 | `multicurrency-netting-settlement-workbench` | Làm sao collapse nghĩa vụ hợp lệ thành net positions theo currency rồi fund và settle an toàn? |
| 08 | `treasury-cash-pool-sweep-orchestrator` | Làm sao điều phối account graph về target balances qua sweep hierarchy, cutoffs và bank acknowledgements? |
| 09 | `fund-nav-strike-workbench` | Làm sao khóa valuation point, xử lý pricing exceptions và phát hành một NAV strike theo share class? |
| 10 | `collateral-margin-call-substitution-workbench` | Làm sao đáp ứng margin call hoặc thay collateral mà không tạo coverage gap khi asset cũ được release? |
| 11 | `xbrl-fact-context-dimensional-validation-workbench` | Làm sao kiểm một report fact qua concept, context, unit, dimensions và taxonomy relationships rồi sửa đúng graph? |
| 12 | `derivative-rate-reset-cashflow-workbench` | Làm sao xác định một rate reset từ observation/fallback rồi tính, confirm và settle cashflow? |
| 13 | `capitalization-dilution-event-modeler` | Làm sao thực thi conversion, issuance và pool resize đúng thứ tự để ra cap table sau event? |
| 14 | `ranked-choice-round-tabulation-audit` | Làm sao tái tạo từng round từ cast-vote preferences, transfers và tie rules đến certified result? |
| 15 | `derivatives-portfolio-compression-cycle-workbench` | Làm sao tìm multilateral replacement set giảm gross notional mà giữ risk invariants và atomic consent? |
| 16 | `bank-regulatory-capital-rwa-workbench` | Làm sao trace exposure treatment qua RWA rollups đến capital ratios, buffers và filing cells? |
| 17 | `insolvency-priority-distribution-waterfall` | Làm sao phân estate pools qua liens, priority classes và pro-rata rules thành payment schedule hợp lệ? |
| 18 | `roll-call-quorum-threshold-determination-workbench` | Làm sao xác lập eligible denominator, ghi roll call và quyết định motion theo quorum, threshold và tie rule? |
| 19 | `customs-origin-valuation-duty-workbench` | Làm sao kết hợp classification, customs value và origin test để ra duty cùng declaration evidence? |
| 20 | `exchange-volatility-auction-reopening-console` | Làm sao chuyển từ price-band breach qua halt và auction imbalance đến một lần uncross rồi reopen có kiểm soát? |

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

## Prompt 01 — `double-entry-journal-posting-workbench`

- **Output boundary:** `archetypes/work/double-entry-journal-posting-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Convert one evidenced accounting event into an authorized, balanced journal batch, post it once to the correct book and period, and preserve corrections as new reversal or adjustment lineage.
- **Required region graph:** `journal-posting → book-entity-period-and-policy-version → source-event-and-document-lineage → journal-header → debit-credit-line-composer ↔ account-dimension-eligibility-and-tax-rules → debit-total-by-book-and-currency ↔ credit-total-by-book-and-currency → counter-entry-navigation-and-batch-balance-receipt → segregation-review-and-approval → immutable-posting-to-ledger → reversal-correction-and-close-lineage`; debit and credit are independent global owners that must reach exact equality within every book/currency partition, and each line must navigate to its balancing counter-entry set before posting.
- **Wide:** Source evidence, journal lines, account eligibility, balance receipt, approval ownership and posting preview remain visible together.
- **Intermediate:** Journal lines and balance receipt remain primary; source documents, account guidance and approval history move to synchronized drawers without losing the selected line.
- **Compact:** Event → header → one debit or credit line → navigate its counter-entry set → compare persistent debit and credit totals for the active book/currency → resolve balance or dimension failure → approval → post receipt or reversal; the desktop grid becomes a guided paired-entry sequence, not a single-total allocator.
- **State obligations:** source pending/verified/rejected, book open/soft-closed/closed, journal draft/unbalanced/balanced, account eligible/blocked, dimension missing, currency imbalance, review pending/approved/rejected, posting queued/posted/duplicate-blocked, reversal scheduled/completed and ledger version superseded.
- **Hard rejection:** Reject cho `review-submit-ledger`, `reconciliation-diff-workbench`, `spreadsheet-grid-editor`, generic form approval hoặc any allocator that distributes one source total; independently derived debit and credit totals by book/currency, counter-entry navigation, book-period control, account/dimension eligibility, segregation of duties, immutable posting identity and correction-by-new-lineage are mandatory.
- **Research anchors:** `CARBON-TABLE`, `WAI-GRID`, `WAI-FOCUS`, `WAI-STATUS`; add [XBRL Global Ledger](https://www.xbrl.org/the-standard/what/global-ledger/) and [U.S. Standard General Ledger](https://fiscal.treasury.gov/ussgl/index.html).
- **Acceptance focus:** Template must create a fictional journal, expose an invalid account dimension and an imbalance, reach exact debit-credit equality, block posting into a closed period, approve and post once, reject a duplicate post and create a linked reversal without mutating the original.

## Prompt 02 — `zero-coupon-yield-curve-bootstrap-workbench`

- **Output boundary:** `archetypes/work/zero-coupon-yield-curve-bootstrap-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Build one dated zero-coupon curve by solving market instruments in maturity dependency order, then prove the resulting discount factors reprice the input set within declared tolerances.
- **Required region graph:** `curve-bootstrap → valuation-date-currency-collateral-and-convention-set → market-instrument-ladder → instrument-cashflow-expansion → dependency-ordered-maturity-nodes → selected-node-equation-and-known-discount-factors ↔ solver-and-interpolation-policy → zero-discount-forward-curve → repricing-residual-and-arbitrage-diagnostics → approved-curve-version`; each solved node extends the already determined curve segment and owns every later cash-flow discount.
- **Wide:** Instrument ladder, dependency nodes, selected equation, curve representations and repricing residuals remain simultaneously visible.
- **Intermediate:** Current maturity node, equation and residual remain primary; complete cash-flow expansion, interpolation controls and full curve diagnostics move to contextual drawers.
- **Compact:** Convention set → next unsolved maturity → input instrument → known versus unknown cash flows → solve node → inspect residual and monotonicity → advance or rollback; the whole chart is replaced by a node sequence plus numeric curve table.
- **State obligations:** market data loading/current/stale, instrument included/excluded/invalid, convention incomplete, dependency blocked, node unsolved/solving/solved/failed, discount factor invalid, interpolation discontinuity, repricing inside/outside tolerance, arbitrage diagnostic warning, curve draft/approved/superseded and rollback complete.
- **Hard rejection:** Reject cho `scenario-sensitivity-modeler`, `calculation-estimate-flow`, `chart-specification-authoring-studio` hoặc generic rate dashboard; cash-flow expansion, maturity dependency order, recursive node solving, instrument repricing residuals and one versioned zero/discount/forward representation are mandatory.
- **Research anchors:** `FLUENT-LAYOUT`, `CARBON-TABLE`, `WAI-FOCUS`, `WAI-STATUS`; add [ECB yield-curve methodology](https://data.ecb.europa.eu/methodology/yield-curves) and [Bank of England yield curves](https://www.bankofengland.co.uk/statistics/yield-curves).
- **Acceptance focus:** Template must exclude one invalid quote, solve at least three ordered nodes, show the equation and known cash flows for the active node, surface an out-of-tolerance repricing residual, correct the quote and publish a curve only after all residual and monotonicity checks pass.

## Prompt 03 — `corporate-action-election-entitlement-workbench`

- **Output boundary:** `archetypes/work/corporate-action-election-entitlement-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Determine holder-specific entitlements for one announced corporate action, capture valid elections before the applicable deadline, and reconcile confirmed allocations or proceeds back to each eligible position.
- **Required region graph:** `corporate-action-election → event-announcement-and-version → terms-options-and-key-dates → frozen-record-date-position-snapshot → holder-account-entitlement-derivation → holder-instruction-draft-send-acknowledge-amend-cancel-late-lifecycle ↔ deadline-channel-and-agent-status → default-option → confirmed-allocation-cash-or-security-movement → exception-tax-and-final-entitlement-receipt`; the frozen position snapshot derives each entitlement ceiling, and holder-instruction lifecycle is the dominant path; over-subscription proration is only a conditional allocation branch after instructions close.
- **Wide:** Event terms, position-derived entitlements, election book, deadline status and projected versus confirmed allocation remain visible together.
- **Intermediate:** Selected holder entitlement and instruction remain primary; full announcement lineage, all-account roster and movement history move to synchronized drawers.
- **Compact:** Event option and deadline → holder account → eligible position → entitlement → elect, amend or cancel → agent status → final allocation and movement receipt; aggregate matrices become account routes rather than stacked cards.
- **State obligations:** announcement preliminary/confirmed/amended/cancelled, position pending/frozen/disputed, holder eligible/ineligible, entitlement projected/revised/final, instruction draft/sent/acknowledged/rejected/cancelled/late, deadline open/near/closed, default applied, proration pending/final, proceeds pending/paid and tax exception unresolved/resolved.
- **Hard rejection:** Reject cho `waitlist-offer-allocation-board`, `constrained-quota-allocation-editor`, `multi-program-eligibility-screening` hoặc `dual-list-transfer`; a versioned security event, frozen record-date position snapshot, derived option-specific entitlement, draft-to-agent holder-instruction lifecycle, deadline/default behavior and allocation-to-cash/security movement reconciliation are mandatory, while proration alone never qualifies.
- **Research anchors:** `CARBON-TABLE`, `WAI-GRID`, `WAI-OBSCURED`, `WAI-STATUS`; add [DTCC corporate-action data dictionaries](https://www.dtcc.com/asset-services/corporate-actions-processing/scenarios) and [ISO 15022 MT565 scope](https://www.iso20022.org/15022/uhb/finmt565.htm).
- **Acceptance focus:** Template must derive two fictional holder entitlements from a record-date snapshot, block an election above entitlement, send and acknowledge a valid choice, apply a default after one deadline, show a prorated final allocation and reconcile resulting cash or securities to the confirmed instruction.

## Prompt 04 — `claims-development-triangle-reserving-workbench`

- **Output boundary:** `archetypes/work/claims-development-triangle-reserving-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Estimate unpaid claims for one homogeneous segment by transforming origin-by-development observations into selected development factors, projected ultimates and a reviewable reserve vintage.
- **Required region graph:** `reserve-analysis → valuation-date-segment-and-data-version → origin-by-development-incremental-triangle ↔ cumulative-triangle-and-diagonals → age-to-age-factor-selection → tail-and-ultimate-projection → paid-incurred-case-reserve-bridge → diagnostic-residuals-and-method-comparison → selected-unpaid-claim-estimate → assumption-review-and-locked-vintage`; factor choices operate by development age while each origin row carries its own observed-to-ultimate path.
- **Wide:** Triangle, current diagonal, factor selections, origin-level ultimate table and diagnostics remain visible together.
- **Intermediate:** Selected development age and affected origin rows remain primary; full triangle, alternate methods and assumption history move to synchronized drawers with bounded grid overflow.
- **Compact:** Segment and vintage → current diagonal → select and edit one development-age factor → inspect its before/after propagation across every affected origin row → review changed ultimates and reserve → diagnostics → lock or revise; the two-dimensional triangle becomes linked age and origin routes with an explicit propagation receipt, not a squeezed or read-only matrix.
- **State obligations:** data loading/reconciled/unreconciled, triangle incremental/cumulative, cell observed/missing/adjusted, factor candidate/selected/overridden, tail unset/set, origin immature/mature, diagnostic normal/outlier, method feasible/unstable, reserve draft/reviewed/locked, assumption challenged and vintage superseded.
- **Hard rejection:** Reject cho `cohort-retention-grid`, `scenario-sensitivity-modeler`, `statistical-process-control-overview`, `process-mass-balance-analyzer` hoặc any read-only cohort matrix; editable development-age factors, visible factor propagation across origin rows, accident-or-underwriting origin periods, triangle transforms, origin-level ultimates and reserve-vintage lineage are mandatory.
- **Research anchors:** `CARBON-TABLE`, `WAI-GRID`, `WAI-FOCUS`, `WAI-STATUS`; add [ASOP 43 — Property/Casualty Unpaid Claim Estimates](https://www.actuarialstandardsboard.org/asops/propertycasualty-unpaid-claim-estimates/) and [CAS actuarial monographs](https://www.casact.org/publications-research/publications/flagship-publications/cas-monographs).
- **Acceptance focus:** Template must switch incremental and cumulative views without changing evidence, select and override one age-to-age factor with rationale, flag an outlier diagonal, recalculate origin ultimates and unpaid amount, compare one alternate method and lock a version whose assumptions remain inspectable.

## Prompt 05 — `performance-obligation-revenue-schedule-workbench`

- **Output boundary:** `archetypes/work/performance-obligation-revenue-schedule-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Turn one customer contract and its modifications into distinct performance obligations, allocate the constrained transaction price, and maintain recognized versus remaining revenue as satisfaction evidence arrives.
- **Required region graph:** `revenue-schedule → contract-and-modification-lineage → promise-inventory → distinct-performance-obligation-decisions → transaction-price-components-and-constraint → standalone-selling-price-evidence → transaction-price-conservation-across-obligations ↔ relative-allocation-ledger → obligation-satisfaction-pattern-and-progress → recognized-versus-remaining-conservation-through-time → contract-asset-liability-schedule → close-review-and-disclosure-receipt`; one conservation graph proves allocated obligation amounts equal constrained transaction price, while a linked second graph proves recognized plus remaining revenue equals each obligation's allocation through time.
- **Wide:** Contract promises, distinctness decisions, price components, allocation ledger and satisfaction schedules remain visible together.
- **Intermediate:** Selected obligation, allocated amount and satisfaction evidence remain primary; source clauses, all-obligation comparison and disclosure history move to contextual drawers.
- **Compact:** Contract version → promise → distinctness decision → transaction-price component → relative allocation → point-in-time or over-time satisfaction → recognized and remaining receipt → modification treatment; desktop matrices become an obligation-by-obligation sequence.
- **State obligations:** contract pending/enforceable/terminated, promise unassessed/distinct/combined, variable consideration unconstrained/constrained/revised, standalone price observed/estimated/missing, allocation unbalanced/balanced, obligation unsatisfied/partially/satisfied, progress disputed, revenue scheduled/recognized/reversed, contract asset/liability current and modification prospective/cumulative.
- **Hard rejection:** Reject cho `stage-gated-process-record`, `review-submit-ledger`, `rule-builder-workbench` hoặc generic billing schedule; contract promise decomposition, distinctness ownership, transaction-price constraint, the allocation conservation graph, the recognized/remaining temporal conservation graph, satisfaction evidence and modification-aware revenue lineage are mandatory.
- **Research anchors:** `CARBON-TABLE`, `WAI-FOCUS`, `WAI-OBSCURED`, `WAI-STATUS`; add [IFRS 15 Revenue from Contracts with Customers](https://www.ifrs.org/issued-standards/list-of-standards/ifrs-15-revenue-from-contracts-with-customers/) and [FASB revenue-recognition implementation Q&As](https://storage.fasb.org/Rev_Rec_Implementation_QAs.pdf).
- **Acceptance focus:** Template must split fictional promises, combine one non-distinct promise with rationale, constrain variable consideration, allocate the resulting price by standalone values, recognize one obligation over time, process a contract modification and reconcile recognized plus remaining amounts to the allocated total.

## Prompt 06 — `hedge-accounting-designation-rebalancing-workbench`

- **Output boundary:** `archetypes/work/hedge-accounting-designation-rebalancing-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Designate one hedge-accounting relationship from a specific hedged item and hedging instrument, test whether their economic relationship and hedge ratio remain qualifying, and account for rebalancing or discontinuation without rewriting prior periods.
- **Required region graph:** `hedge-accounting → reporting-entity-period-standard-and-policy-version → hedged-item-risk-component-profile ↔ hedging-instrument-terms-and-exposure-profile → documented-risk-management-objective → designation-ratio-and-qualifying-criteria → prospective-and-period-effectiveness-tests ↔ source-of-ineffectiveness-diagnostics → oci-pnl-and-basis-adjustment-attribution → rebalance-or-discontinue-decision → posted-accounting-and-designation-lineage`; item and instrument retain separate profiles, their documented ratio owns effectiveness, and accounting attribution follows the resulting designation state.
- **Wide:** Hedged-item profile, instrument profile, designation ratio, effectiveness evidence, ineffectiveness attribution and accounting result remain visible together.
- **Intermediate:** Relationship ratio and failed effectiveness evidence remain primary; complete cash-flow profiles, policy evidence and prior designation versions move to synchronized drawers.
- **Compact:** Policy version → hedged item/risk component → hedging instrument → designation ratio → qualifying criteria → effectiveness result → OCI/P&L attribution → rebalance, continue or discontinue; two desktop profiles become an alternating comparison route with a persistent relationship receipt.
- **State obligations:** item eligible/ineligible/partially designated, instrument active/matured/novated, risk component separately identifiable/not-qualifying, designation draft/documented/rejected, ratio aligned/imbalanced/rebalanced, effectiveness test pending/pass/fail, ineffectiveness unmeasured/measured/posted, accounting OCI/P&L/basis-adjusted, relationship continuing/discontinued and prior period locked/corrected-by-new-version.
- **Hard rejection:** Reject cho `scenario-sensitivity-modeler`, `reconciliation-diff-workbench`, `portfolio-health-matrix` hoặc generic derivative valuation; two separately evidenced item/instrument profiles, documented risk objective, designation ratio, qualifying/effectiveness tests, OCI/P&L or basis attribution and rebalance-versus-discontinue lineage are mandatory.
- **Research anchors:** `FLUENT-LAYOUT`, `CARBON-TABLE`, `WAI-FOCUS`, `WAI-STATUS`; add [IFRS 9 Financial Instruments](https://www.ifrs.org/issued-standards/list-of-standards/ifrs-9-financial-instruments/) and [FASB ASU 2025-09 — Hedge Accounting Improvements](https://storage.fasb.org/ASU%202025-09.pdf).
- **Acceptance focus:** Template must pair a fictional forecast exposure with one instrument, document the risk component and ratio, fail a qualifying criterion, correct the designation, run an effectiveness test, attribute ineffectiveness, show a ratio drift, rebalance without retrospective rewriting, then discontinue a second relationship into a versioned accounting receipt.

## Prompt 07 — `multicurrency-netting-settlement-workbench`

- **Output boundary:** `archetypes/work/multicurrency-netting-settlement-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Reduce eligible gross payment obligations inside one enforceable netting set into currency-specific pay and receive positions, fund them by cutoff, and prove each original obligation is discharged or remains open.
- **Required region graph:** `multicurrency-netting → settlement-cycle-and-legal-netting-set → trade-obligation-register-by-party-currency-value-date → eligibility-and-dispute-exclusions → bilateral-or-multilateral-offset-graph → net-pay-receive-position-by-currency ↔ funding-account-and-cutoff-plan → settlement-method-and-pvp-linkage → instruction-release-acknowledgement-and-failure-recovery → discharged-obligation-and-liquidity-receipt`; only same-set obligations that satisfy party, currency and value-date rules collapse into a net position.
- **Wide:** Gross obligations, inclusion graph, net currency positions, funding plan, cutoff clock and discharge evidence remain visible together.
- **Intermediate:** Net positions and funding exceptions remain primary; gross trade detail, legal-set evidence and settlement history move to synchronized drawers.
- **Compact:** Netting set → currency/value-date lane → included and excluded obligations → net pay or receive amount → fund → release through selected settlement method → acknowledge or recover; the cross-party matrix becomes a currency-lane route.
- **State obligations:** set active/suspended/legally uncertain, obligation eligible/excluded/disputed/cancelled, cycle open/locked, netting calculated/invalid/recalculated, position pay/receive/flat, funding sufficient/short, cutoff open/missed, instruction draft/released/acknowledged/rejected, PvP linked/unavailable, settlement partial/final/failed and obligation discharged/reopened.
- **Hard rejection:** Reject cho `interval-meter-settlement-reconciliation-workbench`, `reconciliation-diff-workbench`, `capacity-allocation-overview` hoặc `multi-creditor-hardship-plan-negotiator`; an enforceable netting set, gross obligations by currency and value date, offset provenance, per-currency funding cutoffs, settlement-risk method and discharge back-link to every obligation are mandatory.
- **Research anchors:** `CARBON-TABLE`, `WAI-GRID`, `WAI-OBSCURED`, `WAI-STATUS`; add [BIS 2026 FX settlement-risk measures](https://www.bis.org/publ/qtrpdf/r_qt2606c.htm) and [CPMI payment-versus-payment report](https://www.bis.org/cpmi/publ/d216.htm).
- **Acceptance focus:** Template must include and exclude fictional obligations under explicit netting rules, derive two currency positions, expose a funding shortfall before cutoff, fund and release a PvP-linked instruction, simulate one failed acknowledgement and prove which original obligations are discharged versus reopened.

## Prompt 08 — `treasury-cash-pool-sweep-orchestrator`

- **Output boundary:** `archetypes/work/treasury-cash-pool-sweep-orchestrator/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Move a group of bank accounts toward declared target balances through a directed physical cash-pool hierarchy, honoring sweep precedence, cutoffs, currency conversions and intercompany-loan evidence before accepting bank acknowledgements.
- **Required region graph:** `cash-pool-sweep → entity-bank-business-date-policy-and-cutoff-version → bank-account-node-graph → observed-and-projected-node-balances ↔ target-minimum-maximum-and-trapped-cash-constraints → directed-zero-balance-target-balance-and-concentration-edges → precedence-ordered-sweep-and-fx-plan → intercompany-loan-principal-interest-and-limit-ledger → bank-instruction-acknowledgement-and-reject-stream → achieved-targets-residuals-and-close-receipt`; every movement traverses an authorized graph edge, changes both endpoint balances, and creates funding and intercompany consequences before downstream edges execute.
- **Wide:** Account graph, balance/target deltas, sweep-edge order, FX effects, loan ledger and bank acknowledgements remain visible together.
- **Intermediate:** Critical residuals and the active sweep edge remain primary; complete hierarchy, account evidence and closed-day history move to synchronized drawers.
- **Compact:** Cutoff and pool → breached target node → inspect upstream/downstream authorized edges → preview both endpoint balances and loan/FX effect → instruct → bank acknowledgement or reject → recalculate remaining graph; the network becomes a node-and-edge route with a persistent whole-pool feasibility receipt.
- **State obligations:** balance observed/projected/stale, account active/blocked/trapped, target inside/breached/unreachable, edge authorized/conditional/disabled, cutoff open/near/closed, sweep proposed/instructed/acknowledged/rejected, FX rate current/stale, loan capacity available/exceeded, pool feasible/partially feasible/infeasible, residual accepted/escalated and day open/closed/reopened.
- **Hard rejection:** Reject cho `multicurrency-netting-settlement-workbench`, `dual-list-transfer`, `capacity-allocation-overview` hoặc generic payment queue; a directed bank-account graph, per-node target bands, ordered dependent sweep edges, two-endpoint balance mutation, cutoff and trapped-cash constraints, FX/intercompany-loan consequences and bank acknowledgements are mandatory.
- **Research anchors:** `CARBON-TABLE`, `WAI-TREEGRID`, `WAI-FOCUS`, `WAI-STATUS`; add [OECD transfer-pricing guidance on financial transactions](https://www.oecd.org/en/publications/transfer-pricing-guidance-on-financial-transactions-inclusive-framework-on-beps-actions-4-8-10_794bcddd-en.html) and [BIS CPMI principles for financial-market infrastructures](https://www.bis.org/cpmi/publ/d101a.htm).
- **Acceptance focus:** Template must model a fictional three-level account graph, detect one below-minimum and one trapped balance, order dependent sweeps, reject an unauthorized edge, preview an FX sweep and its intercompany loan, block instructions after cutoff, process one bank rejection, reroute only through authorized edges and close with explicit achieved and residual targets.

## Prompt 09 — `fund-nav-strike-workbench`

- **Output boundary:** `archetypes/work/fund-nav-strike-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Produce one official fund NAV at a declared valuation point by resolving position, price, foreign-exchange, corporate-action, accrual and share-class exceptions before per-unit prices are released.
- **Required region graph:** `nav-strike → fund-share-class-valuation-point-and-policy-version → position-and-cash-ledger → market-price-fair-value-and-fx-source-lineage → corporate-action-income-expense-and-liability-accruals → strike-blocking-exception-queue ↔ fund-total-net-assets → allocation-across-multiple-share-classes-and-share-counts → per-class-nav-values → reasonableness-review-and-tolerance-gate → official-strike-distribution → correction-as-new-strike-lineage`; every unresolved exception blocks the whole fund strike, propagates through total net assets into all affected share classes, and any correction creates a new strike rather than mutating the released one.
- **Wide:** Position valuation, exception queue, selected pricing evidence, accruals, class allocation and strike receipt remain visible together.
- **Intermediate:** Exceptions and provisional strike remain primary; full holdings, source lineage and prior-strike comparison move to synchronized drawers.
- **Compact:** Valuation point → highest-impact exception → selected holding and source → resolve or override → class expense/share allocation → provisional NAV → tolerance gate → release or correct; the holdings table becomes an exception-first work queue.
- **State obligations:** positions loading/reconciled, price current/stale/missing/overridden, fair-value review pending/approved, FX current/stale, corporate action pending/booked, accrual estimated/final, exception open/waived/resolved and strike-blocking/released, fund NAV provisional/held, share-class values pending/recalculated/final, strike provisional/released/superseded-by-correction, tolerance pass/fail and distribution pending/acknowledged.
- **Hard rejection:** Reject cho `calculation-estimate-flow`, `spreadsheet-grid-editor`, `review-submit-ledger` hoặc `reconciliation-diff-workbench`; a fixed valuation point, strike-blocking exceptions, propagation through fund NAV into multiple share classes, security-level valuation lineage, liabilities and accruals, class-specific allocation/share counts and correction-by-new-strike lineage are mandatory.
- **Research anchors:** `CARBON-TABLE`, `WAI-GRID`, `WAI-FOCUS`, `WAI-STATUS`; add [SEC Rule 2a-5 fair-value guide](https://www.sec.gov/resources-small-businesses/small-business-compliance-guides/good-faith-determinations-fair-value-small-entity-compliance-guide) and [IOSCO collective-investment valuation consultation](https://www.iosco.org/news/pdf/IOSCONEWS780.pdf).
- **Acceptance focus:** Template must load a fictional position set, flag stale and missing prices, inspect source lineage, approve one fair-value override, book an expense accrual, allocate assets and liabilities across two share classes, fail then pass a tolerance gate and issue a versioned NAV strike.

## Prompt 10 — `collateral-margin-call-substitution-workbench`

- **Output boundary:** `archetypes/work/collateral-margin-call-substitution-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Satisfy a margin requirement or execute a collateral substitution by selecting eligible assets whose haircut-adjusted value covers the call without releasing existing collateral before replacement settlement is final.
- **Required region graph:** `collateral-substitution → agreement-counterparty-call-date-and-dispute-state → exposure-threshold-and-margin-requirement → pledged-collateral-inventory → candidate-asset-eligibility-haircut-fx-and-concentration-checks → coverage-and-buffer-ledger ↔ proposed-deliver-release-pair → custodian-settlement-and-timing-dependency → confirmed-substitution-and-updated-shortfall → call-closure-and-dispute-receipt`; replacement delivery and old-asset release form one dependency pair governed by continuous coverage.
- **Wide:** Margin calculation, held and candidate collateral, eligibility evidence, coverage ledger, paired movements and settlement status remain visible together.
- **Intermediate:** Requirement, selected asset and coverage effect remain primary; complete inventory, agreement clauses and custodian history move to synchronized drawers.
- **Compact:** Call and agreement → required amount → candidate asset → eligibility, haircut and concentration checks → deliver/release pair → settle replacement → release old asset → close or dispute; drag allocation has add/remove buttons and an ordered list alternative.
- **State obligations:** exposure current/disputed, call draft/sent/agreed, collateral held/pending/released, asset eligible/ineligible/conditionally eligible, price or FX current/stale, concentration inside/exceeded, coverage short/sufficient/excess, substitution proposed/matched/settling/failed/complete, custodian acknowledged/rejected, dispute open/resolved and call closed/reopened.
- **Hard rejection:** Reject cho `capacity-allocation-overview`, `dual-list-transfer`, `waitlist-offer-allocation-board` hoặc `inventory-replenishment-planner`; agreement-specific exposure and threshold, haircut-adjusted collateral eligibility, concentration limits, held-collateral state, paired deliver-before-release dependency and custodian settlement proof are mandatory.
- **Research anchors:** `CARBON-TABLE`, `WAI-DRAG`, `WAI-FOCUS`, `WAI-STATUS`; add [BCBS-IOSCO margin requirements](https://www.bis.org/bcbs/publ/d499.htm) and [2025 implementation review](https://www.bis.org/bcbs/publ/d606.htm).
- **Acceptance focus:** Template must calculate a fictional call, reject one ineligible and one concentration-breaching asset, apply haircut and FX value, create a sufficient substitution pair, block old-collateral release before replacement acknowledgement, simulate settlement failure and recover to a fully covered closed call.

## Prompt 11 — `xbrl-fact-context-dimensional-validation-workbench`

- **Output boundary:** `archetypes/work/xbrl-fact-context-dimensional-validation-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Validate each reported XBRL fact through its taxonomy concept, period/entity context, unit, dimensions and relationship networks, then correct the smallest semantic graph node and prove the filing revalidates without changing intended meaning.
- **Required region graph:** `xbrl-validation → report-taxonomy-entry-points-and-filing-rule-version → reported-fact-register → selected-fact ↔ concept-type-period-balance-and-label → context-entity-period-scenario → unit-and-decimals-precision → explicit-and-typed-dimension-members → presentation-calculation-definition-and-formula-relationships → semantic-issue-and-affected-fact-set → graph-node-correction-and-revalidation → accepted-report-and-validation-receipt`; a fact is valid only when its value participates in a coherent fact↔concept↔context/unit/dimension↔taxonomy-relationship graph.
- **Wide:** Fact register, selected fact, concept/context/unit/dimension graph, relationship networks, issue queue and validation result remain visible together.
- **Intermediate:** Selected semantic issue and its affected graph neighborhood remain primary; full taxonomy tree, all facts and validation history move to synchronized drawers.
- **Compact:** Issue → affected fact → concept → context and unit → dimensions → relationship edge → correct one graph node → rerun affected rules → whole-report receipt; large fact and taxonomy grids become a navigable semantic chain, not stacked tables.
- **State obligations:** taxonomy loading/resolved/missing, fact reported/duplicate/inconsistent, concept standard/extension/deprecated, context valid/malformed/duplicate, unit compatible/incompatible, dimension allowed/disallowed/missing, relationship satisfied/broken/circular, calculation consistent/inconsistent, correction draft/applied/reverted, validation running/pass/fail and report draft/accepted/superseded.
- **Hard rejection:** Reject cho `regulatory-filing-package-validator`, `data-import-mapping-pipeline`, `document-outline-editor` hoặc generic schema validation; fact-to-concept typing, context and unit identity, dimensional validity, taxonomy relationship networks, affected-fact propagation, graph-node correction and deterministic XBRL revalidation are mandatory.
- **Research anchors:** `CARBON-TABLE`, `WAI-TREEGRID`, `WAI-FOCUS`, `WAI-STATUS`; add [XBRL specifications and current recommendations](https://specifications.xbrl.org/specifications.html) and [SEC EDGAR XBRL technical specifications](https://www.sec.gov/submit-filings/technical-specifications).
- **Acceptance focus:** Template must load fictional facts and one extension taxonomy, trace a fact through concept/context/unit/dimensions, surface a duplicate context, incompatible unit, disallowed member and broken calculation relationship, correct each owning graph node, show affected facts before rerun and issue a reproducible passing validation receipt.

## Prompt 12 — `derivative-rate-reset-cashflow-workbench`

- **Output boundary:** `archetypes/work/derivative-rate-reset-cashflow-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Determine one contractual derivative reset from its schedule, observations, index and fallback provisions, calculate the resulting leg cash flows, obtain counterparty agreement and settle or dispute the payment.
- **Required region graph:** `derivative-reset → contract-confirmation-and-definition-version → leg-schedule-and-business-day-conventions → accrual-period-and-reset-event → observation-set-index-source-and-fallback-waterfall → fixed-or-floating-rate-determination ↔ day-count-notional-and-compounding-calculation → gross-leg-cashflows-and-net-payment → counterparty-confirmation-dispute-and-adjustment → settled-cancelled-or-superseded-cashflow-lineage`; the exact accrual period and observation method bind rate determination to the payable amount.
- **Wide:** Contract terms, schedule, observations, fallback path, rate calculation and cash-flow confirmation remain visible together.
- **Intermediate:** Active reset event, selected observations and payment calculation remain primary; full schedule, definition history and prior settlements move to synchronized drawers.
- **Compact:** Contract leg → active accrual period → observation or fallback → determined rate → day-count/notional calculation → gross and net cash flow → confirm, dispute or settle; the schedule grid becomes one reset-event path.
- **State obligations:** contract active/terminated/amended, schedule valid/broken, reset upcoming/due/determined, observation available/missing/corrected, fallback inactive/triggered/disputed, rate provisional/final, cash flow calculated/adjusted, counterparty unconfirmed/agreed/disputed, payment pending/settled/failed and prior determination superseded.
- **Hard rejection:** Reject cho `calendar-resource-scheduler`, `timeline-status-monitor`, `calculation-estimate-flow` hoặc generic cash-flow table; contract-definition version, accrual and reset dates, observation/fallback semantics, day-count and compounding method, leg-level amounts, counterparty confirmation and settlement lineage are mandatory.
- **Research anchors:** `CARBON-TABLE`, `WAI-FOCUS`, `WAI-OBSCURED`, `WAI-STATUS`; add [ISDA 2021 Interest Rate Derivatives Definitions InfoHub](https://www.isda.org/2021/10/04/2021-isda-interest-rate-derivatives-definitions/) and [FpML 5.13 confirmation-view reset and cash-flow examples](https://www.fpml.org/spec/fpml-5-13-8-rec-2/html/confirmation/fpml-5-13-examples.html).
- **Acceptance focus:** Template must select an accrual period, derive a rate from fictional observations, trigger and explain a missing-index fallback, calculate day count and leg cash flows, show a counterparty adjustment, retain both determinations and settle only the agreed net payment.

## Prompt 13 — `capitalization-dilution-event-modeler`

- **Output boundary:** `archetypes/work/capitalization-dilution-event-modeler/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Execute one financing or capitalization event across all outstanding equity and equity-linked instruments in the prescribed dependency order, then issue a reconciled post-event ownership record.
- **Required region graph:** `dilution-event → frozen-pre-event-capitalization-snapshot → instrument-rights-dependency-dag → financing-or-corporate-event-terms → dependency-ordered-conversion-exercise-issuance-pool-resize-and-protective-adjustment-cascade → affected-instrument-set ↔ per-holder-share-and-proceeds-propagation → fully-diluted-ownership-bridge-for-all-affected-holders → rounding-and-residuals → approval-close-and-security-issuance → post-event-cap-table-and-certificate-lineage`; activating one right traverses the dependency DAG and cascades through every affected instrument and holder before the post-event record can close.
- **Wide:** Pre-event instruments, event sequence, selected conversion terms, holder impact bridge and post-event ownership remain visible together.
- **Intermediate:** Active sequence step and affected holders remain primary; full rights register, alternate assumptions and certificate history move to synchronized drawers.
- **Compact:** Event terms → next conversion, exercise, issuance or pool step → affected instrument/holder → shares and proceeds → rounding/protective adjustment → post-event ownership → approve close; the ownership matrix becomes an event-step and holder-impact route.
- **State obligations:** snapshot draft/frozen, instrument outstanding/convertible/exercisable/cancelled, term valid/disputed, sequence blocked/runnable, conversion pending/applied, option pool unchanged/resized, share count exact/rounded/residual, holder ownership provisional/final, approval pending/complete, issuance pending/recorded and cap table corrected/superseded.
- **Hard rejection:** Reject cho `scenario-sensitivity-modeler`, `capacity-allocation-overview`, `spreadsheet-grid-editor`, `bridge-contribution-waterfall-overview` hoặc any signed-contribution waterfall; a frozen capitalization snapshot, instrument-rights dependency DAG, cascade to all affected holders, ordered conversions/issuances/pool/protective adjustments, per-holder ownership bridge and legally recorded post-event securities are mandatory.
- **Research anchors:** `CARBON-TABLE`, `WAI-TREEGRID`, `WAI-FOCUS`, `WAI-STATUS`; add [SEC capitalization-table glossary](https://www.sec.gov/resources-small-businesses/glossary) and [Delaware corporation stock provisions](https://delcode.delaware.gov/title8/c001/sc05/index.html).
- **Acceptance focus:** Template must freeze a fictional pre-event cap table, convert one note, exercise one warrant, resize an option pool before issuing new shares, expose a rounding residual, show each holder's pre/post fully diluted ownership, approve the sequence and record a post-event version without rewriting the snapshot.

## Prompt 14 — `ranked-choice-round-tabulation-audit`

- **Output boundary:** `archetypes/work/ranked-choice-round-tabulation-audit/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Reproduce and audit a ranked-choice contest round by round from versioned cast-vote preferences, applying validity, threshold, transfer, exhaustion and tie rules until the terminal result is proven.
- **Required region graph:** `ranked-choice-audit → jurisdiction-contest-rule-and-input-version → ballot-style-and-cast-vote-record-set → validity-adjudication-and-preference-normalization → continuing-candidate-set → round-tally-and-threshold-proof ↔ ballot-transfer-exhaustion-and-tie-resolution-ledger → elected-or-eliminated-transition → next-round-or-terminal-result → reproducibility-export-recount-and-certification-receipt`; each round derives solely from the prior continuing set and immutable ballot preferences under one rule version.
- **Wide:** Candidate status, round tallies, selected ballot-transfer evidence, threshold proof and round lineage remain visible together.
- **Intermediate:** Current round and transition proof remain primary; full cast-vote roster, all prior rounds and certification history move to synchronized drawers.
- **Compact:** Contest and input version → current round → continuing candidates → selected tally or ballot transfer → threshold/tie decision → elect, eliminate or continue → next round and audit receipt; the round-by-candidate matrix becomes a round navigator with list and numeric views.
- **State obligations:** input loading/validated/quarantined, ballot valid/overvoted/exhausted/adjudicated, candidate continuing/elected/eliminated/withdrawn, round queued/calculated/challenged/locked, threshold unmet/met, transfer pending/complete, tie unresolved/rule-resolved, result unofficial/recounted/certified and export reproducible/mismatched.
- **Hard rejection:** Reject cho `constrained-quota-allocation-editor`, `bridge-contribution-waterfall-overview`, `evidence-led-case-resolution-dossier` hoặc generic election dashboard; immutable ranked cast-vote preferences, continuing-candidate state, jurisdiction-specific round rule, ballot-level transfers and exhaustion, deterministic ties, round receipts and reproducibility from the same input are mandatory.
- **Research anchors:** `CARBON-TABLE`, `WAI-GRID`, `WAI-FOCUS`, `WAI-STATUS`; add [NIST Cast Vote Records common data format](https://pages.nist.gov/CastVoteRecords/) and [U.S. EAC ranked-choice voting systems guidance](https://www.eac.gov/sites/default/files/2023-10/RCV%20Voting%20Systems%20V3%20Final%2010.20.23.pdf).
- **Acceptance focus:** Template must validate fictional ranked ballots, quarantine one malformed record, calculate a first round, inspect one ballot transfer and one exhausted ballot, resolve a tie by the declared rule, advance rounds to a terminal candidate, rerun from the same input hash and expose an identical audit receipt.

## Prompt 15 — `derivatives-portfolio-compression-cycle-workbench`

- **Output boundary:** `archetypes/work/derivatives-portfolio-compression-cycle-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Construct and execute one multilateral compression cycle that terminates and replaces eligible derivative trades to reduce gross notional while preserving every participant's declared market-risk, cash-flow and legal invariants.
- **Required region graph:** `portfolio-compression → cycle-scope-date-product-rules-and-legal-version → participant-and-trade-portfolio → risk-equivalence-and-net-cashflow-invariants → eligible-trade-hypergraph → candidate-multilateral-terminate-replace-package ↔ participant-impact-and-invariant-diagnostics → bilateral-and-multilateral-consent-matrix → atomic-termination-and-replacement-instruction → post-cycle-residual-trades-risk-proof-and-receipts`; each candidate is a hyperedge spanning multiple participants/trades, and no leg executes unless every affected consent and invariant passes atomically.
- **Wide:** Participant/trade graph, candidate hyperedge, invariant comparison, consent matrix, gross-notional reduction and residual portfolio remain visible together.
- **Intermediate:** Candidate package, failed invariant and missing consent remain primary; full portfolios, alternate packages and prior-cycle receipts move to synchronized drawers.
- **Compact:** Cycle scope → candidate participant/trade set → before/after risk and cash-flow invariants → each consent → atomic execute or reject → residual portfolio proof; the multilateral graph becomes a hyperedge route while persistent cycle totals prevent a bilateral-list interpretation.
- **State obligations:** trade eligible/ineligible/disputed, participant included/withdrawn, invariant inside/outside tolerance, candidate generated/invalid/optimized, consent pending/accepted/rejected/expired, legal check pending/pass/fail, instruction staged/atomic-ready/aborted/executed, termination unmatched/matched, replacement booked/rejected, risk proof pass/fail and cycle open/closed/reversed-by-new-cycle.
- **Hard rejection:** Reject cho `multicurrency-netting-settlement-workbench`, `dual-list-transfer`, `reconciliation-diff-workbench` hoặc generic portfolio optimization; a multilateral trade hypergraph, explicit participant-level risk/cash-flow invariants, terminate-and-replace package, all-party consent matrix, atomic execution and post-cycle residual proof are mandatory.
- **Research anchors:** `CARBON-TABLE`, `WAI-GRID`, `WAI-FOCUS`, `WAI-STATUS`; add [BIS OTC-derivatives statistics and compression definition](https://data.bis.org/topics/OTC_DER) and [CFTC portfolio compression rule](https://www.ecfr.gov/current/title-17/chapter-I/part-23/subpart-I/section-23.503).
- **Acceptance focus:** Template must load fictional trades across three participants, form a candidate hyperedge, show gross-notional reduction, fail one participant risk invariant, regenerate a valid package, collect and revoke consent, block partial execution, obtain all final consents, atomically terminate/replace and prove each participant's residual risk and cash-flow receipt.

## Prompt 16 — `bank-regulatory-capital-rwa-workbench`

- **Output boundary:** `archetypes/work/bank-regulatory-capital-rwa-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Derive a bank's risk-weighted assets and regulatory capital ratios for one reporting scope and framework version, tracing every exposure treatment and capital adjustment into the submitted disclosure cells.
- **Required region graph:** `capital-rwa → reporting-scope-date-framework-and-approach-version → numerator-graph[capital-instruments → eligibility → regulatory-deductions → tier-capital-totals] ↔ denominator-graph[exposure-register → exposure-class-ccf-collateral-guarantee-and-risk-parameter-derivation → credit-market-operational-and-cva-rwa → output-floor-and-scaling] → ratio-buffer-and-shortfall-receipt → regulatory-template-mapping → review-submit-and-restatement-lineage`; numerator eligibility/deductions and exposure-to-RWA denominator are independent derivation graphs that meet only at each ratio calculation.
- **Wide:** Capital components, exposure derivations, RWA rollups, ratios/buffers and filing mappings remain visible together.
- **Intermediate:** Ratio shortfalls and selected exposure trace remain primary; complete exposure register, framework text and filing history move to contextual drawers.
- **Compact:** Reporting scope → ratio or buffer → numerator and RWA denominator → selected risk-type rollup → exposure classification and mitigation derivation → filing cell → approve or restate; large disclosure matrices become trace routes.
- **State obligations:** framework current/future/superseded, scope complete/incomplete, exposure classified/unclassified, approach permitted/not-approved, collateral or guarantee eligible/ineligible, parameter missing/overridden, RWA calculated/failed, output floor inactive/binding, capital component eligible/deducted, ratio compliant/near/short, filing draft/submitted/rejected and restatement pending/complete.
- **Hard rejection:** Reject cho `capacity-allocation-overview`, `portfolio-health-matrix`, `scenario-sensitivity-modeler` hoặc `bridge-contribution-waterfall-overview`; two independently inspectable numerator and denominator derivation graphs, regulatory framework/approach version, exposure-class derivation, credit-risk mitigation, risk-type RWA, capital eligibility/deductions, ratios/buffers and template-cell lineage are mandatory.
- **Research anchors:** `CARBON-TABLE`, `WAI-TREEGRID`, `WAI-FOCUS`, `WAI-STATUS`; add [Basel Framework RBC20](https://www.bis.org/basel_framework/chapter/RBC/20.htm) and [EBA Pillar 3 templates](https://eba.europa.eu/activities/single-rulebook/regulatory-activities/transparency-and-pillar-3/overview-pillar-3-templates-and-it-solutions).
- **Acceptance focus:** Template must classify fictional exposures, apply a CCF and one eligible guarantee, reject an ineligible mitigation, roll credit and operational RWA, make an output floor bind, calculate CET1 and total-capital ratios, trace a shortfall to source exposures and map the approved values into filing cells.

## Prompt 17 — `insolvency-priority-distribution-waterfall`

- **Output boundary:** `archetypes/flow/insolvency-priority-distribution-waterfall/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Allocate one insolvency estate across encumbered asset pools and admitted claims in the court-approved priority order, including within-class pro rata distributions, reserves, deficiencies and objections.
- **Required region graph:** `insolvency-distribution → proceeding-estate-date-and-court-order-version → asset-pool-and-encumbrance-register ↔ admitted-disputed-contingent-and-subordinated-claim-register → bipartite-claim-to-encumbered-pool-edges → available-estate-by-pool → pool-specific-priority-and-within-class-pro-rata → cross-pool-deficiency-surplus-and-reserve-ledger → objection-order-and-recalculation → approved-payment-schedule-and-closure-receipt`; the bipartite claim↔pool graph permits one claim or lien to touch governed pools without collapsing the estate into a single waterfall.
- **Wide:** Asset pools, claims, lien/class mapping, priority waterfall, distributions and objections remain visible together.
- **Intermediate:** Selected pool and active priority class remain primary; full claim register, court-order evidence and payment history move to synchronized drawers.
- **Compact:** Estate and order version → asset pool → encumbrance → next priority class → claim and pro rata share → reserve or deficiency → objection effect → approved payment; the desktop waterfall becomes a pool-and-class sequence with a numeric receipt.
- **State obligations:** estate estimated/realized, asset unencumbered/encumbered/disputed, claim filed/admitted/disputed/contingent/subordinated/rejected, class open/partially paid/satisfied/deficient, distribution provisional/approved/paid, reserve held/released, objection open/sustained/overruled, order current/amended/appealed and proceeding open/closed/reopened.
- **Hard rejection:** Reject cho `bridge-contribution-waterfall-overview`, `multi-creditor-hardship-plan-negotiator`, `waitlist-offer-allocation-board`, `constrained-quota-allocation-editor` hoặc any single-pool tier list; a bipartite claim↔encumbered-pool graph, admitted-claim status, pool-specific priority, within-class pari passu allocation, cross-pool deficiency/reserve effects, court-order changes and approved distributions are mandatory.
- **Research anchors:** `CARBON-TABLE`, `WAI-FOCUS`, `WAI-OBSCURED`, `WAI-STATUS`; add [UNCITRAL Legislative Guide on Insolvency Law](https://uncitral.un.org/en/texts/insolvency/legislativeguides/insolvency_law) and [World Bank insolvency and creditor-rights principles](https://www.worldbank.org/en/topic/financialsector/brief/the-world-bank-principles-for-effective-insolvency-and-creditor-rights).
- **Acceptance focus:** Template must realize fictional asset pools, reserve encumbered proceeds, admit and dispute claims, allocate two priority classes with one pro rata deficiency, change one claim after an objection, recalculate without overwriting the prior court-order version and issue an approved payment schedule.

## Prompt 18 — `roll-call-quorum-threshold-determination-workbench`

- **Output boundary:** `archetypes/work/roll-call-quorum-threshold-determination-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Determine whether one motion is adopted from a versioned procedural rule, the eligible membership and quorum denominator at the instant of decision, and an auditable roll-call ledger including absences, abstentions, pairs, challenges and recounts.
- **Required region graph:** `roll-call-determination → body-session-motion-rule-and-time-version → eligible-membership-set → vacancy-disqualification-recusal-and-pair-adjustments → dynamic-quorum-and-decision-denominators ↔ member-by-member-roll-call-ledger → present-voting-abstaining-absent-and-challenged-tallies → majority-supermajority-tie-and-casting-vote-rule → provisional-result → challenge-correction-or-recount → certified-result-and-journal-receipt`; the versioned eligible set derives the denominator, while immutable member responses derive the numerator and both meet only at the motion threshold.
- **Wide:** Motion/rule, membership adjustments, denominator derivation, roll-call ledger, live tallies and threshold result remain visible together.
- **Intermediate:** Threshold, unresolved member statuses and challenged votes remain primary; complete membership evidence, procedural text and prior counts move to synchronized drawers.
- **Compact:** Motion and rule → eligible set → denominator adjustments → record one member response → persistent quorum/vote tallies → threshold or tie rule → challenge/recount → certify; the desktop roster becomes a member queue with a separate denominator receipt, not a simple tally card.
- **State obligations:** rule current/superseded, member eligible/ineligible/recused/vacant, attendance unknown/present/absent, response pending/aye/no/abstain/paired/challenged, quorum unmet/met/lost, threshold unresolved/met/not-met, tie absent/present/resolved, count open/closed/recounting, result provisional/challenged/corrected/certified and journal pending/published.
- **Hard rejection:** Reject cho `survey-response-analysis-overview`, `calculation-estimate-flow`, `review-submit-ledger` hoặc generic vote counter; a versioned motion rule, dynamically derived eligible membership and denominator, member-level immutable roll call, quorum and decision thresholds, abstention/absence semantics, tie authority, challenge/recount and certified journal receipt are mandatory.
- **Research anchors:** `CARBON-TABLE`, `WAI-GRID`, `WAI-FOCUS`, `WAI-STATUS`; add [U.S. House Manual and Rules](https://rules.house.gov/resources) and [U.S. Senate roll-call vote data](https://www.senate.gov/legislative/votes_new.htm).
- **Acceptance focus:** Template must derive a fictional eligible set, apply a vacancy and recusal, show quorum before voting, record mixed member responses, keep abstention separate from absence, fail then meet a supermajority after correcting one challenged response, invoke a declared tie rule in another motion, recount deterministically and certify a journal receipt.

## Prompt 19 — `customs-origin-valuation-duty-workbench`

- **Output boundary:** `archetypes/work/customs-origin-valuation-duty-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Determine the customs treatment of shipment items by jointly classifying goods, establishing customs value, testing non-preferential or preferential origin and deriving duties, taxes and declaration evidence.
- **Required region graph:** `customs-duty → shipment-entry-date-trade-agreement-and-law-version → item-evidence-register → classification-determination[goods-description → tariff-heading → measure] ↔ valuation-determination[method → transaction-value-adjustments → customs-value] ↔ origin-determination[bill-of-materials-and-production → origin-criterion → preference-status] → duty-tax-relief-and-additional-measure-calculation → declaration-document-evidence-and-exception → accepted-examined-amended-or-refunded-entry-lineage`; classification, valuation and origin are three peer determinations with separate evidence, uncertainty and decisions that converge only at duty derivation.
- **Wide:** Shipment items, tariff reasoning, value adjustments, material/process origin test, duty calculation and declaration evidence remain visible together.
- **Intermediate:** Selected item and unresolved classification/origin issue remain primary; complete bill of materials, valuation history and prior entries move to synchronized drawers.
- **Compact:** Entry and item → classify and measure → build customs value → test material/process origin criterion → apply preference or general rate → calculate duty/tax → attach evidence → submit or amend; cross-item matrices become an item route.
- **State obligations:** entry draft/submitted/selected-for-exam, item classified/ambiguous, value method accepted/challenged, adjustment included/excluded, material origin verified/missing, rule test pass/fail/indeterminate, preference claimed/denied, duty provisional/final/underpaid/refundable, document valid/expired/missing and entry accepted/amended/refunded.
- **Hard rejection:** Reject cho `multi-program-eligibility-screening`, `rule-builder-workbench`, `calculation-estimate-flow` hoặc `evidence-led-case-resolution-dossier`; three independent peer determinations for tariff classification, customs valuation and origin, their distinct evidence/uncertainty, agreement/law version, convergence only at rate derivation, declaration evidence and customs-entry lineage are mandatory.
- **Research anchors:** `CARBON-TABLE`, `WAI-TREEGRID`, `WAI-FOCUS`, `WAI-STATUS`; add [World Customs Organization rules-of-origin compendium](https://www.wcoomd.org/en/topics/origin/overview/origin-compendium.aspx?p=1) and [WTO customs-valuation gateway](https://www.wto.org/english/tratop_e/cusval_e/cusval_e.htm).
- **Acceptance focus:** Template must classify a fictional item, add freight and one disputed value adjustment, inspect a bill of materials, fail then pass an origin criterion after correcting material evidence, switch between preferential and general duty outcomes, generate declaration evidence and preserve an amended entry beside the accepted version.

## Prompt 20 — `exchange-volatility-auction-reopening-console`

- **Output boundary:** `archetypes/work/exchange-volatility-auction-reopening-console/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Control one instrument from a volatility-triggered trading pause through a transparent reopening auction, continuously deriving indicative price and imbalance, applying extension rules, uncrossing once and returning the book to the correct trading state.
- **Required region graph:** `volatility-reopening → venue-instrument-session-rule-and-clock-version → reference-price-and-dynamic-price-bands → triggering-trade-or-quote-and-halt-reason → auction-order-book[price-time-side-quantity] ↔ indicative-match-price-executable-volume-and-imbalance → order-entry-cancel-freeze-and-extension-gates → uncross-allocation-and-residual-book → reopening-trade-and-price-band-reset → continuous-trading-state-and-surveillance-receipt`; auction orders jointly own one indicative clearing state, and no reopen occurs until the clock, price-range, imbalance and extension gates permit one deterministic uncross.
- **Wide:** Trading-state clock, reference/bands, depth book, indicative price/volume/imbalance, extension gates and reopening receipt remain visible together.
- **Intermediate:** Indicative clearing state and blocking gate remain primary; full depth, trigger evidence and surveillance history move to synchronized drawers with overflow owned by the bounded price ladder.
- **Compact:** Halt reason and clock → reference/bands → bounded price ladder summary → indicative price/volume/imbalance → enter or cancel eligible order → extension decision → confirm one uncross → residual/reopen receipt; full depth becomes an accessible price-level navigator while persistent clearing totals preserve whole-book context.
- **State obligations:** session preopen/continuous/halted/auction/reopened/closed, band current/reset/stale, trigger valid/cancelled, order accepted/rejected/cancelled/frozen, indicative price available/unavailable/outside-range, imbalance buy/sell/balanced, extension inactive/triggered/repeated/exhausted, uncross blocked/ready/executing/complete/failed, allocation full/partial, residual resting/cancelled and surveillance clear/flagged.
- **Hard rejection:** Reject cho `live-operations-control-room`, `timeline-status-monitor`, `inventory-replenishment-planner` hoặc generic market dashboard; an instrument-specific trading-state machine, dynamic price bands, price-time auction book, jointly derived indicative match and imbalance, rule-timed extensions, single deterministic uncross, residual book and explicit continuous-trading transition are mandatory.
- **Research anchors:** `CARBON-TABLE`, `WAI-GRID`, `WAI-FOCUS`, `WAI-STATUS`; add [Limit Up-Limit Down plan](https://www.luldplan.com/) and [NYSE trading information and LULD controls](https://beta.nyse.com/trade/trading-information).
- **Acceptance focus:** Template must simulate a fictional band breach, enter a halt, accept and reject orders under declared gates, update indicative price/volume/imbalance after each change, trigger an extension, expose a keyboard-navigable bounded price ladder, perform one deterministic uncross, retain partial residuals, reset bands and prove the transition back to continuous trading.
