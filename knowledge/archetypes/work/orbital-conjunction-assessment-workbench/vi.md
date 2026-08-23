# Workbench đánh giá conjunction quỹ đạo

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `orbital-conjunction-assessment-workbench` |
| Family | Work |
| Dominant task | Đánh giá encounter quỹ đạo dự đoán và chọn mitigation bằng hình học tương đối, uncertainty, risk trend và bằng chứng rescreen maneuver. |
| Search aliases | `orbital encounter assessment`, `covariance risk trend`, `maneuver rescreen`, `conjunction disposition` |
| Authority | Macro topology dùng chung, product-neutral. |

### Bất biến

- Dominant task luôn là: Đánh giá encounter quỹ đạo dự đoán và chọn mitigation bằng hình học tương đối, uncertainty, risk trend và bằng chứng rescreen maneuver.
- Required region graph luôn là `conjunction-assessment → event-queue → selected-event → relative-orbit-projection ↔ encounter-plane-covariance ↔ probability-and-risk-trend → maneuver-candidates → mandatory-rescreen-comparison → disposition-ledger`.
- Mọi state và action gắn với một selected context cùng provenance của nó.
- DOM order, reading order và meaningful focus order luôn trùng nhau.
- Grammar sở hữu product semantics; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Wide, intermediate và compact giữ nguyên action, state, keyboard access, overflow ownership và recovery.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-OC-01` | Dominant task đã nêu là outcome chính của người dùng. | Candidate evidence. |
| `AR-OC-02` | Mọi required region và named relationship đều hiện diện. | Required evidence. |
| `AR-OC-03` | Wide, intermediate và compact dùng đúng topology transformation đã khai báo. | Required evidence. |
| `AR-OC-04` | Compact giữ mọi action, state, keyboard path, focus return và recovery. | Required evidence. |
| `AR-OC-05` | Template must select an event, connect tabular and visual uncertainty evidence, compare pre/post-maneuver risk, block disposition before rescreen and offer a text equivalent for every projection. | Required evidence. |
| `AR-OC-90` | map-led monitor | Từ chối. |
| `AR-OC-91` | scenario sensitivity modeler | Từ chối. |
| `AR-OC-92` | generic risk dashboard | Từ chối. |
| `AR-OC-93` | 3D viewer | Từ chối. |

### Quy tắc chọn

Chỉ chọn `orbital-conjunction-assessment-workbench` khi `AR-OC-01` đến `AR-OC-05` đều có evidence và không có mã `AR-OC-9*`. Trả `needs-evidence` khi owner hoặc relationship bắt buộc chưa rõ. Trả `reject` khi có rejection code. Khác biệt chỉ ở noun, density, color, card count, component hoặc state là `duplicate-or-variation`.

## Sơ đồ vùng

```text
conjunction-assessment
   `-- event-queue
      `-- selected-event
         `-- relative-orbit-projection
            `-- encounter-plane-covariance
               `-- probability-and-risk-trend
                  `-- maneuver-candidates
                     `-- mandatory-rescreen-comparison
                        `-- disposition-ledger
