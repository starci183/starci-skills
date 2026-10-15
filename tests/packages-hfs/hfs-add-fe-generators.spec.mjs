import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { addFePage, readFeContext, writeFePlan } from "../../packages/hfs/scaffold/add-fe-page.mjs";
import { addFeOverlay } from "../../packages/hfs/scaffold/add-fe-overlay.mjs";

const ts = createRequire(import.meta.url)("typescript");
const made = [];
const source = "fe/apps/web/src";
const read = (root, relative) => fs.readFileSync(path.join(root, ...relative.split("/")), "utf8");
const write = (root, relative, body) => {
  const file = path.join(root, ...relative.split("/"));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
};
const jsonText = (value) => `${JSON.stringify(value, null, 2)}\n`;
const refuses = (run, code) => assert.throws(run, (error) => error.code === code);

test.after(() => {
  for (const root of made) fs.rmSync(root, { recursive: true, force: true });
});

function appRoot(edition, apps = [{ name: "web", kind: "next" }]) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hfs-add-fe-"));
  made.push(root);
  write(root, "hfs.json", jsonText({
    hfs: 3, kind: "app", edition, project: "demo",
    sides: { be: { apps: [{ name: "api", kind: "api" }], kinds: ["api"], connections: [] }, fe: { apps, reads: [] } },
  }));
  write(root, "package.json", jsonText({ name: "demo", private: true }));
  for (const app of apps) {
    for (const locale of ["vi", "en"]) {
      write(root, `fe/apps/${app.name}/src/modules/i18n/messages/${locale}.json`, jsonText({ app: { home: { title: "Demo" } } }));
    }
    write(root, `fe/apps/${app.name}/src/modules/routes/index.ts`, '/** The home destination. */\nexport const APP_ROUTES = { home: "/" } as const\n');
  }
  return root;
}

function snapshot(root) {
  const visit = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) return [[path.relative(root, file), fs.readlinkSync(file)]];
    return entry.isDirectory() ? visit(file) : [[path.relative(root, file), fs.readFileSync(file, "utf8")]];
  });
  return visit(root);
}

