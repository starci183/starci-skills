# Execute preflight

1. Run `validate-input.mjs <input.json>`. Do not process an artifact that fails.
2. Verify the workspace route and ensure every requested write root belongs to it.
3. Classify business impact. Require routed business evidence for every product-facing request.
4. Run the frontend source-contract exporter. Resolve base contract plus permitted source delta into one effective contract artifact; do not ask a later model to merge them.
5. Resolve exactly one Grammar package and bind its package identity and lock hash.
6. Freeze the request, evidence set, source-contract artifact and Grammar lock as receipts under the run workspace.
7. Return only references and hashes. Withhold component payloads and Grammar prose from journey generation.
8. Run `validate-output.mjs <output.json>`. Emit `flow.generate / ready` only after it passes, with `preflight-complete`, `source-context-ready` and `grammar-lock-ready` facts.

Stop immediately if a route is stale, evidence is insufficient, export validation fails, more than one Grammar can own the run, or a requested write root escapes the verified workspace.

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| — | — | — | Preflight resolves receipts and does not load design knowledge. |
