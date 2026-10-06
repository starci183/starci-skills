import { coverageScopeOf, coverageTargetOf, judgeCoverage } from './sonar-gate.mjs';

const ITEM_CAP = 50, ISSUE_BATCH = 25;
const tally = (items, field) => items.reduce((out, item) => { const key = item[field] ?? 'unknown'; out[key] = (out[key] ?? 0) + 1; return out; }, {});
const inRanges = (ranges, from, to = from) => ranges.some(([start, end]) => from <= end && to >= start);

/** The lines of `fileKey` that lie in a duplicated block, from an api/duplications/show answer. */
const duplicatedLinesOf = (doc, fileKey) => {
  const refs = new Set(Object.entries(doc?.files ?? {}).filter(([, file]) => file?.key === fileKey).map(([ref]) => String(ref)));
  const lines = new Set();
  for (const duplication of doc?.duplications ?? []) for (const block of duplication?.blocks ?? []) {
    if (!refs.has(String(block?._ref))) continue;
    for (let line = Number(block.from); line < Number(block.from) + Number(block.size); line += 1) lines.add(line);
  }
  return lines;
};

/** One issues/search over component keys of one qualifier, with the legacy key and same-qualifier fallback. */
const sliceIssues = async (cfg, tokens, keys, readAll) => {
  const batch = keys.map(encodeURIComponent).join(',');
  let got = await readAll(cfg, tokens, `/api/issues/search?components=${batch}&resolved=false`, 'issues');
  if (got.error && got.status === 400) got = await readAll(cfg, tokens, `/api/issues/search?componentKeys=${batch}&resolved=false`, 'issues');
  if (got.error && got.status === 400 && keys.length > 1 && /same qualifier/i.test(got.error)) {
    const items = [];
    for (const key of keys) {
      const single = await sliceIssues(cfg, tokens, [key], readAll);
      if (single.error) return single;
      items.push(...single.items);
    }
    return { items };
  }
  return got;
};

/** The Sonar `coverage` measure of one file, or an error when the server cannot answer. */
const fileCoverage = async (cfg, tokens, fileKey, read) => {
  const got = await read(cfg, tokens, `/api/measures/component?component=${encodeURIComponent(fileKey)}&metricKeys=coverage`);
  if (got.status === 404) return { coverage: null };
  if (!got.reachable || got.status !== 200) return { error: got.error ?? `HTTP ${got.status}` };
  return { coverage: (got.json?.component?.measures ?? []).find((measure) => measure.metric === 'coverage')?.value ?? null };
};

/** Read changed source lines in order; a 404 is unanalysed, and the first read failure stops the evaluation. */
const changedSources = async ({ cfg, tokens, key, files, qualifierOf, read }) => {
  const analyzed = new Map(), notAnalyzed = [];
  let changedSourceLines = 0;
  for (const file of files) {
    const fileKey = `${key}:${file.path}`;
    const from = file.ranges.length ? Math.min(...file.ranges.map((range) => range[0])) : 1;
    const to = file.ranges.length ? Math.max(...file.ranges.map((range) => range[1])) : 1;
    const lines = await read(cfg, tokens, `/api/sources/lines?key=${encodeURIComponent(fileKey)}&from=${from}&to=${to}`);
    if (lines.status === 404) { notAnalyzed.push(file.path); continue; }
    if (!lines.reachable || lines.status !== 200) {
      const detail = lines.error ?? `HTTP ${lines.status}`;
      return { error: `source lines of ${file.path} could not be read: ${detail}` };
    }
    analyzed.set(fileKey, file);
    if (qualifierOf(file.path) === 'FIL') changedSourceLines += file.ranges.reduce((total, [start, end]) => total + (end - start + 1), 0);
  }
  return { analyzed, notAnalyzed, changedSourceLines };
};

