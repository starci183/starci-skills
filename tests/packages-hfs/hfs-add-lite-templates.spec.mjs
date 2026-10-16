import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { peerDependencies } from "../../packages/hfs/scaffold/app.mjs";
import { addLiteWebhookInbox, selectLiteWebhookEntries } from "../../packages/hfs/scaffold/add-inbox-lite.mjs";

test("add api and the scaffold declare the runtime peer of a driver integration pair the app depends on (R111), at its pin", () => {
  const pairs = [{ id: "apollo-express5", when: [{ package: "@nestjs/apollo" }, { package: "@nestjs/platform-express", major: 11 }], requires: "@as-integrations/express5" }];
  const pins = { "@as-integrations/express5": { version: "1.1.2" } };
  const graphql = { dependencies: { "@nestjs/apollo": "13.4.5", "@nestjs/platform-express": "11.2.5" } };
  assert.deepEqual(peerDependencies(graphql, pins, pairs), { "@as-integrations/express5": "1.1.2" });
  assert.deepEqual(peerDependencies({ dependencies: { ...graphql.dependencies, "@as-integrations/express5": "1.1.2" } }, pins, pairs), {}, "a declared peer is kept");
  assert.deepEqual(peerDependencies({ dependencies: { "@nestjs/apollo": "13.4.5", "@nestjs/platform-express": "10.4.0" } }, pins, pairs), {}, "another major is not the pair");
  assert.deepEqual(peerDependencies({ dependencies: { "@nestjs/platform-express": "11.2.5" } }, pins, pairs), {}, "no GraphQL, no peer");
  assert.throws(() => peerDependencies(graphql, {}, pairs), { code: "HFS_SCAFFOLD_PIN_MISSING" }, "a peer without a canon pin fails closed");
});

test("the lite API skeleton installs one typed global validation pipe", () => {
  const main = fs.readFileSync(
    new URL("../../packages/hfs/templates/be/skeleton-lite/apps/api/src/main.ts", import.meta.url),
    "utf8",
  );
  const security = fs.readFileSync(
    new URL("../../packages/hfs/templates/be/skeleton-lite/src/modules/platform/http-security/http-security.module.ts", import.meta.url),
    "utf8",
  );
  const validation = fs.readFileSync(
    new URL("../../packages/hfs/templates/be/skeleton/src/modules/platform/http-security/request-validation.service.ts", import.meta.url),
    "utf8",
  );
  const errors = fs.readFileSync(
    new URL("../../packages/hfs/templates/be/skeleton/src/modules/platform/http-security/errors/http-security.error.ts", import.meta.url),
    "utf8",
  );
  // One typed global pipe, installed by the container (a single APP_PIPE of the http-security module), never by main.ts.
  assert.equal(main.includes("useGlobalPipes"), false, "main.ts installs no pipe by hand");
  assert.equal(security.match(/provide:\s*APP_PIPE,\s*useClass:\s*RequestValidationService/g)?.length, 1, "exactly one APP_PIPE of the typed validation service");
  assert.match(validation, /whitelist: true/);
  assert.match(validation, /forbidNonWhitelisted: true/);
  assert.match(validation, /transform: true/);
  assert.match(validation, /HttpSecurityErrorCode\.RequestInvalid/);
  assert.match(errors, /\[HttpSecurityErrorCode\.RequestInvalid\]: "invalid"/);
});

test("lite webhook selection changes only its door and spec; full and other nouns retain their generators", () => {
  const entries = [
    { template: "webhooks/webhook.door.ts.tpl", path: "provider.webhook.ts" },
    { template: "webhooks/webhook.door.spec.ts.tpl", path: "provider.webhook.spec.ts" },
    { template: "webhooks/webhook.http.module.ts.tpl", path: "provider-http.module.ts" },
  ];
  const selected = selectLiteWebhookEntries(entries);
  assert.deepEqual(selected.map((entry) => entry.template), ["../inbox/webhook-door.ts.tpl", "../inbox/webhook-door.spec.ts.tpl", "webhooks/webhook.http.module.ts.tpl"]);
  assert.equal(selected[2], entries[2]);
  assert.equal(entries[0].template, "webhooks/webhook.door.ts.tpl", "the full-edition template entry remains intact");
  assert.deepEqual(addLiteWebhookInbox({ repo: { edition: "full" }, noun: "webhook" }), []);
  assert.deepEqual(addLiteWebhookInbox({ repo: { edition: "lite" }, noun: "api" }), []);
});
