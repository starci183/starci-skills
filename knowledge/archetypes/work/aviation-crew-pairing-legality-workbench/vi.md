# Aviation crew pairing legality workbench

## LOADS

None.

## Record

### Identity

| Trường | Giá trị |
|---|---|
| Archetype ID | `aviation-crew-pairing-legality-workbench` |
| Family | Work |
| Dominant task | Xây dựng một tập aviation crew pairing nhiều vai trò hợp lệ phủ mọi flight leg trong khi tuân base, qualification, positioning, connection, acclimatisation, flight-duty, rest và cumulative-duty. |
| Search aliases | `aviation crew pairing legality`, `aviation crew pairing legality workspace`, `aviation crew pairing legality control` |
| Authority | Macro topology dùng chung và trung lập sản phẩm; Grammar sở hữu ngữ nghĩa sản phẩm, Principles sở hữu geometry chưa giải quyết và Direction sở hữu visual character. |

### Invariants

- Xây dựng một tập aviation crew pairing nhiều vai trò hợp lệ phủ mọi flight leg trong khi tuân base, qualification, positioning, connection, acclimatisation, flight-duty, rest và cumulative-duty.
- Mọi vùng bắt buộc tạo thành một chuỗi bằng chứng đến quyết định có thể truy vết; đầu ra trung gian không tự đóng task.
- Mỗi vùng bắt buộc giữ owner riêng và cùng selected context.
- Wide, intermediate và compact giữ DOM, reading/focus order có nghĩa, action parity và recovery xác định.

## Recognition

