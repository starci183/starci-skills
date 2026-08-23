# Search and rescue coverage planner

## LOADS

None.

## Record

### Identity

| Trường | Giá trị |
|---|---|
| Archetype ID | `search-and-rescue-coverage-planner` |
| Family | Work |
| Dominant task | Chuyển bằng chứng vị trí cuối cùng và drift bất định thành vùng xác suất, phân bổ effort/pattern theo sensor, rồi cập nhật phân bố xác suất và lần tìm tiếp theo sau sighting hoặc coverage âm. |
| Search aliases | `search and rescue coverage`, `search and rescue coverage workspace`, `search and rescue coverage control` |
| Authority | Macro topology dùng chung và trung lập sản phẩm; Grammar sở hữu ngữ nghĩa sản phẩm, Principles sở hữu geometry chưa giải quyết và Direction sở hữu visual character. |

### Invariants

- Chuyển bằng chứng vị trí cuối cùng và drift bất định thành vùng xác suất, phân bổ effort/pattern theo sensor, rồi cập nhật phân bố xác suất và lần tìm tiếp theo sau sighting hoặc coverage âm.
- Mọi vùng bắt buộc tạo thành một chuỗi bằng chứng đến quyết định có thể truy vết; đầu ra trung gian không tự đóng task.
- Mỗi vùng bắt buộc giữ owner riêng và cùng selected context.
- Wide, intermediate và compact giữ DOM, reading/focus order có nghĩa, action parity và recovery xác định.

## Recognition

