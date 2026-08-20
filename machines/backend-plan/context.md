# Backend plan semantic machine

## LOADS

None.

After JSON Schema validation, this machine proves cross-field semantics the schema cannot express:
every planned file is covered, bindings reference real modules/situations, no binding widens the file
boundary, and `planHash` binds the complete canonical plan content independently of source revision.

```text
node .claude/machines/backend-plan/check.mjs <plan.json>
node --test .claude/machines/backend-plan/check.spec.mjs
```
