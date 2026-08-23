# Haplotype phase block curation workbench

## LOADS

None.

## Bản ghi

### Định danh

| Trường | Giá trị |
|---|---|
| Archetype ID | `haplotype-phase-block-curation-workbench` |
| Family | Work |
| Dominant task | Curate phase block bằng read, molecule và family linkage, giữ hai track A/B cùng allele membership, thao tác có thể undo rồi kiểm Mendelian/ploidy trước export. |
| Search aliases | haplotype-phase-block-curation-workbench, phase-curation, phased-callset-export-and-version |
| Authority | Authority topology trang trung lập sản phẩm; archetype không chọn product semantics, visual direction, token, component, exact geometry hoặc breakpoint. |

### Bất biến

- `phase-curation` sở hữu toàn bộ dominant task và recovery boundary.
- Mọi quan sát làm đổi quyết định giữ provenance tới đúng vùng đã tạo nó.
- Completion gate đánh giá mọi vùng bắt buộc chưa giải quyết trước khi đóng.
- Wide, intermediate và compact đổi topology khi một quan hệ được đặt tên thất bại.
- Transformation giữ selection, draft, pending work, recovery, reading order và ý nghĩa focus.

## Nhận diện

### Mã tình huống

| Mã | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `AR-HPC-01` | Người dùng phải hoàn thành dominant task đã ghi trong Identity. | Bắt buộc dominant task. |
| `AR-HPC-02` | Mọi vùng trong graph đều thay đổi hoặc chứng minh quyết định kết thúc. | Bắt buộc graph đầy đủ và provenance. |
| `AR-HPC-03` | Quan hệ peer hoặc feedback phải đồng bộ khi evidence thay đổi. | Bắt buộc projection đồng bộ và invalidation. |
| `AR-HPC-04` | Work state có thể pending, unavailable, stale, conflict hoặc recoverable sau khi đã có input. | Bắt buộc state và recovery parity ở mọi topology. |
| `AR-HPC-90` | Một adjacent archetype trong hard rejection sở hữu task chính xác hơn. | Reject. |
| `AR-HPC-91` | Thiếu quan hệ domain, proof hoặc completion event bắt buộc. | Reject. |
| `AR-HPC-92` | Candidate chỉ đổi noun, density, color, component, card count hoặc state variation. | Reject dạng `duplicate-or-variation`. |

### Quy tắc chọn

Chọn `haplotype-phase-block-curation-workbench` khi và chỉ khi có evidence cho `AR-HPC-01` đến `AR-HPC-04`, mọi vùng và quan hệ đều bắt buộc, đồng thời không có `AR-HPC-90` đến `AR-HPC-92`. Trả `needs-evidence` khi chưa chứng minh dominant task, completion owner, overflow owner hoặc recovery consequence.

## Đồ thị vùng

```text
├─ phase-curation
├─ sample-ploidy-reference-and-callset-version
├─ heterozygous-variant-lane
├─ read-molecule-and-family-linkage-evidence
├─ phase-blocks-with-two-explicitly-oriented-haplotype-tracks-and-allele-membership
├─ selected-link-confidence-and-conflict
├─ split-merge-flip-or-bridge-operation
├─ mendelian-and-ploidy-consistency-check
├─ unresolved-gap-and-phase-quality-ledger
└─ phased-callset-export-and-version
```

Quan hệ bắt buộc: `phase-curation → sample-ploidy-reference-and-callset-version → heterozygous-variant-lane → read-molecule-and-family-linkage-evidence ↔ phase-blocks-with-two-explicitly-oriented-haplotype-tracks-and-allele-membership → selected-link-confidence-and-conflict → split-merge-flip-or-bridge-operation → mendelian-and-ploidy-consistency-check → unresolved-gap-and-phase-quality-ledger → phased-callset-export-and-version`.

### Nghĩa vụ vùng

