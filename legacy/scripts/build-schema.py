#!/usr/bin/env python3
"""Bundle local modular JSON Schemas into one deterministic production document.

This is a reference linker, not a JSON Schema instance validator. Source modules
use Draft 2020-12, JSON Pointer references and root-level IDs. Unsupported scoped
IDs and dynamic/anchor references fail explicitly instead of changing semantics.
"""

from __future__ import annotations

import argparse
import copy
import json
import os
from pathlib import Path
import sys
import tempfile
from urllib.parse import quote, unquote, urljoin, urlsplit

DIALECT = "https://json-schema.org/draft/2020-12/schema"
MAPS = {"$defs", "definitions", "properties", "patternProperties", "dependentSchemas"}
ARRAYS = {"allOf", "anyOf", "oneOf", "prefixItems"}
SINGLES = {"items", "contains", "additionalProperties", "unevaluatedProperties",
           "propertyNames", "not", "if", "then", "else", "unevaluatedItems", "contentSchema"}
UNSUPPORTED = {"$anchor", "$dynamicAnchor", "$dynamicRef", "$recursiveAnchor",
               "$recursiveRef", "$vocabulary", "dependencies", "additionalItems"}


class BuildError(ValueError):
    pass


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise BuildError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def pointer_part(value):
    return str(value).replace("~", "~0").replace("/", "~1")


def schema_nodes(node, pointer=""):
    """Visit schema positions only; examples/default/const are opaque data."""
    if not isinstance(node, (dict, bool)):
        raise BuildError(f"{pointer or '/'}: expected an object or boolean schema")
    yield pointer, node
    if isinstance(node, bool):
        return
    for key, value in node.items():
        at = f"{pointer}/{pointer_part(key)}"
        if key in MAPS:
            if not isinstance(value, dict):
                raise BuildError(f"{at}: expected a schema map")
            for name, child in value.items():
                yield from schema_nodes(child, f"{at}/{pointer_part(name)}")
        elif key in ARRAYS:
            if not isinstance(value, list) or (key != "prefixItems" and not value):
                raise BuildError(f"{at}: expected a nonempty schema array")
            for index, child in enumerate(value):
                yield from schema_nodes(child, f"{at}/{index}")
        elif key in SINGLES:
            yield from schema_nodes(value, at)


