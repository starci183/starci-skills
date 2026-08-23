import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {existsSync, readFileSync, readdirSync} from "node:fs";
import {basename, dirname, join, relative, resolve, sep} from "node:path";
import {fileURLToPath} from "node:url";
import {test} from "node:test";

const trustRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const docsRoot = join(trustRoot, "docs");
const contentRoot = join(docsRoot, "content");
const skillSourceRoot = join(trustRoot, "skills");
const archetypeSourceRoot = join(trustRoot, "archetypes");
const archetypeTemplateAssetRoot = join(docsRoot, "public", "template-assets", "archetypes");

function filesBelow(directory) {
  return readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(path) : [path];
  });
}

function sourceBetween(source, startMarker, endMarker, label) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `${label} has no ${startMarker} boundary`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `${label} has no ${endMarker} boundary`);
  return source.slice(start, end);
}

function assertBefore(source, before, after, message) {
  const beforePosition = source.indexOf(before);
  const afterPosition = source.indexOf(after);
  assert.ok(beforePosition >= 0 && beforePosition < afterPosition, message);
}

test("Nextra publishes EN and VI without module context pages", () => {
  execFileSync(process.execPath, [join(docsRoot, "scripts", "sync-content.mjs")], {
    cwd: docsRoot,
    stdio: "pipe",
  });

  const moduleMeta = readFileSync(join(contentRoot, "mcp", "clients", "_meta.js"), "utf8");
  assert.ok(moduleMeta.indexOf('"index": "EN"') < moduleMeta.indexOf('"vi": "VI"'));
  assert.doesNotMatch(moduleMeta, /context|Agent/);
  assert.equal(filesBelow(contentRoot).some((path) => basename(path) === "context.mdx"), false);

  const skillRoot = join(contentRoot, "skills", "starci-init");
  const skillMeta = readFileSync(join(skillRoot, "_meta.js"), "utf8");
  assert.ok(skillMeta.indexOf('"index": "EN"') < skillMeta.indexOf('"vi": "VI"'));
  assert.ok(skillMeta.indexOf('"vi": "VI"') < skillMeta.indexOf('"agent": "Agent (EN)"'));
  assert.equal(existsSync(join(skillRoot, "agent.mdx")), true);
});

