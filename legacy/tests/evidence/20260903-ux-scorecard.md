# Evidence — the UX lens and the scorecard, 2026-09-03

Knowledge rules are product-agnostic, so the evidence behind `knowledge/ui/proof/ux.md` and
`knowledge/ui/proof/ui.md` lives here. `ux.md` publishes `UX-1` to `UX-12`; `ui.md` publishes `UI-1` to
`UI-11`. Every criterion below is stated as a measurement taken from a run or from a capture, not as an
opinion about a product, and both worked flows are anonymised.

## Evidence 1 — the owner ruling

The owner asked one question of a finished surface — has it passed or not — and refused every answer
that was not a number. Five things follow, and they are the reason these two files exist rather than a
checklist.

| # | What the ruling settles | Consequence in the topics |
| --- | --- | --- |
| 1 | Everything needed to decide pass or fail must be written as a rule with a threshold | Each `UX-n` names a count, a duration, a level or a step budget, and each `UI-n` names the identifier set it scores |
| 2 | UX is judged on a task run, never on a static screenshot | `UX-12` Case 4 makes a screenshot-only score for a run-measured criterion `EVIDENCE_UNAVAILABLE`, and `UI-8` Case 2 makes a scorecard with no run `blocked` |
| 3 | An average never hides a fatal | Both scoring rules carry a gating set that overrides the mean: `UX-12` Case 3 and `UI-10` Case 1 |
| 4 | Thresholds differ by surface class | `UI-9` gives five classes their own density band, accent count, navigation depth and steps budget, and a surface with no declared class is `blocked` |
| 5 | The scorer is not the author | `UI-11` splits the lenses: the audit agent writes `UI-1` to `UI-7`, the uat agent writes `UI-8`, `quality.verify` only combines, and a person is the court of appeal |

## Evidence 2 — an anonymised sign-in flow

A single-purpose authentication surface, product name deliberately omitted, class `form/auth` under
`UI-9` Case 2. The canon and accessibility lenses were clean and the taste lens scored 4. The run was
driven once correctly and once with a deliberately wrong password.

| Criterion | What the run showed | Verdict |
| --- | --- | --- |
| `UX-1` | The session existed in the store and the terminal assertion was reached with no hint from the flow author | pass, 5 |
| `UX-2` | Three committed steps against the class budget of three: open, submit, land | pass, 4 |
| `UX-3` | The wrong password cleared both fields and returned the person to an empty form, so the correction cost a full retype rather than one edit | fail, 2 |
| `UX-4` | The submit control showed a pending treatment at about 80ms and the outcome landed inside 1s | pass, 5 |
| `UX-5` | One navigation level from the entry surface; the heading, the active item and the address agreed | pass, 4 |
| `UX-6` | The locked-account state offered no retry, no alternative and no contact: the only exit was the browser control | fail, 1 |
| `UX-7` | Refresh preserved the entered identifier; a mid-flow address opened in a fresh session stated why it could not resume | pass, 4 |
| `UX-8` | Labels persisted, the keyboard pass reached submit, but the one-time-code field declared no autofill hint and raised an alphabetic keypad | fail, 3 |
| `UX-9` | Primary action in the lower half at the narrow viewport, targets above the minimum | pass, 4 |
| `UX-10` | The same verb on both surfaces, same position | pass, 5 |
| `UX-11` | One heading read Manage rather than naming a thing; no stub copy anywhere | pass, 3 |

Mean across the eleven was roughly 3.6, and two gating criteria failed, so `UX-12` Case 2 returns
`fix-first` and the scorecard is `fix-first` under `UI-8` Case 3 even though every audit lens shipped.
This is the case that fixes the gate list: an error that cannot be corrected in place and a state with
no exit both strand a person who has already committed effort, which no other criterion catches.

## Evidence 3 — an anonymised purchase flow

A multi-step commerce checkout, product name deliberately omitted, class `form/auth` for the checkout
steps and `list/catalog` for the surface it started from. The run completed the purchase and then
attempted a reversal.

