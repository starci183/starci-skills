# Findings

This folder is what the tree learns from the receipts it produces. Every audit and every walk ends
in a verdict table, and until now a failure in that table lived only in the session that recorded it:
the next generator of the same surface never saw it, and a defect no rule covered was met again in
the next session as if for the first time. The ledger here is the memory those receipts leave behind,
and the two scripts beside it are the only ways it is written and read back into law.

## The ledger

One file per grammar family, `<family>.jsonl`, where `<family>` is the family the route binds (the
route's `grammarId`, the same segment `@knowledge/grammars/<family>` resolves through). One JSON
object per line, in the line shape [the findings kind](../../templates/kinds/findings.schema.json)
publishes under `$defs.line`: the id, when it was recorded, the session and branch that produced it,
the operator, the family, the surface and the unit it is about, the rule it fails or `null` when no
rule covers it, the code it carried, the statement as the receipt measured it, its severity, and
`fixed`.

The law of the ledger is three sentences. Every done `interface.audit` and `uat.verify` branch whose
verdicts carry a failure appends its findings, one line each. Nothing edits a line: a finding is
closed by appending a second line with the same id whose `fixed` names the branch, as
`<sessionId>:<N/M>`, whose receipt judged the same surface and unit again and no longer carries the
failure, and the newest line per id is the finding's state. A finding recorded twice is appended
once, because its id is derived from what it is about and not from when it was written.

The append is the orchestrator's, at the transition that accepts the receipt, through
`node scripts/record-findings.mjs <branch>`; an isolated agent never reaches this folder. The script
reads the validated verdicts of the branch, appends the lines the ledger does not hold yet, closes the
open findings of the same surface and unit that the branch judged and found passing, and materializes
the ledger's open lines for the surfaces the branch observed as `response/data/findings.json` beside
the receipt, in [the findings kind](../../templates/kinds/findings.schema.json) — the file the next
`interface.generate` of that surface binds as `inputs.findings`. `scripts/validate-session.mjs`
refuses a session in which a done audit or walk branch carries a failure the family's ledger does not
hold, naming the branch, so a receipt cannot be accepted and forgotten.

## What reads it

A generator answers what the ledger knows. `interface.generate` binds the materialized file as its
`findings` input and its decision receipt names every open line for its surface under
`## Findings answered`, with how the direction answers it; a generator that ignores a known finding
is refused by its validator. A finding for a surface is one whose `surface` is the generator's target
or the unit it runs.

A rule-less finding seen in two sessions is a rule the tree is missing. `node scripts/promote-findings.mjs`
collects the open findings whose `rule` is `null`, groups them by family and by the code or the
statement they share, and for every group seen in at least two distinct sessions drafts
`proposals/<slug>.md` in the rule shape the proof topics use (`Case | When | Observe`),
with an evidence note stub under `tests/evidence/`. It never writes into `knowledge/ui/`: a proposal
becomes law only when a person authors the rule under [`UPDATE.md`](../../UPDATE.md), with the two
occurrences as its evidence, and a proposal file that already exists is never overwritten. A draft
carries no rule heading of its own and cites no ordinal, so the citation gate that reads this folder
does not mistake a draft for a published rule.

## What this folder is not

It is not law, and nothing binds it as a context. A line here records that a surface failed a rule
on a day; the rule stays where it is published, and a finding that contradicts a rule is evidence
against the rule, recorded as it stands.
