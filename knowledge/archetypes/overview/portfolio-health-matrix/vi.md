# Ma trận health danh mục

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `portfolio-health-matrix` |
| Nhóm | Overview |
| Tác vụ chi phối | Quét một hierarchy danh mục theo các health dimension chung, tìm outlier và drill vào unit chịu trách nhiệm. |
| Bí danh tìm kiếm | `portfolio matrix`, `hierarchical health grid`, `unit dimension matrix`, `portfolio outliers` |
| Thẩm quyền | Topology macro dùng chung, trung lập sản phẩm. |

### Bất biến

- Region graph phải giữ nguyên `portfolio-monitor` → `scope-period-filters` → `hierarchy-summary` → `unit-by-dimension-matrix` → `exception-list` → `selected-unit-drilldown`.
- Mỗi region phải giữ owner, state và association với selection hiện tại.
- DOM order, reading order và meaningful focus order phải giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu geometry còn chưa resolve; Direction sở hữu visual character.
- Loading, ready, empty, error, unavailable, pending, success và stale/conflict phải giữ dominant task.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-PH-01` | Dominant task đúng là: Quét một hierarchy danh mục theo các health dimension chung, tìm outlier và drill vào unit chịu trách nhiệm. | Bằng chứng ứng viên. |
| `AR-PH-02` | Toàn bộ region graph bắt buộc phải cùng hiện diện về mặt semantics. | Bằng chứng bắt buộc. |
| `AR-PH-03` | Compact phải giữ selection, action, state và recovery của wide. | Bằng chứng bắt buộc. |
| `AR-PH-04` | Mỗi region có owner riêng và giữ association với selection hiện tại. | Giữ như bất biến. |
| `AR-PH-90` | Dominant task thuộc ranh giới loại trừ: flat comparison decision. | Từ chối. |
| `AR-PH-91` | Dominant task thuộc ranh giới loại trừ: heterogeneous card dashboard. | Từ chối. |
| `AR-PH-92` | Dominant task thuộc ranh giới loại trừ: permissions matrix editing. | Từ chối. |
| `AR-PH-93` | Dominant task thuộc ranh giới loại trừ: goal tree chỉ có một progress measure. | Từ chối. |

### Quy tắc chọn

Chỉ chọn `portfolio-health-matrix` khi `AR-PH-01`, `AR-PH-02` và `AR-PH-03` có bằng chứng, đồng thời không mã nào từ `AR-PH-90` đến `AR-PH-93` mô tả dominant task. Trả `needs-evidence` khi thiếu một quan hệ bắt buộc. Trả `reject` khi có rejection evidence thay vì thích nghi topology theo vẻ ngoài.

## Sơ đồ vùng

```text
portfolio-monitor
└─ scope-period-filters
   └─ hierarchy-summary
      └─ unit-by-dimension-matrix
         └─ exception-list
            └─ selected-unit-drilldown
