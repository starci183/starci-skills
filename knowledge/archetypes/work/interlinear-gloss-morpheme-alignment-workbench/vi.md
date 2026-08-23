# Interlinear gloss morpheme alignment workbench

## LOADS

None.

## Record

### Identity

| Trường | Giá trị |
|---|---|
| Archetype ID | `interlinear-gloss-morpheme-alignment-workbench` |
| Family | Work |
| Dominant task | Biên soạn và xác thực văn bản chú giải liên dòng bằng cách giữ word, morpheme, form, gloss và bản dịch tự do đồng bộ theo một convention đã khai báo. |
| Search aliases | interlinear gloss editor, morpheme tier alignment, gloss rekey validation |
| Authority | Authority topology page trung lập với product; archetype không chọn product semantics, visual direction, token, component, geometry chính xác hoặc breakpoint. |

### Invariants

- `interlinear-authoring` sở hữu toàn bộ dominant task, work state và recovery boundary.
- Biên soạn và xác thực văn bản chú giải liên dòng bằng cách giữ word, morpheme, form, gloss và bản dịch tự do đồng bộ theo một convention đã khai báo.
- Mọi region bắt buộc giữ owner, quan hệ và stable identity đã đặt tên; Grammar chỉ gắn owner theo product.
- Wide, intermediate và compact đổi topology khi một quan hệ đã đặt tên thất bại, không theo device label.
- Transformation giữ selection, draft, pending work, error, recovery, reading order và nghĩa của focus.

## Recognition

### Situation codes

| Code | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `IGT-01` | Biên soạn và xác thực văn bản chú giải liên dòng bằng cách giữ word, morpheme, form, gloss và bản dịch tự do đồng bộ theo một convention đã khai báo. | Bằng chứng dương bắt buộc. |
| `IGT-02` | Mọi region và quan hệ bắt buộc trong graph đều cần để hoàn tất task. | Yêu cầu graph đầy đủ. |
| `IGT-03` | Template phải hoàn thành scenario riêng của leaf qua toàn bộ graph, bộc lộ failure bắt buộc, sửa bằng điều khiển keyboard-complete và chỉ phát hành completion receipt sau khi proof pass. Chuỗi thao tác bắt buộc: Lock utterance and pre-edit stable IDs → Split W03 and atomically rekey form and gloss tiers → Define unknown abbreviation PST and expose orphan G07 → Relink G07 to M03b without dragging → Run cardinality and free-translation validation → Export corpus example EX-017. | Yêu cầu proof path đặc thù của domain. |
| `IGT-04` | Work state phải tồn tại qua cả ba topology response đã đặt tên. | Yêu cầu responsive parity. |
| `IGT-05` | Các state literal của domain được giữ nguyên để đồng bộ runtime: text draft/locked, convention current/changed, token confirmed/split/merged, morpheme boundary proposed/accepted/uncertain, gloss lexical/grammatical/missing, abbreviation defined/undefined/conflicting, alignment balanced/orphaned, free translation missing/current, validation pass/warn/fail and example exported/withdrawn. | Yêu cầu bao phủ state và recovery. |
| `IGT-90` | Từ chối khi candidate thuộc adjacent archetype `localization-workbench`, `media-annotation-workbench`, `spreadsheet-grid-editor`, `reconciliation-diff-workbench` hoặc thiếu bất kỳ evidence owner bắt buộc nào của graph. Từ chối biến thể chỉ đổi noun, density, color, component, card count hoặc state. | Reject. |
| `IGT-91` | Candidate chỉ khác product noun, density, color, component, card count hoặc state variation. | Reject as `duplicate-or-variation`. |
| `IGT-92` | Một adjacent archetype sở hữu work object hoặc completion event chính xác hơn. | Reject. |

### Selection rule

Chọn `interlinear-gloss-morpheme-alignment-workbench` khi và chỉ khi các code `IGT-01`–`05` đều có bằng chứng và không có code `IGT-90`–`92`. Trả `needs-evidence` nếu dominant task, owner, overflow owner hoặc completion consequence chưa được chứng minh; trả `reject` khi có rejection code.

## Region graph

```text
interlinear-authoring
├─ language-speaker-text-and-convention-version (downstream)
├─ utterance-and-stable-token-IDs (downstream)
├─ word-to-morpheme-incidence-and-cardinality-matrix (downstream)
├─ object-language-form-tier (peer synchronization)
├─ lexical-and-grammatical-gloss-tier (peer synchronization)
├─ atomic-split-or-merge-rekeying-all-tiers (downstream)
├─ abbreviation-lexicon-and-word-level-alignment (downstream)
├─ free-translation-and-analyst-notes (downstream)
├─ orphan-boundary-and-tier-validation (downstream)
└─ corpus-example-export (downstream)
```

