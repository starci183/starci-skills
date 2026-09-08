# Request test findings

## Grounding

The hard case is the authenticated AgentOS workspace control center. It has seven tabs, three request states, live runtime values, fail-closed app availability, an external OpenClaw launch, and intentionally disabled lifecycle controls. Test artifacts are synthetic summaries of these facts; they are not copied source, generated images, or visual-quality evidence.

Nivo frontend revision: `5eec15cfa4664b95b7980aba3f03e74a95d55f21`.

- `apps/app/src/components/blocks/agentos/AgentOSWorkspaceControlCenter/component.tsx` — SHA-256 `ef6c80d05bf73c6390dc4ad8c74314441d62b4fe0c535a5b32b6ebfd14fa862b`
- `apps/app/src/components/blocks/agentos/AgentOSWorkspaceControlCenter/index.tsx` — SHA-256 `2bbb7381345086e77965f7e6b676d67a214f1d34fcb36fac6e693c823d367311`
- `apps/app/src/components/blocks/agentos/AgentOSWorkspaceApplications/index.tsx` — SHA-256 `01a3499c3e4fc8b7a1c5ff5feb97a2146c5d6acac3c6641823621b689f70240b`
- `apps/app/src/components/blocks/operations/AgentOSWorkspaceOperations/index.tsx` — SHA-256 `83ffbdef3840c58a17a6cf17a0709aca02ea51fb357d697fc33a0bb7e2868976`
- `apps/app/src/components/blocks/agentos/AgentOSWorkspaceRuntime/index.tsx` — SHA-256 `e0dad3026e433906345088a738aa5b10d8b18fbfdabff782f88c24a1d6db16c2`
- `apps/app/src/modules/api/console.ts` — SHA-256 `4d077547639e37f408a2b567ae225cc01132cf382128eab185123097aeaa487c`

Nivo backend revision: `5adaf96fc4d4deffbd2460ce18e0b84c897ce17b`.

- `src/features/core/api/core/graphql/queries/agent-workspace/my-agent-workspace-control-center/my-agent-workspace-control-center.resolver.ts` — SHA-256 `237d50819ef1c6991cb3db80e19c117eea101ab34cc109a4cad6fbe296eb6e20`
- `src/features/core/api/core/graphql/queries/agent-workspace/my-agent-workspace-control-center/my-agent-workspace-control-center.handler.ts` — SHA-256 `d902ed0edd4aff0cd3f51a8b6f7400b0dcc9c54f2339bee7efc5444f6401bf8a`
- `src/features/core/api/core/graphql/queries/agent-workspace/my-agent-workspace-control-center/graphql-types/response.ts` — SHA-256 `481568508f0cbcd40c81331b26f517159e10ef5b883be2a526737ebdbc123521`

## Result

Command, with the available schema dependencies supplied through `PYTHONPATH`:

```powershell
python .claude/operators/interface.draw/tests/run.py --case request
```

Sixteen tests pass. They cover a complete Nivo-derived request, input/context separation, changed or missing references, parent traversal, work-root identity, duplicate criterion references, recovery routing, and visual inheritance.

Two machine-contract defects found by the first run were corrected before the final run: duplicate `expected[].id` values are now rejected, and request-only validation now binds the work directory name to `request.workId` before consuming files.

The visual cases establish these boundaries:

- `new` rejects `baselinePath`.
- `extend` and `revise` require both a baseline path and nonempty preservation instructions.
- A valid inheritance request binds exactly one declared image in `context.files`; a text file, undeclared path, or duplicate matching entry is rejected.
- Changed baseline bytes fail digest verification before drawing.
- An existing Nivo surface cannot be treated as inherited state without an explicit `extend` or `revise` baseline contract.

File failures and invalid visual inheritance map to `request-correction` at `read-brief`. Essential missing context also maps to correction rather than image regeneration.

Free-text meaning remains a review concern. A vague “Draw a dashboard” request is structurally valid but must take the `missing-essential-context` recovery when a worker finds no usable surface, audience, content, or action brief. Instructions that conflict with bound Nivo behavior are also structurally valid; `brief-fidelity` and `implementation-feasibility` review must catch them before acceptance. These cases intentionally do not expect JSON Schema to infer arbitrary prose.

## Limits

The tests exercise the checked-in compiled bundle and production validator with synthetic local files. They do not run Nivo, authenticate, call external services, invoke ImageGen, inspect pixels, or prove visual quality. The one-pixel baseline is a simulated inheritance artifact used only for path, media-type, and hash checks.
