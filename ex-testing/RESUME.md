# Resume checkpoint (machine shutdown ~5:15)

## State
- 17/20 lanes DONE (see FLEET-STATUS.md). Remaining at shutdown: e2e-00-todo-infra, e2e-02-todo-task, e2e-05-todo-pns.
- All work is on disk in `.claude/examples/{todo-app-backend,ecommerce-app-be}` — survives reboot. Devin sessions resumable via `devin list` / reopening.
- Docker Desktop was wedged; force-restarted OK (v29.5.2). May need manual start after boot.

## After reboot
1. `docker info` — start Docker Desktop if needed.
2. Check git status in `.claude` — look for truncated files from mid-write kills (jest --listTests will surface syntax errors).
3. Resume/re-run 3 unfinished lanes: read their terminal output is gone — safest: rerun jest scoped to their spec dirs; if specs missing/broken, respawn lane with same brief (`ex-testing/briefs/e2e-*.md`).
4. Verify scope discipline: `git status` vs ANALYSIS.md §6 lane map; revert out-of-scope edits.
5. Run full suites: `npx jest` per app (unit) + `npx jest --config test/e2e/jest.config.ts` per app (e2e).
6. Coverage `lcov.info` per app → codecov flags todo-be/ecommerce-be; sonar-scanner per app (needs projectKey provisioned on sonar.starci.org).
7. Delete scaffolding: `test/e2e/**/infra-contract.d.ts` stubs, old JS harness (`run.js`, `lib/*.js`, `scenarios/`, `jest.config.js`, `publish-journal.js`) once TS suite green.
8. Commit — only trò runs git.
9. Orca cleanup: stale sessions/chats/worktree records + `D:\starci-ex\*` leftover dirs.
10. Then back to examples mission.

## Lane→brief map
briefs/: ut-01..ut-10 (unit), e2e-00..e2e-09 (e2e). Contract: ANALYSIS.md §5.
