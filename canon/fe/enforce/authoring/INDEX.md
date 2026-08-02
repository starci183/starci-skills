# `authoring/` — how a line of front-end code is spelled

Not design, not architecture. Design decides *which* component a shape of data becomes
(`canon/fe/explore/component/`). Architecture decides *which tier* it lives in
(`canon/fe/enforce/tiers/`). The files on this shelf decide how the code that results from those two
decisions is written, so that a file added today reads like the file beside it.

Two kinds of file sit here, and the difference is worth knowing before quoting one. Most are
**grounded in this codebase**: they name a real file and a real count, and those counts rot, which is
what `verify.mjs` exists to catch. Four of them — error handling, routing, performance, env and
config — are **grounded in named public sources** instead, because the constraint comes from the
framework or the platform rather than from a house habit. They carry no counts, there is nothing in
them to re-measure, and they hold unchanged on any React app with a file-system router.

## Where the source is

Never hardcode a machine path. A path is true on exactly one machine and the failure looks like
success — files open, greps return, conclusions get drawn from the wrong tree. Ask:

```bash
node .claude/scripts/workspace/read-workspace-context.mjs fe.path
```

Before trusting a rule you did not just write, check that its anchors still resolve:

```bash
node .claude/scripts/verify.mjs
```

## The files

| File | Decides |
|---|---|
| [`structure-and-naming.md`](structure-and-naming.md) | where a file goes and what it is called |
| [`props-and-types.md`](props-and-types.md) | how a prop is declared — `WithClassNames<T>` |
| [`type-safety.md`](type-safety.md) | what may not be typed loosely |
| [`imports-and-format.md`](imports-and-format.md) | import order and formatting — lint-gated |
| [`react-idioms.md`](react-idioms.md) | hooks and render idioms |
| [`state-management.md`](state-management.md) | what belongs in a store, and what does not |
| [`async-data.md`](async-data.md) | how a remote read is fetched and cached |
| [`loading-and-skeleton.md`](loading-and-skeleton.md) | how an async state is written |
| [`error-handling.md`](error-handling.md) | the fixed branch order of an async region, where an error boundary sits and why one at the root is not a strategy, what the reader sees versus what the operator sees, and the rule that a caught error is either handled or rethrown but never swallowed |
| [`routing.md`](routing.md) | that the route tree is the file tree and each segment owns its convention files, and the three-way split between route segment, query parameter and component state — decided by lifetime and shareability, because a URL is an interface |
| [`forms.md`](forms.md) | form idioms |
| [`overlay-and-feedback.md`](overlay-and-feedback.md) | modal, drawer, toast — as code |
| [`styling-tailwind.md`](styling-tailwind.md) | writing classes, `cn()`, semantic tokens |
| [`performance.md`](performance.md) | when a memo is earned and when it is noise, why restructuring beats wrapping, where a bundle is split, and how a list that keeps growing is rendered — the one shelf where most rules are judgement, so each says plainly whether a machine can decide it |
| [`env-and-config.md`](env-and-config.md) | that one typed module owns every read of the environment, that public and server-only are two modules with the prefix as the boundary, and that a missing required value fails at boot rather than at the call site |
| [`storybook-stories.md`](storybook-stories.md) | how a `*.stories.tsx` is written |
| [`i18n.md`](i18n.md) | translated strings |
| [`comments.md`](comments.md) | when a comment is worth writing |

## Reading order

There is none. Open the one file the task touches. These are not a curriculum, and a rule read out of
context is a rule applied where it does not belong.

If a rule and the source disagree, **the source wins and the rule is stale**. Fix it the way
[`HOW-TO-WRITE.md`](../../../HOW-TO-WRITE.md) describes: re-ground it, re-anchor it, re-run
`verify.mjs`.
