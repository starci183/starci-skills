# Ship mooring line load sharing console

## LOADS

None.

## Record

### Identity

| Trường | Giá trị |
|---|---|
| Archetype ID | `ship-mooring-line-load-sharing-console` |
| Family | Work |
| Dominant task | Duy trì khả năng giữ an toàn của một tàu tại bến khi gió, dòng và mực nước thay đổi bằng cách hiểu hình học/tải của mọi dây, dự báo phân phối lại khi mất giới hạn dây hoặc winch và ban hành tending hay unmooring an toàn. |
| Search aliases | `ship mooring line load sharing`, `ship mooring line load workspace`, `mooring line load sharing control` |
| Authority | Macro topology dùng chung và trung lập sản phẩm; Grammar sở hữu ngữ nghĩa sản phẩm, Principles sở hữu geometry chưa giải quyết và Direction sở hữu visual character. |

### Invariants

- Duy trì khả năng giữ an toàn của một tàu tại bến khi gió, dòng và mực nước thay đổi bằng cách hiểu hình học/tải của mọi dây, dự báo phân phối lại khi mất giới hạn dây hoặc winch và ban hành tending hay unmooring an toàn.
- Mọi vùng bắt buộc tạo thành một chuỗi bằng chứng đến quyết định có thể truy vết; đầu ra trung gian không tự đóng task.
- Mỗi vùng bắt buộc giữ owner riêng và cùng selected context.
- Wide, intermediate và compact giữ DOM, reading/focus order có nghĩa, action parity và recovery xác định.

## Recognition

