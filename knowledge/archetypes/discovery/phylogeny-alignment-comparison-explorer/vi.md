# Trình khám phá so sánh phát sinh loài và căn chỉnh

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `phylogeny-alignment-comparison-explorer` |
| Nhóm | Discovery |
| Tác vụ chi phối | Hiểu quan hệ tiến hóa bằng cách ghép cây phát sinh loài có gốc với các hàng và vị trí tương ứng của căn chỉnh đa trình tự. |
| Bí danh tìm kiếm | `phylogeny alignment`, `clade site explorer`, `taxa alignment`, `evolutionary comparison` |
| Thẩm quyền | Topology macro dùng chung, trung lập sản phẩm. |

### Bất biến

- Lựa chọn clade đồng bộ các hàng taxa còn lựa chọn site đồng bộ cột căn chỉnh và detail; không trục nào được thay thế trục kia.
- Region graph bắt buộc giữ nguyên `phylogeny-explorer → dataset-and-model-context → phylogenetic-tree → sequence-alignment-matrix → site-and-conservation-summary → selected-clade-metadata → selected-site-detail`.
- DOM order, reading order và meaningful focus order phải giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Các trạng thái loading, ready, empty, error, unavailable, pending, success và stale/conflict phải giữ dominant task.
- A rooted taxa hierarchy coupled to a two-dimensional aligned residue matrix is mandatory.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-PA-01` | Dominant task là: Hiểu quan hệ tiến hóa bằng cách ghép cây phát sinh loài có gốc với các hàng và vị trí tương ứng của căn chỉnh đa trình tự. | Bằng chứng ứng viên. |
| `AR-PA-02` | Toàn bộ region graph bắt buộc hiện diện về mặt semantics. | Bằng chứng bắt buộc. |
| `AR-PA-03` | Compact giữ selection, action, state và recovery của wide. | Bằng chứng bắt buộc. |
| `AR-PA-04` | Lựa chọn clade đồng bộ các hàng taxa còn lựa chọn site đồng bộ cột căn chỉnh và detail; không trục nào được thay thế trục kia. | Bằng chứng quan hệ bắt buộc. |
| `AR-PA-90` | Dominant task là generic knowledge graph. | Từ chối. |
| `AR-PA-91` | Dominant task là two-document parallel reader. | Từ chối. |
| `AR-PA-92` | Dominant task là hierarchy browser. | Từ chối. |
| `AR-PA-93` | Dominant task là spreadsheet. | Từ chối. |

### Quy tắc chọn

Chỉ chọn `phylogeny-alignment-comparison-explorer` khi `AR-PA-01`, `AR-PA-02`, `AR-PA-03` và `AR-PA-04` có bằng chứng, đồng thời không mã loại trừ nào từ `AR-PA-90` đến `AR-PA-93` đúng. Trả `needs-evidence` khi thiếu owner hoặc quan hệ bắt buộc. Trả `reject` khi có bất kỳ mã loại trừ nào.

## Sơ đồ vùng

```text
phylogeny-explorer
└─ dataset-and-model-context
   └─ phylogenetic-tree
      └─ sequence-alignment-matrix
         └─ site-and-conservation-summary
            └─ selected-clade-metadata
               └─ selected-site-detail
