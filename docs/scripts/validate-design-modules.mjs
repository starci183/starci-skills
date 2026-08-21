import {readdir, readFile} from "node:fs/promises";
import {dirname, relative, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const trustRoot = resolve(siteRoot, "..");

// Only role-wide construction facts use the five-record module shape. Product choices moved to
// machine-readable `.claude/grammars/<grammar>/` and are validated by trust-tree tests instead.
const shelves = ["principles"];

// The shelf that inherited the primitive design facts.
const factShelf = "principles";

const componentRoot = resolve(siteRoot, "src/components/CodeUiTabs");
const required = ["INDEX.md", "vi.md", "example.md", "audit.md", "changelog.md"];

// `prompt.md` remains optional for historical module compatibility.
const optional = ["prompt.md"];
const errors = [];

const templateSectionsV1 = {
  "INDEX.md": ["Canon Question", "Required Business Facts", "Closed Output", "Classification Gate", "Output Explanations", "Exceptions and Safe Stops", "Invariants", "Review Output", "Load Policy", "Version Rule"],
  "prompt.md": ["Evaluation Summary", "Cases", "Ambiguity and Conflict Log", "Rubric"],
  "vi.md": ["Canon at a Glance", "Output Explanations", "Exceptions", "Review Checklist"],
  "example.md": ["Example Index", "Cases", "Boundary Matrix"],
  "audit.md": ["Current Verdict", "Self-Test Results", "Findings", "Accepted Decisions", "Re-audit Triggers"],
  "changelog.md": ["Version Policy"],
};
const templateSectionsV2 = {
  "INDEX.md": ["Law", "Inputs", "Decision Table", "Invariants", "Exceptions", "Output", "Load Policy", "Version Rule"],
  "prompt.md": ["Prompt", "Decision Procedure", "Worked Requests", "Ambiguity Tests"],
  "vi.md": ["Bảng quyết định", "Luật", "Ví dụ", "Ngoại lệ"],
  "example.md": ["Example Index", "Cases", "Boundary Matrix"],
  "audit.md": ["Verdict", "Ambiguity Tests", "Findings", "Decisions", "Re-audit Triggers"],
  "changelog.md": ["Version Policy"],
};

/*
 * `principles-v2` — the shape every `principles` module actually carries at 2.00.
 *
 * It is NOT `design-canon-v2` with new words. The two differ where the module's job changed: a
 * `Decision Table` mapped a relationship straight to a class, while `Situation Codes` gives each
 * situation a QUOTABLE identity first and the class second - which is what lets a review say
 * "this declares GAP-2 but it is GAP-3" instead of "this looks cramped". `Scope` is new and load
 * bearing: it is where the module swears it names no product.
 *
 * `example.md` is deliberately the loosest of the five. Its body is one section per situation code,
 * so the section NAMES are the module's own codes and cannot be listed here; what every module does
 * share is the two closing sections. The mapping section above them is checked by prefix rather than
 * by exact title, because what a module maps a request ONTO legitimately differs - gap emits one
 * class, typography emits a recipe, position emits a decision. Forcing one title would make seven
 * modules lie about what they produce.
 */
const templateSectionsPrinciplesV2 = {
  "INDEX.md": ["Law", "Situation Codes", "Inputs", "Invariants", "Exceptions", "Output", "Load Policy", "Scope", "Version Rule"],
  "vi.md": ["Bảng tra nhanh", "Luật", "Ngoại lệ"],
  "example.md": ["Bảng phân định ranh giới", "Sai lầm lặp lại nhiều nhất"],
  "audit.md": [["Verdict", "Kết luận"], "Kiểm phân định", ["Findings", "Nhận định"], ["Decisions", "Quyết định"], "Rủi ro còn mở", ["Re-audit Triggers", "Điều kiện phản biện lại"]],
  "changelog.md": [["Version Policy", "Quy tắc phiên bản"]],
};

function moduleLabel(module) {
  return `${module.shelf}/${module.name}`;
}

function recordLabel(module, fileName) {
  return `${module.shelf}/${module.name}/${fileName}`;
}

function verifyOrderedSections(module, fileName, source, headings, templateId) {
  let cursor = -1;
  for (const heading of headings) {
    const alternatives = Array.isArray(heading) ? heading : [heading];
    const matches = alternatives
      .map((candidate) => source.indexOf(`## ${candidate}`, cursor + 1))
      .filter((position) => position !== -1);
    const next = matches.length > 0 ? Math.min(...matches) : -1;
    const expected = alternatives.join("' or '## ");
    if (next === -1) {
      errors.push(`${recordLabel(module, fileName)}: ${templateId} missing '## ${expected}'`);
      continue;
    }
    if (next < cursor) errors.push(`${recordLabel(module, fileName)}: ${templateId} section order is invalid at '## ${expected}'`);
    cursor = next;
  }
}

function currentVersion(fileName, source) {
  const patterns = {
    "INDEX.md": /^>?\s*Version:\s*`([^`]+)`/m,
    "vi.md": /^>\s*(?:Version|Phiên bản):\s*`([^`]+)`/m,
    "example.md": /^>\s*(?:Version|Phiên bản):\s*`([^`]+)`/m,
    "prompt.md": /^>\s*Version:\s*`([^`]+)`/m,
    "audit.md": /^>\s*(?:Version được audit|Phiên bản được phản biện|Version|Phiên bản):\s*`([^`]+)`/m,
    "changelog.md": /^>\s*(?:Current version|Phiên bản hiện tại):\s*`([^`]+)`/m
  };
  return source.match(patterns[fileName])?.[1];
}

async function walkJavaScript(directory) {
  const files = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walkJavaScript(path));
    else if (/\.[cm]?jsx?$/.test(entry.name)) files.push(path);
  }
  return files;
}

