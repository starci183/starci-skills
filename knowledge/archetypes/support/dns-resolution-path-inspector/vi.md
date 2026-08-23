# DNS resolution path inspector

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `dns-resolution-path-inspector` |
| Family | Support |
| Dominant task | Trace một DNS question qua recursive hops, delegation, cache và DNSSEC proof để tìm failure hoặc answer bất ngờ. |
| Search aliases | `DNS trace`, `delegation inspector`, `DNSSEC proof path` |
| Authority | Shared product-neutral macro topology; Grammar sở hữu product semantics, Principles sở hữu unresolved geometry và Direction sở hữu visual character. |

### Invariants

- Trace một DNS question qua recursive hops, delegation, cache và DNSSEC proof để tìm failure hoặc answer bất ngờ.
- Delegation hierarchy, RRsets, and the DNSSEC proof chain remain separate owners linked by the selected query and hop.
- Mọi required region giữ owner riêng và cùng selected context; product noun không đổi topology.
- Wide, intermediate và compact giữ DOM/reading/focus order có nghĩa, action parity và deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-DRP-01` | Dominant task là observable outcome bắt buộc. | Required evidence. |
| `AR-DRP-02` | Toàn bộ required region graph và named relationship đều cần. | Required evidence. |
| `AR-DRP-03` | Compact giữ action, state, recovery và focus meaning của wide. | Required evidence. |
| `AR-DRP-04` | Task-specific state có thể đổi sau khi user đã tạo work state. | Required evidence. |
| `AR-DRP-90` | Dominant task thực tế thuộc distributed trace. | Reject. |
| `AR-DRP-91` | Dominant task thực tế thuộc streaming logs. | Reject. |
| `AR-DRP-92` | Dominant task thực tế thuộc certificate path. | Reject. |
| `AR-DRP-93` | Dominant task thực tế thuộc generic network topology. | Reject. |

### Selection rule

Chọn `dns-resolution-path-inspector` khi và chỉ khi `AR-DRP-01` đến `AR-DRP-04` đều được evidence và không có code `AR-DRP-90` đến `AR-DRP-93`. Trả `needs-evidence` khi một owner hoặc relationship còn thiếu; trả `reject` khi có rejection code.

## Region graph

```text
dns-inspector -> query-and-network-context -> recursive-hop-sequence -> delegation-and-authority-tree -> rrset-evidence -> dnssec-proof-chain -> timing-and-cache-status -> failure-locus -> retry-or-export
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `dns-inspector` | Sở hữu dominant task, toàn bộ descendant state và recovery boundary. |
| `query-and-network-context` | Sở hữu evidence hoặc action của Query And Network Context; giữ relationship đã khai báo với current selection. |
| `recursive-hop-sequence` | Sở hữu evidence hoặc action của Recursive Hop Sequence; giữ relationship đã khai báo với current selection. |
| `delegation-and-authority-tree` | Sở hữu evidence hoặc action của Delegation And Authority Tree; giữ relationship đã khai báo với current selection. |
| `rrset-evidence` | Sở hữu evidence hoặc action của Rrset Evidence; giữ relationship đã khai báo với current selection. |
| `dnssec-proof-chain` | Sở hữu evidence hoặc action của Dnssec Proof Chain; giữ relationship đã khai báo với current selection. |
| `timing-and-cache-status` | Sở hữu evidence hoặc action của Timing And Cache Status; giữ relationship đã khai báo với current selection. |
| `failure-locus` | Sở hữu evidence hoặc action của Failure Locus; giữ relationship đã khai báo với current selection. |
| `retry-or-export` | Sở hữu evidence hoặc action của Retry Or Export; giữ relationship đã khai báo với current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi simultaneous regions không còn giữ readable labels, exact association và complete action.
- **Topology response:** Resolution path, delegation tree, RRsets, timing, and proof evidence remain simultaneously visible.
- **Navigation replacement:** Không có khi mọi required region vẫn usable đồng thời.
- **Sticky boundary:** Chỉ current-task status/action được persist; phải reserve space và yield ở short height.
- **Overflow owner:** `recursive-hop-sequence` là bounded owner duy nhất theo trục cần thiết; page không own overflow.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi support region ưu tiên thấp nhất làm primary relationship không usable.
- **Topology response:** The resolution path stays primary while RRset and proof detail move into a named drawer.
- **Navigation replacement:** Named disclosure/drawer thay region bị rời và giữ exact selection cùng trigger.
- **Sticky boundary:** Current verdict hoặc action chỉ persist khi target/status còn visible và trở về flow ở short height.
- **Overflow owner:** `recursive-hop-sequence` giữ bounded overflow; drawer không tạo nested page scroll.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai task region không thể cùng giữ readable evidence, target 44px và unobscured focus.
- **Topology response:** Verdict → ordered hops → selected delegation and RRset → DNSSEC proof → timing and cache → retry.
- **Navigation replacement:** Primary-pane sequence có Back khôi phục selection, state, query, scroll context và exact trigger.
- **Sticky boundary:** Action bar reserve content space, không che focus và yield về normal flow ở short height.
- **Overflow owner:** `recursive-hop-sequence` có text/list equivalent làm primary khi bounded view không fit.

