# Call to action

Drawn from the button canon §2, the region model's CTA anchor, and `CTA.md` — a real file inside the
source at `src/components/features/learn/CTA.md`. StarCi already keeps a CTA notebook next to the
code; this file is the framework half of it written as a rule. The psychological detail stays in
`persuasion-psychology.md`.

## The test

**Each surface has exactly ONE primary action, fired at the moment the learner has both enough
motivation and enough ease — and the copy names the OUTCOME, not the mechanism.**

## The rules

- **One primary CTA per surface**: `variant="primary" size="lg"` with a trailing `ArrowRightIcon`.
  Every other action drops to `secondary` or `tertiary`. Two buttons of the same primary size side
  by side produce decision paralysis — Hick's Law, recorded in `CTA.md` as B4.
- **The CTA lives in the CTA-anchor region** — the hero, or the sticky bar. It does not wander into
  a secondary slot: the `actions` slot of `PageHeader` is for the primary action, not for a refresh
  button or a toolbar.
- **Trigger where motivation multiplies ability** (Fogg's B=MAP). Do not fire a CTA when motivation
  is low (the value has not been seen yet, first open of the app) or when ability is low (the
  destination is vague, the path is many steps). The two levers available: fire at a **completion
  moment**, where motivation peaks — the Zeigarnik effect, see `persuasion-psychology.md` — and
  make the action one click with a clear destination.
- **The north-star CTA is "enter the course / keep learning".** Everything else — buying an AI
  pack, buying a streak freeze — is secondary, and every layout must contain at least one path back
  to a course or to content.
- **Copy is outcome, not feature.** "Mở khóa để dựng bằng chứng đi làm", not "phỏng vấn tốn AI
  credit". Outcome framing persuades where mechanism framing does not; settled in `CTA.md` as
  lever #8.
- **Sub-CTAs stay quiet.** A secondary action — retry, view details — is `tertiary`, not `lg`, and
  carries no arrow, so it reads as subordinate at a glance.

## Where it is applied

`UpNextCard` (`blocks/learn/UpNextCard`) — one accent primary, `lg` with an arrow ("Làm N thử thách
của bài này"), plus one quiet tertiary, fired at the completion moment at the end of a lesson or a
flashcard session.

`MockInterviewScorecard` — the primary CTA moved from the generic "làm lại" to a specific
destination, "ôn {weak phase} →", inside the course; retry dropped to tertiary.

`CourseCtaButtons`, `PremiumPaywall`, `PremiumGateModal` and `CourseMobileEnrollBar` — the CTA icon
was unified to `ArrowRightIcon`, replacing the cart and rocket icons.

Related: `content-linking.md` (a CTA is one form of onward path — every surface has one),
`persuasion-psychology.md`, and the layout rule requiring a funnel to courses.
