# Airspace volume deconfliction planner

## LOADS

None.

## Record

### Identity

| Trường | Giá trị |
|---|---|
| Archetype ID | `airspace-volume-deconfliction-planner` |
| Family | Work |
| Dominant task | Phân bổ các volume không phận bốn chiều tạm thời bằng cách phát hiện giao cắt không-thời gian dưới bất định, thương lượng counterfactual shift/resize/reroute và kích hoạt một tập volume phối hợp không chồng lấn. |
| Search aliases | `airspace volume deconfliction`, `airspace volume deconfliction workspace`, `airspace volume deconfliction control` |
| Authority | Macro topology dùng chung và trung lập sản phẩm; Grammar sở hữu ngữ nghĩa sản phẩm, Principles sở hữu geometry chưa giải quyết và Direction sở hữu visual character. |

### Invariants

- Phân bổ các volume không phận bốn chiều tạm thời bằng cách phát hiện giao cắt không-thời gian dưới bất định, thương lượng counterfactual shift/resize/reroute và kích hoạt một tập volume phối hợp không chồng lấn.
- Mọi vùng bắt buộc tạo thành một chuỗi bằng chứng đến quyết định có thể truy vết; đầu ra trung gian không tự đóng task.
- Mỗi vùng bắt buộc giữ owner riêng và cùng selected context.
- Wide, intermediate và compact giữ DOM, reading/focus order có nghĩa, action parity và recovery xác định.

## Recognition

