# data.plan

Plan isolated seed units for every required UAT flow and data family. Each unit owns a namespace, targets, attribution, representative volume, expected read-back and rollback. Planning never reaches a data store or carries credentials.

Run the repository operator build, then `python tests/test_contract.py` from this directory.
