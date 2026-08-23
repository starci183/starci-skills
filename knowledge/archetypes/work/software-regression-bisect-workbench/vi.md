# Software regression bisect workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `software-regression-bisect-workbench` |
| Family | Work |
| Dominant task | Lặp lại việc test revision đã chọn để thu nhỏ interval known-good/known-bad cho tới khi chứng minh commit gây regression. |
| Search aliases | `git bisect workbench`, `regression interval`, `culprit commit finder` |
| Authority | Shared product-neutral macro topology; Grammar sở hữu product semantics, Principles sở hữu unresolved geometry và Direction sở hữu visual character. |

### Invariants

- Lặp lại việc test revision đã chọn để thu nhỏ interval known-good/known-bad cho tới khi chứng minh commit gây regression.
- The ordered revision interval and executable result evidence determine every next candidate and terminal culprit.
- Mọi required region giữ owner riêng và cùng selected context; product noun không đổi topology.
- Wide, intermediate và compact giữ DOM/reading/focus order có nghĩa, action parity và deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-SRB-01` | Dominant task là observable outcome bắt buộc. | Required evidence. |
| `AR-SRB-02` | Toàn bộ required region graph và named relationship đều cần. | Required evidence. |
| `AR-SRB-03` | Compact giữ action, state, recovery và focus meaning của wide. | Required evidence. |
| `AR-SRB-04` | Task-specific state có thể đổi sau khi user đã tạo work state. | Required evidence. |
| `AR-SRB-90` | Dominant task thực tế thuộc guided troubleshooting tree. | Reject. |
| `AR-SRB-91` | Dominant task thực tế thuộc job-run timeline. | Reject. |
| `AR-SRB-92` | Dominant task thực tế thuộc audit timeline. | Reject. |
| `AR-SRB-93` | Dominant task thực tế thuộc generic commit explorer. | Reject. |

### Selection rule

Chọn `software-regression-bisect-workbench` khi và chỉ khi `AR-SRB-01` đến `AR-SRB-04` đều được evidence và không có code `AR-SRB-90` đến `AR-SRB-93`. Trả `needs-evidence` khi một owner hoặc relationship còn thiếu; trả `reject` khi có rejection code.

## Region graph

```text
bisect-workbench -> symptom-and-reproduction-command -> known-good-and-bad-endpoints -> candidate-interval-and-commit-graph -> current-candidate-build-and-test -> result-evidence -> shrinking-interval -> skipped-or-ambiguous-candidates -> culprit-confirmation-and-reset
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `bisect-workbench` | Sở hữu dominant task, toàn bộ descendant state và recovery boundary. |
| `symptom-and-reproduction-command` | Sở hữu evidence hoặc action của Symptom And Reproduction Command; giữ relationship đã khai báo với current selection. |
| `known-good-and-bad-endpoints` | Sở hữu evidence hoặc action của Known Good And Bad Endpoints; giữ relationship đã khai báo với current selection. |
| `candidate-interval-and-commit-graph` | Sở hữu evidence hoặc action của Candidate Interval And Commit Graph; giữ relationship đã khai báo với current selection. |
| `current-candidate-build-and-test` | Sở hữu evidence hoặc action của Current Candidate Build And Test; giữ relationship đã khai báo với current selection. |
| `result-evidence` | Sở hữu evidence hoặc action của Result Evidence; giữ relationship đã khai báo với current selection. |
| `shrinking-interval` | Sở hữu evidence hoặc action của Shrinking Interval; giữ relationship đã khai báo với current selection. |
| `skipped-or-ambiguous-candidates` | Sở hữu evidence hoặc action của Skipped Or Ambiguous Candidates; giữ relationship đã khai báo với current selection. |
| `culprit-confirmation-and-reset` | Sở hữu evidence hoặc action của Culprit Confirmation And Reset; giữ relationship đã khai báo với current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi simultaneous regions không còn giữ readable labels, exact association và complete action.
- **Topology response:** Commit interval, active test evidence, and remaining candidates remain simultaneously visible.
- **Navigation replacement:** Không có khi mọi required region vẫn usable đồng thời.
- **Sticky boundary:** Chỉ current-task status/action được persist; phải reserve space và yield ở short height.
- **Overflow owner:** `candidate-interval-and-commit-graph` là bounded owner duy nhất theo trục cần thiết; page không own overflow.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi support region ưu tiên thấp nhất làm primary relationship không usable.
- **Topology response:** The active candidate and run are primary while the interval summary persists.
- **Navigation replacement:** Named disclosure/drawer thay region bị rời và giữ exact selection cùng trigger.
- **Sticky boundary:** Current verdict hoặc action chỉ persist khi target/status còn visible và trở về flow ở short height.
- **Overflow owner:** `candidate-interval-and-commit-graph` giữ bounded overflow; drawer không tạo nested page scroll.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai task region không thể cùng giữ readable evidence, target 44px và unobscured focus.
- **Topology response:** Next candidate → build and test → mark good, bad, or skip → remaining interval → culprit confirmation or reset.
- **Navigation replacement:** Primary-pane sequence có Back khôi phục selection, state, query, scroll context và exact trigger.
- **Sticky boundary:** Action bar reserve content space, không che focus và yield về normal flow ở short height.
- **Overflow owner:** `candidate-interval-and-commit-graph` có text/list equivalent làm primary khi bounded view không fit.

