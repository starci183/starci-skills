# UX proof

This file answers one question: a person sat down with the running product and tried to get something
done, so did they get it done? Canon decides who owns a value, taste decides what the composition adds
up to, and this topic decides whether the surface was usable by someone who came to it with a task and
not with a rule book. A surface can be owned correctly, look convincing in a still frame, and still
strand the person who needed it, which is why the evidence here is a run rather than a screenshot.

The instrument is normally the UAT run: `uat.verify` drives one frozen flow at the pinned commit and
judges the `ux` lane on its own captures, so an `Observe` cell names a step of a real attempt — the
assertion that was reached, the number of steps it took, the latency between an activation and the
first visible change, the state after a refresh. Where a criterion is settled by a single render and
needs no attempt, `interface.audit` may measure it from a capture it already took; each rule
below names which of the two instruments answers it. Neither instrument may substitute intent for
observation: an approved flow document does not prove a completed task, and a spinner in the markup
does not prove a progress signal ever appeared.

Sources: the owner ruling that everything needed to decide whether a surface has passed must be a rule
with a threshold, that UX is judged on a task run rather than a static screenshot, and that an average
may never hide a fatal; plus two anonymised flows, a sign-in and a purchase, scored end to end in
[the UX scorecard evidence](../../../tests/evidence/20260903-ux-scorecard.md).

## UX-1 — The task completes

Governs whether the flow's declared goal was actually reached, unaided. Measured in a UAT run; a
failure routes to the flow owner, because only a person decides what the flow was for.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | The run reaches the flow's terminal assertion | The goal state named in `flow.md` is present in the capture and in the store. A run that ends on the last screen without the record the goal names falsifies it |
| Case 2 | The run is driven with no operator knowledge beyond what the surface shows | Every step was chosen from a visible label, and no step required a URL typed by hand, a console command, or a hint from the flow author. One such intervention falsifies it |
| Case 3 | The flow declares an alternate path such as a decline, a cancellation or a retry | That path also reaches a named terminal assertion. A branch that runs out of screens falsifies it |
| Case 4 | The task completes | It completes within the flow's declared time budget from first activation to terminal assertion. Exceeding the budget is recorded as a fail with the measured duration, not waived |

Not this rule: whether the backend actually performed the work is the `behavior` lane, not this one.

## UX-2 — Steps stay inside the flow's budget

Governs how much work the person had to do to finish. Measured in a UAT run against the budget the
flow declares, and against the class band this rule owns; a failure routes to `direction`.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | The run completes | The count of committed steps — each navigation, submission or confirmation the person had to perform — is at most the budget `flow.md` declares for that flow. Exceeding it falsifies it |
| Case 2 | The flow declares no budget | The class band applies instead and the receipt names it: on a `console` any action the surface owns is at most three steps from entry; on a `form` at most three for a single purpose and at most seven for a declared multi-step flow; on a `landing` conversion is at most two; on a `catalog` list to detail is exactly one step and the return one; on a `reader` the return to the origin list is one. A run scored against no number at all is void |
| Case 3 | Two steps are compared | No step exists only to acknowledge the previous one. An interstitial confirming a non-destructive action falsifies it |
| Case 4 | The same task is repeated by a returning person in the run | The repeat costs no more steps than the first attempt: nothing the person already supplied is asked again |

Not this rule: which actions the surface offers at all is [CTA-1](../composition/cta.md).

## UX-3 — A wrong input is corrected in place

Governs recovery: the person made a mistake, and what it cost them. Measured in a UAT run; a failure
routes to `direction`.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | The run submits a deliberately wrong value | The correction is made at the field that holds the wrong value, and the flow reaches its terminal assertion within two further steps. Restarting the flow to fix one field falsifies it |
| Case 2 | The error render is captured | Every value the person had already entered is still present and still editable. One cleared field falsifies it |
| Case 3 | The wrong value is a destructive or paid commitment | An undo, a cancellation or a reversal is reachable from the terminal screen, and the run exercises it. A commitment with no way back falsifies it |
| Case 4 | The error message is read from the capture | It names the offending field and the accepted form, so the second attempt is informed. A message stating only that something is invalid falsifies it |

Not this rule: which owner the error belongs to is [FEEDBACK-1](../composition/feedback.md), and
whether the message is announced to assistive technology is [A11Y-1](accessibility.md).

## UX-4 — The surface answers within the latency bands

