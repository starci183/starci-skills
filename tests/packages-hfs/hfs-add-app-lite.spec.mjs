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
    hfs: 2,
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

test("addApp refuses the second lite front end with the single-app message and changes nothing", () => {
  const root = appRoot("lite");
  const declarationBefore = read(root, "hfs.json");
  const packageBefore = read(root, "package.json");
  assert.throws(
    () => addApp({ root, name: "admin" }),
    (error) =>
      error?.code === "HFS_ADD_LITE_SINGLE_APP" &&
      error.message ===
        "a lite app has one front-end app; a second app needs the shared <project>-ui and <project>-i18n packages: run starci app upgrade --edition full",
  );
  assert.equal(fs.existsSync(path.join(root, "fe", "apps", "admin")), false);
  assert.equal(read(root, "hfs.json"), declarationBefore);
  assert.equal(read(root, "package.json"), packageBefore);
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
});
