# starci-fe-story-audit-block — notes

`SKILL.md` says what to do. This file says why it is shaped that way. Read it before changing
anything here.

## Why the entry point is the shape, and never the name

The lane has one door and it is deliberately narrow: you describe the records you are holding, and
the table answers with a component. Entering the other way round — holding a component name and
looking for a shape that justifies it — always terminates, because every component can be made to
accept almost any data. That is the whole reason the wrong shell survives reviews: nothing about it
is broken. The type checks, the gates pass, the screen renders, and the shell is wrong.

Two entries in this set share one skin on purpose. A list of cards and an accordion of cards look
identical until something is opened, so a screenshot is not evidence about which of them a screen
should be using. The records are the only evidence there is, and the lane is built to make people
fetch them rather than infer them.

## Why three inputs, and why the back end is the one that gets skipped

The feature in words says what somebody wants. The front-end code says what already exists, which is
what stops the sixth almost-identical card being born. The back-end code says what the data actually
is — and it is the input people substitute an assumption for, because it lives in another repo and
the mockup seems to already show the answer.

It does not. A mockup shows three rows because three rows fit on a slide. It shows a filled-in
description because an empty one looks unfinished. Every state the widget needs — empty, late,
truncated, error — is a state a mockup is designed to hide.

## Why the candidates are drawn instead of listed

Asking "should this be a list or an accordion?" in prose puts the burden of imagining both on the
person answering, and they answer from whichever one they pictured. Drawing both, at one width, with
the real field names, moves the decision to something anyone can look at and disagree with in one
second.

The corollary matters as much: when the shape forces exactly one candidate, drawing four is worse
than drawing one. A fake choice invites a wrong pick from somebody who assumed the options had
already been narrowed.

## Why a gap is proposed and never enacted

A wrong block is wrong once. A wrong entry in the set is wrong on every screen that ever uses it, and
it is wrong quietly, because each of those screens can point at the set as its justification. That
asymmetry is the entire argument for the extra step: adding an entry is a change to the rules, and
whoever writes a rule has to be the person who owns the rules.

It is also why a proposal is the one moment this lane pays to read the expensive material. Everything
else — a block assembled correctly out of things that already exist — should open no reasoning file
at all.

## What the tests here can and cannot tell you

`test.mjs` checks three things, and each of them exists because of a specific way this kind of
document rots.

**Every path it cites still resolves.** The most common decay in a rule set is not a wrong rule, it
is a correct rule pointing at a file that moved. That failure is silent: a reader follows the link,
finds nothing, and quietly decides the rule was not important. Four references in the sibling canon
had already died this way when it was last re-grounded.

**No machine path is written into it.** A path is true on exactly one machine and the failure looks
like success — files open, greps return, and conclusions get drawn from the wrong tree. Everything
resolves through `read-workspace-context.mjs` instead.

**The founding invariant survives verbatim.** *UI is a function of data, not of taste* is the
sentence the whole lane hangs from. If an edit softens it, every rule below it loses its reason, and
nothing else in the test would notice.

```bash
node .claude/skills/starci-fe-story-audit-block/test.mjs
node .claude/scripts/run-all-tests.mjs
```

What none of it tests is whether an agent holding this skill actually fetches the back-end code
instead of reading the shape off a screenshot. That is a behaviour question and it needs an eval —
the same prompt run with and without the skill, graded blind.

> **prompt** — here is a screenshot of a findings list, it looks wrong, fix it.
>
> **expected** — asks for the entity behind the list before proposing anything, and says which
> component the shape demands rather than restyling what is on screen.
