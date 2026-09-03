# Updating this tree

Read this before editing anything under `knowledge/`, `operators/`, `templates/`, `workflows/`,
`scripts/` or `resources/`. It is the standard the tree is maintained by, not a description of what
the tree currently says.

A skills tree of this shape is a set of stable addresses. Rules carry ids that other files, receipts
and validators point at; operators carry step tables that scripts read; templates carry contracts
that every authored document is checked against. What makes such a tree usable after a year is not
how much it says but how few places each thing is said in. Every edit below is judged by one
measure: **places per concept**. A change that answers a question already answered somewhere else has
made the tree larger and worse, whatever it added.

## The four questions, in order

Before writing anything, answer these in order and stop at the first that applies.

**1. Is the thing already forbidden?**
If an existing rule already says no and the violation happened anyway, this is an enforcement gap,
not a knowledge gap. The fix is a script, a validator, an operator step or a stop code — something
that would have refused the work. Adding a rule that repeats a rule the tree already publishes leaves
the hole open and adds a second place to maintain. Zero findings from a gate while the work was
plainly wrong is the signature of this case.

**2. Does the concept have no home at all?**
Then one rule, in the file whose reader binds it, stating a shape. A rule says what must be true of
any instance; it never shows a worked example from the product the tree happens to be installed in.
Append the next ordinal of that topic's prefix.

**3. Is an existing rule wrong, or narrower than the truth?**
Change that rule's Case and keep its id. A sibling rule created because the original was slightly off
is the most common way a tree grows a second home. Widening a Case, replacing its `When`, or adding a
Case to the same rule are all preferable to a new id.

**4. Is the concept already in two places?**
Fold. Choose one home — the file whose reader binds the concept — and reduce every other place to a
citation of that rule's id. A citation is a link and an identifier, never a paraphrase; a paraphrase
is a second home wearing a reference's clothes.

## What may be added, and what may not

May be added:

- **A concept** with no home, as one rule stating a shape.
- **A gate**: a validator, a sweep, a schema constraint or a stop code that makes an existing rule
  refusable.
- **An operator step**, when an existing operator must now read or emit something.
- **An evidence note** under `tests/evidence/`, recording the occurrences that justified a rule.

May not be added:

- **A code example from a product.** A rule states a shape: a relationship, a constraint, a
  condition. Concrete component names, file paths, line numbers, commit shas and counts belong to
  evidence, not to law.
- **Anything specific.** The tree is installed by teams that do not share the history that produced
  it, and a rule speaks in roles — the bound project, the route's family, the projected port, the
  kind — never in the one instance this install happens to have. A rule naming a repository, an
  application, a company, a page, a machine path, a port, a tool or the number from one run cannot be
  read by another install; where the concept needs a name, it names the alias or the role, not the
  fact.
- **A restated threshold.** A number lives in exactly one rule. Every other rule that needs it cites
  that rule's id. Two copies of a number drift, and the drift is discovered as a contradiction
  between two green gates.
- **Errata.** A rule states what is true now, never what changed or why it changed: not "used to",
  not "as of", not an incident it was written against. The change record is the commit and the
  evidence file, not the rule. A retired id keeps only the one clause naming it and the survivor it
  folded into — nothing more, because that address must still resolve for a reader who finds an old
  citation.

## How to modify

- **Ids are stable public addresses.** Receipts, validators, other rules and other teams' notes point
  at them. Never renumber, reuse or silently change what an id means.
- **Cases append.** A rule's Cases are ordinal within the rule. Add Case *n+1*; do not renumber the
  ones above it. Changing an existing Case's wording is correct when the Case was wrong; splitting
  one Case into two new ids is not.
- **A threshold lives once.** When a rule needs a number another rule owns, it names the owning rule
  and the situation, and stops. When two rules both need to own a number, that is a sign the concept
  was split in the wrong place: fold first, then state the number once.
- **Change the contract before the documents.** Shapes are enforced by the template contracts. To
  change a shape, change the contract, run the template validator, and bring every document it names
  into conformance in the same commit.

## How to delete

A rule is never deleted and never renumbered. It is **retired**: its number stops being published,
and the file that used to publish it records the retirement in prose, naming the id and the survivor
it folded into. The number is never reused. A topic may therefore publish a non-contiguous series,
and that is the intended result — a reader who finds an old citation can still resolve it.

