# Transport demand assignment modeling workbench

## LOADS

None.

## Record

### Identity

| Trường | Giá trị |
|---|---|
| Archetype ID | `transport-demand-assignment-modeling-workbench` |
| Family | Work |
| Dominant task | Hiệu chỉnh và so sánh transport demand assignment bằng cách nạp supply mạng và OD demand, sinh route-choice set, lặp flow tới hội tụ và đối soát modeled link volume với count quan sát. |
| Search aliases | `transport demand assignment modeling`, `transport demand assignment modeling workspace`, `transport demand assignment modeling control` |
| Authority | Macro topology dùng chung và trung lập sản phẩm; Grammar sở hữu ngữ nghĩa sản phẩm, Principles sở hữu geometry chưa giải quyết và Direction sở hữu visual character. |

### Invariants

- Hiệu chỉnh và so sánh transport demand assignment bằng cách nạp supply mạng và OD demand, sinh route-choice set, lặp flow tới hội tụ và đối soát modeled link volume với count quan sát.
- Mọi vùng bắt buộc tạo thành một chuỗi bằng chứng đến quyết định có thể truy vết; đầu ra trung gian không tự đóng task.
- Mỗi vùng bắt buộc giữ owner riêng và cùng selected context.
- Wide, intermediate và compact giữ DOM, reading/focus order có nghĩa, action parity và recovery xác định.

## Recognition

