import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { addApp } from "../../packages/hfs/scaffold/add-app.mjs";

const made = [];
test.after(() => {
  for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});

function appRoot(edition) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hfs-add-app-lite-"));
  made.push(root);
  const declaration = {
    hfs: 3,
    kind: "app",
    ...(edition === "lite" ? { edition } : {}),
    project: "demo",
    sides: {
      be: {
        apps: [{ name: "api", kind: "api" }],
        kinds: ["api"],
        connections: [],
      },
      fe: { apps: [{ name: "web", kind: "next" }], reads: [] },
    },
  };
  fs.writeFileSync(
    path.join(root, "hfs.json"),
    `${JSON.stringify(declaration, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(root, "package.json"),
    `${JSON.stringify({ name: "demo", private: true, workspaces: ["fe/packages/*"] }, null, 2)}\n`,
  );
  fs.mkdirSync(path.join(root, "fe", "apps", "web"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "fe", "apps", "web", "package.json"),
    `${JSON.stringify(
      {
        name: "@demo/web",
        version: "0.0.0",
        private: true,
        scripts: { build: "next build" },
        dependencies: { next: "16.0.0", react: "19.2.0" },
      },
      null,
      2,
    )}\n`,
  );
  return root;
}

const read = (root, relative) =>
  fs.readFileSync(path.join(root, ...relative.split("/")), "utf8");

test("addApp adds a second lite front end with the lite app skeleton and the shared app core (owner ruling 2026-10-13: one fe structure)", () => {
  const root = appRoot("lite");
  const result = addApp({ root, name: "admin" });
  for (const relative of [
    "fe/apps/admin/src/app/[locale]/layout.tsx",
    "fe/apps/admin/src/app/health/live/route.ts",
    "fe/apps/admin/src/modules/api/graphql/types.ts",
    "fe/apps/admin/src/hooks/auth/useSignIn.ts",
    "fe/apps/admin/src/modules/auth/client.ts",
    "fe/apps/admin/src/modules/toast/hooks.ts",
    "fe/apps/admin/src/redux/store.ts",
    "fe/apps/admin/src/components/providers/AppProviders/index.tsx",
    "fe/apps/admin/src/hooks/swr/SwrSideEffects.tsx",
    "fe/apps/admin/package.json",
    "fe/apps/admin/tsconfig.json",
  ]) {
    assert.ok(result.created.includes(relative), relative);
  }
  assert.equal(result.created.some((relative) => relative.includes("/modules/db/") || relative.includes("/auth/callback/")), false);
  assert.equal(result.created.includes("fe/apps/admin/Dockerfile"), false, "the lite scaffold leaves a hosted front-end Dockerfile optional");
  assert.match(read(root, "fe/apps/admin/src/modules/auth/client.ts"), /@supabase\/supabase-js/);
  assert.doesNotMatch(read(root, "fe/apps/admin/src/components/composites/SiteShell/index.tsx"), /\{\{> /, "partials are rendered");
  assert.deepEqual(JSON.parse(read(root, "hfs.json")).sides.fe.apps, [
    { name: "web", kind: "next" },
    { name: "admin", kind: "next" },
  ]);
  assert.equal(JSON.parse(read(root, "fe/apps/admin/package.json")).name, "@demo/admin");
});

test("addApp keeps the full-edition scaffold and registration behavior", () => {
  const root = appRoot("full");
  const result = addApp({ root, name: "admin" });
  for (const relative of [
    "fe/apps/admin/src/app/[locale]/layout.tsx",
    "fe/apps/admin/package.json",
    "fe/apps/admin/tsconfig.json",
    "fe/apps/admin/Dockerfile",
  ]) {
    assert.ok(result.created.includes(relative), relative);
  }
  assert.deepEqual(JSON.parse(read(root, "hfs.json")).sides.fe.apps, [
    { name: "web", kind: "next" },
    { name: "admin", kind: "next" },
  ]);
  assert.deepEqual(JSON.parse(read(root, "package.json")).workspaces, [
    "fe/packages/*",
    "fe/apps/*",
  ]);
  const workspace = JSON.parse(read(root, "fe/apps/admin/package.json"));
  assert.equal(workspace.name, "@demo/admin");
  assert.deepEqual(workspace.dependencies, { next: "16.0.0", react: "19.2.0" });
  assert.ok(result.created.includes("fe/apps/admin/src/modules/api/graphql/types.ts"), "the shared app core");
  assert.doesNotMatch(read(root, "fe/apps/admin/src/modules/auth/client.ts"), /@supabase/, "full keeps the IdP stub");
  assert.doesNotMatch(read(root, "fe/apps/admin/src/features/layouts/AppLayout/index.tsx"), /\{\{> /, "partials are rendered");
});
