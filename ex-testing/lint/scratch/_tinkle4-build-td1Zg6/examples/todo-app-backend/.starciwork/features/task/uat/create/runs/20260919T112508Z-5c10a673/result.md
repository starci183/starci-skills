# Create a task, and fail to delete somebody else's

Flow: `uat.task.create`  Run: `20260919T112508Z-5c10a673`  Outcome: pass

## Steps walked
- `owner-signed-in` (2026-09-19T11:25:12.230Z -> 2026-09-19T11:25:12.549Z)
- `task-created` (2026-09-19T11:25:12.617Z -> 2026-09-19T11:25:12.723Z)
- `stranger-delete-refused` (2026-09-19T11:25:12.758Z -> 2026-09-19T11:25:13.040Z)

## Assertions
- `fr.task.create`: expected yes, observed yes - The created task's own title (uat-20260919T112508Z-5c10a673-task) appears in the owner's list.
- `br.task.single-owner`: expected yes, observed yes - The stranger's task list has no row for "uat-20260919T112508Z-5c10a673-task", so no delete affordance for it exists to click.

## Redaction
Every screenshot and video frame was reviewed for the password field, which Playwright masks at capture time (`page.screenshot({ mask: [...] })`) whenever a password input is present on the page.