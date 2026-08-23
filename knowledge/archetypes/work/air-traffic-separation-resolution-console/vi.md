# Air traffic separation resolution console

## LOADS

None.

## Record

### Identity

| Trường | Giá trị |
|---|---|
| Archetype ID | `air-traffic-separation-resolution-console` |
| Family | Work |
| Dominant task | Giải quyết một nguy cơ mất phân cách dự báo bằng cách hiểu hình học gặp nhau và luồng bay xung quanh, chọn một huấn lệnh chiến thuật hợp lệ, phối hợp quyền kiểm soát, phát huấn lệnh, xác minh readback của phi công và quan sát sự tuân thủ. |
| Search aliases | `air traffic separation resolution`, `air traffic separation resolution workspace`, `air traffic separation resolution control` |
| Authority | Macro topology dùng chung và trung lập sản phẩm; Grammar sở hữu ngữ nghĩa sản phẩm, Principles sở hữu geometry chưa giải quyết và Direction sở hữu visual character. |

### Invariants

- Giải quyết một nguy cơ mất phân cách dự báo bằng cách hiểu hình học gặp nhau và luồng bay xung quanh, chọn một huấn lệnh chiến thuật hợp lệ, phối hợp quyền kiểm soát, phát huấn lệnh, xác minh readback của phi công và quan sát sự tuân thủ.
- Mọi vùng bắt buộc tạo thành một chuỗi bằng chứng đến quyết định có thể truy vết; đầu ra trung gian không tự đóng task.
- Mỗi vùng bắt buộc giữ owner riêng và cùng selected context.
- Wide, intermediate và compact giữ DOM, reading/focus order có nghĩa, action parity và recovery xác định.

## Recognition

