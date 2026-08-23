# Rolling stock circulation maintenance planner

## LOADS

None.

## Record

### Identity

| Trường | Giá trị |
|---|---|
| Archetype ID | `rolling-stock-circulation-maintenance-planner` |
| Family | Work |
| Dominant task | Xây dựng circulation nhiều ngày khả thi cho các rolling-stock unit vật lý qua service leg, coupling/splitting, depot, cleaning và maintenance window, rồi sửa continuity/coverage gap trước release. |
| Search aliases | `rolling stock circulation maintenance`, `rolling stock circulation maintenance workspace`, `rolling stock circulation maintenance control` |
| Authority | Macro topology dùng chung và trung lập sản phẩm; Grammar sở hữu ngữ nghĩa sản phẩm, Principles sở hữu geometry chưa giải quyết và Direction sở hữu visual character. |

### Invariants

- Xây dựng circulation nhiều ngày khả thi cho các rolling-stock unit vật lý qua service leg, coupling/splitting, depot, cleaning và maintenance window, rồi sửa continuity/coverage gap trước release.
- Mọi vùng bắt buộc tạo thành một chuỗi bằng chứng đến quyết định có thể truy vết; đầu ra trung gian không tự đóng task.
- Mỗi vùng bắt buộc giữ owner riêng và cùng selected context.
- Wide, intermediate và compact giữ DOM, reading/focus order có nghĩa, action parity và recovery xác định.

## Recognition

