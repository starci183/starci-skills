import {mkdir, readdir, readFile, rm, writeFile} from "node:fs/promises";
import {dirname, relative, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const trustRoot = resolve(siteRoot, "..");
const contentRoot = resolve(siteRoot, "content");

if (relative(siteRoot, contentRoot) !== "content") {
  throw new Error(`Refusing to replace unexpected path: ${contentRoot}`);
}

function normalizeDocument(source) {
  return source
    .replace(/^id:.*\r?\n/gm, "")
    .replace(/^slug:.*\r?\n/gm, "")
    .replace(/^sidebar_label:.*\r?\n/gm, "")
    .replace(/^sidebar_position:.*\r?\n/gm, "")
    .replace(/\]\((?:\.\/)?INDEX\.md(#[^)]+)?\)/g, "](./$1)")
    .replace(/\]\((?:\.\/)?(prompt|vi|example|audit|changelog)\.md(#[^)]+)?\)/g, "](./$1$2)")
    .replace(/\]\(\.\.\/([^/)]+)\/INDEX\.md(#[^)]+)?\)/g, "](../$1$2)")
    .replace(/\]\(\.\.\/([^/)]+)\/(prompt|vi|example|audit|changelog)\.md(#[^)]+)?\)/g, "](../$1/$2$3)")
    .replace(/\]\(fe\/(principles|senses|governance)\/([^/)]+)\/INDEX\.md(#[^)]+)?\)/g, "](fe/$1/$2$3)")
    .replace(/\]\(fe\/(principles|senses|governance)\/([^/)]+)\/(prompt|vi|example|audit|changelog)\.md(#[^)]+)?\)/g, "](fe/$1/$2/$3$4)");
}

async function publish(sourcePath, destinationPath) {
  const source = await readFile(resolve(trustRoot, sourcePath), "utf8");
  const destination = resolve(contentRoot, destinationPath);
  await mkdir(dirname(destination), {recursive: true});
  await writeFile(destination, normalizeDocument(source), "utf8");
}

async function writeMeta(path, value) {
  const destination = resolve(contentRoot, path);
  await mkdir(dirname(destination), {recursive: true});
  await writeFile(destination, `export default ${JSON.stringify(value, null, 2)};\n`, "utf8");
}

async function writeGenerated(path, source) {
  const destination = resolve(contentRoot, path);
  await mkdir(dirname(destination), {recursive: true});
  await writeFile(destination, source, "utf8");
}

await rm(contentRoot, {recursive: true, force: true});

// The former `fe/design/` shelf no longer exists; it was split into these three shelves.
const groups = [
  {key: "principles", title: "Principles", description: "Primitive facts and principles that implementation must not violate."},
  {key: "senses", title: "Senses", description: "Contextual product judgement such as hierarchy, actions and affordance."},
  {key: "governance", title: "Governance", description: "Exception and refactor evidence; not visual design law."},
];

async function discoverGroup(group) {
  const root = resolve(trustRoot, `fe/${group.key}`);
  const entries = await readdir(root, {withFileTypes: true});
  const modules = [];
  const promptModules = new Set();

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const names = new Set(await readdir(resolve(root, entry.name)));
    if (names.has("INDEX.md") && names.has("vi.md") && names.has("example.md") && names.has("audit.md")) {
      modules.push(entry.name);
      if (names.has("prompt.md")) promptModules.add(entry.name);
    }
  }

  modules.sort((a, b) => a.localeCompare(b));
  return {...group, modules, promptModules};
}

const publishedGroups = await Promise.all(groups.map(discoverGroup));

await Promise.all([
  publish("docs.md", "index.mdx"),
  writeGenerated("fe/index.mdx", `---\ntitle: fe\n---\n\n# Frontend canon\n\n${publishedGroups.map((group) => `- [${group.title}](./${group.key}) — ${group.description}`).join("\n")}\n`),
  ...publishedGroups.flatMap((group) => [
    writeGenerated(`fe/${group.key}/index.mdx`, `---\ntitle: ${group.title}\n---\n\n# ${group.title}\n\n${group.description}\n\n${group.modules.map((moduleName) => `- [${moduleName}](./${moduleName})`).join("\n")}\n`),
    ...group.modules.flatMap((moduleName) => [
      publish(`fe/${group.key}/${moduleName}/INDEX.md`, `fe/${group.key}/${moduleName}/index.mdx`),
      ...(group.promptModules.has(moduleName) ? [publish(`fe/${group.key}/${moduleName}/prompt.md`, `fe/${group.key}/${moduleName}/prompt.mdx`)] : []),
      publish(`fe/${group.key}/${moduleName}/vi.md`, `fe/${group.key}/${moduleName}/vi.mdx`),
      publish(`fe/${group.key}/${moduleName}/example.md`, `fe/${group.key}/${moduleName}/example.mdx`),
      publish(`fe/${group.key}/${moduleName}/audit.md`, `fe/${group.key}/${moduleName}/audit.mdx`),
      publish(`fe/${group.key}/${moduleName}/changelog.md`, `fe/${group.key}/${moduleName}/changelog.mdx`)
    ])
  ])
]);

await Promise.all([
  writeMeta("_meta.js", {index: "Tài liệu", fe: "fe"}),
  writeMeta("fe/_meta.js", {
    index: "Tổng quan",
    ...Object.fromEntries(publishedGroups.map((group) => [group.key, group.title])),
  }),
  ...publishedGroups.flatMap((group) => [
    writeMeta(`fe/${group.key}/_meta.js`, {
      index: "Tổng quan",
      ...Object.fromEntries(group.modules.map((moduleName) => [moduleName, moduleName])),
    }),
    ...group.modules.map((moduleName) => writeMeta(`fe/${group.key}/${moduleName}/_meta.js`, {
      index: "INDEX.md",
      ...(group.promptModules.has(moduleName) ? {prompt: "prompt.md"} : {}),
      vi: "vi.md",
      example: "example.md",
      audit: "audit.md",
      changelog: "changelog.md"
    }))
  ])
]);

const total = publishedGroups.reduce((sum, group) => sum + group.modules.length, 0);
console.log(`Synced ${total} public modules across ${publishedGroups.length} frontend canon groups.`);
