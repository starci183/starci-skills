#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const trustRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultCatalog = path.join(trustRoot, "skill-runtime", "catalog", "catalog.json");
const defaultCases = path.join(trustRoot, "skill-runtime", "evals", "cases.json");

const stopwords = new Set([
  "a", "an", "and", "the", "this", "that", "to", "for", "of", "on", "in", "with", "or", "its", "it",
  "mot", "va", "cac", "cho", "cua", "voi", "trong", "roi", "dang", "duoc", "tu", "khi", "neu", "khong",
]);

const negators = new Set(["not", "no", "never", "without", "dont", "khong", "chua", "dung"]);
const clauseBreakers = new Set(["but", "instead", "however", "nhung", "ma", "thay"]);
const termAliases = new Map([
  ["changes", "change"], ["changed", "change"], ["changing", "change"],
  ["implemented", "implement"], ["implementing", "implement"], ["implementation", "implement"],
  ["planning", "plan"], ["planned", "plan"],
  ["repairs", "repair"], ["repaired", "repair"], ["repairing", "repair"],
  ["fixes", "fix"], ["fixed", "fix"], ["fixing", "fix"],
  ["locally", "local"], ["startup", "start"], ["transcripts", "transcript"],
  ["references", "reference"], ["sidecars", "sidecar"],
]);

export const DEFAULT_ROUTING_POLICY = Object.freeze({
  minimumScore: 6,
  minimumMargin: 2,
  multipleOwnerScore: 8,
  multipleOwnerMargin: 5,
});

export function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function canonicalTerm(value) {
  return termAliases.get(value) ?? value;
}

function terms(value) {
  return normalize(value).split(/\s+/).map(canonicalTerm).filter((term) => term.length > 1 && !stopwords.has(term));
}

function values(value) {
  if (Array.isArray(value)) return value.flatMap(values);
  if (value && typeof value === "object") return Object.values(value).flatMap(values);
  return value === undefined || value === null ? [] : [String(value)];
}

function phraseScore(prompt, phrases, weight) {
  let score = 0;
  for (const phrase of phrases.map(normalize).filter(Boolean)) {
    if (prompt === phrase) score += weight * 2;
    else if (prompt.includes(phrase)) score += weight;
  }
  return score;
}

function promptSignals(rawPrompt) {
  const normalized = String(rawPrompt ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[.;:!?]+/g, " | ")
    .replace(/[^a-z0-9|]+/g, " ")
    .trim();
  const positive = [];
  const negative = [];
  let remainingNegation = false;
  for (const rawToken of normalized.split(/\s+/).filter(Boolean)) {
    if (rawToken === "|" || clauseBreakers.has(rawToken)) {
      remainingNegation = false;
      continue;
    }
    if (negators.has(rawToken)) {
      remainingNegation = true;
      continue;
    }
    const token = canonicalTerm(rawToken);
    if (remainingNegation) {
      negative.push(token);
    } else positive.push(token);
  }
  const positiveText = positive.join(" ");
  const normalizedPrompt = normalize(rawPrompt);
  const readOnly = /\b(check only|only (?:inspect|audit|check)|without (?:making )?(?:change|changes|repair|repairs|writing)|(?:make|perform) no changes|do not (?:change|repair|write|implement)|khong (?:sua|ghi|thay doi|trien khai))\b/.test(normalizedPrompt);
  const writeRequested = /\b(implement|repair|deploy|setup|set up|create|write|edit|change|fix|publish|record|refresh|reconcile|initialize|trien khai|sua|tao|ghi|cap nhat)\b/.test(positiveText);
  const sourceWriteRequested = /\b(implement|repair|edit|change|fix|trien khai|sua|cap nhat)\b/.test(positiveText);
  const externalWriteRequested = /\b(deploy|publish|setup|set up|tunnel|dns|sonar|cloudflare)\b/.test(positiveText);
  const missingAuthority = /\b(no|without|khong co|chua co) (?:approved )?(?:brief|approval|authority)|\bunapproved\b/.test(normalizedPrompt);
  const conjunction = /\b(and|plus|va|cung|both)\b/.test(normalizedPrompt);
  const plainEdit = /\b(exact micro|micro correction|only (?:the )?(?:[a-z0-9-]+ ){0,3}(?:label|icon|token|spacing|copy)|chi (?:sua|doi) (?:label|icon|token|spacing|text))\b/.test(normalizedPrompt);
  return {
    normalizedPrompt,
    positiveText,
    positiveTerms: new Set(terms(positiveText)),
    negativeTerms: new Set(terms(negative.join(" "))),
    readOnly,
    writeRequested,
    sourceWriteRequested,
    externalWriteRequested,
    missingAuthority,
    conjunction,
    plainEdit,
  };
}

function overlapScore(left, right) {
  if (right.size === 0) return 0;
  let overlap = 0;
  for (const term of left) if (right.has(term)) overlap += 1;
  return overlap / right.size;
}

