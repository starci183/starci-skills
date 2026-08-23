# Bộ giám sát market depth và nhập order

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `market-depth-order-entry-monitor` |
| Nhóm | Overview |
| Tác vụ chi phối | Hiểu price ladder hai phía trực tiếp, depth và recent execution flow trước khi soạn và theo dõi một order có giới hạn. |
| Bí danh tìm kiếm | `order book depth`, `price ladder`, `market depth monitor`, `order entry ladder` |
| Thẩm quyền | Topology macro dùng chung, trung lập sản phẩm. |

### Bất biến

- Region graph phải giữ nguyên `market-monitor` → `instrument-session-context` → `bid-ask-price-ladder` → `depth-visualization` → `recent-trade-tape` → `selected-price-context` → `order-entry-and-risk-summary` → `order-feedback`.
- Mỗi region phải giữ owner, state và association với selection hiện tại.
- DOM order, reading order và meaningful focus order phải giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu geometry còn chưa resolve; Direction sở hữu visual character.
- Loading, ready, empty, error, unavailable, pending, success và stale/conflict phải giữ dominant task.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-MD-01` | Dominant task đúng là: Hiểu price ladder hai phía trực tiếp, depth và recent execution flow trước khi soạn và theo dõi một order có giới hạn. | Bằng chứng ứng viên. |
| `AR-MD-02` | Toàn bộ region graph bắt buộc phải cùng hiện diện về mặt semantics. | Bằng chứng bắt buộc. |
| `AR-MD-03` | Compact phải giữ selection, action, state và recovery của wide. | Bằng chứng bắt buộc. |
| `AR-MD-04` | Mỗi region có owner riêng và giữ association với selection hiện tại. | Giữ như bất biến. |
| `AR-MD-90` | Dominant task thuộc ranh giới loại trừ: product comparison. | Từ chối. |
| `AR-MD-91` | Dominant task thuộc ranh giới loại trừ: operational order collection. | Từ chối. |
| `AR-MD-92` | Dominant task thuộc ranh giới loại trừ: generic live dashboard. | Từ chối. |
| `AR-MD-93` | Dominant task thuộc ranh giới loại trừ: static financial report. | Từ chối. |

### Quy tắc chọn

Chỉ chọn `market-depth-order-entry-monitor` khi `AR-MD-01`, `AR-MD-02` và `AR-MD-03` có bằng chứng, đồng thời không mã nào từ `AR-MD-90` đến `AR-MD-93` mô tả dominant task. Trả `needs-evidence` khi thiếu một quan hệ bắt buộc. Trả `reject` khi có rejection evidence thay vì thích nghi topology theo vẻ ngoài.

## Sơ đồ vùng

```text
market-monitor
└─ instrument-session-context
   └─ bid-ask-price-ladder
      └─ depth-visualization
         └─ recent-trade-tape
            └─ selected-price-context
               └─ order-entry-and-risk-summary
                  └─ order-feedback
