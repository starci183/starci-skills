#!/usr/bin/env python3
"""Build modular alias sources into .dist/alias.json using Python's stdlib."""
import argparse
import json
import os
from pathlib import Path
import re
import sys
import tempfile


class BuildError(ValueError):
    pass


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise BuildError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def read(file):
    def invalid_number(value):
        raise BuildError(f"invalid JSON number: {value}")
    return json.loads(file.read_text(encoding="utf-8-sig"),
                      object_pairs_hook=unique_object, parse_constant=invalid_number)


def closed(value, required, optional=()):
    if not isinstance(value, dict) or set(required) - value.keys() or value.keys() - set(required) - set(optional):
        raise BuildError(f"expected object with required fields {sorted(required)}; optional {sorted(optional)}")


def local_file(root, name):
    if not isinstance(name, str) or not name or "\\" in name or Path(name).is_absolute():
        raise BuildError(f"expected a relative file path: {name!r}")
    file = (root / name).resolve(strict=True)
    if not file.is_relative_to(root) or not file.is_file():
        raise BuildError(f"file escapes source directory or is not a file: {name}")
    return file


def strings(value):
    return isinstance(value, list) and all(isinstance(x, str) and x.strip() for x in value) and len(value) == len(set(value))


def validate_alias(name, value, zones):
    if not re.fullmatch(r"@[a-z][a-z-]*(?:/[a-z_][a-z0-9_-]*)*", name):
        raise BuildError(f"invalid alias name: {name}")
    closed(value, {"params", "kind", "resolvesTo", "scheme", "bind", "writers", "purpose", "zone"},
           {"note", "helperWritable", "support", "invocation"})
    if not isinstance(value["kind"], str) or value["kind"] not in {"file", "dir", "checkout", "service", "caller-supplied", "tool", "cli"}:
        raise BuildError(f"{name}: invalid kind")
    if not strings(value["params"]) or not strings(value["writers"]):
        raise BuildError(f"{name}: params and writers must be unique string arrays")
    for key in ("resolvesTo", "scheme", "bind", "purpose", "zone"):
        if not isinstance(value[key], str) or not value[key].strip():
            raise BuildError(f"{name}: {key} must be nonempty text")
    if value["zone"] not in zones or name.split("/")[0] != "@" + value["zone"]:
        raise BuildError(f"{name}: invalid zone binding")
    kinds = {"workspaces": {"file", "dir", "checkout"}, "tools": {"tool"}, "cli": {"cli"}, "remote": {"service"}}
    if value["kind"] not in kinds[value["zone"]]:
        raise BuildError(f"{name}: kind does not match namespace")
    if "helperWritable" in value and type(value["helperWritable"]) is not bool:
        raise BuildError(f"{name}: helperWritable must be boolean")
    if "note" in value and not isinstance(value["note"], str):
        raise BuildError(f"{name}: note must be text")
    if value["kind"] == "tool":
        support = value.get("support")
        if not isinstance(support, dict) or not support:
            raise BuildError(f"{name}: missing tool support")
        for runtime, binding in support.items():
            closed(binding, {"supported", "via"})
            if type(binding["supported"]) is not bool or not isinstance(binding["via"], str) or not binding["via"].strip():
                raise BuildError(f"{name}: invalid support for {runtime}")
    elif "support" in value:
        raise BuildError(f"{name}: support is only defined for tool aliases")
    if value["kind"] in {"tool", "cli"}:
        invocation = value.get("invocation")
        if value["kind"] == "tool":
            closed(invocation, {"capability"})
            if value["zone"] != "tools" or not isinstance(invocation["capability"], str) or not invocation["capability"].strip():
                raise BuildError(f"{name}: invalid session capability")
        else:
            closed(invocation, {"executable", "arguments"})
            if value["zone"] != "cli" or not isinstance(invocation["executable"], str) or not invocation["executable"].strip() or not isinstance(invocation["arguments"], list) or not all(isinstance(x, str) for x in invocation["arguments"]):
                raise BuildError(f"{name}: invalid CLI invocation")
    elif "invocation" in value:
        raise BuildError(f"{name}: resource aliases cannot declare execution")


def build(source):
    source = source.resolve(strict=True)
    manifest = read(local_file(source, "index.json"))
    closed(manifest, {"schemaVersion", "note", "zones", "segments", "modules"})
    if type(manifest["schemaVersion"]) is not int or manifest["schemaVersion"] != 1:
        raise BuildError("alias contract schemaVersion must be 1")
    if not isinstance(manifest["note"], str) or not manifest["note"].strip():
        raise BuildError("registry note must be nonempty text")
    if not isinstance(manifest["zones"], dict) or not manifest["zones"]:
        raise BuildError("zones must be a nonempty map")
    for zone in manifest["zones"].values():
        closed(zone, {"en"})
        if not isinstance(zone["en"], str) or not zone["en"].strip():
            raise BuildError("zone description must be English text")
    if not isinstance(manifest["segments"], dict) or not all(isinstance(x, str) and x.strip() for x in manifest["segments"].values()):
        raise BuildError("segments must map names to nonempty text")
    if not strings(manifest["modules"]) or not manifest["modules"]:
        raise BuildError("modules must be a nonempty unique string array")
    aliases, visited = {}, set()
    zones = set(manifest["zones"])
    if zones != {"workspaces", "tools", "cli", "remote"}:
        raise BuildError("expected workspaces, tools, cli and remote namespaces")

    def add(name, value):
        if name in aliases:
            raise BuildError(f"duplicate alias: {name}")
        validate_alias(name, value, zones)
        aliases[name] = value

    for name in manifest["modules"]:
        file = local_file(source, name)
        if file in visited or file == source / "index.json":
            raise BuildError(f"duplicate or recursive module: {name}")
        visited.add(file)
        module = read(file)
        closed(module, {"aliases"})
        if not isinstance(module["aliases"], dict) or not module["aliases"]:
            raise BuildError(f"{name}: aliases must be a nonempty map")
        for alias, value in module["aliases"].items():
            add(alias, value)
    if {file.resolve() for file in source.rglob("*.json")} != visited | {local_file(source, "index.json")}:
        raise BuildError("unlisted JSON source module")
    bundle = {key: manifest[key] for key in ("schemaVersion", "note", "zones", "segments")}
    bundle["aliases"] = aliases
    return (json.dumps(bundle, ensure_ascii=False, sort_keys=True, indent=2, allow_nan=False) + "\n").encode("utf-8")


def main(argv=None):
    root = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=root / ".claude/alias")
    parser.add_argument("--output", type=Path, default=root / ".dist/alias.json")
    parser.add_argument("--check", action="store_true", help="Check freshness without writing")
    args = parser.parse_args(argv)
    temporary = None
    try:
        source, output = args.source.resolve(strict=True), args.output.resolve()
        if output.is_relative_to(source):
            raise BuildError("output must be outside the source directory")
        payload = build(source)
        if args.check:
            if not output.is_file() or output.read_bytes() != payload:
                raise BuildError(f"bundle is missing or stale: {output}")
            print(f"alias bundle is current: {output}")
            return 0
        output.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=output.parent, prefix=f".{output.name}.", suffix=".tmp", delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(payload)
        os.replace(temporary, output)
        temporary = None
        print(f"built alias bundle: {output}")
        return 0
    except (OSError, ValueError) as error:
        print(f"alias build failed: {error}", file=sys.stderr)
        return 1
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


if __name__ == "__main__":
    sys.exit(main())
