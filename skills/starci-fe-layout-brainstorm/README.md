# Why this skill is shaped the way it is

Notes for whoever changes it. `SKILL.md` is the interface; this is the reasoning behind it.

## Why the flow, and not the page

The first version of this took a page as its unit, because that is how the request usually
arrives — somebody names one screen. What came back was a sequence of individually sensible
screens that disagreed with each other: two shells for the same kind of work, a primary action
that moved between steps for no reason, and a modal, designed a week later by someone holding only
the page, that looked like it came from a different product.

None of those are page-level mistakes. They are only visible when the surfaces are laid side by
side, which means the unit of the decision has to be the set. Widening the unit costs one step —
enumerating the surfaces before designing any of them — and that step is also where a missed phase
gets caught, which turns out to be the more common win.

## Why the shell comes from the job and not from the data

Choosing the shell from the data is the intuitive move and it is reliably wrong, because the same
records serve different jobs. A list of enrolments is a reading surface on one route and a working
surface on another; a comparison of two things is a split pane when you are choosing and a column
when you are being told. Design from the records and both become the same shape, and one of the
two is then unusable.

The job sentence in step 2a is doing real work here, not ceremony. It is short enough to write
before thinking, and it fails loudly: a sentence that needs an "and" is usually two surfaces, and a
sentence nobody can write is a surface nobody has a reason for.

## Why the conversion lens lives in the skill and not in canon

Canon records what this codebase already does, anchored to files and counts. Persuasion, funnels
and onboarding sequences are not properties of the codebase — there is nothing to anchor to and no
count to recount, so a rule about them would be a preference wearing canon's clothes, and
`canon/HOW-TO-WRITE.md` is explicit that preferences do not belong there.

They still have to be decided somewhere, because leaving them out produces surfaces that are
correct and inert. So the lens sits in the skill, where it is applied at design time and argued
with at design time, and it is deliberately three questions rather than a framework.

The honesty clause is the part not to soften. A fabricated count converts on its first showing and
then costs the product its word, and the loss is not recoverable by a later correction. If the true
number is unimpressive, that is information about the design, not about the number.

## Why the output is a clickable prototype rather than a description

A description of a layout gets agreed to. It does not get understood, because the reader fills in
the gaps with whatever they already pictured, and both sides leave believing they agreed. A
prototype someone clicks through produces disagreement, immediately and specifically, which is
what the step is for.

The state toggles matter more than the screens. Almost every real objection in review has been
about a state rather than a screen — what the empty case says, what happens when the list is longer
than the region, what the surface looks like while it is still loading — and those are invisible in
a static picture of the happy path.

## Why the prototype names real components

Because the alternative is discovered later, at cost. An anonymous rectangle in a wireframe is
built as an anonymous `div`, and by the time anyone notices, the shape lives at the call site. The
naming requirement also acts as a check on the design itself: a block that cannot be named against
anything in the design system is either a component that has to be authored — which the apply phase
needs to know about before it starts — or a sign that the surface is asking for something the
system deliberately does not do.

## Why hosting is verified by content and not by status code

This is an error that was actually made, more than once. A static server from an earlier session is
still holding the port, the new prototype is never served, the fetch returns 200, and the URL that
gets handed over shows last week's design. Everything about the failure reads as success, and the
review that follows is a review of the wrong artefact.

Checking for a marker unique to this prototype costs one command and removes the entire class.

## Why it stops at the proposal

Two reasons, and the second is the load-bearing one.

The first is that design questions and build questions have different failure modes. A build that
goes wrong is visible; a design decided halfway through a build is invisible, because it looks like
progress. Separating them means the shell is settled while it is still cheap to change.

The second is that the proposal is the only durable artefact. A design agreed to in conversation
survives exactly as long as the session. The proposal file, and the one line in the backlog, are
what let the build happen tomorrow, or by someone else, without the flow being re-derived from the
feature's name.

Note that this is not a rule about sessions. Applying immediately in the same session is fine and
the skill offers it; what must not happen is building *while* deciding.

## Why panel mode is opt-in

Rival directions plus an adversarial pass is expensive, and on an ordinary flow it manufactures a
decision that did not exist — three defensible designs where one shell was obvious from the job
sentence. It earns its cost only when two shells genuinely both fit, which is rare enough that
making it the default would tax every run for the benefit of a few.

## What the tests cannot cover

Whether an agent holding this skill actually enumerates the flow's surfaces before designing one,
or reaches for this skill at all instead of sketching a page inline. Both are properties of the
frontmatter description and of judgement, and only an eval can measure them.

`test.mjs` covers what a file can prove: that every canon, pattern, design and skill path this
document cites still resolves, so a rule that moves fails here rather than misleading a reader;
that no machine path was written into it; and that the founding invariant is still stated, in the
words the rest of the skill leans on.
