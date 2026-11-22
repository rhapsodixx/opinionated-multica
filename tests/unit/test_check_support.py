import tempfile
import unittest
from pathlib import Path
from scripts.check_support import node_command, node_result


class NodeGateTests(unittest.TestCase):
    def test_empty_integration_selection_never_falls_back_to_auto_discovery(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with self.assertRaisesRegex(ValueError, "No integration"):
                node_command(root, "integration")
            folder = root / "test/integration"
            folder.mkdir(parents=True)
            case = folder / "cli.test.mjs"
            case.write_text("// selected test")
            self.assertEqual(node_command(root, "integration"), ["node", "--test", str(case)])
        self.assertEqual(node_command(Path('.'), 'unit'), ['npm', 'run', 'test:fast'])

    def test_node_todo_incomplete_missing_and_failed_results_cannot_pass(self):
        good = "# tests 2\n# pass 2\n# fail 0\n# skipped 0\n# cancelled 0\n# todo 0\n"
        self.assertTrue(node_result(good, 0)["ok"])
        for output, code in ((good.replace("pass 2", "pass 0").replace("todo 0", "todo 2"), 0),
                             (good.replace("pass 2", "pass 1"), 0), ("", 0),
                             (good.replace("skipped 0", "skipped 1"), 0),
                             (good.replace("cancelled 0", "cancelled 1"), 0),
                             (good.replace("fail 0", "fail 1"), 0), (good, 1)):
            with self.subTest(output=output, code=code):
                self.assertFalse(node_result(output, code)["ok"])
