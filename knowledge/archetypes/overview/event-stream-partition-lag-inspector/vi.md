# Event stream partition lag inspector

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `event-stream-partition-lag-inspector` |
| Family | Overview |
| Dominant task | Giải thích consumer delay qua partition ownership, log-end so với committed offsets và rebalance history. |
| Search aliases | `consumer lag inspector`, `partition offset monitor`, `rebalance evidence` |
| Authority | Shared product-neutral macro topology; Grammar sở hữu product semantics, Principles sở hữu unresolved geometry và Direction sở hữu visual character. |

### Invariants

- Giải thích consumer delay qua partition ownership, log-end so với committed offsets và rebalance history.
- Partition coordinates and the committed and log-end offset positions jointly own lag and action consequences.
- Mọi required region giữ owner riêng và cùng selected context; product noun không đổi topology.
- Wide, intermediate và compact giữ DOM/reading/focus order có nghĩa, action parity và deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-PLI-01` | Dominant task là observable outcome bắt buộc. | Required evidence. |
| `AR-PLI-02` | Toàn bộ required region graph và named relationship đều cần. | Required evidence. |
| `AR-PLI-03` | Compact giữ action, state, recovery và focus meaning của wide. | Required evidence. |
| `AR-PLI-04` | Task-specific state có thể đổi sau khi user đã tạo work state. | Required evidence. |
| `AR-PLI-90` | Dominant task thực tế thuộc streaming raw logs. | Reject. |
| `AR-PLI-91` | Dominant task thực tế thuộc timeline status. | Reject. |
| `AR-PLI-92` | Dominant task thực tế thuộc SLO console. | Reject. |
| `AR-PLI-93` | Dominant task thực tế thuộc distributed trace. | Reject. |

### Selection rule

Chọn `event-stream-partition-lag-inspector` khi và chỉ khi `AR-PLI-01` đến `AR-PLI-04` đều được evidence và không có code `AR-PLI-90` đến `AR-PLI-93`. Trả `needs-evidence` khi một owner hoặc relationship còn thiếu; trả `reject` khi có rejection code.

## Region graph

```text
lag-inspector -> topic-and-consumer-group-context -> partition-ownership-matrix -> log-end-vs-committed-offsets -> lag-heatmap-and-trends -> rebalance-timeline -> selected-partition-record-sample -> reset-or-reassign-consequence
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `lag-inspector` | Sở hữu dominant task, toàn bộ descendant state và recovery boundary. |
| `topic-and-consumer-group-context` | Sở hữu evidence hoặc action của Topic And Consumer Group Context; giữ relationship đã khai báo với current selection. |
| `partition-ownership-matrix` | Sở hữu evidence hoặc action của Partition Ownership Matrix; giữ relationship đã khai báo với current selection. |
| `log-end-vs-committed-offsets` | Sở hữu evidence hoặc action của Log End Vs Committed Offsets; giữ relationship đã khai báo với current selection. |
| `lag-heatmap-and-trends` | Sở hữu evidence hoặc action của Lag Heatmap And Trends; giữ relationship đã khai báo với current selection. |
| `rebalance-timeline` | Sở hữu evidence hoặc action của Rebalance Timeline; giữ relationship đã khai báo với current selection. |
| `selected-partition-record-sample` | Sở hữu evidence hoặc action của Selected Partition Record Sample; giữ relationship đã khai báo với current selection. |
| `reset-or-reassign-consequence` | Sở hữu evidence hoặc action của Reset Or Reassign Consequence; giữ relationship đã khai báo với current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi simultaneous regions không còn giữ readable labels, exact association và complete action.
- **Topology response:** Partition grid, lag curves, and rebalance evidence remain simultaneously visible.
- **Navigation replacement:** Không có khi mọi required region vẫn usable đồng thời.
- **Sticky boundary:** Chỉ current-task status/action được persist; phải reserve space và yield ở short height.
- **Overflow owner:** `partition-ownership-matrix` là bounded owner duy nhất theo trục cần thiết; page không own overflow.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi support region ưu tiên thấp nhất làm primary relationship không usable.
- **Topology response:** A lag-ranked partition table is primary; sample and detail become temporary.
- **Navigation replacement:** Named disclosure/drawer thay region bị rời và giữ exact selection cùng trigger.
- **Sticky boundary:** Current verdict hoặc action chỉ persist khi target/status còn visible và trở về flow ở short height.
- **Overflow owner:** `partition-ownership-matrix` giữ bounded overflow; drawer không tạo nested page scroll.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai task region không thể cùng giữ readable evidence, target 44px và unobscured focus.
- **Topology response:** Lag summary → ranked partitions → selected offset trajectory → owner and rebalance evidence → safe action.
- **Navigation replacement:** Primary-pane sequence có Back khôi phục selection, state, query, scroll context và exact trigger.
- **Sticky boundary:** Action bar reserve content space, không che focus và yield về normal flow ở short height.
- **Overflow owner:** `partition-ownership-matrix` có text/list equivalent làm primary khi bounded view không fit.

