# Consensus replication state monitor

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `consensus-replication-state-monitor` |
| Family | Overview |
| Dominant task | Xác định replicated cluster còn commit an toàn hay không, member nào lag và action membership hoặc leadership nào giữ quorum. |
| Search aliases | `Raft quorum monitor`, `replication commit index`, `cluster membership safety` |
| Authority | Shared product-neutral macro topology; Grammar sở hữu product semantics, Principles sở hữu unresolved geometry và Direction sở hữu visual character. |

### Invariants

- Xác định replicated cluster còn commit an toàn hay không, member nào lag và action membership hoặc leadership nào giữ quorum.
- Quorum, term, and commit index govern every member, leadership, and membership action.
- Mọi required region giữ owner riêng và cùng selected context; product noun không đổi topology.
- Wide, intermediate và compact giữ DOM/reading/focus order có nghĩa, action parity và deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-CRS-01` | Dominant task là observable outcome bắt buộc. | Required evidence. |
| `AR-CRS-02` | Toàn bộ required region graph và named relationship đều cần. | Required evidence. |
| `AR-CRS-03` | Compact giữ action, state, recovery và focus meaning của wide. | Required evidence. |
| `AR-CRS-04` | Task-specific state có thể đổi sau khi user đã tạo work state. | Required evidence. |
| `AR-CRS-90` | Dominant task thực tế thuộc generic operations command center. | Reject. |
| `AR-CRS-91` | Dominant task thực tế thuộc dependency monitor. | Reject. |
| `AR-CRS-92` | Dominant task thực tế thuộc portfolio matrix. | Reject. |
| `AR-CRS-93` | Dominant task thực tế thuộc log console. | Reject. |

### Selection rule

Chọn `consensus-replication-state-monitor` khi và chỉ khi `AR-CRS-01` đến `AR-CRS-04` đều được evidence và không có code `AR-CRS-90` đến `AR-CRS-93`. Trả `needs-evidence` khi một owner hoặc relationship còn thiếu; trả `reject` khi có rejection code.

## Region graph

```text
replication-monitor -> cluster-and-term-context -> quorum-health -> member-role-and-commit-index-matrix -> leader-log-progression -> replication-lag -> election-timeline -> selected-member-evidence -> safe-membership-or-leadership-action
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `replication-monitor` | Sở hữu dominant task, toàn bộ descendant state và recovery boundary. |
| `cluster-and-term-context` | Sở hữu evidence hoặc action của Cluster And Term Context; giữ relationship đã khai báo với current selection. |
| `quorum-health` | Sở hữu evidence hoặc action của Quorum Health; giữ relationship đã khai báo với current selection. |
| `member-role-and-commit-index-matrix` | Sở hữu evidence hoặc action của Member Role And Commit Index Matrix; giữ relationship đã khai báo với current selection. |
| `leader-log-progression` | Sở hữu evidence hoặc action của Leader Log Progression; giữ relationship đã khai báo với current selection. |
| `replication-lag` | Sở hữu evidence hoặc action của Replication Lag; giữ relationship đã khai báo với current selection. |
| `election-timeline` | Sở hữu evidence hoặc action của Election Timeline; giữ relationship đã khai báo với current selection. |
| `selected-member-evidence` | Sở hữu evidence hoặc action của Selected Member Evidence; giữ relationship đã khai báo với current selection. |
| `safe-membership-or-leadership-action` | Sở hữu evidence hoặc action của Safe Membership Or Leadership Action; giữ relationship đã khai báo với current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi simultaneous regions không còn giữ readable labels, exact association và complete action.
- **Topology response:** Quorum summary, member matrix, log progression, and election evidence remain simultaneously visible.
- **Navigation replacement:** Không có khi mọi required region vẫn usable đồng thời.
- **Sticky boundary:** Chỉ current-task status/action được persist; phải reserve space và yield ở short height.
- **Overflow owner:** `member-role-and-commit-index-matrix` là bounded owner duy nhất theo trục cần thiết; page không own overflow.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi support region ưu tiên thấp nhất làm primary relationship không usable.
- **Topology response:** The member matrix is primary; selected-member evidence becomes temporary while the quorum invariant persists.
- **Navigation replacement:** Named disclosure/drawer thay region bị rời và giữ exact selection cùng trigger.
- **Sticky boundary:** Current verdict hoặc action chỉ persist khi target/status còn visible và trở về flow ở short height.
- **Overflow owner:** `member-role-and-commit-index-matrix` giữ bounded overflow; drawer không tạo nested page scroll.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai task region không thể cùng giữ readable evidence, target 44px và unobscured focus.
- **Topology response:** Quorum verdict → lagging members → commit indices and log gap → election evidence → safe action.
- **Navigation replacement:** Primary-pane sequence có Back khôi phục selection, state, query, scroll context và exact trigger.
- **Sticky boundary:** Action bar reserve content space, không che focus và yield về normal flow ở short height.
- **Overflow owner:** `member-role-and-commit-index-matrix` có text/list equivalent làm primary khi bounded view không fit.

