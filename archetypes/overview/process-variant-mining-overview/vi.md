# Tổng quan khai phá process variant

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `process-variant-mining-overview` |
| Nhóm | Overview |
| Tác vụ chi phối | Khám phá các process path thực tế từ event evidence và tìm loops, deviations, bottlenecks thay vì giả định funnel tuyến tính. |
| Bí danh tìm kiếm | `process mining`, `variant frequency map`, `actual path analysis`, `process bottlenecks` |
| Thẩm quyền | Topology macro dùng chung, trung lập sản phẩm. |

### Bất biến

- Region graph phải giữ nguyên `process-mining` → `case-period-segment-filters` → `directed-process-map` → `variant-frequency-list` → `duration-and-bottleneck-evidence` → `selected-variant-trace`.
- Mỗi region phải giữ owner, state và association với selection hiện tại.
- DOM order, reading order và meaningful focus order phải giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu geometry còn chưa resolve; Direction sở hữu visual character.
- Loading, ready, empty, error, unavailable, pending, success và stale/conflict phải giữ dominant task.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-PV-01` | Dominant task đúng là: Khám phá các process path thực tế từ event evidence và tìm loops, deviations, bottlenecks thay vì giả định funnel tuyến tính. | Bằng chứng ứng viên. |
| `AR-PV-02` | Toàn bộ region graph bắt buộc phải cùng hiện diện về mặt semantics. | Bằng chứng bắt buộc. |
| `AR-PV-03` | Compact phải giữ selection, action, state và recovery của wide. | Bằng chứng bắt buộc. |
| `AR-PV-04` | Mỗi region có owner riêng và giữ association với selection hiện tại. | Giữ như bất biến. |
| `AR-PV-90` | Dominant task thuộc ranh giới loại trừ: fixed linear funnel. | Từ chối. |
| `AR-PV-91` | Dominant task thuộc ranh giới loại trừ: editable workflow builder. | Từ chối. |
| `AR-PV-92` | Dominant task thuộc ranh giới loại trừ: dependency health graph. | Từ chối. |
| `AR-PV-93` | Dominant task thuộc ranh giới loại trừ: retrospective single-case audit timeline. | Từ chối. |

### Quy tắc chọn

Chỉ chọn `process-variant-mining-overview` khi `AR-PV-01`, `AR-PV-02` và `AR-PV-03` có bằng chứng, đồng thời không mã nào từ `AR-PV-90` đến `AR-PV-93` mô tả dominant task. Trả `needs-evidence` khi thiếu một quan hệ bắt buộc. Trả `reject` khi có rejection evidence thay vì thích nghi topology theo vẻ ngoài.

## Sơ đồ vùng

```text
process-mining
└─ case-period-segment-filters
   └─ directed-process-map
      └─ variant-frequency-list
         └─ duration-and-bottleneck-evidence
            └─ selected-variant-trace
