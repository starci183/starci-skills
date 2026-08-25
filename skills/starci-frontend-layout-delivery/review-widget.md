# Frontend review widget

This file governs presentation only. Operator schemas, validated session artifacts, and the state machine remain authoritative.

## When to render

- At `flow.review`, compare all customer-journey directions in one in-conversation interactive HTML widget.
- At `layout.review`, compare all responsive layout directions in one in-conversation interactive HTML widget.
- Use the smallest accessible text fallback only when the conversation host cannot render an interactive visual.

## Required content

- Make the recommended direction useful on first render and label it clearly.
- Preserve every exact direction ID and display the exact approval command for the active direction.
- Show the material differences the operator used to rank directions: sequence or region structure, decision timing, recovery, page boundaries, responsive behavior, risk, and implementation cost as applicable.
- Keep presentation-only selection local to the widget. A click, tab, or toggle does not approve a direction or mutate the operator result.
- Ask for the exact approval command outside the widget and stop at the machine wait.

## Guardrails

- Do not use ASCII art, plain-text box drawings, or a code block as the primary review when an interactive visual is available.
- Do not invent business rules, product metrics, pages, controls, workbench kinds, or implementation decisions to make the review look complete.
- Do not compress a genuine multi-page journey into tabs. Tabs or buttons may switch between review alternatives only.
- Do not persist the widget as product source, generated business authority, or durable machine state.
- Keep exact hashes and evidence references in the validated task-session result; show only the identifiers needed for the user to decide.
- When the host visualization directive carries an absolute filesystem path, serialize the directive as valid JSON and normalize Windows path separators to `/`. Never place raw `\` separators in the JSON `path` value because escape sequences can cause the host to discard the widget silently.
- Emit the visualization directive in the same final response as the review and place the exact approval command after it. If the host still cannot display the widget, immediately provide the smallest accessible comparison fallback while preserving the same direction IDs and approval commands.
