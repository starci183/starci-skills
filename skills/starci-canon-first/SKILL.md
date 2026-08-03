---
name: starci-canon-first
description: The grounded catch-all for a StarCi front-end or back-end task that no specific skill cleanly fits — a broad or exploratory request, an ambiguous one, or work that straddles several verbs. It reads the canon that governs the work (`canon/fe/README.md` and its `enforce/` shelves, or `canon/be/INDEX.md`) carefully first, then does the work to it rather than guessing at a shape the canon already settles. Reach for it when the ask is real but its lane is unclear — an outcome named without a verb, front end or back — "làm cho trang này ổn hơn", "phần backend này nhìn lộn xộn quá, làm gọn lại giùm", "backend chỗ này rối quá, dọn gọn giùm", "this backend looks messy, clean it up", "xử lý giúp cái này", "tối ưu chỗ này", "làm cho chuẩn đi", "clean this up", "handle this properly", "just make it right", "không rõ nên dùng skill nào", "làm cái gì đó cho phần này". The LAST resort, never the first: when the request is clearly one verb, use that skill instead — judging an existing surface, component or async design is `starci-fe-review-plan`; designing a whole flow is `starci-fe-layout-plan`; finding or merging duplication is `starci-fe-consolidate-plan` / `-apply`; writing or auditing back-end code against canon is `starci-be-cannon-apply` / `-plan`; mirroring a design-system component into the app is `starci-fe-sync`; running the DOM contract is `starci-fe-contract`; auditing the canon documents themselves is `starci-canon-audit`; registering where the source lives is `starci-setup-workspace`. It does not replace those lanes — it grounds the work the roster has no narrow lane for, so a vague ask is met by reading the rules rather than by inventing an answer.
---

# Canon first

Most StarCi work has a verb, and the verb has a skill. This one is for the work that does not — a
request that names an outcome and leaves the lane open, or a job that spans several. The failure to
avoid is the same either way: meeting a vague ask by *inventing* a shape, when the canon already
records the shape the codebase uses. The unclear thing is the verb, never the grounding.

So the whole skill is one move: **read the rules before touching the work.**

## 1. Resolve the source

This runs the [`pre/resolve-workspace`](../hooks/pre/resolve-workspace.md) hook — resolve which tree
this machine points at before reading or writing it:

```bash
node .claude/scripts/workspace/read-workspace-context.mjs fe.path
node .claude/scripts/workspace/read-workspace-context.mjs be.path
```

## 2. Read the canon that governs the work

Decide front end or back end from the request, then open the governing canon rather than a memory of
it:

| The work touches | Read first |
|---|---|
| the front end | `canon/fe/README.md`, then the `canon/fe/enforce/` shelf the task lands on |
| the back end | `canon/be/INDEX.md`, then the `canon/be/enforce/` shelf it lands on |
| whether a rule itself is still true | that is not this skill — it is `starci-canon-audit` |

The rule is written down once, in the canon, and reading it is cheaper than rediscovering it in a
diff. When the canon does not cover the pattern at all, that absence is itself the finding — research
it and cite what you read, per `canon/HOW-TO-WRITE.md`, rather than filling the gap silently.

## 3. Then hand off, or do it grounded

Reading the canon usually resolves the verb: a vague "make this page better" turns out to be a review,
a build, or a consolidation once the rules are in front of you. When it does, hand the now-clear work
to the skill that owns it. When it genuinely has no narrow lane, do it here — to the canon you just
read, not around it — and record what did not fit through `starci-record-debt`.

This skill presents nothing and owns no procedure of its own beyond grounding. When it changes code, it
runs the [`post/record-correction`](../hooks/post/record-correction.md) hook the same as any apply.
