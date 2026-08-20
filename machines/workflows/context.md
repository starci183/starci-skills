# Workflow route machine

## LOADS

None.

The workflow machine proves that every physical `.claude/skills/<name>/SKILL.md` is routed by exactly
one lifecycle and that no route points to a missing capability. It validates discovery/accountability;
it does not invoke a skill or restate its procedure.

```text
node .claude/machines/workflows/check.mjs
node --test .claude/machines/workflows/check.spec.mjs
```
