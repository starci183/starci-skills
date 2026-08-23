# Rail consist inspection release workbench

## LOADS

None.

## Record

### Identity

| Trường | Giá trị |
|---|---|
| Archetype ID | `rail-consist-inspection-release-workbench` |
| Family | Work |
| Dominant task | Đối soát một consist tàu có thứ tự, chứng minh tính liên tục brake test, xử lý defect và constraint dangerous-goods theo từng toa rồi phát hành release hoặc restriction toàn tàu với signoff theo vai trò. |
| Search aliases | `rail consist inspection release`, `rail consist inspection release workspace`, `rail consist inspection release control` |
| Authority | Macro topology dùng chung và trung lập sản phẩm; Grammar sở hữu ngữ nghĩa sản phẩm, Principles sở hữu geometry chưa giải quyết và Direction sở hữu visual character. |

### Invariants

- Đối soát một consist tàu có thứ tự, chứng minh tính liên tục brake test, xử lý defect và constraint dangerous-goods theo từng toa rồi phát hành release hoặc restriction toàn tàu với signoff theo vai trò.
- Mọi vùng bắt buộc tạo thành một chuỗi bằng chứng đến quyết định có thể truy vết; đầu ra trung gian không tự đóng task.
- Mỗi vùng bắt buộc giữ owner riêng và cùng selected context.
- Wide, intermediate và compact giữ DOM, reading/focus order có nghĩa, action parity và recovery xác định.

## Recognition

