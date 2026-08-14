# handoff

## Definition

A handoff is the moment one phase's work becomes the next phase's input. It answers one question:
**what does a phase owe before it is allowed to say it is finished?**

The answer is that it owes a CLEAN arrival. A phase runs to the end of its own work, settles
everything settleable, hands over whatever only the user can clear as one answerable set, and then
invites the next phase by name — stating what that phase will do and what it will ask. The user
starts it. What a phase may not do is stall in the middle: ask a question the moment one occurs,
abandon a proof because a tool refused once, or announce the next phase with its own work half done.

A stop is a decision, not a pause. Plan stops because a direction is the user's to pick, Preview
because approval is theirs to give, Apply because a production write boundary is theirs to confirm.
Those three, plus the invitation that closes each phase, are the whole list of places a run may end
a turn.

Everything else the run cannot settle alone is an ITEM, not a stop. An item is written down with
what it blocks and carried to the end of the phase, where the whole set is handed over at once. A run
that turns each item into a question as it appears has converted one phase into a series of
interrogations, and the user pays a full round trip for each.

## Rules

1. **HANDOFF-1 — A phase runs to the end of its own work before it hands anything over.** Reaching
   the boundary is the phase's job, not the user's. Every proof it can take, every mechanical repair
   inside its boundary, every fallback its references name, and every item it can classify are done
   before the phase speaks. A phase that reports a problem and stops with work still available to it
   has spent its whole cost and delivered a status update.

2. **HANDOFF-2 — Do everything the decision cannot change before stopping.** A phase stops for its
   decision alone. Work whose result is identical under every available answer — mirroring the
   candidate from a clean target tree, wiring the lint configuration so it reaches the candidate path,
   resolving fixtures, reading the named reference's source, running the NEXT phase's admission gates
   early — is done before the question is asked rather than after the answer. Work sequenced behind a
   question turns one wait into two, and the second wait permits nothing the first did not.

3. **HANDOFF-3 — A stop names the decision, the options, and what each answer starts.** The question
   states which revision, direction or boundary is on the table and what the run will do with each
   answer, so a one-word reply is unambiguous. A bare confirmation is only bare when the thing being
   confirmed was left unstated; restating it afterwards to make the record honest spends a round trip
   the question should have spent up front.

4. **HANDOFF-4 — Evidence the environment refuses is work, not a stop.** When a tool declines to
   produce evidence a gate requires, take every fallback the governing skill names before recording
   that evidence as unobtainable. Only when all of them fail is it a finding, and it is stated with
   what was tried. An environment failure allowed to end a phase is indistinguishable from a design
   problem: it halts the run on a question no reader can answer, when the proof was available and
   only the path to it went unread.

5. **HANDOFF-5 — Items are handed over as ONE form, answerable in a single pass.** Every open item
   arrives together, each with its options and the default the run took where a safe one existed, so
   the user settles them in one sitting and in any order. A question raised the moment it appears
   stops the run at the point cheapest for the run and dearest for the user, who answers it and is
   stopped again by the next one before they have put the context down.

6. **HANDOFF-6 — A UX or UI choice inside the approved direction is the run's to take, and the
   review's to overturn.** Not everything that COULD be asked is an item. Once a direction is
   selected, the micro-choices that fill it in — what a control is called, whether an action is words
   or a glyph, which of two orderings a group takes, how a label is phrased — belong to the run. Take
   the choice, record it in one line with the reason where the reviewer meets it, and let the
   approval stop decide it. The user selected a direction and will approve a revision; those are the
   two places the design is judged, and a micro-choice raised separately spends a round trip on
   something the approval already covers. A run that asks every one of them has handed back the
   judgement it was engaged for.

   The line is what the choice can be WRONG about. Taste, phrasing and arrangement inside the
   selected direction: the run decides. A fact it derived rather than read, a promise the product
   makes, a permission, a price, a piece of business behavior, or anything outside the selected
   direction's scope: those stay items, because being overruled later does not undo them.

7. **HANDOFF-7 — What is left IS a DECISION, a RESOURCE or a SUB-RUN, and each is handed over in the
   form that lets the user act.**

   - A **decision** is settled by choosing. It arrives with its options, their consequences and the
     default in force.
   - A **resource** is something the run cannot obtain at all — a credential, an API key, an asset
     file, an official mark, a seeded row, a service that has to be up. Asking for one in prose
     leaves the user to derive the format, the filename and the destination, all of which the run
     already knows. Give the exact command or script that puts it in place, the path it writes to,
     and the check that proves it landed, so the answer is something the user RUNS.
   - A **sub-run** is work that belongs to another procedure: a backend enabler the frontend case
     turned out to need, an e2e the flow does not have, a lint wiring that is not adopted. Name the
     skill that owns it, say what it will produce and why this phase cannot proceed on that point
     without it. When the user starts it, it runs and then **returns here** — a sub-run is a detour,
     never a phase transition. The phase that requested it owns the result, resumes at the point that
     recorded the item, and finishes.