export function routePrompt(catalog, rawPrompt, policy = DEFAULT_ROUTING_POLICY) {
  const signals = promptSignals(rawPrompt);
  const promptTerms = signals.positiveTerms;
  const documents = catalog.skills.map((skill) => new Set(terms([
    ...values(skill.intent), ...values(skill.aliases), ...values(skill.modes), skill.description, skill.macro, skill.macroMode,
    ...values(skill.read), ...values(skill.write), skill.risk, ...values(skill.approvalModes),
  ].join(" "))));
  const documentFrequency = new Map();
  for (const document of documents) for (const term of document) {
    documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
  }
  const ranked = catalog.skills.map((skill, index) => {
    let score = 0;
    let matchedTerms = 0;
    for (const term of promptTerms) {
      if (!documents[index].has(term)) continue;
      const idf = Math.log((catalog.skills.length + 1) / ((documentFrequency.get(term) ?? 0) + 1)) + 1;
      score += idf;
      matchedTerms += 1;
    }
    score += phraseScore(signals.positiveText, values(skill.aliases), 16);
    score += phraseScore(signals.positiveText, values(skill.intent), 10);
    score += phraseScore(signals.positiveText, values(skill.modes), 4);
    const exclusions = values(skill.excludes);
    let exclusionConflict = phraseScore(signals.positiveText, exclusions, 24) > 0;
    const scoreBeforeExclusion = score;
    for (const exclusion of exclusions) {
      const exclusionTerms = new Set(terms(exclusion));
      const overlap = overlapScore(promptTerms, exclusionTerms);
      if (exclusionTerms.size >= 2 && overlap >= 0.75) {
        score -= 20 * overlap;
        exclusionConflict = true;
      }
    }
    if (signals.readOnly && skill.risk !== "read-only") score -= 12;
    if (signals.writeRequested && skill.risk === "read-only") score -= 7;
    if (signals.sourceWriteRequested && skill.risk === "source-write") score += 8;
    if (signals.sourceWriteRequested && skill.risk === "local-write") score -= 2;
    if (signals.externalWriteRequested && skill.risk === "external-write") score += 6;
    return {
      skill: skill.id,
      macro: skill.macro,
      mode: skill.macroMode,
      risk: skill.risk,
      score: Number(score.toFixed(6)),
      matchedTerms,
      exclusionConflict,
      scoreBeforeExclusion: Number(scoreBeforeExclusion.toFixed(6)),
    };
  }).sort((left, right) => right.score - left.score || left.skill.localeCompare(right.skill));
  const candidate = ranked[0];
  const runnerUp = ranked[1];
  const excludedCandidate = ranked.find((item) => (
    item.exclusionConflict && item.matchedTerms >= 2 && item.scoreBeforeExclusion >= (candidate?.score ?? policy.minimumScore)
  ));
  const margin = Number(((candidate?.score ?? 0) - (runnerUp?.score ?? 0)).toFixed(6));
  let stopReason = null;
  if (signals.plainEdit) stopReason = "plain-edit-no-skill";
  else if (signals.readOnly && signals.writeRequested) stopReason = "permission-intent-conflict";
  else if (signals.missingAuthority && candidate?.risk !== "read-only") stopReason = "required-authority-missing";
  else if (excludedCandidate) stopReason = "request-matches-exclusion";
  else if (!candidate || candidate.score < policy.minimumScore) stopReason = "insufficient-relevance";
  else if (candidate.exclusionConflict) stopReason = "top-candidate-excluded";
  else if (margin < policy.minimumMargin) stopReason = "ambiguous-route";
  else if (
    signals.conjunction && runnerUp && runnerUp.score >= policy.multipleOwnerScore
    && margin < policy.multipleOwnerMargin && candidate.matchedTerms >= 2 && runnerUp.matchedTerms >= 2
    && !(signals.writeRequested && candidate.risk !== "read-only" && runnerUp.risk === "read-only")
  ) stopReason = "multiple-capability-owners";
  return {
    verdict: stopReason ? "stop" : "route",
    stopReason,
    winner: stopReason ? null : candidate,
    candidate,
    margin,
    ranked,
    signals: {
      readOnly: signals.readOnly,
      writeRequested: signals.writeRequested,
      sourceWriteRequested: signals.sourceWriteRequested,
      externalWriteRequested: signals.externalWriteRequested,
      missingAuthority: signals.missingAuthority,
    },
  };
}

export function evaluate(catalog, suite) {
  const results = suite.cases.map((testCase) => {
    const route = routePrompt(catalog, testCase.prompt);
    const expectedStop = Boolean(testCase.expectedStop);
    const passed = expectedStop
      ? route.verdict === "stop" && (testCase.expectedStop === true || route.stopReason === testCase.expectedStop)
      : route.verdict === "route" && route.winner?.skill === testCase.expectedSkill;
    return {
      ...testCase,
      verdict: route.verdict,
      stopReason: route.stopReason,
      actualSkill: route.winner?.skill,
      candidateSkill: route.candidate?.skill,
      margin: route.margin,
      passed,
    };
  });
  const passed = results.filter((result) => result.passed).length;
  return {
    schemaVersion: 2,
    total: results.length,
    passed,
    accuracy: results.length ? passed / results.length : 0,
    catalogBytes: Buffer.byteLength(JSON.stringify(catalog)),
    failures: results.filter((result) => !result.passed),
    results,
  };
}

function main(argv = process.argv.slice(2)) {
  const check = argv.includes("--check");
  const json = argv.includes("--json");
  const catalogPath = path.resolve(argv.find((value) => value.endsWith("catalog.json")) ?? defaultCatalog);
  const casesPath = path.resolve(argv.find((value) => value.endsWith("cases.json")) ?? defaultCases);
  const report = evaluate(JSON.parse(fs.readFileSync(catalogPath, "utf8")), JSON.parse(fs.readFileSync(casesPath, "utf8")));
  if (json) process.stdout.write(`${JSON.stringify(report)}\n`);
  else {
    console.log(`skill routing: ${report.passed}/${report.total} (${(report.accuracy * 100).toFixed(1)}%), catalog ${report.catalogBytes} bytes`);
    for (const failure of report.failures) console.error(`- ${failure.id}: expected ${failure.expectedSkill ?? `stop:${failure.expectedStop}`}, got ${failure.actualSkill ?? `stop:${failure.stopReason}`}`);
  }
  if (check && report.accuracy !== 1) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