### Situation codes

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-RSCMP-01` | Dominant task là outcome quan sát được bắt buộc. | Bằng chứng bắt buộc. |
| `AR-RSCMP-02` | Toàn bộ region graph và quan hệ đã đặt tên là cần thiết. | Bằng chứng bắt buộc. |
| `AR-RSCMP-03` | Compact giữ action, state, recovery và nghĩa focus của wide. | Bằng chứng bắt buộc. |
| `AR-RSCMP-04` | State đặc thù task có thể đổi sau khi người dùng tạo work state. | Bằng chứng bắt buộc. |
| `AR-RSCMP-90` | Dominant task thực ra là `calendar-resource-scheduler`. | Reject. |
| `AR-RSCMP-91` | Dominant task thực ra là `fleet-route-dispatch-planner`. | Reject. |
| `AR-RSCMP-92` | Dominant task thực ra là `critical-path-project-planner`. | Reject. |
| `AR-RSCMP-93` | Dominant task thực ra là `inventory-replenishment-planner`. | Reject. |

### Selection rule

Chọn `rolling-stock-circulation-maintenance-planner` khi và chỉ khi `AR-RSCMP-01` đến `AR-RSCMP-04` có bằng chứng và không mã nào từ `AR-RSCMP-90` đến `AR-RSCMP-93` đúng. Trả `needs-evidence` khi owner hoặc relationship chưa được giải quyết; trả `reject` khi có rejection code.

## Region graph

```text
circulation-planner → operating-plan-horizon-and-fleet-policy → service-leg-and-required-formation-graph → named-physical-unit-roster-capability-and-due-state → identity-preserving-unit-to-service-leg-chains ↔ couple-split-and-formation-membership-events → arrival-to-depot-path-and-stabling-position → unit-specific-cleaning-inspection-and-maintenance-window → depot-exit-to-next-service-continuity → broken-unit-chain-and-formation-coverage-gaps → identity-specific-swap-or-resequence-scenarios → whole-circulation-release-and-depot-handoff
```

### Region obligations

| Region | Nghĩa vụ owner và relationship |
|---|---|
| `circulation-planner` | Sở hữu dominant task, toàn bộ trạng thái hậu duệ và boundary recovery. |
| `operating-plan-horizon-and-fleet-policy` | Sở hữu bằng chứng hoặc hành động của Operating Plan Horizon And Fleet Policy và giữ quan hệ đã khai báo với selection hiện tại. |
| `service-leg-and-required-formation-graph` | Sở hữu bằng chứng hoặc hành động của Service Leg And Required Formation Graph và giữ quan hệ đã khai báo với selection hiện tại. |
| `named-physical-unit-roster-capability-and-due-state` | Sở hữu bằng chứng hoặc hành động của Named Physical Unit Roster Capability And Due State và giữ quan hệ đã khai báo với selection hiện tại. |
| `identity-preserving-unit-to-service-leg-chains` | Sở hữu bằng chứng hoặc hành động của Identity Preserving Unit To Service Leg Chains và giữ quan hệ đã khai báo với selection hiện tại. |
| `couple-split-and-formation-membership-events` | Sở hữu bằng chứng hoặc hành động của Couple Split And Formation Membership Events và giữ quan hệ đã khai báo với selection hiện tại. |
| `arrival-to-depot-path-and-stabling-position` | Sở hữu bằng chứng hoặc hành động của Arrival To Depot Path And Stabling Position và giữ quan hệ đã khai báo với selection hiện tại. |
| `unit-specific-cleaning-inspection-and-maintenance-window` | Sở hữu bằng chứng hoặc hành động của Unit Specific Cleaning Inspection And Maintenance Window và giữ quan hệ đã khai báo với selection hiện tại. |
| `depot-exit-to-next-service-continuity` | Sở hữu bằng chứng hoặc hành động của Depot Exit To Next Service Continuity và giữ quan hệ đã khai báo với selection hiện tại. |
| `broken-unit-chain-and-formation-coverage-gaps` | Sở hữu bằng chứng hoặc hành động của Broken Unit Chain And Formation Coverage Gaps và giữ quan hệ đã khai báo với selection hiện tại. |
| `identity-specific-swap-or-resequence-scenarios` | Sở hữu bằng chứng hoặc hành động của Identity Specific Swap Or Resequence Scenarios và giữ quan hệ đã khai báo với selection hiện tại. |
| `whole-circulation-release-and-depot-handoff` | Sở hữu bằng chứng hoặc hành động của Whole Circulation Release And Depot Handoff và giữ quan hệ đã khai báo với selection hiện tại. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi các vùng đồng thời không còn giữ được label dễ đọc, liên kết chính xác và action đầy đủ.
- **Topology response:** Service-leg requirement, unit chain song song, formation event, depot/maintenance window, continuity break và swap scenario cùng căn chỉnh; chỉ circulation canvas có giới hạn sở hữu overflow ngang.
- **Navigation replacement:** Không có khi mọi vùng bắt buộc vẫn đồng thời dùng được.
- **Sticky boundary:** Chỉ trạng thái hoặc action của task hiện tại được persist; nó dành chỗ và yield khi chiều cao ngắn.
- **Overflow owner:** `circulation-planner` sở hữu overflow có giới hạn; page không sở hữu overflow ngang.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi vùng hỗ trợ ưu tiên thấp nhất làm quan hệ chính không còn dùng được.
- **Topology response:** Unit và broken transition đã chọn được ghim; circulation-chain và depot/maintenance evidence luân phiên, còn formation/coverage state tồn tại.
- **Navigation replacement:** Các evidence view có tên thay vùng bị dời và giữ đúng selection cùng trigger.
- **Sticky boundary:** Verdict hiện tại chỉ persist khi target vẫn thấy được và trở lại flow khi chiều cao ngắn.
- **Overflow owner:** Owner có giới hạn của wide vẫn cục bộ; view luân phiên không tạo nested page scroll.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai vùng task không thể đồng thời giữ bằng chứng dễ đọc, target 44 px và focus không bị che.
- **Topology response:** Formation chưa cover → unit ứng viên có danh tính → prior arrival → couple/split membership → depot path/stabling → due-state/window của unit → depot exit/next service → coverage sau swap → identity chain → release/handoff.
- **Navigation replacement:** Primary-pane sequence có Back khôi phục selection, state, query, scroll context và đúng trigger.
- **Sticky boundary:** Action bar dành sẵn chỗ, không che focus và trở về normal flow khi chiều cao ngắn.
- **Overflow owner:** Visual có giới hạn có bản tương đương dạng chữ theo thứ tự làm representation compact chính.

### Reflow

- Semantic, DOM và meaningful focus order giữ graph: `circulation-planner → operating-plan-horizon-and-fleet-policy → service-leg-and-required-formation-graph → named-physical-unit-roster-capability-and-due-state → identity-preserving-unit-to-service-leg-chains ↔ couple-split-and-formation-membership-events → arrival-to-depot-path-and-stabling-position → unit-specific-cleaning-inspection-and-maintenance-window → depot-exit-to-next-service-continuity → broken-unit-chain-and-formation-coverage-gaps → identity-specific-swap-or-resequence-scenarios → whole-circulation-release-and-depot-handoff`.
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

Các state đặc thù task: Operating plan loading/versioned, unit available/in-service/stabled/failed, capability compatible/incompatible, leg covered/uncovered, connection feasible/tight/broken, coupling/splitting planned/confirmed/failed, maintenance not-due/due/overdue/completed, depot capacity available/full, swap proposed/feasible/new-gap, circulation draft/feasible/released/superseded and depot handoff pending/acknowledged.

| State | Region sở hữu | Nghĩa vụ |
|---|---|---|
| Initial / loading | `operating-plan-horizon-and-fleet-policy` | Nêu scope đang tải, giữ chỗ primary region và chỉ block owner lỗi. |
| Ready | `service-leg-and-required-formation-graph` | Hiện object, owner relationship, selection và action hợp lệ bằng text lẫn semantics. |
| Empty / not applicable | `service-leg-and-required-formation-graph` | Phân biệt empty thật, no-match và not-applicable rồi cung cấp next action hợp lệ. |
| Error / retry | `identity-specific-swap-or-resequence-scenarios` | Giữ context/input hợp lệ, nêu owner lỗi và cung cấp local retry. |
| Permission / unavailable | `whole-circulation-release-and-depot-handoff` | Giải thích restriction mà không ngụ ý bằng chứng ẩn là không tồn tại và cung cấp safe exit. |
| Pending | `whole-circulation-release-and-depot-handoff` | Ngăn duplicate action, giữ đúng target và announce progress mà không dời focus. |
| Success | `whole-circulation-release-and-depot-handoff` | Xác nhận outcome chính xác, giữ selection và cung cấp next action hoặc recovery. |
| Stale / conflict | `operating-plan-horizon-and-fleet-policy` | Giữ last-safe value, nêu version/time conflict và yêu cầu recovery rõ. |
| Focus transition | `whole-circulation-release-and-depot-handoff` | Chỉ dời focus vào modal hoặc error summary bắt buộc rồi trả về đúng trigger. |
| Responsive presentation | `circulation-planner` | Giữ state, selection, query, pending result và recovery khi topology đổi. |

## Boundaries

### Accept

- Accept khi dominant task là: Xây dựng circulation nhiều ngày khả thi cho các rolling-stock unit vật lý qua service leg, coupling/splitting, depot, cleaning và maintenance window, rồi sửa continuity/coverage gap trước release.
- Accept khi mọi region và relationship bắt buộc trong graph đều cần để hoàn thành task.
- Accept khi compact giữ task, state và recovery bằng replacement topology thay vì stack box desktop.

### Reject

- Reject `calendar-resource-scheduler`; đây là bằng chứng `AR-RSCMP-90` và phải route sang archetype kề.
- Reject `fleet-route-dispatch-planner`; đây là bằng chứng `AR-RSCMP-91` và phải route sang archetype kề.
- Reject `critical-path-project-planner`; đây là bằng chứng `AR-RSCMP-92` và phải route sang archetype kề.
- Reject `inventory-replenishment-planner`; đây là bằng chứng `AR-RSCMP-93` và phải route sang archetype kề.

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
| [ERA Telematics Applications TSI](https://www.era.europa.eu/content/new-telematics-applications-tsi-enters-force) | Quan hệ nghiệp vụ chính thức và boundary quyền hạn đặc thù cho dominant task. | Không chọn archetype, không định nghĩa product truth và không cho phép sao chép geometry. |
| [Network Rail timetable planning](https://www.networkrail.co.uk/industry-and-commercial/the-timetable/) | Quan hệ nghiệp vụ chính thức và boundary quyền hạn đặc thù cho dominant task. | Không chọn archetype, không định nghĩa product truth và không cho phép sao chép geometry. |

Tập nguồn gồm ít nhất ba tổ chức chính thức độc lập và bằng chứng accessibility của W3C.

## Output

```json
{
  "archetypeId": "rolling-stock-circulation-maintenance-planner",
  "situationCodes": [
    "<matched AR-RSCMP-* codes>"
  ],
  "searchAliases": [
    "rolling stock circulation maintenance",
    "rolling stock circulation maintenance workspace",
    "rolling stock circulation maintenance control"
  ],
  "dominantTask": "Build a feasible multi-day circulation of physical rolling-stock units across service legs, coupling and splitting events, depot transitions, cleaning and maintenance windows, then resolve continuity and coverage gaps before release.",
  "regions": [
    "circulation-planner",
    "operating-plan-horizon-and-fleet-policy",
    "service-leg-and-required-formation-graph",
    "named-physical-unit-roster-capability-and-due-state",
    "identity-preserving-unit-to-service-leg-chains",
    "couple-split-and-formation-membership-events",
    "arrival-to-depot-path-and-stabling-position",
    "unit-specific-cleaning-inspection-and-maintenance-window",
    "depot-exit-to-next-service-continuity",
    "broken-unit-chain-and-formation-coverage-gaps",
    "identity-specific-swap-or-resequence-scenarios",
    "whole-circulation-release-and-depot-handoff"
  ],
  "regionRelationships": [
    "a fleet type or anonymous spare can never substitute for the named unit whose service, formation, depot and maintenance history must remain continuous."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "circulation-planner -> operating-plan-horizon-and-fleet-policy -> service-leg-and-required-formation-graph -> named-physical-unit-roster-capability-and-due-state -> identity-preserving-unit-to-service-leg-chains -> couple-split-and-formation-membership-events -> arrival-to-depot-path-and-stabling-position -> unit-specific-cleaning-inspection-and-maintenance-window -> depot-exit-to-next-service-continuity -> broken-unit-chain-and-formation-coverage-gaps -> identity-specific-swap-or-resequence-scenarios -> whole-circulation-release-and-depot-handoff",
    "navigationReplacement": "<none or named evidence view or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "circulation-planner",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": [
    "Operating plan loading/versioned",
    "unit available/in-service/stabled/failed",
    "capability compatible/incompatible",
    "leg covered/uncovered",
    "connection feasible/tight/broken",
    "coupling/splitting planned/confirmed/failed",
    "maintenance not-due/due/overdue/completed",
    "depot capacity available/full",
    "swap proposed/feasible/new-gap",
    "circulation draft/feasible/released/superseded",
    "depot handoff pending/acknowledged"
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

