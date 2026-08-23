# Autonomous vehicle remote assistance console

## LOADS

None.

## Record

### Identity

| Trường | Giá trị |
|---|---|
| Archetype ID | `autonomous-vehicle-remote-assistance-console` |
| Family | Overview |
| Dominant task | Giải quyết một yêu cầu trợ giúp ADS bằng cách xác lập trạng thái xe đóng băng và ODD, xem bằng chứng đồng bộ, gửi guidance chiến lược có giới hạn và xác minh ADS tiếp tục an toàn hoặc vào minimal-risk condition. |
| Search aliases | `autonomous vehicle remote assistance`, `autonomous vehicle remote assistance workspace`, `autonomous vehicle remote assistance control` |
| Authority | Macro topology dùng chung và trung lập sản phẩm; Grammar sở hữu ngữ nghĩa sản phẩm, Principles sở hữu geometry chưa giải quyết và Direction sở hữu visual character. |

### Invariants

- Giải quyết một yêu cầu trợ giúp ADS bằng cách xác lập trạng thái xe đóng băng và ODD, xem bằng chứng đồng bộ, gửi guidance chiến lược có giới hạn và xác minh ADS tiếp tục an toàn hoặc vào minimal-risk condition.
- Mọi vùng bắt buộc tạo thành một chuỗi bằng chứng đến quyết định có thể truy vết; đầu ra trung gian không tự đóng task.
- Mỗi vùng bắt buộc giữ owner riêng và cùng selected context.
- Wide, intermediate và compact giữ DOM, reading/focus order có nghĩa, action parity và recovery xác định.

## Recognition