```

- Quan hệ bắt buộc: Lựa chọn clade đồng bộ các hàng taxa còn lựa chọn site đồng bộ cột căn chỉnh và detail; không trục nào được thay thế trục kia.

### Nghĩa vụ vùng

| Vùng | Chủ sở hữu | Quan hệ |
|---|---|---|
| `phylogeny-explorer` | Sở hữu dominant task cấp trang và trạng thái của toàn graph. | Là gốc của graph. |
| `dataset-and-model-context` | Sở hữu bằng chứng, trạng thái và action của dataset-and-model-context mà không vay product semantics. | Theo sau `phylogeny-explorer` trong semantic order và giữ cùng selection context. |
| `phylogenetic-tree` | Sở hữu bằng chứng, trạng thái và action của phylogenetic-tree mà không vay product semantics. | Theo sau `dataset-and-model-context` trong semantic order và giữ cùng selection context. |
| `sequence-alignment-matrix` | Sở hữu bằng chứng, trạng thái và action của sequence-alignment-matrix mà không vay product semantics. | Theo sau `phylogenetic-tree` trong semantic order và giữ cùng selection context. |
| `site-and-conservation-summary` | Sở hữu bằng chứng, trạng thái và action của site-and-conservation-summary mà không vay product semantics. | Theo sau `sequence-alignment-matrix` trong semantic order và giữ cùng selection context. |
| `selected-clade-metadata` | Sở hữu bằng chứng, trạng thái và action của selected-clade-metadata mà không vay product semantics. | Theo sau `site-and-conservation-summary` trong semantic order và giữ cùng selection context. |
| `selected-site-detail` | Sở hữu bằng chứng, trạng thái và action của selected-site-detail mà không vay product semantics. | Theo sau `selected-clade-metadata` trong semantic order và giữ cùng selection context. |

## Hợp đồng responsive

### Wide

- **Điểm kích hoạt thất bại:** Wide kết thúc khi các owner bằng chứng đồng thời không còn giữ label dễ đọc, association xuyên vùng chính xác và action đầy đủ.
- **Đáp ứng topology:** Show the rooted tree and alignment together with synchronized taxa and site selection.
- **Thay thế điều hướng:** Không thay thế khi mọi owner đồng thời còn usable.
- **Ranh giới sticky:** Chỉ action xuyên vùng đang hoạt động được persist; nó reserve space và yield khi chiều cao ngắn không giữ được focus visible.
- **Chủ sở hữu overflow:** Chỉ `sequence-alignment-matrix` được sở hữu bounded overflow hai chiều khi ý nghĩa tác vụ yêu cầu.

### Intermediate

- **Điểm kích hoạt thất bại:** Intermediate bắt đầu khi region persist có ưu tiên thấp nhất làm quan hệ chi phối khó đọc hoặc không vận hành được.
- **Đáp ứng topology:** Narrow or collapse the tree while preserving the selected clade path and alignment coordinates.
- **Thay thế điều hướng:** Một control pane có tên mở region bị dời với selection và state hiện tại còn nguyên.
- **Ranh giới sticky:** Action persist chỉ còn khi target và status thấy được; nó trở về normal flow ở short height.
- **Chủ sở hữu overflow:** `sequence-alignment-matrix` giữ bounded overflow; prose và control bị dời phải reflow.

### Compact

- **Điểm kích hoạt thất bại:** Compact bắt đầu khi hai task region đồng thời không giữ được evidence dễ đọc và control 44×44 CSS px.
- **Đáp ứng topology:** Use tree-first clade drill-down → alignment slice for selected taxa → site or conservation detail; Back restores clade, site, and scroll.
- **Thay thế điều hướng:** Control Previous, Next và pane có tên khôi phục selection, state và scroll context.
- **Ranh giới sticky:** Compact step control reserve space, không che focus và yield ở short height.
- **Chủ sở hữu overflow:** `sequence-alignment-matrix` là ngoại lệ bounded duy nhất; mọi nội dung khác dùng page scroll.

### Reflow

- Semantic order và DOM order là `phylogeny-explorer → dataset-and-model-context → phylogenetic-tree → sequence-alignment-matrix → site-and-conservation-summary → selected-clade-metadata → selected-site-detail`.
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
- The fictional comparison records both the clade path and the exact alignment site.

## Nghĩa vụ trạng thái

| Trạng thái | Vùng sở hữu | Nghĩa vụ |
|---|---|---|
| Initial / loading | `dataset-and-model-context` | Xác định owner đang pending và giữ semantic position. |
| Ready | `phylogenetic-tree` | Mở toàn bộ dominant task và evidence đồng bộ. |
| Empty / not applicable | `sequence-alignment-matrix` | Phân biệt absence có nghĩa với evidence unavailable. |
| Error / retry | `site-and-conservation-summary` | Giữ context hợp lệ và cho retry cục bộ mà không reset selection. |
| Permission / unavailable | `selected-clade-metadata` | Không ngụ ý evidence bị ẩn là không tồn tại; cung cấp alternate route an toàn. |
| Pending | `selected-site-detail` | Chặn action lặp và announce tiến trình mà không di chuyển focus. |
| Success | `selected-site-detail` | Mở kết quả, giữ context và cung cấp next action hợp lệ. |
| Stale / conflict | `dataset-and-model-context` | Giữ last safe value và yêu cầu recovery rõ ràng. |
| Focus transition | `selected-site-detail` | Chỉ di chuyển focus cho modal hoặc error summary rồi trả về trigger. |
| Responsive presentation | `phylogeny-explorer` | Giữ selection, state và recovery khi topology đổi. |

State family áp dụng: tree loading, alignment loading, taxon missing, clade collapsed, site selected, site conserved, site variable, site gapped, model metadata unavailable, selection sync failure, download ready.

## Ranh giới

### Chấp nhận

- Chấp nhận khi hiểu quan hệ tiến hóa bằng cách ghép cây phát sinh loài có gốc với các hàng và vị trí tương ứng của căn chỉnh đa trình tự.
- Chấp nhận khi lựa chọn clade đồng bộ các hàng taxa còn lựa chọn site đồng bộ cột căn chỉnh và detail; không trục nào được thay thế trục kia.
- Chấp nhận khi compact giữ đúng task evidence, action và recovery.

### Từ chối

- Từ chối generic knowledge graph; đây là bằng chứng `AR-PA-90` và phải route tới archetype lân cận.
- Từ chối two-document parallel reader; đây là bằng chứng `AR-PA-91` và phải route tới archetype lân cận.
- Từ chối hierarchy browser; đây là bằng chứng `AR-PA-92` và phải route tới archetype lân cận.
- Từ chối spreadsheet; đây là bằng chứng `AR-PA-93` và phải route tới archetype lân cận.
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
| [EMBL-EBI — Multiple sequence alignment](https://www.ebi.ac.uk/training/online/courses/guide-to-sequence-analysis-tools/sequence-alignment/multiple-sequence-alignment/) | Hỗ trợ aligned sequence rows and sites. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [NCBI — Tree Viewer](https://www.ncbi.nlm.nih.gov/tools/treeviewer/) | Hỗ trợ rooted tree navigation and clade context. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [GA4GH — Variation Representation Specification](https://vrs.ga4gh.org/en/stable/) | Hỗ trợ independent coordinate representation evidence. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [W3C WAI — Treegrid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/) | Hỗ trợ keyboard access to hierarchical tabular structures. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |

Tập nguồn đại diện cho ít nhất ba tổ chức official độc lập và bao gồm bằng chứng accessibility của W3C.

## Output

```json
{
  "archetypeId": "phylogeny-alignment-comparison-explorer",
  "situationCodes": ["<matched AR-PA-* codes>"],
  "searchAliases": ["phylogeny alignment","clade site explorer","taxa alignment","evolutionary comparison"],
  "dominantTask": "Understand evolutionary relationships by coupling a rooted phylogenetic tree with the corresponding rows and sites of a multiple-sequence alignment.",
  "regions": ["phylogeny-explorer","dataset-and-model-context","phylogenetic-tree","sequence-alignment-matrix","site-and-conservation-summary","selected-clade-metadata","selected-site-detail"],
  "regionRelationships": ["Clade selection synchronizes taxa rows while site selection synchronizes alignment columns and detail; neither axis may replace the other."],
  "responsive": {
    "wide": "<simultaneous evidence structure>",
    "intermediate": "<failure and named-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "phylogeny-explorer → dataset-and-model-context → phylogenetic-tree → sequence-alignment-matrix → site-and-conservation-summary → selected-clade-metadata → selected-site-detail",
    "navigationReplacement": "<none or explicit named-pane controls>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "sequence-alignment-matrix",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["tree loading","alignment loading","taxon missing","clade collapsed","site selected","site conserved","site variable","site gapped","model metadata unavailable","selection sync failure","download ready"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low, with evidence>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

