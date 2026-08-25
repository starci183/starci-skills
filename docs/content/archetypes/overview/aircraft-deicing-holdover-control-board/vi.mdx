# Aircraft deicing holdover control board

## LOADS

None.

## Record

### Identity

| Trường | Giá trị |
|---|---|
| Archetype ID | `aircraft-deicing-holdover-control-board` |
| Family | Overview |
| Dominant task | Điều khiển deicing mặt đất bằng cách ghi treatment hoàn tất theo zone, xác lập thời điểm bắt đầu anti-icing cuối và treatment code, theo dõi holdover phụ thuộc thời tiết qua taxi rồi release, reinspect hoặc retreat trước takeoff. |
| Search aliases | `aircraft deicing holdover control`, `aircraft deicing holdover control workspace`, `aircraft deicing holdover control control` |
| Authority | Macro topology dùng chung và trung lập sản phẩm; Grammar sở hữu ngữ nghĩa sản phẩm, Principles sở hữu geometry chưa giải quyết và Direction sở hữu visual character. |

### Invariants

- Điều khiển deicing mặt đất bằng cách ghi treatment hoàn tất theo zone, xác lập thời điểm bắt đầu anti-icing cuối và treatment code, theo dõi holdover phụ thuộc thời tiết qua taxi rồi release, reinspect hoặc retreat trước takeoff.
- Mọi vùng bắt buộc tạo thành một chuỗi bằng chứng đến quyết định có thể truy vết; đầu ra trung gian không tự đóng task.
- Mỗi vùng bắt buộc giữ owner riêng và cùng selected context.
- Wide, intermediate và compact giữ DOM, reading/focus order có nghĩa, action parity và recovery xác định.

## Recognition

