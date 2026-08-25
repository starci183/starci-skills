# Workbench release flight dispatch

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `flight-dispatch-release-workbench` |
| Family | Flow |
| Dominant task | Chuẩn bị hoặc amend regulated flight release bằng cách reconcile route, weather/NOTAM, aircraft performance, crew, fuel và alternate rồi lấy concurrence của dispatcher và PIC. |
| Search aliases | `flight dispatch release`, `dispatcher PIC concurrence`, `fuel alternate legality`, `release amendment` |
| Authority | Macro topology dùng chung, product-neutral. |

### Bất biến

- Dominant task luôn là: Chuẩn bị hoặc amend regulated flight release bằng cách reconcile route, weather/NOTAM, aircraft performance, crew, fuel và alternate rồi lấy concurrence của dispatcher và PIC.
- Required region graph luôn là `release-workbench → flight-identity-and-operating-window → route-and-leg-plan ↔ weather-NOTAM-hazard-overlay → aircraft-performance-and-fuel-alternate-ledger → MEL-deferment-and-legality-impact → release-validity-gate → dispatcher-concurrence ↔ pilot-in-command-concurrence → issued-release-and-amendment-lineage`.
- Mọi state và action gắn với một selected context cùng provenance của nó.
- DOM order, reading order và meaningful focus order luôn trùng nhau.
- Grammar sở hữu product semantics; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Wide, intermediate và compact giữ nguyên action, state, keyboard access, overflow ownership và recovery.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-FD-01` | Dominant task đã nêu là outcome chính của người dùng. | Candidate evidence. |
| `AR-FD-02` | Mọi required region và named relationship đều hiện diện. | Required evidence. |
| `AR-FD-03` | Wide, intermediate và compact dùng đúng topology transformation đã khai báo. | Required evidence. |
| `AR-FD-04` | Compact giữ mọi action, state, keyboard path, focus return và recovery. | Required evidence. |
| `AR-FD-05` | Template must make one weather, MEL or fuel change invalidate the release, select a viable alternate, require both independent concurrences, issue a superseding amendment and retain exact release context across every responsive topology. | Required evidence. |
| `AR-FD-90` | route itinerary | Từ chối. |
| `AR-FD-91` | estimate calculator | Từ chối. |
| `AR-FD-92` | evidence dossier | Từ chối. |
| `AR-FD-93` | permit-to-work | Từ chối. |

### Quy tắc chọn

Chỉ chọn `flight-dispatch-release-workbench` khi `AR-FD-01` đến `AR-FD-05` đều có evidence và không có mã `AR-FD-9*`. Trả `needs-evidence` khi owner hoặc relationship bắt buộc chưa rõ. Trả `reject` khi có rejection code. Khác biệt chỉ ở noun, density, color, card count, component hoặc state là `duplicate-or-variation`.

## Sơ đồ vùng

```text
release-workbench
   `-- flight-identity-and-operating-window
      `-- route-and-leg-plan
         `-- weather-
            `-- hazard-overlay
               `-- aircraft-performance-and-fuel-alternate-ledger
                  `-- deferment-and-legality-impact
                     `-- release-validity-gate
                        `-- dispatcher-concurrence
                           `-- pilot-in-command-concurrence
                              `-- issued-release-and-amendment-lineage
