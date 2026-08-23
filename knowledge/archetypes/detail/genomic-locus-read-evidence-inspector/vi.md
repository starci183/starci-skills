# Trình kiểm tra bằng chứng read tại locus hệ gen

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `genomic-locus-read-evidence-inspector` |
| Nhóm | Detail |
| Tác vụ chi phối | Xác định cách các read đã căn chỉnh trên nhiều mẫu hỗ trợ hoặc mâu thuẫn với một call tại tọa độ hệ gen chính xác. |
| Bí danh tìm kiếm | `genomic pileup`, `variant read evidence`, `locus inspector`, `allele support` |
| Thẩm quyền | Topology macro dùng chung, trung lập sản phẩm. |

### Bất biến

- Tọa độ tham chiếu chính xác, pileup theo mẫu và ma trận allele là các owner bằng chứng độc lập và đồng bộ mọi lựa chọn.
- Region graph bắt buộc giữ nguyên `locus-inspector → assembly-and-locus-context → coordinate-ruler → reference-and-annotation-tracks → per-sample-coverage-and-pileups → allele-evidence-matrix → selected-read-or-call-detail → quality-summary`.
- DOM order, reading order và meaningful focus order phải giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Các trạng thái loading, ready, empty, error, unavailable, pending, success và stale/conflict phải giữ dominant task.
- A shared reference-coordinate axis with per-sample pileups and an allele-evidence matrix is mandatory.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-GL-01` | Dominant task là: Xác định cách các read đã căn chỉnh trên nhiều mẫu hỗ trợ hoặc mâu thuẫn với một call tại tọa độ hệ gen chính xác. | Bằng chứng ứng viên. |
| `AR-GL-02` | Toàn bộ region graph bắt buộc hiện diện về mặt semantics. | Bằng chứng bắt buộc. |
| `AR-GL-03` | Compact giữ selection, action, state và recovery của wide. | Bằng chứng bắt buộc. |
| `AR-GL-04` | Tọa độ tham chiếu chính xác, pileup theo mẫu và ma trận allele là các owner bằng chứng độc lập và đồng bộ mọi lựa chọn. | Bằng chứng quan hệ bắt buộc. |
| `AR-GL-90` | Dominant task là distributed trace waterfall. | Từ chối. |
| `AR-GL-91` | Dominant task là generic evidence dossier. | Từ chối. |
| `AR-GL-92` | Dominant task là sequence browser. | Từ chối. |
| `AR-GL-93` | Dominant task là timeline. | Từ chối. |

### Quy tắc chọn

Chỉ chọn `genomic-locus-read-evidence-inspector` khi `AR-GL-01`, `AR-GL-02`, `AR-GL-03` và `AR-GL-04` có bằng chứng, đồng thời không mã loại trừ nào từ `AR-GL-90` đến `AR-GL-93` đúng. Trả `needs-evidence` khi thiếu owner hoặc quan hệ bắt buộc. Trả `reject` khi có bất kỳ mã loại trừ nào.

## Sơ đồ vùng

```text
locus-inspector
└─ assembly-and-locus-context
   └─ coordinate-ruler
      └─ reference-and-annotation-tracks
         └─ per-sample-coverage-and-pileups
            └─ allele-evidence-matrix
               └─ selected-read-or-call-detail
                  └─ quality-summary
