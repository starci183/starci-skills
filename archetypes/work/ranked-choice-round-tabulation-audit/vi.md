# Ranked choice round tabulation audit

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `ranked-choice-round-tabulation-audit` |
| Family | Work |
| Dominant task | Tái tạo và audit một ranked-choice contest theo từng round từ versioned cast-vote preferences, áp dụng validity, threshold, transfer, exhaustion và tie rules cho đến khi chứng minh terminal result. |
| Search aliases | `ranked choice recount`, `round transfer audit`, `cast vote record tabulation` |
| Authority | Shared product-neutral macro topology; Grammar sở hữu product semantics, Principles sở hữu unresolved geometry và Direction sở hữu visual character. |

### Invariants

- Tái tạo và audit một ranked-choice contest theo từng round từ versioned cast-vote preferences, áp dụng validity, threshold, transfer, exhaustion và tie rules cho đến khi chứng minh terminal result.
- Mỗi round chỉ derive từ continuing-candidate set của round trước và immutable normalized ballot preferences dưới một rule version; mọi transfer, exhaustion, tie decision và receipt đều reproducible.
- Mỗi required region giữ một owner riêng và cùng selected context; product noun không thay đổi topology.
- Wide, intermediate và compact giữ meaningful DOM, reading và focus order, action parity và deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-RCT-01` | Dominant task là observable outcome bắt buộc. | Bằng chứng bắt buộc. |
| `AR-RCT-02` | Toàn bộ required region graph và named relationship đều cần. | Bằng chứng bắt buộc. |
| `AR-RCT-03` | Compact giữ action, state, recovery và focus meaning của wide. | Bằng chứng bắt buộc. |
| `AR-RCT-04` | Task-specific state có thể đổi sau khi user tạo work state. | Bằng chứng bắt buộc. |
| `AR-RCT-90` | Dominant task thực tế thuộc constrained quota allocation. | Reject. |
| `AR-RCT-91` | Dominant task thực tế thuộc signed contribution waterfall. | Reject. |
| `AR-RCT-92` | Dominant task thực tế thuộc case-resolution dossier. | Reject. |
| `AR-RCT-93` | Dominant task thực tế thuộc generic election dashboard. | Reject. |

### Selection rule

Chọn `ranked-choice-round-tabulation-audit` khi và chỉ khi `AR-RCT-01` đến `AR-RCT-04` đều được evidence và không có `AR-RCT-90` đến `AR-RCT-93`. Trả `needs-evidence` khi owner hoặc relationship còn thiếu; trả `reject` khi có rejection code.

## Region graph

```text
ranked-choice-audit
|-- jurisdiction-contest-rule-and-input-version
|-- ballot-style-and-cast-vote-record-set
|   `-- validity-adjudication-and-preference-normalization
|-- continuing-candidate-set
|-- round-tally-and-threshold-proof
|   <-> ballot-transfer-exhaustion-and-tie-resolution-ledger
|-- elected-or-eliminated-transition
|-- next-round-or-terminal-result
`-- reproducibility-export-recount-and-certification-receipt
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `ranked-choice-audit` | Sở hữu dominant task, toàn bộ descendant state và recovery boundary. |
| `jurisdiction-contest-rule-and-input-version` | Sở hữu evidence, action và state của Jurisdiction Contest Rule And Input Version; giữ quan hệ đã khai báo với selection hiện tại và không vay product semantics. |
| `ballot-style-and-cast-vote-record-set` | Sở hữu evidence, action và state của Ballot Style And Cast Vote Record Set; giữ quan hệ đã khai báo với selection hiện tại và không vay product semantics. |
| `validity-adjudication-and-preference-normalization` | Sở hữu evidence, action và state của Validity Adjudication And Preference Normalization; giữ quan hệ đã khai báo với selection hiện tại và không vay product semantics. |
| `continuing-candidate-set` | Sở hữu evidence, action và state của Continuing Candidate Set; giữ quan hệ đã khai báo với selection hiện tại và không vay product semantics. |
| `round-tally-and-threshold-proof` | Sở hữu evidence, action và state của Round Tally And Threshold Proof; giữ quan hệ đã khai báo với selection hiện tại và không vay product semantics. |
| `ballot-transfer-exhaustion-and-tie-resolution-ledger` | Sở hữu evidence, action và state của Ballot Transfer Exhaustion And Tie Resolution Ledger; giữ quan hệ đã khai báo với selection hiện tại và không vay product semantics. |
| `elected-or-eliminated-transition` | Sở hữu evidence, action và state của Elected Or Eliminated Transition; giữ quan hệ đã khai báo với selection hiện tại và không vay product semantics. |
| `next-round-or-terminal-result` | Sở hữu evidence, action và state của Next Round Or Terminal Result; giữ quan hệ đã khai báo với selection hiện tại và không vay product semantics. |
| `reproducibility-export-recount-and-certification-receipt` | Sở hữu evidence, action và state của Reproducibility Export Recount And Certification Receipt; giữ quan hệ đã khai báo với selection hiện tại và không vay product semantics. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi các vùng đồng thời không còn giữ được readable labels, exact associations và complete actions.
- **Topology response:** Candidate status, current and prior round tallies, threshold proof, selected ballot transfer, exhaustion, tie rule, and round lineage được giữ hiển thị together.
- **Navigation replacement:** None while all simultaneous regions remain usable.
- **Sticky boundary:** Chỉ current task receipt hoặc blocking action được sticky; nó reserve space, không che focus và trở về normal flow ở short height.
- **Overflow owner:** `round-tally-and-threshold-proof` is the only bounded owner on the necessary axis; the page owns no overflow.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi supporting region ưu tiên thấp làm primary relationship không dùng được.
- **Topology response:** Current round và transition proof giữ vai trò primary; cast-vote roster, mọi prior round, quarantine evidence và certification history chuyển vào synchronized drawers.
- **Navigation replacement:** Một synchronized drawer thay vùng bị dời và giữ nguyên selected object, query, state, scroll context và exact trigger.
- **Sticky boundary:** Chỉ current task receipt hoặc blocking action được sticky; nó reserve space, không che focus và trở về normal flow ở short height.
- **Overflow owner:** `round-tally-and-threshold-proof` retains bounded overflow; the drawer creates no nested page scroll.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai task regions không thể cùng giữ readable evidence, target 44 CSS px và unobscured focus.
- **Topology response:** Contest và input version → current round → continuing candidates → selected tally hoặc ballot transfer → threshold hoặc tie decision → elect, eliminate hoặc continue → next round và audit receipt; matrix trở thành round navigator.
- **Navigation replacement:** Primary-pane sequence với Back khôi phục selection, state, query, scroll context và exact trigger.
- **Sticky boundary:** Chỉ current task receipt hoặc blocking action được sticky; nó reserve space, không che focus và trở về normal flow ở short height.
- **Overflow owner:** `round-tally-and-threshold-proof` becomes a semantic list or step route when its bounded view no longer fits.

