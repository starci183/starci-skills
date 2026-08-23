import assert from "node:assert/strict";
import {mkdtempSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";
import {deflateSync} from "node:zlib";
import {validateVisualProof} from "./validate-visual-proof.mjs";

const crcTable = Array.from({length: 256}, (_, value) => {
  let result = value;
  for (let bit = 0; bit < 8; bit += 1) result = (result & 1) ? 0xedb88320 ^ (result >>> 1) : result >>> 1;
  return result >>> 0;
});
const crc32 = (bytes) => { let crc = 0xffffffff; for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; };
const chunk = (type, body) => {
  const name = Buffer.from(type); const length = Buffer.alloc(4); length.writeUInt32BE(body.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([name, body])));
  return Buffer.concat([length, name, body, crc]);
};
const png = (width, height, rgba) => {
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  const rows = []; for (let y = 0; y < height; y += 1) rows.push(Buffer.concat([Buffer.from([0]), rgba.subarray(y * width * 4, (y + 1) * width * 4)]));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(Buffer.concat(rows))), chunk("IEND", Buffer.alloc(0))]);
};

const setup = () => {
  const root = mkdtempSync(join(tmpdir(), "starci-visual-"));
  const white = Buffer.from([255, 255, 255, 255, 255, 255, 255, 255]);
  writeFileSync(join(root, "preview.png"), png(2, 1, white)); writeFileSync(join(root, "source.png"), png(2, 1, white));
  writeFileSync(join(root, "preview-dom.json"), JSON.stringify({role: "main", children: [{role: "button", name: "Open"}]}));
  writeFileSync(join(root, "source-dom.json"), JSON.stringify({children: [{name: "Open", role: "button"}], role: "main"}));
  writeFileSync(join(root, "axe.json"), JSON.stringify({tool: "axe-core", violations: []}));
  writeFileSync(join(root, "trace.json"), JSON.stringify({tool: "playwright", actions: [{id: "open", status: "passed"}], consoleErrors: [], failedRequests: []}));
  const baseline = {authentication: {applicability: "not-applicable"}, references: [{id: "desktop-ready", state: "ready", viewport: {width: 2, height: 1}, deviceScaleFactor: 1, visualThresholds: {maxChangedRatio: 0, maxMeanDelta: 0, perPixelDelta: 0, masks: []}, previewDomSnapshot: "preview-dom.json", requiredInteractions: ["open"]}]};
  const proof = {schemaVersion: 4, candidateAt: "a".repeat(64), renderContractId: "lesson-render", requestedTerminalState: "committed", actualTerminalState: "committed", authentication: {applicability: "not-applicable", reason: "The route is public."}, knownDefects: [], checks: {build: "passed", lint: "passed", tests: "passed", browser: "passed"}, comparisons: [{referenceId: "desktop-ready", state: "ready", viewport: {width: 2, height: 1}, previewCapture: "preview.png", sourceCapture: "source.png", sourceDomSnapshot: "source-dom.json", accessibilityReport: "axe.json", interactionTrace: "trace.json"}]};
  return {root, baseline, proof};
};

