# Form flow — validate, disable while invalid, submit, then a success state

> The order below is Nielsen's fifth heuristic, error prevention, applied to data entry: a careful
> design that stops a problem from happening beats the best error message written after it happened.
> Baymard's checkout research is the empirical half — most of what makes a long form fail is
> structure and validation timing rather than the fields themselves.

## When this applies

Any multi-field data-entry form: a checkout address step, a job posting, a profile editor, an
account settings page. A single-field row that saves as soon as it is valid, with no submit button
at all, is a different case and follows the auto-save rule on the principles shelf instead.

## The five steps

**1. One form controller per form.** The form owns its state in one place and exposes it through one
interface: current values, a setter, the validation state, and a submit handler. The feature reads
nothing else. A component-level state variable mirroring a field is a second source of truth for one
value, and the two go out of step the moment either side resets — a reset after a successful submit,
a value arriving late from the server, a field cleared by a dependent change.

**2. Group fields by meaning, not one card per field.** A posting form groups into company, position
and how to apply; a checkout groups into contact, shipping and payment. Grouping is what makes a long
form readable at a glance, and it is the standard chunking result: a person handles a few labelled
groups far better than a dozen loose controls. One labelled card per meaning.

**3. Validate and disable together.** The submit control is disabled while a required field is empty
or invalid. Showing an error and leaving the button live invites the click and then refuses it,
which teaches the reader that the button is unreliable.

The condition on disabling is that the reader can always see *why*: each invalid field carries its
own message, so the disabled state is explained by something already on the screen rather than being
a locked door with no sign. A disabled button with no visible field errors is the failure mode
critics of disabled submits are describing, and it is a real failure — fix it by showing the errors,
not by enabling the button.

The front end disabling is a courtesy, not a guarantee. The server validates the same rule and
rejects what reaches it anyway, because the front end is not the only client.

**4. A submitting flag drives the pending state**, and the pending state is what blocks a double
submit. Do not track this with a separate variable: it belongs to the same form state as validity,
for the same reason as step one.

**5. Success replaces the layout; it is not a toast — when the form is a page.** After a successful
submit, the success view renders in place of the form: what happened, what it produced, and where to
go next. A toast on a page that still shows the form the reader just sent is ambiguous — it looks
like nothing moved.

A form inside a modal or drawer is the opposite case. There, success closes the overlay and raises a
toast, because the surface underneath is the context the reader came from and is the right thing to
return them to. Do not carry one rule into the other.

## Related

`search-filter-list-surface.md` — the sibling anatomy for a browsable list surface ·
`when-drawer.md` — where the optional half of a heavy form belongs.
