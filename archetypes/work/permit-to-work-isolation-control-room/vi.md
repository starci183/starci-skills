# Permit to work isolation control room

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `permit-to-work-isolation-control-room` |
| Family | Work |
| Dominant task | Chỉ authorize hazardous work khi isolation, test, competence và rescue control còn valid; suspend hoặc close khi evidence đổi. |
| Search aliases | `permit to work control`, `isolation register`, `hazardous work authorization` |
| Authority | Shared product-neutral macro topology; Grammar sở hữu product semantics, Principles sở hữu unresolved geometry và Direction sở hữu visual character. |

### Invariants

- Chỉ authorize hazardous work khi isolation, test, competence và rescue control còn valid; suspend hoặc close khi evidence đổi.
- Independent isolation, test, competence, rescue, and condition controls can invalidate authorization at any time.
- Mọi required region giữ owner riêng và cùng selected context; product noun không đổi topology.
- Wide, intermediate và compact giữ DOM/reading/focus order có nghĩa, action parity và deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-PTW-01` | Dominant task là observable outcome bắt buộc. | Required evidence. |
| `AR-PTW-02` | Toàn bộ required region graph và named relationship đều cần. | Required evidence. |
| `AR-PTW-03` | Compact giữ action, state, recovery và focus meaning của wide. | Required evidence. |
| `AR-PTW-04` | Task-specific state có thể đổi sau khi user đã tạo work state. | Required evidence. |
| `AR-PTW-90` | Dominant task thực tế thuộc generic stage-gated process. | Reject. |
| `AR-PTW-91` | Dominant task thực tế thuộc checklist. | Reject. |
| `AR-PTW-92` | Dominant task thực tế thuộc command center. | Reject. |
| `AR-PTW-93` | Dominant task thực tế thuộc job run. | Reject. |

### Selection rule

Chọn `permit-to-work-isolation-control-room` khi và chỉ khi `AR-PTW-01` đến `AR-PTW-04` đều được evidence và không có code `AR-PTW-90` đến `AR-PTW-93`. Trả `needs-evidence` khi một owner hoặc relationship còn thiếu; trả `reject` khi có rejection code.

## Region graph

```text
permit-control -> work-site-scope -> hazards -> isolation-register -> test-monitor-readings -> role-competency-rescue-roster -> permit-conditions -> authorize-suspend-close -> immutable-event-record
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `permit-control` | Sở hữu dominant task, toàn bộ descendant state và recovery boundary. |
| `work-site-scope` | Sở hữu evidence hoặc action của Work Site Scope; giữ relationship đã khai báo với current selection. |
| `hazards` | Sở hữu evidence hoặc action của Hazards; giữ relationship đã khai báo với current selection. |
| `isolation-register` | Sở hữu evidence hoặc action của Isolation Register; giữ relationship đã khai báo với current selection. |
| `test-monitor-readings` | Sở hữu evidence hoặc action của Test Monitor Readings; giữ relationship đã khai báo với current selection. |
| `role-competency-rescue-roster` | Sở hữu evidence hoặc action của Role Competency Rescue Roster; giữ relationship đã khai báo với current selection. |
| `permit-conditions` | Sở hữu evidence hoặc action của Permit Conditions; giữ relationship đã khai báo với current selection. |
| `authorize-suspend-close` | Sở hữu evidence hoặc action của Authorize Suspend Close; giữ relationship đã khai báo với current selection. |
| `immutable-event-record` | Sở hữu evidence hoặc action của Immutable Event Record; giữ relationship đã khai báo với current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi simultaneous regions không còn giữ readable labels, exact association và complete action.
- **Topology response:** Hazard, isolation, test evidence, and the authorization rail remain simultaneously visible.
- **Navigation replacement:** Không có khi mọi required region vẫn usable đồng thời.
- **Sticky boundary:** Chỉ current-task status/action được persist; phải reserve space và yield ở short height.
- **Overflow owner:** `isolation-register` là bounded owner duy nhất theo trục cần thiết; page không own overflow.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi support region ưu tiên thấp nhất làm primary relationship không usable.
- **Topology response:** The isolation register is primary; evidence detail becomes a drawer while permit state persists.
- **Navigation replacement:** Named disclosure/drawer thay region bị rời và giữ exact selection cùng trigger.
- **Sticky boundary:** Current verdict hoặc action chỉ persist khi target/status còn visible và trở về flow ở short height.
- **Overflow owner:** `isolation-register` giữ bounded overflow; drawer không tạo nested page scroll.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai task region không thể cùng giữ readable evidence, target 44px và unobscured focus.
- **Topology response:** Scope → hazards → isolations → current tests → roster → authorization; permit status remains visible without obscuring focus.
- **Navigation replacement:** Primary-pane sequence có Back khôi phục selection, state, query, scroll context và exact trigger.
- **Sticky boundary:** Action bar reserve content space, không che focus và yield về normal flow ở short height.
- **Overflow owner:** `isolation-register` có text/list equivalent làm primary khi bounded view không fit.

### Reflow

- Semantic, DOM và meaningful focus order giữ graph: `permit-control -> work-site-scope -> hazards -> isolation-register -> test-monitor-readings -> role-competency-rescue-roster -> permit-conditions -> authorize-suspend-close -> immutable-event-record`.
- Long label, bản dịch, zoom và enlarged controls kích hoạt cùng named topology change.
- CSS không reorder semantics; ordinary content không tạo page-level horizontal scroll.
- Hidden detail luôn có explicit accessible reveal path.

