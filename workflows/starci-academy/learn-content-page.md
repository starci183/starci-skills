# learn-content-page

Migrated from the previous shape mid-run. Plan and Preview ran against the record-and-seal skills;
their evidence lives in `starci-academy-fe/.artifacts/design-plan/learn-system-map/`
(`plan-record.md`, `preview-inventory.md`, `design-record.json`, `screens/revision-1-6/`). This file
is that evidence in the shape `starci-workflow-drift` reads.

## plan

SCOPE
| | |
|---|---|
| Doing | The whole learn feature, drawn from legacy, down to one direction |
| Repo / branch | `starci-academy-fe` @ `main` |
| Touching | artifacts only |
| Not touching | all production source |
| Produces | three directions at `localhost:8080` |

CHOSE   direction B — one spine. The eleven learn modes hang off one persistent left rail, and the
        content's own contents drop to a panel inside the reader. Two conditions came with it, in
        the user's words: parity is at the level of CONCEPT rather than pixels, and the content page
        is built first.
TOOK    Reference is `starci-academy@9a19342`, `pages/ContentPage` + `LearnShellLayout`, read as
        source rather than as a screenshot.
TOOK    The spine itself is a separate work item; the reader owns its two rails - the plan record
        puts the contents panel and the on-this-page outline inside `learn-content-page`.

## review

SCOPE
| | |
|---|---|
| Doing | Build the reader from the real components, contracts and tokens |
| Repo / branch | `starci-academy-fe` @ `main` |
| Touching | `.artifacts/design-plan/learn-system-map/candidate/` |
| Not touching | all production source |
| Produces | eight rendered states at `localhost:8083` |

STATES  CourseLearnContentPage → ready → rendered (`screens/revision-1-6/reader-ready.png`)
        CourseLearnContentPage → pending → rendered
        CourseLearnContentPage → locked → rendered
        CourseLearnContentPage → failed → rendered
        CourseLearnContentPage → single face → rendered
        CourseLearnContentPage → first content → rendered
        CourseLearnContentPage → last content → rendered
        CourseLearnContentPage → no destinations → rendered
        CourseLearnContentPage (connected) → all four situations → covered-by the eight above; it
        resolves data and draws nothing of its own
        CourseLearnContentPage (connected) → which outline entry is current → NOT rendered; scroll
        spy needs a live document, so no entry claims to be current
BACKEND nothing missing. `content` and `module` already exist and were read as evidence:
        `content` is authenticated and truncates a premium body server-side, `module` is login-only
        and returns nested contents. No enabler was needed.
APPROVED revision 1.6, after five revisions:
        1.2 rebuilt from the legacy page read line by line - paper card, paywall inside it, footer
            suppressed when locked, reaction on its own ground, tab bar never rested
        1.3 the two rails, and the entity renamed from `lesson` to `content` everywhere
        1.4 outline tinted rather than plated and indented by depth; map rows given mark, time and
            current plate; modules given a summary line that opens
        1.5 declared the mirror specifier repoint as the one integration edit
        1.6 the body is markdown, because the data is - `sections` retired, `Article` and `CodeBlock`
            added, and the connected half built to the same approval

## apply

SCOPE
| | |
|---|---|
| Doing | Write revision 1.6 into production and prove it renders |
| Repo / branch | `starci-academy-fe` @ `main` (`f06071e`) |
| Touching | the sixteen files below, `package.json`, `.claude/launch.json` |
| Not touching | every other path under `src`; `starci-academy` |
| Produces | `/vi/courses/[displayId]/learn/content/modules/[moduleId]/contents/[contentId]` |

WROTE   src/components/pages/CourseLearnContentPage/component.tsx
        src/components/pages/CourseLearnContentPage/index.tsx
        src/components/blocks/learn/ContentTabRow/component.tsx
        src/components/leaves/Article/index.tsx
        src/components/leaves/CodeBlock/index.tsx
        src/components/leaves/ContentMapRow/index.tsx
        src/components/leaves/NavLink/index.tsx            (gains `kind: "section"` and `depth`)
        src/components/contracts/index.ts                  (eleven entries, three union members)
        src/modules/api/graphql/queries/query-content.ts
        src/modules/api/graphql/queries/query-module.ts
        src/modules/api/graphql/queries/types/content.ts
        src/hooks/swr/useQueryContentSwr.ts
        src/hooks/swr/useQueryModuleSwr.ts
        src/app/[lang]/courses/[displayId]/learn/content/modules/[moduleId]/contents/[contentId]/page.tsx
        src/messages/vi.json                               (merged: the `learn` key)
        src/messages/en.json                               (merged: the `learn` key)
        package.json                                       (unified, remark-parse, remark-gfm, remark-directive)
        .claude/launch.json                                (tooling: the dev server had no launch config)

GREEN   npx tsc --noEmit                  clean, whole repository
        npx eslint <every path above>     exit 0
        npm run build                     exit 0; the route appears in the route table
        audit-fe-lint-adoption.mjs        ok, no rule missing, none below error, inline config refused

OWED    Seven of eight states still unseen in production. They need a signed-in reader, and signing
        in was blocked by a Keycloak whitelist that predated locale routing: `academy-web` allowed
        `http://localhost:3000/authentication*` while this FE calls back at `/vi/authentication`.
        FIXED here - one entry per locale, `.../vi/authentication*` and `.../en/authentication*`.
        A star in the MIDDLE of a path is not a wildcard to Keycloak, only a trailing one is, so the
        first attempt was accepted by the admin API and matched nothing; the probe that caught it
        was replaying the exact failing auth URL, which now answers 200 instead of 400.
OWED    The double tab row cannot appear in production. The reviewed design draws a face bar - the
        views a content carries: article, challenges, sandbox, AI lab - and the connected half
        passes `facesLabel` and then never passes `faces` or `languages`. So the row is absent at
        every state, not because a content has one face but because nothing tells it. Found by
        looking at the real page in `pending`; no test and no build could have said it. Fixing it
        means deciding where a face comes from - the content query selects nothing about challenges
        or sandboxes yet - so it is its own bounded run rather than a line added here.
OWED    Same-state parity is proved for `pending` only, and only on THEME. The record's states are
        `dark`; production defaults to light, so `screens/production/reader-pending.png` and
        `screens/revision-1-6/reader-pending.png` differ by theme as well as by data. Structure
        matches: map rail with its search, breadcrumbs, the paper card resting.
OWED    Scroll spy for the outline rail. Until it exists no entry claims to be current, because a
        wrong current entry is worse than none.
OWED    Syntax highlighting in code blocks; the reference uses shiki.
OWED    Remark directives (`:::accordion`) draw as ordinary blocks.
