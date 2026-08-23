# Backend maintainability

## LOADS

None.

## Record

The input is an accepted backend capability whose business behaviour, transport and persistence need
have already been decided. The output is the source shape that keeps that behaviour readable, testable
and changeable after the first implementation: where orchestration ends, where decisions live, which
volatile values are dependencies, which repetition is genuinely one concept, and which complexity must
be split before it becomes an anonymous branch forest.

This module does not set a SonarQube threshold and does not make an analyzer the architect. Static
analysis supplies evidence that a reader is paying too much to understand a file. This pattern decides
the source boundary that removes that cost without changing the accepted behaviour.

## Law

Maintainability is the ability to change one business fact in one place and prove that change without
booting unrelated infrastructure. A short file can fail that law when it hides five decisions in one
expression; a long file can satisfy it when it is a flat catalogue whose entries have one stable shape.
Line count is evidence, never the ruling.

The unit of extraction is a **decision**, not a number of lines. A decision has inputs, an outcome and a
name a business reader can recognise. Orchestration orders decisions and effects; it does not contain
their branch trees. An integration adapter translates one external vocabulary; it does not decide the
domain rule that uses the translated value. A handler owns the operation; it does not become a second
repository, HTTP client, clock and random-number generator merely because all four are available.

Duplication is equally semantic. Two blocks that look alike but change for different reasons remain
separate. Two blocks expressing the same rule through different transports are one decision and must
converge. The question is not “can these lines be shared?” but “must these outcomes change together?”

No quality result may be bought by moving code outside analysis, excluding production files, replacing
branches with opaque metaprogramming, swallowing errors, deleting assertions or labelling a real issue a
false positive. The repaired source must be easier for both a human and the existing tests to follow.

## Situation codes

| Code | Situation | Source shape |
|---|---|---|
| `MAINTAIN-1` | An operation mixes orchestration with a decision tree | The handler reads as a linear sequence; named pure decision functions or focused services own branching |
| `MAINTAIN-2` | One function has several independent reasons to change | Split by business decision or external boundary, never by arbitrary line ranges |
| `MAINTAIN-3` | Repeated code may or may not be one rule | Share only when the inputs, outcome and change reason are the same; keep coincidental similarity separate |
| `MAINTAIN-4` | Time, randomness, environment or network state changes an outcome | Resolve the volatile value through an explicit dependency and pass the resolved fact into the decision |
| `MAINTAIN-5` | Input is normalized or defaulted in several layers | Normalize once at the owning boundary and carry one canonical internal representation |
| `MAINTAIN-6` | A branch is encoded through booleans that permit contradictory states | Replace the boolean bag with a closed discriminated state and exhaustive handling |
| `MAINTAIN-7` | An analyzer reports complexity, duplication or dead code | Trace the issue to the owning decision and repair that boundary; do not perform metric-only surgery |
| `MAINTAIN-8` | A generated, vendored or data-only artifact appears in analysis | Classify by provenance; configure the analysis surface once, without excluding authored production code |

The numbers are stable. A new situation is appended only when none of these questions can express it;
renumbering breaks citations in plans, reviews and repair evidence.

## Reading an accepted shape

1. Name the operation and its externally observable outcomes.
2. Mark every decision: validation, authorization, state transition, price/entitlement calculation,
   routing choice, retry choice and disclosure choice.
3. Mark every effect: database, queue, network, filesystem, clock, randomness and telemetry.
4. Draw the order as `facts → decisions → effects → result`. A cycle means a decision is reading its
   own side effect or an adapter owns domain state.
5. Apply `MAINTAIN-1` and `MAINTAIN-2` before extracting shared helpers. Otherwise extraction merely
   moves the branch forest to a less discoverable file.
6. Apply `MAINTAIN-3` only after both candidate blocks have named inputs and outcomes.
7. Apply `MAINTAIN-4` through `MAINTAIN-6` to make the decision deterministic and its state closed.
8. Use analyzer evidence last. It confirms the reader cost and proves the repair; it never selects a
   business boundary by itself.

