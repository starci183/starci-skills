# Precedents

## LOADS

None.

## Record

You are given one accepted region and the block anatomies already accepted for this source, and you
return, for each block candidate you are about to generate, either a precedent it cites or a statement
that it deliberately departs from every precedent. A precedent is a decision that was accepted before,
kept with its reason. It is **cited, followed and overruled** — never obeyed. A law binds; a precedent
persuades.

A block precedent carries what a layout precedent does not: how many times the block rests, which
states it draws, and who owns its data. Those three are the facts a block is wrong about most often, so
they are the facts a precedent is indexed with.

## Law

A precedent records a decision **and what it beat**. The accepted anatomy alone teaches what to copy;
only the rejected ones teach what to avoid.

A precedent is scoped to one source. Each frontend has its own contract entries, its own leaves and its
own data, so a precedent from another product is a stranger's decision wearing this tree's authority.

## Situation codes

| Code | Situation | What it emits |
|---|---|---|
| `PRECEDENT-0` | No accepted anatomy covers this region | generate from laws; record that no precedent applied |
| `PRECEDENT-1` | A precedent matches on business reason and state set | cite it; reuse its parts, repeats and cited entries |
| `PRECEDENT-2` | The reason matches; the state set or the repeat count differs | cite it, then name what changed and why |
| `PRECEDENT-3` | A precedent cites an entry, leaf or composite since renamed | migrate the citation, or mark the precedent stale |
| `PRECEDENT-4` | The candidate departs from every precedent on purpose | record the departure as the candidate's own reason |
| `PRECEDENT-5` | A precedent is wrong, not merely old | overrule it in writing, and record what replaced it |

## Reading the precedent corpus

1. **Match on the business reason and the state set together.** Two blocks that draw the same parts but
   enumerate different states are not the same case — a block that can be empty is a different decision
   from one that cannot.
2. **Check every citation.** A precedent naming a contract key, a leaf or a composite is usable only if
   that name still exists — `PRECEDENT-3`.
3. **Read what was rejected**, so an anatomy this source already refused is not proposed again.
4. **Guarantee one departure.** At least one candidate in the batch must not follow the nearest
   precedent — `PRECEDENT-4`.
5. **Never let a precedent silence a law.** A precedent whose anatomy skips a state a law requires is a
   defect to record, not a shape to copy — `PRECEDENT-5`.

## `PRECEDENT-0` — nothing covers this region

**Situation.** No accepted anatomy answers this region's business reason.

**Recognition signs**

- No precedent shares the region's outcome or its subject.
- The nearest match resembles it only in part count.

**Ask yourself.** Am I citing because it fits, or because it is the closest thing present?

**Boundary**

- `PRECEDENT-2`: a partial match still shares the reason. Sharing only a part count is no match.

**How it fails.** The nearest anatomy is inherited whole, including a repeat count nobody chose for this
region.

## `PRECEDENT-1` — the reason and the state set both match

**Situation.** An accepted anatomy already answered this reason for this source, with the same states.

**Recognition signs**

- The recorded reason reads as the answer to this region.
- The state set is the same: the same conditions can occur.
- Every cited entry, leaf and composite still exists.

**Ask yourself.** Can I state the shared reason in one sentence without naming a component?

**Boundary**

- `PRECEDENT-2`: if the states or the resting count differ, this code is not reached.

**How it fails.** The anatomy is copied down to details this region never asked for, and it inherits
decisions nobody made for it.

## `PRECEDENT-2` — the state set or the repeat count differs

**Situation.** The reason matches, but this region can be empty when the precedent could not, can fail
where the precedent could not, or rests at a different count.

**Recognition signs**

- One state exists here that the precedent never drew, or the reverse.
- The resting count is stated by the region and differs.

**Ask yourself.** Does the region state this state, or am I assuming it because the data might be
missing?

**Boundary**

- `PRECEDENT-1`: identical states and count.
- `PRECEDENT-0`: if the reason itself differs, the precedent is not the case being decided.

**How it fails.** A new state is added silently, so a reviewer cannot see which part of the precedent
was kept and which was overridden.

## `PRECEDENT-3` — a citation has gone stale

**Situation.** The precedent is sound but names an entry, leaf or composite that has since been
generalised or renamed.

**Recognition signs**

- A cited name is absent from the current contract or component tree.
- A wider name now covers the same reason.

**Ask yourself.** Was it renamed, or removed? Those have different repairs.

**Boundary**

- `PRECEDENT-5`: staleness is a citation problem, not a wrong decision.

**How it fails.** The citation is copied as written, so the candidate names a component that no longer
exists — the invention the corpus exists to prevent.

## `PRECEDENT-4` — a deliberate departure

**Situation.** The candidate does not follow the nearest precedent, so the batch offers a genuinely
different anatomy: different parts, a different owner for the data, or a different state carrying the
weight.

**Recognition signs**

- Its parts or its data ownership differ from the nearest precedent.
- Its reason is stated on its own terms.