### Situation codes

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-ATSRC-01` | Dominant task là outcome quan sát được bắt buộc. | Bằng chứng bắt buộc. |
| `AR-ATSRC-02` | Toàn bộ region graph và quan hệ đã đặt tên là cần thiết. | Bằng chứng bắt buộc. |
| `AR-ATSRC-03` | Compact giữ action, state, recovery và nghĩa focus của wide. | Bằng chứng bắt buộc. |
| `AR-ATSRC-04` | State đặc thù task có thể đổi sau khi người dùng tạo work state. | Bằng chứng bắt buộc. |
| `AR-ATSRC-90` | Dominant task thực ra là `live-operations-command-center`. | Reject. |
| `AR-ATSRC-91` | Dominant task thực ra là `map-led-situation-monitor`. | Reject. |
| `AR-ATSRC-92` | Dominant task thực ra là `orbital-conjunction-assessment-workbench`. | Reject. |
| `AR-ATSRC-93` | Dominant task thực ra là `flight-dispatch-release-workbench`. | Reject. |

### Selection rule

Chọn `air-traffic-separation-resolution-console` khi và chỉ khi `AR-ATSRC-01` đến `AR-ATSRC-04` có bằng chứng và không mã nào từ `AR-ATSRC-90` đến `AR-ATSRC-93` đúng. Trả `needs-evidence` khi owner hoặc relationship chưa được giải quyết; trả `reject` khi có rejection code.

## Region graph

```text
separation-console → sector-time-control-authority-and-rule-version → conflict-pair-queue → selected-two-flight-trajectory-projection ↔ both-flight-progress-strips → legally-applicable-separation-minimum-for-that-pair-and-flight-phases → surrounding-traffic-clearance-veto → legal-tactical-clearance → coordination-and-clearance-issuance → verbatim-pilot-readback-match → observed-track-conformance-to-clearance-and-minimum → resolved-or-reopened-log
```

### Region obligations

| Region | Nghĩa vụ owner và relationship |
|---|---|
| `separation-console` | Sở hữu dominant task, toàn bộ trạng thái hậu duệ và boundary recovery. |
| `sector-time-control-authority-and-rule-version` | Sở hữu bằng chứng hoặc hành động của Sector Time Control Authority And Rule Version và giữ quan hệ đã khai báo với selection hiện tại. |
| `conflict-pair-queue` | Sở hữu bằng chứng hoặc hành động của Conflict Pair Queue và giữ quan hệ đã khai báo với selection hiện tại. |
| `selected-two-flight-trajectory-projection` | Sở hữu bằng chứng hoặc hành động của Selected Two Flight Trajectory Projection và giữ quan hệ đã khai báo với selection hiện tại. |
| `both-flight-progress-strips` | Sở hữu bằng chứng hoặc hành động của Both Flight Progress Strips và giữ quan hệ đã khai báo với selection hiện tại. |
| `legally-applicable-separation-minimum-for-that-pair-and-flight-phases` | Sở hữu bằng chứng hoặc hành động của Legally Applicable Separation Minimum For That Pair And Flight Phases và giữ quan hệ đã khai báo với selection hiện tại. |
| `surrounding-traffic-clearance-veto` | Sở hữu bằng chứng hoặc hành động của Surrounding Traffic Clearance Veto và giữ quan hệ đã khai báo với selection hiện tại. |
| `legal-tactical-clearance` | Sở hữu bằng chứng hoặc hành động của Legal Tactical Clearance và giữ quan hệ đã khai báo với selection hiện tại. |
| `coordination-and-clearance-issuance` | Sở hữu bằng chứng hoặc hành động của Coordination And Clearance Issuance và giữ quan hệ đã khai báo với selection hiện tại. |
| `verbatim-pilot-readback-match` | Sở hữu bằng chứng hoặc hành động của Verbatim Pilot Readback Match và giữ quan hệ đã khai báo với selection hiện tại. |
| `observed-track-conformance-to-clearance-and-minimum` | Sở hữu bằng chứng hoặc hành động của Observed Track Conformance To Clearance And Minimum và giữ quan hệ đã khai báo với selection hiện tại. |
| `resolved-or-reopened-log` | Sở hữu bằng chứng hoặc hành động của Resolved Or Reopened Log và giữ quan hệ đã khai báo với selection hiện tại. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi các vùng đồng thời không còn giữ được label dễ đọc, liên kết chính xác và action đầy đủ.
- **Topology response:** Hàng đợi xung đột, phép chiếu quỹ đạo, strip của cả hai chuyến bay, minima và giao thông ngữ cảnh, so sánh phương án cùng rail huấn lệnh/readback luôn đồng thời nhìn thấy; chỉ vùng quỹ đạo sở hữu pan/zoom có giới hạn.
- **Navigation replacement:** Không có khi mọi vùng bắt buộc vẫn đồng thời dùng được.
- **Sticky boundary:** Chỉ trạng thái hoặc action của task hiện tại được persist; nó dành chỗ và yield khi chiều cao ngắn.
- **Overflow owner:** `conflict-pair-queue` sở hữu overflow có giới hạn; page không sở hữu overflow ngang.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi vùng hỗ trợ ưu tiên thấp nhất làm quan hệ chính không còn dùng được.
- **Topology response:** Xung đột đã chọn và trạng thái huấn lệnh được giữ cố định; quỹ đạo, strip và giao thông ngữ cảnh trở thành các view bằng chứng loại trừ lẫn nhau; rail phát lệnh/readback rời trạng thái bám sau khi được xác nhận.
- **Navigation replacement:** Các evidence view có tên thay vùng bị dời và giữ đúng selection cùng trigger.
- **Sticky boundary:** Verdict hiện tại chỉ persist khi target vẫn thấy được và trở lại flow khi chiều cao ngắn.
- **Overflow owner:** Owner có giới hạn của wide vẫn cục bộ; view luân phiên không tạo nested page scroll.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai vùng task không thể đồng thời giữ bằng chứng dễ đọc, target 44 px và focus không bị che.
- **Topology response:** Hai chuyến bay được định danh → dữ kiện tiếp cận gần nhất → minimum áp dụng cho cặp → veto của giao thông ngữ cảnh → huấn lệnh hợp lệ → phối hợp và phát lệnh → khớp readback → tuân thủ quan sát được → giải quyết hoặc mở lại.
- **Navigation replacement:** Primary-pane sequence có Back khôi phục selection, state, query, scroll context và đúng trigger.
- **Sticky boundary:** Action bar dành sẵn chỗ, không che focus và trở về normal flow khi chiều cao ngắn.
- **Overflow owner:** Visual có giới hạn có bản tương đương dạng chữ theo thứ tự làm representation compact chính.

### Reflow

- Semantic, DOM và meaningful focus order giữ graph: `separation-console → sector-time-control-authority-and-rule-version → conflict-pair-queue → selected-two-flight-trajectory-projection ↔ both-flight-progress-strips → legally-applicable-separation-minimum-for-that-pair-and-flight-phases → surrounding-traffic-clearance-veto → legal-tactical-clearance → coordination-and-clearance-issuance → verbatim-pilot-readback-match → observed-track-conformance-to-clearance-and-minimum → resolved-or-reopened-log`.
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

Các state đặc thù task: Track loading/live/stale/lost, predicted/near-term/actual separation breach, minima available/uncertain, context traffic clear/blocking, candidate safe/unsafe, coordination requested/accepted/rejected, clearance draft/issued, readback correct/incorrect/missing, conformance improving/diverging, resolved/reopened and control transferred.

| State | Region sở hữu | Nghĩa vụ |
|---|---|---|
| Initial / loading | `sector-time-control-authority-and-rule-version` | Nêu scope đang tải, giữ chỗ primary region và chỉ block owner lỗi. |
| Ready | `conflict-pair-queue` | Hiện object, owner relationship, selection và action hợp lệ bằng text lẫn semantics. |
| Empty / not applicable | `conflict-pair-queue` | Phân biệt empty thật, no-match và not-applicable rồi cung cấp next action hợp lệ. |
| Error / retry | `observed-track-conformance-to-clearance-and-minimum` | Giữ context/input hợp lệ, nêu owner lỗi và cung cấp local retry. |
| Permission / unavailable | `resolved-or-reopened-log` | Giải thích restriction mà không ngụ ý bằng chứng ẩn là không tồn tại và cung cấp safe exit. |
| Pending | `resolved-or-reopened-log` | Ngăn duplicate action, giữ đúng target và announce progress mà không dời focus. |
| Success | `resolved-or-reopened-log` | Xác nhận outcome chính xác, giữ selection và cung cấp next action hoặc recovery. |
| Stale / conflict | `sector-time-control-authority-and-rule-version` | Giữ last-safe value, nêu version/time conflict và yêu cầu recovery rõ. |
| Focus transition | `resolved-or-reopened-log` | Chỉ dời focus vào modal hoặc error summary bắt buộc rồi trả về đúng trigger. |
| Responsive presentation | `separation-console` | Giữ state, selection, query, pending result và recovery khi topology đổi. |

## Boundaries

### Accept

- Accept khi dominant task là: Giải quyết một nguy cơ mất phân cách dự báo bằng cách hiểu hình học gặp nhau và luồng bay xung quanh, chọn một huấn lệnh chiến thuật hợp lệ, phối hợp quyền kiểm soát, phát huấn lệnh, xác minh readback của phi công và quan sát sự tuân thủ.
- Accept khi mọi region và relationship bắt buộc trong graph đều cần để hoàn thành task.
- Accept khi compact giữ task, state và recovery bằng replacement topology thay vì stack box desktop.

### Reject

- Reject `live-operations-command-center`; đây là bằng chứng `AR-ATSRC-90` và phải route sang archetype kề.
- Reject `map-led-situation-monitor`; đây là bằng chứng `AR-ATSRC-91` và phải route sang archetype kề.
- Reject `orbital-conjunction-assessment-workbench`; đây là bằng chứng `AR-ATSRC-92` và phải route sang archetype kề.
- Reject `flight-dispatch-release-workbench`; đây là bằng chứng `AR-ATSRC-93` và phải route sang archetype kề.

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
| [FAA Order JO 7110.65BB — Air Traffic Control](https://www.faa.gov/regulations_policies/orders_notices/index.cfm/go/document.information/documentID/1043461) | Quan hệ nghiệp vụ chính thức và boundary quyền hạn đặc thù cho dominant task. | Không chọn archetype, không định nghĩa product truth và không cho phép sao chép geometry. |
| [EUROCONTROL Medium-Term Conflict Detection specification](https://www.eurocontrol.int/publication/eurocontrol-specification-medium-term-conflict-detection-mtcd) | Quan hệ nghiệp vụ chính thức và boundary quyền hạn đặc thù cho dominant task. | Không chọn archetype, không định nghĩa product truth và không cho phép sao chép geometry. |

Tập nguồn gồm ít nhất ba tổ chức chính thức độc lập và bằng chứng accessibility của W3C.

## Output

```json
{
  "archetypeId": "air-traffic-separation-resolution-console",
  "situationCodes": [
    "<matched AR-ATSRC-* codes>"
  ],
  "searchAliases": [
    "air traffic separation resolution",
    "air traffic separation resolution workspace",
    "air traffic separation resolution control"
  ],
  "dominantTask": "Resolve one predicted loss of separation by understanding the encounter geometry and surrounding traffic, selecting a legal tactical clearance, coordinating ownership, issuing it, verifying pilot readback and observing conformance.",
  "regions": [
    "separation-console",
    "sector-time-control-authority-and-rule-version",
    "conflict-pair-queue",
    "selected-two-flight-trajectory-projection",
    "both-flight-progress-strips",
    "legally-applicable-separation-minimum-for-that-pair-and-flight-phases",
    "surrounding-traffic-clearance-veto",
    "legal-tactical-clearance",
    "coordination-and-clearance-issuance",
    "verbatim-pilot-readback-match",
    "observed-track-conformance-to-clearance-and-minimum",
    "resolved-or-reopened-log"
  ],
  "regionRelationships": [
    "neither predicted geometry nor an issued clearance closes the encounter without a correct readback and observed two-flight conformance."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "separation-console -> sector-time-control-authority-and-rule-version -> conflict-pair-queue -> selected-two-flight-trajectory-projection -> both-flight-progress-strips -> legally-applicable-separation-minimum-for-that-pair-and-flight-phases -> surrounding-traffic-clearance-veto -> legal-tactical-clearance -> coordination-and-clearance-issuance -> verbatim-pilot-readback-match -> observed-track-conformance-to-clearance-and-minimum -> resolved-or-reopened-log",
    "navigationReplacement": "<none or named evidence view or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "conflict-pair-queue",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": [
    "Track loading/live/stale/lost",
    "predicted/near-term/actual separation breach",
    "minima available/uncertain",
    "context traffic clear/blocking",
    "candidate safe/unsafe",
    "coordination requested/accepted/rejected",
    "clearance draft/issued",
    "readback correct/incorrect/missing",
    "conformance improving/diverging",
    "resolved/reopened",
    "control transferred"
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

