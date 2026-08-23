# Bàn làm việc hội tụ lưới phần tử hữu hạn

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `finite-element-mesh-convergence-workbench` |
| Nhóm | Work |
| Tác vụ chi phối | Xác lập liệu nghiệm trường số có đủ độc lập với lưới cho đại lượng quan tâm dự kiến hay chưa bằng cách so sánh các mức tinh chỉnh, định vị sai số rời rạc, tinh chỉnh và chạy lại. |
| Bí danh tìm kiếm | `mesh convergence`, `grid independence`, `discretization error`, `refinement study` |
| Thẩm quyền | Topology macro dùng chung, trung lập sản phẩm. |

### Bất biến

- Phân cấp mức lưới giữ một định danh vùng vật lý đồng bộ qua hình học, trường và bằng chứng sai số cục bộ; định vị sai số không gian và hội tụ đại lượng xuyên mức cùng sở hữu quyết định chấp nhận.
- Region graph bắt buộc giữ nguyên `mesh-convergence → analysis-case-boundary-and-material-authority → mesh-level-hierarchy → geometry-and-mesh-stage → field-result-stage → element-quality-and-local-error-map → quantity-of-interest-convergence-series → refinement-plan-and-cost → rerun-and-acceptance-receipt`.
- DOM order, reading order và meaningful focus order phải giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Các trạng thái loading, ready, empty, error, unavailable, pending, success và stale/conflict phải giữ dominant task.
- Linked refinement levels, the same physical region across mesh, field and error views, local discretization error, convergence, and a refinement rerun are all mandatory.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-FM-01` | Dominant task là: Xác lập liệu nghiệm trường số có đủ độc lập với lưới cho đại lượng quan tâm dự kiến hay chưa bằng cách so sánh các mức tinh chỉnh, định vị sai số rời rạc, tinh chỉnh và chạy lại. | Bằng chứng ứng viên. |
| `AR-FM-02` | Toàn bộ region graph bắt buộc hiện diện về mặt semantics. | Bằng chứng bắt buộc. |
| `AR-FM-03` | Compact giữ selection, action, state và recovery của wide. | Bằng chứng bắt buộc. |
| `AR-FM-04` | Phân cấp mức lưới giữ một định danh vùng vật lý đồng bộ qua hình học, trường và bằng chứng sai số cục bộ; định vị sai số không gian và hội tụ đại lượng xuyên mức cùng sở hữu quyết định chấp nhận. | Bằng chứng quan hệ bắt buộc. |
| `AR-FM-90` | Dominant task là scenario-sensitivity-modeler. | Từ chối. |
| `AR-FM-91` | Dominant task là orthogonal-volume-slice-inspector. | Từ chối. |
| `AR-FM-92` | Dominant task là generic simulation viewer. | Từ chối. |
| `AR-FM-93` | Dominant task là job timeline. | Từ chối. |

### Quy tắc chọn

Chỉ chọn `finite-element-mesh-convergence-workbench` khi `AR-FM-01`, `AR-FM-02`, `AR-FM-03` và `AR-FM-04` có bằng chứng, đồng thời không mã loại trừ nào từ `AR-FM-90` đến `AR-FM-93` đúng. Trả `needs-evidence` khi thiếu owner hoặc quan hệ bắt buộc. Trả `reject` khi có bất kỳ mã loại trừ nào.

## Sơ đồ vùng

```text
mesh-convergence
└─ analysis-case-boundary-and-material-authority
   └─ mesh-level-hierarchy
      └─ geometry-and-mesh-stage
         └─ field-result-stage
            └─ element-quality-and-local-error-map
               └─ quantity-of-interest-convergence-series
                  └─ refinement-plan-and-cost
                     └─ rerun-and-acceptance-receipt