**Ask yourself.** Would this candidate be worth reading if the precedent did not exist?

**Boundary**

- `PRECEDENT-5`: departing says this region deserves something else; overruling says the precedent is
  wrong.

**How it fails.** Every candidate cites the nearest precedent and the owner is shown one anatomy three
times.

## `PRECEDENT-5` — the precedent is wrong

**Situation.** The precedent breaks a block law — a state it never enumerated, a field it invented, a
frame it did not own — or its reason turned out false about the product.

**Recognition signs**

- Following it produces a candidate a law rejects.
- Its recorded reason is contradicted by how the block is actually used.

**Ask yourself.** Is it merely old, or was it never right?

**Boundary**

- `PRECEDENT-3`: a stale citation is repaired; a wrong precedent is overruled and kept, so the record
  shows the reversal.

**How it fails.** It is quietly skipped instead of overruled, so the next run cites it again and the
same defect returns.

## Inputs

| Input | Evidence required | Read from |
|---|---|---|
| region | The accepted region and its business reason | the owner |
| corpus | Accepted anatomies for THIS project — see the record shape below | beside the project's own repository |
| contract | Entry **key**, `why`, `host`, children **names**, `repeats` and `optional` — never the class arrays | `context.contract` of the resolved role |
| vocabulary | The leaf names the contract cites (47), the composite names (26), and the blocks that exist (10) | `repository.diskPath` of the resolved role |
| axes | The closed set of anatomy axes, listed below | this module |
| laws | The block laws, which outrank any precedent | this tree |

**"This project" is the project the workspace route declared** — the `project` and `role` in
`.workspace/<project>/<role>/config.json`, never a folder name, never the last session's. Everything in
the third column is read live from the checkout that route resolves, because each frontend has its own
contract, its own components and its own history. Two consequences follow, and both are the reason this
column exists:

- **A stale route poisons every input here.** If the checkout moved or the contract path was renamed,
  the corpus is checked against a contract that is not the product's, and every citation verdict is
  confidently wrong. The route is verified before any of this is read; an unverified route stops the run
  rather than producing a precedent verdict.
- **The corpus is scoped to that project, not to this tree.** Precedents live beside the repository they
  were accepted for. A precedent from another product read into this project is a stranger's decision
  wearing this tree's authority — the counts, the names and the reasons all belong to a different
  contract.

A corpus record holds seven fields, and the fifth is the one that earns the corpus its keep:

```text
region: <the accepted region and its reason>
axes: <the axis values of the accepted anatomy>
states: <every condition it draws>
chosen: <hash + JSON>
rejected: <the other 2-3 anatomies, one sentence each on why it lost>
cited-names: <entry keys, leaves and composites it cited>
contract-at: <the contract state it was accepted against>
```

**The contract is read without its class arrays**, but `repeats` and `optional` ARE read here: a block
precedent is indexed by its state set, and `optional` is the contract's only statement about presence.
It is not, however, a statement about *which* absence — pending, failed and empty all reach the same
`optional`, so separating them is read from the page and block source, never assumed from the registry.

Unlike the layout stage, this stage reads the **leaf and composite vocabulary**: a block is the tier
allowed to cite them, and a precedent whose citation cannot be checked against that vocabulary is a
precedent that teaches an invented name.

**Axes** are the closed set an anatomy may differ on:

| Axis | Values |
|---|---|
| data owner | the block fetches it / the parent passes it in |
| repetition | one instance / repeats with a resting count |
| weight | the populated state carries the block / an absent state carries it |
| composition | one part / label with value / label with visual and caption |

Two anatomies whose whole axis set matches are one anatomy, whatever their precedents say.

## Rules

1. A precedent is scoped to one source and never carried across products.
2. A precedent records the rejected anatomies and one sentence each on why they lost.
3. Precedents are indexed by business reason **and** state set. Parts alone are not an index.
4. Every citation is checked against the current contract and component tree before use.
5. At least one candidate in a batch does not follow the nearest precedent.
6. A law outranks a precedent. A precedent that breaks a law is overruled, never followed.
7. Overruling is written down. A precedent is superseded, not deleted.
8. A precedent is not a candidate. It is evidence for one.

## Exceptions

- **The first case.** With an empty corpus, `PRECEDENT-0` is the whole answer and no departure is owed.
- **A one-off block.** A block the product will have exactly once is recorded and marked non-general, so
  it reads as history without inviting reuse.
- **A precedent for a region that no longer exists.** Kept, marked retired; its rejections still teach.

## Output

One block per candidate in the batch:

```text
candidate: <id in this batch>
situation: <PRECEDENT-0 | PRECEDENT-1 | PRECEDENT-2 | PRECEDENT-3 | PRECEDENT-4 | PRECEDENT-5>
cites: <precedent id, or none>
shared-reason: <the business reason both answer, or why none applies>
state-delta: <states or resting count that differ from the cited precedent>
citation-check: <entries, leaves and composites verified against the source>
reason: <why this candidate is worth the owner's attention>
```
