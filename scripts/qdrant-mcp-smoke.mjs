#!/usr/bin/env node

const url = process.argv[2] ?? "http://localhost:8011/mcp/";
const headers = {
  accept: "application/json, text/event-stream",
  "content-type": "application/json",
};

const parseResponse = async (response) => {
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${text.slice(0, 500)}`);
  const dataLine = text.split(/\r?\n/).find((line) => line.startsWith("data: "));
  return JSON.parse(dataLine ? dataLine.slice(6) : text);
};

const post = async (body, sessionId) => {
  const response = await fetch(url, {
    method: "POST",
    headers: sessionId ? {...headers, "mcp-session-id": sessionId} : headers,
    body: JSON.stringify(body),
  });
  return {response, payload: await parseResponse(response)};
};

const initialized = await post({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: {name: "starci-qdrant-smoke", version: "1"},
  },
});
const sessionId = initialized.response.headers.get("mcp-session-id");
if (!sessionId) throw new Error("initialize returned no mcp-session-id");

await fetch(url, {
  method: "POST",
  headers: {...headers, "mcp-session-id": sessionId},
  body: JSON.stringify({jsonrpc: "2.0", method: "notifications/initialized"}),
});

const listed = await post({jsonrpc: "2.0", id: 2, method: "tools/list", params: {}}, sessionId);
const names = listed.payload.result?.tools?.map((tool) => tool.name) ?? [];
if (!names.includes("qdrant-find")) throw new Error(`qdrant-find absent: ${names.join(", ")}`);
if (names.includes("qdrant-store")) throw new Error("qdrant-store is exposed on a read-only source collection");

const found = await post({
  jsonrpc: "2.0",
  id: 3,
  method: "tools/call",
  params: {name: "qdrant-find", arguments: {query: "authentication login session"}},
}, sessionId);
const resultText = JSON.stringify(found.payload.result ?? {});
if (!resultText.includes("/be/") && !resultText.includes("/fe/")) {
  throw new Error("semantic query returned no routed /be/ or /fe/ path");
}

console.log(`ok: ${names.join(", ")}; semantic result contains routed source paths`);
