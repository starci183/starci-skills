# environment.preflight

Collect all mission readiness checks into one complete report before a chain begins. Every check is `ok`, `wall` or `skipped` under explicit rules. A blocked result still carries every independent wall and owner action; the operator repairs nothing.

Run the repository operator build, then `python tests/test_contract.py` from this directory.