### Reflow

- Semantic, DOM và meaningful focus order giữ graph: `replication-monitor -> cluster-and-term-context -> quorum-health -> member-role-and-commit-index-matrix -> leader-log-progression -> replication-lag -> election-timeline -> selected-member-evidence -> safe-membership-or-leadership-action`.
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

Task-specific states: leader known, leader unknown, quorum healthy, quorum lost, quorum at risk, voter, learner, offline, term changed, lag normal, lag high, election in progress, unsafe action, pending action, success, stale data.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `cluster-and-term-context` | Nêu scope đang load, reserve primary region và chỉ block owner bị lỗi. |
| Ready | `quorum-health` | Hiện current object, owner relationship, selection và action hợp lệ bằng text cùng semantics. |
| Empty / not applicable | `quorum-health` | Phân biệt true empty, no-match và non-applicable; chỉ rõ next action. |
| Error / retry | `selected-member-evidence` | Giữ context và input hợp lệ, nêu failed owner và đưa retry cục bộ. |
| Permission / unavailable | `safe-membership-or-leadership-action` | Không coi hidden evidence là absent; giải thích restriction và safe exit. |
| Pending | `safe-membership-or-leadership-action` | Ngăn duplicate, giữ exact target và announce progress mà không move focus. |
| Success | `safe-membership-or-leadership-action` | Xác nhận exact outcome, giữ selection và cung cấp next valid action hoặc recovery. |
| Stale / conflict | `cluster-and-term-context` | Giữ last safe value, nêu version/time conflict và yêu cầu recovery rõ. |
| Focus transition | `safe-membership-or-leadership-action` | Chỉ move focus tới modal hoặc error summary mới cần xử lý rồi trả về exact trigger. |
| Responsive presentation | `replication-monitor` | Giữ state, selection, query, pending result và recovery khi topology đổi. |

## Boundaries

### Accept

- Accept khi dominant task là: Xác định replicated cluster còn commit an toàn hay không, member nào lag và action membership hoặc leadership nào giữ quorum.
- Accept khi mọi required region và relationship trong graph đều cần để hoàn tất task.
- Accept khi compact transformation giữ đúng task, state và recovery thay vì stack desktop boxes.

### Reject

- Reject generic operations command center; đây là `AR-CRS-90` evidence và phải route tới adjacent archetype.
- Reject dependency monitor; đây là `AR-CRS-91` evidence và phải route tới adjacent archetype.
- Reject portfolio matrix; đây là `AR-CRS-92` evidence và phải route tới adjacent archetype.
- Reject log console; đây là `AR-CRS-93` evidence và phải route tới adjacent archetype.

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
| [etcd — Raft glossary](https://etcd.io/docs/v3.5/learning/glossary/) | Leader, proposal, member, and majority quorum concepts. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [Apache Kafka — Replication](https://kafka.apache.org/documentation/#design_replicatedlog) | Leader and replica log progression semantics. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Explicit row-column relationships, selection, and bounded overflow. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Status changes announced without moving focus. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |

Source set gồm tối thiểu ba tổ chức official độc lập và có W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "consensus-replication-state-monitor",
  "situationCodes": ["<matched AR-CRS-* codes>"],
  "searchAliases": ["Raft quorum monitor","replication commit index","cluster membership safety"],
  "dominantTask": "Xác định replicated cluster còn commit an toàn hay không, member nào lag và action membership hoặc leadership nào giữ quorum.",
  "regions": ["replication-monitor","cluster-and-term-context","quorum-health","member-role-and-commit-index-matrix","leader-log-progression","replication-lag","election-timeline","selected-member-evidence","safe-membership-or-leadership-action"],
  "regionRelationships": ["Quorum, term, and commit index govern every member, leadership, and membership action."],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "replication-monitor -> cluster-and-term-context -> quorum-health -> member-role-and-commit-index-matrix -> leader-log-progression -> replication-lag -> election-timeline -> selected-member-evidence -> safe-membership-or-leadership-action",
    "navigationReplacement": "<none or named disclosure, drawer, or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "member-role-and-commit-index-matrix",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": ["leader known","leader unknown","quorum healthy","quorum lost","quorum at risk","voter","learner","offline","term changed","lag normal","lag high","election in progress","unsafe action","pending action","success","stale data"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

