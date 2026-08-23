# Railway movement authority control console

## LOADS

None.

## Record

### Identity

| Trường | Giá trị |
|---|---|
| Archetype ID | `railway-movement-authority-control-console` |
| Family | Work |
| Dominant task | Thiết lập, truyền, giám sát và giải phóng một movement authority của tàu mà giới hạn an toàn bắt nguồn từ chiếm dụng đường, khóa tuyến và ghi, tính toàn vẹn tàu, hạn chế tốc độ và khoảng hãm. |
| Search aliases | `railway movement authority control`, `railway movement authority control workspace`, `railway movement authority control control` |
| Authority | Macro topology dùng chung và trung lập sản phẩm; Grammar sở hữu ngữ nghĩa sản phẩm, Principles sở hữu geometry chưa giải quyết và Direction sở hữu visual character. |

### Invariants

- Thiết lập, truyền, giám sát và giải phóng một movement authority của tàu mà giới hạn an toàn bắt nguồn từ chiếm dụng đường, khóa tuyến và ghi, tính toàn vẹn tàu, hạn chế tốc độ và khoảng hãm.
- Mọi vùng bắt buộc tạo thành một chuỗi bằng chứng đến quyết định có thể truy vết; đầu ra trung gian không tự đóng task.
- Mỗi vùng bắt buộc giữ owner riêng và cùng selected context.
- Wide, intermediate và compact giữ DOM, reading/focus order có nghĩa, action parity và recovery xác định.

## Recognition

