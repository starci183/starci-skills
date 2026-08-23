# Transit network service pattern authoring workbench

## LOADS

None.

## Record

### Identity

| Trường | Giá trị |
|---|---|
| Archetype ID | `transit-network-service-pattern-authoring-workbench` |
| Family | Work |
| Dominant task | Biên soạn một dịch vụ vận tải công cộng tuyến cố định tái sử dụng bằng cách định nghĩa hình học tuyến, stop và variant có thứ tự, trip cùng lịch dịch vụ, rồi validate tiêu chuẩn vận hành và công bố nhất quán cho hành khách lẫn máy. |
| Search aliases | `transit network service pattern authoring`, `transit network service pattern workspace`, `network service pattern authoring control` |
| Authority | Macro topology dùng chung và trung lập sản phẩm; Grammar sở hữu ngữ nghĩa sản phẩm, Principles sở hữu geometry chưa giải quyết và Direction sở hữu visual character. |

### Invariants

- Biên soạn một dịch vụ vận tải công cộng tuyến cố định tái sử dụng bằng cách định nghĩa hình học tuyến, stop và variant có thứ tự, trip cùng lịch dịch vụ, rồi validate tiêu chuẩn vận hành và công bố nhất quán cho hành khách lẫn máy.
- Mọi vùng bắt buộc tạo thành một chuỗi bằng chứng đến quyết định có thể truy vết; đầu ra trung gian không tự đóng task.
- Mỗi vùng bắt buộc giữ owner riêng và cùng selected context.
- Wide, intermediate và compact giữ DOM, reading/focus order có nghĩa, action parity và recovery xác định.

## Recognition