### Situation codes

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-RCIRW-01` | Dominant task là outcome quan sát được bắt buộc. | Bằng chứng bắt buộc. |
| `AR-RCIRW-02` | Toàn bộ region graph và quan hệ đã đặt tên là cần thiết. | Bằng chứng bắt buộc. |
| `AR-RCIRW-03` | Compact giữ action, state, recovery và nghĩa focus của wide. | Bằng chứng bắt buộc. |
| `AR-RCIRW-04` | State đặc thù task có thể đổi sau khi người dùng tạo work state. | Bằng chứng bắt buộc. |
| `AR-RCIRW-90` | Dominant task thực ra là `stage-gated-process-record`. | Reject. |
| `AR-RCIRW-91` | Dominant task thực ra là `regulatory-filing-package-validator`. | Reject. |
| `AR-RCIRW-92` | Dominant task thực ra là `chain-of-custody-transfer-ledger`. | Reject. |
| `AR-RCIRW-93` | Dominant task thực ra là `permit-to-work-isolation-control-room`. | Reject. |

### Selection rule

Chọn `rail-consist-inspection-release-workbench` khi và chỉ khi `AR-RCIRW-01` đến `AR-RCIRW-04` có bằng chứng và không mã nào từ `AR-RCIRW-90` đến `AR-RCIRW-93` đúng. Trả `needs-evidence` khi owner hoặc relationship chưa được giải quyết; trả `reject` khi có rejection code.

## Region graph

```text
consist-release → train-identity-route-and-operating-rule-set → exact-ordered-physical-locomotive-and-car-chain → position-bound-car-identity-load-and-dangerous-goods-register → end-to-end-brake-pipe-and-tested-car-coverage-map ↔ car-defect-and-restriction-ledger → order-dependent-dangerous-goods-separation-and-placement-proof → reorder-couple-or-uncouple-change-impact → retest-and-continuous-brake-coverage-restoration → whole-train-readiness → independent-role-signoffs → one-global-release-restriction-or-rebuild-lineage
```

### Region obligations

| Region | Nghĩa vụ owner và relationship |
|---|---|
| `consist-release` | Sở hữu dominant task, toàn bộ trạng thái hậu duệ và boundary recovery. |
| `train-identity-route-and-operating-rule-set` | Sở hữu bằng chứng hoặc hành động của Train Identity Route And Operating Rule Set và giữ quan hệ đã khai báo với selection hiện tại. |
| `exact-ordered-physical-locomotive-and-car-chain` | Sở hữu bằng chứng hoặc hành động của Exact Ordered Physical Locomotive And Car Chain và giữ quan hệ đã khai báo với selection hiện tại. |
| `position-bound-car-identity-load-and-dangerous-goods-register` | Sở hữu bằng chứng hoặc hành động của Position Bound Car Identity Load And Dangerous Goods Register và giữ quan hệ đã khai báo với selection hiện tại. |
| `end-to-end-brake-pipe-and-tested-car-coverage-map` | Sở hữu bằng chứng hoặc hành động của End To End Brake Pipe And Tested Car Coverage Map và giữ quan hệ đã khai báo với selection hiện tại. |
| `car-defect-and-restriction-ledger` | Sở hữu bằng chứng hoặc hành động của Car Defect And Restriction Ledger và giữ quan hệ đã khai báo với selection hiện tại. |
| `order-dependent-dangerous-goods-separation-and-placement-proof` | Sở hữu bằng chứng hoặc hành động của Order Dependent Dangerous Goods Separation And Placement Proof và giữ quan hệ đã khai báo với selection hiện tại. |
| `reorder-couple-or-uncouple-change-impact` | Sở hữu bằng chứng hoặc hành động của Reorder Couple Or Uncouple Change Impact và giữ quan hệ đã khai báo với selection hiện tại. |
| `retest-and-continuous-brake-coverage-restoration` | Sở hữu bằng chứng hoặc hành động của Retest And Continuous Brake Coverage Restoration và giữ quan hệ đã khai báo với selection hiện tại. |
| `whole-train-readiness` | Sở hữu bằng chứng hoặc hành động của Whole Train Readiness và giữ quan hệ đã khai báo với selection hiện tại. |
| `independent-role-signoffs` | Sở hữu bằng chứng hoặc hành động của Independent Role Signoffs và giữ quan hệ đã khai báo với selection hiện tại. |
| `one-global-release-restriction-or-rebuild-lineage` | Sở hữu bằng chứng hoặc hành động của One Global Release Restriction Or Rebuild Lineage và giữ quan hệ đã khai báo với selection hiện tại. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi các vùng đồng thời không còn giữ được label dễ đọc, liên kết chính xác và action đầy đủ.
- **Topology response:** Consist có thứ tự, dữ kiện toa đã chọn, brake coverage, defect/restriction, dangerous-goods placement và readiness/signoff toàn cục cùng hiện diện; chỉ consist strip sở hữu overflow dọc đoàn.
- **Navigation replacement:** Không có khi mọi vùng bắt buộc vẫn đồng thời dùng được.
- **Sticky boundary:** Chỉ trạng thái hoặc action của task hiện tại được persist; nó dành chỗ và yield khi chiều cao ngắn.
- **Overflow owner:** `end-to-end-brake-pipe-and-tested-car-coverage-map` sở hữu overflow có giới hạn; page không sở hữu overflow ngang.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi vùng hỗ trợ ưu tiên thấp nhất làm quan hệ chính không còn dùng được.
- **Topology response:** Vị trí toa và readiness toàn tàu được ghim; consist/brake evidence và defect/placement evidence luân phiên, còn signoff tồn tại.
- **Navigation replacement:** Các evidence view có tên thay vùng bị dời và giữ đúng selection cùng trigger.
- **Sticky boundary:** Verdict hiện tại chỉ persist khi target vẫn thấy được và trở lại flow khi chiều cao ngắn.
- **Overflow owner:** Owner có giới hạn của wide vẫn cục bộ; view luân phiên không tạo nested page scroll.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai vùng task không thể đồng thời giữ bằng chứng dễ đọc, target 44 px và focus không bị che.
- **Topology response:** Danh tính tàu → chuỗi locomotive/car đánh số → toa vật lý và vị trí → boundary brake-test liên tục → defect/restriction → dangerous-goods placement → tác động reorder/retest → readiness → signoff → verdict toàn tàu.
- **Navigation replacement:** Primary-pane sequence có Back khôi phục selection, state, query, scroll context và đúng trigger.
- **Sticky boundary:** Action bar dành sẵn chỗ, không che focus và trở về normal flow khi chiều cao ngắn.
- **Overflow owner:** Visual có giới hạn có bản tương đương dạng chữ theo thứ tự làm representation compact chính.

### Reflow

- Semantic, DOM và meaningful focus order giữ graph: `consist-release → train-identity-route-and-operating-rule-set → exact-ordered-physical-locomotive-and-car-chain → position-bound-car-identity-load-and-dangerous-goods-register → end-to-end-brake-pipe-and-tested-car-coverage-map ↔ car-defect-and-restriction-ledger → order-dependent-dangerous-goods-separation-and-placement-proof → reorder-couple-or-uncouple-change-impact → retest-and-continuous-brake-coverage-restoration → whole-train-readiness → independent-role-signoffs → one-global-release-restriction-or-rebuild-lineage`.
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

Các state đặc thù task: Consist loading/reconciled/mismatched, car identity verified/unknown/duplicate, position planned/actual/moved, brake test not-run/partial/passed/failed/expired, defect open/deferred/repaired, restriction compatible/blocking, dangerous-goods document missing/valid, placement pass/fail, readiness incomplete/conditional/ready, signoff pending/signed/rejected and release active/revoked/superseded.

| State | Region sở hữu | Nghĩa vụ |
|---|---|---|
| Initial / loading | `train-identity-route-and-operating-rule-set` | Nêu scope đang tải, giữ chỗ primary region và chỉ block owner lỗi. |
| Ready | `exact-ordered-physical-locomotive-and-car-chain` | Hiện object, owner relationship, selection và action hợp lệ bằng text lẫn semantics. |
| Empty / not applicable | `exact-ordered-physical-locomotive-and-car-chain` | Phân biệt empty thật, no-match và not-applicable rồi cung cấp next action hợp lệ. |
| Error / retry | `independent-role-signoffs` | Giữ context/input hợp lệ, nêu owner lỗi và cung cấp local retry. |
| Permission / unavailable | `one-global-release-restriction-or-rebuild-lineage` | Giải thích restriction mà không ngụ ý bằng chứng ẩn là không tồn tại và cung cấp safe exit. |
| Pending | `one-global-release-restriction-or-rebuild-lineage` | Ngăn duplicate action, giữ đúng target và announce progress mà không dời focus. |
| Success | `one-global-release-restriction-or-rebuild-lineage` | Xác nhận outcome chính xác, giữ selection và cung cấp next action hoặc recovery. |
| Stale / conflict | `train-identity-route-and-operating-rule-set` | Giữ last-safe value, nêu version/time conflict và yêu cầu recovery rõ. |
| Focus transition | `one-global-release-restriction-or-rebuild-lineage` | Chỉ dời focus vào modal hoặc error summary bắt buộc rồi trả về đúng trigger. |
| Responsive presentation | `consist-release` | Giữ state, selection, query, pending result và recovery khi topology đổi. |

## Boundaries

### Accept

- Accept khi dominant task là: Đối soát một consist tàu có thứ tự, chứng minh tính liên tục brake test, xử lý defect và constraint dangerous-goods theo từng toa rồi phát hành release hoặc restriction toàn tàu với signoff theo vai trò.
- Accept khi mọi region và relationship bắt buộc trong graph đều cần để hoàn thành task.
- Accept khi compact giữ task, state và recovery bằng replacement topology thay vì stack box desktop.

### Reject

- Reject `stage-gated-process-record`; đây là bằng chứng `AR-RCIRW-90` và phải route sang archetype kề.
- Reject `regulatory-filing-package-validator`; đây là bằng chứng `AR-RCIRW-91` và phải route sang archetype kề.
- Reject `chain-of-custody-transfer-ledger`; đây là bằng chứng `AR-RCIRW-92` và phải route sang archetype kề.
- Reject `permit-to-work-isolation-control-room`; đây là bằng chứng `AR-RCIRW-93` và phải route sang archetype kề.

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
| [Federal Railroad Administration hazardous-materials and consist information](https://railroads.fra.dot.gov/railroad-safety/divisions/hazardous-materials/hazardous-materials) | Quan hệ nghiệp vụ chính thức và boundary quyền hạn đặc thù cho dominant task. | Không chọn archetype, không định nghĩa product truth và không cho phép sao chép geometry. |
| [ERA Operation and Traffic Management TSI](https://www.era.europa.eu/domains/technical-specifications-interoperability/operation-and-traffic-management-tsi_en) | Quan hệ nghiệp vụ chính thức và boundary quyền hạn đặc thù cho dominant task. | Không chọn archetype, không định nghĩa product truth và không cho phép sao chép geometry. |

Tập nguồn gồm ít nhất ba tổ chức chính thức độc lập và bằng chứng accessibility của W3C.

## Output

```json
{
  "archetypeId": "rail-consist-inspection-release-workbench",
  "situationCodes": [
    "<matched AR-RCIRW-* codes>"
  ],
  "searchAliases": [
    "rail consist inspection release",
    "rail consist inspection release workspace",
    "rail consist inspection release control"
  ],
  "dominantTask": "Reconcile an ordered train consist, prove brake-test continuity, resolve car-specific defects and dangerous-goods placement constraints and issue a whole-train release or restriction with role signoffs.",
  "regions": [
    "consist-release",
    "train-identity-route-and-operating-rule-set",
    "exact-ordered-physical-locomotive-and-car-chain",
    "position-bound-car-identity-load-and-dangerous-goods-register",
    "end-to-end-brake-pipe-and-tested-car-coverage-map",
    "car-defect-and-restriction-ledger",
    "order-dependent-dangerous-goods-separation-and-placement-proof",
    "reorder-couple-or-uncouple-change-impact",
    "retest-and-continuous-brake-coverage-restoration",
    "whole-train-readiness",
    "independent-role-signoffs",
    "one-global-release-restriction-or-rebuild-lineage"
  ],
  "regionRelationships": [
    "moving, adding or removing any physical car invalidates affected coverage and placement proof until recomputed for the complete ordered train."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "consist-release -> train-identity-route-and-operating-rule-set -> exact-ordered-physical-locomotive-and-car-chain -> position-bound-car-identity-load-and-dangerous-goods-register -> end-to-end-brake-pipe-and-tested-car-coverage-map -> car-defect-and-restriction-ledger -> order-dependent-dangerous-goods-separation-and-placement-proof -> reorder-couple-or-uncouple-change-impact -> retest-and-continuous-brake-coverage-restoration -> whole-train-readiness -> independent-role-signoffs -> one-global-release-restriction-or-rebuild-lineage",
    "navigationReplacement": "<none or named evidence view or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "end-to-end-brake-pipe-and-tested-car-coverage-map",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": [
    "Consist loading/reconciled/mismatched",
    "car identity verified/unknown/duplicate",
    "position planned/actual/moved",
    "brake test not-run/partial/passed/failed/expired",
    "defect open/deferred/repaired",
    "restriction compatible/blocking",
    "dangerous-goods document missing/valid",
    "placement pass/fail",
    "readiness incomplete/conditional/ready",
    "signoff pending/signed/rejected",
    "release active/revoked/superseded"
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

