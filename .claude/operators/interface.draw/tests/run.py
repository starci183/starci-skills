#!/usr/bin/env python3
"""Run operator-local tests, optionally selecting one case directory."""
import argparse
import importlib.util
from pathlib import Path
import sys
import unittest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--case", choices=("contract", "request", "response", "recovery"))
    args = parser.parse_args()
    root = Path(__file__).resolve().parent
    directory = root / args.case if args.case else root
    suite = unittest.TestSuite()
    loader = unittest.TestLoader()
    files = sorted(directory.rglob("test_*.py"))
    if not files:
        parser.error("no test files found")
    for index, file in enumerate(files):
        sys.path.insert(0, str(file.parent))
        try:
            spec = importlib.util.spec_from_file_location(f"operator_test_{index}", file)
            module = importlib.util.module_from_spec(spec)
            sys.modules[spec.name] = module
            spec.loader.exec_module(module)
            suite.addTests(loader.loadTestsFromModule(module))
        finally:
            sys.path.pop(0)
    return 0 if unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful() else 1


if __name__ == "__main__":
    sys.exit(main())
