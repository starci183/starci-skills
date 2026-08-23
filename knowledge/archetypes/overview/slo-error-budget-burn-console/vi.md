# SLO error budget burn console

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `slo-error-budget-burn-console` |
| Family | Overview |
| Dominant task | Quyết định release activity hay reliability work phải đổi dựa trên windowed SLI, error budget còn lại và multi-window burn rate. |
| Search aliases | `SLO burn console`, `error budget policy`, `multi-window burn rate` |
| Authority | Shared product-neutral macro topology; Grammar sở hữu product semantics, Principles sở hữu unresolved geometry và Direction sở hữu visual character. |

### Invariants

- Quyết định release activity hay reliability work phải đổi dựa trên windowed SLI, error budget còn lại và multi-window burn rate.
- Remaining budget and short and long burn windows jointly own the policy action.
- Mọi required region giữ owner riêng và cùng selected context; product noun không đổi topology.
- Wide, intermediate và compact giữ DOM/reading/focus order có nghĩa, action parity và deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-SLO-01` | Dominant task là observable outcome bắt buộc. | Required evidence. |
| `AR-SLO-02` | Toàn bộ required region graph và named relationship đều cần. | Required evidence. |
| `AR-SLO-03` | Compact giữ action, state, recovery và focus meaning của wide. | Required evidence. |
| `AR-SLO-04` | Task-specific state có thể đổi sau khi user đã tạo work state. | Required evidence. |
| `AR-SLO-90` | Dominant task thực tế thuộc statistical process control. | Reject. |
| `AR-SLO-91` | Dominant task thực tế thuộc live incident command. | Reject. |
| `AR-SLO-92` | Dominant task thực tế thuộc generic KPI dashboard. | Reject. |
| `AR-SLO-93` | Dominant task thực tế thuộc capacity overview. | Reject. |

### Selection rule

Chọn `slo-error-budget-burn-console` khi và chỉ khi `AR-SLO-01` đến `AR-SLO-04` đều được evidence và không có code `AR-SLO-90` đến `AR-SLO-93`. Trả `needs-evidence` khi một owner hoặc relationship còn thiếu; trả `reject` khi có rejection code.

## Region graph

```text
slo-console -> service-objective-and-window -> sli-definition -> good-vs-total-event-series -> remaining-error-budget -> multiwindow-burn-rates -> breach-contributors-and-incidents -> error-budget-policy-action -> decision-record
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `slo-console` | Sở hữu dominant task, toàn bộ descendant state và recovery boundary. |
| `service-objective-and-window` | Sở hữu evidence hoặc action của Service Objective And Window; giữ relationship đã khai báo với current selection. |
| `sli-definition` | Sở hữu evidence hoặc action của Sli Definition; giữ relationship đã khai báo với current selection. |
| `good-vs-total-event-series` | Sở hữu evidence hoặc action của Good Vs Total Event Series; giữ relationship đã khai báo với current selection. |
| `remaining-error-budget` | Sở hữu evidence hoặc action của Remaining Error Budget; giữ relationship đã khai báo với current selection. |
| `multiwindow-burn-rates` | Sở hữu evidence hoặc action của Multiwindow Burn Rates; giữ relationship đã khai báo với current selection. |
| `breach-contributors-and-incidents` | Sở hữu evidence hoặc action của Breach Contributors And Incidents; giữ relationship đã khai báo với current selection. |
| `error-budget-policy-action` | Sở hữu evidence hoặc action của Error Budget Policy Action; giữ relationship đã khai báo với current selection. |
| `decision-record` | Sở hữu evidence hoặc action của Decision Record; giữ relationship đã khai báo với current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi simultaneous regions không còn giữ readable labels, exact association và complete action.
- **Topology response:** Remaining budget, short and long burn views, and contributor evidence remain simultaneously visible.
- **Navigation replacement:** Không có khi mọi required region vẫn usable đồng thời.
- **Sticky boundary:** Chỉ current-task status/action được persist; phải reserve space và yield ở short height.
- **Overflow owner:** `good-vs-total-event-series` là bounded owner duy nhất theo trục cần thiết; page không own overflow.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi support region ưu tiên thấp nhất làm primary relationship không usable.
- **Topology response:** Budget and burn remain primary while contributor detail becomes a drawer.
- **Navigation replacement:** Named disclosure/drawer thay region bị rời và giữ exact selection cùng trigger.
- **Sticky boundary:** Current verdict hoặc action chỉ persist khi target/status còn visible và trở về flow ở short height.
- **Overflow owner:** `good-vs-total-event-series` giữ bounded overflow; drawer không tạo nested page scroll.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai task region không thể cùng giữ readable evidence, target 44px và unobscured focus.
- **Topology response:** Budget verdict → fast burn → slow burn → contributors → policy action → decision receipt.
- **Navigation replacement:** Primary-pane sequence có Back khôi phục selection, state, query, scroll context và exact trigger.
- **Sticky boundary:** Action bar reserve content space, không che focus và yield về normal flow ở short height.
- **Overflow owner:** `good-vs-total-event-series` có text/list equivalent làm primary khi bounded view không fit.

