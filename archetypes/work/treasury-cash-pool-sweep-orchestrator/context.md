# Treasury cash pool sweep orchestrator

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `treasury-cash-pool-sweep-orchestrator` |
| Family | Work |
| Dominant task | Move a group of bank accounts toward declared target balances through a directed physical cash-pool hierarchy, honoring sweep precedence, cutoffs, currency conversions, intercompany-loan evidence, and bank acknowledgements. |
| Search aliases | physical cash pool, target balance sweep, account graph orchestration |
| Authority | Product-neutral page-topology authority; it does not choose product semantics, visual direction, tokens, components, exact geometry, or breakpoints. |

### Invariants

- `cash-pool-sweep` owns the complete dominant task and recovery boundary.
- Every sweep traverses an authorized directed edge, mutates both endpoint projections, creates loan and FX consequences before dependent edges, and is finalized only by bank acknowledgement.
- Every required region retains its named owner.
- Wide, intermediate, and compact change topology when a named relationship fails, never by device label.
- Transformation preserves selection, draft input, pending work, recovery, reading order, and focus meaning.

## Recognition

### Situation codes

| Code | Observable situation | Consequence |
|---|---|---|
| `AR-TCS-01` | Move a group of bank accounts toward declared target balances through a directed physical cash-pool hierarchy, honoring sweep precedence, cutoffs, currency conversions, intercompany-loan evidence, and bank acknowledgements. | Required positive evidence. |
| `AR-TCS-02` | Every required region and relationship is necessary for completion. | Require the complete graph. |
| `AR-TCS-03` | The named wide, intermediate, and compact transformations preserve the same work state. | Require responsive parity. |
| `AR-TCS-04` | Failure, pending, conflict, permission, or recovery can occur after state exists. | Retain state and focus meaning. |
| `AR-TCS-90` | An adjacent archetype owns the work object or completion event more precisely. | Reject. |
| `AR-TCS-91` | Reject multicurrency-netting-settlement-workbench, dual-list-transfer, capacity-allocation-overview, or generic payment queues when directed node/edge authority, target bands, dependent sweeps, two-endpoint mutations, intercompany consequences, and bank acknowledgements are absent. | Reject. |
| `AR-TCS-92` | The candidate differs only by noun, density, color, component, card count, or state variation. | Reject as `duplicate-or-variation`. |

### Selection rule

Select `treasury-cash-pool-sweep-orchestrator` if and only if `AR-TCS-01` through `04` are evidenced, all required regions and relationships are present, and none of `AR-TCS-90` through `92` is present. Return `needs-evidence` when dominant task, owner relationship, overflow owner, or completion consequence is unproved. Return `reject` when a rejection code is present.

## Region graph

```text
cash-pool-sweep
  ├─ entity-bank-business-date-policy-and-cutoff-version
  ├─ bank-account-node-graph
  ├─ observed-and-projected-node-balances
  ├─ target-minimum-maximum-and-trapped-cash-constraints
  ├─ directed-zero-balance-target-balance-and-concentration-edges
  ├─ precedence-ordered-sweep-and-fx-plan
  ├─ intercompany-loan-principal-interest-and-limit-ledger
  ├─ bank-instruction-acknowledgement-and-reject-stream
  └─ achieved-targets-residuals-and-close-receipt
```

Every sweep traverses an authorized directed edge, mutates both endpoint projections, creates loan and FX consequences before dependent edges, and is finalized only by bank acknowledgement.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `cash-pool-sweep` | Owns the complete account-graph feasibility, sweep, acknowledgement, and close task. |
| `entity-bank-business-date-policy-and-cutoff-version` | Binds the graph to entity, bank, business date, policy, and cutoff version. |
| `bank-account-node-graph` | Owns account nodes and directed authorized connectivity. |
| `observed-and-projected-node-balances` | Owns current and projected balance evidence per node. |
| `target-minimum-maximum-and-trapped-cash-constraints` | Owns per-node target bands and feasibility constraints. |
| `directed-zero-balance-target-balance-and-concentration-edges` | Owns authorized movement edges and edge type. |
| `precedence-ordered-sweep-and-fx-plan` | Orders dependent sweeps and any required FX effect. |
| `intercompany-loan-principal-interest-and-limit-ledger` | Records both-endpoint intercompany consequences before downstream movement. |
| `bank-instruction-acknowledgement-and-reject-stream` | Owns instruction, acknowledgement, rejection, and reroute evidence. |
| `achieved-targets-residuals-and-close-receipt` | Proves achieved targets, accepted residuals, and close state for the whole graph. |

