import {mkdir, readdir, readFile, rm, stat, writeFile} from "node:fs/promises";
import {dirname, relative, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {groups, indexSource} from "../publication.mjs";

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const trustRoot = resolve(siteRoot, "..");
const contentRoot = resolve(siteRoot, "content");

if (relative(siteRoot, contentRoot) !== "content") {
  throw new Error(`Refusing to replace unexpected path: ${contentRoot}`);
}

// A module leads with `en.md`, or with the required `SKILL.md` in a skill directory, and publishes
// whichever human records sit beside it, in sidebar order.
const RECORDS = ["vi"];
const RECORD_LABELS = {
  vi: "Human (VI)",
};

const SKILL_RUNTIME_NOTICE = `> **Agent runtime — English only.** This \`SKILL.md\` is the binding entry. When this skill loads a paired module, read \`en.md\`. **Never load \`vi.md\` during a skill run**; it is a human translation published for review, not runtime instructions.\n`;

// Segments that are acronyms, not words. Capitalising only the first letter turns them into
// something nobody in the repository says out loud.
const ACRONYMS = new Set(["fe", "be", "cdc", "cqrs"]);
const SEGMENT_LABELS = new Map([
  ["oauth", "OAuth"],
  ["s3", "S3"],
  ["ai", "AI"],
  ["ci", "CI"],
]);

// Routes stay lowercase because they mirror directory names; what a reader sees does not.
function label(name) {
  return name
    .split("/")
    .map((part) => SEGMENT_LABELS.get(part)
      ?? (ACRONYMS.has(part) ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)))
    .join("/");
}

