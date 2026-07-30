---
name: writing-canon
description: How to patch canon when a lane's reflect step finds a hole. Read at the reflect step of either skill, or when editing the skill set itself.
---

# Writing canon

**Every time the teacher has to give feedback on something canon should already have answered, the
bug is in canon** — not in that one fix. Fixing code closes one case. Fixing canon closes a whole
class of cases.

This is not a lane of its own. Both skills end with a reflect step, and that step lands here.

> Table "where does this feedback close": [`house-rules.md`](house-rules.md) rule 5
> Rules that need outside sources: [`research-when-silent.md`](research-when-silent.md)

## Three cases, tell them apart cleanly

| Case | Signal | Do what |
|---|---|---|
| **canon is right, code is wrong** | the rule exists, is written clearly, nobody read it | **fix only the code.** Don't touch canon |
| **canon is silent** | this case is simply missing | add it — but see the bar below |
| **canon is wrong** | it teaches the opposite of measured reality | fix it, with a **dated anchor** + before/after |

## Bar for something to become a rule

**One example is not a rule.** Promoting it to a general rule needs **two independent sources**.
Not enough sources? Write it as an anchor to **that specific case**, not as a rule.

Exception only when the teacher personally locks in each case by hand — and it must be marked
**not a precedent**.

## Budgets — count LINES, not words

Taken from the official Anthropic skill standard, not invented here.

| Layer | Ceiling | Contains |
|---|---:|---|
| metadata — `name` + `description` | **~100 words**, always loaded | trigger conditions only |
| `SKILL.md` body | **under 500 lines** | loaded when the skill triggers |
| bundled resources | no ceiling | loaded only on demand |

| File | Shape |
|---|---|
| `CLAUDE.md` | dispatch, not teaching |
| `skills/INDEX.md` | one line per skill |
| `skills/<name>/SKILL.md` | under 500 lines; worked examples, not more principle |
| `principles/judgement.md` | rules no type, API or gate can ever catch |
| `principles/decisions/<axis>.md` | a lookup sheet: scale · tree · confused pairs |
| `docs/API-BACKLOG.md` | a rule an API could delete, written as engineering work |
| `principles/<axis>/rationale.md` | prose. Reasoning, anchors, history of reversed rulings |
| any reference | **over 300 lines ⇒ needs a table of contents** |

Over the ceiling? **Push it down to `references/`**, don't compress it to fit. A word budget
tighter than the real standard silently deletes content — that already happened here once.

**Prose is not a failure mode.** Anthropic's own `frontend-design` skill teaches judgement in
narrative, not tables. A lookup sheet gets a table; a thing that teaches judgement gets sentences.

## Rule for writing `description`

**Description = WHEN TO USE, not WHAT IT DOES.**

An agent can act on the description without reading the skill body. So the description must
contain **the trigger condition** — symptoms, the phrase the teacher tends to say, the situation —
and **must not** contain the workflow.

Write it slightly **pushy**, in the standard's own shape:

```
Use this skill whenever <trigger>. Also triggers on <phrases the teacher actually says>.
Not for <the neighbouring lane>.
```

Name at least four real trigger phrases and one anti-trigger. Around 100 words — this is the only
text always in context, so it is the one place where more words buy more accuracy.

## Every discipline-based skill needs Red flags

List out, in advance, the exact lines **you yourself** will say when you want to cut a corner. Not
other people's mistakes — the rationalizations that lane makes under pressure.

## Where a new rule goes — ask in this order

1. **Could a type, a prop shape, or a gate make this impossible to write?** Then it is not a rule.
   File it in `docs/API-BACKLOG.md` with the concrete API change and the component that must own it.
2. **Is it about verifying before concluding?** Then it belongs in `house-rules.md` §2, not in an
   axis. Nine such rules were once written into nine separate axes.
3. **Is it a step of a scale, or a branch of a tree?** Then `principles/decisions/<axis>.md`.
4. **Does catching it need a view wider than one prop — the whole region, the whole row, the real
   content, the real data?** Only then is it `principles/judgement.md`.

Writing a rule at the wrong level is how canon reached 103 Forbidden lines, 46% of which restated
something already enforced. See [`../docs/RULE-SCAN.md`](../docs/RULE-SCAN.md).

## Editing a decision sheet — what to change alongside it

A decision sheet and its `example.html` split by **reader**, not by content. Editing the rule in one
without the other lets two different versions live at once.

Editing a decision sheet in a way that changes the reasoning ⇒ write it into that axis's
`rationale.md` too, with a date.

## Red flags

- "The teacher just said this, add it to canon" → **one source is not a rule.** Anchor it to that specific case.
- "Canon's too long, compress it" → compressing a course into a table loses the reasoning. Split into two files, don't compress one.
- "Just put the workflow in the description so it's clear" → the agent will act on it without reading the skill body.
- "Code's fixed, canon can wait" → if canon should have answered it, **the next round repeats it exactly**.
- "This rule doesn't fit any axis, park it somewhere for now" → **a rule that doesn't fit the template is a rule about to fall through.** Say so immediately.
- "Logged 'fixed' already" → the log records **intent**, not proof. Check the actual disk.