### Situation codes

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-TNSPAW-01` | Dominant task là outcome quan sát được bắt buộc. | Bằng chứng bắt buộc. |
| `AR-TNSPAW-02` | Toàn bộ region graph và quan hệ đã đặt tên là cần thiết. | Bằng chứng bắt buộc. |
| `AR-TNSPAW-03` | Compact giữ action, state, recovery và nghĩa focus của wide. | Bằng chứng bắt buộc. |
| `AR-TNSPAW-04` | State đặc thù task có thể đổi sau khi người dùng tạo work state. | Bằng chứng bắt buộc. |
| `AR-TNSPAW-90` | Dominant task thực ra là `spatial-route-itinerary-explorer`. | Reject. |
| `AR-TNSPAW-91` | Dominant task thực ra là `calendar-resource-scheduler`. | Reject. |
| `AR-TNSPAW-92` | Dominant task thực ra là `document-outline-editor`. | Reject. |
| `AR-TNSPAW-93` | Dominant task thực ra là `workflow-automation-builder`. | Reject. |

### Selection rule

Chọn `transit-network-service-pattern-authoring-workbench` khi và chỉ khi `AR-TNSPAW-01` đến `AR-TNSPAW-04` có bằng chứng và không mã nào từ `AR-TNSPAW-90` đến `AR-TNSPAW-93` đúng. Trả `needs-evidence` khi owner hoặc relationship chưa được giải quyết; trả `reject` khi có rejection code.

## Region graph

```text
service-pattern-authoring → service-objective-area-and-policy-version → network-and-stop-geometry ↔ ordered-stop-pattern-and-direction-variants → trip-frequency-and-calendar-generator → block-and-interlining-dependencies → coverage-headway-load-and-equity-validation → rider-facing-map-timetable-and-exception-preview → feed-schema-and-cross-file-validation → versioned-publication
```

### Region obligations

| Region | Nghĩa vụ owner và relationship |
|---|---|
| `service-pattern-authoring` | Sở hữu dominant task, toàn bộ trạng thái hậu duệ và boundary recovery. |
| `service-objective-area-and-policy-version` | Sở hữu bằng chứng hoặc hành động của Service Objective Area And Policy Version và giữ quan hệ đã khai báo với selection hiện tại. |
| `network-and-stop-geometry` | Sở hữu bằng chứng hoặc hành động của Network And Stop Geometry và giữ quan hệ đã khai báo với selection hiện tại. |
| `ordered-stop-pattern-and-direction-variants` | Sở hữu bằng chứng hoặc hành động của Ordered Stop Pattern And Direction Variants và giữ quan hệ đã khai báo với selection hiện tại. |
| `trip-frequency-and-calendar-generator` | Sở hữu bằng chứng hoặc hành động của Trip Frequency And Calendar Generator và giữ quan hệ đã khai báo với selection hiện tại. |
| `block-and-interlining-dependencies` | Sở hữu bằng chứng hoặc hành động của Block And Interlining Dependencies và giữ quan hệ đã khai báo với selection hiện tại. |
| `coverage-headway-load-and-equity-validation` | Sở hữu bằng chứng hoặc hành động của Coverage Headway Load And Equity Validation và giữ quan hệ đã khai báo với selection hiện tại. |
| `rider-facing-map-timetable-and-exception-preview` | Sở hữu bằng chứng hoặc hành động của Rider Facing Map Timetable And Exception Preview và giữ quan hệ đã khai báo với selection hiện tại. |
| `feed-schema-and-cross-file-validation` | Sở hữu bằng chứng hoặc hành động của Feed Schema And Cross File Validation và giữ quan hệ đã khai báo với selection hiện tại. |
| `versioned-publication` | Sở hữu bằng chứng hoặc hành động của Versioned Publication và giữ quan hệ đã khai báo với selection hiện tại. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi các vùng đồng thời không còn giữ được label dễ đọc, liên kết chính xác và action đầy đủ.
- **Topology response:** Hình học mạng, phân cấp stop pattern, sinh trip/calendar, ledger validation và preview rider/feed luôn thấy được; chỉ vùng mạng sở hữu pan/zoom có giới hạn.
- **Navigation replacement:** Không có khi mọi vùng bắt buộc vẫn đồng thời dùng được.
- **Sticky boundary:** Chỉ trạng thái hoặc action của task hiện tại được persist; nó dành chỗ và yield khi chiều cao ngắn.
- **Overflow owner:** `rider-facing-map-timetable-and-exception-preview` sở hữu overflow có giới hạn; page không sở hữu overflow ngang.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi vùng hỗ trợ ưu tiên thấp nhất làm quan hệ chính không còn dùng được.
- **Topology response:** Route variant đã chọn là chính; editor hình học và timetable/calendar luân phiên, còn validation và publication vẫn bền vững.
- **Navigation replacement:** Các evidence view có tên thay vùng bị dời và giữ đúng selection cùng trigger.
- **Sticky boundary:** Verdict hiện tại chỉ persist khi target vẫn thấy được và trở lại flow khi chiều cao ngắn.
- **Overflow owner:** Owner có giới hạn của wide vẫn cục bộ; view luân phiên không tạo nested page scroll.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai vùng task không thể đồng thời giữ bằng chứng dễ đọc, target 44 px và focus không bị che.
- **Topology response:** Mục tiêu dịch vụ → hướng/variant → stop có thứ tự → tần suất/lịch → dependency vận hành → vấn đề policy/schema → preview hành khách → publish.
- **Navigation replacement:** Primary-pane sequence có Back khôi phục selection, state, query, scroll context và đúng trigger.
- **Sticky boundary:** Action bar dành sẵn chỗ, không che focus và trở về normal flow khi chiều cao ngắn.
- **Overflow owner:** Visual có giới hạn có bản tương đương dạng chữ theo thứ tự làm representation compact chính.

### Reflow

- Semantic, DOM và meaningful focus order giữ graph: `service-pattern-authoring → service-objective-area-and-policy-version → network-and-stop-geometry ↔ ordered-stop-pattern-and-direction-variants → trip-frequency-and-calendar-generator → block-and-interlining-dependencies → coverage-headway-load-and-equity-validation → rider-facing-map-timetable-and-exception-preview → feed-schema-and-cross-file-validation → versioned-publication`.
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

Các state đặc thù task: Network loading/stale, stop active/temporarily closed, pattern incomplete/valid, trip/calendar generated/conflicting, frequency under/meeting standard, load/coverage/equity pass/fail, interline broken/valid, preview current/stale, feed invalid/valid, publication draft/scheduled/live/superseded and rollback available.

| State | Region sở hữu | Nghĩa vụ |
|---|---|---|
| Initial / loading | `service-objective-area-and-policy-version` | Nêu scope đang tải, giữ chỗ primary region và chỉ block owner lỗi. |
| Ready | `network-and-stop-geometry` | Hiện object, owner relationship, selection và action hợp lệ bằng text lẫn semantics. |
| Empty / not applicable | `network-and-stop-geometry` | Phân biệt empty thật, no-match và not-applicable rồi cung cấp next action hợp lệ. |
| Error / retry | `feed-schema-and-cross-file-validation` | Giữ context/input hợp lệ, nêu owner lỗi và cung cấp local retry. |
| Permission / unavailable | `versioned-publication` | Giải thích restriction mà không ngụ ý bằng chứng ẩn là không tồn tại và cung cấp safe exit. |
| Pending | `versioned-publication` | Ngăn duplicate action, giữ đúng target và announce progress mà không dời focus. |
| Success | `versioned-publication` | Xác nhận outcome chính xác, giữ selection và cung cấp next action hoặc recovery. |
| Stale / conflict | `service-objective-area-and-policy-version` | Giữ last-safe value, nêu version/time conflict và yêu cầu recovery rõ. |
| Focus transition | `versioned-publication` | Chỉ dời focus vào modal hoặc error summary bắt buộc rồi trả về đúng trigger. |
| Responsive presentation | `service-pattern-authoring` | Giữ state, selection, query, pending result và recovery khi topology đổi. |

## Boundaries

### Accept

- Accept khi dominant task là: Biên soạn một dịch vụ vận tải công cộng tuyến cố định tái sử dụng bằng cách định nghĩa hình học tuyến, stop và variant có thứ tự, trip cùng lịch dịch vụ, rồi validate tiêu chuẩn vận hành và công bố nhất quán cho hành khách lẫn máy.
- Accept khi mọi region và relationship bắt buộc trong graph đều cần để hoàn thành task.
- Accept khi compact giữ task, state và recovery bằng replacement topology thay vì stack box desktop.

### Reject

- Reject `spatial-route-itinerary-explorer`; đây là bằng chứng `AR-TNSPAW-90` và phải route sang archetype kề.
- Reject `calendar-resource-scheduler`; đây là bằng chứng `AR-TNSPAW-91` và phải route sang archetype kề.
- Reject `document-outline-editor`; đây là bằng chứng `AR-TNSPAW-92` và phải route sang archetype kề.
- Reject `workflow-automation-builder`; đây là bằng chứng `AR-TNSPAW-93` và phải route sang archetype kề.

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
| [current GTFS Schedule Reference](https://gtfs.org/documentation/schedule/reference/) | Quan hệ nghiệp vụ chính thức và boundary quyền hạn đặc thù cho dominant task. | Không chọn archetype, không định nghĩa product truth và không cho phép sao chép geometry. |
| [FTA fixed-route transit service requirements](https://www.transit.dot.gov/regulations-and-guidance/civil-rights-ada/title-vi-fixed-route-transit-requirements-video-transcript) | Quan hệ nghiệp vụ chính thức và boundary quyền hạn đặc thù cho dominant task. | Không chọn archetype, không định nghĩa product truth và không cho phép sao chép geometry. |

Tập nguồn gồm ít nhất ba tổ chức chính thức độc lập và bằng chứng accessibility của W3C.

## Output

```json
{
  "archetypeId": "transit-network-service-pattern-authoring-workbench",
  "situationCodes": [
    "<matched AR-TNSPAW-* codes>"
  ],
  "searchAliases": [
    "transit network service pattern authoring",
    "transit network service pattern workspace",
    "network service pattern authoring control"
  ],
  "dominantTask": "Author a reusable fixed-route transit service by defining route geometry, ordered stops and variants, trips and service calendars, then validate operational standards and publish consistent rider-facing and machine-readable representations.",
  "regions": [
    "service-pattern-authoring",
    "service-objective-area-and-policy-version",
    "network-and-stop-geometry",
    "ordered-stop-pattern-and-direction-variants",
    "trip-frequency-and-calendar-generator",
    "block-and-interlining-dependencies",
    "coverage-headway-load-and-equity-validation",
    "rider-facing-map-timetable-and-exception-preview",
    "feed-schema-and-cross-file-validation",
    "versioned-publication"
  ],
  "regionRelationships": [
    "one service specification generates both operational trips and public representations."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "service-pattern-authoring -> service-objective-area-and-policy-version -> network-and-stop-geometry -> ordered-stop-pattern-and-direction-variants -> trip-frequency-and-calendar-generator -> block-and-interlining-dependencies -> coverage-headway-load-and-equity-validation -> rider-facing-map-timetable-and-exception-preview -> feed-schema-and-cross-file-validation -> versioned-publication",
    "navigationReplacement": "<none or named evidence view or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "rider-facing-map-timetable-and-exception-preview",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": [
    "Network loading/stale",
    "stop active/temporarily closed",
    "pattern incomplete/valid",
    "trip/calendar generated/conflicting",
    "frequency under/meeting standard",
    "load/coverage/equity pass/fail",
    "interline broken/valid",
    "preview current/stale",
    "feed invalid/valid",
    "publication draft/scheduled/live/superseded",
    "rollback available"
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

