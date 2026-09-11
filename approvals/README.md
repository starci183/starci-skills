# Approval policy

`policy.yaml` is the canonical boundary between automatic procedure and a human decision.
Before the first workflow effect, the Coordinator presents one complete brief. The accepted
brief digest, action ceiling, repositories, scopes and reserved checkpoints are supplied to
`decideApproval`. Actions inside that envelope are automatic. A material goal, business/SRS,
scope, ownership or undeclared external-effect change returns `need-user`.

The decision function validates structured facts; it cannot authenticate a user reply. The
workflow lifecycle remains responsible for binding a real presentation and subsequent user
acceptance to the brief digest.
