# Create a task, and fail to delete somebody else's

Flow: `uat.task.create`  Run: `20260918T080854Z-f7ab26f0`  Outcome: **fail**

## Steps walked
- `owner-signed-in` (2026-09-18T08:08:55.798Z -> 2026-09-18T08:08:56.086Z)
- `task-created` (2026-09-18T08:08:56.114Z -> 2026-09-18T08:09:06.215Z)

## Assertions
- `fr.task.create`: expected yes, observed no - The created row (taskId 50ccc576-1c7c-444e-8750-30a2c379199b) is not owned by demo@todo.dev's real session per a direct, correctly-headed GET /tasks read-back. src/modules/api/client.ts sends an "authorization: Bearer <token>" header; every backend task controller only reads "x-session-token" (e.g. create-task.controller.ts's @Headers('x-session-token')), and session.repository.ts#findActive calls this.rows.findOneBy({ token }) with that undefined token - TypeORM does not filter on an undefined criterion, so it silently matches an arbitrary session row instead of refusing. Every real browser action against this app is therefore attributed to whichever session that happens to be, not the signed-in person. This is a real FE/BE integration + authorization defect this live run surfaced, not a selector or environment gap.
- `br.task.single-owner`: expected yes, observed not-run - Depends on the task in fr.task.create resolving to the owner as expected, which it did not; a stranger-visibility check against a row whose own ownership this run could not confirm would prove nothing either way.

## Redaction
Every screenshot and video frame was reviewed for the password field, which Playwright masks at capture time (`page.screenshot({ mask: [...] })`) whenever a password input is present on the page.