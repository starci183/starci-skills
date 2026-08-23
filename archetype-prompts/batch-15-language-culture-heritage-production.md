# Batch 15 — Language, culture and heritage production archetypes (20 prompts)

Tệp này là **một prompt batch tự chứa** cho linguistic evidence, notation and performance craft, material-culture reconstruction, library and archive stewardship, accessible transcription, and advanced moving-image production surfaces. Khi chạy ở nơi khác, đưa toàn bộ tệp cho agent để tạo đủ 20 leaf. Nếu chỉ chạy một mục, phải đưa kèm toàn bộ phần từ `Cách chạy` đến `Nguồn research dùng chung`; không tách riêng block prompt khỏi hợp đồng chung.

## Mục lục

| # | Archetype ID | Câu hỏi bố cục chính |
|---:|---|---|
| 01 | `musical-temperament-beat-rate-tuning-workbench` | Làm sao tune một temperament bằng target và observed beat rate, khép independent cycles và lộ comma residual hoặc wolf interval? |
| 02 | `interlinear-gloss-morpheme-alignment-workbench` | Làm sao giữ token, morpheme, gloss và free translation thẳng hàng khi segmentation thay đổi? |
| 03 | `mensural-notation-proportion-tactus-realization-workbench` | Làm sao suy ra duration từ mensuration, coloration, proportion và context rồi căn shared tactus giữa các voices? |
| 04 | `archaeological-stratigraphic-phasing-workbench` | Làm sao biến quan hệ vật lý giữa contexts thành Harris matrix không chu trình và phase interpretation có dating evidence? |
| 05 | `serials-holdings-enumeration-gap-workbench` | Làm sao mô tả serial holdings chính xác khi enumeration, chronology, publication pattern và gaps không đồng nhất? |
| 06 | `weaving-draft-liftplan-drawdown-workbench` | Làm sao chỉnh threading, tie-up và treadling để drawdown dẫn xuất đúng mà không tạo floats hoặc loom impossibility? |
| 07 | `musical-instrument-fingering-mechanism-mapper` | Làm sao ánh xạ notes/chords sang fingering hợp lệ trên cơ cấu key-hole-valve-string cụ thể và kiểm transition chơi được? |
| 08 | `braille-translation-contraction-proof-workbench` | Làm sao áp dụng braille contractions có rule trace, pagination và back-translation chứng minh không đổi nghĩa? |
| 09 | `heraldic-blazon-emblazonment-roundtrip-validator` | Làm sao giữ blazon pháp lý và emblazonment thị giác tương đương qua hai chiều parse–render–describe? |
| 10 | `poetry-meter-scansion-prosody-workbench` | Làm sao phân đoạn syllable, stress và feet để giải thích metrical pattern cùng mọi substitution và caesura? |
| 11 | `vinyl-side-sequencing-groove-budget-planner` | Làm sao chia và sắp track lên các mặt đĩa trong groove budget mà vẫn kiểm level, bass, stereo và inner-groove risk? |
| 12 | `numismatic-specimen-die-linkage-analyzer` | Làm sao nối specimens với obverse/reverse dies để dựng die chains, die states và chronology mà không nhập nhằng evidence? |
| 13 | `organ-registration-coupler-piston-programmer` | Làm sao program stops, couplers và piston memories cho các cue biểu diễn mà effective sounding divisions luôn giải thích được? |
| 14 | `motion-capture-skeleton-retargeting-workbench` | Làm sao chuyển motion giữa hai skeleton khác tỷ lệ/hierarchy mà giữ contacts, limits, root motion và deformation hợp lệ? |
| 15 | `archaeological-fragment-refit-assembly-workbench` | Làm sao adjudicate candidate joins rồi dựng một assembly hypothesis vật lý nhất quán từ nhiều fragments? |
| 16 | `theatrical-counterweight-rigging-load-path-workbench` | Làm sao chứng minh load path, lift-line reactions, arbor balance và travel limits trước khi release một theatrical line set? |
| 17 | `motion-picture-keycode-cut-list-conform-workbench` | Làm sao chuyển edit timecode thành KEYKODE cut list frame-accurate và reconcile dupe, handle, optical cùng physical/DI conform? |
| 18 | `radio-frequency-interference-coordination-workbench` | Làm sao coordinate một frequency request bằng emission, terrain, receivers và protection margins trước khi gửi cho affected parties? |
| 19 | `cinema-focus-pull-depth-of-field-rehearsal-workbench` | Làm sao rehearsal một focus pull theo camera/subject trajectories, lens calibration và depth-of-field envelope rồi đo sai lệch thực tế? |
| 20 | `bookbinding-collation-structure-reconstruction-workbench` | Làm sao tái dựng gatherings, bifolia và reading order từ foliation, signatures, catchwords, stubs và missing leaves? |

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

## Prompt 01 — `musical-temperament-beat-rate-tuning-workbench`