8. **HANDOFF-8 — An answered form resolves and the phase finishes.** Answers land in the record, the
   phase resumes from the point that recorded them, and it works through to its own end. An answered
   form that produces another status report has spent the user's pass and returned them to where they
   started. If the answers themselves raise something new, that joins the next form rather than
   becoming an immediate question.

9. **HANDOFF-9 — A phase hands over by invitation, and only once it is clean.** When nothing is
   outstanding, close by naming what the phase produced, stating that nothing is left open, and
   inviting the next phase by the name the user would type — with what it will do and the one
   question it will ask. The user starts it. Entering is theirs because a phase boundary is where the
   work becomes expensive to unwind, and because an invitation is where they get to say "not this
   one" without having to undo anything. An invitation extended with items still open is not an
   invitation; it is the phase asking to be let out of its own work.

10. **HANDOFF-10 — A refusal names the core, not the place the gate noticed it.** A gate reports where
    it tripped, and where it tripped is rarely what broke. Before anything is returned, resolve what
    actually went wrong and say which kind it is: the run's own to repair, a decision, a resource or
    a sub-run. "Hash mismatch, blocked" is a true sentence that leaves nobody able to act — the hash
    moved because a shared file was rewritten under the run, and that is a resync the run can do and
    a sentence the user can answer.

11. **HANDOFF-11 — A refusal is scoped to the seam that broke, and everything clear of it lands.**
    Packets, clusters and operation folders are independent by construction, so one broken seam
    refuses its own packet and not the run. Finish, verify and report everything that does not touch
    the failure, then name the one that does with what it is waiting on. An all-or-nothing refusal
    charges a one-file problem as a whole phase redone, and that shape is what makes going back a
    phase feel like losing one.

12. **HANDOFF-12 — A return carries the finding.** Sending work back to an earlier phase names what
    changed, which recorded decision it invalidates, and the single thing that phase has to settle —
    not the whole scope reopened because one seam was wrong. The phase that found the problem holds
    the evidence for it, so it hands that evidence over rather than leaving the earlier phase to
    rediscover it.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| End a phase with work still available to it | The user is handed a status update in place of the thing the phase exists to produce | Run every proof, repair and fallback the phase owns, then speak |
| Invite the next phase with items still open | The invitation moves the phase's unfinished work onto the user without saying so | Clear or hand over every item first, then invite |
| Enter the next phase unasked | The boundary is where work becomes expensive to unwind, and an invitation is where the user can decline for free | Name the phase, say what it does and what it will ask, and let them start it |
| Skip a decision stop because the answer looks obvious | A direction, an approval and a write boundary belong to the person the run works for; a run that supplies them has replaced them | Work up to the stop, then ask it as one question |
| Halt at the first thing only the user can settle and question them about it | The run stops wherever it happened to meet the item, and each answer buys exactly one more step before the next halt | Record the item, work through everything it does not block, hand the set over as one form |
| Ask a UX or UI micro-choice inside the selected direction | The direction was chosen and the revision will be approved; a label, a glyph or an ordering raised on its own spends a round trip the approval already covers, and hands back the judgement the run was engaged for | Take it, record it in one line with the reason, and let the approval overturn it |
| Take a derived fact, a promise, a permission or a price the same way | Being overruled later does not undo a wrong destination, price or permission that already shipped | Keep it an item, with the derivation stated and the default named |
| Ask for the decision before doing the work the decision cannot change | One decision becomes two waits, and the second permits nothing the first did not | Order the phase so the question is the last thing it needs |
| Accept a bare confirmation and then ask what it approved | The record must show whether the approved thing was named before the approval or after it | Name the revision, direction or boundary inside the question |
| Ask for a resource in prose | The user can supply the file and cannot be expected to derive its format, name and destination, all of which the run already knows | Ship the exact command that places it, with the path it writes and the check that proves it landed |
| Turn a sub-run into a phase transition | The phase that needed it stops existing, and its half-finished work is rediscovered later by somebody who does not know it was ever started | Name the skill, run it when the user starts it, return and finish |
| Record refused evidence as unobtainable on its first failure | A tool that declined once halts the run on a reason no reader can decide | Take every fallback the skill names, then report what was tried |
| Report the gate's message as the finding | The gate names where it tripped, so the reader is handed a symptom and no act that would clear it | Resolve what actually broke, then say whose it is to clear |
| Refuse the whole phase for one broken seam | A one-file problem is charged as a whole phase redone, which is what makes returning feel like losing | Land every packet clear of the failure, then name the one that is waiting |
| Return work to an earlier phase as a refusal alone | The cost moves to the phase furthest from the evidence that produced it | Name the invalidated decision, the one thing to resettle, and hand the evidence over |

