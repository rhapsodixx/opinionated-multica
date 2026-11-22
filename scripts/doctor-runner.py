#!/usr/bin/env python3
"""Check installed tool versions inside the selected runner image."""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from runner_setup import doctor

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--release", type=Path, required=True)
args = parser.parse_args()
try:
    results = doctor(json.loads(args.release.read_text()))
except (ValueError, OSError) as error:
    parser.exit(2, f"doctor: {error}\n")
print(json.dumps(results, indent=2))
sys.exit(0 if all(row["ok"] for row in results) else 1)
