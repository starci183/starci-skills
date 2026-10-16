Owner: knowledge/hfs/rules.yaml

# Custody and automatic test gates

## R12 automatic test execution

`HFS_E2E_IN_AUTOMATIC_GATE` refuses integration, e2e and contract execution in hooks, default typechecking, coverage and workflows triggered by push or pull request. Keep automatic test commands restricted to the unit project. Put the other projects in an explicitly invoked command or a workflow whose only trigger is `workflow_dispatch`.