const modules = [];
for (const shelf of shelves) {
  const root = resolve(trustRoot, `fe/gates/${shelf}`);
  let entries;
  try {
    entries = await readdir(root, {withFileTypes: true});
  } catch {
    errors.push(`fe/${shelf}: shelf directory is missing`);
    continue;
  }
  const flatLaws = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".md") && !["INDEX.md", "GOAL.md"].includes(entry.name));
  for (const entry of flatLaws) errors.push(`Flat canon law remains: fe/${shelf}/${entry.name}`);
  for (const entry of entries.filter((candidate) => candidate.isDirectory() && candidate.name !== "proofs")) {
    modules.push({shelf, name: entry.name, root});
  }
}
modules.sort((a, b) => moduleLabel(a).localeCompare(moduleLabel(b)));
const declaredExamples = new Map();

for (const module of modules) {
  const names = new Set(await readdir(resolve(module.root, module.name)));
  const missing = required.filter((name) => !names.has(name));
  const unexpected = [...names].filter((name) => !required.includes(name) && !optional.includes(name));
  if (missing.length) {
    errors.push(`${moduleLabel(module)}: missing ${missing.join(", ")}`);
    continue;
  }
  if (unexpected.length) errors.push(`${moduleLabel(module)}: unexpected records ${unexpected.join(", ")}`);

  const versions = new Map();
  const indexSource = await readFile(resolve(module.root, module.name, "INDEX.md"), "utf8");
  const usesTemplateV1 = /^template:\s*design-canon-v1\s*$/m.test(indexSource);
  const usesTemplateV2 = /^template:\s*design-canon-v2\s*$/m.test(indexSource);
  const usesPrinciplesV2 = /^template:\s*principles-v2\s*$/m.test(indexSource);
  // The fact shelf moved to `principles-v2` at 2.00. `design-canon-v2` stays legal for the shelves
  // that have not moved yet, so this gate does not turn red on modules nobody has rewritten.
  if (module.shelf === factShelf && !usesPrinciplesV2 && !usesTemplateV2) {
    errors.push(`${moduleLabel(module)}: ${factShelf} facts require template: principles-v2`);
  }
  const records = [...required, ...optional.filter((name) => names.has(name))];
  for (const fileName of records) {
    const source = await readFile(resolve(module.root, module.name, fileName), "utf8");
    const version = currentVersion(fileName, source);
    if (!version) errors.push(`${recordLabel(module, fileName)}: missing current version marker`);
    else versions.set(fileName, version);

    if (fileName === "example.md") {
      for (const match of source.matchAll(/<CodeUiTabs\s+example="([^"]+)"\s*\/>/g)) {
        const id = match[1];
        const owner = recordLabel(module, fileName);
        if (declaredExamples.has(id)) {
          errors.push(`${owner}: duplicate CodeUiTabs id '${id}', already declared by ${declaredExamples.get(id)}`);
        }
        declaredExamples.set(id, owner);
      }
    }

    if (usesTemplateV1 && templateSectionsV1[fileName]) {
      verifyOrderedSections(module, fileName, source, templateSectionsV1[fileName], "design-canon-v1");
    }
    if (usesTemplateV2 && templateSectionsV2[fileName]) {
      verifyOrderedSections(module, fileName, source, templateSectionsV2[fileName], "design-canon-v2");
    }
    if (usesPrinciplesV2 && templateSectionsPrinciplesV2[fileName]) {
      verifyOrderedSections(module, fileName, source, templateSectionsPrinciplesV2[fileName], "principles-v2");
      if (fileName === "example.md" && !/^##\s+Ánh xạ yêu cầu sang /m.test(source)) {
        errors.push(`${recordLabel(module, fileName)}: principles-v2 missing a '## Ánh xạ yêu cầu sang …' section`);
      }
    }
    if (module.shelf === factShelf) {
      if (/INSUFFICIENT[ _]CONTEXT/i.test(source)) {
        errors.push(`${recordLabel(module, fileName)}: safe-stop pseudo-output is forbidden in ${factShelf} facts`);
      }
      if (/Review Checklist/i.test(source)) {
        errors.push(`${recordLabel(module, fileName)}: review checklist belongs in audit.md, not ${factShelf} canon`);
      }
      if (/StarCi/i.test(source)) {
        errors.push(`${recordLabel(module, fileName)}: product-specific StarCi vocabulary is forbidden in ${factShelf} canon`);
      }
      if (/\bASK_[A-Z_]+\b/.test(source) || /\|\s*Dừng(?:\s|\||$)/i.test(source)) {
        errors.push(`${recordLabel(module, fileName)}: clarification cannot be a public ${factShelf} output; use a safe default`);
      }
      if (/\b(?:bg-surface|bg-default|bg-content1|bg-content2|border-separator|border-divider|ring-focus|text-muted(?!-foreground))\b/.test(source)) {
        errors.push(`${recordLabel(module, fileName)}: divergent semantic token vocabulary`);
      }
    }
  }

  const distinct = new Set(versions.values());
  if (distinct.size > 1) {
    errors.push(`${moduleLabel(module)}: version mismatch ${[...versions].map(([file, version]) => `${file}=${version}`).join(", ")}`);
  }
}