```

### Nghĩa vụ vùng

| Vùng | Chủ sở hữu | Quan hệ |
|---|---|---|
| `portfolio-monitor` | Sở hữu dominant task cấp trang và trạng thái của toàn graph. | Là gốc của graph. |
| `scope-period-filters` | Sở hữu evidence hoặc action của scope period filters mà không vay product semantics. | Theo sau `portfolio-monitor` trong semantic order và giữ cùng selection context. |
| `hierarchy-summary` | Sở hữu evidence hoặc action của hierarchy summary mà không vay product semantics. | Theo sau `scope-period-filters` trong semantic order và giữ cùng selection context. |
| `unit-by-dimension-matrix` | Sở hữu evidence hoặc action của unit by dimension matrix mà không vay product semantics. | Theo sau `hierarchy-summary` trong semantic order và giữ cùng selection context. |
| `exception-list` | Sở hữu evidence hoặc action của exception list mà không vay product semantics. | Theo sau `unit-by-dimension-matrix` trong semantic order và giữ cùng selection context. |
| `selected-unit-drilldown` | Sở hữu evidence hoặc action của selected unit drilldown mà không vay product semantics. | Theo sau `exception-list` trong semantic order và giữ cùng selection context. |

## Hợp đồng responsive

### Wide

- **Điểm kích hoạt thất bại:** Wide kết thúc khi các region đồng thời không còn giữ được label dễ đọc, association chính xác và action đầy đủ.
- **Đáp ứng topology:** Giữ đồng thời các region bắt buộc từ `hierarchy-summary` đến `selected-unit-drilldown` khi mỗi region còn đủ measure cho nhiệm vụ.
- **Thay thế điều hướng:** Không thay thế navigation khi toàn bộ region bắt buộc còn usable đồng thời.
- **Ranh giới sticky:** Chỉ active cross-region action được persist; surface phải reserve space và yield khi chiều cao không giữ focus visible.
- **Chủ sở hữu overflow:** `unit-by-dimension-matrix` là region duy nhất có thể sở hữu bounded horizontal overflow.

### Intermediate

- **Điểm kích hoạt thất bại:** Intermediate bắt đầu khi region hỗ trợ có priority thấp nhất làm hỏng quan hệ chính.
- **Đáp ứng topology:** Giữ region chính và một supporting region usable; chuyển region còn lại thành named drawer hoặc disclosure có state rõ.
- **Thay thế điều hướng:** Dùng control có accessible name để mở region bị thay thế và luôn hiển thị selection hiện tại.
- **Ranh giới sticky:** Action chỉ persist khi exact target và status còn visible; action trở về flow ở short height.
- **Chủ sở hữu overflow:** `unit-by-dimension-matrix` giữ overflow axis duy nhất và có hướng dẫn keyboard.

### Compact

- **Điểm kích hoạt thất bại:** Compact bắt đầu khi hai task regions đồng thời không còn giữ evidence dễ đọc và control tối thiểu 44×44 CSS px.
- **Đáp ứng topology:** Tái cấu trúc thành một primary-pane sequence theo semantic order; không stack toàn bộ desktop boxes.
- **Thay thế điều hướng:** Dùng sequence có Back để restore selection, filters, state và scroll context.
- **Ranh giới sticky:** Bottom action phải reserve content space, không che focus và yield về normal flow ở short height.
- **Chủ sở hữu overflow:** `unit-by-dimension-matrix` là view tùy chọn; text hoặc list equivalent là primary.

### Reflow

- Semantic order và DOM order là `portfolio-monitor` → `scope-period-filters` → `hierarchy-summary` → `unit-by-dimension-matrix` → `exception-list` → `selected-unit-drilldown`.
- Zoom, long translation, enlarged control và text pressure kích hoạt cùng topology transformations.
- CSS không được reorder visual sequence khác keyboard hoặc assistive-technology order.
- Long labels phải wrap hoặc có accessible reveal path.
- Ordinary content không tạo page-level horizontal scrolling.

### Ngang bằng tương tác

- Mọi selection, action, explanation, retry và recovery của wide phải reachable ở intermediate và compact.
- Topology change phải giữ exact selected entity, filters, data state và pending/completed result.
- Dynamic update phải announce một contextual status message mà không steal focus.
- Modal phải trap focus, hỗ trợ Escape/Cancel và trả focus về exact trigger.
- Color, position và geometry phải có text hoặc structural equivalent.

## Nghĩa vụ trạng thái

| Trạng thái | Vùng sở hữu | Nghĩa vụ |
|---|---|---|
| Khởi tạo / loading | `scope-period-filters` | Nêu scope và region đang chờ; giữ trước semantic position. |
| Sẵn sàng | `hierarchy-summary` | Trình bày đầy đủ dominant task và các association bắt buộc. |
| Rỗng / không áp dụng | `unit-by-dimension-matrix` | Phân biệt sự vắng mặt có nghĩa với evidence không khả dụng. |
| Lỗi / thử lại | `exception-list` | Giữ context còn hợp lệ và cung cấp retry cục bộ mà không reset selection. |
| Quyền / không khả dụng | `selected-unit-drilldown` | Không suy diễn hidden evidence là absent; cung cấp safe exit hoặc alternate route. |
| Đang chờ | `selected-unit-drilldown` | Chặn action lặp, giữ exact target và announce tiến độ mà không chuyển focus. |
| Thành công | `selected-unit-drilldown` | Hiển thị outcome, giữ selected context và cung cấp next valid action. |
| Cũ / xung đột | `scope-period-filters` | Giữ last safe value, nêu version hoặc time conflict và yêu cầu recovery rõ. |
| Chuyển focus | `selected-unit-drilldown` | Chỉ đưa focus vào modal hoặc error summary bắt buộc rồi trả về exact trigger. |
| Trình bày responsive | `portfolio-monitor` | Giữ state, selection, query và recovery khi topology đổi. |

Các state đặc thù của dominant task phải được Grammar đặt tên đúng nghĩa nhưng không được xóa các family bắt buộc trên.

## Ranh giới

### Chấp nhận

- Chấp nhận khi dominant task khớp chính xác câu trong bảng Identity.
- Chấp nhận khi toàn bộ required region graph cùng giữ một selection context.
- Chấp nhận khi compact giữ task, state, action và recovery parity.

### Từ chối

- Từ chối khi dominant task là flat comparison decision; đây là evidence `AR-PH-90` và phải route sang adjacent archetype.
- Từ chối khi dominant task là heterogeneous card dashboard; đây là evidence `AR-PH-91` và phải route sang adjacent archetype.
- Từ chối khi dominant task là permissions matrix editing; đây là evidence `AR-PH-92` và phải route sang adjacent archetype.
- Từ chối khi dominant task là goal tree chỉ có một progress measure; đây là evidence `AR-PH-93` và phải route sang adjacent archetype.

### Phán quyết ranh giới

Trả `accept` chỉ khi dominant task, complete region graph và compact interaction parity đều đúng. Trả `reject` khi có rejection code. Trả `needs-evidence` khi owner hoặc relationship bắt buộc chưa resolve. Khác biệt chỉ ở noun, card count, density, color, component hoặc state là `duplicate-or-variation`, không phải archetype mới.

## Bàn giao

- **Grammar handoff:** Gắn product-specific owners, labels, permitted actions, eligibility và truthful state meaning vào các region đã khai báo.
- **Principles handoff:** Resolve exact grid, measure, gap, alignment, sticky offset, bounded overflow realization và relationship-driven transition points.
- Không handoff nào được xóa required region, đổi dominant task hoặc giảm interaction parity.

## Bằng chứng nghiên cứu không ràng buộc

### Ranh giới bằng chứng

Research bên ngoài là advisory evidence, không phải product truth. Nguồn hỗ trợ tổng hợp task relationships, adaptive behavior và accessibility obligations; nguồn không đặt StarCi owner, không chọn exact geometry và không cấp quyền copy interface.

### Nguồn

| Nguồn | Điều nguồn hỗ trợ | Điều nguồn không chứng minh |
|---|---|---|
| [WAI-ARIA APG — Treegrid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/) | Hỗ trợ quan hệ grid có hierarchy, expansion và keyboard behavior. | Không chọn archetype này, không định nghĩa product truth và không cho phép copy geometry. |
| [IBM Carbon — 2x Grid](https://carbondesignsystem.com/elements/2x-grid/overview/) | Hỗ trợ adaptive screen regions, fluid structures và content-driven layout integrity. | Không chọn archetype này, không định nghĩa product truth và không cho phép copy geometry. |
| [Microsoft Fluent 2 — Layout](https://fluent2.microsoft.design/layout) | Hỗ trợ adaptive panes, readable content regions và layout relationships theo available space. | Không chọn archetype này, không định nghĩa product truth và không cho phép copy geometry. |
| [W3C WAI — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Hỗ trợ reflow không có page-level two-dimensional scrolling và bounded exceptions. | Không chọn archetype này, không định nghĩa product truth và không cho phép copy geometry. |

| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Hỗ trợ row-column association rõ, selection, dense comparison và bounded table overflow. | Không chọn archetype này, không định nghĩa product truth và không cho phép copy geometry. |
| [Salesforce Lightning — Component reference](https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/) | Hỗ trợ explicit hierarchy, progress, status và drilldown semantics trên enterprise data surfaces. | Không chọn archetype này, không định nghĩa product truth và không cho phép copy geometry. |
| [Atlassian Support — Jira Align custom hierarchy domain health](https://support.atlassian.com/jira-align/kb/jira-align-api-endpoints-for-accessing-custom-room-data/) | Hỗ trợ hierarchical domains có explicit health records và relations như task-specific evidence. | Không áp đặt Jira Align nouns, API shape, scoring policy hoặc layout lên archetype này. |

Tập nguồn đại diện cho ít nhất ba tổ chức chính thức độc lập và có accessibility evidence từ W3C.

## Đầu ra

```json
{
  "archetypeId": "portfolio-health-matrix",
  "situationCodes": ["<matched AR-PH-* codes>"],
  "searchAliases": ["portfolio matrix","hierarchical health grid","unit dimension matrix","portfolio outliers"],
  "dominantTask": "Quét một hierarchy danh mục theo các health dimension chung, tìm outlier và drill vào unit chịu trách nhiệm.",
  "regions": ["portfolio-monitor","scope-period-filters","hierarchy-summary","unit-by-dimension-matrix","exception-list","selected-unit-drilldown"],
  "regionRelationships": ["portfolio-monitor precedes scope-period-filters precedes hierarchy-summary precedes unit-by-dimension-matrix precedes exception-list precedes selected-unit-drilldown"],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named supporting-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "portfolio-monitor → scope-period-filters → hierarchy-summary → unit-by-dimension-matrix → exception-list → selected-unit-drilldown",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "unit-by-dimension-matrix",
    "interactionParity": "<preserved action, state, selection and recovery>"
  },
  "stateObligations": ["initial/loading", "ready", "empty/not-applicable", "error/retry", "permission/unavailable", "pending", "success", "stale/conflict", "focus transition", "responsive presentation"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

