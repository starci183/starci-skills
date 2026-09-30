# Formatting numbers, money and dates

Law module: `formatting.mjs`. Catalogue: R59 FE_I18N_PLACEMENT, sub-check `FE_I18N_FORMATTER`.

`next-intl` owns the reader's locale and time zone and hands them to `useFormatter()` / `getFormatter()`. `toLocale*String`, `new Intl.*`, displayed `toFixed`, a currency symbol glued to a template substitution and the date libraries either guess the locale (server and browser disagree, so a price flickers on hydration) or hard-code one. `modules/i18n/**` is exempt: it is where formats are configured.

Every rule below is an error in `starciFeConfig`; none can be switched off or suppressed inline.

## `starci-fe/use-intl-formatter`

Format numbers, money and dates with `useFormatter` / `getFormatter` from `next-intl`.

**Invalid** (`src/components/blocks/Feed/component.tsx`)

```tsx
<p>{new Date(at).toLocaleString()}</p>
```

**Valid** (`src/components/blocks/Feed/component.tsx`)

```tsx
const format = useFormatter()
<p>{format.dateTime(new Date(at), { dateStyle: "medium" })}</p>
```

**Finding code:** `FE_I18N_FORMATTER`

**Why:** `<file>` formats a number, money or date with `toLocale*String`, `new Intl.*`, `toFixed`, a currency symbol pasted into a template, or a date library, instead of the next-intl formatter.

**Fix:** Use `useFormatter()` (or `getFormatter()` on the server): `number(...)`, `dateTime(...)`, `relativeTime(...)`.