```

- Quan hệ bắt buộc: Phân cấp mức lưới giữ một định danh vùng vật lý đồng bộ qua hình học, trường và bằng chứng sai số cục bộ; định vị sai số không gian và hội tụ đại lượng xuyên mức cùng sở hữu quyết định chấp nhận.

### Nghĩa vụ vùng

| Vùng | Chủ sở hữu | Quan hệ |
|---|---|---|
| `mesh-convergence` | Sở hữu dominant task cấp trang và trạng thái của toàn graph. | Là gốc của graph. |
| `analysis-case-boundary-and-material-authority` | Sở hữu bằng chứng, trạng thái và action của analysis-case-boundary-and-material-authority mà không vay product semantics. | Theo sau `mesh-convergence` trong semantic order và giữ cùng selection context. |
| `mesh-level-hierarchy` | Sở hữu bằng chứng, trạng thái và action của mesh-level-hierarchy mà không vay product semantics. | Theo sau `analysis-case-boundary-and-material-authority` trong semantic order và giữ cùng selection context. |
| `geometry-and-mesh-stage` | Sở hữu bằng chứng, trạng thái và action của geometry-and-mesh-stage mà không vay product semantics. | Theo sau `mesh-level-hierarchy` trong semantic order và giữ cùng selection context. |
| `field-result-stage` | Sở hữu bằng chứng, trạng thái và action của field-result-stage mà không vay product semantics. | Theo sau `geometry-and-mesh-stage` trong semantic order và giữ cùng selection context. |
| `element-quality-and-local-error-map` | Sở hữu bằng chứng, trạng thái và action của element-quality-and-local-error-map mà không vay product semantics. | Theo sau `field-result-stage` trong semantic order và giữ cùng selection context. |
| `quantity-of-interest-convergence-series` | Sở hữu bằng chứng, trạng thái và action của quantity-of-interest-convergence-series mà không vay product semantics. | Theo sau `element-quality-and-local-error-map` trong semantic order và giữ cùng selection context. |
| `refinement-plan-and-cost` | Sở hữu bằng chứng, trạng thái và action của refinement-plan-and-cost mà không vay product semantics. | Theo sau `quantity-of-interest-convergence-series` trong semantic order và giữ cùng selection context. |
| `rerun-and-acceptance-receipt` | Sở hữu bằng chứng, trạng thái và action của rerun-and-acceptance-receipt mà không vay product semantics. | Theo sau `refinement-plan-and-cost` trong semantic order và giữ cùng selection context. |

## Hợp đồng responsive

### Wide

- **Điểm kích hoạt thất bại:** Wide kết thúc khi các owner bằng chứng đồng thời không còn giữ label dễ đọc, association xuyên vùng chính xác và action đầy đủ.
- **Đáp ứng topology:** Keep the selected mesh, field result, local error or quality evidence, and convergence series simultaneous under one shared level and physical-region identity.
- **Thay thế điều hướng:** Không thay thế khi mọi owner đồng thời còn usable.
- **Ranh giới sticky:** Chỉ action xuyên vùng đang hoạt động được persist; nó reserve space và yield khi chiều cao ngắn không giữ được focus visible.
- **Chủ sở hữu overflow:** Chỉ `geometry-and-mesh-stage` được sở hữu bounded overflow hai chiều khi ý nghĩa tác vụ yêu cầu.

### Intermediate

- **Điểm kích hoạt thất bại:** Intermediate bắt đầu khi region persist có ưu tiên thấp nhất làm quan hệ chi phối khó đọc hoặc không vận hành được.
- **Đáp ứng topology:** Keep the selected refinement pair and convergence result primary; alternate geometry and field in one preserved viewport while quality details use a synchronized supporting pane.
- **Thay thế điều hướng:** Một control pane có tên mở region bị dời với selection và state hiện tại còn nguyên.
- **Ranh giới sticky:** Action persist chỉ còn khi target và status thấy được; nó trở về normal flow ở short height.
- **Chủ sở hữu overflow:** `geometry-and-mesh-stage` giữ bounded overflow; prose và control bị dời phải reflow.

### Compact

- **Điểm kích hoạt thất bại:** Compact bắt đầu khi hai task region đồng thời không giữ được evidence dễ đọc và control 44×44 CSS px.
- **Đáp ứng topology:** Use the sequence quantity of interest → refinement-level pair → worst error zone or element → field/error evidence → refine or rerun → convergence receipt; remove the miniature multi-viewport wall.
- **Thay thế điều hướng:** Control Previous, Next và pane có tên khôi phục selection, state và scroll context.
- **Ranh giới sticky:** Compact step control reserve space, không che focus và yield ở short height.
- **Chủ sở hữu overflow:** `geometry-and-mesh-stage` là ngoại lệ bounded duy nhất; mọi nội dung khác dùng page scroll.

### Reflow

- Semantic order và DOM order là `mesh-convergence → analysis-case-boundary-and-material-authority → mesh-level-hierarchy → geometry-and-mesh-stage → field-result-stage → element-quality-and-local-error-map → quantity-of-interest-convergence-series → refinement-plan-and-cost → rerun-and-acceptance-receipt`.
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
- The fictional run blocks acceptance while the local error remains above 3%.

## Nghĩa vụ trạng thái

| Trạng thái | Vùng sở hữu | Nghĩa vụ |
|---|---|---|
| Initial / loading | `analysis-case-boundary-and-material-authority` | Xác định owner đang pending và giữ semantic position. |
| Ready | `mesh-level-hierarchy` | Mở toàn bộ dominant task và evidence đồng bộ. |
| Empty / not applicable | `geometry-and-mesh-stage` | Phân biệt absence có nghĩa với evidence unavailable. |
| Error / retry | `field-result-stage` | Giữ context hợp lệ và cho retry cục bộ mà không reset selection. |
| Permission / unavailable | `element-quality-and-local-error-map` | Không ngụ ý evidence bị ẩn là không tồn tại; cung cấp alternate route an toàn. |
| Pending | `rerun-and-acceptance-receipt` | Chặn action lặp và announce tiến trình mà không di chuyển focus. |
| Success | `rerun-and-acceptance-receipt` | Mở kết quả, giữ context và cung cấp next action hợp lệ. |
| Stale / conflict | `analysis-case-boundary-and-material-authority` | Giữ last safe value và yêu cầu recovery rõ ràng. |
| Focus transition | `rerun-and-acceptance-receipt` | Chỉ di chuyển focus cho modal hoặc error summary rồi trả về trigger. |
| Responsive presentation | `mesh-convergence` | Giữ selection, state và recovery khi topology đổi. |

State family áp dụng: case incomplete, mesh generating, mesh failure, element invalid, solve pending, solve diverged, quantity unavailable, error estimator stale, convergence monotonic, convergence oscillatory, convergence not reached, cost exceeded, acceptance pending, accepted, rejected.

## Ranh giới

### Chấp nhận

- Chấp nhận khi xác lập liệu nghiệm trường số có đủ độc lập với lưới cho đại lượng quan tâm dự kiến hay chưa bằng cách so sánh các mức tinh chỉnh, định vị sai số rời rạc, tinh chỉnh và chạy lại.
- Chấp nhận khi phân cấp mức lưới giữ một định danh vùng vật lý đồng bộ qua hình học, trường và bằng chứng sai số cục bộ; định vị sai số không gian và hội tụ đại lượng xuyên mức cùng sở hữu quyết định chấp nhận.
- Chấp nhận khi compact giữ đúng task evidence, action và recovery.

### Từ chối

- Từ chối scenario-sensitivity-modeler; đây là bằng chứng `AR-FM-90` và phải route tới archetype lân cận.
- Từ chối orthogonal-volume-slice-inspector; đây là bằng chứng `AR-FM-91` và phải route tới archetype lân cận.
- Từ chối generic simulation viewer; đây là bằng chứng `AR-FM-92` và phải route tới archetype lân cận.
- Từ chối job timeline; đây là bằng chứng `AR-FM-93` và phải route tới archetype lân cận.
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
| [NASA — NASA-STD-7009B](https://standards.nasa.gov/standard/nasa/nasa-std-7009) | Hỗ trợ model credibility and evidence records. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [ASME — V&V 10](https://www.asme.org/codes-standards/find-codes-standards/standard-for-verification-and-validation-in-computational-solid-mechanics) | Hỗ trợ computational solid-mechanics verification and validation. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [NAFEMS — Code verification exemplars](https://www.nafems.org/publications/resource_center/r0135/) | Hỗ trợ mesh refinement and verification exemplars. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [W3C WAI — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Hỗ trợ responsive access and bounded two-dimensional exceptions. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |

Tập nguồn đại diện cho ít nhất ba tổ chức official độc lập và bao gồm bằng chứng accessibility của W3C.

## Output

```json
{
  "archetypeId": "finite-element-mesh-convergence-workbench",
  "situationCodes": ["<matched AR-FM-* codes>"],
  "searchAliases": ["mesh convergence","grid independence","discretization error","refinement study"],
  "dominantTask": "Establish whether a numerical field solution is mesh-independent enough for its intended quantity of interest by comparing refinement levels, locating discretization error, refining, and rerunning.",
  "regions": ["mesh-convergence","analysis-case-boundary-and-material-authority","mesh-level-hierarchy","geometry-and-mesh-stage","field-result-stage","element-quality-and-local-error-map","quantity-of-interest-convergence-series","refinement-plan-and-cost","rerun-and-acceptance-receipt"],
  "regionRelationships": ["The mesh-level hierarchy keeps one physical-region identity synchronized across geometry, field, and local-error evidence; spatial error localization and cross-level quantity convergence jointly own acceptance."],
  "responsive": {
    "wide": "<simultaneous evidence structure>",
    "intermediate": "<failure and named-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "mesh-convergence → analysis-case-boundary-and-material-authority → mesh-level-hierarchy → geometry-and-mesh-stage → field-result-stage → element-quality-and-local-error-map → quantity-of-interest-convergence-series → refinement-plan-and-cost → rerun-and-acceptance-receipt",
    "navigationReplacement": "<none or explicit named-pane controls>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "geometry-and-mesh-stage",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["case incomplete","mesh generating","mesh failure","element invalid","solve pending","solve diverged","quantity unavailable","error estimator stale","convergence monotonic","convergence oscillatory","convergence not reached","cost exceeded","acceptance pending","accepted","rejected"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low, with evidence>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

