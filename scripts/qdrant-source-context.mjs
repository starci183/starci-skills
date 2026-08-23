#!/usr/bin/env node

import {randomBytes} from "node:crypto";
import {spawnSync} from "node:child_process";
import {existsSync, mkdirSync, readFileSync, statSync, writeFileSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const trustRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(trustRoot, "..");
const args = process.argv.slice(2);
const action = args[0];
const MCP_REVISION = "c56ae5adf62bb78d852bf7bbcbc5d7b75e2bbe41";
const QDRANT_IMAGE = "qdrant/qdrant:v1.19.0";
const COLLECTION = "starci-context-v1";
const MODEL = "qwen3-embedding:8b";
const DIMENSIONS = 4096;
const OLLAMA_URL = "http://host.docker.internal:11434";
const DEFAULT_PUBLIC_MCP_URL = "https://mcp.starci.org/mcp/";

const fail = (message) => {
  console.error(`qdrant-source-context: ${message}`);
  process.exit(1);
};
const valueFor = (flag) => {
  const at = args.indexOf(flag);
  return at >= 0 ? args[at + 1] : null;
};
const project = valueFor("--project");
const roles = (valueFor("--roles") ?? "").split(",").map((item) => item.trim()).filter(Boolean);
const publicMcpUrl = valueFor("--public-url") ?? DEFAULT_PUBLIC_MCP_URL;
let parsedPublicMcpUrl;
if (!project || !/^[a-z0-9][a-z0-9-]*$/.test(project)) fail("--project must be a lowercase workspace project name");
if (roles.length === 0 || roles.some((role) => !/^[a-z][a-z0-9-]*$/.test(role))) fail("--roles must contain workspace roles");
try {
  parsedPublicMcpUrl = new URL(publicMcpUrl);
  if (parsedPublicMcpUrl.protocol !== "https:" || parsedPublicMcpUrl.pathname !== "/mcp/" || parsedPublicMcpUrl.search || parsedPublicMcpUrl.hash || parsedPublicMcpUrl.username || parsedPublicMcpUrl.password) {
    fail("--public-url must be an HTTPS origin ending at /mcp/ without credentials, query or fragment");
  }
} catch {
  fail("--public-url must be a valid HTTPS MCP URL");
}
if (!parsedPublicMcpUrl.hostname.startsWith("mcp.")) fail("--public-url hostname must use mcp.<zone>");
const publicShowcaseUrl = valueFor("--showcase-url") ?? `https://qdrant.${parsedPublicMcpUrl.hostname.slice(4)}/dashboard`;
try {
  const parsedShowcaseUrl = new URL(publicShowcaseUrl);
  if (parsedShowcaseUrl.protocol !== "https:" || parsedShowcaseUrl.pathname !== "/dashboard" || parsedShowcaseUrl.search || parsedShowcaseUrl.hash || parsedShowcaseUrl.username || parsedShowcaseUrl.password) {
    fail("--showcase-url must be an HTTPS origin ending at /dashboard without credentials, query or fragment");
  }
} catch {
  fail("--showcase-url must be a valid HTTPS Qdrant showcase URL");
}
if (!["plan", "config", "index", "up", "down", "setup"].includes(action)) {
  fail("usage: qdrant-source-context.mjs <plan|config|index|up|down|setup> --project <name> --roles <be,fe> [--public-url https://mcp.<zone>/mcp/] [--showcase-url https://qdrant.<zone>/dashboard]");
}

const readJson = (path, label) => {
  if (!existsSync(path)) fail(`${label} is missing: ${path}`);
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch (error) { fail(`${label} is invalid JSON: ${error.message}`); }
};
const routes = roles.map((role) => {
  const routePath = join(sourceRoot, ".workspaces", "local", "routes", project, role, "config.json");
  const route = readJson(routePath, `${project}/${role} route`);
  if (route.project !== project || route.role !== role) fail(`${routePath} identifies ${route.project}/${route.role}`);
  const diskPath = resolve(route.repository?.diskPath ?? "");
  if (!existsSync(diskPath) || resolve(route.repository?.gitRoot ?? "") !== diskPath) fail(`${project}/${role} route has no verified checkout`);
  return {role, route, diskPath};
});

const appQdrantPort = Number(readJson(join(sourceRoot, "metadata.json"), "Source metadata").ports?.qdrant);
if (!Number.isInteger(appQdrantPort)) fail("Source metadata has no numeric ports.qdrant");
const restPort = appQdrantPort + 2;
const grpcPort = restPort + 1;
const mcpPort = 8011;
const showcasePort = 8012;
const cacheDir = join(sourceRoot, ".workspaces", "local", "state", "source-context", "mcp");
const composeFile = join(cacheDir, "compose.yaml");
const envFile = join(cacheDir, ".env");
const clientFile = join(cacheDir, "mcp.json");
const secretRecord = "dev/runtime/files/qdrant-mcp-api-key.txt";
const encryptedKey = join(sourceRoot, ".stacks", `${secretRecord}.enc`);
const keyFile = join(sourceRoot, ".stacks", secretRecord);
const docker = process.platform === "win32" ? "docker.exe" : "docker";
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const yamlPath = (path) => path.replaceAll("\\", "/").replaceAll("'", "''");
const mcpGatewayTemplate = join(trustRoot, "mcp", "docker", "mcp-gateway.conf.template");
const showcaseTemplate = join(trustRoot, "mcp", "docker", "qdrant-showcase.conf.template");

const run = (command, commandArgs, options = {}) => {
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd ?? sourceRoot,
    input: options.input,
    encoding: "utf8",
    stdio: options.input ? ["pipe", "inherit", "inherit"] : "inherit",
    windowsHide: true,
    shell: process.platform === "win32" && command.endsWith(".cmd"),
  });
  if (result.error) fail(`${command} could not start: ${result.error.message}`);
  if (result.status !== 0) fail(`${command} exited ${result.status}`);
};

