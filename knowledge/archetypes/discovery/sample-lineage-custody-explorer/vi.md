# Trình khám phá dòng dõi và lưu ký mẫu

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `sample-lineage-custody-explorer` |
| Nhóm | Discovery |
| Tác vụ chi phối | Truy vết một mẫu hoặc aliquot qua tổ tiên dẫn xuất, lưu ký, vị trí và lịch sử sử dụng để xác lập nguồn gốc và tính toàn vẹn. |
| Bí danh tìm kiếm | `sample lineage`, `aliquot provenance`, `custody history`, `sample ancestry` |
| Thẩm quyền | Topology macro dùng chung, trung lập sản phẩm. |

### Bất biến

- Cây dẫn xuất, chuỗi lưu ký theo thời gian và vị trí hiện tại vẫn là các owner bằng chứng riêng biệt trong khi dùng chung node mẫu được chọn.
- Region graph bắt buộc giữ nguyên `sample-explorer → sample-identity → derivation-lineage-tree → current-location-and-inventory → custody-chain → assay-and-consumption-links → integrity-exceptions → selected-ancestor-or-descendant-detail`.
- DOM order, reading order và meaningful focus order phải giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Các trạng thái loading, ready, empty, error, unavailable, pending, success và stale/conflict phải giữ dominant task.
- Branching derivation and a separately owned custody chronology are mandatory; one generic graph or timeline is insufficient.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-SL-01` | Dominant task là: Truy vết một mẫu hoặc aliquot qua tổ tiên dẫn xuất, lưu ký, vị trí và lịch sử sử dụng để xác lập nguồn gốc và tính toàn vẹn. | Bằng chứng ứng viên. |
| `AR-SL-02` | Toàn bộ region graph bắt buộc hiện diện về mặt semantics. | Bằng chứng bắt buộc. |
| `AR-SL-03` | Compact giữ selection, action, state và recovery của wide. | Bằng chứng bắt buộc. |
| `AR-SL-04` | Cây dẫn xuất, chuỗi lưu ký theo thời gian và vị trí hiện tại vẫn là các owner bằng chứng riêng biệt trong khi dùng chung node mẫu được chọn. | Bằng chứng quan hệ bắt buộc. |
| `AR-SL-90` | Dominant task là generic knowledge graph. | Từ chối. |
| `AR-SL-91` | Dominant task là audit timeline. | Từ chối. |
| `AR-SL-92` | Dominant task là inventory detail. | Từ chối. |
| `AR-SL-93` | Dominant task là chain-of-custody transfer execution. | Từ chối. |

### Quy tắc chọn

Chỉ chọn `sample-lineage-custody-explorer` khi `AR-SL-01`, `AR-SL-02`, `AR-SL-03` và `AR-SL-04` có bằng chứng, đồng thời không mã loại trừ nào từ `AR-SL-90` đến `AR-SL-93` đúng. Trả `needs-evidence` khi thiếu owner hoặc quan hệ bắt buộc. Trả `reject` khi có bất kỳ mã loại trừ nào.

## Sơ đồ vùng

```text
sample-explorer
└─ sample-identity
   └─ derivation-lineage-tree
      └─ current-location-and-inventory
         └─ custody-chain
            └─ assay-and-consumption-links
               └─ integrity-exceptions
                  └─ selected-ancestor-or-descendant-detail
