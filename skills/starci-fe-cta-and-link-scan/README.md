# Why this skill is shaped the way it is

Notes for whoever changes it. `SKILL.md` is the interface; this is the reasoning behind it.

## Why an audit that no gate can replace

Every other check in this repo answers a question about a file. Is this gap on the scale, does this
component have a story, does this block earn its layer, is this prop typed. All of them can be
decided by reading one file, which is why they are scripts under `scripts/gates/` rather than
prose.

The defect this skill hunts is not in a file. Two buttons of identical weight are individually
correct. An empty state that says "nothing here yet" is individually correct. A mention of a course
rendered as plain text is individually correct. What is wrong is the shape of the graph they form —
where a person can go from here, and whether they can tell. No amount of static analysis reaches
that, so it stays a judgement, and a judgement needs a person to approve it. Hence a proposal rather
than a fix.

## Why the pair is split at all

The same reason `starci-fe-consolidate-scan` and its apply half are split, and the reason
`starci-fe-layout-brainstorm` stops before building: the expensive resource is the reviewer's
attention, not the model's. A scan that also edits presents its conclusions and its diff at the same
moment, and the only way to disagree with a conclusion is to read a diff. Splitting them means the
argument happens over three sentences.

The second reason is time. A conversion audit is worth running on a whole app; the fixes land over
weeks. If the scan holds the state in a conversation, the state dies with the conversation. Writing
it into `proposals/` means Thursday's session can pick up Monday's work without Monday being present.

## Why the ledger is complete and the proposal is not

The scan produces two files deliberately. The ledger holds everything it found; the proposal holds
three to five findings.

That is not tidiness, it is the observed failure mode. A list of thirty findings is skimmed, argued
with in general terms, and approved as a mood rather than as a list — after which the apply half has
no spec. Three findings get read individually and decided individually. The remaining twenty-seven
are not lost; they are ranked, and the next batch takes the top of what is left.

The ledger also makes the second run cheap. Re-scanning updates states rather than starting over, so
the cost of the audit falls with each pass instead of staying flat.

## Why grounding is a step and not an instruction

The most confident wrong output this audit produces is an invented funnel: two features that "should
obviously" link to each other, where nothing in the data connects them. It reads well, it survives
review, and it costs a week.

So the check is written as its own numbered step, before any finding that asserts a missing link may
be written, and its legitimate outcome is "this surface stands alone". A skill that only tells the
reader not to guess is relying on the reader remembering at the exact moment guessing feels
justified.

## Why every state counts as a surface

Because the dead ends live in the states nobody demos. A page with content almost always has a next
step, since the person who built it was looking at content while they built it. The empty state was
written last, in one line, as a message — and a message is not a route.

Enumerating the state set first also borrows work that already exists: a component's story is
obliged to render its states, so the story is the fastest inventory available. When the story omits a
state the audit needs, that omission is itself worth noting.

## Why honesty is a graded family rather than a warning

Persuasion techniques are legitimate and the app uses them. The distinction that matters is not
between persuasion and restraint, it is between a claim with a column behind it and a claim without
one. Written as a warning, that reads as a vague caution and gets nodded past. Written as a graded
check — does this number resolve to something the back end can produce — it produces findings, and
the findings are specific: a fallback that invents a plausible figure when a query fails is a
fabricated claim shipped under a real component's name.

Keeping it inside this audit rather than in a separate ethics document is deliberate. The moment it
is separate, it is optional.

## Why the map is required output

A ranked list answers "which finding is worst". The question actually being asked is "which page is
in trouble", and a list answers that only after a minute of reading, which means it usually is not
answered at all. A grid of surfaces against the three families is the same information in a form the
eye resolves at once.

## What the tests cannot cover

Whether an agent holding this skill actually reaches for it — and, harder, whether it grades honestly
rather than producing a plausible-looking audit of surfaces it did not read. Both are properties of
the description and the model, not of a script, and only an eval measures them.

`test.mjs` covers what a static check can: that every canon, patterns, design and sibling-skill path
this file cites still resolves, so a moved reference fails here rather than in front of a user; that
no machine path was written in; and that the founding invariant is still stated in words rather than
having been edited into a shorter, weaker sentence.