### Situation codes

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-SARCP-01` | Dominant task là outcome quan sát được bắt buộc. | Bằng chứng bắt buộc. |
| `AR-SARCP-02` | Toàn bộ region graph và quan hệ đã đặt tên là cần thiết. | Bằng chứng bắt buộc. |
| `AR-SARCP-03` | Compact giữ action, state, recovery và nghĩa focus của wide. | Bằng chứng bắt buộc. |
| `AR-SARCP-04` | State đặc thù task có thể đổi sau khi người dùng tạo work state. | Bằng chứng bắt buộc. |
| `AR-SARCP-90` | Dominant task thực ra là `fleet-route-dispatch-planner`. | Reject. |
| `AR-SARCP-91` | Dominant task thực ra là `map-led-situation-monitor`. | Reject. |
| `AR-SARCP-92` | Dominant task thực ra là `capacity-allocation-overview`. | Reject. |
| `AR-SARCP-93` | Dominant task thực ra là `orbital-conjunction-assessment-workbench`. | Reject. |

### Selection rule

Chọn `search-and-rescue-coverage-planner` khi và chỉ khi `AR-SARCP-01` đến `AR-SARCP-04` có bằng chứng và không mã nào từ `AR-SARCP-90` đến `AR-SARCP-93` đúng. Trả `needs-evidence` khi owner hoặc relationship chưa được giải quyết; trả `reject` khi có rejection code.

## Region graph

```text
sar-coverage-planner → incident-object-survival-and-environment-context → scenario-weight-and-drift-particle-surface → probability-area-segmentation ↔ search-unit-sensor-endurance-register → pattern-track-spacing-and-effort-generator → coverage-pod-pos-calculation → asset-area-assignment-and-brief → executed-track-sighting-or-negative-result → posterior-redistribution-and-next-search-plan
```

### Region obligations

| Region | Nghĩa vụ owner và relationship |
|---|---|
| `sar-coverage-planner` | Sở hữu dominant task, toàn bộ trạng thái hậu duệ và boundary recovery. |
| `incident-object-survival-and-environment-context` | Sở hữu bằng chứng hoặc hành động của Incident Object Survival And Environment Context và giữ quan hệ đã khai báo với selection hiện tại. |
| `scenario-weight-and-drift-particle-surface` | Sở hữu bằng chứng hoặc hành động của Scenario Weight And Drift Particle Surface và giữ quan hệ đã khai báo với selection hiện tại. |
| `probability-area-segmentation` | Sở hữu bằng chứng hoặc hành động của Probability Area Segmentation và giữ quan hệ đã khai báo với selection hiện tại. |
| `search-unit-sensor-endurance-register` | Sở hữu bằng chứng hoặc hành động của Search Unit Sensor Endurance Register và giữ quan hệ đã khai báo với selection hiện tại. |
| `pattern-track-spacing-and-effort-generator` | Sở hữu bằng chứng hoặc hành động của Pattern Track Spacing And Effort Generator và giữ quan hệ đã khai báo với selection hiện tại. |
| `coverage-pod-pos-calculation` | Sở hữu bằng chứng hoặc hành động của Coverage Pod Pos Calculation và giữ quan hệ đã khai báo với selection hiện tại. |
| `asset-area-assignment-and-brief` | Sở hữu bằng chứng hoặc hành động của Asset Area Assignment And Brief và giữ quan hệ đã khai báo với selection hiện tại. |
| `executed-track-sighting-or-negative-result` | Sở hữu bằng chứng hoặc hành động của Executed Track Sighting Or Negative Result và giữ quan hệ đã khai báo với selection hiện tại. |
| `posterior-redistribution-and-next-search-plan` | Sở hữu bằng chứng hoặc hành động của Posterior Redistribution And Next Search Plan và giữ quan hệ đã khai báo với selection hiện tại. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi các vùng đồng thời không còn giữ được label dễ đọc, liên kết chính xác và action đầy đủ.
- **Topology response:** Bề mặt xác suất, trọng số kịch bản, register asset/sensor, pattern sinh ra, phép tính coverage và kế hoạch phân công cùng hiện diện; chỉ bản đồ xác suất sở hữu pan/zoom có giới hạn.
- **Navigation replacement:** Không có khi mọi vùng bắt buộc vẫn đồng thời dùng được.
- **Sticky boundary:** Chỉ trạng thái hoặc action của task hiện tại được persist; nó dành chỗ và yield khi chiều cao ngắn.
- **Overflow owner:** `sar-coverage-planner` sở hữu overflow có giới hạn; page không sở hữu overflow ngang.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi vùng hỗ trợ ưu tiên thấp nhất làm quan hệ chính không còn dùng được.
- **Topology response:** Vùng xác suất đã chọn là chính; map/pattern và phép tính asset/coverage luân phiên, còn briefing và POS tích lũy vẫn tồn tại.
- **Navigation replacement:** Các evidence view có tên thay vùng bị dời và giữ đúng selection cùng trigger.
- **Sticky boundary:** Verdict hiện tại chỉ persist khi target vẫn thấy được và trở lại flow khi chiều cao ngắn.
- **Overflow owner:** Owner có giới hạn của wide vẫn cục bộ; view luân phiên không tạo nested page scroll.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai vùng task không thể đồng thời giữ bằng chứng dễ đọc, target 44 px và focus không bị che.
- **Topology response:** Bằng chứng sự cố → tóm tắt scenario/drift → vùng xác suất xếp hạng → sensor/endurance sẵn có → effort/pattern đề xuất → POD/POS → assign/brief → kết quả → posterior phân phối lại.
- **Navigation replacement:** Primary-pane sequence có Back khôi phục selection, state, query, scroll context và đúng trigger.
- **Sticky boundary:** Action bar dành sẵn chỗ, không che focus và trở về normal flow khi chiều cao ngắn.
- **Overflow owner:** Visual có giới hạn có bản tương đương dạng chữ theo thứ tự làm representation compact chính.

### Reflow

- Semantic, DOM và meaningful focus order giữ graph: `sar-coverage-planner → incident-object-survival-and-environment-context → scenario-weight-and-drift-particle-surface → probability-area-segmentation ↔ search-unit-sensor-endurance-register → pattern-track-spacing-and-effort-generator → coverage-pod-pos-calculation → asset-area-assignment-and-brief → executed-track-sighting-or-negative-result → posterior-redistribution-and-next-search-plan`.
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

Các state đặc thù task: Environmental data loading/stale, scenario active/discounted, drift computed/uncertain, asset available/en route/on scene/exhausted, pattern draft/assigned/executing/complete, coverage insufficient/adequate, sighting unverified/confirmed/false, negative search posted, posterior recalculating, next plan feasible/resource-short and case suspended/resolved.

| State | Region sở hữu | Nghĩa vụ |
|---|---|---|
| Initial / loading | `incident-object-survival-and-environment-context` | Nêu scope đang tải, giữ chỗ primary region và chỉ block owner lỗi. |
| Ready | `scenario-weight-and-drift-particle-surface` | Hiện object, owner relationship, selection và action hợp lệ bằng text lẫn semantics. |
| Empty / not applicable | `scenario-weight-and-drift-particle-surface` | Phân biệt empty thật, no-match và not-applicable rồi cung cấp next action hợp lệ. |
| Error / retry | `executed-track-sighting-or-negative-result` | Giữ context/input hợp lệ, nêu owner lỗi và cung cấp local retry. |
| Permission / unavailable | `posterior-redistribution-and-next-search-plan` | Giải thích restriction mà không ngụ ý bằng chứng ẩn là không tồn tại và cung cấp safe exit. |
| Pending | `posterior-redistribution-and-next-search-plan` | Ngăn duplicate action, giữ đúng target và announce progress mà không dời focus. |
| Success | `posterior-redistribution-and-next-search-plan` | Xác nhận outcome chính xác, giữ selection và cung cấp next action hoặc recovery. |
| Stale / conflict | `incident-object-survival-and-environment-context` | Giữ last-safe value, nêu version/time conflict và yêu cầu recovery rõ. |
| Focus transition | `posterior-redistribution-and-next-search-plan` | Chỉ dời focus vào modal hoặc error summary bắt buộc rồi trả về đúng trigger. |
| Responsive presentation | `sar-coverage-planner` | Giữ state, selection, query, pending result và recovery khi topology đổi. |

## Boundaries

### Accept

- Accept khi dominant task là: Chuyển bằng chứng vị trí cuối cùng và drift bất định thành vùng xác suất, phân bổ effort/pattern theo sensor, rồi cập nhật phân bố xác suất và lần tìm tiếp theo sau sighting hoặc coverage âm.
- Accept khi mọi region và relationship bắt buộc trong graph đều cần để hoàn thành task.
- Accept khi compact giữ task, state và recovery bằng replacement topology thay vì stack box desktop.

### Reject

- Reject `fleet-route-dispatch-planner`; đây là bằng chứng `AR-SARCP-90` và phải route sang archetype kề.
- Reject `map-led-situation-monitor`; đây là bằng chứng `AR-SARCP-91` và phải route sang archetype kề.
- Reject `capacity-allocation-overview`; đây là bằng chứng `AR-SARCP-92` và phải route sang archetype kề.
- Reject `orbital-conjunction-assessment-workbench`; đây là bằng chứng `AR-SARCP-93` và phải route sang archetype kề.

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
| [U.S. Coast Guard SAROPS](https://www.dcms.uscg.mil/Our-Organization/Assistant-Commandant-for-Acquisitions-CG-9/International-Acquisition/SAROPS/) | Quan hệ nghiệp vụ chính thức và boundary quyền hạn đặc thù cho dominant task. | Không chọn archetype, không định nghĩa product truth và không cho phép sao chép geometry. |
| [IMO documents relevant to SAR](https://www.imo.org/en/ourwork/safety/pages/imo-documents-relevant-to-sar.aspx) | Quan hệ nghiệp vụ chính thức và boundary quyền hạn đặc thù cho dominant task. | Không chọn archetype, không định nghĩa product truth và không cho phép sao chép geometry. |

Tập nguồn gồm ít nhất ba tổ chức chính thức độc lập và bằng chứng accessibility của W3C.

## Output

```json
{
  "archetypeId": "search-and-rescue-coverage-planner",
  "situationCodes": [
    "<matched AR-SARCP-* codes>"
  ],
  "searchAliases": [
    "search and rescue coverage",
    "search and rescue coverage workspace",
    "search and rescue coverage control"
  ],
  "dominantTask": "Convert uncertain last-known evidence and drift into probability areas, allocate sensor-specific search effort and patterns, then update the probability distribution and next search after sightings or negative coverage.",
  "regions": [
    "sar-coverage-planner",
    "incident-object-survival-and-environment-context",
    "scenario-weight-and-drift-particle-surface",
    "probability-area-segmentation",
    "search-unit-sensor-endurance-register",
    "pattern-track-spacing-and-effort-generator",
    "coverage-pod-pos-calculation",
    "asset-area-assignment-and-brief",
    "executed-track-sighting-or-negative-result",
    "posterior-redistribution-and-next-search-plan"
  ],
  "regionRelationships": [
    "probability of containment, detection and cumulative search effort change after every result."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "sar-coverage-planner -> incident-object-survival-and-environment-context -> scenario-weight-and-drift-particle-surface -> probability-area-segmentation -> search-unit-sensor-endurance-register -> pattern-track-spacing-and-effort-generator -> coverage-pod-pos-calculation -> asset-area-assignment-and-brief -> executed-track-sighting-or-negative-result -> posterior-redistribution-and-next-search-plan",
    "navigationReplacement": "<none or named evidence view or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "sar-coverage-planner",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": [
    "Environmental data loading/stale",
    "scenario active/discounted",
    "drift computed/uncertain",
    "asset available/en route/on scene/exhausted",
    "pattern draft/assigned/executing/complete",
    "coverage insufficient/adequate",
    "sighting unverified/confirmed/false",
    "negative search posted",
    "posterior recalculating",
    "next plan feasible/resource-short",
    "case suspended/resolved"
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