| Vùng | Nghĩa vụ owner và quan hệ |
|---|---|
| `phase-curation` | Sở hữu trạng thái và quyết định của `phase-curation`; giữ quan hệ với hạ nguồn `sample-ploidy-reference-and-callset-version` mà không hấp thụ owner của vùng khác. |
| `sample-ploidy-reference-and-callset-version` | Sở hữu trạng thái và quyết định của `sample-ploidy-reference-and-callset-version`; giữ quan hệ với thượng nguồn `phase-curation` và hạ nguồn `heterozygous-variant-lane` mà không hấp thụ owner của vùng khác. |
| `heterozygous-variant-lane` | Sở hữu trạng thái và quyết định của `heterozygous-variant-lane`; giữ quan hệ với thượng nguồn `sample-ploidy-reference-and-callset-version` và hạ nguồn `read-molecule-and-family-linkage-evidence` mà không hấp thụ owner của vùng khác. |
| `read-molecule-and-family-linkage-evidence` | Sở hữu trạng thái và quyết định của `read-molecule-and-family-linkage-evidence`; giữ quan hệ với thượng nguồn `heterozygous-variant-lane` và hạ nguồn `phase-blocks-with-two-explicitly-oriented-haplotype-tracks-and-allele-membership` mà không hấp thụ owner của vùng khác. |
| `phase-blocks-with-two-explicitly-oriented-haplotype-tracks-and-allele-membership` | Sở hữu trạng thái và quyết định của `phase-blocks-with-two-explicitly-oriented-haplotype-tracks-and-allele-membership`; giữ quan hệ với thượng nguồn `read-molecule-and-family-linkage-evidence` và hạ nguồn `selected-link-confidence-and-conflict` mà không hấp thụ owner của vùng khác. |
| `selected-link-confidence-and-conflict` | Sở hữu trạng thái và quyết định của `selected-link-confidence-and-conflict`; giữ quan hệ với thượng nguồn `phase-blocks-with-two-explicitly-oriented-haplotype-tracks-and-allele-membership` và hạ nguồn `split-merge-flip-or-bridge-operation` mà không hấp thụ owner của vùng khác. |
| `split-merge-flip-or-bridge-operation` | Sở hữu trạng thái và quyết định của `split-merge-flip-or-bridge-operation`; giữ quan hệ với thượng nguồn `selected-link-confidence-and-conflict` và hạ nguồn `mendelian-and-ploidy-consistency-check` mà không hấp thụ owner của vùng khác. |
| `mendelian-and-ploidy-consistency-check` | Sở hữu trạng thái và quyết định của `mendelian-and-ploidy-consistency-check`; giữ quan hệ với thượng nguồn `split-merge-flip-or-bridge-operation` và hạ nguồn `unresolved-gap-and-phase-quality-ledger` mà không hấp thụ owner của vùng khác. |
| `unresolved-gap-and-phase-quality-ledger` | Sở hữu trạng thái và quyết định của `unresolved-gap-and-phase-quality-ledger`; giữ quan hệ với thượng nguồn `mendelian-and-ploidy-consistency-check` và hạ nguồn `phased-callset-export-and-version` mà không hấp thụ owner của vùng khác. |
| `phased-callset-export-and-version` | Sở hữu trạng thái và quyết định của `phased-callset-export-and-version`; giữ quan hệ với thượng nguồn `unresolved-gap-and-phase-quality-ledger` mà không hấp thụ owner của vùng khác. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Không còn đủ measure để đọc, thao tác và giữ focus không bị che cho các vùng cần so sánh đồng thời.
- **Topology response:** Giữ đồng thời toàn bộ completion-owning regions theo graph; chi tiết ràng buộc là: Variant lane, both oriented A/B tracks for every selected phase block, linkage evidence, allele-membership conflict/operation controls, family/ploidy checks and unresolved-gap ledger remain simultaneously visible with synchronized variant, track and block selection
- **Navigation replacement:** Không thay navigation khi các quan hệ quyết định vẫn được cảm nhận trực tiếp.
- **Sticky boundary:** Chỉ identity hiện tại hoặc completion gate được persist sau khi reserve space; short height trả nó về normal flow.
- **Overflow owner:** Chỉ `heterozygous-variant-lane` được sở hữu bounded overflow cần thiết cho task.

