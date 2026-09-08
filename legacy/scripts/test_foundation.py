#!/usr/bin/env python3
"""Check generated v3 bundles and run foundation and operator-local offline tests."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import os
from pathlib import Path
import subprocess
import sys


def main():
    root = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--operator', help='Run only one operator test directory.')
    args = parser.parse_args()
    if subprocess.run([sys.executable, str(root / 'scripts/build.py'), '--check'], cwd=root).returncode:
        return 1
    directory = root / '.claude/operators'
    if args.operator:
        directory = directory / args.operator
        if directory.parent != root / '.claude/operators' or not directory.is_dir():
            parser.error('unknown operator')
    folders = [directory] if args.operator else sorted(p for p in directory.iterdir() if p.is_dir())
    files = []
    for folder in folders:
        tests = sorted((folder / 'tests').rglob('test_*.py'))
        runner = folder / 'tests/run.py'
        if tests:
            files.extend(tests)
        elif runner.is_file():
            files.append(runner)
        else:
            parser.error(f'no tests for {folder.name}')
    if not args.operator:
        files = [root / 'scripts' / name for name in ('test_build_schema.py', 'test_build_alias.py', 'test_works_schema.py', 'test_operator_catalog.py')] + files
    if not files:
        parser.error('no tests found')
    env = dict(os.environ, PYTHONPATH=os.pathsep.join(str(Path(p).resolve()) for p in sys.path))
    def run(file):
        result = subprocess.run([sys.executable, str(file)], cwd=root, env=env, capture_output=True, text=True)
        return file, result
    failed = []
    with ThreadPoolExecutor(max_workers=3) as pool:
        for file, result in pool.map(run, files):
            print(('PASS' if result.returncode == 0 else 'FAIL') + ' ' + file.relative_to(root).as_posix())
            if result.returncode:
                failed.append(file)
                print(result.stdout + result.stderr)
    print(f'{len(files) - len(failed)}/{len(files)} offline test files passed. Live scenarios are documented separately; no external actions ran.')
    return int(bool(failed))


if __name__ == '__main__':
    sys.exit(main())