```

### Nghĩa vụ vùng

| Vùng | Chủ sở hữu | Quan hệ |
|---|---|---|
| `market-monitor` | Sở hữu dominant task cấp trang và trạng thái của toàn graph. | Là gốc của graph. |
| `instrument-session-context` | Sở hữu evidence hoặc action của instrument session context mà không vay product semantics. | Theo sau `market-monitor` trong semantic order và giữ cùng selection context. |
| `bid-ask-price-ladder` | Sở hữu evidence hoặc action của bid ask price ladder mà không vay product semantics. | Theo sau `instrument-session-context` trong semantic order và giữ cùng selection context. |
| `depth-visualization` | Sở hữu evidence hoặc action của depth visualization mà không vay product semantics. | Theo sau `bid-ask-price-ladder` trong semantic order và giữ cùng selection context. |
| `recent-trade-tape` | Sở hữu evidence hoặc action của recent trade tape mà không vay product semantics. | Theo sau `depth-visualization` trong semantic order và giữ cùng selection context. |
| `selected-price-context` | Sở hữu evidence hoặc action của selected price context mà không vay product semantics. | Theo sau `recent-trade-tape` trong semantic order và giữ cùng selection context. |
| `order-entry-and-risk-summary` | Sở hữu evidence hoặc action của order entry and risk summary mà không vay product semantics. | Theo sau `selected-price-context` trong semantic order và giữ cùng selection context. |
| `order-feedback` | Sở hữu evidence hoặc action của order feedback mà không vay product semantics. | Theo sau `order-entry-and-risk-summary` trong semantic order và giữ cùng selection context. |

## Hợp đồng responsive

### Wide

- **Điểm kích hoạt thất bại:** Wide kết thúc khi các region đồng thời không còn giữ được label dễ đọc, association chính xác và action đầy đủ.
- **Đáp ứng topology:** Giữ đồng thời các region bắt buộc từ `bid-ask-price-ladder` đến `order-feedback` khi mỗi region còn đủ measure cho nhiệm vụ.
- **Thay thế điều hướng:** Không thay thế navigation khi toàn bộ region bắt buộc còn usable đồng thời.
- **Ranh giới sticky:** Chỉ active cross-region action được persist; surface phải reserve space và yield khi chiều cao không giữ focus visible.
- **Chủ sở hữu overflow:** `bid-ask-price-ladder` là region duy nhất có thể sở hữu bounded horizontal overflow.

### Intermediate

- **Điểm kích hoạt thất bại:** Intermediate bắt đầu khi region hỗ trợ có priority thấp nhất làm hỏng quan hệ chính.
- **Đáp ứng topology:** Giữ region chính và một supporting region usable; chuyển region còn lại thành named drawer hoặc disclosure có state rõ.
- **Thay thế điều hướng:** Dùng control có accessible name để mở region bị thay thế và luôn hiển thị selection hiện tại.
- **Ranh giới sticky:** Action chỉ persist khi exact target và status còn visible; action trở về flow ở short height.
- **Chủ sở hữu overflow:** `bid-ask-price-ladder` giữ overflow axis duy nhất và có hướng dẫn keyboard.

### Compact

- **Điểm kích hoạt thất bại:** Compact bắt đầu khi hai task regions đồng thời không còn giữ evidence dễ đọc và control tối thiểu 44×44 CSS px.
- **Đáp ứng topology:** Tái cấu trúc thành một primary-pane sequence theo semantic order; không stack toàn bộ desktop boxes.
- **Thay thế điều hướng:** Dùng sequence có Back để restore selection, filters, state và scroll context.
- **Ranh giới sticky:** Bottom action phải reserve content space, không che focus và yield về normal flow ở short height.
- **Chủ sở hữu overflow:** `bid-ask-price-ladder` là view tùy chọn; text hoặc list equivalent là primary.

### Reflow

- Semantic order và DOM order là `market-monitor` → `instrument-session-context` → `bid-ask-price-ladder` → `depth-visualization` → `recent-trade-tape` → `selected-price-context` → `order-entry-and-risk-summary` → `order-feedback`.
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
| Khởi tạo / loading | `instrument-session-context` | Nêu scope và region đang chờ; giữ trước semantic position. |
| Sẵn sàng | `bid-ask-price-ladder` | Trình bày đầy đủ dominant task và các association bắt buộc. |
| Rỗng / không áp dụng | `depth-visualization` | Phân biệt sự vắng mặt có nghĩa với evidence không khả dụng. |
| Lỗi / thử lại | `recent-trade-tape` | Giữ context còn hợp lệ và cung cấp retry cục bộ mà không reset selection. |
| Quyền / không khả dụng | `order-feedback` | Không suy diễn hidden evidence là absent; cung cấp safe exit hoặc alternate route. |
| Đang chờ | `order-feedback` | Chặn action lặp, giữ exact target và announce tiến độ mà không chuyển focus. |
| Thành công | `order-feedback` | Hiển thị outcome, giữ selected context và cung cấp next valid action. |
| Cũ / xung đột | `instrument-session-context` | Giữ last safe value, nêu version hoặc time conflict và yêu cầu recovery rõ. |
| Chuyển focus | `order-feedback` | Chỉ đưa focus vào modal hoặc error summary bắt buộc rồi trả về exact trigger. |
| Trình bày responsive | `market-monitor` | Giữ state, selection, query và recovery khi topology đổi. |

Các state đặc thù của dominant task phải được Grammar đặt tên đúng nghĩa nhưng không được xóa các family bắt buộc trên.

## Ranh giới

### Chấp nhận

- Chấp nhận khi dominant task khớp chính xác câu trong bảng Identity.
- Chấp nhận khi toàn bộ required region graph cùng giữ một selection context.
- Chấp nhận khi compact giữ task, state, action và recovery parity.

### Từ chối

- Từ chối khi dominant task là product comparison; đây là evidence `AR-MD-90` và phải route sang adjacent archetype.
- Từ chối khi dominant task là operational order collection; đây là evidence `AR-MD-91` và phải route sang adjacent archetype.
- Từ chối khi dominant task là generic live dashboard; đây là evidence `AR-MD-92` và phải route sang adjacent archetype.
- Từ chối khi dominant task là static financial report; đây là evidence `AR-MD-93` và phải route sang adjacent archetype.

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
| [Nasdaq — TotalView](https://www.nasdaq.com/solutions/data/equities/nasdaq-totalview/whitepaper) | Hỗ trợ full depth-of-book bids/asks, quotes, executions và supply-demand context. | Không chọn archetype này, không định nghĩa product truth và không cho phép copy geometry. |
| [IBM Carbon — 2x Grid](https://carbondesignsystem.com/elements/2x-grid/overview/) | Hỗ trợ adaptive screen regions, fluid structures và content-driven layout integrity. | Không chọn archetype này, không định nghĩa product truth và không cho phép copy geometry. |
| [Microsoft Fluent 2 — Layout](https://fluent2.microsoft.design/layout) | Hỗ trợ adaptive panes, readable content regions và layout relationships theo available space. | Không chọn archetype này, không định nghĩa product truth và không cho phép copy geometry. |
| [W3C WAI — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Hỗ trợ reflow không có page-level two-dimensional scrolling và bounded exceptions. | Không chọn archetype này, không định nghĩa product truth và không cho phép copy geometry. |

| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Hỗ trợ row-column association rõ, selection, dense comparison và bounded table overflow. | Không chọn archetype này, không định nghĩa product truth và không cho phép copy geometry. |
| [W3C WAI — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Hỗ trợ announce live, pending, success, failure và reconnect change mà không chuyển focus. | Không chọn archetype này, không định nghĩa product truth và không cho phép copy geometry. |
| [W3C WAI — Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) | Hỗ trợ reserve space cho sticky action và yield overlay để keyboard focus còn visible. | Không chọn archetype này, không định nghĩa product truth và không cho phép copy geometry. |

Tập nguồn đại diện cho ít nhất ba tổ chức chính thức độc lập và có accessibility evidence từ W3C.

## Đầu ra

```json
{
  "archetypeId": "market-depth-order-entry-monitor",
  "situationCodes": ["<matched AR-MD-* codes>"],
  "searchAliases": ["order book depth","price ladder","market depth monitor","order entry ladder"],
  "dominantTask": "Hiểu price ladder hai phía trực tiếp, depth và recent execution flow trước khi soạn và theo dõi một order có giới hạn.",
  "regions": ["market-monitor","instrument-session-context","bid-ask-price-ladder","depth-visualization","recent-trade-tape","selected-price-context","order-entry-and-risk-summary","order-feedback"],
  "regionRelationships": ["market-monitor precedes instrument-session-context precedes bid-ask-price-ladder precedes depth-visualization precedes recent-trade-tape precedes selected-price-context precedes order-entry-and-risk-summary precedes order-feedback"],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named supporting-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "market-monitor → instrument-session-context → bid-ask-price-ladder → depth-visualization → recent-trade-tape → selected-price-context → order-entry-and-risk-summary → order-feedback",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "bid-ask-price-ladder",
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

