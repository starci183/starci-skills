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
    // A shelf INDEX links DOWN into its own modules as `child/INDEX.md`. Without
    // this the link keeps the `.md` and resolves to nothing once published.
    .replace(/\]\((?:\.\/)?([a-z0-9-]+)\/INDEX\.md(#[^)]+)?\)/g, "](./$1$2)")
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

// Listed in chain order: a requirement enters at `layouts` and leaves `lints` as code. The three
// shelves after `blocks` resolve to something closed - a contract, then code, then what the linter
// refuses - which is why only the first two offer alternatives.
const groups = [
  {key: "layouts", title: "Layouts", description: "Từ một yêu cầu nghiệp vụ ra bố cục trang: archetype nào, mỗi vùng giữ gì."},
  {key: "blocks", title: "Blocks", description: "Từ một vùng ra giải phẫu khối: khối nào, gồm những phần nào, mỗi trạng thái vẽ gì."},
  {key: "principles", title: "Principles", description: "Primitive facts and principles that implementation must not violate."},
  {key: "senses", title: "Senses", description: "Contextual product judgement such as hierarchy, actions and affordance."},
  {key: "governance", title: "Governance", description: "Exception and refactor evidence; not visual design law."},
];

const REQUIRED = ["INDEX.md", "vi.md", "example.md", "audit.md"];

// A module id is its path under the shelf, so a nested one reads `laws/b1-one-surface-owner`.
// Shelves that sort their modules into families - `blocks` keeps `archetypes/` apart from `laws/` -
// were invisible before this walked one level down: the family folder holds no `INDEX.md`, so the
// old flat scan skipped it and every module inside it, silently and without a count to notice.
// `proofs/` is excluded by the same test it always was: it has no `vi.md`.
async function discoverModules(root, prefix = "") {
  const found = [];
  for (const entry of await readdir(root, {withFileTypes: true})) {
    if (!entry.isDirectory()) continue;
    const here = resolve(root, entry.name);
    const id = prefix ? `${prefix}/${entry.name}` : entry.name;
    const names = new Set(await readdir(here));
    if (REQUIRED.every((file) => names.has(file))) {
      found.push({id, prompt: names.has("prompt.md")});
      continue;
    }
    // Not a module. One level of family nesting is allowed; deeper is not a shape this tree has.
    if (!prefix) found.push(...(await discoverModules(here, entry.name)));
  }
  return found;
}

async function discoverGroup(group) {
  const found = await discoverModules(resolve(trustRoot, `fe/${group.key}`));
  found.sort((a, b) => a.id.localeCompare(b.id));
  return {
    ...group,
    modules: found.map((entry) => entry.id),
    promptModules: new Set(found.filter((entry) => entry.prompt).map((entry) => entry.id)),
  };
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
