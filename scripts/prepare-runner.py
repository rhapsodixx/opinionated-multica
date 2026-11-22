#!/usr/bin/env python3
"""Render a runner bundle from an approved image release; do not start it."""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from runner_setup import prepare

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--release", type=Path, required=True)
parser.add_argument("--output", type=Path, required=True)
parser.add_argument("--server", required=True)
parser.add_argument("--workspace", required=True)
parser.add_argument("--token-file", type=Path, required=True)
parser.add_argument("--cpus", type=float, default=2)
parser.add_argument("--memory", default="4g")
args = parser.parse_args()
try:
    target = prepare(json.loads(args.release.read_text()), args.output, args.server,
                     args.workspace, args.token_file, cpus=args.cpus, memory=args.memory)
except (ValueError, OSError) as error:
    parser.exit(2, f"prepare: {error}\n")
print(f"Prepared {target}. No service was started and no token was read.")
