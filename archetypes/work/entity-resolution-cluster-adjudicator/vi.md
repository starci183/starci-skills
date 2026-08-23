# Entity resolution cluster adjudicator

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `entity-resolution-cluster-adjudicator` |
| Family | Work |
| Dominant task | Quyết định nhiều noisy record có đại diện cùng một entity hay không, rồi merge hoặc split cluster và định nghĩa canonical outcome có thể review. |
| Search aliases | `record linkage adjudicator`, `entity cluster review`, `deduplication cluster` |
| Authority | Shared product-neutral macro topology; Grammar sở hữu product semantics, Principles sở hữu unresolved geometry và Direction sở hữu visual character. |

### Invariants

- Quyết định nhiều noisy record có đại diện cùng một entity hay không, rồi merge hoặc split cluster và định nghĩa canonical outcome có thể review.
- N-record transitivity and canonicalization are independent owners bound to the same candidate cluster.
- Mọi required region giữ owner riêng và cùng selected context; product noun không đổi topology.
- Wide, intermediate và compact giữ DOM/reading/focus order có nghĩa, action parity và deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-ERA-01` | Dominant task là observable outcome bắt buộc. | Required evidence. |
| `AR-ERA-02` | Toàn bộ required region graph và named relationship đều cần. | Required evidence. |
| `AR-ERA-03` | Compact giữ action, state, recovery và focus meaning của wide. | Required evidence. |
| `AR-ERA-04` | Task-specific state có thể đổi sau khi user đã tạo work state. | Required evidence. |
| `AR-ERA-90` | Dominant task thực tế thuộc two-source diff. | Reject. |
| `AR-ERA-91` | Dominant task thực tế thuộc operational queue. | Reject. |
| `AR-ERA-92` | Dominant task thực tế thuộc one-case dossier. | Reject. |
| `AR-ERA-93` | Dominant task thực tế thuộc duplicate warning. | Reject. |

### Selection rule

Chọn `entity-resolution-cluster-adjudicator` khi và chỉ khi `AR-ERA-01` đến `AR-ERA-04` đều được evidence và không có code `AR-ERA-90` đến `AR-ERA-93`. Trả `needs-evidence` khi một owner hoặc relationship còn thiếu; trả `reject` khi có rejection code.

## Region graph

```text
cluster-adjudicator -> source-dataset-context -> candidate-cluster-graph -> pairwise-comparison-evidence -> cluster-consistency-and-anomaly-summary -> merge-split-and-canonical-actions -> outcome-preview -> audit-sample-and-commit
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `cluster-adjudicator` | Sở hữu dominant task, toàn bộ descendant state và recovery boundary. |
| `source-dataset-context` | Sở hữu evidence hoặc action của Source Dataset Context; giữ relationship đã khai báo với current selection. |
| `candidate-cluster-graph` | Sở hữu evidence hoặc action của Candidate Cluster Graph; giữ relationship đã khai báo với current selection. |
| `pairwise-comparison-evidence` | Sở hữu evidence hoặc action của Pairwise Comparison Evidence; giữ relationship đã khai báo với current selection. |
| `cluster-consistency-and-anomaly-summary` | Sở hữu evidence hoặc action của Cluster Consistency And Anomaly Summary; giữ relationship đã khai báo với current selection. |
| `merge-split-and-canonical-actions` | Sở hữu evidence hoặc action của Merge Split And Canonical Actions; giữ relationship đã khai báo với current selection. |
| `outcome-preview` | Sở hữu evidence hoặc action của Outcome Preview; giữ relationship đã khai báo với current selection. |
| `audit-sample-and-commit` | Sở hữu evidence hoặc action của Audit Sample And Commit; giữ relationship đã khai báo với current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi simultaneous regions không còn giữ readable labels, exact association và complete action.
- **Topology response:** Cluster graph, pairwise evidence, and canonical preview remain simultaneously visible.
- **Navigation replacement:** Không có khi mọi required region vẫn usable đồng thời.
- **Sticky boundary:** Chỉ current-task status/action được persist; phải reserve space và yield ở short height.
- **Overflow owner:** `candidate-cluster-graph` là bounded owner duy nhất theo trục cần thiết; page không own overflow.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi support region ưu tiên thấp nhất làm primary relationship không usable.
- **Topology response:** The cluster queue and pair evidence stay primary while the graph becomes optional.
- **Navigation replacement:** Named disclosure/drawer thay region bị rời và giữ exact selection cùng trigger.
- **Sticky boundary:** Current verdict hoặc action chỉ persist khi target/status còn visible và trở về flow ở short height.
- **Overflow owner:** `candidate-cluster-graph` giữ bounded overflow; drawer không tạo nested page scroll.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai task region không thể cùng giữ readable evidence, target 44px và unobscured focus.
- **Topology response:** Cluster queue → suspicious pair → evidence → merge or split → canonical preview → commit.
- **Navigation replacement:** Primary-pane sequence có Back khôi phục selection, state, query, scroll context và exact trigger.
- **Sticky boundary:** Action bar reserve content space, không che focus và yield về normal flow ở short height.
- **Overflow owner:** `candidate-cluster-graph` có text/list equivalent làm primary khi bounded view không fit.

