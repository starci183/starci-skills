# design research

## Definition

Design research is the compact evidence packet that prevents an AI from filling unknowns with
plausible-looking UI. It joins the user's words, real product data, existing behavior, contract
inventory and relevant prior art before any direction is drawn.

Use [`best-belief-source.md`](best-belief-source.md) to decide which source may settle each claim.
Research gathers evidence; best-belief selection prevents evidence from speaking outside its scope.

The deciding question: **can every important region and action be traced to a user need, product
fact, state or reference?**

## Rules

**RESEARCH-1 · Read evidence in scoped authority order.**

Start with the current user instruction, then select the best source for the claim kind: named
reference for migration parity, backend behavior for business truth, repository canon and the
executable registry for UI grammar, component source for reuse, vendor documentation for mechanics
and external prior art for possibilities. One source may explain another but cannot decide outside
its own authority.

**RESEARCH-2 · Inspect the product before searching for inspiration.**

Inventory existing pages, blocks, branches, composites, leaves, shells and contract keys. Read the
queries and state branches that feed the page. External examples are useful only after the actual
problem and available grammar are known.

**RESEARCH-3 · Record claims, not piles of links.**

For each piece of evidence, write the observed fact, its source and the decision it constrains. A
source without a claim is browsing history; a claim without a source is invention.

**RESEARCH-4 · Distinguish product data from design fixtures.**

Real API fields and seeded development data may justify a region. A proposed fixture may test a
shape, but must be labelled as a fixture and must not be presented as a capability the backend
already supports.

**RESEARCH-5 · Research the complete state matrix.**

Ready, first-load, empty, failed, pending action, partial data, signed-out and relevant responsive
states can change the tree or its content. Researching only the populated desktop view designs only
the easiest branch.

**RESEARCH-6 · Prove the consequence of every visible interaction.**

A visible interaction is not proved by its control or selected paint. For every interaction in the
selected journey, trace the trigger to its product owner, request or route, visual states, pending
behavior, success consequence, failure consequence and persistence or shared-surface effect. `N/A`
is a claim and requires evidence.

Record the result under `### INTERACTION CONSEQUENCE`:

| Interaction | Trigger | Product owner | Request / route | Visual states | Pending | Success | Failure | Persistence / shared effect | Evidence |
|---|---|---|---|---|---|---|---|---|---|

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| Search visual galleries before understanding the product | Familiar patterns will replace the actual job | Inspect product truth and grammar first |
| Copy a competitor's composition directly | Their data, constraints and CTA are different | Extract the principle and re-derive the composition |
| Invent a statistic to make a mockup convincing | It turns visual confidence into a product lie | Use a labelled fixture or honest empty state |
| Record a source without the fact learned from it | The evidence cannot constrain a decision | Write claim, source and consequence together |
| Research only the happy path | Loading and failure will later force unplanned trees | Build the state matrix before concepts |
| Treat a painted control as completed behavior | Selection chrome can exist while request, navigation, failure or persistence is absent | Trace and prove the complete interaction consequence |

## Examples

### An evidence packet

```
fact: daily quests settle independently from weekly goals
source: separate query hooks and block state branches
consequence: they remain separate blocks and loading units
```

```
fact: dashboards usually use cards
source: three inspiration screenshots
consequence: wrap every dashboard item in a card
```

They differ in one thing: whether the evidence belongs to this product.
