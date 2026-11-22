#!/usr/bin/env python3
"""Run this repository's local full/fast checks and emit honest coverage by layer."""
import argparse
import io
import json
import os
import re
import subprocess
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from coverage import Coverage

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("mode", choices=["full", "fast"], nargs="?", default="full")
args = parser.parse_args()
report_dir = ROOT / "reports" / args.mode
report_dir.mkdir(parents=True, exist_ok=True)
coverage = Coverage(data_file=str(report_dir / ".coverage"), config_file=str(ROOT / "pyproject.toml"))
coverage.start()
from scripts.check_support import node_command, node_result
layers = {}
ok = True
for layer in (["unit", "integration"] if args.mode == "full" else ["unit"]):
    suite = unittest.TestLoader().discover(str(ROOT / "tests" / layer))
    output = io.StringIO()
    selected = suite.countTestCases()
    result = unittest.TextTestRunner(stream=output, verbosity=2).run(suite)
    text = output.getvalue()
    print(text, end="")
    (report_dir / f"{layer}.log").write_text(text)
    failed = len(result.failures) + len(result.errors) + len(result.unexpectedSuccesses)
    layers[layer] = {"selected": selected,
                     "run": result.testsRun, "failed": failed, "skipped": len(result.skipped),
                     "expected_failures": len(result.expectedFailures),
                     "passed": result.testsRun - failed - len(result.skipped) - len(result.expectedFailures)}
    ok = ok and result.wasSuccessful() and result.testsRun > 0 and not result.skipped and not result.expectedFailures
coverage.stop()
coverage.save()
coverage.json_report(outfile=str(report_dir / "coverage.json"))
coverage.xml_report(outfile=str(report_dir / "coverage.xml"))
percent = coverage.report()
ok = ok and percent >= 85
node_coverage = None
for layer in (["unit", "integration"] if args.mode == "full" else ["unit"]):
    try:
        command = node_command(ROOT, layer)
        result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True,
                                env=os.environ | {"NO_COLOR": "1"})
        output = result.stdout + result.stderr
        counts = node_result(output, result.returncode)
        passed = counts["ok"]
        if layer == "unit":
            match = re.search(r"all files\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)", output)
            passed = passed and match is not None
            if match:
                node_coverage = {"line_percent": float(match[1]), "branch_percent": float(match[2]),
                                 "function_percent": float(match[3]), "source": "lib/*.mjs"}
        layers["node_" + layer] = {"run": counts["tests"], "passed": counts["pass"],
            "failed": counts["fail"], "skipped": counts["skipped"], "cancelled": counts["cancelled"], "todo": counts["todo"], "result": "passed" if passed else "failed"}
    except (OSError, ValueError) as error:
        passed, output = False, f"Node check unavailable: {error}\n"
        layers["node_" + layer] = {"result": "failed", "reason": output.strip()}
    print(output, end="")
    (report_dir / f"node-{layer}.log").write_text(output)
    ok = ok and passed
for script in [*(ROOT / "runner").glob("*.sh"), ROOT / "setup.sh"]:
    result = subprocess.run(["bash", "-n", str(script)], capture_output=True, text=True)
    ok = ok and result.returncode == 0
    if result.returncode:
        print(result.stderr, file=sys.stderr)
totals = json.loads((report_dir / "coverage.json").read_text())["totals"]
summary = {
    "mode": args.mode, "time_utc": datetime.now(timezone.utc).isoformat(),
    "time_wib": datetime.now(timezone(timedelta(hours=7))).isoformat(),
    "result": "passed" if ok else "failed", "layers": layers,
    "unit_code_coverage": {
        "line_percent": round(100 * totals["covered_lines"] / totals["num_statements"], 2),
        "branch_percent": round(100 * totals["covered_branches"] / totals["num_branches"], 2)
                          if totals["num_branches"] else None,
        "combined_percent": round(percent, 2), "source": "runner_setup.py, runner/install-image-tools.py and scripts/check_support.py",
    },
    "node_code_coverage": node_coverage,
    "functional_ui": {"status": "not_applicable", "reason": "This repository has setup helpers, not a UI."},
    "not_run": ["integration", "node_integration"] if args.mode == "fast" else [],
    "limits": ["No image build, Multica login, live service or product UI test runs in this check."],
}
(report_dir / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
print(json.dumps(summary, indent=2))
sys.exit(0 if ok else 1)