function parses(root, files) {
  for (const file of files.filter((relative) => /\.tsx?$/.test(relative))) {
    const parsed = ts.createSourceFile(file, read(root, file), ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    assert.deepEqual(parsed.parseDiagnostics, [], file);
  }
}

for (const edition of ["lite", "full"]) {
  test(`addFePage ${edition} creates a server owner, a thin route, metadata and localized copy`, () => {
    const root = appRoot(edition);
    const declaration = read(root, "hfs.json");
    const result = addFePage({ root, name: "sales-summary", route: "reports/sales" });
    assert.deepEqual(result.registered, { app: "web", page: "SalesSummaryPage", route: "/reports/sales" });
    assert.equal(result.created.length, 3);
    assert.equal(result.updated.length, 3);
    const route = read(root, `${source}/app/[locale]/reports/sales/page.tsx`);
    assert.match(route, /salesSummaryMetadata as generateMetadata/);
    assert.match(route, /const Page = \(\) => <SalesSummaryPage \/>/);
    assert.doesNotMatch(route, /use client|useTranslations|Heading/);
    const entry = read(root, `${source}/features/pages/SalesSummaryPage/index.tsx`);
    assert.match(entry, /getTranslations\("app\.pages\.sales-summary"\)/);
    assert.match(entry, /canonical: SALES_SUMMARY_PAGE_ROUTE/);
    assert.doesNotMatch(entry, /use client/);
    assert.match(read(root, `${source}/modules/routes/index.ts`), /SALES_SUMMARY_PAGE_ROUTE = "\/reports\/sales"/);
    for (const [locale, title] of [["vi", "Trang m\u1edbi"], ["en", "New page"]]) {
      const catalog = JSON.parse(read(root, `${source}/modules/i18n/messages/${locale}.json`));
      assert.deepEqual(catalog.app.pages["sales-summary"], { title });
      assert.deepEqual(catalog.app.home, { title: "Demo" });
    }
    assert.equal(read(root, "hfs.json"), declaration);
    parses(root, [...result.created, ...result.updated]);
    const before = snapshot(root);
    refuses(() => addFePage({ root, name: "sales-summary" }), "HFS_ADD_EXISTS");
    assert.deepEqual(snapshot(root), before, "replay refuses without changing an owner");
  });

  test(`addFePage ${edition} rejects invalid names, traversal and existing routes before any write`, () => {
    const root = appRoot(edition);
    const before = snapshot(root);
    for (const name of ["../other", "bad/name", "bad--name", "CON", "con", "-bad", "bad-", ""]) {
      refuses(() => addFePage({ root, name }), "HFS_ADD_NAME_INVALID");
    }
    for (const route of ["../outside", "/absolute", "reports//sales", String.raw`reports\sales`, "[id]"]) {
      refuses(() => addFePage({ root, name: "sales", route }), "HFS_ADD_NAME_INVALID");
    }
    assert.deepEqual(snapshot(root), before);
    write(root, `${source}/app/[locale]/sales/page.tsx`, "existing route\n");
    const existing = snapshot(root);
    refuses(() => addFePage({ root, name: "sales" }), "HFS_ADD_EXISTS");
    assert.deepEqual(snapshot(root), existing);
  });

  test(`addFePage ${edition} requires declared selection and both catalogs`, () => {
    const root = appRoot(edition, [{ name: "web", kind: "next" }, { name: "admin", kind: "next" }]);
    refuses(() => addFePage({ root, name: "sales" }), "HFS_ADD_OPTION_MISSING");
    refuses(() => addFePage({ root, app: "missing", name: "sales" }), "HFS_ADD_APP_UNKNOWN");
    const result = addFePage({ root, app: "admin", name: "sales", messages: { vi: { title: "Doanh s\u1ed1" }, en: { title: "Sales" } } });
    assert.ok(result.created.every((file) => file.startsWith("fe/apps/admin/")));
    assert.equal(JSON.parse(read(root, "fe/apps/admin/src/modules/i18n/messages/en.json")).app.pages.sales.title, "Sales");
    fs.rmSync(path.join(root, ...source.split("/"), "modules/i18n/messages/en.json"));
    const before = snapshot(root);
    refuses(() => addFePage({ root, app: "web", name: "orders" }), "HFS_ADD_I18N_MISSING");
    assert.deepEqual(snapshot(root), before);
  });

  test(`addFeOverlay ${edition} mounts a public client owner in its existing server page`, () => {
    const root = appRoot(edition);
    addFePage({ root, name: "sales" });
    const result = addFeOverlay({ root, name: "details", page: "sales", ts });
    assert.deepEqual(result.registered, { app: "web", overlay: "DetailsOverlay", page: "SalesPage" });
    assert.equal(result.created.length, 2);
    const page = read(root, `${source}/features/pages/SalesPage/index.tsx`);
    assert.match(page, /import \{ DetailsOverlay \} from "@\/features\/overlays\/DetailsOverlay"/);
    assert.match(page, /<SalesPageBase props=/);
    assert.match(page, /<DetailsOverlay \/>/);
    assert.doesNotMatch(page, /use client/);
    const entry = read(root, `${source}/features/overlays/DetailsOverlay/index.tsx`);
    assert.match(entry, /^"use client"/);
    assert.match(entry, /useTranslations\("app\.overlays\.details"\)/);
    const pure = read(root, `${source}/features/overlays/DetailsOverlay/component.tsx`);
    assert.match(pure, /trigger=\{<Button>\{props\.props\.open\}<\/Button>\}/);
    assert.match(pure, /closeLabel=\{props\.props\.close\}/);
    assert.doesNotMatch(pure, /useTranslations|useState|"use client"/);
    const vi = JSON.parse(read(root, `${source}/modules/i18n/messages/vi.json`)).app.overlays.details;
    const en = JSON.parse(read(root, `${source}/modules/i18n/messages/en.json`)).app.overlays.details;
    assert.deepEqual(Object.keys(vi), Object.keys(en));
    assert.equal(vi.close, "\u0110\u00f3ng");
    assert.equal(en.close, "Close");
    parses(root, [...result.created, ...result.updated]);
    const before = snapshot(root);
    refuses(() => addFeOverlay({ root, name: "details", page: "sales", ts }), "HFS_ADD_EXISTS");
    assert.deepEqual(snapshot(root), before);
  });

  test(`addFeOverlay ${edition} rejects an absent, client or branching host without changing catalogs`, () => {
    const root = appRoot(edition);
    refuses(() => addFeOverlay({ root, name: "details", ts }), "HFS_ADD_OPTION_MISSING");
    refuses(() => addFeOverlay({ root, name: "details", page: "absent", ts }), "HFS_ADD_WIRE_MISSING");
    const file = `${source}/features/pages/SalesPage/index.tsx`;
    for (const text of [
      '"use client"\nexport const SalesPage = () => <div />\n',
      'export const SalesPage = () => { if (ready) return <div />; return <main /> }\n',
      'export const SalesPage = () => null\n',
      'export const SalesPage = () => { return }\n',
      'export const SalesPage = () => (<div />\n',
      'export const OtherPage = () => <div />\n',
    ]) {
      write(root, file, text);
      const before = snapshot(root);
      refuses(() => addFeOverlay({ root, name: "details", page: "sales", ts }), "HFS_ADD_WIRE_INVALID");
      assert.deepEqual(snapshot(root), before);
    }
  });

  test(`addFeOverlay ${edition} supports a parenthesized JSX expression without replacing the page body`, () => {
    const root = appRoot(edition);
    const file = `${source}/features/pages/SalesPage/index.tsx`;
    write(root, file, 'import { SalesBlock } from "@/components/blocks/SalesBlock"\n\n/** Sales page. */\nexport const SalesPage = () => (<SalesBlock />)\n');
    const result = addFeOverlay({ root, name: "details", page: "sales", ts });
    assert.match(read(root, file), /\/\*\* Sales page\. \*\//);
    assert.match(read(root, file), /<SalesBlock \/>/);
    assert.match(read(root, file), /<DetailsOverlay \/>/);
    parses(root, [...result.created, ...result.updated]);
  });

  test(`addFeOverlay ${edition} preserves async copy resolution, parenthesized JSX and existing imports`, () => {
    const root = appRoot(edition);
    const file = `${source}/features/pages/SalesPage/index.tsx`;
    const body = [
      'import { getTranslations } from "next-intl/server"',
      'import { SalesBlock } from "@/components/blocks/SalesBlock"',
      '',
      '/** Localized sales page. */',
      'export const SalesPage = async () => {',
      '    const t = await getTranslations("app.home")',
      '    return (<SalesBlock title={t("title")} />)',
      '}',
      '',
    ].join("\n");
    write(root, file, body);
    const result = addFeOverlay({ root, name: "details", page: "sales", ts });
    const mounted = read(root, file);
    assert.match(mounted, /const t = await getTranslations\("app\.home"\)/);
    assert.match(mounted, /export const SalesPage = async/);
    assert.match(mounted, /<SalesBlock title=\{t\("title"\)\} \/>/);
    assert.match(mounted, /<DetailsOverlay \/>/);
    assert.equal(mounted.split('from "next-intl/server"').length, 2);
    assert.doesNotMatch(mounted, /use client/);
    parses(root, [...result.created, ...result.updated]);
  });

  test(`generators ${edition} refuse malformed catalogs and invalid copy without writing a partial owner`, () => {
    const root = appRoot(edition);
    addFePage({ root, name: "home" });
    const catalog = `${source}/modules/i18n/messages/en.json`;
    for (const body of ["{broken", "null", "[]", '"catalog"', '{"app":[]}', '{"app":{"pages":false,"overlays":false}}']) {
      write(root, catalog, body);
      const before = snapshot(root);
      refuses(() => addFePage({ root, name: "sales" }), "HFS_ADD_I18N_INVALID");
      refuses(() => addFeOverlay({ root, name: "details", page: "home", ts }), "HFS_ADD_I18N_INVALID");
      assert.deepEqual(snapshot(root), before);
    }
    write(root, catalog, jsonText({ app: { home: { title: "Demo" } } }));
    const before = snapshot(root);
    refuses(() => addFePage({ root, name: "sales", messages: { en: { title: "  " } } }), "HFS_ADD_I18N_INVALID");
    refuses(() => addFeOverlay({ root, name: "details", page: "home", messages: { en: { title: "Details" } }, ts }), "HFS_ADD_I18N_INVALID");
    assert.deepEqual(snapshot(root), before);
  });

  test(`generators ${edition} keep an additional locale in lockstep when supplied its messages`, () => {
    const root = appRoot(edition, [{ name: "web", kind: "next" }, { name: "admin", kind: "next" }]);
    const selected = "fe/apps/admin/src";
    write(root, `${selected}/modules/i18n/messages/fr.json`, jsonText({ app: { home: { title: "D\u00e9mo" } } }));
    const unselected = snapshot(path.join(root, "fe/apps/web"));
    const page = addFePage({ root, app: "admin", name: "sales", messages: { fr: { title: "Ventes" } } });
    const overlay = addFeOverlay({
      root, app: "admin", name: "details", page: "sales", ts,
      messages: { fr: { title: "Informations", open: "Ouvrir", close: "Fermer", description: "Informations de cette page." } },
    });
    assert.ok([...page.created, ...page.updated, ...overlay.created, ...overlay.updated].every((file) => file.startsWith(`${selected}/`)));
    const catalogs = ["vi", "en", "fr"].map((locale) => JSON.parse(read(root, `${selected}/modules/i18n/messages/${locale}.json`)).app);
    for (const catalog of catalogs) {
      assert.deepEqual(Object.keys(catalog.pages.sales), ["title"]);
      assert.deepEqual(Object.keys(catalog.overlays.details), ["title", "open", "close", "description"]);
    }
    assert.equal(catalogs[2].pages.sales.title, "Ventes");
    assert.equal(catalogs[2].overlays.details.close, "Fermer");
    assert.deepEqual(snapshot(path.join(root, "fe/apps/web")), unselected);
    parses(root, [...page.created, ...page.updated, ...overlay.created, ...overlay.updated]);
  });

  test(`writeFePlan ${edition} restores exact bytes after a partial create or partial update`, (context) => {
    const root = appRoot(edition);
    const selected = readFeContext({ root });
    const relative = `${source}/modules/routes/index.ts`;
    const old = read(root, relative);
    const before = snapshot(root);
    const originalWrite = fs.writeFileSync;
    let failed = false;
    context.mock.method(fs, "writeFileSync", (file, body, options) => {
      if (!failed && body === "partial create") {
        originalWrite(file, "part", options);
        failed = true;
        throw new Error("injected partial create");
      }
      return originalWrite(file, body, options);
    });
    assert.throws(() => writeFePlan(selected, [{
      relative: `${source}/features/pages/OnePage/index.tsx`, body: "partial create",
    }], []), /injected partial create/);
    assert.deepEqual(snapshot(root), before, "an opened and partially written new file is removed");
    context.mock.restoreAll();
    failed = false;
    context.mock.method(fs, "writeFileSync", (file, body, options) => {
      if (!failed && body === "partial update") {
        originalWrite(file, "part", options);
        failed = true;
        throw new Error("injected partial update");
      }
      return originalWrite(file, body, options);
    });
    assert.throws(() => writeFePlan(selected, [{
      relative: `${source}/features/pages/OnePage/index.tsx`, body: "created",
    }], [{ relative, before: old, body: "partial update" }]), /injected partial update/);
    assert.deepEqual(snapshot(root), before, "updated owners and all created directories are restored");
    context.mock.restoreAll();
  });
}

test("catalog collision, extra locales and missing routes all refuse atomically", () => {
  const root = appRoot("lite");
  const en = `${source}/modules/i18n/messages/en.json`;
  write(root, en, jsonText({ app: { pages: { sales: { title: "Existing" } } } }));
  const before = snapshot(root);
  refuses(() => addFePage({ root, name: "sales" }), "HFS_ADD_EXISTS");
  assert.deepEqual(snapshot(root), before);
  write(root, en, jsonText({ app: { home: { title: "Demo" } } }));
  write(root, `${source}/modules/i18n/messages/fr.json`, jsonText({ app: { home: { title: "D\u00e9mo" } } }));
  refuses(() => addFePage({ root, name: "sales" }), "HFS_ADD_I18N_INVALID");
  fs.rmSync(path.join(root, ...source.split("/"), "modules/routes/index.ts"));
  const missing = snapshot(root);
  refuses(() => addFePage({ root, name: "sales", messages: { fr: { title: "Ventes" } } }), "HFS_ADD_WIRE_MISSING");
  assert.deepEqual(snapshot(root), missing);
});

test("unsafe symlink ancestors are refused before catalog or source reads", (context) => {
  const root = appRoot("lite");
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "hfs-add-fe-outside-"));
  made.push(outside);
  const features = path.join(root, ...source.split("/"), "features");
  try { fs.symlinkSync(outside, features, "junction"); } catch (error) {
    if (error.code === "EPERM" || error.code === "EACCES") { context.skip("directory symlinks are unavailable"); return; }
    throw error;
  }
  const before = snapshot(root);
  refuses(() => addFePage({ root, name: "sales" }), "HFS_ADD_PATH_UNSAFE");
  assert.deepEqual(snapshot(root), before);
  assert.deepEqual(fs.readdirSync(outside), []);
  fs.unlinkSync(features);
});

test("a failed write removes only new files and restores catalog bytes", (context) => {
  const root = appRoot("full");
  const selected = readFeContext({ root });
  const relative = `${source}/modules/routes/index.ts`;
  const before = snapshot(root);
  const old = read(root, relative);
  const originalWrite = fs.writeFileSync;
  let failed = false;
  context.mock.method(fs, "writeFileSync", (file, body, options) => {
    if (!failed && body === "fail here") { failed = true; throw new Error("injected write failure"); }
    return originalWrite(file, body, options);
  });
  assert.throws(() => writeFePlan(selected, [
    { relative: `${source}/features/pages/OnePage/index.tsx`, body: "created" },
  ], [{ relative, before: old, body: "fail here" }]), /injected write failure/);
  assert.deepEqual(snapshot(root), before);
  context.mock.restoreAll();
});