### Situation codes

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-ADHCB-01` | Dominant task là outcome quan sát được bắt buộc. | Bằng chứng bắt buộc. |
| `AR-ADHCB-02` | Toàn bộ region graph và quan hệ đã đặt tên là cần thiết. | Bằng chứng bắt buộc. |
| `AR-ADHCB-03` | Compact giữ action, state, recovery và nghĩa focus của wide. | Bằng chứng bắt buộc. |
| `AR-ADHCB-04` | State đặc thù task có thể đổi sau khi người dùng tạo work state. | Bằng chứng bắt buộc. |
| `AR-ADHCB-90` | Dominant task thực ra là `stage-gated-process-record`. | Reject. |
| `AR-ADHCB-91` | Dominant task thực ra là `permit-to-work-isolation-control-room`. | Reject. |
| `AR-ADHCB-92` | Dominant task thực ra là `timeline-status-monitor`. | Reject. |
| `AR-ADHCB-93` | Dominant task thực ra là `appointment-booking-flow`. | Reject. |

### Selection rule

Chọn `aircraft-deicing-holdover-control-board` khi và chỉ khi `AR-ADHCB-01` đến `AR-ADHCB-04` có bằng chứng và không mã nào từ `AR-ADHCB-90` đến `AR-ADHCB-93` đúng. Trả `needs-evidence` khi owner hoặc relationship chưa được giải quyết; trả `reject` khi có rejection code.

## Region graph

```text
deicing-control → winter-program-fluid-and-weather-authority → aircraft-treatment-queue → selected-aircraft-critical-surface-and-treatment-plan → zone-by-zone-application-record → anti-icing-code-and-hot-start → dynamic-hot-allowance-clock ↔ taxi-takeoff-sequence → pre-takeoff-contamination-check → release-reinspect-or-retreat → treatment-and-expiry-audit
```

### Region obligations

| Region | Nghĩa vụ owner và relationship |
|---|---|
| `deicing-control` | Sở hữu dominant task, toàn bộ trạng thái hậu duệ và boundary recovery. |
| `winter-program-fluid-and-weather-authority` | Sở hữu bằng chứng hoặc hành động của Winter Program Fluid And Weather Authority và giữ quan hệ đã khai báo với selection hiện tại. |
| `aircraft-treatment-queue` | Sở hữu bằng chứng hoặc hành động của Aircraft Treatment Queue và giữ quan hệ đã khai báo với selection hiện tại. |
| `selected-aircraft-critical-surface-and-treatment-plan` | Sở hữu bằng chứng hoặc hành động của Selected Aircraft Critical Surface And Treatment Plan và giữ quan hệ đã khai báo với selection hiện tại. |
| `zone-by-zone-application-record` | Sở hữu bằng chứng hoặc hành động của Zone By Zone Application Record và giữ quan hệ đã khai báo với selection hiện tại. |
| `anti-icing-code-and-hot-start` | Sở hữu bằng chứng hoặc hành động của Anti Icing Code And Hot Start và giữ quan hệ đã khai báo với selection hiện tại. |
| `dynamic-hot-allowance-clock` | Sở hữu bằng chứng hoặc hành động của Dynamic Hot Allowance Clock và giữ quan hệ đã khai báo với selection hiện tại. |
| `taxi-takeoff-sequence` | Sở hữu bằng chứng hoặc hành động của Taxi Takeoff Sequence và giữ quan hệ đã khai báo với selection hiện tại. |
| `pre-takeoff-contamination-check` | Sở hữu bằng chứng hoặc hành động của Pre Takeoff Contamination Check và giữ quan hệ đã khai báo với selection hiện tại. |
| `release-reinspect-or-retreat` | Sở hữu bằng chứng hoặc hành động của Release Reinspect Or Retreat và giữ quan hệ đã khai báo với selection hiện tại. |
| `treatment-and-expiry-audit` | Sở hữu bằng chứng hoặc hành động của Treatment And Expiry Audit và giữ quan hệ đã khai báo với selection hiện tại. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi các vùng đồng thời không còn giữ được label dễ đọc, liên kết chính xác và action đầy đủ.
- **Topology response:** Queue treatment, zone record, weather/fluid authority, holdover range, taxi/takeoff sequence và release decision cùng hiện diện; chỉ queue sở hữu mật độ dọc có giới hạn.
- **Navigation replacement:** Không có khi mọi vùng bắt buộc vẫn đồng thời dùng được.
- **Sticky boundary:** Chỉ trạng thái hoặc action của task hiện tại được persist; nó dành chỗ và yield khi chiều cao ngắn.
- **Overflow owner:** `aircraft-treatment-queue` sở hữu overflow có giới hạn; page không sở hữu overflow ngang.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi vùng hỗ trợ ưu tiên thấp nhất làm quan hệ chính không còn dùng được.
- **Topology response:** Tàu bay, treatment code và allowance còn lại được ghim; zone evidence và taxi/weather evidence luân phiên, còn release gate nằm kề.
- **Navigation replacement:** Các evidence view có tên thay vùng bị dời và giữ đúng selection cùng trigger.
- **Sticky boundary:** Verdict hiện tại chỉ persist khi target vẫn thấy được và trở lại flow khi chiều cao ngắn.
- **Overflow owner:** Owner có giới hạn của wide vẫn cục bộ; view luân phiên không tạo nested page scroll.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai vùng task không thể đồng thời giữ bằng chứng dễ đọc, target 44 px và focus không bị che.
- **Topology response:** Tàu bay → zone critical surface → hoàn tất treatment → anti-icing start/code → weather và holdover range → taxi delay → contamination check → release/reinspect/retreat.
- **Navigation replacement:** Primary-pane sequence có Back khôi phục selection, state, query, scroll context và đúng trigger.
- **Sticky boundary:** Action bar dành sẵn chỗ, không che focus và trở về normal flow khi chiều cao ngắn.
- **Overflow owner:** Visual có giới hạn có bản tương đương dạng chữ theo thứ tự làm representation compact chính.

### Reflow

- Semantic, DOM và meaningful focus order giữ graph: `deicing-control → winter-program-fluid-and-weather-authority → aircraft-treatment-queue → selected-aircraft-critical-surface-and-treatment-plan → zone-by-zone-application-record → anti-icing-code-and-hot-start → dynamic-hot-allowance-clock ↔ taxi-takeoff-sequence → pre-takeoff-contamination-check → release-reinspect-or-retreat → treatment-and-expiry-audit`.
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

Các state đặc thù task: Weather feed live/stale/changed-category, fluid table current/superseded, zone untreated/in-progress/complete/recontaminated, treatment code incomplete/valid, holdover not-started/active/near-limit/expired/indeterminate, taxi sequence on-time/delayed, check not-required/due/passed/failed, release blocked/granted/revoked, retreat queued/in-progress/complete and audit record reconciled.

| State | Region sở hữu | Nghĩa vụ |
|---|---|---|
| Initial / loading | `winter-program-fluid-and-weather-authority` | Nêu scope đang tải, giữ chỗ primary region và chỉ block owner lỗi. |
| Ready | `aircraft-treatment-queue` | Hiện object, owner relationship, selection và action hợp lệ bằng text lẫn semantics. |
| Empty / not applicable | `aircraft-treatment-queue` | Phân biệt empty thật, no-match và not-applicable rồi cung cấp next action hợp lệ. |
| Error / retry | `release-reinspect-or-retreat` | Giữ context/input hợp lệ, nêu owner lỗi và cung cấp local retry. |
| Permission / unavailable | `treatment-and-expiry-audit` | Giải thích restriction mà không ngụ ý bằng chứng ẩn là không tồn tại và cung cấp safe exit. |
| Pending | `treatment-and-expiry-audit` | Ngăn duplicate action, giữ đúng target và announce progress mà không dời focus. |
| Success | `treatment-and-expiry-audit` | Xác nhận outcome chính xác, giữ selection và cung cấp next action hoặc recovery. |
| Stale / conflict | `winter-program-fluid-and-weather-authority` | Giữ last-safe value, nêu version/time conflict và yêu cầu recovery rõ. |
| Focus transition | `treatment-and-expiry-audit` | Chỉ dời focus vào modal hoặc error summary bắt buộc rồi trả về đúng trigger. |
| Responsive presentation | `deicing-control` | Giữ state, selection, query, pending result và recovery khi topology đổi. |

## Boundaries

### Accept

- Accept khi dominant task là: Điều khiển deicing mặt đất bằng cách ghi treatment hoàn tất theo zone, xác lập thời điểm bắt đầu anti-icing cuối và treatment code, theo dõi holdover phụ thuộc thời tiết qua taxi rồi release, reinspect hoặc retreat trước takeoff.
- Accept khi mọi region và relationship bắt buộc trong graph đều cần để hoàn thành task.
- Accept khi compact giữ task, state và recovery bằng replacement topology thay vì stack box desktop.

### Reject

- Reject `stage-gated-process-record`; đây là bằng chứng `AR-ADHCB-90` và phải route sang archetype kề.
- Reject `permit-to-work-isolation-control-room`; đây là bằng chứng `AR-ADHCB-91` và phải route sang archetype kề.
- Reject `timeline-status-monitor`; đây là bằng chứng `AR-ADHCB-92` và phải route sang archetype kề.
- Reject `appointment-booking-flow`; đây là bằng chứng `AR-ADHCB-93` và phải route sang archetype kề.

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
| [W3C WAI — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Nghĩa vụ accessibility cho reflow, focus, trạng thái và tương tác tương đương. | Không chọn archetype, không định nghĩa product truth và không cho phép sao chép geometry. |
| [Transport Canada current holdover-time guidelines](https://tc.canada.ca/en/aviation/general-operating-flight-rules/holdover-time-hot-guidelines-icing-anti-icing-aircraft) | Quan hệ nghiệp vụ chính thức và boundary quyền hạn đặc thù cho dominant task. | Không chọn archetype, không định nghĩa product truth và không cho phép sao chép geometry. |
| [EASA ground-handling deicing rules](https://www.easa.europa.eu/en/document-library/easy-access-rules/online-publications/easy-access-rules-ground-handling?erules-id=ERULES-1963177438-23680) | Quan hệ nghiệp vụ chính thức và boundary quyền hạn đặc thù cho dominant task. | Không chọn archetype, không định nghĩa product truth và không cho phép sao chép geometry. |

Tập nguồn gồm ít nhất ba tổ chức chính thức độc lập và bằng chứng accessibility của W3C.

## Output

```json
{
  "archetypeId": "aircraft-deicing-holdover-control-board",
  "situationCodes": [
    "<matched AR-ADHCB-* codes>"
  ],
  "searchAliases": [
    "aircraft deicing holdover control",
    "aircraft deicing holdover control workspace",
    "aircraft deicing holdover control control"
  ],
  "dominantTask": "Control aircraft ground deicing by recording zone-complete treatment, establishing the final anti-icing start and treatment code, tracking weather-sensitive holdover allowance through taxi and releasing, reinspecting or retreating before takeoff.",
  "regions": [
    "deicing-control",
    "winter-program-fluid-and-weather-authority",
    "aircraft-treatment-queue",
    "selected-aircraft-critical-surface-and-treatment-plan",
    "zone-by-zone-application-record",
    "anti-icing-code-and-hot-start",
    "dynamic-hot-allowance-clock",
    "taxi-takeoff-sequence",
    "pre-takeoff-contamination-check",
    "release-reinspect-or-retreat",
    "treatment-and-expiry-audit"
  ],
  "regionRelationships": [
    "physical treatment completion, current precipitation/fluid limits and the takeoff sequence jointly determine protection validity."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "deicing-control -> winter-program-fluid-and-weather-authority -> aircraft-treatment-queue -> selected-aircraft-critical-surface-and-treatment-plan -> zone-by-zone-application-record -> anti-icing-code-and-hot-start -> dynamic-hot-allowance-clock -> taxi-takeoff-sequence -> pre-takeoff-contamination-check -> release-reinspect-or-retreat -> treatment-and-expiry-audit",
    "navigationReplacement": "<none or named evidence view or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "aircraft-treatment-queue",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": [
    "Weather feed live/stale/changed-category",
    "fluid table current/superseded",
    "zone untreated/in-progress/complete/recontaminated",
    "treatment code incomplete/valid",
    "holdover not-started/active/near-limit/expired/indeterminate",
    "taxi sequence on-time/delayed",
    "check not-required/due/passed/failed",
    "release blocked/granted/revoked",
    "retreat queued/in-progress/complete",
    "audit record reconciled"
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