```

Biểu thức relationship đã khai báo: `conjunction-assessment → event-queue → selected-event → relative-orbit-projection ↔ encounter-plane-covariance ↔ probability-and-risk-trend → maneuver-candidates → mandatory-rescreen-comparison → disposition-ledger`.

### Nghĩa vụ vùng

| Vùng | Owner | Relationship |
|---|---|---|
| `conjunction-assessment` | Sở hữu dominant task hoàn chỉnh, version context và recovery của mọi descendant. | Là root của graph bắt buộc; không được thay bằng generic container. |
| `event-queue` | Sở hữu evidence, action, state và recovery của event queue. | Theo sau `conjunction-assessment` trong semantic order và dùng đúng selected context của vùng đó. |
| `selected-event` | Sở hữu evidence, action, state và recovery của selected event. | Theo sau `event-queue` trong semantic order và dùng đúng selected context của vùng đó. |
| `relative-orbit-projection` | Sở hữu evidence, action, state và recovery của relative orbit projection. | Đồng bộ hai chiều với `selected-event` trong cùng selected context. |
| `encounter-plane-covariance` | Sở hữu evidence, action, state và recovery của encounter plane covariance. | Đồng bộ hai chiều với `relative-orbit-projection` trong cùng selected context. |
| `probability-and-risk-trend` | Sở hữu evidence, action, state và recovery của probability and risk trend. | Đồng bộ hai chiều với `encounter-plane-covariance` trong cùng selected context. |
| `maneuver-candidates` | Sở hữu evidence, action, state và recovery của maneuver candidates. | Theo sau `probability-and-risk-trend` trong semantic order và dùng đúng selected context của vùng đó. |
| `mandatory-rescreen-comparison` | Sở hữu evidence, action, state và recovery của mandatory rescreen comparison. | Theo sau `maneuver-candidates` trong semantic order và dùng đúng selected context của vùng đó. |
| `disposition-ledger` | Sở hữu evidence, action, state và recovery của disposition ledger. | Theo sau `mandatory-rescreen-comparison` trong semantic order và dùng đúng selected context của vùng đó. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Wide kết thúc khi các vùng đồng thời không còn giữ label dễ đọc, association chính xác, action nhìn thấy và focus không bị che.
- **Topology response:** Giữ đồng thời đúng các owner được contract nêu: Event queue, orbit projection, encounter plane, risk trend and maneuver comparison remain linked.
- **Navigation replacement:** Không có khi mọi required owner vẫn dùng đồng thời được.
- **Sticky boundary:** Chỉ outcome hoặc action hiện tại được persist; nó reserve space và yield khi viewport thấp.
- **Overflow owner:** Chỉ `relative-orbit-projection` được sở hữu bounded horizontal overflow; nội dung thường không tạo page-level horizontal scroll.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi persistent region ít ưu tiên nhất làm hỏng dominant cross-region relationship.
- **Topology response:** Chuyển đúng theo contract: Encounter plane and risk trend remain primary; orbit becomes on-demand and candidates move to a drawer.
- **Navigation replacement:** Named synchronized drawer, disclosure hoặc pane thay mỗi persistent region bị dời và trigger hiển thị state hiện tại.
- **Sticky boundary:** Persistent action chỉ tồn tại khi exact target nhìn thấy và trở lại in-flow khi viewport thấp.
- **Overflow owner:** `relative-orbit-projection` giữ bounded overflow axis duy nhất và có text/list equivalent.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai task owner đồng thời không thể giữ evidence dễ đọc và control 44-by-44 CSS pixel.
- **Topology response:** Tái cấu trúc theo primary sequence: Event dossier → risk facts/trend → tabular geometry/covariance → maneuver cards → rescreen comparison → disposition; no miniature 3D view is required.
- **Navigation replacement:** Dùng một primary-pane sequence với Previous và Next rõ ràng, khôi phục selection, query, state và scroll context.
- **Sticky boundary:** Current action reserve content space, không che focus và trở lại normal flow khi viewport thấp.
- **Overflow owner:** Text hoặc relation ledger là primary; `relative-orbit-projection` chỉ là optional bounded region.

### Reflow

- Semantic và DOM order là `conjunction-assessment → event-queue → selected-event → relative-orbit-projection → encounter-plane-covariance → probability-and-risk-trend → maneuver-candidates → mandatory-rescreen-comparison → disposition-ledger`.
- Text zoom, translation dài và control phóng to kích hoạt cùng named topology change.
- CSS không reorder visual content lệch khỏi keyboard hoặc assistive-technology order.
- Label và identifier dài được wrap; detail ẩn có accessible reveal rõ ràng.
- Nội dung thường không tạo page-level horizontal scroll.

### Ngang bằng tương tác

- Mọi selection, edit, action, explanation, retry và recovery ở wide vẫn reachable tại intermediate và compact.
- Topology change giữ selected entity, version, filter, pending state, validation result và recovery point.
- Dynamic update dùng một contextual status message mà không di chuyển focus.
- Modal nhận và giữ focus, hỗ trợ Escape hoặc Cancel, rồi trả focus về đúng trigger.
- Drag, drawing, fader, spatial hoặc point movement có parity bằng button, numeric hoặc list.
- Color, position, geometry và motion luôn có text hoặc structural equivalent.

## Nghĩa vụ trạng thái

| State | Vùng sở hữu | Nghĩa vụ |
|---|---|---|
| Khởi đầu / loading | `event-queue` | Xác định scope đang chờ và giữ semantic position. |
| Ready | `selected-event` | Hiển thị dominant task hoàn chỉnh và version hiện tại. |
| Empty / không áp dụng | `relative-orbit-projection` | Phân biệt absence có nghĩa với evidence unavailable. |
| Lỗi / retry | `encounter-plane-covariance` | Giữ context hợp lệ và cung cấp retry cục bộ mà không reset selection. |
| Permission / unavailable | `mandatory-rescreen-comparison` | Không suy diễn evidence bị hạn chế là không tồn tại; cung cấp alternate route an toàn. |
| Pending | `disposition-ledger` | Ngăn action trùng và announce tiến độ mà không di chuyển focus. |
| Success | `disposition-ledger` | Hiển thị outcome, provenance và action hợp lệ kế tiếp. |
| Stale / conflict | `event-queue` | Giữ giá trị an toàn cuối cùng và yêu cầu reconciliation rõ ràng. |
| Chuyển focus | `disposition-ledger` | Chỉ đưa focus tới error summary bắt buộc hoặc modal vừa mở, rồi trả về đúng trigger. |
| Trình bày responsive | `conjunction-assessment` | Giữ selected entity, query, state và recovery khi topology đổi. |
| event loading/stale | `event-queue` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| covariance missing/low-confidence | `selected-event` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| risk below/above threshold | `relative-orbit-projection` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| trajectory update | `encounter-plane-covariance` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| candidate infeasible | `probability-and-risk-trend` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| rescreen pending/failure | `maneuver-candidates` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| collision risk reduced/increased and decision approved/escalated. | `mandatory-rescreen-comparison` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |

## Ranh giới

### Chấp nhận

- Chỉ accept khi dominant task chuyển required evidence thành outcome đã khai báo.
- Chỉ accept khi mỗi required region có owner độc lập và named relationship vẫn explicit.
- Chỉ accept khi template must select an event, connect tabular and visual uncertainty evidence, compare pre/post-maneuver risk, block disposition before rescreen and offer a text equivalent for every projection.

### Từ chối

- Từ chối map-led monitor; đây là evidence `AR-OC-90` và phải route sang archetype khác.
- Từ chối scenario sensitivity modeler; đây là evidence `AR-OC-91` và phải route sang archetype khác.
- Từ chối generic risk dashboard; đây là evidence `AR-OC-92` và phải route sang archetype khác.
- Từ chối 3D viewer; đây là evidence `AR-OC-93` và phải route sang archetype khác.
- Từ chối candidate chỉ thỏa task bằng cách đổi product noun hoặc visual treatment.

### Phán quyết ranh giới

Trả `accept` chỉ khi dominant task, complete required graph, transformation contract, state/recovery parity và `AR-OC-05` đều giữ. Trả `reject` cho rejection code. Trả `needs-evidence` khi owner hoặc relationship chưa resolve. Báo `duplicate-or-variation` cho khác biệt chỉ ở noun, density, color, card count, component hoặc state.

## Bàn giao

- **Grammar handoff:** Bind product-specific owner, label, permission, truthful state meaning và permitted action vào declared regions.
- **Principles handoff:** Resolve exact grid, measure, gap, alignment, sticky offset, bounded overflow realization và relationship-driven transition points.
- Hai handoff không được xóa required region, thay dominant task hoặc làm yếu keyboard, focus, responsive hay recovery parity.

## Bằng chứng nghiên cứu không ràng buộc

### Ranh giới bằng chứng

Research bên ngoài là advisory evidence, không phải product truth. Nó hỗ trợ synthesis của task relationship, responsive transformation, interaction và accessibility obligation. Nó không đặt tên StarCi owner, chọn exact geometry, tạo product fact hoặc cấp quyền copy source interface.

### Nguồn

| Nguồn | Hỗ trợ điều gì | Không chứng minh điều gì |
|---|---|---|
| [NASA CARA — Training Materials](https://www.nasa.gov/cara/training-materials-and-documentation/) | Hỗ trợ conjunction assessment, risk, and mitigation evidence. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |
| [ESA — Collision Avoidance](https://www.esa.int/Space_Safety/Space_Debris/Reentry_and_collision_avoidance) | Hỗ trợ collision avoidance workflow and maneuver assessment. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |
| [CCSDS — Conjunction Data Message](https://ccsds.org/Pubs/508x0b1e2c2.pdf) | Hỗ trợ encounter data and covariance exchange. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |
| [W3C WAI — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Hỗ trợ bounded complex projections and text reflow. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |

Source set gồm tài liệu official hiện hành từ ít nhất ba tổ chức độc lập và có W3C accessibility evidence.

## Đầu ra

```json
{
  "archetypeId": "orbital-conjunction-assessment-workbench",
  "situationCodes": [
    "<matched AR-OC-* codes>"
  ],
  "searchAliases": [
    "orbital encounter assessment",
    "covariance risk trend",
    "maneuver rescreen",
    "conjunction disposition"
  ],
  "dominantTask": "Assess a predicted orbital encounter and choose a mitigation using relative geometry, uncertainty, risk trend and rescreened maneuver evidence.",
  "regions": [
    "conjunction-assessment",
    "event-queue",
    "selected-event",
    "relative-orbit-projection",
    "encounter-plane-covariance",
    "probability-and-risk-trend",
    "maneuver-candidates",
    "mandatory-rescreen-comparison",
    "disposition-ledger"
  ],
  "regionRelationships": [
    "conjunction-assessment → event-queue → selected-event → relative-orbit-projection ↔ encounter-plane-covariance ↔ probability-and-risk-trend → maneuver-candidates → mandatory-rescreen-comparison → disposition-ledger"
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<named synchronized panes or drawers>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "conjunction-assessment → event-queue → selected-event → relative-orbit-projection → encounter-plane-covariance → probability-and-risk-trend → maneuver-candidates → mandatory-rescreen-comparison → disposition-ledger",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "relative-orbit-projection",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": [
    "event loading/stale",
    "covariance missing/low-confidence",
    "risk below/above threshold",
    "trajectory update",
    "candidate infeasible",
    "rescreen pending/failure",
    "collision risk reduced/increased and decision approved/escalated."
  ],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": [
    "<product meaning and semantic owners>"
  ],
  "principlesHandoff": [
    "<unresolved geometry only>"
  ],
  "confidence": "<high | medium | low>",
  "evidence": [
    "<business or current-source facts>",
    "<official task research>",
    "<accessibility research>"
  ]
}
```