### Reflow

- Semantic, DOM và meaningful focus order giữ graph: `ranked-choice-audit -> jurisdiction-contest-rule-and-input-version -> ballot-style-and-cast-vote-record-set -> validity-adjudication-and-preference-normalization -> continuing-candidate-set -> round-tally-and-threshold-proof -> ballot-transfer-exhaustion-and-tie-resolution-ledger -> elected-or-eliminated-transition -> next-round-or-terminal-result -> reproducibility-export-recount-and-certification-receipt`.
- Long labels, localization, zoom và enlarged controls kích hoạt cùng named topology changes.
- CSS không reorder semantics; ordinary content không tạo page-level horizontal scroll.
- Hidden detail luôn có explicit accessible reveal path.

### Interaction parity

- Mọi selection, edit, action, explanation, retry và recovery ở wide vẫn reachable ở intermediate và compact.
- Topology change giữ exact selected object, order, input, pending result và error context.
- Pointer action có keyboard equivalent; color không bao giờ là tín hiệu duy nhất.
- Dynamic update announce một contextual status mà không giật focus.

## State obligations

Task-specific states: input loading/validated/quarantined; ballot valid/overvoted/exhausted/adjudicated; candidate continuing/elected/eliminated/withdrawn; round queued/calculated/challenged/locked; threshold unmet/met; transfer pending/complete; tie unresolved/rule-resolved; result unofficial/recounted/certified; export reproducible/mismatched.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `jurisdiction-contest-rule-and-input-version` | Nêu loading scope, reserve primary region và chỉ block owner bị lỗi. |
| Ready | `ballot-style-and-cast-vote-record-set` | Expose current object, owner relationship, selection và valid action bằng text lẫn semantics. |
| Empty / not applicable | `ballot-style-and-cast-vote-record-set` | Phân biệt true empty, no-match và non-applicable; cung cấp valid next action. |
| Error / retry | `next-round-or-terminal-result` | Giữ valid context/input, nêu failed owner và cung cấp local retry. |
| Permission / unavailable | `reproducibility-export-recount-and-certification-receipt` | Không ngụ ý hidden evidence là absent; giải thích restriction và safe exit. |
| Pending | `next-round-or-terminal-result` | Ngăn duplicate action, giữ exact target và announce progress mà không chuyển focus. |
| Success | `reproducibility-export-recount-and-certification-receipt` | Xác nhận exact outcome, giữ selection và cung cấp next action hoặc recovery. |
| Stale / conflict | `jurisdiction-contest-rule-and-input-version` | Giữ last safe value, nêu version/time conflict và yêu cầu explicit recovery. |
| Focus transition | `next-round-or-terminal-result` | Chỉ chuyển focus vào required error summary/modal, sau đó trả exact trigger. |
| Responsive presentation | `ranked-choice-audit` | Giữ state, selection, query, pending result và recovery khi topology đổi. |