function normalizeDocument(source) {
  return source
    .replace(/^id:.*\r?\n/gm, "")
    .replace(/^slug:.*\r?\n/gm, "")
    .replace(/^sidebar_label:.*\r?\n/gm, "")
    .replace(/^sidebar_position:.*\r?\n/gm, "")
    // Nextra does not need source-record descriptions, and a record may carry an unquoted colon
    // that is valid prose but invalid YAML. Drop this publication-only metadata rather than
    // rewriting canon or maintaining a second YAML serializer here.
    .replace(/^description:.*\r?\n/gm, "")
    .replace(/\]\((?:\.\/)?en\.md(#[^)]+)?\)/g, "](./$1)")
    // A shelf record links DOWN into its own modules as `child/en.md`. Without this the link keeps
    // the `.md` and resolves to nothing once published.
    .replace(/\]\((?:\.\/)?([a-z0-9-]+)\/en\.md(#[^)]+)?\)/g, "](./$1$2)")
    .replace(new RegExp(`\\]\\((?:\\./)?([a-z0-9-]+)/(${RECORDS.join("|")})\\.md(#[^)]+)?\\)`, "g"), "](./$1/$2$3)")
    .replace(new RegExp(`\\]\\((?:\\./)?(${RECORDS.join("|")})\\.md(#[^)]+)?\\)`, "g"), "](./$1$2)")
    .replace(/\]\(\.\.\/([^/)]+)\/en\.md(#[^)]+)?\)/g, "](../$1$2)")
    .replace(new RegExp(`\\]\\(\\.\\./([^/)]+)/(${RECORDS.join("|")})\\.md(#[^)]+)?\\)`, "g"), "](../$1/$2$3)");
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function publish(sourcePath, destinationPath) {
  const source = await readFile(resolve(trustRoot, sourcePath), "utf8");
  const destination = resolve(contentRoot, destinationPath);
  await mkdir(dirname(destination), {recursive: true});
  const normalized = normalizeDocument(source);
  const published = sourcePath.endsWith("/SKILL.md")
    ? normalized.replace(/^(---\r?\n[\s\S]*?\r?\n---\r?\n)/, `$1\n${SKILL_RUNTIME_NOTICE}\n`)
    : normalized;
  await writeFile(destination, published, "utf8");
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

// A module id is its path under the shelf, so a nested one reads `laws/b1-one-surface-owner`.
// One level of family nesting is walked: a family folder holds no en.md, so a flat scan would
// skip it and every module inside it silently. Deeper nesting is not a shape this tree has.
async function discoverModules(root, prefix = "") {
  const found = [];
  for (const entry of await readdir(root, {withFileTypes: true})) {
    if (!entry.isDirectory()) continue;
    const here = resolve(root, entry.name);
    const id = prefix ? `${prefix}/${entry.name}` : entry.name;
    const names = new Set(await readdir(here));
    const binding = names.has("en.md") ? "en.md" : names.has("SKILL.md") ? "SKILL.md" : null;
    if (binding) {
      found.push({id, binding, records: RECORDS.filter((record) => names.has(`${record}.md`))});
      continue;
    }
    if (!prefix) found.push(...(await discoverModules(here, entry.name)));
  }
  return found;
}

async function discoverGroup(group) {
  const shelf = resolve(trustRoot, group.source);
  if (!(await exists(shelf))) {
    throw new Error(`Published shelf "${group.source}" has no source. Expected: ${shelf}`);
  }
  const found = await discoverModules(shelf);
  found.sort((a, b) => a.id.localeCompare(b.id));
  // A shelf may state its own law — a compiler shelf does — in which case that record IS the shelf
  // page. Without this the shelf gets a generated list of links and its law has nowhere to live.
  const names = new Set(await readdir(shelf));
  // The route mirrors the source path, so a reader who sees `compilers/principles/gap` in the site
  // can open exactly that directory in the tree. A published page is never at an invented address.
  return {...group, route: group.source, modules: found, own: {en: names.has("en.md"), vi: names.has("vi.md")}};
}

function groupNavigation(group) {
  const directModules = group.modules.filter((module) => !module.id.includes("/"));
  const families = new Map();

  for (const module of group.modules.filter((entry) => entry.id.includes("/"))) {
    const [family, leaf] = module.id.split("/");
    const leaves = families.get(family) ?? [];
    leaves.push(leaf);
    families.set(family, leaves);
  }

  return {directModules, families};
}

// Every route segment above a shelf — `compilers` for `compilers/principles` — is a real page in the
// sidebar, so it needs its own index and _meta. Without these Nextra shows a folder that opens onto
// nothing.
function branchRoutes(published) {
  const branches = new Map();
  for (const group of published) {
    const segments = group.route.split("/");
    for (let depth = 0; depth < segments.length; depth += 1) {
      const path = segments.slice(0, depth).join("/");
      const child = segments[depth];
      const isShelf = depth === segments.length - 1;
      const children = branches.get(path) ?? new Map();
      children.set(child, isShelf ? group.title : label(child));
      branches.set(path, children);
    }
  }
  return branches;
}

await rm(contentRoot, {recursive: true, force: true});

const publishedGroups = await Promise.all(groups.map(discoverGroup));
const branches = branchRoutes(publishedGroups);

// The index is the one page the tree cannot be missing: without it an empty tree has no route and
// the site fails to build. Publish the real record when it exists, otherwise generate a stub that
// states what IS published rather than claiming nothing is.
const indexPath = resolve(trustRoot, indexSource);
const rootChildren = [...(branches.get("") ?? new Map()).keys()];
await (await exists(indexPath)
  ? publish(indexSource, "index.mdx")
  : writeGenerated(
      "index.mdx",
      rootChildren.length === 0
        ? `---\ntitle: Docs\n---\n\n# StarCi skills\n\nNothing is published yet. Write \`${indexSource}\` at the root of \`.claude/\`, declare a shelf in \`docs/publication.mjs\`, then run \`npm run sync\`.\n`
        : `---\ntitle: Docs\n---\n\n# StarCi skills\n\nEvery page below sits at exactly its own address in the \`.claude/\` tree.\n\n${publishedGroups.map((group) => `- [${group.route}](./${group.route}) — ${group.description}`).join("\n")}\n\nThis home page is generated. Write \`${indexSource}\` at the root of \`.claude/\` to replace it.\n`
    ));

await Promise.all(
  publishedGroups.flatMap((group) => [
    group.own.en
      ? publish(`${group.source}/en.md`, `${group.route}/index.mdx`)
      : writeGenerated(
          `${group.route}/index.mdx`,
          `---\ntitle: ${group.title}\n---\n\n# ${group.title}\n\n${group.description}\n\n${group.modules.map((module) => `- [${label(module.id)}](./${module.id})`).join("\n")}\n`
        ),
    ...(group.own.vi ? [publish(`${group.source}/vi.md`, `${group.route}/vi.mdx`)] : []),
    ...[...groupNavigation(group).families.entries()].map(([family, leaves]) =>
      writeGenerated(
        `${group.route}/${family}/index.mdx`,
        `---\ntitle: ${label(family)}\n---\n\n# ${label(family)}\n\n${leaves.map((leaf) => `- [${label(leaf)}](./${leaf})`).join("\n")}\n`
      )
    ),
    ...group.modules.flatMap((module) => [
      publish(`${group.source}/${module.id}/${module.binding}`, `${group.route}/${module.id}/index.mdx`),
      ...module.records.map((record) =>
        publish(`${group.source}/${module.id}/${record}.md`, `${group.route}/${module.id}/${record}.mdx`)
      ),
    ]),
  ])
);

// Branch pages: one index per segment above a shelf, listing what that segment holds.
await Promise.all(
  [...branches.entries()]
    .filter(([path]) => path !== "" && !publishedGroups.some((group) => group.route === path))
    .map(([path, children]) => {
      const name = label(path.split("/").pop());
      return writeGenerated(
        `${path}/index.mdx`,
        `---\ntitle: ${name}\n---\n\n# ${name}\n\n${[...children.entries()].map(([child, childLabel]) => `- [${childLabel}](./${child})`).join("\n")}\n`
      );
    })
);

await Promise.all([
  ...[...branches.entries()].map(([path, children]) =>
    writeMeta(path === "" ? "_meta.js" : `${path}/_meta.js`, {
      index: "Overview",
      ...Object.fromEntries([...children.entries()]),
    })
  ),
  ...publishedGroups.flatMap((group) => [
    writeMeta(`${group.route}/_meta.js`, {
      index: group.own.en ? "Agent (EN)" : "Overview",
      ...(group.own.vi ? {vi: RECORD_LABELS.vi} : {}),
      ...Object.fromEntries(groupNavigation(group).directModules.map((module) => [module.id, label(module.id)])),
      ...Object.fromEntries([...groupNavigation(group).families.keys()].map((family) => [family, label(family)])),
    }),
    ...[...groupNavigation(group).families.entries()].map(([family, leaves]) =>
      writeMeta(`${group.route}/${family}/_meta.js`, {
        index: "Overview",
        ...Object.fromEntries(leaves.map((leaf) => [leaf, label(leaf)])),
      })
    ),
    ...group.modules.map((module) =>
      writeMeta(`${group.route}/${module.id}/_meta.js`, {
        index: "Agent (EN)",
        ...Object.fromEntries(module.records.map((record) => [record, RECORD_LABELS[record]])),
      })
    ),
  ]),
]);

const total = publishedGroups.reduce((sum, group) => sum + group.modules.length, 0);
console.log(
  publishedGroups.length === 0
    ? "Synced 0 modules: no shelf is declared in publication.mjs yet."
    : `Synced ${total} modules across ${publishedGroups.length} published shelves.`
);
