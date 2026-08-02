# Why this skill is shaped the way it is

Notes for whoever changes it. `SKILL.md` is the interface; this is the reasoning behind it.

## Why build order is the content

Almost everything that goes wrong in a wide front-end build is an ordering mistake rather than a
coding mistake, and the two are not equally visible. Bad code gets reviewed. A component that was
born inside a page, shaped by the one screen that needed it, reads as perfectly ordinary code — it
just cannot be used anywhere else, has no story, and has no state matrix anybody can read. Nobody
sees it in a diff, and the extraction that would fix it is a rewrite that never gets scheduled.

So the skill spends its length on sequence: back end, then components in the design system, then the
surfaces, then the data. Each step exists because the step after it is written against its shape,
and a shape that moves underneath half-finished work is the most expensive thing that can happen
here.

## Why storybook-first is stated rather than assumed

It is already canon, and canon is where the reasoning lives — this document does not restate it. It
is quoted here for one reason: it is the rule under time pressure, and the moment it is broken is
always the same moment, three surfaces into a build with one small missing piece. A rule that is
only true when nothing is urgent is not the rule.

The gates back it up rather than relying on discipline, which is the right division. Coverage,
doc parity and the import direction are all machine-decidable, so they are decided by a machine and
this document only has to say when to run them.

## Why the gates run per component instead of at the end

Saving verification for the end is cheaper per run and much more expensive per mistake. A tier
misjudged on the first component and discovered after five others were built on top of it is five
rewrites, and by then the wrong tier has usually been copied deliberately, on the reasoning that the
existing one is the house pattern.

## Why the unit is the surface set

Because that is the unit the proposal was designed in. The shell that page two shares with page one,
the drawer that reuses the list behind it, the empty state pointing three steps along — these are
relationships, and half of a relationship is not half as good, it is incoherent. Landing a proposal
in fragments also destroys the one thing the backlog is for: a proposal that is partly done has no
honest status.

Adjusting one block afterwards is a different job with a different risk profile, and it has its own
skill. Mixing the two is how a small fix quietly becomes a redesign.

## Why the back end is in scope

Not because the boundary does not matter, but because the alternative is worse. A surface that needs
a field the API does not expose has three outcomes: the field gets faked on the client, the surface
gets designed around the gap, or the work stops. All three are worse than writing the resolver, and
the first two are invisible later.

The constraint that keeps this honest is ordering and verification. The back end goes first, so the
front end is written against something real, and a back-end change is verified at runtime rather
than by a clean front-end type check — which says nothing whatsoever about a resolver. That
distinction has been got wrong often enough to be worth stating in the skill body rather than here.

## Why redesigning mid-build is refused

The separation between the two layout skills buys exactly one thing: the shell is settled while
changing it is still cheap. A design changed during a build spends that, and the spend is invisible,
because a build in progress looks like progress whatever it is building.

There is a second reason that only shows up later. The proposal is what the next reader has. If the
code and the proposal diverge, the proposal becomes a document that describes something that does
not exist, and the reader trusts it before they check.

## Why closing out is a step and not an afterthought

A build finished in the tree and pending in the backlog is worse than one never started, because the
backlog is believed. The same logic drives the two write-backs: a reusable judgement belongs in
canon so the next build does not re-derive it, and a deliberate shortcut belongs in the debt ledger
with its reason, because a shortcut with no note is read as the house pattern by whoever arrives
next.

The restraint on canon write-back matters as much as the write-back. `canon/HOW-TO-WRITE.md` demands
two independent sources before a rule; one build is an anchor to one case. Writing every build's
local decision into canon is how a rule set doubles in size every month with laws nobody can trace.

## What the tests cannot cover

Whether an agent holding this skill actually authors the missing component in the design system
before composing the page, rather than inlining it and meaning to extract it later. That is the one
behaviour the whole skill exists to produce, and only an eval can measure it — the gates catch the
result at commit time, which is later than the skill is trying to be.

`test.mjs` covers what a file can prove: that every canon, pattern, design and skill path this
document cites still resolves, that no machine path was written into it, and that the founding
invariant is still stated in the words canon uses for it.