## Boundaries

### Accept

- Accept khi dominant task là: Tái tạo và audit một ranked-choice contest theo từng round từ versioned cast-vote preferences, áp dụng validity, threshold, transfer, exhaustion và tie rules cho đến khi chứng minh terminal result.
- Accept khi mọi required region và relationship trong graph đều cần để hoàn thành task.
- Accept khi compact giữ task, state và recovery bằng replacement topology thay vì stack desktop boxes.

### Reject

- Reject constrained quota allocation; this is `AR-RCT-90` evidence and must route to an adjacent archetype.
- Reject signed contribution waterfall; this is `AR-RCT-91` evidence and must route to an adjacent archetype.
- Reject case-resolution dossier; this is `AR-RCT-92` evidence and must route to an adjacent archetype.
- Reject generic election dashboard; this is `AR-RCT-93` evidence and must route to an adjacent archetype.

### Boundary verdict

Chỉ trả `accept` khi dominant task, complete graph và compact parity cùng đúng. Khác biệt chỉ ở noun, density, color, component, card count hoặc state là `duplicate-or-variation`.

## Handoff

- **Grammar handoff:** Bind product-specific owners, labels, permitted actions và truthful state meaning vào declared regions.
- **Principles handoff:** Resolve exact grid, measure, gap, alignment, sticky offset, bounded overflow và relationship-driven transition points.
- Không handoff nào được bỏ required region, đổi dominant task hoặc làm yếu interaction parity.

## Non-binding research evidence

### Evidence boundary

External research là advisory evidence, không phải product truth. Nó hỗ trợ synthesis task relationships, adaptive behavior và accessibility obligations; nó không chọn StarCi owners, exact geometry hay cấp quyền copy source interface.

### Sources

| Source | Hỗ trợ | Không chứng minh |
|---|---|---|
| [NIST — Cast Vote Records Common Data Format](https://pages.nist.gov/CastVoteRecords/) | Versioned cast-vote records, contest selections, and interoperable audit input structure. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [U.S. Election Assistance Commission — RCV systems guidance](https://www.eac.gov/sites/default/files/2023-10/RCV%20Voting%20Systems%20V3%20Final%2010.20.23.pdf) | Ranked-choice tabulation, round, transfer, exhaustion, and reporting considerations. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Round/candidate tables, explicit row actions, and bounded numeric comparison. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |
| [W3C WAI — Grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Keyboard-complete navigation for interactive round-by-candidate tabular data. | Không chọn archetype, không định nghĩa product truth và không cấp quyền copy geometry. |

The source set includes at least three independent official organizations and W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "ranked-choice-round-tabulation-audit",
  "situationCodes": [
    "<matched AR-RCT-* codes>"
  ],
  "searchAliases": [
    "ranked choice recount",
    "round transfer audit",
    "cast vote record tabulation"
  ],
  "dominantTask": "Tái tạo và audit một ranked-choice contest theo từng round từ versioned cast-vote preferences, áp dụng validity, threshold, transfer, exhaustion và tie rules cho đến khi chứng minh terminal result.",
  "regions": [
    "ranked-choice-audit",
    "jurisdiction-contest-rule-and-input-version",
    "ballot-style-and-cast-vote-record-set",
    "validity-adjudication-and-preference-normalization",
    "continuing-candidate-set",
    "round-tally-and-threshold-proof",
    "ballot-transfer-exhaustion-and-tie-resolution-ledger",
    "elected-or-eliminated-transition",
    "next-round-or-terminal-result",
    "reproducibility-export-recount-and-certification-receipt"
  ],
  "regionRelationships": [
    "Mỗi round chỉ derive từ continuing-candidate set của round trước và immutable normalized ballot preferences dưới một rule version; mọi transfer, exhaustion, tie decision và receipt đều reproducible."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and drawer response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "ranked-choice-audit -> jurisdiction-contest-rule-and-input-version -> ballot-style-and-cast-vote-record-set -> validity-adjudication-and-preference-normalization -> continuing-candidate-set -> round-tally-and-threshold-proof -> ballot-transfer-exhaustion-and-tie-resolution-ledger -> elected-or-eliminated-transition -> next-round-or-terminal-result -> reproducibility-export-recount-and-certification-receipt",
    "navigationReplacement": "<none, synchronized drawer, or primary-pane sequence>",
    "stickyBehavior": "<reserved space and short-height yield>",
    "overflowOwner": "round-tally-and-threshold-proof",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": [
    "input loading/validated/quarantined",
    "ballot valid/overvoted/exhausted/adjudicated",
    "candidate continuing/elected/eliminated/withdrawn",
    "round queued/calculated/challenged/locked",
    "threshold unmet/met",
    "transfer pending/complete",
    "tie unresolved/rule-resolved",
    "result unofficial/recounted/certified",
    "export reproducible/mismatched"
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
