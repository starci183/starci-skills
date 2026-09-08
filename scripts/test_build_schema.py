"""Offline integration tests for the Python schema bundle CLI."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).with_name("build-schema.py")
spec = importlib.util.spec_from_file_location("build_schema", SCRIPT)
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class SchemaBuildTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="starci-schema-build-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / "schema"
        self.source.mkdir()
        self.output = self.root / "schema.json"

    def write(self, name, value):
        file = self.source / name
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(json.dumps(value), encoding="utf-8")
        return file

    def run_cli(self, *args):
        return subprocess.run([sys.executable, str(SCRIPT), "--source", str(self.source),
                               "--output", str(self.output), *args], capture_output=True, text=True)

    def test_cross_file_local_and_recursive_refs_preserve_siblings_and_literal_data(self):
        self.write("index.schema.json", {"type": "object", "additionalProperties": False,
                   "required": ["id"], "properties": {"id": {"$ref": "common.schema.json#/$defs/id", "maxLength": 10},
                   "next": {"$ref": "#"}}, "const": {"$ref": "literal-not-a-file", "$id": "literal"}})
        self.write("common.schema.json", {"$defs": {"id": {"type": "string", "minLength": 1}}})
        result = self.run_cli()
        self.assertEqual(result.returncode, 0, result.stderr)
        bundle = json.loads(self.output.read_text(encoding="utf-8"))
        entry = bundle["$defs"]["index"]
        self.assertEqual(bundle["$ref"], "#/$defs/index")
        self.assertEqual(entry["properties"]["id"], {"$ref": "#/$defs/common/$defs/id", "maxLength": 10})
        self.assertEqual(entry["properties"]["next"]["$ref"], "#/$defs/index")
        self.assertEqual(entry["const"], {"$ref": "literal-not-a-file", "$id": "literal"})
        self.assertEqual(entry["required"], ["id"])
        self.assertFalse(entry["additionalProperties"])

    def test_schema_id_aliases_and_subdirectory_pointers(self):
        self.write("index.schema.json", {"$id": "https://example.invalid/index.schema.json", "$ref": "common.schema.json"})
        self.write("nested/common.schema.json", {"$id": "https://example.invalid/common.schema.json", "$defs": {"a/b~c": False}, "$ref": "#/$defs/a~1b~0c"})
        bundle = json.loads(builder.build(self.source, "index.schema.json"))
        self.assertEqual(bundle["$defs"]["index"]["$ref"], "#/$defs/nested~1common")
        self.assertEqual(bundle["$defs"]["nested/common"]["$ref"], "#/$defs/nested~1common/$defs/a~1b~0c")
        self.assertNotIn("$id", bundle["$defs"]["index"])

    def test_check_is_deterministic_and_never_updates_stale_output(self):
        self.write("index.schema.json", {"type": "string"})
        self.assertEqual(self.run_cli().returncode, 0)
        before = self.output.read_bytes()
        self.assertEqual(self.run_cli("--check").returncode, 0)
        self.assertEqual(self.run_cli().returncode, 0)
        self.assertEqual(self.output.read_bytes(), before)
        self.write("index.schema.json", {"type": "integer"})
        self.assertEqual(self.run_cli("--check").returncode, 1)
        self.assertEqual(self.output.read_bytes(), before)

    def test_invalid_refs_leave_last_production_bundle_untouched(self):
        for ref in ["missing.schema.json", "#/$defs/missing", "../outside.schema.json",
                    "https://example.invalid/remote", "#anchor", "#/description"]:
            with self.subTest(ref=ref):
                self.output.write_bytes(b"previous production bundle")
                self.write("index.schema.json", {"$ref": ref, "description": "not a schema"})
                result = self.run_cli()
                self.assertEqual(result.returncode, 1, result.stderr)
                self.assertEqual(self.output.read_bytes(), b"previous production bundle")
                self.assertEqual(list(self.root.glob("*.tmp")), [])

    def test_duplicate_ids_keys_and_module_names_are_refused(self):
        self.write("index.schema.json", {"$id": "urn:test:index"})
        other = self.write("other.schema.json", {"$id": "urn:test:index"})
        with self.assertRaisesRegex(builder.BuildError, "duplicate.*id"):
            builder.build(self.source, "index.schema.json")
        other.unlink()
        (self.source / "index.schema.json").write_text('{"type":"string","type":"integer"}', encoding="utf-8")
        with self.assertRaisesRegex(builder.BuildError, "duplicate JSON key"):
            builder.build(self.source, "index.schema.json")
        self.write("index.schema.json", {})
        self.write("nested/A.schema.json", {})
        self.write("NESTED/a.schema.json", {})
        # Case-insensitive filesystems may replace a file instead of creating a collision.
        if len(list(self.source.rglob("*.schema.json"))) == 3:
            with self.assertRaisesRegex(builder.BuildError, "duplicate module identity"):
                builder.build(self.source, "index.schema.json")

    def test_unsupported_scope_and_non_schema_nodes_fail_explicitly(self):
        for value in [{"$defs": {"scoped": {"$id": "urn:nested"}}},
                      {"$dynamicRef": "#node"}, {"$schema": "http://json-schema.org/draft-07/schema#"},
                      {"items": []}, {"$ref": 3}, {"$anchor": "node"}]:
            with self.subTest(value=value):
                self.write("index.schema.json", value)
                with self.assertRaises(builder.BuildError):
                    builder.build(self.source, "index.schema.json")

    def test_boolean_schema_and_empty_input(self):
        with self.assertRaisesRegex(builder.BuildError, "no .* source modules"):
            builder.build(self.source, "index.schema.json")
        self.write("index.schema.json", False)
        self.assertIs(json.loads(builder.build(self.source, "index.schema.json"))["$defs"]["index"], False)

    def test_output_inside_source_is_refused(self):
        self.write("index.schema.json", True)
        result = self.run_cli("--output", str(self.source / "prod.schema.json"))
        self.assertEqual(result.returncode, 1)
        self.assertFalse((self.source / "prod.schema.json").exists())


if __name__ == "__main__":
    unittest.main()