const ensureKey = () => {
  if (!existsSync(encryptedKey)) {
    run(npm, ["run", "secret:set", "--", secretRecord], {
      input: randomBytes(48).toString("base64url"),
    });
  }
  if (!existsSync(keyFile) || statSync(keyFile).size === 0) {
    run(npm, ["run", "secret:show", "--", secretRecord]);
  }
  if (!existsSync(keyFile) || statSync(keyFile).size === 0) fail("dedicated Qdrant key could not be prepared");
};

const writeConfig = () => {
  ensureKey();
  mkdirSync(cacheDir, {recursive: true});
  writeFileSync(envFile, `QDRANT_MCP_API_KEY=${readFileSync(keyFile, "utf8").trim()}\n`);
  const services = [`  qdrant-context:
    image: ${QDRANT_IMAGE}
    container_name: starci-source-context-qdrant
    environment:
      QDRANT__SERVICE__API_KEY: \${QDRANT_MCP_API_KEY}
    ports:
      - "${restPort}:6333"
      - "${grpcPort}:6334"
    volumes:
      - qdrant-context-data:/qdrant/storage
    healthcheck:
      test: ["CMD", "bash", "-c", "</dev/tcp/127.0.0.1/6333"]
      interval: 3s
      timeout: 2s
      retries: 30
    restart: unless-stopped`, `  mcp-context:
    image: starci/mcp-server-qdrant-ollama:${MCP_REVISION.slice(0, 12)}
    build:
      context: '${yamlPath(trustRoot)}'
      dockerfile: mcp/docker/mcp-ollama.Dockerfile
      args:
        MCP_SERVER_QDRANT_REVISION: ${MCP_REVISION}
    container_name: starci-source-context-mcp
    command: ["--transport", "streamable-http"]
    environment:
      FASTMCP_SERVER_HOST: 0.0.0.0
      FASTMCP_SERVER_PORT: 8000
      QDRANT_URL: http://qdrant-context:6333
      QDRANT_API_KEY: \${QDRANT_MCP_API_KEY}
      COLLECTION_NAME: ${COLLECTION}
      OLLAMA_URL: ${OLLAMA_URL}
      OLLAMA_EMBEDDING_MODEL: ${MODEL}
      OLLAMA_EMBEDDING_DIMENSIONS: "${DIMENSIONS}"
      QDRANT_READ_ONLY: "true"
      QDRANT_SEARCH_LIMIT: "10"
      TOOL_FIND_DESCRIPTION: Search routed source catalogs under /fe/<project> and /be/<project>; open authoritative files before writing.
    expose:
      - "8000"
    extra_hosts:
      - "host.docker.internal:host-gateway"
    depends_on:
      qdrant-context:
        condition: service_healthy
    restart: unless-stopped`, `  mcp-gateway:
    image: nginx:1.29-alpine
    container_name: starci-source-context-mcp-gateway
    ports:
      - "${mcpPort}:8080"
    volumes:
      - '${yamlPath(mcpGatewayTemplate)}:/etc/nginx/conf.d/default.conf:ro'
    depends_on:
      - mcp-context
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:8080/healthz"]
      interval: 3s
      timeout: 2s
      retries: 30
    restart: unless-stopped`, `  qdrant-showcase:
    image: nginx:1.29-alpine
    container_name: starci-source-context-showcase
    environment:
      QDRANT_MCP_API_KEY: \${QDRANT_MCP_API_KEY}
      NGINX_ENVSUBST_FILTER: ^QDRANT_MCP_API_KEY$
    ports:
      - "${showcasePort}:8080"
    volumes:
      - '${yamlPath(showcaseTemplate)}:/etc/nginx/templates/default.conf.template:ro'
    depends_on:
      qdrant-context:
        condition: service_healthy
    restart: unless-stopped`];
  for (const route of routes) {
    services.push(`  index-${route.role}-${project}:
    image: starci/qdrant-source-indexer:v1
    build:
      context: '${yamlPath(trustRoot)}'
      dockerfile: mcp/docker/indexer.Dockerfile
    profiles: ["tools"]
    environment:
      QDRANT_MCP_API_KEY: \${QDRANT_MCP_API_KEY}
    volumes:
      - '${yamlPath(route.diskPath)}:/source:ro'
      - '${yamlPath(cacheDir)}:/output'
    extra_hosts:
      - "host.docker.internal:host-gateway"
    command: ["--root", "/source", "--project", "${project}", "--role", "${route.role}", "--repository", "${String(route.route.repository?.gitRepository ?? "")}", "--revision", "${String(route.route.repository?.head ?? "unknown")}", "--collection", "${COLLECTION}", "--qdrant-url", "http://qdrant-context:6333", "--api-key-env", "QDRANT_MCP_API_KEY", "--manifest", "/output/${route.role}-${project}-index.json", "--model", "${MODEL}", "--ollama-url", "${OLLAMA_URL}", "--dimensions", "${DIMENSIONS}"]
    depends_on:
      qdrant-context:
        condition: service_healthy`);
  }
  writeFileSync(composeFile, `name: starci-source-context\nservices:\n${services.join("\n")}\nvolumes:\n  qdrant-context-data:\n`);
  writeFileSync(clientFile, `${JSON.stringify({mcpServers: {
    "starci-source-context": {url: publicMcpUrl},
  }}, null, 2)}\n`);
  console.log(`wrote: ${composeFile}`);
  console.log(`wrote: ${clientFile}`);
};