The citation gate understands this: a line that says a number is retired may name numbers the topic
no longer publishes, so the record stays legal without reopening the address.

## Evidence

- A rule needs **at least two independent occurrences** before it is law. One occurrence is an
  anecdote and legislating it turns a local accident into a constraint on everyone.
- Occurrences are recorded under `tests/evidence/`, dated, in prose, with whatever concrete detail
  they need — paths, counts, screenshots, line numbers. Evidence is allowed to be concrete precisely
  because it is not law.
- The rule cites its evidence from its `Sources:` line. That line is the join between the shape and
  the observations that justified it.
- Evidence that contradicts the intended rule is recorded as it stands. A rule written against the
  observations is worse than no rule, and the count that refuses it is the most useful thing in the
  file.

## Language

- **English `.md` files are the only runtime authority.** Every context manifest, dependency list,
  operator binding and validator input names an English file.
- **Same-stem `.vi.md` files are human mirrors**, written in the same commit as the English file they
  mirror. Nothing loads a mirror as authority.
- The one thing that reads a mirror is the parity check that proves it has not drifted from its
  English original. That check takes no authority from the mirror; it only compares.

## Enforcement first

Every rule an operator relies on has something behind it that would refuse a violation: a validator, a
schema constraint, a sweep, or a stop code in the operator's own table. A rule with nothing behind it
is advice, and advice is what the four questions above exist to avoid adding.

A gate reads the rule file. It does not carry its own copy of a threshold, a closed list or a set of
names — it parses them out of the file that publishes them, so changing the rule changes the gate and
there is no second place to forget. A gate that hard-codes what a rule states is itself a second home
for that concept, and the next edit to the rule will silently pass it.

## Regeneration

Some files in the tree are generated and must never be hand-edited. After changing their sources,
regenerate them and commit the result:

| Generated | Regenerate with |
| --- | --- |
| `operators/INDEX.md` (+ mirror) | `node scripts/generate-operators-index.mjs` |
| `alias/INDEX.md` (+ mirror) | `node scripts/generate-alias-doc.mjs` |
| `docs/reference/**` (+ `docs/vi/reference/**`) | `node docs/scripts/generate-docs.mjs` |
| the published site catalog | the site's own generation step |

Each generator has a `--check` mode, and the test run uses it: a stale generated file is a build
failure rather than a silent divergence.

## Release

- One version, one **lineage line**. Each release adds a single line to the lineage section of the
  root index saying what changed and why, newest first. The lineage is the tree's own history and the
  only narrative it keeps.
- **Patch**: a gate, a validator, a wording fix, a regenerated file, an evidence note. No id changes
  meaning and no document shape changes.
- **Minor**: a new concept with a new id, a new operator step, a new template section, a new stop
  code, a folded concept whose old id is now retired. Existing addresses still resolve.
- **Major**: an address stops resolving, a document shape changes in a way an installed tree cannot
  read, or the entry's routing contract changes.

A tree is publishable only when its test run is green. There is no grace period, because a tree whose
own gates are red cannot be the authority for anything else's.

## The pre-commit checklist

Run through all of it. Each line is a thing that has silently broken before.

1. **Citations validator** — every rule identifier cited anywhere resolves to a published rule.
2. **Templates validator** — every authored document matches its kind's contract, mirror included.
3. **Operator self-tests** — each operator's validator accepts its lawful branches and rejects its
   mutations.
4. **Docs check** — the generated reference matches the tree.
5. **Places per concept** — for every concept this change touched, count the files that state it. The
   count must not have gone up. If it did, one of them is a citation you have not written yet.
6. **No product identity in law** — no repository name, application name, absolute path, file:line
   reference, commit sha or census count in `knowledge/**` or `operators/**`. If it is evidence, it
   belongs under `tests/evidence/`.
7. **Every new rule has a gate** — name it. If you cannot, you are at question 1, not question 2.

## Lineage of this standard

Distilled from operating one tree of this shape through several rounds of live use, where every rule
above was learned by watching a specific failure: a rule added where a gate was missing, a threshold
copied into a second file and then contradicted, a sibling rule created because an existing one was
one word too narrow, and a green test suite over work that was entirely wrong. The standard is
written to be installed alongside the tree and followed by any team that owns one.
