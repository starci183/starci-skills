#!/usr/bin/env python3
"""Build each modular operator into one self-contained .dist/operators/<id>.json."""
import argparse
import copy
import importlib.util
import json
import os
from pathlib import Path
import re
import sys
import tempfile

from validate_operator import MACHINE_CHECKS


def load_builder(name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(name + ".py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


alias_builder = load_builder("build-alias")
schema_builder = load_builder("build-schema")
BuildError = alias_builder.BuildError
read = alias_builder.read
closed = alias_builder.closed
local_file = alias_builder.local_file

# Unknown JSON Schema keywords are legal annotations in the standard but usually indicate
# a misplaced constraint in these authored contracts. Keep this source dialect explicit.
SCHEMA_KEYWORDS = set("""$schema $id $ref $defs $comment definitions title description default examples
type enum const allOf anyOf oneOf not if then else properties patternProperties
additionalProperties unevaluatedProperties required dependentRequired dependentSchemas propertyNames
minProperties maxProperties items prefixItems contains minContains maxContains unevaluatedItems
minItems maxItems uniqueItems minLength maxLength pattern format contentEncoding contentMediaType
contentSchema minimum maximum exclusiveMinimum exclusiveMaximum multipleOf readOnly writeOnly deprecated""".split())


def text(value):
    if not isinstance(value, str) or not value.strip():
        raise BuildError("expected nonempty text")


def identifier(value):
    if not isinstance(value, str) or not re.fullmatch(r"[a-z][a-z0-9.-]*", value):
        raise BuildError(f"invalid identifier: {value!r}")


def build(source, aliases, schema):
    source = source.resolve(strict=True)
    manifest = read(local_file(source, "operator.json"))
    closed(manifest, {"schemaVersion", "id", "purpose", "scope", "modules"})
    if type(manifest["schemaVersion"]) is not int or manifest["schemaVersion"] != 1:
        raise BuildError("operator schemaVersion must be 1")
    identifier(manifest["id"])
    if source.name != manifest["id"]:
        raise BuildError("operator id must match its directory")
    text(manifest["purpose"])
    text(manifest["scope"])
    closed(manifest["modules"], {"request", "response", "validate", "step", "criteria"})
    modules, files = {}, {local_file(source, "operator.json")}
    for key, name in manifest["modules"].items():
        file = local_file(source, name)
        if file in files:
            raise BuildError(f"duplicate module file: {name}")
        files.add(file)
        modules[key] = read(file)
    if files != {file.resolve() for file in source.rglob("*.json") if "tests" not in file.relative_to(source).parts}:
        raise BuildError("unlisted operator JSON source")
    for kind in ("request", "response"):
        contract = modules[kind]
        if not isinstance(contract, dict) or contract.get("$ref") != f"works:{kind}":
            raise BuildError(f"{kind} must extend works:{kind}")
        for _, node in schema_builder.schema_nodes(contract):
            if not isinstance(node, dict):
                continue
            if set(node) - SCHEMA_KEYWORDS:
                raise BuildError("unknown operator schema keywords: " + ", ".join(sorted(set(node) - SCHEMA_KEYWORDS)))
            if "$id" in node or schema_builder.UNSUPPORTED.intersection(node):
                raise BuildError("scoped schema identities and dynamic references are unsupported")
            if "$ref" in node:
                reference = node["$ref"]
                if not isinstance(reference, str) or reference not in {"works:request", "works:response"}:
                    raise BuildError(f"unsupported operator schema reference: {reference}")
                node["$ref"] = "#/$defs/" + reference.removeprefix("works:")
    operation = modules["request"].get("properties", {}).get("operation", {})
    if operation != {"const": manifest["id"]}:
        raise BuildError("request operation must be constrained to the operator id")
    validation = modules["validate"]
    closed(validation, {"machine", "review", "failurePolicy"})
    text(validation["failurePolicy"])
    check_ids, opcodes = set(), set()
    for group in ("machine", "review"):
        if not isinstance(validation[group], list):
            raise BuildError(f"validate.{group} must be an array")
        for check in validation[group]:
            closed(check, {"id", "phase", "check"} if group == "machine" else {"id", "instruction"})
            identifier(check["id"])
            if check["id"] in check_ids:
                raise BuildError("duplicate validation id")
            check_ids.add(check["id"])
            if group == "machine":
                if not isinstance(check["check"], str) or check["check"] not in MACHINE_CHECKS or check["phase"] != MACHINE_CHECKS[check["check"]]:
                    raise BuildError("unknown machine check or wrong validation phase")
                if check["check"] in opcodes:
                    raise BuildError("duplicate machine check")
                opcodes.add(check["check"])
            else:
                text(check["instruction"])
    if not {"request-schema", "response-schema", "request-binding"} <= opcodes:
        raise BuildError("request, response and request-binding checks are required")
    closed(modules["step"], {"steps"})
    steps = modules["step"]["steps"]
    if not isinstance(steps, list) or not steps:
        raise BuildError("steps must be a nonempty array")
    used, executed_checks, step_ids = set(), set(), set()
    for step in steps:
        closed(step, {"id", "instruction", "reads", "writes", "calls", "checks", "produces"})
        identifier(step["id"])
        if step["id"] in step_ids:
            raise BuildError("duplicate step id")
        step_ids.add(step["id"])
        text(step["instruction"])
        for key in ("reads", "writes", "calls", "checks", "produces"):
            if not isinstance(step[key], list):
                raise BuildError(f"step.{key} must be an array")
        for key in ("checks", "produces"):
            for value in step[key]:
                text(value)
        if set(step["checks"]) - check_ids:
            raise BuildError("step names an undeclared validation check")
        executed_checks.update(step["checks"])
        for group in ("reads", "writes", "calls"):
            for binding in step[group]:
                closed(binding, {"alias", "when", "purpose" if group == "calls" else "path"})
                text(binding["alias"])
                text(binding["when"])
                alias = aliases.get(binding["alias"])
                if alias is None:
                    raise BuildError(f"unknown alias: {binding['alias']}")
                used.add(binding["alias"])
                if group == "calls":
                    text(binding["purpose"])
                    if alias["zone"] not in {"tools", "cli"}:
                        raise BuildError("calls must name tools or cli aliases")
                else:
                    text(binding["path"])
                    path = binding["path"]
                    if "\\" in path or path.startswith("/") or ":" in path or any(part in {"", ".", ".."} for part in path.split("/")):
                        raise BuildError("step paths must be relative without traversal")
                    if group == "reads" and alias["zone"] == "remote" and alias["kind"] == "service":
                        continue  # Resource reference; a declared tool/CLI performs the read.
                    if alias["zone"] != "workspaces" or alias["kind"] not in {"dir", "checkout"}:
                        raise BuildError("file accesses require a workspace directory or checkout alias")
                    if group == "writes" and manifest["id"] not in alias["writers"]:
                        raise BuildError(f"operator is not a declared writer of {binding['alias']}")
    if executed_checks != check_ids:
        raise BuildError("every declared validation check must be assigned to a step")
    criteria = modules["criteria"]
    closed(criteria, {"limits", "history", "items", "stopWhen"})
    closed(criteria["limits"], {"feedbackRounds"})
    limit = criteria["limits"]["feedbackRounds"]
    if type(limit) is not int or limit < 1:
        raise BuildError("feedbackRounds must be a positive integer")
    text(criteria["history"])
    text(criteria["stopWhen"])
    if not isinstance(criteria["items"], list) or not criteria["items"]:
        raise BuildError("criteria items must be a nonempty array")
    criterion_ids, covered, review_ids = set(), set(), []
    available = {group: {check["id"] for check in validation[group]} for group in ("machine", "review")}
    available["event"] = {"capability-unavailable", "essential-input-missing", "transient-execution-failure"}
    for item in criteria["items"]:
        closed(item, {"id", "expect", "check", "onFail"})
        identifier(item["id"])
        if item["id"] in criterion_ids:
            raise BuildError("duplicate criterion id")
        criterion_ids.add(item["id"])
        text(item["expect"])
        closed(item["check"], {"kind", "ref"})
        kind, reference = item["check"]["kind"], item["check"]["ref"]
        if not isinstance(kind, str) or not isinstance(reference, str) or reference not in available.get(kind, set()):
            raise BuildError("criterion names an unknown check")
        key = (kind, reference)
        if key in covered:
            raise BuildError("each check must have exactly one criterion")
        covered.add(key)
        failure = item["onFail"]
        closed(failure, {"action", "fromStep", "instruction"})
        text(failure["instruction"])
        if not isinstance(failure["fromStep"], str) or failure["fromStep"] not in step_ids:
            raise BuildError("criterion must resume at a declared step")
        if not isinstance(failure["action"], str) or failure["action"] not in {"retry", "ask", "block"}:
            raise BuildError("unknown criterion failure action")
        if kind == "review":
            review_ids.append(item["id"])
    required = {(group, check) for group in ("machine", "review", "event") for check in available[group]}
    if not required <= covered:
        raise BuildError("every validation check and execution event requires exactly one criterion")
    # One completion gate for every operator. Reviews remain evidence-backed agent judgments;
    # machine outcomes are computed by the validator, never accepted as self-attestations.
    response = modules["response"]
    response.setdefault("properties", {})["criteriaResults"] = {
        "items": {"properties": {"criterionId": {"enum": review_ids}}} if review_ids else False
    }
    response["properties"]["feedbackRound"] = {"maximum": limit}
    response.setdefault("allOf", []).append({
        "if": {"properties": {"status": {"const": "done"}}, "required": ["status"]},
        "then": {"required": ["criteriaResults", "feedbackRound", "observations"], "properties": {
            "criteriaResults": {"minItems": len(review_ids), "maxItems": len(review_ids),
                "items": {"properties": {"result": {"const": "passed"}, "outputIds": {"minItems": 1}}},
                "allOf": [{"contains": {"properties": {"criterionId": {"const": name}}, "required": ["criterionId"]}}
                          for name in review_ids]} if review_ids else {"maxItems": 0},
            "observations": {"minItems": 1, "items": {"properties": {"result": {"const": "passed"}}}}
        }}
    })
    bundle = {key: manifest[key] for key in ("schemaVersion", "id", "purpose", "scope")}
    bundle.update(modules)
    bundle["$defs"] = copy.deepcopy(schema["$defs"])
    bundle["aliases"] = {name: aliases[name] for name in sorted(used)}
    return (json.dumps(bundle, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode("utf-8")


def main(argv=None):
    root = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=root / ".claude/operators")
    parser.add_argument("--alias-source", type=Path, default=root / ".claude/alias")
    parser.add_argument("--schema-source", type=Path, default=root / ".claude/schema")
    parser.add_argument("--output-dir", type=Path, default=root / ".dist/operators")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args(argv)
    try:
        source = args.source.resolve(strict=True)
        destination = args.output_dir.resolve()
        if any(destination.is_relative_to(folder.resolve(strict=True)) for folder in (source, args.alias_source, args.schema_source)):
            raise BuildError("output must stay outside source directories")
        aliases = json.loads(alias_builder.build(args.alias_source))["aliases"]
        schema = json.loads(schema_builder.build(args.schema_source, "index.schema.json"))
        folders = sorted(source.iterdir())
        if not folders:
            raise BuildError("no operator sources")
        outputs = {}
        for folder in folders:
            if not folder.is_dir() or not folder.resolve().is_relative_to(source):
                raise BuildError(f"expected a local operator directory: {folder.name}")
            try:
                outputs[destination / (folder.name + ".json")] = build(folder, aliases, schema)
            except (ValueError, OSError) as error:
                raise BuildError(f"{folder.name}: {error}") from error
        if destination.exists() and set(destination.glob("*.json")) - outputs.keys():
            raise BuildError("obsolete operator bundles exist; remove the explicitly retired outputs before building")
        # Validate all sources before replacing any output.
        for file, payload in outputs.items():
            if args.check and (not file.is_file() or file.read_bytes() != payload):
                raise BuildError(f"missing or stale operator bundle: {file}")
        if not args.check:
            destination.mkdir(parents=True, exist_ok=True)
            for file, payload in outputs.items():
                temporary = None
                try:
                    with tempfile.NamedTemporaryFile(dir=destination, delete=False) as stream:
                        temporary = Path(stream.name)
                        stream.write(payload)
                    os.replace(temporary, file)
                    temporary = None
                finally:
                    if temporary is not None:
                        temporary.unlink(missing_ok=True)
        print(f"operator bundles {'are current' if args.check else 'built'}: {len(outputs)} in {destination}")
        return 0
    except (OSError, ValueError) as error:
        print(f"operator build failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
