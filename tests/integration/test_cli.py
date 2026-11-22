import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from runner_setup import TOOL_COMMANDS, prepare

ROOT = Path(__file__).resolve().parents[2]


class SetupCliTests(unittest.TestCase):
    def test_prepare_writes_a_complete_bundle_without_starting_docker(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifest = root / "release.json"
            manifest.write_text(json.dumps({"schema": 1,
                "image": "registry.example.test/runner@sha256:" + "a" * 64,
                "tools": {name: "1.2.3" for name in TOOL_COMMANDS}}))
            command = [sys.executable, str(ROOT / "scripts/prepare-runner.py"),
                       "--release", str(manifest), "--output", str(root / "bundle"),
                       "--server", "https://multica.example.test", "--workspace", "engineering",
                       "--token-file", str(root / "private-token")]
            result = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertTrue((root / "bundle/start-runner.sh").is_file())
            self.assertEqual(json.loads((root / "bundle/compose.json").read_text())
                             ["services"]["runner"]["cpus"], 2)

    def test_cli_rejects_mutable_images_without_creating_output(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifest = root / "release.json"
            manifest.write_text(json.dumps({"schema": 1, "image": "runner:latest",
                "tools": {name: "1.2.3" for name in TOOL_COMMANDS}}))
            result = subprocess.run([sys.executable, str(ROOT / "scripts/prepare-runner.py"),
                "--release", str(manifest), "--output", str(root / "bundle"),
                "--server", "https://multica.example.test", "--workspace", "engineering",
                "--token-file", str(root / "private-token")], capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse((root / "bundle").exists())

    def test_startup_previews_then_passes_token_only_through_stdin(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            token = root / "token"
            bundle = prepare({"schema": 1,
                "image": "registry.example.test/runner@sha256:" + "a" * 64,
                "tools": {name: "1.2.3" for name in TOOL_COMMANDS}}, root / "bundle",
                "https://multica.example.test", "engineering", token)
            script = str(bundle / "start-runner.sh")
            preview = subprocess.run(["bash", script], capture_output=True, text=True)
            self.assertEqual(preview.returncode, 0, preview.stderr)
            self.assertFalse(token.exists())
            token.write_text("synthetic-test-token")
            token.chmod(0o644)
            rejected = subprocess.run(["bash", script, "--apply"], capture_output=True, text=True)
            self.assertNotEqual(rejected.returncode, 0)
            self.assertIn("owner-only", rejected.stderr)
            token.chmod(0o600)
            bindir = root / "bin"
            bindir.mkdir()
            docker = bindir / "docker"
            docker.write_text("#!" + sys.executable + "\n" +
                "import json,os,sys\n" +
                "data=sys.stdin.read() if 'login' in sys.argv else ''\n" +
                "with open(os.environ['CALL_LOG'],'a') as f: f.write(json.dumps({'args':sys.argv[1:], 'stdin_bytes':len(data)})+'\\n')\n")
            docker.chmod(0o755)
            log = root / "calls.jsonl"
            result = subprocess.run(["bash", script, "--apply"], capture_output=True, text=True,
                env=os.environ | {"PATH": str(bindir) + os.pathsep + os.environ["PATH"],
                                  "CALL_LOG": str(log)})
            self.assertEqual(result.returncode, 0, result.stderr)
            calls = [json.loads(line) for line in log.read_text().splitlines()]
            self.assertEqual(len(calls), 3)
            self.assertEqual(calls[0]["args"][-2:], ["config", "--quiet"])
            self.assertEqual(calls[1]["stdin_bytes"], len(token.read_text()))
            self.assertEqual(calls[2]["args"][-2:], ["up", "-d"])
            self.assertNotIn(token.read_text(), log.read_text() + result.stdout + result.stderr)