const compose = (...commandArgs) => run(docker, ["compose", "--env-file", envFile, "-f", composeFile, ...commandArgs]);
const requireConfig = () => {
  if (!existsSync(composeFile) || !existsSync(envFile)) fail("generated config is absent; run config or setup first");
};
const index = () => {
  requireConfig();
  compose("up", "-d", "--wait", "qdrant-context");
  const indexServices = roles.map((role) => `index-${role}-${project}`);
  compose("--profile", "tools", "build", ...indexServices);
  for (const service of indexServices) compose("--profile", "tools", "run", "--rm", service);
};
const up = () => {
  requireConfig();
  compose("up", "-d", "--build", "qdrant-context", "mcp-context", "mcp-gateway", "qdrant-showcase");
};

if (action === "plan") {
  console.log(`project partitions: ${roles.map((role) => `/${role}/${project}`).join(", ")}`);
  console.log(`shared collection: ${COLLECTION}`);
  console.log(`dedicated qdrant: http://localhost:${restPort} (gRPC ${grpcPort})`);
  console.log(`MCP local diagnostic: http://localhost:${mcpPort}/mcp/`);
  console.log(`MCP canonical: ${publicMcpUrl}`);
  console.log(`Qdrant dashboard local: http://localhost:${showcasePort}/dashboard`);
  console.log(`Qdrant showcase canonical: ${publicShowcaseUrl}`);
  console.log(`encrypted key: ${encryptedKey} (${existsSync(encryptedKey) ? "ready" : "will mint"})`);
  for (const route of routes) console.log(`/${route.role}/${project}: ${route.diskPath}`);
  console.log(`generated state: ${cacheDir}`);
} else if (action === "config") {
  writeConfig();
} else if (action === "index") {
  index();
} else if (action === "up") {
  up();
} else if (action === "down") {
  requireConfig();
  compose("down");
} else if (action === "setup") {
  writeConfig();
  index();
  up();
}