### Intermediate

- **Failure trigger:** Vùng hỗ trợ ưu tiên thấp nhất không thể persist mà không nén active relationship hoặc che focus.
- **Topology response:** Giữ primary relationship và chuyển support thấp nhất sang synchronized temporary route; chi tiết ràng buộc là: The selected block's two oriented tracks, active allele membership, supporting/conflicting evidence and proposed operation remain primary; the global variant lane, complete family/read evidence and phase-quality ledger move to synchronized drawers
- **Navigation replacement:** Route có label mở đúng vùng hỗ trợ rồi trả query, selection, draft, scroll và trigger focus.
- **Sticky boundary:** Identity hiện tại có thể persist; support tạm và actions nằm trong normal flow.
- **Overflow owner:** `heterozygous-variant-lane` giữ bounded overflow khi detail hỗ trợ chuyển sang resumable view.

### Compact

- **Failure trigger:** Side-by-side không còn giữ readable measure, target size hoặc quan hệ được đặt tên.
- **Topology response:** Chuyển thành một primary stage theo semantic order; chi tiết ràng buộc là: Open the highest-priority phase conflict → inspect the variant pair or block in a labeled A/B allele-membership table → review a linkage evidence table → split, merge, flip or bridge through buttons/forms → verify the resulting track orientation → rerun Mendelian and ploidy checks → record the next unresolved gap → export; the global graph yields to a block-and-track ledger, and every spatial or drag edit retains a single-pointer and keyboard alternative
- **Navigation replacement:** Sequence có label thay simultaneous panes và cung cấp direct bounded review route.
- **Sticky boundary:** Chỉ compact orientation được persist sau khi reserve space; primary action vẫn reachable trong flow.
- **Overflow owner:** `heterozygous-variant-lane` dùng semantic alternative bounded; page không sở hữu horizontal scroll.

### Reflow

- DOM order, reading order và meaningful focus order là `phase-curation → sample-ploidy-reference-and-callset-version → heterozygous-variant-lane → read-molecule-and-family-linkage-evidence → phase-blocks-with-two-explicitly-oriented-haplotype-tracks-and-allele-membership → selected-link-confidence-and-conflict → split-merge-flip-or-bridge-operation → mendelian-and-ploidy-consistency-check → unresolved-gap-and-phase-quality-ledger → phased-callset-export-and-version`.
- CSS không reorder semantics.
- Label dài, bản dịch, zoom 400% và text phóng to wrap mà không mất action hoặc state meaning.
- Temporary view focus heading của nó và trả về đúng trigger cùng selection và draft.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action.
- Drag, spatial, chart, image, curve, graph hoặc map luôn có semantic button, list, coordinate hoặc table alternative.
- Topology change không reset work state hoặc duplicate pending action.
- Dynamic status dùng text và semantics ngoài color rồi announce mà không cướp focus.
- Validation giữ input, có inline error, focus summary khi nhiều lỗi và cung cấp recovery cụ thể.
- Task parity gồm callset loading/version-mismatch, variant unphased/phased/conflicted, read/molecule/family evidence available/partial/unavailable, block current/stale/split, link confidence unknown/low/high, operation draft/applied/undone, Mendelian or ploidy check pending/pass/fail/indeterminate, gap unresolved/accepted, export queued/failed/issued/superseded and evidence permission limited.

## Nghĩa vụ trạng thái

Task-specific states: callset loading/version-mismatch, variant unphased/phased/conflicted, read/molecule/family evidence available/partial/unavailable, block current/stale/split, link confidence unknown/low/high, operation draft/applied/undone, Mendelian or ploidy check pending/pass/fail/indeterminate, gap unresolved/accepted, export queued/failed/issued/superseded and evidence permission limited.

