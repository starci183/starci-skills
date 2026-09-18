# Full-screen anatomy comparison: ADDENDUM 2

All seven directions were compared with the four superseding real renders and regenerated using image_gen.imagegen. Brand rev 3 remains unchanged.

Formula: **direction = real-render(anatomy) + brand(surface) + composition(intent)**. The actual component controls shape and state styling. Page layout, content and declared application-owned regions carry composition intent.

| UI | Corrected direction | PNG and exact prompt |
|---|---|---|
| ui.login.sign-in | Frameless compact form in the right half, grey secondary inputs, stock white-label disabled primary, real auth links and master turtle in the left panel. | [PNG](../../../../login/ui/sign-in/assets/sign-in-refused.png), [prompt](../../../../login/ui/sign-in/assets/sign-in-refused.prompt.txt) |
| ui.task.list | Reference-scale shell, grey composer input, white Add task label, neutral Delete outline and raised list body with external label/count/footer. | [PNG](list-many-tasks.png), [prompt](list-many-tasks.prompt.txt) |
| ui.share.invite | Grey invalid secondary field with actual label/error treatment, white Send invitation label, neutral Revoke buttons and reference-backed collection shell. | [PNG](../../../../share/ui/invite/assets/invite-refused.png), [prompt](../../../../share/ui/invite/assets/invite-refused.prompt.txt) |
| ui.notify.preferences | White Save preferences label, blue secondary Turn off label, restrained reference typography and dark plain save refusal. | [PNG](../../../../notify/ui/preferences/assets/preferences-refused.png), [prompt](../../../../notify/ui/preferences/assets/preferences-refused.prompt.txt) |
| ui.plan.usage | White primary label; preserved 40/20 and 200% over-cap state composed using Text, with no uncaptured progress control. | [PNG](../../../../plan/ui/usage/assets/usage-over-cap-frozen.png), [prompt](../../../../plan/ui/usage/assets/usage-over-cap-frozen.prompt.txt) |
| ui.audit.privacy | Actual blue-label secondary Export and neutral-outline Request erasure; two app-owned content groups inside the real SurfaceCard boundary. | [PNG](../../../../audit/ui/privacy/assets/privacy-erasure-refused.png), [prompt](../../../../audit/ui/privacy/assets/privacy-erasure-refused.prompt.txt) |
| ui.recur.schedule | All fields use grey secondary anatomy, error label/border/message use the actual Input invalid state, Save has white ink and Cancel has blue ink. | [PNG](../../../../recur/ui/schedule/assets/schedule-refused.png), [prompt](../../../../recur/ui/schedule/assets/schedule-refused.prompt.txt) |

## Current references

- [sign-in-screen.png](../../../../../brand/assets/grammar-reference/sign-in-screen.png) - SHA256 0619dec4572f8d5931b39075d21aaf089963eaeab4e7bb883a35fb4cd28d5d2e
- [tasks-screen.png](../../../../../brand/assets/grammar-reference/tasks-screen.png) - SHA256 e9ea01cbbecb7a5b6f19328184fa5a0eca7e37f4a411351e8582491dde5024d5
- [empty-state.png](../../../../../brand/assets/grammar-reference/empty-state.png) - SHA256 09ba45e64e7d0e7167c2572df6ae33406b842859d8528aeb9fd2f756a4b48c26
- [primitives.png](../../../../../brand/assets/grammar-reference/primitives.png) - SHA256 21fe46c116fa5ede07ff044c4fbdf5f1600686cbd8b955f2d3d82cc9e0f8ba91

The old reference set is superseded and remains recoverable at Git revision 41471a63. Current records, generation inputs and checks bind only the new set. Task and Notifications retain their first full-screen generation plus the exact prompt because a final targeted edit consumed it. Earlier .v4/.initial/.anatomy-initial files are history, not current instructions.

## Rule source and authority

The canonical knowledge file is absent from this checkout. The coordinator version was read at C:/Users/Hi/orca/workspaces/.claude/ex-lint/knowledge/ui/proof/anatomy-source.yaml and its exact bytes retained as [anatomy-source.accepted.yaml.txt](anatomy-source.accepted.yaml.txt), SHA256 db4352239c7991a58e8d970e2373858c3ef9ed34f37b369a15563bb94e60d48f. No knowledge or operator source was modified. ANATOMY-1 through ANATOMY-4 are bound in each prompt and record.

ADDENDUM 2 explicitly requires white primary label ink and actual component anatomy. This supersedes earlier agent-derived black label, dark Input-error, custom disabled, danger-outline and auth-card treatments. Brand rev 3 stays byte-identical; its conflicting foreground/contrast prescriptions are recorded as unresolved specification differences, not used to recolour component internals. No accessibility contrast pass is claimed.

The earlier COLLECTION-1/2 flat-row interpretation remains overridden by real SurfaceListCard containment, as required by both addenda.

## Component review

| Owner | Source and treatment |
|---|---|
| WorkspaceShell / NavigationFeatureNav | tasks-screen.png: compact header, identity and text navigation/account actions. |
| SurfaceCard / SurfaceListCard | tasks-screen.png: white raised body; all list rows share one body, external label/fact and footer. Privacy content groups are application composition within the ordinary SurfaceCard. |
| Input | sign-in-screen.png, tasks-screen.png and primitives.png: every field on a surface uses secondary grey fill. Invalid fields preserve the real danger label/edge/error and grey interior. |
| Button | primitives.png: primary white ink, secondary blue ink, neutral outline, stock pending/disabled treatment. |
| Text and destinations | primitives.png and sign-in-screen.png: normal dark refusal Text, separate Input-owned error treatment. Native breadcrumb/radio/checkbox content is application-owned. |
| Auth composition | sign-in-screen.png: left illustration/master, right compact frameless form; full web links and refusal semantics preserved. |
| Other-state content | The new empty-state.png shows shell, heading, zero count and a blank raised list body. It does not visibly show EmptyNotice content, turtle or composer. StaticStateRow and Progress are not rendered by this four-image set. Those names no longer claim a proven visual anatomy: empty/occurrence content is app-owned composition of referenced primitives, and usage uses text instead of a bar. Loading skeleton and alternate viewport/state appearances remain unproven until actual captures exist. |

## Verification and limits

Seven owned verification commands check asset/prompt hashes, current reference hashes, accepted inputs, source citation order, secondary Input mappings, app-owned regions and state/viewport coverage. Evidence is generated by actually running those commands with scripts/example-evidence.mjs, not attributed to a kernel. See [grammar-reference-check.txt](grammar-reference-check.txt) for the full workspace result and unchanged-brand check.

The directions are generated design inputs; real-render references remain separate. Exact pixels, browser interactions and accessibility contrast still require implementation captures and UAT. No frontend implementation or brand decision files were changed.
