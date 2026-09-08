#!/usr/bin/env python3
"""Build schema, alias and operator production bundles into .dist/."""
import argparse
from pathlib import Path
import subprocess
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Check both bundles without writing")
    args = parser.parse_args()
    for name in ("build-schema.py", "build-alias.py", "build-operators.py"):
        command = [sys.executable, str(Path(__file__).with_name(name))]
        if args.check:
            command.append("--check")
        result = subprocess.run(command)
        if result.returncode:
            return result.returncode
    return 0


if __name__ == "__main__":
    sys.exit(main())