### Interaction parity

- Mọi wide selection, edit, action, explanation, retry và recovery đều reachable ở intermediate và compact.
- Topology change giữ exact selected object, cursor/order, data state, pending result và error context.
- Pointer action có keyboard và single-pointer non-drag equivalent khi movement liên quan.
- Dynamic update announce một contextual status mà không steal focus; color không phải tín hiệu duy nhất.
- Modal đưa focus vào, contain focus, hỗ trợ Escape/Cancel và return đúng trigger.

## State obligations

Task-specific states: permit draft, permit authorized, permit suspended, permit closed, isolation applied, isolation verified, isolation expired, reading safe, reading unsafe, reading stale, role missing, rescue unready, condition breached, authorization pending, authorization failure, immutable event.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `work-site-scope` | Nêu scope đang load, reserve primary region và chỉ block owner bị lỗi. |
| Ready | `hazards` | Hiện current object, owner relationship, selection và action hợp lệ bằng text cùng semantics. |
| Empty / not applicable | `hazards` | Phân biệt true empty, no-match và non-applicable; chỉ rõ next action. |
| Error / retry | `authorize-suspend-close` | Giữ context và input hợp lệ, nêu failed owner và đưa retry cục bộ. |
| Permission / unavailable | `immutable-event-record` | Không coi hidden evidence là absent; giải thích restriction và safe exit. |
| Pending | `immutable-event-record` | Ngăn duplicate, giữ exact target và announce progress mà không move focus. |
| Success | `immutable-event-record` | Xác nhận exact outcome, giữ selection và cung cấp next valid action hoặc recovery. |
| Stale / conflict | `work-site-scope` | Giữ last safe value, nêu version/time conflict và yêu cầu recovery rõ. |
| Focus transition | `immutable-event-record` | Chỉ move focus tới modal hoặc error summary mới cần xử lý rồi trả về exact trigger. |
| Responsive presentation | `permit-control` | Giữ state, selection, query, pending result và recovery khi topology đổi. |

## Boundaries

### Accept

- Accept khi dominant task là: Chỉ authorize hazardous work khi isolation, test, competence và rescue control còn valid; suspend hoặc close khi evidence đổi.
- Accept khi mọi required region và relationship trong graph đều cần để hoàn tất task.
- Accept khi compact transformation giữ đúng task, state và recovery thay vì stack desktop boxes.

### Reject

- Reject generic stage-gated process; đây là `AR-PTW-90` evidence và phải route tới adjacent archetype.
- Reject checklist; đây là `AR-PTW-91` evidence và phải route tới adjacent archetype.
- Reject command center; đây là `AR-PTW-92` evidence và phải route tới adjacent archetype.
- Reject job run; đây là `AR-PTW-93` evidence và phải route tới adjacent archetype.

### Boundary verdict

Trả `accept` chỉ khi dominant task, complete graph và compact parity cùng hold. Khác biệt chỉ ở noun, density, color, component, card count hoặc state là `duplicate-or-variation`.

## Handoff

- **Grammar handoff:** Bind product-specific owner, label, permitted action và truthful state meaning vào declared regions.
- **Principles handoff:** Resolve exact grid, measure, gap, alignment, sticky offset, bounded overflow và relationship-driven transition point.
- Không handoff nào được xóa required region, đổi dominant task hoặc làm yếu interaction parity.

## Non-binding research evidence

### Evidence boundary

Research bên ngoài là advisory evidence, không phải product truth. Nó hỗ trợ synthesis task relationship, adaptive behavior và accessibility obligation; không chọn StarCi owner, exact geometry hay cho phép copy source UI.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [OSHA 1926.1204](https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.1204) | Permit-space hazards, controls, rescue, verification, and authorization obligations. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [Microsoft Fluent 2 — Layout](https://fluent2.microsoft.design/layout) | Adaptive regions and readable pane relationships. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Explicit row-column relationships, selection, and bounded overflow. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [W3C WAI — Focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) | Persistent permit actions must not fully obscure focused content. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |

Source set gồm tối thiểu ba tổ chức official độc lập và có W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "permit-to-work-isolation-control-room",
  "situationCodes": ["<matched AR-PTW-* codes>"],
  "searchAliases": ["permit to work control","isolation register","hazardous work authorization"],
  "dominantTask": "Chỉ authorize hazardous work khi isolation, test, competence và rescue control còn valid; suspend hoặc close khi evidence đổi.",
  "regions": ["permit-control","work-site-scope","hazards","isolation-register","test-monitor-readings","role-competency-rescue-roster","permit-conditions","authorize-suspend-close","immutable-event-record"],
  "regionRelationships": ["Independent isolation, test, competence, rescue, and condition controls can invalidate authorization at any time."],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "permit-control -> work-site-scope -> hazards -> isolation-register -> test-monitor-readings -> role-competency-rescue-roster -> permit-conditions -> authorize-suspend-close -> immutable-event-record",
    "navigationReplacement": "<none or named disclosure, drawer, or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "isolation-register",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": ["permit draft","permit authorized","permit suspended","permit closed","isolation applied","isolation verified","isolation expired","reading safe","reading unsafe","reading stale","role missing","rescue unready","condition breached","authorization pending","authorization failure","immutable event"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