### Situation codes

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-SMLLSC-01` | Dominant task là outcome quan sát được bắt buộc. | Bằng chứng bắt buộc. |
| `AR-SMLLSC-02` | Toàn bộ region graph và quan hệ đã đặt tên là cần thiết. | Bằng chứng bắt buộc. |
| `AR-SMLLSC-03` | Compact giữ action, state, recovery và nghĩa focus của wide. | Bằng chứng bắt buộc. |
| `AR-SMLLSC-04` | State đặc thù task có thể đổi sau khi người dùng tạo work state. | Bằng chứng bắt buộc. |
| `AR-SMLLSC-90` | Dominant task thực ra là `live-operations-command-center`. | Reject. |
| `AR-SMLLSC-91` | Dominant task thực ra là `vessel-damage-stability-response-workbench`. | Reject. |
| `AR-SMLLSC-92` | Dominant task thực ra là `finite-element-mesh-convergence-workbench`. | Reject. |
| `AR-SMLLSC-93` | Dominant task thực ra là `risk-bow-tie-control-overview`. | Reject. |

### Selection rule

Chọn `ship-mooring-line-load-sharing-console` khi và chỉ khi `AR-SMLLSC-01` đến `AR-SMLLSC-04` có bằng chứng và không mã nào từ `AR-SMLLSC-90` đến `AR-SMLLSC-93` đúng. Trả `needs-evidence` khi owner hoặc relationship chưa được giải quyết; trả `reject` khi có rejection code.

## Region graph

```text
mooring-load-control → vessel-berth-environment-and-mooring-plan → ship-and-shore-fairlead-bollard-winch-geometry → line-identity-material-condition-and-working-load-limit → measured-line-tension-lead-angle-and-winch-brake-margin → vessel-force-and-moment-restraint-equilibrium ↔ per-line-utilization-slack-and-chafe-ledger → selected-line-failure-and-load-redistribution-cascade → snap-back-zone-and-personnel-clearance → tend-heave-pay-out-suspend-or-unmoor-command → acknowledgement-and-post-action-equilibrium → secured-hold-or-emergency-release-log
```

### Region obligations

| Region | Nghĩa vụ owner và relationship |
|---|---|
| `mooring-load-control` | Sở hữu dominant task, toàn bộ trạng thái hậu duệ và boundary recovery. |
| `vessel-berth-environment-and-mooring-plan` | Sở hữu bằng chứng hoặc hành động của Vessel Berth Environment And Mooring Plan và giữ quan hệ đã khai báo với selection hiện tại. |
| `ship-and-shore-fairlead-bollard-winch-geometry` | Sở hữu bằng chứng hoặc hành động của Ship And Shore Fairlead Bollard Winch Geometry và giữ quan hệ đã khai báo với selection hiện tại. |
| `line-identity-material-condition-and-working-load-limit` | Sở hữu bằng chứng hoặc hành động của Line Identity Material Condition And Working Load Limit và giữ quan hệ đã khai báo với selection hiện tại. |
| `measured-line-tension-lead-angle-and-winch-brake-margin` | Sở hữu bằng chứng hoặc hành động của Measured Line Tension Lead Angle And Winch Brake Margin và giữ quan hệ đã khai báo với selection hiện tại. |
| `vessel-force-and-moment-restraint-equilibrium` | Sở hữu bằng chứng hoặc hành động của Vessel Force And Moment Restraint Equilibrium và giữ quan hệ đã khai báo với selection hiện tại. |
| `per-line-utilization-slack-and-chafe-ledger` | Sở hữu bằng chứng hoặc hành động của Per Line Utilization Slack And Chafe Ledger và giữ quan hệ đã khai báo với selection hiện tại. |
| `selected-line-failure-and-load-redistribution-cascade` | Sở hữu bằng chứng hoặc hành động của Selected Line Failure And Load Redistribution Cascade và giữ quan hệ đã khai báo với selection hiện tại. |
| `snap-back-zone-and-personnel-clearance` | Sở hữu bằng chứng hoặc hành động của Snap Back Zone And Personnel Clearance và giữ quan hệ đã khai báo với selection hiện tại. |
| `tend-heave-pay-out-suspend-or-unmoor-command` | Sở hữu bằng chứng hoặc hành động của Tend Heave Pay Out Suspend Or Unmoor Command và giữ quan hệ đã khai báo với selection hiện tại. |
| `acknowledgement-and-post-action-equilibrium` | Sở hữu bằng chứng hoặc hành động của Acknowledgement And Post Action Equilibrium và giữ quan hệ đã khai báo với selection hiện tại. |
| `secured-hold-or-emergency-release-log` | Sở hữu bằng chứng hoặc hành động của Secured Hold Or Emergency Release Log và giữ quan hệ đã khai báo với selection hiện tại. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi các vùng đồng thời không còn giữ được label dễ đọc, liên kết chính xác và action đầy đủ.
- **Topology response:** Hình học bến/tàu, mọi dây và winch, lực môi trường, cân bằng chia tải, cascade failure, clearance snap-back và xác nhận lệnh cùng hiện diện; chỉ mooring plan sở hữu pan/zoom.
- **Navigation replacement:** Không có khi mọi vùng bắt buộc vẫn đồng thời dùng được.
- **Sticky boundary:** Chỉ trạng thái hoặc action của task hiện tại được persist; nó dành chỗ và yield khi chiều cao ngắn.
- **Overflow owner:** `vessel-berth-environment-and-mooring-plan` sở hữu overflow có giới hạn; page không sở hữu overflow ngang.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi vùng hỗ trợ ưu tiên thấp nhất làm quan hệ chính không còn dùng được.
- **Topology response:** Dây tới hạn và cân bằng tổng được ghim; bằng chứng lead/equipment và redistribution/action luân phiên, còn lệnh hoạt động tồn tại tới khi được xác nhận và đo.
- **Navigation replacement:** Các evidence view có tên thay vùng bị dời và giữ đúng selection cùng trigger.
- **Sticky boundary:** Verdict hiện tại chỉ persist khi target vẫn thấy được và trở lại flow khi chiều cao ngắn.
- **Overflow owner:** Owner có giới hạn của wide vẫn cục bộ; view luân phiên không tạo nested page scroll.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai vùng task không thể đồng thời giữ bằng chứng dễ đọc, target 44 px và focus không bị che.
- **Topology response:** Dây tới hạn → fairlead/bollard/winch lead → tension so với WLL và brake margin → restraint toàn hệ → phân phối lại khi mất dây → clear vùng snap-back → tending/unmooring → xác nhận → cân bằng sau hành động.
- **Navigation replacement:** Primary-pane sequence có Back khôi phục selection, state, query, scroll context và đúng trigger.
- **Sticky boundary:** Action bar dành sẵn chỗ, không che focus và trở về normal flow khi chiều cao ngắn.
- **Overflow owner:** Visual có giới hạn có bản tương đương dạng chữ theo thứ tự làm representation compact chính.

### Reflow

- Semantic, DOM và meaningful focus order giữ graph: `mooring-load-control → vessel-berth-environment-and-mooring-plan → ship-and-shore-fairlead-bollard-winch-geometry → line-identity-material-condition-and-working-load-limit → measured-line-tension-lead-angle-and-winch-brake-margin → vessel-force-and-moment-restraint-equilibrium ↔ per-line-utilization-slack-and-chafe-ledger → selected-line-failure-and-load-redistribution-cascade → snap-back-zone-and-personnel-clearance → tend-heave-pay-out-suspend-or-unmoor-command → acknowledgement-and-post-action-equilibrium → secured-hold-or-emergency-release-log`.
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

Các state đặc thù task: Environment live/stale/escalating, line slack/loaded/near-limit/over-limit/damaged, lead clear/chafing/invalid, winch brake margin adequate/marginal/exceeded, restraint balanced/drifting/insufficient, failure scenario contained/cascading, snap-back zone clear/occupied/unknown, command proposed/authorized/issued/acknowledged/failed, post-action improved/worsened and berth secured/suspended/emergency-unmooring.

| State | Region sở hữu | Nghĩa vụ |
|---|---|---|
| Initial / loading | `vessel-berth-environment-and-mooring-plan` | Nêu scope đang tải, giữ chỗ primary region và chỉ block owner lỗi. |
| Ready | `ship-and-shore-fairlead-bollard-winch-geometry` | Hiện object, owner relationship, selection và action hợp lệ bằng text lẫn semantics. |
| Empty / not applicable | `ship-and-shore-fairlead-bollard-winch-geometry` | Phân biệt empty thật, no-match và not-applicable rồi cung cấp next action hợp lệ. |
| Error / retry | `acknowledgement-and-post-action-equilibrium` | Giữ context/input hợp lệ, nêu owner lỗi và cung cấp local retry. |
| Permission / unavailable | `secured-hold-or-emergency-release-log` | Giải thích restriction mà không ngụ ý bằng chứng ẩn là không tồn tại và cung cấp safe exit. |
| Pending | `secured-hold-or-emergency-release-log` | Ngăn duplicate action, giữ đúng target và announce progress mà không dời focus. |
| Success | `secured-hold-or-emergency-release-log` | Xác nhận outcome chính xác, giữ selection và cung cấp next action hoặc recovery. |
| Stale / conflict | `vessel-berth-environment-and-mooring-plan` | Giữ last-safe value, nêu version/time conflict và yêu cầu recovery rõ. |
| Focus transition | `secured-hold-or-emergency-release-log` | Chỉ dời focus vào modal hoặc error summary bắt buộc rồi trả về đúng trigger. |
| Responsive presentation | `mooring-load-control` | Giữ state, selection, query, pending result và recovery khi topology đổi. |

## Boundaries

### Accept

- Accept khi dominant task là: Duy trì khả năng giữ an toàn của một tàu tại bến khi gió, dòng và mực nước thay đổi bằng cách hiểu hình học/tải của mọi dây, dự báo phân phối lại khi mất giới hạn dây hoặc winch và ban hành tending hay unmooring an toàn.
- Accept khi mọi region và relationship bắt buộc trong graph đều cần để hoàn thành task.
- Accept khi compact giữ task, state và recovery bằng replacement topology thay vì stack box desktop.

### Reject

- Reject `live-operations-command-center`; đây là bằng chứng `AR-SMLLSC-90` và phải route sang archetype kề.
- Reject `vessel-damage-stability-response-workbench`; đây là bằng chứng `AR-SMLLSC-91` và phải route sang archetype kề.
- Reject `finite-element-mesh-convergence-workbench`; đây là bằng chứng `AR-SMLLSC-92` và phải route sang archetype kề.
- Reject `risk-bow-tie-control-overview`; đây là bằng chứng `AR-SMLLSC-93` và phải route sang archetype kề.

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
| [IMO Safe Mooring authority and current SOLAS guidance](https://www.imo.org/en/ourwork/safety/pages/safemooring.aspx) | Quan hệ nghiệp vụ chính thức và boundary quyền hạn đặc thù cho dominant task. | Không chọn archetype, không định nghĩa product truth và không cho phép sao chép geometry. |
| [OCIMF Mooring Equipment Guidelines, Fourth Edition](https://www.ocimf.org/publications/books/) | Quan hệ nghiệp vụ chính thức và boundary quyền hạn đặc thù cho dominant task. | Không chọn archetype, không định nghĩa product truth và không cho phép sao chép geometry. |

Tập nguồn gồm ít nhất ba tổ chức chính thức độc lập và bằng chứng accessibility của W3C.

## Output

```json
{
  "archetypeId": "ship-mooring-line-load-sharing-console",
  "situationCodes": [
    "<matched AR-SMLLSC-* codes>"
  ],
  "searchAliases": [
    "ship mooring line load sharing",
    "ship mooring line load workspace",
    "mooring line load sharing control"
  ],
  "dominantTask": "Maintain one ship's safe berth restraint as wind, current and water level change by interpreting every mooring line's geometry and live load, predicting redistribution after a line or winch limit is lost and issuing safe tending or unmooring actions.",
  "regions": [
    "mooring-load-control",
    "vessel-berth-environment-and-mooring-plan",
    "ship-and-shore-fairlead-bollard-winch-geometry",
    "line-identity-material-condition-and-working-load-limit",
    "measured-line-tension-lead-angle-and-winch-brake-margin",
    "vessel-force-and-moment-restraint-equilibrium",
    "per-line-utilization-slack-and-chafe-ledger",
    "selected-line-failure-and-load-redistribution-cascade",
    "snap-back-zone-and-personnel-clearance",
    "tend-heave-pay-out-suspend-or-unmoor-command",
    "acknowledgement-and-post-action-equilibrium",
    "secured-hold-or-emergency-release-log"
  ],
  "regionRelationships": [
    "total restraint and failure redistribution are derived from the whole physical line system, never from one alarm in isolation."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "mooring-load-control -> vessel-berth-environment-and-mooring-plan -> ship-and-shore-fairlead-bollard-winch-geometry -> line-identity-material-condition-and-working-load-limit -> measured-line-tension-lead-angle-and-winch-brake-margin -> vessel-force-and-moment-restraint-equilibrium -> per-line-utilization-slack-and-chafe-ledger -> selected-line-failure-and-load-redistribution-cascade -> snap-back-zone-and-personnel-clearance -> tend-heave-pay-out-suspend-or-unmoor-command -> acknowledgement-and-post-action-equilibrium -> secured-hold-or-emergency-release-log",
    "navigationReplacement": "<none or named evidence view or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "vessel-berth-environment-and-mooring-plan",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": [
    "Environment live/stale/escalating",
    "line slack/loaded/near-limit/over-limit/damaged",
    "lead clear/chafing/invalid",
    "winch brake margin adequate/marginal/exceeded",
    "restraint balanced/drifting/insufficient",
    "failure scenario contained/cascading",
    "snap-back zone clear/occupied/unknown",
    "command proposed/authorized/issued/acknowledged/failed",
    "post-action improved/worsened",
    "berth secured/suspended/emergency-unmooring"
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