### Reflow

- Semantic, DOM và meaningful focus order giữ graph: `slo-console -> service-objective-and-window -> sli-definition -> good-vs-total-event-series -> remaining-error-budget -> multiwindow-burn-rates -> breach-contributors-and-incidents -> error-budget-policy-action -> decision-record`.
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

Task-specific states: SLI loading, SLI gap, budget healthy, budget warning, budget exhausted, fast burn active, fast burn clear, slow burn active, slow burn clear, contributor selected, action recommended, action overridden, decision pending, decision recorded, window changed.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `service-objective-and-window` | Nêu scope đang load, reserve primary region và chỉ block owner bị lỗi. |
| Ready | `sli-definition` | Hiện current object, owner relationship, selection và action hợp lệ bằng text cùng semantics. |
| Empty / not applicable | `sli-definition` | Phân biệt true empty, no-match và non-applicable; chỉ rõ next action. |
| Error / retry | `error-budget-policy-action` | Giữ context và input hợp lệ, nêu failed owner và đưa retry cục bộ. |
| Permission / unavailable | `decision-record` | Không coi hidden evidence là absent; giải thích restriction và safe exit. |
| Pending | `decision-record` | Ngăn duplicate, giữ exact target và announce progress mà không move focus. |
| Success | `decision-record` | Xác nhận exact outcome, giữ selection và cung cấp next valid action hoặc recovery. |
| Stale / conflict | `service-objective-and-window` | Giữ last safe value, nêu version/time conflict và yêu cầu recovery rõ. |
| Focus transition | `decision-record` | Chỉ move focus tới modal hoặc error summary mới cần xử lý rồi trả về exact trigger. |
| Responsive presentation | `slo-console` | Giữ state, selection, query, pending result và recovery khi topology đổi. |

## Boundaries

### Accept

- Accept khi dominant task là: Quyết định release activity hay reliability work phải đổi dựa trên windowed SLI, error budget còn lại và multi-window burn rate.
- Accept khi mọi required region và relationship trong graph đều cần để hoàn tất task.
- Accept khi compact transformation giữ đúng task, state và recovery thay vì stack desktop boxes.

### Reject

- Reject statistical process control; đây là `AR-SLO-90` evidence và phải route tới adjacent archetype.
- Reject live incident command; đây là `AR-SLO-91` evidence và phải route tới adjacent archetype.
- Reject generic KPI dashboard; đây là `AR-SLO-92` evidence và phải route tới adjacent archetype.
- Reject capacity overview; đây là `AR-SLO-93` evidence và phải route tới adjacent archetype.

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
| [Google SRE Workbook — Alerting on SLOs](https://sre.google/workbook/alerting-on-slos/) | Error-budget consumption and multi-window multi-burn-rate alerting. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [Prometheus — Alerting rules](https://prometheus.io/docs/practices/rules/) | Operational rule evaluation and recorded alert evidence. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Explicit row-column relationships, selection, and bounded overflow. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Status changes announced without moving focus. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |

Source set gồm tối thiểu ba tổ chức official độc lập và có W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "slo-error-budget-burn-console",
  "situationCodes": ["<matched AR-SLO-* codes>"],
  "searchAliases": ["SLO burn console","error budget policy","multi-window burn rate"],
  "dominantTask": "Quyết định release activity hay reliability work phải đổi dựa trên windowed SLI, error budget còn lại và multi-window burn rate.",
  "regions": ["slo-console","service-objective-and-window","sli-definition","good-vs-total-event-series","remaining-error-budget","multiwindow-burn-rates","breach-contributors-and-incidents","error-budget-policy-action","decision-record"],
  "regionRelationships": ["Remaining budget and short and long burn windows jointly own the policy action."],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "slo-console -> service-objective-and-window -> sli-definition -> good-vs-total-event-series -> remaining-error-budget -> multiwindow-burn-rates -> breach-contributors-and-incidents -> error-budget-policy-action -> decision-record",
    "navigationReplacement": "<none or named disclosure, drawer, or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "good-vs-total-event-series",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": ["SLI loading","SLI gap","budget healthy","budget warning","budget exhausted","fast burn active","fast burn clear","slow burn active","slow burn clear","contributor selected","action recommended","action overridden","decision pending","decision recorded","window changed"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