Governs whether the person ever waited without knowing they were waiting. Measured in a UAT run by
timing from activation to rendered change; a failure routes to `direction`, because the missing signal
is a composition problem even when the slow work is not.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | Any control is activated | A visible change occurs within `100ms` — a pressed treatment, a disabled control, a pending indicator. No change inside that window falsifies it |
| Case 2 | The work outlasts `1s` | A progress signal is showing by then, and it sits on the initiator or the region that will change. Progress announced only in a corner toast falsifies it |
| Case 3 | The work outlasts `10s` | A way out is present and operable: a cancel, a background option, or a stated expectation with an escape. A frame that only spins past ten seconds falsifies it |
| Case 4 | The progress signal is compared with the outcome | The signal ends when the outcome is known, and never claims settlement before the store confirms it, as [TRUTH-3](render-truth.md) requires |

Not this rule: whether pending sits on the initiator by design is
[ACTION-2](../composition/action.md), and whether the pending treatment is visible in a still capture
is [TASTE-11](taste.md).

## UX-5 — The destination is findable

Governs whether the person could locate what they came for. Measured in a UAT run for the flow's own
destinations, and from an audit capture for the navigation the surface exposes at rest; a failure
routes to `direction`.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | The run navigates to the flow's destination | It is reached within the navigation depth the declared class allows: two levels on a `console`, `catalog` or `reader`, one on a `form` or a `landing`. A level beyond it, or a search that was the only route, falsifies it |
| Case 2 | The navigation labels are read from the capture | Each label is the word the person used for the thing, not the internal name of the module. A label naming a service, a table or a release falsifies it |
| Case 3 | The destination is reached | The surface states where the person is: the active navigation item, the heading and the address agree. Two of the three disagreeing falsifies it |
| Case 4 | A destination is reachable by more than one route | The routes land on the same surface in the same state. Two routes producing two different renders of the same destination falsifies it |

Not this rule: which regions exist and who owns them is [LAYOUT-1](../composition/layout.md).

## UX-6 — No dead ends

Governs every state the run can land in. Measured in a UAT run, and from an audit capture for the
static empty, error and success renders; a failure routes to `direction`.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | Any state the run reaches is captured | It offers at least one next action or one way back, both operable. A screen whose only exit is the browser's own control falsifies it |
| Case 2 | The empty state is reached | The action that ends the emptiness is present and reachable in the same region. An empty state that only explains falsifies it |
| Case 3 | The terminal success state is reached | It names what happens next or returns the person to a working surface. A confirmation screen that goes nowhere falsifies it |
| Case 4 | An error or permission refusal is reached | It offers a retry, an alternative, or the contact that can resolve it, and the run exercises the offer |

Not this rule: whether absence is rendered completely is [STATE-3](../composition/state.md), and
whether the state has a designed composition is [TASTE-10](taste.md).

## UX-7 — Place survives back, refresh and a shared link

Governs continuity: the person left and came back. Measured in a UAT run; a failure routes to the flow
owner, because where a route may be resumed is a product decision.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | The run presses back mid-flow | The previous step returns with its entered values intact, and no step is silently re-committed. A back that restarts the flow falsifies it |
| Case 2 | The run reloads the current step | The same step renders, with the same selection, filter or tab, and nothing the person entered before the last commit is lost |
| Case 3 | The address of a mid-flow step is opened in a fresh session | It either resumes at that step or states plainly why it cannot and where to start. A blank surface or a silent redirect to the root falsifies it |
| Case 4 | The run leaves for another surface and returns | Scroll position, expanded groups and the active view are as they were left, unless the flow declared otherwise |

Not this rule: which choices are persistent peers is [STATE-6](../composition/state.md).

## UX-8 — The form can be filled

Governs the ergonomics of every field the run touches. Measured from an audit capture for structure
and order, and in a UAT run for the keyboard and autofill passes; a failure routes to `direction`.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | Each field is captured | It carries a persistent visible label, not a placeholder standing in for one. A label that disappears on typing falsifies it |
| Case 2 | A field is rejected | The message renders adjacent to that field and stays while the field is corrected. A single summary at the top with no field-level mark falsifies it |
| Case 3 | The form is filled with the keyboard alone | Tab order equals reading order, the submit control is reachable, and Enter submits from a single-line field. A trap or a skipped field falsifies it |
| Case 4 | A known field type is measured — email, name, address, one-time code, payment | It declares the autofill and input-mode hints the platform expects, and the browser offers the stored value in the run. A numeric field raising an alphabetic keypad falsifies it |

Not this rule: whether the field's accessible name and relationships are computed is
[A11Y-1](accessibility.md), and whether focus is visible is [FOCUS-1](focus.md).

## UX-9 — The primary action is in reach on a phone

