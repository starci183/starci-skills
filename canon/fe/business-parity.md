# business-parity — the back end owns the business rule; the front end obeys it

A business rule has exactly one home, and it is the back end. Who may enrol, what a thing costs, how
much a completed lesson is worth, when an action is allowed — these are decided by a resolver, a
validation, a gate in the server, and the front end's job is to **reflect** that decision, never to
invent one beside it. Two copies of a rule drift the moment either side changes, and the drift is
invisible until a user hits the seam: a button the server will reject, a price the client made up, a
total that disagrees with the one the API returns.

So the rule is one sentence:

**Where the back end defines a business rule clearly, the front end reads it from the API and honours
it exactly. Where the back end is silent or ambiguous, the front end does not invent a rule quietly —
it surfaces the gap and asks.**

The contract the front end honours is the back end's own — `canon/be/explore/system-design/api-design.md`
for the shape of what the server returns, and the resolver or validation for the rule itself.

## What "honour it" means in the code

- **A value the server owns is read, not written.** A price, an XP amount, a threshold, a percentage,
  an enum of allowed states — these come down from the API. The front end does not hardcode the number,
  because the day the server changes it, a hardcoded copy is a lie the reviewer cannot see.
- **An action the server would reject is not offered as if it would succeed.** If the resolver refuses
  an enrol unless the user has paid, the enrol control is gated on the paid state the API already
  returns — not left enabled to fail on submit. A dead action is worse than a disabled one, because the
  user spends effort on it first.
- **State is derived from the server's truth, not recomputed.** If the back end says a submission is
  `graded`, the front end shows graded — it does not re-run the grading rule client-side and risk a
  different answer.

## How it is enforced — two halves, because the rule has two halves

- **The mechanical half is a gate.** `scripts/gates/check-fe-business-constants.mjs` flags a business
  value hardcoded in front-end source — a price, an XP number, a threshold, a business percentage,
  a business enum — where it should have been read from the API. A number a script can recognise as
  business-owned and find written into a component is a red build.
- **The semantic half is a review axis.** Whether a surface's *behaviour* honours the rule — the gate
  on the action, the state it derives, the flow it allows — is not something a script can read out of
  source; it needs the rule and the surface read together and compared in meaning. That is the
  business-parity axis of `starci-fe-review-scan`, and the fix is `starci-fe-review-apply`.

A build skill (`starci-fe-layout-brainstorm`, `starci-fe-layout-apply`) honours this while building;
the review pair checks and fixes it after. The gate catches what can be counted; the review catches
what must be understood.
