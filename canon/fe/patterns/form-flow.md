# Form flow — validate, disable while invalid, submit, then a success state

> Shell and route: `useSubmitJobPostingForm` (`src/hooks/rhf/useSubmitJobPostingForm.ts`) with
> `JobPostForm`. The sibling react-hook-form hooks live together in `src/hooks/rhf/*` —
> `useEditProfileForm`, `useContactForm`, `usePinExternalProjectForm`, `useEditSubmissionForm`.

## When this applies

Any multi-field data-entry form. A single-field per-row auto-save — the submission URL that saves as
soon as it is valid, with no Submit button — is a different case and follows the auto-save rule in
the principles set instead.

## The five steps

**1. One react-hook-form hook per form**, at `src/hooks/rhf/use<Form>.ts`, returning `watch`,
`setValue`, `formState` and `onSubmit`. The feature reads only through the hook. A parallel
`useState` mirroring a field is a second source of truth for one value, and the two go out of step
the moment either side resets.

**2. Group fields by meaning**, one `LabeledCard` per meaning — company, position, apply method —
not one card per field. The card component canon, section 6, is the reference.

**3. Validate and disable together.** The submit button is `isDisabled` while a required field is
empty or invalid. Showing an error message while leaving the button live invites the click and then
refuses it. There are two layers here: the front end disables, and the back end throws when the
field is missing — see `submit-requires-valid-input-fe-disable-be-throw` in the engineering set.

**4. `isSubmitting`** from `formState` drives the button's `isPending`, which is what blocks a
double submit.

**5. Success replaces the layout; it is not a toast** — when the form *is* a page. After a
successful submit, render the success component (`SubmitSuccess`) in place of the form. A form
inside a modal or drawer is a different context: there, success closes the overlay and raises a
toast. Do not carry one rule into the other.

## Related

`search-filter-list-surface.md` — the sibling anatomy for a browsable list surface.