## Responsive contract

### Wide

- **Failure trigger:** Simultaneous comparison no longer leaves enough measure for profiles, evidence, controls, and unobscured focus.
- **Topology response:** Account graph, target deltas, ordered edges, FX effect, loan ledger, bank acknowledgement stream, and whole-pool receipt remain visible together.
- **Navigation replacement:** None while direct region access remains operable.
- **Sticky boundary:** Only current scope or the primary receipt may persist after reserving space.
- **Overflow owner:** One intrinsically tabular or graph region may own bounded overflow; the page owns no horizontal overflow.

### Intermediate

- **Failure trigger:** The lowest-priority supporting region can no longer coexist without compressing the dominant relationship.
- **Topology response:** Critical residuals and the active sweep edge remain primary; full hierarchy, account evidence, and closed-day history move to synchronized drawers.
- **Navigation replacement:** A labeled contextual drawer opens the exact supporting region and preserves selection, draft, scroll, and return-focus target.
- **Sticky boundary:** Only current scope or the primary receipt may persist; short height returns it to normal flow.
- **Overflow owner:** The same bounded evidence region remains the sole overflow owner.

### Compact

- **Failure trigger:** Peer regions can no longer remain simultaneously readable and operable.
- **Topology response:** Cutoff and pool → breached node → authorized upstream/downstream edge → both endpoint and loan/FX preview → instruct → acknowledge or reject → recalculate graph; the network becomes a node-and-edge route with a persistent feasibility receipt.
- **Navigation replacement:** A labeled stage navigator exposes one primary pane at a time and returns focus to the entered stage heading.
- **Sticky boundary:** The relationship receipt may persist only with reserved space and yields at short height.
- **Overflow owner:** A numeric table becomes a labeled route or remains one bounded navigator; the page never scrolls horizontally.

### Reflow

- DOM order, reading order, and meaningful focus order follow `cash-pool-sweep → entity-bank-business-date-policy-and-cutoff-version → bank-account-node-graph → observed-and-projected-node-balances → target-minimum-maximum-and-trapped-cash-constraints → directed-zero-balance-target-balance-and-concentration-edges → precedence-ordered-sweep-and-fx-plan → intercompany-loan-principal-interest-and-limit-ledger → bank-instruction-acknowledgement-and-reject-stream → achieved-targets-residuals-and-close-receipt`.
- CSS never reorders semantic content.
- Long labels, translation, enlarged text, and zoom wrap without losing actions or state.
- A modal drawer focuses its heading, contains modal focus, supports Escape and Cancel, and returns to the exact trigger.

### Interaction parity

- Pointer, keyboard, and assistive technology reach every core action.
- Drag or gesture has an add, remove, or ordered-list alternative.
- A topology change retains selection, completed steps, pending guards, errors, and recovery.
- Dynamic status uses text and semantics in addition to color and announces without stealing focus.
- Multi-error validation retains input and moves focus to a summary.
- Task parity includes balance observed/projected/stale; account active/blocked/trapped; target inside/breached/unreachable; edge authorized/conditional/disabled; cutoff open/near/closed; sweep proposed/instructed/acknowledged/rejected; FX current/stale; loan capacity available/exceeded; pool feasible/partially feasible/infeasible; residual accepted/escalated; day open/closed/reopened.

## State obligations

Task-specific states: balance observed/projected/stale; account active/blocked/trapped; target inside/breached/unreachable; edge authorized/conditional/disabled; cutoff open/near/closed; sweep proposed/instructed/acknowledged/rejected; FX current/stale; loan capacity available/exceeded; pool feasible/partially feasible/infeasible; residual accepted/escalated; day open/closed/reopened.

| State family | Required behavior |
|---|---|
| Initial / loading | Name the loading scope, reserve the primary region, and block only the failed region. |
| Ready | Expose the current object, owner relationship, evidence state, and valid actions in text. |
| Empty / not-applicable | Distinguish true empty, no-match, excluded, and non-applicable states with a next action. |
| Error / retry | Name the failed scope, retain input and work state, and provide a focused retry or correction target. |
| Permission / unavailable | Explain the restriction; read-only differs from disabled and retains context. |
| Pending | Prevent duplicate action, retain context, allow safe cancellation, and announce progress. |
| Success | Confirm the exact changed scope and update dependent receipts. |
| Stale / conflict | Compare versions, never overwrite silently, and retain deterministic recovery. |
| Focus transition | User-triggered stage changes focus the new heading; status-only updates do not move focus; modal close returns to the trigger. |
| Responsive presentation | Wide retains simultaneity; intermediate makes lower-priority support temporary; compact uses one primary stage with parity. |