| State family | Hành vi bắt buộc |
|---|---|
| Initial / loading | Nêu scope đang tải, reserve primary region và chỉ block vùng thất bại. |
| Ready | Thể hiện current object, owner relationship và valid actions bằng text cùng semantics. |
| Empty / not-applicable | Phân biệt true empty, no-match và non-applicable, kèm next action hợp lệ. |
| Error / retry | Nêu scope lỗi, giữ input/work state và cung cấp target retry hoặc correction. |
| Permission / unavailable | Giải thích restriction bằng text; read-only khác disabled và vẫn giữ context. |
| Pending | Ngăn duplicate, giữ context, cho cancel khi an toàn và announce progress. |
| Success | Xác nhận chính xác scope đã đổi, cập nhật dependent summaries và giữ next valid step. |
| Stale / conflict | So local với external state, không silent overwrite và giữ deterministic recovery. |
| Focus transition | Stage change do user kích hoạt focus heading mới; status-only update không chuyển focus. |
| Responsive presentation | Wide giữ simultaneity; intermediate làm support thấp tạm thời; compact dùng một primary stage có parity. |

## Ranh giới

### Chấp nhận

- Template phải chứng minh chuỗi task-specific trong acceptance focus bằng fictional data, keyboard-complete action và recovery không mất state.
- Chỉ accept variation khi dominant task, required regions, relationships, transformations và completion event không đổi.

### Từ chối

- Reject mọi adjacent archetype được nêu trong hard rejection khi nó thiếu graph hoặc completion-owning relationship của leaf này.
- Reject khi adjacent archetype sở hữu work object hoặc completion event chính xác hơn.

### Phán quyết ranh giới

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-HPC-90`, `AR-HPC-91` hoặc `AR-HPC-92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, relationship, overflow owner hoặc completion consequence.

## Handoff

1. Business truth cung cấp actor, object, rule, permission, state transition và completion consequence.
2. Archetype này giải dominant task, region graph, responsive replacement, semantic order và parity.
3. Grammar gắn product-semantic owner vào region và state mà không đổi topology.
4. Principles giải exact grid, measure, gap, size, alignment, overflow và content-fit threshold.
5. Direction thể hiện visual character bên trong owner đã accept.

## Bằng chứng nghiên cứu không ràng buộc

### Ranh giới bằng chứng

Research dưới đây là advisory evidence, không phải product truth. Nó không cấp quyền copy geometry, component tree, product noun, breakpoint hoặc visual treatment; mọi binding claim vẫn đi qua business truth, Grammar và Principles.

### Nguồn

