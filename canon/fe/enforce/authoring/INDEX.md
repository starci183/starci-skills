# Patterns — how code is written in this codebase

Not design, not architecture. **How a line of code is written here** so that a file written today
reads like the file next to it.

Design decides *which* component a shape of data takes (`canon/fe/explore/component`). Architecture decides
*which tier* it lives in (`canon/fe/storybook.md`). These files decide how the code that results from
those two decisions is spelled.

## Where the source is

Never hardcode a path. Ask:

```bash
node .claude/scripts/workspace/read-workspace-context.mjs fe.path
node .claude/scripts/workspace/read-workspace-context.mjs be.path
```

Every rule below is grounded in that source — a real file, a real count. That grounding is also
what rots, so before trusting a rule:

```bash
node .claude/scripts/verify.mjs        # every anchor still resolves?
```

## Front end

| File | Decides |
|---|---|
| [`fe/structure-and-naming.md`](fe/structure-and-naming.md) | where a file goes and what it is called |
| [`fe/props-and-types.md`](fe/props-and-types.md) | how a prop is declared — `WithClassNames<T>` |
| [`fe/type-safety.md`](fe/type-safety.md) | what may not be typed loosely |
| [`fe/imports-and-format.md`](fe/imports-and-format.md) | import order and formatting — lint-gated |
| [`fe/react-idioms.md`](fe/react-idioms.md) | hooks and render idioms |
| [`fe/state-management.md`](fe/state-management.md) | Zustand: what belongs in a store |
| [`fe/async-data.md`](fe/async-data.md) | `runGraphQL` + SWR |
| [`fe/loading-and-skeleton.md`](fe/loading-and-skeleton.md) | how an async state is written |
| [`fe/forms.md`](fe/forms.md) | form idioms |
| [`fe/overlay-and-feedback.md`](fe/overlay-and-feedback.md) | modal, drawer, toast — as code |
| [`fe/styling-tailwind.md`](fe/styling-tailwind.md) | writing classes, `cn()`, semantic tokens |
| [`fe/storybook-stories.md`](fe/storybook-stories.md) | `*.stories.tsx` |
| [`fe/i18n.md`](fe/i18n.md) | translated strings |
| [`fe/comments.md`](fe/comments.md) | when a comment is worth writing |

## Back end

| File | Decides |
|---|---|
| [`be/modules-and-di.md`](be/modules-and-di.md) | module layout and injection |
| [`be/database-and-entities.md`](be/database-and-entities.md) | entities, relations, indexes |
| [`be/api-surface.md`](be/api-surface.md) | what the API exposes |
| [`be/validation.md`](be/validation.md) | `ValidationPipe`, DTOs |
| [`be/exceptions.md`](be/exceptions.md) | typed exceptions, never bare throws |
| [`be/async-and-messaging.md`](be/async-and-messaging.md) | queues, events, CDC |
| [`be/config-and-env.md`](be/config-and-env.md) | env access and defaults |
| [`be/type-safety.md`](be/type-safety.md) | what may not be typed loosely |
| [`be/imports-and-format.md`](be/imports-and-format.md) | import order and formatting |
| [`be/comments.md`](be/comments.md) | when a comment is worth writing |

## Reading order

Open the one file the task touches. These are not a curriculum — a rule read out of context is a
rule applied where it does not belong.

If a rule and the source disagree, **the source wins and the rule is stale**. Fix it the way
[`HOW-TO-WRITE.md`](HOW-TO-WRITE.md) describes: re-ground it, re-anchor it, re-run `verify.mjs`.
