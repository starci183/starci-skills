# Sonar assurance machine

## LOADS

None.

## Purpose

The machine proves one shared SonarQube assurance boundary across every routed backend, frontend and
console Source role. It is deterministic and testable with mocked provider responses.

## Contract

All three roles (`be`/backend, `fe`/frontend and console) must be routed, with every row recognized.
Evidence must identify the exact analysis SHA and return quality-gate status OK. Bugs, vulnerabilities and code smells are zero overall and new when supported; reliability,
security and maintainability ratings are A; security hotspots reviewed is 100%; duplicated lines density
is no more than 3 overall and new; native coverage is at least 80% overall and 90% new.

Scanner tokens are distinct from admin/operator authority. Analysis tokens use `SONAR_TOKEN` or
stdin; execute authority uses `SONAR_ADMIN_TOKEN`. Missing status, SHA or any required measure
fails. Tokens are never read from arguments or logs. Plan and dry-run modes do not contact the provider.
Execute proof reads status, all required measures, and the latest analysis revision from their dedicated
Web API endpoints; absent evidence fails.

## Evidence

The machine emits structured failures and treats an unsupported or missing required measure as incomplete,
never as a fabricated pass.
Tests inject fetch implementations, so no test contacts SonarQube or mutates an external service.
