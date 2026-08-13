# design implementation

## Definition

Design implementation turns the selected contract graph into code without reopening settled design
or bypassing ownership for speed. It advances in vertical slices so real data, state and rendering
can disprove the plan early.

The deciding question: **is each code change the direct implementation of an evidence-backed node in
the selected graph?**

## Rules

**IMPLEMENTATION-1 · Build a thin complete slice before broad repetition.**

Implement one representative block from connected data through pure rendering, loading, empty,
failed and action behavior. Verify it before porting the pattern across the page; repetition makes a
wrong assumption expensive.

**IMPLEMENTATION-2 · Add vocabulary before its call sites.**

When selection approved a new contract or component tier, implement and test that owner first. Page
code may consume approved vocabulary but may not prototype structural exceptions inline.

**IMPLEMENTATION-3 · Keep connected and pure halves explicit.**

The connected half resolves requests, translations, stores and product situations. `_X` receives
resolved copy, discriminated state, inert props and actions, making every visual branch mountable in
isolation.

**IMPLEMENTATION-4 · Implement resting as the same shape.**

Each leaf or composite draws the geometry it will occupy. Repeated contracts use their declared
resting count. Labels, facts and controls skeletonize only when their real counterparts do; static
copy and known outcomes remain visible.

**IMPLEMENTATION-5 · Use realistic data without inventing production truth.**

Seeded development data may exercise populated states and visual density. Keep it in the backend or
fixture boundary appropriate to the project, identify it as seed data and preserve honest empty and
failed states.

**IMPLEMENTATION-6 · Stop when implementation disproves the graph.**

If real copy, data cardinality, responsive behavior or state ownership contradicts the selected
direction, return to the brief or graph. Do not patch the contradiction with local classes or
conditional wrappers.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| Refactor dozens of call sites before verifying one slice | A mistaken pattern spreads before the browser can challenge it | Prove one representative slice first |
| Add raw layout in a page or block to finish quickly | It creates a second structural owner | Add or reuse the proper contract/branch |
| Resolve translations or requests in `_X` | The pure half can no longer be tested as a state renderer | Resolve them in the connected half |
| Draw a generic skeleton unrelated to final content | The layout shifts and hides missing state design | Rest the exact final shape |
| Patch a contract mismatch at the caller | The executable grammar becomes untrue | Correct or add the contract |

## Examples

### A vertical slice

```
query → connected block state → pure block → approved branch/contract → leaf resting shape → browser state test
```

```
build all page markup with fixture data, then connect and type it later
```

They differ in one thing: whether product truth can challenge the design early.

