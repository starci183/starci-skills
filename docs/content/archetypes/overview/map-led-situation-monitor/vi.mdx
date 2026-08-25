# Bộ giám sát tình huống dẫn dắt bằng bản đồ

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `map-led-situation-monitor` |
| Nhóm | Overview |
| Tác vụ chi phối | Giám sát trạng thái phân bố theo địa lý, dùng impact geometry để đổi ưu tiên alert và bind response command đủ điều kiện vào đúng khu vực bị ảnh hưởng. |
| Bí danh tìm kiếm | `geospatial situation monitor`, `hotspot response map`, `area impact monitor`, `map operations` |
| Thẩm quyền | Topology macro dùng chung, trung lập sản phẩm. |

### Bất biến

- Region graph phải giữ nguyên `situation-monitor` → `scope-time-severity` → `geographic-health-map` → `impact-area-model` → `alert-priority-queue` → `selected-area-evidence` → `response-command-surface` → `command-feedback`.
- Alert priority, impact geometry và response command là ba owner độc lập dùng chung selection.
- Impact area đã chọn phải suy ra exact command target và eligibility; generic incident identifier là không đủ.
- Mỗi region phải giữ owner, state và association với selection hiện tại.
- DOM order, reading order và meaningful focus order phải giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu geometry còn chưa resolve; Direction sở hữu visual character.
- Loading, ready, empty, error, unavailable, pending, success và stale/conflict phải giữ dominant task.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-MM-01` | Dominant task đúng là: Giám sát trạng thái phân bố theo địa lý, dùng impact geometry để đổi ưu tiên alert và bind response command đủ điều kiện vào đúng khu vực bị ảnh hưởng. | Bằng chứng ứng viên. |
| `AR-MM-02` | Toàn bộ region graph bắt buộc phải cùng hiện diện về mặt semantics. | Bằng chứng bắt buộc. |
| `AR-MM-03` | Compact phải giữ selection, action, state và recovery của wide. | Bằng chứng bắt buộc. |
| `AR-MM-04` | Mỗi region có owner riêng và giữ association với selection hiện tại. | Giữ như bất biến. |
| `AR-MM-90` | Dominant task thuộc ranh giới loại trừ: place discovery hoặc choice. | Từ chối. |
| `AR-MM-91` | Dominant task thuộc ranh giới loại trừ: route planning. | Từ chối. |
| `AR-MM-92` | Dominant task thuộc ranh giới loại trừ: asset dispatch editing. | Từ chối. |
| `AR-MM-93` | Dominant task thuộc ranh giới loại trừ: decorative map có thể bỏ mà task không đổi. | Từ chối. |
| `AR-MM-94` | Dominant task là generic live operations command center nơi geography không sở hữu alert grouping, impact boundary hoặc command eligibility. | Từ chối. |

### Quy tắc chọn

Chỉ chọn `map-led-situation-monitor` khi `AR-MM-01`, `AR-MM-02` và `AR-MM-03` có bằng chứng, impact geometry làm thay đổi alert priority hoặc command eligibility, đồng thời không mã nào từ `AR-MM-90` đến `AR-MM-94` mô tả dominant task. Trả `needs-evidence` khi thiếu một quan hệ bắt buộc. Trả `reject` khi có rejection evidence thay vì thích nghi topology theo vẻ ngoài.

## Sơ đồ vùng

```text
situation-monitor
└─ scope-time-severity
   ├─ geographic-health-map
   │  ↔ impact-area-model
   │     ↔ alert-priority-queue
   └─ selected-area-evidence
      └─ response-command-surface
         └─ command-feedback
