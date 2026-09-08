# backend.plan

Partition a frozen architecture operation set into nonoverlapping modules grouped by writer and store boundary. The plan and `units.json` are one list read two ways. This operator writes no backend source and does not change the architecture contract.

Run the repository operator build, then `python tests/test_contract.py` from this directory.