## Examples

### Closing a phase

Right:

```text
Preview finished. Revision 1.3 approved and sealed; nine candidate files mapped to nine target
paths; every owner state rendered and hashed. Nothing is open.

Next is starci-fe-design-apply. It confirms the write boundary with you first — four paths, printed
before anything is written — then materializes the sealed candidate and runs same-state parity.
Say the word and I start it.
```

Wrong:

```text
Revision 1.3 approved. Route to $starci-fe-design-preview... I mean Apply.
Two states still have no screenshot and the Zalo mark is missing, but Apply can pick those up.
```

The difference is whether the phase arrived clean, or handed its own unfinished work forward inside
an invitation.

### The approval question

Right:

```text
Revision 1.3 as shown — approve and seal? A no names the element and 1.4 follows from it.
```

Wrong:

```text
Does this look right?
  ... "ok"
Approve revision 1.3 as shown?
```

The difference is whether the thing being approved was named before the answer or after it.

### The three kinds of item

Right:

```text
Taken, not asked: the tile's action reads "Nhắn tin" rather than "Gửi tin nhắn" — it names the act,
and the panel below it is a thread. One line in the relationship sheet; overturn it at approval.

Three things are yours. None blocks the rest, and the rest is done.

DECISION  zalo.me/0828678897 was DERIVED from the phone number, not read from source. Every other
          contact fact is verbatim from `starci-academy/src/resources/contact.ts`.
          a) keep it, marked derived in the record  ← default in force
          b) replace with the real destination

RESOURCE  Zalo's official mark. The tile draws the `send` glyph until it lands. ICON-7 refuses the
          icon package the legacy page used, so it has to be a local file:

              curl -o src/components/leaves/Icon/brands/zalo.svg <the official asset url>

          I read it back, register `zalo` in IconName, and the tile picks it up with no further input.

SUB-RUN   The "đã học xong" badge needs a field the schema does not expose. That is
          starci-be-feature-plan — one query folder, one projection read, no new write path. It
          returns here and this candidate finishes; it does not replace this phase.
```

Wrong:

```text
Which label should the tile use — "Nhắn tin" or "Gửi tin nhắn"? Let me know and I'll continue.
```

The difference is not the number of questions. It is that the label is a choice inside the selected
direction, so it was the run's to take and the approval's to overturn, while the derived URL can be
FALSE — and being overruled after the fact does not undo a wrong destination that shipped.

### A tool refuses evidence

Right:

```text
The Browser pane would not composite. Captured every rendered state with headless Chrome instead,
per state-coverage. Hashes sealed.
```

Wrong:

```text
The Browser pane would not composite, so state evidence is measurement rather than images.
A seal needs the images.
```

The difference is whether the named fallback was taken before the proof was called unobtainable.

### Apply meets a hash that moved

Right:

```text
Materialization check: two of nine targets differ from their approved hashes.

Both are the same cause, and it is not this phase's edit. Another session rewrote
`src/components/contracts/index.ts` and replaced `branches/PressableTree` with
`branches/PressableSurface` while the seal was being taken, so the approved candidate imports a name
that no longer exists. The approved tree is unchanged; only the import moved.

Seven targets clear of that import are materialized, verified against their hashes and rendered at
their approved states. Parity holds on all seven. Resyncing the mirror and re-pointing the two
imports now, recorded as an integrationEdit. No approved decision changes, so this does not go back.
```

Wrong:

```text
verify_apply_materialization: 2 targets differ from approved hash. Blocked.
Returning to $starci-fe-design-preview for a new revision.
```

The difference is that one names what moved and keeps seven targets, and the other reports where the
gate tripped and gives back the phase.

### The write boundary

Right:

```text
Apply lock redetected. No drift.
Confirm target, branch, worktree and write boundary as printed — on yes, the vertical slice lands
and the same-state parity matrix runs without a further question.
```

Wrong:

```text
Apply lock redetected. No drift, so the boundary is unchanged from Preview. Materializing now.
```

The difference is that a production write boundary is confirmed by its owner and never inherited
into. CONTEXT-LOCK-7 is a decision stop, not ceremony.