/** Read issues and hotspots limited to the changed lines. */
const sliceEvidence = async ({ cfg, tokens, key, analyzed, qualifierOf, readAll, inRanges }) => {
  const onSlice = (item, component) => {
    const file = analyzed.get(component);
    if (!file) return false;
    const from = item.textRange?.startLine ?? item.line;
    if (from === undefined || from === null) return file.added;
    return inRanges(file.ranges, Number(from), Number(item.textRange?.endLine ?? from));
  };
  const keys = [...analyzed.keys()], groups = new Map();
  for (const fileKey of keys) {
    const qualifier = qualifierOf(analyzed.get(fileKey).path);
    if (!groups.has(qualifier)) groups.set(qualifier, []);
    groups.get(qualifier).push(fileKey);
  }
  const issues = [];
  for (const group of groups.values()) for (let index = 0; index < group.length; index += ISSUE_BATCH) {
    const got = await sliceIssues(cfg, tokens, group.slice(index, index + ISSUE_BATCH), readAll);
    if (got.error) return { error: `issues of the slice could not be read: ${got.error}` };
    issues.push(...got.items.filter((issue) => onSlice(issue, issue.component)));
  }
  const hotspotsRead = keys.length ? await readAll(cfg, tokens, `/api/hotspots/search?projectKey=${encodeURIComponent(key)}&status=TO_REVIEW`, 'hotspots') : { items: [] };
  if (hotspotsRead.error) return { error: `hotspots of the project could not be read: ${hotspotsRead.error}` };
  return { keys, issues, hotspots: hotspotsRead.items.filter((hotspot) => onSlice(hotspot, hotspot.component)), onSlice };
};

/** The duplicated share of changed source lines, including the first API error if any. */
const duplicationResult = async ({ cfg, tokens, keys, analyzed, qualifierOf, changedLines, gate, read }) => {
  const duplication = { changedLines, duplicatedLines: 0, percent: null, threshold: gate.duplicationMaxPercent, files: [] };
  for (const fileKey of keys) {
    const file = analyzed.get(fileKey);
    if (qualifierOf(file.path) !== 'FIL' || !file.ranges.length) continue;
    const shown = await read(cfg, tokens, `/api/duplications/show?key=${encodeURIComponent(fileKey)}`);
    if (shown.status === 404) continue;
    if (!shown.reachable || shown.status !== 200) {
      const detail = shown.error ?? `HTTP ${shown.status}`;
      return { error: `duplications of ${file.path} could not be read: ${detail}` };
    }
    const mine = duplicatedLinesOf(shown.json, fileKey);
    const hit = [...mine].filter((line) => inRanges(file.ranges, line)).sort((a, b) => a - b);
    if (hit.length) { duplication.duplicatedLines += hit.length; duplication.files.push({ path: file.path, lines: hit.slice(0, ITEM_CAP) }); }
  }
  duplication.percent = changedLines ? Math.round((duplication.duplicatedLines / changedLines) * 1000) / 10 : null;
  return { duplication };
};

/** The dashboard coverage block's status, after the measure and per-file coverage are assembled. */
const coverageStatus = (coverage) => {
  if (coverage.applied) {
    if (coverage.failures.length) return 'red';
    if (coverage.files.length) return 'green';
    return 'no-target';
  }
  return 'no-scope';
};

/** Measure each changed coverage target in order and return its policy result. */
const coverageResult = async ({ cfg, tokens, keys, analyzed, qualifierOf, props, coverageRun, gate, read }) => {
  const scope = coverageScopeOf(props), isTarget = coverageTargetOf(scope), measured = [];
  for (const fileKey of coverageRun?.judged === false ? [] : keys) {
    const file = analyzed.get(fileKey);
    if (qualifierOf(file.path) !== 'FIL' || !isTarget(file.path)) continue;
    const got = await fileCoverage(cfg, tokens, fileKey, read);
    if (got.error) return { error: `coverage of ${file.path} could not be read: ${got.error}` };
    measured.push({ path: file.path, coverage: got.coverage });
  }
  let coverage;
  if (coverageRun?.judged === false) {
    const status = coverageRun.ownerMode ? 'not-measured' : 'not-required';
    coverage = { applied: false, status, ownerMode: coverageRun.ownerMode, exclusions: scope.exclusions, minPercent: gate.coverageMinPercent, files: [], failures: [], note: coverageRun.note };
  } else coverage = judgeCoverage(measured, { scope, minPercent: gate.coverageMinPercent });
  if (coverageRun?.judged !== false && coverageRun?.error) coverage.failures.unshift(`the slice's services could not be measured: ${coverageRun.error}`);
  if (!coverage.status) coverage.status = coverageStatus(coverage);
  return { coverage };
};