test("archetype HTML templates publish byte-identically through safe indexed previews", () => {
  execFileSync(process.execPath, [join(docsRoot, "scripts", "sync-content.mjs")], {
    cwd: docsRoot,
    stdio: "pipe",
  });

  const templateSources = filesBelow(archetypeSourceRoot)
    .filter((path) => basename(path) === "template.html")
    .sort();
  assert.equal(templateSources.length, 301);

  const component = readFileSync(
    join(docsRoot, "src", "components", "ArchetypeTemplatePreview", "index.js"),
    "utf8",
  );
  assert.match(component, /template-assets/);
  assert.match(component, /sandbox="allow-scripts"/);
  assert.doesNotMatch(component, /allow-same-origin/);
  assert.match(component, /loading="lazy"/);
  assert.match(component, /title=\{accessibleTitle\}/);
  assert.match(component, /referrerPolicy="no-referrer"/);
  assert.match(component, /target="_blank"/);
  assert.match(component, /rel="noopener noreferrer"/);
  assert.doesNotMatch(component, /dangerouslySetInnerHTML/);

  const mdxComponents = readFileSync(join(docsRoot, "mdx-components.js"), "utf8");
  assert.match(mdxComponents, /ArchetypeTemplatePreview/);

  for (const sourcePath of templateSources) {
    const sourceDirectory = dirname(sourcePath);
    const moduleId = relative(archetypeSourceRoot, sourceDirectory).split(sep).join("/");
    const moduleSegments = moduleId.split("/");
    const leafId = moduleSegments.at(-1);
    const publishedAsset = join(archetypeTemplateAssetRoot, ...moduleSegments, "template.html");
    const publishedRouteRoot = join(contentRoot, "archetypes", ...moduleSegments);
    const templateRoute = join(publishedRouteRoot, "template.mdx");
    const metaPath = join(publishedRouteRoot, "_meta.js");

    assert.equal(existsSync(publishedAsset), true, `${moduleId} has no copied HTML asset`);
    assert.deepEqual(readFileSync(publishedAsset), readFileSync(sourcePath), `${moduleId} asset changed during copy`);
    assert.equal(existsSync(templateRoute), true, `${moduleId} has no Nextra template route`);

    const route = readFileSync(templateRoute, "utf8");
    assert.ok(
      route.includes(`<ArchetypeTemplatePreview src="/template-assets/archetypes/${moduleId}/template.html"`),
      `${moduleId} preview does not point at its generated asset`,
    );
    assert.doesNotMatch(route, /<!doctype html>/i, `${moduleId} injects raw HTML into MDX`);

    const meta = readFileSync(metaPath, "utf8");
    const indexPosition = meta.indexOf('"index"');
    const viPosition = meta.indexOf('"vi"');
    const templatePosition = meta.indexOf('"template": "Template"');
    assert.ok(indexPosition >= 0 && indexPosition < viPosition && viPosition < templatePosition);

    const html = readFileSync(sourcePath, "utf8");
    assert.match(html, /^<!doctype html>/i, `${moduleId} has no HTML doctype`);
    assert.match(html, /<meta\s+[^>]*name=["']viewport["'][^>]*>/i, `${moduleId} has no viewport contract`);
    assert.match(html, /@media\s*\(/i, `${moduleId} has no responsive media query`);
    assert.match(
      html,
      new RegExp(`<html\\b[^>]*\\bdata-archetype-template=(?:"${leafId}"|'${leafId}')`, "i"),
      `${moduleId} has no matching data-archetype-template identity`,
    );
    const cspMeta = (html.match(/<meta\b[^>]*>/gi) ?? [])
      .find((tag) => /\bhttp-equiv=["']Content-Security-Policy["']/i.test(tag));
    assert.ok(cspMeta, `${moduleId} has no Content-Security-Policy meta`);
    const csp = cspMeta.match(/\bcontent="([^"]*)"/i)?.[1];
    assert.ok(csp, `${moduleId} has no readable Content-Security-Policy content`);
    assert.match(csp, /(?:^|;)\s*default-src\s+'none'(?:\s*;|$)/i, `${moduleId} CSP permits a default source`);
    assert.match(csp, /(?:^|;)\s*connect-src\s+'none'(?:\s*;|$)/i, `${moduleId} CSP permits connections`);
    assert.match(csp, /(?:^|;)\s*form-action\s+'none'(?:\s*;|$)/i, `${moduleId} CSP permits form submission`);
    assert.doesNotMatch(
      html,
      /(?:\b(?:src|href|poster|action|formaction)\s*=\s*["']\s*|@import\s+(?:url\()?\s*["']?\s*|url\(\s*["']?\s*)(?:https?:)?\/\//i,
      `${moduleId} depends on a network resource`,
    );
    assert.doesNotMatch(
      html,
      /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/i,
      `${moduleId} contains a network-capable script API`,
    );
    assert.doesNotMatch(
      html,
      /\.(?:innerHTML|outerHTML)\s*=|\binsertAdjacentHTML\s*\(/i,
      `${moduleId} writes HTML through a script sink instead of DOM-safe text and nodes`,
    );
    assert.doesNotMatch(html, /<[^>]*\son[a-z][a-z0-9:-]*\s*=/i, `${moduleId} uses an inline event handler`);
  }
});

// This package has no browser or DOM emulator dependency. These guards stay narrowly scoped to
// the state transitions and DOM-write boundaries that caused the interaction regressions.
test("archetype template source guards keep focus and task ownership", () => {
  const assessment = readFileSync(
    join(archetypeSourceRoot, "work", "assessment-workbench", "template.html"),
    "utf8",
  );
  const saveAnswer = sourceBetween(
    assessment,
    "function saveAnswer(value)",
    "function syncAttemptLock()",
    "assessment answer save",
  );
  assert.match(saveAnswer, /if\s*\(submitted\)\s*{\s*return;/);
  assert.doesNotMatch(
    saveAnswer,
    /\brender(?:Question|Answers)\s*\(|answerOptions\.replaceChildren\s*\(/,
    "assessment answer save replaces the focused radio control",
  );
  const answerChange = sourceBetween(
    assessment,
    'answerOptions.addEventListener("change"',
    'flagButton.addEventListener("click"',
    "assessment answer change",
  );
  assert.doesNotMatch(
    answerChange,
    /\brender(?:Question|Answers)\s*\(|answerOptions\.replaceChildren\s*\(/,
    "assessment answer change replaces the focused radio control",
  );

  const renderAnswers = sourceBetween(
    assessment,
    "function renderAnswers()",
    "function renderQuestion()",
    "assessment answer render",
  );
  const attemptLock = sourceBetween(
    assessment,
    "function syncAttemptLock()",
    "function updateReviewSummary()",
    "assessment attempt lock",
  );
  const submitAttempt = sourceBetween(
    assessment,
    'document.getElementById("submit-attempt").addEventListener',
    'document.getElementById("save-exit").addEventListener',
    "assessment submit handler",
  );
  assert.match(renderAnswers, /input\.disabled\s*=\s*submitted/);
  assert.match(attemptLock, /answer-fieldset[\s\S]*\.disabled\s*=\s*submitted/);
  assert.match(attemptLock, /control\.disabled\s*=\s*submitted/);
  assert.doesNotMatch(
    assessment,
    /\.disabled\s*=\s*false\b|removeAttribute\(["']disabled["']\)/,
    "assessment explicitly re-enables a locked control",
  );
  assertBefore(
    submitAttempt,
    "submitted = true",
    "syncAttemptLock()",
    "assessment does not establish the submitted state before locking the attempt",
  );

  const assessmentOpenDialog = sourceBetween(
    assessment,
    'openNavigator.addEventListener("click"',
    'closeNavigator.addEventListener("click"',
    "assessment compact navigator open",
  );
  const assessmentCloseDialog = sourceBetween(
    assessment,
    'navigatorDialog.addEventListener("close"',
    'document.querySelectorAll("[data-review]")',
    "assessment compact navigator close",
  );
  assertBefore(
    assessmentOpenDialog,
    "navOpener = document.activeElement",
    "navigatorDialog.showModal()",
    "assessment compact navigator does not remember its opener before opening",
  );
  assert.match(assessmentCloseDialog, /navOpener\s+instanceof\s+HTMLElement[\s\S]*navOpener\.focus\(\)/);

  const catalog = readFileSync(
    join(archetypeSourceRoot, "discovery", "searchable-card-catalog", "template.html"),
    "utf8",
  );
  const catalogOpenDialog = sourceBetween(
    catalog,
    "openFilters.addEventListener('click'",
    "closeFilters.addEventListener('click'",
    "catalog compact filters open",
  );
  const catalogCloseDialog = sourceBetween(
    catalog,
    "filterDialog.addEventListener('close'",
    "filterForm.addEventListener('submit'",
    "catalog compact filters close",
  );
  assertBefore(
    catalogOpenDialog,
    "dialogOpener = openFilters",
    "filterDialog.showModal()",
    "catalog compact filters do not remember their opener before opening",
  );
  assert.match(catalogCloseDialog, /dialogOpener[\s\S]*dialogOpener\.focus\(\)/);

  const chipRemoval = sourceBetween(
    catalog,
    "criteriaList.addEventListener('click'",
    "clearAll.addEventListener('click'",
    "catalog criterion removal",
  );
  assertBefore(
    chipRemoval,
    "const removedIndex",
    "render()",
    "catalog does not retain the removed chip position before rerendering",
  );
  assertBefore(
    chipRemoval,
    "render()",
    "const remainingChips",
    "catalog chooses a focus fallback before the post-removal DOM exists",
  );
  assert.match(
    chipRemoval,
    /if\s*\(adjacentChip\)[\s\S]*adjacentChip\.focus\(\)[\s\S]*searchInput\.focus\(\)[\s\S]*resultSummary\.focus\(\)/,
  );

  const clearCriteria = sourceBetween(
    catalog,
    "function clearAllCriteria(",
    "function closeDialogAndRestore()",
    "catalog clear criteria",
  );
  assertBefore(
    clearCriteria,
    "render()",
    "searchInput.focus()",
    "catalog clear-all focus moves before the new results are rendered",
  );
  assert.match(clearCriteria, /searchInput\.focus\(\)[\s\S]*resultSummary\.focus\(\)/);
  assert.match(catalog, /id="result-summary"[^>]*tabindex="-1"/);
  assert.match(catalog, /clearAllCriteria\(\{\s*focusTarget:\s*'summary'\s*}\)/);
  assert.match(catalog, /clearAllCriteria\(\{\s*focusTarget:\s*'search'\s*}\)/);

  const overview = readFileSync(
    join(archetypeSourceRoot, "overview", "overview-dashboard", "template.html"),
    "utf8",
  );
  const continueRegion = sourceBetween(
    overview,
    '<section class="card continue-card"',
    '<section class="card progress-card"',
    "overview recommended continuation",
  );
  assert.match(continueRegion, /id="continue-review"/);
  assert.doesNotMatch(
    continueRegion,
    /(?:href|aria-controls)=["']#?activity-heading["']/,
    "overview continuation action is incorrectly owned by recent activity",
  );
  const continueAction = sourceBetween(
    overview,
    "continueButton.addEventListener('click'",
    "returnButton.addEventListener('click'",
    "overview continuation action",
  );
  assert.doesNotMatch(continueAction, /activity(?:-heading|Error|List)/i);
  assert.match(continueAction, /resumeFeedback\.hidden\s*=\s*false[\s\S]*resumeFeedback\.focus\(\)/);
});

test("every StarCi capability entry publishes its own executable pipeline contract", () => {
  const capabilities = readdirSync(skillSourceRoot, {withFileTypes: true})
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("starci-"))
    .map((entry) => entry.name)
    .sort();
  assert.equal(capabilities.length, 20);
  assert.deepEqual(
    capabilities.filter((name) => name.startsWith("starci-fe-")),
    ["starci-fe-design-block", "starci-fe-design-layout", "starci-fe-design-refactor", "starci-fe-design-resolve", "starci-fe-ui-reconcile"],
  );
  const refactorBinding = readFileSync(join(skillSourceRoot, "starci-fe-design-refactor", "SKILL.md"), "utf8");
  assert.match(refactorBinding, /fix product source before writing the request/i);
  assert.match(refactorBinding, /implementation `applied`[\s\S]*proof `passed`[\s\S]*authority `pending`/);
  const resolveBinding = readFileSync(join(skillSourceRoot, "starci-fe-design-resolve", "SKILL.md"), "utf8");
  assert.match(resolveBinding, /requests\/rejects\.json/);
  assert.match(resolveBinding, /Grammar owns product-specific meaning[\s\S]*principles own reusable product-neutral/);
  assert.match(resolveBinding, /append[\s\S]*reject[\s\S]*before overwriting source/i);
  const uiReconcileBinding = readFileSync(join(skillSourceRoot, "starci-fe-ui-reconcile", "SKILL.md"), "utf8");
  assert.match(uiReconcileBinding, /Declared authority and observed product evidence remain independent/);
  assert.match(uiReconcileBinding, /at least two independent cases[\s\S]*explicitly rules it\s+systemic/);
  assert.match(uiReconcileBinding, /Grammar owns product-family meaning[\s\S]*Principles own only/);
  assert.match(uiReconcileBinding, /one writer per target/);

  for (const capability of capabilities) {
    for (const file of ["SKILL.md", "en.md", "vi.md"]) {
      const content = readFileSync(join(skillSourceRoot, capability, file), "utf8");
      assert.match(content, /^## PIPELINE$/m, `${capability}/${file} has no pipeline section`);
      assert.match(content, /^Topology:/m, `${capability}/${file} has no explicit topology`);
      if (file === "vi.md") {
        assert.match(content, /\| Bước \| Nhánh \| Đầu vào \| Cách thực hiện \| Đầu ra bắt buộc \| Điều kiện kiểm tra \|/);
      } else {
        assert.match(content, /\| Step \| Track \| Input \| Transform \| Required output \| Gate \|/);
      }
    }
  }
});

test("frontend progress uses the compact public vocabulary instead of internal methodology columns", () => {
  const shape = readFileSync(join(skillSourceRoot, "skill-shape", "en.md"), "utf8");
  assert.match(shape, /`Step`, `Work`, `Evidence`, `Status`/);
  assert.match(shape, /Scope.*Decision.*Source boundary.*Test evidence.*Approval.*Result/);
  assert.doesNotMatch(shape, /exactly these columns: `Step`, `Track`/);
});
