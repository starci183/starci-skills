# practices/ — lịch sử thực hành

> **Status: EXPERIMENTAL** — during the draft phase these entries are the
> primary upgrade mechanism: practice → observe → distill → standard.

Referenced practice records of what the fleet did, what broke, and what standard was
derived from it. This is how `.claude` upgrades: **practice → observe → distill →
standard**. Superseded records without contract or code references were pruned on
2026-09-28; the retained evidence is append-only.

## Entry format

One file per practice session: `YYYY-MM-DD-<slug>.md`

```markdown
# <slug>

## Practiced   — what we actually ran (agents, commands, topology)
## Observed    — what happened: failures, surprises, timings (facts, not opinions)
## Derived     — standards/rules extracted, where they now live (modules/, scripts/)
## Open        — unresolved questions for next sessions
```

## Rules

- Facts over opinions: cite markers, logs, exit codes.
- Never rewrite history — corrections go in a new entry.
- When a Derived rule gets encoded into `modules/` or `scripts/`, the entry links to it.