/** Judge the changed slice on Sonar issues, hotspots, duplication and coverage. */
export async function evaluateSlice(cfg, tokens, { key, slice, props = {}, pkg = null, gate, coverageRun = null }, deps) {
  const { read, readAll, fileQualifier } = deps, qualifierOf = fileQualifier(props, pkg);
  const files = slice.files.filter((file) => file.ranges.length || file.added);
  const source = await changedSources({ cfg, tokens, key, files, qualifierOf, read });
  if (source.error) return source;
  const evidence = await sliceEvidence({ cfg, tokens, key, analyzed: source.analyzed, qualifierOf, readAll, inRanges });
  if (evidence.error) return evidence;
  const duplication = await duplicationResult({ cfg, tokens, keys: evidence.keys, analyzed: source.analyzed, qualifierOf, changedLines: source.changedSourceLines, gate, read });
  if (duplication.error) return duplication;
  const blocking = evidence.issues.filter((issue) => gate.blockingSeverities.includes(issue.severity));
  const lesser = evidence.issues.filter((issue) => !gate.blockingSeverities.includes(issue.severity));
  const failures = [];
  if (!duplication.duplication.changedLines) {
    duplication.duplication.applied = false;
    duplication.duplication.note = 'the slice changed no source line';
  } else if (duplication.duplication.changedLines < gate.ignoreBelowChangedLines) {
    duplication.duplication.applied = false;
    duplication.duplication.note = `${duplication.duplication.changedLines} changed source lines (< ${gate.ignoreBelowChangedLines}): like the server's ignoreSmallChanges, the threshold is not held`;
  } else {
    duplication.duplication.applied = true;
    if (duplication.duplication.percent > gate.duplicationMaxPercent)
      failures.push(`duplication on the slice's changed lines ${duplication.duplication.percent}% > ${gate.duplicationMaxPercent}%`);
  }
  if (blocking.length > gate.blockingIssuesMax) failures.push(`${blocking.length} open ${gate.blockingSeverities.join('/')} issue(s) on changed lines`);
  if (evidence.hotspots.length > gate.unreviewedHotspotsMax) failures.push(`${evidence.hotspots.length} security hotspot(s) to review on changed lines`);
  const coverage = await coverageResult({ cfg, tokens, keys: evidence.keys, analyzed: source.analyzed, qualifierOf, props, coverageRun, gate, read });
  if (coverage.error) return coverage;
  failures.push(...coverage.coverage.failures);
  const pathOf = (component) => source.analyzed.get(component)?.path ?? component;
  const newIssues = { total: evidence.issues.length, blocking: blocking.length, notBlocking: lesser.length,
    bySeverity: tally(evidence.issues, 'severity'), byType: tally(evidence.issues, 'type'),
    items: [...blocking, ...lesser].slice(0, ITEM_CAP).map((issue) => ({ key: issue.key, rule: issue.rule, severity: issue.severity, type: issue.type, path: pathOf(issue.component), line: issue.line ?? null, message: issue.message, blocking: gate.blockingSeverities.includes(issue.severity) })) };
  const newHotspots = { total: evidence.hotspots.length,
    items: evidence.hotspots.slice(0, ITEM_CAP).map((hotspot) => ({ key: hotspot.key, rule: hotspot.ruleKey, probability: hotspot.vulnerabilityProbability, path: pathOf(hotspot.component), line: hotspot.line ?? null, message: hotspot.message })) };
  return { error: null, result: { analyzedFiles: evidence.keys.length, notAnalyzed: source.notAnalyzed, newIssues, newHotspots,
    duplication: duplication.duplication, coverage: coverage.coverage, verdict: failures.length ? 'fail' : 'pass', failures } };
}
