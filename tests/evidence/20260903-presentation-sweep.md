# Evidence — presentation sweep and shell geometry, 2026-09-03

Knowledge rules are product-agnostic, so the concrete counts behind the Cases added on 2026-09-03 live
here instead. Two products were read: a reference application at `starci-academy-fe` (`mtp`) and a
second application at `nivo-fe` (`main`, `b3f4691`). Counts are file counts at the time of reading.

## What the round was about

A session in the second product shipped four things the knowledge tree already forbade, and no gate
caught any of them. `scripts/sweep-presentation.mjs` and the Cases below exist because of these four.

| # | What shipped | Which law it broke |
| --- | --- | --- |
| 1 | `flex-col items-start sm:flex-row sm:items-end sm:justify-between` layered onto `SectionHeader`, whose published CSS owns display, alignment and the collapse through a container query | `APP_REIMPLEMENTATION` (`ui/presentation/INDEX.md`) |
| 2 | `h-9 min-h-9 w-64 … rounded-field border-[var(--field-border)] … shadow-[var(--field-shadow)]` passed into a control's `className` | `OFF_SCALE` (`radius.md`); not `APP_OVERRIDE`, because the control was the vendor's and not Grammar's |
| 3 | `rounded-large` in 5 places of one package | `OFF_SCALE`: a Tailwind 3 plugin name this head emits no CSS for, so the corner renders square |
| 4 | A top bar built from divs, composing no Grammar shell object, and handed to `WorkspaceShell`'s `header` slot | `SHELL_GEOMETRY` (FE-IMPORTS-7) |

## FE-FUNCTION-4 Case 5 — a pure half choosing between a connected block and its Base

| Measure | Reference application | Second application |
| --- | --- | --- |
| `component.tsx` holding such a choice | 0 of 150 | 4 in one page (`pages/OverviewPage/component.tsx:314-317`) |
| Page `index.tsx` rendering `<XBase …>` directly | 46 of 49 | — |
| Page `index.tsx` re-exporting the Base as the page | 1 | — |
| Page `index.tsx` handing to a local `…Shell` | 2 | — |

The four counter-example lines read
`accepted === null ? <AppsSummary /> : <AppsSummaryBase {...accepted.apps} />` and three siblings.

## FE-TEST-5 Case 4 and FE-TEST-7 — spec coverage

| Measure | Reference application |
| --- | --- |
| Specs under `src/` | 497 |
| Component and index specs containing `toHaveClass` or `className` | 57 of 272, in 167 calls |
| Component specs asserting no class at all | 215 of 272 |
| `classNames.spec.ts` files, and their class assertions | 2 files, 11 assertions |
| Grammar `styles.spec.ts` files | 6 |
| Block folders with `component.tsx` | 101 |
| Block folders carrying both `component.spec.tsx` and `index.spec.tsx` | 28 |
| Page folders with `component.tsx` | 49 |
| Page folders carrying both specs | 22 |

FE-TEST-7 Case 1 binds a new unit. It is not a census: 73 block folders and 27 page folders carry one
spec and not two, which the file records as an open question.

## FE-FOLDER-6 Case 5 — deployment constants

| Measure | Reference application | Second application |
| --- | --- | --- |
| `process.env.NEXT_PUBLIC_*` reads under `src/modules` | 7 | — |
| `process.env` of any kind under `src/components` | 0 | 3 |

The three counter-examples each read the same host suffix with their own `?? ".nivo.vn"` default:
`blocks/console/AppsSummary/index.tsx:11`, `blocks/apps/AppsDashboard/index.tsx:55`,
`blocks/academy/AcademyControlCenter/index.tsx:30`.

## The currency literal, which is not legislated

| Measure | Reference application |
| --- | --- |
| `currency:` under `src/components` (connected halves) | 11 occurrences, 8 outside specs |
| `currency:` under `src/modules` | 0 |
| `"vi-VN"` / `"en-US"` under `src/components` | 10 occurrences, 2 outside specs |
| `"vi-VN"` / `"en-US"` under `src/modules` | 0 |

The evidence points the opposite way from the deployment constant, so `folder.md` records it as an
open question rather than a rule.

## FE-IMPORTS-7 Case 7 and Case 9 — shell geometry

The discriminating fact is not whether a shell folder holds classes, it is whether it composes a
Grammar shell object at all.

| Unit | Composes | Verdict |
| --- | --- | --- |
| Reference `product-shells/LearnShellLayout` | `WorkspaceShell`, `Subnav`, `Tabs`; no `classNames.ts` | clean |
| Reference `product-shells/ShellNav` | `NavigationFeatureNav`; 11 class exports, all inside slots it is handed | clean |
| Second app `product-shells/ConsoleLayout` | `WorkspaceShell` | clean on Case 7 |
| Second app `product-shells/Sidebar` | the Grammar `Sidebar` | clean |
| Second app `product-shells/ConsoleTopBar` | `Text` alone; `CONSOLE_TOP_BAR_CLASS_NAME` is `flex min-w-0 flex-wrap items-center justify-between gap-3`, plus three more exports | `SHELL_GEOMETRY` |

A rule written as "any layout utility in a shell folder is a finding" would turn the reference
application's own `ShellNav` red in 11 places. The rule as written clears it.

For Case 9, the landmark facts read out of the published package:
`WorkspaceShell/index.tsx:52` wraps `props.header` in `<header …>`, and
`NavigationFeatureNav/index.tsx:53` is itself a `<header>`. Nesting one in the other publishes two
banners for one band. The reference application mounts the band as a sibling above the page in 6
route layouts (`src/app/[lang]/{cart,courses,dashboard,league,practice,profile}/layout.tsx`), each
rendering `<ShellNav />` then `<main>{children}</main>`, and its `LearnShellLayout` passes no
`header`. The second application's `ConsoleLayout/component.tsx:25` passes `header={<ConsoleTopBar />}`.

## Sweep baseline on the reference application

1474 files scanned, the Grammar package excluded because it is the authority these rules are measured
against and not a consumer of them.

| Code | Findings |
| --- | --- |
| `OFF_SCALE` | 337 |
| `SHELL_GEOMETRY` | 36 |
| `APP_OVERRIDE` | 12 |
| `APP_REIMPLEMENTATION` | 1 |

`OFF_SCALE` is led by `p-5` (33), `max-w-full` (24), `gap-5` (23) and `rounded-medium` (14). Two of
these are owner questions rather than obvious defects: `max-w-full` is not a step on the closed cap
scale `measure.md` publishes, and the folder-name half of the shell test ("…Rail", "…Nav") reaches
two blocks and two layouts that are not product shells.