def build(source: Path, entry: str):
    source = source.resolve(strict=True)
    if not source.is_dir():
        raise BuildError(f"source is not a directory: {source}")
    modules, names, ids, positions = {}, {}, {}, {}
    for file in sorted(source.rglob("*.schema.json")):
        real = file.resolve(strict=True)
        if not real.is_relative_to(source):
            raise BuildError(f"source symlink escapes schema directory: {file}")
        name = file.relative_to(source).as_posix()
        key = name.removesuffix(".schema.json")
        if real in modules or key.casefold() in names:
            raise BuildError(f"duplicate module identity: {name}")
        names[key.casefold()] = name
        try:
            doc = json.loads(file.read_text(encoding="utf-8-sig"), object_pairs_hook=unique_object,
                             parse_constant=lambda value: (_ for _ in ()).throw(BuildError(f"invalid JSON number: {value}")))
            nodes = dict(schema_nodes(doc))
            for pointer, node in nodes.items():
                if isinstance(node, bool):
                    continue
                unsupported = UNSUPPORTED.intersection(node)
                if unsupported:
                    raise BuildError(f"{pointer or '/'}: unsupported scope/keyword: {', '.join(sorted(unsupported))}")
                if "$id" in node and pointer:
                    raise BuildError(f"{pointer}: nested $id is unsupported; use a separate module")
                if "$schema" in node and node["$schema"] != DIALECT:
                    raise BuildError(f"{pointer or '/'}: only {DIALECT} is supported")
                if "$ref" in node and not isinstance(node["$ref"], str):
                    raise BuildError(f"{pointer or '/'}: $ref must be a string")
            if isinstance(doc, dict) and "$id" in doc:
                schema_id = doc["$id"]
                if not isinstance(schema_id, str) or not urlsplit(schema_id).scheme or "#" in schema_id:
                    raise BuildError("root $id must be an absolute URI without a fragment")
                if schema_id in ids:
                    raise BuildError(f"duplicate $id: {schema_id}")
                ids[schema_id] = real
        except (ValueError, UnicodeError) as error:
            raise BuildError(f"{name}: {error}") from error
        modules[real] = (key, doc)
        positions[real] = nodes
    if not modules:
        raise BuildError(f"no *.schema.json source modules in {source}")
    entry_path = (source / entry).resolve()
    if entry_path not in modules:
        raise BuildError(f"entry is not a source module: {entry}")

    def target_of(owner, ref):
        location, separator, fragment = ref.partition("#")
        if "#" in fragment:
            raise BuildError(f"invalid reference fragment: {ref}")
        if not location:
            target = owner
        elif location in ids:
            target = ids[location]
        else:
            original = modules[owner][1]
            base_id = original.get("$id", "") if isinstance(original, dict) else ""
            logical_id = urljoin(base_id, location) if base_id else ""
            if logical_id and logical_id in ids:
                target = ids[logical_id]
            else:
                parsed = urlsplit(location)
                if parsed.scheme or parsed.netloc or parsed.query or "\\" in location:
                    raise BuildError(f"unresolved or non-local reference: {ref}")
                relative = Path(unquote(location))
                if relative.is_absolute():
                    raise BuildError(f"absolute file reference is forbidden: {ref}")
                target = (owner.parent / relative).resolve()
                if not target.is_relative_to(source):
                    raise BuildError(f"reference escapes source directory: {ref}")
        if target not in modules:
            raise BuildError(f"missing source module for reference: {ref}")
        pointer = unquote(fragment) if separator else ""
        if pointer and not pointer.startswith("/"):
            raise BuildError(f"only JSON Pointer fragments are supported: {ref}")
        if pointer not in positions[target]:
            raise BuildError(f"reference does not resolve to a schema: {ref}")
        key = modules[target][0]
        return "#" + quote(f"/$defs/{pointer_part(key)}{pointer}", safe="/~$")

    definitions = {}
    for owner, (key, doc) in modules.items():
        rewritten = copy.deepcopy(doc)
        for pointer, node in schema_nodes(rewritten):
            if isinstance(node, bool):
                continue
            if not pointer:
                node.pop("$id", None)
            node.pop("$schema", None)
            if "$ref" in node:
                try:
                    node["$ref"] = target_of(owner, node["$ref"])
                except BuildError as error:
                    raise BuildError(f"{owner.relative_to(source)}{pointer}: {error}") from error
        definitions[key] = rewritten
    entry_key = modules[entry_path][0]
    bundle = {"$schema": DIALECT, "$ref": "#" + quote(f"/$defs/{pointer_part(entry_key)}", safe="/~$"), "$defs": definitions}
    return (json.dumps(bundle, ensure_ascii=False, sort_keys=True, indent=2, allow_nan=False) + "\n").encode("utf-8")


def main(argv=None):
    runtime = Path(__file__).resolve().parent.parent
    # The package authors contracts under .claude/schema; an installed runtime
    # may expose its source modules directly under schema.
    source_default = runtime / ".claude" / "schema"
    if not source_default.is_dir():
        source_default = runtime / "schema"
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=source_default)
    parser.add_argument("--entry", default="index.schema.json", help="Entry filename relative to --source")
    parser.add_argument("--output", type=Path, default=runtime / ".dist" / "schema.json")
    parser.add_argument("--check", action="store_true", help="Fail if the existing bundle differs; never write")
    args = parser.parse_args(argv)
    temporary = None
    try:
        source = args.source.resolve(strict=True)
        output = args.output.resolve()
        if output.is_relative_to(source):
            raise BuildError("output must be outside the source directory")
        payload = build(source, args.entry)
        if args.check:
            if not output.is_file() or output.read_bytes() != payload:
                raise BuildError(f"bundle is missing or stale: {output}")
            print(f"schema bundle is current: {output}")
            return 0
        output.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=output.parent, prefix=f".{output.name}.", suffix=".tmp", delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(payload)
        os.replace(temporary, output)
        temporary = None
        print(f"built schema bundle: {output}")
        return 0
    except (OSError, ValueError) as error:
        print(f"schema build failed: {error}", file=sys.stderr)
        return 1
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


if __name__ == "__main__":
    sys.exit(main())