- **Output boundary:** `archetypes/work/musical-temperament-beat-rate-tuning-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Tune an acoustic instrument or register to one declared reference pitch and temperament by working through a spanning sequence of intervals, comparing target with observed beat direction and rate, propagating every movable-note adjustment and proving independent cycle closure before issuing a repeatable tuning receipt.
- **Required region graph:** `tuning → reference-pitch-temperature-and-temperament → note-frequency-register-state → spanning-tuning-interval-sequence → target-ratio-cents-and-beat-rate-per-edge → observed-beat-direction-and-rate → movable-note-adjustment-and-frequency-propagation → independent-cycle-closure-checks → comma-residual-and-wolf-interval-ledger → octave-register-verification → repeatable-tuning-receipt`; the same note-frequency state owns interval observations, propagated adjustments and all closure residuals.
- **Wide:** Reference conditions, register map, spanning tuning sequence, active interval target/observation, propagation consequences, cycle closures and comma/wolf ledger remain visible together.
- **Intermediate:** The active interval's target-to-observed beat decision and affected-note propagation remain primary; the full register map, independent closures and receipt history move to synchronized panels without losing the selected edge or movable note.
- **Compact:** Reference note → next tuning interval → target ratio, cents and beat → observed beat direction/rate → adjust movable note → propagate frequency → close independent cycle → inspect comma or wolf → verify octaves → receipt; register geometry becomes an ordered semantic route with no page-level horizontal scrolling.
- **State obligations:** reference pitch verified/changed, temperature current/stale, temperament selected/revised, note fixed/movable/tuned/drifted, edge queued/listening/adjusted/passed, beat direction expected/reversed/indeterminate, observed rate under/on/over target, propagation clean/conflicting, cycle open/closed/residual-exceeded, comma expected/unexplained, wolf accepted/rejected, octave verified/diverged and receipt draft/approved/revoked.
- **Hard rejection:** Reject cho `structure-spectrum-assignment-workbench`, `audio-mix-routing-console`, `constraint-solver-unsat-core-explorer` or `organ-registration-coupler-piston-programmer`; reference-condition authority, a spanning interval sequence, signed observed beat rates, movable-note frequency propagation, independent closure residuals and octave verification are mandatory.
- **Research anchors:** `CARBON-TABLE`, `WAI-REFLOW`, `WAI-FOCUS`, `WAI-OBSCURED`, `WAI-STATUS`; add [ISO 16:1975 Acoustics — Standard tuning frequency](https://www.iso.org/standard/3601.html) and [NIST Time and Frequency from A to Z](https://www.nist.gov/pml/time-and-frequency-division/popular-links/time-frequency-z).
- **Acceptance focus:** Template must bind a reference pitch and temperature, traverse at least three tuning edges, compare one target and observed signed beat rate, adjust and propagate one movable note, reveal a failed independent cycle closure or wolf interval, correct it, verify an octave in another register and issue a versioned tuning receipt.

## Prompt 02 — `interlinear-gloss-morpheme-alignment-workbench`

- **Output boundary:** `archetypes/work/interlinear-gloss-morpheme-alignment-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Author and validate an interlinear glossed text by aligning utterance words, morpheme segmentation, object-language forms, lexical or grammatical glosses and a free translation under one declared convention.
- **Required region graph:** `interlinear-authoring → language-speaker-text-and-convention-version → utterance-and-stable-token-IDs → word-to-morpheme-incidence-and-cardinality-matrix ↔ object-language-form-tier ↔ lexical-and-grammatical-gloss-tier → atomic-split-or-merge-rekeying-all-tiers → abbreviation-lexicon-and-word-level-alignment → free-translation-and-analyst-notes → orphan-boundary-and-tier-validation → corpus-example-export`; a non-1:1 incidence matrix owns form/gloss cardinality, and every split or merge atomically rekeys all tier references.
- **Wide:** Utterance context, word sequence, linked morpheme/form/gloss tiers, abbreviation lexicon and validation queue remain simultaneously visible.
- **Intermediate:** The active word and its tier alignment remain primary; full utterance, lexicon and analyst notes move to synchronized panels that retain the active morpheme.
- **Compact:** Utterance → word stable ID → pre-edit token and morpheme IDs → split or merge → incidence/cardinality links → post-edit form and gloss IDs → abbreviation and free translation → orphan check → commit or block; an unresolved or stale tier reference blocks commit, and each tier becomes an ordered semantic list instead of a squeezed alignment table.
- **State obligations:** text draft/locked, convention current/changed, token confirmed/split/merged, morpheme boundary proposed/accepted/uncertain, gloss lexical/grammatical/missing, abbreviation defined/undefined/conflicting, alignment balanced/orphaned, free translation missing/current, validation pass/warn/fail and example exported/withdrawn.
- **Hard rejection:** Reject cho `localization-workbench`, `media-annotation-workbench`, `spreadsheet-grid-editor` or `reconciliation-diff-workbench`; stable token ownership, a non-1:1 word-to-morpheme incidence/cardinality matrix, atomic split-or-merge rekeying across form and gloss tiers, abbreviation semantics and commit-blocking orphan validation are mandatory.
- **Research anchors:** `CARBON-TABLE`, `WAI-GRID`, `WAI-REFLOW`, `WAI-FOCUS`, `WAI-STATUS`; add the [Leipzig Glossing Rules from the Max Planck Institute](https://www.eva.mpg.de/lingua/resources/glossing-rules.php) and [SIL FieldWorks interlinear text guidance](https://software.sil.org/fieldworks/features/orientation-to-fieldworks/interlinearize-texts/).
- **Acceptance focus:** Template must show pre-edit stable IDs, split one word into multiple morphemes, atomically rekey every linked form and gloss, define one previously unknown abbreviation, block commit on a deliberately orphaned tier item, resolve it, preserve the utterance translation and export a valid corpus example without mouse-only dragging.

## Prompt 03 — `mensural-notation-proportion-tactus-realization-workbench`

- **Output boundary:** `archetypes/work/mensural-notation-proportion-tactus-realization-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Realize a polyphonic mensural-notation passage by deriving note and rest durations from per-voice mensuration, coloration, proportion, ligature and local imperfection or alteration context, then reconcile every voice against a shared tactus and publish explicit competing interpretations in the apparatus.
- **Required region graph:** `mensural-realization → source-witness-notation-system-and-editorial-policy → voice-specific-event-and-ligature-sequences → mensuration-coloration-and-proportion-state-per-voice → context-derived-note-and-rest-values → imperfection-alteration-and-ligature-resolution-branches → shared-tactus-cross-voice-alignment → contradiction-and-competing-interpretation-ledger → modern-duration-realization-and-apparatus → reviewed-encoded-edition`; contextual duration derivation owns the realization, while the shared tactus proves cross-voice coherence without flattening voices into a generic track timeline.
- **Wide:** Source-witness passage, voice-specific event sequences, mensuration/proportion states, derived values, cross-voice tactus alignment and competing-interpretation ledger remain visible together.
- **Intermediate:** The active voice event and its contextual duration branch remain primary; other voices collapse to synchronized tactus checkpoints, while witness context and apparatus move to panels that retain the same event identity.
- **Compact:** Source passage → voice and mensuration/proportion state → event or ligature context → derived duration → imperfection, alteration or ligature branch → shared-tactus checkpoint → competing interpretation → modern realization and apparatus; voices become ordered routes with no squeezed multi-track canvas.
- **State obligations:** witness current/revised, notation system declared/uncertain, voice active/hidden, mensuration inherited/changed/ambiguous, coloration inactive/active, proportion open/closed/conflicting, ligature unresolved/resolved, value perfect/imperfect/altered/disputed, tactus aligned/drifted, interpretation primary/alternate/rejected, apparatus incomplete/ready and encoded edition reviewed/returned/published.
- **Hard rejection:** Reject cho `media-annotation-workbench`, `multi-track-timeline-editor`, `rule-builder-workbench` or `poetry-meter-scansion-prosody-workbench`; per-voice mensuration and proportion state, context-derived values, imperfection/alteration/ligature branching, shared-tactus alignment and an explicit competing-interpretation apparatus are mandatory.
- **Research anchors:** `CARBON-TABLE`, `WAI-REFLOW`, `WAI-FOCUS`, `WAI-OBSCURED`, `WAI-STATUS`; add the [Music Encoding Initiative v5 mensural notation guidelines](https://music-encoding.org/guidelines/v5/content/mensural.html) and [RISM Cataloging Guidelines](https://guidelines.rism.info/masks.html).
- **Acceptance focus:** Template must realize at least two voices under different mensuration or proportion states, derive one colored or ligated event, branch one imperfection or alteration ambiguity, expose a cross-voice tactus contradiction, compare two interpretations, resolve the contradiction and publish a modern-duration realization with a traceable critical apparatus.

## Prompt 04 — `archaeological-stratigraphic-phasing-workbench`

- **Output boundary:** `archetypes/work/archaeological-stratigraphic-phasing-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Build and defend an archaeological stratigraphic sequence from recorded physical interfaces, detect impossible relationships and group validated contexts into interpretive phases without erasing primary observations.
- **Required region graph:** `stratigraphic-phasing → excavation-area-recording-version → context-register-and-type → physical-interface-and-section-evidence → direct-earlier-later-relationship-ledger → Harris-directed-acyclic-graph ↔ contradiction-cycle-and-redundancy-queue → dating-finds-and-terminus-evidence → phase-grouping-and-interpretive-event-model → reviewed-sequence-and-archive-export`; only recorded direct relationships create graph edges and interpretations remain a separate layer.
- **Wide:** Context register, section/interface evidence, Harris graph, selected relationship ledger, contradiction queue and phase interpretation remain visible together.
- **Intermediate:** The selected context neighborhood and direct relationship evidence remain primary; full graph, dating evidence and phase groups become synchronized drawers.
- **Compact:** Context → recorded physical interface → direct earlier/later relation → local predecessor/successor chain → contradiction or redundancy → dating bound → phase proposal → review; a semantic relation list replaces the full graph.
- **State obligations:** context unrecorded/draft/verified, interface observed/inferred/disputed, relation proposed/direct/rejected, graph acyclic/cyclic/incomplete, redundancy intentional/unnecessary, dating evidence open/accepted/conflicting, phase unassigned/proposed/approved, interpretation superseded and archive export valid/blocked.
- **Hard rejection:** Reject cho `critical-path-schedule-workbench`, `dependency-topology-monitor`, a generic knowledge graph or causal-root explorer; archaeological contexts, observed physical interfaces, direct earlier/later edges, Harris acyclicity, terminus evidence and interpretation-separated phase grouping are mandatory.
- **Research anchors:** `WAI-DRAG`, `WAI-REFLOW`, `WAI-FOCUS`, `WAI-STATUS`, `ESRI-LAYOUT`; add the [Historic England Archaeological Recording Manual](https://historicengland.org.uk/content/docs/research/historic-england-archaeological-recording-manual-2018) and [Archaeology Data Service files and metadata guidance](https://archaeologydataservice.ac.uk/help-guidance/instructions-for-depositors/files-and-metadata/).
- **Acceptance focus:** Template must add one direct stratigraphic relation from section evidence, reveal a cycle caused by a contradictory edge, offer keyboard and button alternatives to graph dragging, remove or reject the bad edge, apply a dating terminus, propose a phase and export the reviewed acyclic sequence.

## Prompt 05 — `serials-holdings-enumeration-gap-workbench`

- **Output boundary:** `archetypes/work/serials-holdings-enumeration-gap-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Record and publish exactly which issues of a continuing serial a location holds by pairing hierarchical enumeration with chronology, predicting expected issues and distinguishing real gaps from irregular publication, supplements or bound-unit choices.
- **Required region graph:** `serials-holdings → bibliographic-title-copy-location-and-publication-pattern-version → predicted-issue-generator → enumeration-levels × chronology-levels → enumeration-chronology-issue-identity → received-item-ledger → expected-issue-classification-as-received-missing-not-published-or-irregular → supplement-index-and-bound-unit-check → reversible-expanded-to-compressed-to-expanded-equality-proof → publish-holdings-and-claiming-handoff`; enumeration and chronology jointly own issue identity, and compression is valid only when expansion reproduces that exact classified issue set.
- **Wide:** Title/copy context, paired enumeration-chronology grid, expected sequence, gap ledger and compressed holdings statement remain visible together.
- **Intermediate:** The selected run and its expected-versus-received issues remain primary; caption hierarchy, bound units and statement rules move to synchronized drawers.
- **Compact:** Location/copy → publication-pattern version → predicted issue → enumeration×chronology identity → received, missing, not-published or irregular → supplement/binding evidence → expanded statement → compress → re-expand the same issue → equality proof → publish or claim; the complete issue matrix stays in a bounded table route.
- **State obligations:** publication active/ceased/unknown, pattern regular/irregular/changed, issue expected/received/missing/not-published, enumeration valid/ambiguous, chronology exact/approximate, supplement linked/orphaned, index covered/missing, bound unit open/complete, summary valid/overcompressed and holdings published/revised.
- **Hard rejection:** Reject cho `inventory-replenishment-planner`, `cycle-count-variance-reconciliation-workbench`, `timeline-status-monitor` or `spreadsheet-grid-editor`; a versioned publication-pattern generator, enumeration×chronology issue identity, received/missing/not-published/irregular classification and reversible statement equality proof are mandatory.
- **Research anchors:** `CARBON-TABLE`, `WAI-GRID`, `WAI-REFLOW`, `WAI-FOCUS`, `WAI-STATUS`; add the [Library of Congress MARC 21 Format for Holdings Data](https://www.loc.gov/marc/holdings/) and [NISO Z39.71 Holdings Statements for Bibliographic Items](https://www.niso.org/publications/z3971-2006-r2011).
- **Acceptance focus:** Template must generate expected issues from one versioned pattern, identify each by paired enumeration and chronology, classify one as missing and another as not published, attach a supplement, compress the expanded issue set, re-expand one issue to prove identity equality and publish a statement that preserves the remaining claimable gap.

## Prompt 06 — `weaving-draft-liftplan-drawdown-workbench`

- **Output boundary:** `archetypes/work/weaving-draft-liftplan-drawdown-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Construct an executable loom draft by coordinating warp threading, treadle-to-shaft tie-up or liftplan and pick sequence, then derive the interlacement drawdown and correct structural or loom-feasibility defects.
- **Required region graph:** `weaving-draft → loom-shaft-treadle-and-fabric-spec → warp-thread-order-and-shaft-threading-matrix ↔ treadle-to-shaft-tieup-or-liftplan-matrix ↔ pick-by-treadle-sequence → derived-warp-weft-interlacement-drawdown → float-selvedge-repeat-and-loom-feasibility-validation → color-and-structure-simulation → corrected-executable-draft → export-and-sample-proof`; the drawdown is derived from three linked matrices and cannot be painted independently.
- **Wide:** Threading, tie-up or liftplan, treadling, derived drawdown, loom limits and validation findings remain aligned and visible together.
- **Intermediate:** The active repeat and two contributing matrices remain primary; full drawdown, color simulation and loom setup move to synchronized panels without losing shaft, end or pick coordinates.
- **Compact:** Repeat → warp end and threading → pick and lift set → derived interlacement row → float/selvedge/loom violation → correction → sample proof; matrices become navigable row/column cards with labeled coordinates and no page-level horizontal scroll.
- **State obligations:** loom profile valid/mismatched, threading incomplete/valid, tie-up asymmetric/valid, liftplan conflict, treadling draft/complete, drawdown stale/recomputed, float acceptable/excessive, selvedge stable/open, repeat aligned/broken, sample pending/accepted and export current/superseded.
- **Hard rejection:** Reject cho a spreadsheet grid, `palette-and-token-workbench`, `canvas-inspector-workspace` or a generic rule builder; three separately editable but linked threading/tie-up-or-liftplan/treadling matrices, mechanically derived drawdown, loom limits and interlacement validation are mandatory.
- **Research anchors:** `WAI-GRID`, `WAI-DRAG`, `WAI-REFLOW`, `WAI-FOCUS`, `WAI-STATUS`; add the [Weavers' Guild of Boston weaving-draft definitions](https://www.weaversguildofboston.org/_files/ugd/c50db8_b78ed82b8ca74e45ac7203fa3b087bd3.pdf) and the [Black Mountain College Museum digital weaving project](https://www.blackmountaincollege.org/?p=37224).
- **Acceptance focus:** Template must alter one threading cell and one treadle or lift selection, recompute rather than paint the drawdown, surface an excessive float, provide button and keyboard alternatives to dragging, correct the draft and preserve both an executable export and sample-proof state.

## Prompt 07 — `musical-instrument-fingering-mechanism-mapper`

- **Output boundary:** `archetypes/work/musical-instrument-fingering-mechanism-mapper/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Map a note, chord or passage to playable fingerings on one exact instrument mechanism, compare alternate physical key/hole/valve/string states and validate transitions across the performed sequence.
- **Required region graph:** `fingering-mapper → instrument-model-tuning-and-mechanism-version → note-chord-and-articulation-sequence → physical-key-hole-valve-string-state-model → candidate-fingering-set-per-event → sounding-pitch-register-and-alternate-fingering-proof → transition-path-hand-span-and-technique-constraints → difficult-transition-and-unreachable-queue → selected-fingering-sequence-and-notation → performer-validation-and-export`; candidate equivalence is based on sounding result while selection is constrained by physical transition cost.
- **Wide:** Passage notation, instrument mechanism, candidate fingerings, prior/next transition evidence and unreachable queue remain visible together.
- **Intermediate:** The active event and mechanism state remain primary; passage overview, alternate candidates and performer notes move to synchronized panels.
- **Compact:** Note or chord → candidate physical state → sounding pitch/register → previous and next transition → constraint or technique note → select and validate; the mechanism diagram always has a labeled key/hole/valve/string list alternative.
- **State obligations:** instrument profile current/wrong, event unassigned/assigned, candidate standard/alternate/extended/unreachable, pitch correct/out-of-register, mechanism state valid/conflicting, transition easy/difficult/impossible, hand span within/exceeded, performer test pending/accepted/rejected and export current/stale.
- **Hard rejection:** Reject cho a typeface glyph map, `spatial-route-constraint-planner`, `canvas-inspector-workspace` or `score-to-part-extraction-proof-workbench`; a versioned physical instrument mechanism, many-to-one fingering candidates, sounding-pitch proof and sequence-dependent transition feasibility are mandatory.
- **Research anchors:** `WAI-DRAG`, `WAI-FOCUS`, `WAI-REFLOW`, `WAI-STATUS`, `FLUENT-LAYOUT`; add [Yamaha instrument fingering charts](https://www.yamaha.com/en/musical_instrument_guide/feature/fingering/) and the [Music Encoding Initiative common music notation guidance](https://music-encoding.org/guidelines/v5/content/cmn.html).
- **Acceptance focus:** Template must show two physical fingerings for one sounding note, reject one because its transition from the previous event is impossible, allow mechanism selection without dragging, choose a playable alternate, validate the next transition and export a performer-reviewed sequence tied to the instrument model.

## Prompt 08 — `braille-translation-contraction-proof-workbench`

- **Output boundary:** `archetypes/work/braille-translation-contraction-proof-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Translate print source into a declared braille code, prove every contraction and indicator decision, back-translate the cells and certify a tactile master whose semantics and pagination are intact.
- **Required region graph:** `braille-proof → source-language-purpose-and-code-edition → print-block-and-stable-token-sequence → braille-finite-state-transducer → pre-token-grade-capital-number-and-emphasis-state → rule-and-contraction-transition → source-span-to-cell-span-mapping → post-token-grade-capital-number-and-emphasis-state → line-page-formatting-and-state-carry-or-close → independent-back-translation → semantic-punctuation-capitalization-and-number-discrepancy-ledger → tactile-proofreader-corrections → certified-master-and-embosser-export`; every cell span retains its source span, transition rule and pre/post transducer state.
- **Wide:** Print source, braille cells with line/page context, applied-rule trace, back-translation and discrepancy ledger remain visible together.
- **Intermediate:** The active token-to-cell decision and back-translation remain primary; full page layout, rulebook context and proofreader history move to synchronized drawers.
- **Compact:** Source token → inherited grade/capital/number/emphasis state → rule or contraction transition → cell span → resulting indicator state → carry or close at line/page boundary → independent back-translation → discrepancy → correct or certify; visual dot diagrams include textual dot-number labels and semantic cell strings.
- **State obligations:** source current/changed, code edition selected/outdated, token contracted/uncontracted/ambiguous, indicator open/closed/missing, cell sequence valid/invalid, line overflow, page break approved/risky, back-translation equal/diverged, proofreader issue open/resolved and master certified/revoked.
- **Hard rejection:** Reject cho `localization-workbench`, `print-proof-preflight-review`, `reconciliation-diff-workbench` or `typeface-glyph-metrics-workbench`; a braille finite-state transducer, explicit pre/post indicator state, source-span↔cell-span ownership, line/page state carry-or-close and independent back-translation are mandatory.
- **Research anchors:** `WAI-REFLOW`, `WAI-FOCUS`, `WAI-OBSCURED`, `WAI-STATUS`, `CARBON-TABLE`; add the [International Council on English Braille UEB rulebook](https://iceb.org/publications/ueb/) and the [Braille Authority of North America UEB implementation statement](https://www.brailleauthority.org/ueb/implementation/statement.pdf).
- **Acceptance focus:** Template must show one token's inherited transducer state, apply a contraction transition with exact rule and source-span↔dot-numbered-cell-span trace, carry or close an indicator at a line boundary, show the resulting state, reveal one discrepancy through an independent back-translation, accept tactile proof and certify an embosser-ready master with visible code-version provenance.

## Prompt 09 — `heraldic-blazon-emblazonment-roundtrip-validator`

- **Output boundary:** `archetypes/work/heraldic-blazon-emblazonment-roundtrip-validator/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Validate that a jurisdictionally normalized heraldic blazon and its emblazonment express the same arms by resolving clause semantics into a scene, recapturing that scene and explaining every roundtrip difference.
- **Required region graph:** `heraldic-roundtrip → jurisdiction-grant-and-register-authority → normalized-blazon-clause-tree → tincture-ordinary-charge-attitude-and-marshalling-semantics → deterministic-emblazonment-scene-graph ↔ accessible-structural-description → visual-to-semantic-recapture → tincture-rule-positional-and-difference-mark-validation → blazon-vs-recaptured-roundtrip-delta → herald-review-and-register-proof`; the grant's semantic armorial structure, not pixel similarity, owns equivalence.
- **Wide:** Blazon clause tree, semantic armorial scene, emblazonment, accessible description, recaptured semantics and rule/delta ledger remain visible together.
- **Intermediate:** The active clause-to-scene relationship and roundtrip delta remain primary; full rendering, register context and validation history move to synchronized panels.
- **Compact:** Grant and clause → resolved tincture/ordinary/charge relation → accessible structural description → recaptured clause → heraldic rule check → roundtrip delta → accept or correct; the image is supportive and never the only carrier of structure.
- **State obligations:** grant draft/registered/superseded, clause parsed/ambiguous/invalid, tincture resolved/conflicting, charge attitude known/unknown, marshalling complete/incomplete, scene generated/stale, recapture equivalent/divergent, rule pass/warn/fail, difference mark verified and review approved/returned.
- **Hard rejection:** Reject cho `canvas-inspector-workspace`, `media-annotation-review-console`, `reconciliation-diff-workbench` or a generic illustration editor; jurisdictional grant authority, normalized blazon semantics, deterministic semantic scene, accessible structural recapture and heraldic rule equivalence are mandatory.
- **Research anchors:** `WAI-REFLOW`, `WAI-FOCUS`, `WAI-STATUS`, `WAI-DRAG`, `FLUENT-LAYOUT`; add the [College of Arms official guidance and records](https://www.college-of-arms.gov.uk/) and the [Canadian Heraldic Authority Public Register](https://www.gg.ca/en/heraldry/public-register/project/1698).
- **Acceptance focus:** Template must parse one blazon clause, map it to a labeled charge relationship, expose the same structure without the image, recapture a deliberately wrong tincture or position, explain the rule and semantic delta, correct it without dragging and approve an equivalent register proof.

## Prompt 10 — `poetry-meter-scansion-prosody-workbench`

- **Output boundary:** `archetypes/work/poetry-meter-scansion-prosody-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Scan a poem under an explicit metrical hypothesis by resolving syllables and contextual stress or quantity, grouping metrical positions and documenting meaningful substitutions, caesurae and competing readings.
- **Required region graph:** `prosody-workbench → poem-language-edition-and-meter-hypothesis → stanza-line-word-and-syllable-sequence → lexical-and-contextual-stress-evidence → syllable-quantity-or-stress-scansion-grid → foot-boundary-caesura-and-metrical-position-model → substitution-elision-resolution-and-extrametrical-annotations → line-pattern-and-poem-level-variation-summary → competing-scansion-comparison-and-rationale → annotated-edition-export`; scansion is a hierarchical interpretation over syllable evidence rather than decorative marks on text.
- **Wide:** Poem lines, syllable/stress evidence, foot and caesura model, deviations, competing reading and poem-level pattern remain visible together.
- **Intermediate:** The active line and its evidence-to-meter mapping remain primary; stanza pattern, alternative analysis and terminology notes move to synchronized drawers.
- **Compact:** Line → word and syllable → contextual stress or quantity → metrical position and foot → caesura/substitution/elision → competing reading → rationale; symbols always have spoken or textual names and ordered semantic controls.
- **State obligations:** edition current/variant, meter hypothesis selected/competing, syllabification confirmed/disputed, stress lexical/contextual/ambiguous, position filled/resolved/extra, foot boundary proposed/accepted, caesura primary/secondary, substitution allowed/unexplained, line regular/variant and analysis reviewed/exported.
- **Hard rejection:** Reject cho `document-outline-workspace`, text highlighting, `media-annotation-review-console`, localization or a spreadsheet; word-to-syllable hierarchy, stress or quantity evidence, metrical positions, foot boundaries, licensed deviations and competing scansion rationale are mandatory.
- **Research anchors:** `WAI-GRID`, `WAI-REFLOW`, `WAI-FOCUS`, `WAI-STATUS`, `WAI-OBSCURED`; add the [Academy of American Poets glossary of meter](https://poets.org/glossary/meter) and the [TEI P5 Verse guidelines](https://www.tei-c.org/release/doc/tei-p5-doc/en/html/VE.html).
- **Acceptance focus:** Template must syllabify one line, change a contextual stress, regroup its feet, mark a caesura and one licensed substitution, compare an alternate scansion with explicit rationale and export a semantic annotation understandable without color or visual scansion marks alone.

## Prompt 11 — `vinyl-side-sequencing-groove-budget-planner`

- **Output boundary:** `archetypes/work/vinyl-side-sequencing-groove-budget-planner/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Sequence masters across physical record sides by forecasting radial groove use and cutting risk, then choose order, edits, level or format changes before sending a traceable side master to the cutting engineer.
- **Required region graph:** `vinyl-sequencing → release-format-disc-size-speed-and-lathe-profile → track-master-register-and-technical-analysis → side-a-side-b-membership-and-running-order → per-side-duration-gap-and-lock-groove-ledger → radial-groove-budget-and-inner-radius-projection ↔ level-low-frequency-stereo-phase-and-sibilance-risks → reorder-edit-level-or-format-counterfactuals → cutting-engineer-notes-and-side-master-manifest → test-cut-approval-and-pressing-handoff`; track order changes both radial position and downstream cut feasibility.
- **Wide:** Both ordered sides, radial budget projection, track technical risks, counterfactual comparison and cutting notes remain visible together.
- **Intermediate:** The selected side and its limiting inner-groove track remain primary; other side, complete analysis and format alternatives move to synchronized panels.
- **Compact:** Side → ordered track → cumulative radial position and remaining groove budget → position-specific cut risk → reorder/edit/level/format alternative → engineer note → handoff; no waveform timeline is required.
- **State obligations:** master missing/current/revised, side under/near/over budget, track outer/mid/inner radius, gap or lock groove valid/invalid, bass/stereo/sibilance risk low/raised/blocking, counterfactual unsolved/viable, engineer note open/answered, test cut pending/pass/fail and manifest approved/superseded.
- **Hard rejection:** Reject cho `multi-track-timeline-workbench`, `audio-mix-routing-console`, load packing or a calendar scheduler; physical disc side membership, radial groove consumption, inner-radius-dependent cutting risk, format/level/order counterfactuals and a cutting-side master manifest are mandatory.
- **Research anchors:** `WAI-DRAG`, `WAI-REFLOW`, `WAI-FOCUS`, `WAI-STATUS`, `CARBON-TABLE`; add [Ableton's mastering-for-vinyl guidance](https://www.ableton.com/en/blog/mastering-tracks-for-vinyl-record/) and the [Mixonic Vinyl Audio Guidelines](https://www.mixonic.com/VinylAudioGuidelines.pdf).
- **Acceptance focus:** Template must move a track between sides through buttons or keyboard as well as drag, recompute its radial position and remaining budget, expose an inner-groove risk, compare at least two corrective counterfactuals, record the cutting engineer's choice and approve versioned side manifests.

## Prompt 12 — `numismatic-specimen-die-linkage-analyzer`

- **Output boundary:** `archetypes/work/numismatic-specimen-die-linkage-analyzer/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Infer coin-production relationships by assigning each specimen independently to obverse and reverse die identities, then reviewing the specimen bridges that form die pairs, chains and a defensible production sequence.
- **Required region graph:** `die-linkage-analysis → corpus-mint-denomination-and-period → specimen-register-with-obverse-reverse-evidence → candidate-obverse-die-clusters ↔ candidate-reverse-die-clusters → specimen-to-obverse-and-reverse-die-bipartite-links → die-match-confidence-conflict-and-wear-state → die-pair-chain-and-link-sequence → production-chronology-and-output-hypotheses → reviewed-die-study-and-linked-data-export`; specimens bridge two separate die partitions and may never be collapsed into a single similarity cluster.
- **Wide:** Specimen evidence, obverse die partition, reverse die partition, bipartite links, selected chain and chronology hypothesis remain visible together.
- **Intermediate:** The selected specimen and both candidate die assignments remain primary; whole-corpus network, wear chronology and export metadata move to synchronized drawers.
- **Compact:** Specimen → obverse candidates and evidence → reverse candidates and evidence → two assignments → die-pair bridge → chain consequence → review; image comparison always includes labeled feature evidence and confidence.
- **State obligations:** specimen verified/duplicate/restricted, image sufficient/insufficient, obverse assignment proposed/confirmed/conflicted, reverse assignment proposed/confirmed/conflicted, die state early/late/unknown, pair linked/broken, chain connected/isolated, chronology supported/contradicted, hypothesis draft/reviewed and export current/retracted.
- **Hard rejection:** Reject cho `entity-resolution-cluster-workbench`, `phylogenetic-tree-comparison-workbench`, a generic knowledge graph or `media-annotation-review-console`; distinct obverse and reverse die partitions, specimen-as-bridge linkage, side-specific match evidence, wear state and die-chain production inference are mandatory.
- **Research anchors:** `WAI-DRAG`, `WAI-FOCUS`, `WAI-REFLOW`, `WAI-STATUS`, `ESRI-LAYOUT`; add the [Nomisma.org ontology](https://www.nomisma.org/ontology) and the [American Numismatic Society guide to die links and sequences](https://numismatics.org/pocketchange/die-links-and-sequences/).
- **Acceptance focus:** Template must assign one specimen to separate obverse and reverse candidates, show feature evidence and uncertainty, reveal a conflicting side assignment, resolve it without relying on image-only cues, update the die chain and publish a reviewed hypothesis with specimen-to-die link provenance.

## Prompt 13 — `organ-registration-coupler-piston-programmer`

- **Output boundary:** `archetypes/work/organ-registration-coupler-piston-programmer/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Program and rehearse pipe-organ registrations by resolving stops through divisions and couplers into effective sounding ranks, then storing reachable cue changes in the console's piston and memory system.
- **Required region graph:** `organ-registration → instrument-stoplist-divisions-and-console-memory → score-cue-and-performance-sequence → selected-cue-stop-registration-by-division → coupler-and-unison-off-transitive-closure → effective-sounding-rank-and-pitch-set → wind-load-balance-and-style-compatibility-check → general-divisional-piston-and-memory-level-capture → registration-change-reachability-and-recall-test → approved-cue-sheet-and-console-program`; effective sound is derived through the instrument's coupling graph rather than equated with selected stop labels.
- **Wide:** Cue sequence, stops by division, coupler closure, effective ranks, piston memory and change-reachability findings remain visible together.
- **Intermediate:** The active cue, division registration and effective sounding result remain primary; complete stoplist, piston banks and prior rehearsal notes move to synchronized panels.
- **Compact:** Cue → stops by division → couplers and unison-off state → effective ranks/pitches → wind/style check → reachable change → piston capture and recall; console diagrams have an ordered semantic control list.
- **State obligations:** instrument profile current/changed, stop on/off/unavailable, coupler engaged/disengaged/conflicting, effective rank sounding/suppressed, wind load normal/high, cue registration draft/approved, change reachable/unreachable, piston empty/stored/overwritten, memory level active/wrong, recall equal/diverged and rehearsal passed/returned.
- **Hard rejection:** Reject cho `audio-mix-routing-console`, `rule-builder-workbench`, `multi-track-timeline-editor` or `editorial-rundown-control-board`; physical organ divisions and stops, transitive coupler semantics, effective-rank derivation, console piston snapshots and performance-time recall reachability are mandatory.
- **Research anchors:** `WAI-DRAG`, `WAI-FOCUS`, `WAI-OBSCURED`, `WAI-STATUS`, `FLUENT-LAYOUT`; add the [American Guild of Organists New Organist resources](https://agohq.org/Ago/Ago/Education/The-New-Organist.aspx) and [Allen Organ manuals and guides](https://allenorgan.com/support/manuals-and-guides.html).
- **Acceptance focus:** Template must select stops in two divisions, derive a rank added through a coupler, show an invalid or overloaded combination, correct it, store the result to a named piston and memory level, detect a failed recall and pass a reachable cue-to-cue registration change without mouse-only controls.

## Prompt 14 — `motion-capture-skeleton-retargeting-workbench`

- **Output boundary:** `archetypes/work/motion-capture-skeleton-retargeting-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Retarget a motion take from one source skeleton to a differently proportioned target by mapping joint hierarchies and axes, enforcing anatomical constraints and repairing contact errors before a reproducible bake.
- **Required region graph:** `retargeting-workbench → source-motion-take-and-target-character-version → source-skeleton-hierarchy-and-rest-pose ↔ target-skeleton-hierarchy-and-rest-pose → joint-correspondence-and-axis-map → scale-proportion-root-motion-and-action-space-compensation → joint-limit-twist-and-reach-constraints → contact-foot-slide-and-penetration-error-profiles → correction-pass-and-before-after-motion → bake-export-and-regression-proof`; motion comparison is downstream of explicit skeleton correspondence and constraint ownership.
- **Wide:** Source and target hierarchies, correspondence map, synchronized motion, joint constraints, contact-error profile and before/after proof remain visible together.
- **Intermediate:** The active source-target joint pair and error interval remain primary; full hierarchies, 3D preview and export settings move to synchronized panels.
- **Compact:** Error interval → implicated target joint → mapped source joint and axes → rest-pose/proportion compensation → constraint correction → contact rerun → before/after metrics → bake; hierarchy trees and numeric transform lists replace an obligatory canvas.
- **State obligations:** take loaded/missing, skeleton characterized/incomplete, rest pose matched/diverged, joint mapped/unmapped/ambiguous, axis valid/flipped, root motion preserved/rebased, constraint within/exceeded, contact planted/sliding/penetrating, correction draft/accepted, bake queued/failed/complete and regression pass/fail.
- **Hard rejection:** Reject cho `canvas-inspector-studio`, `multi-track-timeline-editor`, `finite-element-mesh-convergence-workbench` or `media-annotation-workbench`; two explicit skeleton hierarchies, joint/axis correspondence, rest-pose and proportion compensation, anatomical constraints, contact-error metrics and reproducible rebaking are mandatory.
- **Research anchors:** `WAI-DRAG`, `WAI-TREEGRID`, `WAI-REFLOW`, `WAI-FOCUS`, `WAI-STATUS`; add [Autodesk MotionBuilder retargeting guidance](https://help.autodesk.com/cloudhelp/2026/ENU/MotionBuilder-Reference/files/Character-Settings-Reference/GUID-877F937B-21C2-472F-AA43-0099DBF08B75.html) and the [Khronos glTF 2.0 skin and animation specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html).
- **Acceptance focus:** Template must map one ambiguous source-target joint, expose an axis or rest-pose mismatch, show a measurable foot-slide or penetration interval, correct it through numeric and keyboard-operable controls, rerun the contact proof and export a baked motion whose source, target and mapping versions are recorded.

## Prompt 15 — `archaeological-fragment-refit-assembly-workbench`

- **Output boundary:** `archetypes/work/archaeological-fragment-refit-assembly-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Test non-destructive physical joins among archaeological fragments, combine compatible joins into assembly hypotheses and use proven refits to interpret manufacture or redistribution while preserving uncertainty and conservation limits.
- **Required region graph:** `refit-assembly → assemblage-provenience-material-and-conservation-context → fragment-register-and-surface-or-edge-evidence → candidate-pair-match-graph → selected-join-geometric-material-and-decoration-proof → rigid-transform-and-physical-contact-fit → transitive-assembly-hypothesis ↔ overlap-incompatibility-and-mutual-exclusion-ledger → manufacturing-sequence-and-context-redistribution-inference → reviewed-non-destructive-assembly-and-archive`; only evidence-backed physical joins create assembly membership and incompatible placements remain first-class.
- **Wide:** Fragment register, candidate-pair graph, selected edge/surface evidence, transformed assembly, incompatibility ledger and inference remain visible together.
- **Intermediate:** The selected fragment pair and its contact-fit proof remain primary; whole assembly, provenience comparison and alternate hypotheses move to synchronized drawers.
- **Compact:** Fragment → candidate mate → edge/surface/material/decorative evidence → rigid fit and contact → assembly consequence → overlap or exclusion conflict → accept, reject or hold; imagery always has labeled evidence and transform values.
- **State obligations:** fragment stable/restricted, candidate unreviewed/likely/unlikely, surface sufficient/eroded, join aligned/misaligned, contact within/outside tolerance, transform provisional/locked, assembly compatible/overlapping, hypothesis active/mutually exclusive/superseded, conservation handling allowed/blocked and review accepted/rejected.
- **Hard rejection:** Reject cho `canvas-inspector-studio`, `entity-resolution-cluster-adjudicator`, `knowledge-graph-explorer` or `chain-of-custody-transfer-ledger`; physical fragment surfaces, rigid contact transforms, proven joins, transitive assembly membership, overlap incompatibility and mutually exclusive reconstructions are mandatory.
- **Research anchors:** `WAI-DRAG`, `WAI-REFLOW`, `WAI-FOCUS`, `WAI-STATUS`, `ESRI-LAYOUT`; add [Historic England guidance on lithic refitting studies](https://historicengland.org.uk/images-books/publications/managing-lithic-sites/heag318-managing-lithic-sites/) and the [Canadian Conservation Institute care of archaeological collections guidance](https://www.canada.ca/en/conservation-institute/services/learning-activities/care-archaeological-collections.html).
- **Acceptance focus:** Template must compare one fragment against at least two mates, record material and edge evidence, fit one join with explicit transform and tolerance, reveal an overlap that makes two assemblies mutually exclusive, support non-drag controls, approve one hypothesis and retain the rejected alternative.

## Prompt 16 — `theatrical-counterweight-rigging-load-path-workbench`

- **Output boundary:** `archetypes/work/theatrical-counterweight-rigging-load-path-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Engineer, load and release one theatrical counterweight line set by tracing every hung load through pick points, lift lines, blocks and arbor, proving per-line reactions, fleet angles, component working-load limits, balance and travel before a witnessed static and movement test.
- **Required region graph:** `rigging-proof → venue-system-and-inspection-version → batten-and-pick-point-load-plan → lift-line-loft-block-head-block-and-arbor-paths → per-lift-line-reaction-and-fleet-angle → hung-load-vs-arbor-counterweight-balance → weakest-component-working-load-and-travel-limit-ledger → loading-rail-lock-off-and-out-of-balance-procedure → witnessed-static-and-travel-test → approved-line-set-load-sheet`; the named physical path from each pick point to the arbor owns reaction, capacity and travel evidence.
- **Wide:** Batten/pick-point plan, physical lift-line paths, reaction and fleet-angle calculations, arbor balance, weakest-component ledger, procedure and witnessed-test record remain visible together.
- **Intermediate:** The selected lift line and its load-path proof remain primary; the whole batten plan, arbor stack, loading procedure and test history move to synchronized panels that retain the same line and component identity.
- **Compact:** Line set → hung loads and pick points → lift-line reaction → loft/head-block/arbor path → component limits and fleet angle → arbor balance → lock-off/loading procedure → witnessed static and travel test → release; the rigging diagram becomes an ordered physical-path list with no horizontal-page dependency.
- **State obligations:** system inspection current/expired, load known/estimated, pick point assigned/unassigned, lift line loaded/slack/overloaded, reaction valid/suspect, fleet angle within/outside limit, component available/restricted/failed, arbor underbalanced/balanced/overbalanced, travel clear/obstructed, lock-off applied/released, loading procedure pending/acknowledged, test queued/passed/failed and load sheet draft/approved/revoked.
- **Hard rejection:** Reject cho `load-and-balance-packing-workbench`, `bridge-defect-load-rating-workbench`, `finite-element-mesh-convergence-workbench` or `ship-mooring-line-load-sharing-console`; a theatrical batten-to-arbor physical path, discrete lift-line reactions and fleet angles, weakest-component working load, counterweight balance, travel limits, lock-off/loading procedure and witnessed motion test are mandatory.
- **Research anchors:** `CARBON-TABLE`, `WAI-DRAG`, `WAI-REFLOW`, `WAI-FOCUS`, `WAI-STATUS`; add [ESTA Technical Standards Program published documents](https://tsp.esta.org/tsp/documents/published_docs.php) and [UK HSE theatre safety guidance](https://www.hse.gov.uk/entertainment/theatre-tv/theatre.htm).
- **Acceptance focus:** Template must place multiple loads on named pick points, calculate at least two lift-line reactions and one fleet angle, trace the governing component path, expose a working-load or travel-limit failure, correct the load or counterweight balance, require an acknowledged lock-off/out-of-balance procedure, record witnessed static and full-travel tests and approve a versioned line-set load sheet.

## Prompt 17 — `motion-picture-keycode-cut-list-conform-workbench`

- **Output boundary:** `archetypes/work/motion-picture-keycode-cut-list-conform-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Match a picture edit back to motion-picture film stock by translating each edit event's timecode into edge-number frame ranges, generating physical cut and change lists and proving frame-continuous conform order.
- **Required region graph:** `film-conform → project-gauge-perforation-frame-rate-and-edit-version → source-roll-reel-keycode-and-timecode-correlation → edit-event-decision-list → event-to-keycode-frame-range-matchback → cut-list-change-list-and-optical-blocks → dupe-handle-perf-slip-and-missing-keycode-ledger → physical-negative-or-di-assembly-order → frame-count-continuity-and-conform-reconciliation → approved-list-and-conform-receipt`; frame-count correlation between timecode and physical edge numbers owns the matchback.
- **Wide:** Edit events, roll/reel correlation, keycode ranges, cut/change lists, physical assembly order and continuity exceptions remain visible together.
- **Intermediate:** The selected edit event and timecode-to-keycode matchback remain primary; full reel map, optical blocks and conform history move to synchronized panels.
- **Compact:** Edit event → source timecode → roll/reel and keycode frame range → cut/optical/handle instruction → physical assembly position → frame-continuity verification → approve or correct; no waveform or freeform timeline is required.
- **State obligations:** edit version current/superseded, source roll identified/missing, keycode readable/partial/absent, correlation calibrated/slipped, event matched/ambiguous/unmatched, handle sufficient/short, dupe required/available/missing, optical block valid/invalid, assembly continuous/gapped/overlapped and conform receipt approved/returned.
- **Hard rejection:** Reject cho `multi-track-timeline-editor`, `reconciliation-diff-workbench`, `data-import-mapping-pipeline` or `print-signature-imposition-planner`; film gauge/perforation/frame-rate authority, timecode-to-edge-number correlation, roll-level cut instructions, handles/dupes/opticals and frame-continuous physical assembly are mandatory.
- **Research anchors:** `CARBON-TABLE`, `WAI-GRID`, `WAI-REFLOW`, `WAI-FOCUS`, `WAI-STATUS`; add [Kodak KEYKODE edge-number guidance](https://www.kodak.com/en/motion/page/keykode-numbers/) and the [Avid FilmScribe User's Guide](https://resources.avid.com/SupportFiles/attach/FilmScribeUG.pdf).
- **Acceptance focus:** Template must select one edit event, match its source timecode to roll and keycode frames, reveal a one-perforation slip or insufficient handle, regenerate the affected cut/change instruction, verify continuity against adjacent events and issue a versioned conform receipt.

## Prompt 18 — `radio-frequency-interference-coordination-workbench`

- **Output boundary:** `archetypes/work/radio-frequency-interference-coordination-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Coordinate a proposed radio assignment by calculating wanted and unwanted signals at protected receivers, finding pairwise and aggregate interference failures and negotiating technical conditions that make the assignment acceptable.
- **Required region graph:** `frequency-coordination → service-band-jurisdiction-and-rule-version → existing-and-planned-assignment-register → proposed-transmitter-receiver-location-antenna-and-emission → propagation-path-and-terrain-model → wanted-vs-unwanted-signal-at-protected-receivers → pairwise-and-aggregate-interference-margin-matrix → channel-power-time-antenna-or-site-counterfactuals → affected-party-notice-response-and-agreement → coordinated-application-and-condition-record`; every condition traces to a protected receiver and measured or modeled interference margin.
- **Wide:** Assignment register/map, proposed technical parameters, protected receivers, propagation evidence, interference matrix, alternatives and party responses remain visible together.
- **Intermediate:** The worst protected receiver and its interference contributors remain primary; complete map, assignment roster and correspondence move to synchronized drawers.
- **Compact:** Proposal → worst protected receiver → wanted/unwanted signal facts → pairwise and aggregate margin → channel/power/time/antenna/site alternative → affected-party response → condition or rejection; a ranked path list replaces the map.
- **State obligations:** rule version current/changed, assignment licensed/planned/expired, path model valid/insufficient, receiver protected/unprotected, wanted signal adequate/weak, interferer individual/aggregate, margin pass/marginal/fail, counterfactual unsolved/viable, notice unsent/sent/responded, objection open/resolved and condition agreed/expired.
- **Hard rejection:** Reject cho `capacity-allocation-overview`, `airspace-volume-deconfliction-planner`, `scenario-sensitivity-modeler` or `map-led-situation-monitor`; service-specific spectrum rules, emission and antenna parameters, propagation to protected receivers, pairwise-plus-aggregate interference margins and affected-licensee coordination are mandatory.
- **Research anchors:** `ESRI-LAYOUT`, `CARBON-TABLE`, `WAI-REFLOW`, `WAI-FOCUS`, `WAI-STATUS`; add the [ITU Radiocommunication terrestrial coordination guidance](https://www.itu.int/en/ITU-R/terrestrial/Pages/by-categories-faq.aspx?categorizedby=35) and the [NTIA United States Frequency Allocation Chart](https://www.ntia.gov/page/united-states-frequency-allocation-chart).
- **Acceptance focus:** Template must enter one proposed transmitter, identify the worst protected receiver, show wanted, pairwise unwanted and aggregate margin values, fail the original channel or power, compare at least two technical alternatives, record an affected party response and issue a conditional coordinated application.

## Prompt 19 — `cinema-focus-pull-depth-of-field-rehearsal-workbench`

- **Output boundary:** `archetypes/work/cinema-focus-pull-depth-of-field-rehearsal-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Plan and rehearse one cinema focus pull by combining camera and subject distance trajectories with calibrated lens/motor response, frame-indexed focus marks and near/far depth-of-field envelopes, then compare measured lens data with the plan before declaring the take ready.
- **Required region graph:** `focus-rehearsal → shot-camera-sensor-lens-aperture-and-take-version → camera-path-and-subject-distance-trajectories → calibrated-lens-scale-and-motor-map → frame-indexed-focus-mark-sequence → near-far-depth-of-field-envelope → subject-miss-intervals-and-pull-rate-backlash-limits → aperture-blocking-mark-or-rack-counterfactuals → measured-rehearsal-lens-data-vs-plan → approved-focus-map-and-take-readiness`; subject-distance geometry and calibrated lens response own focus state, while time only indexes the physical pull proof.
- **Wide:** Shot setup, camera/subject trajectories, calibrated lens map, frame-indexed focus marks, depth-of-field envelopes, miss intervals, counterfactuals and measured rehearsal overlay remain visible together.
- **Intermediate:** The active critical frame interval and its subject-distance-to-focus proof remain primary; full trajectories, calibration history and alternate blocking/aperture choices move to synchronized panels without losing the selected mark.
- **Compact:** Critical frame → camera and subject distance → focus mark → near/far depth-of-field envelope → pull rate and backlash → subject miss → aperture, blocking or rack alternative → measured rehearsal → approve; curves become an ordered critical-frame route and retain the same decision/action parity without horizontal scrolling.
- **State obligations:** shot version current/superseded, lens and motor calibrated/stale, trajectory measured/estimated/changed, focus mark queued/rehearsed/hit/missed, depth-of-field envelope safe/marginal/outside, pull rate feasible/exceeded, backlash compensated/unresolved, aperture locked/change-proposed, blocking fixed/revised, rack direction planned/reversed, measured lens data aligned/diverged and take readiness pending/approved/returned.
- **Hard rejection:** Reject cho `multi-track-timeline-editor`, `media-annotation-workbench`, `spatial-route-itinerary-explorer` or `motion-capture-skeleton-retargeting-workbench`; camera/subject distance trajectories, a calibrated lens-and-motor map, frame-indexed focus marks, near/far depth-of-field geometry, pull-rate/backlash limits and measured rehearsal comparison are mandatory.
- **Research anchors:** `CARBON-TABLE`, `WAI-REFLOW`, `WAI-FOCUS`, `WAI-OBSCURED`, `WAI-STATUS`; add the [ARRI Lens Data System FAQ](https://www.arri.com/en/learn-help/learn-help-camera-system/frequently-asked-questions/lens-data-system-faq) and [ZEISS eXtended Data for cinematography](https://www.zeiss.com/photonics-and-optics/en/cinematography/know-how-hub/extended-data.html).
- **Acceptance focus:** Template must bind a camera, sensor, calibrated lens/motor and aperture, map moving camera and subject distances to at least three focus marks, calculate one near/far depth-of-field envelope, expose a miss caused by pull rate or backlash, compare an aperture/blocking/rack alternative, ingest measured rehearsal lens data and approve or return take readiness with version evidence.

## Prompt 20 — `bookbinding-collation-structure-reconstruction-workbench`

- **Output boundary:** `archetypes/work/bookbinding-collation-structure-reconstruction-workbench/{en.md,vi.md,context.md,template.html}`.
- **Dominant task:** Reconstruct the physical collation of a bound volume by using signatures, catchwords, foliation and conjugacy to model gatherings, explain missing or inserted leaves and derive both reading order and a defensible collation formula.
- **Required region graph:** `collation-reconstruction → volume-edition-material-and-observation-version → foliation-pagination-signature-catchword-and-conjugacy-evidence → competing-gathering-hypotheses → per-hypothesis-conjugacy-and-nesting-predictions → expected-signature-catchword-foliation-and-stub-observations → falsifying-evidence-ledger → selected-physical-gathering-hypothesis → derived-reading-order-and-collation-formula → anomaly-review-and-conservation-catalogue-handoff`; physical observations test competing structures, and reading order plus formula derive only after one hypothesis survives falsification.
- **Wide:** Leaf evidence, at least two gathering hypotheses, predicted versus observed signatures/catchwords/foliation, falsification ledger, selected structure, reading order and collation formula remain visible together.
- **Intermediate:** One disputed gathering observation and its effect on competing hypotheses remain primary; whole-volume evidence, derived reading projection and conservation notes move to synchronized panels.
- **Compact:** Gathering → compare hypothesis A and B → predicted conjugacy/nesting → expected signature, catchword, foliation or stub → observed evidence → falsify or retain each hypothesis → select structure → derive reading order and formula; every diagram relation also has a semantic nested list.
- **State obligations:** observation current/revised, signature visible/partial/absent, foliation consistent/duplicated/skipped, catchword matches/conflicts, bifolium conjugate/probable/impossible, gathering complete/irregular, leaf singleton/insert/cancel/missing, reading order stable/disputed, formula valid/ambiguous and review approved/returned.
- **Hard rejection:** Reject cho `print-signature-imposition-planner`, `document-outline-editor`, `hierarchical-content-browser` or `reconciliation-diff-workbench`; at least two competing physical gathering hypotheses, hypothesis-specific conjugacy/nesting predictions, expected-versus-observed signature/catchword/foliation evidence, explicit falsification and post-selection derivation of reading order plus formula are mandatory.
- **Research anchors:** `WAI-TREEGRID`, `WAI-DRAG`, `WAI-REFLOW`, `WAI-FOCUS`, `WAI-STATUS`; add the [TEI P5 collation element example](https://tei-c.org/release/doc/tei-p5-doc/en/html/examples-collation.html), the [Library of Congress manuscript collation treatment record](https://www.loc.gov/preservation/conservators/rumi/treatment.html) and [Ligatus bookbinding terminology](https://www.ligatus.org.uk/node/712).
- **Acceptance focus:** Template must compare at least two gathering hypotheses, derive distinct conjugacy/nesting predictions, use a signature, catchword, foliation or stub observation to falsify one, retain the evidence against both, select the surviving physical structure, derive reading order and collation formula together, support non-drag interaction and approve the conservation/catalogue handoff.
