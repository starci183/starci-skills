"""Revalidate retained real scenario artifacts; this test makes no ImageGen calls."""
import json
from pathlib import Path
import sys
import unittest

ROOT = next(p for p in Path(__file__).resolve().parents if (p / 'scripts/validate_operator.py').is_file())
sys.path.insert(0, str(ROOT / 'scripts'))
from validate_operator import load, validate

CASES = Path(__file__).resolve().parent


class RetainedScenarioTests(unittest.TestCase):
    def test_accepted_images_pass_current_criteria_and_have_adjacent_previews(self):
        bundle = load(ROOT / '.dist/operators/interface.draw.json')
        cases = [('document-filter', 'requests/document-filter-001.json', 'document-filter-response-001'),
                 ('recovery-immutable-ledger', 'request.json', 'response-recovery-immutable-ledger-002')]
        for case, request_path, response_id in cases:
            with self.subTest(case=case):
                work = CASES / case
                response = load(work / 'responses' / (response_id + '.json'))
                result = validate(bundle, load(work / request_path), response, work)
                self.assertTrue(result['accepted'], result)
                direction = next(o['file'] for o in response['outputs'] if o['id'] == 'direction')
                self.assertEqual((work / direction['path']).read_bytes(), (work / 'responses' / (response_id + '-direction.png')).read_bytes())

    def test_rejected_images_are_deleted_and_not_response_outputs(self):
        for item in load(CASES / 'rejected-image-cleanup.json')['removed']:
            self.assertFalse((CASES / item['path']).exists(), item['path'])
        for case in CASES.iterdir():
            if not case.is_dir():
                continue
            for file in (case / 'responses').glob('*.json'):
                response = load(file)
                if response['status'] == 'mismatch':
                    self.assertFalse(any(o['type'] == 'image' for o in response['outputs']))
                    self.assertTrue(response['reason'])


if __name__ == '__main__':
    unittest.main()