### Reflow

- Semantic, DOM và meaningful focus order giữ graph: `dns-inspector -> query-and-network-context -> recursive-hop-sequence -> delegation-and-authority-tree -> rrset-evidence -> dnssec-proof-chain -> timing-and-cache-status -> failure-locus -> retry-or-export`.
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

Task-specific states: query pending, timeout, cache hit, cache miss, cache stale, delegation valid, delegation lame, RRset empty, RRset conflicting, DNSSEC secure, DNSSEC insecure, DNSSEC bogus, DNSSEC indeterminate, network failure, retry.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `query-and-network-context` | Nêu scope đang load, reserve primary region và chỉ block owner bị lỗi. |
| Ready | `recursive-hop-sequence` | Hiện current object, owner relationship, selection và action hợp lệ bằng text cùng semantics. |
| Empty / not applicable | `recursive-hop-sequence` | Phân biệt true empty, no-match và non-applicable; chỉ rõ next action. |
| Error / retry | `failure-locus` | Giữ context và input hợp lệ, nêu failed owner và đưa retry cục bộ. |
| Permission / unavailable | `retry-or-export` | Không coi hidden evidence là absent; giải thích restriction và safe exit. |
| Pending | `retry-or-export` | Ngăn duplicate, giữ exact target và announce progress mà không move focus. |
| Success | `retry-or-export` | Xác nhận exact outcome, giữ selection và cung cấp next valid action hoặc recovery. |
| Stale / conflict | `query-and-network-context` | Giữ last safe value, nêu version/time conflict và yêu cầu recovery rõ. |
| Focus transition | `retry-or-export` | Chỉ move focus tới modal hoặc error summary mới cần xử lý rồi trả về exact trigger. |
| Responsive presentation | `dns-inspector` | Giữ state, selection, query, pending result và recovery khi topology đổi. |

## Boundaries

### Accept

- Accept khi dominant task là: Trace một DNS question qua recursive hops, delegation, cache và DNSSEC proof để tìm failure hoặc answer bất ngờ.
- Accept khi mọi required region và relationship trong graph đều cần để hoàn tất task.
- Accept khi compact transformation giữ đúng task, state và recovery thay vì stack desktop boxes.

### Reject

- Reject distributed trace; đây là `AR-DRP-90` evidence và phải route tới adjacent archetype.
- Reject streaming logs; đây là `AR-DRP-91` evidence và phải route tới adjacent archetype.
- Reject certificate path; đây là `AR-DRP-92` evidence và phải route tới adjacent archetype.
- Reject generic network topology; đây là `AR-DRP-93` evidence và phải route tới adjacent archetype.

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
| [IETF RFC 1034](https://www.rfc-editor.org/rfc/rfc1034.html) | DNS concepts, resolvers, name servers, and delegation. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [ICANN — Root Server System](https://www.icann.org/root-server-system-en) | Root referrals and resolver traversal of the DNS hierarchy. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [Visual Studio Code — UX guidelines](https://code.visualstudio.com/api/ux-guidelines/overview) | Tool workspaces with clear primary and secondary regions. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [W3C WAI — Focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Logical keyboard order that preserves meaning and operability. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |

Source set gồm tối thiểu ba tổ chức official độc lập và có W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "dns-resolution-path-inspector",
  "situationCodes": ["<matched AR-DRP-* codes>"],
  "searchAliases": ["DNS trace","delegation inspector","DNSSEC proof path"],
  "dominantTask": "Trace một DNS question qua recursive hops, delegation, cache và DNSSEC proof để tìm failure hoặc answer bất ngờ.",
  "regions": ["dns-inspector","query-and-network-context","recursive-hop-sequence","delegation-and-authority-tree","rrset-evidence","dnssec-proof-chain","timing-and-cache-status","failure-locus","retry-or-export"],
  "regionRelationships": ["Delegation hierarchy, RRsets, and the DNSSEC proof chain remain separate owners linked by the selected query and hop."],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "dns-inspector -> query-and-network-context -> recursive-hop-sequence -> delegation-and-authority-tree -> rrset-evidence -> dnssec-proof-chain -> timing-and-cache-status -> failure-locus -> retry-or-export",
    "navigationReplacement": "<none or named disclosure, drawer, or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "recursive-hop-sequence",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": ["query pending","timeout","cache hit","cache miss","cache stale","delegation valid","delegation lame","RRset empty","RRset conflicting","DNSSEC secure","DNSSEC insecure","DNSSEC bogus","DNSSEC indeterminate","network failure","retry"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

