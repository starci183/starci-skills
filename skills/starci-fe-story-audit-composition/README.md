# starci-fe-story-audit-composition — notes

`SKILL.md` says what to do. This file says why it is shaped that way. Read it before changing
anything here.

## Why volume is the variable, and why it has to be counted

Every arrangement works at four records. The differences between arrangements only appear at the
volume the arrangement was supposed to handle, which is exactly the volume no mockup, no screenshot
and no local seed database ever contains. So the first act of this lane is arithmetic, not drawing:
the page size, the worst case, the number of regions, and how many of those regions are empty for a
new account.

Once that number is on the table, most arrangement arguments end by themselves. A lot of data splits
into two workspaces because one column cannot carry it; a little data centres, because spreading it
thin only dilutes it. Nobody has to be persuaded of a taste.

## Why this lane exists separately from the block lane

They ask different questions of different evidence, and merging them produces the failure both were
built to stop. The moment one lane owns both, the natural move is to pick a familiar component first
and then arrange the page around it — the exact reasoning direction the whole set forbids.

Keeping them apart also makes the handoff explicit. This lane settles how many regions there are and
which of them shrinks, then hands each region over with its record count attached. If you catch
yourself weighing two components, that is the signal you crossed a boundary, and it is a cheap signal
precisely because the boundary is written down.

## The incident this lane is anchored to

Two screens needed a reading column beside a narrow column of actions. Nothing in the set answered
it, so both authors reached for a horizontal stack with a wrap, and both wrote the same comment about
it being the best available substitute.

The wrap had no threshold. The main column shrank without limit, so the row never wrapped — the two
columns stayed glued together at every width, phones included, on both screens. Nothing looked broken
in review. Nothing failed a gate. It took a measurement.

Two things came out of that, and both are load-bearing here. **Two independent cases stating the same
lack is the bar for building something new** — one case would have been an anchor, not a proposal.
And **an arrangement has to be drawn at more than one width**, because the narrow form is where
arrangements fail and it is the form nobody looks at.

## Why the arrangements are drawn rather than described

A layout described in prose is agreed to and then imagined differently by everyone who agreed. Drawn
side by side at one width, with real region names and the real record count, it can be rejected in a
second. The rule that a widget must carry the production count is not pedantry: a widget showing
three rows where production shows three hundred is a comfortable lie about the only variable the
whole decision turns on.

## What the tests here can and cannot tell you

`test.mjs` checks three things, each of them a specific way a document like this rots.

**Every path it cites still resolves.** A correct rule pointing at a file that moved fails silently:
the reader finds nothing and quietly downgrades the rule. That is the most common decay there is.

**No machine path is written into it.** A path is true on one machine, and the failure looks like
success — files open, greps return, and the conclusions come from the wrong tree.

**The founding invariant survives verbatim.** *Volume decides the arrangement* is the sentence the
rest of the lane hangs from; soften it and every step below loses its justification.

```bash
node .claude/skills/starci-fe-story-audit-composition/test.mjs
node .claude/scripts/run-all-tests.mjs
```

What none of it tests is whether an agent holding this skill counts the records before drawing, or
whether it really hands regions over instead of quietly choosing components. Those are behaviour
questions and need an eval.

> **prompt** — build the booking page for this feature.
>
> **expected** — asks how many records each region holds before proposing an arrangement, draws the
> candidates at more than one width, and stops at the region boundary instead of naming components.