## Boundaries

### Accept

- Model a directed multilevel account graph, resolve breached and trapped nodes through authorized precedence, preview both endpoints and loan/FX effects, process bank responses, and close with explicit residuals.
- Accept a variation only when dominant task, required regions, relationships, transformations, and completion event remain unchanged.

### Reject

- Reject multicurrency-netting-settlement-workbench, dual-list-transfer, capacity-allocation-overview, or generic payment queues when directed node/edge authority, target bands, dependent sweeps, two-endpoint mutations, intercompany consequences, and bank acknowledgements are absent.
- Reject when an adjacent archetype owns the work object or completion event more precisely.

### Boundary verdict

Return `accept` only when the selection rule passes. Return `reject` for `AR-TCS-90`, `91`, or `92`. Return `needs-evidence` when business truth does not prove dominant task, owner relationship, overflow owner, or completion consequence.

## Handoff

1. Business truth supplies actors, objects, rules, permissions, state transitions, and completion consequences.
2. This archetype resolves dominant task, region graph, responsive replacement, semantic order, and parity.
3. Grammar binds product-semantic owners without changing topology.
4. Principles resolve exact grid, measure, gap, size, alignment, overflow, and content-fit breakpoints.
5. Direction expresses visual character inside accepted owners.

## Non-binding research evidence

### Evidence boundary

Research is advisory evidence, not product truth. It does not authorize copying geometry, component trees, product nouns, breakpoints, or visual treatment. Binding product claims still route through business truth, Grammar, and Principles.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [OECD financial-transactions transfer-pricing guidance](https://www.oecd.org/en/publications/transfer-pricing-guidance-on-financial-transactions-inclusive-framework-on-beps-actions-4-8-10_794bcddd-en.html) | Cash-pooling and intercompany financial-transaction evidence. | Does not prove product truth, exact geometry, breakpoints, components, or visual treatment. |
| [CPMI-IOSCO Principles for Financial Market Infrastructures](https://www.bis.org/cpmi/publ/d101a.htm) | Operational-risk, settlement, and acknowledgement context. | Does not prove product truth, exact geometry, breakpoints, components, or visual treatment. |
| [W3C Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Meaningful order through node, edge, instruction, and recovery stages. | Does not prove product truth, exact geometry, breakpoints, components, or visual treatment. |
| [W3C Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Announcements for bank acknowledgement and residual recalculation. | Does not prove product truth, exact geometry, breakpoints, components, or visual treatment. |

## Output

| Field | Contract |
|---|---|
| `archetypeId` | Fixed value `treasury-cash-pool-sweep-orchestrator`. |
| `situationCodes` | Matched codes from this record. |
| `searchAliases` | Routed aliases that led to the match. |
| `dominantTask` | One product-neutral task sentence. |
| `regions` | Ordered required region IDs. |
| `regionRelationships` | Owner, peer, supporting, temporary, and downstream relationships. |
| `responsive` | `wide`, `intermediate`, `compact`, `reflow`, `readingOrder`, `navigationReplacement`, `stickyBehavior`, `overflowOwner`, `interactionParity`. |
| `stateObligations` | Applicable task-specific and common state families. |
| `boundaryVerdict` | `accept`, `reject`, or `needs-evidence`, with reason. |
| `grammarHandoff` | Product-semantic region and state owners left to Grammar. |
| `principlesHandoff` | Exact geometry and fit thresholds left to Principles. |
| `confidence` | `high`, `medium`, or `low`, with evidence completeness. |
| `evidence` | Business, current-source, and research evidence classes without invented facts. |

```json
{"archetypeId":"treasury-cash-pool-sweep-orchestrator","situationCodes":[],"searchAliases":[],"dominantTask":"","regions":[],"regionRelationships":[],"responsive":{"wide":"","intermediate":"","compact":"","reflow":"","readingOrder":"","navigationReplacement":"","stickyBehavior":"","overflowOwner":"","interactionParity":""},"stateObligations":[],"boundaryVerdict":"needs-evidence","grammarHandoff":[],"principlesHandoff":[],"confidence":"low","evidence":[]}
```

