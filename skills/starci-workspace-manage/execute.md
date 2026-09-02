# Execute

Follow `machine.json`. Invoke one atomic operator at a time as `operator(context, input) -> output`; validate its typed result before this Skill selects a transition.

`uat-account` routes only to `workspace/uat-account-provision`; it never pauses for manual user login.