### Situation codes

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-AVRAC-01` | Dominant task là outcome quan sát được bắt buộc. | Bằng chứng bắt buộc. |
| `AR-AVRAC-02` | Toàn bộ region graph và quan hệ đã đặt tên là cần thiết. | Bằng chứng bắt buộc. |
| `AR-AVRAC-03` | Compact giữ action, state, recovery và nghĩa focus của wide. | Bằng chứng bắt buộc. |
| `AR-AVRAC-04` | State đặc thù task có thể đổi sau khi người dùng tạo work state. | Bằng chứng bắt buộc. |
| `AR-AVRAC-90` | Dominant task thực ra là `live-support-console`. | Reject. |
| `AR-AVRAC-91` | Dominant task thực ra là `live-operations-command-center`. | Reject. |
| `AR-AVRAC-92` | Dominant task thực ra là `fleet-route-dispatch-planner`. | Reject. |
| `AR-AVRAC-93` | Dominant task thực ra là `canvas-inspector-studio`. | Reject. |

### Selection rule

Chọn `autonomous-vehicle-remote-assistance-console` khi và chỉ khi `AR-AVRAC-01` đến `AR-AVRAC-04` có bằng chứng và không mã nào từ `AR-AVRAC-90` đến `AR-AVRAC-93` đúng. Trả `needs-evidence` khi owner hoặc relationship chưa được giải quyết; trả `reject` khi có rejection code.

## Region graph

```text
remote-assistance → exception-queue → vehicle-identity-odd-and-ads-state → frozen-help-request-and-minimal-risk-state → synchronized-scene-evidence ↔ ads-proposed-strategic-options → operator-permitted-guidance-boundary → safety-policy-and-vulnerable-road-user-check → guidance-send → ads-accept-reject-execute → resume-minimal-risk-escalate-and-event-record
```

### Region obligations

| Region | Nghĩa vụ owner và relationship |
|---|---|
| `remote-assistance` | Sở hữu dominant task, toàn bộ trạng thái hậu duệ và boundary recovery. |
| `exception-queue` | Sở hữu bằng chứng hoặc hành động của Exception Queue và giữ quan hệ đã khai báo với selection hiện tại. |
| `vehicle-identity-odd-and-ads-state` | Sở hữu bằng chứng hoặc hành động của Vehicle Identity Odd And Ads State và giữ quan hệ đã khai báo với selection hiện tại. |
| `frozen-help-request-and-minimal-risk-state` | Sở hữu bằng chứng hoặc hành động của Frozen Help Request And Minimal Risk State và giữ quan hệ đã khai báo với selection hiện tại. |
| `synchronized-scene-evidence` | Sở hữu bằng chứng hoặc hành động của Synchronized Scene Evidence và giữ quan hệ đã khai báo với selection hiện tại. |
| `ads-proposed-strategic-options` | Sở hữu bằng chứng hoặc hành động của Ads Proposed Strategic Options và giữ quan hệ đã khai báo với selection hiện tại. |
| `operator-permitted-guidance-boundary` | Sở hữu bằng chứng hoặc hành động của Operator Permitted Guidance Boundary và giữ quan hệ đã khai báo với selection hiện tại. |
| `safety-policy-and-vulnerable-road-user-check` | Sở hữu bằng chứng hoặc hành động của Safety Policy And Vulnerable Road User Check và giữ quan hệ đã khai báo với selection hiện tại. |
| `guidance-send` | Sở hữu bằng chứng hoặc hành động của Guidance Send và giữ quan hệ đã khai báo với selection hiện tại. |
| `ads-accept-reject-execute` | Sở hữu bằng chứng hoặc hành động của Ads Accept Reject Execute và giữ quan hệ đã khai báo với selection hiện tại. |
| `resume-minimal-risk-escalate-and-event-record` | Sở hữu bằng chứng hoặc hành động của Resume Minimal Risk Escalate And Event Record và giữ quan hệ đã khai báo với selection hiện tại. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi các vùng đồng thời không còn giữ được label dễ đọc, liên kết chính xác và action đầy đủ.
- **Topology response:** Hàng đợi exception, trạng thái vehicle/ODD, bằng chứng hiện trường đồng bộ, đề xuất ADS, boundary guidance và xác nhận execution cùng thấy được; chỉ evidence viewport sở hữu pan/zoom.
- **Navigation replacement:** Không có khi mọi vùng bắt buộc vẫn đồng thời dùng được.
- **Sticky boundary:** Chỉ trạng thái hoặc action của task hiện tại được persist; nó dành chỗ và yield khi chiều cao ngắn.
- **Overflow owner:** `exception-queue` sở hữu overflow có giới hạn; page không sở hữu overflow ngang.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi vùng hỗ trợ ưu tiên thấp nhất làm quan hệ chính không còn dùng được.
- **Topology response:** Trạng thái xe và help request được ghim; scene evidence và strategic-option evidence luân phiên, còn scope guidance và trạng thái minimal-risk tồn tại.
- **Navigation replacement:** Các evidence view có tên thay vùng bị dời và giữ đúng selection cùng trigger.
- **Sticky boundary:** Verdict hiện tại chỉ persist khi target vẫn thấy được và trở lại flow khi chiều cao ngắn.
- **Overflow owner:** Owner có giới hạn của wide vẫn cục bộ; view luân phiên không tạo nested page scroll.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai vùng task không thể đồng thời giữ bằng chứng dễ đọc, target 44 px và focus không bị che.
- **Topology response:** Help request → trạng thái ADS/ODD đóng băng → scene facts → ADS options → strategic guidance được phép → kiểm tra vulnerable road user → gửi → ADS accept/reject → resume hoặc minimal-risk.
- **Navigation replacement:** Primary-pane sequence có Back khôi phục selection, state, query, scroll context và đúng trigger.
- **Sticky boundary:** Action bar dành sẵn chỗ, không che focus và trở về normal flow khi chiều cao ngắn.
- **Overflow owner:** Visual có giới hạn có bản tương đương dạng chữ theo thứ tự làm representation compact chính.

### Reflow

- Semantic, DOM và meaningful focus order giữ graph: `remote-assistance → exception-queue → vehicle-identity-odd-and-ads-state → frozen-help-request-and-minimal-risk-state → synchronized-scene-evidence ↔ ads-proposed-strategic-options → operator-permitted-guidance-boundary → safety-policy-and-vulnerable-road-user-check → guidance-send → ads-accept-reject-execute → resume-minimal-risk-escalate-and-event-record`.
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

Các state đặc thù task: Request new/triaged/claimed, telemetry live/stale/lost, scene evidence synchronized/lagging/incomplete, ADS engaged/degraded/stopped/minimal-risk, ODD inside/edge/outside, proposal available/unsafe/ambiguous, guidance draft/blocked/sent, ADS accepted/rejected/executing, vulnerable-road-user clear/uncertain/present, resume verified/failed and escalation transferred/acknowledged.

| State | Region sở hữu | Nghĩa vụ |
|---|---|---|
| Initial / loading | `exception-queue` | Nêu scope đang tải, giữ chỗ primary region và chỉ block owner lỗi. |
| Ready | `vehicle-identity-odd-and-ads-state` | Hiện object, owner relationship, selection và action hợp lệ bằng text lẫn semantics. |
| Empty / not applicable | `vehicle-identity-odd-and-ads-state` | Phân biệt empty thật, no-match và not-applicable rồi cung cấp next action hợp lệ. |
| Error / retry | `ads-accept-reject-execute` | Giữ context/input hợp lệ, nêu owner lỗi và cung cấp local retry. |
| Permission / unavailable | `resume-minimal-risk-escalate-and-event-record` | Giải thích restriction mà không ngụ ý bằng chứng ẩn là không tồn tại và cung cấp safe exit. |
| Pending | `resume-minimal-risk-escalate-and-event-record` | Ngăn duplicate action, giữ đúng target và announce progress mà không dời focus. |
| Success | `resume-minimal-risk-escalate-and-event-record` | Xác nhận outcome chính xác, giữ selection và cung cấp next action hoặc recovery. |
| Stale / conflict | `exception-queue` | Giữ last-safe value, nêu version/time conflict và yêu cầu recovery rõ. |
| Focus transition | `resume-minimal-risk-escalate-and-event-record` | Chỉ dời focus vào modal hoặc error summary bắt buộc rồi trả về đúng trigger. |
| Responsive presentation | `remote-assistance` | Giữ state, selection, query, pending result và recovery khi topology đổi. |

## Boundaries

### Accept

- Accept khi dominant task là: Giải quyết một yêu cầu trợ giúp ADS bằng cách xác lập trạng thái xe đóng băng và ODD, xem bằng chứng đồng bộ, gửi guidance chiến lược có giới hạn và xác minh ADS tiếp tục an toàn hoặc vào minimal-risk condition.
- Accept khi mọi region và relationship bắt buộc trong graph đều cần để hoàn thành task.
- Accept khi compact giữ task, state và recovery bằng replacement topology thay vì stack box desktop.

### Reject

- Reject `live-support-console`; đây là bằng chứng `AR-AVRAC-90` và phải route sang archetype kề.
- Reject `live-operations-command-center`; đây là bằng chứng `AR-AVRAC-91` và phải route sang archetype kề.
- Reject `fleet-route-dispatch-planner`; đây là bằng chứng `AR-AVRAC-92` và phải route sang archetype kề.
- Reject `canvas-inspector-studio`; đây là bằng chứng `AR-AVRAC-93` và phải route sang archetype kề.

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
| [UNECE remote-management terminology for automated driving](https://unece.org/sites/default/files/2025-09/Informal%20document-WP1-90-11rev1-e.pdf) | Quan hệ nghiệp vụ chính thức và boundary quyền hạn đặc thù cho dominant task. | Không chọn archetype, không định nghĩa product truth và không cho phép sao chép geometry. |
| [UK Department for Transport automated-vehicle safety principles](https://www.gov.uk/government/consultations/automated-vehicles-statement-of-safety-principles/automated-vehicles-statement-of-safety-principles-consultation) | Quan hệ nghiệp vụ chính thức và boundary quyền hạn đặc thù cho dominant task. | Không chọn archetype, không định nghĩa product truth và không cho phép sao chép geometry. |

Tập nguồn gồm ít nhất ba tổ chức chính thức độc lập và bằng chứng accessibility của W3C.

## Output

```json
{
  "archetypeId": "autonomous-vehicle-remote-assistance-console",
  "situationCodes": [
    "<matched AR-AVRAC-* codes>"
  ],
  "searchAliases": [
    "autonomous vehicle remote assistance",
    "autonomous vehicle remote assistance workspace",
    "autonomous vehicle remote assistance control"
  ],
  "dominantTask": "Resolve an automated-driving-system help request by establishing the frozen vehicle state and operational-design-domain context, reviewing synchronized evidence, sending bounded strategic guidance and verifying whether the ADS safely resumes or enters a minimal-risk condition.",
  "regions": [
    "remote-assistance",
    "exception-queue",
    "vehicle-identity-odd-and-ads-state",
    "frozen-help-request-and-minimal-risk-state",
    "synchronized-scene-evidence",
    "ads-proposed-strategic-options",
    "operator-permitted-guidance-boundary",
    "safety-policy-and-vulnerable-road-user-check",
    "guidance-send",
    "ads-accept-reject-execute",
    "resume-minimal-risk-escalate-and-event-record"
  ],
  "regionRelationships": [
    "the ADS retains the dynamic driving task while the remote operator owns only a discrete, evidenced guidance transaction."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "remote-assistance -> exception-queue -> vehicle-identity-odd-and-ads-state -> frozen-help-request-and-minimal-risk-state -> synchronized-scene-evidence -> ads-proposed-strategic-options -> operator-permitted-guidance-boundary -> safety-policy-and-vulnerable-road-user-check -> guidance-send -> ads-accept-reject-execute -> resume-minimal-risk-escalate-and-event-record",
    "navigationReplacement": "<none or named evidence view or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "exception-queue",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": [
    "Request new/triaged/claimed",
    "telemetry live/stale/lost",
    "scene evidence synchronized/lagging/incomplete",
    "ADS engaged/degraded/stopped/minimal-risk",
    "ODD inside/edge/outside",
    "proposal available/unsafe/ambiguous",
    "guidance draft/blocked/sent",
    "ADS accepted/rejected/executing",
    "vulnerable-road-user clear/uncertain/present",
    "resume verified/failed",
    "escalation transferred/acknowledged"
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

