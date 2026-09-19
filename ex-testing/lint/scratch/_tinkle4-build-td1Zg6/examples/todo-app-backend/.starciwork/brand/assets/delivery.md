# Todo app: brand rev 3 and seven interface directions

The owner’s turtle, blue primary, left-illustration/right-form auth and real sign-in links are recorded in [brand/index.yaml](../index.yaml). The only product-code change is the accent/alias override in globals.css.

| Selected direction | Exact prompt | Review |
| --- | --- | --- |
| [login — refused](../../features/login/ui/sign-in/assets/sign-in-refused.png) | [prompt](../../features/login/ui/sign-in/assets/sign-in-refused.prompt.txt) | [review](../../features/login/ui/sign-in/assets/visual-review.md) |
| [task — many-tasks](../../features/task/ui/list/assets/list-many-tasks.png) | [prompt](../../features/task/ui/list/assets/list-many-tasks.prompt.txt) | [review](../../features/task/ui/list/assets/visual-review.md) |
| [share — refused](../../features/share/ui/invite/assets/invite-refused.png) | [prompt](../../features/share/ui/invite/assets/invite-refused.prompt.txt) | [review](../../features/share/ui/invite/assets/visual-review.md) |
| [notify — refused](../../features/notify/ui/preferences/assets/preferences-refused.png) | [prompt](../../features/notify/ui/preferences/assets/preferences-refused.prompt.txt) | [review](../../features/notify/ui/preferences/assets/visual-review.md) |
| [plan — over-cap-frozen](../../features/plan/ui/usage/assets/usage-over-cap-frozen.png) | [prompt](../../features/plan/ui/usage/assets/usage-over-cap-frozen.prompt.txt) | [review](../../features/plan/ui/usage/assets/visual-review.md) |
| [audit — erasure-refused](../../features/audit/ui/privacy/assets/privacy-erasure-refused.png) | [prompt](../../features/audit/ui/privacy/assets/privacy-erasure-refused.prompt.txt) | [review](../../features/audit/ui/privacy/assets/visual-review.md) |
| [recur — refused](../../features/recur/ui/schedule/assets/schedule-refused.png) | [prompt](../../features/recur/ui/schedule/assets/schedule-refused.prompt.txt) | [review](../../features/recur/ui/schedule/assets/visual-review.md) |

The [turtle master](turtle-master.png) is a generated placeholder with [its exact prompt](turtle-master.prompt.txt), pending final asset acceptance. All images used built-in image_gen.imagegen; the tool exposed no model field. Initial attempts consumed by corrective edits remain beside their final UI owner.

The seven UI records contain 66 explicit screen/state/viewport mappings, including desktop and mobile for every named state and a signed-out unsubscribe projection. The task-list empty state derives from the populated screen and carries the turtle master.

Verification: brand source/hash/contrast checks and all seven direction checks passed; all 12 retained PNGs decoded with System.Drawing. check-example-work.mjs adds **zero new refusals**; its four pre-existing refusals and fifteen warnings remain. See [comparison](refusal-comparison.txt), [brand checks](brand-check.txt) and the per-UI evidence.yaml files.

The general starci validate command cannot start without .dist. The installed Grammar inspection used the prior draw checkout with a byte-identical lockfile. [Contract and environment write-up prepared for docs/examples/grit](grit-for-docs-examples-grit.md) records these limitations, the example/general-schema mismatch and implementation gaps. No frontend build or browser UAT is claimed.

Implementation must activate the recorded theme, load Inter, wire black primary-label ink, resolve the declared destructive/disabled Grammar capability gaps and implement the proposed destinations. Brand tokens and records are the exact source; generated pixels are visual direction.
