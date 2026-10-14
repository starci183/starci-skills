// Shared lite upgrade fixture and byte-preservation helpers.
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { TEMPLATES_DIR, imageFiles, render, renderTargets, writeTargets } from "../../packages/hfs/sync/index.mjs";
import { createSlotResolver, loadSlotManifest, resolveRepoDeclaration } from "../../scripts/hfs/slots.mjs";
import { FE_APP_SCRIPTS, PACKAGE_MANAGER, WORKSPACES, feAppPackageName } from "../../scripts/hfs/rules/monorepo.mjs";

export const MANIFEST = loadSlotManifest();
export const ROOT = path.resolve(import.meta.dirname, "..", "..");
export const PRESETS = {
  sonarExclusions: ["**/node_modules/**", "fe/**"],
  coverageSources: ["src/**/*.service.ts", "src/features/cli/**/*.cli.ts"],
};
const LITE = {
  hfs: MANIFEST.major,
  kind: "app",
  edition: "lite",
  project: "demo",
  sides: {
    be: {
      apps: [{ name: "api", kind: "api" }],
      kinds: ["api"],
      connections: [
        {
          name: "primary",
          envPrefix: "PRIMARY_DB",
          owner: "api",
          isolation: "schema",
          provider: "supabase",
        },
      ],
    },
    fe: {
      apps: [{ name: "web", kind: "next" }],
      reads: ["be/contracts/", "supabase/types/"],
    },
  },
};
const TYPE_TEXT =
  "export type Json = string | number | boolean | null | Json[] | { [key: string]: Json | undefined };\nexport interface Database { public: { Tables: Record<string, never> } }\n";

const posix = (value) => value.split(path.sep).join("/");
export const put = (root, file, text = "export {};\n") => {
  const target = path.join(root, ...file.split("/"));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text);
};
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

function requiredContent(file) {
  if (file.endsWith(".json")) return "{}\n";
  if (file.endsWith(".yaml") || file.endsWith(".yml"))
    return "schema: fixture/v1\n";
  if (file.endsWith(".toml")) return 'project_id = "demo"\n';
  if (file.endsWith(".md")) return "# Demo\n";
  return "export {};\n";
}

/** Materialize the real composition and health source that an additive upgrade must preserve. */
function writeBackendTemplate(root, directory, relative, project) {
  const source = path.join(TEMPLATES_DIR, "be", directory, relative);
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const file = `${relative}/${entry.name}`;
    if (entry.isDirectory()) {
      writeBackendTemplate(root, directory, file, project);
      continue;
    }
    const text = fs.readFileSync(path.join(source, entry.name), "utf8");
    put(root, `be/${file}`, render(text, { project, app: "api", appPascal: "Api" }));
  }
}

export function fakeLock(root) {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8"),
  );
  put(
    root,
    "package-lock.json",
    json({
      name: pkg.name,
      version: pkg.version,
      lockfileVersion: 3,
      requires: true,
      packages: {
        "": {
          name: pkg.name,
          version: pkg.version,
          dependencies: pkg.dependencies,
          devDependencies: pkg.devDependencies,
        },
      },
    }),
  );
  return { ok: true };
}

export function contents(root) {
  const result = {};
  const walk = (dir) => {
    for (const entry of fs
      .readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const target = path.join(dir, entry.name);
      const rel = posix(path.relative(root, target));
      if (entry.isDirectory()) {
        result[`${rel}/`] = "directory";
        walk(target);
      } else
        result[rel] = createHash("sha256")
          .update(fs.readFileSync(target))
          .digest("hex");
    }
  };
  walk(root);
  return result;
}

export function syntheticLite(t, name = "demo") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hfs-upgrade-lite-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const declaration = { ...structuredClone(LITE), project: name };
  const pkg = {
    name,
    version: "0.0.0",
    private: true,
    packageManager: PACKAGE_MANAGER,
    workspaces: [...WORKSPACES],
    dependencies: {
      "@nestjs/common": "11.1.6",
      "@nestjs/core": "11.1.6",
      "@supabase/supabase-js": "2.117.2",
    },
    devDependencies: {
      "@starci/hfs": "4.0.9",
      supabase: "2.119.0",
      turbo: "2.8.20",
      typescript: "5.9.3",
    },
  };
  put(root, "hfs.json", json(declaration));
  put(root, "package.json", json(pkg));
  writeTargets(
    root,
    renderTargets(declaration, PRESETS, { manifest: MANIFEST }),
  );

  const resolver = createSlotResolver(
    MANIFEST,
    resolveRepoDeclaration(MANIFEST, declaration),
  );
  for (const entry of resolver.requiredPaths().paths) {
    const file = entry.path;
    if (
      file.endsWith("/") ||
      file === ".starciwork/index.yaml" ||
      fs.existsSync(path.join(root, ...file.split("/")))
    )
      continue;
    put(root, file, requiredContent(file));
  }
  writeBackendTemplate(root, "skeleton-lite", "apps/api/src", name);
  writeBackendTemplate(root, "skeleton", "src/features/api/system-health", name);
  put(
    root,
    "be/nest-cli.json",
    json({
      $schema: "https://json.schemastore.org/nest-cli",
      collection: "@nestjs/schematics",
      monorepo: true,
      root: "apps/api",
      sourceRoot: "apps/api/src",
      projects: {
        api: {
          type: "application",
          root: "apps/api",
          entryFile: "main",
          sourceRoot: "apps/api/src",
        },
      },
    }),
  );
  put(
    root,
    "fe/apps/web/package.json",
    json({
      name: feAppPackageName(name, "web"),
      version: "0.0.0",
      private: true,
      scripts: FE_APP_SCRIPTS,
      dependencies: { "next-intl": "4.3.9" },
    }),
  );
  put(
    root,
    "fe/apps/web/tsconfig.json",
    json({
      extends: "../../tsconfig.json",
      compilerOptions: { paths: { "@/*": ["./src/*"] } },
    }),
  );
  for (const image of imageFiles(resolveRepoDeclaration(MANIFEST, declaration)))
    put(root, image.path, image.content);
  put(root, "supabase/types/database.types.ts", TYPE_TEXT);
  put(
    root,
    "supabase/migrations/20261002000000_baseline.sql",
    "create table public.notes (id uuid primary key);\nalter table public.notes enable row level security;\ncreate policy notes_read on public.notes for select using (true);\n",
  );
  put(
    root,
    ".starcistacks/dev/environment.json",
    json({ environment: "dev", provider: "supabase" }),
  );
  put(root, ".starcistacks/dev/secrets/.gitkeep", "");
  put(root, ".starciwork/shell/index.yaml", "schema: work/shell@1\n");
  put(
    root,
    "be/apps/api/src/main.ts",
    'export const apiProductMarker = "preserve-api";\n',
  );
  put(
    root,
    "be/src/modules/domain/sample/index.ts",
    'export { SampleService } from "./sample.service";\n',
  );
  put(
    root,
    "be/src/modules/domain/sample/sample.service.ts",
    'export class SampleService { value(): string { return "preserve-service"; } }\n',
  );
  put(
    root,
    "fe/apps/web/src/app/[locale]/page.tsx",
    'export default function Page() { return "preserve-fe"; }\n',
  );
  fakeLock(root);
  return root;
}
