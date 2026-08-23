#!/usr/bin/env node

import {existsSync, readFileSync} from "node:fs";
import {join, resolve} from "node:path";

const args = process.argv.slice(2);
const sourceArg = args[args.indexOf("--source") + 1];

if (!args.includes("--source") || !sourceArg) {
  console.error("usage: resolve-workspace-language.mjs --source <Source>");
  process.exit(2);
}

const route = join(resolve(sourceArg), ".workspaces", "config.json");
if (!existsSync(route)) {
  console.error(`workspace config is absent: ${route}`);
  process.exit(1);
}

let config;
try {
  config = JSON.parse(readFileSync(route, "utf8"));
} catch (error) {
  console.error(`workspace config is not valid JSON: ${route} — ${error.message}`);
  process.exit(1);
}

if (config === null || Array.isArray(config) || typeof config !== "object") {
  console.error(`workspace config is invalid: ${route} — root must be an object`);
  process.exit(1);
}

const allowed = new Set(["$schema", "version", "defaultLang"]);
const extras = Object.keys(config).filter((key) => !allowed.has(key));
const languageTag = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

if (
  config.version !== 1 ||
  typeof config.defaultLang !== "string" ||
  !languageTag.test(config.defaultLang) ||
  ("$schema" in config && typeof config.$schema !== "string") ||
  extras.length
) {
  const reasons = [];
  if (config.version !== 1) reasons.push("version must equal 1");
  if (typeof config.defaultLang !== "string" || !languageTag.test(config.defaultLang)) {
    reasons.push("defaultLang must be a BCP 47-style language tag");
  }
  if ("$schema" in config && typeof config.$schema !== "string") reasons.push("$schema must be a string");
  if (extras.length) reasons.push(`unknown fields: ${extras.join(", ")}`);
  console.error(`workspace config is invalid: ${route} — ${reasons.join("; ")}`);
  process.exit(1);
}

process.stdout.write(`${config.defaultLang}\n`);
