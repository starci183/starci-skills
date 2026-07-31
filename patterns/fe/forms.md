# Form idioms — STRICT

Scope: how to WRITE a form in the app — library, validation, submit, error display. Grounded
entirely in `src/hooks/rhf/**` and its real consumers in `src/components/**`. This is code style,
not design.

## 1. A fixed stack: react-hook-form + zod + zodResolver

Every form is `useForm` (react-hook-form) with `zodResolver` (`@hookform/resolvers/zod`) and a `zod`
schema. Formik is gone, and per-field `useState` is not how state is kept.

```ts
// src/hooks/rhf/usePinExternalProjectForm.ts
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
const form = useForm<PinExternalProjectFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", description: "", url: "", techStack: "" },
})
```

No form file in the repo does `const [name, setName] = useState("")` and validates by hand.

## 2. Form logic lives in `src/hooks/rhf/`, not in the component

Each form is one hook `use<Name>Form.ts` under `src/hooks/rhf/`, marked `"use client"`, exporting
`FormValues` (an interface or `z.infer`), the schema where one is needed, and a hook returning
`{ ...form, onSubmit, … }`. The component only BINDS fields.

`src/hooks/rhf/useContactForm.ts` returns `{ ...form, onSubmit, sent, onSendAnother }` — spreading
every RHF method plus the already-wrapped `onSubmit`. Its consumer,
`src/components/features/contact/Contact/ContactForm/index.tsx`, takes only
`const { watch, setValue, onSubmit, formState } = useContactForm()`.

Calling `useForm(...)` directly inside a feature or modal component is the shape to move down into
an `rhf/` hook.

## 3. Schemas: localised messages go in a `useMemo`; static ones in a module const. Max lengths are module constants

A message that depends on `t()` puts the schema in `useMemo(() => z.object({...}), [t])`. With no
localisation, use `useMemo(…, [])` or a const outside the hook.

Length limits are `SCREAMING_SNAKE` constants beside the field, mirroring the database column.

```ts
// src/hooks/rhf/useContactForm.ts
const NAME_MAX = 100
const schema = useMemo(() => z.object({
    name: z.string().trim().min(1, t("contact.form.nameRequired")).max(NAME_MAX),
    email: z.string().trim().email(t("contact.form.emailInvalid")).max(EMAIL_MAX),
}), [t])
```

An optional-or-URL field is a union with the empty string, not `.optional()`:
`z.union([z.literal(""), z.string().trim().url().max(URL_MAX)])` (`useEditProfileForm.ts`,
`useSubmitJobPostingForm.ts`). An enum-or-not-yet-chosen field is
`z.union([z.nativeEnum(WorkMode), z.literal("")])`.

## 4. `onSubmit` wraps `handleSubmit` INSIDE the hook; the component writes only `<form onSubmit={onSubmit}>`

The hook returns `onSubmit = form.handleSubmit(async (value) => …)`. The component never calls
`handleSubmit` itself.

`src/hooks/rhf/usePersonalProjectIdeaForm.ts` does
`const onSubmit = form.handleSubmit(async (value) => {…}); return { ...form, onSubmit }`, and
`src/components/.../ContactForm/index.tsx` does
`<form onSubmit={onSubmit} className={cn("flex flex-col gap-3", className)}>`.

Writing `<form onSubmit={handleSubmit(doThing)}>` in the component puts the hook's job in the wrong
place.

## 5. API calls go through `useGraphQLWithToast`; a business error is `throw new Error(t(...))` inside the callback

Inside `handleSubmit`, call the SWR mutation within
`runGraphQL(async () => {…}, { showErrorToast, showSuccessToast })`. A cross-field problem or an
error envelope becomes `throw new Error(...)`, which the toast catches — not a field-level
`setError`.

```ts
// src/hooks/rhf/useSubmitJobPostingForm.ts
const onSubmit = form.handleSubmit(async (value) => runGraphQL(async () => {
    if (!companyId && !newCompanyTitle) throw new Error(t("jobs.post.errors.companyRequired"))
    const result = await submitJobPostingSwr.trigger({ … })
    const env = result?.data?.submitJobPosting
    if (!env) throw new Error(t("toast.defaultError"))
    if (env.success && env.data) onSuccess?.(env.data)
    return env
}, { showErrorToast: true, showSuccessToast: false }))
```

Note this is an FE idiom — a bare `Error` thrown inside a toast callback. The "always use a typed
exception" rule applies to the backend only.

