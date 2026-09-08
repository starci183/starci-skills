# uat.verify

Executes one frozen written browser flow against the attested running product at the pinned commit. It preserves the run snapshot, current case captures and screenshots, separate behavior, data and experience verdicts, and exact namespace cleanup evidence.

Accounts, seed data, admissions and runtime state come from their owning operators. This verifier creates none of them. Credentials are resolved by name and masked before capture. Every created record stays inside the seed namespace, and cleanup reaches only that namespace. Runs are append-only and retries use new attempt evidence rather than a prior pass image.

A done response includes `uat-flow-verification`, `uat-snapshot`, `uat-captures`, `uat-verdicts` and `uat-screenshots`. Failed criteria produce exact case or lane defects and targeted reassessment, bounded to two feedback rounds.

Tests use synthetic local records and PNGs only; they neither drive a browser nor alter test data. Run `python .claude/operators/uat.verify/tests/run.py`.
