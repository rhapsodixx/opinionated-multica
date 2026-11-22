"""Select explicit Node suites and reject incomplete test results."""
import re


def node_command(root, layer):
    if layer == "unit":
        return ["npm", "run", "test:fast"]
    selected = sorted((root / "test" / "integration").glob("*.test.mjs"))
    if not selected:
        raise ValueError("No integration tests selected; refusing Node auto-discovery")
    return ["node", "--test", *map(str, selected)]


def node_result(output, code):
    counts = {name: int(match[1]) if (match := re.search(r"(?:#|ℹ) " + name + r" (\d+)", output)) else 0
              for name in ("tests", "pass", "fail", "skipped", "cancelled", "todo")}
    counts["ok"] = (code == 0 and counts["tests"] > 0 and counts["pass"] == counts["tests"]
                    and not any(counts[name] for name in ("fail", "skipped", "cancelled", "todo")))
    return counts