const registryIds = new Set();
const allowedCodeTags = new Set([
  "Avatar", "Avatar.Fallback", "Button", "Card", "Card.Content", "Card.Description",
  "Badge", "Card.Footer", "Card.Header", "Card.Title", "Chip", "ConfirmButton", "Field", "Heading",
  "IconLabelFactRow", "IconTile", "Input", "Label", "PressableInputLike", "SearchBox",
  "SearchCommandField", "Separator", "Skeleton", "SurfaceCard", "SurfaceListCard", "Text", "Tree",
  "StatusDot", "_CourseReviewBlock"
]);
for (const file of await walkJavaScript(componentRoot)) {
  const source = await readFile(file, "utf8");
  for (const match of source.matchAll(/["']([^"']+)["']\s*:\s*{\s*(?:\r?\n\s*)?render\s*:/g)) {
    registryIds.add(match[1]);
  }
  for (const match of source.matchAll(/\bid:\s*["']([^"']+)["']\s*,\s*family\s*:/g)) {
    registryIds.add(match[1]);
  }
  for (const match of source.matchAll(/["']([^"']+)["']\s*:\s*defineGenericSpacing\(\s*["']\1["']\s*\)/g)) {
    registryIds.add(match[1]);
  }
  for (const match of source.matchAll(/code:\s*`([\s\S]*?)`/g)) {
    const code = match[1];
    if (code.includes("...")) errors.push(`${relative(siteRoot, file)}: Code tab contains an ellipsis placeholder`);
    for (const tag of code.matchAll(/<\/?([A-Z_][A-Za-z0-9._]*)\b/g)) {
      if (!allowedCodeTags.has(tag[1])) errors.push(`${relative(siteRoot, file)}: Code tab contains pseudo component <${tag[1]}>`);
    }
  }
}

for (const [id, owner] of declaredExamples) {
  if (!registryIds.has(id)) errors.push(`${owner}: live demo '${id}' has no registry renderer`);
}

// A retired shared shelf may leave a docs-only renderer until its generated demo is deleted. Current
// source declarations must resolve to a renderer; the reverse is cleanup evidence, not grammar law.

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  const counts = Object.fromEntries(shelves.map((shelf) => [
    shelf,
    modules.filter((module) => module.shelf === shelf).length,
  ]));
  console.log(`Validated ${modules.length} modules across ${shelves.length} shelves (${shelves.map((shelf) => `${shelf}=${counts[shelf]}`).join(", ")}) and ${declaredExamples.size} live demos.`);
}
