# Tổng quan control bow-tie rủi ro

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `risk-bow-tie-control-overview` |
| Nhóm | Overview |
| Tác vụ chi phối | Hiểu threats có thể gây một central event như thế nào và preventive/recovery controls cắt các đường tới consequences ra sao. |
| Bí danh tìm kiếm | `bow tie risk`, `barrier control overview`, `threat consequence paths`, `control gaps` |
| Thẩm quyền | Topology macro dùng chung, trung lập sản phẩm. |

### Bất biến

- Region graph phải giữ nguyên `bow-tie-overview` → `risk-scope-and-central-event` → `threat-paths` → `preventive-controls` → `central-event` → `consequence-paths` → `recovery-mitigations` → `control-gap-register`.
- Mỗi region phải giữ owner, state và association với selection hiện tại.
- DOM order, reading order và meaningful focus order phải giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu geometry còn chưa resolve; Direction sở hữu visual character.
- Loading, ready, empty, error, unavailable, pending, success và stale/conflict phải giữ dominant task.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-RB-01` | Dominant task đúng là: Hiểu threats có thể gây một central event như thế nào và preventive/recovery controls cắt các đường tới consequences ra sao. | Bằng chứng ứng viên. |
| `AR-RB-02` | Toàn bộ region graph bắt buộc phải cùng hiện diện về mặt semantics. | Bằng chứng bắt buộc. |
| `AR-RB-03` | Compact phải giữ selection, action, state và recovery của wide. | Bằng chứng bắt buộc. |
| `AR-RB-04` | Mỗi region có owner riêng và giữ association với selection hiện tại. | Giữ như bất biến. |
| `AR-RB-90` | Dominant task thuộc ranh giới loại trừ: impact-by-likelihood matrix. | Từ chối. |
| `AR-RB-91` | Dominant task thuộc ranh giới loại trừ: dependency graph health. | Từ chối. |
| `AR-RB-92` | Dominant task thuộc ranh giới loại trừ: generic compliance matrix. | Từ chối. |
| `AR-RB-93` | Dominant task thuộc ranh giới loại trừ: editable workflow. | Từ chối. |

### Quy tắc chọn

Chỉ chọn `risk-bow-tie-control-overview` khi `AR-RB-01`, `AR-RB-02` và `AR-RB-03` có bằng chứng, đồng thời không mã nào từ `AR-RB-90` đến `AR-RB-93` mô tả dominant task. Trả `needs-evidence` khi thiếu một quan hệ bắt buộc. Trả `reject` khi có rejection evidence thay vì thích nghi topology theo vẻ ngoài.

## Sơ đồ vùng

```text
bow-tie-overview
└─ risk-scope-and-central-event
   └─ threat-paths
      └─ preventive-controls
         └─ central-event
            └─ consequence-paths
               └─ recovery-mitigations
                  └─ control-gap-register