## 6. Re-seeding from a store is the `values` option, not `defaultValues` plus a manual `reset`

A blank new form uses `defaultValues`. A form seeded from redux or props — an edit form — uses
`values:`, which replaces formik's old `enableReinitialize`.

`src/hooks/rhf/useEditProfileForm.ts` uses `values: { displayName: user?.displayName ?? "", … }`, so
it re-seeds whenever the redux user changes; `src/hooks/rhf/usePersonalProjectIdeaForm.ts` uses
`values: { ideaText: enrollment?.ideaText ?? "" }`.

## 7. Binding a field — three idioms, chosen by the kind of control

**`register("name")` spread** is the default for a plain text `Input` or `TextArea`. It is the
shortest, and preferred when no extra logic is needed:

```tsx
// src/components/modals/ManagePinnedProjectsModal/ExternalProjectForm/index.tsx
<Input id="pin-title" {...register("title")} />
```

**`Controller` with a render prop** is for a field that needs `fieldState` (invalid, touched) or a
custom control wrapper:

```tsx
// src/components/features/admin/AdminLogin/index.tsx
<Controller control={control} name="apiKey" render={({ field, fieldState }) => (
    <TextField variant="secondary" isInvalid={fieldState.invalid && fieldState.isTouched}>
        <Input name={field.name} ref={field.ref} value={field.value}
            onChange={(e) => field.onChange(e.target.value)} onBlur={field.onBlur} />
        <FieldError>{fieldState.error?.message}</FieldError>
    </TextField>
)} />
```

**`watch("name")` with `setValue("name", v)`** is REQUIRED for a non-native control — the vendor
`Select.Root` uses `selectedKey` and `onSelectionChange` — and whenever the value and `setValue` are
passed down into a child section:

```tsx
// src/components/features/careers/Jobs/JobPostForm/PositionSection/index.tsx
value={title} onChange={(event) => setValue("title", event.target.value)}
onSelectionChange={(key) => setValue("employmentType", …)}
```

Do not mix `register` with `value={watch(...)}` on the same input — that is double control. One
field, one idiom.

## 8. Errors render under the field, `body-xs` in `text-danger-soft-foreground`, with `isInvalid` on the `TextField`

For a text field bound by register or watch, render conditionally with `? :`, never `&&`:
`errors.x ? <Typography slot="description"|"errorMessage" type="body-xs" className="text-danger-soft-foreground">{errors.x.message}</Typography> : null`.

For a `Controller`, use the vendor's `<FieldError>{fieldState.error?.message}</FieldError>`.

Mark the field invalid with `isInvalid={Boolean(errors.title)}` on `<TextField>`, as
`src/components/.../ExternalProjectForm/index.tsx` does.

An `alert()` or a toast for a field-level validation error is the wrong channel: field errors show
inline, and toasts are for API or business errors (§5).

## 9. The submit button is `type="submit"` with `isPending={isSubmitting}` and a hand-rendered spinner

Take `isSubmitting` from `formState`. `isPending` alone does NOT render a spinner, so render
`<Spinner/>` yourself, or change the label. Disabling while submitting or invalid is optional.

```tsx
// src/components/.../ExternalProjectForm/index.tsx
<Button type="submit" variant="primary" fullWidth isDisabled={isSubmitting} isPending={isSubmitting}>
    {({ isPending }) => (<>{isPending ? <Spinner color="current" size="sm" /> : null}{t("pinnedProjects.form.submit")}</>)}
</Button>
```

`ContactForm` swaps the label instead, which is equally valid:
`<Button type="submit" isPending={isSubmitting}>{isSubmitting ? t("...submitting") : t("...submit")}</Button>`.

`<Button onPress={onSubmit}>` is the shape to avoid — submission goes through `<form onSubmit>` with
`type="submit"`, never an onPress handler.

## 10. The exception: not every form is RHF — but it must mimic the interface

A form with a special need — nested field arrays plus debounced auto-save — may be hand-rolled, but
it returns a compatible shape so consumers do not change.

`src/hooks/rhf/useEditSubmissionForm.ts` deliberately avoids RHF and returns
`{ values, errors, touched, setFieldValue, setFieldTouched, isSubmitting }` — a formik-like shape —
for `ChallengeSubmissionPanel`.

The default remains RHF with zod (§1); deviate only with a clear reason, and keep the interface
consistent.