### Reflow

- Semantic, DOM và meaningful focus order giữ graph: `cluster-adjudicator -> source-dataset-context -> candidate-cluster-graph -> pairwise-comparison-evidence -> cluster-consistency-and-anomaly-summary -> merge-split-and-canonical-actions -> outcome-preview -> audit-sample-and-commit`.
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

Task-specific states: cluster loading, pair match, pair nonmatch, pair uncertain, transitivity anomaly, split draft, merge draft, canonical field conflict, preview stale, audit sample pass, audit sample fail, commit, rollback.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `source-dataset-context` | Nêu scope đang load, reserve primary region và chỉ block owner bị lỗi. |
| Ready | `candidate-cluster-graph` | Hiện current object, owner relationship, selection và action hợp lệ bằng text cùng semantics. |
| Empty / not applicable | `candidate-cluster-graph` | Phân biệt true empty, no-match và non-applicable; chỉ rõ next action. |
| Error / retry | `outcome-preview` | Giữ context và input hợp lệ, nêu failed owner và đưa retry cục bộ. |
| Permission / unavailable | `audit-sample-and-commit` | Không coi hidden evidence là absent; giải thích restriction và safe exit. |
| Pending | `audit-sample-and-commit` | Ngăn duplicate, giữ exact target và announce progress mà không move focus. |
| Success | `audit-sample-and-commit` | Xác nhận exact outcome, giữ selection và cung cấp next valid action hoặc recovery. |
| Stale / conflict | `source-dataset-context` | Giữ last safe value, nêu version/time conflict và yêu cầu recovery rõ. |
| Focus transition | `audit-sample-and-commit` | Chỉ move focus tới modal hoặc error summary mới cần xử lý rồi trả về exact trigger. |
| Responsive presentation | `cluster-adjudicator` | Giữ state, selection, query, pending result và recovery khi topology đổi. |

## Boundaries

### Accept

- Accept khi dominant task là: Quyết định nhiều noisy record có đại diện cùng một entity hay không, rồi merge hoặc split cluster và định nghĩa canonical outcome có thể review.
- Accept khi mọi required region và relationship trong graph đều cần để hoàn tất task.
- Accept khi compact transformation giữ đúng task, state và recovery thay vì stack desktop boxes.

### Reject

- Reject two-source diff; đây là `AR-ERA-90` evidence và phải route tới adjacent archetype.
- Reject operational queue; đây là `AR-ERA-91` evidence và phải route tới adjacent archetype.
- Reject one-case dossier; đây là `AR-ERA-92` evidence và phải route tới adjacent archetype.
- Reject duplicate warning; đây là `AR-ERA-93` evidence và phải route tới adjacent archetype.

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
| [UK Ministry of Justice — Splink clustering](https://moj-analytical-services.github.io/splink/api_docs/linker_clustering.html) | Connected-record clustering and graph metrics. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [US Census — Statistical Quality Standard C4](https://www.census.gov/about/policies/quality/standards/standardc4.html) | Quality evidence for linking data records. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Explicit row-column relationships, selection, and bounded overflow. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [W3C WAI — Focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Logical keyboard order that preserves meaning and operability. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |

Source set gồm tối thiểu ba tổ chức official độc lập và có W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "entity-resolution-cluster-adjudicator",
  "situationCodes": ["<matched AR-ERA-* codes>"],
  "searchAliases": ["record linkage adjudicator","entity cluster review","deduplication cluster"],
  "dominantTask": "Quyết định nhiều noisy record có đại diện cùng một entity hay không, rồi merge hoặc split cluster và định nghĩa canonical outcome có thể review.",
  "regions": ["cluster-adjudicator","source-dataset-context","candidate-cluster-graph","pairwise-comparison-evidence","cluster-consistency-and-anomaly-summary","merge-split-and-canonical-actions","outcome-preview","audit-sample-and-commit"],
  "regionRelationships": ["N-record transitivity and canonicalization are independent owners bound to the same candidate cluster."],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "cluster-adjudicator -> source-dataset-context -> candidate-cluster-graph -> pairwise-comparison-evidence -> cluster-consistency-and-anomaly-summary -> merge-split-and-canonical-actions -> outcome-preview -> audit-sample-and-commit",
    "navigationReplacement": "<none or named disclosure, drawer, or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "candidate-cluster-graph",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": ["cluster loading","pair match","pair nonmatch","pair uncertain","transitivity anomaly","split draft","merge draft","canonical field conflict","preview stale","audit sample pass","audit sample fail","commit","rollback"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