### Situation codes

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-ACPLW-01` | Dominant task là outcome quan sát được bắt buộc. | Bằng chứng bắt buộc. |
| `AR-ACPLW-02` | Toàn bộ region graph và quan hệ đã đặt tên là cần thiết. | Bằng chứng bắt buộc. |
| `AR-ACPLW-03` | Compact giữ action, state, recovery và nghĩa focus của wide. | Bằng chứng bắt buộc. |
| `AR-ACPLW-04` | State đặc thù task có thể đổi sau khi người dùng tạo work state. | Bằng chứng bắt buộc. |
| `AR-ACPLW-90` | Dominant task thực ra là `driver-duty-rest-compliance-planner`. | Reject. |
| `AR-ACPLW-91` | Dominant task thực ra là `calendar-resource-scheduler`. | Reject. |
| `AR-ACPLW-92` | Dominant task thực ra là `dual-list-transfer`. | Reject. |
| `AR-ACPLW-93` | Dominant task thực ra là `critical-path-project-planner`. | Reject. |

### Selection rule

Chọn `aviation-crew-pairing-legality-workbench` khi và chỉ khi `AR-ACPLW-01` đến `AR-ACPLW-04` có bằng chứng và không mã nào từ `AR-ACPLW-90` đến `AR-ACPLW-93` đúng. Trả `needs-evidence` khi owner hoặc relationship chưa được giải quyết; trả `reject` khi có rejection code.

## Region graph

```text
crew-pairing → schedule-rule-version-bases-and-planning-horizon → every-flight-leg-by-required-captain-first-officer-and-cabin-role-slot → individual-crew-base-qualification-recency-and-availability → candidate-multi-leg-duty-and-pairing-builder → per-person-flight-duty-rest-acclimatisation-and-timezone-clocks → deadhead-positioning-and-connection-feasibility-per-person → pairing-cost-robustness-and-set-level-role-coverage-matrix → selected-pairing-set-with-no-uncovered-or-double-owned-role → every-member-legality-proof → roster-handoff
```

### Region obligations

| Region | Nghĩa vụ owner và relationship |
|---|---|
| `crew-pairing` | Sở hữu dominant task, toàn bộ trạng thái hậu duệ và boundary recovery. |
| `schedule-rule-version-bases-and-planning-horizon` | Sở hữu bằng chứng hoặc hành động của Schedule Rule Version Bases And Planning Horizon và giữ quan hệ đã khai báo với selection hiện tại. |
| `every-flight-leg-by-required-captain-first-officer-and-cabin-role-slot` | Sở hữu bằng chứng hoặc hành động của Every Flight Leg By Required Captain First Officer And Cabin Role Slot và giữ quan hệ đã khai báo với selection hiện tại. |
| `individual-crew-base-qualification-recency-and-availability` | Sở hữu bằng chứng hoặc hành động của Individual Crew Base Qualification Recency And Availability và giữ quan hệ đã khai báo với selection hiện tại. |
| `candidate-multi-leg-duty-and-pairing-builder` | Sở hữu bằng chứng hoặc hành động của Candidate Multi Leg Duty And Pairing Builder và giữ quan hệ đã khai báo với selection hiện tại. |
| `per-person-flight-duty-rest-acclimatisation-and-timezone-clocks` | Sở hữu bằng chứng hoặc hành động của Per Person Flight Duty Rest Acclimatisation And Timezone Clocks và giữ quan hệ đã khai báo với selection hiện tại. |
| `deadhead-positioning-and-connection-feasibility-per-person` | Sở hữu bằng chứng hoặc hành động của Deadhead Positioning And Connection Feasibility Per Person và giữ quan hệ đã khai báo với selection hiện tại. |
| `pairing-cost-robustness-and-set-level-role-coverage-matrix` | Sở hữu bằng chứng hoặc hành động của Pairing Cost Robustness And Set Level Role Coverage Matrix và giữ quan hệ đã khai báo với selection hiện tại. |
| `selected-pairing-set-with-no-uncovered-or-double-owned-role` | Sở hữu bằng chứng hoặc hành động của Selected Pairing Set With No Uncovered Or Double Owned Role và giữ quan hệ đã khai báo với selection hiện tại. |
| `every-member-legality-proof` | Sở hữu bằng chứng hoặc hành động của Every Member Legality Proof và giữ quan hệ đã khai báo với selection hiện tại. |
| `roster-handoff` | Sở hữu bằng chứng hoặc hành động của Roster Handoff và giữ quan hệ đã khai báo với selection hiện tại. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi các vùng đồng thời không còn giữ được label dễ đọc, liên kết chính xác và action đầy đủ.
- **Topology response:** Flight-leg coverage network, eligible crew, candidate duty, legality clock, positioning, coverage matrix và pairing đã chọn cùng so sánh được; chỉ leg-time axis có giới hạn sở hữu overflow ngang.
- **Navigation replacement:** Không có khi mọi vùng bắt buộc vẫn đồng thời dùng được.
- **Sticky boundary:** Chỉ trạng thái hoặc action của task hiện tại được persist; nó dành chỗ và yield khi chiều cao ngắn.
- **Overflow owner:** `schedule-rule-version-bases-and-planning-horizon` sở hữu overflow có giới hạn; page không sở hữu overflow ngang.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi vùng hỗ trợ ưu tiên thấp nhất làm quan hệ chính không còn dùng được.
- **Topology response:** Leg chưa cover và candidate duty được ghim; coverage/qualification và clock/positioning evidence luân phiên, còn set completeness tồn tại.
- **Navigation replacement:** Các evidence view có tên thay vùng bị dời và giữ đúng selection cùng trigger.
- **Sticky boundary:** Verdict hiện tại chỉ persist khi target vẫn thấy được và trở lại flow khi chiều cao ngắn.
- **Overflow owner:** Owner có giới hạn của wide vẫn cục bộ; view luân phiên không tạo nested page scroll.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai vùng task không thể đồng thời giữ bằng chứng dễ đọc, target 44 px và focus không bị che.
- **Topology response:** Flight-leg role chưa cover → named crew đủ điều kiện → multi-leg duty → clock acclimatisation/duty/rest → deadhead positioning → legality cá nhân → thêm pairing → tính lại role hở/trùng → complete-set proof → handoff.
- **Navigation replacement:** Primary-pane sequence có Back khôi phục selection, state, query, scroll context và đúng trigger.
- **Sticky boundary:** Action bar dành sẵn chỗ, không che focus và trở về normal flow khi chiều cao ngắn.
- **Overflow owner:** Visual có giới hạn có bản tương đương dạng chữ theo thứ tự làm representation compact chính.

### Reflow

- Semantic, DOM và meaningful focus order giữ graph: `crew-pairing → schedule-rule-version-bases-and-planning-horizon → every-flight-leg-by-required-captain-first-officer-and-cabin-role-slot → individual-crew-base-qualification-recency-and-availability → candidate-multi-leg-duty-and-pairing-builder → per-person-flight-duty-rest-acclimatisation-and-timezone-clocks → deadhead-positioning-and-connection-feasibility-per-person → pairing-cost-robustness-and-set-level-role-coverage-matrix → selected-pairing-set-with-no-uncovered-or-double-owned-role → every-member-legality-proof → roster-handoff`.
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

Các state đặc thù task: Schedule loading/versioned, leg-role uncovered/covered/overcovered, crew available/unavailable, qualification current/expired/missing, duty draft/legal/illegal, acclimatisation known/unknown/changed, flight-duty clock available/warning/exceeded, rest qualifying/insufficient, positioning confirmed/missed, pairing selected/rejected, coverage set incomplete/complete and roster handoff pending/accepted/returned.

| State | Region sở hữu | Nghĩa vụ |
|---|---|---|
| Initial / loading | `schedule-rule-version-bases-and-planning-horizon` | Nêu scope đang tải, giữ chỗ primary region và chỉ block owner lỗi. |
| Ready | `every-flight-leg-by-required-captain-first-officer-and-cabin-role-slot` | Hiện object, owner relationship, selection và action hợp lệ bằng text lẫn semantics. |
| Empty / not applicable | `every-flight-leg-by-required-captain-first-officer-and-cabin-role-slot` | Phân biệt empty thật, no-match và not-applicable rồi cung cấp next action hợp lệ. |
| Error / retry | `every-member-legality-proof` | Giữ context/input hợp lệ, nêu owner lỗi và cung cấp local retry. |
| Permission / unavailable | `roster-handoff` | Giải thích restriction mà không ngụ ý bằng chứng ẩn là không tồn tại và cung cấp safe exit. |
| Pending | `roster-handoff` | Ngăn duplicate action, giữ đúng target và announce progress mà không dời focus. |
| Success | `roster-handoff` | Xác nhận outcome chính xác, giữ selection và cung cấp next action hoặc recovery. |
| Stale / conflict | `schedule-rule-version-bases-and-planning-horizon` | Giữ last-safe value, nêu version/time conflict và yêu cầu recovery rõ. |
| Focus transition | `roster-handoff` | Chỉ dời focus vào modal hoặc error summary bắt buộc rồi trả về đúng trigger. |
| Responsive presentation | `crew-pairing` | Giữ state, selection, query, pending result và recovery khi topology đổi. |

## Boundaries

### Accept

- Accept khi dominant task là: Xây dựng một tập aviation crew pairing nhiều vai trò hợp lệ phủ mọi flight leg trong khi tuân base, qualification, positioning, connection, acclimatisation, flight-duty, rest và cumulative-duty.
- Accept khi mọi region và relationship bắt buộc trong graph đều cần để hoàn thành task.
- Accept khi compact giữ task, state và recovery bằng replacement topology thay vì stack box desktop.

### Reject

- Reject `driver-duty-rest-compliance-planner`; đây là bằng chứng `AR-ACPLW-90` và phải route sang archetype kề.
- Reject `calendar-resource-scheduler`; đây là bằng chứng `AR-ACPLW-91` và phải route sang archetype kề.
- Reject `dual-list-transfer`; đây là bằng chứng `AR-ACPLW-92` và phải route sang archetype kề.
- Reject `critical-path-project-planner`; đây là bằng chứng `AR-ACPLW-93` và phải route sang archetype kề.

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
| [EASA flight-time limitations rules](https://www.easa.europa.eu/en/document-library/easy-access-rules/online-publications/easy-access-rules-air-operations?erules-id=ERULES-1963177438-11941) | Quan hệ nghiệp vụ chính thức và boundary quyền hạn đặc thù cho dominant task. | Không chọn archetype, không định nghĩa product truth và không cho phép sao chép geometry. |
| [U.S. eCFR Part 117 flight and duty limitations](https://www.ecfr.gov/current/title-14/chapter-I/subchapter-G/part-117) | Quan hệ nghiệp vụ chính thức và boundary quyền hạn đặc thù cho dominant task. | Không chọn archetype, không định nghĩa product truth và không cho phép sao chép geometry. |

Tập nguồn gồm ít nhất ba tổ chức chính thức độc lập và bằng chứng accessibility của W3C.

## Output

```json
{
  "archetypeId": "aviation-crew-pairing-legality-workbench",
  "situationCodes": [
    "<matched AR-ACPLW-* codes>"
  ],
  "searchAliases": [
    "aviation crew pairing legality",
    "aviation crew pairing legality workspace",
    "aviation crew pairing legality control"
  ],
  "dominantTask": "Construct a legal set of multi-role aviation crew pairings that covers every flight leg while respecting base, qualification, positioning, connection, acclimatisation, flight-duty, rest and cumulative-duty constraints.",
  "regions": [
    "crew-pairing",
    "schedule-rule-version-bases-and-planning-horizon",
    "every-flight-leg-by-required-captain-first-officer-and-cabin-role-slot",
    "individual-crew-base-qualification-recency-and-availability",
    "candidate-multi-leg-duty-and-pairing-builder",
    "per-person-flight-duty-rest-acclimatisation-and-timezone-clocks",
    "deadhead-positioning-and-connection-feasibility-per-person",
    "pairing-cost-robustness-and-set-level-role-coverage-matrix",
    "selected-pairing-set-with-no-uncovered-or-double-owned-role",
    "every-member-legality-proof",
    "roster-handoff"
  ],
  "regionRelationships": [
    "set coverage is invalid if any required leg-role is open, even when each individual duty is legal, and individual legality is invalid without feasible positioning."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "crew-pairing -> schedule-rule-version-bases-and-planning-horizon -> every-flight-leg-by-required-captain-first-officer-and-cabin-role-slot -> individual-crew-base-qualification-recency-and-availability -> candidate-multi-leg-duty-and-pairing-builder -> per-person-flight-duty-rest-acclimatisation-and-timezone-clocks -> deadhead-positioning-and-connection-feasibility-per-person -> pairing-cost-robustness-and-set-level-role-coverage-matrix -> selected-pairing-set-with-no-uncovered-or-double-owned-role -> every-member-legality-proof -> roster-handoff",
    "navigationReplacement": "<none or named evidence view or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "schedule-rule-version-bases-and-planning-horizon",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": [
    "Schedule loading/versioned",
    "leg-role uncovered/covered/overcovered",
    "crew available/unavailable",
    "qualification current/expired/missing",
    "duty draft/legal/illegal",
    "acclimatisation known/unknown/changed",
    "flight-duty clock available/warning/exceeded",
    "rest qualifying/insufficient",
    "positioning confirmed/missed",
    "pairing selected/rejected",
    "coverage set incomplete/complete",
    "roster handoff pending/accepted/returned"
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

