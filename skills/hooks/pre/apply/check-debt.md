# pre/check-debt.md

**Scope.** Any skill about to change code it did not just write — a `starci-fe-review-apply`, a
`starci-fe-consolidate-apply`, a `starci-be-cannon-apply` touching an existing module.

**Before you change something that looks wrong**, check whether it was already weighed and deferred.
Odd-looking code is not always an oversight; sometimes it is a shortcut someone took on purpose and
recorded, and re-"fixing" it quietly undoes a decision.

```
node scripts/record-technical-debt.mjs list
```

If the area you are about to touch carries an open entry, read it first. The entry names the rule it
breaks and the reason it was left standing — act with that in front of you, not against it. If the code
still turns out to need changing, the debt entry is updated or closed as part of the change, not left to
describe a state that no longer exists.
