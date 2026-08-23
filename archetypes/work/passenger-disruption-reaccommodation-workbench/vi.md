# Passenger disruption reaccommodation workbench

## LOADS

None.

## Record

### Identity

| Trường | Giá trị |
|---|---|
| Archetype ID | `passenger-disruption-reaccommodation-workbench` |
| Family | Work |
| Dominant task | Khôi phục một party hành khách bị gián đoạn bằng cách dựng package hành trình thay thế đáp ứng document, accessibility, seat, baggage và connection của từng người, giữ party cùng nhau trừ khi split được đồng ý rõ. |
| Search aliases | `passenger disruption reaccommodation`, `passenger disruption reaccommodation workspace`, `passenger disruption reaccommodation control` |
| Authority | Macro topology dùng chung và trung lập sản phẩm; Grammar sở hữu ngữ nghĩa sản phẩm, Principles sở hữu geometry chưa giải quyết và Direction sở hữu visual character. |

### Invariants

- Khôi phục một party hành khách bị gián đoạn bằng cách dựng package hành trình thay thế đáp ứng document, accessibility, seat, baggage và connection của từng người, giữ party cùng nhau trừ khi split được đồng ý rõ.
- Mọi vùng bắt buộc tạo thành một chuỗi bằng chứng đến quyết định có thể truy vết; đầu ra trung gian không tự đóng task.
- Mỗi vùng bắt buộc giữ owner riêng và cùng selected context.
- Wide, intermediate và compact giữ DOM, reading/focus order có nghĩa, action parity và recovery xác định.

## Recognition

