# migration.release

Applies one digest-frozen migration plan to one authorized non-production target through the source-owned runner. It binds the route, backend application and quality verification at one head, then performs inspect, optional apply, inspect and replay proof.

Only a wholly safe pending set may execute. Already applied is a proved no-op. Missing, invalid, partial or uncertain journal state never reaches apply. Migration files and runner commands remain unchanged, prior journal rows and checksums remain preserved, and credential values never enter artifacts. Any uncertain effect returns to a fresh journal observation before another decision.

A done response includes `migration-release` and `migration-release-proof`; execution logs are optional for a no-op. The two-round feedback loop repairs evidence and reassesses replay but never authorizes duplicate migration effects.

Tests use synthetic local plan, journal and proof records and never connect to a database. Run `python .claude/operators/migration.release/tests/run.py`.
