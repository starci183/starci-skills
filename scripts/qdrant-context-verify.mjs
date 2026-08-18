#!/usr/bin/env node

import {readFileSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const apiKey = readFileSync(join(sourceRoot, ".stacks", "dev", "runtime", "files", "qdrant-mcp-api-key.txt"), "utf8").trim();
const base = "http://localhost:6336/collections/starci-context-v1";
const headers = {"api-key": apiKey, "content-type": "application/json"};

const request = async (url, options = {}) => {
  const response = await fetch(url, {headers, ...options});
  const body = await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${JSON.stringify(body).slice(0, 500)}`);
  return body.result;
};

const collection = await request(base);
console.log(`collection: points=${collection.points_count} vectors=${collection.indexed_vectors_count}`);
for (const role of ["be", "fe"]) {
  const result = await request(`${base}/points/count`, {
    method: "POST",
    body: JSON.stringify({filter: {must: [
      {key: "metadata.project", match: {value: "starci-academy"}},
      {key: "metadata.role", match: {value: role}},
    ]}}),
  });
  console.log(`/${role}/starci-academy: ${result.count}`);
}