### Situation codes

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-TDAMW-01` | Dominant task là outcome quan sát được bắt buộc. | Bằng chứng bắt buộc. |
| `AR-TDAMW-02` | Toàn bộ region graph và quan hệ đã đặt tên là cần thiết. | Bằng chứng bắt buộc. |
| `AR-TDAMW-03` | Compact giữ action, state, recovery và nghĩa focus của wide. | Bằng chứng bắt buộc. |
| `AR-TDAMW-04` | State đặc thù task có thể đổi sau khi người dùng tạo work state. | Bằng chứng bắt buộc. |
| `AR-TDAMW-90` | Dominant task thực ra là `pivot-table-analytics-workbench`. | Reject. |
| `AR-TDAMW-91` | Dominant task thực ra là `scenario-sensitivity-explorer`. | Reject. |
| `AR-TDAMW-92` | Dominant task thực ra là `process-mass-balance-analyzer`. | Reject. |
| `AR-TDAMW-93` | Dominant task thực ra là `map-led-situation-monitor`. | Reject. |

### Selection rule

Chọn `transport-demand-assignment-modeling-workbench` khi và chỉ khi `AR-TDAMW-01` đến `AR-TDAMW-04` có bằng chứng và không mã nào từ `AR-TDAMW-90` đến `AR-TDAMW-93` đúng. Trả `needs-evidence` khi owner hoặc relationship chưa được giải quyết; trả `reject` khi có rejection code.

## Region graph

```text
demand-assignment-model → model-purpose-period-and-version → network-supply-cost-and-capacity-graph ↔ origin-destination-demand-cube → route-choice-and-path-set-builder → iterative-assignment-and-cost-feedback-loop → convergence-and-gap-diagnostics → modeled-link-flow-vs-observed-count-residuals → demand-cost-or-capacity-calibration → base-and-scenario-comparison → validated-model-release
```

### Region obligations

| Region | Nghĩa vụ owner và relationship |
|---|---|
| `demand-assignment-model` | Sở hữu dominant task, toàn bộ trạng thái hậu duệ và boundary recovery. |
| `model-purpose-period-and-version` | Sở hữu bằng chứng hoặc hành động của Model Purpose Period And Version và giữ quan hệ đã khai báo với selection hiện tại. |
| `network-supply-cost-and-capacity-graph` | Sở hữu bằng chứng hoặc hành động của Network Supply Cost And Capacity Graph và giữ quan hệ đã khai báo với selection hiện tại. |
| `origin-destination-demand-cube` | Sở hữu bằng chứng hoặc hành động của Origin Destination Demand Cube và giữ quan hệ đã khai báo với selection hiện tại. |
| `route-choice-and-path-set-builder` | Sở hữu bằng chứng hoặc hành động của Route Choice And Path Set Builder và giữ quan hệ đã khai báo với selection hiện tại. |
| `iterative-assignment-and-cost-feedback-loop` | Sở hữu bằng chứng hoặc hành động của Iterative Assignment And Cost Feedback Loop và giữ quan hệ đã khai báo với selection hiện tại. |
| `convergence-and-gap-diagnostics` | Sở hữu bằng chứng hoặc hành động của Convergence And Gap Diagnostics và giữ quan hệ đã khai báo với selection hiện tại. |
| `modeled-link-flow-vs-observed-count-residuals` | Sở hữu bằng chứng hoặc hành động của Modeled Link Flow Vs Observed Count Residuals và giữ quan hệ đã khai báo với selection hiện tại. |
| `demand-cost-or-capacity-calibration` | Sở hữu bằng chứng hoặc hành động của Demand Cost Or Capacity Calibration và giữ quan hệ đã khai báo với selection hiện tại. |
| `base-and-scenario-comparison` | Sở hữu bằng chứng hoặc hành động của Base And Scenario Comparison và giữ quan hệ đã khai báo với selection hiện tại. |
| `validated-model-release` | Sở hữu bằng chứng hoặc hành động của Validated Model Release và giữ quan hệ đã khai báo với selection hiện tại. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi các vùng đồng thời không còn giữ được label dễ đọc, liên kết chính xác và action đầy đủ.
- **Topology response:** Supply network, OD slice, path set, iteration diagnostic, residual modeled/observed và scenario comparison cùng kiểm tra được; chỉ network viewport và diagnostic table có giới hạn sở hữu overflow cục bộ.
- **Navigation replacement:** Không có khi mọi vùng bắt buộc vẫn đồng thời dùng được.
- **Sticky boundary:** Chỉ trạng thái hoặc action của task hiện tại được persist; nó dành chỗ và yield khi chiều cao ngắn.
- **Overflow owner:** `network-supply-cost-and-capacity-graph` sở hữu overflow có giới hạn; page không sở hữu overflow ngang.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi vùng hỗ trợ ưu tiên thấp nhất làm quan hệ chính không còn dùng được.
- **Topology response:** OD pair/link và iteration đã chọn được ghim; network/path evidence và convergence/calibration evidence luân phiên, còn release fitness thấy được.
- **Navigation replacement:** Các evidence view có tên thay vùng bị dời và giữ đúng selection cùng trigger.
- **Sticky boundary:** Verdict hiện tại chỉ persist khi target vẫn thấy được và trở lại flow khi chiều cao ngắn.
- **Overflow owner:** Owner có giới hạn của wide vẫn cục bộ; view luân phiên không tạo nested page scroll.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai vùng task không thể đồng thời giữ bằng chứng dễ đọc, target 44 px và focus không bị che.
- **Topology response:** Mục đích model → demand slice và supply assumption → candidate path → cost/flow feedback → convergence gap → residual xấu nhất → calibration change → base/scenario delta → validate/reject.
- **Navigation replacement:** Primary-pane sequence có Back khôi phục selection, state, query, scroll context và đúng trigger.
- **Sticky boundary:** Action bar dành sẵn chỗ, không che focus và trở về normal flow khi chiều cao ngắn.
- **Overflow owner:** Visual có giới hạn có bản tương đương dạng chữ theo thứ tự làm representation compact chính.

### Reflow

- Semantic, DOM và meaningful focus order giữ graph: `demand-assignment-model → model-purpose-period-and-version → network-supply-cost-and-capacity-graph ↔ origin-destination-demand-cube → route-choice-and-path-set-builder → iterative-assignment-and-cost-feedback-loop → convergence-and-gap-diagnostics → modeled-link-flow-vs-observed-count-residuals → demand-cost-or-capacity-calibration → base-and-scenario-comparison → validated-model-release`.
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

Các state đặc thù task: Supply loading/current/stale, OD matrix missing/calibrated/changed, path set empty/generated/pruned, iteration queued/running/converged/diverged/cancelled, cost feedback stable/oscillating, count observation valid/suspect/excluded, residual within/outside threshold, calibration proposed/applied/rolled-back, scenario comparable/incompatible and model draft/validated/released/superseded.

| State | Region sở hữu | Nghĩa vụ |
|---|---|---|
| Initial / loading | `model-purpose-period-and-version` | Nêu scope đang tải, giữ chỗ primary region và chỉ block owner lỗi. |
| Ready | `network-supply-cost-and-capacity-graph` | Hiện object, owner relationship, selection và action hợp lệ bằng text lẫn semantics. |
| Empty / not applicable | `network-supply-cost-and-capacity-graph` | Phân biệt empty thật, no-match và not-applicable rồi cung cấp next action hợp lệ. |
| Error / retry | `base-and-scenario-comparison` | Giữ context/input hợp lệ, nêu owner lỗi và cung cấp local retry. |
| Permission / unavailable | `validated-model-release` | Giải thích restriction mà không ngụ ý bằng chứng ẩn là không tồn tại và cung cấp safe exit. |
| Pending | `validated-model-release` | Ngăn duplicate action, giữ đúng target và announce progress mà không dời focus. |
| Success | `validated-model-release` | Xác nhận outcome chính xác, giữ selection và cung cấp next action hoặc recovery. |
| Stale / conflict | `model-purpose-period-and-version` | Giữ last-safe value, nêu version/time conflict và yêu cầu recovery rõ. |
| Focus transition | `validated-model-release` | Chỉ dời focus vào modal hoặc error summary bắt buộc rồi trả về đúng trigger. |
| Responsive presentation | `demand-assignment-model` | Giữ state, selection, query, pending result và recovery khi topology đổi. |

## Boundaries

### Accept

- Accept khi dominant task là: Hiệu chỉnh và so sánh transport demand assignment bằng cách nạp supply mạng và OD demand, sinh route-choice set, lặp flow tới hội tụ và đối soát modeled link volume với count quan sát.
- Accept khi mọi region và relationship bắt buộc trong graph đều cần để hoàn thành task.
- Accept khi compact giữ task, state và recovery bằng replacement topology thay vì stack box desktop.

### Reject

- Reject `pivot-table-analytics-workbench`; đây là bằng chứng `AR-TDAMW-90` và phải route sang archetype kề.
- Reject `scenario-sensitivity-explorer`; đây là bằng chứng `AR-TDAMW-91` và phải route sang archetype kề.
- Reject `process-mass-balance-analyzer`; đây là bằng chứng `AR-TDAMW-92` và phải route sang archetype kề.
- Reject `map-led-situation-monitor`; đây là bằng chứng `AR-TDAMW-93` và phải route sang archetype kề.

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
| [FHWA dynamic traffic assignment modeling guidance](https://ops.fhwa.dot.gov/publications/fhwahop13015/sec4.htm) | Quan hệ nghiệp vụ chính thức và boundary quyền hạn đặc thù cho dominant task. | Không chọn archetype, không định nghĩa product truth và không cho phép sao chép geometry. |
| [UK Department for Transport TAG assignment-modeling guidance](https://www.gov.uk/government/publications/tag-unit-m3-1-highway-assignment-modelling) | Quan hệ nghiệp vụ chính thức và boundary quyền hạn đặc thù cho dominant task. | Không chọn archetype, không định nghĩa product truth và không cho phép sao chép geometry. |

Tập nguồn gồm ít nhất ba tổ chức chính thức độc lập và bằng chứng accessibility của W3C.

## Output

```json
{
  "archetypeId": "transport-demand-assignment-modeling-workbench",
  "situationCodes": [
    "<matched AR-TDAMW-* codes>"
  ],
  "searchAliases": [
    "transport demand assignment modeling",
    "transport demand assignment modeling workspace",
    "transport demand assignment modeling control"
  ],
  "dominantTask": "Calibrate and compare transport demand assignment by loading network supply and origin-destination demand, generating route-choice sets, iterating flows toward convergence and reconciling modeled link volumes against observed counts.",
  "regions": [
    "demand-assignment-model",
    "model-purpose-period-and-version",
    "network-supply-cost-and-capacity-graph",
    "origin-destination-demand-cube",
    "route-choice-and-path-set-builder",
    "iterative-assignment-and-cost-feedback-loop",
    "convergence-and-gap-diagnostics",
    "modeled-link-flow-vs-observed-count-residuals",
    "demand-cost-or-capacity-calibration",
    "base-and-scenario-comparison",
    "validated-model-release"
  ],
  "regionRelationships": [
    "OD demand, congested network costs, chosen paths and observed-count residuals participate in one reproducible equilibrium loop."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "demand-assignment-model -> model-purpose-period-and-version -> network-supply-cost-and-capacity-graph -> origin-destination-demand-cube -> route-choice-and-path-set-builder -> iterative-assignment-and-cost-feedback-loop -> convergence-and-gap-diagnostics -> modeled-link-flow-vs-observed-count-residuals -> demand-cost-or-capacity-calibration -> base-and-scenario-comparison -> validated-model-release",
    "navigationReplacement": "<none or named evidence view or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "network-supply-cost-and-capacity-graph",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": [
    "Supply loading/current/stale",
    "OD matrix missing/calibrated/changed",
    "path set empty/generated/pruned",
    "iteration queued/running/converged/diverged/cancelled",
    "cost feedback stable/oscillating",
    "count observation valid/suspect/excluded",
    "residual within/outside threshold",
    "calibration proposed/applied/rolled-back",
    "scenario comparable/incompatible",
    "model draft/validated/released/superseded"
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