Governs whether the surface can be driven one-handed. Measured from an audit capture at the narrow
viewport; a failure routes to `direction`.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | The surface is captured at its narrowest declared viewport | The step's primary action sits in the lower half of the frame, or in a sticky bar pinned to the bottom edge. A primary action only reachable after scrolling past the fold falsifies it |
| Case 2 | A sticky action bar is present | It does not cover content the person still needs: the last content row remains fully visible above it. Content permanently hidden behind the bar falsifies it |
| Case 3 | Destructive and primary actions sit in the same reach zone | They are separated by at least one target width, so a thumb cannot hit the wrong one. Adjacent confirm and delete falsifies it |
| Case 4 | Targets in the reach zone are measured | Each meets the minimum size [A11Y-4](accessibility.md) names, at that viewport, including its padded hit area |

Not this rule: what survives when space shrinks is [RESPONSIVE-1](../composition/responsive.md).

## UX-10 — The same verb sits in the same place

Governs consistency across the surfaces one flow crosses. Measured across the run's captures; a
failure routes to `direction`.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | One action appears on two surfaces of the run | It carries the same verb in both. The same operation labelled Save on one screen and Update on the next falsifies it |
| Case 2 | Two surfaces of the same class are compared | The primary action occupies the same position relative to its region. A primary at the top right on one and the bottom left on the next falsifies it |
| Case 3 | A control's shape is compared across the run | The same consequence carries the same emphasis every time, as [CTA-1](../composition/cta.md) settled. A destructive action rendered as a quiet link on one surface falsifies it |
| Case 4 | An interaction pattern repeats — a picker, a confirmation, a filter | It behaves the same way each time it appears in the run |

Not this rule: which action deserves the dominant accent is [ACCENT-1](../composition/accent.md).

## UX-11 — The words say what the thing is

Governs the copy the run actually read. Measured from the run's captures; a failure routes to the flow
owner, because copy authority is not the designer's to change.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | Labels and headings are read from the captures | They are nouns naming the thing, and controls are verbs naming the effect. A control reading Information, or a heading reading Manage, falsifies it |
| Case 2 | A number, a date or a status renders | It carries the unit, the currency, the timezone or the scale that makes it a fact. A bare figure whose meaning depends on the reader's guess falsifies it |
| Case 3 | The captures are scanned for stub copy | No placeholder text, no untranslated key, no lorem, no debug string, and no truncated sentence survives in any state the run reached |
| Case 4 | The same concept appears twice in the run | It is named identically both times. Two names for one object in one flow falsifies it |

Not this rule: whether the claim traces to real authority is [TRUTH-1](render-truth.md).

## UX-12 — Scoring and the UX verdict

Governs how the criteria above become one decision.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | The UX lens runs | Every criterion from `UX-1` to `UX-11` carries a pass or fail and a score from 1 to 5, each backed by the run step or the capture its own rule names |
| Case 2 | The verdict is computed | `ship` requires no fail on `UX-1`, `UX-3`, `UX-4`, `UX-6` or `UX-7`, and a mean score of at least 4 across the eleven. Anything else is `fix-first` |
| Case 3 | A gating criterion fails while the mean is at least 4 | The verdict is `fix-first` regardless of the mean. A receipt shipping on the average alone falsifies the lens |
| Case 4 | A criterion's evidence is a screenshot with no attempt behind it, for a rule this file assigns to a run | The entry is `EVIDENCE_UNAVAILABLE`, not a pass and not a fail, and the lens is incomplete |
| Case 5 | A failure is routed | It goes to the destination its own rule names — `direction` for a composition failure, the flow owner for a failure of intent, authority or copy — and never to `resolve`, because no value swap repairs a flow |

The scored set is `UX-1` to `UX-11`; this rule is the arithmetic and is not itself scored. The five
criteria that gate `ship` are the ones that strand a person mid-task: the task never finishes, the
mistake cannot be undone, the wait is unexplained, the state has no exit, or the place is lost on the
way back. A score of 3 means the criterion was met without conviction, so a flow that never actually
fails can still be `fix-first` on the mean, which is the intended outcome for a flow that merely
works. UX findings never carry a canon base verdict and never become a `grammar-gap`. The scored
result is the `ux` lane of the run record, and it is the `experience` row of every `## Verdict` table
downstream of it.

## What this file does not decide

Whether the product performed the work is the `behavior` lane of the run, not a knowledge rule.
Whether the render is perceivable and operable is [Accessibility](accessibility.md) and
[Focus](focus.md), whether distinctions survive measurement is [Contrast](contrast.md), whether
movement keeps meaning is [Motion](motion.md), whether the rendered claim traces to authority is
[Render truth](render-truth.md), and whether the composition is good enough to look at is
[Taste](taste.md). Which rank, action, region, state or emphasis the direction chose is
[Hierarchy](../composition/hierarchy.md), [CTA](../composition/cta.md),
[Layout](../composition/layout.md), [State](../composition/state.md) and
[Accent](../composition/accent.md). How the lenses combine into one shippable verdict is
[the scorecard](ui.md).
