# workspace/device-checkpoint input

The input is a closed, task-session envelope for one explicitly authorized stop-time checkpoint. It never embeds source bodies, credentials, database values, volume bytes, or master-identity material.

## JSON architecture

| Section | Ownership |
| --- | --- |
| `payload.provided` | Exact route receipt, external-mutation approval, touched-checkout set and portable device-state contract reference supplied by the parent skill. |
| `payload.loads` | Exact session artifacts and orchestration profile resolved by the runtime; no Qdrant knowledge body is loaded. |
| `payload.session` | Task-owned input, output and scratch slots retained only until the parent skill terminal. |

Every provided reference must have one exact runtime-loaded artifact binding. The touched-checkout set is closed before Git inspection; adjacent repositories and working trees are forbidden.
