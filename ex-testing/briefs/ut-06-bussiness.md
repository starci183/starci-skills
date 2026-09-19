# Lane UT-06 — todo bussiness hardening

SCOPE (exclusive): `D:/Repositories/starci-academy-backend/.claude/D:/Repositories/starci-academy-backend/.claude/examples/todo-app-backend/src/modules/bussiness/` (audit, notify, plan, recur, session, share, task)

Existing specs live here — do NOT duplicate. (a) Convert direct-instantiation specs (`new XService(...)`) to `Test.createTestingModule` where mechanical. (b) Fill edge gaps: policy failures, quota limits, event emission (assert emitted domain events), transaction rollback paths, concurrency guards. Read existing specs first; extend in-place when the file exists, new file when the class is untested.
