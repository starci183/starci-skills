# Vessel damage stability response workbench

## LOADS

None.

## Record

### Identity

| Trường | Giá trị |
|---|---|
| Archetype ID | `vessel-damage-stability-response-workbench` |
| Family | Work |
| Dominant task | Đánh giá một casualty ngập nước, dự báo mất sức nổi và ổn định tăng dần, so sánh đóng, bơm, ballast hoặc counter-flooding rồi ban hành ứng phó sống còn mà không tạo đường lan truyền xấu hơn. |
| Search aliases | `vessel damage stability response`, `vessel damage stability response workspace`, `vessel damage stability response control` |
| Authority | Macro topology dùng chung và trung lập sản phẩm; Grammar sở hữu ngữ nghĩa sản phẩm, Principles sở hữu geometry chưa giải quyết và Direction sở hữu visual character. |

### Invariants

- Đánh giá một casualty ngập nước, dự báo mất sức nổi và ổn định tăng dần, so sánh đóng, bơm, ballast hoặc counter-flooding rồi ban hành ứng phó sống còn mà không tạo đường lan truyền xấu hơn.
- Mọi vùng bắt buộc tạo thành một chuỗi bằng chứng đến quyết định có thể truy vết; đầu ra trung gian không tự đóng task.
- Mỗi vùng bắt buộc giữ owner riêng và cùng selected context.
- Wide, intermediate và compact giữ DOM, reading/focus order có nghĩa, action parity và recovery xác định.

## Recognition

