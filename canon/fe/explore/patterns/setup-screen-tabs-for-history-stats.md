# History and statistics become tabs on the existing setup screen, not a new route

> A data-state flow inside a shell that already exists — the shape of the page does not change.

When a resumable, session-based feature (setup, then the work, then the result) needs "the runs I
have already done" plus "aggregate statistics", and sometimes "what to improve", **do not open a new
route or a new shell**. Add a `TabsCard` of two or three tabs directly above the setup screen — `Bắt
đầu` · `Lịch sử` · `Thống kê` — held in local `useState` rather than a query parameter, with three
mutually exclusive render branches under the tab bar. Setup, the work itself and the result keep
their shells; only setup gains tabs.

## First applied — two real cases, both 2026-07-08

- **Flashcard Quiz "Hỏi nhanh"** (`flashcard-quiz.proposal.md`) — three tabs. The statistics tab
  uses `TopicMasteryGrid`, which already existed and had no caller, plus a new inline sparkline.
- **Mock Interview** (`mock-interview-history-stats.proposal.md`) — three tabs. The statistics tab
  folds "improvement" (the weakest area plus one CTA) into itself rather than splitting off a fourth
  tab, mirroring how `MockInterviewScorecard` already holds its bar chart, its gaps and its CTA in
  one view.

Neither case changed a route or a shell. Each added a tab bar and two new components,
`<Feature>History` and `<Feature>Stats`, rendered in place of the setup form when a tab other than
`Bắt đầu` is selected.

## Shape

- `TabsCard` with `leftTabs`, immediately above the setup content, driven by one local
  `useState<"begin"|"history"|"stats">`. No query parameter — nothing deep-links into a specific tab.
- An **embedded history widget** (a hard cap of N rows, no filter) is promoted into its own tab: the
  cap goes, offset or load-more ("Xem thêm", never a silent truncation) comes in, and an optional
  filter by mode or tier is added. That filter should be a **server-side parameter**, not a
  client-side pass, or pagination goes out of step with the filter.
- The **statistics tab** gets a new aggregate query scanning the most recent N attempts or sessions
  with an explicit cap — 50 in both cases — returning `insufficientData` or an empty gate when the
  sample is too small. Do not infer a percentage from one or two runs. Break the numbers down along
  an axis that **recurs across sessions**, not a positional label like "Question N" or "Attempt N".
- **Trend chart**: there is no canon block for one yet — a gap recorded in
  `fe/components/INDEX.md`. Both cases used either simple inline bars (style only, height as a
  percentage) or `recharts`, which is already in the app and used by `AiUsageHistory`, where a real
  tooltip or axis was needed. Do not extract a block until there are at least three callers.
- An empty state needing its own action button ("Bắt đầu…") uses `EmptyState` from `blocks/feedback`,
  which supports `action` — not `AsyncContent`'s `emptyContent`.

## Gotcha — `emptyContent` cannot carry an arbitrary action

`AsyncContent.emptyContent` maps straight onto `EmptyContentProps` in `blocks/async/EmptyContent`,
whose props are only `title`, `description`, `icon`, `onRetry` and `retryLabel`. For any action
button that is not a retry, render `EmptyState` from `blocks/feedback/EmptyState` — which has
`action?: ReactNode` — by hand inside the `children` branch of `AsyncContent`. Do not pass `action`
into `emptyContent`. Strict TypeScript will catch it; an `as any` copied over from another case will
not, which is how this one gets through.

## Related

`labeled-section-render-empty-not-self-hide.md` — the empty state each tab owes ·
`layout-must-funnel-to-courses-and-cover-full-data-state-matrix.md` — every empty state carries a
CTA into the funnel.
