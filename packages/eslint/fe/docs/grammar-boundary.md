# Grammar boundary

Law module: `grammar-boundary.mjs`. Catalogue: R62 FE_NATIVE_FORM_CONTROL (the grammar owns the element).

Page structure and text are composed from `@starci/grammar` (or the repository's `<family>-ui` package), not drawn as raw HTML.

Every rule below is an error in `starciFeConfig`; none can be switched off or suppressed inline.

## `starci-fe/no-raw-structural-element`

Page structure and text are grammar components, not raw `div`-family HTML; only `fe.package.ui` renderers draw raw tags.

Applies to app source that composes the grammar (slots `fe.feature`, `fe.components`, `fe.route`, `fe.hooks`) and to every workspace package except the `<family>-ui` package (`fe.package.ui`), whose components are the renderers. Spec files render raw HTML as a harness and are not judged; a file no slot owns is not judged.

The refused tags are exactly those `@starci/grammar` has a component for (the twin test reads the package source): `h1-h6` (`Heading`), `p` and `span` (`Text`), `hr` (`Divider`), `label` (`Label`), `form` (`Form`), `fieldset` (`Fieldset`), `dl` `dt` `dd` (`DescriptionList`), `table` `thead` `tbody` `tr` `td` `th` (`DataTable`), `ul` `ol` `li` (`SurfaceListCard`, `StaticStateRow`), `header` (`SectionHeader`, `TopBar`), `footer` (`Footer`), `nav` (`Subnav`, `Breadcrumbs`, `NavigationFeatureNav`), `section` (`SurfaceCard`), `main` (`WorkspaceShell`), `figure` and `figcaption` (`MediaFrame`). `div`, `br`, `aside` and `article` are not refused: the grammar has no component for them.

**Invalid** (`src/features/pages/home/component.tsx`)

```ts
export const Home = () => <section><p>{t("intro")}</p></section>
```

**Valid** (`src/features/pages/home/component.tsx`)

```ts
export const Home = () => <SurfaceCard><Text>{t("intro")}</Text></SurfaceCard>
```

**Finding code:** `FE_NATIVE_FORM_CONTROL`

**Why:** Raw `<tag>` in `<file>`. Page structure and text are composed from grammar components, not written as raw HTML.

**Fix:** Replace it with the matching grammar component (`Heading`, `Text`, `SurfaceCard`, ...); if the grammar lacks one, add it to the grammar or the ui package instead of drawing it in place.