### Situation codes

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-VDSRW-01` | Dominant task là outcome quan sát được bắt buộc. | Bằng chứng bắt buộc. |
| `AR-VDSRW-02` | Toàn bộ region graph và quan hệ đã đặt tên là cần thiết. | Bằng chứng bắt buộc. |
| `AR-VDSRW-03` | Compact giữ action, state, recovery và nghĩa focus của wide. | Bằng chứng bắt buộc. |
| `AR-VDSRW-04` | State đặc thù task có thể đổi sau khi người dùng tạo work state. | Bằng chứng bắt buộc. |
| `AR-VDSRW-90` | Dominant task thực ra là `load-and-balance-packing-workbench`. | Reject. |
| `AR-VDSRW-91` | Dominant task thực ra là `process-mass-balance-analyzer`. | Reject. |
| `AR-VDSRW-92` | Dominant task thực ra là `live-operations-command-center`. | Reject. |
| `AR-VDSRW-93` | Dominant task thực ra là `risk-bow-tie-control-overview`. | Reject. |

### Selection rule

Chọn `vessel-damage-stability-response-workbench` khi và chỉ khi `AR-VDSRW-01` đến `AR-VDSRW-04` có bằng chứng và không mã nào từ `AR-VDSRW-90` đến `AR-VDSRW-93` đúng. Trả `needs-evidence` khi owner hoặc relationship chưa được giải quyết; trả `reject` khi có rejection code.

## Region graph

```text
damage-stability-response → vessel-loading-and-sea-condition → watertight-compartment-topology ↔ flooding-source-opening-pump-and-closure-state → hydrostatic-heel-trim-free-surface-envelope → progressive-flooding-scenario-tree → candidate-response-sequence → action-side-effect-and-stability-forecast → commander-go-no-go-decision → executed-action-and-residual-survivability-log
```

### Region obligations

| Region | Nghĩa vụ owner và relationship |
|---|---|
| `damage-stability-response` | Sở hữu dominant task, toàn bộ trạng thái hậu duệ và boundary recovery. |
| `vessel-loading-and-sea-condition` | Sở hữu bằng chứng hoặc hành động của Vessel Loading And Sea Condition và giữ quan hệ đã khai báo với selection hiện tại. |
| `watertight-compartment-topology` | Sở hữu bằng chứng hoặc hành động của Watertight Compartment Topology và giữ quan hệ đã khai báo với selection hiện tại. |
| `flooding-source-opening-pump-and-closure-state` | Sở hữu bằng chứng hoặc hành động của Flooding Source Opening Pump And Closure State và giữ quan hệ đã khai báo với selection hiện tại. |
| `hydrostatic-heel-trim-free-surface-envelope` | Sở hữu bằng chứng hoặc hành động của Hydrostatic Heel Trim Free Surface Envelope và giữ quan hệ đã khai báo với selection hiện tại. |
| `progressive-flooding-scenario-tree` | Sở hữu bằng chứng hoặc hành động của Progressive Flooding Scenario Tree và giữ quan hệ đã khai báo với selection hiện tại. |
| `candidate-response-sequence` | Sở hữu bằng chứng hoặc hành động của Candidate Response Sequence và giữ quan hệ đã khai báo với selection hiện tại. |
| `action-side-effect-and-stability-forecast` | Sở hữu bằng chứng hoặc hành động của Action Side Effect And Stability Forecast và giữ quan hệ đã khai báo với selection hiện tại. |
| `commander-go-no-go-decision` | Sở hữu bằng chứng hoặc hành động của Commander Go No Go Decision và giữ quan hệ đã khai báo với selection hiện tại. |
| `executed-action-and-residual-survivability-log` | Sở hữu bằng chứng hoặc hành động của Executed Action And Residual Survivability Log và giữ quan hệ đã khai báo với selection hiện tại. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi các vùng đồng thời không còn giữ được label dễ đọc, liên kết chính xác và action đầy đủ.
- **Topology response:** Sơ đồ khoang, opening/pump, envelope ổn định, cây kịch bản và dự báo ứng phó luôn thấy được; chỉ sơ đồ khoang sở hữu pan/zoom có giới hạn.
- **Navigation replacement:** Không có khi mọi vùng bắt buộc vẫn đồng thời dùng được.
- **Sticky boundary:** Chỉ trạng thái hoặc action của task hiện tại được persist; nó dành chỗ và yield khi chiều cao ngắn.
- **Overflow owner:** `watertight-compartment-topology` sở hữu overflow có giới hạn; page không sở hữu overflow ngang.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi vùng hỗ trợ ưu tiên thấp nhất làm quan hệ chính không còn dùng được.
- **Topology response:** Đường ngập đã chọn và tóm tắt ổn định dư là chính; bằng chứng khoang và dự báo luân phiên trong khi chuỗi hành động vẫn chỉnh sửa được.
- **Navigation replacement:** Các evidence view có tên thay vùng bị dời và giữ đúng selection cùng trigger.
- **Sticky boundary:** Verdict hiện tại chỉ persist khi target vẫn thấy được và trở lại flow khi chiều cao ngắn.
- **Overflow owner:** Owner có giới hạn của wide vẫn cục bộ; view luân phiên không tạo nested page scroll.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai vùng task không thể đồng thời giữ bằng chứng dễ đọc, target 44 px và focus không bị che.
- **Topology response:** Casualty → chuỗi khoang ảnh hưởng → opening/pump đang hoạt động → heel/trim/biên ổn định → hành động cùng tác dụng phụ → trạng thái dư dự báo → mệnh lệnh → xác minh.
- **Navigation replacement:** Primary-pane sequence có Back khôi phục selection, state, query, scroll context và đúng trigger.
- **Sticky boundary:** Action bar dành sẵn chỗ, không che focus và trở về normal flow khi chiều cao ngắn.
- **Overflow owner:** Visual có giới hạn có bản tương đương dạng chữ theo thứ tự làm representation compact chính.

### Reflow

- Semantic, DOM và meaningful focus order giữ graph: `damage-stability-response → vessel-loading-and-sea-condition → watertight-compartment-topology ↔ flooding-source-opening-pump-and-closure-state → hydrostatic-heel-trim-free-surface-envelope → progressive-flooding-scenario-tree → candidate-response-sequence → action-side-effect-and-stability-forecast → commander-go-no-go-decision → executed-action-and-residual-survivability-log`.
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

Các state đặc thù task: Vessel data loading/stale, compartment intact/flooding/flooded, boundary open/closed/failed, pump available/running/failed, sensor confirmed/uncertain, stability safe/marginal/unsafe, progressive path dormant/active, action proposed/blocked/ordered/complete, survivability improving/worsening and abandon/continue decision recorded.

| State | Region sở hữu | Nghĩa vụ |
|---|---|---|
| Initial / loading | `vessel-loading-and-sea-condition` | Nêu scope đang tải, giữ chỗ primary region và chỉ block owner lỗi. |
| Ready | `watertight-compartment-topology` | Hiện object, owner relationship, selection và action hợp lệ bằng text lẫn semantics. |
| Empty / not applicable | `watertight-compartment-topology` | Phân biệt empty thật, no-match và not-applicable rồi cung cấp next action hợp lệ. |
| Error / retry | `commander-go-no-go-decision` | Giữ context/input hợp lệ, nêu owner lỗi và cung cấp local retry. |
| Permission / unavailable | `executed-action-and-residual-survivability-log` | Giải thích restriction mà không ngụ ý bằng chứng ẩn là không tồn tại và cung cấp safe exit. |
| Pending | `executed-action-and-residual-survivability-log` | Ngăn duplicate action, giữ đúng target và announce progress mà không dời focus. |
| Success | `executed-action-and-residual-survivability-log` | Xác nhận outcome chính xác, giữ selection và cung cấp next action hoặc recovery. |
| Stale / conflict | `vessel-loading-and-sea-condition` | Giữ last-safe value, nêu version/time conflict và yêu cầu recovery rõ. |
| Focus transition | `executed-action-and-residual-survivability-log` | Chỉ dời focus vào modal hoặc error summary bắt buộc rồi trả về đúng trigger. |
| Responsive presentation | `damage-stability-response` | Giữ state, selection, query, pending result và recovery khi topology đổi. |

## Boundaries

### Accept

- Accept khi dominant task là: Đánh giá một casualty ngập nước, dự báo mất sức nổi và ổn định tăng dần, so sánh đóng, bơm, ballast hoặc counter-flooding rồi ban hành ứng phó sống còn mà không tạo đường lan truyền xấu hơn.
- Accept khi mọi region và relationship bắt buộc trong graph đều cần để hoàn thành task.
- Accept khi compact giữ task, state và recovery bằng replacement topology thay vì stack box desktop.

### Reject

- Reject `load-and-balance-packing-workbench`; đây là bằng chứng `AR-VDSRW-90` và phải route sang archetype kề.
- Reject `process-mass-balance-analyzer`; đây là bằng chứng `AR-VDSRW-91` và phải route sang archetype kề.
- Reject `live-operations-command-center`; đây là bằng chứng `AR-VDSRW-92` và phải route sang archetype kề.
- Reject `risk-bow-tie-control-overview`; đây là bằng chứng `AR-VDSRW-93` và phải route sang archetype kề.

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
| [IMO Damage Stability](https://www.imo.org/en/ourwork/safety/pages/damagestability.aspx) | Quan hệ nghiệp vụ chính thức và boundary quyền hạn đặc thù cho dominant task. | Không chọn archetype, không định nghĩa product truth và không cho phép sao chép geometry. |
| [U.S. Coast Guard Marine Safety Center technical notes](https://www.dco.uscg.mil/msc/mtn/) | Quan hệ nghiệp vụ chính thức và boundary quyền hạn đặc thù cho dominant task. | Không chọn archetype, không định nghĩa product truth và không cho phép sao chép geometry. |

Tập nguồn gồm ít nhất ba tổ chức chính thức độc lập và bằng chứng accessibility của W3C.

## Output

```json
{
  "archetypeId": "vessel-damage-stability-response-workbench",
  "situationCodes": [
    "<matched AR-VDSRW-* codes>"
  ],
  "searchAliases": [
    "vessel damage stability response",
    "vessel damage stability response workspace",
    "vessel damage stability response control"
  ],
  "dominantTask": "Assess a flooding casualty, predict progressive loss of buoyancy and stability, compare closure, pumping, ballast or counter-flooding actions and issue a survivability response without creating a worse propagation path.",
  "regions": [
    "damage-stability-response",
    "vessel-loading-and-sea-condition",
    "watertight-compartment-topology",
    "flooding-source-opening-pump-and-closure-state",
    "hydrostatic-heel-trim-free-surface-envelope",
    "progressive-flooding-scenario-tree",
    "candidate-response-sequence",
    "action-side-effect-and-stability-forecast",
    "commander-go-no-go-decision",
    "executed-action-and-residual-survivability-log"
  ],
  "regionRelationships": [
    "physical subdivision, dynamic flooding paths and recalculated stability jointly own the response."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "damage-stability-response -> vessel-loading-and-sea-condition -> watertight-compartment-topology -> flooding-source-opening-pump-and-closure-state -> hydrostatic-heel-trim-free-surface-envelope -> progressive-flooding-scenario-tree -> candidate-response-sequence -> action-side-effect-and-stability-forecast -> commander-go-no-go-decision -> executed-action-and-residual-survivability-log",
    "navigationReplacement": "<none or named evidence view or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "watertight-compartment-topology",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": [
    "Vessel data loading/stale",
    "compartment intact/flooding/flooded",
    "boundary open/closed/failed",
    "pump available/running/failed",
    "sensor confirmed/uncertain",
    "stability safe/marginal/unsafe",
    "progressive path dormant/active",
    "action proposed/blocked/ordered/complete",
    "survivability improving/worsening",
    "abandon/continue decision recorded"
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