```

Biểu thức relationship đã khai báo: `release-workbench → flight-identity-and-operating-window → route-and-leg-plan ↔ weather-NOTAM-hazard-overlay → aircraft-performance-and-fuel-alternate-ledger → MEL-deferment-and-legality-impact → release-validity-gate → dispatcher-concurrence ↔ pilot-in-command-concurrence → issued-release-and-amendment-lineage`.

### Nghĩa vụ vùng

| Vùng | Owner | Relationship |
|---|---|---|
| `release-workbench` | Sở hữu dominant task hoàn chỉnh, version context và recovery của mọi descendant. | Là root của graph bắt buộc; không được thay bằng generic container. |
| `flight-identity-and-operating-window` | Sở hữu evidence, action, state và recovery của flight identity and operating window. | Theo sau `release-workbench` trong semantic order và dùng đúng selected context của vùng đó. |
| `route-and-leg-plan` | Sở hữu evidence, action, state và recovery của route and leg plan. | Đồng bộ hai chiều với `flight-identity-and-operating-window` trong cùng selected context. |
| `weather-` | Sở hữu evidence, action, state và recovery của weather . | Đồng bộ hai chiều với `route-and-leg-plan` trong cùng selected context. |
| `hazard-overlay` | Sở hữu evidence, action, state và recovery của hazard overlay. | Theo sau `weather-` trong semantic order và dùng đúng selected context của vùng đó. |
| `aircraft-performance-and-fuel-alternate-ledger` | Sở hữu evidence, action, state và recovery của aircraft performance and fuel alternate ledger. | Theo sau `hazard-overlay` trong semantic order và dùng đúng selected context của vùng đó. |
| `deferment-and-legality-impact` | Sở hữu evidence, action, state và recovery của deferment and legality impact. | Theo sau `aircraft-performance-and-fuel-alternate-ledger` trong semantic order và dùng đúng selected context của vùng đó. |
| `release-validity-gate` | Sở hữu evidence, action, state và recovery của release validity gate. | Theo sau `deferment-and-legality-impact` trong semantic order và dùng đúng selected context của vùng đó. |
| `dispatcher-concurrence` | Sở hữu evidence, action, state và recovery của dispatcher concurrence. | Đồng bộ hai chiều với `release-validity-gate` trong cùng selected context. |
| `pilot-in-command-concurrence` | Sở hữu evidence, action, state và recovery của pilot in command concurrence. | Đồng bộ hai chiều với `dispatcher-concurrence` trong cùng selected context. |
| `issued-release-and-amendment-lineage` | Sở hữu evidence, action, state và recovery của issued release and amendment lineage. | Theo sau `pilot-in-command-concurrence` trong semantic order và dùng đúng selected context của vùng đó. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Wide kết thúc khi các vùng đồng thời không còn giữ label dễ đọc, association chính xác, action nhìn thấy và focus không bị che.
- **Topology response:** Giữ đồng thời đúng các owner được contract nêu: Route/hazard strip, performance/fuel/alternate ledger, deferment impacts, validity gate and both concurrence owners remain visible.
- **Navigation replacement:** Không có khi mọi required owner vẫn dùng đồng thời được.
- **Sticky boundary:** Chỉ outcome hoặc action hiện tại được persist; nó reserve space và yield khi viewport thấp.
- **Overflow owner:** Chỉ `aircraft-performance-and-fuel-alternate-ledger` được sở hữu bounded horizontal overflow; nội dung thường không tạo page-level horizontal scroll.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi persistent region ít ưu tiên nhất làm hỏng dominant cross-region relationship.
- **Topology response:** Chuyển đúng theo contract: Selected release scenario and validity gate stay primary; route/hazard and performance/legality sources alternate without hiding concurrence state.
- **Navigation replacement:** Named synchronized drawer, disclosure hoặc pane thay mỗi persistent region bị dời và trigger hiển thị state hiện tại.
- **Sticky boundary:** Persistent action chỉ tồn tại khi exact target nhìn thấy và trở lại in-flow khi viewport thấp.
- **Overflow owner:** `aircraft-performance-and-fuel-alternate-ledger` giữ bounded overflow axis duy nhất và có text/list equivalent.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai task owner đồng thời không thể giữ evidence dễ đọc và control 44-by-44 CSS pixel.
- **Topology response:** Tái cấu trúc theo primary sequence: Flight → route hazard → performance/fuel/alternate → MEL or legality exception → validity → dispatcher concurrence → PIC concurrence → issue/amend; blocker-first evidence replaces any miniature route map.
- **Navigation replacement:** Dùng một primary-pane sequence với Previous và Next rõ ràng, khôi phục selection, query, state và scroll context.
- **Sticky boundary:** Current action reserve content space, không che focus và trở lại normal flow khi viewport thấp.
- **Overflow owner:** Text hoặc relation ledger là primary; `aircraft-performance-and-fuel-alternate-ledger` chỉ là optional bounded region.

### Reflow

- Semantic và DOM order là `release-workbench → flight-identity-and-operating-window → route-and-leg-plan → weather- → hazard-overlay → aircraft-performance-and-fuel-alternate-ledger → deferment-and-legality-impact → release-validity-gate → dispatcher-concurrence → pilot-in-command-concurrence → issued-release-and-amendment-lineage`.
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
| Khởi đầu / loading | `flight-identity-and-operating-window` | Xác định scope đang chờ và giữ semantic position. |
| Ready | `route-and-leg-plan` | Hiển thị dominant task hoàn chỉnh và version hiện tại. |
| Empty / không áp dụng | `weather-` | Phân biệt absence có nghĩa với evidence unavailable. |
| Lỗi / retry | `hazard-overlay` | Giữ context hợp lệ và cung cấp retry cục bộ mà không reset selection. |
| Permission / unavailable | `pilot-in-command-concurrence` | Không suy diễn evidence bị hạn chế là không tồn tại; cung cấp alternate route an toàn. |
| Pending | `issued-release-and-amendment-lineage` | Ngăn action trùng và announce tiến độ mà không di chuyển focus. |
| Success | `issued-release-and-amendment-lineage` | Hiển thị outcome, provenance và action hợp lệ kế tiếp. |
| Stale / conflict | `flight-identity-and-operating-window` | Giữ giá trị an toàn cuối cùng và yêu cầu reconciliation rõ ràng. |
| Chuyển focus | `issued-release-and-amendment-lineage` | Chỉ đưa focus tới error summary bắt buộc hoặc modal vừa mở, rồi trả về đúng trigger. |
| Trình bày responsive | `release-workbench` | Giữ selected entity, query, state và recovery khi topology đổi. |
| plan loading/stale | `flight-identity-and-operating-window` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| route accepted/restricted | `route-and-leg-plan` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| weather or NOTAM clear/blocking | `weather-` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| aircraft performance sufficient/insufficient | `hazard-overlay` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| fuel valid/short | `aircraft-performance-and-fuel-alternate-ledger` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| alternate required/invalid | `deferment-and-legality-impact` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| MEL compatible/blocking | `release-validity-gate` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| validity pass/fail | `dispatcher-concurrence` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| concurrence pending/declined/signed | `pilot-in-command-concurrence` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| release issued/expired and amendment superseding. | `issued-release-and-amendment-lineage` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |

## Ranh giới

### Chấp nhận

- Chỉ accept khi dominant task chuyển required evidence thành outcome đã khai báo.
- Chỉ accept khi mỗi required region có owner độc lập và named relationship vẫn explicit.
- Chỉ accept khi template must make one weather, MEL or fuel change invalidate the release, select a viable alternate, require both independent concurrences, issue a superseding amendment and retain exact release context across every responsive topology.

### Từ chối

- Từ chối route itinerary; đây là evidence `AR-FD-90` và phải route sang archetype khác.
- Từ chối estimate calculator; đây là evidence `AR-FD-91` và phải route sang archetype khác.
- Từ chối evidence dossier; đây là evidence `AR-FD-92` và phải route sang archetype khác.
- Từ chối permit-to-work; đây là evidence `AR-FD-93` và phải route sang archetype khác.
- Từ chối candidate chỉ thỏa task bằng cách đổi product noun hoặc visual treatment.

### Phán quyết ranh giới

Trả `accept` chỉ khi dominant task, complete required graph, transformation contract, state/recovery parity và `AR-FD-05` đều giữ. Trả `reject` cho rejection code. Trả `needs-evidence` khi owner hoặc relationship chưa resolve. Báo `duplicate-or-variation` cho khác biệt chỉ ở noun, density, color, card count, component hoặc state.

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
| [FAA — AC 120-126A](https://www.faa.gov/media/92696) | Hỗ trợ dispatch resource management and joint operational decisions. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |
| [EASA — Air Operations Rules](https://www.easa.europa.eu/en/document-library/easy-access-rules/online-publications/easy-access-rules-air-operations) | Hỗ trợ operational planning, fuel, alternates, and legality. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |
| [W3C WAI — Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum) | Hỗ trợ blocker-first focus visibility. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |

Source set gồm tài liệu official hiện hành từ ít nhất ba tổ chức độc lập và có W3C accessibility evidence.

## Đầu ra

```json
{
  "archetypeId": "flight-dispatch-release-workbench",
  "situationCodes": [
    "<matched AR-FD-* codes>"
  ],
  "searchAliases": [
    "flight dispatch release",
    "dispatcher PIC concurrence",
    "fuel alternate legality",
    "release amendment"
  ],
  "dominantTask": "Prepare or amend one regulated flight release by reconciling route, weather/NOTAM, aircraft performance, crew, fuel and alternates, then obtaining dispatcher and pilot-in-command concurrence.",
  "regions": [
    "release-workbench",
    "flight-identity-and-operating-window",
    "route-and-leg-plan",
    "weather-",
    "hazard-overlay",
    "aircraft-performance-and-fuel-alternate-ledger",
    "deferment-and-legality-impact",
    "release-validity-gate",
    "dispatcher-concurrence",
    "pilot-in-command-concurrence",
    "issued-release-and-amendment-lineage"
  ],
  "regionRelationships": [
    "release-workbench → flight-identity-and-operating-window → route-and-leg-plan ↔ weather-NOTAM-hazard-overlay → aircraft-performance-and-fuel-alternate-ledger → MEL-deferment-and-legality-impact → release-validity-gate → dispatcher-concurrence ↔ pilot-in-command-concurrence → issued-release-and-amendment-lineage"
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<named synchronized panes or drawers>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "release-workbench → flight-identity-and-operating-window → route-and-leg-plan → weather- → hazard-overlay → aircraft-performance-and-fuel-alternate-ledger → deferment-and-legality-impact → release-validity-gate → dispatcher-concurrence → pilot-in-command-concurrence → issued-release-and-amendment-lineage",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "none",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": [
    "plan loading/stale",
    "route accepted/restricted",
    "weather or NOTAM clear/blocking",
    "aircraft performance sufficient/insufficient",
    "fuel valid/short",
    "alternate required/invalid",
    "MEL compatible/blocking",
    "validity pass/fail",
    "concurrence pending/declined/signed",
    "release issued/expired and amendment superseding."
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