```

- Quan hệ bắt buộc: Cây dẫn xuất, chuỗi lưu ký theo thời gian và vị trí hiện tại vẫn là các owner bằng chứng riêng biệt trong khi dùng chung node mẫu được chọn.

### Nghĩa vụ vùng

| Vùng | Chủ sở hữu | Quan hệ |
|---|---|---|
| `sample-explorer` | Sở hữu dominant task cấp trang và trạng thái của toàn graph. | Là gốc của graph. |
| `sample-identity` | Sở hữu bằng chứng, trạng thái và action của sample-identity mà không vay product semantics. | Theo sau `sample-explorer` trong semantic order và giữ cùng selection context. |
| `derivation-lineage-tree` | Sở hữu bằng chứng, trạng thái và action của derivation-lineage-tree mà không vay product semantics. | Theo sau `sample-identity` trong semantic order và giữ cùng selection context. |
| `current-location-and-inventory` | Sở hữu bằng chứng, trạng thái và action của current-location-and-inventory mà không vay product semantics. | Theo sau `derivation-lineage-tree` trong semantic order và giữ cùng selection context. |
| `custody-chain` | Sở hữu bằng chứng, trạng thái và action của custody-chain mà không vay product semantics. | Theo sau `current-location-and-inventory` trong semantic order và giữ cùng selection context. |
| `assay-and-consumption-links` | Sở hữu bằng chứng, trạng thái và action của assay-and-consumption-links mà không vay product semantics. | Theo sau `custody-chain` trong semantic order và giữ cùng selection context. |
| `integrity-exceptions` | Sở hữu bằng chứng, trạng thái và action của integrity-exceptions mà không vay product semantics. | Theo sau `assay-and-consumption-links` trong semantic order và giữ cùng selection context. |
| `selected-ancestor-or-descendant-detail` | Sở hữu bằng chứng, trạng thái và action của selected-ancestor-or-descendant-detail mà không vay product semantics. | Theo sau `integrity-exceptions` trong semantic order và giữ cùng selection context. |

## Hợp đồng responsive

### Wide

- **Điểm kích hoạt thất bại:** Wide kết thúc khi các owner bằng chứng đồng thời không còn giữ label dễ đọc, association xuyên vùng chính xác và action đầy đủ.
- **Đáp ứng topology:** Keep the lineage tree and selected node detail visible with an independent custody and location rail.
- **Thay thế điều hướng:** Không thay thế khi mọi owner đồng thời còn usable.
- **Ranh giới sticky:** Chỉ action xuyên vùng đang hoạt động được persist; nó reserve space và yield khi chiều cao ngắn không giữ được focus visible.
- **Chủ sở hữu overflow:** Chỉ `derivation-lineage-tree` được sở hữu bounded overflow hai chiều khi ý nghĩa tác vụ yêu cầu.

### Intermediate

- **Điểm kích hoạt thất bại:** Intermediate bắt đầu khi region persist có ưu tiên thấp nhất làm quan hệ chi phối khó đọc hoặc không vận hành được.
- **Đáp ứng topology:** Make lineage or custody primary while the selected path, current location, and integrity verdict persist.
- **Thay thế điều hướng:** Một control pane có tên mở region bị dời với selection và state hiện tại còn nguyên.
- **Ranh giới sticky:** Action persist chỉ còn khi target và status thấy được; nó trở về normal flow ở short height.
- **Chủ sở hữu overflow:** `derivation-lineage-tree` giữ bounded overflow; prose và control bị dời phải reflow.

### Compact

- **Điểm kích hoạt thất bại:** Compact bắt đầu khi hai task region đồng thời không giữ được evidence dễ đọc và control 44×44 CSS px.
- **Đáp ứng topology:** Use sample summary → ancestor or descendant path → location → custody events → assays or consumption; node switching restores path and scroll context.
- **Thay thế điều hướng:** Control Previous, Next và pane có tên khôi phục selection, state và scroll context.
- **Ranh giới sticky:** Compact step control reserve space, không che focus và yield ở short height.
- **Chủ sở hữu overflow:** `derivation-lineage-tree` là ngoại lệ bounded duy nhất; mọi nội dung khác dùng page scroll.

### Reflow

- Semantic order và DOM order là `sample-explorer → sample-identity → derivation-lineage-tree → current-location-and-inventory → custody-chain → assay-and-consumption-links → integrity-exceptions → selected-ancestor-or-descendant-detail`.
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
- The fictional integrity verdict remains blocked until the missing handoff is explained.

## Nghĩa vụ trạng thái

| Trạng thái | Vùng sở hữu | Nghĩa vụ |
|---|---|---|
| Initial / loading | `sample-identity` | Xác định owner đang pending và giữ semantic position. |
| Ready | `derivation-lineage-tree` | Mở toàn bộ dominant task và evidence đồng bộ. |
| Empty / not applicable | `current-location-and-inventory` | Phân biệt absence có nghĩa với evidence unavailable. |
| Error / retry | `custody-chain` | Giữ context hợp lệ và cho retry cục bộ mà không reset selection. |
| Permission / unavailable | `assay-and-consumption-links` | Không ngụ ý evidence bị ẩn là không tồn tại; cung cấp alternate route an toàn. |
| Pending | `selected-ancestor-or-descendant-detail` | Chặn action lặp và announce tiến trình mà không di chuyển focus. |
| Success | `selected-ancestor-or-descendant-detail` | Mở kết quả, giữ context và cung cấp next action hợp lệ. |
| Stale / conflict | `sample-identity` | Giữ last safe value và yêu cầu recovery rõ ràng. |
| Focus transition | `selected-ancestor-or-descendant-detail` | Chỉ di chuyển focus cho modal hoặc error summary rồi trả về trigger. |
| Responsive presentation | `sample-explorer` | Giữ selection, state và recovery khi topology đổi. |

State family áp dụng: lineage loading, lineage partial, cyclic lineage invalid, aliquot consumed, aliquot available, aliquot missing, custody verified, custody gap, custody disputed, location stale, integrity exception open, integrity exception resolved, permission-redacted event, selected-node recovery.

## Ranh giới

### Chấp nhận

- Chấp nhận khi truy vết một mẫu hoặc aliquot qua tổ tiên dẫn xuất, lưu ký, vị trí và lịch sử sử dụng để xác lập nguồn gốc và tính toàn vẹn.
- Chấp nhận khi cây dẫn xuất, chuỗi lưu ký theo thời gian và vị trí hiện tại vẫn là các owner bằng chứng riêng biệt trong khi dùng chung node mẫu được chọn.
- Chấp nhận khi compact giữ đúng task evidence, action và recovery.

### Từ chối

- Từ chối generic knowledge graph; đây là bằng chứng `AR-SL-90` và phải route tới archetype lân cận.
- Từ chối audit timeline; đây là bằng chứng `AR-SL-91` và phải route tới archetype lân cận.
- Từ chối inventory detail; đây là bằng chứng `AR-SL-92` và phải route tới archetype lân cận.
- Từ chối chain-of-custody transfer execution; đây là bằng chứng `AR-SL-93` và phải route tới archetype lân cận.
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
| [NIST — Research Data Framework](https://www.nist.gov/programs-projects/research-data-framework-rdaf) | Hỗ trợ research-data lifecycle and provenance considerations. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [FDA — Data integrity guidance](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/data-integrity-and-compliance-drug-cgmp-questions-and-answers) | Hỗ trợ data integrity and trustworthy records. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [W3C WAI — Tree View Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/) | Hỗ trợ keyboard behavior for hierarchical navigation. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [W3C WAI — Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Hỗ trợ meaningful focus order through pane changes. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |

Tập nguồn đại diện cho ít nhất ba tổ chức official độc lập và bao gồm bằng chứng accessibility của W3C.

## Output

```json
{
  "archetypeId": "sample-lineage-custody-explorer",
  "situationCodes": ["<matched AR-SL-* codes>"],
  "searchAliases": ["sample lineage","aliquot provenance","custody history","sample ancestry"],
  "dominantTask": "Trace one sample or aliquot through derivation ancestry, custody, location, and use history to establish provenance and integrity.",
  "regions": ["sample-explorer","sample-identity","derivation-lineage-tree","current-location-and-inventory","custody-chain","assay-and-consumption-links","integrity-exceptions","selected-ancestor-or-descendant-detail"],
  "regionRelationships": ["The derivation tree, chronological custody chain, and current location remain separate evidence owners while sharing the selected sample node."],
  "responsive": {
    "wide": "<simultaneous evidence structure>",
    "intermediate": "<failure and named-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "sample-explorer → sample-identity → derivation-lineage-tree → current-location-and-inventory → custody-chain → assay-and-consumption-links → integrity-exceptions → selected-ancestor-or-descendant-detail",
    "navigationReplacement": "<none or explicit named-pane controls>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "derivation-lineage-tree",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["lineage loading","lineage partial","cyclic lineage invalid","aliquot consumed","aliquot available","aliquot missing","custody verified","custody gap","custody disputed","location stale","integrity exception open","integrity exception resolved","permission-redacted event","selected-node recovery"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low, with evidence>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

