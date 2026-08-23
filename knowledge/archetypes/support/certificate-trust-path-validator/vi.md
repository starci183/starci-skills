# Certificate trust path validator

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `certificate-trust-path-validator` |
| Family | Support |
| Dominant task | Giải thích chính xác vì sao một certificate pass hoặc fail cho một endpoint, policy và trust store. |
| Search aliases | `certificate chain validator`, `TLS trust path`, `PKIX failure inspector` |
| Authority | Shared product-neutral macro topology; Grammar sở hữu product semantics, Principles sở hữu unresolved geometry và Direction sở hữu visual character. |

### Invariants

- Giải thích chính xác vì sao một certificate pass hoặc fail cho một endpoint, policy và trust store.
- The selected trust path and parallel hostname, key-usage, time, revocation, transparency, and policy checks jointly own the verdict.
- Mọi required region giữ owner riêng và cùng selected context; product noun không đổi topology.
- Wide, intermediate và compact giữ DOM/reading/focus order có nghĩa, action parity và deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-CTV-01` | Dominant task là observable outcome bắt buộc. | Required evidence. |
| `AR-CTV-02` | Toàn bộ required region graph và named relationship đều cần. | Required evidence. |
| `AR-CTV-03` | Compact giữ action, state, recovery và focus meaning của wide. | Required evidence. |
| `AR-CTV-04` | Task-specific state có thể đổi sau khi user đã tạo work state. | Required evidence. |
| `AR-CTV-90` | Dominant task thực tế thuộc effective-setting provenance. | Reject. |
| `AR-CTV-91` | Dominant task thực tế thuộc generic dependency graph. | Reject. |
| `AR-CTV-92` | Dominant task thực tế thuộc credential rotation. | Reject. |
| `AR-CTV-93` | Dominant task thực tế thuộc record detail without certification-path checks. | Reject. |

### Selection rule

Chọn `certificate-trust-path-validator` khi và chỉ khi `AR-CTV-01` đến `AR-CTV-04` đều được evidence và không có code `AR-CTV-90` đến `AR-CTV-93`. Trả `needs-evidence` khi một owner hoặc relationship còn thiếu; trả `reject` khi có rejection code.

## Region graph

```text
trust-validator -> endpoint-and-verification-context -> candidate-certificate-chains -> selected-trust-path -> per-certificate-fields-and-validity -> hostname-keyusage-policy-checks -> revocation-and-transparency-evidence -> failure-locus -> remediation
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `trust-validator` | Sở hữu dominant task, toàn bộ descendant state và recovery boundary. |
| `endpoint-and-verification-context` | Sở hữu evidence hoặc action của Endpoint And Verification Context; giữ relationship đã khai báo với current selection. |
| `candidate-certificate-chains` | Sở hữu evidence hoặc action của Candidate Certificate Chains; giữ relationship đã khai báo với current selection. |
| `selected-trust-path` | Sở hữu evidence hoặc action của Selected Trust Path; giữ relationship đã khai báo với current selection. |
| `per-certificate-fields-and-validity` | Sở hữu evidence hoặc action của Per Certificate Fields And Validity; giữ relationship đã khai báo với current selection. |
| `hostname-keyusage-policy-checks` | Sở hữu evidence hoặc action của Hostname Keyusage Policy Checks; giữ relationship đã khai báo với current selection. |
| `revocation-and-transparency-evidence` | Sở hữu evidence hoặc action của Revocation And Transparency Evidence; giữ relationship đã khai báo với current selection. |
| `failure-locus` | Sở hữu evidence hoặc action của Failure Locus; giữ relationship đã khai báo với current selection. |
| `remediation` | Sở hữu evidence hoặc action của Remediation; giữ relationship đã khai báo với current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi simultaneous regions không còn giữ readable labels, exact association và complete action.
- **Topology response:** Candidate chains, selected-certificate detail, and validation checks remain simultaneously visible.
- **Navigation replacement:** Không có khi mọi required region vẫn usable đồng thời.
- **Sticky boundary:** Chỉ current-task status/action được persist; phải reserve space và yield ở short height.
- **Overflow owner:** `candidate-certificate-chains` là bounded owner duy nhất theo trục cần thiết; page không own overflow.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi support region ưu tiên thấp nhất làm primary relationship không usable.
- **Topology response:** The chain summary persists while certificate fields and checks alternate in a named evidence pane.
- **Navigation replacement:** Named disclosure/drawer thay region bị rời và giữ exact selection cùng trigger.
- **Sticky boundary:** Current verdict hoặc action chỉ persist khi target/status còn visible và trở về flow ở short height.
- **Overflow owner:** `candidate-certificate-chains` giữ bounded overflow; drawer không tạo nested page scroll.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai task region không thể cùng giữ readable evidence, target 44px và unobscured focus.
- **Topology response:** Verdict → first failed check → trust path → certificate detail → remediation; Back restores the exact failed check.
- **Navigation replacement:** Primary-pane sequence có Back khôi phục selection, state, query, scroll context và exact trigger.
- **Sticky boundary:** Action bar reserve content space, không che focus và yield về normal flow ở short height.
- **Overflow owner:** `candidate-certificate-chains` có text/list equivalent làm primary khi bounded view không fit.