### Situation codes

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-AVDP-01` | Dominant task là outcome quan sát được bắt buộc. | Bằng chứng bắt buộc. |
| `AR-AVDP-02` | Toàn bộ region graph và quan hệ đã đặt tên là cần thiết. | Bằng chứng bắt buộc. |
| `AR-AVDP-03` | Compact giữ action, state, recovery và nghĩa focus của wide. | Bằng chứng bắt buộc. |
| `AR-AVDP-04` | State đặc thù task có thể đổi sau khi người dùng tạo work state. | Bằng chứng bắt buộc. |
| `AR-AVDP-90` | Dominant task thực ra là `orbital-conjunction-assessment-workbench`. | Reject. |
| `AR-AVDP-91` | Dominant task thực ra là `air-traffic-separation-resolution-console`. | Reject. |
| `AR-AVDP-92` | Dominant task thực ra là `capacity-allocation-overview`. | Reject. |
| `AR-AVDP-93` | Dominant task thực ra là `calendar-resource-scheduler`. | Reject. |
| `AR-AVDP-94` | Dominant task thực ra là `map-led-situation-monitor`. | Reject. |

### Selection rule

Chọn `airspace-volume-deconfliction-planner` khi và chỉ khi `AR-AVDP-01` đến `AR-AVDP-04` có bằng chứng và không mã nào từ `AR-AVDP-90` đến `AR-AVDP-94` đúng. Trả `needs-evidence` khi owner hoặc relationship chưa được giải quyết; trả `reject` khi có rejection code.

## Region graph

```text
volume-deconfliction → airspace-authority-time-horizon-and-rule-version → request-register → selected-operation-lateral-polygon-altitude-floor-ceiling-and-time-interval → true-4d-volume-solid ↔ altitude-time-slice-projections ↔ pairwise-space-time-intersection-matrix → uncertainty-and-buffer-envelope → shift-resize-reroute-counterfactuals → stakeholder-coordination-and-approval → activation-amendment-or-cancellation → actual-use-containment-and-vacated-time → explicit-volume-release-and-lineage
```

### Region obligations

| Region | Nghĩa vụ owner và relationship |
|---|---|
| `volume-deconfliction` | Sở hữu dominant task, toàn bộ trạng thái hậu duệ và boundary recovery. |
| `airspace-authority-time-horizon-and-rule-version` | Sở hữu bằng chứng hoặc hành động của Airspace Authority Time Horizon And Rule Version và giữ quan hệ đã khai báo với selection hiện tại. |
| `request-register` | Sở hữu bằng chứng hoặc hành động của Request Register và giữ quan hệ đã khai báo với selection hiện tại. |
| `selected-operation-lateral-polygon-altitude-floor-ceiling-and-time-interval` | Sở hữu bằng chứng hoặc hành động của Selected Operation Lateral Polygon Altitude Floor Ceiling And Time Interval và giữ quan hệ đã khai báo với selection hiện tại. |
| `true-4d-volume-solid` | Sở hữu bằng chứng hoặc hành động của True 4d Volume Solid và giữ quan hệ đã khai báo với selection hiện tại. |
| `altitude-time-slice-projections` | Sở hữu bằng chứng hoặc hành động của Altitude Time Slice Projections và giữ quan hệ đã khai báo với selection hiện tại. |
| `pairwise-space-time-intersection-matrix` | Sở hữu bằng chứng hoặc hành động của Pairwise Space Time Intersection Matrix và giữ quan hệ đã khai báo với selection hiện tại. |
| `uncertainty-and-buffer-envelope` | Sở hữu bằng chứng hoặc hành động của Uncertainty And Buffer Envelope và giữ quan hệ đã khai báo với selection hiện tại. |
| `shift-resize-reroute-counterfactuals` | Sở hữu bằng chứng hoặc hành động của Shift Resize Reroute Counterfactuals và giữ quan hệ đã khai báo với selection hiện tại. |
| `stakeholder-coordination-and-approval` | Sở hữu bằng chứng hoặc hành động của Stakeholder Coordination And Approval và giữ quan hệ đã khai báo với selection hiện tại. |
| `activation-amendment-or-cancellation` | Sở hữu bằng chứng hoặc hành động của Activation Amendment Or Cancellation và giữ quan hệ đã khai báo với selection hiện tại. |
| `actual-use-containment-and-vacated-time` | Sở hữu bằng chứng hoặc hành động của Actual Use Containment And Vacated Time và giữ quan hệ đã khai báo với selection hiện tại. |
| `explicit-volume-release-and-lineage` | Sở hữu bằng chứng hoặc hành động của Explicit Volume Release And Lineage và giữ quan hệ đã khai báo với selection hiện tại. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi các vùng đồng thời không còn giữ được label dễ đọc, liên kết chính xác và action đầy đủ.
- **Topology response:** Request register, 4D slice projection, intersection matrix, buffer evidence, counterfactual và coordination state cùng hiện diện; chỉ spatial slice có giới hạn sở hữu pan/zoom.
- **Navigation replacement:** Không có khi mọi vùng bắt buộc vẫn đồng thời dùng được.
- **Sticky boundary:** Chỉ trạng thái hoặc action của task hiện tại được persist; nó dành chỗ và yield khi chiều cao ngắn.
- **Overflow owner:** `pairwise-space-time-intersection-matrix` sở hữu overflow có giới hạn; page không sở hữu overflow ngang.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi vùng hỗ trợ ưu tiên thấp nhất làm quan hệ chính không còn dùng được.
- **Topology response:** Cặp xung đột và lát time/altitude đã chọn được ghim; spatial slice và matrix/counterfactual evidence luân phiên, còn approval state tồn tại.
- **Navigation replacement:** Các evidence view có tên thay vùng bị dời và giữ đúng selection cùng trigger.
- **Sticky boundary:** Verdict hiện tại chỉ persist khi target vẫn thấy được và trở lại flow khi chiều cao ngắn.
- **Overflow owner:** Owner có giới hạn của wide vẫn cục bộ; view luân phiên không tạo nested page scroll.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai vùng task không thể đồng thời giữ bằng chứng dễ đọc, target 44 px và focus không bị che.
- **Topology response:** Request → lateral polygon → altitude floor/ceiling → activation interval → solid 4D xung đột và overlap interval → uncertainty buffer → shift/resize/reroute → stakeholder decision → activate → containment/vacated evidence → release.
- **Navigation replacement:** Primary-pane sequence có Back khôi phục selection, state, query, scroll context và đúng trigger.
- **Sticky boundary:** Action bar dành sẵn chỗ, không che focus và trở về normal flow khi chiều cao ngắn.
- **Overflow owner:** Visual có giới hạn có bản tương đương dạng chữ theo thứ tự làm representation compact chính.

### Reflow

- Semantic, DOM và meaningful focus order giữ graph: `volume-deconfliction → airspace-authority-time-horizon-and-rule-version → request-register → selected-operation-lateral-polygon-altitude-floor-ceiling-and-time-interval → true-4d-volume-solid ↔ altitude-time-slice-projections ↔ pairwise-space-time-intersection-matrix → uncertainty-and-buffer-envelope → shift-resize-reroute-counterfactuals → stakeholder-coordination-and-approval → activation-amendment-or-cancellation → actual-use-containment-and-vacated-time → explicit-volume-release-and-lineage`.
- Label dài, bản dịch, zoom và control phóng lớn kích hoạt cùng topology change đã đặt tên.
- CSS không reorder semantic; content thường không tạo page-level horizontal scroll.
- Detail bị ẩn luôn có reveal path accessible rõ ràng.

### Interaction parity

- Mọi selection, edit, action, explanation, retry và recovery của wide đều tới được ở intermediate và compact.
- Đổi topology giữ đúng selected object, order, data state, pending result và error context.
- Pointer action có phương án keyboard và single-pointer không drag khi có movement.
- Dynamic update announce một status có ngữ cảnh mà không giật focus; màu không là tín hiệu duy nhất.
- Modal nhận và giữ focus, hỗ trợ Escape hoặc Cancel rồi trả focus về đúng trigger.

## State obligations

Các state đặc thù task: Request draft/submitted/changed, geometry invalid/valid, interval proposed/coordinated/active/released, buffer complete/insufficient, intersection none/potential/confirmed, counterfactual infeasible/clear/new-conflict, stakeholder pending/accepted/rejected, activation scheduled/live/aborted, actual containment nominal/deviating and amendment superseded.

| State | Region sở hữu | Nghĩa vụ |
|---|---|---|
| Initial / loading | `airspace-authority-time-horizon-and-rule-version` | Nêu scope đang tải, giữ chỗ primary region và chỉ block owner lỗi. |
| Ready | `request-register` | Hiện object, owner relationship, selection và action hợp lệ bằng text lẫn semantics. |
| Empty / not applicable | `request-register` | Phân biệt empty thật, no-match và not-applicable rồi cung cấp next action hợp lệ. |
| Error / retry | `actual-use-containment-and-vacated-time` | Giữ context/input hợp lệ, nêu owner lỗi và cung cấp local retry. |
| Permission / unavailable | `explicit-volume-release-and-lineage` | Giải thích restriction mà không ngụ ý bằng chứng ẩn là không tồn tại và cung cấp safe exit. |
| Pending | `explicit-volume-release-and-lineage` | Ngăn duplicate action, giữ đúng target và announce progress mà không dời focus. |
| Success | `explicit-volume-release-and-lineage` | Xác nhận outcome chính xác, giữ selection và cung cấp next action hoặc recovery. |
| Stale / conflict | `airspace-authority-time-horizon-and-rule-version` | Giữ last-safe value, nêu version/time conflict và yêu cầu recovery rõ. |
| Focus transition | `explicit-volume-release-and-lineage` | Chỉ dời focus vào modal hoặc error summary bắt buộc rồi trả về đúng trigger. |
| Responsive presentation | `volume-deconfliction` | Giữ state, selection, query, pending result và recovery khi topology đổi. |

## Boundaries

### Accept

- Accept khi dominant task là: Phân bổ các volume không phận bốn chiều tạm thời bằng cách phát hiện giao cắt không-thời gian dưới bất định, thương lượng counterfactual shift/resize/reroute và kích hoạt một tập volume phối hợp không chồng lấn.
- Accept khi mọi region và relationship bắt buộc trong graph đều cần để hoàn thành task.
- Accept khi compact giữ task, state và recovery bằng replacement topology thay vì stack box desktop.

### Reject

- Reject `orbital-conjunction-assessment-workbench`; đây là bằng chứng `AR-AVDP-90` và phải route sang archetype kề.
- Reject `air-traffic-separation-resolution-console`; đây là bằng chứng `AR-AVDP-91` và phải route sang archetype kề.
- Reject `capacity-allocation-overview`; đây là bằng chứng `AR-AVDP-92` và phải route sang archetype kề.
- Reject `calendar-resource-scheduler`; đây là bằng chứng `AR-AVDP-93` và phải route sang archetype kề.
- Reject `map-led-situation-monitor`; đây là bằng chứng `AR-AVDP-94` và phải route sang archetype kề.

### Boundary verdict

Chỉ trả `accept` khi dominant task, complete graph và compact parity cùng đúng. Khác biệt chỉ ở noun, density, color, component, card count hoặc state là `duplicate-or-variation`.

## Handoff

- **Grammar handoff:** Gắn owner, label, permitted action và nghĩa state trung thực của sản phẩm vào các region đã khai báo.
- **Principles handoff:** Giải quyết grid, measure, gap, alignment, sticky offset, bounded overflow và transition point theo relationship.
- Không handoff nào được bỏ region bắt buộc, đổi dominant task hoặc làm yếu interaction parity.

## Non-binding research evidence

### Evidence boundary

Research bên ngoài là bằng chứng tham khảo, không phải product truth. Nó hỗ trợ tổng hợp quan hệ task, adaptive behavior và accessibility obligation; nó không chọn StarCi owner, exact geometry hay quyền sao chép interface nguồn.

### Sources

| Nguồn | Hỗ trợ điều gì | Không chứng minh điều gì |
|---|---|---|
| [W3C WAI — Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Nghĩa vụ accessibility cho reflow, focus, trạng thái và tương tác tương đương. | Không chọn archetype, không định nghĩa product truth và không cho phép sao chép geometry. |
| [EASA U-space rules for four-dimensional volumes](https://www.easa.europa.eu/en/document-library/easy-access-rules/online-publications/easy-access-rules-u-space?erules-id=ERULES-1963177438-21046) | Quan hệ nghiệp vụ chính thức và boundary quyền hạn đặc thù cho dominant task. | Không chọn archetype, không định nghĩa product truth và không cho phép sao chép geometry. |
| [EUROCONTROL airspace-management service](https://www.eurocontrol.int/service/airspace-management) | Quan hệ nghiệp vụ chính thức và boundary quyền hạn đặc thù cho dominant task. | Không chọn archetype, không định nghĩa product truth và không cho phép sao chép geometry. |

Tập nguồn gồm ít nhất ba tổ chức chính thức độc lập và bằng chứng accessibility của W3C.

## Output

```json
{
  "archetypeId": "airspace-volume-deconfliction-planner",
  "situationCodes": [
    "<matched AR-AVDP-* codes>"
  ],
  "searchAliases": [
    "airspace volume deconfliction",
    "airspace volume deconfliction workspace",
    "airspace volume deconfliction control"
  ],
  "dominantTask": "Allocate temporary four-dimensional airspace volumes by detecting space-time intersections under uncertainty, negotiating shift, resize or reroute counterfactuals and activating a non-overlapping coordinated volume set.",
  "regions": [
    "volume-deconfliction",
    "airspace-authority-time-horizon-and-rule-version",
    "request-register",
    "selected-operation-lateral-polygon-altitude-floor-ceiling-and-time-interval",
    "true-4d-volume-solid",
    "altitude-time-slice-projections",
    "pairwise-space-time-intersection-matrix",
    "uncertainty-and-buffer-envelope",
    "shift-resize-reroute-counterfactuals",
    "stakeholder-coordination-and-approval",
    "activation-amendment-or-cancellation",
    "actual-use-containment-and-vacated-time",
    "explicit-volume-release-and-lineage"
  ],
  "regionRelationships": [
    "a 2D map overlap or calendar overlap is insufficient, and reserved capacity stays occupied until actual use ends and authority records release."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "volume-deconfliction -> airspace-authority-time-horizon-and-rule-version -> request-register -> selected-operation-lateral-polygon-altitude-floor-ceiling-and-time-interval -> true-4d-volume-solid -> altitude-time-slice-projections -> pairwise-space-time-intersection-matrix -> uncertainty-and-buffer-envelope -> shift-resize-reroute-counterfactuals -> stakeholder-coordination-and-approval -> activation-amendment-or-cancellation -> actual-use-containment-and-vacated-time -> explicit-volume-release-and-lineage",
    "navigationReplacement": "<none or named evidence view or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "pairwise-space-time-intersection-matrix",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": [
    "Request draft/submitted/changed",
    "geometry invalid/valid",
    "interval proposed/coordinated/active/released",
    "buffer complete/insufficient",
    "intersection none/potential/confirmed",
    "counterfactual infeasible/clear/new-conflict",
    "stakeholder pending/accepted/rejected",
    "activation scheduled/live/aborted",
    "actual containment nominal/deviating",
    "amendment superseded"
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

