# Grammar reference comparison: all seven UI directions

Coordinator addendum completed by Codex. Brand remains rev 3; the existing brand record, mascot master, token wiring and brand evidence were not edited. All eight supplied reference PNGs were inspected before regeneration, alongside every screen component map and selected v4 direction.

| UI | Mismatch found | Corrected direction and exact prompt |
|---|---|---|
| ui.task.list | Missing composer SurfaceCard; task rows lie flat on canvas; count beside label; rectangular actions. | [PNG](list-many-tasks.png), [prompt](list-many-tasks.prompt.txt) |
| ui.share.invite | Outlined invitation panel; collaborator rows lie flat on canvas; no count; rectangular actions. | [PNG](../../../../share/ui/invite/assets/invite-refused.png), [prompt](../../../../share/ui/invite/assets/invite-refused.prompt.txt) |
| ui.login.sign-in | No bounded form SurfaceCard; outlined square controls and disabled rectangular action. | [PNG](../../../../login/ui/sign-in/assets/sign-in-refused.png), [prompt](../../../../login/ui/sign-in/assets/sign-in-refused.prompt.txt) |
| ui.notify.preferences | Outlined panel rather than raised SurfaceCard; rectangular primary and toggle actions. | [PNG](../../../../notify/ui/preferences/assets/preferences-refused.png), [prompt](../../../../notify/ui/preferences/assets/preferences-refused.prompt.txt) |
| ui.plan.usage | Outlined panel rather than raised SurfaceCard; rectangular upgrade action. | [PNG](../../../../plan/ui/usage/assets/usage-over-cap-frozen.png), [prompt](../../../../plan/ui/usage/assets/usage-over-cap-frozen.prompt.txt) |
| ui.audit.privacy | Two detached outlined panels contradict the mapped joined SurfaceCard; export variant contradicts secondary map. | [PNG](../../../../audit/ui/privacy/assets/privacy-erasure-refused.png), [prompt](../../../../audit/ui/privacy/assets/privacy-erasure-refused.prompt.txt) |
| ui.recur.schedule | Outlined panel; labels beside Inputs and hints below; rectangular actions. | [PNG](../../../../recur/ui/schedule/assets/schedule-refused.png), [prompt](../../../../recur/ui/schedule/assets/schedule-refused.prompt.txt) |

All seven required regeneration. Each owner has an updated visual-review.md and evidence.yaml. Original v4 PNG/prompt pairs are retained as edit inputs. Task and recurrence also retain the first anatomy correction, followed by a focused ink correction. All generated images are 1536 x 1024.

## Component comparison

| Component | Actual source | Decision |
|---|---|---|
| WorkspaceShell + NavigationFeatureNav | app-shell.png | Six signed-in screens use the real header composition; plain A/Alex account presence and named destination row. |
| SurfaceCard | sign-in-card.png, task-composer.png | Raised white rounded body, soft shadow and content inset. Auth gains its form card, task gains its composer; other outlined panels are replaced. Privacy joins its two action bands in one subject card, per its existing component map and the published composition prop. |
| SurfaceListCard | task-list.png, empty-state.png | Shared raised white row body, external label/fact above and footer below. Applied to task and collaborators, and mapped recurrence active/history variants. |
| Input | inputs.png, sign-in-card.png, task-composer.png | Label and hint above, error below; rounded field. Recurrence corrected from side labels. Brand dark error ink is preserved as a declared theme requirement. |
| Button | buttons.png | Pill primary/secondary/outline shapes and inactive fill. Black primary labels follow unchanged brand contrast; destructive outline capability remains declared. |
| Text, TextAction, Badge | text-and-actions.png | Plain text hierarchy, text links and neutral status labels; no invented message component. |
| EmptyNotice / StaticStateRow | empty-state.png / task-list.png plus installed source | empty-state.png visibly contains the All tasks / 0 tasks header and blank raised shell; it does not show legible EmptyNotice content. task-list.png supplies the repeated-row boundary. No separate visible StaticStateRow sample or Progress/PrimaryRailLayout render is present. Those prop and state contracts remain grounded in the inspected installed source and existing brand/business input, not falsely certified by these PNGs. |
| PrimaryRailLayout, MediaFrame, Progress, native radios/checkboxes | existing brand and accepted source/contracts | No dedicated render in this set; keep owner split auth, turtle placement, progress value/ratio and native control semantics. No screenshot certification is claimed. |

## Conflict disposition

COLLECTION-1 cases 1-4 and COLLECTION-2 prohibit an enclosing card, but @starci/grammar 0.4.13 SurfaceListCard actually renders a raised shell around its rows. The coordinator addendum explicitly requires this shipped anatomy. Preserve the external section label/fact and footer; use the published collection owner without an extra SurfaceCard or per-row cards. This is a documented knowledge/renderer conflict, not a claimed pass of those contradictory cases.

The user requested brand rev 3 unchanged, so this finding is recorded in UI-owned artifacts and gaps. Ops, knowledge, schema, checks, runtime and implementation code remain untouched.

## Verification

The seven owned verifiers check selected PNG and prompt hashes, retained image inputs, actual reference hashes, brand/business/knowledge hashes, explicit state/viewport maps and prompt citation order. Evidence is generated by actually running those commands with scripts/example-evidence.mjs; it is not kernel provenance. The overall example-work check retains its four pre-existing refusals and fifteen warnings, with no new refusal. See grammar-reference-check.txt for exact output.

These remain ImageGen directions, not browser renders. The supplied grammar-reference PNGs are the real component captures; the corrected directions approximate their anatomy. Current implementation/theme/danger/link gaps stay explicit.
