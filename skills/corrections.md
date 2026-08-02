# corrections.md — the feedback ledger

Every correction a person gives a skill is written here, so the miss is fixed once and never repeated.
This file is the input to `starci-upgrade`, which reads each open entry and folds it into the skill it
belongs to.

## How an entry is written

Append a block at the top (newest first). Keep it short — the correction and where it lands, not the story.

```
## <date> · <skill it targets> · <status: open | applied>
**What was corrected:** the miss, in one or two sentences — a rejected option, a rule restated, "not like that".
**Why:** the reason it was wrong, so the fix survives a case its author never saw.
**How to apply:** the concrete change to the skill (a rule to add to prompt.md, a step to fix, a reference to write).
```

- **status: open** — recorded, not yet folded into the skill. `starci-upgrade` acts on these.
- **status: applied** — `starci-upgrade` has folded it in; kept as the trail of why the skill reads the way it does.

## Rules

- One entry per correction. If the same note lands twice, the skill was not upgraded — that is a bug in the loop, not a new entry.
- A correction that applies to every FE skill belongs in `prompt.md`, and the entry says so.
- Do not delete applied entries — they are the record of how the suite learned.

---

<!-- entries below, newest first -->