Biểu thức quan hệ binding là `interlinear-authoring → language-speaker-text-and-convention-version → utterance-and-stable-token-IDs → word-to-morpheme-incidence-and-cardinality-matrix ↔ object-language-form-tier ↔ lexical-and-grammatical-gloss-tier → atomic-split-or-merge-rekeying-all-tiers → abbreviation-lexicon-and-word-level-alignment → free-translation-and-analyst-notes → orphan-boundary-and-tier-validation → corpus-example-export`; các operator giữ nghĩa directed, peer hoặc joint-axis đã khai báo trong prompt.

### Region obligations

| Vùng | Nghĩa vụ owner và quan hệ |
|---|---|
| `interlinear-authoring` | interlinear-authoring sở hữu bằng chứng và trạng thái của chính vùng này; sở hữu boundary của dominant task và truyền identity không đổi tới `language-speaker-text-and-convention-version`. Vùng này không hấp thụ owner của vùng khác. |
| `language-speaker-text-and-convention-version` | language-speaker-text-and-convention-version sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `interlinear-authoring` và truyền identity không đổi tới `utterance-and-stable-token-IDs`. Vùng này không hấp thụ owner của vùng khác. |
| `utterance-and-stable-token-IDs` | utterance-and-stable-token-IDs sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `language-speaker-text-and-convention-version` và truyền identity không đổi tới `word-to-morpheme-incidence-and-cardinality-matrix`. Vùng này không hấp thụ owner của vùng khác. |
| `word-to-morpheme-incidence-and-cardinality-matrix` | word-to-morpheme-incidence-and-cardinality-matrix sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `utterance-and-stable-token-IDs` và truyền identity không đổi tới `object-language-form-tier`. Vùng này không hấp thụ owner của vùng khác. |
| `object-language-form-tier` | object-language-form-tier sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ ↔ với upstream `word-to-morpheme-incidence-and-cardinality-matrix` và truyền identity không đổi tới `lexical-and-grammatical-gloss-tier`. Vùng này không hấp thụ owner của vùng khác. |
| `lexical-and-grammatical-gloss-tier` | lexical-and-grammatical-gloss-tier sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ ↔ với upstream `object-language-form-tier` và truyền identity không đổi tới `atomic-split-or-merge-rekeying-all-tiers`. Vùng này không hấp thụ owner của vùng khác. |
| `atomic-split-or-merge-rekeying-all-tiers` | atomic-split-or-merge-rekeying-all-tiers sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `lexical-and-grammatical-gloss-tier` và truyền identity không đổi tới `abbreviation-lexicon-and-word-level-alignment`. Vùng này không hấp thụ owner của vùng khác. |
| `abbreviation-lexicon-and-word-level-alignment` | abbreviation-lexicon-and-word-level-alignment sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `atomic-split-or-merge-rekeying-all-tiers` và truyền identity không đổi tới `free-translation-and-analyst-notes`. Vùng này không hấp thụ owner của vùng khác. |
| `free-translation-and-analyst-notes` | free-translation-and-analyst-notes sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `abbreviation-lexicon-and-word-level-alignment` và truyền identity không đổi tới `orphan-boundary-and-tier-validation`. Vùng này không hấp thụ owner của vùng khác. |
| `orphan-boundary-and-tier-validation` | orphan-boundary-and-tier-validation sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `free-translation-and-analyst-notes` và truyền identity không đổi tới `corpus-example-export`. Vùng này không hấp thụ owner của vùng khác. |
| `corpus-example-export` | corpus-example-export sở hữu bằng chứng và trạng thái của chính vùng này; giữ quan hệ → với upstream `orphan-boundary-and-tier-validation`; phát hành completion evidence. Vùng này không hấp thụ owner của vùng khác. |

## Responsive contract

### Wide

- **Failure trigger:** Một quan hệ bằng chứng đồng thời đã đặt tên không còn đủ measure để đọc, thao tác và giữ focus không bị che.
- **Topology response:** Giữ đồng thời context, chuỗi bằng chứng chính, phép kiểm tra active và completion proof; topology chỉ chuyển khi quan hệ so sánh không còn đủ chỗ đọc và thao tác.
- **Navigation replacement:** Không; truy cập trực tiếp vào region vẫn vừa và bằng chứng liên quan còn đồng thời.
- **Sticky boundary:** Chỉ current scope hoặc primary action được sticky sau khi reserve space; short height đưa nó về normal flow.
- **Overflow owner:** Chỉ region có bản chất table, matrix, graph, timeline, notation hoặc media sở hữu bounded overflow; page không sở hữu horizontal overflow.

### Intermediate

