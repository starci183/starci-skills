# Batch 08 — Governance, trust and evidence archetypes (20 prompts)

Tệp này là **một prompt batch tự chứa** cho policy, privacy, regulated evidence, trust và governance surfaces. Khi chạy ở nơi khác, đưa toàn bộ tệp cho agent để tạo đủ 20 leaf. Nếu chỉ chạy một mục, phải đưa kèm toàn bộ phần từ `Cách chạy` đến `Nguồn research dùng chung`; không tách riêng block prompt khỏi hợp đồng chung.

## Mục lục

| # | Archetype ID | Câu hỏi bố cục chính |
|---:|---|---|
| 01 | `jurisdiction-authority-resolution` | Làm sao xác định đúng authority khi geographic và organizational jurisdictions chồng lấn? |
| 02 | `public-consultation-response-workspace` | Làm sao đọc proposal, trả lời nhiều issues, gắn citations và preview public disclosure? |
| 03 | `policy-obligation-authoring-workbench` | Làm sao author clauses đồng thời trace obligations, owners, evidence và control impact? |
| 04 | `cross-framework-traceability-mapper` | Làm sao tạo auditable many-to-many mappings giữa hai requirement/control frameworks? |
| 05 | `retention-disposition-policy-planner` | Làm sao định nghĩa lifecycle trigger, retention, holds và irreversible disposition trước publish? |
| 06 | `control-assurance-testing-workbench` | Làm sao execute repeatable procedures trên samples và prove assertion coverage? |
| 07 | `literature-screening-workbench` | Làm sao classify citations theo protocol và adjudicate reviewer disagreements? |
| 08 | `evidence-extraction-synthesis-matrix` | Làm sao extract normalized claims/values từ sources mà giữ exact provenance và reviewer agreement? |
| 09 | `taxonomy-facet-modeling-workbench` | Làm sao author controlled concepts, semantic relations và facet behavior rồi validate consumers? |
| 10 | `treaty-reservation-depositary-workbench` | Làm sao giữ party instruments, reservations↔objections và entry-into-force effects đồng bộ như một depositary authority? |
| 11 | `delegated-access-lifecycle-manager` | Làm sao invite, verify, grant, review, renew và revoke access của delegates? |
| 12 | `communication-delivery-recovery-center` | Làm sao repair một deadline-bound notice mà vẫn giữ đúng version và verified alternate channel? |
| 13 | `third-party-data-access-grant` | Làm sao quyết định granular runtime grant theo requester, purpose, resource, scope và duration? |
| 14 | `active-session-threat-containment` | Làm sao terminate suspicious sessions mà không tự khóa current trusted access? |
| 15 | `automated-decision-explanation-challenge` | Làm sao hiểu consequential automated outcome, sửa source data hoặc challenge sang human review? |
| 16 | `consent-withdrawal-impact-review` | Làm sao withdraw grants sau khi hiểu affected purposes, recipients, services và retained basis? |
| 17 | `regulatory-filing-package-validator` | Làm sao assemble, cross-validate, sign và test/live transmit một official filing package? |
| 18 | `regulated-sample-selection-workbench` | Làm sao define population/method, generate sample, assess bias và lock immutable version? |
| 19 | `regulatory-comment-synthesis-workbench` | Làm sao organize public-comment corpus, draft issue responses và prove complete coverage? |
| 20 | `retention-obligation-disposition-workbench` | Làm sao apply retention authority, resolve holds và execute certified disposition trên record cohorts? |

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

## Prompt 01 — `jurisdiction-authority-resolution`