| Criterion | What the run showed | Verdict |
| --- | --- | --- |
| `UX-1` | The order record existed and the terminal assertion was reached; the decline branch also reached a named terminal | pass, 5 |
| `UX-2` | Nine committed steps against the declared multi-step budget of seven; two of them were interstitials confirming non-destructive choices | fail, 2 |
| `UX-3` | A rejected card number was corrected in the field, with every other value preserved, and the flow finished two steps later | pass, 5 |
| `UX-4` | Payment authorisation ran about 14s with a spinner and no cancel, no background option and no stated expectation | fail, 2 |
| `UX-5` | Checkout was two navigation levels from the catalog; the labels were the words a buyer uses | pass, 4 |
| `UX-6` | Every state including the declined payment offered a next action | pass, 4 |
| `UX-7` | Back from the payment step re-submitted the address step silently, producing a second address record | fail, 1 |
| `UX-8` | Inline errors adjacent to their fields, autofill offered for name, address and card | pass, 5 |
| `UX-9` | The confirm and the remove-item controls sat adjacent in the bottom reach zone, under one target width apart | fail, 3 |
| `UX-10` | The cart action read Remove on the list and Delete in the summary | fail, 3 |
| `UX-11` | Totals carried currency and the tax basis; no stub copy | pass, 4 |

Mean across the eleven was roughly 3.5, with `UX-4` and `UX-7` failing out of the gating set, so the
verdict is `fix-first`. The silent re-commit on back is the case that makes `UX-7` gating rather than
merely scored: it did not lose the person's place, it duplicated a real record, and no other lens in
the tree would have seen it.

## Why the thresholds are the numbers they are

| Threshold | Where it comes from |
| --- | --- |
| `100ms`, `1s`, `10s` (`UX-4`) | The three bands at which a person stops perceiving an action as instant, starts needing a signal, and starts needing an escape; the purchase flow crossed the third with nothing offered |
| Two further steps to recover (`UX-3`) | One step to correct the value and one to resubmit; the sign-in flow needed a full retype and was rejectable without argument |
| Two navigation levels (`UX-5`) | Both anonymised flows reached every destination they needed in two; a third level appeared only where a module name had been used as a label |
| Steps budget of three, and seven for a declared multi-step flow (`UI-9` Case 2) | The sign-in flow finished in three; the checkout declared seven and spent nine, and both extra steps were acknowledgement interstitials |
| Mean of at least 4, gating set overriding it (`UX-12`) | Both flows scored around 3.5, which is a flow that works and disappoints; neither could be allowed to ship on the average |
| Density bands per class (`UI-9`) | Carried over from `TASTE-9`, which already fixed sixty percent for a console and the reverse for a landing page; the intermediate classes are interpolations this file records as provisional |

## Open questions, deliberately not turned into rules

These were raised while writing the two topics. None has a measurable rule yet, and inventing one
would put a number in knowledge that no evidence supports.

| Question | Why it is not a rule yet |
| --- | --- |
| Performance beyond feedback latency — first paint, interaction latency under load, payload budgets | `UX-4` measures what a person perceives at the surface. A performance lens would need budgets per class and a load profile, and neither exists in the tree yet |
| Feedback beyond `FEEDBACK-1` to `FEEDBACK-3` and `UX-4` — the tone, timing and dismissal of notifications | The composition rules settle the owner and the run settles the latency; nothing measurable is published about how long a message should persist |
| Internationalisation and locale — text expansion, right-to-left mirroring, locale-specific formats | `UX-11` Case 2 requires the unit and the scale, but no rule covers a layout under a longer translation, and no capture matrix cell exists for locale |
| Data density beyond `TASTE-9` — table column counts, pagination thresholds, sort and filter affordances | The list class band in `UI-9` names density and depth only; the rest would need evidence from more than one catalog surface |
| The intermediate density bands in `UI-9` Cases 2, 4 and 5 | Interpolated from the two ends `TASTE-9` fixed, not measured. They should be re-derived once three surfaces per class have been scored |