## `MAINTAIN-1` — orchestration is linear

An operation handler may coordinate several collaborators, but the happy path must read from top to
bottom: establish preconditions, load state, decide, persist, publish, answer. Nested policy branches,
provider-specific switches and calculations move behind names that state the fact they decide.

The extracted unit receives facts and returns a value or a named decision. It does not reach back into
the handler, fetch another row or emit telemetry on its own. If it needs infrastructure, it is an
orchestration collaborator rather than a pure decision, and its name must say which boundary it owns.

Do not “fix” complexity by reversing every condition, adding early returns until the story is scattered,
or replacing branches with a lookup whose values are anonymous closures. Early refusal is useful when it
names a precondition; it is not a substitute for identifying the decisions.

## `MAINTAIN-2` — split by reason to change

A function has more than one reason to change when, for example, payment policy, email formatting and
provider retry behaviour can each change independently. Those are three owners even if the current
implementation is forty lines. Conversely, a two-hundred-line declarative mapping may have one reason to
change and should not be shattered into one function per row.

The emitted boundary follows the existing module family. A domain calculation stays near the operation
or domain module; provider translation stays under the integration adapter; persistence query shape stays
with data access. A generic `utils` or `helpers` folder is not a boundary—it is where ownership was lost.

## `MAINTAIN-3` — duplication follows semantics

Before sharing two blocks, write four facts for each: input, output, failure, reason to change. They are
one abstraction only when all four align. Similar DTO mapping for two independent providers usually stays
separate; two controllers calculating the same entitlement must converge even if their syntax differs.

The shared unit is named for the rule, not for the callers (`calculateRefundEligibility`, not
`commonPaymentHelper`). Callers keep their transport mapping and pass canonical facts into the rule.
Tests move with the rule, while each caller retains one contract test proving its mapping.

## `MAINTAIN-4` — volatile facts are dependencies

`Date.now()`, random ids, process environment, hostnames and live network answers make a decision vary
without its arguments changing. Resolve them at the boundary through a clock, id generator, configuration
object or integration client. Pass the resulting fact into the decision.

This is not permission to wrap every global in an interface. Extract only a volatile fact that affects an
outcome. A logger timestamp is observability mechanics; an invoice deadline is business input. The latter
must be controlled by a test, the former need not be.

## `MAINTAIN-5` — normalize once

Choose the boundary that first owns untrusted representation: DTO/parser for syntax, adapter for provider
vocabulary, domain constructor for invariant-bearing value. Trim, case-fold, default or convert there,
then carry one representation inward. Re-normalizing in handler, repository and publisher lets the same
input mean three things and makes every test choose which layer to believe.

Defaults that alter business meaning are decisions and must be named. A missing page size becoming `20`
is transport normalization; a missing payment deadline becoming “tomorrow” is a domain policy using a
clock and belongs to `MAINTAIN-4` as well.

## `MAINTAIN-6` — state is closed

Several booleans describing one lifecycle create impossible combinations: `paid && cancelled`,
`running && suspended`, `verified && pending`. Emit a discriminated union or enum-backed state and make
the transition exhaustive. Additional orthogonal facts may remain fields, but a field is orthogonal only
when every state can legitimately combine with either value.

An exhaustive switch is allowed to be visually repetitive when every arm represents a different business
state. Share the mechanics inside arms, not the states themselves. A default arm that silently treats a
future state as an old one defeats the closed representation.

## `MAINTAIN-7` — analyzer evidence is traced, not obeyed blindly

For each issue, record file, rule, affected decision and proposed owner. Complexity normally routes to
`MAINTAIN-1` or `MAINTAIN-2`; duplication to `MAINTAIN-3`; unstable tests or hidden globals to
`MAINTAIN-4`; repeated coercion to `MAINTAIN-5`; contradictory conditions to `MAINTAIN-6`.

A false-positive decision requires source evidence explaining why the reported construct cannot be
changed without making the code less truthful. “The gate is annoying”, “legacy” and “quality gate must
pass” are not evidence. A confirmed false positive is marked in the analyzer only after the source and
tests prove the intended shape.

