# Rule-binding machine

## LOADS

None.

## Record

The machine validates the backend and frontend gate routers against their published canon packages and
the rule-binding policy. It reports missing law, missing machine rules and untested machine identities;
it never repairs consumer repositories.

## Execution

```text
node .claude/machines/rule-bindings/check.mjs --all
node --test .claude/machines/rule-bindings/check.spec.mjs
```
