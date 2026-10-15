Owner: knowledge/application-stacks.yaml
# Runtime example sealed members

The public runtime repository stores member names and environment-key inventories. It stores no ciphertext. Application repositories still keep their genuine SOPS/age members under `.starcistacks/<environment>/secrets/`; R253 and R277 continue to judge that custody.

Run a check against an example after installing its declared dependencies:

```sh
starci runtime example-secrets --run examples/lite-app -- npm run lint
```

The runner copies the example into an `os.tmpdir()` directory, creates a fresh age identity and seals the declared members with random, nondeployable values. The private identity is written only to a separate private temporary directory, zeroed in memory, and removed before the check starts. The copy's public SOPS recipient matches its envelopes. The runner links the example's installed dependencies, makes existing coverage input available, returns generated `reports/` artifacts to the source example and removes the temporary copy even when the check fails. Its exit status is the check's exit status.

The copy excludes existing ciphertext, host custody, private environment files, private-key files and source symlinks. It uses an isolated Git index so source checks see the generated application members without adding anything to the runtime index. Public environment examples remain available.

Specs and runtime checks use the same helper:

```js
import { withMaterializedExample } from '../scripts/hfs/example-secrets.mjs';

await withMaterializedExample(runtimeRoot, 'examples/lite-app', async (appRoot) => {
  await checkExample(appRoot);
});
```

The callback receives the temporary application root; its result is returned after cleanup. The optional `linkDependencies: true` option is for checks that execute installed app tooling. The optional `materialize` function is an explicit fixture seam for tests that supply their own public member source.

`materializeExample(copyRoot)` is the lower-level operation for an already disposable copy. It returns the generated member paths and needs no native SOPS or age executable. It refuses existing declared envelopes before changing the recipient; it never rotates or overwrites owner-provisioned custody. A tree without declared members is a no-op.

The portable writer in `scripts/hfs/sealed-members.mjs` derives member names from the stack manifest and environment descriptors, and key names from the environment inventory (or a member's conventional key name). Scaffolding uses it after creating the new application's own recipient and ignored host identity. The secret-init flow fills only missing declared members, retaining each existing recipient policy and every owner-provisioned envelope. Replace generated app placeholders with operator-provided values before deployment; examples and scaffolding supply no operational credentials.