| Source | Hỗ trợ điều gì | Không chứng minh điều gì |
|---|---|---|
| [GA4GH VCF 4.5 specification](https://samtools.github.io/hts-specs/VCFv4.5.pdf) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [GA4GH VRS Cis-Phased Block](https://vrs.ga4gh.org/en/stable/concepts/MolecularVariation/CisPhasedBlock.html) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [ClinGen PM3 in-trans guidance](https://www.clinicalgenome.org/docs/pm3-recommendation-for-in-trans-criterion-pm3-version-1.0/) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [WAI-ARIA APG — Treegrid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/) | Hỗ trợ hierarchical grid semantics. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Hỗ trợ single-pointer alternatives to drag. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Hỗ trợ semantic and focus order. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |

## Đầu ra

```json
{
  "archetypeId": "haplotype-phase-block-curation-workbench",
  "matchedSituationCodes": [
    "AR-HPC-01",
    "AR-HPC-02",
    "AR-HPC-03",
    "AR-HPC-04"
  ],
  "aliases": [
    "haplotype-phase-block-curation-workbench",
    "phase-curation",
    "phased-callset-export-and-version"
  ],
  "dominantTask": "Assemble, split, merge, flip and bridge phased haplotype blocks from read, molecule and family linkage evidence while maintaining two explicitly oriented haplotype tracks and exact allele membership, then prove Mendelian and ploidy consistency before exporting a versioned phased callset with unresolved gaps explicit",
  "regions": [
    "phase-curation",
    "sample-ploidy-reference-and-callset-version",
    "heterozygous-variant-lane",
    "read-molecule-and-family-linkage-evidence",
    "phase-blocks-with-two-explicitly-oriented-haplotype-tracks-and-allele-membership",
    "selected-link-confidence-and-conflict",
    "split-merge-flip-or-bridge-operation",
    "mendelian-and-ploidy-consistency-check",
    "unresolved-gap-and-phase-quality-ledger",
    "phased-callset-export-and-version"
  ],
  "relationships": [
    "phase-curation → sample-ploidy-reference-and-callset-version → heterozygous-variant-lane → read-molecule-and-family-linkage-evidence ↔ phase-blocks-with-two-explicitly-oriented-haplotype-tracks-and-allele-membership → selected-link-confidence-and-conflict → split-merge-flip-or-bridge-operation → mendelian-and-ploidy-consistency-check → unresolved-gap-and-phase-quality-ledger → phased-callset-export-and-version"
  ],
  "responsive": {
    "wide": "Variant lane, both oriented A/B tracks for every selected phase block, linkage evidence, allele-membership conflict/operation controls, family/ploidy checks and unresolved-gap ledger remain simultaneously visible with synchronized variant, track and block selection",
    "intermediate": "The selected block's two oriented tracks, active allele membership, supporting/conflicting evidence and proposed operation remain primary; the global variant lane, complete family/read evidence and phase-quality ledger move to synchronized drawers",
    "compact": "Open the highest-priority phase conflict → inspect the variant pair or block in a labeled A/B allele-membership table → review a linkage evidence table → split, merge, flip or bridge through buttons/forms → verify the resulting track orientation → rerun Mendelian and ploidy checks → record the next unresolved gap → export; the global graph yields to a block-and-track ledger, and every spatial or drag edit retains a single-pointer and keyboard alternative",
    "reflow": "DOM order remains semantic order; supporting regions become synchronized temporary routes without resetting work.",
    "readingOrder": "phase-curation → sample-ploidy-reference-and-callset-version → heterozygous-variant-lane → read-molecule-and-family-linkage-evidence → phase-blocks-with-two-explicitly-oriented-haplotype-tracks-and-allele-membership → selected-link-confidence-and-conflict → split-merge-flip-or-bridge-operation → mendelian-and-ploidy-consistency-check → unresolved-gap-and-phase-quality-ledger → phased-callset-export-and-version",
    "navigationReplacement": "Intermediate uses labeled synchronized support routes; compact uses a labeled one-primary-stage sequence.",
    "stickyBehavior": "Only identity or the active completion gate may persist after reserving space, and it yields at short height.",
    "overflowOwner": "heterozygous-variant-lane",
    "interactionParity": "Every action, state, error recovery, selection, and focus-return target remains available in every topology."
  },
  "stateObligations": [
    "callset loading/version-mismatch",
    "variant unphased/phased/conflicted",
    "read/molecule/family evidence available/partial/unavailable",
    "block current/stale/split",
    "link confidence unknown/low/high",
    "operation draft/applied/undone",
    "Mendelian or ploidy check pending/pass/fail/indeterminate",
    "gap unresolved/accepted",
    "export queued/failed/issued/superseded and evidence permission limited"
  ],
  "boundaryVerdict": "needs-evidence",
  "grammarHandoff": [
    "product facts",
    "semantic owners",
    "permissions",
    "consequences"
  ],
  "principlesHandoff": [
    "exact grid",
    "measure",
    "gap",
    "size",
    "alignment",
    "overflow",
    "content-fit thresholds"
  ],
  "confidence": "high when all positive situations and the completion-owning relationship are evidenced; otherwise needs-evidence",
  "evidenceClasses": [
    "business or current-source evidence",
    "official task-domain guidance",
    "official accessibility guidance"
  ]
}
```

Không trả class, token, component, source path, fixed breakpoint hoặc invented product fact.