- **Output boundary:** `archetypes/discovery/jurisdiction-authority-resolution/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Resolve which authority owns a subject when geographic and organizational jurisdictions overlap, while preserving the rule evidence that explains the result.
- **Required region graph:** `authority-resolver → subject-location-and-scope → jurisdiction-layer-stack ↔ authority-rule-register → overlap-or-conflict-evidence → selected-authority-and-service → proof-and-escalation`; rule resolution, not the map, owns the outcome.
- **Wide:** Spatial/layer context, rule register and authority result remain visible.
- **Intermediate:** Rule/result becomes primary while spatial context is an alternate pane.
- **Compact:** Evidence-first jurisdiction path → selected authority/service → proof → escalation; map opens only when location evidence needs inspection.
- **State obligations:** location unknown/ambiguous, layer loading, rule active/expired, authority unique/multiple/none, conflict unresolved, service unavailable, escalation pending and proof exported.
- **Hard rejection:** Reject cho place discovery, map monitor, scope picker, evidence dossier, service hub or generic rule builder; one subject must intersect multiple geographic/organizational jurisdiction layers whose precedence and authority rules deterministically resolve the service owner—no case-merit adjudication owns the result.
- **Research anchors:** `ESRI-LAYOUT`, `USWDS-PATTERNS`, `GOVUK-PATTERNS`, `WAI-FOCUS`, `WAI-REFLOW`; add [GOV.UK local government structure and responsibilities](https://www.gov.uk/guidance/local-government-structure-and-elections) and [GOV.UK Find your local council](https://www.gov.uk/find-local-council).
- **Acceptance focus:** Template must resolve an overlap, expose the winning and conflicting rules textually, switch map/evidence without loss and route an unresolved case to escalation.

## Prompt 02 — `public-consultation-response-workspace`

- **Output boundary:** `archetypes/work/public-consultation-response-workspace/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Read a proposal or docket, compose responses across multiple issues, bind citations and preview exactly what will be public.
- **Required region graph:** `consultation-workspace → docket-and-deadline → issue-navigator ↔ source-proposal → response-register → cited-evidence-and-attachments → public-disclosure-preview → declaration-submit-receipt`; issue responses and disclosure preview are independent owners.
- **Wide:** Source, active response and public-disclosure preview remain visible.
- **Intermediate:** Source becomes an anchored drawer while response and disclosure remain primary.
- **Compact:** Issue-by-issue response with adjacent clause excerpt → citations/attachments → full public preview → declaration/submit.
- **State obligations:** docket loading/closed, issue unanswered/draft/complete, citation linked/broken, attachment scanning/failure, private data detected, preview stale, submit pending/rejected/accepted and receipt.
- **Hard rejection:** Reject cho split-reference form, document editor, regulatory comment synthesis or generic multi-step application; multiple issue owners, citation graph and public disclosure boundary are mandatory.
- **Research anchors:** `GOVUK-PATTERNS`, `USWDS-PATTERNS`, `WAI-FOCUS`, `WAI-REFLOW`, `WAI-STATUS`; add [European Commission Better Regulation](https://commission.europa.eu/law/law-making-process/better-regulation_en) and [EPA docket comments](https://www.epa.gov/dockets/commenting-epa-dockets).
- **Acceptance focus:** Template must answer several issues, bind source anchors, update public preview, detect an unresolved disclosure risk and return from source drawer to exact response.

## Prompt 03 — `policy-obligation-authoring-workbench`

- **Output boundary:** `archetypes/work/policy-obligation-authoring-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Author policy clauses while tracing obligations, owners, evidence requirements and downstream control impact.
- **Required region graph:** `policy-workbench → policy-outline → clause-editor ↔ obligation-role-evidence-ledger → dependency-control-impact → reviewer-comments → version-approval-publish`; clause prose and obligation traceability are peer owners.
- **Wide:** Outline, active clause and obligation/impact rail remain visible.
- **Intermediate:** Outline becomes a drawer and obligation/impact uses synchronized panes.
- **Compact:** Clause-by-clause authoring → obligations/evidence → downstream impact → comments → version review; anchors return to the exact clause.
- **State obligations:** version loading, clause draft/changed/approved, obligation missing/assigned, evidence undefined, control impact unknown/conflict, comment open/resolved, publish pending/failure and superseded version.
- **Hard rejection:** Reject cho generic document outline editor, rule builder, retention policy planner, evidence dossier or authored briefing; authoring source clauses must derive atomic actor/action/condition obligations with two-way evidence/control impact traceability—outline hierarchy or case evidence alone cannot satisfy the task.
- **Research anchors:** `VSCODE-UX`, `WAI-FOCUS`, `WAI-STATUS`, `WAI-REFLOW`, `WAI-APG`; add [NIST SP 800-53](https://csrc.nist.gov/CSRC/media/Projects/risk-management/800-53%20Downloads/800-53r5/SP_800-53_v5_1-derived-OSCAL.pdf) and [Microsoft Track Changes](https://support.microsoft.com/en-us/word/training/track-changes-in-word).
- **Acceptance focus:** Template must edit a clause, create an obligation/evidence owner, surface downstream impact, resolve a comment and bind approval to an exact version.

## Prompt 04 — `cross-framework-traceability-mapper`

- **Output boundary:** `archetypes/work/cross-framework-traceability-mapper/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Create and approve auditable many-to-many relations between two control, requirement or standards frameworks.
- **Required region graph:** `traceability-mapper → framework-a-tree ↔ mapping-workspace ↔ framework-b-tree → relation-evidence-inspector → coverage-gap-summary → mapping-approval`; both hierarchies and typed relation evidence are independent owners.
- **Wide:** Both framework trees, mapping center and selected relation evidence remain visible.
- **Intermediate:** One tree remains visible while target picker/evidence becomes a sheet; coverage persists.
- **Compact:** Source control → candidate targets → relation type/evidence → coverage result → approval; no squeezed dual hierarchy.
- **State obligations:** framework loading/version mismatch, source/target selected, mapping exact/partial/related/none, evidence missing, duplicate/conflict, coverage calculating/gap, approval pending and superseded map.
- **Hard rejection:** Reject cho data-import mapping pipeline, row transformation, comparison matrix, knowledge graph, taxonomy editor or reconciliation diff; governed source/target hierarchy versions, many-to-many typed semantic mappings, ambiguity stewardship and derived coverage impact are mandatory, with no ingest execution or record-level conversion.
- **Research anchors:** `WAI-TREEGRID`, `WAI-FOCUS`, `WAI-REFLOW`, `WAI-STATUS`, `CARBON-GRID`; add [NIST mapping guidance](https://tsapps.nist.gov/publication/get_pdf.cfm?pub_id=957319).
- **Acceptance focus:** Template must map nodes many-to-many, attach evidence, calculate coverage gaps, prevent ambiguous duplicate relations and preserve source/target state at compact.

## Prompt 05 — `retention-disposition-policy-planner`

- **Output boundary:** `archetypes/settings/retention-disposition-policy-planner/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Define lifecycle triggers, retention periods, holds, precedence and irreversible disposition, then simulate impact before publishing and locking policy.
- **Required region graph:** `retention-policy-planner → scope-record-class-tree → lifecycle-timeline → trigger-retention-disposition-editor ↔ holds-exceptions-precedence → impact-simulation → publish-lock-receipt`; temporal precedence and irreversible outcome own the policy.
- **Wide:** Scope tree, lifecycle timeline and rule/impact regions remain visible.
- **Intermediate:** Tree becomes a drawer while lifecycle and selected precedence remain primary.
- **Compact:** Record class → trigger → duration/hold → disposition → simulated outcome → explicit publish/lock ceremony.
- **State obligations:** class loading, trigger absent/valid, duration invalid, hold active/conflicting, precedence unresolved, simulation running/impact, policy draft/reviewed/locked, publish failure and superseded version.
- **Hard rejection:** Reject cho generic rule builder, effective-setting provenance, operational disposition queue or preference center; this archetype authors temporal policy and does not execute it on records.
- **Research anchors:** `NIST-PRIVACY`, `WAI-FOCUS`, `WAI-STATUS`, `WAI-REFLOW`, `WAI-TREEGRID`; add [Microsoft Purview retention](https://learn.microsoft.com/en-us/purview/create-retention-policies).
- **Acceptance focus:** Template must define a trigger/hold/disposition, simulate impacted cohorts, resolve precedence and require an explicit irreversible version lock.

## Prompt 06 — `control-assurance-testing-workbench`

- **Output boundary:** `archetypes/work/control-assurance-testing-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Execute repeatable assurance procedures across samples, bind evidence, record exceptions and prove assertion coverage before reviewer sign-off.
- **Required region graph:** `assurance-workbench → control-test-plan → sample-population → procedure-steps ↔ evidence-viewer → result-exception-ledger → assertion-coverage → reviewer-signoff`; repeated sample results roll up to one assertion owner.
- **Wide:** Samples/procedures, evidence and result/coverage remain visible.
- **Intermediate:** Sample queue becomes a drawer while active procedure/evidence remains primary.
- **Compact:** Sample → procedure step → evidence → result/exception → next sample → coverage/sign-off.
- **State obligations:** plan loading, sample pending/in-test/complete, procedure pass/fail/not-applicable, evidence missing/invalid, exception open/cleared, coverage insufficient/sufficient, reviewer changes requested and sign-off.
- **Hard rejection:** Reject cho one-case dossier, diagnostic bundle, assessment quiz, regulated sample selection or generic checklist; repeated sampled procedures and assertion coverage are mandatory.
- **Research anchors:** `CARBON-TABLE`, `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`, `WAI-APG`; add [NIST SP 800-53A Rev. 5 assessment procedures](https://csrc.nist.gov/pubs/sp/800/53/a/r5/final).
- **Acceptance focus:** Template must execute tests over several samples, attach local evidence, register an exception, update coverage and block sign-off until the assertion threshold passes.

## Prompt 07 — `literature-screening-workbench`

- **Output boundary:** `archetypes/work/literature-screening-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Classify citations against a review protocol, record exclusion reasons and adjudicate independent reviewer conflicts.
- **Required region graph:** `screening-workbench → review-protocol → citation-queue → title-abstract-evidence ↔ inclusion-criteria → include-exclude-uncertain-decision → reviewer-conflict-adjudication → flow-counts`; protocol decisions and blinded reviewer agreement own progress.
- **Wide:** Queue, citation evidence and criteria/decision remain visible.
- **Intermediate:** Queue becomes a drawer while evidence and criteria remain primary.
- **Compact:** One citation → criteria → decision/reason → next; adjudication is a separate route preserving queue position.
- **State obligations:** citation loading/duplicate, reviewer assignment blind/revealed, include/exclude/uncertain, reason missing, disagreement open/adjudicated, full text unavailable, flow counts stale and screening complete.
- **Hard rejection:** Reject cho generic operational queue, one-case resolution, systematic synthesis or content moderation; protocol classification, independent reviews and disagreement accounting are mandatory.
- **Research anchors:** `COCHRANE-HANDBOOK`, `WAI-FOCUS`, `WAI-STATUS`, `WAI-REFLOW`, `CARBON-TABLE`; add [Cochrane study selection](https://training.cochrane.org/interactivelearning/module-4-selecting-studies-and-collecting-data).
- **Acceptance focus:** Template must support blinded independent decisions, require exclusion reasons, open/adjudicate disagreement and retain exact citation/queue position.

## Prompt 08 — `evidence-extraction-synthesis-matrix`

- **Output boundary:** `archetypes/work/evidence-extraction-synthesis-matrix/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Extract normalized values or claims from sources into an outcome schema while preserving exact provenance and reviewer agreement.
- **Required region graph:** `extraction-workbench → synthesis-question-outcomes → source-by-field-matrix ↔ selected-source-excerpt → structured-extraction → normalization-confidence → reviewer-conflict → aggregate-synthesis`; every matrix value is anchored to source evidence.
- **Wide:** Matrix, source viewer and extraction inspector remain visible.
- **Intermediate:** Matrix owns bounded overflow while viewer and inspector alternate.
- **Compact:** Source/outcome selector → exact excerpt → fields → confidence/conflict → synthesis summary; no page-level horizontal scroll.
- **State obligations:** source loading/unavailable, field missing/extracted, excerpt anchor valid/broken, normalization pending/conflict, confidence low/high, reviewer agreement/disagreement, aggregate stale and export.
- **Hard rejection:** Reject cho spreadsheet, comparison matrix, reconciliation diff or systematic weighted synthesis; provenance-bound extraction cells and reviewer conflict are mandatory.
- **Research anchors:** `COCHRANE-HANDBOOK`, `WAI-GRID`, `WAI-FOCUS`, `WAI-REFLOW`, `WAI-STATUS`; add [Cochrane Handbook chapter 5](https://training.cochrane.org/handbook/current/chapter-05) and the [JBI Manual for Evidence Synthesis](https://jbi-global-wiki.refined.site/download/attachments/355599504/JBI%20Manual%20for%20Evidence%20Synthesis%202024.pdf).
- **Acceptance focus:** Template must extract fields from anchored excerpts, resolve a reviewer conflict, update aggregate summary and expose matrix semantics as grouped compact records.

## Prompt 09 — `taxonomy-facet-modeling-workbench`

- **Output boundary:** `archetypes/work/taxonomy-facet-modeling-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Author a controlled concept scheme with preferred and alternate labels, semantic relations and facet behavior, then validate consuming search behavior.
- **Required region graph:** `taxonomy-workbench → concept-scheme-tree → selected-concept-label-definition ↔ broader-narrower-related-graph → facet-rule-preview → validation-issues → publish-version`; hierarchy, semantic relation and facet behavior are separate owners.
- **Wide:** Concept tree, editor and relation/facet preview remain visible.
- **Intermediate:** Relation/preview becomes tabs while the selected concept path persists.
- **Compact:** Concept path picker → concept editor → relations → facet preview → validation/publish.
- **State obligations:** scheme loading, concept draft/deprecated, label duplicate/missing, relation valid/cyclic, facet preview empty/conflicting, validation pass/fail, publish pending and version conflict.
- **Hard rejection:** Reject cho knowledge graph exploration, document outline, cross-framework mapper or rule builder; this archetype authors one controlled vocabulary and its facet behavior.
- **Research anchors:** `WAI-TREEGRID`, `WAI-FOCUS`, `WAI-REFLOW`, `WAI-STATUS`, `APPLE-SPLIT`; add the [W3C SKOS Reference](https://www.w3.org/TR/skos-reference) and [Getty Vocabulary Editorial Guidelines](https://www.getty.edu/publications/vocabularies-editorial-guidelines/).
- **Acceptance focus:** Template must create/edit a concept, add semantic relations, detect a cycle/duplicate label, preview facet behavior and publish a version with keyboard-complete tree actions.

## Prompt 10 — `treaty-reservation-depositary-workbench`

- **Output boundary:** `archetypes/work/treaty-reservation-depositary-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Administer one multilateral treaty as depositary by validating incoming instruments, registering party status and reservations, routing objections/withdrawals, deriving entry-into-force effects and issuing authoritative notifications without adjudicating treaty merits.
- **Required region graph:** `treaty-depositary → authentic-text-final-clauses-and-thresholds → eligible-state-organization-roster → instrument-intake-and-form-check → party-action-ledger ↔ reservation-declaration-register ↔ objection-acceptance-withdrawal-relations → per-party-consent-and-effective-status → global-entry-into-force-calculation → depositary-notification-and-registration-record`; party instruments, reservation relations and threshold-derived status are independent owners.
- **Wide:** Party/action ledger, selected instrument, reservation-objection relation map and entry-into-force calculation remain simultaneously visible; every status result links to its instrument and final clause.
- **Intermediate:** Party/action ledger and selected relation remain primary; instrument text and threshold evidence alternate in synchronized panes while authentic treaty version and current status persist.
- **Compact:** Treaty status → state/organization → instrument/form check → reservation/declaration → affected objections/withdrawals → party/global effect → depositary notification; relation graphs become ordered semantic records and Back restores exact context.
- **State obligations:** treaty adopted/open-for-signature/in-force/closed, instrument draft/received/improper-form/accepted, signature/ratification/acceptance/approval/accession, reservation proposed/registered/withdrawn, objection pending/registered/withdrawn, consent bound/not-yet-bound/ceased, threshold unmet/met/recalculated, notification draft/issued/corrected and registration pending/complete.
- **Hard rejection:** Reject cho timeline audit, bitemporal detail, regulatory filing validation, consensus/voting, chain-of-custody ledger or generic legal case dossier; multiple sovereign party instruments, reservation↔objection relations, treaty-specific final clauses, impartial form checks and derived per-party/global entry-into-force states are mandatory, without deciding whose policy position is correct.
- **Research anchors:** `WAI-FOCUS`, `WAI-REFLOW`, `WAI-STATUS`; add the [UN Treaty Handbook](https://treaties.un.org/Pages/Resource.aspx?path=Publication%2FTH%2FPage1_en.xml), [UN Treaty Collection depositary overview](https://treaties.un.org/pages/overview.aspx?path=overview%2Foverview%2Fpage1_en.xml), [Council of Europe Treaty Office](https://www.coe.int/en/web/dlapil/treaty-office) and [OAS multilateral treaty/depositary register](https://www.oas.org/juridico/english/Sigs/a-42.html).
- **Acceptance focus:** Template must validate an instrument, register a reservation, receive an objection and later withdrawal, recalculate per-party and global entry-into-force status, issue a corrected notification and preserve party/instrument/relation context across all topologies.

## Prompt 11 — `delegated-access-lifecycle-manager`

- **Output boundary:** `archetypes/settings/delegated-access-lifecycle-manager/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Manage a delegate from authority evidence through invitation, scoped grant, expiry, effective-access review, renewal and revocation.
- **Required region graph:** `delegation-manager → account-subject → delegate-roster → authority-evidence → scoped-access-bundles → invitation-verification-expiry → effective-access-activity → renew-revoke-recovery`; proof and lifecycle state distinguish delegates from permission cells.
- **Wide:** Roster, selected authority/grant and effective-access activity remain visible.
- **Intermediate:** Delegate selector and lifecycle detail remain; supporting evidence becomes a drawer.
- **Compact:** Delegate-first lifecycle: identity/authority → grant → invitation/verification → effective access → renew/revoke.
- **State obligations:** delegate invited/verified/expired/suspended, authority evidence valid/missing, grant draft/active, invitation delivery failure, activity unavailable, renewal pending, revoke pending/success and recovery.
- **Hard rejection:** Reject cho permissions matrix, third-party one-time grant, account switcher or preference center; authority proof plus invitation/expiry/review lifecycle are mandatory.
- **Research anchors:** `WAI-AUTH`, `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`, `CARBON-TABLE`; add [Microsoft access packages](https://learn.microsoft.com/en-us/entra/id-governance/entitlement-management-access-package-create) and [NIST federation](https://pages.nist.gov/800-63-4/sp800-63c.html).
- **Acceptance focus:** Template must invite/verify a delegate, apply a scoped expiry, show effective access/activity, renew/revoke safely and preserve selected delegate at compact.

## Prompt 12 — `communication-delivery-recovery-center`

- **Output boundary:** `archetypes/support/communication-delivery-recovery-center/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Repair failed delivery of a deadline-bound notice while preserving the immutable notice version, verifying an alternate channel and proving receipt or escalation.
- **Required region graph:** `delivery-recovery → notice-obligation-deadline → channel-endpoint-set → attempt-failure-evidence → alternate-channel-verification → retry-replay-plan → delivery-receipt → manual-escalation`; obligation/deadline and immutable payload govern recovery.
- **Wide:** Notice obligations, endpoints and selected failure/recovery remain visible.
- **Intermediate:** Failure queue and active recovery are primary; notice version/deadline persists.
- **Compact:** Urgent notice → failure cause → verify alternate channel → retry → receipt or escalation.
- **State obligations:** notice pending/due/overdue, endpoint verified/unverified, attempt queued/delivered/bounced/expired, retry locked/running, alternate unavailable, receipt confirmed and manual escalation.
- **Hard rejection:** Reject cho `interrupted-service-continuity-router`, asynchronous outcome tracker, messaging inbox, generic retry error or notification settings; an immutable notice obligation, channel-attempt lineage, recipient delivery evidence and fallback escalation own recovery—no in-progress service task or warm-transfer payload is routed.
- **Research anchors:** `GOVUK-PATTERNS`, `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`, `WAI-APG`; add [GOV.UK Notify status](https://www.notifications.service.gov.uk/using-notify/message-status/email) and [NHS Notify](https://digital.nhs.uk/services/nhs-notify).
- **Acceptance focus:** Template must diagnose failure, verify an alternate endpoint, retry the exact notice version, surface deadline risk and issue a delivery/escalation receipt.

## Prompt 13 — `third-party-data-access-grant`

- **Output boundary:** `archetypes/flow/third-party-data-access-grant/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Decide a runtime data-access grant for a named third party by resource, purpose, scope and duration, allowing partial denial and a clear revocation path.
- **Required region graph:** `access-grant → requester-identity-trust → requested-resource-purpose-scope → existing-grants-conflicts → granular-decision → duration-consequence → allow-deny-receipt → revocation-path`; each scope can be allowed or denied independently.
- **Wide:** Requester trust, requested scopes and consequences remain visible.
- **Intermediate:** Scope decisions are primary while requester/purpose summary persists.
- **Compact:** Requester → purpose/resources → granular decisions → duration/consequence → receipt and revocation route.
- **State obligations:** requester verified/unknown, scope requested/allowed/denied, purpose insufficient, conflict with existing grant, duration invalid, grant pending/active/expired/revoked and receipt.
- **Hard rejection:** Reject cho signature ceremony, permissions matrix, delegated lifecycle manager or consent preferences; one transactional multi-scope runtime authorization is mandatory.
- **Research anchors:** `WAI-AUTH`, `NIST-PRIVACY`, `WAI-FOCUS`, `WAI-STATUS`, `WAI-REFLOW`; add [IETF Rich Authorization Requests](https://datatracker.ietf.org/doc/html/rfc9396) and [ICO consent](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/consent/).
- **Acceptance focus:** Template must permit partial allow/deny, explain purpose/duration consequences, issue a precise receipt and expose a deterministic revocation path.

## Prompt 14 — `active-session-threat-containment`

- **Output boundary:** `archetypes/support/active-session-threat-containment/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Identify suspicious sessions or devices, preserve the current trusted access path, contain threats and complete credential-recovery follow-up.
- **Required region graph:** `session-containment → current-trusted-session → device-session-groups ↔ sign-in-risk-evidence → suspicious-selection → containment-actions → credential-recovery-followup → security-receipt`; self-lockout prevention owns every destructive action.
- **Wide:** Sessions, risk evidence and containment actions remain visible.
- **Intermediate:** Suspicious list and evidence are primary while current-safe-session status persists.
- **Compact:** Current safe session → suspicious session → risk evidence → contain → credential/recovery follow-up → receipt.
- **State obligations:** session active/expired/suspicious, device trusted/unknown, risk loading/high/low, revoke selected/all, self-lockout blocked, credential reset pending, recovery method unavailable and receipt.
- **Hard rejection:** Reject cho operational collection, account security list, incident command or credential rotation; coupled session/device/credential containment with safe-current-session invariant is mandatory.
- **Research anchors:** `WAI-AUTH`, `WAI-STATUS`, `WAI-FOCUS`, `WAI-OBSCURED`, `WAI-REFLOW`; add [NIST session management](https://pages.nist.gov/800-63-4/sp800-63b/session/) and [Google device review](https://support.google.com/accounts/answer/3067630?hl=en).
- **Acceptance focus:** Template must classify/revoke a suspicious session, prevent self-lockout, require recovery follow-up and keep current trusted session status visible at compact.

## Prompt 15 — `automated-decision-explanation-challenge`

- **Output boundary:** `archetypes/flow/automated-decision-explanation-challenge/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Understand a consequential automated outcome, inspect factors, source data and uncertainty, then correct inputs or challenge it for human review.
- **Required region graph:** `decision-challenge → outcome-impact → factor-explanation ↔ source-data-provenance → limits-uncertainty → correction-or-challenge-grounds → evidence-submit → human-review-tracker`; explanation and transactional challenge are peer owners.
- **Wide:** Outcome/factors, source facts and challenge workspace remain visible.
- **Intermediate:** Source provenance becomes a drawer while factors/grounds remain primary.
- **Compact:** Outcome → factors → source facts → limits → correction/challenge grounds → submit → human-review status.
- **State obligations:** outcome loading/final, factor available/withheld, source fact correct/incorrect/unknown, uncertainty high, correction allowed/blocked, challenge draft/submitted, evidence missing and review pending/decided.
- **Hard rejection:** Reject cho authored analytical briefing, generic appeal form, model dashboard or one-case dossier; subject-specific source provenance plus correction/challenge and human review are mandatory.
- **Research anchors:** `NIST-AI`, `WAI-FOCUS`, `WAI-STATUS`, `WAI-REFLOW`, `NIST-PRIVACY`; add [OECD AI Principles](https://www.oecd.org/en/topics/ai-principles.html).
- **Acceptance focus:** Template must inspect factors/source data, correct one fact or file a challenge, explain uncertainty and preserve exact disputed factor through review tracking.

## Prompt 16 — `consent-withdrawal-impact-review`

- **Output boundary:** `archetypes/flow/consent-withdrawal-impact-review/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Withdraw one or more grants after understanding affected purposes, recipients, services, unavoidable retention and propagation timing.
- **Required region graph:** `withdrawal-review → existing-grant-version → purpose-data-recipient-dependency-map → service-consequences → selectable-withdrawal-boundary → retained-basis-timing → confirm-propagation-receipts`; revocation scope and lawful retained basis must remain distinct.
- **Wide:** Dependency map, consequences and selectable scope remain visible.
- **Intermediate:** Impact list/path becomes primary while grant version persists.
- **Compact:** Grant → affected recipients/services → scope → retained basis/timing → confirm → propagation receipts.
- **State obligations:** grant active/partial/expired, dependency loading, recipient unknown, service consequence unavailable, scope selected, retained basis required, withdrawal pending/failure/success and propagation incomplete.
- **Hard rejection:** Reject cho configuration dependency resolver, consent signature, preference center or account exit; user-authorized withdrawal and lawful-retention separation are mandatory.
- **Research anchors:** `NIST-PRIVACY`, `WAI-FOCUS`, `WAI-STATUS`, `WAI-REFLOW`, `WAI-APG`; add [ICO consent management](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/consent/how-should-we-obtain-record-and-manage-consent/) and [IETF Rich Authorization Requests](https://datatracker.ietf.org/doc/html/rfc9396).
- **Acceptance focus:** Template must select partial withdrawal, expose downstream service/recipient impact, distinguish retained basis and show propagation receipts without implying immediate deletion.

## Prompt 17 — `regulatory-filing-package-validator`

- **Output boundary:** `archetypes/flow/regulatory-filing-package-validator/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Assemble schedules and attachments, validate cross-document conformance, prove signatory authority and transmit a test or live filing with an acceptance receipt.
- **Required region graph:** `filing-validator → filer-submission-type → required-schedule-register → attachment-manifest → cross-document-validation-errors → signatory-authority → test-live-review → transmit → acceptance-or-suspension`; package version and cross-document rules own transmission.
- **Wide:** Manifest, validation errors and submission/signatory summary remain visible.
- **Intermediate:** Errors become primary while manifest/version persists.
- **Compact:** Requirements → documents → errors → signatory → test/live review → transmit → receipt.
- **State obligations:** requirement missing, document uploaded/invalid, cross-reference mismatch, validation running/pass/fail, signatory verified/unauthorized, test accepted/rejected, live transmit pending and suspended receipt.
- **Hard rejection:** Reject cho import mapping, evidence bundle, generic filing checklist or review-submit ledger; official package version, cross-document validation, signatory and external acceptance are mandatory.
- **Research anchors:** `USWDS-PATTERNS`, `GOVUK-PATTERNS`, `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`; add [SEC EDGAR Filer Manual](https://www.sec.gov/submit-filings/edgar-filer-manual).
- **Acceptance focus:** Template must assemble a manifest, surface cross-document errors, verify signatory, separate test/live transmission and process accepted/suspended receipts.

## Prompt 18 — `regulated-sample-selection-workbench`

- **Output boundary:** `archetypes/work/regulated-sample-selection-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Define a population and sampling method, generate a sample, assess coverage and bias, govern replacements and lock an immutable testing handoff.
- **Required region graph:** `sample-selection → population-frame-exclusions → method-parameters → generated-sample → coverage-bias-evidence → replacement-exception-log → locked-sample-version → testing-handoff`; representativeness and replacement governance own the sample.
- **Wide:** Population/method, generated sample and coverage/bias evidence remain visible.
- **Intermediate:** Sample and coverage are primary while parameters become a drawer.
- **Compact:** Parameters → generated sample → coverage/bias → exceptions/replacements → lock → testing handoff.
- **State obligations:** frame loading/incomplete, exclusion valid/invalid, generation pending, sample selected, coverage sufficient/biased, replacement requested/approved, version unlocked/locked and handoff.
- **Hard rejection:** Reject cho query builder, experimental randomization design, control testing or batch selection; regulated representativeness, replacement log and immutable lock are mandatory.
- **Research anchors:** `USWDS-PATTERNS`, `CARBON-TABLE`, `WAI-FOCUS`, `WAI-STATUS`, `WAI-REFLOW`; add [GAO Financial Audit Manual](https://www.gao.gov/financial-audit-manual).
- **Acceptance focus:** Template must generate a deterministic sample, expose coverage/bias, govern a replacement and prevent edits after the immutable lock.

## Prompt 19 — `regulatory-comment-synthesis-workbench`

- **Output boundary:** `archetypes/work/regulatory-comment-synthesis-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Organize a public-comment corpus by issue, stance and evidence, trace every synthesis to source comments and prove response coverage.
- **Required region graph:** `comment-synthesis → docket-comment-corpus → issue-taxonomy ↔ comment-clusters → selected-comment-attachment-evidence → response-to-issue-composer → coverage-unresolved-register → published-response-package`; corpus coverage, not one case, owns completion.
- **Wide:** Issue taxonomy, comment clusters and source/response workspace remain visible.
- **Intermediate:** Source detail becomes a drawer while issue response/coverage persists.
- **Compact:** Issue → cluster → source evidence → response → coverage review → published package.
- **State obligations:** corpus loading/duplicate, issue unclassified, cluster provisional, source redacted, response draft/reviewed, material comment unresolved, coverage incomplete/complete and package publish.
- **Hard rejection:** Reject cho consultation response submission, one-case dossier, literature synthesis or document editor; corpus-wide clustering and every-material-issue response coverage are mandatory.
- **Research anchors:** `GOVUK-PATTERNS`, `USWDS-PATTERNS`, `WAI-FOCUS`, `WAI-STATUS`, `WAI-REFLOW`; add [EPA docket comments](https://www.epa.gov/dockets/commenting-epa-dockets) and [Regulations.gov API](https://open.gsa.gov/api/regulationsgov/).
- **Acceptance focus:** Template must classify comments, inspect source evidence, draft issue responses, expose unresolved coverage and publish only when material issues are addressed.

## Prompt 20 — `retention-obligation-disposition-workbench`

- **Output boundary:** `archetypes/work/retention-obligation-disposition-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Apply retention authority to record cohorts, resolve holds, preview delete, transfer or anonymize outcomes and produce an execution certificate.
- **Required region graph:** `disposition-workbench → record-cohort-inventory → retention-authority-clock → hold-exception-register → eligible-disposition-queue → delete-transfer-anonymize-preview → approval-execution → certificate`; active holds veto otherwise eligible execution.
- **Wide:** Cohorts, authority/hold evidence and eligible queue remain visible.
- **Intermediate:** Eligible queue and selected exception are primary while clock/hold summary persists.
- **Compact:** Cohort → authority/clock/holds → disposition preview → approval → execution/certificate.
- **State obligations:** cohort loading, clock running/matured, hold active/released/conflicting, disposition eligible/blocked, preview ready/stale, approval pending/denied, execution partial/failure/success and certificate.
- **Hard rejection:** Reject cho retention policy authoring, generic batch operations, account closure or data export; policy-derived clocks, hold vetoes and certified irreversible execution are mandatory.
- **Research anchors:** `NIST-PRIVACY`, `CARBON-TABLE`, `WAI-STATUS`, `WAI-FOCUS`, `WAI-REFLOW`; add [NARA scheduling and appraisal](https://www.archives.gov/records-mgmt/sch-appraisal) and [NIST media sanitization](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-88r2.pdf).
- **Acceptance focus:** Template must calculate eligibility, block a held cohort, preview multiple disposition types, simulate partial execution and issue a traceable certificate.