- **Failure trigger:** Toàn bộ support scope không còn có thể persistent cạnh active proof mà vẫn giữ readable measure và focus.
- **Topology response:** Giữ quyết định active cùng bằng chứng trực tiếp làm primary; context tổng thể và history trở thành panel đồng bộ, không làm mất selection hoặc draft.
- **Navigation replacement:** Stage hoặc drawer có label mở đúng supporting region và giữ query, selection, draft, scroll cùng return-focus target.
- **Sticky boundary:** Active proof chỉ được sticky khi reserved space giữ mọi focused control hiển thị; short height phải yield.
- **Overflow owner:** Cùng bounded intrinsic region vẫn là overflow owner duy nhất; temporary support không tạo nested page scroll.

### Compact

- **Failure trigger:** Active decision và minimum proof không còn vừa side by side ở readable measure.
- **Topology response:** Tái cấu trúc dominant task thành một route primary theo semantic order `interlinear-authoring → language-speaker-text-and-convention-version → utterance-and-stable-token-IDs → word-to-morpheme-incidence-and-cardinality-matrix ↔ object-language-form-tier ↔ lexical-and-grammatical-gloss-tier → atomic-split-or-merge-rekeying-all-tiers → abbreviation-lexicon-and-word-level-alignment → free-translation-and-analyst-notes → orphan-boundary-and-tier-validation → corpus-example-export`; support mở theo stage và không tạo horizontal scroll cấp trang.
- **Navigation replacement:** Route stage một-pane có label thay simultaneous columns và giữ chính xác active object cùng recovery target.
- **Sticky boundary:** Chỉ action của current stage được sticky với safe-area spacing; landscape hoặc short height đưa nó về flow.
- **Overflow owner:** Không horizontal scroll cấp page; bằng chứng hai chiều dùng một bounded region có label hoặc semantic list thay thế.

### Reflow

- DOM order, reading order, and meaningful focus order are `interlinear-authoring → language-speaker-text-and-convention-version → utterance-and-stable-token-IDs → word-to-morpheme-incidence-and-cardinality-matrix ↔ object-language-form-tier ↔ lexical-and-grammatical-gloss-tier → atomic-split-or-merge-rekeying-all-tiers → abbreviation-lexicon-and-word-level-alignment → free-translation-and-analyst-notes → orphan-boundary-and-tier-validation → corpus-example-export`; CSS never reorders semantics.
- Label dài, bản dịch, zoom 400% và text phóng lớn wrap mà không mất action hoặc nghĩa state.
- Dialog, drawer hoặc sheet focus heading, giữ focus khi modal, hỗ trợ Escape hoặc Cancel và trả về đúng trigger với work context nguyên vẹn.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action; drag hoặc gesture luôn có button hoặc keyboard equivalent.
- Topology change không reset work state, duplicate pending action hoặc đổi owner.
- Dynamic status dùng text và semantics bên cạnh color rồi announce mà không cướp focus.
- Validation giữ input, lộ inline error, focus summary cho nhiều lỗi và cung cấp recovery cụ thể.
- Các state literal của domain được giữ nguyên để đồng bộ runtime: text draft/locked, convention current/changed, token confirmed/split/merged, morpheme boundary proposed/accepted/uncertain, gloss lexical/grammatical/missing, abbreviation defined/undefined/conflicting, alignment balanced/orphaned, free translation missing/current, validation pass/warn/fail and example exported/withdrawn.

## State obligations

Các state literal của domain được giữ nguyên để đồng bộ runtime: text draft/locked, convention current/changed, token confirmed/split/merged, morpheme boundary proposed/accepted/uncertain, gloss lexical/grammatical/missing, abbreviation defined/undefined/conflicting, alignment balanced/orphaned, free translation missing/current, validation pass/warn/fail and example exported/withdrawn.

| Nhóm trạng thái | Hành vi bắt buộc |
|---|---|
| Initial / loading | Nêu scope đang load, giữ chỗ cho primary region và chỉ block vùng thất bại. |
| Ready | Hiển thị object hiện tại, owner relationship và action hợp lệ bằng text cùng semantics. |
| Empty / not-applicable | Phân biệt empty thật, no-match và non-applicable; cung cấp next action phù hợp. |
| Error / retry | Nêu scope lỗi, giữ input/work state và đưa ra target retry hoặc correction có focus. |
| Permission / unavailable | Giải thích restriction bằng text; read-only khác disabled và vẫn giữ context. |
| Pending | Ngăn duplicate, giữ context, cho phép Cancel khi an toàn và announce progress. |
| Success | Xác nhận scope đã đổi, cập nhật summary liên quan và giữ next step hoặc Undo khi cần. |
| Stale / conflict | So sánh local/external state, không overwrite ngầm và giữ recovery xác định. |
| Focus transition | Stage do user kích hoạt focus heading mới; status-only update không di chuyển focus; modal trả focus về trigger. |
| Responsive presentation | Wide giữ simultaneity; intermediate biến support thấp nhất thành temporary; compact dùng một primary stage với parity. |

