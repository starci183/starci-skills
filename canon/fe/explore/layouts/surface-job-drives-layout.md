# The surface's JOB chooses the shell — and a multi-phase feature CHANGES shell per phase

> The root rule of the `layouts/` shelf. Before building a page, the question is not "what does this
> page look like" but **"what JOB is this surface doing?"** — the job picks the shell. Web ground:
> adaptive layout, where the layout follows the *modality or task* rather than being locked to one
> frame ([Material](https://m2.material.io/design/layout/understanding-layout.html) · [Fluent
> 2](https://fluent2.microsoft.design/layout)); and focus mode, where VS Code and focus browsers
> HIDE the nav to concentrate on one job.

## Job to shell

| Job of the surface | Shell | Archetype |
|---|---|---|
| **Read / browse** hierarchical documentation | three panes: tree rail, reading column, TOC | [`docs-three-pane-reader.md`](docs-three-pane-reader.md) |
| **Browse N items of one kind** | catalog grid/line plus pager | [`catalog-grid.md`](catalog-grid.md) |
| **Decide / enter** one task (form, setup, checkout) | centered single column, no rail | [`centered-form-setup.md`](centered-form-setup.md) |
| **FOCUSED WORK with a tool** (solving, interviewing, designing) | **full-bleed, no rail, two panes** | [`full-bleed-work-surface.md`](full-bleed-work-surface.md) · [`solving-surface-fullbleed-no-course-rails.md`](solving-surface-fullbleed-no-course-rails.md) |
| **Overview** of several areas under one identity | dashboard hub (tab strip) | [`dashboard-hub.md`](dashboard-hub.md) |
| **Result / debrief** | centered single column | the [`centered-form-setup.md`](centered-form-setup.md) shape |
| **Selling / storytelling** in public | stacked landing | [`marketing-landing.md`](marketing-landing.md) |

To pick the concrete shell, use the decision tree in
[`page-shell-selection.md`](page-shell-selection.md); for the vocabulary of regions, see
[`region-model.md`](region-model.md).

## A MULTI-PHASE feature is several jobs in one route — CHANGE the shell per phase, STRICT

- **One route passing through N phases with DIFFERENT jobs uses the shell of each phase's job. Do
  not lock the whole feature to one frame.** Forcing every phase into one shell distorts whichever
  phase has a different job — usually the working phase, crammed into a narrow reading column.
- The symptom: a single `phase` state machine rendering every phase inside the SAME centered
  `max-w-*` and the SAME rail, while one of those phases is a solve or interview that needs
  full-bleed.
- Switching shell by phase is **adaptive-by-task**, not only adaptive-by-viewport: the phase changes
  job, so the layout changes.

## First applied 2026-07-07 — Mock Interview

`MockInterviewSession` packed all FOUR phases into a `max-w-2xl` column inside `LearnShell` with the
course rail still present (`learn/layout.tsx` had only `fullBleed={isMindMap}`), and rendered the
interview phase two different ways: `qna` as one column with a hidden workspace, `design` as two
panes. By job it should be:

- **setup** (deciding, green room) → centered
- **interview** (working with a tool) → **full-bleed two panes, no rail**
  ([`full-bleed-work-surface.md`](full-bleed-work-surface.md))
- **grading** (waiting) → centered interstitial
- **scorecard** (result) → centered

The layout fix: the route turns on `fullBleed` when `phase === "interview"`, and setup, grading and
scorecard stay centered.

## Correction 2026-07-09 — route-level `fullBleed` cannot see a client-side phase

The fix above was applied (`learn/layout.tsx`:
`fullBleed={isMindMap || isMockInterviewLive}`), but `isMockInterviewLive` matches on the **URL
segment** `/mock-interview/interview/[sessionId]`, and this route is DEDICATED and RESUMABLE: it
keeps ONE URL for the whole session, moving interview → grading → scorecard through CLIENT STATE
without changing the URL or adding `?phase=`. So the shell believed the ENTIRE route was full-bleed,
and `grading` and `scorecard` — which the job table above says should be centered — lost their
reading column and spilled across the full width.

**Fix:** since the shell (`layout.tsx`, server- and route-level) cannot see `phase`, which is client
state inside `MockInterviewSession`, the reading column has to cap itself LOCALLY rather than the
route being changed: `mx-auto w-full max-w-3xl` goes directly on the root div of the `grading` and
`scorecard` phases in `MockInterviewSession/index.tsx`. It is the same technique already used for
the conversation column of `interview`-qna (`mx-auto w-full max-w-2xl`, on its own line when
`!workspaceOpen`).

**The reusable rule:** when a dedicated resumable route holds a fixed URL across SEVERAL phases with
different jobs, a route-level `fullBleed` toggle sees only the URL and never the client-side phase.
A phase that needs a narrow reading column must therefore not rely on the shell; it applies
`mx-auto max-w-3xl` in the component itself. `max-w-3xl` is the current standard value — see
[`when-rail.md`](when-rail.md) and [`region-model.md`](region-model.md) — replacing the `max-w-2xl`
of the original 2026-07-07 table.

## Related

[`page-shell-selection.md`](page-shell-selection.md) (picking the concrete shell) ·
[`full-bleed-work-surface.md`](full-bleed-work-surface.md) · [`region-model.md`](region-model.md) ·
[`responsive-regions.md`](responsive-regions.md) ·
`product/assessment-surface-integrity-and-grade-at-end` (rule 3, the workspace tool tabs) ·
`patterns/layout-must-funnel-to-courses-and-cover-full-data-state-matrix` (every phase still covers
its states and still funnels).
