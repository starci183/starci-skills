# Front end — design principles

Foundations decide which value an element gets. This shelf decides **what the interface is allowed to
say and do at all** — whether a thing is clickable, whether a claim is true, whether a screen has one
primary action or three, whether accent means anything. These are the judgements a type checker and a
gate cannot reach, which is exactly why they are written as prose with the reason attached.

Several files here are umbrellas that absorbed narrower rules and kept the narrow ones in place as the
case-by-case detail. Where two files overlap, the umbrella states the test and the narrow file states
the ruling that produced it.

| File | Decides |
|---|---|
| [`accent-system.md`](accent-system.md) | that accent is a signal rather than a surface — the four roles that may carry it, one channel per element, and that it never encodes status |
| [`accessibility.md`](accessibility.md) | the single baseline a new component is checked against: works without colour, works from the keyboard, and is not silent to a screen reader |
| [`advanced-tech-flexes-capability-not-decoration.md`](advanced-tech-flexes-capability-not-decoration.md) | that heavy technology — 3D scenes, node graphs, live canvases — earns its place by serving a real purpose and demonstrating capability at once, and is cut when it is only beautiful |
| [`affordance-and-feedback.md`](affordance-and-feedback.md) | the umbrella over hover affordance and waiting states: the interface never goes silent, and every region handles loading, empty and error explicitly |
| [`call-to-action.md`](call-to-action.md) | that each surface has exactly one primary action, fired when motivation and ease are both present, with copy naming the outcome rather than the mechanism |
| [`card.md`](card.md) | when to build a card at all, and the ban on two bordered surfaces stacked directly against each other with the three correct shapes when the second thing is secondary |
| [`content-linking.md`](content-linking.md) | that no screen is a dead end — every surface offers a way onward, and every reference to another entity is clickable and carries the right intent |
| [`content-voice.md`](content-voice.md) | how a UI string reads: Vietnamese translated by meaning rather than word for word, both locales complete, no emoji, no uppercase |
| [`design-restraint.md`](design-restraint.md) | that a screen carries exactly the visual weight it needs, and everything decorative, repeated or vanity gets cut |
| [`grounded-in-data.md`](grounded-in-data.md) | that the interface is built for the data that actually exists, nulls and blanks included, rather than for the ideal schema nobody has filled in |
| [`heatmap-trong-la-bug-token-khong-redesign.md`](heatmap-trong-la-bug-token-khong-redesign.md) | that a flat or washed-out element is an undefined CSS token until proven otherwise — inspect the computed style before proposing a redesign |
| [`hover-style-matches-clickable-nature.md`](hover-style-matches-clickable-nature.md) | which kind of hover a target gets, decided by whether the action goes there or stays here: underline for navigation, fill for selection in place |
| [`interactive-needs-hover.md`](interactive-needs-hover.md) | that anything clickable, openable or navigable has a hover response and a hand cursor, because an element that does something and shows nothing is indistinguishable from text |
| [`landing-marketing.md`](landing-marketing.md) | the rules shared by every public selling surface — what the design may assume about data, how it is positioned, which visualisation it may reach for, and how the copy reads |
| [`no-emoji.md`](no-emoji.md) | that emoji are banned in product text, and that a genuinely needed symbol is a phosphor icon which takes the system's colour and size tokens |
| [`no-uppercase-text.md`](no-uppercase-text.md) | that hand-typed caps and `uppercase` are banned outside spots individually approved, and that text stays as the i18n source wrote it |
| [`persuasion-psychology.md`](persuasion-psychology.md) | which persuasion techniques are legal — only those whose claim is true and checkable against a real back-end field — and the ethical boundary on each |
| [`progressive-disclosure.md`](progressive-disclosure.md) | when something is hidden behind a summary row and opened on demand, across drawer, accordion, modal and see-more alike |
| [`resume-cta-only-when-away.md`](resume-cta-only-when-away.md) | that a resume CTA renders only when the reader is not already on the task it would link to |
| [`single-source-render.md`](single-source-render.md) | that a quantity shown in several places — price, progress, status, rating — has exactly one shared component rendering it, computation included |
| [`visual-hierarchy.md`](visual-hierarchy.md) | that rank comes from size, weight and colour inside one system, never from adding a border, a background or another box to emphasise something |
| [`whitespace-over-dividers.md`](whitespace-over-dividers.md) | that stacked sections are separated by gap rather than by a rule, and the two narrow cases where a divider is still correct |

## Reading order

There is none, but the umbrellas are the cheaper entry: `affordance-and-feedback`, `design-restraint`,
`content-voice`, `grounded-in-data` and `visual-hierarchy` each state a test in one line and point at
the narrow files under them. Read the umbrella when deciding, the narrow file when arguing.
