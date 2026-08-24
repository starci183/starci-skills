# Customer journey input

Customer journey accepts `flow.generate / ready` only after preflight has frozen the request, routed business evidence and workspace receipts.

The input carries references and hashes, not source components or Grammar implementation instructions. Its product material is limited to:

- the actor, goal and requested scope from the frozen request;
- business evidence references;
- known entry, completion and failure conditions;
- explicit constraints that change the user journey.

Source capability, CSS, component names and existing page topology are intentionally absent. They cannot decide what the user must accomplish.