### Situation codes

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-RMACC-01` | Dominant task là outcome quan sát được bắt buộc. | Bằng chứng bắt buộc. |
| `AR-RMACC-02` | Toàn bộ region graph và quan hệ đã đặt tên là cần thiết. | Bằng chứng bắt buộc. |
| `AR-RMACC-03` | Compact giữ action, state, recovery và nghĩa focus của wide. | Bằng chứng bắt buộc. |
| `AR-RMACC-04` | State đặc thù task có thể đổi sau khi người dùng tạo work state. | Bằng chứng bắt buộc. |
| `AR-RMACC-90` | Dominant task thực ra là `rail-possession-access-planner`. | Reject. |
| `AR-RMACC-91` | Dominant task thực ra là `dependency-topology-monitor`. | Reject. |
| `AR-RMACC-92` | Dominant task thực ra là `permit-to-work-isolation-control-room`. | Reject. |
| `AR-RMACC-93` | Dominant task thực ra là `air-traffic-separation-resolution-console`. | Reject. |

### Selection rule

Chọn `railway-movement-authority-control-console` khi và chỉ khi `AR-RMACC-01` đến `AR-RMACC-04` có bằng chứng và không mã nào từ `AR-RMACC-90` đến `AR-RMACC-93` đúng. Trả `needs-evidence` khi owner hoặc relationship chưa được giải quyết; trả `reject` khi có rejection code.

## Region graph

```text
movement-control → control-area-operating-mode-and-rule-version → discrete-track-block-topology ↔ train-identity-position-direction-integrity-and-braking-model → route-lock-and-point-state → train-specific-moving-authority-envelope-with-speed-distance-braking-curve → occupancy-and-stop-before-limit-proof → issue-transmit-driver-acknowledgement → supervised-train-front-progression-and-rear-integrity → progressive-block-by-block-release → authority-close-or-degraded-mode-log
```

### Region obligations

| Region | Nghĩa vụ owner và relationship |
|---|---|
| `movement-control` | Sở hữu dominant task, toàn bộ trạng thái hậu duệ và boundary recovery. |
| `control-area-operating-mode-and-rule-version` | Sở hữu bằng chứng hoặc hành động của Control Area Operating Mode And Rule Version và giữ quan hệ đã khai báo với selection hiện tại. |
| `discrete-track-block-topology` | Sở hữu bằng chứng hoặc hành động của Discrete Track Block Topology và giữ quan hệ đã khai báo với selection hiện tại. |
| `train-identity-position-direction-integrity-and-braking-model` | Sở hữu bằng chứng hoặc hành động của Train Identity Position Direction Integrity And Braking Model và giữ quan hệ đã khai báo với selection hiện tại. |
| `route-lock-and-point-state` | Sở hữu bằng chứng hoặc hành động của Route Lock And Point State và giữ quan hệ đã khai báo với selection hiện tại. |
| `train-specific-moving-authority-envelope-with-speed-distance-braking-curve` | Sở hữu bằng chứng hoặc hành động của Train Specific Moving Authority Envelope With Speed Distance Braking Curve và giữ quan hệ đã khai báo với selection hiện tại. |
| `occupancy-and-stop-before-limit-proof` | Sở hữu bằng chứng hoặc hành động của Occupancy And Stop Before Limit Proof và giữ quan hệ đã khai báo với selection hiện tại. |
| `issue-transmit-driver-acknowledgement` | Sở hữu bằng chứng hoặc hành động của Issue Transmit Driver Acknowledgement và giữ quan hệ đã khai báo với selection hiện tại. |
| `supervised-train-front-progression-and-rear-integrity` | Sở hữu bằng chứng hoặc hành động của Supervised Train Front Progression And Rear Integrity và giữ quan hệ đã khai báo với selection hiện tại. |
| `progressive-block-by-block-release` | Sở hữu bằng chứng hoặc hành động của Progressive Block By Block Release và giữ quan hệ đã khai báo với selection hiện tại. |
| `authority-close-or-degraded-mode-log` | Sở hữu bằng chứng hoặc hành động của Authority Close Or Degraded Mode Log và giữ quan hệ đã khai báo với selection hiện tại. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi các vùng đồng thời không còn giữ được label dễ đọc, liên kết chính xác và action đầy đủ.
- **Topology response:** Sơ đồ block, tàu đã chọn, khóa tuyến, envelope thẩm quyền, bằng chứng hãm/xung đột và ledger truyền/xác nhận luôn cùng hiện diện.
- **Navigation replacement:** Không có khi mọi vùng bắt buộc vẫn đồng thời dùng được.
- **Sticky boundary:** Chỉ trạng thái hoặc action của task hiện tại được persist; nó dành chỗ và yield khi chiều cao ngắn.
- **Overflow owner:** `discrete-track-block-topology` sở hữu overflow có giới hạn; page không sở hữu overflow ngang.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi vùng hỗ trợ ưu tiên thấp nhất làm quan hệ chính không còn dùng được.
- **Topology response:** Tàu đã chọn và thẩm quyền đề xuất là chính; sơ đồ cùng bằng chứng hãm/khóa luân phiên, còn trạng thái truyền được giữ tới khi xác nhận.
- **Navigation replacement:** Các evidence view có tên thay vùng bị dời và giữ đúng selection cùng trigger.
- **Sticky boundary:** Verdict hiện tại chỉ persist khi target vẫn thấy được và trở lại flow khi chiều cao ngắn.
- **Overflow owner:** Owner có giới hạn của wide vẫn cục bộ; view luân phiên không tạo nested page scroll.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai vùng task không thể đồng thời giữ bằng chứng dễ đọc, target 44 px và focus không bị che.
- **Topology response:** Tàu và tính toàn vẹn → chuỗi tuyến/block đã khóa → giới hạn thẩm quyền và đường cong hãm → chứng minh dừng trước giới hạn → truyền và xác nhận → tiến đầu tàu → chứng minh đuôi tàu đã qua → giải phóng từng block.
- **Navigation replacement:** Primary-pane sequence có Back khôi phục selection, state, query, scroll context và đúng trigger.
- **Sticky boundary:** Action bar dành sẵn chỗ, không che focus và trở về normal flow khi chiều cao ngắn.
- **Overflow owner:** Visual có giới hạn có bản tương đương dạng chữ theo thứ tự làm representation compact chính.

### Reflow

- Semantic, DOM và meaningful focus order giữ graph: `movement-control → control-area-operating-mode-and-rule-version → discrete-track-block-topology ↔ train-identity-position-direction-integrity-and-braking-model → route-lock-and-point-state → train-specific-moving-authority-envelope-with-speed-distance-braking-curve → occupancy-and-stop-before-limit-proof → issue-transmit-driver-acknowledgement → supervised-train-front-progression-and-rear-integrity → progressive-block-by-block-release → authority-close-or-degraded-mode-log`.
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

Các state đặc thù task: Occupancy unknown/clear/occupied, train position fresh/stale, integrity confirmed/unknown, points normal/reverse/failed, route unlocked/setting/locked, authority proposed/conflicting/valid/transmitted/acknowledged, train stationary/moving/overrun risk, block released, authority shortened/cancelled and degraded verbal procedure active.

| State | Region sở hữu | Nghĩa vụ |
|---|---|---|
| Initial / loading | `control-area-operating-mode-and-rule-version` | Nêu scope đang tải, giữ chỗ primary region và chỉ block owner lỗi. |
| Ready | `discrete-track-block-topology` | Hiện object, owner relationship, selection và action hợp lệ bằng text lẫn semantics. |
| Empty / not applicable | `discrete-track-block-topology` | Phân biệt empty thật, no-match và not-applicable rồi cung cấp next action hợp lệ. |
| Error / retry | `progressive-block-by-block-release` | Giữ context/input hợp lệ, nêu owner lỗi và cung cấp local retry. |
| Permission / unavailable | `authority-close-or-degraded-mode-log` | Giải thích restriction mà không ngụ ý bằng chứng ẩn là không tồn tại và cung cấp safe exit. |
| Pending | `authority-close-or-degraded-mode-log` | Ngăn duplicate action, giữ đúng target và announce progress mà không dời focus. |
| Success | `authority-close-or-degraded-mode-log` | Xác nhận outcome chính xác, giữ selection và cung cấp next action hoặc recovery. |
| Stale / conflict | `control-area-operating-mode-and-rule-version` | Giữ last-safe value, nêu version/time conflict và yêu cầu recovery rõ. |
| Focus transition | `authority-close-or-degraded-mode-log` | Chỉ dời focus vào modal hoặc error summary bắt buộc rồi trả về đúng trigger. |
| Responsive presentation | `movement-control` | Giữ state, selection, query, pending result và recovery khi topology đổi. |

## Boundaries

### Accept

- Accept khi dominant task là: Thiết lập, truyền, giám sát và giải phóng một movement authority của tàu mà giới hạn an toàn bắt nguồn từ chiếm dụng đường, khóa tuyến và ghi, tính toàn vẹn tàu, hạn chế tốc độ và khoảng hãm.
- Accept khi mọi region và relationship bắt buộc trong graph đều cần để hoàn thành task.
- Accept khi compact giữ task, state và recovery bằng replacement topology thay vì stack box desktop.

### Reject

- Reject `rail-possession-access-planner`; đây là bằng chứng `AR-RMACC-90` và phải route sang archetype kề.
- Reject `dependency-topology-monitor`; đây là bằng chứng `AR-RMACC-91` và phải route sang archetype kề.
- Reject `permit-to-work-isolation-control-room`; đây là bằng chứng `AR-RMACC-92` và phải route sang archetype kề.
- Reject `air-traffic-separation-resolution-console`; đây là bằng chứng `AR-RMACC-93` và phải route sang archetype kề.

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
| [ERA European Rail Traffic Management System](https://www.era.europa.eu/domains/infrastructure/european-rail-traffic-management-system-ertms_en) | Quan hệ nghiệp vụ chính thức và boundary quyền hạn đặc thù cho dominant task. | Không chọn archetype, không định nghĩa product truth và không cho phép sao chép geometry. |
| [FRA Positive Train Control](https://railroads.fra.dot.gov/research-development/program-areas/train-control/ptc/positive-train-control-ptc) | Quan hệ nghiệp vụ chính thức và boundary quyền hạn đặc thù cho dominant task. | Không chọn archetype, không định nghĩa product truth và không cho phép sao chép geometry. |

Tập nguồn gồm ít nhất ba tổ chức chính thức độc lập và bằng chứng accessibility của W3C.

## Output

```json
{
  "archetypeId": "railway-movement-authority-control-console",
  "situationCodes": [
    "<matched AR-RMACC-* codes>"
  ],
  "searchAliases": [
    "railway movement authority control",
    "railway movement authority control workspace",
    "railway movement authority control control"
  ],
  "dominantTask": "Establish, transmit, supervise and release one train movement authority whose safe limit derives from track occupancy, route and point locking, train integrity, speed restrictions and braking distance.",
  "regions": [
    "movement-control",
    "control-area-operating-mode-and-rule-version",
    "discrete-track-block-topology",
    "train-identity-position-direction-integrity-and-braking-model",
    "route-lock-and-point-state",
    "train-specific-moving-authority-envelope-with-speed-distance-braking-curve",
    "occupancy-and-stop-before-limit-proof",
    "issue-transmit-driver-acknowledgement",
    "supervised-train-front-progression-and-rear-integrity",
    "progressive-block-by-block-release",
    "authority-close-or-degraded-mode-log"
  ],
  "regionRelationships": [
    "a block is released only behind the proven rear of this train, never merely because a possession window ended."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "movement-control -> control-area-operating-mode-and-rule-version -> discrete-track-block-topology -> train-identity-position-direction-integrity-and-braking-model -> route-lock-and-point-state -> train-specific-moving-authority-envelope-with-speed-distance-braking-curve -> occupancy-and-stop-before-limit-proof -> issue-transmit-driver-acknowledgement -> supervised-train-front-progression-and-rear-integrity -> progressive-block-by-block-release -> authority-close-or-degraded-mode-log",
    "navigationReplacement": "<none or named evidence view or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "discrete-track-block-topology",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": [
    "Occupancy unknown/clear/occupied",
    "train position fresh/stale",
    "integrity confirmed/unknown",
    "points normal/reverse/failed",
    "route unlocked/setting/locked",
    "authority proposed/conflicting/valid/transmitted/acknowledged",
    "train stationary/moving/overrun risk",
    "block released",
    "authority shortened/cancelled",
    "degraded verbal procedure active"
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