### Reflow

- Semantic, DOM và meaningful focus order giữ graph: `bisect-workbench -> symptom-and-reproduction-command -> known-good-and-bad-endpoints -> candidate-interval-and-commit-graph -> current-candidate-build-and-test -> result-evidence -> shrinking-interval -> skipped-or-ambiguous-candidates -> culprit-confirmation-and-reset`.
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

Task-specific states: endpoints invalid, candidate checkout, building, testing, good, bad, skip, ambiguous, command failed, interval shrinking, culprit provisional, culprit confirmed, abort, reset, evidence export.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `symptom-and-reproduction-command` | Nêu scope đang load, reserve primary region và chỉ block owner bị lỗi. |
| Ready | `known-good-and-bad-endpoints` | Hiện current object, owner relationship, selection và action hợp lệ bằng text cùng semantics. |
| Empty / not applicable | `known-good-and-bad-endpoints` | Phân biệt true empty, no-match và non-applicable; chỉ rõ next action. |
| Error / retry | `skipped-or-ambiguous-candidates` | Giữ context và input hợp lệ, nêu failed owner và đưa retry cục bộ. |
| Permission / unavailable | `culprit-confirmation-and-reset` | Không coi hidden evidence là absent; giải thích restriction và safe exit. |
| Pending | `culprit-confirmation-and-reset` | Ngăn duplicate, giữ exact target và announce progress mà không move focus. |
| Success | `culprit-confirmation-and-reset` | Xác nhận exact outcome, giữ selection và cung cấp next valid action hoặc recovery. |
| Stale / conflict | `symptom-and-reproduction-command` | Giữ last safe value, nêu version/time conflict và yêu cầu recovery rõ. |
| Focus transition | `culprit-confirmation-and-reset` | Chỉ move focus tới modal hoặc error summary mới cần xử lý rồi trả về exact trigger. |
| Responsive presentation | `bisect-workbench` | Giữ state, selection, query, pending result và recovery khi topology đổi. |

## Boundaries

### Accept

- Accept khi dominant task là: Lặp lại việc test revision đã chọn để thu nhỏ interval known-good/known-bad cho tới khi chứng minh commit gây regression.
- Accept khi mọi required region và relationship trong graph đều cần để hoàn tất task.
- Accept khi compact transformation giữ đúng task, state và recovery thay vì stack desktop boxes.

### Reject

- Reject guided troubleshooting tree; đây là `AR-SRB-90` evidence và phải route tới adjacent archetype.
- Reject job-run timeline; đây là `AR-SRB-91` evidence và phải route tới adjacent archetype.
- Reject audit timeline; đây là `AR-SRB-92` evidence và phải route tới adjacent archetype.
- Reject generic commit explorer; đây là `AR-SRB-93` evidence và phải route tới adjacent archetype.

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
| [Git — git bisect](https://git-scm.com/docs/git-bisect) | Algorithmic good and bad interval reduction, skip, reset, and run. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [Chromium — bisect-builds.py](https://www.chromium.org/developers/bisect-builds-py/) | Executable revision testing across available builds. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [Visual Studio Code — UX guidelines](https://code.visualstudio.com/api/ux-guidelines/overview) | Tool workspaces with clear primary and secondary regions. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Status changes announced without moving focus. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |

Source set gồm tối thiểu ba tổ chức official độc lập và có W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "software-regression-bisect-workbench",
  "situationCodes": ["<matched AR-SRB-* codes>"],
  "searchAliases": ["git bisect workbench","regression interval","culprit commit finder"],
  "dominantTask": "Lặp lại việc test revision đã chọn để thu nhỏ interval known-good/known-bad cho tới khi chứng minh commit gây regression.",
  "regions": ["bisect-workbench","symptom-and-reproduction-command","known-good-and-bad-endpoints","candidate-interval-and-commit-graph","current-candidate-build-and-test","result-evidence","shrinking-interval","skipped-or-ambiguous-candidates","culprit-confirmation-and-reset"],
  "regionRelationships": ["The ordered revision interval and executable result evidence determine every next candidate and terminal culprit."],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "bisect-workbench -> symptom-and-reproduction-command -> known-good-and-bad-endpoints -> candidate-interval-and-commit-graph -> current-candidate-build-and-test -> result-evidence -> shrinking-interval -> skipped-or-ambiguous-candidates -> culprit-confirmation-and-reset",
    "navigationReplacement": "<none or named disclosure, drawer, or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "candidate-interval-and-commit-graph",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": ["endpoints invalid","candidate checkout","building","testing","good","bad","skip","ambiguous","command failed","interval shrinking","culprit provisional","culprit confirmed","abort","reset","evidence export"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

