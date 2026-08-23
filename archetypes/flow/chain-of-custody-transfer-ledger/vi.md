# Chain of custody transfer ledger

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `chain-of-custody-transfer-ledger` |
| Family | Flow |
| Dominant task | Execute custody transfer lặp lại trong khi giữ current custodian, seal và condition evidence trong append-only provenance chain. |
| Search aliases | `custody transfer ledger`, `chain of custody`, `signed handoff history` |
| Authority | Shared product-neutral macro topology; Grammar sở hữu product semantics, Principles sở hữu unresolved geometry và Direction sở hữu visual character. |

### Invariants

- Execute custody transfer lặp lại trong khi giữ current custodian, seal và condition evidence trong append-only provenance chain.
- Each accepted transfer appends one receipt and updates exactly one canonical current custodian.
- Mọi required region giữ owner riêng và cùng selected context; product noun không đổi topology.
- Wide, intermediate và compact giữ DOM/reading/focus order có nghĩa, action parity và deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-CCT-01` | Dominant task là observable outcome bắt buộc. | Required evidence. |
| `AR-CCT-02` | Toàn bộ required region graph và named relationship đều cần. | Required evidence. |
| `AR-CCT-03` | Compact giữ action, state, recovery và focus meaning của wide. | Required evidence. |
| `AR-CCT-04` | Task-specific state có thể đổi sau khi user đã tạo work state. | Required evidence. |
| `AR-CCT-90` | Dominant task thực tế thuộc one-time cross-party handoff. | Reject. |
| `AR-CCT-91` | Dominant task thực tế thuộc audit timeline. | Reject. |
| `AR-CCT-92` | Dominant task thực tế thuộc sample lineage explorer. | Reject. |
| `AR-CCT-93` | Dominant task thực tế thuộc package tracking. | Reject. |

### Selection rule

Chọn `chain-of-custody-transfer-ledger` khi và chỉ khi `AR-CCT-01` đến `AR-CCT-04` đều được evidence và không có code `AR-CCT-90` đến `AR-CCT-93`. Trả `needs-evidence` khi một owner hoặc relationship còn thiếu; trả `reject` khi có rejection code.

## Region graph

```text
custody-ledger -> item-batch-identity -> current-custodian-condition -> transfer-event-chain -> pending-handoff -> recipient-verification -> seal-condition-evidence -> accept-reject-exception -> signed-receipt-and-current-state
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `custody-ledger` | Sở hữu dominant task, toàn bộ descendant state và recovery boundary. |
| `item-batch-identity` | Sở hữu evidence hoặc action của Item Batch Identity; giữ relationship đã khai báo với current selection. |
| `current-custodian-condition` | Sở hữu evidence hoặc action của Current Custodian Condition; giữ relationship đã khai báo với current selection. |
| `transfer-event-chain` | Sở hữu evidence hoặc action của Transfer Event Chain; giữ relationship đã khai báo với current selection. |
| `pending-handoff` | Sở hữu evidence hoặc action của Pending Handoff; giữ relationship đã khai báo với current selection. |
| `recipient-verification` | Sở hữu evidence hoặc action của Recipient Verification; giữ relationship đã khai báo với current selection. |
| `seal-condition-evidence` | Sở hữu evidence hoặc action của Seal Condition Evidence; giữ relationship đã khai báo với current selection. |
| `accept-reject-exception` | Sở hữu evidence hoặc action của Accept Reject Exception; giữ relationship đã khai báo với current selection. |
| `signed-receipt-and-current-state` | Sở hữu evidence hoặc action của Signed Receipt And Current State; giữ relationship đã khai báo với current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi simultaneous regions không còn giữ readable labels, exact association và complete action.
- **Topology response:** Event chain, current state, and pending transfer remain simultaneously visible.
- **Navigation replacement:** Không có khi mọi required region vẫn usable đồng thời.
- **Sticky boundary:** Chỉ current-task status/action được persist; phải reserve space và yield ở short height.
- **Overflow owner:** `transfer-event-chain` là bounded owner duy nhất theo trục cần thiết; page không own overflow.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi support region ưu tiên thấp nhất làm primary relationship không usable.
- **Topology response:** The event chain collapses to a rail while pending verification stays primary.
- **Navigation replacement:** Named disclosure/drawer thay region bị rời và giữ exact selection cùng trigger.
- **Sticky boundary:** Current verdict hoặc action chỉ persist khi target/status còn visible và trở về flow ở short height.
- **Overflow owner:** `transfer-event-chain` giữ bounded overflow; drawer không tạo nested page scroll.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai task region không thể cùng giữ readable evidence, target 44px và unobscured focus.
- **Topology response:** Current custody → pending handoff → verification and evidence → accept or reject → signed receipt; history remains reachable.
- **Navigation replacement:** Primary-pane sequence có Back khôi phục selection, state, query, scroll context và exact trigger.
- **Sticky boundary:** Action bar reserve content space, không che focus và yield về normal flow ở short height.
- **Overflow owner:** `transfer-event-chain` có text/list equivalent làm primary khi bounded view không fit.

