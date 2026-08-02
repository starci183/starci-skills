# Persuasion psychology — honest only

Persuasion is a real part of interface design, and it has a literature: Cialdini's influence
principles, Fogg's behaviour model, Kivetz's goal-gradient work, the Zeigarnik effect, and Eyal's
habit loop. This file states them as rules for building surfaces, and draws the line each one has to
stay behind.

## The rule of thumb

**A persuasion technique is legal only when what it says is TRUE and checkable against the back
end.** There is no exception for "it converts better if we make it up".

## The frameworks, and what an honest implementation looks like

| Framework | Mechanism | Honest form |
|---|---|---|
| Cialdini — scarcity | A scarce thing is priced and valued higher | A real remaining-stock or seat count, and a real scheduled price change; the whole element is HIDDEN when supply is unlimited |
| Cialdini — social proof | A crowd lowers perceived risk | Real counts and real reviews on the pricing page; the number is gated below a minimum rather than padded |
| Cialdini — authority | Expertise and provenance raise perceived value | A named author with checkable credentials, a published audit, a public repository |
| Cialdini — consistency | Consistent behaviour pulls further commitment | A progress indicator over work the person genuinely did — steps completed, days used |
| Cialdini — reciprocity | Receiving first creates an obligation to return | A free tier or preview that gives real value before the paywall, cut at a natural boundary rather than mid-sentence |
| Cialdini — liking | Liking opens the reader up | A consistent voice and persona — [[content-voice]] |
| Fogg B = M·A·P | Action needs motivation, ability and a prompt at once | The next-step card fires at the completion moment (high motivation) with one unambiguous, one-click target (high ability) — see [[call-to-action]] |
| Goal-gradient (Kivetz) | Motivation rises non-linearly near the goal | A progress meter framed as "two steps left" (near the goal) rather than "three done" (far from it) |
| Zeigarnik and peak-end | Unfinished work creates tension that pulls the reader back; memory keeps the peak and the end | The next-step prompt sits at the END of a task, riding a positive ending, rather than interrupting mid-flow |
| Hook (Eyal): trigger → action → reward → investment | The habit loop | A daily prompt, a completing action, an immediate reward, and something accumulated that would be lost by leaving |

## How it is executed

**Every field used to persuade points at a real back-end source.** A count, a remaining quantity, a
quota and a completion total are all genuinely queried. No hardcoded or decorative number reaches the UI: a
scarcity note renders only when the remaining quantity actually exists, and it never simulates a
countdown that resets on reload.

**One focal point per screen** (Von Restorff). The primary call to action is the single solid accent;
making everything stand out means nothing does — [[accent-system]].

**Ambient pressure at the right dose** — one thin strip, in the same place, without blinking and
without repeating across several overlays. Mere exposure over-applied becomes banner blindness and
works against you.

## The boundary — absolutely forbidden

Fake scarcity and fake social proof (a countdown with no deadline behind it, an invented user count);
a fake loss threat, where the copy implies work will be destroyed when in truth only a feature locks,
so the message is "unlock the rest", not "save what you have"; confirmshaming, where the decline
option is worded to make the reader feel small; and a nag loop that cannot be dismissed. These are
the deceptive patterns catalogued by Brignull and increasingly named directly in consumer-protection
law, and they are forbidden here even where they measure as more effective — a technique that only
works while the reader is mistaken stops working the moment they are not.

**North star:** persuasion points the person toward the REAL value the product delivers — the work
they came to do, the outcome they can verify — and never toward inflating a number that money bought.

## Related

[[call-to-action]] · [[content-linking]] · [[accent-system]] (one focal point per screen) ·
[[grounded-in-data]] (numbers come from real data).