```

### Nghĩa vụ vùng

| Vùng | Chủ sở hữu | Quan hệ |
|---|---|---|
| `bow-tie-overview` | Sở hữu dominant task cấp trang và trạng thái của toàn graph. | Là gốc của graph. |
| `risk-scope-and-central-event` | Sở hữu evidence hoặc action của risk scope and central event mà không vay product semantics. | Theo sau `bow-tie-overview` trong semantic order và giữ cùng selection context. |
| `threat-paths` | Sở hữu evidence hoặc action của threat paths mà không vay product semantics. | Theo sau `risk-scope-and-central-event` trong semantic order và giữ cùng selection context. |
| `preventive-controls` | Sở hữu evidence hoặc action của preventive controls mà không vay product semantics. | Theo sau `threat-paths` trong semantic order và giữ cùng selection context. |
| `central-event` | Sở hữu evidence hoặc action của central event mà không vay product semantics. | Theo sau `preventive-controls` trong semantic order và giữ cùng selection context. |
| `consequence-paths` | Sở hữu evidence hoặc action của consequence paths mà không vay product semantics. | Theo sau `central-event` trong semantic order và giữ cùng selection context. |
| `recovery-mitigations` | Sở hữu evidence hoặc action của recovery mitigations mà không vay product semantics. | Theo sau `consequence-paths` trong semantic order và giữ cùng selection context. |
| `control-gap-register` | Sở hữu evidence hoặc action của control gap register mà không vay product semantics. | Theo sau `recovery-mitigations` trong semantic order và giữ cùng selection context. |

## Hợp đồng responsive

### Wide

- **Điểm kích hoạt thất bại:** Wide kết thúc khi các region đồng thời không còn giữ được label dễ đọc, association chính xác và action đầy đủ.
- **Đáp ứng topology:** Giữ đồng thời các region bắt buộc từ `threat-paths` đến `control-gap-register` khi mỗi region còn đủ measure cho nhiệm vụ.
- **Thay thế điều hướng:** Không thay thế navigation khi toàn bộ region bắt buộc còn usable đồng thời.
- **Ranh giới sticky:** Chỉ active cross-region action được persist; surface phải reserve space và yield khi chiều cao không giữ focus visible.
- **Chủ sở hữu overflow:** `bow-tie-overview` là region duy nhất có thể sở hữu bounded horizontal overflow.

### Intermediate

- **Điểm kích hoạt thất bại:** Intermediate bắt đầu khi region hỗ trợ có priority thấp nhất làm hỏng quan hệ chính.
- **Đáp ứng topology:** Giữ region chính và một supporting region usable; chuyển region còn lại thành named drawer hoặc disclosure có state rõ.
- **Thay thế điều hướng:** Dùng control có accessible name để mở region bị thay thế và luôn hiển thị selection hiện tại.
- **Ranh giới sticky:** Action chỉ persist khi exact target và status còn visible; action trở về flow ở short height.
- **Chủ sở hữu overflow:** `bow-tie-overview` giữ overflow axis duy nhất và có hướng dẫn keyboard.

### Compact

- **Điểm kích hoạt thất bại:** Compact bắt đầu khi hai task regions đồng thời không còn giữ evidence dễ đọc và control tối thiểu 44×44 CSS px.
- **Đáp ứng topology:** Tái cấu trúc thành một primary-pane sequence theo semantic order; không stack toàn bộ desktop boxes.
- **Thay thế điều hướng:** Dùng sequence có Back để restore selection, filters, state và scroll context.
- **Ranh giới sticky:** Bottom action phải reserve content space, không che focus và yield về normal flow ở short height.
- **Chủ sở hữu overflow:** `bow-tie-overview` là view tùy chọn; text hoặc list equivalent là primary.

### Reflow

- Semantic order và DOM order là `bow-tie-overview` → `risk-scope-and-central-event` → `threat-paths` → `preventive-controls` → `central-event` → `consequence-paths` → `recovery-mitigations` → `control-gap-register`.
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
| Khởi tạo / loading | `risk-scope-and-central-event` | Nêu scope và region đang chờ; giữ trước semantic position. |
| Sẵn sàng | `threat-paths` | Trình bày đầy đủ dominant task và các association bắt buộc. |
| Rỗng / không áp dụng | `preventive-controls` | Phân biệt sự vắng mặt có nghĩa với evidence không khả dụng. |
| Lỗi / thử lại | `central-event` | Giữ context còn hợp lệ và cung cấp retry cục bộ mà không reset selection. |
| Quyền / không khả dụng | `control-gap-register` | Không suy diễn hidden evidence là absent; cung cấp safe exit hoặc alternate route. |
| Đang chờ | `control-gap-register` | Chặn action lặp, giữ exact target và announce tiến độ mà không chuyển focus. |
| Thành công | `control-gap-register` | Hiển thị outcome, giữ selected context và cung cấp next valid action. |
| Cũ / xung đột | `risk-scope-and-central-event` | Giữ last safe value, nêu version hoặc time conflict và yêu cầu recovery rõ. |
| Chuyển focus | `control-gap-register` | Chỉ đưa focus vào modal hoặc error summary bắt buộc rồi trả về exact trigger. |
| Trình bày responsive | `bow-tie-overview` | Giữ state, selection, query và recovery khi topology đổi. |

Các state đặc thù của dominant task phải được Grammar đặt tên đúng nghĩa nhưng không được xóa các family bắt buộc trên.

## Ranh giới

### Chấp nhận

- Chấp nhận khi dominant task khớp chính xác câu trong bảng Identity.
- Chấp nhận khi toàn bộ required region graph cùng giữ một selection context.
- Chấp nhận khi compact giữ task, state, action và recovery parity.

### Từ chối

- Từ chối khi dominant task là impact-by-likelihood matrix; đây là evidence `AR-RB-90` và phải route sang adjacent archetype.
- Từ chối khi dominant task là dependency graph health; đây là evidence `AR-RB-91` và phải route sang adjacent archetype.
- Từ chối khi dominant task là generic compliance matrix; đây là evidence `AR-RB-92` và phải route sang adjacent archetype.
- Từ chối khi dominant task là editable workflow; đây là evidence `AR-RB-93` và phải route sang adjacent archetype.

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
| [UK HSE — Major hazards regulatory model](https://www.hse.gov.uk/regulating-major-hazards/assets/docs/major-hazards-regulatory-model.pdf) | Hỗ trợ các lớp barrier bow-tie, hazard paths, prevention, mitigation và effective control. | Không chọn archetype này, không định nghĩa product truth và không cho phép copy geometry. |
| [IBM Carbon — 2x Grid](https://carbondesignsystem.com/elements/2x-grid/overview/) | Hỗ trợ adaptive screen regions, fluid structures và content-driven layout integrity. | Không chọn archetype này, không định nghĩa product truth và không cho phép copy geometry. |
| [Microsoft Fluent 2 — Layout](https://fluent2.microsoft.design/layout) | Hỗ trợ adaptive panes, readable content regions và layout relationships theo available space. | Không chọn archetype này, không định nghĩa product truth và không cho phép copy geometry. |
| [W3C WAI — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Hỗ trợ reflow không có page-level two-dimensional scrolling và bounded exceptions. | Không chọn archetype này, không định nghĩa product truth và không cho phép copy geometry. |

| [W3C WAI — ARIA Authoring Practices patterns](https://www.w3.org/WAI/ARIA/apg/patterns/) | Hỗ trợ keyboard-complete composite interaction, state exposure và predictable focus movement. | Không chọn archetype này, không định nghĩa product truth và không cho phép copy geometry. |
| [W3C WAI — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Hỗ trợ announce live, pending, success, failure và reconnect change mà không chuyển focus. | Không chọn archetype này, không định nghĩa product truth và không cho phép copy geometry. |

Tập nguồn đại diện cho ít nhất ba tổ chức chính thức độc lập và có accessibility evidence từ W3C.

## Đầu ra

```json
{
  "archetypeId": "risk-bow-tie-control-overview",
  "situationCodes": ["<matched AR-RB-* codes>"],
  "searchAliases": ["bow tie risk","barrier control overview","threat consequence paths","control gaps"],
  "dominantTask": "Hiểu threats có thể gây một central event như thế nào và preventive/recovery controls cắt các đường tới consequences ra sao.",
  "regions": ["bow-tie-overview","risk-scope-and-central-event","threat-paths","preventive-controls","central-event","consequence-paths","recovery-mitigations","control-gap-register"],
  "regionRelationships": ["bow-tie-overview precedes risk-scope-and-central-event precedes threat-paths precedes preventive-controls precedes central-event precedes consequence-paths precedes recovery-mitigations precedes control-gap-register"],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named supporting-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "bow-tie-overview → risk-scope-and-central-event → threat-paths → preventive-controls → central-event → consequence-paths → recovery-mitigations → control-gap-register",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "bow-tie-overview",
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

