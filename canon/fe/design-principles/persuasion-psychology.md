# Persuasion psychology — honest only

Taken from `src/components/features/learn/CTA.md`, a real file in the tree in which StarCi wrote its
own handbook of persuasion techniques, each one grounded in an actual back-end field and each with an
explicit ethical boundary. This file is that handbook stated as rules and widened from the
course-purchase CTA to the whole app.

## The rule of thumb

**A persuasion technique is legal only when what it says is TRUE and checkable against the back
end.** There is no exception for "it converts better if we make it up".

## The frameworks, and what they are already built as here

| Framework | Mechanism | What StarCi built |
|---|---|---|
| Cialdini — scarcity | A scarce thing is priced and valued higher | `PhaseScarcityNote` — a real seat cap and a real price increase (`coursePricePreview`), HIDDEN when there is no cap (`seatsRemaining == null`) |
| Cialdini — social proof | A crowd lowers perceived risk | `StatStrip` / `CourseTrustStats` on the landing page (real learner, lesson and course counts); `TopLearners` / `LeaderboardPodium` (the real leaderboard) |
| Cialdini — authority | Expertise and exclusivity raise perceived value | `SelfHostGpuMark` (self-hosted GPU, stated rather than buried in a technical prompt); `FounderCard` (build-in-public, a real founder) |
| Cialdini — consistency | Consistent behaviour pulls further commitment | `StreakStrip` / `StreakFreezeCard` (keeping the daily streak alive) |
| Cialdini — reciprocity | Receiving first creates an obligation to return | The premium preview cuts off at "Kiểm thử" — real learning is given away before the lock |
| Cialdini — liking | Liking opens the reader up | The mascot and rank persona system, and the teacher-to-student voice in content-voice |
| Fogg B = M·A·P | Action needs motivation, ability and a prompt at once | `UpNextCard` fires its CTA at the completion moment (high motivation) with a one-click, unambiguous target (high ability) — see [[call-to-action]] |
| Goal-gradient (Kivetz) | Motivation rises non-linearly near the goal | `WeeklyGoals` plus `ProgressMeter` / `SegmentBar`; framed as "còn N bài" (near the goal) instead of "đã đọc N" (far from it) |
| Zeigarnik / peak-end | Unfinished work creates tension that pulls the reader back; memory keeps the peak and the end | `UpNextCard` sits at the END of each surface (end of lesson, end of session), riding a positive ending rather than interrupting mid-flow |
| Hook (Eyal): trigger → action → reward → investment | The habit loop | `DailyQuest` (daily trigger) → completion (action) → XP (reward) → accumulated streak (investment) |

## How it is executed

**Every field used to persuade points at a real back-end source** — seat count, enrollment count, XP
and streak are all genuinely queried. No hardcoded or decorative number in the UI: `PhaseScarcityNote`
renders only when `seatsRemaining` actually exists, and it never simulates a countdown.

**One focal point per screen** (Von Restorff). The primary CTA is the single solid accent; making
everything stand out means nothing does — [[accent-system]].

**Ambient pressure at the right dose** — one thin strip, in the same place, without blinking and
without repeating across several overlays. Over-applied mere exposure becomes banner blindness and
works against you.

## The boundary — absolutely forbidden

Fake scarcity or fake social proof (a fake countdown, an invented learner count); a fake
progress-loss threat (free progress is NOT deleted when a trial ends — only the extended part locks,
so the copy says "mở tiếp", not "giữ lại"); confirmshaming; and a nag loop that cannot be dismissed.
All are forbidden even where they measure as more effective. These are tied hard to the fair
monetization axiom.

**North star:** persuasion here always points the learner toward REAL learning — capstones,
challenges, code, evidence someone can check — and never toward "pay to raise a number". That is the
asymmetric-fairness rule: no scalar inflates just because more was purchased.

## Already applied

`PhaseScarcityNote` (`blocks/commerce/PhaseScarcityNote`) — real scarcity, hidden when supply is
unlimited. `TrialConversionStrip` (`features/learn/CourseContents`) — loss aversion, goal gradient
and scarcity combined into one thin strip, shown only to trial users. `UpNextCard` — the Fogg trigger
plus Zeigarnik/peak-end at the completion moment. `AiQuotaCard` — the real quota (remaining5h/Week)
rendered through `ProgressBar`, with no invented numbers.

## Related

[[call-to-action]] · [[content-linking]] · [[accent-system]] (one focal point per screen) ·
[[grounded-in-data]] (numbers come from real data).