### Situation codes

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-PDRW-01` | Dominant task là outcome quan sát được bắt buộc. | Bằng chứng bắt buộc. |
| `AR-PDRW-02` | Toàn bộ region graph và quan hệ đã đặt tên là cần thiết. | Bằng chứng bắt buộc. |
| `AR-PDRW-03` | Compact giữ action, state, recovery và nghĩa focus của wide. | Bằng chứng bắt buộc. |
| `AR-PDRW-04` | State đặc thù task có thể đổi sau khi người dùng tạo work state. | Bằng chứng bắt buộc. |
| `AR-PDRW-90` | Dominant task thực ra là `spatial-route-itinerary-explorer`. | Reject. |
| `AR-PDRW-91` | Dominant task thực ra là `booking-slot-selection`. | Reject. |
| `AR-PDRW-92` | Dominant task thực ra là `waitlist-offer-allocation-board`. | Reject. |
| `AR-PDRW-93` | Dominant task thực ra là `multi-item-return-resolution`. | Reject. |
| `AR-PDRW-94` | Dominant task thực ra là `nonlinear-task-list-application`. | Reject. |

### Selection rule

Chọn `passenger-disruption-reaccommodation-workbench` khi và chỉ khi `AR-PDRW-01` đến `AR-PDRW-04` có bằng chứng và không mã nào từ `AR-PDRW-90` đến `AR-PDRW-94` đúng. Trả `needs-evidence` khi owner hoặc relationship chưa được giải quyết; trả `reject` khi có rejection code.

## Region graph

```text
reaccommodation-workbench → disruption-and-original-journey-contract → passenger-party-membership-access-document-and-assistance-constraints → original-segments-ticket-coupons-and-baggage-state → complete-origin-to-contracted-destination-replacement-package-graph → every-segment-seat-connection-and-baggage-feasibility-per-passenger → keep-party-together-or-record-explicit-member-level-split-consent → care-refund-compensation-and-assistance-ledger → selected-complete-party-recovery-package → atomic-all-passenger-rebook-reissue-or-full-rollback → notifications-and-per-passenger-party-receipts
```

### Region obligations

| Region | Nghĩa vụ owner và relationship |
|---|---|
| `reaccommodation-workbench` | Sở hữu dominant task, toàn bộ trạng thái hậu duệ và boundary recovery. |
| `disruption-and-original-journey-contract` | Sở hữu bằng chứng hoặc hành động của Disruption And Original Journey Contract và giữ quan hệ đã khai báo với selection hiện tại. |
| `passenger-party-membership-access-document-and-assistance-constraints` | Sở hữu bằng chứng hoặc hành động của Passenger Party Membership Access Document And Assistance Constraints và giữ quan hệ đã khai báo với selection hiện tại. |
| `original-segments-ticket-coupons-and-baggage-state` | Sở hữu bằng chứng hoặc hành động của Original Segments Ticket Coupons And Baggage State và giữ quan hệ đã khai báo với selection hiện tại. |
| `complete-origin-to-contracted-destination-replacement-package-graph` | Sở hữu bằng chứng hoặc hành động của Complete Origin To Contracted Destination Replacement Package Graph và giữ quan hệ đã khai báo với selection hiện tại. |
| `every-segment-seat-connection-and-baggage-feasibility-per-passenger` | Sở hữu bằng chứng hoặc hành động của Every Segment Seat Connection And Baggage Feasibility Per Passenger và giữ quan hệ đã khai báo với selection hiện tại. |
| `keep-party-together-or-record-explicit-member-level-split-consent` | Sở hữu bằng chứng hoặc hành động của Keep Party Together Or Record Explicit Member Level Split Consent và giữ quan hệ đã khai báo với selection hiện tại. |
| `care-refund-compensation-and-assistance-ledger` | Sở hữu bằng chứng hoặc hành động của Care Refund Compensation And Assistance Ledger và giữ quan hệ đã khai báo với selection hiện tại. |
| `selected-complete-party-recovery-package` | Sở hữu bằng chứng hoặc hành động của Selected Complete Party Recovery Package và giữ quan hệ đã khai báo với selection hiện tại. |
| `atomic-all-passenger-rebook-reissue-or-full-rollback` | Sở hữu bằng chứng hoặc hành động của Atomic All Passenger Rebook Reissue Or Full Rollback và giữ quan hệ đã khai báo với selection hiện tại. |
| `notifications-and-per-passenger-party-receipts` | Sở hữu bằng chứng hoặc hành động của Notifications And Per Passenger Party Receipts và giữ quan hệ đã khai báo với selection hiện tại. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi các vùng đồng thời không còn giữ được label dễ đọc, liên kết chính xác và action đầy đủ.
- **Topology response:** Hành trình gốc, constraint hành khách, graph thay thế, tính khả thi party/seat, assistance ledger và receipt phát hành cùng so sánh được; chỉ graph hành trình sở hữu pan ngang có giới hạn.
- **Navigation replacement:** Không có khi mọi vùng bắt buộc vẫn đồng thời dùng được.
- **Sticky boundary:** Chỉ trạng thái hoặc action của task hiện tại được persist; nó dành chỗ và yield khi chiều cao ngắn.
- **Overflow owner:** `complete-origin-to-contracted-destination-replacement-package-graph` sở hữu overflow có giới hạn; page không sở hữu overflow ngang.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi vùng hỗ trợ ưu tiên thấp nhất làm quan hệ chính không còn dùng được.
- **Topology response:** Party và package đã chọn được ghim; lựa chọn hành trình và passenger/assistance feasibility luân phiên, còn commit summary nằm kề.
- **Navigation replacement:** Các evidence view có tên thay vùng bị dời và giữ đúng selection cùng trigger.
- **Sticky boundary:** Verdict hiện tại chỉ persist khi target vẫn thấy được và trở lại flow khi chiều cao ngắn.
- **Overflow owner:** Owner có giới hạn của wide vẫn cục bộ; view luân phiên không tạo nested page scroll.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai vùng task không thể đồng thời giữ bằng chứng dễ đọc, target 44 px và focus không bị che.
- **Topology response:** Gián đoạn → thành viên và contract gốc → constraint bắt buộc từng người → package toàn chặng xếp hạng → proof seat/access/document/baggage từng người → cùng nhau hoặc split consent → hệ quả assistance → rebook/reissue nguyên tử hoặc rollback → receipt.
- **Navigation replacement:** Primary-pane sequence có Back khôi phục selection, state, query, scroll context và đúng trigger.
- **Sticky boundary:** Action bar dành sẵn chỗ, không che focus và trở về normal flow khi chiều cao ngắn.
- **Overflow owner:** Visual có giới hạn có bản tương đương dạng chữ theo thứ tự làm representation compact chính.

### Reflow

- Semantic, DOM và meaningful focus order giữ graph: `reaccommodation-workbench → disruption-and-original-journey-contract → passenger-party-membership-access-document-and-assistance-constraints → original-segments-ticket-coupons-and-baggage-state → complete-origin-to-contracted-destination-replacement-package-graph → every-segment-seat-connection-and-baggage-feasibility-per-passenger → keep-party-together-or-record-explicit-member-level-split-consent → care-refund-compensation-and-assistance-ledger → selected-complete-party-recovery-package → atomic-all-passenger-rebook-reissue-or-full-rollback → notifications-and-per-passenger-party-receipts`.
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

Các state đặc thù task: Disruption loading/confirmed/changed, segment operating/cancelled/misconnected, passenger verified/document-blocked, accessibility request unmet/matched, baggage retained/transferred/unknown, seat tentative/held/expired/confirmed, connection feasible/risky/impossible, party together/split-proposed/split-consented, care due/offered/accepted, package draft/committing/partially-failed/issued and notification acknowledged.

| State | Region sở hữu | Nghĩa vụ |
|---|---|---|
| Initial / loading | `disruption-and-original-journey-contract` | Nêu scope đang tải, giữ chỗ primary region và chỉ block owner lỗi. |
| Ready | `passenger-party-membership-access-document-and-assistance-constraints` | Hiện object, owner relationship, selection và action hợp lệ bằng text lẫn semantics. |
| Empty / not applicable | `passenger-party-membership-access-document-and-assistance-constraints` | Phân biệt empty thật, no-match và not-applicable rồi cung cấp next action hợp lệ. |
| Error / retry | `atomic-all-passenger-rebook-reissue-or-full-rollback` | Giữ context/input hợp lệ, nêu owner lỗi và cung cấp local retry. |
| Permission / unavailable | `notifications-and-per-passenger-party-receipts` | Giải thích restriction mà không ngụ ý bằng chứng ẩn là không tồn tại và cung cấp safe exit. |
| Pending | `notifications-and-per-passenger-party-receipts` | Ngăn duplicate action, giữ đúng target và announce progress mà không dời focus. |
| Success | `notifications-and-per-passenger-party-receipts` | Xác nhận outcome chính xác, giữ selection và cung cấp next action hoặc recovery. |
| Stale / conflict | `disruption-and-original-journey-contract` | Giữ last-safe value, nêu version/time conflict và yêu cầu recovery rõ. |
| Focus transition | `notifications-and-per-passenger-party-receipts` | Chỉ dời focus vào modal hoặc error summary bắt buộc rồi trả về đúng trigger. |
| Responsive presentation | `reaccommodation-workbench` | Giữ state, selection, query, pending result và recovery khi topology đổi. |

## Boundaries

### Accept

- Accept khi dominant task là: Khôi phục một party hành khách bị gián đoạn bằng cách dựng package hành trình thay thế đáp ứng document, accessibility, seat, baggage và connection của từng người, giữ party cùng nhau trừ khi split được đồng ý rõ.
- Accept khi mọi region và relationship bắt buộc trong graph đều cần để hoàn thành task.
- Accept khi compact giữ task, state và recovery bằng replacement topology thay vì stack box desktop.

### Reject

- Reject `spatial-route-itinerary-explorer`; đây là bằng chứng `AR-PDRW-90` và phải route sang archetype kề.
- Reject `booking-slot-selection`; đây là bằng chứng `AR-PDRW-91` và phải route sang archetype kề.
- Reject `waitlist-offer-allocation-board`; đây là bằng chứng `AR-PDRW-92` và phải route sang archetype kề.
- Reject `multi-item-return-resolution`; đây là bằng chứng `AR-PDRW-93` và phải route sang archetype kề.
- Reject `nonlinear-task-list-application`; đây là bằng chứng `AR-PDRW-94` và phải route sang archetype kề.

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
| [European Commission air passenger rights](https://europa.eu/youreurope/citizens/travel/passenger-rights/air/index_en.htm) | Quan hệ nghiệp vụ chính thức và boundary quyền hạn đặc thù cho dominant task. | Không chọn archetype, không định nghĩa product truth và không cho phép sao chép geometry. |
| [U.S. Department of Transportation airline refunds](https://www.transportation.gov/individuals/aviation-consumer-protection/refunds) | Quan hệ nghiệp vụ chính thức và boundary quyền hạn đặc thù cho dominant task. | Không chọn archetype, không định nghĩa product truth và không cho phép sao chép geometry. |

Tập nguồn gồm ít nhất ba tổ chức chính thức độc lập và bằng chứng accessibility của W3C.

## Output

```json
{
  "archetypeId": "passenger-disruption-reaccommodation-workbench",
  "situationCodes": [
    "<matched AR-PDRW-* codes>"
  ],
  "searchAliases": [
    "passenger disruption reaccommodation",
    "passenger disruption reaccommodation workspace",
    "passenger disruption reaccommodation control"
  ],
  "dominantTask": "Recover a disrupted passenger party by constructing replacement journey packages that satisfy individual documents, accessibility, seat, baggage and connection constraints while keeping the party together unless an explicit split is accepted.",
  "regions": [
    "reaccommodation-workbench",
    "disruption-and-original-journey-contract",
    "passenger-party-membership-access-document-and-assistance-constraints",
    "original-segments-ticket-coupons-and-baggage-state",
    "complete-origin-to-contracted-destination-replacement-package-graph",
    "every-segment-seat-connection-and-baggage-feasibility-per-passenger",
    "keep-party-together-or-record-explicit-member-level-split-consent",
    "care-refund-compensation-and-assistance-ledger",
    "selected-complete-party-recovery-package",
    "atomic-all-passenger-rebook-reissue-or-full-rollback",
    "notifications-and-per-passenger-party-receipts"
  ],
  "regionRelationships": [
    "a candidate is not a package until every passenger and every replacement segment is feasible, and partial ticket reissue is never a successful commit."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "reaccommodation-workbench -> disruption-and-original-journey-contract -> passenger-party-membership-access-document-and-assistance-constraints -> original-segments-ticket-coupons-and-baggage-state -> complete-origin-to-contracted-destination-replacement-package-graph -> every-segment-seat-connection-and-baggage-feasibility-per-passenger -> keep-party-together-or-record-explicit-member-level-split-consent -> care-refund-compensation-and-assistance-ledger -> selected-complete-party-recovery-package -> atomic-all-passenger-rebook-reissue-or-full-rollback -> notifications-and-per-passenger-party-receipts",
    "navigationReplacement": "<none or named evidence view or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "complete-origin-to-contracted-destination-replacement-package-graph",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": [
    "Disruption loading/confirmed/changed",
    "segment operating/cancelled/misconnected",
    "passenger verified/document-blocked",
    "accessibility request unmet/matched",
    "baggage retained/transferred/unknown",
    "seat tentative/held/expired/confirmed",
    "connection feasible/risky/impossible",
    "party together/split-proposed/split-consented",
    "care due/offered/accepted",
    "package draft/committing/partially-failed/issued",
    "notification acknowledged"
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