```

- Quan hệ bắt buộc: Tọa độ tham chiếu chính xác, pileup theo mẫu và ma trận allele là các owner bằng chứng độc lập và đồng bộ mọi lựa chọn.

### Nghĩa vụ vùng

| Vùng | Chủ sở hữu | Quan hệ |
|---|---|---|
| `locus-inspector` | Sở hữu dominant task cấp trang và trạng thái của toàn graph. | Là gốc của graph. |
| `assembly-and-locus-context` | Sở hữu bằng chứng, trạng thái và action của assembly-and-locus-context mà không vay product semantics. | Theo sau `locus-inspector` trong semantic order và giữ cùng selection context. |
| `coordinate-ruler` | Sở hữu bằng chứng, trạng thái và action của coordinate-ruler mà không vay product semantics. | Theo sau `assembly-and-locus-context` trong semantic order và giữ cùng selection context. |
| `reference-and-annotation-tracks` | Sở hữu bằng chứng, trạng thái và action của reference-and-annotation-tracks mà không vay product semantics. | Theo sau `coordinate-ruler` trong semantic order và giữ cùng selection context. |
| `per-sample-coverage-and-pileups` | Sở hữu bằng chứng, trạng thái và action của per-sample-coverage-and-pileups mà không vay product semantics. | Theo sau `reference-and-annotation-tracks` trong semantic order và giữ cùng selection context. |
| `allele-evidence-matrix` | Sở hữu bằng chứng, trạng thái và action của allele-evidence-matrix mà không vay product semantics. | Theo sau `per-sample-coverage-and-pileups` trong semantic order và giữ cùng selection context. |
| `selected-read-or-call-detail` | Sở hữu bằng chứng, trạng thái và action của selected-read-or-call-detail mà không vay product semantics. | Theo sau `allele-evidence-matrix` trong semantic order và giữ cùng selection context. |
| `quality-summary` | Sở hữu bằng chứng, trạng thái và action của quality-summary mà không vay product semantics. | Theo sau `selected-read-or-call-detail` trong semantic order và giữ cùng selection context. |

## Hợp đồng responsive

### Wide

- **Điểm kích hoạt thất bại:** Wide kết thúc khi các owner bằng chứng đồng thời không còn giữ label dễ đọc, association xuyên vùng chính xác và action đầy đủ.
- **Đáp ứng topology:** Keep the track stack or pileups and allele evidence matrix visible while selected-read detail remains supporting.
- **Thay thế điều hướng:** Không thay thế khi mọi owner đồng thời còn usable.
- **Ranh giới sticky:** Chỉ action xuyên vùng đang hoạt động được persist; nó reserve space và yield khi chiều cao ngắn không giữ được focus visible.
- **Chủ sở hữu overflow:** Chỉ `per-sample-coverage-and-pileups` được sở hữu bounded overflow hai chiều khi ý nghĩa tác vụ yêu cầu.

### Intermediate

- **Điểm kích hoạt thất bại:** Intermediate bắt đầu khi region persist có ưu tiên thấp nhất làm quan hệ chi phối khó đọc hoặc không vận hành được.
- **Đáp ứng topology:** Make one pileup primary while the sample navigator, exact locus, and quality summary persist.
- **Thay thế điều hướng:** Một control pane có tên mở region bị dời với selection và state hiện tại còn nguyên.
- **Ranh giới sticky:** Action persist chỉ còn khi target và status thấy được; nó trở về normal flow ở short height.
- **Chủ sở hữu overflow:** `per-sample-coverage-and-pileups` giữ bounded overflow; prose và control bị dời phải reflow.

### Compact

- **Điểm kích hoạt thất bại:** Compact bắt đầu khi hai task region đồng thời không giữ được evidence dễ đọc và control 44×44 CSS px.
- **Đáp ứng topology:** Use locus summary → selected sample pileup → allele counts → read detail → quality; every view retains the exact coordinate.
- **Thay thế điều hướng:** Control Previous, Next và pane có tên khôi phục selection, state và scroll context.
- **Ranh giới sticky:** Compact step control reserve space, không che focus và yield ở short height.
- **Chủ sở hữu overflow:** `per-sample-coverage-and-pileups` là ngoại lệ bounded duy nhất; mọi nội dung khác dùng page scroll.

### Reflow

- Semantic order và DOM order là `locus-inspector → assembly-and-locus-context → coordinate-ruler → reference-and-annotation-tracks → per-sample-coverage-and-pileups → allele-evidence-matrix → selected-read-or-call-detail → quality-summary`.
- Text zoom, bản dịch dài và control phóng lớn kích hoạt cùng topology change theo quan hệ.
- CSS không reorder visual sequence lệch khỏi keyboard hoặc assistive-technology order.
- Label dài được wrap và mọi region ẩn đều có đường reveal accessible có tên.
- Nội dung thông thường không tạo horizontal scroll cấp trang.

### Tương đương tương tác

- Mọi selection, measurement, action, retry và recovery ở wide vẫn reachable tại intermediate và compact.
- Topology change giữ đúng selected item, coordinate hoặc path dùng chung, data state và receipt pending hoặc completed.
- Dynamic update announce một contextual status mà không giật focus.
- Modal giữ focus, hỗ trợ Escape hoặc Cancel và trả focus về đúng trigger.
- Color, position, geometry và visual mark đều có equivalent bằng text hoặc table.
- The fictional call remains ambiguous until the low-depth sample is reviewed.

## Nghĩa vụ trạng thái

| Trạng thái | Vùng sở hữu | Nghĩa vụ |
|---|---|---|
| Initial / loading | `assembly-and-locus-context` | Xác định owner đang pending và giữ semantic position. |
| Ready | `coordinate-ruler` | Mở toàn bộ dominant task và evidence đồng bộ. |
| Empty / not applicable | `reference-and-annotation-tracks` | Phân biệt absence có nghĩa với evidence unavailable. |
| Error / retry | `per-sample-coverage-and-pileups` | Giữ context hợp lệ và cho retry cục bộ mà không reset selection. |
| Permission / unavailable | `allele-evidence-matrix` | Không ngụ ý evidence bị ẩn là không tồn tại; cung cấp alternate route an toàn. |
| Pending | `quality-summary` | Chặn action lặp và announce tiến trình mà không di chuyển focus. |
| Success | `quality-summary` | Mở kết quả, giữ context và cung cấp next action hợp lệ. |
| Stale / conflict | `assembly-and-locus-context` | Giữ last safe value và yêu cầu recovery rõ ràng. |
| Focus transition | `quality-summary` | Chỉ di chuyển focus cho modal hoặc error summary rồi trả về trigger. |
| Responsive presentation | `locus-inspector` | Giữ selection, state và recovery khi topology đổi. |

State family áp dụng: assembly mismatch, locus loading, locus not covered, sample missing, sample low depth, reference evidence, alternate evidence, strand warning, mapping-quality warning, call supported, call ambiguous, call refuted, sample redacted.

## Ranh giới

### Chấp nhận

- Chấp nhận khi xác định cách các read đã căn chỉnh trên nhiều mẫu hỗ trợ hoặc mâu thuẫn với một call tại tọa độ hệ gen chính xác.
- Chấp nhận khi tọa độ tham chiếu chính xác, pileup theo mẫu và ma trận allele là các owner bằng chứng độc lập và đồng bộ mọi lựa chọn.
- Chấp nhận khi compact giữ đúng task evidence, action và recovery.

### Từ chối

- Từ chối distributed trace waterfall; đây là bằng chứng `AR-GL-90` và phải route tới archetype lân cận.
- Từ chối generic evidence dossier; đây là bằng chứng `AR-GL-91` và phải route tới archetype lân cận.
- Từ chối sequence browser; đây là bằng chứng `AR-GL-92` và phải route tới archetype lân cận.
- Từ chối timeline; đây là bằng chứng `AR-GL-93` và phải route tới archetype lân cận.
- Từ chối candidate chỉ khác product noun, count, density, color, component hoặc state dưới dạng `duplicate-or-variation`.

### Phán quyết ranh giới

Chỉ trả `accept` khi dominant task, region graph đầy đủ, quan hệ owner bắt buộc và compact interaction parity đều đúng. Trả `reject` cho mọi rejection code. Trả `needs-evidence` khi owner hoặc quan hệ bắt buộc chưa resolve.

## Bàn giao

- **Bàn giao Grammar:** Gắn owner, label, permission, action và ý nghĩa state trung thực của sản phẩm vào các region đã khai báo.
- **Bàn giao Principles:** Resolve exact grid, measure, gap, alignment, sticky offset, realization overflow bounded và transition point theo quan hệ.
- Không bàn giao nào được xóa region bắt buộc, đổi dominant task hoặc làm yếu interaction parity.

## Bằng chứng nghiên cứu không ràng buộc

### Ranh giới bằng chứng

Research bên ngoài là bằng chứng tư vấn, không phải product truth. Nó hỗ trợ quan hệ tác vụ, adaptive behavior và nghĩa vụ accessibility; nó không đặt tên StarCi owner, không chọn geometry chính xác và không cấp quyền sao chép interface nguồn. Các nguồn đã được mở và kiểm chứng là trang official hiện hành trong batch này.

### Nguồn

| Nguồn | Hỗ trợ điều gì | Không chứng minh điều gì |
|---|---|---|
| [NCBI — Genome Data Viewer help](https://www.ncbi.nlm.nih.gov/gdv/browser/help/) | Hỗ trợ coordinate-based genomic navigation and tracks. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [GA4GH — Variation Representation Specification](https://vrs.ga4gh.org/en/stable/) | Hỗ trợ precise variation and location representation. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [EMBL-EBI — Multiple sequence alignment](https://www.ebi.ac.uk/training/online/courses/guide-to-sequence-analysis-tools/sequence-alignment/multiple-sequence-alignment/) | Hỗ trợ independent sequence-coordinate evidence. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [W3C WAI — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Hỗ trợ non-disruptive status announcements. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |

Tập nguồn đại diện cho ít nhất ba tổ chức official độc lập và bao gồm bằng chứng accessibility của W3C.

## Output

```json
{
  "archetypeId": "genomic-locus-read-evidence-inspector",
  "situationCodes": ["<matched AR-GL-* codes>"],
  "searchAliases": ["genomic pileup","variant read evidence","locus inspector","allele support"],
  "dominantTask": "Determine how aligned reads across samples support or contradict one call at an exact genomic coordinate.",
  "regions": ["locus-inspector","assembly-and-locus-context","coordinate-ruler","reference-and-annotation-tracks","per-sample-coverage-and-pileups","allele-evidence-matrix","selected-read-or-call-detail","quality-summary"],
  "regionRelationships": ["The exact reference coordinate, per-sample pileups, and allele matrix remain independent evidence owners and synchronize every selection."],
  "responsive": {
    "wide": "<simultaneous evidence structure>",
    "intermediate": "<failure and named-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "locus-inspector → assembly-and-locus-context → coordinate-ruler → reference-and-annotation-tracks → per-sample-coverage-and-pileups → allele-evidence-matrix → selected-read-or-call-detail → quality-summary",
    "navigationReplacement": "<none or explicit named-pane controls>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "per-sample-coverage-and-pileups",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["assembly mismatch","locus loading","locus not covered","sample missing","sample low depth","reference evidence","alternate evidence","strand warning","mapping-quality warning","call supported","call ambiguous","call refuted","sample redacted"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low, with evidence>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

