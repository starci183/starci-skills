"""Contract and failure-path tests for the modular alias builder."""
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "scripts/build-alias.py"
spec = importlib.util.spec_from_file_location("build_alias", SCRIPT)
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class AliasBuildTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory(prefix="starci-alias-")
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.source = self.root / "source"
        shutil.copytree(ROOT / ".claude/alias", self.source)
        self.output = self.root / ".dist/alias.json"

    def change(self, file, mutate):
        path = self.source / file
        doc = json.loads(path.read_text(encoding="utf-8"))
        mutate(doc)
        path.write_text(json.dumps(doc), encoding="utf-8")

    def cli(self, *args):
        return subprocess.run([sys.executable, str(SCRIPT), "--source", str(self.source),
                               "--output", str(self.output), *args], capture_output=True, text=True)

    def test_namespaces_and_execution_boundary(self):
        bundle = json.loads(builder.build(self.source))
        aliases = bundle["aliases"]
        self.assertEqual(set(bundle["zones"]), {"workspaces", "tools", "cli", "remote"})
        self.assertEqual(aliases["@tools/browsercontrol"]["invocation"], {"capability": "browsercontrol"})
        self.assertEqual(aliases["@cli/browser-walk"]["invocation"],
                         {"executable": "node", "arguments": ["scripts/browser-walk.mjs"]})
        self.assertEqual(aliases["@cli/git"]["kind"], "cli")
        self.assertEqual(aliases["@remote/git"]["kind"], "service")
        self.assertEqual(aliases["@workspaces/inputs"]["resolvesTo"], "<Workspace>/.works/<workId>/inputs/")
        self.assertEqual(aliases["@workspaces/schema"]["resolvesTo"], "<Runtime>/.dist/schema.json")
        for forbidden in ("@dynamic", "@dir", "worktree", "@tools/git", "@tools/shell"):
            self.assertNotIn(forbidden, json.dumps(bundle).lower())
        self.assertEqual((ROOT / ".dist/alias.json").read_bytes(), builder.build(self.source))

    def test_determinism_and_stale_check_never_writes(self):
        self.assertEqual(self.cli().returncode, 0)
        before = self.output.read_bytes()
        self.assertEqual(self.cli().returncode, 0)
        self.assertEqual(self.output.read_bytes(), before)
        self.assertEqual(self.cli("--check").returncode, 0)
        self.change("index.json", lambda d: d.update(note="Changed registry note"))
        self.assertEqual(self.cli("--check").returncode, 1)
        self.assertEqual(self.output.read_bytes(), before)

    def test_duplicate_alias_is_not_silently_overwritten(self):
        alias = json.loads((self.source / "cli.json").read_text())["aliases"]["@cli/git"]
        self.change("remote.json", lambda d: d["aliases"].update({"@cli/git": alias}))
        with self.assertRaisesRegex(builder.BuildError, "duplicate alias"):
            builder.build(self.source)

    def test_missing_unlisted_and_escaping_modules(self):
        original = (self.source / "index.json").read_bytes()
        for name in ("missing.json", "../outside.json"):
            with self.subTest(name=name):
                (self.root / "outside.json").write_text("{}")
                (self.source / "index.json").write_bytes(original)
                self.change("index.json", lambda d: d["modules"].append(name))
                with self.assertRaises((builder.BuildError, OSError)):
                    builder.build(self.source)
        (self.source / "index.json").write_bytes(original)
        (self.source / "forgotten.json").write_text("{}")
        with self.assertRaisesRegex(builder.BuildError, "unlisted"):
            builder.build(self.source)

    def test_invalid_definitions_leave_previous_bundle(self):
        original = (self.source / "cli.json").read_bytes()
        mutations = [lambda a: a.update(typo=True), lambda a: a.update(kind="tool"),
                     lambda a: a.update(kind=[]), lambda a: a.update(zone="tools"),
                     lambda a: a.update(invocation={"capability": "git"}),
                     lambda a: a.update(writers=["same", "same"]),
                     lambda a: a.pop("bind")]
        self.output.parent.mkdir()
        self.output.write_bytes(b"previous bundle")
        for mutation in mutations:
            (self.source / "cli.json").write_bytes(original)
            self.change("cli.json", lambda d: mutation(d["aliases"]["@cli/git"]))
            result = self.cli()
            self.assertEqual(result.returncode, 1, result.stderr)
            self.assertNotIn("Traceback", result.stderr)
            self.assertEqual(self.output.read_bytes(), b"previous bundle")
            self.assertEqual(list(self.output.parent.glob("*.tmp")), [])

    def test_duplicate_json_keys_and_invalid_numbers(self):
        for text in ('{"aliases":{},"aliases":{}}', '{"aliases":NaN}'):
            (self.source / "cli.json").write_text(text)
            with self.assertRaises(builder.BuildError):
                builder.build(self.source)

    def test_output_cannot_overwrite_source(self):
        source = self.source / "cli.json"
        before = source.read_bytes()
        self.assertEqual(self.cli("--output", str(source)).returncode, 1)
        self.assertEqual(source.read_bytes(), before)

    def test_removed_namespace_and_wrong_version_are_rejected(self):
        original = (self.source / "index.json").read_bytes()
        self.change("index.json", lambda d: d["zones"].update(dynamic={"en": "removed"}))
        with self.assertRaises(builder.BuildError):
            builder.build(self.source)
        (self.source / "index.json").write_bytes(original)
        self.change("index.json", lambda d: d.update(schemaVersion=True))
        with self.assertRaises(builder.BuildError):
            builder.build(self.source)


if __name__ == "__main__":
    unittest.main()