## `MAINTAIN-8` — analysis surface follows provenance

Authored production code is always in the quality and coverage surface. Tests are test code; generated
clients, compiled output, vendored source and data payloads are classified once by deterministic path or
generation manifest. An artifact is not generated because it is hard to test, and a large constant is not
vendored because it creates duplication.

Coverage and quality exclusions are separate. A generated client may be excluded from authored-code
smells yet still require a contract test at the adapter. Test files may be absent from production coverage
while remaining analyzed as tests. The configuration documents provenance, never a desired percentage.

## Layer held

| Code | Tier | Evidence |
|---|---|---|
| `MAINTAIN-1` | analyzed + reviewed | Cognitive-complexity evidence plus handler story review |
| `MAINTAIN-2` | reviewed | File/function ownership and independent change reasons |
| `MAINTAIN-3` | analyzed + reviewed | Duplication report plus semantic four-fact comparison |
| `MAINTAIN-4` | tested + reviewed | Deterministic tests control the volatile fact |
| `MAINTAIN-5` | reviewed | One normalization boundary and canonical internal type |
| `MAINTAIN-6` | type-held + tested | Closed union/enum and exhaustive transition tests |
| `MAINTAIN-7` | externally enforced | Sonar issue state and waited quality gate |
| `MAINTAIN-8` | configuration-held | Declared source/test/generated provenance and LCOV surface |

No row is held by a metric alone. Analyzer evidence without a source boundary is a symptom report;
source refactoring without proof is an unmeasured rewrite.

## Inputs

| Input | Evidence required |
|---|---|
| operation | Accepted operation and observable outcomes |
| decisions | Branches that choose a business result |
| effects | Database, network, queue, filesystem, time, randomness and telemetry |
| state | Valid lifecycle states and transitions |
| repetition | Input/output/failure/change-reason comparison for each candidate block |
| analysis | Exact rule, file and current issue state |
| provenance | Authored, test, generated, vendored, compiled or data-only |

## Rules

1. Extract decisions, not line ranges.
2. Keep orchestration linear and effects visible.
3. Split by reason to change, not by a universal size limit.
4. Share semantic rules; preserve coincidental similarity.
5. Make outcome-affecting time, randomness, environment and network answers explicit dependencies.
6. Normalize an external representation once at its owning boundary.
7. Represent one lifecycle with a closed state, not contradictory booleans.
8. Trace analyzer findings to source ownership before changing code.
9. Never exclude authored production code to improve a metric.
10. Prove the same accepted behaviour after the repair.

## Exceptions

- A declarative catalogue may be long when entries are uniform and one owner changes them together.
- A small duplication may remain when the callers have different failures or release cadence.
- Framework-generated decorator branches are handled at the project analysis threshold only after their
  measured cause is proven; they do not authorize per-file ignores.
- Provider adapters may intentionally mirror provider vocabulary at the edge; canonical domain terms
  begin after translation.
- Performance-driven denormalization is allowed only with a benchmark, consistency owner and repair path.

## Stops

- The accepted behaviour is not known well enough to prove preservation.
- Extraction would cross a capability boundary not present in the approved file plan.
- A proposed green result requires an exclusion, suppression, skipped test or lower gate.
- Two repeated blocks cannot be shown to share the same change reason.
- Analyzer authority is unavailable and the requested result specifically requires external issue state.

## Proof

Run the original tests and source gates, then the exact analyzer gate. Review the diff as a story: the
handler is linear, decisions are named, volatile facts are controllable, state is exhaustive, and no
authored source left the analysis surface. Report before/after complexity or duplication only alongside
the changed ownership boundary.

## Output

```text
operation: <accepted capability>
situations: <MAINTAIN-1 ... MAINTAIN-8>
orchestration: <file and linear sequence>
decisions: <named units and inputs/outcomes>
effects: <explicit boundary collaborators>
state: <closed representation and transitions>
analysis: <issue/rule and source owner>
files: <exact paths>
proof: <tests, source gates and waited analysis>
```