## Boundaries

### Accept

- Template phải hoàn thành scenario riêng của leaf qua toàn bộ graph, bộc lộ failure bắt buộc, sửa bằng điều khiển keyboard-complete và chỉ phát hành completion receipt sau khi proof pass. Chuỗi thao tác bắt buộc: Lock utterance and pre-edit stable IDs → Split W03 and atomically rekey form and gloss tiers → Define unknown abbreviation PST and expose orphan G07 → Relink G07 to M03b without dragging → Run cardinality and free-translation validation → Export corpus example EX-017.
- Chỉ accept variation khi dominant task, required regions, relationships, transformations và completion event không đổi.

### Reject

- Từ chối khi candidate thuộc adjacent archetype `localization-workbench`, `media-annotation-workbench`, `spreadsheet-grid-editor`, `reconciliation-diff-workbench` hoặc thiếu bất kỳ evidence owner bắt buộc nào của graph. Từ chối biến thể chỉ đổi noun, density, color, component, card count hoặc state.
- Reject khi adjacent archetype sở hữu work object hoặc completion event chính xác hơn.

### Boundary verdict

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `IGT-90`–`92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, owner relationship, overflow owner hoặc completion consequence.

## Handoff

1. Business truth cung cấp actor, object, rule, permission, state transition và completion consequence.
2. Archetype này resolve dominant task, region graph, responsive replacement, semantic order và parity.
3. Grammar gắn product-semantic owner vào region và state mà không đổi topology.
4. Principles resolve grid, measure, gap, size, alignment, overflow và content-fit breakpoint chính xác.
5. Direction biểu đạt visual character bên trong owner đã accept.

## Non-binding research evidence

### Evidence boundary

Research dưới đây chỉ là bằng chứng tư vấn, không phải product truth. Nó không cấp quyền sao chép geometry, component tree, product noun, breakpoint hoặc visual treatment; mọi claim binding vẫn đi qua business truth, Grammar và Principles.

### Sources

| Nguồn | Nguồn hỗ trợ | Nguồn không chứng minh |
|---|---|---|
| [W3C Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Cung cấp bằng chứng chính thức về hành vi accessibility, reflow, focus và status. | Không chứng minh product truth, geometry, breakpoint, component hoặc visual direction. |
| [W3C Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Cung cấp bằng chứng chính thức về hành vi accessibility, reflow, focus và status. | Không chứng minh product truth, geometry, breakpoint, component hoặc visual direction. |
| [Leipzig Glossing Rules from the Max Planck Institute](https://www.eva.mpg.de/lingua/resources/glossing-rules.php) | Cung cấp thuật ngữ và ràng buộc chuyên ngành cho dominant task. | Không chứng minh product truth, geometry, breakpoint, component hoặc visual direction. |
| [SIL FieldWorks interlinear text guidance](https://software.sil.org/fieldworks/features/orientation-to-fieldworks/interlinearize-texts/) | Cung cấp thuật ngữ và ràng buộc chuyên ngành cho dominant task. | Không chứng minh product truth, geometry, breakpoint, component hoặc visual direction. |

## Output

| Trường | Contract |
|---|---|
| `archetypeId` | Fixed value `interlinear-gloss-morpheme-alignment-workbench`. |
| `situationCodes` | Các code đã match từ record này. |
| `searchAliases` | Các alias đã route tới match. |
| `dominantTask` | Một câu task trung lập với product. |
| `regions` | Các required region ID có thứ tự. |
| `regionRelationships` | Các quan hệ owner, peer, joint-axis, supporting, temporary và downstream. |
| `responsive` | `wide`, `intermediate`, `compact`, `reflow`, `readingOrder`, `navigationReplacement`, `stickyBehavior`, `overflowOwner`, `interactionParity`. |
| `stateObligations` | Các state family task-specific và common áp dụng được. |
| `boundaryVerdict` | `accept`, `reject`, or `needs-evidence`, with reason. |
| `grammarHandoff` | Owner region và state theo product-semantic để lại cho Grammar. |
| `principlesHandoff` | Geometry, fit threshold và emitted layout chính xác để lại cho Principles. |
| `confidence` | `high`, `medium`, or `low`, with evidence completeness. |
| `evidence` | Các lớp evidence business, current-source và research không bịa fact. |

```json
{"archetypeId":"interlinear-gloss-morpheme-alignment-workbench","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```