### Reflow

- Semantic, DOM và meaningful focus order giữ graph: `trust-validator -> endpoint-and-verification-context -> candidate-certificate-chains -> selected-trust-path -> per-certificate-fields-and-validity -> hostname-keyusage-policy-checks -> revocation-and-transparency-evidence -> failure-locus -> remediation`.
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

Task-specific states: endpoint loading, chain absent, multiple chains, valid, expired, not yet valid, hostname mismatch, usage invalid, revocation unknown, revoked, trust anchor missing, policy pass, policy fail, retry.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `endpoint-and-verification-context` | Nêu scope đang load, reserve primary region và chỉ block owner bị lỗi. |
| Ready | `candidate-certificate-chains` | Hiện current object, owner relationship, selection và action hợp lệ bằng text cùng semantics. |
| Empty / not applicable | `candidate-certificate-chains` | Phân biệt true empty, no-match và non-applicable; chỉ rõ next action. |
| Error / retry | `failure-locus` | Giữ context và input hợp lệ, nêu failed owner và đưa retry cục bộ. |
| Permission / unavailable | `remediation` | Không coi hidden evidence là absent; giải thích restriction và safe exit. |
| Pending | `remediation` | Ngăn duplicate, giữ exact target và announce progress mà không move focus. |
| Success | `remediation` | Xác nhận exact outcome, giữ selection và cung cấp next valid action hoặc recovery. |
| Stale / conflict | `endpoint-and-verification-context` | Giữ last safe value, nêu version/time conflict và yêu cầu recovery rõ. |
| Focus transition | `remediation` | Chỉ move focus tới modal hoặc error summary mới cần xử lý rồi trả về exact trigger. |
| Responsive presentation | `trust-validator` | Giữ state, selection, query, pending result và recovery khi topology đổi. |

## Boundaries

### Accept

- Accept khi dominant task là: Giải thích chính xác vì sao một certificate pass hoặc fail cho một endpoint, policy và trust store.
- Accept khi mọi required region và relationship trong graph đều cần để hoàn tất task.
- Accept khi compact transformation giữ đúng task, state và recovery thay vì stack desktop boxes.

### Reject

- Reject effective-setting provenance; đây là `AR-CTV-90` evidence và phải route tới adjacent archetype.
- Reject generic dependency graph; đây là `AR-CTV-91` evidence và phải route tới adjacent archetype.
- Reject credential rotation; đây là `AR-CTV-92` evidence và phải route tới adjacent archetype.
- Reject record detail without certification-path checks; đây là `AR-CTV-93` evidence và phải route tới adjacent archetype.

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
| [IETF RFC 5280](https://www.rfc-editor.org/rfc/rfc5280.html) | Certification-path validation, validity, constraints, and revocation processing. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [NIST SP 800-52 Rev. 2](https://csrc.nist.gov/pubs/sp/800/52/r2/final) | TLS certificate and protocol policy guidance. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [Visual Studio Code — UX guidelines](https://code.visualstudio.com/api/ux-guidelines/overview) | Tool workspaces with clear primary and secondary regions. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [W3C WAI — Focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Logical keyboard order that preserves meaning and operability. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |

Source set gồm tối thiểu ba tổ chức official độc lập và có W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "certificate-trust-path-validator",
  "situationCodes": ["<matched AR-CTV-* codes>"],
  "searchAliases": ["certificate chain validator","TLS trust path","PKIX failure inspector"],
  "dominantTask": "Giải thích chính xác vì sao một certificate pass hoặc fail cho một endpoint, policy và trust store.",
  "regions": ["trust-validator","endpoint-and-verification-context","candidate-certificate-chains","selected-trust-path","per-certificate-fields-and-validity","hostname-keyusage-policy-checks","revocation-and-transparency-evidence","failure-locus","remediation"],
  "regionRelationships": ["The selected trust path and parallel hostname, key-usage, time, revocation, transparency, and policy checks jointly own the verdict."],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "trust-validator -> endpoint-and-verification-context -> candidate-certificate-chains -> selected-trust-path -> per-certificate-fields-and-validity -> hostname-keyusage-policy-checks -> revocation-and-transparency-evidence -> failure-locus -> remediation",
    "navigationReplacement": "<none or named disclosure, drawer, or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "candidate-certificate-chains",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": ["endpoint loading","chain absent","multiple chains","valid","expired","not yet valid","hostname mismatch","usage invalid","revocation unknown","revoked","trust anchor missing","policy pass","policy fail","retry"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

