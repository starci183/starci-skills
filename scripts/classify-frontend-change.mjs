#!/usr/bin/env node

import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";

const truthy = (value, keys) => keys.some((key) => value?.[key] === true);

export function classifyFrontendChange(facts) {
  if (!facts || typeof facts !== "object" || Array.isArray(facts)) throw new Error("frontend impact facts must be an object");
  const domains = [...new Set((facts.domains ?? []).filter((item) => typeof item === "string" && item.trim()))];
  const crossDomain = domains.length > 1 || truthy(facts, ["securityCritical", "paymentCritical", "externalProviderChanged"]);
  const capability = truthy(facts, ["businessRuleChanged", "contractChanged", "routeAdded", "operationAdded", "capabilityAdded"]);
  const page = truthy(facts, ["journeyChanged", "pageArchitectureChanged", "regionHierarchyChanged", "navigationChanged"]);
  const component = truthy(facts, ["componentAnatomyChanged", "blockStateChanged", "stateOwnershipChanged", "interactionChanged"]);
  const exactMicro = facts.decisionAlreadySpecified === true
    && facts.sourceBoundaryKnown === true
    && truthy(facts, ["copyOnly", "iconOnly", "spacingOnly", "styleTokenOnly", "breakpointFix"]);

  if (crossDomain) return {
    level: "cross-domain", workflow: "full", requiresDirection: true, approvalStages: 2,
    independentReviewer: true, proof: ["targeted-tests", "full-browser", "computed-visual", "dom", "accessibility", "interaction"],
    reason: "The change crosses domains or touches a security/payment/provider boundary."
  };
  if (capability) return {
    level: "capability", workflow: "full", requiresDirection: true, approvalStages: 2,
    independentReviewer: true, proof: ["targeted-tests", "full-browser", "computed-visual", "dom", "accessibility", "interaction"],
    reason: "The change adds or changes a business, route, operation or contract capability."
  };
  if (page) return {
    level: "page", workflow: "layout", requiresDirection: true, approvalStages: 2,
    independentReviewer: false, proof: ["targeted-tests", "full-browser", "computed-visual", "dom", "accessibility", "interaction"],
    reason: "The page journey, navigation, region hierarchy or page architecture changes."
  };
  if (component) return {
    level: "component", workflow: "block", requiresDirection: facts.decisionAlreadySpecified !== true, approvalStages: 1,
    independentReviewer: false, proof: ["targeted-tests", "parent-browser", "computed-visual", "accessibility", "interaction"],
    reason: "One component subtree changes anatomy, state ownership or interaction without changing page architecture."
  };
  if (exactMicro) return {
    level: "micro", workflow: "plain", requiresDirection: false, approvalStages: 0,
    independentReviewer: false, proof: ["targeted-tests", "browser-if-visual"],
    reason: "The exact local decision and source boundary are already known and no architecture, owner or contract changes."
  };
  throw new Error("frontend impact is ambiguous; resolve whether the change is micro, component, page, capability or cross-domain");
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invoked) {
  const input = process.argv[2];
  if (!input) throw new Error("Usage: node scripts/classify-frontend-change.mjs <facts.json>");
  process.stdout.write(`${JSON.stringify(classifyFrontendChange(JSON.parse(readFileSync(resolve(input), "utf8"))), null, 2)}\n`);
}