```

### Nghĩa vụ vùng

| Vùng | Chủ sở hữu | Quan hệ |
|---|---|---|
| `situation-monitor` | Sở hữu dominant task cấp trang và trạng thái của toàn graph. | Là gốc của graph. |
| `scope-time-severity` | Sở hữu evidence hoặc action của scope time severity mà không vay product semantics. | Theo sau `situation-monitor` trong semantic order và giữ cùng selection context. |
| `geographic-health-map` | Sở hữu spatial status và affected-area geometry có thể chọn. | Đồng bộ area selection với `impact-area-model` nhưng không sở hữu alert priority hoặc command eligibility. |
| `impact-area-model` | Sở hữu selected boundary, containment, overlap và giải thích affected set. | Biến map geometry thành area evidence mà `alert-priority-queue` và `response-command-surface` tiêu thụ. |
| `alert-priority-queue` | Sở hữu alert ordering và lý do geometry thay đổi thứ tự đó. | Đồng bộ selection hai chiều với impact area nhưng vẫn độc lập với command owner. |
| `selected-area-evidence` | Sở hữu textual evidence cho selected boundary và affected set. | Giữ một verification path không phụ thuộc map trước commitment. |
| `response-command-surface` | Sở hữu exact area-derived command target, eligibility, review và điểm vào confirmation. | Tiêu thụ selected impact area thay vì generic incident identifier. |
| `command-feedback` | Sở hữu confirming, pending, success, failure, conflict và reconnect outcome. | Giữ exact area, command target và queue context trước đó qua recovery. |

## Hợp đồng responsive

### Wide

- **Điểm kích hoạt thất bại:** Wide kết thúc khi các region đồng thời không còn giữ được label dễ đọc, association chính xác và action đầy đủ.
- **Đáp ứng topology:** Giữ đồng thời các region bắt buộc từ `geographic-health-map` đến `command-feedback` khi mỗi region còn đủ measure cho nhiệm vụ.
- **Thay thế điều hướng:** Không thay thế navigation khi toàn bộ region bắt buộc còn usable đồng thời.
- **Ranh giới sticky:** Chỉ active cross-region action được persist; surface phải reserve space và yield khi chiều cao không giữ focus visible.
- **Chủ sở hữu overflow:** `geographic-health-map` là region duy nhất có thể sở hữu bounded horizontal overflow.

### Intermediate

- **Điểm kích hoạt thất bại:** Intermediate bắt đầu khi region hỗ trợ có priority thấp nhất làm hỏng quan hệ chính.
- **Đáp ứng topology:** Giữ region chính và một supporting region usable; chuyển region còn lại thành named drawer hoặc disclosure có state rõ.
- **Thay thế điều hướng:** Dùng control có accessible name để mở region bị thay thế và luôn hiển thị selection hiện tại.
- **Ranh giới sticky:** Action chỉ persist khi exact target và status còn visible; action trở về flow ở short height.
- **Chủ sở hữu overflow:** `geographic-health-map` giữ overflow axis duy nhất và có hướng dẫn keyboard.

### Compact

- **Điểm kích hoạt thất bại:** Compact bắt đầu khi hai task regions đồng thời không còn giữ evidence dễ đọc và control tối thiểu 44×44 CSS px.
- **Đáp ứng topology:** Bắt đầu từ alert queue, đi qua textual impact-area boundary và containment evidence, rồi kết thúc ở exact area-derived response command; map là alternate full-screen verification view.
- **Thay thế điều hướng:** Dùng sequence có Back để restore selection, filters, state và scroll context.
- **Ranh giới sticky:** Bottom action phải reserve content space, không che focus và yield về normal flow ở short height.
- **Chủ sở hữu overflow:** `geographic-health-map` là view tùy chọn; text hoặc list equivalent là primary.

### Reflow

- Semantic order và DOM order là `situation-monitor` → `scope-time-severity` → `geographic-health-map` → `impact-area-model` → `alert-priority-queue` → `selected-area-evidence` → `response-command-surface` → `command-feedback`.
- Zoom, long translation, enlarged control và text pressure kích hoạt cùng topology transformations.
- CSS không được reorder visual sequence khác keyboard hoặc assistive-technology order.
- Long labels phải wrap hoặc có accessible reveal path.
- Ordinary content không tạo page-level horizontal scrolling.

### Ngang bằng tương tác

- Mọi selection, action, explanation, retry và recovery của wide phải reachable ở intermediate và compact.
- Topology change phải giữ queue severity, selected alert, selected impact area, boundary evidence, exact command target, eligibility và pending/completed result.
- Dynamic update phải announce một contextual status message mà không steal focus.
- Modal phải trap focus, hỗ trợ Escape/Cancel và trả focus về exact trigger.
- Color, position và geometry phải có text hoặc structural equivalent.

## Nghĩa vụ trạng thái

| Trạng thái | Vùng sở hữu | Nghĩa vụ |
|---|---|---|
| Khởi tạo / loading | `scope-time-severity` | Nêu scope và region đang chờ; giữ trước semantic position. |
| Sẵn sàng | `geographic-health-map` | Trình bày alert priority, impact geometry và response command như các owner độc lập, đồng thời nêu cách area suy ra exact command target và eligibility. |
| Rỗng / không áp dụng | `impact-area-model` | Phân biệt sự vắng mặt có nghĩa với evidence không khả dụng. |
| Lỗi / thử lại | `alert-priority-queue` | Giữ context còn hợp lệ và cung cấp retry cục bộ mà không reset selection. |
| Quyền / không khả dụng | `command-feedback` | Không suy diễn hidden evidence là absent; cung cấp safe exit hoặc alternate route. |
| Đang chờ | `command-feedback` | Chặn action lặp, giữ exact target và announce tiến độ mà không chuyển focus. |
| Thành công | `command-feedback` | Hiển thị outcome, giữ selected context và cung cấp next valid action. |
| Cũ / xung đột | `scope-time-severity` | Giữ last safe value, nêu version hoặc time conflict và yêu cầu recovery rõ. |
| Chuyển focus | `command-feedback` | Chỉ đưa focus vào modal hoặc error summary bắt buộc rồi trả về exact trigger. |
| Trình bày responsive | `situation-monitor` | Giữ state, selection, query và recovery khi topology đổi. |

Các state đặc thù của dominant task phải được Grammar đặt tên đúng nghĩa nhưng không được xóa các family bắt buộc trên.

## Ranh giới

### Chấp nhận

- Chấp nhận khi geography thay đổi response priority.
- Chấp nhận khi alert bind vào exact impact area.
- Chấp nhận khi impact area suy ra exact command target và eligibility.

### Từ chối

- Từ chối khi dominant task là place discovery hoặc choice; đây là evidence `AR-MM-90` và phải route sang adjacent archetype.
- Từ chối khi dominant task là route planning; đây là evidence `AR-MM-91` và phải route sang adjacent archetype.
- Từ chối khi dominant task là asset dispatch editing; đây là evidence `AR-MM-92` và phải route sang adjacent archetype.
- Từ chối khi dominant task là decorative map có thể bỏ mà task không đổi; đây là evidence `AR-MM-93` và phải route sang adjacent archetype.
- Từ chối generic live operations command center nơi geography không sở hữu alert grouping, impact boundary hoặc command eligibility; đây là evidence `AR-MM-94` và phải route sang adjacent archetype.

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
| [Mapbox — Maps products overview](https://docs.mapbox.com/help/getting-started/maps/) | Hỗ trợ map tương tác, user-data overlay, geographic context và các use case giám sát dẫn dắt bằng map. | Không chọn archetype này, không định nghĩa product truth và không cho phép copy geometry. |
| [IBM Carbon — 2x Grid](https://carbondesignsystem.com/elements/2x-grid/overview/) | Hỗ trợ adaptive screen regions, fluid structures và content-driven layout integrity. | Không chọn archetype này, không định nghĩa product truth và không cho phép copy geometry. |
| [Microsoft Fluent 2 — Layout](https://fluent2.microsoft.design/layout) | Hỗ trợ adaptive panes, readable content regions và layout relationships theo available space. | Không chọn archetype này, không định nghĩa product truth và không cho phép copy geometry. |
| [W3C WAI — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Hỗ trợ reflow không có page-level two-dimensional scrolling và bounded exceptions. | Không chọn archetype này, không định nghĩa product truth và không cho phép copy geometry. |

| [Apple — Layout](https://developer.apple.com/design/human-interface-guidelines/layout) | Hỗ trợ hierarchy, readable regions, adaptation và giữ important content theo available space. | Không chọn archetype này, không định nghĩa product truth và không cho phép copy geometry. |
| [W3C WAI — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Hỗ trợ announce live, pending, success, failure và reconnect change mà không chuyển focus. | Không chọn archetype này, không định nghĩa product truth và không cho phép copy geometry. |
| [OASIS — Common Alerting Protocol 1.2](https://docs.oasis-open.org/emergency/cap/v1.2/CAP-v1.2-os.pdf) | Hỗ trợ liên kết urgency, severity, certainty và polygon hoặc area geometry trong alert model. | Không áp đặt product command, scoring policy hoặc copied map geometry. |

Tập nguồn đại diện cho ít nhất ba tổ chức chính thức độc lập và có accessibility evidence từ W3C.

## Đầu ra

```json
{
  "archetypeId": "map-led-situation-monitor",
  "situationCodes": ["<matched AR-MM-* codes>"],
  "searchAliases": ["geospatial situation monitor","hotspot response map","area impact monitor","map operations"],
  "dominantTask": "Giám sát trạng thái phân bố theo địa lý, dùng impact geometry để đổi ưu tiên alert và bind response command đủ điều kiện vào đúng khu vực bị ảnh hưởng.",
  "regions": ["situation-monitor","scope-time-severity","geographic-health-map","impact-area-model","alert-priority-queue","selected-area-evidence","response-command-surface","command-feedback"],
  "regionRelationships": ["geographic-health-map đồng bộ area selection với impact-area-model", "impact-area-model suy ra alert-priority-queue ordering", "selected-area-evidence xác minh boundary trước khi response-command-surface suy ra target và eligibility", "command-feedback giữ area và command context"],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named supporting-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "situation-monitor → scope-time-severity → geographic-health-map → impact-area-model → alert-priority-queue → selected-area-evidence → response-command-surface → command-feedback",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "geographic-health-map",
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
