# Content linking: no screen is a dead end

Drawn from the places where the product already joins two pieces of content deliberately:
`EntityLink` and `EntityToken` (references in the feed), the back link and breadcrumb rules in the
header canon §3, the CTA loop described in section B of `CTA.md` around `UpNextCard`, and the two
product rules that a surface lands on its dashboard rather than auto-forwarding, and that continue
resumes content rather than jumping to the capstone.

## The test

**No screen is a dead end. Every surface offers a way onward — funnel, resume, or related — and
every reference to another entity is clickable and carries the right intent.**

## The rules

- **Every surface has at least one onward path.** With content, that is the next CTA (resume or
  continue). Empty is not a dead end either: it is a funnel back to a course or to content,
  `[Vào khóa học →]`.
- **A reference to another entity — a user, a lesson, a course, a challenge — inside prose or a
  feed is a real link, not static text.** `EntityLink` in the feed renders bold and clickable; when
  the target cannot be resolved (deleted, or an error) it falls back to **bold plain text** rather
  than rendering a dead link that pretends to be clickable. `EntityToken` on the dashboard resolves
  the route through the global id before navigating.
- **A deep link carries an INTENT, not just an address.** The mock-interview scorecard points at
  the module or phase it just measured as **weakest** (`weakestPhase` becomes `studyHref`), not at
  the generic course page. The learner arrives somewhere for a reason that was computed for them.
- **Resume stays inside the scope of the surface it is on.** The content home resumes the next
  piece of content and does not jump to the capstone; a surface that has its own dashboard lands on
  that dashboard rather than auto-forwarding into a single item.
- **Backward navigation has exactly one affordance** — a breadcrumb chain for a browsing page, a
  single back link for a leaf page such as a solution or a result. The user is never left unsure
  which way is out.
- **An empty state is a path, not a notice.** "Nothing here yet" is useless on its own; it always
  carries a link or CTA to the place where that content gets created.

## Where it is applied

`EntityLink` (`blocks/feed/EntityLink`) and `EntityToken` (`features/dashboard/EntityToken`) —
clickable references in the feed and on the dashboard, resolving the route through the global id,
falling back to bold text rather than a dead link when resolution fails.

`MockInterviewScorecard` — the primary CTA deep-links via `studyHref` into the weakest phase inside
the course; the capstone drops to tertiary.

`UpNextCard` at the end of a lesson or a flashcard session — always names one concrete next task, so
the session never ends in mid-air.

Related: `call-to-action.md`, and the layout rule requiring a funnel to courses.