### Reflow

- Semantic, DOM và meaningful focus order giữ graph: `custody-ledger -> item-batch-identity -> current-custodian-condition -> transfer-event-chain -> pending-handoff -> recipient-verification -> seal-condition-evidence -> accept-reject-exception -> signed-receipt-and-current-state`.
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

Task-specific states: custody current, custody unknown, transfer draft, transfer pending, transfer accepted, transfer rejected, recipient verified, recipient failed, seal intact, seal broken, seal unknown, condition unchanged, condition damaged, receipt signing, receipt failure, exception.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `item-batch-identity` | Nêu scope đang load, reserve primary region và chỉ block owner bị lỗi. |
| Ready | `current-custodian-condition` | Hiện current object, owner relationship, selection và action hợp lệ bằng text cùng semantics. |
| Empty / not applicable | `current-custodian-condition` | Phân biệt true empty, no-match và non-applicable; chỉ rõ next action. |
| Error / retry | `accept-reject-exception` | Giữ context và input hợp lệ, nêu failed owner và đưa retry cục bộ. |
| Permission / unavailable | `signed-receipt-and-current-state` | Không coi hidden evidence là absent; giải thích restriction và safe exit. |
| Pending | `signed-receipt-and-current-state` | Ngăn duplicate, giữ exact target và announce progress mà không move focus. |
| Success | `signed-receipt-and-current-state` | Xác nhận exact outcome, giữ selection và cung cấp next valid action hoặc recovery. |
| Stale / conflict | `item-batch-identity` | Giữ last safe value, nêu version/time conflict và yêu cầu recovery rõ. |
| Focus transition | `signed-receipt-and-current-state` | Chỉ move focus tới modal hoặc error summary mới cần xử lý rồi trả về exact trigger. |
| Responsive presentation | `custody-ledger` | Giữ state, selection, query, pending result và recovery khi topology đổi. |

## Boundaries

### Accept

- Accept khi dominant task là: Execute custody transfer lặp lại trong khi giữ current custodian, seal và condition evidence trong append-only provenance chain.
- Accept khi mọi required region và relationship trong graph đều cần để hoàn tất task.
- Accept khi compact transformation giữ đúng task, state và recovery thay vì stack desktop boxes.

### Reject

- Reject one-time cross-party handoff; đây là `AR-CCT-90` evidence và phải route tới adjacent archetype.
- Reject audit timeline; đây là `AR-CCT-91` evidence và phải route tới adjacent archetype.
- Reject sample lineage explorer; đây là `AR-CCT-92` evidence và phải route tới adjacent archetype.
- Reject package tracking; đây là `AR-CCT-93` evidence và phải route tới adjacent archetype.

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
| [GS1 — Global Traceability Standard](https://www.gs1.org/standards/gs1-global-traceability-standard/current-standard) | Time-ordered custody parties, traceability events, and key evidence. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Explicit row-column relationships, selection, and bounded overflow. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [Microsoft Fluent 2 — Layout](https://fluent2.microsoft.design/layout) | Adaptive regions and readable pane relationships. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Status changes announced without moving focus. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |

Source set gồm tối thiểu ba tổ chức official độc lập và có W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "chain-of-custody-transfer-ledger",
  "situationCodes": ["<matched AR-CCT-* codes>"],
  "searchAliases": ["custody transfer ledger","chain of custody","signed handoff history"],
  "dominantTask": "Execute custody transfer lặp lại trong khi giữ current custodian, seal và condition evidence trong append-only provenance chain.",
  "regions": ["custody-ledger","item-batch-identity","current-custodian-condition","transfer-event-chain","pending-handoff","recipient-verification","seal-condition-evidence","accept-reject-exception","signed-receipt-and-current-state"],
  "regionRelationships": ["Each accepted transfer appends one receipt and updates exactly one canonical current custodian."],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "custody-ledger -> item-batch-identity -> current-custodian-condition -> transfer-event-chain -> pending-handoff -> recipient-verification -> seal-condition-evidence -> accept-reject-exception -> signed-receipt-and-current-state",
    "navigationReplacement": "<none or named disclosure, drawer, or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "transfer-event-chain",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": ["custody current","custody unknown","transfer draft","transfer pending","transfer accepted","transfer rejected","recipient verified","recipient failed","seal intact","seal broken","seal unknown","condition unchanged","condition damaged","receipt signing","receipt failure","exception"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