```

### Nghĩa vụ vùng

| Vùng | Chủ sở hữu | Quan hệ |
|---|---|---|
| `process-mining` | Sở hữu dominant task cấp trang và trạng thái của toàn graph. | Là gốc của graph. |
| `case-period-segment-filters` | Sở hữu evidence hoặc action của case period segment filters mà không vay product semantics. | Theo sau `process-mining` trong semantic order và giữ cùng selection context. |
| `directed-process-map` | Sở hữu evidence hoặc action của directed process map mà không vay product semantics. | Theo sau `case-period-segment-filters` trong semantic order và giữ cùng selection context. |
| `variant-frequency-list` | Sở hữu evidence hoặc action của variant frequency list mà không vay product semantics. | Theo sau `directed-process-map` trong semantic order và giữ cùng selection context. |
| `duration-and-bottleneck-evidence` | Sở hữu evidence hoặc action của duration and bottleneck evidence mà không vay product semantics. | Theo sau `variant-frequency-list` trong semantic order và giữ cùng selection context. |
| `selected-variant-trace` | Sở hữu evidence hoặc action của selected variant trace mà không vay product semantics. | Theo sau `duration-and-bottleneck-evidence` trong semantic order và giữ cùng selection context. |

## Hợp đồng responsive

### Wide

- **Điểm kích hoạt thất bại:** Wide kết thúc khi các region đồng thời không còn giữ được label dễ đọc, association chính xác và action đầy đủ.
- **Đáp ứng topology:** Giữ đồng thời các region bắt buộc từ `directed-process-map` đến `selected-variant-trace` khi mỗi region còn đủ measure cho nhiệm vụ.
- **Thay thế điều hướng:** Không thay thế navigation khi toàn bộ region bắt buộc còn usable đồng thời.
- **Ranh giới sticky:** Chỉ active cross-region action được persist; surface phải reserve space và yield khi chiều cao không giữ focus visible.
- **Chủ sở hữu overflow:** `directed-process-map` là region duy nhất có thể sở hữu bounded horizontal overflow.

### Intermediate

- **Điểm kích hoạt thất bại:** Intermediate bắt đầu khi region hỗ trợ có priority thấp nhất làm hỏng quan hệ chính.
- **Đáp ứng topology:** Giữ region chính và một supporting region usable; chuyển region còn lại thành named drawer hoặc disclosure có state rõ.
- **Thay thế điều hướng:** Dùng control có accessible name để mở region bị thay thế và luôn hiển thị selection hiện tại.
- **Ranh giới sticky:** Action chỉ persist khi exact target và status còn visible; action trở về flow ở short height.
- **Chủ sở hữu overflow:** `directed-process-map` giữ overflow axis duy nhất và có hướng dẫn keyboard.

### Compact

- **Điểm kích hoạt thất bại:** Compact bắt đầu khi hai task regions đồng thời không còn giữ evidence dễ đọc và control tối thiểu 44×44 CSS px.
- **Đáp ứng topology:** Tái cấu trúc thành một primary-pane sequence theo semantic order; không stack toàn bộ desktop boxes.
- **Thay thế điều hướng:** Dùng sequence có Back để restore selection, filters, state và scroll context.
- **Ranh giới sticky:** Bottom action phải reserve content space, không che focus và yield về normal flow ở short height.
- **Chủ sở hữu overflow:** `directed-process-map` là view tùy chọn; text hoặc list equivalent là primary.

### Reflow

- Semantic order và DOM order là `process-mining` → `case-period-segment-filters` → `directed-process-map` → `variant-frequency-list` → `duration-and-bottleneck-evidence` → `selected-variant-trace`.
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
| Khởi tạo / loading | `case-period-segment-filters` | Nêu scope và region đang chờ; giữ trước semantic position. |
| Sẵn sàng | `directed-process-map` | Trình bày đầy đủ dominant task và các association bắt buộc. |
| Rỗng / không áp dụng | `variant-frequency-list` | Phân biệt sự vắng mặt có nghĩa với evidence không khả dụng. |
| Lỗi / thử lại | `duration-and-bottleneck-evidence` | Giữ context còn hợp lệ và cung cấp retry cục bộ mà không reset selection. |
| Quyền / không khả dụng | `selected-variant-trace` | Không suy diễn hidden evidence là absent; cung cấp safe exit hoặc alternate route. |
| Đang chờ | `selected-variant-trace` | Chặn action lặp, giữ exact target và announce tiến độ mà không chuyển focus. |
| Thành công | `selected-variant-trace` | Hiển thị outcome, giữ selected context và cung cấp next valid action. |
| Cũ / xung đột | `case-period-segment-filters` | Giữ last safe value, nêu version hoặc time conflict và yêu cầu recovery rõ. |
| Chuyển focus | `selected-variant-trace` | Chỉ đưa focus vào modal hoặc error summary bắt buộc rồi trả về exact trigger. |
| Trình bày responsive | `process-mining` | Giữ state, selection, query và recovery khi topology đổi. |

Các state đặc thù của dominant task phải được Grammar đặt tên đúng nghĩa nhưng không được xóa các family bắt buộc trên.

## Ranh giới

### Chấp nhận

- Chấp nhận khi dominant task khớp chính xác câu trong bảng Identity.
- Chấp nhận khi toàn bộ required region graph cùng giữ một selection context.
- Chấp nhận khi compact giữ task, state, action và recovery parity.

### Từ chối

- Từ chối khi dominant task là fixed linear funnel; đây là evidence `AR-PV-90` và phải route sang adjacent archetype.
- Từ chối khi dominant task là editable workflow builder; đây là evidence `AR-PV-91` và phải route sang adjacent archetype.
- Từ chối khi dominant task là dependency health graph; đây là evidence `AR-PV-92` và phải route sang adjacent archetype.
- Từ chối khi dominant task là retrospective single-case audit timeline; đây là evidence `AR-PV-93` và phải route sang adjacent archetype.

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
| [Microsoft Power Automate — Visualize and gain insights from processes](https://learn.microsoft.com/en-us/power-automate/process-mining-visualize) | Hỗ trợ process variants, frequency, duration, loops, bottlenecks và synchronized filtering. | Không chọn archetype này, không định nghĩa product truth và không cho phép copy geometry. |
| [IBM Carbon — 2x Grid](https://carbondesignsystem.com/elements/2x-grid/overview/) | Hỗ trợ adaptive screen regions, fluid structures và content-driven layout integrity. | Không chọn archetype này, không định nghĩa product truth và không cho phép copy geometry. |
| [Microsoft Fluent 2 — Layout](https://fluent2.microsoft.design/layout) | Hỗ trợ adaptive panes, readable content regions và layout relationships theo available space. | Không chọn archetype này, không định nghĩa product truth và không cho phép copy geometry. |
| [W3C WAI — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Hỗ trợ reflow không có page-level two-dimensional scrolling và bounded exceptions. | Không chọn archetype này, không định nghĩa product truth và không cho phép copy geometry. |

| [W3C WAI — ARIA Authoring Practices patterns](https://www.w3.org/WAI/ARIA/apg/patterns/) | Hỗ trợ keyboard-complete composite interaction, state exposure và predictable focus movement. | Không chọn archetype này, không định nghĩa product truth và không cho phép copy geometry. |
| [W3C WAI — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Hỗ trợ announce live, pending, success, failure và reconnect change mà không chuyển focus. | Không chọn archetype này, không định nghĩa product truth và không cho phép copy geometry. |

Tập nguồn đại diện cho ít nhất ba tổ chức chính thức độc lập và có accessibility evidence từ W3C.

## Đầu ra

```json
{
  "archetypeId": "process-variant-mining-overview",
  "situationCodes": ["<matched AR-PV-* codes>"],
  "searchAliases": ["process mining","variant frequency map","actual path analysis","process bottlenecks"],
  "dominantTask": "Khám phá các process path thực tế từ event evidence và tìm loops, deviations, bottlenecks thay vì giả định funnel tuyến tính.",
  "regions": ["process-mining","case-period-segment-filters","directed-process-map","variant-frequency-list","duration-and-bottleneck-evidence","selected-variant-trace"],
  "regionRelationships": ["process-mining precedes case-period-segment-filters precedes directed-process-map precedes variant-frequency-list precedes duration-and-bottleneck-evidence precedes selected-variant-trace"],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named supporting-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "process-mining → case-period-segment-filters → directed-process-map → variant-frequency-list → duration-and-bottleneck-evidence → selected-variant-trace",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "directed-process-map",
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

