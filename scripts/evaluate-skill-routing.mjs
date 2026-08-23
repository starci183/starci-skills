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

export function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function terms(value) {
  return normalize(value).split(/\s+/).filter((term) => term.length > 1 && !stopwords.has(term));
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

export function routePrompt(catalog, rawPrompt) {
  const prompt = normalize(rawPrompt);
  const promptTerms = new Set(terms(prompt));
  const documents = catalog.skills.map((skill) => new Set(terms([
    ...values(skill.intent), ...values(skill.aliases), ...values(skill.modes), skill.description, skill.macro, skill.macroMode,
  ].join(" "))));
  const documentFrequency = new Map();
  for (const document of documents) for (const term of document) {
    documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
  }
  const ranked = catalog.skills.map((skill, index) => {
    let score = 0;
    for (const term of promptTerms) {
      if (!documents[index].has(term)) continue;
      const idf = Math.log((catalog.skills.length + 1) / ((documentFrequency.get(term) ?? 0) + 1)) + 1;
      score += idf;
    }
    score += phraseScore(prompt, values(skill.aliases), 16);
    score += phraseScore(prompt, values(skill.intent), 10);
    score += phraseScore(prompt, values(skill.modes), 4);
    const exclusions = values(skill.excludes);
    score -= phraseScore(prompt, exclusions, 18);
    return {skill: skill.id, macro: skill.macro, mode: skill.macroMode, score: Number(score.toFixed(6))};
  }).sort((left, right) => right.score - left.score || left.skill.localeCompare(right.skill));
  return {winner: ranked[0], margin: Number(((ranked[0]?.score ?? 0) - (ranked[1]?.score ?? 0)).toFixed(6)), ranked};
}

export function evaluate(catalog, suite) {
  const results = suite.cases.map((testCase) => {
    const route = routePrompt(catalog, testCase.prompt);
    return {...testCase, actualSkill: route.winner?.skill, margin: route.margin, passed: route.winner?.skill === testCase.expectedSkill};
  });
  const passed = results.filter((result) => result.passed).length;
  return {
    schemaVersion: 1,
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
    for (const failure of report.failures) console.error(`- ${failure.id}: expected ${failure.expectedSkill}, got ${failure.actualSkill}`);
  }
  if (check && report.accuracy !== 1) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
