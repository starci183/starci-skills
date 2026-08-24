# Execute customer journey

1. Run `validate-input.mjs <input.json>` and verify `preflight-complete`. Do not process an artifact that fails.
2. Read the frozen request and routed business evidence only.
3. Establish the actor goal, entry, terminal success, meaningful failure and irreversible commitments.
4. Generate two or three complete directions. Change a material journey decision between directions, such as sequencing, progressive disclosure or where commitment occurs; cosmetic wording is not a distinct direction.
5. Describe each direction from first entry to terminal outcome. Do not collapse a multi-page capability into one representative page.
6. Declare one global progress owner for every linear multi-page journey. Forbid page-local duplicate progress models and journey-as-tabs.
7. Compare the directions with explicit benefits, costs and risks. Recommend one without selecting it for the user.
8. Hash the normalized batch and run `validate-output.mjs <output.json>`. Emit `flow.review / pending` only after it passes.
9. Pause for `OK FLOW <id>`. Rejection returns to this operation with feedback; approval is routed to page modeling.

Stop when evidence cannot establish the actor goal or terminal outcome, when fewer than two valid directions exist, or when candidates differ only in presentation.

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@customer-journey` | `fe.customer-journey` | qdrant | derive materially different end-to-end flow directions and shared journey ownership |
