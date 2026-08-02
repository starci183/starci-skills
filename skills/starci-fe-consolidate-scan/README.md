# Why this skill is shaped the way it is

Notes for whoever changes it. `SKILL.md` is the interface; this is the reasoning behind it.

## Why the scan is a separate skill from the apply

The two halves fail in opposite directions, and a single skill can only be tuned for one of them.

A scan is cheap, wide and reversible: reading the whole app twice costs nothing, and a wrong finding
costs a paragraph. An apply is narrow and expensive: it deletes code, and a wrong target is discovered
three screens later by someone who was not there.

Written as one skill, the expensive half sets the tempo. The reader who wanted to know *how much
duplication is there* gets a diff, and the reader who wanted a diff gets an essay about clusters. The
split also buys the thing that matters more than either: the proposal is a real document, written to
be argued with, and the argument happens before anything is deleted.

The second reason is timing. A scan is worth running before a redesign, before writing a new
component, and while onboarding onto an unfamiliar feature — three moments where nobody wants a code
change. Coupling the report to the edit makes the report unavailable exactly when it is most useful.

## Why the proposal lives in the audited tree and not here

The same reasoning as role-relative paths in `starci-record-debt`, arrived at from the other end. A
consolidation proposal is a **claim about one checkout at one moment**: these seven files, these
nineteen call sites, this rank order. Store it in the skill set and two checkouts of the same repo
share one proposal between them, each half true. Store it beside the code and it travels with the code
it describes, gets reviewed in the same diff, and dies with the branch if the branch dies.

`fe.artifacts` was chosen over inventing a folder because the front end already keeps audit state
there, and one convention that a person can guess beats two that they have to look up.

## Why it updates the file instead of rewriting it

The first shape regenerated the proposal on every run, which is obviously correct until the second
run. A regenerated file loses every decision somebody already made — the cluster that was weighed and
kept apart comes back at rank three, gets refused again, and the refusal is again not recorded.

So the file accumulates and the states are written as words. The cost is that a stale row can survive
a refactor that deleted its call sites, which is why the apply is required to re-read the source
before trusting a row.

## Why three clusters per batch, with the rest still written down

Two failure modes, and the batch size is aimed between them.

A proposal of thirty rows is approved in one gesture, which means the fourth-ranked cluster was never
weighed by anybody — the approval was of the document, not of the work. A proposal of three is
approved cluster by cluster, which is the only approval worth having.

But a scan that only ever *reports* three loses its own ranking. The next scan has to rediscover the
same twenty-seven clusters and may rank them differently, and there is no way to see whether the set
is shrinking. So everything found is written, and only the top three are put up for approval.

## Why semantics beat shape, stated three ways

The sweep can only see shape, so every guard in the skill exists to stop shape deciding. The three
tests — does either copy know a domain entity, how many flags would unification cost, and would the
merged component need a `className` — are the same question asked at three different distances,
because in practice people answer one of them and skip the other two.

The `className` test is the load-bearing one and the least intuitive. It converts a design question
into a mechanical one: if the only way to serve both callers is an escape hatch, the callers wanted
two things. `canon/fe/architecture.md` argues that at length and this skill deliberately does not
restate the argument — a copied rule rots, and the copy is always the one that gets read.

## Why call sites are counted as imports

Because the obvious method is wrong in a way that flatters the result. A grep for a component name
matches its definition, its story, its re-export, its type and every comment mentioning it — so the
component that is *most talked about* ranks above the one that is genuinely copied five times. Impact
ranking is the whole value of the proposal, and a metric that inflates on attention rather than on
duplication inverts it.

## What the tests cannot cover

Whether an agent holding this skill actually reaches for it before writing a component that already
exists — the single most valuable moment to run it, and the one nobody thinks to. That is a property
of the description, not of the body, and only an eval measures it.

What the suite does check is narrower and still worth having: that every path the skill sends a reader
to still resolves, that no machine-specific path was baked in, and that the skill's founding invariant
is present in words rather than implied. The first of those is the one that breaks — canon files move,
and a skill pointing at a moved file is a skill that teaches a reader the canon is unreliable.
