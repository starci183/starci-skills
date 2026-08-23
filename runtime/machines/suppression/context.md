# Suppression refusal machine

## LOADS

None.

The suppression machine refuses source-level directives that make lint, type, coverage or Sonar evidence
disappear. It scans authored JS/TS source only and reports exact paths/lines. A genuine exception belongs
in the owning law and machine configuration, never in a local comment that bypasses accountability.

```text
node .claude/runtime/machines/suppression/check.mjs <repository-root>
node --test .claude/runtime/machines/suppression/check.spec.mjs
```
