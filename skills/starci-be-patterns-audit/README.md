# Why this skill is shaped the way it is

Notes for whoever changes it. `SKILL.md` is the interface; this is the reasoning behind it.

## Why a skill at all, when there is already a script

`patterns/verify.mjs` answers the two questions a machine can answer: does this path exist, and does
this count still recount. Those are worth automating precisely because they are mechanical, and the
day they were first run they found an anchor pointing at a folder that had been renamed and a count
that was off by nearly three hundred.

What the script cannot do is read a file. A rule that says the enqueue shape is a tracked row, then
an unawaited `add`, then a failure fallback, is a claim about what the code *does* — and the anchor
resolving tells you only that a file with that name is still there. Most of the canon's real decay
is that shape: the path is fine, the paragraph is describing a version of the file that no longer
exists.

So the split is deliberate. Anything checkable is a script and gets run first; the skill is the pass
that a person or a model has to do, and it starts from a clean mechanical result so that no effort is
spent judging a rule that points at nothing.

## Why it is incremental, and why the state is a commit

The first pass over a backend of this size is long, and if every later pass cost the same, there
would be no later passes. That is the whole failure mode of a documentation audit: it happens once,
at the moment somebody has energy for it, and never again.

A commit sha is the right unit of state because it is the only thing that answers "what could
possibly have changed" without trusting anyone's memory. Timestamps drift across machines, file
mtimes lie after a checkout, and a human's account of what they touched is an account. `git diff
--name-only <lastAuditCommit> HEAD` is checkable, cheap, and wrong in only one direction — it can
name a file that did not really change, which costs a read, and it cannot miss one.

Open findings carry forward for the opposite reason: a file that has not changed since the last run
is not re-read, so anything unresolved in it would vanish from the record precisely because nobody
fixed it. Carrying them makes an unfixed finding louder each run rather than quieter.

## Why the state file lives in the backend, not here

It is a claim about that repository. It names a commit in that repository's history and files inside
its tree, and both are meaningless in this one. Putting it here would also mean this skill set — which
travels — carried one machine's audit position for one project, which is the same mistake the
workspace registry exists to prevent.

The cost is that the audited tree needs an `.artifacts/states/` folder and gains a file it did not ask
for. That is the same arrangement the front-end audit uses, and the consistency is worth more than
the tidiness.

## Why report-only is the default

Two of the three conclusions an audit can reach are not this skill's to act on. "The code drifted" is
a change to a running backend, which needs its own verification and belongs to whoever owns that
change. "The rule should not exist" is a deletion from a shared canon, and deleting somebody's rule
because a script disagreed with it once is how a rule set stops being trusted.

Only "the rule went stale" is inside the lane, and even that is gated on approval, because
re-grounding is an edit to prose that other people are reading as law.

The failure this guards against is specific and has happened elsewhere in this set: an audit lane
handed a directive-sounding argument starts fixing, and the report — the actual deliverable — never
gets written because the session was spent on edits nobody asked for.

## Why the direction of authority is stated so bluntly

Because in the moment it does not feel obvious. A rule reads as law, the code in front of you
disagrees with it, and the natural reflex is to change the code. That reflex is right when one new
file breaks a pattern the whole backend follows, and badly wrong when the whole backend has moved on
and one paragraph has not — and both look identical from inside a single file.

Stating it once, at the top, means every finding has to say which case it is. That is also why a
finding records what the source actually does rather than only which rule it breaks: the first is
evidence, the second is an accusation.

## Why the fan-out splits by shelf

Splitting by module is the obvious cut and the wrong one. Ten modules all touch
`conventions/type-safety.md`, so ten lanes each form an opinion about the same rule, and the closing
pass gets ten partially-informed verdicts to reconcile instead of one. Splitting by shelf gives each
lane sole ownership of a set of rules, which is the thing a conclusion is about.

Every lane writes its brief to a file before it ends. A lane that answers into the conversation has
produced nothing the closing pass can read.

## What the tests cannot cover

Whether an agent holding this skill actually runs `verify.mjs` before judging, keeps the state, and
stops at reporting rather than editing. Those are properties of the description and the body, and only
an eval measures them.

`test.mjs` covers what is checkable about the document itself: that every canon, patterns and skill
path it cites still resolves, that it contains no machine-specific path, and that the invariant the
rest of the skill rests on is actually written down. A reference that rots is the exact failure this
skill exists to catch, and a skill whose own references have rotted has no standing to report anyone
else's.