test("computed image, DOM, accessibility and interaction evidence passes", (t) => {
  const value = setup(); t.after(() => rmSync(value.root, {recursive: true, force: true}));
  const result = validateVisualProof(value.baseline, value.proof, {baselineRoot: value.root, proofRoot: value.root});
  assert.equal(result.ok, true); assert.equal(result.measurements[0].visual.changedPixels, 0);
});
test("declared pass cannot hide a computed pixel mismatch", (t) => {
  const value = setup(); t.after(() => rmSync(value.root, {recursive: true, force: true}));
  writeFileSync(join(value.root, "source.png"), png(2, 1, Buffer.from([0, 0, 0, 255, 255, 255, 255, 255])));
  assert.match(validateVisualProof(value.baseline, value.proof, {baselineRoot: value.root, proofRoot: value.root}).failures.join("\n"), /computed visual diff failed/);
});
test("DOM differences are computed", (t) => {
  const value = setup(); t.after(() => rmSync(value.root, {recursive: true, force: true}));
  writeFileSync(join(value.root, "source-dom.json"), JSON.stringify({role: "main", children: []}));
  assert.match(validateVisualProof(value.baseline, value.proof, {baselineRoot: value.root, proofRoot: value.root}).failures.join("\n"), /computed DOM structure differs/);
});
test("accessibility violations cannot be self-declared away", (t) => {
  const value = setup(); t.after(() => rmSync(value.root, {recursive: true, force: true}));
  writeFileSync(join(value.root, "axe.json"), JSON.stringify({tool: "axe-core", violations: [{id: "button-name"}]}));
  assert.match(validateVisualProof(value.baseline, value.proof, {baselineRoot: value.root, proofRoot: value.root}).failures.join("\n"), /accessibility report contains violations/);
});
test("required interaction trace cannot omit the critical action", (t) => {
  const value = setup(); t.after(() => rmSync(value.root, {recursive: true, force: true}));
  writeFileSync(join(value.root, "trace.json"), JSON.stringify({tool: "playwright", actions: [], consoleErrors: [], failedRequests: []}));
  assert.match(validateVisualProof(value.baseline, value.proof, {baselineRoot: value.root, proofRoot: value.root}).failures.join("\n"), /required action open/);
});
test("known defects and an uncommitted delivery cannot pass", (t) => {
  const value = setup(); t.after(() => rmSync(value.root, {recursive: true, force: true})); value.proof.knownDefects = ["mobile overflow"]; value.proof.actualTerminalState = "verified-local";
  assert.match(validateVisualProof(value.baseline, value.proof, {baselineRoot: value.root, proofRoot: value.root}).failures.join("\n"), /known visual defects|delivery stopped/);
});
test("evidence paths cannot escape their declared roots", (t) => {
  const value = setup(); t.after(() => rmSync(value.root, {recursive: true, force: true})); value.proof.comparisons[0].sourceDomSnapshot = "../outside.json";
  assert.match(validateVisualProof(value.baseline, value.proof, {baselineRoot: value.root, proofRoot: value.root}).failures.join("\n"), /escapes its evidence root/);
});
test("authenticated delivery must fill credentials through the product UI", (t) => {
  const value = setup(); t.after(() => rmSync(value.root, {recursive: true, force: true}));
  value.baseline.authentication = {applicability: "required", entryRoute: "/dang-nhap", protectedRoute: "/hoi-vien"};
  value.proof.authentication = {applicability: "required", entryRoute: "/dang-nhap", protectedRoute: "/hoi-vien", credentialSource: "process-environment", interactionTrace: "auth-trace.json"};
  writeFileSync(join(value.root, "auth-trace.json"), JSON.stringify({
    tool: "playwright", sessionSetup: "product-ui", credentialSource: "process-environment", consoleErrors: [], failedRequests: [],
    actions: [
      {id: "auth-open-login", status: "passed", method: "page.goto"},
      {id: "auth-fill-username", status: "passed", method: "locator.fill", selector: "username"},
      {id: "auth-fill-password", status: "passed", method: "locator.fill", selector: "password"},
      {id: "auth-submit", status: "passed", method: "locator.click", selector: "submit"},
      {id: "auth-reach-protected-route", status: "passed", method: "page.waitForURL"},
    ],
  }));
  assert.equal(validateVisualProof(value.baseline, value.proof, {baselineRoot: value.root, proofRoot: value.root}).ok, true);
});
test("direct API session setup cannot satisfy authenticated browser proof", (t) => {
  const value = setup(); t.after(() => rmSync(value.root, {recursive: true, force: true}));
  value.baseline.authentication = {applicability: "required", entryRoute: "/dang-nhap", protectedRoute: "/hoi-vien"};
  value.proof.authentication = {applicability: "required", entryRoute: "/dang-nhap", protectedRoute: "/hoi-vien", credentialSource: "process-environment", interactionTrace: "auth-trace.json"};
  writeFileSync(join(value.root, "auth-trace.json"), JSON.stringify({tool: "playwright", sessionSetup: "direct-api", credentialSource: "process-environment", actions: [], consoleErrors: [], failedRequests: []}));
  assert.match(validateVisualProof(value.baseline, value.proof, {baselineRoot: value.root, proofRoot: value.root}).failures.join("\n"), /product UI/);
});
test("authenticated browser proof cannot omit password entry", (t) => {
  const value = setup(); t.after(() => rmSync(value.root, {recursive: true, force: true}));
  value.baseline.authentication = {applicability: "required", entryRoute: "/dang-nhap", protectedRoute: "/hoi-vien"};
  value.proof.authentication = {applicability: "required", entryRoute: "/dang-nhap", protectedRoute: "/hoi-vien", credentialSource: "process-environment", interactionTrace: "auth-trace.json"};
  writeFileSync(join(value.root, "auth-trace.json"), JSON.stringify({tool: "playwright", sessionSetup: "product-ui", credentialSource: "process-environment", actions: [
    {id: "auth-open-login", status: "passed", method: "page.goto"},
    {id: "auth-fill-username", status: "passed", method: "locator.fill"},
    {id: "auth-submit", status: "passed", method: "locator.click"},
    {id: "auth-reach-protected-route", status: "passed", method: "page.waitForURL"},
  ], consoleErrors: [], failedRequests: []}));
  assert.match(validateVisualProof(value.baseline, value.proof, {baselineRoot: value.root, proofRoot: value.root}).failures.join("\n"), /auth-fill-password/);
});
