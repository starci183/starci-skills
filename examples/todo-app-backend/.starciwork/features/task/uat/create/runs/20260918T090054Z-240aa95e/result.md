# Create a task, and fail to delete somebody else's

Flow: `uat.task.create`  Run: `20260918T090054Z-240aa95e`  Outcome: pass

## Steps walked
- `owner-signed-in` (2026-09-18T09:00:58.082Z -> 2026-09-18T09:00:58.574Z)
- `task-created` (2026-09-18T09:00:58.615Z -> 2026-09-18T09:00:58.805Z)
- `stranger-delete-refused` (2026-09-18T09:00:58.867Z -> 2026-09-18T09:00:59.240Z)
- `owner-list-unchanged-and-cleaned-up` (2026-09-18T09:00:59.284Z -> 2026-09-18T09:00:59.722Z)

## Assertions
- `fr.task.create`: expected yes, observed yes - The created task's own title (uat-20260918T090054Z-240aa95e-task) appears in the owner's list.
- `br.task.single-owner`: expected yes, observed yes - The stranger's task list has no row for "uat-20260918T090054Z-240aa95e-task", so no delete affordance for it exists to click.

## Redaction
Every screenshot and video frame was reviewed for the password field, which Playwright masks at capture time (`page.screenshot({ mask: [...] })`) whenever a password input is present on the page.