### Reflow

- Semantic, DOM và meaningful focus order giữ graph: `lag-inspector -> topic-and-consumer-group-context -> partition-ownership-matrix -> log-end-vs-committed-offsets -> lag-heatmap-and-trends -> rebalance-timeline -> selected-partition-record-sample -> reset-or-reassign-consequence`.
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

Task-specific states: group loading, group empty, partition assigned, partition unassigned, consumer healthy, consumer dead, lag rising, lag stable, lag recovering, rebalance active, sample unavailable, reset safe, reset unsafe, action pending.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `topic-and-consumer-group-context` | Nêu scope đang load, reserve primary region và chỉ block owner bị lỗi. |
| Ready | `partition-ownership-matrix` | Hiện current object, owner relationship, selection và action hợp lệ bằng text cùng semantics. |
| Empty / not applicable | `partition-ownership-matrix` | Phân biệt true empty, no-match và non-applicable; chỉ rõ next action. |
| Error / retry | `selected-partition-record-sample` | Giữ context và input hợp lệ, nêu failed owner và đưa retry cục bộ. |
| Permission / unavailable | `reset-or-reassign-consequence` | Không coi hidden evidence là absent; giải thích restriction và safe exit. |
| Pending | `reset-or-reassign-consequence` | Ngăn duplicate, giữ exact target và announce progress mà không move focus. |
| Success | `reset-or-reassign-consequence` | Xác nhận exact outcome, giữ selection và cung cấp next valid action hoặc recovery. |
| Stale / conflict | `topic-and-consumer-group-context` | Giữ last safe value, nêu version/time conflict và yêu cầu recovery rõ. |
| Focus transition | `reset-or-reassign-consequence` | Chỉ move focus tới modal hoặc error summary mới cần xử lý rồi trả về exact trigger. |
| Responsive presentation | `lag-inspector` | Giữ state, selection, query, pending result và recovery khi topology đổi. |

## Boundaries

### Accept

- Accept khi dominant task là: Giải thích consumer delay qua partition ownership, log-end so với committed offsets và rebalance history.
- Accept khi mọi required region và relationship trong graph đều cần để hoàn tất task.
- Accept khi compact transformation giữ đúng task, state và recovery thay vì stack desktop boxes.

### Reject

- Reject streaming raw logs; đây là `AR-PLI-90` evidence và phải route tới adjacent archetype.
- Reject timeline status; đây là `AR-PLI-91` evidence và phải route tới adjacent archetype.
- Reject SLO console; đây là `AR-PLI-92` evidence và phải route tới adjacent archetype.
- Reject distributed trace; đây là `AR-PLI-93` evidence và phải route tới adjacent archetype.

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
| [Apache Kafka 4.3 — Monitoring](https://kafka.apache.org/43/operations/monitoring/) | Consumer lag metrics and per-partition monitoring. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [AWS MSK — Best practices](https://docs.aws.amazon.com/msk/latest/developerguide/bestpractices.html) | Operational evidence for partitioned stream consumers. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Explicit row-column relationships, selection, and bounded overflow. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Status changes announced without moving focus. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |

Source set gồm tối thiểu ba tổ chức official độc lập và có W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "event-stream-partition-lag-inspector",
  "situationCodes": ["<matched AR-PLI-* codes>"],
  "searchAliases": ["consumer lag inspector","partition offset monitor","rebalance evidence"],
  "dominantTask": "Giải thích consumer delay qua partition ownership, log-end so với committed offsets và rebalance history.",
  "regions": ["lag-inspector","topic-and-consumer-group-context","partition-ownership-matrix","log-end-vs-committed-offsets","lag-heatmap-and-trends","rebalance-timeline","selected-partition-record-sample","reset-or-reassign-consequence"],
  "regionRelationships": ["Partition coordinates and the committed and log-end offset positions jointly own lag and action consequences."],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "lag-inspector -> topic-and-consumer-group-context -> partition-ownership-matrix -> log-end-vs-committed-offsets -> lag-heatmap-and-trends -> rebalance-timeline -> selected-partition-record-sample -> reset-or-reassign-consequence",
    "navigationReplacement": "<none or named disclosure, drawer, or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "partition-ownership-matrix",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": ["group loading","group empty","partition assigned","partition unassigned","consumer healthy","consumer dead","lag rising","lag stable","lag recovering","rebalance active","sample unavailable","reset safe","reset unsafe","action pending"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

