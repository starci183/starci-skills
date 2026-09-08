"""Cross-operator production contract checks; does not execute operator side effects."""
import json
from pathlib import Path
import unittest
from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parent.parent


class OperatorCatalogTests(unittest.TestCase):
    def test_all_existing_operator_ids_have_complete_v3_packages(self):
        expected = {json.loads(file.read_text(encoding='utf-8'))['id'] for file in (ROOT / 'operators').glob('*/operator.json')}
        sources = {p.name for p in (ROOT / '.claude/operators').iterdir() if p.is_dir()}
        self.assertEqual(sources, expected)
        self.assertEqual({p.stem for p in (ROOT / '.dist/operators').glob('*.json')}, expected)
        for operator_id in sorted(expected):
            with self.subTest(operator=operator_id):
                source = ROOT / '.claude/operators' / operator_id
                manifest = json.loads((source / 'operator.json').read_text(encoding='utf-8'))
                self.assertEqual(set(manifest['modules']), {'request', 'response', 'validate', 'step', 'criteria'})
                self.assertTrue((source / 'README.md').is_file())
                self.assertTrue(list((source / 'tests').rglob('test_*.py')) or (source / 'tests/run.py').is_file())
                bundle = json.loads((ROOT / '.dist/operators' / (operator_id + '.json')).read_text(encoding='utf-8'))
                for kind in ('request', 'response'):
                    Draft202012Validator.check_schema({'$defs': bundle['$defs'], 'allOf': [bundle[kind]]})
                self.assertTrue(bundle['validate']['review'])
                self.assertGreaterEqual(len(bundle['step']['steps']), 3)
                self.assertNotIn('recovery', bundle)
                for alias in bundle['aliases']:
                    self.assertTrue(alias == '@workspaces' or alias.startswith(('@workspaces/', '@tools/', '@cli/', '@remote/')))


if __name__ == '__main__':
    unittest.main()
